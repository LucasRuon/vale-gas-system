const express = require('express');
const router = express.Router();
const { getQuery, allQuery, runQuery } = require('../database');
const { autenticarAdmin, verificarNivel, hashSenha } = require('../auth');
const {
    validarCPF,
    validarCNPJ,
    limparDocumento,
    gerarSenhaAleatoria,
    gerarCodigoVale,
    getMesReferencia,
    getDataExpiracao,
    buscarCoordenadasPorEndereco,
    getConfiguracao,
    limparCacheConfiguracoes
} = require('../utils');
const { notificarSenhaGerada, notificarCodigoGerado } = require('../webhooks');
const { ACOES, registrarAuditoria, buscarLogs, getClientIP } = require('../auditoria');

// Função auxiliar para buscar configuração (agora usa cache)
const getConfig = async (chave, valorPadrao = null) => {
    try {
        return await getConfiguracao(chave, valorPadrao);
    } catch (error) {
        console.error('Erro ao buscar configuração:', error);
        return valorPadrao;
    }
};

// Aplicar autenticação de admin em todas as rotas
router.use(autenticarAdmin);

// ========================================
// COLABORADORES
// ========================================

// Listar todos os colaboradores
router.get('/colaboradores', async (req, res) => {
    try {
        const { ativo, busca, pagina = 1, limite = 20 } = req.query;
        const offset = (pagina - 1) * limite;

        let sql = 'SELECT * FROM colaboradores WHERE 1=1';
        const params = [];

        // Só filtra por ativo se o valor for 'true' ou 'false' explicitamente
        if (ativo === 'true' || ativo === 'false') {
            sql += ' AND ativo = ?';
            params.push(ativo === 'true' ? 1 : 0);
        }

        if (busca) {
            sql += ' AND (nome LIKE ? OR cpf LIKE ? OR email LIKE ? OR matricula LIKE ?)';
            const buscaLike = `%${busca}%`;
            params.push(buscaLike, buscaLike, buscaLike, buscaLike);
        }

        // Contar total
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await getQuery(countSql, params);
        const total = countResult.total;

        // Buscar com paginação
        sql += ' ORDER BY nome ASC LIMIT ? OFFSET ?';
        params.push(parseInt(limite), parseInt(offset));

        const colaboradores = await allQuery(sql, params);

        // Remover senhas da resposta
        const colaboradoresSemSenha = colaboradores.map(c => {
            const { senha, ...dados } = c;
            return dados;
        });

        res.json({
            sucesso: true,
            dados: colaboradoresSemSenha,
            paginacao: {
                total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(total / limite)
            }
        });

    } catch (error) {
        console.error('Erro ao listar colaboradores:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Buscar colaborador por ID
router.get('/colaboradores/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const colaborador = await getQuery(
            'SELECT * FROM colaboradores WHERE id = ?',
            [id]
        );

        if (!colaborador) {
            return res.status(404).json({ erro: 'Colaborador não encontrado' });
        }

        // Remover senha
        const { senha, ...dados } = colaborador;

        res.json({ sucesso: true, dados });

    } catch (error) {
        console.error('Erro ao buscar colaborador:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Criar novo colaborador
router.post('/colaboradores', async (req, res) => {
    try {
        const {
            nome, cpf, email, telefone,
            cep, logradouro, numero, complemento, bairro, cidade, estado,
            data_admissao, matricula, setor
        } = req.body;

        // Validações
        if (!nome || !cpf || !email || !telefone || !cep || !logradouro || 
            !numero || !bairro || !cidade || !estado || !data_admissao) {
            return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos' });
        }

        const cpfLimpo = limparDocumento(cpf);
        
        if (!validarCPF(cpfLimpo)) {
            return res.status(400).json({ erro: 'CPF inválido' });
        }

        // Verificar se CPF já existe
        const cpfExiste = await getQuery('SELECT id FROM colaboradores WHERE cpf = ?', [cpfLimpo]);
        if (cpfExiste) {
            return res.status(400).json({ erro: 'CPF já cadastrado' });
        }

        // Verificar se email já existe
        const emailExiste = await getQuery('SELECT id FROM colaboradores WHERE email = ?', [email]);
        if (emailExiste) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }

        // Verificar matrícula se fornecida
        if (matricula) {
            const matriculaExiste = await getQuery('SELECT id FROM colaboradores WHERE matricula = ?', [matricula]);
            if (matriculaExiste) {
                return res.status(400).json({ erro: 'Matrícula já cadastrada' });
            }
        }

        // Gerar senha aleatória
        const senhaTemporaria = gerarSenhaAleatoria(8);
        const senhaHash = await hashSenha(senhaTemporaria);

        // Inserir colaborador
        const result = await runQuery(
            `INSERT INTO colaboradores 
            (nome, cpf, email, telefone, senha, cep, logradouro, numero, complemento, bairro, cidade, estado, data_admissao, matricula, setor) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, cpfLimpo, email, telefone, senhaHash, cep, logradouro, numero, complemento || '', bairro, cidade, estado, data_admissao, matricula || null, setor || null]
        );

        // Registrar auditoria
        await registrarAuditoria({
            tipo_usuario: 'admin',
            usuario_id: req.usuario.id,
            usuario_nome: req.usuario.nome,
            acao: ACOES.CRIAR_COLABORADOR,
            entidade: 'colaborador',
            entidade_id: result.lastID,
            detalhes: { nome, cpf: cpfLimpo, email },
            ip: getClientIP(req)
        });

        // Enviar webhook com a senha temporária
        await notificarSenhaGerada('colaborador', {
            id: result.lastID,
            nome,
            email,
            telefone
        }, senhaTemporaria);

        res.status(201).json({ 
            sucesso: true, 
            mensagem: 'Colaborador criado com sucesso',
            id: result.lastID,
            senha_temporaria: senhaTemporaria // Retorna para exibir no admin (opcional)
        });

    } catch (error) {
        console.error('Erro ao criar colaborador:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Importar colaboradores em massa
router.post('/colaboradores/importar', verificarNivel('admin'), async (req, res) => {
    try {
        const { colaboradores } = req.body;
        
        if (!colaboradores || !Array.isArray(colaboradores) || colaboradores.length === 0) {
            return res.status(400).json({ erro: 'Nenhum colaborador para importar' });
        }
        
        if (colaboradores.length > 500) {
            return res.status(400).json({ erro: 'Máximo de 500 colaboradores por importação' });
        }
        
        const resultados = {
            importados: 0,
            erros: [],
            senhas: []
        };
        
        for (const colab of colaboradores) {
            try {
                const { nome, cpf, email, telefone, cidade, estado, data_admissao, matricula, setor } = colab;
                
                // Limpar CPF
                const cpfLimpo = cpf.replace(/\D/g, '');
                
                // Validar CPF
                if (!validarCPF(cpfLimpo)) {
                    resultados.erros.push(`${nome}: CPF inválido`);
                    continue;
                }
                
                // Verificar se já existe
                const existe = await getQuery(
                    'SELECT id FROM colaboradores WHERE cpf = ? OR email = ?',
                    [cpfLimpo, email]
                );
                
                if (existe) {
                    resultados.erros.push(`${nome}: CPF ou Email já cadastrado`);
                    continue;
                }
                
                // Gerar senha
                const senhaTemporaria = gerarSenhaAleatoria(8);
                const senhaHash = await hashSenha(senhaTemporaria);
                
                // Inserir
                const result = await runQuery(`
                    INSERT INTO colaboradores (
                        nome, cpf, email, telefone, cidade, estado, 
                        data_admissao, matricula, setor, senha, ativo
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `, [nome, cpfLimpo, email, telefone, cidade, estado.toUpperCase(), 
                    data_admissao, matricula || null, setor || null, senhaHash]);
                
                resultados.importados++;
                resultados.senhas.push({
                    nome,
                    cpf: cpfLimpo,
                    email,
                    senha: senhaTemporaria
                });
                
                // Enviar webhook (opcional, pode ser lento para muitos)
                // Comentado para performance - descomente se quiser notificar cada um
                // await notificarSenhaGerada('colaborador', { id: result.lastID, nome, email, telefone }, senhaTemporaria);
                
            } catch (err) {
                resultados.erros.push(`${colab.nome}: ${err.message}`);
            }
        }
        
        // Registrar auditoria
        await registrarAuditoria({
            tipo_usuario: 'admin',
            usuario_id: req.usuario.id,
            usuario_nome: req.usuario.nome,
            acao: 'importar_colaboradores',
            detalhes: { 
                total_enviado: colaboradores.length,
                importados: resultados.importados,
                erros: resultados.erros.length
            },
            ip: getClientIP(req)
        });
        
        res.json({
            sucesso: true,
            importados: resultados.importados,
            erros: resultados.erros,
            senhas: resultados.senhas
        });
        
    } catch (error) {
        console.error('Erro ao importar colaboradores:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Atualizar colaborador
router.put('/colaboradores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nome, email, telefone,
            cep, logradouro, numero, complemento, bairro, cidade, estado,
            data_admissao, matricula, setor, ativo
        } = req.body;

        // Verificar se colaborador existe
        const colaborador = await getQuery('SELECT id FROM colaboradores WHERE id = ?', [id]);
        if (!colaborador) {
            return res.status(404).json({ erro: 'Colaborador não encontrado' });
        }

        // Verificar email se foi alterado
        if (email) {
            const emailExiste = await getQuery(
                'SELECT id FROM colaboradores WHERE email = ? AND id != ?', 
                [email, id]
            );
            if (emailExiste) {
                return res.status(400).json({ erro: 'Email já cadastrado por outro colaborador' });
            }
        }

        // Verificar matrícula se foi alterada
        if (matricula) {
            const matriculaExiste = await getQuery(
                'SELECT id FROM colaboradores WHERE matricula = ? AND id != ?', 
                [matricula, id]
            );
            if (matriculaExiste) {
                return res.status(400).json({ erro: 'Matrícula já cadastrada por outro colaborador' });
            }
        }

        // Montar query dinâmica com whitelist de campos permitidos
        const camposPermitidos = {
            nome, email, telefone, cep, logradouro, numero, complemento,
            bairro, cidade, estado, data_admissao, matricula, setor, ativo
        };

        const campos = [];
        const valores = [];

        // Validar e adicionar apenas campos permitidos
        if (nome !== undefined) { campos.push('nome = ?'); valores.push(nome); }
        if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
        if (telefone !== undefined) { campos.push('telefone = ?'); valores.push(telefone); }
        if (cep !== undefined) { campos.push('cep = ?'); valores.push(cep); }
        if (logradouro !== undefined) { campos.push('logradouro = ?'); valores.push(logradouro); }
        if (numero !== undefined) { campos.push('numero = ?'); valores.push(numero); }
        if (complemento !== undefined) { campos.push('complemento = ?'); valores.push(complemento); }
        if (bairro !== undefined) { campos.push('bairro = ?'); valores.push(bairro); }
        if (cidade !== undefined) { campos.push('cidade = ?'); valores.push(cidade); }
        if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }
        if (data_admissao !== undefined) { campos.push('data_admissao = ?'); valores.push(data_admissao); }
        if (matricula !== undefined) { campos.push('matricula = ?'); valores.push(matricula); }
        if (setor !== undefined) { campos.push('setor = ?'); valores.push(setor); }
        if (ativo !== undefined) { campos.push('ativo = ?'); valores.push(ativo ? 1 : 0); }

        // Verificar se há pelo menos um campo para atualizar
        if (campos.length === 0) {
            return res.status(400).json({ erro: 'Nenhum campo fornecido para atualização' });
        }

        campos.push('atualizado_em = CURRENT_TIMESTAMP');
        valores.push(id);

        await runQuery(
            `UPDATE colaboradores SET ${campos.join(', ')} WHERE id = ?`,
            valores
        );

        res.json({ sucesso: true, mensagem: 'Colaborador atualizado com sucesso' });

    } catch (error) {
        console.error('Erro ao atualizar colaborador:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Resetar senha do colaborador
router.post('/colaboradores/:id/resetar-senha', async (req, res) => {
    try {
        const { id } = req.params;

        const colaborador = await getQuery(
            'SELECT id, nome, email, telefone FROM colaboradores WHERE id = ?',
            [id]
        );

        if (!colaborador) {
            return res.status(404).json({ erro: 'Colaborador não encontrado' });
        }

        // Gerar nova senha
        const novaSenha = gerarSenhaAleatoria(8);
        const senhaHash = await hashSenha(novaSenha);

        await runQuery(
            'UPDATE colaboradores SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [senhaHash, id]
        );

        // Enviar webhook
        await notificarSenhaGerada('colaborador', colaborador, novaSenha);

        res.json({ 
            sucesso: true, 
            mensagem: 'Senha resetada com sucesso',
            nova_senha: novaSenha
        });

    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Excluir colaborador (soft delete)
router.delete('/colaboradores/:id', verificarNivel('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const colaborador = await getQuery('SELECT id FROM colaboradores WHERE id = ?', [id]);
        if (!colaborador) {
            return res.status(404).json({ erro: 'Colaborador não encontrado' });
        }

        await runQuery(
            'UPDATE colaboradores SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        res.json({ sucesso: true, mensagem: 'Colaborador desativado com sucesso' });

    } catch (error) {
        console.error('Erro ao excluir colaborador:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// DISTRIBUIDORES
// ========================================

// Listar todos os distribuidores
router.get('/distribuidores', async (req, res) => {
    try {
        const { ativo, busca, pagina = 1, limite = 20 } = req.query;
        const offset = (pagina - 1) * limite;

        let sql = 'SELECT * FROM distribuidores WHERE 1=1';
        const params = [];

        // Só filtra por ativo se o valor for 'true' ou 'false' explicitamente
        if (ativo === 'true' || ativo === 'false') {
            sql += ' AND ativo = ?';
            params.push(ativo === 'true' ? 1 : 0);
        }

        if (busca) {
            sql += ' AND (nome LIKE ? OR cnpj LIKE ? OR email LIKE ? OR cidade LIKE ?)';
            const buscaLike = `%${busca}%`;
            params.push(buscaLike, buscaLike, buscaLike, buscaLike);
        }

        // Contar total
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const countResult = await getQuery(countSql, params);
        const total = countResult.total;

        // Buscar com paginação
        sql += ' ORDER BY nome ASC LIMIT ? OFFSET ?';
        params.push(parseInt(limite), parseInt(offset));

        const distribuidores = await allQuery(sql, params);

        // Remover senhas
        const distribuidoresSemSenha = distribuidores.map(d => {
            const { senha, ...dados } = d;
            return dados;
        });

        res.json({
            sucesso: true,
            dados: distribuidoresSemSenha,
            paginacao: {
                total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(total / limite)
            }
        });

    } catch (error) {
        console.error('Erro ao listar distribuidores:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Buscar distribuidor por ID
router.get('/distribuidores/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const distribuidor = await getQuery(
            'SELECT * FROM distribuidores WHERE id = ?',
            [id]
        );

        if (!distribuidor) {
            return res.status(404).json({ erro: 'Distribuidor não encontrado' });
        }

        const { senha, ...dados } = distribuidor;

        res.json({ sucesso: true, dados });

    } catch (error) {
        console.error('Erro ao buscar distribuidor:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Criar novo distribuidor
router.post('/distribuidores', async (req, res) => {
    try {
        const {
            nome, cnpj, email, telefone, responsavel,
            cep, logradouro, numero, complemento, bairro, cidade, estado,
            horario_funcionamento
        } = req.body;

        // Validações
        if (!nome || !cnpj || !email || !telefone || !responsavel || 
            !cep || !logradouro || !numero || !bairro || !cidade || !estado) {
            return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos' });
        }

        const cnpjLimpo = limparDocumento(cnpj);
        
        if (!validarCNPJ(cnpjLimpo)) {
            return res.status(400).json({ erro: 'CNPJ inválido' });
        }

        // Verificar se CNPJ já existe
        const cnpjExiste = await getQuery('SELECT id FROM distribuidores WHERE cnpj = ?', [cnpjLimpo]);
        if (cnpjExiste) {
            return res.status(400).json({ erro: 'CNPJ já cadastrado' });
        }

        // Verificar se email já existe
        const emailExiste = await getQuery('SELECT id FROM distribuidores WHERE email = ?', [email]);
        if (emailExiste) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }

        // Buscar coordenadas
        let latitude = null;
        let longitude = null;
        
        try {
            const coordenadas = await buscarCoordenadasPorEndereco({
                logradouro, numero, cidade, estado
            });
            if (coordenadas) {
                latitude = coordenadas.latitude;
                longitude = coordenadas.longitude;
            }
        } catch (e) {
            console.log('Não foi possível obter coordenadas:', e.message);
        }

        // Gerar senha aleatória
        const senhaTemporaria = gerarSenhaAleatoria(8);
        const senhaHash = await hashSenha(senhaTemporaria);

        // Inserir distribuidor
        const result = await runQuery(
            `INSERT INTO distribuidores 
            (nome, cnpj, email, senha, telefone, responsavel, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude, horario_funcionamento) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, cnpjLimpo, email, senhaHash, telefone, responsavel, cep, logradouro, numero, complemento || '', bairro, cidade, estado, latitude, longitude, horario_funcionamento || '']
        );

        // Enviar webhook
        await notificarSenhaGerada('distribuidor', {
            id: result.lastID,
            nome,
            email,
            telefone
        }, senhaTemporaria);

        res.status(201).json({ 
            sucesso: true, 
            mensagem: 'Distribuidor criado com sucesso',
            id: result.lastID,
            senha_temporaria: senhaTemporaria
        });

    } catch (error) {
        console.error('Erro ao criar distribuidor:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Atualizar distribuidor
router.put('/distribuidores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nome, email, telefone, responsavel,
            cep, logradouro, numero, complemento, bairro, cidade, estado,
            horario_funcionamento, ativo
        } = req.body;

        const distribuidor = await getQuery('SELECT id FROM distribuidores WHERE id = ?', [id]);
        if (!distribuidor) {
            return res.status(404).json({ erro: 'Distribuidor não encontrado' });
        }

        // Verificar email
        if (email) {
            const emailExiste = await getQuery(
                'SELECT id FROM distribuidores WHERE email = ? AND id != ?',
                [email, id]
            );
            if (emailExiste) {
                return res.status(400).json({ erro: 'Email já cadastrado por outro distribuidor' });
            }
        }

        // Montar query dinâmica com whitelist de campos permitidos
        const camposPermitidos = {
            nome, email, telefone, responsavel, cep, logradouro, numero,
            complemento, bairro, cidade, estado, horario_funcionamento, ativo
        };

        const campos = [];
        const valores = [];

        // Validar e adicionar apenas campos permitidos
        if (nome !== undefined) { campos.push('nome = ?'); valores.push(nome); }
        if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
        if (telefone !== undefined) { campos.push('telefone = ?'); valores.push(telefone); }
        if (responsavel !== undefined) { campos.push('responsavel = ?'); valores.push(responsavel); }
        if (cep !== undefined) { campos.push('cep = ?'); valores.push(cep); }
        if (logradouro !== undefined) { campos.push('logradouro = ?'); valores.push(logradouro); }
        if (numero !== undefined) { campos.push('numero = ?'); valores.push(numero); }
        if (complemento !== undefined) { campos.push('complemento = ?'); valores.push(complemento); }
        if (bairro !== undefined) { campos.push('bairro = ?'); valores.push(bairro); }
        if (cidade !== undefined) { campos.push('cidade = ?'); valores.push(cidade); }
        if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }
        if (horario_funcionamento !== undefined) { campos.push('horario_funcionamento = ?'); valores.push(horario_funcionamento); }
        if (ativo !== undefined) { campos.push('ativo = ?'); valores.push(ativo ? 1 : 0); }

        // Atualizar coordenadas se endereço foi alterado
        if (logradouro || numero || cidade || estado) {
            try {
                const distAtual = await getQuery('SELECT * FROM distribuidores WHERE id = ?', [id]);
                const coordenadas = await buscarCoordenadasPorEndereco({
                    logradouro: logradouro || distAtual.logradouro,
                    numero: numero || distAtual.numero,
                    cidade: cidade || distAtual.cidade,
                    estado: estado || distAtual.estado
                });
                if (coordenadas) {
                    campos.push('latitude = ?'); valores.push(coordenadas.latitude);
                    campos.push('longitude = ?'); valores.push(coordenadas.longitude);
                }
            } catch (e) {
                console.log('Não foi possível atualizar coordenadas');
            }
        }

        // Verificar se há pelo menos um campo para atualizar
        if (campos.length === 0) {
            return res.status(400).json({ erro: 'Nenhum campo fornecido para atualização' });
        }

        campos.push('atualizado_em = CURRENT_TIMESTAMP');
        valores.push(id);

        await runQuery(
            `UPDATE distribuidores SET ${campos.join(', ')} WHERE id = ?`,
            valores
        );

        res.json({ sucesso: true, mensagem: 'Distribuidor atualizado com sucesso' });

    } catch (error) {
        console.error('Erro ao atualizar distribuidor:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Resetar senha do distribuidor
router.post('/distribuidores/:id/resetar-senha', async (req, res) => {
    try {
        const { id } = req.params;

        const distribuidor = await getQuery(
            'SELECT id, nome, email, telefone FROM distribuidores WHERE id = ?',
            [id]
        );

        if (!distribuidor) {
            return res.status(404).json({ erro: 'Distribuidor não encontrado' });
        }

        const novaSenha = gerarSenhaAleatoria(8);
        const senhaHash = await hashSenha(novaSenha);

        await runQuery(
            'UPDATE distribuidores SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [senhaHash, id]
        );

        await notificarSenhaGerada('distribuidor', distribuidor, novaSenha);

        res.json({ 
            sucesso: true, 
            mensagem: 'Senha resetada com sucesso',
            nova_senha: novaSenha
        });

    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Excluir distribuidor (soft delete)
router.delete('/distribuidores/:id', verificarNivel('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const distribuidor = await getQuery('SELECT id FROM distribuidores WHERE id = ?', [id]);
        if (!distribuidor) {
            return res.status(404).json({ erro: 'Distribuidor não encontrado' });
        }

        await runQuery(
            'UPDATE distribuidores SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        res.json({ sucesso: true, mensagem: 'Distribuidor desativado com sucesso' });

    } catch (error) {
        console.error('Erro ao excluir distribuidor:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// VALES-GÁS
// ========================================

// Gerar código para um colaborador específico
router.post('/vales/gerar', verificarNivel('admin', 'supervisor'), async (req, res) => {
    try {
        const { colaborador_id } = req.body;
        
        if (!colaborador_id) {
            return res.status(400).json({ erro: 'ID do colaborador é obrigatório' });
        }

        const mesReferencia = getMesReferencia();
        
        // Buscar configurações
        const valesPorMes = parseInt(await getConfig('vales_por_mes', '1'));
        const diasValidade = parseInt(await getConfig('dias_validade_vale', '30'));
        const dataExpiracao = getDataExpiracao(diasValidade);

        // Verificar se colaborador existe e está ativo
        const colaborador = await getQuery(
            'SELECT id, nome, email, telefone, ativo FROM colaboradores WHERE id = ?',
            [colaborador_id]
        );

        if (!colaborador) {
            return res.status(404).json({ erro: 'Colaborador não encontrado' });
        }

        if (!colaborador.ativo) {
            return res.status(400).json({ erro: 'Colaborador está inativo' });
        }

        // Contar quantos vales já existem para este colaborador no mês
        const valesExistentes = await getQuery(
            'SELECT COUNT(*) as total FROM vales_gas WHERE colaborador_id = ? AND mes_referencia = ?',
            [colaborador_id, mesReferencia]
        );

        if (valesExistentes.total >= valesPorMes) {
            return res.status(400).json({ 
                erro: `Colaborador já possui ${valesExistentes.total} vale(s) para este mês (máximo: ${valesPorMes})` 
            });
        }

        // Gerar código único
        let codigo;
        let codigoExiste = true;
        
        while (codigoExiste) {
            codigo = gerarCodigoVale();
            const existe = await getQuery('SELECT id FROM vales_gas WHERE codigo = ?', [codigo]);
            codigoExiste = !!existe;
        }

        // Inserir vale
        await runQuery(
            `INSERT INTO vales_gas (colaborador_id, codigo, mes_referencia, data_expiracao) VALUES (?, ?, ?, ?)`,
            [colaborador_id, codigo, mesReferencia, dataExpiracao]
        );

        // Enviar webhook
        await notificarCodigoGerado(colaborador, codigo, mesReferencia, dataExpiracao);

        const valesRestantes = valesPorMes - valesExistentes.total - 1;

        res.json({
            sucesso: true,
            mensagem: 'Vale gerado com sucesso',
            dados: {
                colaborador_id,
                colaborador_nome: colaborador.nome,
                codigo,
                mes_referencia: mesReferencia,
                vales_restantes: valesRestantes
            }
        });

    } catch (error) {
        console.error('Erro ao gerar vale individual:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Gerar códigos mensais para todos os colaboradores ativos
router.post('/vales/gerar-mensal', verificarNivel('admin', 'supervisor'), async (req, res) => {
    try {
        const mesReferencia = getMesReferencia();
        
        // Buscar configurações
        const valesPorMes = parseInt(await getConfig('vales_por_mes', '1'));
        const diasValidade = parseInt(await getConfig('dias_validade_vale', '30'));
        const dataExpiracao = getDataExpiracao(diasValidade);

        // Buscar todos os colaboradores ativos que ainda podem receber vales
        // (têm menos vales do que o permitido)
        const colaboradores = await allQuery(`
            SELECT c.id, c.nome, c.email, c.telefone,
                   COALESCE((SELECT COUNT(*) FROM vales_gas v WHERE v.colaborador_id = c.id AND v.mes_referencia = ?), 0) as vales_atuais
            FROM colaboradores c
            WHERE c.ativo = 1
            AND COALESCE((SELECT COUNT(*) FROM vales_gas v WHERE v.colaborador_id = c.id AND v.mes_referencia = ?), 0) < ?
        `, [mesReferencia, mesReferencia, valesPorMes]);

        if (colaboradores.length === 0) {
            return res.status(400).json({ 
                erro: `Todos os colaboradores ativos já possuem ${valesPorMes} vale(s) para este mês` 
            });
        }

        let gerados = 0;
        let erros = 0;

        for (const colaborador of colaboradores) {
            try {
                // Calcular quantos vales ainda faltam para este colaborador
                const valesFaltando = valesPorMes - colaborador.vales_atuais;
                
                for (let i = 0; i < valesFaltando; i++) {
                    // Gerar código único
                    let codigo;
                    let codigoExiste = true;
                    
                    while (codigoExiste) {
                        codigo = gerarCodigoVale();
                        const existe = await getQuery('SELECT id FROM vales_gas WHERE codigo = ?', [codigo]);
                        codigoExiste = !!existe;
                    }

                    // Inserir vale
                    await runQuery(
                        `INSERT INTO vales_gas (colaborador_id, codigo, mes_referencia, data_expiracao) VALUES (?, ?, ?, ?)`,
                        [colaborador.id, codigo, mesReferencia, dataExpiracao]
                    );

                    // Enviar webhook
                    await notificarCodigoGerado(colaborador, codigo, mesReferencia, dataExpiracao);

                    gerados++;
                }
            } catch (e) {
                console.error(`Erro ao gerar vale para colaborador ${colaborador.id}:`, e);
                erros++;
            }
        }

        res.json({
            sucesso: true,
            mensagem: `Vales gerados para ${mesReferencia}`,
            gerados,
            erros,
            total_colaboradores: colaboradores.length,
            vales_por_colaborador: valesPorMes
        });

    } catch (error) {
        console.error('Erro ao gerar vales mensais:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Listar todos os vales do mês atual ou específico
router.get('/vales', async (req, res) => {
    try {
        const { mes, status, colaborador_id, pagina = 1, limite = 20 } = req.query;
        const offset = (pagina - 1) * limite;
        const mesReferencia = mes || getMesReferencia();

        let whereClause = 'WHERE v.mes_referencia = ?';
        const params = [mesReferencia];

        if (status) {
            whereClause += ' AND v.status = ?';
            params.push(status);
        }

        if (colaborador_id) {
            whereClause += ' AND v.colaborador_id = ?';
            params.push(colaborador_id);
        }

        // Contar
        const countSql = `
            SELECT COUNT(*) as total
            FROM vales_gas v
            JOIN colaboradores c ON v.colaborador_id = c.id
            ${whereClause}
        `;
        const countResult = await getQuery(countSql, params);
        const total = countResult ? countResult.total : 0;

        // Buscar com paginação
        const sql = `
            SELECT v.*, c.nome as colaborador_nome, c.cpf as colaborador_cpf,
                   d.nome as distribuidor_nome
            FROM vales_gas v
            JOIN colaboradores c ON v.colaborador_id = c.id
            LEFT JOIN distribuidores d ON v.distribuidor_id = d.id
            ${whereClause}
            ORDER BY c.nome ASC 
            LIMIT ? OFFSET ?
        `;
        const vales = await allQuery(sql, [...params, parseInt(limite), parseInt(offset)]);

        res.json({
            sucesso: true,
            dados: vales,
            mes_referencia: mesReferencia,
            paginacao: {
                total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(total / limite)
            }
        });

    } catch (error) {
        console.error('Erro ao listar vales:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// SOLICITAÇÕES DE ALTERAÇÃO
// ========================================

// Listar solicitações pendentes
router.get('/solicitacoes', async (req, res) => {
    try {
        const { status = 'pendente', pagina = 1, limite = 20 } = req.query;
        const offset = (pagina - 1) * limite;

        let sql = `
            SELECT s.*, c.nome as colaborador_nome, c.email as colaborador_email
            FROM solicitacoes_alteracao s
            JOIN colaboradores c ON s.colaborador_id = c.id
            WHERE s.status = ?
            ORDER BY s.criado_em DESC
            LIMIT ? OFFSET ?
        `;

        const solicitacoes = await allQuery(sql, [status, parseInt(limite), parseInt(offset)]);

        const countResult = await getQuery(
            'SELECT COUNT(*) as total FROM solicitacoes_alteracao WHERE status = ?',
            [status]
        );

        res.json({
            sucesso: true,
            dados: solicitacoes,
            paginacao: {
                total: countResult.total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(countResult.total / limite)
            }
        });

    } catch (error) {
        console.error('Erro ao listar solicitações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Responder solicitação
router.put('/solicitacoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resposta_admin } = req.body;

        if (!['aprovado', 'rejeitado'].includes(status)) {
            return res.status(400).json({ erro: 'Status inválido' });
        }

        const solicitacao = await getQuery('SELECT * FROM solicitacoes_alteracao WHERE id = ?', [id]);
        if (!solicitacao) {
            return res.status(404).json({ erro: 'Solicitação não encontrada' });
        }

        await runQuery(
            `UPDATE solicitacoes_alteracao 
             SET status = ?, resposta_admin = ?, admin_id = ?, atualizado_em = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [status, resposta_admin || '', req.usuario.id, id]
        );

        // Se aprovado, aplicar as alterações (se houver dados_novos)
        if (status === 'aprovado' && solicitacao.dados_novos) {
            try {
                const dadosNovos = JSON.parse(solicitacao.dados_novos);
                const campos = [];
                const valores = [];

                Object.keys(dadosNovos).forEach(campo => {
                    campos.push(`${campo} = ?`);
                    valores.push(dadosNovos[campo]);
                });

                if (campos.length > 0) {
                    campos.push('atualizado_em = CURRENT_TIMESTAMP');
                    valores.push(solicitacao.colaborador_id);
                    
                    await runQuery(
                        `UPDATE colaboradores SET ${campos.join(', ')} WHERE id = ?`,
                        valores
                    );
                }
            } catch (e) {
                console.error('Erro ao aplicar alterações:', e);
            }
        }

        res.json({ sucesso: true, mensagem: `Solicitação ${status}` });

    } catch (error) {
        console.error('Erro ao responder solicitação:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// DASHBOARD E RELATÓRIOS
// ========================================

// Estatísticas gerais
router.get('/dashboard', async (req, res) => {
    try {
        const mesReferencia = getMesReferencia();

        // Total de colaboradores
        const totalColaboradores = await getQuery(
            'SELECT COUNT(*) as total FROM colaboradores WHERE ativo = 1'
        );

        // Total de distribuidores
        const totalDistribuidores = await getQuery(
            'SELECT COUNT(*) as total FROM distribuidores WHERE ativo = 1'
        );

        // Vales do mês
        const valesMes = await getQuery(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) as ativos,
                SUM(CASE WHEN status = 'utilizado' THEN 1 ELSE 0 END) as utilizados,
                SUM(CASE WHEN status = 'expirado' THEN 1 ELSE 0 END) as expirados
            FROM vales_gas WHERE mes_referencia = ?
        `, [mesReferencia]);

        // Solicitações pendentes
        const solicitacoesPendentes = await getQuery(
            'SELECT COUNT(*) as total FROM solicitacoes_alteracao WHERE status = ?',
            ['pendente']
        );

        // Retiradas por distribuidor (mês atual)
        const retiradasPorDistribuidor = await allQuery(`
            SELECT d.nome, COUNT(v.id) as total_retiradas
            FROM vales_gas v
            JOIN distribuidores d ON v.distribuidor_id = d.id
            WHERE v.mes_referencia = ? AND v.status = 'utilizado'
            GROUP BY d.id
            ORDER BY total_retiradas DESC
        `, [mesReferencia]);

        // Histórico dos últimos 6 meses
        const historicoMensal = await allQuery(`
            SELECT 
                mes_referencia,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'utilizado' THEN 1 ELSE 0 END) as utilizados
            FROM vales_gas
            GROUP BY mes_referencia
            ORDER BY mes_referencia DESC
            LIMIT 6
        `);

        res.json({
            sucesso: true,
            dados: {
                mes_referencia: mesReferencia,
                colaboradores: {
                    total: totalColaboradores.total
                },
                distribuidores: {
                    total: totalDistribuidores.total
                },
                vales_mes: {
                    total: valesMes.total || 0,
                    ativos: valesMes.ativos || 0,
                    utilizados: valesMes.utilizados || 0,
                    expirados: valesMes.expirados || 0,
                    taxa_utilizacao: valesMes.total > 0 
                        ? ((valesMes.utilizados / valesMes.total) * 100).toFixed(1) 
                        : 0
                },
                solicitacoes_pendentes: solicitacoesPendentes.total,
                retiradas_por_distribuidor: retiradasPorDistribuidor,
                historico_mensal: historicoMensal
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Dados para gráficos do dashboard
router.get('/dashboard/graficos', async (req, res) => {
    try {
        const mesReferencia = getMesReferencia();
        
        // Retiradas dos últimos 6 meses
        const retiradasPorMes = await allQuery(`
            SELECT 
                mes_referencia,
                COUNT(CASE WHEN status = 'utilizado' THEN 1 END) as total
            FROM vales_gas
            WHERE mes_referencia >= date('now', '-6 months')
            GROUP BY mes_referencia
            ORDER BY mes_referencia ASC
        `);
        
        // Formatar nomes dos meses
        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const retiradasFormatadas = retiradasPorMes.map(r => {
            const [ano, mes] = r.mes_referencia.split('-');
            return {
                mes_referencia: r.mes_referencia,
                mes_nome: mesesNomes[parseInt(mes) - 1] + '/' + ano.slice(-2),
                total: r.total || 0
            };
        });
        
        // Status dos vales do mês atual
        const statusVales = await getQuery(`
            SELECT 
                SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) as ativos,
                SUM(CASE WHEN status = 'utilizado' THEN 1 ELSE 0 END) as utilizados,
                SUM(CASE WHEN status = 'expirado' THEN 1 ELSE 0 END) as expirados
            FROM vales_gas WHERE mes_referencia = ?
        `, [mesReferencia]);
        
        // Taxa de utilização dos últimos 6 meses
        const taxaUtilizacao = await allQuery(`
            SELECT 
                mes_referencia,
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'utilizado' THEN 1 END) as utilizados
            FROM vales_gas
            WHERE mes_referencia >= date('now', '-6 months')
            GROUP BY mes_referencia
            ORDER BY mes_referencia ASC
        `);
        
        const taxaFormatada = taxaUtilizacao.map(t => {
            const [ano, mes] = t.mes_referencia.split('-');
            return {
                mes_referencia: t.mes_referencia,
                mes_nome: mesesNomes[parseInt(mes) - 1] + '/' + ano.slice(-2),
                taxa: t.total > 0 ? Math.round((t.utilizados / t.total) * 100) : 0
            };
        });
        
        // Top 5 distribuidores do mês
        const topDistribuidores = await allQuery(`
            SELECT d.nome, COUNT(v.id) as total
            FROM vales_gas v
            JOIN distribuidores d ON v.distribuidor_id = d.id
            WHERE v.mes_referencia = ? AND v.status = 'utilizado'
            GROUP BY d.id
            ORDER BY total DESC
            LIMIT 5
        `, [mesReferencia]);
        
        res.json({
            sucesso: true,
            dados: {
                retiradas_por_mes: retiradasFormatadas,
                status_vales: {
                    ativos: statusVales?.ativos || 0,
                    utilizados: statusVales?.utilizados || 0,
                    expirados: statusVales?.expirados || 0
                },
                taxa_utilizacao: taxaFormatada,
                top_distribuidores: topDistribuidores.length > 0 ? topDistribuidores : [{nome: 'Nenhum', total: 0}]
            }
        });
        
    } catch (error) {
        console.error('Erro ao buscar dados dos gráficos:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Relatório de retiradas por período
router.get('/relatorios/retiradas', async (req, res) => {
    try {
        const { mes_inicio, mes_fim, distribuidor_id } = req.query;

        let sql = `
            SELECT 
                h.mes_referencia,
                h.data_retirada,
                h.colaborador_nome,
                h.colaborador_cpf,
                h.distribuidor_nome,
                h.codigo
            FROM historico_retiradas h
            WHERE 1=1
        `;
        const params = [];

        if (mes_inicio) {
            sql += ' AND h.mes_referencia >= ?';
            params.push(mes_inicio);
        }

        if (mes_fim) {
            sql += ' AND h.mes_referencia <= ?';
            params.push(mes_fim);
        }

        if (distribuidor_id) {
            sql += ' AND h.distribuidor_id = ?';
            params.push(distribuidor_id);
        }

        sql += ' ORDER BY h.data_retirada DESC';

        const retiradas = await allQuery(sql, params);

        // Resumo por distribuidor
        let sqlResumo = `
            SELECT 
                d.nome as distribuidor_nome,
                COUNT(*) as total_retiradas
            FROM historico_retiradas h
            JOIN distribuidores d ON h.distribuidor_id = d.id
            WHERE 1=1
        `;
        const paramsResumo = [];
        
        if (mes_inicio) {
            sqlResumo += ' AND h.mes_referencia >= ?';
            paramsResumo.push(mes_inicio);
        }
        if (mes_fim) {
            sqlResumo += ' AND h.mes_referencia <= ?';
            paramsResumo.push(mes_fim);
        }
        if (distribuidor_id) {
            sqlResumo += ' AND h.distribuidor_id = ?';
            paramsResumo.push(distribuidor_id);
        }
        
        sqlResumo += ' GROUP BY d.id ORDER BY total_retiradas DESC';

        const resumo = await allQuery(sqlResumo, paramsResumo);

        res.json({
            sucesso: true,
            dados: {
                detalhes: retiradas,  // Renomeado para 'detalhes' para ficar mais claro
                resumo,
                total: retiradas.length
            }
        });

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// USUÁRIOS ADMIN
// ========================================

// Listar usuários admin
router.get('/usuarios', verificarNivel('admin'), async (req, res) => {
    try {
        const adminMasterEmail = process.env.ADMIN_MASTER_EMAIL || 'admin@consigaz.com.br';
        const usuarios = await allQuery(
            'SELECT id, nome, email, nivel, ativo, criado_em FROM usuarios_admin ORDER BY nome'
        );
        // Marcar qual é o master
        const usuariosComMaster = usuarios.map(u => ({
            ...u,
            is_master: u.email === adminMasterEmail
        }));
        res.json({ sucesso: true, dados: usuariosComMaster });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Buscar usuário por ID
router.get('/usuarios/:id', verificarNivel('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await getQuery(
            'SELECT id, nome, email, nivel, ativo FROM usuarios_admin WHERE id = ?',
            [id]
        );
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        res.json({ sucesso: true, dados: usuario });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Criar usuário admin
router.post('/usuarios', verificarNivel('admin'), async (req, res) => {
    try {
        const { nome, email, senha, nivel } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        }

        const emailExiste = await getQuery('SELECT id FROM usuarios_admin WHERE email = ?', [email]);
        if (emailExiste) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
        }

        const senhaHash = await hashSenha(senha);

        const result = await runQuery(
            'INSERT INTO usuarios_admin (nome, email, senha, nivel) VALUES (?, ?, ?, ?)',
            [nome, email, senhaHash, nivel || 'operador']
        );

        res.status(201).json({ sucesso: true, id: result.lastID });

    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Atualizar usuário admin
router.put('/usuarios/:id', verificarNivel('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, senha, nivel, ativo } = req.body;

        const adminMasterEmail = process.env.ADMIN_MASTER_EMAIL || 'admin@consigaz.com.br';
        const usuario = await getQuery('SELECT id, email FROM usuarios_admin WHERE id = ?', [id]);
        
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        // Não permitir desativar ou rebaixar o master
        if (usuario.email === adminMasterEmail) {
            if (ativo === false || ativo === 0) {
                return res.status(400).json({ erro: 'Não é possível desativar o usuário master' });
            }
            if (nivel && nivel !== 'admin') {
                return res.status(400).json({ erro: 'Não é possível alterar o nível do usuário master' });
            }
        }

        const campos = [];
        const valores = [];

        if (nome) { campos.push('nome = ?'); valores.push(nome); }
        if (email) { campos.push('email = ?'); valores.push(email); }
        if (senha) { 
            const senhaHash = await hashSenha(senha);
            campos.push('senha = ?'); 
            valores.push(senhaHash); 
        }
        if (nivel) { campos.push('nivel = ?'); valores.push(nivel); }
        if (ativo !== undefined) { campos.push('ativo = ?'); valores.push(ativo ? 1 : 0); }

        campos.push('atualizado_em = CURRENT_TIMESTAMP');
        valores.push(id);

        await runQuery(
            `UPDATE usuarios_admin SET ${campos.join(', ')} WHERE id = ?`,
            valores
        );

        res.json({ sucesso: true, mensagem: 'Usuário atualizado' });

    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Excluir usuário admin (desativar)
router.delete('/usuarios/:id', verificarNivel('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const adminMasterEmail = process.env.ADMIN_MASTER_EMAIL || 'admin@consigaz.com.br';
        const usuario = await getQuery('SELECT id, email FROM usuarios_admin WHERE id = ?', [id]);
        
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        // Não permitir excluir o master
        if (usuario.email === adminMasterEmail) {
            return res.status(400).json({ erro: 'Não é possível excluir o usuário master' });
        }
        
        // Não permitir excluir a si mesmo
        if (parseInt(id) === req.usuario.id) {
            return res.status(400).json({ erro: 'Você não pode excluir seu próprio usuário' });
        }

        await runQuery(
            'UPDATE usuarios_admin SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        // Registrar auditoria
        await registrarAuditoria({
            tipo_usuario: 'admin',
            usuario_id: req.usuario.id,
            usuario_nome: req.usuario.nome,
            acao: 'excluir_usuario',
            entidade: 'usuario',
            entidade_id: parseInt(id),
            detalhes: { email: usuario.email },
            ip: getClientIP(req)
        });

        res.json({ sucesso: true, mensagem: 'Usuário desativado com sucesso' });

    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ==================== SOLICITAÇÕES DE RECUPERAÇÃO DE SENHA ====================

// Listar solicitações de recuperação de senha pendentes
router.get('/solicitacoes-senha', verificarNivel('admin'), async (req, res) => {
    try {
        // Buscar tokens não usados e não expirados
        const solicitacoes = await allQuery(`
            SELECT t.id, t.tipo_usuario, t.usuario_id, t.criado_em,
                   CASE 
                       WHEN t.tipo_usuario = 'colaborador' THEN c.nome
                       WHEN t.tipo_usuario = 'distribuidor' THEN d.nome
                   END as nome,
                   CASE 
                       WHEN t.tipo_usuario = 'colaborador' THEN c.email
                       WHEN t.tipo_usuario = 'distribuidor' THEN d.email
                   END as email
            FROM tokens_recuperacao t
            LEFT JOIN colaboradores c ON t.tipo_usuario = 'colaborador' AND t.usuario_id = c.id
            LEFT JOIN distribuidores d ON t.tipo_usuario = 'distribuidor' AND t.usuario_id = d.id
            WHERE t.usado = 0 AND t.expira_em > datetime('now')
            AND t.tipo_usuario IN ('colaborador', 'distribuidor')
            ORDER BY t.criado_em DESC
        `);
        
        res.json({ sucesso: true, dados: solicitacoes });
    } catch (error) {
        console.error('Erro ao listar solicitações de senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rejeitar solicitação de senha (deletar token)
router.delete('/solicitacoes-senha/:id', verificarNivel('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        await runQuery('DELETE FROM tokens_recuperacao WHERE id = ?', [id]);
        res.json({ sucesso: true, mensagem: 'Solicitação rejeitada' });
    } catch (error) {
        console.error('Erro ao rejeitar solicitação:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ==================== LOGS DE AUDITORIA ====================

// Listar logs de auditoria
router.get('/auditoria', verificarNivel('admin'), async (req, res) => {
    try {
        const { tipo_usuario, acao, entidade, data_inicio, data_fim, busca, pagina, limite } = req.query;
        
        const resultado = await buscarLogs({
            tipo_usuario,
            acao,
            entidade,
            data_inicio,
            data_fim,
            busca,
            pagina: pagina || 1,
            limite: limite || 50
        });

        res.json({ sucesso: true, ...resultado });
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Estatísticas de auditoria
router.get('/auditoria/estatisticas', verificarNivel('admin'), async (req, res) => {
    try {
        const { data_inicio, data_fim } = req.query;
        
        let whereData = '';
        const params = [];
        
        if (data_inicio) {
            whereData += ' AND DATE(criado_em) >= ?';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereData += ' AND DATE(criado_em) <= ?';
            params.push(data_fim);
        }

        // Total de ações por tipo
        const acoesPorTipo = await allQuery(`
            SELECT acao, COUNT(*) as total 
            FROM logs_auditoria 
            WHERE 1=1 ${whereData}
            GROUP BY acao 
            ORDER BY total DESC
        `, params);

        // Ações por usuário (top 10)
        const acoesPorUsuario = await allQuery(`
            SELECT usuario_nome, tipo_usuario, COUNT(*) as total 
            FROM logs_auditoria 
            WHERE 1=1 ${whereData}
            GROUP BY usuario_id, usuario_nome 
            ORDER BY total DESC 
            LIMIT 10
        `, params);

        // Ações por dia (últimos 30 dias)
        const acoesPorDia = await allQuery(`
            SELECT DATE(criado_em) as data, COUNT(*) as total 
            FROM logs_auditoria 
            WHERE criado_em >= datetime('now', '-30 days') ${whereData}
            GROUP BY DATE(criado_em) 
            ORDER BY data DESC
        `, params);

        // Total de logins por tipo de usuário
        const loginsPorTipo = await allQuery(`
            SELECT tipo_usuario, COUNT(*) as total 
            FROM logs_auditoria 
            WHERE acao = 'login' ${whereData}
            GROUP BY tipo_usuario
        `, params);

        res.json({
            sucesso: true,
            dados: {
                acoes_por_tipo: acoesPorTipo,
                acoes_por_usuario: acoesPorUsuario,
                acoes_por_dia: acoesPorDia,
                logins_por_tipo: loginsPorTipo
            }
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ==================== WEBHOOKS / NOTIFICAÇÕES ====================

const { getEstatisticasWebhooks, verificarValesProximosExpirar } = require('../webhooks');

// Estatísticas de webhooks
router.get('/webhooks/estatisticas', verificarNivel('admin'), async (req, res) => {
    try {
        const dias = parseInt(req.query.dias) || 30;
        const stats = await getEstatisticasWebhooks(dias);
        res.json({ sucesso: true, dados: stats });
    } catch (error) {
        console.error('Erro ao buscar estatísticas de webhooks:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Disparar lembretes de expiração manualmente
router.post('/webhooks/enviar-lembretes', verificarNivel('admin'), async (req, res) => {
    try {
        const { dias } = req.body;
        const diasArray = dias || [7, 3, 1];
        
        const resultado = await verificarValesProximosExpirar(diasArray);
        
        // Registrar auditoria
        await registrarAuditoria({
            tipo_usuario: 'admin',
            usuario_id: req.usuario.id,
            usuario_nome: req.usuario.nome,
            acao: 'enviar_lembretes',
            detalhes: { dias: diasArray, enviados: resultado.enviados },
            ip: getClientIP(req)
        });
        
        res.json({ 
            sucesso: true, 
            mensagem: `${resultado.enviados || 0} lembretes enviados` 
        });
    } catch (error) {
        console.error('Erro ao enviar lembretes:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Logs de webhooks
router.get('/webhooks/logs', verificarNivel('admin'), async (req, res) => {
    try {
        const { tipo, sucesso, pagina = 1, limite = 50 } = req.query;
        const offset = (pagina - 1) * limite;
        
        let sql = 'SELECT * FROM logs_webhook WHERE 1=1';
        let sqlCount = 'SELECT COUNT(*) as total FROM logs_webhook WHERE 1=1';
        const params = [];
        const paramsCount = [];
        
        if (tipo) {
            sql += ' AND tipo = ?';
            sqlCount += ' AND tipo = ?';
            params.push(tipo);
            paramsCount.push(tipo);
        }
        
        if (sucesso !== undefined && sucesso !== '') {
            sql += ' AND sucesso = ?';
            sqlCount += ' AND sucesso = ?';
            params.push(sucesso === 'true' ? 1 : 0);
            paramsCount.push(sucesso === 'true' ? 1 : 0);
        }
        
        sql += ' ORDER BY criado_em DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limite), offset);
        
        const [logs, countResult] = await Promise.all([
            allQuery(sql, params),
            getQuery(sqlCount, paramsCount)
        ]);
        
        res.json({
            sucesso: true,
            dados: logs.map(l => ({
                ...l,
                payload: l.payload ? JSON.parse(l.payload) : null,
                resposta: l.resposta ? (typeof l.resposta === 'string' ? l.resposta : JSON.parse(l.resposta)) : null
            })),
            paginacao: {
                total: countResult.total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total_paginas: Math.ceil(countResult.total / limite)
            }
        });
    } catch (error) {
        console.error('Erro ao buscar logs de webhooks:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ==================== AVALIAÇÕES DE DISTRIBUIDORES ====================

// Listar avaliações (com filtros)
router.get('/avaliacoes', async (req, res) => {
    try {
        const { distribuidor_id, nota_min, pagina = 1, limite = 20 } = req.query;
        const offset = (pagina - 1) * limite;
        
        let where = '1=1';
        const params = [];
        
        if (distribuidor_id) {
            where += ' AND a.distribuidor_id = ?';
            params.push(distribuidor_id);
        }
        
        if (nota_min) {
            where += ' AND a.nota >= ?';
            params.push(nota_min);
        }
        
        const avaliacoes = await allQuery(`
            SELECT 
                a.id,
                a.nota,
                a.comentario,
                a.criado_em,
                c.nome as colaborador_nome,
                d.nome as distribuidor_nome,
                d.cidade,
                h.codigo,
                h.mes_referencia
            FROM avaliacoes_distribuidores a
            JOIN colaboradores c ON a.colaborador_id = c.id
            JOIN distribuidores d ON a.distribuidor_id = d.id
            JOIN historico_retiradas h ON a.retirada_id = h.id
            WHERE ${where}
            ORDER BY a.criado_em DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limite), offset]);
        
        res.json({ sucesso: true, dados: avaliacoes });
    } catch (error) {
        console.error('Erro ao buscar avaliações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Ranking de distribuidores por avaliação
router.get('/avaliacoes/ranking', async (req, res) => {
    try {
        const ranking = await allQuery(`
            SELECT 
                d.id,
                d.nome,
                d.cidade,
                d.estado,
                COUNT(a.id) as total_avaliacoes,
                ROUND(AVG(a.nota), 1) as media_nota,
                SUM(CASE WHEN a.nota >= 4 THEN 1 ELSE 0 END) as avaliacoes_positivas,
                SUM(CASE WHEN a.nota <= 2 THEN 1 ELSE 0 END) as avaliacoes_negativas
            FROM distribuidores d
            LEFT JOIN avaliacoes_distribuidores a ON d.id = a.distribuidor_id
            WHERE d.ativo = 1
            GROUP BY d.id
            ORDER BY media_nota DESC, total_avaliacoes DESC
        `);
        
        res.json({ sucesso: true, dados: ranking });
    } catch (error) {
        console.error('Erro ao buscar ranking:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Estatísticas de avaliações
router.get('/avaliacoes/estatisticas', async (req, res) => {
    try {
        const stats = await getQuery(`
            SELECT 
                COUNT(*) as total,
                ROUND(AVG(nota), 1) as media_geral,
                SUM(CASE WHEN nota = 5 THEN 1 ELSE 0 END) as nota_5,
                SUM(CASE WHEN nota = 4 THEN 1 ELSE 0 END) as nota_4,
                SUM(CASE WHEN nota = 3 THEN 1 ELSE 0 END) as nota_3,
                SUM(CASE WHEN nota = 2 THEN 1 ELSE 0 END) as nota_2,
                SUM(CASE WHEN nota = 1 THEN 1 ELSE 0 END) as nota_1
            FROM avaliacoes_distribuidores
        `);
        
        const ultimasSemana = await getQuery(`
            SELECT COUNT(*) as total
            FROM avaliacoes_distribuidores
            WHERE criado_em >= datetime('now', '-7 days')
        `);
        
        res.json({ 
            sucesso: true, 
            dados: {
                ...stats,
                ultimos_7_dias: ultimasSemana?.total || 0
            }
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ==================== CONFIGURAÇÕES DO SISTEMA ====================

// Buscar todas as configurações
router.get('/configuracoes', verificarNivel('admin'), async (req, res) => {
    try {
        const configs = await allQuery('SELECT * FROM configuracoes ORDER BY chave');
        res.json({ sucesso: true, dados: configs });
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Atualizar configuração
router.put('/configuracoes/:chave', verificarNivel('admin'), async (req, res) => {
    try {
        const { chave } = req.params;
        const { valor } = req.body;
        
        if (valor === undefined || valor === null) {
            return res.status(400).json({ erro: 'Valor é obrigatório' });
        }
        
        await runQuery(
            'UPDATE configuracoes SET valor = ?, atualizado_em = CURRENT_TIMESTAMP WHERE chave = ?',
            [String(valor), chave]
        );

        // Limpar cache de configurações
        limparCacheConfiguracoes();

        // Registrar auditoria
        await registrarAuditoria({
            tipo_usuario: 'admin',
            usuario_id: req.usuario.id,
            usuario_nome: req.usuario.nome,
            acao: 'alterar_configuracao',
            detalhes: { chave, valor },
            ip: getClientIP(req)
        });

        res.json({ sucesso: true, mensagem: 'Configuração atualizada' });
    } catch (error) {
        console.error('Erro ao atualizar configuração:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

module.exports = router;
module.exports.getConfig = getConfig;

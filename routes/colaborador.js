const express = require('express');
const router = express.Router();
const { getQuery, allQuery, runQuery } = require('../database');
const { autenticarColaborador } = require('../auth');
const { getMesReferencia, calcularDistancia, formatarCPF, formatarMesReferencia } = require('../utils');
const { validate } = require('../middlewares/sanitize');

// Aplicar autenticação em todas as rotas
router.use(autenticarColaborador);

// ========================================
// PERFIL DO COLABORADOR
// ========================================

// Ver perfil completo
router.get('/perfil', async (req, res) => {
    try {
        const colaborador = await getQuery(
            `SELECT id, nome, cpf, email, telefone, 
                    cep, logradouro, numero, complemento, bairro, cidade, estado,
                    data_admissao, matricula, setor, criado_em
             FROM colaboradores WHERE id = ?`,
            [req.usuario.id]
        );

        if (!colaborador) {
            return res.status(404).json({ erro: 'Colaborador não encontrado' });
        }

        // Formatar CPF para exibição
        colaborador.cpf_formatado = formatarCPF(colaborador.cpf);

        res.json({ sucesso: true, dados: colaborador });

    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// VALE-GÁS ATUAL
// ========================================

// Ver vales-gás do mês atual (pode ser múltiplos)
router.get('/vale-gas', async (req, res) => {
    try {
        const mesReferencia = getMesReferencia();

        // Buscar TODOS os vales do mês atual
        const vales = await allQuery(
            `SELECT v.*, d.nome as distribuidor_nome, d.logradouro as distribuidor_endereco,
                    d.cidade as distribuidor_cidade
             FROM vales_gas v
             LEFT JOIN distribuidores d ON v.distribuidor_id = d.id
             WHERE v.colaborador_id = ? AND v.mes_referencia = ?
             ORDER BY v.status ASC, v.data_geracao DESC`,
            [req.usuario.id, mesReferencia]
        );

        if (!vales || vales.length === 0) {
            return res.json({ 
                sucesso: true, 
                dados: null,
                multiplos: [],
                mensagem: 'Nenhum vale-gás disponível para este mês'
            });
        }

        // Processar cada vale
        const valesProcessados = vales.map(vale => {
            const hoje = new Date();
            const expiracao = new Date(vale.data_expiracao);
            const diasRestantes = Math.ceil((expiracao - hoje) / (1000 * 60 * 60 * 24));
            
            return {
                ...vale,
                dias_restantes: diasRestantes > 0 ? diasRestantes : 0,
                mes_referencia_formatado: formatarMesReferencia(vale.mes_referencia)
            };
        });

        // Priorizar vales ativos
        const valeAtivo = valesProcessados.find(v => v.status === 'ativo');
        const valePrincipal = valeAtivo || valesProcessados[0];

        res.json({ 
            sucesso: true, 
            dados: valePrincipal,
            multiplos: valesProcessados,
            total_vales: valesProcessados.length,
            vales_ativos: valesProcessados.filter(v => v.status === 'ativo').length,
            vales_utilizados: valesProcessados.filter(v => v.status === 'utilizado').length
        });

    } catch (error) {
        console.error('Erro ao buscar vale-gás:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Histórico de vales-gás
router.get('/vale-gas/historico', async (req, res) => {
    try {
        const { pagina = 1, limite = 12 } = req.query;
        const offset = (pagina - 1) * limite;

        const vales = await allQuery(
            `SELECT v.*, d.nome as distribuidor_nome
             FROM vales_gas v
             LEFT JOIN distribuidores d ON v.distribuidor_id = d.id
             WHERE v.colaborador_id = ?
             ORDER BY v.mes_referencia DESC
             LIMIT ? OFFSET ?`,
            [req.usuario.id, parseInt(limite), parseInt(offset)]
        );

        const countResult = await getQuery(
            'SELECT COUNT(*) as total FROM vales_gas WHERE colaborador_id = ?',
            [req.usuario.id]
        );

        // Formatar dados
        const valesFormatados = vales.map(v => ({
            ...v,
            mes_referencia_formatado: formatarMesReferencia(v.mes_referencia)
        }));

        res.json({
            sucesso: true,
            dados: valesFormatados,
            paginacao: {
                total: countResult.total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(countResult.total / limite)
            }
        });

    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// DISTRIBUIDORES PRÓXIMOS
// ========================================

// Buscar distribuidores próximos ao endereço do colaborador
router.get('/distribuidores-proximos', async (req, res) => {
    try {
        // Buscar dados do colaborador
        const colaborador = await getQuery(
            'SELECT cep, cidade, estado FROM colaboradores WHERE id = ?',
            [req.usuario.id]
        );

        if (!colaborador) {
            return res.status(404).json({ erro: 'Colaborador não encontrado' });
        }

        // Buscar todos os distribuidores ativos
        const distribuidores = await allQuery(
            `SELECT id, nome, logradouro, numero, bairro, cidade, estado, cep,
                    telefone, horario_funcionamento, latitude, longitude
             FROM distribuidores 
             WHERE ativo = 1`
        );

        // Filtrar por cidade/estado e ordenar
        // Prioridade: mesma cidade > mesmo estado > outros
        const distribuidoresOrdenados = distribuidores.map(d => {
            let prioridade = 3; // Outros estados
            
            if (d.cidade.toLowerCase() === colaborador.cidade.toLowerCase() && 
                d.estado.toLowerCase() === colaborador.estado.toLowerCase()) {
                prioridade = 1; // Mesma cidade
            } else if (d.estado.toLowerCase() === colaborador.estado.toLowerCase()) {
                prioridade = 2; // Mesmo estado
            }

            // Se tiver CEP, calcular proximidade pelo prefixo do CEP
            let proximidadeCep = 999;
            if (colaborador.cep && d.cep) {
                const cepColab = colaborador.cep.replace(/\D/g, '').substring(0, 5);
                const cepDist = d.cep.replace(/\D/g, '').substring(0, 5);
                proximidadeCep = Math.abs(parseInt(cepColab) - parseInt(cepDist));
            }

            return {
                ...d,
                prioridade,
                proximidade_cep: proximidadeCep,
                endereco_completo: `${d.logradouro}, ${d.numero} - ${d.bairro}, ${d.cidade}/${d.estado}`
            };
        });

        // Ordenar por prioridade e proximidade de CEP
        distribuidoresOrdenados.sort((a, b) => {
            if (a.prioridade !== b.prioridade) {
                return a.prioridade - b.prioridade;
            }
            return a.proximidade_cep - b.proximidade_cep;
        });

        // Retornar os 10 mais próximos
        const resultado = distribuidoresOrdenados.slice(0, 10).map(d => {
            const { prioridade, proximidade_cep, latitude, longitude, ...dados } = d;
            return dados;
        });

        res.json({
            sucesso: true,
            dados: resultado,
            endereco_colaborador: {
                cidade: colaborador.cidade,
                estado: colaborador.estado
            }
        });

    } catch (error) {
        console.error('Erro ao buscar distribuidores:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// SOLICITAÇÃO DE ALTERAÇÃO DE DADOS
// ========================================

// Criar solicitação de alteração
router.post('/solicitacao-alteracao', validate({
    tipo: {
        required: true,
        type: 'string',
        custom: (value) => ['endereco', 'telefone', 'email', 'outros'].includes(value),
        customMessage: 'Tipo deve ser: endereco, telefone, email ou outros'
    },
    descricao: {
        required: true,
        type: 'string',
        minLength: 10,
        maxLength: 500
    },
    dados_novos: {
        required: false,
        custom: (value) => {
            try {
                if (typeof value === 'string') {
                    JSON.parse(value);
                }
                return true;
            } catch {
                return false;
            }
        },
        customMessage: 'dados_novos deve ser um JSON válido'
    }
}), async (req, res) => {
    try {
        const { tipo, descricao, dados_novos } = req.body;

        // Verificar se já existe solicitação pendente do mesmo tipo
        const solicitacaoExistente = await getQuery(
            `SELECT id FROM solicitacoes_alteracao
             WHERE colaborador_id = ? AND tipo = ? AND status = 'pendente'`,
            [req.usuario.id, tipo]
        );

        if (solicitacaoExistente) {
            return res.status(400).json({
                erro: 'Já existe uma solicitação pendente deste tipo'
            });
        }

        const result = await runQuery(
            `INSERT INTO solicitacoes_alteracao (colaborador_id, tipo, descricao, dados_novos)
             VALUES (?, ?, ?, ?)`,
            [req.usuario.id, tipo, descricao, dados_novos ? JSON.stringify(dados_novos) : null]
        );

        res.status(201).json({
            sucesso: true,
            mensagem: 'Solicitação enviada com sucesso. Aguarde a análise do RH.',
            id: result.lastID
        });

    } catch (error) {
        console.error('Erro ao criar solicitação:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Listar minhas solicitações
router.get('/solicitacoes', async (req, res) => {
    try {
        const solicitacoes = await allQuery(
            `SELECT id, tipo, descricao, status, resposta_admin, criado_em, atualizado_em
             FROM solicitacoes_alteracao
             WHERE colaborador_id = ?
             ORDER BY criado_em DESC`,
            [req.usuario.id]
        );

        res.json({ sucesso: true, dados: solicitacoes });

    } catch (error) {
        console.error('Erro ao listar solicitações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// ALTERAR SENHA
// ========================================

router.post('/alterar-senha', async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias' });
        }

        if (nova_senha.length < 6) {
            return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres' });
        }

        const colaborador = await getQuery(
            'SELECT senha FROM colaboradores WHERE id = ?',
            [req.usuario.id]
        );

        const bcrypt = require('bcryptjs');
        const senhaValida = await bcrypt.compare(senha_atual, colaborador.senha);

        if (!senhaValida) {
            return res.status(400).json({ erro: 'Senha atual incorreta' });
        }

        const novaSenhaHash = await bcrypt.hash(nova_senha, 10);

        await runQuery(
            'UPDATE colaboradores SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [novaSenhaHash, req.usuario.id]
        );

        res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// AVALIAÇÕES DE DISTRIBUIDORES
// ========================================

// Listar retiradas pendentes de avaliação
router.get('/avaliacoes/pendentes', async (req, res) => {
    try {
        const retiradas = await allQuery(`
            SELECT 
                h.id as retirada_id,
                h.codigo,
                h.mes_referencia,
                h.data_retirada,
                h.distribuidor_nome,
                d.id as distribuidor_id,
                d.logradouro || ', ' || d.numero || ' - ' || d.bairro as endereco,
                d.cidade,
                d.estado
            FROM historico_retiradas h
            JOIN distribuidores d ON h.distribuidor_id = d.id
            LEFT JOIN avaliacoes_distribuidores a ON h.id = a.retirada_id
            WHERE h.colaborador_id = ?
            AND a.id IS NULL
            ORDER BY h.data_retirada DESC
            LIMIT 10
        `, [req.usuario.id]);

        res.json({ sucesso: true, dados: retiradas });
    } catch (error) {
        console.error('Erro ao buscar avaliações pendentes:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Enviar avaliação
router.post('/avaliacoes', async (req, res) => {
    try {
        const { retirada_id, nota, comentario } = req.body;

        if (!retirada_id || !nota) {
            return res.status(400).json({ erro: 'Retirada e nota são obrigatórios' });
        }

        if (nota < 1 || nota > 5) {
            return res.status(400).json({ erro: 'Nota deve ser entre 1 e 5' });
        }

        // Verificar se a retirada pertence ao colaborador
        const retirada = await getQuery(`
            SELECT id, distribuidor_id FROM historico_retiradas 
            WHERE id = ? AND colaborador_id = ?
        `, [retirada_id, req.usuario.id]);

        if (!retirada) {
            return res.status(404).json({ erro: 'Retirada não encontrada' });
        }

        // Verificar se já foi avaliada
        const avaliacaoExiste = await getQuery(
            'SELECT id FROM avaliacoes_distribuidores WHERE retirada_id = ?',
            [retirada_id]
        );

        if (avaliacaoExiste) {
            return res.status(400).json({ erro: 'Esta retirada já foi avaliada' });
        }

        // Inserir avaliação
        await runQuery(`
            INSERT INTO avaliacoes_distribuidores (retirada_id, colaborador_id, distribuidor_id, nota, comentario)
            VALUES (?, ?, ?, ?, ?)
        `, [retirada_id, req.usuario.id, retirada.distribuidor_id, nota, comentario || null]);

        res.json({ sucesso: true, mensagem: 'Avaliação enviada com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar avaliação:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Listar minhas avaliações
router.get('/avaliacoes', async (req, res) => {
    try {
        const avaliacoes = await allQuery(`
            SELECT 
                a.id,
                a.nota,
                a.comentario,
                a.criado_em,
                h.codigo,
                h.mes_referencia,
                h.distribuidor_nome
            FROM avaliacoes_distribuidores a
            JOIN historico_retiradas h ON a.retirada_id = h.id
            WHERE a.colaborador_id = ?
            ORDER BY a.criado_em DESC
            LIMIT 20
        `, [req.usuario.id]);

        res.json({ sucesso: true, dados: avaliacoes });
    } catch (error) {
        console.error('Erro ao buscar avaliações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

module.exports = router;

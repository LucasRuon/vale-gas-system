const express = require('express');
const router = express.Router();
const { getQuery, allQuery, runQuery } = require('../database');
const { autenticarDistribuidor } = require('../auth');
const { getMesReferencia, formatarCPF } = require('../utils');
const { notificarValeRetirado } = require('../webhooks');
const logger = require('../config/logger');

// Aplicar autenticação em todas as rotas
router.use(autenticarDistribuidor);

// ========================================
// PERFIL DO DISTRIBUIDOR
// ========================================

// Ver perfil
router.get('/perfil', async (req, res) => {
    try {
        const distribuidor = await getQuery(
            `SELECT id, nome, cnpj, email, telefone, responsavel,
                    cep, logradouro, numero, complemento, bairro, cidade, estado,
                    horario_funcionamento, criado_em
             FROM distribuidores WHERE id = ?`,
            [req.usuario.id]
        );

        if (!distribuidor) {
            return res.status(404).json({ erro: 'Distribuidor não encontrado' });
        }

        res.json({ sucesso: true, dados: distribuidor });

    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// VALIDAÇÃO DE VALE-GÁS
// ========================================

// Consultar vale-gás por código (sem validar/utilizar)
router.get('/validar/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const mesReferencia = getMesReferencia();

        const vale = await getQuery(
            `SELECT v.*, c.nome as colaborador_nome, c.cpf as colaborador_cpf
             FROM vales_gas v
             JOIN colaboradores c ON v.colaborador_id = c.id
             WHERE v.codigo = ?`,
            [codigo.toUpperCase()]
        );

        if (!vale) {
            return res.json({
                sucesso: false,
                valido: false,
                mensagem: 'Código não encontrado'
            });
        }

        // Verificar status
        if (vale.status === 'utilizado') {
            return res.json({
                sucesso: true,
                valido: false,
                mensagem: 'Este vale já foi utilizado',
                dados: {
                    codigo: vale.codigo,
                    status: vale.status,
                    colaborador_nome: vale.colaborador_nome,
                    colaborador_cpf: formatarCPF(vale.colaborador_cpf),
                    data_retirada: vale.data_retirada
                }
            });
        }

        if (vale.status === 'expirado') {
            return res.json({
                sucesso: true,
                valido: false,
                mensagem: 'Este vale está expirado',
                dados: {
                    codigo: vale.codigo,
                    status: vale.status,
                    mes_referencia: vale.mes_referencia,
                    data_expiracao: vale.data_expiracao
                }
            });
        }

        // Verificar se está no mês correto
        if (vale.mes_referencia !== mesReferencia) {
            return res.json({
                sucesso: true,
                valido: false,
                mensagem: 'Este vale não é do mês atual',
                dados: {
                    codigo: vale.codigo,
                    mes_referencia: vale.mes_referencia,
                    mes_atual: mesReferencia
                }
            });
        }

        // Verificar expiração
        const hoje = new Date();
        const expiracao = new Date(vale.data_expiracao);
        if (hoje > expiracao) {
            // Atualizar status para expirado
            await runQuery(
                'UPDATE vales_gas SET status = ? WHERE id = ?',
                ['expirado', vale.id]
            );

            return res.json({
                sucesso: true,
                valido: false,
                mensagem: 'Este vale está expirado',
                dados: {
                    codigo: vale.codigo,
                    data_expiracao: vale.data_expiracao
                }
            });
        }

        // Vale válido!
        res.json({
            sucesso: true,
            valido: true,
            mensagem: 'Vale-gás válido para retirada',
            dados: {
                codigo: vale.codigo,
                colaborador_nome: vale.colaborador_nome,
                colaborador_cpf: formatarCPF(vale.colaborador_cpf),
                mes_referencia: vale.mes_referencia,
                data_expiracao: vale.data_expiracao
            }
        });

    } catch (error) {
        console.error('Erro ao consultar vale:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Confirmar retirada do vale-gás
router.post('/confirmar-retirada', async (req, res) => {
    try {
        const { codigo } = req.body;

        if (!codigo) {
            return res.status(400).json({ erro: 'Código é obrigatório' });
        }

        const mesReferencia = getMesReferencia();

        // Buscar vale
        const vale = await getQuery(
            `SELECT v.*, c.id as colaborador_id, c.nome as colaborador_nome, 
                    c.cpf as colaborador_cpf, c.email as colaborador_email,
                    c.telefone as colaborador_telefone
             FROM vales_gas v
             JOIN colaboradores c ON v.colaborador_id = c.id
             WHERE v.codigo = ? AND v.status = 'ativo'`,
            [codigo.toUpperCase()]
        );

        if (!vale) {
            return res.status(400).json({ 
                erro: 'Vale não encontrado ou não disponível para retirada' 
            });
        }

        // Verificar mês
        if (vale.mes_referencia !== mesReferencia) {
            return res.status(400).json({ 
                erro: 'Este vale não é do mês atual' 
            });
        }

        // Verificar expiração
        const hoje = new Date();
        const expiracao = new Date(vale.data_expiracao);
        if (hoje > expiracao) {
            await runQuery('UPDATE vales_gas SET status = ? WHERE id = ?', ['expirado', vale.id]);
            return res.status(400).json({ erro: 'Este vale está expirado' });
        }

        // Buscar dados do distribuidor
        const distribuidor = await getQuery(
            'SELECT id, nome FROM distribuidores WHERE id = ?',
            [req.usuario.id]
        );

        // Atualizar vale como utilizado
        await runQuery(
            `UPDATE vales_gas 
             SET status = 'utilizado', distribuidor_id = ?, data_retirada = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [req.usuario.id, vale.id]
        );

        // Registrar no histórico
        await runQuery(
            `INSERT INTO historico_retiradas 
             (vale_id, colaborador_id, distribuidor_id, codigo, mes_referencia, 
              colaborador_nome, colaborador_cpf, distribuidor_nome)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [vale.id, vale.colaborador_id, req.usuario.id, vale.codigo, vale.mes_referencia,
             vale.colaborador_nome, vale.colaborador_cpf, distribuidor.nome]
        );

        // Enviar webhook de notificação
        await notificarValeRetirado(
            {
                id: vale.colaborador_id,
                nome: vale.colaborador_nome,
                email: vale.colaborador_email,
                telefone: vale.colaborador_telefone
            },
            distribuidor,
            vale.codigo,
            vale.mes_referencia
        );

        // Criar reembolso automaticamente se configurado
        const configReembolsoAuto = await getQuery(
            'SELECT valor FROM configuracoes WHERE chave = ?',
            ['gerar_reembolso_automatico']
        );

        if (configReembolsoAuto && configReembolsoAuto.valor === 'true') {
            // Verificar se é distribuidor externo (apenas externos recebem reembolso)
            const distribuidorTipo = await getQuery(
                'SELECT tipo_distribuidor FROM distribuidores WHERE id = ?',
                [req.usuario.id]
            );

            const isExterno = !distribuidorTipo || !distribuidorTipo.tipo_distribuidor || distribuidorTipo.tipo_distribuidor === 'externo';

            if (isExterno) {
                // Buscar valor padrão de reembolso
                const configValor = await getQuery(
                    'SELECT valor FROM configuracoes WHERE chave = ?',
                    ['valor_reembolso_padrao']
                );

                const valorReembolso = configValor ? parseFloat(configValor.valor) : 100.00;

                // Criar reembolso
                await runQuery(`
                    INSERT INTO reembolsos
                    (vale_id, distribuidor_id, colaborador_id, valor, mes_referencia, data_validacao, status)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'a_validar')
                `, [vale.id, req.usuario.id, vale.colaborador_id, valorReembolso, vale.mes_referencia]);

                logger.logInfo('Reembolso criado automaticamente', {
                    vale_id: vale.id,
                    distribuidor_id: req.usuario.id,
                    valor: valorReembolso,
                    tipo: 'externo'
                });
            } else {
                logger.logInfo('Reembolso não criado (distribuidor interno)', {
                    vale_id: vale.id,
                    distribuidor_id: req.usuario.id,
                    tipo: 'interno'
                });
            }
        }

        res.json({
            sucesso: true,
            mensagem: 'Retirada confirmada com sucesso!',
            dados: {
                codigo: vale.codigo,
                colaborador: vale.colaborador_nome,
                data_retirada: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Erro ao confirmar retirada:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// HISTÓRICO DE RETIRADAS
// ========================================

// Listar retiradas realizadas por este distribuidor
router.get('/retiradas', async (req, res) => {
    try {
        const { mes, pagina = 1, limite = 20 } = req.query;
        const offset = (pagina - 1) * limite;
        const mesReferencia = mes || getMesReferencia();

        const retiradas = await allQuery(
            `SELECT h.*, 
                    DATE(h.data_retirada) as data_formatada,
                    TIME(h.data_retirada) as hora_formatada
             FROM historico_retiradas h
             WHERE h.distribuidor_id = ? AND h.mes_referencia = ?
             ORDER BY h.data_retirada DESC
             LIMIT ? OFFSET ?`,
            [req.usuario.id, mesReferencia, parseInt(limite), parseInt(offset)]
        );

        const countResult = await getQuery(
            `SELECT COUNT(*) as total FROM historico_retiradas 
             WHERE distribuidor_id = ? AND mes_referencia = ?`,
            [req.usuario.id, mesReferencia]
        );

        // Formatar CPF
        const retiradasFormatadas = retiradas.map(r => ({
            ...r,
            colaborador_cpf: formatarCPF(r.colaborador_cpf)
        }));

        res.json({
            sucesso: true,
            dados: retiradasFormatadas,
            mes_referencia: mesReferencia,
            paginacao: {
                total: countResult.total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(countResult.total / limite)
            }
        });

    } catch (error) {
        console.error('Erro ao listar retiradas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// DASHBOARD DO DISTRIBUIDOR
// ========================================

router.get('/dashboard', async (req, res) => {
    try {
        const mesReferencia = getMesReferencia();

        // Total de retiradas no mês
        const retiradasMes = await getQuery(
            `SELECT COUNT(*) as total FROM historico_retiradas 
             WHERE distribuidor_id = ? AND mes_referencia = ?`,
            [req.usuario.id, mesReferencia]
        );

        // Retiradas hoje
        const retiradasHoje = await getQuery(
            `SELECT COUNT(*) as total FROM historico_retiradas 
             WHERE distribuidor_id = ? AND DATE(data_retirada) = DATE('now')`,
            [req.usuario.id]
        );

        // Últimas 5 retiradas
        const ultimasRetiradas = await allQuery(
            `SELECT colaborador_nome, colaborador_cpf, codigo, data_retirada
             FROM historico_retiradas
             WHERE distribuidor_id = ?
             ORDER BY data_retirada DESC
             LIMIT 5`,
            [req.usuario.id]
        );

        // Histórico dos últimos 6 meses
        const historicoMensal = await allQuery(
            `SELECT mes_referencia, COUNT(*) as total
             FROM historico_retiradas
             WHERE distribuidor_id = ?
             GROUP BY mes_referencia
             ORDER BY mes_referencia DESC
             LIMIT 6`,
            [req.usuario.id]
        );

        res.json({
            sucesso: true,
            dados: {
                mes_referencia: mesReferencia,
                retiradas_mes: retiradasMes.total,
                retiradas_hoje: retiradasHoje.total,
                ultimas_retiradas: ultimasRetiradas.map(r => ({
                    ...r,
                    colaborador_cpf: formatarCPF(r.colaborador_cpf)
                })),
                historico_mensal: historicoMensal
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
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

        const distribuidor = await getQuery(
            'SELECT senha FROM distribuidores WHERE id = ?',
            [req.usuario.id]
        );

        const bcrypt = require('bcryptjs');
        const senhaValida = await bcrypt.compare(senha_atual, distribuidor.senha);

        if (!senhaValida) {
            return res.status(400).json({ erro: 'Senha atual incorreta' });
        }

        const novaSenhaHash = await bcrypt.hash(nova_senha, 10);

        await runQuery(
            'UPDATE distribuidores SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
            [novaSenhaHash, req.usuario.id]
        );

        res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

module.exports = router;

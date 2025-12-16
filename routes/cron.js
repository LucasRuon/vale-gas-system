const express = require('express');
const router = express.Router();
const { getQuery, allQuery, runQuery } = require('../database');
const { gerarCodigoVale, getMesReferencia, getDataExpiracao, getConfiguracao } = require('../utils');
const { notificarCodigoGerado, verificarValesProximosExpirar } = require('../webhooks');
const { registrarAuditoria } = require('../auditoria');

// Middleware para verificar chave de API do cron
const verificarChaveCron = (req, res, next) => {
    const chaveEnviada = req.headers['x-cron-key'] || req.query.cron_key;
    const chaveCorreta = process.env.CRON_API_KEY;

    if (!chaveCorreta) {
        console.warn('⚠️ CRON_API_KEY não configurada no .env');
        return res.status(500).json({ erro: 'Chave de cron não configurada no servidor' });
    }

    if (chaveEnviada !== chaveCorreta) {
        return res.status(401).json({ erro: 'Chave de cron inválida' });
    }

    next();
};

// Função auxiliar para buscar configuração (agora usa cache)
const getConfig = async (chave, valorPadrao = null) => {
    try {
        return await getConfiguracao(chave, valorPadrao);
    } catch (error) {
        return valorPadrao;
    }
};

// ==================== ENDPOINTS DE CRON ====================

/**
 * POST /api/cron/gerar-vales
 * Gera vales para todos os colaboradores ativos que ainda não têm
 * 
 * Headers: x-cron-key: <CRON_API_KEY>
 * 
 * Configurar no crontab:
 * 0 6 1 * * curl -X POST -H "x-cron-key: SUA_CHAVE" http://localhost:3000/api/cron/gerar-vales
 */
router.post('/gerar-vales', verificarChaveCron, async (req, res) => {
    const inicio = Date.now();
    
    try {
        const mesReferencia = getMesReferencia();
        const diaAtual = new Date().getDate();
        
        // Verificar se é o dia configurado para geração
        const diaGeracao = parseInt(await getConfig('dia_geracao_automatica', '1'));
        const forcarGeracao = req.query.forcar === 'true';
        
        if (diaAtual !== diaGeracao && !forcarGeracao) {
            return res.json({
                sucesso: true,
                mensagem: `Hoje não é dia de geração automática (configurado: dia ${diaGeracao})`,
                gerados: 0,
                pulado: true
            });
        }
        
        // Buscar configurações
        const valesPorMes = parseInt(await getConfig('vales_por_mes', '1'));
        const diasValidade = parseInt(await getConfig('dias_validade_vale', '30'));
        const dataExpiracao = getDataExpiracao(diasValidade);

        // Buscar colaboradores que precisam de vales
        const colaboradores = await allQuery(`
            SELECT c.id, c.nome, c.email, c.telefone,
                   COALESCE((SELECT COUNT(*) FROM vales_gas v WHERE v.colaborador_id = c.id AND v.mes_referencia = ?), 0) as vales_atuais
            FROM colaboradores c
            WHERE c.ativo = 1
            AND COALESCE((SELECT COUNT(*) FROM vales_gas v WHERE v.colaborador_id = c.id AND v.mes_referencia = ?), 0) < ?
        `, [mesReferencia, mesReferencia, valesPorMes]);

        if (colaboradores.length === 0) {
            return res.json({
                sucesso: true,
                mensagem: 'Todos os colaboradores já possuem vales para este mês',
                gerados: 0,
                mes_referencia: mesReferencia
            });
        }

        let gerados = 0;
        let erros = 0;
        const detalhes = [];

        for (const colaborador of colaboradores) {
            try {
                const valesFaltando = valesPorMes - colaborador.vales_atuais;
                
                for (let i = 0; i < valesFaltando; i++) {
                    // Gerar código único com retry e backoff
                    let codigo;
                    let tentativas = 0;
                    const maxTentativas = 10;
                    let sucesso = false;

                    while (!sucesso && tentativas < maxTentativas) {
                        try {
                            codigo = gerarCodigoVale();

                            // Tentar inserir diretamente - UNIQUE constraint evita duplicatas
                            await runQuery(
                                `INSERT INTO vales_gas (colaborador_id, codigo, mes_referencia, data_expiracao) VALUES (?, ?, ?, ?)`,
                                [colaborador.id, codigo, mesReferencia, dataExpiracao]
                            );

                            sucesso = true;
                        } catch (error) {
                            tentativas++;

                            // Se for erro de UNIQUE constraint, tentar novamente
                            if (error.code === 'SQLITE_CONSTRAINT' && tentativas < maxTentativas) {
                                // Backoff exponencial: 10ms, 20ms, 40ms, etc.
                                await new Promise(resolve => setTimeout(resolve, 10 * Math.pow(2, tentativas)));
                                continue;
                            }

                            // Se não for constraint ou esgotou tentativas, propagar erro
                            throw error;
                        }
                    }

                    if (!sucesso) {
                        throw new Error(`Não foi possível gerar código único após ${maxTentativas} tentativas`);
                    }

                    // Enviar notificação
                    await notificarCodigoGerado(colaborador, codigo, mesReferencia, dataExpiracao);

                    gerados++;
                    detalhes.push({
                        colaborador_id: colaborador.id,
                        nome: colaborador.nome,
                        codigo
                    });
                }
            } catch (e) {
                console.error(`Erro ao gerar vale para ${colaborador.nome}:`, e);
                erros++;
            }
        }

        // Registrar na auditoria
        await registrarAuditoria({
            tipo_usuario: 'sistema',
            usuario_id: 0,
            usuario_nome: 'Cron Job',
            acao: 'gerar_vales_automatico',
            detalhes: {
                mes_referencia: mesReferencia,
                gerados,
                erros,
                colaboradores_processados: colaboradores.length
            },
            ip: req.ip
        });

        const duracao = Date.now() - inicio;

        res.json({
            sucesso: true,
            mensagem: `Geração automática concluída`,
            mes_referencia: mesReferencia,
            data_expiracao: dataExpiracao,
            gerados,
            erros,
            colaboradores_processados: colaboradores.length,
            vales_por_colaborador: valesPorMes,
            duracao_ms: duracao
        });

    } catch (error) {
        console.error('Erro na geração automática:', error);
        res.status(500).json({ erro: 'Erro interno do servidor', detalhes: error.message });
    }
});

/**
 * POST /api/cron/enviar-lembretes
 * Envia lembretes de expiração para vales próximos de vencer
 * 
 * Configurar no crontab (diariamente às 9h):
 * 0 9 * * * curl -X POST -H "x-cron-key: SUA_CHAVE" http://localhost:3000/api/cron/enviar-lembretes
 */
router.post('/enviar-lembretes', verificarChaveCron, async (req, res) => {
    const inicio = Date.now();
    
    try {
        // Buscar configuração de dias para lembrete
        const diasConfig = await getConfig('notificar_expiracao_dias', '7,3,1');
        const dias = diasConfig.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
        
        const resultado = await verificarValesProximosExpirar(dias);
        
        // Registrar na auditoria
        await registrarAuditoria({
            tipo_usuario: 'sistema',
            usuario_id: 0,
            usuario_nome: 'Cron Job',
            acao: 'enviar_lembretes_automatico',
            detalhes: {
                dias_verificados: dias,
                lembretes_enviados: resultado
            },
            ip: req.ip
        });

        const duracao = Date.now() - inicio;

        res.json({
            sucesso: true,
            mensagem: 'Lembretes processados',
            dias_verificados: dias,
            lembretes_enviados: resultado,
            duracao_ms: duracao
        });

    } catch (error) {
        console.error('Erro ao enviar lembretes:', error);
        res.status(500).json({ erro: 'Erro interno do servidor', detalhes: error.message });
    }
});

/**
 * POST /api/cron/expirar-vales
 * Marca como expirados os vales que passaram da data de validade
 * 
 * Configurar no crontab (diariamente à meia-noite):
 * 0 0 * * * curl -X POST -H "x-cron-key: SUA_CHAVE" http://localhost:3000/api/cron/expirar-vales
 */
router.post('/expirar-vales', verificarChaveCron, async (req, res) => {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        
        // Marcar vales expirados
        const result = await runQuery(`
            UPDATE vales_gas 
            SET status = 'expirado' 
            WHERE status = 'ativo' 
            AND data_expiracao < ?
        `, [hoje]);

        // Registrar na auditoria
        await registrarAuditoria({
            tipo_usuario: 'sistema',
            usuario_id: 0,
            usuario_nome: 'Cron Job',
            acao: 'expirar_vales_automatico',
            detalhes: {
                data_referencia: hoje,
                vales_expirados: result.changes
            },
            ip: req.ip
        });

        res.json({
            sucesso: true,
            mensagem: 'Vales expirados atualizados',
            vales_expirados: result.changes,
            data_referencia: hoje
        });

    } catch (error) {
        console.error('Erro ao expirar vales:', error);
        res.status(500).json({ erro: 'Erro interno do servidor', detalhes: error.message });
    }
});

/**
 * GET /api/cron/status
 * Retorna status do sistema de cron (para monitoramento)
 */
router.get('/status', verificarChaveCron, async (req, res) => {
    try {
        const mesReferencia = getMesReferencia();
        
        // Estatísticas gerais
        const totalColaboradores = await getQuery('SELECT COUNT(*) as total FROM colaboradores WHERE ativo = 1');
        const valesMes = await getQuery('SELECT COUNT(*) as total FROM vales_gas WHERE mes_referencia = ?', [mesReferencia]);
        const valesAtivos = await getQuery('SELECT COUNT(*) as total FROM vales_gas WHERE status = "ativo"');
        const valesExpirandoHoje = await getQuery(`
            SELECT COUNT(*) as total FROM vales_gas 
            WHERE status = 'ativo' AND data_expiracao = date('now')
        `);
        
        // Última execução de cada cron
        const ultimaGeracao = await getQuery(`
            SELECT criado_em FROM logs_auditoria 
            WHERE acao = 'gerar_vales_automatico' 
            ORDER BY criado_em DESC LIMIT 1
        `);
        const ultimoLembrete = await getQuery(`
            SELECT criado_em FROM logs_auditoria 
            WHERE acao = 'enviar_lembretes_automatico' 
            ORDER BY criado_em DESC LIMIT 1
        `);

        // Configurações atuais
        const configs = {};
        const configRows = await allQuery('SELECT chave, valor FROM configuracoes');
        configRows.forEach(c => configs[c.chave] = c.valor);

        res.json({
            sucesso: true,
            status: 'online',
            timestamp: new Date().toISOString(),
            mes_referencia: mesReferencia,
            estatisticas: {
                colaboradores_ativos: totalColaboradores?.total || 0,
                vales_mes_atual: valesMes?.total || 0,
                vales_ativos_total: valesAtivos?.total || 0,
                vales_expirando_hoje: valesExpirandoHoje?.total || 0
            },
            ultima_execucao: {
                geracao_vales: ultimaGeracao?.criado_em || 'Nunca',
                envio_lembretes: ultimoLembrete?.criado_em || 'Nunca'
            },
            configuracoes: configs
        });

    } catch (error) {
        console.error('Erro ao buscar status:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

module.exports = router;

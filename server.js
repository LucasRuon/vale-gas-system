require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const { exec } = require('child_process');

// Importar configurações
const logger = require('./config/logger');
const cache = require('./config/cache');

// Importar middlewares
const { errorHandler, notFoundHandler, asyncHandler } = require('./middlewares/errorHandler');
const { sanitizeBody } = require('./middlewares/sanitize');

// Importar módulos do sistema
const { initDatabase, allQuery, runQuery, getQuery } = require('./database');
const { gerarCodigoVale, getMesReferencia, getDataExpiracao } = require('./utils');
const { notificarCodigoGerado, notificarLembreteExpiracao } = require('./webhooks');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// SEGURANÇA - HELMET
// ========================================
// CSP mais permissivo em desenvolvimento, restritivo em produção
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            scriptSrcAttr: isDevelopment ? ["'unsafe-inline'"] : null, // Permite onclick, onload, etc em dev
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// ========================================
// CORS RESTRITIVO
// ========================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Permitir requisições sem origin (mobile apps, Postman, etc)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            logger.logSecurity('CORS bloqueado', { origin });
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    credentials: true
}));

// ========================================
// RATE LIMITING
// ========================================

// Rate limit para login (ajustado por ambiente)
const loginLimiter = rateLimit({
    windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 min (dev) ou 15 min (prod)
    max: isDevelopment ? 100 : 50, // 100 tentativas (dev) ou 50 (prod) - Aumentado para testes
    message: {
        erro: isDevelopment
            ? 'Muitas tentativas de login. Aguarde 1 minuto.'
            : 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        tentativas_restantes: 0
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.logSecurity('Rate limit excedido - Login', {
            ip: req.ip,
            url: req.originalUrl,
            ambiente: process.env.NODE_ENV
        });
        res.status(429).json({
            erro: isDevelopment
                ? 'Muitas tentativas de login. Aguarde 1 minuto.'
                : 'Muitas tentativas de login. Tente novamente em 15 minutos.'
        });
    },
    // Pular rate limit se variável de ambiente estiver definida
    skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true'
});

// Rate limit geral para API
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: isDevelopment ? 1000 : 100, // 1000 (dev) ou 100 (prod) requisições por minuto
    message: {
        erro: 'Muitas requisições. Aguarde um momento.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true'
});

// ========================================
// MIDDLEWARES GERAIS
// ========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitizar todos os inputs
app.use(sanitizeBody);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de logging de requisições
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;

        logger.logInfo('Requisição HTTP', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration_ms: duration,
            ip: req.ip,
            usuario: req.usuario?.id
        });

        // Log de performance para requisições lentas
        if (duration > 1000) {
            logger.logPerformance('Requisição lenta', duration, {
                method: req.method,
                url: req.originalUrl
            });
        }
    });

    next();
});

// ========================================
// ROTAS DA API
// ========================================

// Aplicar rate limit em rotas de autenticação
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));

// Aplicar rate limit geral nas APIs
app.use('/api', apiLimiter);

// Rotas do painel admin (RH)
app.use('/api/admin', require('./routes/admin'));

// Rotas de reembolsos (admin)
app.use('/api/admin/reembolsos', require('./routes/reembolsos'));

// Rotas do painel colaborador
app.use('/api/colaborador', require('./routes/colaborador'));

// Rotas do painel distribuidor
app.use('/api/distribuidor', require('./routes/distribuidor'));

// Rotas de cron/agendamento (protegidas por chave de API)
app.use('/api/cron', require('./routes/cron'));

// ========================================
// HEALTH CHECK COMPLETO
// ========================================
app.get('/api/health', asyncHandler(async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {}
    };

    // Verificar banco de dados
    try {
        const start = Date.now();
        await getQuery('SELECT 1');
        const latency = Date.now() - start;

        health.checks.database = {
            status: 'ok',
            latency_ms: latency
        };
    } catch (error) {
        health.status = 'unhealthy';
        health.checks.database = {
            status: 'error',
            error: error.message
        };
    }

    // Verificar memória
    const memoryUsage = process.memoryUsage();
    const memoryUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    health.checks.memory = {
        status: memoryUsedPercent > 90 ? 'critical' : memoryUsedPercent > 75 ? 'warning' : 'ok',
        used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        percent: Math.round(memoryUsedPercent)
    };

    // Verificar cache
    const cacheStats = cache.getStats();
    health.checks.cache = {
        status: 'ok',
        keys: cacheStats.keys,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hit_rate: cacheStats.hits > 0 ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100) : 0
    };

    // Status HTTP baseado na saúde geral
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(health);
}));

// ========================================
// ROTA DE MÉTRICAS (ADMIN)
// ========================================
app.get('/api/metrics', asyncHandler(async (req, res) => {
    const { autenticarAdmin } = require('./auth');

    // Verificar autenticação (simplificado para esta rota)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ erro: 'Não autorizado' });
    }

    // Buscar métricas em cache ou calcular
    const metrics = await cache.wrap('metrics:dashboard', 300, async () => {
        // Vales
        const valesAtivos = await getQuery('SELECT COUNT(*) as total FROM vales_gas WHERE status = "ativo"');
        const valesUtilizados = await getQuery('SELECT COUNT(*) as total FROM vales_gas WHERE status = "utilizado" AND strftime("%Y-%m", data_retirada) = strftime("%Y-%m", "now")');
        const valesExpirando = await getQuery('SELECT COUNT(*) as total FROM vales_gas WHERE status = "ativo" AND DATE(data_expiracao) <= DATE("now", "+7 days")');

        // Colaboradores
        const colaboradoresAtivos = await getQuery('SELECT COUNT(*) as total FROM colaboradores WHERE ativo = 1');
        const colaboradoresNovos = await getQuery('SELECT COUNT(*) as total FROM colaboradores WHERE DATE(criado_em) >= DATE("now", "-30 days")');

        // Distribuidores
        const distribuidoresAtivos = await getQuery('SELECT COUNT(*) as total FROM distribuidores WHERE ativo = 1');

        // Top distribuidor
        const topDistribuidor = await getQuery(`
            SELECT d.nome, COUNT(*) as retiradas
            FROM historico_retiradas h
            JOIN distribuidores d ON h.distribuidor_id = d.id
            WHERE strftime('%Y-%m', h.data_retirada) = strftime('%Y-%m', 'now')
            GROUP BY d.id
            ORDER BY retiradas DESC
            LIMIT 1
        `);

        // Webhooks com falha
        const webhooksFalhas = await getQuery(`
            SELECT COUNT(*) as total
            FROM logs_webhook
            WHERE sucesso = 0 AND datetime(criado_em) >= datetime('now', '-24 hours')
        `);

        return {
            vales: {
                ativos: valesAtivos.total,
                utilizados_mes: valesUtilizados.total,
                expirando_7_dias: valesExpirando.total,
                taxa_utilizacao: valesAtivos.total > 0
                    ? Math.round((valesUtilizados.total / valesAtivos.total) * 100)
                    : 0
            },
            colaboradores: {
                ativos: colaboradoresAtivos.total,
                novos_mes: colaboradoresNovos.total
            },
            distribuidores: {
                ativos: distribuidoresAtivos.total,
                top_mes: topDistribuidor ? topDistribuidor.nome : 'N/A'
            },
            sistema: {
                webhooks_falhas_24h: webhooksFalhas.total,
                cache_hit_rate: cache.getStats().hits > 0
                    ? Math.round((cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses)) * 100)
                    : 0
            }
        };
    });

    res.json({
        sucesso: true,
        dados: metrics,
        timestamp: new Date().toISOString()
    });
}));

// Rota para buscar endereço por CEP (pública, com cache)
app.get('/api/cep/:cep', asyncHandler(async (req, res) => {
    const { cep } = req.params;

    // Tentar buscar no cache primeiro
    const cacheKey = cache.KEYS.CEP(cep);
    const cachedEndereco = cache.get(cacheKey);

    if (cachedEndereco) {
        return res.json({ sucesso: true, dados: cachedEndereco, from_cache: true });
    }

    // Buscar da API
    const { buscarEnderecoPorCEP } = require('./utils');
    const endereco = await buscarEnderecoPorCEP(cep);

    if (!endereco) {
        return res.status(404).json({ erro: 'CEP não encontrado' });
    }

    // Cachear por 24 horas (CEP não muda)
    cache.set(cacheKey, endereco, 86400);

    res.json({ sucesso: true, dados: endereco });
}));

// ========================================
// TAREFAS AGENDADAS (CRON)
// ========================================

// Função auxiliar para buscar configuração (com cache)
const getConfigValue = async (chave, valorPadrao) => {
    return await cache.wrap(`config:${chave}`, 3600, async () => {
        try {
            const config = await getQuery('SELECT valor FROM configuracoes WHERE chave = ?', [chave]);
            return config ? config.valor : valorPadrao;
        } catch (error) {
            logger.logError('Erro ao buscar configuração', error, { chave });
            return valorPadrao;
        }
    });
};

// Backup automático diário às 2h da manhã
cron.schedule('0 2 * * *', () => {
    logger.logInfo('Iniciando backup automático do banco de dados...');

    exec('bash scripts/backup.sh', (error, stdout, stderr) => {
        if (error) {
            logger.logError('Erro no backup automático', error);
            return;
        }
        logger.logInfo('Backup automático concluído', { output: stdout });
    });
});

// Gerar códigos mensais automaticamente
cron.schedule('1 0 * * *', async () => {
    const diaAtual = new Date().getDate();
    const diaGeracao = parseInt(await getConfigValue('dia_geracao_automatica', '1'));

    if (diaAtual !== diaGeracao) {
        return; // Não é dia de geração
    }

    logger.logInfo('Iniciando geração automática de códigos mensais...');

    try {
        const mesReferencia = getMesReferencia();
        const valesPorMes = parseInt(await getConfigValue('vales_por_mes', '1'));
        const diasValidade = parseInt(await getConfigValue('dias_validade_vale', '30'));
        const dataExpiracao = getDataExpiracao(diasValidade);

        const colaboradores = await allQuery(`
            SELECT c.id, c.nome, c.email, c.telefone,
                   COALESCE((SELECT COUNT(*) FROM vales_gas v WHERE v.colaborador_id = c.id AND v.mes_referencia = ?), 0) as vales_atuais
            FROM colaboradores c
            WHERE c.ativo = 1
            AND COALESCE((SELECT COUNT(*) FROM vales_gas v WHERE v.colaborador_id = c.id AND v.mes_referencia = ?), 0) < ?
        `, [mesReferencia, mesReferencia, valesPorMes]);

        if (colaboradores.length === 0) {
            logger.logInfo(`Todos colaboradores já possuem ${valesPorMes} vale(s) para ${mesReferencia}`);
            return;
        }

        let gerados = 0;
        for (const colaborador of colaboradores) {
            try {
                const valesFaltando = valesPorMes - colaborador.vales_atuais;

                for (let i = 0; i < valesFaltando; i++) {
                    // Gerar código único com retry e backoff exponencial
                    let codigo;
                    let tentativas = 0;
                    const maxTentativas = 10;
                    let sucesso = false;

                    while (!sucesso && tentativas < maxTentativas) {
                        try {
                            codigo = gerarCodigoVale();

                            // Tentar inserir diretamente - UNIQUE constraint previne duplicatas
                            await runQuery(
                                `INSERT INTO vales_gas (colaborador_id, codigo, mes_referencia, data_expiracao)
                                 VALUES (?, ?, ?, ?)`,
                                [colaborador.id, codigo, mesReferencia, dataExpiracao]
                            );

                            sucesso = true;
                        } catch (error) {
                            tentativas++;

                            // Se for erro de UNIQUE constraint, tentar novamente
                            if (error.code === 'SQLITE_CONSTRAINT' && tentativas < maxTentativas) {
                                // Backoff exponencial: 10ms, 20ms, 40ms, 80ms, etc.
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

                    await notificarCodigoGerado(colaborador, codigo, mesReferencia, dataExpiracao);
                    gerados++;
                }
            } catch (e) {
                logger.logError(`Erro ao gerar vale para colaborador ${colaborador.id}`, e);
            }
        }

        logger.logInfo(`Geração automática concluída: ${gerados} códigos gerados para ${mesReferencia}`);

        // Limpar cache
        cache.delPattern('vales:');
        cache.delPattern('metrics:');
    } catch (error) {
        logger.logError('Erro na geração automática de códigos', error);
    }
});

// Verificar vales próximos de expirar - Executa todos os dias às 09:00
cron.schedule('0 9 * * *', async () => {
    logger.logInfo('Verificando vales próximos de expirar...');

    try {
        const diasConfig = await getConfigValue('notificar_expiracao_dias', '7,3,1');
        const dias = diasConfig.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));

        let totalEnviados = 0;

        for (const diasRestantes of dias) {
            const valesProximosExpiracao = await allQuery(`
                SELECT v.*, c.nome, c.email, c.telefone
                FROM vales_gas v
                JOIN colaboradores c ON v.colaborador_id = c.id
                WHERE v.status = 'ativo'
                AND DATE(v.data_expiracao) = DATE('now', '+' || ? || ' days')
            `, [diasRestantes]);

            for (const vale of valesProximosExpiracao) {
                await notificarLembreteExpiracao(
                    { id: vale.colaborador_id, nome: vale.nome, email: vale.email, telefone: vale.telefone },
                    vale.codigo,
                    diasRestantes
                );
                totalEnviados++;
            }
        }

        logger.logInfo(`Lembretes de expiração enviados: ${totalEnviados}`);
    } catch (error) {
        logger.logError('Erro ao verificar expirações', error);
    }
});

// Expirar vales antigos - Executa todo dia à meia-noite
cron.schedule('0 0 * * *', async () => {
    logger.logInfo('Expirando vales antigos...');

    try {
        const result = await runQuery(`
            UPDATE vales_gas
            SET status = 'expirado'
            WHERE status = 'ativo' AND DATE(data_expiracao) < DATE('now')
        `);

        logger.logInfo(`Vales expirados: ${result.changes}`);

        // Limpar cache
        cache.delPattern('vales:');
        cache.delPattern('metrics:');
    } catch (error) {
        logger.logError('Erro ao expirar vales', error);
    }
});

// Limpar logs antigos - Executa uma vez por semana (domingo às 3h)
cron.schedule('0 3 * * 0', async () => {
    logger.logInfo('Limpando logs antigos...');

    try {
        // Remover logs de webhook com mais de 90 dias
        const webhooksRemovidos = await runQuery(`
            DELETE FROM logs_webhook
            WHERE datetime(criado_em) < datetime('now', '-90 days')
        `);

        // Remover logs de auditoria com mais de 180 dias
        const auditoriaRemovida = await runQuery(`
            DELETE FROM logs_auditoria
            WHERE datetime(criado_em) < datetime('now', '-180 days')
        `);

        logger.logInfo('Limpeza de logs concluída', {
            webhooks_removidos: webhooksRemovidos.changes,
            auditoria_removida: auditoriaRemovida.changes
        });
    } catch (error) {
        logger.logError('Erro ao limpar logs antigos', error);
    }
});

// ========================================
// ROTAS DE PÁGINAS (SPA)
// ========================================

// Redirecionar todas as rotas não-API para o index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// ========================================
// TRATAMENTO DE ERROS
// ========================================

// Rota não encontrada
app.use(notFoundHandler);

// Handler global de erros
app.use(errorHandler);

// ========================================
// INICIALIZAÇÃO
// ========================================

const startServer = async () => {
    try {
        // Criar diretórios necessários
        const fs = require('fs');

        // Railway usa /data, local usa ./data
        const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
        const baseDir = isRailway ? '/data' : path.join(__dirname, 'data');

        const dirs = [
            'logs',
            path.join(baseDir, 'backups')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Inicializar banco de dados
        console.log('⏳ Iniciando database.initDatabase()...');
        await initDatabase();

        console.log('✅ Database initialized, starting server...');
        logger.logInfo('Banco de dados inicializado com sucesso');

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log('');
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║                SISTEMA VALE-GÁS v2.0                       ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log(`║  🚀 Servidor rodando em: http://localhost:${PORT}            ║`);
            console.log('║                                                            ║');
            console.log('║  🔒 Segurança:                                             ║');
            console.log('║     ✅ Helmet (Headers)                                    ║');
            console.log('║     ✅ CORS Restritivo                                     ║');
            console.log('║     ✅ Rate Limiting                                       ║');
            console.log('║     ✅ Input Sanitization                                  ║');
            console.log('║                                                            ║');
            console.log('║  📊 Recursos:                                              ║');
            console.log('║     ✅ Cache Inteligente                                   ║');
            console.log('║     ✅ Logs Estruturados                                   ║');
            console.log('║     ✅ Health Check (/api/health)                          ║');
            console.log('║     ✅ Métricas (/api/metrics)                             ║');
            console.log('║     ✅ Backup Automático (2h diárias)                      ║');
            console.log('║                                                            ║');
            console.log('║  📋 Endpoints:                                             ║');
            console.log('║     - Admin:       /admin.html                             ║');
            console.log('║     - Colaborador: /colaborador.html                       ║');
            console.log('║     - Distribuidor:/distribuidor.html                      ║');
            console.log('║                                                            ║');
            console.log('║  🔑 Login Admin: Verifique o arquivo .env                  ║');
            console.log('║     (padrão: admin@consigaz.com.br / ConsigAz@2025)        ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
            console.log('');

            logger.logInfo('Servidor iniciado com sucesso', {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                node_version: process.version
            });
        });
    } catch (error) {
        logger.logError('Erro ao iniciar servidor', error);
        process.exit(1);
    }
};

// Tratamento de sinais de término
process.on('SIGTERM', () => {
    logger.logInfo('Sinal SIGTERM recebido. Encerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.logInfo('Sinal SIGINT recebido. Encerrando servidor...');
    process.exit(0);
});

startServer();

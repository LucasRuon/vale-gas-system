const winston = require('winston');
const path = require('path');

// Criar diretório de logs se não existir
const fs = require('fs');
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Formato customizado para logs
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Formato para console (mais legível)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Criar logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    defaultMeta: { service: 'vale-gas-system' },
    transports: [
        // Erros em arquivo separado
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),

        // Todos os logs combinados
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10
        }),

        // Console (desenvolvimento)
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
        })
    ],

    // Tratamento de exceções não capturadas
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log')
        })
    ],

    // Tratamento de rejeições de promises não capturadas
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log')
        })
    ]
});

// Helpers para diferentes níveis de log
logger.logInfo = (message, meta = {}) => {
    logger.info(message, meta);
};

logger.logError = (message, error = null, meta = {}) => {
    if (error) {
        logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else {
        logger.error(message, meta);
    }
};

logger.logWarning = (message, meta = {}) => {
    logger.warn(message, meta);
};

logger.logDebug = (message, meta = {}) => {
    logger.debug(message, meta);
};

// Log de auditoria (ações críticas)
logger.logAudit = (acao, usuario, detalhes = {}) => {
    logger.info('AUDITORIA', {
        acao,
        usuario_id: usuario?.id,
        usuario_nome: usuario?.nome,
        usuario_tipo: usuario?.tipo,
        ...detalhes,
        timestamp: new Date().toISOString()
    });
};

// Log de segurança (tentativas de acesso, falhas de autenticação)
logger.logSecurity = (evento, detalhes = {}) => {
    logger.warn('SEGURANÇA', {
        evento,
        ...detalhes,
        timestamp: new Date().toISOString()
    });
};

// Log de performance (queries lentas, etc)
logger.logPerformance = (operacao, duracao, detalhes = {}) => {
    const nivel = duracao > 1000 ? 'warn' : 'info';
    logger[nivel]('PERFORMANCE', {
        operacao,
        duracao_ms: duracao,
        ...detalhes
    });
};

module.exports = logger;

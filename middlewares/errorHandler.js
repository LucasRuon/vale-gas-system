const logger = require('../config/logger');

/**
 * Wrapper para funções async/await
 * Captura erros automaticamente sem precisar de try/catch
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Middleware de tratamento de erros global
 */
const errorHandler = (err, req, res, next) => {
    // Log do erro
    logger.logError('Erro não tratado', err, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        usuario: req.usuario?.id,
        body: req.body
    });

    // Determinar status code
    let statusCode = err.statusCode || 500;

    // Erros conhecidos do SQLite
    if (err.code) {
        switch (err.code) {
            case 'SQLITE_CONSTRAINT':
                statusCode = 400;
                break;
            case 'SQLITE_BUSY':
                statusCode = 503;
                break;
            case 'SQLITE_NOTFOUND':
                statusCode = 404;
                break;
        }
    }

    // Erros de validação do JWT
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
    }

    // Erros de validação
    if (err.name === 'ValidationError') {
        statusCode = 400;
    }

    // Preparar resposta
    const response = {
        erro: err.message || 'Erro interno do servidor',
        timestamp: new Date().toISOString()
    };

    // Em desenvolvimento, enviar stack trace
    if (process.env.NODE_ENV !== 'production') {
        response.stack = err.stack;
        response.detalhes = err;
    }

    // Enviar resposta
    res.status(statusCode).json(response);
};

/**
 * Middleware para rotas não encontradas (404)
 */
const notFoundHandler = (req, res, next) => {
    logger.logWarning('Rota não encontrada', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
    });

    res.status(404).json({
        erro: 'Rota não encontrada',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
};

/**
 * Middleware para validar body de requisição
 */
const validateBody = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = [];

        for (const field of requiredFields) {
            if (!req.body[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            return res.status(400).json({
                erro: 'Campos obrigatórios ausentes',
                campos: missingFields
            });
        }

        next();
    };
};

module.exports = {
    asyncHandler,
    errorHandler,
    notFoundHandler,
    validateBody
};

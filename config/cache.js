const NodeCache = require('node-cache');
const logger = require('./logger');

// Configurações do cache
const cache = new NodeCache({
    stdTTL: 600, // 10 minutos padrão
    checkperiod: 120, // Verificar itens expirados a cada 2 minutos
    useClones: false, // Melhor performance (cuidado com mutações)
    deleteOnExpire: true
});

// Eventos de cache (para debugging)
cache.on('set', (key, value) => {
    logger.logDebug('Cache SET', { key, size: JSON.stringify(value).length });
});

cache.on('expired', (key, value) => {
    logger.logDebug('Cache EXPIRED', { key });
});

cache.on('flush', () => {
    logger.logInfo('Cache FLUSH - todos os dados removidos');
});

// Wrapper para facilitar uso
const cacheManager = {
    /**
     * Obter valor do cache
     */
    get: (key) => {
        const value = cache.get(key);
        if (value !== undefined) {
            logger.logDebug('Cache HIT', { key });
            return value;
        }
        logger.logDebug('Cache MISS', { key });
        return null;
    },

    /**
     * Definir valor no cache
     */
    set: (key, value, ttl = null) => {
        if (ttl) {
            return cache.set(key, value, ttl);
        }
        return cache.set(key, value);
    },

    /**
     * Deletar chave específica
     */
    del: (key) => {
        cache.del(key);
        logger.logDebug('Cache DELETE', { key });
    },

    /**
     * Deletar múltiplas chaves
     */
    delMultiple: (keys) => {
        cache.del(keys);
        logger.logDebug('Cache DELETE múltiplo', { keys });
    },

    /**
     * Deletar por padrão (ex: 'colaboradores:*')
     */
    delPattern: (pattern) => {
        const keys = cache.keys().filter(key => key.startsWith(pattern));
        if (keys.length > 0) {
            cache.del(keys);
            logger.logDebug('Cache DELETE por padrão', { pattern, count: keys.length });
        }
    },

    /**
     * Limpar todo o cache
     */
    flush: () => {
        cache.flushAll();
    },

    /**
     * Obter estatísticas do cache
     */
    getStats: () => {
        return cache.getStats();
    },

    /**
     * Middleware para cachear respostas de API
     * Uso: router.get('/endpoint', cacheManager.middleware(300), handler)
     */
    middleware: (ttl = 600) => {
        return (req, res, next) => {
            // Só cachear GET requests
            if (req.method !== 'GET') {
                return next();
            }

            const key = `api:${req.originalUrl}`;
            const cachedResponse = cacheManager.get(key);

            if (cachedResponse) {
                return res.json(cachedResponse);
            }

            // Interceptar res.json para cachear a resposta
            const originalJson = res.json.bind(res);
            res.json = (data) => {
                cacheManager.set(key, data, ttl);
                return originalJson(data);
            };

            next();
        };
    },

    /**
     * Helper para cachear resultado de função
     */
    wrap: async (key, ttl, fn) => {
        const cached = cacheManager.get(key);
        if (cached !== null) {
            return cached;
        }

        const result = await fn();
        cacheManager.set(key, result, ttl);
        return result;
    }
};

// Chaves de cache pré-definidas (para manter consistência)
cacheManager.KEYS = {
    DISTRIBUIDORES_ATIVOS: 'distribuidores:ativos',
    CONFIGURACOES: 'configuracoes',
    STATS_DASHBOARD: 'stats:dashboard',
    CEP: (cep) => `cep:${cep}`,
    COLABORADOR: (id) => `colaborador:${id}`,
    DISTRIBUIDOR: (id) => `distribuidor:${id}`,
};

module.exports = cacheManager;

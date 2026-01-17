const validator = require('validator');
const xss = require('xss');
const logger = require('../config/logger');

/**
 * Configuração do XSS
 */
const xssOptions = {
    whiteList: {}, // Não permite nenhuma tag HTML
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
};

/**
 * Sanitizar string individual
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;

    // Remover tags HTML e scripts
    let clean = xss(str, xssOptions);

    // Escapar caracteres especiais HTML
    clean = validator.escape(clean);

    // Normalizar espaços
    clean = clean.trim();

    return clean;
};

/**
 * Sanitizar objeto recursivamente
 */
const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }

    return obj;
};

/**
 * Middleware para sanitizar body da requisição
 */
const sanitizeBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        // Log se detectar algo suspeito
        const original = JSON.stringify(req.body);
        req.body = sanitizeObject(req.body);
        const sanitized = JSON.stringify(req.body);

        if (original !== sanitized) {
            logger.logSecurity('Input sanitizado detectado', {
                usuario: req.usuario?.id,
                url: req.originalUrl,
                ip: req.ip,
                diferenca: original.length - sanitized.length
            });
        }
    }
    next();
};

/**
 * Validadores específicos
 */
const validators = {
    /**
     * Validar email
     */
    isEmail: (email) => {
        return validator.isEmail(email);
    },

    /**
     * Validar URL
     */
    isURL: (url) => {
        return validator.isURL(url, {
            protocols: ['http', 'https'],
            require_protocol: true
        });
    },

    /**
     * Validar telefone brasileiro
     */
    isPhoneBR: (phone) => {
        // Remove formatação
        const clean = phone.replace(/\D/g, '');

        // Valida formato brasileiro (10 ou 11 dígitos)
        return /^[1-9]{2}9?[0-9]{8}$/.test(clean);
    },

    /**
     * Validar CEP
     */
    isCEP: (cep) => {
        const clean = cep.replace(/\D/g, '');
        return /^[0-9]{8}$/.test(clean);
    },

    /**
     * Validar se é numérico
     */
    isNumeric: (value) => {
        return validator.isNumeric(String(value));
    },

    /**
     * Validar data
     */
    isDate: (date) => {
        return validator.isDate(date, { format: 'YYYY-MM-DD' });
    },

    /**
     * Validar senha forte
     */
    isStrongPassword: (password) => {
        return validator.isStrongPassword(password, {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 0
        });
    },

    /**
     * Validar CNPJ (formato e dígitos verificadores)
     */
    isCNPJ: (cnpj) => {
        const clean = cnpj.replace(/\D/g, '');

        if (clean.length !== 14) return false;

        // Rejeitar CNPJs com todos os dígitos iguais
        if (/^(\d)\1+$/.test(clean)) return false;

        // Validar dígitos verificadores
        let tamanho = clean.length - 2;
        let numeros = clean.substring(0, tamanho);
        const digitos = clean.substring(tamanho);
        let soma = 0;
        let pos = tamanho - 7;

        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }

        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado !== parseInt(digitos.charAt(0))) return false;

        tamanho = tamanho + 1;
        numeros = clean.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;

        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }

        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado !== parseInt(digitos.charAt(1))) return false;

        return true;
    },

    /**
     * Validar CPF (formato e dígitos verificadores)
     */
    isCPF: (cpf) => {
        const clean = cpf.replace(/\D/g, '');

        if (clean.length !== 11) return false;

        // Rejeitar CPFs com todos os dígitos iguais (ex: 111.111.111-11)
        if (/^(\d)\1+$/.test(clean)) return false;

        // Validar primeiro dígito verificador
        let soma = 0;
        for (let i = 0; i < 9; i++) {
            soma += parseInt(clean.charAt(i)) * (10 - i);
        }
        let resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(clean.charAt(9))) return false;

        // Validar segundo dígito verificador
        soma = 0;
        for (let i = 0; i < 10; i++) {
            soma += parseInt(clean.charAt(i)) * (11 - i);
        }
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(clean.charAt(10))) return false;

        return true;
    },

    /**
     * Validar CNPJ (apenas formato - mantido para compatibilidade)
     */
    isCNPJFormat: (cnpj) => {
        const clean = cnpj.replace(/\D/g, '');
        return clean.length === 14;
    },

    /**
     * Validar CPF (apenas formato - mantido para compatibilidade)
     */
    isCPFFormat: (cpf) => {
        const clean = cpf.replace(/\D/g, '');
        return clean.length === 11;
    }
};

/**
 * Middleware de validação de campos
 */
const validate = (schema) => {
    return (req, res, next) => {
        const errors = [];

        for (const field in schema) {
            const rules = schema[field];
            const value = req.body[field];

            // Verificar se campo é obrigatório
            if (rules.required && (!value || value === '')) {
                errors.push({
                    campo: field,
                    erro: 'Campo obrigatório'
                });
                continue;
            }

            // Se campo não é obrigatório e está vazio, pular validações
            if (!value) continue;

            // Validar tipo
            if (rules.type) {
                const type = typeof value;
                if (type !== rules.type) {
                    errors.push({
                        campo: field,
                        erro: `Deve ser do tipo ${rules.type}`
                    });
                    continue;
                }
            }

            // Validar email
            if (rules.email && !validators.isEmail(value)) {
                errors.push({
                    campo: field,
                    erro: 'Email inválido'
                });
            }

            // Validar tamanho mínimo
            if (rules.minLength && value.length < rules.minLength) {
                errors.push({
                    campo: field,
                    erro: `Deve ter no mínimo ${rules.minLength} caracteres`
                });
            }

            // Validar tamanho máximo
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push({
                    campo: field,
                    erro: `Deve ter no máximo ${rules.maxLength} caracteres`
                });
            }

            // Validação customizada
            if (rules.custom && !rules.custom(value)) {
                errors.push({
                    campo: field,
                    erro: rules.customMessage || 'Valor inválido'
                });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                erro: 'Validação falhou',
                detalhes: errors
            });
        }

        next();
    };
};

module.exports = {
    sanitizeString,
    sanitizeObject,
    sanitizeBody,
    validators,
    validate
};

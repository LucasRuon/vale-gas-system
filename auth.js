const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getQuery } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao';
const JWT_EXPIRATION = '24h';

// Gerar token JWT
const gerarToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

// Verificar token JWT
const verificarToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Middleware de autenticação geral
const autenticar = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }
    
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2) {
        return res.status(401).json({ erro: 'Formato de token inválido' });
    }
    
    const [scheme, token] = parts;
    
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ erro: 'Token mal formatado' });
    }
    
    const decoded = verificarToken(token);
    
    if (!decoded) {
        return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
    
    req.usuario = decoded;
    next();
};

// Middleware para verificar se é admin
const autenticarAdmin = async (req, res, next) => {
    autenticar(req, res, async () => {
        if (req.usuario.tipo !== 'admin') {
            return res.status(403).json({ erro: 'Acesso negado. Apenas administradores.' });
        }
        
        // Verificar se o admin ainda existe e está ativo
        const admin = await getQuery(
            'SELECT id, ativo FROM usuarios_admin WHERE id = ?',
            [req.usuario.id]
        );
        
        if (!admin || !admin.ativo) {
            return res.status(403).json({ erro: 'Usuário inativo ou não encontrado' });
        }
        
        next();
    });
};

// Middleware para verificar se é colaborador
const autenticarColaborador = async (req, res, next) => {
    autenticar(req, res, async () => {
        if (req.usuario.tipo !== 'colaborador') {
            return res.status(403).json({ erro: 'Acesso negado. Apenas colaboradores.' });
        }
        
        // Verificar se o colaborador ainda existe e está ativo
        const colaborador = await getQuery(
            'SELECT id, ativo FROM colaboradores WHERE id = ?',
            [req.usuario.id]
        );
        
        if (!colaborador || !colaborador.ativo) {
            return res.status(403).json({ erro: 'Colaborador inativo ou não encontrado' });
        }
        
        next();
    });
};

// Middleware para verificar se é distribuidor
const autenticarDistribuidor = async (req, res, next) => {
    autenticar(req, res, async () => {
        if (req.usuario.tipo !== 'distribuidor') {
            return res.status(403).json({ erro: 'Acesso negado. Apenas distribuidores.' });
        }
        
        // Verificar se o distribuidor ainda existe e está ativo
        const distribuidor = await getQuery(
            'SELECT id, ativo FROM distribuidores WHERE id = ?',
            [req.usuario.id]
        );
        
        if (!distribuidor || !distribuidor.ativo) {
            return res.status(403).json({ erro: 'Distribuidor inativo ou não encontrado' });
        }
        
        next();
    });
};

// Middleware para verificar nível de admin
const verificarNivel = (...niveisPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario || req.usuario.tipo !== 'admin') {
            return res.status(403).json({ erro: 'Acesso negado' });
        }
        
        if (!niveisPermitidos.includes(req.usuario.nivel)) {
            return res.status(403).json({ 
                erro: `Acesso negado. Níveis permitidos: ${niveisPermitidos.join(', ')}` 
            });
        }
        
        next();
    };
};

// Hash de senha
const hashSenha = async (senha) => {
    return await bcrypt.hash(senha, 10);
};

// Comparar senha
const compararSenha = async (senha, hash) => {
    return await bcrypt.compare(senha, hash);
};

module.exports = {
    gerarToken,
    verificarToken,
    autenticar,
    autenticarAdmin,
    autenticarColaborador,
    autenticarDistribuidor,
    verificarNivel,
    hashSenha,
    compararSenha
};

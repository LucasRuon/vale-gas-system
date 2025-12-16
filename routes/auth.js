const express = require('express');
const router = express.Router();
const { getQuery, runQuery } = require('../database');
const { gerarToken, hashSenha, compararSenha } = require('../auth');
const { gerarTokenRecuperacao, limparDocumento } = require('../utils');
const { notificarRecuperacaoSenha } = require('../webhooks');
const { ACOES, registrarAuditoria, getClientIP } = require('../auditoria');

// ========================================
// LOGIN COLABORADOR
// ========================================
router.post('/login/colaborador', async (req, res) => {
    try {
        const { login, senha } = req.body;

        if (!login || !senha) {
            return res.status(400).json({ erro: 'Login e senha são obrigatórios' });
        }

        // Limpar CPF se for o caso
        const loginLimpo = login.includes('@') ? login : limparDocumento(login);
        
        // Buscar por CPF ou email
        const colaborador = await getQuery(
            `SELECT * FROM colaboradores WHERE (cpf = ? OR email = ?) AND ativo = 1`,
            [loginLimpo, login]
        );

        if (!colaborador) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const senhaValida = await compararSenha(senha, colaborador.senha);
        
        if (!senhaValida) {
            // Registrar tentativa de login falha
            await registrarAuditoria({
                tipo_usuario: 'colaborador',
                usuario_id: colaborador.id,
                usuario_nome: colaborador.nome,
                acao: ACOES.LOGIN_FALHA,
                detalhes: { motivo: 'Senha incorreta' },
                ip: getClientIP(req)
            });
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        // Registrar login bem-sucedido
        await registrarAuditoria({
            tipo_usuario: 'colaborador',
            usuario_id: colaborador.id,
            usuario_nome: colaborador.nome,
            acao: ACOES.LOGIN,
            ip: getClientIP(req)
        });

        const token = gerarToken({
            id: colaborador.id,
            nome: colaborador.nome,
            email: colaborador.email,
            tipo: 'colaborador'
        });

        res.json({
            sucesso: true,
            token,
            usuario: {
                id: colaborador.id,
                nome: colaborador.nome,
                email: colaborador.email,
                tipo: 'colaborador'
            }
        });

    } catch (error) {
        console.error('Erro no login colaborador:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// LOGIN ADMIN (RH)
// ========================================
router.post('/login/admin', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        }

        const admin = await getQuery(
            `SELECT * FROM usuarios_admin WHERE email = ? AND ativo = 1`,
            [email]
        );

        if (!admin) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const senhaValida = await compararSenha(senha, admin.senha);
        
        if (!senhaValida) {
            // Registrar tentativa de login falha
            await registrarAuditoria({
                tipo_usuario: 'admin',
                usuario_id: admin.id,
                usuario_nome: admin.nome,
                acao: ACOES.LOGIN_FALHA,
                detalhes: { motivo: 'Senha incorreta' },
                ip: getClientIP(req)
            });
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        // Registrar login bem-sucedido
        await registrarAuditoria({
            tipo_usuario: 'admin',
            usuario_id: admin.id,
            usuario_nome: admin.nome,
            acao: ACOES.LOGIN,
            ip: getClientIP(req)
        });

        const token = gerarToken({
            id: admin.id,
            nome: admin.nome,
            email: admin.email,
            nivel: admin.nivel,
            tipo: 'admin'
        });

        res.json({
            sucesso: true,
            token,
            usuario: {
                id: admin.id,
                nome: admin.nome,
                email: admin.email,
                nivel: admin.nivel,
                tipo: 'admin'
            }
        });

    } catch (error) {
        console.error('Erro no login admin:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// LOGIN DISTRIBUIDOR
// ========================================
router.post('/login/distribuidor', async (req, res) => {
    try {
        const { login, senha } = req.body;

        if (!login || !senha) {
            return res.status(400).json({ erro: 'Login e senha são obrigatórios' });
        }

        // Limpar CNPJ se for o caso
        const loginLimpo = login.includes('@') ? login : limparDocumento(login);
        
        const distribuidor = await getQuery(
            `SELECT * FROM distribuidores WHERE (cnpj = ? OR email = ?) AND ativo = 1`,
            [loginLimpo, login]
        );

        if (!distribuidor) {
            // Registrar tentativa de login com credenciais inválidas
            await registrarAuditoria({
                tipo_usuario: 'distribuidor',
                usuario_id: 0,
                usuario_nome: login,
                acao: ACOES.LOGIN_FALHA,
                detalhes: JSON.stringify({ motivo: 'Distribuidor não encontrado', login }),
                ip: getClientIP(req)
            });
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const senhaValida = await compararSenha(senha, distribuidor.senha);

        if (!senhaValida) {
            // Registrar tentativa de login com senha incorreta
            await registrarAuditoria({
                tipo_usuario: 'distribuidor',
                usuario_id: distribuidor.id,
                usuario_nome: distribuidor.nome,
                acao: ACOES.LOGIN_FALHA,
                detalhes: JSON.stringify({ motivo: 'Senha incorreta' }),
                ip: getClientIP(req)
            });
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }

        const token = gerarToken({
            id: distribuidor.id,
            nome: distribuidor.nome,
            email: distribuidor.email,
            tipo: 'distribuidor'
        });

        // Registrar login bem-sucedido
        await registrarAuditoria({
            tipo_usuario: 'distribuidor',
            usuario_id: distribuidor.id,
            usuario_nome: distribuidor.nome,
            acao: ACOES.LOGIN,
            detalhes: JSON.stringify({ email: distribuidor.email }),
            ip: getClientIP(req)
        });

        res.json({
            sucesso: true,
            token,
            usuario: {
                id: distribuidor.id,
                nome: distribuidor.nome,
                email: distribuidor.email,
                tipo: 'distribuidor'
            }
        });

    } catch (error) {
        console.error('Erro no login distribuidor:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// SOLICITAR RECUPERAÇÃO DE SENHA
// ========================================
router.post('/recuperar-senha/solicitar', async (req, res) => {
    try {
        const { tipo, login } = req.body;

        if (!tipo || !login) {
            return res.status(400).json({ erro: 'Tipo e login são obrigatórios' });
        }

        let usuario = null;
        let tabela = '';

        // Buscar usuário baseado no tipo
        if (tipo === 'colaborador') {
            const loginLimpo = login.includes('@') ? login : limparDocumento(login);
            usuario = await getQuery(
                `SELECT id, nome, email, telefone FROM colaboradores WHERE (cpf = ? OR email = ?) AND ativo = 1`,
                [loginLimpo, login]
            );
            tabela = 'colaboradores';
        } else if (tipo === 'admin') {
            usuario = await getQuery(
                `SELECT id, nome, email, '' as telefone FROM usuarios_admin WHERE email = ? AND ativo = 1`,
                [login]
            );
            tabela = 'usuarios_admin';
        } else if (tipo === 'distribuidor') {
            const loginLimpo = login.includes('@') ? login : limparDocumento(login);
            usuario = await getQuery(
                `SELECT id, nome, email, telefone FROM distribuidores WHERE (cnpj = ? OR email = ?) AND ativo = 1`,
                [loginLimpo, login]
            );
            tabela = 'distribuidores';
        } else {
            return res.status(400).json({ erro: 'Tipo de usuário inválido' });
        }

        // Sempre retornar sucesso (por segurança, não informar se o usuário existe ou não)
        if (!usuario) {
            return res.json({ 
                sucesso: true, 
                mensagem: 'Se o usuário existir, você receberá instruções por email/WhatsApp' 
            });
        }

        // Gerar token de recuperação
        const token = gerarTokenRecuperacao();
        const expiraEm = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        // Salvar token
        await runQuery(
            `INSERT INTO tokens_recuperacao (tipo_usuario, usuario_id, token, expira_em) VALUES (?, ?, ?, ?)`,
            [tipo, usuario.id, token, expiraEm.toISOString()]
        );

        // Enviar webhook para N8N
        await notificarRecuperacaoSenha(tipo, usuario, token);

        res.json({ 
            sucesso: true, 
            mensagem: 'Se o usuário existir, você receberá instruções por email/WhatsApp' 
        });

    } catch (error) {
        console.error('Erro na recuperação de senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// CONFIRMAR RECUPERAÇÃO DE SENHA
// ========================================
router.post('/recuperar-senha/confirmar', async (req, res) => {
    try {
        const { token, novaSenha } = req.body;

        if (!token || !novaSenha) {
            return res.status(400).json({ erro: 'Token e nova senha são obrigatórios' });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
        }

        // Buscar token válido
        const tokenData = await getQuery(
            `SELECT * FROM tokens_recuperacao WHERE token = ? AND usado = 0 AND expira_em > datetime('now')`,
            [token]
        );

        if (!tokenData) {
            return res.status(400).json({ erro: 'Token inválido ou expirado' });
        }

        // Determinar tabela
        let tabela = '';
        if (tokenData.tipo_usuario === 'colaborador') {
            tabela = 'colaboradores';
        } else if (tokenData.tipo_usuario === 'admin') {
            tabela = 'usuarios_admin';
        } else if (tokenData.tipo_usuario === 'distribuidor') {
            tabela = 'distribuidores';
        }

        // Atualizar senha
        const senhaHash = await hashSenha(novaSenha);
        await runQuery(
            `UPDATE ${tabela} SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
            [senhaHash, tokenData.usuario_id]
        );

        // Marcar token como usado
        await runQuery(
            `UPDATE tokens_recuperacao SET usado = 1 WHERE id = ?`,
            [tokenData.id]
        );

        res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });

    } catch (error) {
        console.error('Erro ao confirmar recuperação de senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// ========================================
// VERIFICAR TOKEN (para manter sessão)
// ========================================
router.get('/verificar-token', require('../auth').autenticar, (req, res) => {
    res.json({ 
        sucesso: true, 
        usuario: req.usuario 
    });
});

module.exports = router;

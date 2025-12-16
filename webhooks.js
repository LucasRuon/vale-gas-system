/**
 * Sistema de Webhooks e Notificações - Vale-Gás
 * Envia notificações via webhooks para integração com N8N, Zapier, etc.
 * O N8N pode então disparar emails, WhatsApp, SMS, etc.
 */

const { runQuery, allQuery, getQuery } = require('./database');

// URLs dos webhooks (configuradas no .env)
const WEBHOOKS = {
    CODIGO_GERADO: process.env.WEBHOOK_CODIGO_GERADO,
    LEMBRETE_EXPIRACAO: process.env.WEBHOOK_LEMBRETE_EXPIRACAO,
    VALE_RETIRADO: process.env.WEBHOOK_VALE_RETIRADO,
    SENHA_GERADA: process.env.WEBHOOK_SENHA_GERADA || process.env.WEBHOOK_CODIGO_GERADO,
    RECUPERACAO_SENHA: process.env.WEBHOOK_RECUPERACAO_SENHA || process.env.WEBHOOK_CODIGO_GERADO
};

// Tipos de notificação
const TIPOS_NOTIFICACAO = {
    CODIGO_GERADO: 'codigo_gerado',
    LEMBRETE_EXPIRACAO: 'lembrete_expiracao',
    VALE_RETIRADO: 'vale_retirado',
    SENHA_GERADA: 'senha_gerada',
    SENHA_RESETADA: 'senha_resetada',
    RECUPERACAO_SENHA: 'recuperacao_senha',
    VALE_PROXIMO_EXPIRAR: 'vale_proximo_expirar',
    BEM_VINDO: 'bem_vindo'
};

// Templates de mensagem (para referência do N8N)
const TEMPLATES = {
    codigo_gerado: {
        assunto: 'Seu Vale-Gás de {mes} está disponível!',
        mensagem: `Olá {nome}!

Seu vale-gás do mês de {mes} foi gerado com sucesso.

📋 Código: {codigo}
📅 Válido até: {data_expiracao}

Apresente este código em um dos distribuidores autorizados para retirar seu botijão de gás.

Consigaz - Sistema Vale-Gás`
    },
    lembrete_expiracao: {
        assunto: '⚠️ Seu Vale-Gás expira em {dias} dias!',
        mensagem: `Olá {nome}!

Seu vale-gás está próximo de expirar!

📋 Código: {codigo}
⏰ Expira em: {dias} dias

Não perca! Retire seu botijão de gás em um dos distribuidores autorizados.

Consigaz - Sistema Vale-Gás`
    },
    vale_retirado: {
        assunto: '✅ Vale-Gás retirado com sucesso!',
        mensagem: `Olá {nome}!

Sua retirada de vale-gás foi confirmada.

📋 Código: {codigo}
🏪 Distribuidor: {distribuidor}
📅 Data: {data}

Obrigado por usar o Sistema Vale-Gás!

Consigaz`
    },
    senha_gerada: {
        assunto: 'Bem-vindo ao Sistema Vale-Gás!',
        mensagem: `Olá {nome}!

Sua conta no Sistema Vale-Gás foi criada.

🔐 Sua senha temporária: {senha}

Acesse o sistema e altere sua senha no primeiro login.

Consigaz - Sistema Vale-Gás`
    },
    senha_resetada: {
        assunto: 'Sua senha foi resetada',
        mensagem: `Olá {nome}!

Sua senha do Sistema Vale-Gás foi resetada.

🔐 Nova senha: {senha}

Recomendamos que altere sua senha após o login.

Consigaz - Sistema Vale-Gás`
    }
};

// Registrar log do webhook
const registrarLog = async (tipo, payload, resposta, statusCode, sucesso) => {
    try {
        await runQuery(
            `INSERT INTO logs_webhook (tipo, payload, resposta, status_code, sucesso) VALUES (?, ?, ?, ?, ?)`,
            [tipo, JSON.stringify(payload), JSON.stringify(resposta), statusCode, sucesso ? 1 : 0]
        );
    } catch (error) {
        console.error('Erro ao registrar log de webhook:', error);
    }
};

// Enviar webhook genérico
const enviarWebhook = async (url, tipo, payload) => {
    if (!url) {
        console.log(`⚠️ URL do webhook ${tipo} não configurada`);
        return { sucesso: false, erro: 'URL não configurada' };
    }

    try {
        console.log(`📤 Enviando webhook ${tipo}...`);
        
        // Usar fetch nativo do Node.js 18+
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeout);

        const data = await response.text();
        let jsonData;
        try {
            jsonData = JSON.parse(data);
        } catch {
            jsonData = data;
        }

        await registrarLog(tipo, payload, jsonData, response.status, response.ok);
        
        if (response.ok) {
            console.log(`✅ Webhook ${tipo} enviado com sucesso`);
            return { sucesso: true, data: jsonData };
        } else {
            console.error(`❌ Webhook ${tipo} retornou erro: ${response.status}`);
            return { sucesso: false, erro: `HTTP ${response.status}` };
        }
    } catch (error) {
        await registrarLog(tipo, payload, error.message, 0, false);
        console.error(`❌ Erro ao enviar webhook ${tipo}:`, error.message);
        return { sucesso: false, erro: error.message };
    }
};

// ==================== FUNÇÕES DE NOTIFICAÇÃO ====================

/**
 * Notifica quando um código de vale-gás é gerado
 */
const notificarCodigoGerado = async (colaborador, codigo, mesReferencia, dataExpiracao) => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const [ano, mes] = mesReferencia.split('-');
    const mesNome = meses[parseInt(mes) - 1];
    
    const payload = {
        evento: TIPOS_NOTIFICACAO.CODIGO_GERADO,
        timestamp: new Date().toISOString(),
        
        // Dados do destinatário
        destinatario: {
            id: colaborador.id,
            nome: colaborador.nome,
            email: colaborador.email,
            telefone: colaborador.telefone,
            tipo: 'colaborador'
        },
        
        // Dados do vale
        vale: {
            codigo: codigo,
            mes_referencia: mesReferencia,
            mes_nome: mesNome,
            ano: ano,
            data_expiracao: dataExpiracao
        },
        
        // Template sugerido
        template: {
            assunto: `Seu Vale-Gás de ${mesNome}/${ano} está disponível!`,
            mensagem: TEMPLATES.codigo_gerado.mensagem
                .replace('{nome}', colaborador.nome)
                .replace('{mes}', `${mesNome}/${ano}`)
                .replace('{codigo}', codigo)
                .replace('{data_expiracao}', new Date(dataExpiracao).toLocaleDateString('pt-BR'))
        },
        
        // Canais sugeridos
        canais: ['email', 'whatsapp']
    };

    return await enviarWebhook(WEBHOOKS.CODIGO_GERADO, TIPOS_NOTIFICACAO.CODIGO_GERADO, payload);
};

/**
 * Notifica lembrete de expiração
 */
const notificarLembreteExpiracao = async (colaborador, codigo, diasRestantes) => {
    const payload = {
        evento: TIPOS_NOTIFICACAO.LEMBRETE_EXPIRACAO,
        timestamp: new Date().toISOString(),
        
        destinatario: {
            id: colaborador.id,
            nome: colaborador.nome,
            email: colaborador.email,
            telefone: colaborador.telefone,
            tipo: 'colaborador'
        },
        
        vale: {
            codigo: codigo,
            dias_restantes: diasRestantes
        },
        
        template: {
            assunto: `⚠️ Seu Vale-Gás expira em ${diasRestantes} dias!`,
            mensagem: TEMPLATES.lembrete_expiracao.mensagem
                .replace('{nome}', colaborador.nome)
                .replace('{codigo}', codigo)
                .replace(/{dias}/g, diasRestantes)
        },
        
        canais: ['email', 'whatsapp'],
        prioridade: diasRestantes <= 3 ? 'alta' : 'normal'
    };

    return await enviarWebhook(WEBHOOKS.LEMBRETE_EXPIRACAO, TIPOS_NOTIFICACAO.LEMBRETE_EXPIRACAO, payload);
};

/**
 * Notifica quando vale é retirado
 */
const notificarValeRetirado = async (colaborador, distribuidor, codigo, mesReferencia) => {
    const payload = {
        evento: TIPOS_NOTIFICACAO.VALE_RETIRADO,
        timestamp: new Date().toISOString(),
        
        destinatario: {
            id: colaborador.id,
            nome: colaborador.nome,
            email: colaborador.email,
            telefone: colaborador.telefone,
            tipo: 'colaborador'
        },
        
        distribuidor: {
            id: distribuidor.id,
            nome: distribuidor.nome,
            cidade: distribuidor.cidade,
            telefone: distribuidor.telefone
        },
        
        vale: {
            codigo: codigo,
            mes_referencia: mesReferencia,
            data_retirada: new Date().toISOString()
        },
        
        template: {
            assunto: '✅ Vale-Gás retirado com sucesso!',
            mensagem: TEMPLATES.vale_retirado.mensagem
                .replace('{nome}', colaborador.nome)
                .replace('{codigo}', codigo)
                .replace('{distribuidor}', distribuidor.nome)
                .replace('{data}', new Date().toLocaleString('pt-BR'))
        },
        
        canais: ['email']
    };

    return await enviarWebhook(WEBHOOKS.VALE_RETIRADO, TIPOS_NOTIFICACAO.VALE_RETIRADO, payload);
};

/**
 * Notifica quando senha é gerada (novo usuário)
 */
const notificarSenhaGerada = async (tipo, usuario, senha) => {
    const payload = {
        evento: TIPOS_NOTIFICACAO.SENHA_GERADA,
        timestamp: new Date().toISOString(),
        
        destinatario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            telefone: usuario.telefone,
            tipo: tipo // 'colaborador', 'distribuidor'
        },
        
        credenciais: {
            senha_temporaria: senha,
            deve_alterar: true
        },
        
        template: {
            assunto: 'Bem-vindo ao Sistema Vale-Gás!',
            mensagem: TEMPLATES.senha_gerada.mensagem
                .replace('{nome}', usuario.nome)
                .replace('{senha}', senha)
        },
        
        canais: ['email', 'whatsapp']
    };

    return await enviarWebhook(WEBHOOKS.SENHA_GERADA, TIPOS_NOTIFICACAO.SENHA_GERADA, payload);
};

/**
 * Notifica quando senha é resetada
 */
const notificarSenhaResetada = async (tipo, usuario, novaSenha) => {
    const payload = {
        evento: TIPOS_NOTIFICACAO.SENHA_RESETADA,
        timestamp: new Date().toISOString(),
        
        destinatario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            telefone: usuario.telefone,
            tipo: tipo
        },
        
        credenciais: {
            nova_senha: novaSenha
        },
        
        template: {
            assunto: 'Sua senha foi resetada',
            mensagem: TEMPLATES.senha_resetada.mensagem
                .replace('{nome}', usuario.nome)
                .replace('{senha}', novaSenha)
        },
        
        canais: ['email', 'whatsapp']
    };

    return await enviarWebhook(WEBHOOKS.SENHA_GERADA, TIPOS_NOTIFICACAO.SENHA_RESETADA, payload);
};

/**
 * Notifica solicitação de recuperação de senha
 */
const notificarRecuperacaoSenha = async (tipo, usuario, token) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const linkRecuperacao = `${baseUrl}/recuperar-senha.html?token=${token}&tipo=${tipo}`;
    
    const payload = {
        evento: TIPOS_NOTIFICACAO.RECUPERACAO_SENHA,
        timestamp: new Date().toISOString(),
        
        destinatario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            telefone: usuario.telefone,
            tipo: tipo
        },
        
        recuperacao: {
            token: token,
            link: linkRecuperacao,
            expira_em: '1 hora'
        },
        
        template: {
            assunto: 'Recuperação de Senha - Vale-Gás',
            mensagem: `Olá ${usuario.nome}!

Recebemos uma solicitação de recuperação de senha para sua conta.

Clique no link abaixo para criar uma nova senha:
${linkRecuperacao}

Este link expira em 1 hora.

Se você não solicitou essa recuperação, ignore este email.

Consigaz - Sistema Vale-Gás`
        },
        
        canais: ['email']
    };

    return await enviarWebhook(WEBHOOKS.RECUPERACAO_SENHA, TIPOS_NOTIFICACAO.RECUPERACAO_SENHA, payload);
};

/**
 * Verifica vales próximos de expirar e envia lembretes
 * Deve ser chamado por um cron job diário
 */
const verificarValesProximosExpirar = async (diasAntecedencia = [7, 3, 1]) => {
    try {
        console.log('🔍 Verificando vales próximos de expirar...');
        let totalEnviados = 0;
        
        for (const dias of diasAntecedencia) {
            const vales = await allQuery(`
                SELECT v.*, c.nome, c.email, c.telefone
                FROM vales_gas v
                JOIN colaboradores c ON v.colaborador_id = c.id
                WHERE v.status = 'ativo'
                AND DATE(v.data_expiracao) = DATE('now', '+' || ? || ' days')
            `, [dias]);
            
            console.log(`📧 ${vales.length} vales expiram em ${dias} dias`);
            
            for (const vale of vales) {
                await notificarLembreteExpiracao(
                    { id: vale.colaborador_id, nome: vale.nome, email: vale.email, telefone: vale.telefone },
                    vale.codigo,
                    dias
                );
                totalEnviados++;
            }
        }
        
        return { sucesso: true, enviados: totalEnviados };
    } catch (error) {
        console.error('Erro ao verificar vales:', error);
        return { sucesso: false, erro: error.message };
    }
};

/**
 * Retorna estatísticas dos webhooks
 */
const getEstatisticasWebhooks = async (dias = 30) => {
    try {
        const stats = await allQuery(`
            SELECT 
                tipo,
                COUNT(*) as total,
                SUM(CASE WHEN sucesso = 1 THEN 1 ELSE 0 END) as sucessos,
                SUM(CASE WHEN sucesso = 0 THEN 1 ELSE 0 END) as falhas
            FROM logs_webhook
            WHERE criado_em >= datetime('now', '-' || ? || ' days')
            GROUP BY tipo
        `, [dias]);
        
        const ultimos = await allQuery(`
            SELECT * FROM logs_webhook
            ORDER BY criado_em DESC
            LIMIT 20
        `);
        
        return { stats, ultimos };
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return { stats: [], ultimos: [] };
    }
};

module.exports = {
    TIPOS_NOTIFICACAO,
    TEMPLATES,
    notificarCodigoGerado,
    notificarLembreteExpiracao,
    notificarValeRetirado,
    notificarSenhaGerada,
    notificarSenhaResetada,
    notificarRecuperacaoSenha,
    verificarValesProximosExpirar,
    getEstatisticasWebhooks
};

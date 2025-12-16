/**
 * Módulo de Auditoria - Sistema Vale-Gás
 * Registra todas as ações importantes do sistema
 */

const { runQuery, allQuery, getQuery } = require('./database');

// Tipos de ações para auditoria
const ACOES = {
    // Login
    LOGIN: 'login',
    LOGOUT: 'logout',
    LOGIN_FALHA: 'login_falha',
    
    // Colaboradores
    CRIAR_COLABORADOR: 'criar_colaborador',
    EDITAR_COLABORADOR: 'editar_colaborador',
    ATIVAR_COLABORADOR: 'ativar_colaborador',
    DESATIVAR_COLABORADOR: 'desativar_colaborador',
    RESETAR_SENHA_COLABORADOR: 'resetar_senha_colaborador',
    
    // Distribuidores
    CRIAR_DISTRIBUIDOR: 'criar_distribuidor',
    EDITAR_DISTRIBUIDOR: 'editar_distribuidor',
    ATIVAR_DISTRIBUIDOR: 'ativar_distribuidor',
    DESATIVAR_DISTRIBUIDOR: 'desativar_distribuidor',
    RESETAR_SENHA_DISTRIBUIDOR: 'resetar_senha_distribuidor',
    
    // Vales
    GERAR_VALE: 'gerar_vale',
    GERAR_VALES_MENSAL: 'gerar_vales_mensal',
    VALIDAR_VALE: 'validar_vale',
    CONFIRMAR_RETIRADA: 'confirmar_retirada',
    
    // Usuários RH
    CRIAR_USUARIO: 'criar_usuario',
    EDITAR_USUARIO: 'editar_usuario',
    ATIVAR_USUARIO: 'ativar_usuario',
    DESATIVAR_USUARIO: 'desativar_usuario',
    
    // Solicitações
    APROVAR_SOLICITACAO: 'aprovar_solicitacao',
    REJEITAR_SOLICITACAO: 'rejeitar_solicitacao',
    
    // Configurações
    ALTERAR_CONFIGURACAO: 'alterar_configuracao'
};

// Descrições amigáveis das ações
const DESCRICOES_ACOES = {
    login: 'Realizou login no sistema',
    logout: 'Saiu do sistema',
    login_falha: 'Tentativa de login falhou',
    criar_colaborador: 'Cadastrou novo colaborador',
    editar_colaborador: 'Editou dados do colaborador',
    ativar_colaborador: 'Ativou colaborador',
    desativar_colaborador: 'Desativou colaborador',
    resetar_senha_colaborador: 'Resetou senha do colaborador',
    criar_distribuidor: 'Cadastrou novo distribuidor',
    editar_distribuidor: 'Editou dados do distribuidor',
    ativar_distribuidor: 'Ativou distribuidor',
    desativar_distribuidor: 'Desativou distribuidor',
    resetar_senha_distribuidor: 'Resetou senha do distribuidor',
    gerar_vale: 'Gerou vale individual',
    gerar_vales_mensal: 'Gerou vales do mês',
    validar_vale: 'Consultou código de vale',
    confirmar_retirada: 'Confirmou retirada de vale',
    criar_usuario: 'Cadastrou novo usuário RH',
    editar_usuario: 'Editou usuário RH',
    ativar_usuario: 'Ativou usuário RH',
    desativar_usuario: 'Desativou usuário RH',
    aprovar_solicitacao: 'Aprovou solicitação',
    rejeitar_solicitacao: 'Rejeitou solicitação',
    alterar_configuracao: 'Alterou configuração do sistema'
};

/**
 * Registra uma ação no log de auditoria
 * @param {Object} dados - Dados da auditoria
 * @param {string} dados.tipo_usuario - 'admin', 'colaborador', 'distribuidor'
 * @param {number} dados.usuario_id - ID do usuário que realizou a ação
 * @param {string} dados.usuario_nome - Nome do usuário
 * @param {string} dados.acao - Tipo da ação (usar constantes ACOES)
 * @param {string} [dados.entidade] - Tipo da entidade afetada
 * @param {number} [dados.entidade_id] - ID da entidade afetada
 * @param {Object} [dados.detalhes] - Detalhes adicionais (será convertido para JSON)
 * @param {string} [dados.ip] - IP do usuário
 */
async function registrarAuditoria(dados) {
    try {
        const {
            tipo_usuario,
            usuario_id,
            usuario_nome,
            acao,
            entidade = null,
            entidade_id = null,
            detalhes = null,
            ip = null
        } = dados;

        await runQuery(
            `INSERT INTO logs_auditoria 
             (tipo_usuario, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes, ip) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tipo_usuario,
                usuario_id,
                usuario_nome,
                acao,
                entidade,
                entidade_id,
                detalhes ? JSON.stringify(detalhes) : null,
                ip
            ]
        );
    } catch (error) {
        console.error('Erro ao registrar auditoria:', error);
        // Não lançar erro para não interromper a operação principal
    }
}

/**
 * Busca logs de auditoria com filtros
 * @param {Object} filtros - Filtros de busca
 * @param {string} [filtros.tipo_usuario] - Filtrar por tipo de usuário
 * @param {string} [filtros.acao] - Filtrar por tipo de ação
 * @param {string} [filtros.entidade] - Filtrar por tipo de entidade
 * @param {string} [filtros.data_inicio] - Data inicial (YYYY-MM-DD)
 * @param {string} [filtros.data_fim] - Data final (YYYY-MM-DD)
 * @param {string} [filtros.busca] - Busca por nome de usuário
 * @param {number} [filtros.limite] - Limite de registros
 * @param {number} [filtros.pagina] - Página atual
 */
async function buscarLogs(filtros = {}) {
    try {
        const {
            tipo_usuario,
            acao,
            entidade,
            data_inicio,
            data_fim,
            busca,
            limite = 50,
            pagina = 1
        } = filtros;

        let sql = 'SELECT * FROM logs_auditoria WHERE 1=1';
        let sqlCount = 'SELECT COUNT(*) as total FROM logs_auditoria WHERE 1=1';
        const params = [];
        const paramsCount = [];

        if (tipo_usuario) {
            sql += ' AND tipo_usuario = ?';
            sqlCount += ' AND tipo_usuario = ?';
            params.push(tipo_usuario);
            paramsCount.push(tipo_usuario);
        }

        if (acao) {
            sql += ' AND acao = ?';
            sqlCount += ' AND acao = ?';
            params.push(acao);
            paramsCount.push(acao);
        }

        if (entidade) {
            sql += ' AND entidade = ?';
            sqlCount += ' AND entidade = ?';
            params.push(entidade);
            paramsCount.push(entidade);
        }

        if (data_inicio) {
            sql += ' AND DATE(criado_em) >= ?';
            sqlCount += ' AND DATE(criado_em) >= ?';
            params.push(data_inicio);
            paramsCount.push(data_inicio);
        }

        if (data_fim) {
            sql += ' AND DATE(criado_em) <= ?';
            sqlCount += ' AND DATE(criado_em) <= ?';
            params.push(data_fim);
            paramsCount.push(data_fim);
        }

        if (busca) {
            sql += ' AND usuario_nome LIKE ?';
            sqlCount += ' AND usuario_nome LIKE ?';
            params.push(`%${busca}%`);
            paramsCount.push(`%${busca}%`);
        }

        sql += ' ORDER BY criado_em DESC';
        
        const offset = (pagina - 1) * limite;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limite), offset);

        const [logs, countResult] = await Promise.all([
            allQuery(sql, params),
            getQuery(sqlCount, paramsCount)
        ]);

        // Adicionar descrição amigável
        const logsComDescricao = logs.map(log => ({
            ...log,
            acao_descricao: DESCRICOES_ACOES[log.acao] || log.acao,
            detalhes: log.detalhes ? JSON.parse(log.detalhes) : null
        }));

        return {
            dados: logsComDescricao,
            paginacao: {
                total: countResult.total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total_paginas: Math.ceil(countResult.total / limite)
            }
        };
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        throw error;
    }
}

/**
 * Middleware para extrair IP do request
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           'desconhecido';
}

module.exports = {
    ACOES,
    DESCRICOES_ACOES,
    registrarAuditoria,
    buscarLogs,
    getClientIP
};

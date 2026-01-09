const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, verifyAdmin } = require('../auth');
const { runQuery, getQuery, allQuery } = require('../database');
const logger = require('../config/logger');

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'reembolsos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `reembolso-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.xml'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Use: PDF, JPG, PNG ou XML'));
        }
    }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

// Registrar mudança no histórico
async function registrarHistorico(reembolsoId, adminId, adminNome, acao, statusAnterior, statusNovo, observacao, ip) {
    await runQuery(`
        INSERT INTO historico_reembolsos
        (reembolso_id, admin_id, admin_nome, status_anterior, status_novo, acao, observacao, ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [reembolsoId, adminId, adminNome, statusAnterior, statusNovo, acao, observacao, ip]);
}

// Formatar dados de reembolso com joins
function formatarReembolso(reembolso) {
    return {
        ...reembolso,
        valor: parseFloat(reembolso.valor),
        status_badge: {
            'a_validar': { texto: 'A Validar', cor: 'warning' },
            'aprovado': { texto: 'Aprovado', cor: 'info' },
            'pago': { texto: 'Pago', cor: 'success' },
            'rejeitado': { texto: 'Rejeitado', cor: 'danger' }
        }[reembolso.status]
    };
}

// ========================================
// ROTAS DE LISTAGEM E CONSULTA
// ========================================

// GET /api/admin/reembolsos - Listar todos os reembolsos com filtros
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const {
            status,
            distribuidor_id,
            mes_referencia,
            data_inicio,
            data_fim,
            page = 1,
            limit = 50
        } = req.query;

        let sql = `
            SELECT
                r.*,
                d.razao_social as distribuidor_nome,
                d.cnpj as distribuidor_cnpj,
                c.nome as colaborador_nome,
                c.cpf as colaborador_cpf,
                v.codigo_vale,
                aprovador.nome as aprovado_por_nome,
                pagador.nome as pago_por_nome
            FROM reembolsos r
            LEFT JOIN distribuidores d ON r.distribuidor_id = d.id
            LEFT JOIN colaboradores c ON r.colaborador_id = c.id
            LEFT JOIN vales v ON r.vale_id = v.id
            LEFT JOIN usuarios_admin aprovador ON r.aprovado_por = aprovador.id
            LEFT JOIN usuarios_admin pagador ON r.pago_por = pagador.id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            sql += ' AND r.status = ?';
            params.push(status);
        }

        if (distribuidor_id) {
            sql += ' AND r.distribuidor_id = ?';
            params.push(distribuidor_id);
        }

        if (mes_referencia) {
            sql += ' AND r.mes_referencia = ?';
            params.push(mes_referencia);
        }

        if (data_inicio) {
            sql += ' AND r.data_validacao >= ?';
            params.push(data_inicio);
        }

        if (data_fim) {
            sql += ' AND r.data_validacao <= ?';
            params.push(data_fim);
        }

        sql += ' ORDER BY r.criado_em DESC';

        // Paginação
        const offset = (page - 1) * limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const reembolsos = await allQuery(sql, params);

        // Contar total
        let countSql = `SELECT COUNT(*) as total FROM reembolsos r WHERE 1=1`;
        const countParams = [];
        let countIndex = 0;

        if (status) {
            countSql += ' AND r.status = ?';
            countParams.push(status);
        }
        if (distribuidor_id) {
            countSql += ' AND r.distribuidor_id = ?';
            countParams.push(distribuidor_id);
        }
        if (mes_referencia) {
            countSql += ' AND r.mes_referencia = ?';
            countParams.push(mes_referencia);
        }
        if (data_inicio) {
            countSql += ' AND r.data_validacao >= ?';
            countParams.push(data_inicio);
        }
        if (data_fim) {
            countSql += ' AND r.data_validacao <= ?';
            countParams.push(data_fim);
        }

        const { total } = await getQuery(countSql, countParams);

        // Estatísticas resumidas
        const stats = await getQuery(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'a_validar' THEN 1 ELSE 0 END) as a_validar,
                SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END) as aprovado,
                SUM(CASE WHEN status = 'pago' THEN 1 ELSE 0 END) as pago,
                SUM(CASE WHEN status = 'rejeitado' THEN 1 ELSE 0 END) as rejeitado,
                SUM(CASE WHEN status = 'a_validar' THEN valor ELSE 0 END) as valor_a_validar,
                SUM(CASE WHEN status = 'aprovado' THEN valor ELSE 0 END) as valor_aprovado,
                SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as valor_pago
            FROM reembolsos
        `);

        res.json({
            success: true,
            data: reembolsos.map(formatarReembolso),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            },
            stats
        });

    } catch (error) {
        logger.logError('Erro ao listar reembolsos', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/reembolsos/:id - Detalhes de um reembolso
router.get('/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const reembolso = await getQuery(`
            SELECT
                r.*,
                d.razao_social as distribuidor_nome,
                d.cnpj as distribuidor_cnpj,
                d.email as distribuidor_email,
                d.telefone as distribuidor_telefone,
                c.nome as colaborador_nome,
                c.cpf as colaborador_cpf,
                v.codigo_vale,
                v.mes_referencia as vale_mes,
                aprovador.nome as aprovado_por_nome,
                pagador.nome as pago_por_nome,
                rejeitador.nome as rejeitado_por_nome
            FROM reembolsos r
            LEFT JOIN distribuidores d ON r.distribuidor_id = d.id
            LEFT JOIN colaboradores c ON r.colaborador_id = c.id
            LEFT JOIN vales v ON r.vale_id = v.id
            LEFT JOIN usuarios_admin aprovador ON r.aprovado_por = aprovador.id
            LEFT JOIN usuarios_admin pagador ON r.pago_por = pagador.id
            LEFT JOIN usuarios_admin rejeitador ON r.rejeitado_por = rejeitador.id
            WHERE r.id = ?
        `, [id]);

        if (!reembolso) {
            return res.status(404).json({ success: false, error: 'Reembolso não encontrado' });
        }

        // Buscar histórico de alterações
        const historico = await allQuery(`
            SELECT * FROM historico_reembolsos
            WHERE reembolso_id = ?
            ORDER BY criado_em DESC
        `, [id]);

        res.json({
            success: true,
            data: formatarReembolso(reembolso),
            historico
        });

    } catch (error) {
        logger.logError('Erro ao buscar reembolso', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE CRIAÇÃO E EDIÇÃO
// ========================================

// POST /api/admin/reembolsos - Criar reembolso manualmente
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const {
            vale_id,
            distribuidor_id,
            colaborador_id,
            valor,
            mes_referencia,
            observacoes
        } = req.body;

        // Validações
        if (!vale_id || !distribuidor_id || !colaborador_id || !valor) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: vale_id, distribuidor_id, colaborador_id, valor'
            });
        }

        // Verificar se vale existe e foi validado
        const vale = await getQuery('SELECT * FROM vales WHERE id = ?', [vale_id]);
        if (!vale) {
            return res.status(404).json({ success: false, error: 'Vale não encontrado' });
        }

        if (vale.status !== 'utilizado') {
            return res.status(400).json({
                success: false,
                error: 'Vale não foi utilizado ainda. Apenas vales utilizados podem gerar reembolso.'
            });
        }

        // Verificar se já existe reembolso para este vale
        const reembolsoExistente = await getQuery('SELECT id FROM reembolsos WHERE vale_id = ?', [vale_id]);
        if (reembolsoExistente) {
            return res.status(400).json({
                success: false,
                error: 'Já existe um reembolso cadastrado para este vale'
            });
        }

        // Criar reembolso
        const result = await runQuery(`
            INSERT INTO reembolsos
            (vale_id, distribuidor_id, colaborador_id, valor, mes_referencia, observacoes, data_validacao, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'a_validar')
        `, [vale_id, distribuidor_id, colaborador_id, valor, mes_referencia || vale.mes_referencia, observacoes, vale.data_validacao || new Date().toISOString()]);

        // Registrar no histórico
        await registrarHistorico(
            result.lastID,
            req.user.userId,
            req.user.nome,
            'criado',
            null,
            'a_validar',
            'Reembolso criado manualmente pelo RH',
            req.ip
        );

        logger.logInfo('Reembolso criado manualmente', {
            reembolso_id: result.lastID,
            vale_id,
            admin: req.user.nome
        });

        res.json({
            success: true,
            message: 'Reembolso criado com sucesso',
            reembolso_id: result.lastID
        });

    } catch (error) {
        logger.logError('Erro ao criar reembolso', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/admin/reembolsos/:id - Editar reembolso
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { valor, observacoes, banco, agencia, conta, tipo_conta, pix } = req.body;

        const reembolso = await getQuery('SELECT * FROM reembolsos WHERE id = ?', [id]);
        if (!reembolso) {
            return res.status(404).json({ success: false, error: 'Reembolso não encontrado' });
        }

        // Não pode editar se já foi pago ou rejeitado
        if (reembolso.status === 'pago' || reembolso.status === 'rejeitado') {
            return res.status(400).json({
                success: false,
                error: `Não é possível editar reembolso com status '${reembolso.status}'`
            });
        }

        await runQuery(`
            UPDATE reembolsos
            SET valor = ?, observacoes = ?, banco = ?, agencia = ?, conta = ?, tipo_conta = ?, pix = ?, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [valor || reembolso.valor, observacoes, banco, agencia, conta, tipo_conta, pix, id]);

        // Registrar no histórico
        await registrarHistorico(
            id,
            req.user.userId,
            req.user.nome,
            'editado',
            reembolso.status,
            reembolso.status,
            'Reembolso editado',
            req.ip
        );

        res.json({ success: true, message: 'Reembolso atualizado com sucesso' });

    } catch (error) {
        logger.logError('Erro ao editar reembolso', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE MUDANÇA DE STATUS
// ========================================

// POST /api/admin/reembolsos/:id/aprovar - Aprovar reembolso
router.post('/:id/aprovar', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { observacoes } = req.body;

        const reembolso = await getQuery('SELECT * FROM reembolsos WHERE id = ?', [id]);
        if (!reembolso) {
            return res.status(404).json({ success: false, error: 'Reembolso não encontrado' });
        }

        if (reembolso.status !== 'a_validar') {
            return res.status(400).json({
                success: false,
                error: 'Apenas reembolsos "A Validar" podem ser aprovados'
            });
        }

        await runQuery(`
            UPDATE reembolsos
            SET status = 'aprovado',
                data_aprovacao = CURRENT_TIMESTAMP,
                aprovado_por = ?,
                observacoes = ?,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [req.user.userId, observacoes || reembolso.observacoes, id]);

        await registrarHistorico(
            id,
            req.user.userId,
            req.user.nome,
            'aprovado',
            'a_validar',
            'aprovado',
            observacoes || 'Reembolso aprovado',
            req.ip
        );

        logger.logInfo('Reembolso aprovado', {
            reembolso_id: id,
            admin: req.user.nome
        });

        res.json({ success: true, message: 'Reembolso aprovado com sucesso' });

    } catch (error) {
        logger.logError('Erro ao aprovar reembolso', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/reembolsos/:id/rejeitar - Rejeitar reembolso
router.post('/:id/rejeitar', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo_rejeicao } = req.body;

        if (!motivo_rejeicao) {
            return res.status(400).json({
                success: false,
                error: 'Motivo da rejeição é obrigatório'
            });
        }

        const reembolso = await getQuery('SELECT * FROM reembolsos WHERE id = ?', [id]);
        if (!reembolso) {
            return res.status(404).json({ success: false, error: 'Reembolso não encontrado' });
        }

        if (reembolso.status === 'pago') {
            return res.status(400).json({
                success: false,
                error: 'Não é possível rejeitar reembolso já pago'
            });
        }

        await runQuery(`
            UPDATE reembolsos
            SET status = 'rejeitado',
                data_rejeicao = CURRENT_TIMESTAMP,
                rejeitado_por = ?,
                motivo_rejeicao = ?,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [req.user.userId, motivo_rejeicao, id]);

        await registrarHistorico(
            id,
            req.user.userId,
            req.user.nome,
            'rejeitado',
            reembolso.status,
            'rejeitado',
            `Motivo: ${motivo_rejeicao}`,
            req.ip
        );

        logger.logWarning('Reembolso rejeitado', {
            reembolso_id: id,
            admin: req.user.nome,
            motivo: motivo_rejeicao
        });

        res.json({ success: true, message: 'Reembolso rejeitado' });

    } catch (error) {
        logger.logError('Erro ao rejeitar reembolso', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/reembolsos/:id/marcar-pago - Marcar como pago
router.post('/:id/marcar-pago', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { observacoes } = req.body;

        const reembolso = await getQuery('SELECT * FROM reembolsos WHERE id = ?', [id]);
        if (!reembolso) {
            return res.status(404).json({ success: false, error: 'Reembolso não encontrado' });
        }

        if (reembolso.status !== 'aprovado') {
            return res.status(400).json({
                success: false,
                error: 'Apenas reembolsos aprovados podem ser marcados como pagos'
            });
        }

        await runQuery(`
            UPDATE reembolsos
            SET status = 'pago',
                data_pagamento = CURRENT_TIMESTAMP,
                pago_por = ?,
                observacoes = ?,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [req.user.userId, observacoes || reembolso.observacoes, id]);

        await registrarHistorico(
            id,
            req.user.userId,
            req.user.nome,
            'pago',
            'aprovado',
            'pago',
            observacoes || 'Pagamento realizado',
            req.ip
        );

        logger.logInfo('Reembolso marcado como pago', {
            reembolso_id: id,
            admin: req.user.nome
        });

        res.json({ success: true, message: 'Reembolso marcado como pago' });

    } catch (error) {
        logger.logError('Erro ao marcar reembolso como pago', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE UPLOAD DE ARQUIVOS
// ========================================

// POST /api/admin/reembolsos/:id/upload - Upload de comprovantes
router.post('/:id/upload', verifyToken, verifyAdmin, upload.fields([
    { name: 'comprovante_nf', maxCount: 1 },
    { name: 'comprovante_recibo', maxCount: 1 },
    { name: 'comprovante_pagamento', maxCount: 1 }
]), async (req, res) => {
    try {
        const { id } = req.params;

        const reembolso = await getQuery('SELECT * FROM reembolsos WHERE id = ?', [id]);
        if (!reembolso) {
            return res.status(404).json({ success: false, error: 'Reembolso não encontrado' });
        }

        const updates = {};
        if (req.files['comprovante_nf']) {
            updates.comprovante_nf = req.files['comprovante_nf'][0].filename;
        }
        if (req.files['comprovante_recibo']) {
            updates.comprovante_recibo = req.files['comprovante_recibo'][0].filename;
        }
        if (req.files['comprovante_pagamento']) {
            updates.comprovante_pagamento = req.files['comprovante_pagamento'][0].filename;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum arquivo foi enviado'
            });
        }

        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        await runQuery(`
            UPDATE reembolsos
            SET ${setClauses}, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `, values);

        await registrarHistorico(
            id,
            req.user.userId,
            req.user.nome,
            'editado',
            reembolso.status,
            reembolso.status,
            `Arquivos anexados: ${Object.keys(updates).join(', ')}`,
            req.ip
        );

        res.json({
            success: true,
            message: 'Arquivos enviados com sucesso',
            arquivos: updates
        });

    } catch (error) {
        logger.logError('Erro ao fazer upload de arquivos', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/reembolsos/:id/arquivo/:tipo - Download de arquivo
router.get('/:id/arquivo/:tipo', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id, tipo } = req.params;

        const tipos_validos = ['comprovante_nf', 'comprovante_recibo', 'comprovante_pagamento'];
        if (!tipos_validos.includes(tipo)) {
            return res.status(400).json({ success: false, error: 'Tipo de arquivo inválido' });
        }

        const reembolso = await getQuery(`SELECT ${tipo} FROM reembolsos WHERE id = ?`, [id]);
        if (!reembolso || !reembolso[tipo]) {
            return res.status(404).json({ success: false, error: 'Arquivo não encontrado' });
        }

        const filePath = path.join(__dirname, '..', 'uploads', 'reembolsos', reembolso[tipo]);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'Arquivo não existe no servidor' });
        }

        res.download(filePath);

    } catch (error) {
        logger.logError('Erro ao baixar arquivo', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE EXPORTAÇÃO
// ========================================

// GET /api/admin/reembolsos/exportar/csv - Exportar para CSV
router.get('/exportar/csv', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { status, mes_referencia, distribuidor_id } = req.query;

        let sql = `
            SELECT
                r.id,
                r.mes_referencia,
                r.valor,
                r.status,
                v.codigo_vale,
                d.razao_social as distribuidor,
                d.cnpj,
                c.nome as colaborador,
                c.cpf,
                r.data_validacao,
                r.data_aprovacao,
                r.data_pagamento,
                aprovador.nome as aprovado_por,
                pagador.nome as pago_por,
                r.observacoes
            FROM reembolsos r
            LEFT JOIN distribuidores d ON r.distribuidor_id = d.id
            LEFT JOIN colaboradores c ON r.colaborador_id = c.id
            LEFT JOIN vales v ON r.vale_id = v.id
            LEFT JOIN usuarios_admin aprovador ON r.aprovado_por = aprovador.id
            LEFT JOIN usuarios_admin pagador ON r.pago_por = pagador.id
            WHERE 1=1
        `;

        const params = [];
        if (status) {
            sql += ' AND r.status = ?';
            params.push(status);
        }
        if (mes_referencia) {
            sql += ' AND r.mes_referencia = ?';
            params.push(mes_referencia);
        }
        if (distribuidor_id) {
            sql += ' AND r.distribuidor_id = ?';
            params.push(distribuidor_id);
        }

        sql += ' ORDER BY r.criado_em DESC';

        const reembolsos = await allQuery(sql, params);

        // Gerar CSV
        const csv_header = 'ID,Mês Ref,Valor,Status,Código Vale,Distribuidor,CNPJ,Colaborador,CPF,Data Validação,Data Aprovação,Data Pagamento,Aprovado Por,Pago Por,Observações\n';
        const csv_rows = reembolsos.map(r => {
            return [
                r.id,
                r.mes_referencia,
                r.valor,
                r.status,
                r.codigo_vale,
                `"${r.distribuidor}"`,
                r.cnpj,
                `"${r.colaborador}"`,
                r.cpf,
                r.data_validacao || '',
                r.data_aprovacao || '',
                r.data_pagamento || '',
                r.aprovado_por || '',
                r.pago_por || '',
                `"${r.observacoes || ''}"`
            ].join(',');
        }).join('\n');

        const csv = csv_header + csv_rows;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=reembolsos_${Date.now()}.csv`);
        res.send('\uFEFF' + csv); // BOM para UTF-8

    } catch (error) {
        logger.logError('Erro ao exportar CSV', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/admin/reembolsos/:id - Deletar reembolso (apenas a_validar ou rejeitado)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const reembolso = await getQuery('SELECT * FROM reembolsos WHERE id = ?', [id]);
        if (!reembolso) {
            return res.status(404).json({ success: false, error: 'Reembolso não encontrado' });
        }

        // Só pode deletar se não foi processado
        if (reembolso.status === 'aprovado' || reembolso.status === 'pago') {
            return res.status(400).json({
                success: false,
                error: 'Não é possível deletar reembolsos aprovados ou pagos'
            });
        }

        // Deletar arquivos associados
        ['comprovante_nf', 'comprovante_recibo', 'comprovante_pagamento'].forEach(campo => {
            if (reembolso[campo]) {
                const filePath = path.join(__dirname, '..', 'uploads', 'reembolsos', reembolso[campo]);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        });

        // Deletar histórico e reembolso
        await runQuery('DELETE FROM historico_reembolsos WHERE reembolso_id = ?', [id]);
        await runQuery('DELETE FROM reembolsos WHERE id = ?', [id]);

        logger.logWarning('Reembolso deletado', {
            reembolso_id: id,
            admin: req.user.nome
        });

        res.json({ success: true, message: 'Reembolso deletado com sucesso' });

    } catch (error) {
        logger.logError('Erro ao deletar reembolso', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

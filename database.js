const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Railway usa volumes persistentes em /data
// Localmente usa o diretório atual
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT
    ? '/data'
    : path.join(__dirname, 'data');

// Criar diretório de dados se não existir
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'database.sqlite');

// Log importante para verificar persistência
console.log('📊 Configuração do Banco de Dados:');
console.log('   • Ambiente:', process.env.RAILWAY_ENVIRONMENT ? 'RAILWAY (Produção)' : 'LOCAL (Desenvolvimento)');
console.log('   • Diretório de dados:', DATA_DIR);
console.log('   • Caminho do banco:', DB_PATH);
console.log('   • Volume persistente:', process.env.RAILWAY_ENVIRONMENT ? 'SIM (/data)' : 'NÃO (./data)');

const db = new sqlite3.Database(DB_PATH);

// Habilitar foreign keys
db.run('PRAGMA foreign_keys = ON');

// Função para executar queries com Promise
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

// Função para buscar todos os registros
const allQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Função para buscar um registro
const getQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Inicialização do banco de dados
const initDatabase = async () => {
    console.log('🔧 Inicializando banco de dados...');

    // Tabela de Usuários do Sistema (RH/Admin)
    console.log('   → Criando tabela usuarios_admin...');
    await runQuery(`
        CREATE TABLE IF NOT EXISTS usuarios_admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            nivel TEXT CHECK(nivel IN ('admin', 'supervisor', 'operador')) DEFAULT 'operador',
            ativo INTEGER DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Colaboradores
    await runQuery(`
        CREATE TABLE IF NOT EXISTS colaboradores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cpf TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefone TEXT NOT NULL,
            senha TEXT NOT NULL,
            
            -- Endereço (opcionais para permitir importação simplificada)
            cep TEXT,
            logradouro TEXT,
            numero TEXT,
            complemento TEXT,
            bairro TEXT,
            cidade TEXT NOT NULL,
            estado TEXT NOT NULL,
            
            -- Dados profissionais
            data_admissao DATE NOT NULL,
            matricula TEXT,
            setor TEXT,
            
            -- Controle
            ativo INTEGER DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Distribuidores/Revendas
    await runQuery(`
        CREATE TABLE IF NOT EXISTS distribuidores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cnpj TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            telefone TEXT NOT NULL,
            responsavel TEXT NOT NULL,

            -- Tipo de distribuidor (interno = Consigaz, externo = recebe reembolso)
            tipo_distribuidor TEXT CHECK(tipo_distribuidor IN ('interno', 'externo')) DEFAULT 'externo',

            -- Endereço
            cep TEXT NOT NULL,
            logradouro TEXT NOT NULL,
            numero TEXT NOT NULL,
            complemento TEXT,
            bairro TEXT NOT NULL,
            cidade TEXT NOT NULL,
            estado TEXT NOT NULL,
            
            -- Coordenadas para geolocalização
            latitude REAL,
            longitude REAL,
            
            -- Horário de funcionamento
            horario_funcionamento TEXT,

            -- Dados Bancários (para reembolso)
            banco TEXT,
            agencia TEXT,
            conta TEXT,
            tipo_conta TEXT CHECK(tipo_conta IN ('corrente', 'poupanca')),
            pix TEXT,

            -- Controle
            ativo INTEGER DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Vales-Gás (códigos mensais)
    await runQuery(`
        CREATE TABLE IF NOT EXISTS vales_gas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            colaborador_id INTEGER NOT NULL,
            codigo TEXT UNIQUE NOT NULL,
            mes_referencia TEXT NOT NULL,  -- Formato: YYYY-MM
            
            -- Status do vale
            status TEXT CHECK(status IN ('ativo', 'utilizado', 'expirado')) DEFAULT 'ativo',
            
            -- Dados de retirada
            distribuidor_id INTEGER,
            data_retirada DATETIME,
            
            -- Controle
            data_geracao DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_expiracao DATE NOT NULL,
            
            FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
            FOREIGN KEY (distribuidor_id) REFERENCES distribuidores(id)
        )
    `);

    // Tabela de Histórico de Retiradas (para relatórios)
    await runQuery(`
        CREATE TABLE IF NOT EXISTS historico_retiradas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vale_id INTEGER NOT NULL,
            colaborador_id INTEGER NOT NULL,
            distribuidor_id INTEGER NOT NULL,
            codigo TEXT NOT NULL,
            mes_referencia TEXT NOT NULL,
            data_retirada DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            -- Dados do colaborador no momento da retirada
            colaborador_nome TEXT,
            colaborador_cpf TEXT,
            
            -- Dados do distribuidor no momento da retirada
            distribuidor_nome TEXT,
            
            FOREIGN KEY (vale_id) REFERENCES vales_gas(id),
            FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
            FOREIGN KEY (distribuidor_id) REFERENCES distribuidores(id)
        )
    `);

    // Tabela de Solicitações de Alteração de Dados (colaborador pede correção)
    await runQuery(`
        CREATE TABLE IF NOT EXISTS solicitacoes_alteracao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            colaborador_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,  -- 'endereco', 'telefone', 'email', 'outros'
            descricao TEXT NOT NULL,
            dados_novos TEXT,  -- JSON com os novos dados
            status TEXT CHECK(status IN ('pendente', 'aprovado', 'rejeitado')) DEFAULT 'pendente',
            resposta_admin TEXT,
            admin_id INTEGER,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
            FOREIGN KEY (admin_id) REFERENCES usuarios_admin(id)
        )
    `);

    // Tabela de Logs de Webhook (para debug e controle)
    await runQuery(`
        CREATE TABLE IF NOT EXISTS logs_webhook (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,  -- 'codigo_gerado', 'lembrete_expiracao', 'vale_retirado'
            payload TEXT NOT NULL,  -- JSON enviado
            resposta TEXT,
            status_code INTEGER,
            sucesso INTEGER DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Tokens de Recuperação de Senha
    await runQuery(`
        CREATE TABLE IF NOT EXISTS tokens_recuperacao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo_usuario TEXT NOT NULL,  -- 'colaborador', 'admin', 'distribuidor'
            usuario_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expira_em DATETIME NOT NULL,
            usado INTEGER DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Logs de Auditoria
    await runQuery(`
        CREATE TABLE IF NOT EXISTS logs_auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo_usuario TEXT NOT NULL,  -- 'admin', 'colaborador', 'distribuidor'
            usuario_id INTEGER NOT NULL,
            usuario_nome TEXT NOT NULL,
            acao TEXT NOT NULL,  -- 'login', 'criar_colaborador', 'editar_colaborador', etc.
            entidade TEXT,  -- 'colaborador', 'distribuidor', 'vale', 'usuario'
            entidade_id INTEGER,
            detalhes TEXT,  -- JSON com detalhes adicionais
            ip TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Configurações do Sistema
    await runQuery(`
        CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT NOT NULL,
            descricao TEXT,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Avaliações de Distribuidores
    await runQuery(`
        CREATE TABLE IF NOT EXISTS avaliacoes_distribuidores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            retirada_id INTEGER NOT NULL,
            colaborador_id INTEGER NOT NULL,
            distribuidor_id INTEGER NOT NULL,
            nota INTEGER NOT NULL CHECK(nota >= 1 AND nota <= 5),
            comentario TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (retirada_id) REFERENCES historico_retiradas(id),
            FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
            FOREIGN KEY (distribuidor_id) REFERENCES distribuidores(id),

            UNIQUE(retirada_id)
        )
    `);

    // Tabela de Reembolsos (Distribuidores Externos)
    console.log('   → Criando tabela reembolsos...');
    await runQuery(`
        CREATE TABLE IF NOT EXISTS reembolsos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vale_id INTEGER NOT NULL,
            distribuidor_id INTEGER NOT NULL,
            colaborador_id INTEGER NOT NULL,

            -- Dados financeiros
            valor DECIMAL(10,2) NOT NULL,
            mes_referencia TEXT NOT NULL,

            -- Status e aprovação
            status TEXT CHECK(status IN ('a_validar', 'aprovado', 'pago', 'rejeitado')) DEFAULT 'a_validar',
            observacoes TEXT,
            motivo_rejeicao TEXT,

            -- Comprovantes e documentos
            comprovante_nf TEXT,  -- Caminho do arquivo da Nota Fiscal
            comprovante_recibo TEXT,  -- Caminho do arquivo do Recibo
            comprovante_pagamento TEXT,  -- Comprovante de pagamento feito pelo RH

            -- Dados bancários do distribuidor (opcional, pode vir do cadastro)
            banco TEXT,
            agencia TEXT,
            conta TEXT,
            tipo_conta TEXT CHECK(tipo_conta IN ('corrente', 'poupanca')),
            pix TEXT,

            -- Datas de controle
            data_validacao DATETIME,  -- Quando o vale foi validado (origem do reembolso)
            data_aprovacao DATETIME,  -- Quando o RH aprovou
            data_pagamento DATETIME,  -- Quando foi marcado como pago
            data_rejeicao DATETIME,

            -- Responsáveis
            aprovado_por INTEGER,  -- ID do admin que aprovou
            pago_por INTEGER,  -- ID do admin que marcou como pago
            rejeitado_por INTEGER,  -- ID do admin que rejeitou

            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (vale_id) REFERENCES vales_gas(id),
            FOREIGN KEY (distribuidor_id) REFERENCES distribuidores(id),
            FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
            FOREIGN KEY (aprovado_por) REFERENCES usuarios_admin(id),
            FOREIGN KEY (pago_por) REFERENCES usuarios_admin(id),
            FOREIGN KEY (rejeitado_por) REFERENCES usuarios_admin(id)
        )
    `);
    console.log('   ✓ Tabela reembolsos criada');

    // Tabela de Histórico de Alterações de Reembolsos (Trilha de Auditoria)
    console.log('   → Criando tabela historico_reembolsos...');
    await runQuery(`
        CREATE TABLE IF NOT EXISTS historico_reembolsos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reembolso_id INTEGER NOT NULL,
            admin_id INTEGER NOT NULL,
            admin_nome TEXT NOT NULL,

            status_anterior TEXT,
            status_novo TEXT NOT NULL,

            campo_alterado TEXT,  -- 'status', 'valor', 'observacoes', etc.
            valor_anterior TEXT,
            valor_novo TEXT,

            acao TEXT NOT NULL,  -- 'criado', 'aprovado', 'pago', 'rejeitado', 'editado'
            observacao TEXT,

            ip TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (reembolso_id) REFERENCES reembolsos(id),
            FOREIGN KEY (admin_id) REFERENCES usuarios_admin(id)
        )
    `);

    // Índices para performance de reembolsos
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_reembolsos_status ON reembolsos(status)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_reembolsos_mes ON reembolsos(mes_referencia)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_reembolsos_distribuidor ON reembolsos(distribuidor_id)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_historico_reembolsos ON historico_reembolsos(reembolso_id)`);

    // MIGRAÇÃO: Adicionar coluna tipo_distribuidor se não existir
    try {
        const columns = await allQuery(`PRAGMA table_info(distribuidores)`);
        const hasTipoDistribuidor = columns.some(col => col.name === 'tipo_distribuidor');

        if (!hasTipoDistribuidor) {
            console.log('   → Migrando tabela distribuidores: adicionando tipo_distribuidor...');
            await runQuery(`ALTER TABLE distribuidores ADD COLUMN tipo_distribuidor TEXT CHECK(tipo_distribuidor IN ('interno', 'externo')) DEFAULT 'externo'`);
            console.log('   ✓ Coluna tipo_distribuidor adicionada com sucesso');
        }
    } catch (error) {
        console.error('   ⚠️  Erro ao adicionar coluna tipo_distribuidor:', error.message);
    }

    // MIGRAÇÃO: Adicionar colunas bancárias na tabela distribuidores se não existirem
    try {
        const columns = await allQuery(`PRAGMA table_info(distribuidores)`);
        const columnNames = columns.map(col => col.name);

        const camposBancarios = [
            { nome: 'banco', sql: 'banco TEXT' },
            { nome: 'agencia', sql: 'agencia TEXT' },
            { nome: 'conta', sql: 'conta TEXT' },
            { nome: 'tipo_conta', sql: "tipo_conta TEXT CHECK(tipo_conta IN ('corrente', 'poupanca'))" },
            { nome: 'pix', sql: 'pix TEXT' }
        ];

        for (const campo of camposBancarios) {
            if (!columnNames.includes(campo.nome)) {
                console.log(`   → Migrando tabela distribuidores: adicionando ${campo.nome}...`);
                await runQuery(`ALTER TABLE distribuidores ADD COLUMN ${campo.sql}`);
                console.log(`   ✓ Coluna ${campo.nome} adicionada com sucesso`);
            }
        }
    } catch (error) {
        console.error('   ⚠️  Erro ao adicionar colunas bancárias:', error.message);
    }

    // Inserir configurações padrão se não existirem
    const configPadrao = [
        { chave: 'vales_por_mes', valor: '1', descricao: 'Quantidade de vales por colaborador por mês' },
        { chave: 'dias_validade_vale', valor: '30', descricao: 'Dias de validade do vale após geração' },
        { chave: 'dia_geracao_automatica', valor: '1', descricao: 'Dia do mês para geração automática de vales' },
        { chave: 'notificar_expiracao_dias', valor: '7,3,1', descricao: 'Dias antes da expiração para enviar lembrete' },
        { chave: 'valor_reembolso_padrao', valor: '100.00', descricao: 'Valor padrão de reembolso por vale (R$)' },
        { chave: 'gerar_reembolso_automatico', valor: 'true', descricao: 'Gerar reembolso automaticamente ao validar vale' }
    ];

    for (const config of configPadrao) {
        const existe = await getQuery('SELECT chave FROM configuracoes WHERE chave = ?', [config.chave]);
        if (!existe) {
            await runQuery(
                'INSERT INTO configuracoes (chave, valor, descricao) VALUES (?, ?, ?)',
                [config.chave, config.valor, config.descricao]
            );
        }
    }

    // Criar índices para melhor performance
    console.log('🔧 Criando índices do banco de dados...');

    // Índices existentes
    await runQuery('CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON colaboradores(cpf)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_colaboradores_email ON colaboradores(email)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_vales_codigo ON vales_gas(codigo)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_vales_mes ON vales_gas(mes_referencia)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_vales_status ON vales_gas(status)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_distribuidores_cnpj ON distribuidores(cnpj)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_historico_mes ON historico_retiradas(mes_referencia)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_logs_auditoria_data ON logs_auditoria(criado_em)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_avaliacoes_distribuidor ON avaliacoes_distribuidores(distribuidor_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_avaliacoes_colaborador ON avaliacoes_distribuidores(colaborador_id)');

    // Novos índices para otimização de queries
    await runQuery('CREATE INDEX IF NOT EXISTS idx_vales_colaborador_mes ON vales_gas(colaborador_id, mes_referencia)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_vales_status_expiracao ON vales_gas(status, data_expiracao)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_vales_distribuidor ON vales_gas(distribuidor_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes_alteracao(status)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_solicitacoes_colaborador ON solicitacoes_alteracao(colaborador_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_historico_data ON historico_retiradas(data_retirada)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_historico_colaborador ON historico_retiradas(colaborador_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_historico_distribuidor ON historico_retiradas(distribuidor_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_logs_webhook_tipo ON logs_webhook(tipo, criado_em)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_logs_webhook_sucesso ON logs_webhook(sucesso, criado_em)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_tokens_tipo_usuario ON tokens_recuperacao(tipo_usuario, usuario_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens_recuperacao(token)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_tokens_expiracao ON tokens_recuperacao(expira_em)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo ON colaboradores(ativo)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_distribuidores_ativo ON distribuidores(ativo)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_distribuidores_cidade ON distribuidores(cidade, ativo)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_avaliacoes_nota ON avaliacoes_distribuidores(distribuidor_id, nota)');

    console.log('✅ Índices criados com sucesso!');

    // Criar usuário admin master se não existir
    const adminEmail = process.env.ADMIN_MASTER_EMAIL || 'admin@consigaz.com.br';
    const adminNome = process.env.ADMIN_MASTER_NOME || 'Administrador Master';
    const adminSenha = process.env.ADMIN_MASTER_SENHA || 'ConsigAz@2025';
    
    const adminExiste = await getQuery('SELECT id FROM usuarios_admin WHERE email = ?', [adminEmail]);
    
    if (!adminExiste) {
        const senhaHash = await bcrypt.hash(adminSenha, 10);
        await runQuery(
            'INSERT INTO usuarios_admin (nome, email, senha, nivel) VALUES (?, ?, ?, ?)',
            [adminNome, adminEmail, senhaHash, 'admin']
        );
        console.log(`👤 Usuário admin master criado: ${adminEmail}`);
        console.log('   ⚠️  ALTERE A SENHA APÓS O PRIMEIRO LOGIN!');
        // SEGURANÇA: Não logamos a senha no console
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
};

module.exports = {
    db,
    runQuery,
    allQuery,
    getQuery,
    initDatabase
};

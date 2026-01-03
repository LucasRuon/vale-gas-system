# 🐘 Migração SQLite → PostgreSQL no Railway

## 📊 Comparação: SQLite vs PostgreSQL

| Característica | SQLite (Atual) | PostgreSQL (Railway) |
|----------------|----------------|----------------------|
| **Configuração** | ✅ Simples (arquivo local) | ⚠️ Requer configuração |
| **Persistência** | ⚠️ Precisa volume /data | ✅ Gerenciado pelo Railway |
| **Backups** | ⚠️ Manual/CRON | ✅ Automático (Railway) |
| **Escalabilidade** | ❌ Uma instância apenas | ✅ Múltiplas instâncias |
| **Tamanho** | ⚠️ Limitado (1GB Railway) | ✅ Ilimitado (plano Railway) |
| **Custo** | ✅ Grátis | ⚠️ $5/mês (Railway) |
| **Performance** | ✅ Excelente (pequeno) | ✅ Excelente (grande) |
| **Mudanças no código** | ✅ Nenhuma (atual) | ⚠️ Mínimas (database.js) |

---

## 🎯 Recomendação

### **Use SQLite se:**
- ✅ Sistema pequeno (< 100 colaboradores)
- ✅ Sem necessidade de escalar
- ✅ Orçamento zero
- ✅ Quer simplicidade máxima

### **Use PostgreSQL se:**
- ✅ Sistema médio/grande (> 100 colaboradores)
- ✅ Precisa escalar no futuro
- ✅ Quer backups automáticos
- ✅ Múltiplas instâncias do app
- ✅ Pode pagar $5/mês

---

## 🔧 Como Migrar para PostgreSQL

### **Passo 1: Adicionar PostgreSQL no Railway**

1. **Railway Dashboard** → Seu projeto
2. Clique em **+ New** → **Database** → **Add PostgreSQL**
3. Railway criará automaticamente:
   - ✅ Instância PostgreSQL
   - ✅ Variáveis de ambiente (`DATABASE_URL`)
   - ✅ Conexão automática com seu app

### **Passo 2: Instalar Dependências**

```bash
# Remover SQLite
npm uninstall sqlite3

# Instalar PostgreSQL
npm install pg
```

### **Passo 3: Criar `database-postgres.js`**

Vou criar um arquivo novo para você escolher qual usar:

```javascript
// database-postgres.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Railway injeta DATABASE_URL automaticamente
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurado!');
    process.exit(1);
}

// Pool de conexões PostgreSQL
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

console.log('📊 Configuração do Banco de Dados:');
console.log('   • Tipo: PostgreSQL');
console.log('   • Ambiente:', process.env.NODE_ENV || 'development');
console.log('   • SSL:', process.env.NODE_ENV === 'production' ? 'Ativo' : 'Desativado');

// Função para executar queries com Promise
const runQuery = async (sql, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return {
            lastID: result.rows[0]?.id,
            changes: result.rowCount
        };
    } finally {
        client.release();
    }
};

// Função para buscar todos os registros
const allQuery = async (sql, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows;
    } finally {
        client.release();
    }
};

// Função para buscar um registro
const getQuery = async (sql, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows[0] || null;
    } finally {
        client.release();
    }
};

// Inicialização do banco de dados
const initDatabase = async () => {
    console.log('🔧 Inicializando banco de dados PostgreSQL...');

    // IMPORTANTE: PostgreSQL usa SERIAL ao invés de AUTOINCREMENT
    // e $1, $2 para placeholders ao invés de ?

    // Tabela de Usuários do Sistema (RH/Admin)
    await runQuery(`
        CREATE TABLE IF NOT EXISTS usuarios_admin (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            nivel TEXT CHECK(nivel IN ('admin', 'supervisor', 'operador')) DEFAULT 'operador',
            ativo BOOLEAN DEFAULT true,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Colaboradores
    await runQuery(`
        CREATE TABLE IF NOT EXISTS colaboradores (
            id SERIAL PRIMARY KEY,
            nome TEXT NOT NULL,
            cpf TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefone TEXT NOT NULL,
            senha TEXT NOT NULL,

            cep TEXT,
            logradouro TEXT,
            numero TEXT,
            complemento TEXT,
            bairro TEXT,
            cidade TEXT NOT NULL,
            estado TEXT NOT NULL,

            data_admissao DATE NOT NULL,
            matricula TEXT,
            cargo TEXT,
            departamento TEXT,

            ativo BOOLEAN DEFAULT true,
            primeiro_acesso BOOLEAN DEFAULT true,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Distribuidores
    await runQuery(`
        CREATE TABLE IF NOT EXISTS distribuidores (
            id SERIAL PRIMARY KEY,
            razao_social TEXT NOT NULL,
            nome_fantasia TEXT,
            cnpj TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefone TEXT NOT NULL,
            senha TEXT NOT NULL,

            cep TEXT,
            logradouro TEXT,
            numero TEXT,
            complemento TEXT,
            bairro TEXT,
            cidade TEXT NOT NULL,
            estado TEXT NOT NULL,

            responsavel TEXT,
            ativo BOOLEAN DEFAULT true,
            primeiro_acesso BOOLEAN DEFAULT true,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de Vales
    await runQuery(`
        CREATE TABLE IF NOT EXISTS vales (
            id SERIAL PRIMARY KEY,
            colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
            codigo_vale TEXT UNIQUE NOT NULL,
            mes_referencia TEXT NOT NULL,
            data_geracao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_expiracao TIMESTAMP NOT NULL,
            status TEXT CHECK(status IN ('pendente', 'utilizado', 'expirado', 'cancelado')) DEFAULT 'pendente',
            distribuidor_id INTEGER REFERENCES distribuidores(id),
            data_validacao TIMESTAMP,
            observacoes TEXT,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Criar índices para performance
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_vales_colaborador ON vales(colaborador_id)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_vales_mes ON vales(mes_referencia)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_vales_status ON vales(status)`);

    // Criar admin master se não existir
    const adminExists = await getQuery(
        'SELECT id FROM usuarios_admin WHERE email = $1',
        [process.env.ADMIN_MASTER_EMAIL || 'admin@consigaz.com.br']
    );

    if (!adminExists) {
        const senhaHash = await bcrypt.hash(
            process.env.ADMIN_MASTER_SENHA || 'Admin123!@#',
            10
        );
        await runQuery(
            `INSERT INTO usuarios_admin (nome, email, senha, nivel)
             VALUES ($1, $2, $3, $4)`,
            [
                process.env.ADMIN_MASTER_NOME || 'Administrador Master',
                process.env.ADMIN_MASTER_EMAIL || 'admin@consigaz.com.br',
                senhaHash,
                'admin'
            ]
        );
        console.log('✅ Admin master criado');
    }

    console.log('✅ Banco de dados PostgreSQL inicializado');
};

// Fechar pool ao encerrar aplicação
process.on('SIGINT', async () => {
    await pool.end();
    console.log('🔌 Conexão com PostgreSQL fechada');
    process.exit(0);
});

module.exports = {
    pool,
    runQuery,
    allQuery,
    getQuery,
    initDatabase
};
```

### **Passo 4: Atualizar `server.js`**

Trocar a importação:

```javascript
// ANTES (SQLite)
const { initDatabase, allQuery, runQuery, getQuery } = require('./database');

// DEPOIS (PostgreSQL)
const { initDatabase, allQuery, runQuery, getQuery } = require('./database-postgres');
```

### **Passo 5: Atualizar Queries com Placeholders**

**SQLite usa `?`:**
```javascript
await runQuery('SELECT * FROM colaboradores WHERE cpf = ?', [cpf]);
```

**PostgreSQL usa `$1, $2, $3`:**
```javascript
await runQuery('SELECT * FROM colaboradores WHERE cpf = $1', [cpf]);
```

Você precisará substituir todas as queries no código. Vou criar um script para fazer isso automaticamente.

---

## 🔄 Script de Migração Automática

Crie `scripts/migrate-to-postgres.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Diretórios para processar
const dirs = ['routes', '.'];

// Padrão regex para encontrar queries SQLite
const sqlitePattern = /runQuery\s*\(\s*[`'"](.*?)[`'"],\s*\[(.*?)\]\s*\)/g;

function convertPlaceholders(sql, params) {
    let counter = 1;
    const convertedSql = sql.replace(/\?/g, () => `$${counter++}`);
    return { sql: convertedSql, params };
}

function processFile(filePath) {
    console.log(`📝 Processando: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    content = content.replace(sqlitePattern, (match, sql, params) => {
        if (sql.includes('?')) {
            const { sql: newSql } = convertPlaceholders(sql, params);
            modified = true;
            return `runQuery(\`${newSql}\`, [${params}])`;
        }
        return match;
    });

    // Converter INTEGER AUTOINCREMENT → SERIAL
    if (content.includes('INTEGER PRIMARY KEY AUTOINCREMENT')) {
        content = content.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
        modified = true;
    }

    // Converter INTEGER (boolean) → BOOLEAN
    if (content.includes('INTEGER DEFAULT 1') || content.includes('INTEGER DEFAULT 0')) {
        content = content.replace(/INTEGER DEFAULT 1/g, 'BOOLEAN DEFAULT true');
        content = content.replace(/INTEGER DEFAULT 0/g, 'BOOLEAN DEFAULT false');
        modified = true;
    }

    // Converter DATETIME → TIMESTAMP
    if (content.includes('DATETIME')) {
        content = content.replace(/DATETIME/g, 'TIMESTAMP');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`   ✅ Modificado`);
    } else {
        console.log(`   ⏭️  Nenhuma mudança necessária`);
    }
}

// Processar arquivos
dirs.forEach(dir => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (file.endsWith('.js') && !file.includes('migrate')) {
            processFile(path.join(dir, file));
        }
    });
});

console.log('\n✅ Migração concluída!');
```

Execute:
```bash
node scripts/migrate-to-postgres.js
```

---

## 📋 Checklist de Migração

### **Antes de Migrar:**
- [ ] Fazer backup completo do banco SQLite atual
- [ ] Exportar dados importantes (CSV)
- [ ] Testar PostgreSQL localmente primeiro
- [ ] Documentar credenciais do banco atual

### **Durante a Migração:**
- [ ] Adicionar PostgreSQL no Railway
- [ ] Instalar dependência `pg`
- [ ] Criar `database-postgres.js`
- [ ] Converter placeholders (`?` → `$1`)
- [ ] Converter tipos SQLite → PostgreSQL
- [ ] Atualizar `server.js`
- [ ] Testar localmente com PostgreSQL

### **Após a Migração:**
- [ ] Verificar todas as rotas funcionando
- [ ] Importar dados do backup (se necessário)
- [ ] Testar CRUD completo
- [ ] Verificar logs de erro
- [ ] Monitorar performance

---

## 🆚 Diferenças Principais

### **1. Tipos de Dados**

| SQLite | PostgreSQL |
|--------|------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `INTEGER` (boolean) | `BOOLEAN` |
| `DATETIME` | `TIMESTAMP` |
| `TEXT` | `TEXT` ou `VARCHAR(n)` |

### **2. Placeholders**

```javascript
// SQLite
await runQuery('SELECT * FROM users WHERE id = ? AND nome = ?', [id, nome]);

// PostgreSQL
await runQuery('SELECT * FROM users WHERE id = $1 AND nome = $2', [id, nome]);
```

### **3. Foreign Keys**

```sql
-- SQLite
PRAGMA foreign_keys = ON;

-- PostgreSQL (ativado por padrão)
-- Não precisa configurar
```

### **4. Funções de Data**

```sql
-- SQLite
CURRENT_TIMESTAMP

-- PostgreSQL
CURRENT_TIMESTAMP (mesmo)
NOW() (também funciona)
```

---

## 💰 Custo Estimado

### **Railway PostgreSQL:**
- **Free Tier**: Incluído até $5 crédito/mês
- **Hobby Plan**: $5/mês (500 horas)
- **Pro Plan**: $20/mês (uso ilimitado)

### **SQLite com Volume:**
- **Free Tier**: Incluído (até 1GB)
- **Custo adicional**: $0 (grátis)

---

## 🎯 Minha Recomendação

### **Para o seu caso (Consigaz):**

Eu recomendaria **MANTER SQLite** por enquanto, PELOS SEGUINTES MOTIVOS:

✅ **Vantagens para você:**
1. **Custo zero** - SQLite é grátis, PostgreSQL custa $5/mês
2. **Simplicidade** - Não precisa configurar nada extra
3. **Performance excelente** - Para até 500 colaboradores, SQLite é mais que suficiente
4. **Código atual funciona** - Não precisa migrar nada
5. **Volume /data resolve** - Com volume persistente, dados não se perdem

⚠️ **Quando migrar para PostgreSQL:**
1. Quando passar de **500+ colaboradores**
2. Quando precisar **múltiplas instâncias** do app (load balancing)
3. Quando o volume SQLite encher (> 1GB)
4. Quando cliente pagar por plano Railway Pro

---

## 🔄 Solução Híbrida (Melhor de Dois Mundos)

Você pode preparar o código para **suportar ambos** e escolher via variável de ambiente:

```javascript
// database.js
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

if (DB_TYPE === 'postgres') {
    module.exports = require('./database-postgres');
} else {
    module.exports = require('./database-sqlite');
}
```

Assim você pode trocar apenas mudando `.env`:
```bash
# Usar SQLite
DB_TYPE=sqlite

# Usar PostgreSQL
DB_TYPE=postgres
```

---

## ✅ Conclusão

### **Resposta à sua pergunta:**

**SIM, você pode usar PostgreSQL no Railway** e funcionaria perfeitamente. As mudanças necessárias são:

1. ✅ Trocar biblioteca (`sqlite3` → `pg`)
2. ✅ Converter placeholders (`?` → `$1`)
3. ✅ Ajustar tipos de dados (`INTEGER AUTOINCREMENT` → `SERIAL`)
4. ✅ ~2-4 horas de trabalho para migrar tudo

### **Mas minha recomendação:**

**Configure o volume /data e mantenha SQLite** por enquanto:
- Mais simples
- Custo zero
- Resolve seu problema de perda de dados
- Pode migrar para PostgreSQL depois se precisar

---

**Quer que eu:**
1. ✅ Configure o volume /data (solução imediata)
2. ⏭️  Crie os arquivos para PostgreSQL (migração futura)
3. ⏭️  Implemente solução híbrida (suporta ambos)

Qual você prefere?

# 🏗️ Arquitetura do Sistema Vale-Gás v2.0

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Estrutura de Diretórios](#estrutura-de-diretórios)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Arquitetura Backend](#arquitetura-backend)
5. [Arquitetura Frontend](#arquitetura-frontend)
6. [Banco de Dados](#banco-de-dados)
7. [Segurança](#segurança)
8. [Fluxo de Requisições](#fluxo-de-requisições)
9. [Configuração e Deploy](#configuração-e-deploy)
10. [Replicação para Novos Projetos](#replicação-para-novos-projetos)

---

## 🎯 Visão Geral

Sistema multi-tenant com 3 tipos de usuários (Admin, Colaborador, Distribuidor), autenticação JWT, auditoria completa e integração com webhooks.

**Características principais:**
- **Arquitetura**: MVC simplificada (sem camada de View separada)
- **Pattern**: RESTful API + Server-Side Rendering
- **Segurança**: JWT, bcrypt, Helmet, sanitização XSS
- **Performance**: Cache em memória, rate limiting
- **Monitoramento**: Winston logs, auditoria completa
- **Deploy**: Railway (PostgreSQL) ou Local (SQLite)

---

## 📁 Estrutura de Diretórios

```
vale-gas-system/
│
├── assets/                    # Imagens e arquivos estáticos
│   └── logo-consigaz.png     # Logo da empresa
│
├── backups/                   # Backups manuais do banco
│
├── config/                    # Configurações centralizadas
│   ├── cache.js              # Sistema de cache em memória
│   └── logger.js             # Winston logger configurado
│
├── data/                      # Dados persistentes
│   ├── database.sqlite       # Banco SQLite (local)
│   └── backups/              # Backups automáticos
│
├── logs/                      # Logs do sistema
│   ├── combined.log          # Todos os logs
│   ├── error.log             # Apenas erros
│   └── audit.log             # Auditoria de ações
│
├── middlewares/               # Middlewares customizados
│   ├── errorHandler.js       # Tratamento global de erros
│   └── sanitize.js           # Sanitização XSS
│
├── public/                    # Frontend (HTML estático)
│   ├── index.html            # Página inicial
│   ├── login-admin.html      # Login RH
│   ├── login-colaborador.html # Login colaborador
│   ├── login-distribuidor.html # Login distribuidor
│   ├── admin.html            # Dashboard RH
│   ├── colaborador.html      # Dashboard colaborador
│   ├── distribuidor.html     # Dashboard distribuidor
│   └── recuperar-senha.html  # Recuperação de senha
│
├── routes/                    # Rotas da API (Controllers)
│   ├── admin.js              # Endpoints RH
│   ├── auth.js               # Autenticação
│   ├── colaborador.js        # Endpoints colaborador
│   ├── distribuidor.js       # Endpoints distribuidor
│   └── cron.js               # Jobs agendados
│
├── scripts/                   # Scripts utilitários
│   ├── backup.sh             # Backup automático do banco
│   └── gerar-pdf-manual.js   # Geração de PDF do manual
│
├── .env                       # Variáveis de ambiente (não commitado)
├── .env.local                 # Template ambiente local
├── .env.railway               # Template ambiente Railway
├── .gitignore                 # Arquivos ignorados pelo Git
├── .eslintrc.json             # Configuração ESLint
├── .prettierrc.json           # Configuração Prettier
│
├── auth.js                    # Sistema de autenticação JWT
├── auditoria.js               # Sistema de auditoria
├── database.js                # Conexão e queries do banco
├── server.js                  # Servidor principal (entry point)
├── utils.js                   # Funções utilitárias
├── webhooks.js                # Integração N8N/Zapier
│
├── package.json               # Dependências e scripts
├── railway.json               # Configuração Railway
│
└── README.md                  # Documentação principal
```

---

## 🛠️ Stack Tecnológico

### **Backend**
| Tecnologia | Versão | Função |
|------------|--------|--------|
| Node.js | 18+ | Runtime JavaScript |
| Express.js | 4.18.2 | Framework web |
| SQLite3 | 5.1.6 | Banco de dados (local) |
| PostgreSQL | - | Banco de dados (produção Railway) |

### **Segurança**
| Pacote | Função |
|--------|--------|
| jsonwebtoken | Autenticação JWT |
| bcryptjs | Hash de senhas |
| helmet | Headers de segurança HTTP |
| cors | Controle de CORS |
| express-rate-limit | Proteção contra brute-force |
| validator | Validação de inputs |
| xss | Sanitização contra XSS |

### **Monitoramento e Performance**
| Pacote | Função |
|--------|--------|
| winston | Sistema de logs estruturados |
| node-cache | Cache em memória |
| node-cron | Jobs agendados (geração de vales) |

### **Integração e Utilidades**
| Pacote | Função |
|--------|--------|
| axios | Requisições HTTP (webhooks) |
| dotenv | Variáveis de ambiente |
| puppeteer | Geração de PDFs |
| markdown-it | Conversão Markdown → HTML |

### **Qualidade de Código**
| Pacote | Função |
|--------|--------|
| eslint | Linter JavaScript |
| prettier | Formatação de código |

### **Frontend**
- HTML5 puro
- CSS3 (inline e embedded)
- JavaScript Vanilla (sem frameworks)
- Fetch API para requisições

---

## 🔧 Arquitetura Backend

### **1. Entry Point - `server.js`**

```javascript
// Fluxo de inicialização:
1. Carrega variáveis de ambiente (.env)
2. Configura middlewares de segurança (Helmet, CORS, Rate Limit)
3. Configura middlewares de parsing (JSON, URL-encoded)
4. Configura sanitização XSS
5. Serve arquivos estáticos (/public)
6. Registra rotas da API
7. Configura error handler global
8. Inicializa banco de dados
9. Inicia servidor HTTP
10. Configura jobs CRON (geração automática de vales)
```

**Middlewares aplicados globalmente:**
```javascript
app.use(helmet({...}))                    // Segurança HTTP
app.use(cors({...}))                      // CORS configurado
app.use(express.json())                   // Parse JSON
app.use(sanitizeInput)                    // Sanitização XSS
app.use(rateLimiter)                      // Rate limiting
app.use(express.static('public'))         // Arquivos estáticos
```

### **2. Autenticação - `auth.js`**

```javascript
// Sistema JWT com 3 tipos de tokens:
- Admin (RH): Payload { userId, email, nome, tipo: 'admin' }
- Colaborador: Payload { userId, cpf, nome, tipo: 'colaborador' }
- Distribuidor: Payload { userId, cnpj, nome, tipo: 'distribuidor' }

// Middlewares:
verifyToken(req, res, next)          // Valida JWT
verifyAdmin(req, res, next)          // Apenas admin
verifyColaborador(req, res, next)    // Apenas colaborador
verifyDistribuidor(req, res, next)   // Apenas distribuidor
```

### **3. Banco de Dados - `database.js`**

```javascript
// Pattern: Database Module com funções assíncronas
- initializeDatabase()      // Cria tabelas se não existirem
- runQuery(sql, params)     // INSERT, UPDATE, DELETE
- getQuery(sql, params)     // SELECT único
- allQuery(sql, params)     // SELECT múltiplo

// Tabelas principais:
1. colaboradores
2. distribuidores
3. vales
4. avaliacoes
5. solicitacoes_alteracao
6. admin_users
7. configuracoes
8. audit_logs
```

### **4. Rotas - `/routes`**

Cada arquivo de rota segue o padrão:

```javascript
const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../auth');
const db = require('../database');

// Rota protegida
router.get('/endpoint', verifyToken, verifyAdmin, async (req, res) => {
    try {
        // Lógica de negócio
        const data = await db.allQuery('SELECT...');
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

### **5. Auditoria - `auditoria.js`**

```javascript
// Registra todas as ações críticas:
logAudit({
    usuario_id: req.user.userId,
    tipo_usuario: 'admin',
    acao: 'CREATE_COLABORADOR',
    detalhes: JSON.stringify({ cpf: '12345678900' }),
    ip: req.ip
});

// Armazenado em: logs/audit.log + tabela audit_logs
```

### **6. Webhooks - `webhooks.js`**

```javascript
// Dispara eventos para N8N/Zapier:
- sendWebhook('vale_gerado', { codigoVale, cpf, mesReferencia })
- sendWebhook('vale_validado', { codigoVale, cnpj, distribuidor })
- sendWebhook('avaliacao_criada', { avaliacaoId, nota, comentario })

// Configurado via env: WEBHOOK_VALE_GERADO, WEBHOOK_VALE_VALIDADO, etc.
```

### **7. Cache - `config/cache.js`**

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutos

// Uso em rotas:
let data = cache.get('key');
if (!data) {
    data = await db.allQuery(...);
    cache.set('key', data);
}
```

### **8. Logs - `config/logger.js`**

```javascript
const winston = require('winston');

// Níveis de log:
logger.error('Erro crítico', { error: err.stack });
logger.warn('Aviso', { userId });
logger.info('Informação', { action: 'login' });
logger.debug('Debug detalhado', { query: sql });

// Saídas: console + logs/combined.log + logs/error.log
```

---

## 🎨 Arquitetura Frontend

### **Padrão Utilizado: SPA Simples com Vanilla JS**

Cada página HTML segue a estrutura:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Página</title>
    <style>
        /* CSS inline ou embedded */
        /* Paleta de cores: #1e3a8a, #3b82f6, #eff6ff */
    </style>
</head>
<body>
    <!-- Estrutura HTML -->

    <script>
        // JavaScript Vanilla

        // 1. Verificação de token JWT
        const token = localStorage.getItem('token');
        if (!token) window.location.href = '/login.html';

        // 2. Funções de API
        async function fetchData() {
            const response = await fetch('/api/endpoint', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            return data;
        }

        // 3. Manipulação DOM
        function renderData(data) {
            const container = document.getElementById('container');
            container.innerHTML = data.map(item => `
                <div>${item.name}</div>
            `).join('');
        }

        // 4. Event listeners
        document.getElementById('btn').onclick = async () => {
            const data = await fetchData();
            renderData(data);
        };

        // 5. Inicialização
        document.addEventListener('DOMContentLoaded', async () => {
            const data = await fetchData();
            renderData(data);
        });
    </script>
</body>
</html>
```

### **Padrões de UI:**

1. **Cores Consigaz:**
   - Primária: `#1e3a8a` (azul escuro)
   - Secundária: `#3b82f6` (azul médio)
   - Background: `#eff6ff` (azul claro)
   - Texto: `#333` (preto)

2. **Componentes Comuns:**
   - Cards com `box-shadow` e `border-radius: 8px`
   - Botões com hover effects
   - Tabelas responsivas com striped rows
   - Modals centralizados com overlay
   - Alerts coloridos (success, error, warning, info)

3. **Responsividade:**
   - Grid layout com CSS Grid
   - Media queries para mobile (`@media (max-width: 768px)`)
   - Tabelas com scroll horizontal em mobile

---

## 🗄️ Banco de Dados

### **Schema Completo:**

```sql
-- 1. COLABORADORES
CREATE TABLE colaboradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpf TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    data_nascimento DATE,
    data_admissao DATE,
    cargo TEXT,
    departamento TEXT,
    salario DECIMAL(10,2),
    status TEXT DEFAULT 'ativo',
    senha_hash TEXT,
    primeiro_acesso BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. DISTRIBUIDORES
CREATE TABLE distribuidores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cnpj TEXT UNIQUE NOT NULL,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    email TEXT,
    telefone TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    responsavel TEXT,
    senha_hash TEXT NOT NULL,
    primeiro_acesso BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. VALES
CREATE TABLE vales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    codigo_vale TEXT UNIQUE NOT NULL,
    mes_referencia TEXT NOT NULL,
    data_geracao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_expiracao DATETIME NOT NULL,
    status TEXT DEFAULT 'pendente',
    distribuidor_id INTEGER,
    data_validacao DATETIME,
    observacoes TEXT,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
    FOREIGN KEY (distribuidor_id) REFERENCES distribuidores(id)
);

-- 4. AVALIAÇÕES
CREATE TABLE avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    distribuidor_id INTEGER NOT NULL,
    vale_id INTEGER NOT NULL,
    nota INTEGER CHECK(nota >= 1 AND nota <= 5),
    comentario TEXT,
    data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
    FOREIGN KEY (distribuidor_id) REFERENCES distribuidores(id),
    FOREIGN KEY (vale_id) REFERENCES vales(id)
);

-- 5. SOLICITAÇÕES DE ALTERAÇÃO
CREATE TABLE solicitacoes_alteracao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    tipo_alteracao TEXT NOT NULL,
    dados_antigos TEXT,
    dados_novos TEXT NOT NULL,
    justificativa TEXT,
    status TEXT DEFAULT 'pendente',
    data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_resposta DATETIME,
    respondido_por INTEGER,
    observacoes_resposta TEXT,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
    FOREIGN KEY (respondido_por) REFERENCES admin_users(id)
);

-- 6. ADMIN USERS
CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    cargo TEXT,
    primeiro_acesso BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. CONFIGURAÇÕES
CREATE TABLE configuracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT DEFAULT 'string',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. AUDIT LOGS
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    tipo_usuario TEXT,
    acao TEXT NOT NULL,
    detalhes TEXT,
    ip TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Índices para Performance:**

```sql
CREATE INDEX idx_vales_colaborador ON vales(colaborador_id);
CREATE INDEX idx_vales_mes ON vales(mes_referencia);
CREATE INDEX idx_vales_status ON vales(status);
CREATE INDEX idx_avaliacoes_distribuidor ON avaliacoes(distribuidor_id);
CREATE INDEX idx_audit_usuario ON audit_logs(usuario_id, tipo_usuario);
CREATE INDEX idx_solicitacoes_status ON solicitacoes_alteracao(status);
```

---

## 🔐 Segurança

### **1. Autenticação e Autorização**

```javascript
// JWT com expiração
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

// Refresh token não implementado (opcional para v3.0)

// Hierarquia de permissões:
Admin > Colaborador > Distribuidor
```

### **2. Proteção de Senhas**

```javascript
const bcrypt = require('bcryptjs');

// Hash na criação
const senhaHash = await bcrypt.hash(senha, 10);

// Verificação no login
const senhaValida = await bcrypt.compare(senha, senhaHash);
```

### **3. Sanitização XSS**

```javascript
// middleware/sanitize.js
const xss = require('xss');

function sanitizeInput(req, res, next) {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key]);
            }
        });
    }
    next();
}
```

### **4. Rate Limiting**

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requisições por IP
    message: 'Muitas requisições, tente novamente mais tarde'
});

app.use('/api/', limiter);
```

### **5. Helmet - Headers HTTP**

```javascript
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
```

### **6. CORS Configurado**

```javascript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
```

### **7. Validação de Inputs**

```javascript
const validator = require('validator');

// Exemplo: validar email
if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Email inválido' });
}

// Exemplo: validar CPF
if (!/^\d{11}$/.test(cpf)) {
    return res.status(400).json({ error: 'CPF inválido' });
}
```

---

## 🔄 Fluxo de Requisições

### **Fluxo Completo de uma Requisição:**

```
1. Cliente (Browser)
   ↓
2. HTTPS (Railway) ou HTTP (Local)
   ↓
3. Express.js recebe requisição
   ↓
4. Middlewares Globais (ordem de execução):
   - helmet (segurança HTTP)
   - cors (CORS)
   - express.json (parse JSON)
   - sanitizeInput (XSS)
   - rateLimiter (limite de requisições)
   ↓
5. Router específico (/api/admin, /api/colaborador, etc.)
   ↓
6. Middlewares de Rota:
   - verifyToken (valida JWT)
   - verifyAdmin/verifyColaborador/verifyDistribuidor
   ↓
7. Controller (função da rota)
   - Validação de inputs específicos
   - Lógica de negócio
   - Query no banco de dados
   - Log de auditoria (se necessário)
   - Webhook (se necessário)
   - Cache (se aplicável)
   ↓
8. Response JSON
   ↓
9. Error Handler (se houver erro)
   - Captura erro
   - Log no Winston
   - Response com status code apropriado
   ↓
10. Cliente recebe resposta
```

### **Exemplo Prático - Login de Colaborador:**

```javascript
// 1. Cliente envia POST /api/auth/login/colaborador
fetch('/api/auth/login/colaborador', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: '12345678900', senha: '123456' })
});

// 2. Server recebe em routes/auth.js
router.post('/login/colaborador', async (req, res) => {
    try {
        // 3. Sanitização XSS já aplicada pelo middleware
        const { cpf, senha } = req.body;

        // 4. Validação
        if (!cpf || !senha) {
            return res.status(400).json({ error: 'CPF e senha obrigatórios' });
        }

        // 5. Busca no banco
        const colaborador = await db.getQuery(
            'SELECT * FROM colaboradores WHERE cpf = ? AND status = "ativo"',
            [cpf]
        );

        if (!colaborador) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // 6. Verifica senha
        const senhaValida = await bcrypt.compare(senha, colaborador.senha_hash);

        if (!senhaValida) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // 7. Gera token JWT
        const token = jwt.sign(
            {
                userId: colaborador.id,
                cpf: colaborador.cpf,
                nome: colaborador.nome,
                tipo: 'colaborador'
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 8. Log de auditoria
        await logAudit({
            usuario_id: colaborador.id,
            tipo_usuario: 'colaborador',
            acao: 'LOGIN',
            detalhes: JSON.stringify({ cpf }),
            ip: req.ip
        });

        // 9. Responde
        res.json({
            success: true,
            token,
            primeiroAcesso: colaborador.primeiro_acesso,
            nome: colaborador.nome
        });

    } catch (error) {
        // 10. Error handler
        logger.error('Erro no login de colaborador', { error: error.message });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
```

---

## ⚙️ Configuração e Deploy

### **1. Variáveis de Ambiente (.env)**

```bash
# Servidor
PORT=3000
NODE_ENV=development # ou production

# Segurança
JWT_SECRET=sua_chave_secreta_super_segura_256bits

# Admin Master (primeiro acesso)
ADMIN_MASTER_EMAIL=admin@empresa.com.br
ADMIN_MASTER_PASSWORD=senha_inicial_123

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://seudominio.com

# Email SMTP (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASSWORD=sua_senha_app
SMTP_FROM=noreply@empresa.com.br

# Webhooks (opcional)
WEBHOOK_VALE_GERADO=https://n8n.io/webhook/vale-gerado
WEBHOOK_VALE_VALIDADO=https://n8n.io/webhook/vale-validado
WEBHOOK_AVALIACAO_CRIADA=https://n8n.io/webhook/avaliacao

# Banco de dados
DATABASE_URL=./data/database.sqlite # Local
# DATABASE_URL=postgresql://user:pass@host:5432/db # Railway

# Cache
CACHE_TTL=600 # 10 minutos

# Logs
LOG_LEVEL=info # debug, info, warn, error
```

### **2. Deploy Local (Mac/Windows/Linux)**

```bash
# 1. Clonar repositório
git clone <repo>
cd vale-gas-system

# 2. Instalar dependências
npm install

# 3. Configurar .env
cp .env.local .env
# Editar .env com suas credenciais

# 4. Criar diretórios necessários
mkdir -p data logs backups

# 5. Iniciar servidor
npm start          # Produção
# ou
npm run dev        # Desenvolvimento

# 6. Acessar
# http://localhost:3000
```

### **3. Deploy Railway**

```bash
# 1. Criar conta Railway
# https://railway.app/

# 2. Criar novo projeto
# New Project > Deploy from GitHub repo

# 3. Adicionar PostgreSQL (opcional)
# Add Plugin > PostgreSQL

# 4. Configurar variáveis de ambiente
# Settings > Variables > Adicionar todas as variáveis do .env.railway

# 5. Configurar volume persistente (SQLite)
# Settings > Volumes > Add Volume
# Mount Path: /data

# 6. Deploy automático
# Git push para main → Railway faz deploy automaticamente

# 7. Verificar logs
# Railway Dashboard > Deployments > View Logs

# 8. Configurar domínio customizado (opcional)
# Settings > Domains > Add Custom Domain
```

### **4. Scripts Úteis**

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development node server.js",
    "prod": "NODE_ENV=production node server.js",
    "backup": "bash scripts/backup.sh",
    "pdf": "node scripts/gerar-pdf-manual.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{js,json,md}\"",
    "test": "echo \"Testes não configurados\" && exit 1"
  }
}
```

---

## 🚀 Replicação para Novos Projetos

### **Passo a Passo para Replicar a Arquitetura:**

#### **1. Estrutura Básica**

```bash
# Criar projeto
mkdir meu-projeto
cd meu-projeto
npm init -y

# Criar diretórios
mkdir -p config middlewares routes public logs data scripts assets backups

# Arquivos raiz
touch server.js auth.js database.js utils.js webhooks.js auditoria.js
touch .env .env.local .gitignore README.md

# Configurações
touch .eslintrc.json .prettierrc.json railway.json
```

#### **2. Instalar Dependências**

```bash
# Produção
npm install express cors dotenv helmet express-rate-limit
npm install jsonwebtoken bcryptjs validator xss
npm install sqlite3 winston node-cache node-cron axios

# Desenvolvimento
npm install --save-dev eslint prettier markdown-it puppeteer
```

#### **3. Copiar Arquivos Base**

Copie do Vale-Gás v2.0:

- `server.js` (adaptar rotas)
- `auth.js` (manter igual)
- `database.js` (adaptar schema)
- `config/logger.js` (manter igual)
- `config/cache.js` (manter igual)
- `middlewares/errorHandler.js` (manter igual)
- `middlewares/sanitize.js` (manter igual)
- `auditoria.js` (manter igual)
- `webhooks.js` (adaptar eventos)
- `.eslintrc.json` (manter igual)
- `.prettierrc.json` (manter igual)
- `.gitignore` (manter igual)

#### **4. Adaptar Schema do Banco**

```javascript
// database.js - adaptar para seu domínio
async function initializeDatabase() {
    await runQuery(`
        CREATE TABLE IF NOT EXISTS sua_tabela_principal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campo1 TEXT NOT NULL,
            campo2 TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Criar índices
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_campo1 ON sua_tabela_principal(campo1)`);
}
```

#### **5. Criar Rotas**

```javascript
// routes/seu-recurso.js
const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../auth');
const db = require('../database');
const { logAudit } = require('../auditoria');

// Listar
router.get('/', verifyToken, async (req, res) => {
    try {
        const items = await db.allQuery('SELECT * FROM sua_tabela_principal');
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { campo1, campo2 } = req.body;

        // Validar
        if (!campo1) {
            return res.status(400).json({ error: 'Campo1 é obrigatório' });
        }

        // Inserir
        await db.runQuery(
            'INSERT INTO sua_tabela_principal (campo1, campo2) VALUES (?, ?)',
            [campo1, campo2]
        );

        // Log de auditoria
        await logAudit({
            usuario_id: req.user.userId,
            tipo_usuario: req.user.tipo,
            acao: 'CREATE_RECURSO',
            detalhes: JSON.stringify({ campo1 }),
            ip: req.ip
        });

        res.json({ success: true, message: 'Criado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
    // Implementar...
});

// Deletar
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
    // Implementar...
});

module.exports = router;
```

#### **6. Criar Frontend**

```html
<!-- public/dashboard.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #f5f5f5; }

        /* Navbar */
        .navbar {
            background: #1e3a8a;
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* Container */
        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 1rem;
        }

        /* Cards */
        .card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 1.5rem;
            margin-bottom: 1rem;
        }

        /* Tabelas */
        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        th {
            background: #1e3a8a;
            color: white;
        }

        /* Botões */
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }

        .btn-primary {
            background: #1e3a8a;
            color: white;
        }

        .btn-primary:hover {
            background: #3b82f6;
        }
    </style>
</head>
<body>
    <div class="navbar">
        <h1>Meu Sistema</h1>
        <button onclick="logout()" class="btn btn-primary">Sair</button>
    </div>

    <div class="container">
        <div class="card">
            <h2>Recursos</h2>
            <button onclick="criar()" class="btn btn-primary">+ Novo</button>
            <table id="tabela">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Campo 1</th>
                        <th>Campo 2</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="tbody"></tbody>
            </table>
        </div>
    </div>

    <script>
        const token = localStorage.getItem('token');
        if (!token) window.location.href = '/login.html';

        async function carregarDados() {
            const response = await fetch('/api/recursos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                renderTabela(result.data);
            }
        }

        function renderTabela(data) {
            const tbody = document.getElementById('tbody');
            tbody.innerHTML = data.map(item => `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.campo1}</td>
                    <td>${item.campo2 || '-'}</td>
                    <td>
                        <button onclick="editar(${item.id})" class="btn btn-primary">Editar</button>
                        <button onclick="deletar(${item.id})" class="btn btn-danger">Excluir</button>
                    </td>
                </tr>
            `).join('');
        }

        function logout() {
            localStorage.removeItem('token');
            window.location.href = '/';
        }

        document.addEventListener('DOMContentLoaded', carregarDados);
    </script>
</body>
</html>
```

#### **7. Configurar .env**

```bash
# .env
PORT=3000
NODE_ENV=development
JWT_SECRET=sua_chave_secreta_aqui_256bits_minimo
ADMIN_MASTER_EMAIL=admin@empresa.com
ADMIN_MASTER_PASSWORD=senha123
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info
CACHE_TTL=600
```

#### **8. Configurar Railway (railway.json)**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### **9. Testar Localmente**

```bash
npm start
# Abrir http://localhost:3000
```

#### **10. Deploy Railway**

```bash
# Inicializar Git
git init
git add .
git commit -m "Initial commit"

# Criar repositório no GitHub
# https://github.com/new

# Push
git remote add origin git@github.com:usuario/repo.git
git push -u origin main

# Deploy no Railway
# 1. Login Railway
# 2. New Project > Deploy from GitHub
# 3. Selecionar repositório
# 4. Configurar variáveis de ambiente
# 5. Adicionar volume em /data
# 6. Deploy automático
```

---

## 📊 Checklist de Replicação

### **Arquitetura Backend:**
- [ ] Estrutura de diretórios criada
- [ ] Dependências instaladas
- [ ] `server.js` configurado
- [ ] Middlewares de segurança aplicados
- [ ] Sistema de autenticação JWT implementado
- [ ] Banco de dados inicializado
- [ ] Rotas CRUD criadas
- [ ] Sistema de auditoria configurado
- [ ] Sistema de logs Winston configurado
- [ ] Cache em memória implementado
- [ ] Error handler global configurado
- [ ] Webhooks configurados (opcional)

### **Arquitetura Frontend:**
- [ ] Páginas HTML criadas
- [ ] Sistema de autenticação (localStorage + JWT)
- [ ] Fetch API para requisições
- [ ] Validação de formulários
- [ ] Feedback visual (alerts, loaders)
- [ ] Responsividade mobile
- [ ] Paleta de cores definida

### **Segurança:**
- [ ] Helmet configurado
- [ ] CORS configurado
- [ ] Rate limiting ativo
- [ ] Sanitização XSS
- [ ] Validação de inputs
- [ ] Hash de senhas (bcrypt)
- [ ] JWT com expiração

### **Deploy:**
- [ ] `.env` configurado
- [ ] `.gitignore` atualizado
- [ ] `railway.json` configurado
- [ ] Variáveis de ambiente no Railway
- [ ] Volume persistente configurado
- [ ] Health check funcionando
- [ ] Logs sendo gerados
- [ ] Backups automáticos (opcional)

---

## 🎓 Conceitos-Chave da Arquitetura

1. **Separation of Concerns**: Cada arquivo tem uma responsabilidade única
2. **DRY (Don't Repeat Yourself)**: Funções utilitárias reutilizáveis
3. **Security First**: Múltiplas camadas de segurança
4. **Scalability**: Cache, índices de banco, rate limiting
5. **Observability**: Logs estruturados, auditoria completa
6. **Simplicity**: Vanilla JS no frontend, sem over-engineering
7. **Production Ready**: Error handling, validações, health checks

---

## 📚 Recursos Adicionais

- **Documentação Express.js**: https://expressjs.com/
- **JWT.io**: https://jwt.io/
- **Railway Docs**: https://docs.railway.app/
- **Winston Docs**: https://github.com/winstonjs/winston
- **Helmet Docs**: https://helmetjs.github.io/

---

**Versão do Sistema**: 2.0.0
**Última Atualização**: Janeiro 2026
**Autor**: Desenvolvido para Consigaz
**Licença**: Proprietário

---

## 💡 Dicas Finais

1. **Sempre valide inputs**: Nunca confie em dados do cliente
2. **Use prepared statements**: Evita SQL injection
3. **Logs são seus amigos**: Winston salva vidas em produção
4. **Cache estrategicamente**: Não cache dados sensíveis
5. **Monitore em produção**: Railway tem dashboards excelentes
6. **Backup religiosamente**: Automatize backups diários
7. **Documente**: README.md atualizado = menos dúvidas
8. **Teste localmente**: Sempre teste antes de commitar
9. **Versionamento semântico**: v1.0.0, v1.1.0, v2.0.0
10. **Code review**: Sempre revise antes de merge

---

**Esta arquitetura foi testada em produção e está pronta para escalar! 🚀**

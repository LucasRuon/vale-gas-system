# 🎯 Sistema Vale-Gás v2.0 - Comece Aqui!

---

## 📋 Você está em: Modo de Escolha

Escolha como você quer usar o sistema:

---

## 1️⃣ RODAR LOCALMENTE (Desenvolvimento no Mac)

**Use quando:**
- Quer testar o sistema no seu computador
- Está desenvolvendo novas funcionalidades
- Quer explorar antes de colocar em produção

**Como fazer:**

```bash
cd /Users/lucasruon/Downloads/vale-gas-system
./start-local.sh
```

📖 **Guia completo**: [INSTALACAO_LOCAL.md](INSTALACAO_LOCAL.md)

---

## 2️⃣ DEPLOY NA RAILWAY (Produção Online)

**Use quando:**
- Quer colocar o sistema online
- Precisa de acesso de qualquer lugar
- Está pronto para usar em produção

**Como fazer:**

📖 **Guia completo**: [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md)

---

## ⚡ Quick Start (Local)

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor
./start-local.sh

# 3. Abrir navegador em:
# http://localhost:3000/api/health
```

**Login padrão:**
- Email: `admin@consigaz.com.br`
- Senha: `Admin123!@#`

---

## 📁 Arquivos de Configuração

Foram criados 3 arquivos de configuração:

| Arquivo | Uso | Git |
|---------|-----|-----|
| `.env.example` | Template geral | ✅ Commitado |
| `.env.local` | Desenvolvimento local | ❌ Ignorado |
| `.env.railway` | Produção Railway | ❌ Ignorado |

**Automático:** Quando você roda `./start-local.sh`, ele copia `.env.local` para `.env`

---

## 🔑 Diferenças: Local vs Railway

### Local (Desenvolvimento)
```bash
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
BASE_URL=http://localhost:3000
DATABASE_PATH=./data/database.sqlite
```

### Railway (Produção)
```bash
PORT=<detectado automaticamente>
NODE_ENV=production
LOG_LEVEL=info
BASE_URL=https://seu-app.up.railway.app
DATABASE_PATH=/data/database.sqlite
RAILWAY_ENVIRONMENT=production <detectado automaticamente>
```

---

## 🗂️ Estrutura do Projeto

```
vale-gas-system/
│
├── 📄 START_HERE.md              ← VOCÊ ESTÁ AQUI
├── 📄 INSTALACAO_LOCAL.md        ← Guia para rodar localmente
├── 📄 DEPLOY_RAILWAY.md          ← Guia para deploy online
├── 📄 MELHORIAS_V2.md            ← Documentação de melhorias
│
├── 🔧 .env.example               ← Template de configuração
├── 🔧 .env.local                 ← Config local (criado automaticamente)
├── 🔧 .env.railway               ← Config Railway (use no painel)
│
├── 🚀 start-local.sh             ← Script para iniciar localmente
├── 🚀 server.js                  ← Servidor principal
│
├── 📁 routes/                    ← Rotas da API
├── 📁 config/                    ← Configurações (cache, logs)
├── 📁 middlewares/               ← Middlewares (auth, sanitize)
├── 📁 scripts/                   ← Scripts utilitários
│
├── 📁 data/ (criado)             ← Banco SQLite local
├── 📁 logs/ (criado)             ← Logs do sistema
└── 📁 node_modules/ (criado)     ← Dependências NPM
```

---

## ✅ Checklist de Instalação

### Local (Mac)
- [ ] Node.js instalado (v18+)
- [ ] `npm install` executado
- [ ] Arquivo `.env` criado
- [ ] Servidor rodando (`./start-local.sh`)
- [ ] Health check OK (http://localhost:3000/api/health)

### Railway (Produção)
- [ ] Conta Railway criada
- [ ] Repositório no GitHub
- [ ] Variáveis de ambiente configuradas
- [ ] Volume `/data` criado
- [ ] Deploy funcionando
- [ ] Health check OK (https://seu-app.up.railway.app/api/health)

---

## 🧪 Testar Sistema

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

### 2. Login Admin
```bash
curl -X POST http://localhost:3000/api/auth/login/admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@consigaz.com.br",
    "senha": "Admin123!@#"
  }'
```

---

## 🆘 Precisa de Ajuda?

### Documentação
- [INSTALACAO_LOCAL.md](INSTALACAO_LOCAL.md) - Rodar localmente
- [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md) - Deploy em produção
- [MELHORIAS_V2.md](MELHORIAS_V2.md) - Recursos do sistema
- [README.md](README.md) - Documentação geral

### Problemas Comuns
- Porta em uso → Mude `PORT` no `.env`
- Módulo não encontrado → Execute `npm install`
- Permissão negada → Execute `chmod +x start-local.sh`
- Banco corrompido → Remova `data/` e reinicie

---

## 🚀 Fluxo Recomendado

1. **Teste Local** (Mac) → `./start-local.sh`
2. **Desenvolva** → Faça modificações
3. **Teste Tudo** → Garanta que funciona
4. **Commit no Git** → Salve as mudanças
5. **Deploy Railway** → Coloque online
6. **Configure Variáveis** → Use `.env.railway` como referência
7. **Teste Produção** → Verifique se está OK

---

## 📞 Próximos Passos

### Agora (Local)
1. Execute: `./start-local.sh`
2. Acesse: http://localhost:3000/api/health
3. Faça login: admin@consigaz.com.br / Admin123!@#
4. Explore a API

### Depois (Railway)
1. Crie conta na Railway
2. Conecte o GitHub
3. Configure variáveis (use `.env.railway`)
4. Crie volume `/data`
5. Deploy!

---

## ⚠️ IMPORTANTE

### Segurança
- ❌ **NÃO commite** arquivo `.env` no Git
- ✅ **USE senhas fortes** em produção
- ✅ **GERE nova** `JWT_SECRET` para Railway
- ✅ **MUDE senha** do admin master em produção

### Comando para gerar JWT_SECRET forte:
```bash
openssl rand -base64 32
```

---

## 🎉 Tudo Pronto!

Escolha seu caminho:
- 💻 **Local**: `./start-local.sh` → [INSTALACAO_LOCAL.md](INSTALACAO_LOCAL.md)
- 🌐 **Railway**: [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md)

**Boa sorte!** 🚀

# 💻 Instalação Local - Sistema Vale-Gás v2.0

Guia rápido para rodar o sistema no seu Mac (desenvolvimento local).

---

## 🚀 Início Rápido (3 passos)

### Opção 1: Script Automático (Recomendado)

```bash
cd /Users/lucasruon/Downloads/vale-gas-system
./start-local.sh
```

✅ Pronto! O script configura tudo automaticamente.

---

### Opção 2: Manual

#### 1. Instalar Dependências

```bash
cd /Users/lucasruon/Downloads/vale-gas-system
npm install
```

#### 2. Configurar Ambiente

```bash
# Copiar configuração local
cp .env.local .env
```

#### 3. Iniciar Servidor

```bash
npm start
```

---

## 📊 Informações do Sistema Local

Após iniciar, você verá:

```
🚀 Servidor rodando na porta 3000
📡 Ambiente: development
```

**Acessos:**
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **Admin Email**: admin@consigaz.com.br
- **Admin Senha**: Admin123!@#

---

## 🧪 Testar se Está Funcionando

### 1. Health Check (Terminal)

```bash
curl http://localhost:3000/api/health
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "uptime": 5.123,
  "checks": {
    "database": { "status": "ok" },
    "memory": { "status": "ok" },
    "cache": { "status": "ok" }
  }
}
```

### 2. Login Admin (Terminal)

```bash
curl -X POST http://localhost:3000/api/auth/login/admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@consigaz.com.br",
    "senha": "Admin123!@#"
  }'
```

**Resposta esperada:**
```json
{
  "sucesso": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "nome": "Administrador Local",
    "email": "admin@consigaz.com.br",
    "tipo": "admin"
  }
}
```

### 3. Abrir no Navegador

Abra: http://localhost:3000/api/health

---

## 📁 Estrutura de Arquivos Locais

Após rodar, você terá:

```
vale-gas-system/
├── data/                      # Banco de dados local
│   ├── database.sqlite        # SQLite (criado automaticamente)
│   └── backups/               # Backups automáticos
├── logs/                      # Logs do sistema
│   ├── combined.log           # Todos os logs
│   ├── error.log              # Apenas erros
│   ├── exceptions.log         # Exceções
│   └── rejections.log         # Promise rejections
├── .env                       # Configuração local (CRIADO)
└── node_modules/              # Dependências (CRIADO)
```

---

## ⚙️ Configurações Locais

Arquivo: `.env` (já configurado automaticamente)

```bash
# Principais configurações locais
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Admin padrão
ADMIN_MASTER_EMAIL=admin@consigaz.com.br
ADMIN_MASTER_SENHA=Admin123!@#

# URLs locais
ALLOWED_ORIGINS=http://localhost:3000
BASE_URL=http://localhost:3000
```

**Você pode editar `.env` se precisar mudar algo!**

---

## 🔍 Ver Logs em Tempo Real

```bash
# Ver todos os logs
tail -f logs/combined.log

# Ver apenas erros
tail -f logs/error.log
```

---

## 🛑 Parar o Servidor

Pressione `Ctrl + C` no terminal onde o servidor está rodando.

---

## 🔄 Reiniciar do Zero

Se algo der errado, limpe tudo:

```bash
# Parar servidor (Ctrl+C)

# Remover banco e logs
rm -rf data/ logs/

# Remover dependências
rm -rf node_modules/

# Reinstalar
npm install

# Iniciar novamente
./start-local.sh
```

---

## 🐛 Problemas Comuns

### Erro: "Cannot find module"

```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Port 3000 already in use"

```bash
# Descobrir o que está usando a porta
lsof -ti:3000

# Matar o processo
kill -9 $(lsof -ti:3000)

# OU mudar a porta no .env
# Edite .env e mude PORT=3001
```

### Erro: "EACCES permission denied"

```bash
sudo chown -R $USER:$USER /Users/lucasruon/Downloads/vale-gas-system
chmod +x start-local.sh
chmod +x scripts/backup.sh
```

### Banco de dados corrompido

```bash
# Remover banco e criar novo
rm -rf data/
npm start
```

---

## 📝 Scripts Disponíveis

```bash
# Iniciar servidor
npm start

# Fazer backup manual
npm run backup

# Ver versão
node -v
npm -v
```

---

## 🚀 Próximos Passos

Após rodar localmente:

1. **Testar endpoints** - Use Postman ou Insomnia
2. **Criar colaboradores** - Via API ou interface
3. **Gerar vales** - Testar geração de códigos
4. **Deploy na Railway** - Quando estiver tudo OK

---

## 🔐 Segurança Local

⚠️ **IMPORTANTE:**
- A senha `Admin123!@#` é APENAS para desenvolvimento local
- O arquivo `.env` NÃO deve ser commitado no Git
- Quando fizer deploy na Railway, use senhas fortes!

---

## 📞 Desenvolvimento

### Modificar código e ver mudanças automaticamente

Instale `nodemon`:

```bash
npm install -g nodemon
nodemon server.js
```

Agora qualquer mudança no código reinicia o servidor automaticamente!

---

## ✅ Checklist Rápido

- [ ] Node.js instalado (v18+)
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` criado
- [ ] Servidor rodando (`npm start`)
- [ ] Health check OK (http://localhost:3000/api/health)
- [ ] Login admin funcionando

---

**Tudo funcionando?** 🎉

Agora você pode desenvolver localmente e depois fazer deploy na Railway quando estiver pronto!

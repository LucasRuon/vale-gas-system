# 🚂 Deploy do Sistema Vale-Gás na Railway

Guia completo passo-a-passo para fazer deploy do Sistema Vale-Gás v2.0 na plataforma Railway.

---

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Preparação do Projeto](#preparação-do-projeto)
3. [Deploy na Railway](#deploy-na-railway)
4. [Configuração de Volumes](#configuração-de-volumes)
5. [Variáveis de Ambiente](#variáveis-de-ambiente)
6. [Domínio Customizado (Opcional)](#domínio-customizado)
7. [Monitoramento](#monitoramento)
8. [Troubleshooting](#troubleshooting)

---

## ✅ Pré-requisitos

Antes de começar, você precisa de:

- [x] Conta na Railway ([railway.app](https://railway.app))
- [x] Conta GitHub (para conectar o código)
- [x] Código do Sistema Vale-Gás v2.0
- [x] Cartão de crédito (Railway oferece $5/mês grátis, mas pede cartão)

**Custo estimado:** $5-10/mês (depende do uso)

---

## 📦 Preparação do Projeto

### Passo 1: Criar Repositório no GitHub

```bash
# 1. Inicializar git (se ainda não fez)
cd vale-gas-system
git init

# 2. Criar .gitignore
cat > .gitignore << 'EOF'
node_modules/
logs/
data/
*.log
.env
.DS_Store
EOF

# 3. Fazer primeiro commit
git add .
git commit -m "Sistema Vale-Gás v2.0 - pronto para Railway"

# 4. Criar repositório no GitHub e fazer push
# Vá em github.com/new e crie um repositório
git remote add origin https://github.com/SEU_USUARIO/vale-gas-system.git
git branch -M main
git push -u origin main
```

---

## 🚀 Deploy na Railway

### Passo 2: Criar Projeto na Railway

1. **Acesse:** [railway.app](https://railway.app)
2. **Clique em:** "Start a New Project"
3. **Selecione:** "Deploy from GitHub repo"
4. **Autorize:** Railway a acessar seu GitHub
5. **Selecione:** O repositório `vale-gas-system`
6. **Aguarde:** Railway vai detectar automaticamente que é Node.js

### Passo 3: Configurar Build

A Railway detecta automaticamente o `railway.json` e usa as configurações:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health"
  }
}
```

**Não precisa configurar nada manualmente!** ✅

---

## 💾 Configuração de Volumes (IMPORTANTE!)

O SQLite precisa de um volume persistente para não perder dados ao reiniciar.

### Passo 4: Criar Volume Persistente

1. **No painel do projeto Railway:**
   - Clique na aba **"Settings"**
   - Role até **"Volumes"**
   - Clique em **"+ New Volume"**

2. **Configurar volume:**
   ```
   Mount Path: /data
   ```

3. **Clique em:** "Add Volume"

4. **Redeploy:** Railway vai reiniciar automaticamente

**Estrutura no volume:**
```
/data/
  ├── database.sqlite    # Banco de dados persistente
  └── backups/           # Backups automáticos
      └── database_YYYYMMDD_HHMMSS.sqlite
```

---

## ⚙️ Variáveis de Ambiente

### Passo 5: Configurar Variáveis

1. **No painel Railway:**
   - Clique na aba **"Variables"**
   - Adicione as variáveis abaixo

### Variáveis OBRIGATÓRIAS:

```bash
# Segurança (GERE CHAVES FORTES!)
JWT_SECRET=USE_OPENSSL_RAND_BASE64_32_AQUI
ADMIN_MASTER_SENHA=SenhaForte123!@#

# Ambiente
NODE_ENV=production
LOG_LEVEL=info

# CORS (use o domínio da Railway)
ALLOWED_ORIGINS=https://seu-app-production.up.railway.app

# URL Base (use o domínio da Railway)
BASE_URL=https://seu-app-production.up.railway.app
```

### Gerar JWT_SECRET forte:

```bash
# No seu terminal local:
openssl rand -base64 32

# Copie o resultado e cole em JWT_SECRET na Railway
```

### Variáveis OPCIONAIS:

```bash
# Admin Master (personalize se quiser)
ADMIN_MASTER_EMAIL=admin@suaempresa.com.br
ADMIN_MASTER_NOME=Administrador

# Chave de API Cron
CRON_API_KEY=gere_uma_chave_segura_aqui

# Webhooks N8N (configure depois se quiser)
WEBHOOK_CODIGO_GERADO=
WEBHOOK_LEMBRETE_EXPIRACAO=
WEBHOOK_VALE_RETIRADO=
```

### Passo 6: Obter URL da Railway

Após o deploy, a Railway gera uma URL automática:

```
https://seu-app-production.up.railway.app
```

**Copie essa URL** e atualize as variáveis:
- `ALLOWED_ORIGINS`
- `BASE_URL`

Depois clique em **"Redeploy"** para aplicar as mudanças.

---

## 🌐 Domínio Customizado (Opcional)

Se você tem um domínio próprio (ex: `valegaz.suaempresa.com.br`):

### Passo 7: Configurar Domínio

1. **Na Railway:**
   - Aba **"Settings"**
   - Seção **"Domains"**
   - Clique **"+ Custom Domain"**
   - Digite: `valegaz.suaempresa.com.br`

2. **No seu provedor de domínio (Registro.br, GoDaddy, etc):**
   - Adicione registro **CNAME**:
   ```
   Nome: valegaz
   Tipo: CNAME
   Valor: seu-app-production.up.railway.app
   ```

3. **Aguarde propagação DNS** (5-60 minutos)

4. **Atualize variáveis de ambiente:**
   ```bash
   ALLOWED_ORIGINS=https://valegaz.suaempresa.com.br
   BASE_URL=https://valegaz.suaempresa.com.br
   ```

5. **Redeploy** na Railway

---

## 📊 Monitoramento

### Passo 8: Verificar Saúde do Sistema

```bash
# 1. Testar Health Check
curl https://seu-app-production.up.railway.app/api/health

# Resposta esperada:
{
  "status": "healthy",
  "uptime": 1234,
  "checks": {
    "database": { "status": "ok" },
    "memory": { "status": "ok" },
    "cache": { "status": "ok" }
  }
}

# 2. Acessar o sistema
# Abra no navegador:
https://seu-app-production.up.railway.app

# 3. Fazer login
Email: admin@consigaz.com.br (ou o que você configurou)
Senha: A que você configurou em ADMIN_MASTER_SENHA
```

### Verificar Logs na Railway

1. **No painel Railway:**
   - Aba **"Deployments"**
   - Clique no deployment atual
   - Veja os logs em tempo real

2. **Logs estruturados:**
   - Sistema salva logs em `logs/combined.log`
   - Pode ver pelo **Railway CLI** (opcional)

---

## 🔍 Monitoramento Externo (Recomendado)

### Configurar UptimeRobot (Grátis)

1. **Acesse:** [uptimerobot.com](https://uptimerobot.com)
2. **Criar monitor:**
   ```
   Tipo: HTTP(s)
   URL: https://seu-app-production.up.railway.app/api/health
   Intervalo: 5 minutos
   Alerta: Email se down
   ```

3. **Configurar alertas:**
   - Email quando sistema cair
   - Email quando voltar

---

## 🐛 Troubleshooting

### Problema: Deploy falhou

**Solução:**
```bash
# Ver logs do build na Railway
# Aba "Deployments" > Ver logs

# Problemas comuns:
# 1. package.json mal formatado → verificar JSON
# 2. Dependências faltando → rodar npm install local
# 3. Node version incompatível → Railway usa Node 18+
```

### Problema: Banco de dados vazio após restart

**Causa:** Volume não configurado

**Solução:**
1. Ir em Settings > Volumes
2. Criar volume em `/data`
3. Redeploy

### Problema: CORS bloqueando requisições

**Causa:** `ALLOWED_ORIGINS` incorreto

**Solução:**
```bash
# 1. Copie a URL exata da Railway (com https://)
# 2. Cole em ALLOWED_ORIGINS (sem barra final)
# 3. Redeploy

# Correto:
ALLOWED_ORIGINS=https://seu-app-production.up.railway.app

# Errado:
ALLOWED_ORIGINS=http://seu-app-production.up.railway.app/  # sem / final
```

### Problema: Admin não consegue logar

**Solução:**
```bash
# 1. Verificar variáveis:
ADMIN_MASTER_EMAIL=admin@consigaz.com.br
ADMIN_MASTER_SENHA=SuaSenhaAqui

# 2. Ver logs para verificar se admin foi criado
# Logs devem mostrar: "Usuário admin master criado"

# 3. Tentar resetar banco (se necessário)
# Deletar volume e criar novo (PERDERÁ DADOS!)
```

### Problema: Rate limit muito agressivo

**Solução:**
```bash
# Aumentar limites em server.js (se necessário)
# E fazer redeploy

# Ou configurar via variáveis (futuro)
RATE_LIMIT_API=200
RATE_LIMIT_LOGIN=10
```

### Problema: Backup não está funcionando

**Solução:**
```bash
# 1. Verificar se volume /data existe
# 2. Verificar logs: tail logs/combined.log
# 3. Testar backup manual via Railway CLI ou SSH

# O backup roda automaticamente às 2h da manhã
# Verifica em: /data/backups/
```

---

## 📈 Custos Estimados Railway

### Plano Hobby ($5/mês grátis)

```
Incluído no plano:
- 512MB RAM
- 1GB Disco
- 100GB Bandwidth
- Execução contínua

Custo extra apenas se exceder:
- RAM adicional: ~$10/GB/mês
- Disco adicional: ~$0.25/GB/mês
- Bandwidth: ~$0.10/GB
```

### Sistema Vale-Gás (estimativa)

```
Uso típico:
- RAM: ~200MB (dentro do grátis)
- Disco: ~500MB com backups (dentro do grátis)
- Bandwidth: ~10GB/mês (dentro do grátis)

CUSTO TOTAL: $0-5/mês ✅
```

---

## ✅ Checklist Pós-Deploy

Após fazer deploy, verifique:

- [ ] Health check retorna `{"status":"healthy"}`
- [ ] Consegue acessar interface web
- [ ] Admin consegue fazer login
- [ ] Pode criar colaborador teste
- [ ] Pode criar distribuidor teste
- [ ] Logs estão sendo salvos
- [ ] Backup automático configurado (verificar após 24h)
- [ ] UptimeRobot configurado (opcional)
- [ ] Domínio customizado funcionando (se configurou)
- [ ] Webhooks funcionando (se configurou)

---

## 🎯 Próximos Passos

1. **Importar colaboradores**
   - Painel Admin > Colaboradores > Importar CSV

2. **Cadastrar distribuidores**
   - Painel Admin > Distribuidores > Novo

3. **Configurar webhooks N8N** (opcional)
   - Criar workflows no N8N
   - Copiar URLs dos webhooks
   - Adicionar nas variáveis de ambiente

4. **Gerar primeiro lote de vales**
   - Painel Admin > Vales > Gerar Códigos

5. **Monitorar sistema**
   - Verificar `/api/health` diariamente
   - Checar logs em caso de problemas
   - Verificar backups semanalmente

---

## 📞 Suporte

### Problemas com Railway:
- Docs: [docs.railway.app](https://docs.railway.app)
- Discord: [discord.gg/railway](https://discord.gg/railway)

### Problemas com o Sistema:
1. Ver logs em Railway: Deployments > Logs
2. Verificar health: `curl URL/api/health`
3. Consultar documentação: `README.md` e `MELHORIAS_V2.md`

---

## 🎉 Conclusão

Seu Sistema Vale-Gás v2.0 agora está rodando na Railway com:

✅ **Deploy automático** via GitHub
✅ **Banco SQLite persistente** em volume
✅ **Backups automáticos** diários
✅ **HTTPS gratuito** da Railway
✅ **Health check** para monitoramento
✅ **Logs estruturados** com Winston
✅ **Segurança robusta** (Helmet, CORS, Rate Limiting)

**Status:** ✅ Pronto para uso em produção!

---

**Última atualização:** Dezembro 2025
**Versão do Sistema:** 2.0.0
**Plataforma:** Railway

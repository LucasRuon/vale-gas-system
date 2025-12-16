# 🚀 Quick Start - Deploy Railway (5 minutos)

Guia rápido para fazer deploy do Sistema Vale-Gás na Railway.

---

## 📋 Checklist Pré-Deploy

- [ ] Conta na Railway ([railway.app](https://railway.app))
- [ ] Conta GitHub
- [ ] Cartão de crédito (para Railway)

---

## 🎯 Deploy em 8 Passos

### 1. Criar Repositório GitHub

```bash
cd vale-gas-system
git init
git add .
git commit -m "Sistema Vale-Gás v2.0"
```

No GitHub: Criar repositório `vale-gas-system` e fazer push.

### 2. Deploy na Railway

1. Ir em [railway.app](https://railway.app/new)
2. Clicar "Deploy from GitHub repo"
3. Selecionar `vale-gas-system`
4. Aguardar build (~2 minutos)

### 3. Criar Volume Persistente

1. Settings > Volumes > "+ New Volume"
2. Mount Path: `/data`
3. Add Volume

### 4. Configurar Variáveis (Essenciais)

```bash
# Gerar JWT_SECRET forte:
openssl rand -base64 32

# Adicionar na Railway (aba Variables):
JWT_SECRET=cole_o_resultado_aqui
ADMIN_MASTER_SENHA=SuaSenhaForte123!
NODE_ENV=production
```

### 5. Copiar URL da Railway

Copie a URL gerada (ex: `https://vale-gas-production.up.railway.app`)

### 6. Configurar CORS

Adicione mais variáveis:

```bash
ALLOWED_ORIGINS=https://vale-gas-production.up.railway.app
BASE_URL=https://vale-gas-production.up.railway.app
```

### 7. Redeploy

Click em "Redeploy" para aplicar mudanças.

### 8. Testar

```bash
# Health Check
curl https://sua-url.railway.app/api/health

# Acessar no navegador
https://sua-url.railway.app

# Login padrão:
Email: admin@consigaz.com.br
Senha: A que você configurou em ADMIN_MASTER_SENHA
```

---

## ✅ Pronto!

Seu sistema está no ar em: `https://sua-url.railway.app`

**Custo:** $0-5/mês (Railway oferece $5 grátis)

---

## 📚 Documentação Completa

Para mais detalhes, ver: **[DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md)**

- Domínio customizado
- Troubleshooting
- Monitoramento
- Webhooks N8N

---

## 🆘 Problemas?

**Deploy falhou:**
- Ver logs em Railway > Deployments

**CORS bloqueado:**
- Verificar `ALLOWED_ORIGINS` (sem barra final, com https://)

**Admin não loga:**
- Verificar `ADMIN_MASTER_EMAIL` e `ADMIN_MASTER_SENHA`

**Banco vazio após restart:**
- Criar volume em `/data` (passo 3)

---

## 📞 Suporte

- **Railway:** [docs.railway.app](https://docs.railway.app)
- **Sistema:** Ver [README.md](README.md) e [MELHORIAS_V2.md](MELHORIAS_V2.md)

---

**Versão:** 2.0.0
**Atualizado:** Dezembro 2025

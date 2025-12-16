# 🔧 Troubleshooting - Problemas Comuns

Soluções para problemas frequentes do Sistema Vale-Gás v2.0.

---

## 🚨 Erros de Content Security Policy (CSP)

### **Erro: "Executing inline event handler violates CSP directive 'script-src-attr'"**

**Sintoma:**
```
admin.html:1 Executing inline event handler violates the following
Content Security Policy directive 'script-src-attr 'none''.
The action has been blocked.
```

**Causa:**
O Helmet (middleware de segurança) está bloqueando event handlers inline como:
- `<button onclick="minhaFuncao()">`
- `<body onload="init()">`
- `<img onerror="tratarErro()">`

**Solução Aplicada:**
O sistema agora diferencia ambiente de desenvolvimento e produção:

- **Desenvolvimento** (`NODE_ENV=development`):
  - ✅ Permite `onclick`, `onload`, etc.
  - Mais fácil para desenvolver e testar

- **Produção** (`NODE_ENV=production`):
  - ❌ Bloqueia inline handlers
  - Mais seguro contra XSS

**Arquivo:** `server.js:39`
```javascript
scriptSrcAttr: isDevelopment ? ["'unsafe-inline'"] : null
```

**Como Resolver em Produção (Recomendado):**

Se você tiver esse erro em produção, **NÃO libere inline handlers**. Em vez disso, refatore o código HTML:

**❌ Errado (Inline):**
```html
<button onclick="salvar()">Salvar</button>
```

**✅ Correto (Event Listener):**
```html
<button id="btnSalvar">Salvar</button>

<script>
document.getElementById('btnSalvar').addEventListener('click', function() {
    salvar();
});
</script>
```

---

## 🔌 Erros de Porta

### **Erro: "Port 3000 already in use"**

**Causa:**
Outra aplicação está usando a porta 3000.

**Solução 1: Parar o processo na porta**
```bash
# Descobrir PID
lsof -ti:3000

# Matar processo
kill -9 $(lsof -ti:3000)
```

**Solução 2: Mudar a porta**
```bash
# Edite o arquivo .env
PORT=3001

# Reinicie o servidor
npm start
```

---

## 📦 Erros de Dependências

### **Erro: "Cannot find module 'xxx'"**

**Solução:**
```bash
# Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install

# Reiniciar
npm start
```

---

## 🗄️ Erros de Banco de Dados

### **Erro: "SQLITE_CORRUPT: database disk image is malformed"**

**Causa:**
Banco de dados SQLite corrompido.

**Solução:**
```bash
# Parar servidor (Ctrl+C)

# Fazer backup do banco corrompido (por garantia)
cp data/database.sqlite data/database.sqlite.backup

# Remover banco corrompido
rm -rf data/

# Reiniciar servidor (cria banco novo)
npm start
```

**⚠️ ATENÇÃO:** Isso apaga todos os dados!

---

## 🔐 Erros de Autenticação

### **Erro: "jwt malformed" ou "invalid token"**

**Causa:**
Token JWT inválido ou expirado.

**Solução Cliente:**
- Fazer logout e login novamente
- Limpar localStorage do navegador
- Gerar novo token

**Solução Servidor:**
```bash
# Verificar se JWT_SECRET está configurado
grep JWT_SECRET .env

# Se vazio, adicione:
JWT_SECRET=chave_forte_aqui_123
```

---

## 🌐 Erros de CORS

### **Erro: "Não permitido pelo CORS"**

**Sintoma:**
```
Access to fetch at 'http://localhost:3000/api/...' from origin
'http://localhost:8080' has been blocked by CORS policy
```

**Causa:**
A origem do frontend não está na lista de origens permitidas.

**Solução:**
```bash
# Edite .env e adicione a origem do frontend
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000

# Reinicie o servidor
npm start
```

**Alternativa (apenas desenvolvimento):**
```bash
# .env
NODE_ENV=development  # Libera CORS em dev
```

---

## 💾 Erros de Cache

### **Erro: Dados desatualizados após update**

**Causa:**
Cache não foi invalidado após atualização.

**Solução Manual:**
```bash
# Opção 1: Reiniciar servidor (limpa cache)
# Ctrl+C e npm start

# Opção 2: Aguardar 15 minutos (TTL do cache)

# Opção 3: Implementar cache.flush() em endpoints críticos
```

**Onde o cache é usado:**
- Configurações do sistema (15 min)
- Distribuidores ativos (10 min)
- Stats do dashboard (10 min)

---

## 🔄 Erros de Race Condition

### **Erro: "SQLITE_CONSTRAINT: UNIQUE constraint failed"**

**Causa:**
Tentativa de gerar código duplicado (já corrigido na v2.0).

**Status:**
✅ **Resolvido** - Sistema usa retry com exponential backoff.

Se ainda ocorrer:
```bash
# Verificar logs
tail -f logs/error.log

# Procurar por:
# "Não foi possível gerar código único após 10 tentativas"
```

---

## 📊 Erros de Logs

### **Erro: "EACCES: permission denied, open 'logs/combined.log'"**

**Causa:**
Falta permissão para escrever nos logs.

**Solução:**
```bash
# Dar permissões ao diretório logs
chmod -R 755 logs/

# OU recriar diretório
rm -rf logs/
mkdir logs
```

---

## 🚀 Erros de Deploy Railway

### **Erro: Deploy falhou - "Cannot find module"**

**Solução:**
```bash
# Verificar package.json
# Todas as dependências estão listadas?

# Fazer commit e push novamente
git add .
git commit -m "Fix dependencies"
git push
```

### **Erro: Banco vazio após restart**

**Causa:**
Volume `/data` não configurado.

**Solução:**
1. Railway → Settings → Volumes
2. Criar volume: Mount Path = `/data`
3. Redeploy

---

## 🔍 Como Debugar

### **Ver logs em tempo real:**
```bash
tail -f logs/combined.log
```

### **Ver apenas erros:**
```bash
tail -f logs/error.log
```

### **Buscar erro específico:**
```bash
grep "ERRO_AQUI" logs/combined.log
```

### **Ver últimas 50 linhas:**
```bash
tail -n 50 logs/combined.log
```

### **Testar endpoints:**
```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login/admin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@consigaz.com.br", "senha": "Admin123!@#"}'
```

---

## ⚙️ Configurações Comuns

### **Desativar rate limiting (dev):**

**server.js:**
```javascript
// Comentar linhas de rate limit
// app.use('/api/auth', loginLimiter);
// app.use('/api', apiLimiter);
```

### **Aumentar limite de requests:**

**.env:**
```bash
RATE_LIMIT_API=200      # Padrão: 100
RATE_LIMIT_LOGIN=10     # Padrão: 5
```

### **Mudar nível de log:**

**.env:**
```bash
LOG_LEVEL=debug   # Mais verboso
# OU
LOG_LEVEL=error   # Apenas erros
```

---

## 📞 Quando Tudo Falhar

### **Reset completo (⚠️ APAGA DADOS!):**

```bash
# Parar servidor
# Ctrl+C

# Limpar tudo
rm -rf data/ logs/ node_modules/ .env

# Recriar .env
cp .env.local .env

# Reinstalar
npm install

# Reiniciar
npm start
```

---

## 🆘 Reportar Bug

Se encontrar um bug não listado aqui:

1. Verificar logs: `logs/error.log`
2. Testar health check: `curl http://localhost:3000/api/health`
3. Verificar variáveis: `cat .env`
4. Documentar erro e contexto

---

## ✅ Checklist de Debug

- [ ] Servidor está rodando?
- [ ] Porta correta? (padrão: 3000)
- [ ] Arquivo `.env` existe?
- [ ] `JWT_SECRET` configurado?
- [ ] Dependências instaladas? (`npm install`)
- [ ] Banco de dados criado? (existe `data/database.sqlite`?)
- [ ] Logs mostram erros? (`tail -f logs/error.log`)
- [ ] Health check OK? (`curl localhost:3000/api/health`)

---

**Última atualização:** Dezembro 2025
**Versão do Sistema:** 2.0.0

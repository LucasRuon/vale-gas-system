# 🛡️ Gerenciamento de Rate Limiting

## 📋 O que é Rate Limiting?

Rate Limiting é um mecanismo de segurança que **limita o número de requisições** que um IP pode fazer em um período de tempo, protegendo contra:

- **Ataques de força bruta** (tentativas de descobrir senhas)
- **DoS (Denial of Service)** - sobrecarga do servidor
- **Scraping abusivo** de dados
- **Uso excessivo de recursos**

---

## ⚙️ Configuração Atual

### **1. Rate Limit de Login**

| Ambiente | Tentativas | Janela de Tempo | Mensagem |
|----------|-----------|-----------------|----------|
| **Desenvolvimento** | 100 | 1 minuto | "Aguarde 1 minuto" |
| **Produção** | 10 | 15 minutos | "Tente novamente em 15 minutos" |

**Aplicado em:**
- `/api/auth/login/admin`
- `/api/auth/login/colaborador`
- `/api/auth/login/distribuidor`

### **2. Rate Limit Geral da API**

| Ambiente | Requisições | Janela de Tempo |
|----------|-------------|-----------------|
| **Desenvolvimento** | 1000 | 1 minuto |
| **Produção** | 100 | 1 minuto |

**Aplicado em:**
- Todas as rotas `/api/*` (exceto login que tem seu próprio limite)

---

## 🚀 Soluções Rápidas

### **Solução 1: Aguardar o Tempo (Recomendado)**

Se você está bloqueado, basta aguardar:
- **Desenvolvimento**: 1 minuto
- **Produção**: 15 minutos

### **Solução 2: Reiniciar o Servidor**

O rate limit é armazenado **em memória**. Ao reiniciar o servidor, o contador é zerado:

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
npm start
```

### **Solução 3: Desabilitar Temporariamente (Apenas Dev)**

**ATENÇÃO**: Use apenas em desenvolvimento local!

#### **Opção A - Via arquivo `.env`**

```bash
# Editar .env
DISABLE_RATE_LIMIT=true
```

Reinicie o servidor:
```bash
npm start
```

#### **Opção B - Via linha de comando**

```bash
DISABLE_RATE_LIMIT=true npm start
```

### **Solução 4: Aumentar os Limites**

Edite o arquivo `server.js` (linhas 80-118):

```javascript
// Para login
const loginLimiter = rateLimit({
    windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000,
    max: isDevelopment ? 100 : 10, // ← Altere aqui
    // ...
});

// Para API geral
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isDevelopment ? 1000 : 100, // ← Altere aqui
    // ...
});
```

---

## 🔍 Como Saber se Estou Bloqueado?

### **No Frontend (Browser)**

Você verá uma mensagem de erro:
```json
{
  "erro": "Muitas tentativas de login. Aguarde 1 minuto."
}
```

Status HTTP: **429 Too Many Requests**

### **No Console do Navegador (DevTools)**

```
POST http://localhost:3000/api/auth/login/colaborador 429 (Too Many Requests)
```

### **Nos Logs do Servidor**

```bash
# logs/combined.log ou console
[SECURITY] Rate limit excedido - Login {
  ip: '::1',
  url: '/api/auth/login/colaborador',
  ambiente: 'development'
}
```

---

## 📊 Monitoramento

### **Ver Headers da Resposta**

O servidor envia headers informativos:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1640995200
```

**No Chrome DevTools:**
1. Abra DevTools (F12)
2. Aba **Network**
3. Faça uma requisição de login
4. Clique na requisição
5. Veja a aba **Headers** → **Response Headers**

### **Ver no Código JavaScript**

```javascript
fetch('/api/auth/login/colaborador', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf, senha })
})
.then(response => {
    console.log('Limite:', response.headers.get('RateLimit-Limit'));
    console.log('Restantes:', response.headers.get('RateLimit-Remaining'));
    console.log('Reset em:', response.headers.get('RateLimit-Reset'));
    return response.json();
});
```

---

## 🛠️ Configurações Avançadas

### **Rate Limit por IP vs por Usuário**

Atualmente o rate limit é **por IP**. Se você quiser limitar por usuário:

```javascript
// server.js - Adicionar após loginLimiter
const loginLimiterByUser = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => {
        // Usar CPF/CNPJ/Email como chave ao invés de IP
        return req.body.cpf || req.body.cnpj || req.body.email || req.ip;
    }
});
```

### **Whitelist de IPs**

Para permitir IPs específicos sem rate limit:

```javascript
const loginLimiter = rateLimit({
    // ... outras configurações
    skip: (req) => {
        const whitelist = ['127.0.0.1', '::1', '192.168.1.100'];
        return whitelist.includes(req.ip) || process.env.DISABLE_RATE_LIMIT === 'true';
    }
});
```

### **Rate Limit Persistente (Redis)**

Para manter o rate limit entre reinicializações:

```bash
npm install rate-limit-redis redis
```

```javascript
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL
});

const loginLimiter = rateLimit({
    store: new RedisStore({
        client: redisClient,
        prefix: 'rl:login:'
    }),
    windowMs: 15 * 60 * 1000,
    max: 5
});
```

---

## ⚠️ Boas Práticas

### **✅ FAÇA:**

1. **Mantenha rate limit em produção** - segurança é prioridade
2. **Use limites diferentes por ambiente** - mais permissivo em dev
3. **Monitore os logs** - identifique ataques reais
4. **Informe o usuário** - mensagens claras sobre o bloqueio
5. **Teste os limites** - garanta que não afetam usuários legítimos

### **❌ NÃO FAÇA:**

1. **Desabilitar em produção** - expõe seu sistema a ataques
2. **Usar limites muito baixos** - frustra usuários legítimos
3. **Ignorar os logs** - você pode perder sinais de ataque
4. **Bloquear permanentemente** - sempre dê uma segunda chance
5. **Usar mesmos limites para tudo** - login precisa ser mais restritivo

---

## 🐛 Troubleshooting

### **Problema: Bloqueado mesmo após aguardar**

**Causa**: O servidor não foi reiniciado ou o tempo não expirou completamente.

**Solução**:
```bash
# Reiniciar servidor
Ctrl+C
npm start
```

### **Problema: Rate limit não está funcionando**

**Causa**: `DISABLE_RATE_LIMIT=true` está ativo.

**Solução**:
```bash
# Editar .env
DISABLE_RATE_LIMIT=false

# Reiniciar
npm start
```

### **Problema: Usuários legítimos sendo bloqueados**

**Causa**: Limite muito baixo ou múltiplos usuários no mesmo IP (NAT corporativo).

**Solução**:
```javascript
// Aumentar o limite em produção
max: isDevelopment ? 100 : 20, // Era 10, agora 20
```

### **Problema: Rate limit não reseta após o tempo**

**Causa**: Usando Redis/armazenamento persistente sem configurar TTL.

**Solução**:
```javascript
// Garantir que windowMs está configurado
windowMs: 15 * 60 * 1000, // 15 minutos
```

---

## 📈 Estatísticas Recomendadas

### **Para Login:**

| Tipo de Sistema | Tentativas | Janela |
|-----------------|-----------|--------|
| Pequeno/Médio | 10 | 15 min |
| Grande (muitos usuários) | 20 | 15 min |
| Desenvolvimento | 100 | 1 min |

### **Para API Geral:**

| Tipo de Sistema | Requisições | Janela |
|-----------------|-------------|--------|
| Pequeno | 50 | 1 min |
| Médio | 100 | 1 min |
| Grande | 200 | 1 min |
| Desenvolvimento | 1000 | 1 min |

---

## 🔐 Segurança vs Usabilidade

### **Muito Restritivo (Alto Risco de Frustração)**
```javascript
max: 3,
windowMs: 30 * 60 * 1000 // 3 tentativas em 30 minutos
```

### **Balanceado (Recomendado)**
```javascript
max: 10,
windowMs: 15 * 60 * 1000 // 10 tentativas em 15 minutos
```

### **Muito Permissivo (Baixa Segurança)**
```javascript
max: 100,
windowMs: 1 * 60 * 1000 // 100 tentativas em 1 minuto
```

---

## 📞 Suporte

Se você continua com problemas de rate limit:

1. **Verifique os logs**: `logs/combined.log`
2. **Veja o IP bloqueado**: nos logs de segurança
3. **Confirme o ambiente**: `NODE_ENV=development` ou `production`
4. **Teste com DISABLE_RATE_LIMIT=true**: para isolar o problema

---

**Última atualização**: Janeiro 2026
**Versão do Sistema**: 2.0.0

# 💾 Persistência de Dados no Railway - Guia Completo

## ⚠️ PROBLEMA IDENTIFICADO

Você está perdendo o banco de dados a cada deploy porque o **volume persistente não foi configurado** no Railway.

### O que acontece sem volume persistente:
```
Deploy 1: Banco criado em memória efêmera → dados inseridos
Deploy 2: Container novo criado → BANCO ANTERIOR PERDIDO ❌
Deploy 3: Container novo criado → BANCO ANTERIOR PERDIDO ❌
```

### O que acontece COM volume persistente:
```
Deploy 1: Banco criado em /data (volume) → dados inseridos
Deploy 2: Container novo, mas /data persiste → DADOS MANTIDOS ✅
Deploy 3: Container novo, mas /data persiste → DADOS MANTIDOS ✅
```

---

## ✅ SOLUÇÃO: Configurar Volume Persistente

### **Passo 1: Acessar Railway Dashboard**

1. Acesse: https://railway.app/
2. Faça login
3. Selecione o projeto **vale-gas-system**

### **Passo 2: Criar Volume Persistente**

1. No projeto, clique na aba **Settings** (ou no ícone de engrenagem)
2. Role até a seção **Volumes**
3. Clique em **+ Add Volume** (ou **New Volume**)

### **Passo 3: Configurar Volume**

Preencha os campos:

```
Mount Path: /data
```

**IMPORTANTE**: O mount path DEVE ser exatamente `/data` (sem barra no final).

**Explicação:**
- O código já está configurado para usar `/data` quando detecta Railway (linha 7-9 do `database.js`)
- O banco será salvo em `/data/database.sqlite`

### **Passo 4: Salvar e Aguardar Redeploy**

1. Clique em **Add** ou **Create Volume**
2. O Railway fará **redeploy automático** (~2-3 minutos)
3. Aguarde o deploy completar (status **Active** em verde)

### **Passo 5: Verificar Persistência**

Teste se o volume está funcionando:

```bash
# 1. Faça login no sistema e crie dados de teste
# 2. Faça um novo deploy (git push)
# 3. Verifique se os dados continuam lá após o deploy
```

Se os dados permanecerem, o volume está configurado corretamente! ✅

---

## 🔍 Como Verificar se o Volume Está Ativo

### **Método 1: Via Railway Dashboard**

1. Vá em **Settings** → **Volumes**
2. Você deve ver:
   ```
   /data
   Status: Active
   Size: X MB
   ```

### **Método 2: Via Logs do Railway**

Nos logs de deploy, você verá:
```
Mounting volume at /data...
✓ Volume mounted successfully
```

### **Método 3: Verificar Caminho do Banco nos Logs**

Quando o servidor inicia, você verá nos logs:
```
📊 Caminho do banco de dados: /data/database.sqlite
✅ Banco de dados inicializado com sucesso
```

Se aparecer `/data/database.sqlite` → Volume persistente ativo ✅
Se aparecer `/app/data/database.sqlite` → Usando diretório efêmero ❌

---

## 📊 Estrutura de Dados no Volume

Quando configurado corretamente, o volume `/data` conterá:

```
/data/
├── database.sqlite          # Banco principal
└── backups/                 # Backups automáticos (futuro)
    ├── backup_2026-01-03.db
    ├── backup_2026-01-02.db
    └── backup_2026-01-01.db
```

---

## 🛡️ Proteção Adicional: Backups Automáticos

Mesmo com volume persistente, é importante ter backups. Vou criar um sistema de backup automático para você.

### **Sistema de Backup (já implementado no código)**

O sistema já tem um script de backup em `scripts/backup.sh`, mas vamos melhorar:

#### **Backup Manual:**

```bash
# Via Railway CLI (se instalado)
railway run npm run backup

# Ou criar backup via código
```

#### **Backup Automático (Recomendado):**

**Opção 1: CRON Job no Railway**

Adicionar ao `server.js` (já existe parcialmente):

```javascript
const cron = require('node-cron');

// Backup diário às 3h da manhã
cron.schedule('0 3 * * *', async () => {
    try {
        const backupPath = path.join(DATA_DIR, 'backups');

        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const backupFile = path.join(backupPath, `backup_${timestamp}.db`);

        // Copiar banco de dados
        fs.copyFileSync(DB_PATH, backupFile);

        logger.logInfo('Backup automático criado', { arquivo: backupFile });

        // Limpar backups antigos (manter últimos 7 dias)
        const files = fs.readdirSync(backupPath);
        const backups = files.filter(f => f.startsWith('backup_')).sort().reverse();

        if (backups.length > 7) {
            backups.slice(7).forEach(f => {
                fs.unlinkSync(path.join(backupPath, f));
            });
        }
    } catch (error) {
        logger.logError('Erro no backup automático', error);
    }
});
```

**Opção 2: Railway Automated Backups (pago)**

Se você tiver plano Railway Pro:
1. Settings → Backups
2. Enable Automated Backups
3. Configurar frequência (diária, semanal)

---

## 🔄 Migração: Como NÃO Perder Dados no Futuro

### **Situações Seguras (não perde dados):**

✅ **Git push com mudanças de código**
- Apenas código é atualizado
- Volume `/data` permanece intacto

✅ **Adicionar/modificar variáveis de ambiente**
- Railway faz redeploy mas mantém volume

✅ **Restart do serviço**
- Volume persiste entre restarts

### **Situações de Risco (pode perder dados):**

⚠️ **Deletar o volume no Railway**
- TODOS os dados são perdidos
- Não tem rollback

⚠️ **Deletar e recriar o projeto**
- Volume é perdido junto com o projeto

⚠️ **Mudar mount path do volume**
- Dados ficam em caminho antigo, app não encontra

---

## 🚨 Checklist de Segurança para Produção

Antes de entregar o sistema ao cliente:

### **1. Volume Persistente**
- [ ] Volume criado com mount path `/data`
- [ ] Status do volume: **Active**
- [ ] Testado: dados persistem após deploy

### **2. Backups Automáticos**
- [ ] CRON job de backup configurado
- [ ] Backups sendo gerados diariamente
- [ ] Retenção configurada (7 dias)

### **3. Monitoramento**
- [ ] Logs sendo gerados corretamente
- [ ] Auditoria registrando ações críticas
- [ ] Webhook de alertas configurado (opcional)

### **4. Acesso ao Banco**
- [ ] Credenciais de admin master configuradas
- [ ] Variáveis de ambiente em produção configuradas
- [ ] DISABLE_RATE_LIMIT=false em produção

### **5. Documentação**
- [ ] Cliente tem acesso ao manual de uso
- [ ] Processo de backup documentado
- [ ] Contato de suporte definido

---

## 💡 Boas Práticas

### **DO's (Faça):**

1. ✅ **Sempre use volume persistente em produção**
2. ✅ **Configure backups automáticos**
3. ✅ **Teste a persistência antes de entregar**
4. ✅ **Monitore o tamanho do volume**
5. ✅ **Mantenha variáveis de ambiente documentadas**

### **DON'Ts (Não Faça):**

1. ❌ **Nunca delete o volume sem backup**
2. ❌ **Não use banco em memória em produção**
3. ❌ **Não armazene backups apenas no volume (use storage externo)**
4. ❌ **Não mude mount path sem migração planejada**
5. ❌ **Não ignore avisos de espaço em disco**

---

## 📈 Monitoramento de Espaço

### **Como ver o uso do volume:**

1. Railway Dashboard → Projeto
2. Settings → Volumes
3. Veja **Size** (tamanho usado)

### **Limites do Railway:**

- **Starter Plan**: Até 1 GB de volume (grátis)
- **Pro Plan**: Volumes maiores (pago)

### **Se o volume encher:**

1. Limpar backups antigos
2. Fazer vacuum no SQLite:
   ```sql
   VACUUM;
   ```
3. Exportar dados antigos para arquivo
4. Aumentar plano Railway (se necessário)

---

## 🔧 Troubleshooting

### **Problema: Dados ainda são perdidos após configurar volume**

**Causa 1**: Mount path errado
```
Solução: Verificar se mount path é exatamente /data
```

**Causa 2**: Variável RAILWAY_ENVIRONMENT não detectada
```
Solução: Verificar logs se aparece:
"📊 Caminho do banco de dados: /data/database.sqlite"
```

**Causa 3**: Volume não foi salvo
```
Solução: Verificar em Settings → Volumes se o volume existe
```

### **Problema: Volume está cheio**

```bash
# Conectar via Railway CLI (se instalado)
railway run bash

# Ver uso de disco
du -sh /data/*

# Limpar backups antigos
rm /data/backups/backup_2025-*.db
```

### **Problema: Migrar de volume antigo para novo**

```bash
# 1. Fazer backup do banco atual
# 2. Criar novo volume
# 3. Copiar backup para novo volume
# 4. Atualizar mount path
# 5. Redeploy
```

---

## 📞 Suporte Railway

Se tiver problemas com volumes:

- Documentação: https://docs.railway.app/guides/volumes
- Discord: https://discord.gg/railway
- Twitter: @Railway

---

## ✅ Resumo da Configuração

```yaml
# railway.json (já configurado)
volumes:
  - mountPath: /data

# database.js (já configurado)
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT
    ? '/data'  # Railway
    : './data' # Local

# .gitignore (já configurado)
data/
*.sqlite
*.db
```

---

## 🎯 Ação Imediata

**Agora mesmo, faça:**

1. ✅ **Acessar Railway Dashboard**
2. ✅ **Settings → Volumes → Add Volume**
3. ✅ **Mount Path: /data**
4. ✅ **Aguardar redeploy (~2-3 min)**
5. ✅ **Testar: criar dados → fazer deploy → verificar se dados persistem**

Após isso, seus dados **NUNCA MAIS** serão perdidos em deploys! 🎉

---

**Última atualização**: Janeiro 2026
**Versão do Sistema**: 2.0.0
**Autor**: Desenvolvido para Consigaz

# 🔒 Guia de Configuração de Volume Persistente no Railway

## 🚨 PROBLEMA: Dados sendo perdidos a cada deploy

**Por quê isso acontece?**
- Railway usa containers efêmeros (temporários)
- A cada deploy, um novo container é criado
- O arquivo SQLite dentro do container é perdido
- **RESULTADO: Todos os dados somem!**

## ✅ SOLUÇÃO: Configurar Volume Persistente

O código JÁ está preparado para usar volume persistente em `/data`. Você só precisa configurar no Railway!

---

## 📋 PASSO A PASSO (5 minutos)

### 1️⃣ Acessar o Dashboard do Railway

1. Acesse: https://railway.app/dashboard
2. Selecione seu projeto: **vale-gas-system**
3. Clique no seu serviço (backend)

### 2️⃣ Criar o Volume Persistente

1. Na aba do serviço, clique em **"Settings"** (Configurações)
2. Role até a seção **"Volumes"**
3. Clique em **"+ New Volume"** ou **"Add Volume"**

### 3️⃣ Configurar o Volume

**Preencha os campos:**

```
Volume Name: data-volume
Mount Path: /data
```

**Detalhes:**
- **Volume Name**: Pode ser qualquer nome (sugestão: `data-volume` ou `sqlite-data`)
- **Mount Path**: **DEVE SER** `/data` (exatamente isso, sem mudar!)
- **Size**: Deixe o padrão (1GB é suficiente, você pode aumentar depois)

### 4️⃣ Salvar e Fazer Redeploy

1. Clique em **"Add"** ou **"Create Volume"**
2. O Railway vai fazer um redeploy automático
3. Aguarde 2-3 minutos

---

## ✅ Verificar se Funcionou

### Método 1: Verificar Logs

1. Na aba do serviço, clique em **"Deployments"**
2. Clique no deployment mais recente
3. Veja os logs e procure por:

```
📊 Configuração do Banco de Dados:
   • Ambiente: RAILWAY (Produção)
   • Diretório de dados: /data
   • Caminho do banco: /data/database.sqlite
   • Volume persistente: SIM (/data)
```

**✅ Se aparecer "Volume persistente: SIM (/data)" → TUDO CERTO!**

### Método 2: Testar na Prática

1. Acesse seu painel admin no Railway
2. Cadastre um colaborador de teste
3. Faça um novo deploy (pode ser um commit vazio):
   ```bash
   git commit --allow-empty -m "test: Testar persistência de dados"
   git push origin main
   ```
4. Aguarde o deploy terminar
5. Acesse novamente → **O colaborador deve estar lá!**

---

## 🔧 Estrutura de Dados no Volume

Após configurar, seu volume `/data` terá:

```
/data/
├── database.sqlite          ← Banco de dados principal
├── database.sqlite-shm      ← Arquivo temporário do SQLite
├── database.sqlite-wal      ← Write-Ahead Log do SQLite
└── backups/                 ← Backups automáticos (se configurado)
    ├── backup-2025-01-09.sqlite
    ├── backup-2025-01-08.sqlite
    └── ...
```

---

## 🎯 Benefícios do Volume Persistente

✅ **Dados preservados entre deploys**
✅ **Sem necessidade de PostgreSQL** (por enquanto)
✅ **Zero custo adicional**
✅ **Backups automáticos** (se configurar o cron job)
✅ **Fácil de migrar para PostgreSQL depois**

---

## 🔄 Migração Futura para PostgreSQL (Opcional)

Quando seu sistema crescer (10k+ registros ou múltiplas instâncias), você pode migrar:

### Passo 1: Adicionar PostgreSQL no Railway
1. Dashboard → **New** → **Database** → **PostgreSQL**
2. Railway cria automaticamente a variável `DATABASE_URL`

### Passo 2: Instalar dependência
```bash
npm install pg
```

### Passo 3: Modificar código
- Atualizar `database.js` para detectar `DATABASE_URL`
- Usar biblioteca `pg` ao invés de `sqlite3`

### Passo 4: Migrar dados
- Exportar dados do SQLite
- Importar no PostgreSQL

**Mas NÃO faça isso agora!** SQLite com volume persistente é perfeito para começar.

---

## ⚠️ IMPORTANTE

### ❌ NÃO faça:
- ❌ Usar `/app` ou qualquer outro diretório que não seja `/data`
- ❌ Deletar o volume enquanto tiver dados importantes
- ❌ Fazer backup manual sem testar a restauração

### ✅ FAÇA:
- ✅ Configurar o volume ANTES de ir para produção
- ✅ Testar a persistência com dados de teste
- ✅ Configurar backups automáticos (opcional, mas recomendado)
- ✅ Monitorar o tamanho do banco de dados

---

## 📊 Monitoramento do Espaço

Para ver o tamanho do banco:

1. No Railway, vá em **"Settings"** → **"Volumes"**
2. Você verá o uso de espaço
3. SQLite é muito eficiente:
   - 1.000 registros ≈ 100-200 KB
   - 10.000 registros ≈ 1-2 MB
   - 100.000 registros ≈ 10-20 MB

**1GB de volume = capacidade para centenas de milhares de registros!**

---

## 🆘 Troubleshooting

### Problema: "Dados ainda somem após configurar volume"

**Solução:**
1. Verifique se o Mount Path é exatamente `/data`
2. Veja os logs para confirmar que está usando `/data`
3. Certifique-se de que o volume foi criado ANTES do deploy

### Problema: "Erro de permissão ao escrever em /data"

**Solução:**
- O Railway gerencia as permissões automaticamente
- Se der erro, delete o volume e crie novamente
- Certifique-se de não ter arquivos corrompidos

### Problema: "Volume cheio"

**Solução:**
1. No Railway: Settings → Volumes → Increase Size
2. Considere fazer limpeza de dados antigos
3. Considere migrar para PostgreSQL

---

## 📞 Próximos Passos

Após configurar o volume:

1. ✅ Teste a persistência de dados
2. ✅ Configure backups automáticos (opcional)
3. ✅ Monitore o crescimento do banco
4. ✅ Documente o acesso ao volume para a equipe

---

## 🎉 Pronto!

Com o volume configurado, seu sistema está pronto para produção! Os dados nunca mais serão perdidos entre deploys.

**Tempo total: ~5 minutos**
**Custo adicional: $0**
**Dados perdidos: 0**

---

**Criado por Claude Code**

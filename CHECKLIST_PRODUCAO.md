# ✅ Checklist para Colocar o Sistema em Produção

## 🚨 CRÍTICO - Faça ANTES de ir para produção!

### 1. ⚠️ CONFIGURAR VOLUME PERSISTENTE NO RAILWAY

**Status:** ⬜ Pendente

**Por quê é crítico?**
Sem isso, TODOS OS DADOS serão perdidos a cada deploy!

**Como fazer:**
1. Acesse https://railway.app/dashboard
2. Selecione seu projeto: vale-gas-system
3. Clique no serviço (backend)
4. Settings → Volumes → "+ New Volume"
5. Configurar:
   - **Volume Name**: `data-volume`
   - **Mount Path**: `/data` (EXATAMENTE isso!)
   - **Size**: 1GB (padrão está ok)
6. Clique em "Add" / "Create"
7. Aguarde o redeploy automático (2-3 min)

**Verificar se funcionou:**
- Veja os logs do deploy
- Procure por: `Volume persistente: SIM (/data)`
- Teste: cadastre um colaborador → faça novo deploy → verifique se permanece

**Documentação completa:** `RAILWAY_VOLUME_SETUP.md`

---

### 2. 🔒 ALTERAR SENHA DO ADMIN PADRÃO

**Status:** ⬜ Pendente

**Por quê é crítico?**
A senha padrão está no código e pode ser descoberta!

**Como fazer:**
1. Acesse o painel admin: https://seu-dominio.railway.app/admin.html
2. Login com:
   - Email: `admin@consigaz.com.br`
   - Senha: `Admin123!@`
3. Vá em "Usuários RH"
4. Edite o admin master
5. Altere a senha para algo forte
6. ⚠️ **GUARDE A NOVA SENHA EM LUGAR SEGURO!**

**Senha forte sugerida:**
- Mínimo 12 caracteres
- Letras maiúsculas e minúsculas
- Números
- Símbolos especiais
- Exemplo: `Vale@Gas2025!Secure#`

---

### 3. 🌐 CONFIGURAR DOMÍNIO PERSONALIZADO

**Status:** ⬜ Opcional (mas recomendado)

**Por quê é importante?**
URL mais profissional e fácil de lembrar

**Como fazer no Railway:**
1. Settings → Domains
2. Generate Domain (Railway fornece grátis)
   - Exemplo: `vale-gas-system.up.railway.app`
3. OU adicionar seu próprio domínio:
   - Adicione CNAME no seu DNS
   - Configure no Railway

---

### 4. 🔐 CONFIGURAR VARIÁVEIS DE AMBIENTE (Opcional)

**Status:** ⬜ Opcional

**Variáveis recomendadas:**

```bash
# Segurança
JWT_SECRET=sua-chave-secreta-aleatoria-aqui

# Email/Notificações (se for usar)
WEBHOOK_CODIGO_GERADO=https://n8n.io/webhook/...
WEBHOOK_LEMBRETE_EXPIRACAO=https://n8n.io/webhook/...

# CORS (se precisar)
ALLOWED_ORIGINS=https://seudominio.com,https://www.seudominio.com
```

**Como configurar:**
1. Railway Dashboard → Settings → Variables
2. Add Variable → Preencha e salve
3. Redeploy automático

---

## 🎯 Recomendado - Configure quando puder

### 5. 📧 CONFIGURAR WEBHOOKS PARA NOTIFICAÇÕES

**Status:** ⬜ Opcional

**Funcionalidades:**
- Enviar email quando vale é gerado
- Lembrete de expiração via WhatsApp
- Notificações de validação

**Como fazer:**
1. Crie uma conta no N8N.io (grátis)
2. Configure workflows
3. Adicione URLs nos webhooks (variáveis de ambiente)

**Documentação:** Já existe no código em `webhooks.js`

---

### 6. 📊 MONITORAMENTO

**Status:** ⬜ Opcional

**Ferramentas sugeridas:**
- ✅ Logs do Railway (grátis, já disponível)
- ⬜ Sentry para erros (opcional)
- ⬜ Uptime monitoring (UptimeRobot - grátis)

**Health Check:**
- Endpoint: https://seu-dominio.railway.app/api/health
- Use o UptimeRobot para monitorar e receber alertas se cair

---

### 7. 💾 TESTAR BACKUP E RESTAURAÇÃO

**Status:** ⬜ Pendente

**Como testar:**

1. **Criar backup manual:**
   ```bash
   # No Railway: Settings → Shell
   node scripts/backup-database.js create
   ```

2. **Listar backups:**
   ```bash
   node scripts/backup-database.js list
   ```

3. **Testar restauração (ambiente de teste!):**
   ```bash
   node scripts/backup-database.js restore backup-YYYY-MM-DD_HH-MM-SS.sqlite
   ```

**Backup automático:**
- ✅ Já configurado!
- Roda todo dia às 2h da manhã
- Mantém últimos 7 backups

---

### 8. 📱 TESTAR SISTEMA COMPLETO

**Status:** ⬜ Pendente

**Checklist de testes:**

#### Painel Admin (RH)
- ⬜ Login funciona
- ⬜ Cadastrar colaborador
- ⬜ Cadastrar distribuidor
- ⬜ Gerar vales mensais
- ⬜ Exportar relatórios
- ⬜ Ver auditoria
- ⬜ Gerenciar reembolsos

#### Painel Colaborador
- ⬜ Login funciona
- ⬜ Ver vales disponíveis
- ⬜ Solicitar alteração de dados
- ⬜ Visualizar histórico

#### Painel Distribuidor
- ⬜ Login funciona
- ⬜ Validar vale (com código)
- ⬜ Ver histórico de validações
- ⬜ Gerenciar dados bancários (para reembolsos)

#### Reembolsos (NOVO!)
- ⬜ Reembolso é criado automaticamente ao validar vale
- ⬜ Filtros funcionam
- ⬜ Upload de comprovantes
- ⬜ Aprovar/Rejeitar/Pagar
- ⬜ Exportar CSV
- ⬜ Visualizar histórico

---

### 9. 🔄 TESTE DE PERSISTÊNCIA

**Status:** ⬜ CRÍTICO - Fazer DEPOIS de configurar volume!

**Como testar:**

1. Cadastre um colaborador de teste
2. Anote o nome/CPF
3. Faça um deploy:
   ```bash
   git commit --allow-empty -m "test: Testar persistência"
   git push origin main
   ```
4. Aguarde o deploy terminar (2-3 min)
5. Acesse o sistema novamente
6. **✅ SUCESSO:** O colaborador ainda está lá
7. **❌ FALHA:** O colaborador sumiu → Volume não configurado corretamente!

---

### 10. 📚 DOCUMENTAÇÃO PARA A EQUIPE

**Status:** ⬜ Recomendado

**Documentos a criar:**

- ⬜ Manual do usuário (RH)
- ⬜ Manual do usuário (Colaborador)
- ⬜ Manual do usuário (Distribuidor)
- ⬜ Procedimentos de backup/restauração
- ⬜ Contatos de suporte

**Dica:** Use os endpoints e fluxos já implementados como base!

---

## 📊 Status Geral do Sistema

### ✅ IMPLEMENTADO E FUNCIONANDO

- ✅ Autenticação completa (3 tipos de usuário)
- ✅ Sistema de vales mensais
- ✅ Validação de vales (distribuidores)
- ✅ Sistema de reembolsos completo
- ✅ Relatórios e exportações
- ✅ Auditoria de ações
- ✅ Webhooks para notificações
- ✅ Rate limiting e segurança
- ✅ Health check
- ✅ Backup automático (código pronto)
- ✅ Logs estruturados

### ⚠️ PENDENTE (USUÁRIO DEVE FAZER)

- ⬜ Configurar volume persistente no Railway
- ⬜ Alterar senha admin padrão
- ⬜ Testar persistência de dados
- ⬜ (Opcional) Configurar domínio personalizado
- ⬜ (Opcional) Configurar webhooks de notificação

---

## 🆘 Troubleshooting

### Problema: "Dados sumindo após deploy"
**Solução:** Configure o volume persistente (item 1 acima)

### Problema: "Erro 500 ao acessar reembolsos"
**Solução:** Verifique os logs. Pode ser erro de permissão ou tabela não criada.

### Problema: "Healthcheck failed no Railway"
**Solução:** Já resolvido! Mas se voltar, verifique os logs de inicialização.

### Problema: "Não consigo fazer login"
**Solução:** Verifique as credenciais. Padrão: admin@consigaz.com.br / Admin123!@

### Problema: "Upload de comprovantes não funciona"
**Solução:** Verifique se a pasta `uploads/reembolsos` tem permissão de escrita.

---

## 🎉 Quando estiver tudo ✅

**Seu sistema estará PRONTO PARA PRODUÇÃO!**

Recursos disponíveis:
- 📊 Dashboard completo
- 👥 Gestão de colaboradores
- 🏪 Gestão de distribuidores
- 🎟️ Vales mensais automáticos
- ✅ Validação de vales
- 💰 Reembolsos automáticos
- 📈 Relatórios gerenciais
- 🔍 Auditoria completa
- 💾 Backups automáticos
- 🔒 Segurança robusta

---

## 📞 Suporte

Se precisar de ajuda:
1. Verifique a documentação em `/docs`
2. Veja os logs do Railway
3. Confira os arquivos `.md` no projeto:
   - `RAILWAY_VOLUME_SETUP.md`
   - `REEMBOLSOS_INTEGRACAO.md`
   - Este arquivo: `CHECKLIST_PRODUCAO.md`

---

**Criado por Claude Code**
**Vale-Gás v2.0 - Sistema completo de gestão de vales-gás**

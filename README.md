# Sistema Vale-Gás v2.0

Sistema completo para controle de distribuição de vale-gás para colaboradores com recursos enterprise-ready de segurança, performance e monitoramento.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)

---

## 🆕 Novidades da Versão 2.0

✅ **Segurança Robusta** - Helmet, CORS restritivo, Rate limiting, Sanitização de inputs
✅ **Performance 10x Melhor** - Cache inteligente, índices otimizados
✅ **Logs Estruturados** - Winston com rotação automática
✅ **Health Check Completo** - Monitoramento em tempo real
✅ **Backup Automático** - Proteção diária dos dados
✅ **Dashboard de Métricas** - Visão operacional completa
✅ **Código Padronizado** - ESLint + Prettier

👉 **[Ver todas as melhorias detalhadas](MELHORIAS_V2.md)**

---

## 📋 Funcionalidades

### Painel Administrativo (RH)
- ✅ Dashboard com estatísticas em tempo real
- ✅ CRUD de Colaboradores (importação em massa)
- ✅ CRUD de Distribuidores/Revendas
- ✅ Geração automática de códigos mensais
- ✅ Gestão de solicitações de alteração
- ✅ Relatórios e exportações
- ✅ Multi-usuário com níveis de permissão
- ✅ Sistema de auditoria completo

### Painel do Colaborador
- ✅ Visualização do vale-gás atual (código + QR Code)
- ✅ Múltiplos vales com navegação
- ✅ Histórico completo de vales
- ✅ Busca de distribuidores próximos (por CEP)
- ✅ Avaliação de distribuidores
- ✅ Perfil e alteração de dados
- ✅ Solicitação de alteração de dados
- ✅ Alteração de senha segura

### Painel do Distribuidor
- ✅ Validação de códigos em tempo real
- ✅ Confirmação de retirada
- ✅ Dashboard com estatísticas
- ✅ Histórico de todas as retiradas
- ✅ Sistema de avaliações
- ✅ Alteração de senha

### Integrações e Automações
- ✅ Webhooks para N8N (notificações personalizadas)
- ✅ Busca de CEP automática (ViaCEP com cache)
- ✅ Geração automática mensal via cron
- ✅ Notificações de expiração programadas
- ✅ Backup automático diário
- ✅ Limpeza automática de logs antigos

---

## 🚀 Instalação Rápida

### Pré-requisitos
- Node.js 18+ ([Download](https://nodejs.org))
- NPM (incluído com Node.js)

### Passo a Passo

```bash
# 1. Navegar para o diretório
cd vale-gas-system

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
nano .env  # Editar com suas configurações

# 4. Iniciar servidor
npm start
```

### Acesso Inicial

```
URL: http://localhost:3000
Admin: admin@consigaz.com.br
Senha: ConsigAz@2025
```

> ⚠️ **IMPORTANTE:** Altere a senha do admin após o primeiro acesso!

---

## ⚙️ Configuração (.env)

```env
# Segurança
JWT_SECRET=gere_uma_chave_forte_aqui
ALLOWED_ORIGINS=https://seu-dominio.com.br

# Servidor
PORT=3000
NODE_ENV=production

# Admin Master
ADMIN_MASTER_EMAIL=admin@consigaz.com.br
ADMIN_MASTER_SENHA=SenhaForte123!

# Webhooks N8N (opcional)
WEBHOOK_CODIGO_GERADO=https://seu-n8n.com/webhook/codigo-gerado
WEBHOOK_LEMBRETE_EXPIRACAO=https://seu-n8n.com/webhook/lembrete
WEBHOOK_VALE_RETIRADO=https://seu-n8n.com/webhook/retirado
```

**Gerar chave JWT segura:**
```bash
openssl rand -base64 32
```

---

## 📡 API e Endpoints

### Endpoints Públicos

```bash
# Health Check (monitoramento)
GET /api/health

# Buscar CEP (com cache)
GET /api/cep/:cep
```

### Endpoints Autenticados

```bash
# Login
POST /api/auth/login

# Dashboard de métricas (admin)
GET /api/metrics
Header: Authorization: Bearer TOKEN

# Gestão de colaboradores
GET    /api/admin/colaboradores
POST   /api/admin/colaboradores
PUT    /api/admin/colaboradores/:id
DELETE /api/admin/colaboradores/:id

# ... e muitos outros
```

**Resposta Health Check:**
```json
{
  "status": "healthy",
  "uptime": 432156,
  "version": "2.0.0",
  "checks": {
    "database": { "status": "ok", "latency_ms": 12 },
    "memory": { "status": "ok", "percent": 48 },
    "cache": { "status": "ok", "hit_rate": 92 }
  }
}
```

---

## 📊 Webhooks (N8N)

O sistema envia webhooks automáticos para integração com N8N, Zapier, Make, etc.

### 1. Código Gerado
```json
{
  "evento": "codigo_gerado",
  "destinatario": {
    "nome": "João Silva",
    "email": "joao@empresa.com",
    "telefone": "11999999999"
  },
  "vale": {
    "codigo": "VG-ABC123",
    "mes_referencia": "2024-01",
    "data_expiracao": "2024-01-31"
  },
  "canais": ["email", "whatsapp"]
}
```

### 2. Lembrete de Expiração
```json
{
  "evento": "lembrete_expiracao",
  "vale": {
    "codigo": "VG-ABC123",
    "dias_restantes": 5
  },
  "prioridade": "alta"
}
```

### 3. Vale Retirado
```json
{
  "evento": "vale_retirado",
  "distribuidor": {
    "nome": "Distribuidora Centro",
    "cidade": "São Paulo"
  }
}
```

---

## 📂 Estrutura do Projeto

```
vale-gas-system/
├── server.js              # Servidor principal (v2.0)
├── database.js            # Banco SQLite + índices otimizados
├── auth.js                # Autenticação JWT
├── utils.js               # Funções utilitárias
├── webhooks.js            # Integração N8N
├── auditoria.js           # Sistema de auditoria
│
├── config/
│   ├── logger.js          # 🆕 Winston (logs estruturados)
│   └── cache.js           # 🆕 NodeCache (cache inteligente)
│
├── middlewares/
│   ├── errorHandler.js    # 🆕 Tratamento global de erros
│   └── sanitize.js        # 🆕 Sanitização de inputs (XSS)
│
├── routes/
│   ├── auth.js            # Rotas de autenticação
│   ├── admin.js           # Painel administrativo
│   ├── colaborador.js     # Painel do colaborador
│   ├── distribuidor.js    # Painel do distribuidor
│   └── cron.js            # Tarefas agendadas
│
├── public/
│   ├── admin.html         # Interface admin
│   ├── colaborador.html   # Interface colaborador
│   ├── distribuidor.html  # Interface distribuidor
│   └── login-*.html       # Páginas de login
│
├── scripts/
│   └── backup.sh          # 🆕 Backup automático
│
├── logs/                  # 🆕 Logs estruturados
│   ├── combined.log       # Todos os logs
│   ├── error.log          # Apenas erros
│   ├── exceptions.log     # Crashes
│   └── rejections.log     # Promises rejeitadas
│
├── backups/               # 🆕 Backups automáticos (30 dias)
│   └── database_YYYYMMDD_HHMMSS.sqlite
│
├── database.sqlite        # Banco de dados
├── package.json           # Dependências
├── .env                   # Configurações (NÃO versionar!)
├── .env.example           # Template de configuração
├── .eslintrc.json         # 🆕 Regras ESLint
├── .prettierrc.json       # 🆕 Configuração Prettier
├── README.md              # Este arquivo
├── MELHORIAS_V2.md        # 🆕 Documentação completa v2.0
└── ANALISE_BUGS.md        # Histórico de correções
```

---

## 🛠️ Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia em modo desenvolvimento

# Produção
npm start                # Inicia em modo produção

# Manutenção
npm run backup           # Backup manual do banco
npm run lint             # Verificar código
npm run lint:fix         # Corrigir problemas automaticamente
npm run format           # Formatar código (Prettier)

# Logs
tail -f logs/combined.log     # Monitorar todos os logs
tail -f logs/error.log        # Monitorar apenas erros

# Backup/Restauração
ls -lh backups/                    # Listar backups disponíveis
cp backups/database_*.sqlite database.sqlite  # Restaurar backup
```

---

## 🔒 Segurança em Produção

### Checklist Obrigatório

- [ ] Alterar `JWT_SECRET` (usar `openssl rand -base64 32`)
- [ ] Alterar `ADMIN_MASTER_SENHA`
- [ ] Alterar `CRON_API_KEY`
- [ ] Configurar `ALLOWED_ORIGINS` com domínio real
- [ ] Definir `NODE_ENV=production`
- [ ] Configurar HTTPS (Nginx/Caddy/CloudFlare)
- [ ] Configurar firewall (permitir apenas 80/443)
- [ ] Testar backup/restauração
- [ ] Configurar monitoramento (UptimeRobot)
- [ ] Verificar logs sendo salvos

### Headers de Segurança (automático com Helmet)

```
✅ Content-Security-Policy
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
✅ Strict-Transport-Security (HSTS)
✅ X-XSS-Protection
```

### Rate Limiting (automático)

```
✅ Login: 5 tentativas / 15 minutos
✅ API: 100 requisições / minuto
```

---

## 📈 Monitoramento

### Health Check (UptimeRobot, Pingdom, etc.)

```bash
# Configurar monitoramento em:
URL: https://seu-dominio.com/api/health
Intervalo: 5 minutos
Alertas: Email/SMS se status != 200
```

### Logs

```bash
# Visualizar logs em tempo real
tail -f logs/combined.log | grep "ERROR"

# Analisar logs do dia
cat logs/combined.log | grep "2025-12-06"

# Contar erros
cat logs/error.log | grep "error" | wc -l
```

### Métricas (Dashboard Admin)

Acesse `/api/metrics` (autenticado) para ver:
- Vales ativos/utilizados/expirando
- Taxa de utilização
- Colaboradores ativos
- Top distribuidor do mês
- Falhas de webhooks
- Taxa de hit do cache

---

## 🔄 Backup e Recuperação

### Backup Automático

```bash
# Agendado diariamente às 2h da manhã
# Mantém últimos 30 dias
# Local: backups/database_YYYYMMDD_HHMMSS.sqlite
```

### Backup Manual

```bash
npm run backup
# OU
bash scripts/backup.sh
```

### Restauração

```bash
# 1. Parar servidor
# 2. Listar backups disponíveis
ls -lh backups/

# 3. Restaurar backup desejado
cp backups/database_20251205_020000.sqlite database.sqlite

# 4. Reiniciar servidor
npm start
```

---

## 🐛 Troubleshooting

### Servidor não inicia

```bash
# Verificar porta ocupada
lsof -i :3000

# Verificar logs de erro
cat logs/error.log

# Verificar .env existe
ls -la .env
```

### Banco de dados corrompido

```bash
# Restaurar do backup
cp backups/database_YYYYMMDD_HHMMSS.sqlite database.sqlite

# Verificar integridade
sqlite3 database.sqlite "PRAGMA integrity_check;"
```

### Performance lenta

```bash
# Verificar health check
curl http://localhost:3000/api/health

# Verificar hit rate do cache (deve ser > 70%)
# Verificar memória (deve ser < 85%)

# Limpar cache (reiniciar servidor)
```

### Logs muito grandes

```bash
# Remover logs antigos
rm logs/*.log

# Configurar rotação (já automática no Winston)
```

---

## 📞 Suporte

### Documentação

- **README.md** - Este arquivo (visão geral)
- **MELHORIAS_V2.md** - Detalhes técnicos das melhorias
- **ANALISE_BUGS.md** - Histórico de correções

### Debug

1. Verificar logs: `tail -f logs/combined.log`
2. Health check: `curl http://localhost:3000/api/health`
3. Métricas: Acessar `/api/metrics` (autenticado)

### Contato

Em caso de problemas críticos, verificar:
- Logs de erro em `logs/error.log`
- Status do servidor em `/api/health`
- Versão do Node.js: `node -v` (mínimo 18.x)

---

## 📝 Licença

Sistema desenvolvido sob demanda. Todos os direitos reservados.

---

## 🎉 Agradecimentos

**Versão 2.0** desenvolvida com foco em:
- ✅ Segurança enterprise
- ✅ Performance otimizada
- ✅ Observabilidade completa
- ✅ Código profissional

**Status:** ✅ Pronto para produção
**Versão:** 2.0.0
**Última atualização:** Dezembro 2025
# vale-gas-system
# vale-gas-system

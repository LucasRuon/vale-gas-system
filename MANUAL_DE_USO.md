# 📖 Manual de Uso - Sistema Vale-Gás v2.0

Manual completo para usuários do sistema de controle de vale-gás para colaboradores.

---

## 📑 Índice

1. [Visão Geral](#-visão-geral)
2. [Tipos de Usuário](#-tipos-de-usuário)
3. [Manual do Administrador (RH)](#-manual-do-administrador-rh)
4. [Manual do Colaborador](#-manual-do-colaborador)
5. [Manual do Distribuidor](#-manual-do-distribuidor)
6. [Fluxo Completo do Sistema](#-fluxo-completo-do-sistema)
7. [Perguntas Frequentes (FAQ)](#-perguntas-frequentes-faq)
8. [Suporte](#-suporte)

---

## 🎯 Visão Geral

O **Sistema Vale-Gás v2.0** é uma plataforma completa para gerenciar o benefício de vale-gás para colaboradores de forma digital, segura e eficiente.

### **O que o sistema faz:**

- ✅ Gera códigos de vale-gás mensalmente para colaboradores
- ✅ Permite que colaboradores retirem gás em distribuidores parceiros
- ✅ Controla validade e expiração dos vales
- ✅ Registra todas as retiradas com auditoria completa
- ✅ Avaliação de distribuidores pelos colaboradores
- ✅ Relatórios e estatísticas para RH

### **Benefícios:**

- 🌐 100% online - acesso de qualquer lugar
- 📱 Responsivo - funciona em celular, tablet e computador
- 🔒 Seguro - criptografia e auditoria completa
- ⚡ Rápido - códigos gerados automaticamente
- 📊 Transparente - histórico completo de retiradas

---

## 👥 Tipos de Usuário

O sistema possui **3 tipos** de usuários:

| Tipo | Descrição | Acesso |
|------|-----------|--------|
| **👨‍💼 Administrador (RH)** | Gerencia colaboradores, distribuidores e configurações | `/admin.html` |
| **👷 Colaborador** | Acessa seus vales e retira gás | `/colaborador.html` |
| **🏪 Distribuidor** | Valida códigos e registra retiradas | `/distribuidor.html` |

---

# 👨‍💼 Manual do Administrador (RH)

## 1. Acesso ao Sistema

### **1.1. Como Fazer Login**

1. Acesse: `https://seu-sistema.up.railway.app/admin.html`
2. Digite:
   - **Email**: `admin@consigaz.com.br` (ou o configurado)
   - **Senha**: Senha definida no `.env`
3. Clique em **"Entrar"**

✅ **Sucesso:** Você será redirecionado para o painel administrativo

❌ **Erro "Credenciais inválidas":**
- Verifique email e senha
- Certifique-se de estar usando o portal correto (admin.html)

---

## 2. Dashboard Principal

Ao fazer login, você verá:

### **2.1. Estatísticas Rápidas**

```
┌─────────────────────────────────────────────────┐
│  📊 Dashboard                                   │
├─────────────────────────────────────────────────┤
│  👷 Colaboradores Ativos: 150                   │
│  🏪 Distribuidores Ativos: 25                   │
│  🎫 Vales Gerados (Mês): 148                    │
│  ✅ Vales Utilizados: 132                       │
│  ⏳ Vales Pendentes: 16                         │
│  ⚠️ Vales Expirados: 12                        │
└─────────────────────────────────────────────────┘
```

### **2.2. Menu Principal**

- **Dashboard**: Visão geral e estatísticas
- **Colaboradores**: Gerenciar colaboradores
- **Distribuidores**: Gerenciar distribuidores
- **Vales-Gás**: Gerenciar vales
- **Relatórios**: Gerar relatórios
- **Configurações**: Configurar sistema
- **Auditoria**: Ver logs de auditoria

---

## 3. Gestão de Colaboradores

### **3.1. Cadastrar Colaborador Individual**

1. Menu → **"Colaboradores"**
2. Clique em **"+ Novo Colaborador"**
3. Preencha os dados:

**Dados Pessoais:**
```
Nome Completo: João da Silva
CPF: 123.456.789-00 (apenas números)
Email: joao.silva@empresa.com.br
Telefone: (11) 98765-4321
```

**Endereço:**
```
CEP: 01234-567
Logradouro: Rua das Flores
Número: 123
Complemento: Apto 45
Bairro: Centro
Cidade: São Paulo
Estado: SP
```

**Dados Profissionais:**
```
Data de Admissão: 01/01/2024
Matrícula: 2024001
Setor: Produção
```

**Senha de Acesso:**
```
Senha: [será gerada automaticamente]
```

4. Clique em **"Cadastrar"**

✅ **Sucesso:**
- Colaborador criado
- Senha gerada automaticamente
- Código do vale do mês atual gerado (se configurado)
- Senha enviada por email (se SMTP configurado)

📧 **Email enviado ao colaborador:**
```
Assunto: Bem-vindo ao Sistema Vale-Gás!

Olá João da Silva,

Você foi cadastrado no Sistema Vale-Gás.

Acesso: https://seu-sistema.up.railway.app/colaborador.html
Email: joao.silva@empresa.com.br
Senha: ABC12345

Altere sua senha no primeiro acesso.
```

---

### **3.2. Importar Colaboradores em Massa (CSV)**

Para cadastrar muitos colaboradores de uma vez:

1. Menu → **"Colaboradores"**
2. Clique em **"Importar CSV"**
3. Baixe o **modelo CSV** (clique em "Baixar Modelo")
4. Preencha o arquivo Excel/CSV:

**Modelo CSV:**
```csv
nome,cpf,email,telefone,cep,logradouro,numero,complemento,bairro,cidade,estado,data_admissao,matricula,setor
João Silva,12345678900,joao@empresa.com,(11) 98765-4321,01234-567,Rua das Flores,123,Apto 45,Centro,São Paulo,SP,2024-01-01,2024001,Produção
Maria Santos,98765432100,maria@empresa.com,(11) 98765-4322,01234-567,Rua das Rosas,456,,Centro,São Paulo,SP,2024-01-15,2024002,Administrativo
```

**Regras:**
- ✅ CPF sem pontos e traços (apenas números)
- ✅ Data no formato AAAA-MM-DD (2024-01-01)
- ✅ Complemento pode ficar vazio
- ✅ Email deve ser único

5. Faça upload do arquivo
6. Clique em **"Importar"**

✅ **Sucesso:**
```
✅ 150 colaboradores importados com sucesso
⚠️ 3 erros encontrados:
  - Linha 5: CPF duplicado
  - Linha 12: Email inválido
  - Linha 23: Data de admissão inválida
```

---

### **3.3. Editar Colaborador**

1. Menu → **"Colaboradores"**
2. Localize o colaborador (busque por nome, CPF ou matrícula)
3. Clique em **"Editar"** (ícone ✏️)
4. Altere os campos desejados
5. Clique em **"Salvar"**

⚠️ **Atenção:**
- CPF e Email não podem duplicar
- Alteração de endereço não afeta vales já gerados

---

### **3.4. Desativar Colaborador**

Para colaboradores demitidos ou afastados:

1. Menu → **"Colaboradores"**
2. Localize o colaborador
3. Clique em **"Desativar"** (ícone 🚫)
4. Confirme a desativação

**O que acontece:**
- ❌ Colaborador não receberá mais vales automáticos
- ❌ Não poderá fazer login
- ✅ Histórico de vales é mantido
- ✅ Vales ativos ainda podem ser utilizados
- ✅ Pode ser reativado depois

---

### **3.5. Resetar Senha de Colaborador**

Se o colaborador esqueceu a senha:

1. Menu → **"Colaboradores"**
2. Localize o colaborador
3. Clique em **"Resetar Senha"** (ícone 🔑)
4. Sistema gera nova senha aleatória
5. Senha é enviada por email (se configurado)

📧 **Email enviado:**
```
Assunto: Senha Redefinida - Sistema Vale-Gás

Sua senha foi redefinida.

Nova senha: XYZ98765

Faça login e altere sua senha em:
https://seu-sistema.up.railway.app/colaborador.html
```

---

### **3.6. Ver Histórico de Vales do Colaborador**

1. Menu → **"Colaboradores"**
2. Localize o colaborador
3. Clique em **"Histórico"** (ícone 📋)

**Você verá:**
```
┌──────────────────────────────────────────────────┐
│  Histórico de Vales - João da Silva              │
├──────────────────────────────────────────────────┤
│  Dezembro/2024                                   │
│  Código: VG-A1B2C3                               │
│  Status: ✅ Utilizado                            │
│  Retirado em: 15/12/2024 às 14:30               │
│  Distribuidor: Gás Comercial Ltda                │
├──────────────────────────────────────────────────┤
│  Novembro/2024                                   │
│  Código: VG-X9Y8Z7                               │
│  Status: ⏳ Expirado                             │
│  Expirou em: 30/11/2024                          │
├──────────────────────────────────────────────────┤
│  Outubro/2024                                    │
│  Código: VG-M5N6P7                               │
│  Status: ✅ Utilizado                            │
│  Retirado em: 10/10/2024 às 09:15               │
│  Distribuidor: Distribuidora Central             │
└──────────────────────────────────────────────────┘
```

---

## 4. Gestão de Distribuidores

### **4.1. Cadastrar Distribuidor**

1. Menu → **"Distribuidores"**
2. Clique em **"+ Novo Distribuidor"**
3. Preencha os dados:

**Dados da Empresa:**
```
Nome Fantasia: Gás Comercial Ltda
CNPJ: 12.345.678/0001-90
Email: contato@gascomercial.com.br
Telefone: (11) 3333-4444
Responsável: Carlos Mendes
```

**Endereço:**
```
CEP: 01234-567
Logradouro: Av. Principal
Número: 1000
Complemento: Loja 1
Bairro: Centro
Cidade: São Paulo
Estado: SP
```

**Dados Operacionais:**
```
Horário de Funcionamento: Seg-Sex: 8h-18h | Sáb: 8h-12h
Senha de Acesso: [gerada automaticamente]
```

4. Clique em **"Cadastrar"**

✅ **Sucesso:**
- Distribuidor criado
- Coordenadas GPS calculadas automaticamente (para proximidade)
- Senha enviada por email
- Distribuidor já pode validar códigos

---

### **4.2. Editar Distribuidor**

1. Menu → **"Distribuidores"**
2. Localize o distribuidor
3. Clique em **"Editar"**
4. Altere os campos
5. Clique em **"Salvar"**

⚠️ **Nota:** Alteração de endereço recalcula coordenadas GPS automaticamente

---

### **4.3. Desativar Distribuidor**

Para distribuidores que não são mais parceiros:

1. Menu → **"Distribuidores"**
2. Localize o distribuidor
3. Clique em **"Desativar"**

**O que acontece:**
- ❌ Não aparece mais na lista de distribuidores próximos
- ❌ Não pode validar novos códigos
- ✅ Histórico de retiradas mantido

---

### **4.4. Ver Estatísticas do Distribuidor**

1. Menu → **"Distribuidores"**
2. Localize o distribuidor
3. Clique em **"Estatísticas"**

**Você verá:**
```
┌────────────────────────────────────────────┐
│  Gás Comercial Ltda                        │
├────────────────────────────────────────────┤
│  📊 Retiradas no Mês: 45                   │
│  📊 Total de Retiradas: 523                │
│  ⭐ Avaliação Média: 4.7/5.0               │
│  📝 Total de Avaliações: 89                │
│                                            │
│  🏆 Top 3 Comentários Recentes:            │
│  ⭐⭐⭐⭐⭐ "Ótimo atendimento!"          │
│  ⭐⭐⭐⭐⭐ "Rápido e eficiente"          │
│  ⭐⭐⭐⭐ "Bom, mas local pequeno"        │
└────────────────────────────────────────────┘
```

---

## 5. Gestão de Vales-Gás

### **5.1. Gerar Vales Manualmente**

Para gerar vales fora do período automático:

1. Menu → **"Vales-Gás"**
2. Clique em **"Gerar Vales"**
3. Selecione:
   - **Mês de Referência**: Dezembro/2024
   - **Colaboradores**: Todos ou selecionados
   - **Data de Expiração**: 30 dias (padrão)
4. Clique em **"Gerar"**

✅ **Sucesso:**
```
✅ 150 vales gerados com sucesso!

Mês: Dezembro/2024
Validade: 30 dias
Expira em: 31/12/2024
```

⚠️ **Atenção:**
- Não gera vale duplicado se colaborador já tem vale do mês
- Apenas colaboradores ativos recebem vales

---

### **5.2. Consultar Vale Específico**

1. Menu → **"Vales-Gás"**
2. Digite o código: `VG-A1B2C3`
3. Clique em **"Buscar"**

**Informações exibidas:**
```
┌─────────────────────────────────────────┐
│  Vale-Gás: VG-A1B2C3                    │
├─────────────────────────────────────────┤
│  Colaborador: João da Silva             │
│  CPF: 123.456.789-00                    │
│  Matrícula: 2024001                     │
│                                         │
│  Mês Referência: Dezembro/2024          │
│  Gerado em: 01/12/2024                  │
│  Expira em: 31/12/2024                  │
│                                         │
│  Status: ✅ UTILIZADO                   │
│  Retirado em: 15/12/2024 14:30          │
│  Distribuidor: Gás Comercial Ltda       │
│  Local: Av. Principal, 1000             │
└─────────────────────────────────────────┘
```

---

### **5.3. Cancelar Vale**

Em casos excepcionais:

1. Menu → **"Vales-Gás"**
2. Busque o vale
3. Clique em **"Cancelar"**
4. Digite o motivo:
   ```
   Motivo: Colaborador afastado por licença médica
   ```
5. Confirme

⚠️ **Atenção:**
- Vale cancelado não pode ser reativado
- Colaborador não poderá usar o código
- Ação é registrada em auditoria

---

## 6. Relatórios

### **6.1. Relatório Mensal de Vales**

1. Menu → **"Relatórios"**
2. Selecione **"Relatório Mensal"**
3. Escolha o mês: **Dezembro/2024**
4. Clique em **"Gerar"**

**Relatório gerado:**
```
═══════════════════════════════════════════════
RELATÓRIO MENSAL DE VALES-GÁS
Mês: Dezembro/2024
═══════════════════════════════════════════════

📊 RESUMO GERAL
- Vales Gerados: 150
- Vales Utilizados: 132 (88%)
- Vales Pendentes: 16 (10.7%)
- Vales Expirados: 2 (1.3%)

💰 VALOR ESTIMADO
- Valor Unitário: R$ 100,00
- Total Gerado: R$ 15.000,00
- Total Utilizado: R$ 13.200,00
- Economia (não utilizado): R$ 1.800,00

🏪 DISTRIBUIDORES MAIS UTILIZADOS
1. Gás Comercial Ltda - 45 retiradas (34.1%)
2. Distribuidora Central - 38 retiradas (28.8%)
3. Super Gás - 25 retiradas (18.9%)
4. Outros - 24 retiradas (18.2%)

📈 TENDÊNCIA
- Mês Anterior: 135 utilizações (90%)
- Variação: -2% ⚠️

═══════════════════════════════════════════════
```

**Opções:**
- 📄 **Exportar PDF**
- 📊 **Exportar Excel**
- 📧 **Enviar por Email**

---

### **6.2. Relatório de Colaborador**

Para ver histórico completo de um colaborador:

1. Menu → **"Relatórios"**
2. Selecione **"Relatório Individual"**
3. Digite CPF ou Matrícula
4. Selecione período: **Jan/2024 a Dez/2024**
5. Clique em **"Gerar"**

**Você verá:**
- Total de vales recebidos
- Taxa de utilização
- Distribuidores preferidos
- Histórico mês a mês

---

### **6.3. Relatório de Distribuidor**

1. Menu → **"Relatórios"**
2. Selecione **"Relatório de Distribuidor"**
3. Escolha o distribuidor
4. Período: **Último trimestre**
5. Clique em **"Gerar"**

**Informações:**
- Total de retiradas
- Avaliação média
- Comentários dos colaboradores
- Gráfico de retiradas por mês

---

## 7. Configurações do Sistema

### **7.1. Configurações Gerais**

1. Menu → **"Configurações"**

**Parâmetros configuráveis:**

```
┌──────────────────────────────────────────────┐
│  CONFIGURAÇÕES DO SISTEMA                    │
├──────────────────────────────────────────────┤
│  Valor do Vale-Gás: R$ 100,00                │
│  Dias de Validade: 30 dias                   │
│  Dia de Geração Automática: 1º dia do mês    │
│  Habilitar Geração Automática: ✅ Sim        │
│  Habilitar Avaliações: ✅ Sim                │
│  Enviar Email de Senha: ❌ Não (SMTP não configurado) │
│  Enviar Lembrete de Expiração: ❌ Não        │
└──────────────────────────────────────────────┘
```

**Como alterar:**
1. Clique no campo desejado
2. Digite novo valor
3. Clique em **"Salvar"**

✅ Alteração aplicada imediatamente!

---

### **7.2. Configurar Geração Automática**

Para gerar vales automaticamente todo dia 1º:

1. Menu → **"Configurações"**
2. **Habilitar Geração Automática**: ✅ Marque
3. **Dia de Geração**: 1
4. **Dias de Validade**: 30
5. Clique em **"Salvar"**

**O que acontece:**
- 📅 Todo dia 1º às 00:00
- 🎫 Sistema gera vales para todos colaboradores ativos
- 📧 Envia email com código (se SMTP configurado)
- 📊 Registra em auditoria

---

### **7.3. Configurar SMTP (Email)**

Para enviar emails automáticos:

1. Menu → **"Configurações"** → **"SMTP"**
2. Preencha:

```
Host SMTP: smtp.gmail.com
Porta: 587
Usuário: noreply@suaempresa.com.br
Senha: [senha do email]
Remetente: Sistema Vale-Gás <noreply@suaempresa.com.br>
```

3. Clique em **"Testar Conexão"**
4. Se OK, clique em **"Salvar"**

✅ **Emails habilitados:**
- Senha de novo colaborador
- Reset de senha
- Código de vale gerado
- Lembrete de expiração

---

## 8. Auditoria e Logs

### **8.1. Ver Logs de Auditoria**

1. Menu → **"Auditoria"**
2. Filtros disponíveis:
   - **Tipo de Usuário**: Admin, Colaborador, Distribuidor
   - **Ação**: Login, Criar, Editar, Deletar, etc.
   - **Período**: Últimas 24h, 7 dias, 30 dias
   - **Usuário**: Nome ou ID

**Exemplo de log:**
```
┌───────────────────────────────────────────────────────┐
│  2024-12-06 14:30:15                                  │
│  👨‍💼 Admin: Maria Santos (maria@empresa.com.br)     │
│  Ação: CRIAR_COLABORADOR                              │
│  Detalhes: Criou colaborador "João Silva" (CPF: 123.456.789-00) │
│  IP: 192.168.1.100                                    │
├───────────────────────────────────────────────────────┤
│  2024-12-06 14:15:23                                  │
│  👷 Colaborador: Pedro Souza                          │
│  Ação: LOGIN                                          │
│  Detalhes: Login bem-sucedido                         │
│  IP: 192.168.1.50                                     │
├───────────────────────────────────────────────────────┤
│  2024-12-06 13:45:10                                  │
│  🏪 Distribuidor: Gás Comercial Ltda                  │
│  Ação: VALIDAR_CODIGO                                 │
│  Detalhes: Validou código VG-A1B2C3                   │
│  IP: 192.168.1.200                                    │
└───────────────────────────────────────────────────────┘
```

**Exportar:**
- 📄 PDF
- 📊 CSV
- 📧 Email

---

## 9. Solicitações de Alteração

Colaboradores podem solicitar alterações de dados:

1. Menu → **"Solicitações"**
2. Ver solicitações pendentes

**Exemplo:**
```
┌──────────────────────────────────────────────┐
│  SOLICITAÇÃO #001                            │
│  Colaborador: João da Silva                  │
│  Tipo: Alteração de Endereço                 │
│  Data: 05/12/2024                            │
│                                              │
│  Descrição:                                  │
│  "Mudei de endereço. Novo CEP: 98765-432"   │
│                                              │
│  Dados Novos:                                │
│  CEP: 98765-432                              │
│  Logradouro: Rua Nova                        │
│  Número: 789                                 │
│                                              │
│  [Aprovar] [Rejeitar]                        │
└──────────────────────────────────────────────┘
```

**Para aprovar:**
1. Clique em **"Aprovar"**
2. Dados são atualizados automaticamente

**Para rejeitar:**
1. Clique em **"Rejeitar"**
2. Digite motivo: `"Falta comprovante de endereço"`
3. Colaborador recebe notificação

---

# 👷 Manual do Colaborador

## 1. Acesso ao Sistema

### **1.1. Primeiro Acesso**

1. Você receberá email do RH com:
   ```
   Acesso: https://seu-sistema.up.railway.app/colaborador.html
   Email: seu.email@empresa.com.br
   Senha: ABC12345
   ```

2. Acesse o link
3. Faça login com email e senha
4. **Sistema pedirá para alterar senha**
5. Digite nova senha:
   ```
   Nova Senha: ********
   Confirmar: ********
   ```
6. Clique em **"Alterar Senha"**

✅ **Pronto!** Senha alterada. Faça login novamente.

---

## 2. Dashboard do Colaborador

Ao fazer login, você verá:

```
┌─────────────────────────────────────────────────┐
│  Olá, João da Silva! 👋                         │
├─────────────────────────────────────────────────┤
│  🎫 SEU VALE-GÁS DO MÊS                         │
│                                                 │
│  Mês: Dezembro/2024                             │
│  Código: VG-A1B2C3                              │
│                                                 │
│  ⏱️ Expira em: 15 dias                          │
│  📅 Válido até: 31/12/2024                      │
│                                                 │
│  Status: ⏳ ATIVO - Pode ser usado              │
│                                                 │
│  [Ver Código Grande] [Distribuidores Próximos] │
└─────────────────────────────────────────────────┘
```

---

## 3. Como Usar Seu Vale-Gás

### **3.1. Ver Código do Vale**

1. Dashboard → Clique em **"Ver Código Grande"**
2. Código será exibido em tamanho grande:

```
═════════════════════════════
    SEU VALE-GÁS
═════════════════════════════

      VG-A1B2C3

═════════════════════════════
Mostre este código ao
distribuidor para retirar
seu botijão de gás.
═════════════════════════════
```

**💡 Dica:** Tire print ou anote o código!

---

### **3.2. Encontrar Distribuidores Próximos**

1. Dashboard → Clique em **"Distribuidores Próximos"**
2. Sistema mostra lista ordenada por proximidade:

```
┌──────────────────────────────────────────────┐
│  📍 DISTRIBUIDORES PRÓXIMOS                  │
│  Seu endereço: São Paulo/SP                  │
├──────────────────────────────────────────────┤
│  1. 🏪 Gás Comercial Ltda                    │
│     Av. Principal, 1000 - Centro             │
│     São Paulo/SP                             │
│     ⭐ 4.7 (89 avaliações)                   │
│     📞 (11) 3333-4444                        │
│     🕐 Seg-Sex: 8h-18h | Sáb: 8h-12h         │
│     📍 Mesma cidade                          │
├──────────────────────────────────────────────┤
│  2. 🏪 Distribuidora Central                 │
│     Rua das Flores, 500 - Vila Nova          │
│     São Paulo/SP                             │
│     ⭐ 4.5 (67 avaliações)                   │
│     📞 (11) 2222-3333                        │
│     🕐 Seg-Sáb: 7h-19h                       │
│     📍 Mesma cidade                          │
├──────────────────────────────────────────────┤
│  3. 🏪 Super Gás                             │
│     Av. Comercial, 2000 - Jardim             │
│     São Paulo/SP                             │
│     ⭐ 4.8 (123 avaliações)                  │
│     📞 (11) 4444-5555                        │
│     🕐 Seg-Dom: 8h-20h                       │
│     📍 Mesma cidade                          │
└──────────────────────────────────────────────┘
```

---

### **3.3. Retirar o Gás**

**Passo a passo:**

1. Escolha um distribuidor da lista
2. Vá até o local
3. Mostre o código ao atendente: **VG-A1B2C3**
4. Atendente valida o código no sistema dele
5. ✅ **Retire seu botijão de gás!**

**⏱️ O que acontece:**
- Sistema registra data/hora da retirada
- Vale fica como "UTILIZADO"
- Você não pode usar o mesmo código de novo
- Próximo vale será gerado no mês seguinte

---

## 4. Histórico de Vales

Para ver seus vales anteriores:

1. Menu → **"Histórico"**
2. Ver lista completa:

```
┌──────────────────────────────────────────────┐
│  📋 MEU HISTÓRICO DE VALES                   │
├──────────────────────────────────────────────┤
│  Dezembro/2024                               │
│  VG-A1B2C3                                   │
│  ✅ Utilizado em: 15/12/2024 14:30           │
│  Local: Gás Comercial Ltda                   │
│  [Avaliar] ⭐⭐⭐⭐⭐                          │
├──────────────────────────────────────────────┤
│  Novembro/2024                               │
│  VG-X9Y8Z7                                   │
│  ⏳ Expirado em: 30/11/2024                  │
│  (Não utilizado)                             │
├──────────────────────────────────────────────┤
│  Outubro/2024                                │
│  VG-M5N6P7                                   │
│  ✅ Utilizado em: 10/10/2024 09:15           │
│  Local: Distribuidora Central                │
│  ⭐⭐⭐⭐⭐ "Ótimo atendimento!"              │
└──────────────────────────────────────────────┘
```

---

## 5. Avaliar Distribuidor

Após retirar o gás, você pode avaliar:

1. Menu → **"Histórico"**
2. Localize a retirada recente
3. Clique em **"Avaliar"**
4. Preencha:

```
┌──────────────────────────────────────────────┐
│  AVALIAR: Gás Comercial Ltda                 │
├──────────────────────────────────────────────┤
│  Como foi sua experiência?                   │
│                                              │
│  Nota: ⭐⭐⭐⭐⭐ (5/5)                        │
│                                              │
│  Comentário (opcional):                      │
│  ┌──────────────────────────────────────┐   │
│  │ Atendimento excelente! Muito rápido  │   │
│  │ e o local é limpo e organizado.      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Enviar Avaliação]                          │
└──────────────────────────────────────────────┘
```

5. Clique em **"Enviar Avaliação"**

✅ **Obrigado!** Sua avaliação ajuda outros colaboradores.

---

## 6. Solicitar Alteração de Dados

Se mudou de endereço, telefone ou email:

1. Menu → **"Meus Dados"**
2. Clique em **"Solicitar Alteração"**
3. Escolha o tipo:
   - 📍 Alteração de Endereço
   - 📞 Alteração de Telefone
   - 📧 Alteração de Email
   - 📝 Outros

4. Preencha:

```
┌──────────────────────────────────────────────┐
│  SOLICITAR ALTERAÇÃO DE ENDEREÇO             │
├──────────────────────────────────────────────┤
│  Descrição do Motivo:                        │
│  ┌──────────────────────────────────────┐   │
│  │ Mudei de endereço. Preciso atualizar │   │
│  │ para receber correspondências.       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Novos Dados:                                │
│  CEP: 98765-432                              │
│  Logradouro: Rua Nova                        │
│  Número: 789                                 │
│  Complemento: Casa                           │
│  Bairro: Jardim Novo                         │
│  Cidade: São Paulo                           │
│  Estado: SP                                  │
│                                              │
│  [Enviar Solicitação]                        │
└──────────────────────────────────────────────┘
```

5. Clique em **"Enviar"**

**O que acontece:**
- 📨 Solicitação enviada ao RH
- ⏳ RH analisa (pode pedir documentos)
- ✅ Se aprovado: dados atualizados automaticamente
- ❌ Se rejeitado: você recebe o motivo

**Ver status:**
- Menu → **"Minhas Solicitações"**

```
┌──────────────────────────────────────────────┐
│  Solicitação #001                            │
│  Tipo: Alteração de Endereço                 │
│  Data: 05/12/2024                            │
│  Status: ⏳ PENDENTE (aguardando RH)         │
└──────────────────────────────────────────────┘
```

---

## 7. Alterar Senha

1. Menu → **"Configurações"** → **"Alterar Senha"**
2. Preencha:

```
Senha Atual: ********
Nova Senha: ********
Confirmar Nova Senha: ********
```

3. Clique em **"Alterar"**

✅ **Senha alterada!** Faça login novamente.

⚠️ **Dica de segurança:**
- Use senha com 8+ caracteres
- Misture letras, números e símbolos
- Não use senhas óbvias (123456, senha123, etc)

---

## 8. Esqueci Minha Senha

Se esqueceu a senha:

1. Tela de login → Clique em **"Esqueci minha senha"**
2. Digite seu **email** ou **CPF**
3. Clique em **"Recuperar"**

**📧 Email enviado:**
```
Assunto: Recuperação de Senha

Use o link abaixo para criar nova senha:
https://seu-sistema.up.railway.app/reset?token=ABC123

Link válido por 1 hora.
```

4. Clique no link do email
5. Digite nova senha
6. Pronto! Faça login.

⚠️ **Se não recebeu email:**
- Verifique spam/lixo eletrônico
- Confirme que email está correto no cadastro
- Entre em contato com RH

---

# 🏪 Manual do Distribuidor

## 1. Acesso ao Sistema

### **1.1. Fazer Login**

1. Acesse: `https://seu-sistema.up.railway.app/distribuidor.html`
2. Digite:
   - **Email/CNPJ**: contato@gascomercial.com.br
   - **Senha**: Senha fornecida pelo RH
3. Clique em **"Entrar"**

✅ **Sucesso:** Redirecionado para painel do distribuidor

---

## 2. Dashboard do Distribuidor

```
┌─────────────────────────────────────────────────┐
│  🏪 Gás Comercial Ltda                          │
├─────────────────────────────────────────────────┤
│  📊 ESTATÍSTICAS DO MÊS                         │
│                                                 │
│  Retiradas hoje: 12                             │
│  Retiradas no mês: 145                          │
│  Avaliação: ⭐ 4.7/5.0 (89 avaliações)         │
│                                                 │
│  [Validar Código] [Histórico] [Avaliações]     │
└─────────────────────────────────────────────────┘
```

---

## 3. Validar Código de Vale

**Principal função do distribuidor:**

### **3.1. Passo a Passo**

1. Cliente chega com código
2. Dashboard → Clique em **"Validar Código"**
3. Digite ou escaneie o código:

```
┌──────────────────────────────────────────────┐
│  VALIDAR CÓDIGO                              │
├──────────────────────────────────────────────┤
│  Digite o código do vale:                   │
│  ┌──────────────────────────────────────┐   │
│  │  VG-A1B2C3                           │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Validar] [Limpar]                          │
└──────────────────────────────────────────────┘
```

4. Clique em **"Validar"**

---

### **3.2. Código VÁLIDO ✅**

```
╔════════════════════════════════════════════╗
║  ✅ CÓDIGO VÁLIDO!                         ║
╠════════════════════════════════════════════╣
║  Colaborador: João da Silva                ║
║  CPF: 123.456.789-00                       ║
║  Empresa: Sua Empresa Ltda                 ║
║                                            ║
║  Mês: Dezembro/2024                        ║
║  Válido até: 31/12/2024                    ║
║                                            ║
║  ⚠️ CONFIRME OS DADOS DO CLIENTE          ║
║                                            ║
║  [✅ Confirmar Retirada] [❌ Cancelar]    ║
╚════════════════════════════════════════════╝
```

**Você deve:**
1. ✅ Verificar identidade do cliente (peça RG/CPF)
2. ✅ Confirmar que CPF bate com o código
3. ✅ Clicar em **"Confirmar Retirada"**
4. ✅ Entregar o botijão de gás

**Sistema registra:**
- Data e hora exata
- Distribuidor que validou
- Localização (seu estabelecimento)

---

### **3.3. Código INVÁLIDO ❌**

```
╔════════════════════════════════════════════╗
║  ❌ CÓDIGO INVÁLIDO                        ║
╠════════════════════════════════════════════╣
║  Motivo: Código já foi utilizado           ║
║                                            ║
║  Data da utilização: 10/12/2024 14:30      ║
║  Local: Distribuidora Central              ║
║                                            ║
║  ⚠️ NÃO ENTREGUE O BOTIJÃO                ║
║                                            ║
║  [OK]                                      ║
╚════════════════════════════════════════════╝
```

**Possíveis motivos:**
- ❌ Código já utilizado
- ❌ Código expirado
- ❌ Código não existe
- ❌ Colaborador desativado

**O que fazer:**
- 🚫 **NÃO entregue o botijão**
- 💬 Informe o cliente educadamente
- 📞 Oriente cliente a contactar RH da empresa

---

### **3.4. Código EXPIRADO ⏰**

```
╔════════════════════════════════════════════╗
║  ⏰ CÓDIGO EXPIRADO                        ║
╠════════════════════════════════════════════╣
║  Colaborador: Maria Santos                 ║
║  CPF: 987.654.321-00                       ║
║                                            ║
║  Mês: Novembro/2024                        ║
║  Expirou em: 30/11/2024                    ║
║                                            ║
║  ⚠️ Este código não é mais válido          ║
║                                            ║
║  [OK]                                      ║
╚════════════════════════════════════════════╝
```

**O que fazer:**
- Informe que código expirou
- Oriente a buscar novo código no sistema
- RH gera novo código se ainda for o mês vigente

---

## 4. Histórico de Validações

Para ver suas validações:

1. Menu → **"Histórico"**
2. Filtros:
   - **Hoje**: Ver validações de hoje
   - **Semana**: Últimos 7 dias
   - **Mês**: Mês atual
   - **Período**: Data específica

```
┌──────────────────────────────────────────────┐
│  HISTÓRICO DE VALIDAÇÕES - HOJE              │
├──────────────────────────────────────────────┤
│  15:30 - VG-A1B2C3                           │
│  Colaborador: João da Silva                  │
│  Status: ✅ Confirmado                       │
├──────────────────────────────────────────────┤
│  14:15 - VG-X9Y8Z7                           │
│  Colaborador: Maria Santos                   │
│  Status: ✅ Confirmado                       │
├──────────────────────────────────────────────┤
│  13:45 - VG-M5N6P7                           │
│  Colaborador: Pedro Souza                    │
│  Status: ✅ Confirmado                       │
├──────────────────────────────────────────────┤
│  Total hoje: 12 retiradas                    │
└──────────────────────────────────────────────┘
```

**Exportar:**
- 📄 PDF
- 📊 Excel

---

## 5. Ver Avaliações

Para ver o que os colaboradores acham do seu atendimento:

1. Menu → **"Avaliações"**

```
┌──────────────────────────────────────────────┐
│  📊 SUAS AVALIAÇÕES                          │
├──────────────────────────────────────────────┤
│  Avaliação Geral: ⭐ 4.7/5.0                │
│  Total de Avaliações: 89                     │
│                                              │
│  ⭐⭐⭐⭐⭐ (67 avaliações) - 75%             │
│  ⭐⭐⭐⭐ (18 avaliações) - 20%               │
│  ⭐⭐⭐ (4 avaliações) - 5%                   │
│  ⭐⭐ (0 avaliações) - 0%                     │
│  ⭐ (0 avaliações) - 0%                       │
├──────────────────────────────────────────────┤
│  COMENTÁRIOS RECENTES                        │
├──────────────────────────────────────────────┤
│  ⭐⭐⭐⭐⭐                                    │
│  "Atendimento excelente! Muito rápido."      │
│  - João Silva, 15/12/2024                    │
├──────────────────────────────────────────────┤
│  ⭐⭐⭐⭐⭐                                    │
│  "Sempre bem atendido. Local limpo."         │
│  - Maria Santos, 14/12/2024                  │
├──────────────────────────────────────────────┤
│  ⭐⭐⭐⭐                                      │
│  "Bom atendimento, mas fila demorada."       │
│  - Pedro Souza, 13/12/2024                   │
└──────────────────────────────────────────────┘
```

**💡 Dica:** Use as avaliações para melhorar seu atendimento!

---

## 6. Atualizar Dados do Estabelecimento

1. Menu → **"Meus Dados"**
2. Ver dados cadastrados:

```
Gás Comercial Ltda
CNPJ: 12.345.678/0001-90
Email: contato@gascomercial.com.br
Telefone: (11) 3333-4444
Responsável: Carlos Mendes

Endereço:
Av. Principal, 1000 - Loja 1
Centro - São Paulo/SP
CEP: 01234-567

Horário de Funcionamento:
Seg-Sex: 8h-18h
Sáb: 8h-12h
Dom: Fechado
```

**Para alterar:**
- Entre em contato com RH da empresa
- RH atualizará seus dados no sistema

---

# 🔄 Fluxo Completo do Sistema

## Ciclo Mensal do Vale-Gás

```
┌──────────────────────────────────────────────────────────┐
│  DIA 1 DO MÊS (Automático)                               │
│  ↓                                                        │
│  🤖 Sistema gera códigos para todos colaboradores        │
│  📧 Envia email com código (se SMTP configurado)         │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  COLABORADOR                                             │
│  ↓                                                        │
│  📱 Acessa sistema e vê código                           │
│  🔍 Busca distribuidor próximo                           │
│  🚗 Vai até o distribuidor                               │
│  📋 Mostra código                                        │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  DISTRIBUIDOR                                            │
│  ↓                                                        │
│  💻 Valida código no sistema                             │
│  ✅ Sistema confirma validade                            │
│  👤 Distribuidor confere identidade                      │
│  📦 Entrega botijão de gás                               │
│  ✅ Confirma retirada no sistema                         │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  SISTEMA (Automático)                                    │
│  ↓                                                        │
│  📝 Registra data/hora da retirada                       │
│  🔒 Marca código como "UTILIZADO"                        │
│  💾 Salva no histórico                                   │
│  📊 Atualiza estatísticas                                │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  COLABORADOR (Opcional)                                  │
│  ↓                                                        │
│  ⭐ Avalia distribuidor (1-5 estrelas)                   │
│  💬 Deixa comentário                                     │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  FIM DO MÊS                                              │
│  ↓                                                        │
│  ⏰ Códigos não utilizados expiram automaticamente       │
│  📊 Relatórios mensais gerados                           │
│  🔄 Processo reinicia no dia 1 do próximo mês            │
└──────────────────────────────────────────────────────────┘
```

---

# ❓ Perguntas Frequentes (FAQ)

## Para Administradores

**P: Posso gerar vales fora do dia 1º?**
R: Sim! Menu → Vales-Gás → Gerar Vales. Você pode gerar manualmente a qualquer momento.

**P: O que acontece se um colaborador não usar o vale?**
R: O código expira automaticamente após 30 dias (ou prazo configurado). No próximo mês, novo código será gerado.

**P: Posso cancelar um vale já utilizado?**
R: Não. Após confirmação da retirada, o vale não pode ser cancelado. Apenas vales pendentes podem ser cancelados.

**P: Como faço backup do banco de dados?**
R: Sistema faz backup automático diariamente às 2h da manhã. Backups ficam salvos por 30 dias.

**P: Quantos distribuidores posso cadastrar?**
R: Ilimitado! Cadastre quantos parceiros precisar.

---

## Para Colaboradores

**P: Não recebi meu código do mês. O que fazer?**
R: Faça login no sistema. Seu código está lá, mesmo sem email. Se não aparecer, contacte RH.

**P: Posso usar meu código em qualquer distribuidor?**
R: Sim! O código funciona em todos os distribuidores parceiros cadastrados no sistema.

**P: Perdi meu código. Como recupero?**
R: Faça login no sistema. Seu código sempre estará disponível lá.

**P: Posso transferir meu vale para outra pessoa?**
R: Não. O vale é pessoal e intransferível. O distribuidor verificará sua identidade.

**P: Mudei de endereço. Como atualizo?**
R: Menu → Solicitar Alteração → Preencha novo endereço. RH irá aprovar.

**P: Posso retirar o gás em dois distribuidores diferentes?**
R: Não. Cada código pode ser usado apenas uma vez, em um único distribuidor.

---

## Para Distribuidores

**P: O que faço se o código não funcionar?**
R: Sistema mostra o motivo (expirado, já usado, inválido). Informe o cliente educadamente e oriente a contactar RH da empresa.

**P: Preciso conferir documento do colaborador?**
R: **SIM!** Sempre verifique se o CPF do documento bate com o CPF mostrado no sistema.

**P: Posso cancelar uma validação já confirmada?**
R: Não. Após confirmar retirada, o registro fica permanente. Confira bem antes de confirmar!

**P: Como melhoro minha avaliação?**
R:
- Atendimento rápido e educado
- Local limpo e organizado
- Horário de funcionamento cumprido
- Botijões em bom estado

---

# 📞 Suporte

## Contatos

**Suporte Técnico (Sistema):**
- 📧 Email: suporte@suaempresa.com.br
- 📞 Telefone: (11) 9999-8888
- 💬 Horário: Seg-Sex, 8h-18h

**RH (Dúvidas sobre Vale-Gás):**
- 📧 Email: rh@suaempresa.com.br
- 📞 Ramal: 2000

## Problemas Comuns

### Não consigo fazer login
1. Verifique email e senha
2. Caps Lock está desligado?
3. Navegador está atualizado?
4. Limpe cache do navegador
5. Tente "Esqueci minha senha"

### Sistema está lento
1. Verifique sua conexão com internet
2. Feche abas desnecessárias do navegador
3. Tente outro navegador (Chrome, Firefox, Edge)

### Código não aparece
1. Faça logout e login novamente
2. Limpe cache do navegador (Ctrl+F5)
3. Verifique se você está no mês correto
4. Contacte RH se persistir

---

# 📊 Glossário

**Vale-Gás**: Benefício mensal em forma de código digital para retirar botijão de gás.

**Código**: Sequência alfanumérica única (ex: VG-A1B2C3) que identifica o vale.

**Distribuidor**: Estabelecimento credenciado onde o colaborador retira o gás.

**Validação**: Processo de confirmar que o código é válido antes de entregar o gás.

**Expiração**: Data limite para usar o código. Após essa data, código fica inválido.

**Auditoria**: Registro de todas as ações no sistema para segurança e transparência.

**RH**: Recursos Humanos - departamento responsável pelo benefício.

**SMTP**: Protocolo para envio de emails automáticos do sistema.

---

# 🎓 Boas Práticas

## Para Administradores
✅ Faça backup manual antes de alterações importantes
✅ Revise logs de auditoria semanalmente
✅ Acompanhe taxa de utilização mensal
✅ Responda solicitações de alteração rapidamente
✅ Mantenha dados de distribuidores atualizados

## Para Colaboradores
✅ Anote ou tire print do código
✅ Use o vale dentro do prazo
✅ Avalie o distribuidor após retirada
✅ Mantenha seus dados cadastrais atualizados
✅ Altere senha periodicamente

## Para Distribuidores
✅ **SEMPRE** confira identidade do cliente
✅ Confirme CPF antes de entregar o gás
✅ Registre retirada imediatamente
✅ Mantenha horário de funcionamento atualizado
✅ Responda avaliações negativas com melhorias

---

**Versão do Manual:** 2.0.0
**Última Atualização:** Dezembro 2024
**Sistema:** Vale-Gás v2.0

---

_Este manual é um documento vivo. Sugestões de melhorias são bem-vindas!_

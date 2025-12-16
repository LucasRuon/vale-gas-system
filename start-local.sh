#!/bin/bash

# ============================================
# Script para Iniciar o Sistema Localmente
# ============================================

echo "🚀 Iniciando Sistema Vale-Gás v2.0 - Modo Local"
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado!"
    echo "📥 Instale em: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado!"
    exit 1
fi

echo "✅ npm $(npm -v) detectado"
echo ""

# Copiar arquivo .env.local para .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env a partir de .env.local..."
    cp .env.local .env
    echo "✅ Arquivo .env criado!"
    echo ""
else
    echo "✅ Arquivo .env já existe"
    echo ""
fi

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
else
    echo "✅ Dependências já instaladas"
    echo ""
fi

# Criar diretórios necessários
echo "📁 Criando diretórios necessários..."
mkdir -p data
mkdir -p data/backups
mkdir -p logs
echo "✅ Diretórios criados!"
echo ""

# Dar permissão de execução ao script de backup
if [ -f "scripts/backup.sh" ]; then
    chmod +x scripts/backup.sh
    echo "✅ Permissões de backup configuradas"
    echo ""
fi

# Exibir informações
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 INFORMAÇÕES DO SISTEMA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 URL: http://localhost:3000"
echo "🔍 Health Check: http://localhost:3000/api/health"
echo "📧 Admin: admin@consigaz.com.br"
echo "🔑 Senha: Admin123!@#"
echo "📁 Banco: ./data/database.sqlite"
echo "📋 Logs: ./logs/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Iniciar servidor
echo "🎯 Iniciando servidor..."
echo "⏸️  Pressione Ctrl+C para parar"
echo ""

npm start

#!/bin/bash

# ============================================
# Script de Backup Automático - Vale-Gás
# ============================================

# Detectar ambiente (Railway ou local)
if [ -n "$RAILWAY_ENVIRONMENT" ]; then
    # Railway - usa volume persistente
    DATA_DIR="/data"
    BACKUP_DIR="/data/backups"
    DB_FILE="/data/database.sqlite"
else
    # Local - usa diretório data
    DATA_DIR="./data"
    BACKUP_DIR="./data/backups"
    DB_FILE="./data/database.sqlite"
fi

# Criar diretório se não existir
mkdir -p "$BACKUP_DIR"

# Nome do arquivo de backup com timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/database_$TIMESTAMP.sqlite"

# Verificar se banco existe
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Erro: Banco de dados não encontrado em $DB_FILE"
    exit 1
fi

# Fazer backup
echo "📦 Iniciando backup do banco de dados..."
cp "$DB_FILE" "$BACKUP_FILE"

# Verificar se backup foi criado
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup criado com sucesso: $BACKUP_FILE ($SIZE)"

    # Remover backups com mais de 30 dias
    echo "🗑️  Removendo backups antigos (mais de 30 dias)..."
    find "$BACKUP_DIR" -name "database_*.sqlite" -type f -mtime +30 -delete

    # Contar backups restantes
    COUNT=$(find "$BACKUP_DIR" -name "database_*.sqlite" -type f | wc -l)
    echo "📊 Total de backups armazenados: $COUNT"

    exit 0
else
    echo "❌ Erro ao criar backup"
    exit 1
fi

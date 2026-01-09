#!/usr/bin/env node

/**
 * Script de Backup Automático do Banco de Dados
 *
 * Funcionalidades:
 * - Cria backup do database.sqlite
 * - Mantém últimos 7 backups
 * - Compacta backups antigos (opcional)
 * - Envia notificação de sucesso/falha (opcional)
 *
 * Uso:
 * - Manual: node scripts/backup-database.js
 * - Automático: Configurado no server.js via cron (2h da manhã)
 */

const fs = require('fs');
const path = require('path');

// Configuração
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
const DATA_DIR = isRailway ? '/data' : path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const MAX_BACKUPS = 7; // Manter últimos 7 backups

/**
 * Garante que o diretório de backups existe
 */
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`📁 Diretório de backups criado: ${BACKUP_DIR}`);
    }
}

/**
 * Gera nome do arquivo de backup com timestamp
 */
function getBackupFileName() {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return `backup-${date}_${time}.sqlite`;
}

/**
 * Copia o banco de dados para o backup
 */
function createBackup() {
    try {
        // Verificar se o banco existe
        if (!fs.existsSync(DB_PATH)) {
            console.error('❌ Erro: Banco de dados não encontrado em:', DB_PATH);
            return false;
        }

        const backupFile = path.join(BACKUP_DIR, getBackupFileName());

        console.log('📦 Criando backup do banco de dados...');
        console.log(`   • Origem: ${DB_PATH}`);
        console.log(`   • Destino: ${backupFile}`);

        // Copiar arquivo
        fs.copyFileSync(DB_PATH, backupFile);

        // Verificar integridade
        const originalSize = fs.statSync(DB_PATH).size;
        const backupSize = fs.statSync(backupFile).size;

        if (originalSize !== backupSize) {
            console.error('❌ Erro: Tamanho do backup diferente do original!');
            fs.unlinkSync(backupFile);
            return false;
        }

        console.log('✅ Backup criado com sucesso!');
        console.log(`   • Tamanho: ${(backupSize / 1024 / 1024).toFixed(2)} MB`);

        return true;

    } catch (error) {
        console.error('❌ Erro ao criar backup:', error.message);
        return false;
    }
}

/**
 * Remove backups antigos, mantendo apenas os últimos MAX_BACKUPS
 */
function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('backup-') && file.endsWith('.sqlite'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Mais recente primeiro

        if (files.length > MAX_BACKUPS) {
            console.log(`🧹 Limpando backups antigos (mantendo últimos ${MAX_BACKUPS})...`);

            const toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`   • Removido: ${file.name}`);
            });

            console.log(`✅ ${toDelete.length} backup(s) antigo(s) removido(s)`);
        }

    } catch (error) {
        console.error('⚠️  Erro ao limpar backups antigos:', error.message);
    }
}

/**
 * Lista todos os backups disponíveis
 */
function listBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('backup-') && file.endsWith('.sqlite'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    date: stats.mtime
                };
            })
            .sort((a, b) => b.date - a.date);

        if (files.length === 0) {
            console.log('📋 Nenhum backup encontrado');
            return;
        }

        console.log(`📋 Backups disponíveis (${files.length}):`);
        files.forEach((file, index) => {
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            const date = file.date.toLocaleString('pt-BR');
            console.log(`   ${index + 1}. ${file.name}`);
            console.log(`      • Tamanho: ${sizeMB} MB`);
            console.log(`      • Data: ${date}`);
        });

    } catch (error) {
        console.error('❌ Erro ao listar backups:', error.message);
    }
}

/**
 * Restaura um backup específico
 */
function restoreBackup(backupFileName) {
    try {
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        if (!fs.existsSync(backupPath)) {
            console.error('❌ Erro: Backup não encontrado:', backupFileName);
            return false;
        }

        console.log('⚠️  RESTAURANDO BACKUP - ISSO VAI SOBRESCREVER O BANCO ATUAL!');
        console.log(`   • Backup: ${backupFileName}`);
        console.log(`   • Destino: ${DB_PATH}`);

        // Fazer backup do estado atual antes de restaurar
        const emergencyBackup = path.join(BACKUP_DIR, `emergency-backup-${Date.now()}.sqlite`);
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, emergencyBackup);
            console.log(`   • Backup de emergência criado: ${path.basename(emergencyBackup)}`);
        }

        // Restaurar
        fs.copyFileSync(backupPath, DB_PATH);

        console.log('✅ Backup restaurado com sucesso!');
        console.log('   ⚠️  Reinicie o servidor para aplicar as mudanças');

        return true;

    } catch (error) {
        console.error('❌ Erro ao restaurar backup:', error.message);
        return false;
    }
}

/**
 * Função principal
 */
function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     SISTEMA DE BACKUP - VALE-GÁS v2.0      ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    ensureBackupDir();

    switch (command) {
        case 'create':
        case undefined:
            // Criar backup (padrão)
            const success = createBackup();
            if (success) {
                cleanOldBackups();
            }
            process.exit(success ? 0 : 1);
            break;

        case 'list':
            // Listar backups
            listBackups();
            break;

        case 'restore':
            // Restaurar backup
            const backupName = args[1];
            if (!backupName) {
                console.error('❌ Erro: Especifique o nome do backup');
                console.log('   Uso: node scripts/backup-database.js restore <nome-do-backup>');
                console.log('');
                console.log('   Backups disponíveis:');
                listBackups();
                process.exit(1);
            }
            const restored = restoreBackup(backupName);
            process.exit(restored ? 0 : 1);
            break;

        case 'help':
        default:
            console.log('Uso: node scripts/backup-database.js [comando]');
            console.log('');
            console.log('Comandos:');
            console.log('  create (padrão)    - Criar novo backup');
            console.log('  list               - Listar backups disponíveis');
            console.log('  restore <nome>     - Restaurar backup específico');
            console.log('  help               - Mostrar esta ajuda');
            console.log('');
            console.log('Exemplos:');
            console.log('  node scripts/backup-database.js');
            console.log('  node scripts/backup-database.js list');
            console.log('  node scripts/backup-database.js restore backup-2025-01-09_14-30-00.sqlite');
            console.log('');
            break;
    }
}

// Executar
if (require.main === module) {
    main();
}

module.exports = { createBackup, listBackups, restoreBackup };

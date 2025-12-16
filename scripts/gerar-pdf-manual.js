#!/usr/bin/env node

/**
 * Script para gerar PDF do Manual de Uso
 *
 * Dependências necessárias:
 * npm install --save-dev puppeteer markdown-it
 */

const fs = require('fs');
const path = require('path');

// Verificar se puppeteer está instalado
try {
    require.resolve('puppeteer');
    require.resolve('markdown-it');
} catch (e) {
    console.log('📦 Instalando dependências necessárias...');
    console.log('');
    console.log('Execute: npm install --save-dev puppeteer markdown-it');
    console.log('');
    process.exit(1);
}

const puppeteer = require('puppeteer');
const MarkdownIt = require('markdown-it');

// Configurar Markdown parser
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
});

// Caminhos
const MANUAL_PATH = path.join(__dirname, '../MANUAL_DE_USO.md');
const OUTPUT_PATH = path.join(__dirname, '../MANUAL_DE_USO.pdf');

// CSS para o PDF
const pdfStyles = `
<style>
    @page {
        size: A4;
        margin: 2cm;
    }

    * {
        box-sizing: border-box;
    }

    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 100%;
        padding: 0;
        margin: 0;
    }

    /* Capa */
    .cover {
        page-break-after: always;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        background: white;
        color: #333;
        padding: 2cm;
        border: 3px solid #1e3a8a;
    }

    .cover img {
        max-width: 250px;
        margin-bottom: 40px;
    }

    .cover h1 {
        font-size: 48px;
        margin-bottom: 20px;
        color: #333;
    }

    .cover .version {
        font-size: 24px;
        margin-bottom: 40px;
        color: #1e3a8a;
        font-weight: bold;
    }

    .cover .info {
        font-size: 18px;
        margin-top: 40px;
        color: #666;
    }

    /* Índice */
    .toc {
        page-break-after: always;
        padding: 20px;
    }

    .toc h2 {
        color: #333;
        border-bottom: 3px solid #1e3a8a;
        padding-bottom: 10px;
        margin-bottom: 30px;
    }

    .toc ul {
        list-style: none;
        padding-left: 0;
    }

    .toc li {
        padding: 10px 0;
        border-bottom: 1px solid #eee;
    }

    .toc a {
        text-decoration: none;
        color: #333;
        font-size: 16px;
    }

    .toc a:hover {
        color: #1e3a8a;
    }

    /* Títulos */
    h1 {
        color: #333;
        font-size: 32px;
        margin-top: 40px;
        margin-bottom: 20px;
        page-break-before: always;
        border-bottom: 3px solid #1e3a8a;
        padding-bottom: 10px;
    }

    h1:first-of-type {
        page-break-before: avoid;
    }

    h2 {
        color: #333;
        font-size: 24px;
        margin-top: 30px;
        margin-bottom: 15px;
        border-left: 4px solid #1e3a8a;
        padding-left: 15px;
    }

    h3 {
        color: #555;
        font-size: 20px;
        margin-top: 25px;
        margin-bottom: 10px;
    }

    h4 {
        color: #666;
        font-size: 18px;
        margin-top: 20px;
        margin-bottom: 10px;
    }

    /* Parágrafos */
    p {
        margin-bottom: 15px;
        text-align: justify;
    }

    /* Listas */
    ul, ol {
        margin-bottom: 15px;
        padding-left: 30px;
    }

    li {
        margin-bottom: 8px;
    }

    /* Tabelas */
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 14px;
        page-break-inside: avoid;
    }

    table thead {
        background-color: #1e3a8a;
        color: white;
    }

    table th, table td {
        border: 1px solid #ddd;
        padding: 12px;
        text-align: left;
    }

    table tbody tr:nth-child(even) {
        background-color: #f9f9f9;
    }

    table tbody tr:hover {
        background-color: #eff6ff;
    }

    /* Blocos de código */
    pre {
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-left: 4px solid #1e3a8a;
        padding: 15px;
        overflow-x: auto;
        border-radius: 4px;
        margin: 20px 0;
        page-break-inside: avoid;
    }

    code {
        background-color: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: #1e3a8a;
    }

    pre code {
        background-color: transparent;
        padding: 0;
        color: #333;
    }

    /* Citações */
    blockquote {
        border-left: 4px solid #1e3a8a;
        padding-left: 20px;
        margin: 20px 0;
        color: #666;
        font-style: italic;
        background-color: #f9f9f9;
        padding: 15px 20px;
        border-radius: 4px;
    }

    /* Links */
    a {
        color: #1e3a8a;
        text-decoration: none;
        border-bottom: 1px dotted #1e3a8a;
    }

    a:hover {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
    }

    /* Alertas */
    .alert {
        padding: 15px;
        margin: 20px 0;
        border-radius: 4px;
        border-left: 4px solid;
        page-break-inside: avoid;
    }

    .alert-success {
        background-color: #d4edda;
        border-color: #28a745;
        color: #155724;
    }

    .alert-warning {
        background-color: #fff3cd;
        border-color: #ffc107;
        color: #856404;
    }

    .alert-danger {
        background-color: #f8d7da;
        border-color: #dc3545;
        color: #721c24;
    }

    .alert-info {
        background-color: #d1ecf1;
        border-color: #17a2b8;
        color: #0c5460;
    }

    /* Boxes decorativos */
    .box {
        border: 2px solid #1e3a8a;
        padding: 20px;
        margin: 20px 0;
        border-radius: 8px;
        background-color: #eff6ff;
        page-break-inside: avoid;
    }

    /* Rodapé */
    .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 10px;
        color: #999;
        padding: 10px;
        border-top: 1px solid #eee;
    }

    /* Quebras de página */
    .page-break {
        page-break-after: always;
    }

    /* Não quebrar */
    .no-break {
        page-break-inside: avoid;
    }

    /* Destaque */
    .highlight {
        background-color: #fff3cd;
        padding: 2px 6px;
        border-radius: 3px;
    }

    /* Emojis e ícones */
    .emoji {
        font-size: 1.2em;
    }

    /* Impressão */
    @media print {
        body {
            background: white;
        }

        a {
            color: #333;
            border-bottom: none;
        }

        .no-print {
            display: none;
        }
    }
</style>
`;

// Função para processar Markdown e adicionar classes CSS
function processMarkdown(content) {
    // Converter emojis comuns em spans com classe
    content = content.replace(/✅/g, '<span class="emoji">✅</span>');
    content = content.replace(/❌/g, '<span class="emoji">❌</span>');
    content = content.replace(/⚠️/g, '<span class="emoji">⚠️</span>');
    content = content.replace(/📊/g, '<span class="emoji">📊</span>');
    content = content.replace(/🎯/g, '<span class="emoji">🎯</span>');
    content = content.replace(/💡/g, '<span class="emoji">💡</span>');

    // Adicionar classes para alertas
    content = content.replace(/⚠️ \*\*IMPORTANTE:\*\*/g, '<div class="alert alert-warning"><strong>⚠️ IMPORTANTE:</strong>');
    content = content.replace(/✅ \*\*Sucesso:\*\*/g, '<div class="alert alert-success"><strong>✅ Sucesso:</strong>');
    content = content.replace(/❌ \*\*Erro:/g, '<div class="alert alert-danger"><strong>❌ Erro:</strong>');
    content = content.replace(/💡 \*\*Dica:\*\*/g, '<div class="alert alert-info"><strong>💡 Dica:</strong>');

    return content;
}

// Função para criar capa
function createCover() {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Verificar se existe logo
    const logoPath = path.join(__dirname, '../assets/logo-consigaz.png');
    const hasLogo = fs.existsSync(logoPath);

    return `
        <div class="cover">
            ${hasLogo ? '<img src="file://' + logoPath + '" alt="Logo Consigaz">' : ''}
            <h1>Sistema Vale-Gás</h1>
            <div class="version">Manual de Uso v2.0</div>
            <div style="font-size: 20px; margin: 40px 0; color: #666;">
                Guia Completo para Administradores,<br>
                Colaboradores e Distribuidores
            </div>
            <div class="info">
                <p>Gerado em: ${formattedDate}</p>
                <p>Versão do Sistema: 2.0.0</p>
            </div>
        </div>
    `;
}

// Função para extrair índice do conteúdo
function createTOC(html) {
    const headings = html.match(/<h[12][^>]*>(.*?)<\/h[12]>/g) || [];
    let toc = '<div class="toc"><h2>📑 Índice</h2><ul>';

    headings.forEach((heading, index) => {
        const level = heading.match(/<h([12])/)[1];
        const text = heading.replace(/<[^>]*>/g, '');
        const id = `section-${index}`;

        if (level === '1') {
            toc += `<li style="font-weight: bold; margin-top: 15px;"><a href="#${id}">${text}</a></li>`;
        } else {
            toc += `<li style="padding-left: 20px;"><a href="#${id}">${text}</a></li>`;
        }
    });

    toc += '</ul></div>';

    // Adicionar IDs aos headings no HTML
    let counter = 0;
    html = html.replace(/<h[12][^>]*>/g, (match) => {
        return match.replace('>', ` id="section-${counter++}">`);
    });

    return { toc, html };
}

// Função principal
async function generatePDF() {
    console.log('📄 Gerando PDF do Manual de Uso...\n');

    try {
        // Ler arquivo Markdown
        console.log('📖 Lendo arquivo Markdown...');
        const markdownContent = fs.readFileSync(MANUAL_PATH, 'utf-8');

        // Processar Markdown
        console.log('🔄 Convertendo Markdown para HTML...');
        let processedContent = processMarkdown(markdownContent);
        let htmlContent = md.render(processedContent);

        // Criar índice
        console.log('📑 Criando índice...');
        const { toc, html } = createTOC(htmlContent);

        // Criar capa
        console.log('🎨 Criando capa...');
        const cover = createCover();

        // Montar HTML completo
        const fullHTML = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Manual de Uso - Sistema Vale-Gás v2.0</title>
                ${pdfStyles}
            </head>
            <body>
                ${cover}
                ${toc}
                <div class="content">
                    ${html}
                </div>
            </body>
            </html>
        `;

        // Gerar PDF com Puppeteer
        console.log('🚀 Gerando PDF com Puppeteer...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(fullHTML, { waitUntil: 'networkidle0' });

        await page.pdf({
            path: OUTPUT_PATH,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '2cm',
                right: '2cm',
                bottom: '2cm',
                left: '2cm'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; text-align: center; width: 100%; color: #999;">
                    <span>Manual de Uso - Sistema Vale-Gás v2.0</span> |
                    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
                </div>
            `
        });

        await browser.close();

        // Verificar tamanho do arquivo
        const stats = fs.statSync(OUTPUT_PATH);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log('\n✅ PDF gerado com sucesso!\n');
        console.log(`📍 Local: ${OUTPUT_PATH}`);
        console.log(`📊 Tamanho: ${fileSizeInMB} MB`);
        console.log(`📄 Páginas: Verifique o PDF\n`);
        console.log('💡 Dica: Use Adobe Acrobat para editar o PDF');
        console.log('');

    } catch (error) {
        console.error('\n❌ Erro ao gerar PDF:', error.message);
        console.error('\nDetalhes:', error);
        process.exit(1);
    }
}

// Executar
generatePDF();

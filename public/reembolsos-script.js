// ========================================
// GESTÃO DE REEMBOLSOS
// ========================================

let reembolsoAtual = null;
let paginaAtualReembolsos = 1;

// Função auxiliar para mostrar notificações
function mostrarToast(mensagem, tipo = 'info') {
    // Usar alert simples como fallback
    if (typeof tipo === 'string' && tipo === 'error') {
        console.error(mensagem);
        alert('❌ ' + mensagem);
    } else if (tipo === 'success') {
        console.log('✅', mensagem);
        // Sucesso é silencioso para não irritar o usuário
    } else {
        console.info(mensagem);
    }
}

// Carregar estatísticas de reembolsos
async function carregarEstatisticasReembolsos() {
    try {
        const response = await fetch('/api/admin/reembolsos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.stats) {
            document.getElementById('reembolsos-a-validar').textContent = data.stats.a_validar || 0;
            document.getElementById('reembolsos-aprovados').textContent = data.stats.aprovado || 0;
            document.getElementById('reembolsos-pagos').textContent = data.stats.pago || 0;
            document.getElementById('reembolsos-total').textContent =
                'R$ ' + (parseFloat(data.stats.valor_aprovado) || 0).toFixed(2).replace('.', ',');
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas de reembolsos:', error);
    }
}

// Carregar lista de reembolsos
async function carregarReembolsos(page = 1) {
    try {
        paginaAtualReembolsos = page;
        const tbody = document.getElementById('listaReembolsos');
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px"><div class="spinner" style="margin:20px auto"></div>Carregando...</td></tr>';

        // Construir query params
        const params = new URLSearchParams({ page, limit: 50 });

        const status = document.getElementById('filtro-status-reembolso')?.value;
        if (status) params.append('status', status);

        const distribuidor = document.getElementById('filtro-distribuidor-reembolso')?.value;
        if (distribuidor) params.append('distribuidor_id', distribuidor);

        const mes = document.getElementById('filtro-mes-reembolso')?.value;
        if (mes) params.append('mes_referencia', mes);

        const dataInicio = document.getElementById('filtro-data-inicio-reembolso')?.value;
        if (dataInicio) params.append('data_inicio', dataInicio);

        const dataFim = document.getElementById('filtro-data-fim-reembolso')?.value;
        if (dataFim) params.append('data_fim', dataFim);

        const response = await fetch(`/api/admin/reembolsos?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao carregar reembolsos');
        }

        // Atualizar estatísticas
        if (data.stats) {
            document.getElementById('reembolsos-a-validar').textContent = data.stats.a_validar || 0;
            document.getElementById('reembolsos-aprovados').textContent = data.stats.aprovado || 0;
            document.getElementById('reembolsos-pagos').textContent = data.stats.pago || 0;
            document.getElementById('reembolsos-total').textContent =
                'R$ ' + (parseFloat(data.stats.valor_aprovado) || 0).toFixed(2).replace('.', ',');
        }

        // Renderizar tabela
        if (data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-secondary)">Nenhum reembolso encontrado</td></tr>';
            document.getElementById('paginacaoReembolsos').innerHTML = '';
            return;
        }

        tbody.innerHTML = data.data.map(r => `
            <tr>
                <td>${r.id}</td>
                <td>
                    <strong>${r.distribuidor_nome || '-'}</strong>
                    ${r.distribuidor_tipo === 'interno' ? '<span class="badge badge-secondary" style="margin-left:8px;font-size:10px">Interno</span>' : ''}
                    <br>
                    <small style="color:var(--text-secondary)">${r.distribuidor_cnpj || '-'}</small>
                </td>
                <td>
                    <strong>${r.colaborador_nome || '-'}</strong><br>
                    <small style="color:var(--text-secondary)">${r.colaborador_cpf || '-'}</small>
                </td>
                <td>${r.codigo_vale || '-'}</td>
                <td>${formatarMesReferencia(r.mes_referencia)}</td>
                <td style="font-weight:600;color:var(--success)">R$ ${parseFloat(r.valor).toFixed(2).replace('.', ',')}</td>
                <td>${renderBadgeStatus(r.status)}</td>
                <td>${r.data_validacao ? new Date(r.data_validacao).toLocaleDateString('pt-BR') : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="verDetalhesReembolso(${r.id})" title="Ver Detalhes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        // Paginação
        if (data.pagination && data.pagination.pages > 1) {
            renderPaginacaoReembolsos(data.pagination);
        } else {
            document.getElementById('paginacaoReembolsos').innerHTML = '';
        }

    } catch (error) {
        console.error('Erro ao carregar reembolsos:', error);
        mostrarToast(error.message, 'error');
        document.getElementById('listaReembolsos').innerHTML =
            '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--danger)">Erro ao carregar reembolsos</td></tr>';
    }
}

// Render Badge de Status
function renderBadgeStatus(status) {
    const badges = {
        'a_validar': '<span class="badge badge-warning">A Validar</span>',
        'aprovado': '<span class="badge badge-info">Aprovado</span>',
        'pago': '<span class="badge badge-success">Pago</span>',
        'rejeitado': '<span class="badge badge-danger">Rejeitado</span>'
    };
    return badges[status] || '<span class="badge badge-secondary">-</span>';
}

// Paginação
function renderPaginacaoReembolsos(pagination) {
    const container = document.getElementById('paginacaoReembolsos');
    let html = '<div style="display:flex;align-items:center;justify-content:center;gap:8px">';

    // Anterior
    if (pagination.page > 1) {
        html += `<button class="btn btn-secondary btn-sm" onclick="carregarReembolsos(${pagination.page - 1})">Anterior</button>`;
    }

    // Páginas
    const maxButtons = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxButtons / 2));
    let endPage = Math.min(pagination.pages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === pagination.page) {
            html += `<button class="btn btn-primary btn-sm" disabled>${i}</button>`;
        } else {
            html += `<button class="btn btn-secondary btn-sm" onclick="carregarReembolsos(${i})">${i}</button>`;
        }
    }

    // Próximo
    if (pagination.page < pagination.pages) {
        html += `<button class="btn btn-secondary btn-sm" onclick="carregarReembolsos(${pagination.page + 1})">Próximo</button>`;
    }

    html += `<span style="margin-left:16px;color:var(--text-secondary)">Página ${pagination.page} de ${pagination.pages}</span>`;
    html += '</div>';

    container.innerHTML = html;
}

// Ver detalhes do reembolso
async function verDetalhesReembolso(id) {
    try {
        const response = await fetch(`/api/admin/reembolsos/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Erro ao carregar detalhes');
        }

        reembolsoAtual = result.data;

        // Preencher modal
        document.getElementById('det-reembolso-id').textContent = reembolsoAtual.id;
        document.getElementById('det-distribuidor').textContent = reembolsoAtual.distribuidor_nome || '-';
        document.getElementById('det-cnpj').textContent = reembolsoAtual.distribuidor_cnpj || '-';
        document.getElementById('det-colaborador').textContent = reembolsoAtual.colaborador_nome || '-';
        document.getElementById('det-cpf').textContent = reembolsoAtual.colaborador_cpf || '-';
        document.getElementById('det-codigo-vale').textContent = reembolsoAtual.codigo_vale || '-';
        document.getElementById('det-mes-ref').textContent = formatarMesReferencia(reembolsoAtual.mes_referencia);
        document.getElementById('det-valor').textContent = 'R$ ' + parseFloat(reembolsoAtual.valor).toFixed(2).replace('.', ',');
        document.getElementById('det-data-validacao').textContent = reembolsoAtual.data_validacao ?
            new Date(reembolsoAtual.data_validacao).toLocaleString('pt-BR') : '-';

        // Status badge
        document.getElementById('det-status-badge').innerHTML = renderBadgeStatus(reembolsoAtual.status);

        // Dados bancários
        document.getElementById('det-banco').textContent = reembolsoAtual.banco || '-';
        document.getElementById('det-agencia').textContent = reembolsoAtual.agencia || '-';
        document.getElementById('det-conta').textContent = reembolsoAtual.conta || '-';
        document.getElementById('det-tipo-conta').textContent = reembolsoAtual.tipo_conta ?
            (reembolsoAtual.tipo_conta === 'corrente' ? 'Corrente' : 'Poupança') : '-';
        document.getElementById('det-pix').textContent = reembolsoAtual.pix || '-';

        // Observações
        const obsDiv = document.getElementById('card-observacoes');
        if (reembolsoAtual.observacoes) {
            document.getElementById('det-observacoes').textContent = reembolsoAtual.observacoes;
            obsDiv.style.display = 'block';
        } else {
            obsDiv.style.display = 'none';
        }

        // Comprovantes
        renderComprovantes(reembolsoAtual);

        // Histórico
        renderHistoricoReembolso(result.historico || []);

        // Ações baseadas no status
        renderAcoesReembolso(reembolsoAtual.status);

        abrirModal('modalDetalhesReembolso');

    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        mostrarToast(error.message, 'error');
    }
}

// Render comprovantes
function renderComprovantes(reembolso) {
    const container = document.getElementById('listaComprovantes');
    const comprovantes = [
        { tipo: 'comprovante_nf', label: 'Nota Fiscal', arquivo: reembolso.comprovante_nf },
        { tipo: 'comprovante_recibo', label: 'Recibo', arquivo: reembolso.comprovante_recibo },
        { tipo: 'comprovante_pagamento', label: 'Comprovante Pagamento', arquivo: reembolso.comprovante_pagamento }
    ];

    const html = comprovantes.map(c => {
        if (c.arquivo) {
            return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--gray-50);border-radius:8px;margin-bottom:8px">
                    <div style="display:flex;align-items:center;gap:12px">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <div>
                            <strong>${c.label}</strong><br>
                            <small style="color:var(--text-secondary)">${c.arquivo}</small>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="baixarComprovante(${reembolso.id}, '${c.tipo}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </button>
                </div>
            `;
        }
        return '';
    }).filter(Boolean).join('');

    container.innerHTML = html || '<p style="color:var(--text-secondary);text-align:center;padding:20px">Nenhum comprovante anexado</p>';
}

// Render histórico
function renderHistoricoReembolso(historico) {
    const container = document.getElementById('historicoReembolso');

    if (historico.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px">Nenhuma alteração registrada</p>';
        return;
    }

    const html = historico.map(h => `
        <div style="border-left:3px solid var(--primary);padding-left:16px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                    <strong>${h.acao.toUpperCase()}</strong>
                    ${h.status_anterior ? ` (${h.status_anterior} → ${h.status_novo})` : ''}
                </div>
                <small style="color:var(--text-secondary)">${new Date(h.criado_em).toLocaleString('pt-BR')}</small>
            </div>
            <div style="color:var(--text-secondary);margin-bottom:4px">
                <strong>Por:</strong> ${h.admin_nome}
            </div>
            ${h.observacao ? `<div style="background:var(--gray-50);padding:8px;border-radius:4px;margin-top:8px">${h.observacao}</div>` : ''}
        </div>
    `).join('');

    container.innerHTML = html;
}

// Render ações
function renderAcoesReembolso(status) {
    const container = document.getElementById('acoesReembolso');
    let html = '<button type="button" class="btn btn-secondary" onclick="fecharModal(\'modalDetalhesReembolso\')">Fechar</button>';

    if (status === 'a_validar') {
        html += '<button type="button" class="btn btn-success" onclick="abrirModalAprovar()">Aprovar</button>';
        html += '<button type="button" class="btn btn-danger" onclick="abrirModalRejeitar()">Rejeitar</button>';
    } else if (status === 'aprovado') {
        html += '<button type="button" class="btn btn-success" onclick="abrirModalMarcarPago()">Marcar como Pago</button>';
    }

    container.innerHTML = html;
}

// Modais de ações
function abrirModalAprovar() {
    document.getElementById('aprovar-observacoes').value = '';
    abrirModal('modalAprovarReembolso');
}

function abrirModalRejeitar() {
    document.getElementById('rejeitar-motivo').value = '';
    abrirModal('modalRejeitarReembolso');
}

function abrirModalMarcarPago() {
    document.getElementById('pago-observacoes').value = '';
    abrirModal('modalMarcarPago');
}

function abrirModalUpload() {
    document.getElementById('upload-nf').value = '';
    document.getElementById('upload-recibo').value = '';
    document.getElementById('upload-pagamento').value = '';
    abrirModal('modalUploadReembolso');
}

// Confirmar aprovação
async function confirmarAprovacao(e) {
    e.preventDefault();

    if (!reembolsoAtual) return;

    try {
        const observacoes = document.getElementById('aprovar-observacoes').value;

        const response = await fetch(`/api/admin/reembolsos/${reembolsoAtual.id}/aprovar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ observacoes })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao aprovar reembolso');
        }

        mostrarToast('Reembolso aprovado com sucesso!', 'success');
        fecharModal('modalAprovarReembolso');
        fecharModal('modalDetalhesReembolso');
        carregarReembolsos(paginaAtualReembolsos);

    } catch (error) {
        console.error('Erro ao aprovar:', error);
        mostrarToast(error.message, 'error');
    }
}

// Confirmar rejeição
async function confirmarRejeicao(e) {
    e.preventDefault();

    if (!reembolsoAtual) return;

    try {
        const motivo = document.getElementById('rejeitar-motivo').value;

        if (!motivo.trim()) {
            mostrarToast('Informe o motivo da rejeição', 'error');
            return;
        }

        const response = await fetch(`/api/admin/reembolsos/${reembolsoAtual.id}/rejeitar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ motivo_rejeicao: motivo })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao rejeitar reembolso');
        }

        mostrarToast('Reembolso rejeitado', 'success');
        fecharModal('modalRejeitarReembolso');
        fecharModal('modalDetalhesReembolso');
        carregarReembolsos(paginaAtualReembolsos);

    } catch (error) {
        console.error('Erro ao rejeitar:', error);
        mostrarToast(error.message, 'error');
    }
}

// Confirmar pagamento
async function confirmarPagamento(e) {
    e.preventDefault();

    if (!reembolsoAtual) return;

    try {
        const observacoes = document.getElementById('pago-observacoes').value;

        const response = await fetch(`/api/admin/reembolsos/${reembolsoAtual.id}/marcar-pago`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ observacoes })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao marcar como pago');
        }

        mostrarToast('Reembolso marcado como pago!', 'success');
        fecharModal('modalMarcarPago');
        fecharModal('modalDetalhesReembolso');
        carregarReembolsos(paginaAtualReembolsos);

    } catch (error) {
        console.error('Erro ao marcar como pago:', error);
        mostrarToast(error.message, 'error');
    }
}

// Enviar comprovantes
async function enviarComprovantes() {
    if (!reembolsoAtual) return;

    try {
        const formData = new FormData();

        const nf = document.getElementById('upload-nf').files[0];
        if (nf) formData.append('comprovante_nf', nf);

        const recibo = document.getElementById('upload-recibo').files[0];
        if (recibo) formData.append('comprovante_recibo', recibo);

        const pagamento = document.getElementById('upload-pagamento').files[0];
        if (pagamento) formData.append('comprovante_pagamento', pagamento);

        if (!nf && !recibo && !pagamento) {
            mostrarToast('Selecione pelo menos um arquivo', 'error');
            return;
        }

        const response = await fetch(`/api/admin/reembolsos/${reembolsoAtual.id}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao enviar arquivos');
        }

        mostrarToast('Arquivos enviados com sucesso!', 'success');
        fecharModal('modalUploadReembolso');
        verDetalhesReembolso(reembolsoAtual.id); // Recarregar detalhes

    } catch (error) {
        console.error('Erro ao enviar arquivos:', error);
        mostrarToast(error.message, 'error');
    }
}

// Baixar comprovante
async function baixarComprovante(reembolsoId, tipo) {
    try {
        window.open(`/api/admin/reembolsos/${reembolsoId}/arquivo/${tipo}?token=${token}`, '_blank');
    } catch (error) {
        console.error('Erro ao baixar comprovante:', error);
        mostrarToast('Erro ao baixar arquivo', 'error');
    }
}

// Exportar CSV
async function exportarReembolsosCSV() {
    try {
        const params = new URLSearchParams();

        const status = document.getElementById('filtro-status-reembolso')?.value;
        if (status) params.append('status', status);

        const distribuidor = document.getElementById('filtro-distribuidor-reembolso')?.value;
        if (distribuidor) params.append('distribuidor_id', distribuidor);

        const mes = document.getElementById('filtro-mes-reembolso')?.value;
        if (mes) params.append('mes_referencia', mes);

        mostrarToast('Exportando relatório...', 'info');

        // Fazer fetch com token no header
        const response = await fetch(`/api/admin/reembolsos/exportar/csv?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Erro ao exportar');
        }

        // Criar blob e fazer download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reembolsos-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        mostrarToast('CSV exportado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao exportar:', error);
        mostrarToast('Erro ao exportar CSV', 'error');
    }
}

// Limpar filtros
function limparFiltrosReembolsos() {
    document.getElementById('filtro-status-reembolso').value = '';
    document.getElementById('filtro-distribuidor-reembolso').value = '';
    document.getElementById('filtro-mes-reembolso').value = '';
    document.getElementById('filtro-data-inicio-reembolso').value = '';
    document.getElementById('filtro-data-fim-reembolso').value = '';
    carregarReembolsos(1);
}

// Abrir modal novo reembolso
function abrirModalNovoReembolso() {
    document.getElementById('novo-vale-codigo').value = '';
    document.getElementById('novo-reembolso-dados').style.display = 'none';
    abrirModal('modalNovoReembolso');
}

// Criar reembolso manual
async function criarReembolsoManual(e) {
    e.preventDefault();

    try {
        const codigoVale = document.getElementById('novo-vale-codigo').value;
        const valor = document.getElementById('novo-valor').value;
        const observacoes = document.getElementById('novo-observacoes').value;

        // Buscar vale pelo código
        const valeResponse = await fetch(`/api/admin/vales?search=${codigoVale}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const valeData = await valeResponse.json();

        if (!valeData.success || !valeData.vales || valeData.vales.length === 0) {
            throw new Error('Vale não encontrado');
        }

        const vale = valeData.vales[0];

        if (vale.status !== 'utilizado') {
            throw new Error('Apenas vales utilizados podem gerar reembolso');
        }

        // Criar reembolso
        const response = await fetch('/api/admin/reembolsos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vale_id: vale.id,
                distribuidor_id: vale.distribuidor_id,
                colaborador_id: vale.colaborador_id,
                valor: parseFloat(valor),
                mes_referencia: vale.mes_referencia,
                observacoes
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao criar reembolso');
        }

        mostrarToast('Reembolso criado com sucesso!', 'success');
        fecharModal('modalNovoReembolso');
        carregarReembolsos(1);

    } catch (error) {
        console.error('Erro ao criar reembolso:', error);
        mostrarToast(error.message, 'error');
    }
}

// Carregar distribuidores para filtro
async function carregarDistribuidoresFiltro() {
    try {
        const response = await fetch('/api/admin/distribuidores?ativo=true&limite=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.sucesso) {
            const select = document.getElementById('filtro-distribuidor-reembolso');
            select.innerHTML = '<option value="">Todos</option>' +
                data.dados.map(d =>
                    `<option value="${d.id}">${d.nome || d.razao_social}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar distribuidores:', error);
    }
}

// Expor funções globalmente para event handlers inline
window.carregarReembolsos = carregarReembolsos;
window.carregarEstatisticasReembolsos = carregarEstatisticasReembolsos;
window.carregarDistribuidoresFiltro = carregarDistribuidoresFiltro;
window.exportarReembolsosCSV = exportarReembolsosCSV;
window.limparFiltrosReembolsos = limparFiltrosReembolsos;
window.abrirModalNovoReembolso = abrirModalNovoReembolso;
window.abrirModalDetalhes = abrirModalDetalhes;
window.abrirModalAprovar = abrirModalAprovar;
window.abrirModalRejeitar = abrirModalRejeitar;
window.abrirModalMarcarPago = abrirModalMarcarPago;
window.abrirModalUpload = abrirModalUpload;
window.fecharModal = fecharModal;
window.confirmarAprovacao = confirmarAprovacao;
window.confirmarRejeicao = confirmarRejeicao;
window.confirmarPagamento = confirmarPagamento;
window.enviarComprovantes = enviarComprovantes;
window.criarReembolsoManual = criarReembolsoManual;
window.buscarValePorCodigo = buscarValePorCodigo;
window.baixarArquivo = baixarArquivo;
window.confirmarDelecao = confirmarDelecao;

console.log('✅ Funções de reembolsos expostas globalmente');

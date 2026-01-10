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

// Função para abrir modal (adiciona classe 'show')
function abrirModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

// Função para fechar modal (remove classe 'show')
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// Função para formatar mês de referência (YYYY-MM para Mês/Ano)
function formatarMesReferencia(mesRef) {
    if (!mesRef) return '-';
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const partes = mesRef.split('-');
    if (partes.length !== 2) return mesRef;
    const ano = partes[0];
    const mes = parseInt(partes[1]) - 1;
    if (mes < 0 || mes > 11) return mesRef;
    return `${meses[mes]}/${ano}`;
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

        // Verificar se a resposta é OK antes de parsear JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro HTTP:', response.status, errorText);
            throw new Error(`Erro do servidor (${response.status})`);
        }

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

// Variáveis para controle de vales selecionados
let valesPendentesLista = [];
let valesSelecionados = new Set();

// Abrir modal novo reembolso
async function abrirModalNovoReembolso() {
    // Resetar estado
    valesPendentesLista = [];
    valesSelecionados.clear();

    document.getElementById('novo-reembolso-distribuidor').value = '';
    document.getElementById('vales-pendentes-container').style.display = 'none';
    document.getElementById('novo-reembolso-obs').style.display = 'none';
    document.getElementById('resumo-selecao').style.display = 'none';
    document.getElementById('btn-criar-reembolsos').disabled = true;
    document.getElementById('novo-observacoes').value = '';

    // Carregar distribuidores externos
    await carregarDistribuidoresExternos();

    abrirModal('modalNovoReembolso');
}

// Carregar distribuidores externos (que recebem reembolso)
async function carregarDistribuidoresExternos() {
    try {
        const response = await fetch('/api/admin/distribuidores?ativo=true&tipo=externo&limite=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        const select = document.getElementById('novo-reembolso-distribuidor');
        select.innerHTML = '<option value="">Selecione um distribuidor...</option>';

        // API retorna { sucesso, dados } para distribuidores
        if (data.sucesso && data.dados && data.dados.length > 0) {
            data.dados.forEach(d => {
                select.innerHTML += `<option value="${d.id}">${d.nome || d.razao_social} - ${d.cnpj}</option>`;
            });
        } else if (!data.sucesso) {
            console.error('Erro da API:', data.erro);
            select.innerHTML += '<option value="" disabled>Erro ao carregar distribuidores</option>';
        } else {
            select.innerHTML += '<option value="" disabled>Nenhum distribuidor externo cadastrado</option>';
        }
    } catch (error) {
        console.error('Erro ao carregar distribuidores:', error);
        const select = document.getElementById('novo-reembolso-distribuidor');
        select.innerHTML = '<option value="">Selecione um distribuidor...</option>';
        select.innerHTML += '<option value="" disabled>Erro ao carregar - tente novamente</option>';
    }
}

// Carregar vales pendentes de reembolso para o distribuidor selecionado
async function carregarValesPendentes() {
    const distribuidorId = document.getElementById('novo-reembolso-distribuidor').value;
    const container = document.getElementById('vales-pendentes-container');
    const tbody = document.getElementById('lista-vales-pendentes');

    if (!distribuidorId) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px"><div class="spinner" style="margin:10px auto"></div>Carregando...</td></tr>';

    try {
        // Buscar vales utilizados deste distribuidor que ainda não têm reembolso
        const response = await fetch(`/api/admin/reembolsos/vales-pendentes/${distribuidorId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro HTTP vales-pendentes:', response.status, errorText);
            throw new Error(`Erro do servidor (${response.status})`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao carregar vales');
        }

        valesPendentesLista = data.vales || [];
        valesSelecionados.clear();

        if (valesPendentesLista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-secondary)">Nenhum vale pendente de reembolso para este distribuidor</td></tr>';
            document.getElementById('novo-reembolso-obs').style.display = 'none';
            document.getElementById('resumo-selecao').style.display = 'none';
            return;
        }

        // Renderizar lista de vales
        tbody.innerHTML = valesPendentesLista.map(v => `
            <tr>
                <td>
                    <input type="checkbox" class="vale-checkbox" data-vale-id="${v.id}" data-valor="${v.valor || 0}" onchange="toggleVale(${v.id}, ${v.valor || 0})">
                </td>
                <td><code style="background:var(--gray-100);padding:2px 6px;border-radius:4px">${v.codigo}</code></td>
                <td>
                    <strong>${v.colaborador_nome || '-'}</strong><br>
                    <small style="color:var(--text-secondary)">${v.colaborador_cpf || '-'}</small>
                </td>
                <td>${formatarMesReferencia(v.mes_referencia)}</td>
                <td>${v.data_validacao ? new Date(v.data_validacao).toLocaleDateString('pt-BR') : '-'}</td>
                <td style="font-weight:600;color:var(--success)">R$ ${(parseFloat(v.valor) || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
        `).join('');

        document.getElementById('selecionar-todos-vales').checked = false;
        document.getElementById('novo-reembolso-obs').style.display = 'block';
        atualizarResumoSelecao();

    } catch (error) {
        console.error('Erro ao carregar vales:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--danger)">${error.message}</td></tr>`;
    }
}

// Toggle seleção de um vale
function toggleVale(valeId, valor) {
    if (valesSelecionados.has(valeId)) {
        valesSelecionados.delete(valeId);
    } else {
        valesSelecionados.add(valeId);
    }
    atualizarResumoSelecao();
}

// Toggle selecionar todos os vales
function toggleSelecionarTodosVales() {
    const checked = document.getElementById('selecionar-todos-vales').checked;
    const checkboxes = document.querySelectorAll('.vale-checkbox');

    valesSelecionados.clear();

    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            valesSelecionados.add(parseInt(cb.dataset.valeId));
        }
    });

    atualizarResumoSelecao();
}

// Atualizar resumo da seleção
function atualizarResumoSelecao() {
    const resumo = document.getElementById('resumo-selecao');
    const btnCriar = document.getElementById('btn-criar-reembolsos');

    if (valesSelecionados.size === 0) {
        resumo.style.display = 'none';
        btnCriar.disabled = true;
        return;
    }

    // Calcular total
    let total = 0;
    valesPendentesLista.forEach(v => {
        if (valesSelecionados.has(v.id)) {
            total += parseFloat(v.valor) || 0;
        }
    });

    document.getElementById('qtd-vales-selecionados').textContent = valesSelecionados.size;
    document.getElementById('total-reembolso').textContent = total.toFixed(2).replace('.', ',');

    resumo.style.display = 'block';
    btnCriar.disabled = false;
}

// Criar reembolsos para os vales selecionados
async function criarReembolsosSelecionados() {
    if (valesSelecionados.size === 0) {
        mostrarToast('Selecione pelo menos um vale', 'error');
        return;
    }

    const distribuidorId = document.getElementById('novo-reembolso-distribuidor').value;
    const observacoes = document.getElementById('novo-observacoes').value;
    const btnCriar = document.getElementById('btn-criar-reembolsos');

    btnCriar.disabled = true;
    btnCriar.innerHTML = '<div class="spinner" style="width:16px;height:16px;margin-right:8px"></div>Criando...';

    try {
        // Criar reembolsos para cada vale selecionado
        const valesParaCriar = valesPendentesLista.filter(v => valesSelecionados.has(v.id));
        let criados = 0;
        let erros = [];

        for (const vale of valesParaCriar) {
            try {
                const response = await fetch('/api/admin/reembolsos', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vale_id: vale.id,
                        distribuidor_id: parseInt(distribuidorId),
                        colaborador_id: vale.colaborador_id,
                        valor: parseFloat(vale.valor) || 0,
                        mes_referencia: vale.mes_referencia,
                        observacoes
                    })
                });

                const data = await response.json();

                if (data.success) {
                    criados++;
                } else {
                    erros.push(`Vale ${vale.codigo}: ${data.error}`);
                }
            } catch (e) {
                erros.push(`Vale ${vale.codigo}: ${e.message}`);
            }
        }

        if (criados > 0) {
            mostrarToast(`${criados} reembolso(s) criado(s) com sucesso!`, 'success');
            fecharModal('modalNovoReembolso');
            carregarReembolsos(1);
        }

        if (erros.length > 0) {
            console.error('Erros ao criar reembolsos:', erros);
            if (criados === 0) {
                mostrarToast('Erro ao criar reembolsos. Verifique o console.', 'error');
            }
        }

    } catch (error) {
        console.error('Erro ao criar reembolsos:', error);
        mostrarToast(error.message, 'error');
    } finally {
        btnCriar.disabled = false;
        btnCriar.innerHTML = 'Criar Reembolso(s)';
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
window.verDetalhesReembolso = verDetalhesReembolso;
window.abrirModalAprovar = abrirModalAprovar;
window.abrirModalRejeitar = abrirModalRejeitar;
window.abrirModalMarcarPago = abrirModalMarcarPago;
window.abrirModalUpload = abrirModalUpload;
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.confirmarAprovacao = confirmarAprovacao;
window.confirmarRejeicao = confirmarRejeicao;
window.confirmarPagamento = confirmarPagamento;
window.enviarComprovantes = enviarComprovantes;
window.baixarComprovante = baixarComprovante;
window.formatarMesReferencia = formatarMesReferencia;
// Novas funções para o modal de novo reembolso
window.carregarDistribuidoresExternos = carregarDistribuidoresExternos;
window.carregarValesPendentes = carregarValesPendentes;
window.toggleVale = toggleVale;
window.toggleSelecionarTodosVales = toggleSelecionarTodosVales;
window.criarReembolsosSelecionados = criarReembolsosSelecionados;

console.log('✅ Funções de reembolsos expostas globalmente');

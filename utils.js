const crypto = require('crypto');
const axios = require('axios');
const cache = require('./config/cache');
const { getQuery, allQuery } = require('./database');

// Gerar código alfanumérico único para vale-gás
const gerarCodigoVale = () => {
    // Formato: VG-XXXXXX (VG = Vale Gás + 6 caracteres alfanuméricos)
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = 'VG-';
    for (let i = 0; i < 6; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
};

// Gerar senha aleatória
const gerarSenhaAleatoria = (tamanho = 8) => {
    const caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let senha = '';
    for (let i = 0; i < tamanho; i++) {
        senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return senha;
};

// Gerar token para recuperação de senha
const gerarTokenRecuperacao = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Validar CPF
const validarCPF = (cpf) => {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;
    
    return true;
};

// Validar CNPJ
const validarCNPJ = (cnpj) => {
    cnpj = cnpj.replace(/[^\d]/g, '');
    
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    
    return true;
};

// Formatar CPF
const formatarCPF = (cpf) => {
    cpf = cpf.replace(/[^\d]/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// Formatar CNPJ
const formatarCNPJ = (cnpj) => {
    cnpj = cnpj.replace(/[^\d]/g, '');
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

// Limpar CPF/CNPJ (remover formatação)
const limparDocumento = (doc) => {
    return doc.replace(/[^\d]/g, '');
};

// Buscar endereço por CEP usando ViaCEP
const buscarEnderecoPorCEP = async (cep) => {
    try {
        cep = cep.replace(/[^\d]/g, '');
        const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
        
        if (response.data.erro) {
            return null;
        }
        
        return {
            cep: response.data.cep,
            logradouro: response.data.logradouro,
            complemento: response.data.complemento,
            bairro: response.data.bairro,
            cidade: response.data.localidade,
            estado: response.data.uf
        };
    } catch (error) {
        console.error('Erro ao buscar CEP:', error.message);
        return null;
    }
};

// Buscar coordenadas por CEP usando Nominatim (OpenStreetMap)
const buscarCoordenadasPorEndereco = async (endereco) => {
    try {
        const query = encodeURIComponent(`${endereco.logradouro}, ${endereco.numero}, ${endereco.cidade}, ${endereco.estado}, Brasil`);
        const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`, {
            headers: {
                'User-Agent': 'ValeGasSystem/1.0'
            }
        });
        
        if (response.data && response.data.length > 0) {
            return {
                latitude: parseFloat(response.data[0].lat),
                longitude: parseFloat(response.data[0].lon)
            };
        }
        
        return null;
    } catch (error) {
        console.error('Erro ao buscar coordenadas:', error.message);
        return null;
    }
};

// Calcular distância entre duas coordenadas (fórmula de Haversine)
const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distância em km
};

// Obter mês de referência atual (formato YYYY-MM)
const getMesReferencia = () => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
};

// Obter data de expiração do vale (X dias a partir de hoje, padrão 30)
const getDataExpiracao = (diasValidade = 30) => {
    const agora = new Date();
    const expiracao = new Date(agora.getTime() + (diasValidade * 24 * 60 * 60 * 1000));
    return expiracao.toISOString().split('T')[0];
};

// Formatar data para exibição
const formatarData = (data) => {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
};

// Formatar data e hora para exibição
const formatarDataHora = (data) => {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleString('pt-BR');
};

// Formatar mês de referência (YYYY-MM) para texto legível
const formatarMesReferencia = (mesReferencia) => {
    if (!mesReferencia) return '-';

    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const [ano, mes] = mesReferencia.split('-');
    const mesNumero = parseInt(mes, 10);

    if (mesNumero < 1 || mesNumero > 12) return mesReferencia;

    return `${meses[mesNumero - 1]}/${ano}`;
};

/**
 * Obter configuração do sistema com cache
 * Reduz carga no banco de dados para configurações frequentemente acessadas
 */
const getConfiguracao = async (chave, valorPadrao = null) => {
    const cacheKey = `config:${chave}`;

    // Tentar obter do cache primeiro (TTL: 15 minutos)
    const cached = cache.get(cacheKey);
    if (cached !== null) {
        return cached;
    }

    // Buscar do banco
    const config = await getQuery(
        'SELECT valor FROM configuracoes WHERE chave = ?',
        [chave]
    );

    const valor = config ? config.valor : valorPadrao;

    // Cachear por 15 minutos (900 segundos)
    cache.set(cacheKey, valor, 900);

    return valor;
};

/**
 * Obter todas as configurações com cache
 * Útil para carregar configurações em massa
 */
const getAllConfiguracoes = async () => {
    const cacheKey = 'config:all';

    // Tentar obter do cache primeiro (TTL: 15 minutos)
    const cached = cache.get(cacheKey);
    if (cached !== null) {
        return cached;
    }

    // Buscar do banco
    const configs = await allQuery('SELECT chave, valor FROM configuracoes');

    // Transformar em objeto chave-valor
    const configObj = {};
    configs.forEach(c => {
        configObj[c.chave] = c.valor;
    });

    // Cachear por 15 minutos (900 segundos)
    cache.set(cacheKey, configObj, 900);

    return configObj;
};

/**
 * Limpar cache de configurações
 * Deve ser chamado sempre que uma configuração for alterada
 */
const limparCacheConfiguracoes = () => {
    cache.delPattern('config:');
};

module.exports = {
    gerarCodigoVale,
    gerarSenhaAleatoria,
    gerarTokenRecuperacao,
    validarCPF,
    validarCNPJ,
    formatarCPF,
    formatarCNPJ,
    limparDocumento,
    buscarEnderecoPorCEP,
    buscarCoordenadasPorEndereco,
    calcularDistancia,
    getMesReferencia,
    getDataExpiracao,
    formatarData,
    formatarDataHora,
    formatarMesReferencia,
    getConfiguracao,
    getAllConfiguracoes,
    limparCacheConfiguracoes
};

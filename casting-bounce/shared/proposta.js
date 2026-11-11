// Regras das propostas comerciais, usadas pelo painel, pela página do contratante e pelo servidor.

export const MODOS = { valor: 'Valor', combinar: 'A combinar', cortesia: 'Cortesia' };

const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? '').replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const numero = num;

export const brl = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valor de uma linha de preço: quantidade × valor (quantidade vazia conta como 1). */
export function totalLinha(it) {
  if (!it || (it.modo && it.modo !== 'valor')) return 0;
  const q = String(it.qtd ?? '').trim() === '' ? 1 : num(it.qtd);
  return q * num(it.valor);
}

/** Texto do valor de uma linha (para a página e o painel). */
export function textoLinha(it) {
  if (it?.modo === 'cortesia') return 'Cortesia';
  if (it?.modo === 'combinar' || (String(it?.valor ?? '').trim() === '')) return 'A combinar';
  return brl(totalLinha(it));
}

/** Detalhe "4 × R$ 70,00" quando a quantidade é maior que 1. */
export function detalheLinha(it) {
  if (it?.modo && it.modo !== 'valor') return '';
  if (String(it?.valor ?? '').trim() === '') return '';
  const q = num(it.qtd);
  if (!q || q === 1) return it.unidade ? `${brl(it.valor)} / ${it.unidade}` : '';
  return `${String(q).replace('.', ',')} ${it.unidade || '×'} × ${brl(it.valor)}`;
}

/**
 * Totais da proposta.
 * nLista = quantas pessoas estão na lista ligada (usado quando a quantidade de bailarinas fica em branco).
 */
export function calcular(c, nLista = 0) {
  const manual = num(c?.elenco?.qtd);
  const n = manual > 0 ? Math.round(manual) : nLista;
  const cache = c?.cacheBailarina || [];
  const bounce = c?.bounce || [];
  const porBailarina = cache.reduce((s, it) => s + totalLinha(it), 0);
  const totalElenco = porBailarina * n;
  const totalBounce = bounce.reduce((s, it) => s + totalLinha(it), 0);
  const aCombinar = [...cache, ...bounce].some((it) => it.modo === 'combinar' || (it.modo !== 'cortesia' && String(it.valor ?? '').trim() === ''));
  return { n, porBailarina, totalElenco, totalBounce, total: totalElenco + totalBounce, aCombinar };
}

export const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

/** Textos fixos da apresentação (editáveis em cada proposta/modelo). {contratante} vira o nome do contratante. */
export const TEXTOS_PADRAO = {
  capa: '// para {contratante}',
  capaSemContratante: '// bounce basement',
  info: 'informações gerais',
  elenco: 'ELENCO',
  investimento: 'investimento',
  blocoElenco: 'ELENCO',
  blocoElencoSub: 'por bailarina',
  blocoBounce: 'BOUNCE BASEMENT',
  total: 'TOTAL',
  fim: '_obrigado//',
};
export const ROTULOS_TEXTOS = {
  capa: 'Rodapé da capa', capaSemContratante: 'Rodapé da capa (sem contratante)', info: 'Título “informações gerais”',
  elenco: 'Título da página do elenco', investimento: 'Título da página de valores', blocoElenco: 'Bloco de cachê (título)',
  blocoElencoSub: 'Bloco de cachê (complemento)', blocoBounce: 'Bloco da produtora (título)', total: 'Palavra do total', fim: 'Frase final',
};
/** Dados de cada bailarina que podem aparecer na proposta (contato e documentos nunca aparecem). */
export const CAMPOS_ELENCO_PADRAO = ['idade', 'altura', 'tamanho_blusa', 'tamanho_calca'];
export const MAX_FOTOS_SECAO = 8;

/** Estimativa de quanto uma seção ocupa (1 = um slide inteiro). Serve para avisar no editor. */
export function tamanhoSecao(s = {}) {
  const linhasDe = (txt, porLinha) => Math.max(1, Math.ceil(String(txt || '').length / porLinha));
  const itens = (s.itens || []).filter((x) => String(x).trim());
  let u = itens.reduce((t, it) => t + linhasDe(it, 50) + 0.9, 0);
  if (s.nota) u += linhasDe(s.nota, 55) + 1;
  if (s.linkUrl) u += 2;
  return u / 12;
}

/** Modelo inicial (o mesmo texto que a Bounce já usava). Pode ser editado no painel → PROPOSTAS → MODELOS. */
export const MODELO_PADRAO = {
  titulo: 'PROPOSTA BOUNCE BASEMENT',
  projeto: '',
  contratante: '',
  evento: '',
  data: '',
  local: '',
  apresentacao: '',
  secoes: [
    { titulo: 'Casting', itens: [
      'Produção do casting com plataforma própria e seleção de perfis pré-indicados.',
      'Seleção final do elenco juntamente com o cliente.',
      'Contato e negociação com os dançarinos selecionados.',
    ], nota: '', linkTexto: '', linkUrl: '' },
    { titulo: 'Direção e criação', itens: [
      'Criação e desenvolvimento da proposta/conceito do show através do SET.',
      'Criação de 3 coreografias + “costuras” musicais (transições, acting e direção de improviso).',
      'Direção geral e ensaios (coreografias prontas + novas criações).',
    ], nota: '', linkTexto: '', linkUrl: '' },
    { titulo: 'Produção de moda / styling', itens: [
      'Garimpo das peças com parceiros locais conforme moodboard fornecido pelo cliente.',
      'Montagem dos looks de cada dançarina.',
      'Prova de roupa e ajustes com cada dançarina.',
    ], nota: 'Compra, aluguel de peças e taxa de lavagem (caso haja): a cargo do contratante.', linkTexto: '', linkUrl: '' },
    { titulo: 'Local de ensaio', itens: [
      'Estúdio: espaço de 45 m² com espelho, sonorização, piso adequado e climatização.',
      'Estúdio disponível para ponto de encontro e concentração pré-show no dia.',
    ], nota: '', linkTexto: 'Ver fotos da sala', linkUrl: 'https://photos.app.goo.gl/bThZd4ooVPRyssdP7', fotos: [] },
    { titulo: 'Equipe / elenco', itens: [
      'Elenco devidamente uniformizado.',
      'Identificação da equipe.',
    ], nota: '', linkTexto: '', linkUrl: '' },
    { titulo: 'Entrega pós-show', itens: [
      'Roteiro do show e proposta conceitual.',
      'Pautas de orientação de cada coreografia criada.',
      'Nota fiscal e repasse aos bailarinos.',
    ], nota: '', linkTexto: '', linkUrl: '' },
  ],
  elenco: { mostrar: true, qtd: '' },
  cacheBailarina: [
    { descricao: 'Ensaios (até 3h cada)', qtd: '4', unidade: 'ensaios', valor: '70', modo: 'valor' },
    { descricao: 'Show (cachê dia)', qtd: '1', unidade: '', valor: '450', modo: 'valor' },
  ],
  condicoesBailarinas: [
    'Alimentação no dia fornecida pelo contratante (catering no local / camarim).',
    'Deslocamento fornecido pelo contratante, partindo do ponto de encontro — ou van buscando o elenco pronto no estúdio.',
  ],
  bounce: [
    { descricao: 'Direção de ensaios', qtd: '', unidade: '', valor: '', modo: 'combinar' },
    { descricao: 'Aluguel de sala', qtd: '12', unidade: 'horas', valor: '50', modo: 'valor' },
    { descricao: 'Criação das 3 coreografias', qtd: '', unidade: '', valor: '', modo: 'combinar' },
    { descricao: 'Produção de moda', qtd: '', unidade: '', valor: '', modo: 'combinar' },
    { descricao: 'Produção de elenco & casting', qtd: '', unidade: '', valor: '', modo: 'cortesia' },
  ],
  observacoes: '',
  validade: '15 dias',
  textos: { ...TEXTOS_PADRAO },
  minusculas: true,
  mostrarContato: true,
};

const t = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const url = (v) => { const s = t(v, 800); return /^https?:\/\//i.test(s) ? s : ''; };
const linhaPreco = (x) => ({
  descricao: t(x?.descricao, 200), qtd: t(x?.qtd, 12), unidade: t(x?.unidade, 40), valor: t(x?.valor, 20),
  modo: MODOS[x?.modo] ? x.modo : 'valor',
});
const idFoto = (v) => { const s = t(v, 300); return /^[\w\-. /]+$/.test(s) && !s.includes('..') ? s : ''; };
const linhas = (v, n = 30, max = 600) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((s) => t(s, max)).filter(Boolean).slice(0, n);

/** Deixa o conteúdo de uma proposta/modelo num formato seguro e completo. */
export function limparConteudo(c = {}) {
  return {
    titulo: t(c.titulo, 160),
    projeto: t(c.projeto, 120),
    contratante: t(c.contratante, 160),
    evento: t(c.evento, 200),
    data: t(c.data, 40),
    local: t(c.local, 200),
    apresentacao: t(c.apresentacao, 4000),
    secoes: (Array.isArray(c.secoes) ? c.secoes : []).slice(0, 20).map((s) => ({
      titulo: t(s?.titulo, 120), itens: linhas(s?.itens), nota: t(s?.nota, 800),
      linkTexto: t(s?.linkTexto, 80), linkUrl: url(s?.linkUrl),
      fotos: (Array.isArray(s?.fotos) ? s.fotos : []).map((f) => idFoto(typeof f === 'string' ? f : f?.id)).filter(Boolean).slice(0, MAX_FOTOS_SECAO),
    })).filter((s) => s.titulo || s.itens.length || s.fotos.length),
    elenco: {
      mostrar: c.elenco?.mostrar !== false, qtd: t(c.elenco?.qtd, 6),
      campos: Array.isArray(c.elenco?.campos) ? c.elenco.campos.map((x) => t(x, 60)).filter((x) => /^\w+$/.test(x)).slice(0, 20) : [...CAMPOS_ELENCO_PADRAO],
    },
    cacheBailarina: (Array.isArray(c.cacheBailarina) ? c.cacheBailarina : []).slice(0, 30).map(linhaPreco).filter((x) => x.descricao),
    condicoesBailarinas: linhas(c.condicoesBailarinas),
    bounce: (Array.isArray(c.bounce) ? c.bounce : []).slice(0, 40).map(linhaPreco).filter((x) => x.descricao),
    observacoes: t(c.observacoes, 4000),
    validade: t(c.validade, 80),
    textos: Object.fromEntries(Object.entries(TEXTOS_PADRAO).map(([k, padrao]) => [k, c.textos?.[k] == null ? padrao : t(c.textos[k], 120)])),
    minusculas: c.minusculas !== false,
    mostrarContato: c.mostrarContato !== false,
  };
}

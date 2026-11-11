// Contratos gerados a partir das propostas, com assinatura eletrônica no próprio site.
// Abas da planilha:
//   "Modelos de contrato" → textos com campos {{...}} (editáveis no painel)
//   "Contratos"           → um por proposta aceita, com o registro de assinaturas
import crypto from 'node:crypto';
import { g, SHEET_ID } from './store.js';
import { lerListas, inscricoesPorPasta, STATUS as STATUS_LISTA } from './listas.js';
import { lerPropostas, alterarProposta, STATUS as STATUS_PROPOSTA } from './propostas.js';
import { limparConteudo, calcular } from '../shared/proposta.js';
import { CONTRATO_PADRAO, STATUS_CONTRATO as S, camposDaProposta, camposDoCliente, preencher, isValidCNPJ, mascararDoc } from '../shared/contrato.js';
import { isValidCPF, onlyDigits } from '../shared/rules.js';
import { SVG_OK } from '../shared/assinatura.js';

export const ABA_MODELOS = 'Modelos de contrato';
export const ABA = 'Contratos';
const COLS_MODELOS = ['ID', 'Nome do modelo', 'Texto', 'Atualizado em', 'Status'];
const COLS = ['ID', 'Proposta (ID)', 'Status', 'Contratante', 'CPF/CNPJ', 'Valor total', 'Criado em', 'Atualizado em',
  'Chave do link', 'Dados (não editar)', 'Texto assinado', 'Código de verificação (SHA-256)', 'Assinatura contratante', 'Assinatura Bounce', 'Versão'];
const MAX_TEXTO = 30000;

const agora = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const hoje = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' });
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const novoId = () => crypto.randomBytes(5).toString('hex');
export const novaChave = () => crypto.randomBytes(18).toString('base64url');
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const json = (s, padrao) => { try { return JSON.parse(s || ''); } catch { return padrao; } };
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/* ---------------- modelos ---------------- */
const modeloDeLinha = (r, linha) => ({ id: r[0] || '', nome: r[1] || '', texto: r[2] || '', atualizado: r[3] || '', status: r[4] || 'Ativo', _linha: linha });
const linhaModelo = (m) => [m.id, m.nome, m.texto, m.atualizado, m.status];

export async function lerModelosContrato() {
  await g.ensureSheet(SHEET_ID(), ABA_MODELOS, COLS_MODELOS);
  let ms = (await g.readRows(SHEET_ID(), ABA_MODELOS)).slice(1).map((r, i) => modeloDeLinha(r, i + 2)).filter((m) => m.id);
  if (!ms.length) {
    const m = { id: novoId(), nome: 'Contrato padrão Bounce', texto: CONTRATO_PADRAO, atualizado: agora(), status: 'Ativo' };
    m._linha = await g.appendRow(SHEET_ID(), ABA_MODELOS, linhaModelo(m));
    ms = [m];
  }
  return ms.filter((m) => m.status !== 'Excluído');
}

export async function salvarModeloContrato({ id, nome, texto: t }) {
  nome = texto(nome, 120);
  t = String(t ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXTO);
  if (!nome) throw erro('Dê um nome para o modelo.');
  if (!t) throw erro('O texto do contrato está vazio.');
  if (!id) {
    const m = { id: novoId(), nome, texto: t, atualizado: agora(), status: 'Ativo' };
    m._linha = await g.appendRow(SHEET_ID(), ABA_MODELOS, linhaModelo(m));
    return m;
  }
  const m = (await lerModelosContrato()).find((x) => x.id === id);
  if (!m) throw erro('Modelo não encontrado.', 404);
  Object.assign(m, { nome, texto: t, atualizado: agora() });
  await g.writeRange(SHEET_ID(), ABA_MODELOS, `A${m._linha}`, linhaModelo(m));
  return m;
}

export async function excluirModeloContrato(id) {
  const ms = await lerModelosContrato();
  const m = ms.find((x) => x.id === id);
  if (!m) throw erro('Modelo não encontrado.', 404);
  if (ms.length === 1) throw erro('Mantenha pelo menos um modelo de contrato.');
  m.status = 'Excluído'; m.atualizado = agora();
  await g.writeRange(SHEET_ID(), ABA_MODELOS, `A${m._linha}`, linhaModelo(m));
  return m;
}

/* ---------------- contratos ---------------- */
function deLinha(r, linha) {
  const d = json(r[9], {});
  return {
    id: r[0] || '', propostaId: r[1] || '', status: r[2] || S.cliente, contratante: r[3] || '', documento: r[4] || '',
    total: r[5] || '', criado: r[6] || '', atualizado: r[7] || '', chave: r[8] || '',
    modeloNome: d.modeloNome || '', template: d.template || '', snapshot: d.snapshot || { conteudo: limparConteudo({}), nLista: 0, elenco: [] },
    versaoProposta: d.versaoProposta || 0, cliente: d.cliente || null, bounce: d.bounce || null, cancelado: d.cancelado || '',
    textoFinal: r[10] || '', hash: r[11] || '',
    assCliente: json(r[12], null), assBounce: json(r[13], null), versao: Number(r[14]) || 1, _linha: linha,
  };
}
const paraLinha = (c) => [c.id, c.propostaId, c.status, c.contratante, c.documento, c.total, c.criado, c.atualizado, c.chave,
  JSON.stringify({ modeloNome: c.modeloNome, template: c.template, snapshot: c.snapshot, versaoProposta: c.versaoProposta,
    cliente: c.cliente, bounce: c.bounce, cancelado: c.cancelado }),
  c.textoFinal, c.hash, c.assCliente ? JSON.stringify(c.assCliente) : '', c.assBounce ? JSON.stringify(c.assBounce) : '', String(c.versao)];

export async function lerContratos() {
  await g.ensureSheet(SHEET_ID(), ABA, COLS);
  return (await g.readRows(SHEET_ID(), ABA)).slice(1).map((r, i) => deLinha(r, i + 2)).filter((c) => c.id);
}

async function gravar(c) {
  c.atualizado = agora();
  c.versao += 1;
  await g.writeRange(SHEET_ID(), ABA, `A${c._linha}`, paraLinha(c));
  return c;
}

/** Texto do contrato com os dados da proposta (os do contratante ficam em branco até ele preencher). */
export const textoBase = (c) => preencher(c.template, camposDaProposta(c.snapshot));

export async function gerarContrato({ propostaId, modeloId }) {
  const [propostas, modelos, contratos, listas] = await Promise.all([lerPropostas(), lerModelosContrato(), lerContratos(), lerListas()]);
  const p = propostas.find((x) => x.id === propostaId && x.status !== STATUS_PROPOSTA.excluida);
  if (!p) throw erro('Proposta não encontrada.', 404);
  if (contratos.some((c) => c.propostaId === p.id && c.status !== S.cancelado))
    throw erro('Esta proposta já tem um contrato. Cancele o atual para gerar outro.');
  const m = modelos.find((x) => x.id === modeloId) || modelos[0];

  // elenco: nomes artísticos de quem está na lista ligada
  const l = p.listaId ? listas.find((x) => x.id === p.listaId && x.status !== STATUS_LISTA.excluida) : null;
  const pessoas = l ? l.pessoas.filter((x) => !x.excluido) : [];
  let elenco = [];
  if (pessoas.length) {
    const porPasta = await inscricoesPorPasta(pessoas);
    elenco = pessoas.map((x) => porPasta.get(x.p)?.nome_artistico || x.nome).filter(Boolean);
  }
  const snapshot = { conteudo: p.conteudo, nLista: pessoas.length, elenco };
  const r = calcular(p.conteudo, pessoas.length);
  const c = {
    id: novoId(), propostaId: p.id, status: S.cliente, contratante: p.contratante || '', documento: '',
    total: `${r.total.toFixed(2).replace('.', ',')}${r.aCombinar ? ' + a combinar' : ''}`,
    criado: agora(), atualizado: agora(), chave: novaChave(), modeloNome: m.nome, template: m.texto, snapshot,
    versaoProposta: p.versao, cliente: null, bounce: null, cancelado: '', textoFinal: '', hash: '', assCliente: null, assBounce: null, versao: 1,
  };
  await g.ensureSheet(SHEET_ID(), ABA, COLS);
  c._linha = await g.appendRow(SHEET_ID(), ABA, paraLinha(c));
  return c;
}

async function pegar(id) {
  const c = (await lerContratos()).find((x) => x.id === id);
  if (!c) throw erro('Contrato não encontrado.', 404);
  return c;
}

export async function cancelarContrato(id) {
  const c = await pegar(id);
  if (c.status === S.assinado) throw erro('Contrato já assinado pelas duas partes não pode ser cancelado aqui.');
  c.status = S.cancelado; c.cancelado = agora();
  return gravar(c);
}

export async function novoLinkContrato(id) {
  const c = await pegar(id);
  c.chave = novaChave();
  return gravar(c);
}

const validarAssinatura = (a) => {
  if (a?.tipo === 'texto' && texto(a.valor, 80).length >= 3) return { tipo: 'texto', valor: texto(a.valor, 80) };
  if (a?.tipo === 'desenho' && SVG_OK(a.svg)) return { tipo: 'desenho', svg: a.svg };
  throw erro('Faça a assinatura (desenhe ou digite seu nome).');
};
const meta = (req) => ({
  ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64),
  navegador: String(req.headers['user-agent'] || '').slice(0, 300),
  em: agora(),
  iso: new Date().toISOString(),
});

/** O contratante preenche os dados e assina pelo link. */
export async function assinarContratante(c, dados, req) {
  if (c.status !== S.cliente) throw erro('Este contrato já foi assinado ou não está mais disponível.', 409);
  const d = {
    tipo: dados?.tipo === 'PJ' ? 'PJ' : 'PF',
    nome: texto(dados?.nome, 160), documento: onlyDigits(dados?.documento).slice(0, 14), endereco: texto(dados?.endereco, 300),
    representante: texto(dados?.representante, 160), representanteCpf: onlyDigits(dados?.representanteCpf).slice(0, 11),
    email: texto(dados?.email, 160).toLowerCase(), telefone: texto(dados?.telefone, 40),
  };
  if (!d.nome) throw erro(d.tipo === 'PJ' ? 'Informe a razão social.' : 'Informe seu nome completo.');
  if (d.tipo === 'PJ' ? !isValidCNPJ(d.documento) : !isValidCPF(d.documento)) throw erro(d.tipo === 'PJ' ? 'CNPJ inválido.' : 'CPF inválido.');
  if (!d.endereco) throw erro('Informe o endereço.');
  if (d.tipo === 'PJ' && !d.representante) throw erro('Informe o nome de quem assina pela empresa.');
  if (d.tipo === 'PJ' && !isValidCPF(d.representanteCpf)) throw erro('CPF de quem assina inválido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw erro('E-mail inválido.');
  if (dados?.aceite !== true) throw erro('Marque que você leu e concorda com o contrato.');
  const assinatura = validarAssinatura(dados?.assinatura);

  const m = meta(req);
  c.textoFinal = preencher(textoBase(c), camposDoCliente(d, hoje()));
  c.hash = sha256(c.textoFinal);
  c.cliente = { ...d, ...m, hash: c.hash };
  c.assCliente = assinatura;
  c.contratante = d.nome;
  c.documento = d.documento;
  c.status = S.bounce;
  await gravar(c);
  // proposta aceita
  await alterarProposta(c.propostaId, (p) => { p.status = STATUS_PROPOSTA.aprovada; }).catch((e) => console.error(e));
  return c;
}

/** A Bounce assina pelo painel, depois do contratante. */
export async function assinarBounce(id, dados, req) {
  const c = await pegar(id);
  if (c.status !== S.bounce) throw erro(c.status === S.cliente ? 'O contratante ainda não assinou.' : 'Este contrato não está aguardando a assinatura da Bounce.');
  const d = { nome: texto(dados?.nome, 160), cpf: onlyDigits(dados?.cpf).slice(0, 11), cargo: texto(dados?.cargo, 80) };
  if (!d.nome) throw erro('Informe o nome de quem assina pela Bounce.');
  if (!isValidCPF(d.cpf)) throw erro('CPF inválido.');
  if (dados?.aceite !== true) throw erro('Confirme que leu o contrato assinado pelo contratante.');
  const assinatura = validarAssinatura(dados?.assinatura);
  c.bounce = { ...d, ...meta(req), hash: sha256(c.textoFinal) };
  if (c.bounce.hash !== c.hash) throw erro('O texto do contrato não confere com o que foi assinado. Fale com o suporte.', 409);
  c.assBounce = assinatura;
  c.status = S.assinado;
  return gravar(c);
}

/** O que a página de assinatura recebe. */
export function contratoPublico(c) {
  const parte = (x, ass, tipo) => x && ({
    nome: tipo === 'cliente' ? (x.tipo === 'PJ' ? `${x.representante} (por ${x.nome})` : x.nome) : `${x.nome}${x.cargo ? ` — ${x.cargo}` : ''} (Bounce Basement)`,
    documento: mascararDoc(tipo === 'cliente' ? (x.tipo === 'PJ' ? x.representanteCpf : x.documento) : x.cpf),
    email: x.email || '', em: x.em, iso: x.iso, ip: x.ip, navegador: x.navegador, assinatura: ass,
  });
  const assinado = c.status === S.bounce || c.status === S.assinado;
  return {
    id: c.id, status: c.status,
    projeto: c.snapshot.conteudo.projeto || c.snapshot.conteudo.evento || '',
    texto: assinado ? c.textoFinal : textoBase(c),
    hash: c.hash,
    cliente: parte(c.cliente, c.assCliente, 'cliente'),
    bounce: parte(c.bounce, c.assBounce, 'bounce'),
    sugestao: assinado ? null : { nome: c.snapshot.conteudo.contratante || '' },
  };
}

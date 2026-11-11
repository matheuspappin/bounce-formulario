// Propostas comerciais para contratantes.
// Duas abas na mesma planilha:
//   "Modelos de proposta" → os textos e valores padrão (editáveis no painel)
//   "Propostas"           → cada proposta enviada, ligada (ou não) a uma lista de elenco
import crypto from 'node:crypto';
import config from '../casting.config.js';
import { g, SHEET_ID } from './store.js';
import { lerListas, inscricoesPorPasta, linkMidia, emLotes, STATUS as STATUS_LISTA } from './listas.js';
import { limparConteudo, calcular, MODELO_PADRAO } from '../shared/proposta.js';

export const ABA_MODELOS = 'Modelos de proposta';
export const ABA_PROPOSTAS = 'Propostas';
const COLS_MODELOS = ['ID', 'Nome do modelo', 'Conteúdo (não editar)', 'Atualizado em', 'Status'];
const COLS_PROPOSTAS = ['ID', 'Lista (ID)', 'Título', 'Contratante', 'Status', 'Total (R$)', 'Conteúdo (não editar)',
  'Chave do link', 'Criada em', 'Atualizada em', 'Versão'];

export const STATUS = { rascunho: 'Rascunho', enviada: 'Enviada', aprovada: 'Aprovada', recusada: 'Recusada', excluida: 'Excluída' };
const STATUS_EDITAVEIS = [STATUS.rascunho, STATUS.enviada, STATUS.aprovada, STATUS.recusada];

const agora = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const novoId = () => crypto.randomBytes(5).toString('hex');
export const novaChave = () => crypto.randomBytes(18).toString('base64url');
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const json = (s, padrao) => { try { return JSON.parse(s || ''); } catch { return padrao; } };

/* ---------------- modelos ---------------- */
function modeloDeLinha(r, linha) {
  return { id: r[0] || '', nome: r[1] || '', conteudo: limparConteudo(json(r[2], {})), atualizado: r[3] || '', status: r[4] || 'Ativo', _linha: linha };
}
const linhaModelo = (m) => [m.id, m.nome, JSON.stringify(m.conteudo), m.atualizado, m.status];

export async function lerModelos() {
  await g.ensureSheet(SHEET_ID(), ABA_MODELOS, COLS_MODELOS);
  const rows = await g.readRows(SHEET_ID(), ABA_MODELOS);
  let modelos = rows.slice(1).map((r, i) => modeloDeLinha(r, i + 2)).filter((m) => m.id);
  // primeira vez: cria o modelo padrão da Bounce
  if (!modelos.length) {
    const m = { id: novoId(), nome: 'Proposta padrão Bounce', conteudo: limparConteudo(MODELO_PADRAO), atualizado: agora(), status: 'Ativo' };
    m._linha = await g.appendRow(SHEET_ID(), ABA_MODELOS, linhaModelo(m));
    modelos = [m];
  }
  return modelos.filter((m) => m.status !== 'Excluído');
}

export async function salvarModelo({ id, nome, conteudo }) {
  nome = texto(nome, 120);
  if (!nome) throw erro('Dê um nome para o modelo.');
  const c = limparConteudo(conteudo);
  if (!id) {
    const m = { id: novoId(), nome, conteudo: c, atualizado: agora(), status: 'Ativo' };
    m._linha = await g.appendRow(SHEET_ID(), ABA_MODELOS, linhaModelo(m));
    return m;
  }
  const m = (await lerModelos()).find((x) => x.id === id);
  if (!m) throw erro('Modelo não encontrado.', 404);
  Object.assign(m, { nome, conteudo: c, atualizado: agora() });
  await g.writeRange(SHEET_ID(), ABA_MODELOS, `A${m._linha}`, linhaModelo(m));
  return m;
}

export async function excluirModelo(id) {
  const modelos = await lerModelos();
  const m = modelos.find((x) => x.id === id);
  if (!m) throw erro('Modelo não encontrado.', 404);
  if (modelos.length === 1) throw erro('Mantenha pelo menos um modelo.');
  m.status = 'Excluído'; m.atualizado = agora();
  await g.writeRange(SHEET_ID(), ABA_MODELOS, `A${m._linha}`, linhaModelo(m));
  return m;
}

/* ---------------- propostas ---------------- */
function propostaDeLinha(r, linha) {
  return {
    id: r[0] || '', listaId: r[1] || '', titulo: r[2] || '', contratante: r[3] || '', status: r[4] || STATUS.rascunho,
    total: r[5] || '', conteudo: limparConteudo(json(r[6], {})), chave: r[7] || '',
    criada: r[8] || '', atualizada: r[9] || '', versao: Number(r[10]) || 1, _linha: linha,
  };
}
const linhaProposta = (p) => [p.id, p.listaId, p.titulo, p.contratante, p.status, p.total, JSON.stringify(p.conteudo),
  p.chave, p.criada, p.atualizada, String(p.versao)];

export async function lerPropostas() {
  await g.ensureSheet(SHEET_ID(), ABA_PROPOSTAS, COLS_PROPOSTAS);
  const rows = await g.readRows(SHEET_ID(), ABA_PROPOSTAS);
  return rows.slice(1).map((r, i) => propostaDeLinha(r, i + 2)).filter((p) => p.id);
}

const pessoasAtivas = (l) => (l ? l.pessoas.filter((p) => !p.excluido) : []);

/** Total (texto) gravado na planilha, só para consulta rápida. */
function totalPlanilha(p, listas) {
  const l = listas.find((x) => x.id === p.listaId);
  const r = calcular(p.conteudo, pessoasAtivas(l).length);
  return `${r.total.toFixed(2).replace('.', ',')}${r.aCombinar ? ' + a combinar' : ''}`;
}

function sincronizarCampos(p) {
  p.titulo = p.conteudo.projeto || p.conteudo.evento || p.conteudo.titulo || 'Proposta';
  p.contratante = p.conteudo.contratante;
}

export async function criarProposta({ modeloId, listaId, copiarDe }) {
  const [modelos, listas, propostas] = await Promise.all([lerModelos(), lerListas(), copiarDe ? lerPropostas() : []]);
  let conteudo;
  if (copiarDe) {
    const orig = propostas.find((x) => x.id === copiarDe && x.status !== STATUS.excluida);
    if (!orig) throw erro('Proposta não encontrada.', 404);
    conteudo = structuredClone(orig.conteudo);
    conteudo.contratante = '';
    listaId = listaId ?? orig.listaId;
  } else {
    const m = modelos.find((x) => x.id === modeloId) || modelos[0];
    conteudo = structuredClone(m.conteudo);
  }
  const l = listaId ? listas.find((x) => x.id === listaId && x.status !== STATUS_LISTA.excluida) : null;
  if (l && !copiarDe) {
    conteudo.projeto = conteudo.projeto || l.evento || l.nome;
    conteudo.evento = conteudo.evento || l.evento;
    conteudo.data = conteudo.data || l.data;
    conteudo.contratante = conteudo.contratante || l.contratante;
  }
  const p = {
    id: novoId(), listaId: l?.id || '', status: STATUS.rascunho, conteudo: limparConteudo(conteudo),
    chave: novaChave(), criada: agora(), atualizada: agora(), versao: 1,
  };
  sincronizarCampos(p);
  p.total = totalPlanilha(p, listas);
  await g.ensureSheet(SHEET_ID(), ABA_PROPOSTAS, COLS_PROPOSTAS);
  p._linha = await g.appendRow(SHEET_ID(), ABA_PROPOSTAS, linhaProposta(p));
  return p;
}

/** Lê a versão mais recente, aplica a mudança e grava (procura pelo ID). */
export async function alterarProposta(id, mudar) {
  const [propostas, listas] = await Promise.all([lerPropostas(), lerListas()]);
  const p = propostas.find((x) => x.id === id && x.status !== STATUS.excluida);
  if (!p) throw erro('Proposta não encontrada.', 404);
  const versao = p.versao;
  mudar(p, listas);
  p.conteudo = limparConteudo(p.conteudo);
  if (!STATUS_EDITAVEIS.includes(p.status) && p.status !== STATUS.excluida) throw erro('Status inválido.');
  if (p.listaId && !listas.some((l) => l.id === p.listaId && l.status !== STATUS_LISTA.excluida)) p.listaId = '';
  sincronizarCampos(p);
  p.total = totalPlanilha(p, listas);
  p.atualizada = agora();
  p.versao = versao + 1;
  await g.writeRange(SHEET_ID(), ABA_PROPOSTAS, `A${p._linha}`, linhaProposta(p));
  return p;
}

/* ---------------- página pública ---------------- */
const CAMPOS_ELENCO = { idade: 'Idade', altura: 'Altura', tamanho_blusa: 'Blusa', tamanho_calca: 'Calça' };
const PROIBIDOS = new Set(['nome_completo', 'email', 'instagram', 'whatsapp', 'cpf', 'endereco', 'data_nascimento']);

export async function montarPropostaPublica(p) {
  const listas = await lerListas();
  const l = p.listaId ? listas.find((x) => x.id === p.listaId && x.status !== STATUS_LISTA.excluida) : null;
  const pessoas = pessoasAtivas(l);
  let elenco = [];
  if (p.conteudo.elenco.mostrar && pessoas.length) {
    const campos = Object.entries(config.propostas?.camposElenco || CAMPOS_ELENCO).filter(([k]) => !PROIBIDOS.has(k));
    const porPasta = await inscricoesPorPasta(pessoas);
    const exp = Date.now() + 12 * 3600_000;
    elenco = new Array(pessoas.length);
    await emLotes(pessoas.map((x, i) => [x, i]), 6, async ([x, i]) => {
      const o = porPasta.get(x.p) || {};
      const foto = (await g.listFolder(x.p).catch(() => [])).find((f) => f.mimeType?.startsWith('image'));
      elenco[i] = {
        nome: o.nome_artistico || x.nome || 'Perfil',
        foto: foto ? linkMidia(foto.id, exp) : '',
        info: campos.map(([k, label]) => {
          let v = o[k] || '';
          if (k === 'idade' && v) v = `${v} anos`;
          if (k === 'altura' && v) v = `${String(v).replace('.', ',')} m`;
          return { label, valor: v };
        }).filter((y) => y.valor),
      };
    });
  }
  return {
    proposta: p.conteudo,
    status: p.status,
    atualizada: p.atualizada,
    nLista: pessoas.length,
    elenco,
    contato: config.contato || {},
  };
}

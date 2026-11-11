// Listas para contratantes: grupos de perfis montados para um evento, com um link só de visualização.
// Ficam na aba "Listas para contratantes" da mesma planilha (uma linha por lista), então
// cada evento é independente e dá para ter quantas listas quiser ao mesmo tempo.
import crypto from 'node:crypto';
import config from '../casting.config.js';
import { columns } from './columns.js';
import { g, SHEET_ID } from './store.js';
import { sign } from './sign.js';

export const ABA = 'Listas para contratantes';
const COLS = ['ID', 'Nome da lista', 'Evento', 'Data do evento', 'Contratante', 'Status', 'Pessoas',
  'Chave do link', 'Criada em', 'Atualizada em', 'Versão', 'Concluída em', 'Resultado'];
export const STATUS = { ativa: 'Ativa', encerrada: 'Encerrada', concluida: 'Concluída', excluida: 'Excluída' };
export const MAX_PESSOAS = 200;

// o que o contratante pode ver (nada de contato, CPF, endereço ou nome completo)
const CAMPOS_PADRAO = {
  genero: 'Gênero', idade: 'Idade', cidade: 'Cidade', altura: 'Altura (m)',
  tamanho_blusa: 'Blusa', tamanho_calca: 'Calça',
  estilos_dominio: 'Domina / em estudo', estilos_estudados: 'Já estudou',
  tem_experiencia: 'Experiência profissional', experiencias: 'Áreas de experiência', experiencia_detalhes: 'Sobre a experiência',
};
const PROIBIDOS = new Set(['nome_completo', 'email', 'instagram', 'whatsapp', 'cpf', 'endereco', 'data_nascimento']);
export const camposVisiveis = () => Object.entries(config.listas?.campos || CAMPOS_PADRAO).filter(([k]) => !PROIBIDOS.has(k));

const agora = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);
export const novaChave = () => crypto.randomBytes(18).toString('base64url');
const novoId = () => crypto.randomBytes(5).toString('hex');

export const mesmaChave = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Limpa a lista de pessoas: [{ c: slug do casting, p: id da pasta, nome, nota }] sem repetidos. */
export function limparPessoas(lista) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).map((x) => ({
    c: texto(x?.c || config.slug, 120), p: texto(x?.p, 300), nome: texto(x?.nome, 120), nota: texto(x?.nota, 1000),
    // ok: participou do trabalho (só existe em listas concluídas)
    ...(typeof x?.ok === 'boolean' ? { ok: x.ok } : {}),
    ...(x?.excluido ? { excluido: true } : {}),
  })).filter((x) => x.p && !vistos.has(x.p) && vistos.add(x.p)).slice(0, MAX_PESSOAS);
}

function deLinha(r, linha) {
  let pessoas = [];
  try { pessoas = JSON.parse(r[6] || '[]'); } catch {}
  return {
    id: r[0] || '', nome: r[1] || '', evento: r[2] || '', data: r[3] || '', contratante: r[4] || '',
    status: r[5] || STATUS.ativa, pessoas: limparPessoas(pessoas), chave: r[7] || '',
    criada: r[8] || '', atualizada: r[9] || '', versao: Number(r[10]) || 1,
    concluida: r[11] || '', resultado: r[12] || '', _linha: linha,
  };
}
const paraLinha = (l) => [l.id, l.nome, l.evento, l.data, l.contratante, l.status,
  JSON.stringify(l.pessoas), l.chave, l.criada, l.atualizada, String(l.versao), l.concluida || '', l.resultado || ''];

export async function lerListas() {
  await g.ensureSheet(SHEET_ID(), ABA, COLS);
  const rows = await g.readRows(SHEET_ID(), ABA);
  // abas criadas antes de existir "Concluída em"/"Resultado" ganham as colunas novas no fim
  if (rows[0] && rows[0].length < COLS.length) {
    await g.writeRange(SHEET_ID(), ABA, 'A1', COLS);
    rows[0] = [...COLS];
  }
  return rows.slice(1).map((r, i) => deLinha(r, i + 2)).filter((l) => l.id);
}

export async function criarLista(dados) {
  const l = {
    id: novoId(), nome: texto(dados.nome, 120), evento: texto(dados.evento, 160), data: texto(dados.data, 20),
    contratante: texto(dados.contratante, 160), status: STATUS.ativa, pessoas: limparPessoas(dados.pessoas),
    chave: novaChave(), criada: agora(), atualizada: agora(), versao: 1,
  };
  if (!l.nome) throw Object.assign(new Error('Dê um nome para a lista.'), { status: 400 });
  await g.ensureSheet(SHEET_ID(), ABA, COLS);
  l._linha = await g.appendRow(SHEET_ID(), ABA, paraLinha(l));
  return l;
}

/** Lê a versão mais recente da lista, aplica a mudança e grava (procura pelo ID, não pela posição da linha). */
export async function alterarLista(id, mudar) {
  const listas = await lerListas();
  const l = listas.find((x) => x.id === id && x.status !== STATUS.excluida);
  return aplicar(l, listas, mudar);
}

async function aplicar(l, listas, mudar) {
  if (!l) throw Object.assign(new Error('Lista não encontrada.'), { status: 404 });
  const id = l.id;
  const antes = structuredClone(l);
  mudar(l);
  l.nome = texto(l.nome, 120);
  if (!l.nome) throw Object.assign(new Error('Dê um nome para a lista.'), { status: 400 });
  l.atualizada = agora();
  l.versao = antes.versao + 1;
  await g.writeRange(SHEET_ID(), ABA, `A${l._linha}`, paraLinha(l));
  // `listas` já tem a versão nova (o objeto foi alterado no lugar); `listasAntes` tem a anterior
  return { lista: l, listasAntes: listas.map((x) => (x.id === id ? antes : x)), listasDepois: listas };
}

/**
 * Perfil excluído: sai das listas em andamento. Nas concluídas o nome fica no histórico (marcado como excluído).
 * Devolve { antes, depois } para ajustar o compartilhamento dos vídeos.
 */
export async function tirarPerfilDasListas(pasta) {
  const listas = await lerListas();
  const antes = structuredClone(listas);
  for (const l of listas) {
    if (!l.pessoas.some((p) => p.p === pasta) || l.status === STATUS.excluida) continue;
    await aplicar(l, listas, (x) => {
      if (x.status === STATUS.concluida) x.pessoas = x.pessoas.map((p) => (p.p === pasta ? { ...p, excluido: true } : p));
      else x.pessoas = x.pessoas.filter((p) => p.p !== pasta);
    });
  }
  return { antes, depois: listas };
}

/* ---------- vídeos: compartilhamento por link só enquanto a pessoa estiver em alguma lista ativa ---------- */
const pastasAtivas = (listas) => new Set(listas.filter((l) => l.status === STATUS.ativa).flatMap((l) => l.pessoas.map((p) => p.p)));

async function emLotes(itens, n, fn) {
  const fila = [...itens];
  await Promise.all(Array.from({ length: Math.min(n, fila.length) }, async () => { while (fila.length) await fn(fila.shift()); }));
}

/** Compara o antes e o depois e liga/desliga o link só das pastas que mudaram. Devolve um aviso se algo falhar. */
export async function sincronizarVideos(listasAntes, listasDepois) {
  const a = pastasAtivas(listasAntes); const d = pastasAtivas(listasDepois);
  const mudaram = [...new Set([...a, ...d])].filter((p) => a.has(p) !== d.has(p));
  let falhas = 0;
  await emLotes(mudaram, 4, async (pasta) => {
    try {
      const videos = (await g.listFolder(pasta)).filter((f) => f.mimeType?.startsWith('video'));
      await Promise.all(videos.map((v) => g.setPublic(v.id, d.has(pasta))));
    } catch (e) { console.error(e); falhas++; }
  });
  return falhas ? `Não foi possível ajustar o acesso aos vídeos de ${falhas} perfil(is). Tente salvar de novo.` : '';
}

/* ---------- versão pública (o que o contratante vê) ---------- */
const VALIDADE_MIDIA = 12 * 3600_000;
export const assinarMidia = (fileId, exp) => sign(`lista-midia|${fileId}|${exp}`);

/** Lê as inscrições dos castings usados pelas pessoas, indexadas pela pasta no Drive. */
export async function inscricoesPorPasta(pessoas) {
  const cols = columns(config);
  const porLabel = new Map(cols.map((c) => [c.label, c.key]));
  const porPasta = new Map();
  for (const slug of [...new Set(pessoas.map((p) => p.c))]) {
    const [head = [], ...rows] = await g.readRows(SHEET_ID(), slug);
    const keys = head.map((label) => porLabel.get(label) || '');
    for (const r of rows) {
      const o = {}; keys.forEach((k, i) => { if (k) o[k] = r[i] ?? ''; });
      const pasta = g.folderIdFromLink(o._pasta || '');
      if (pasta) porPasta.set(pasta, o);
    }
  }
  return porPasta;
}

/** Endereço assinado (12h) de uma foto ou capa de vídeo para páginas públicas. */
export function linkMidia(id, exp = Date.now() + VALIDADE_MIDIA) {
  return `/api/lista-midia?f=${encodeURIComponent(id)}&e=${exp}&s=${assinarMidia(id, exp)}`;
}
export { emLotes };

export async function montarPublico(l) {
  const campos = camposVisiveis();
  const exp = Date.now() + VALIDADE_MIDIA;
  const midia = (id) => linkMidia(id, exp);

  // inscrições de cada casting usado na lista, indexadas pela pasta
  const porPasta = await inscricoesPorPasta(l.pessoas);

  const pessoas = new Array(l.pessoas.length);
  await emLotes(l.pessoas.map((p, i) => [p, i]), 6, async ([p, i]) => {
    const o = porPasta.get(p.p) || {};
    const arquivos = await g.listFolder(p.p).catch(() => []);
    const info = campos.map(([k, label]) => {
      let valor = o[k] || '';
      if (o[`${k}_outros`]) valor = [valor, o[`${k}_outros`]].filter(Boolean).join(', ');
      return { k, label, valor };
    }).filter((x) => x.valor);
    pessoas[i] = {
      nome: o.nome_artistico || p.nome || 'Perfil',
      nota: p.nota,
      info,
      fotos: arquivos.filter((f) => f.mimeType?.startsWith('image')).map((f) => midia(f.id)),
      videos: arquivos.filter((f) => f.mimeType?.startsWith('video')).map((f) => ({
        capa: midia(f.id), player: g.videoEmbed(f.id), arquivo: g.videoEmbed(f.id) ? null : `${midia(f.id)}&video=1`,
      })),
    };
  });

  return {
    lista: { nome: l.nome, evento: l.evento, data: l.data, contratante: l.contratante },
    pessoas,
    contato: config.contato || {},
  };
}

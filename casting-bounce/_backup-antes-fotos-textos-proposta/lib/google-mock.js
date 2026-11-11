// Simulação do Google Drive/Sheets para testar no computador antes de configurar o Google.
// Arquivos vão para a pasta ./teste-local/ ; a "planilha" vira teste-local/<aba>.csv
// Aqui o "id" de uma pasta/arquivo é o caminho relativo dentro de teste-local.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve('teste-local');
const abs = (id = '') => {
  const p = path.resolve(ROOT, id === 'root' ? '' : id);
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) throw new Error('caminho inválido');
  return p;
};
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const clean = (name) => name.replace(/[\\/:*?"<>|]/g, '_');
const sessions = new Map();
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };

export async function createFolder(name, parentId = 'root') {
  const p = path.join(abs(parentId), clean(name));
  await fs.mkdir(p, { recursive: true });
  return { id: rel(p), webViewLink: p };
}
export async function findOrCreateFolder(name, parentId) {
  return (await createFolder(name, parentId)).id;
}
export async function createUploadSession({ name, size, parentId }) {
  const token = crypto.randomUUID();
  sessions.set(token, { file: path.join(abs(parentId), clean(name)), size });
  return `/__upload_local/${token}`;
}
export async function receiveUpload(token, buffer) {
  const s = sessions.get(token);
  if (!s || buffer.length !== Number(s.size)) return false;
  await fs.writeFile(s.file, buffer);
  sessions.delete(token);
  return true;
}
export async function listFolder(folderId) {
  try {
    const dir = abs(folderId);
    return (await fs.readdir(dir)).sort().map((name) => {
      const id = rel(path.join(dir, name));
      return { id, name, mimeType: MIME[path.extname(name).toLowerCase()] || 'application/octet-stream', webViewLink: `/__arquivo_local/${encodeURI(id)}` };
    });
  } catch { return []; }
}
export async function fileThumbnail(fileId) {
  const p = abs(fileId);
  const type = MIME[path.extname(p).toLowerCase()] || '';
  if (!type.startsWith('image/')) return null; // no modo local, vídeos não têm miniatura
  return { type, buffer: await fs.readFile(p) };
}
export async function readLocalFile(fileId) {
  const p = abs(fileId);
  return { type: MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', path: p };
}
export async function folderLink(folderId) {
  return `local:${folderId}`;
}
export const folderIdFromLink = (link = '') => (link.startsWith('local:') ? link.slice(6) : '');

const store = (sheet) => path.join(ROOT, `${sheet}.csv`);
const cell = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export async function readRows(_id, sheet) {
  try { return JSON.parse(await fs.readFile(store(sheet) + '.json', 'utf8')); } catch { return []; }
}
async function writeRows(sheet, rows) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(store(sheet) + '.json', JSON.stringify(rows));
  await fs.writeFile(store(sheet), '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n'));
}
export async function ensureSheet(_id, sheet, header) {
  if (!(await readRows(_id, sheet)).length) await writeRows(sheet, [header]);
}
export async function appendRow(_id, sheet, values) {
  const rows = await readRows(_id, sheet);
  rows.push(values);
  await writeRows(sheet, rows);
  return rows.length;
}
const colIdx = (a1) => a1.match(/^[A-Z]+/)[0].split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const rowIdx = (a1) => Number(a1.match(/\d+/)[0]) - 1;
export async function readCell(_id, sheet, a1) {
  return (await readRows(_id, sheet))[rowIdx(a1)]?.[colIdx(a1)] ?? '';
}
export async function writeCell(_id, sheet, a1, value) {
  const rows = await readRows(_id, sheet);
  rows[rowIdx(a1)][colIdx(a1)] = value;
  await writeRows(sheet, rows);
}
export async function writeRange(_id, sheet, a1, values) {
  const rows = await readRows(_id, sheet);
  const r = rowIdx(a1), c = colIdx(a1);
  while (rows.length <= r) rows.push([]);
  values.forEach((v, i) => { rows[r][c + i] = v; });
  for (const row of rows) for (let i = 0; i < row.length; i++) if (row[i] == null) row[i] = '';
  await writeRows(sheet, rows);
}

/* ---------- listas para contratantes ---------- */
export async function fileParents(fileId) {
  const dir = path.posix.dirname(fileId);
  return dir && dir !== '.' ? [dir] : [];
}
export async function setPublic() {} // no modo local não há compartilhamento
export const videoEmbed = () => null; // no modo local o vídeo passa pelo servidor

/* ---------- excluir perfil ---------- */
export async function trashFile(fileId) {
  const lixeira = path.join(ROOT, '_lixeira');
  await fs.mkdir(lixeira, { recursive: true });
  await fs.rename(abs(fileId), path.join(lixeira, `${Date.now()}-${path.basename(abs(fileId))}`));
}
export async function deleteRow(_id, sheet, rowNumber) {
  const rows = await readRows(_id, sheet);
  rows.splice(rowNumber - 1, 1);
  await writeRows(sheet, rows);
}

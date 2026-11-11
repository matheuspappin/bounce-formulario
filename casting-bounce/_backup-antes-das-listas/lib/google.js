// Acesso ao Google Drive e Google Sheets usando só fetch (sem dependências).
// Credenciais vêm das variáveis de ambiente (veja README → "Configurar o Google").

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Variável de ambiente ${k} não configurada.`);
  return v;
};

let cached = { token: '', exp: 0 };

export async function accessToken() {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Falha ao autenticar no Google: ${data.error_description || data.error}`);
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function api(url, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body && !raw ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      ...headers,
    },
    body: body && !raw ? JSON.stringify(body) : body,
  });
  if (!res.ok) {
    const txt = await res.text();
    let msg = txt.slice(0, 300);
    try { msg = JSON.parse(txt).error?.message || msg; } catch {}
    throw new Error(`Google ${res.status} (${method} ${decodeURIComponent(url.split('?')[0].split('/').slice(-2).join('/'))}): ${msg}`);
  }
  return res;
}

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const FOLDER = 'application/vnd.google-apps.folder';
const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function createFolder(name, parentId) {
  const res = await api(`${DRIVE}?fields=id,webViewLink`, {
    method: 'POST',
    body: { name, mimeType: FOLDER, ...(parentId ? { parents: [parentId] } : {}) },
  });
  return res.json(); // { id, webViewLink }
}

const folderCache = new Map();
export async function findOrCreateFolder(name, parentId) {
  const key = `${parentId}/${name}`;
  if (folderCache.has(key)) return folderCache.get(key);
  const query = `name='${q(name)}' and mimeType='${FOLDER}' and '${parentId}' in parents and trashed=false`;
  const res = await api(`${DRIVE}?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`);
  const found = (await res.json()).files?.[0]?.id;
  const id = found || (await createFolder(name, parentId)).id;
  folderCache.set(key, id);
  return id;
}

/** Cria uma sessão de upload; o navegador envia o arquivo direto para a URL retornada. */
export async function createUploadSession({ name, mimeType, size, parentId, origin }) {
  const res = await api(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    body: { name, parents: [parentId] },
    headers: {
      'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(size),
      ...(origin ? { Origin: origin } : {}), // libera o envio direto do navegador (CORS)
    },
  });
  return res.headers.get('location');
}

export async function listFolder(folderId) {
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await api(`${DRIVE}?q=${encodeURIComponent(query)}&fields=files(id,name,size,mimeType,webViewLink)&orderBy=name&pageSize=100`);
  return (await res.json()).files || [];
}

/** Miniatura de uma foto ou vídeo do Drive (imagem pequena, segura para passar pela Vercel). */
export async function fileThumbnail(fileId, size = 800) {
  const meta = await (await api(`${DRIVE}/${fileId}?fields=thumbnailLink,mimeType`)).json();
  if (!meta.thumbnailLink) return null;
  const url = meta.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) return null;
  return { type: res.headers.get('content-type') || 'image/jpeg', buffer: Buffer.from(await res.arrayBuffer()) };
}

/** Todas as linhas de uma aba (a primeira é o cabeçalho). */
export async function readRows(spreadsheetId, sheet) {
  try {
    const res = await api(`${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(`'${sheet}'`)}`);
    return (await res.json()).values || [];
  } catch (e) {
    if (String(e.message).includes('400')) return []; // aba ainda não existe
    throw e;
  }
}

export async function folderLink(folderId) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
export const folderIdFromLink = (link = '') => link.match(/folders\/([\w-]+)/)?.[1] || '';

const range = (sheet, a1) => encodeURIComponent(`'${sheet}'!${a1}`);

/** Adiciona uma linha e devolve o número dela. */
export async function appendRow(spreadsheetId, sheet, values) {
  const res = await api(
    `${SHEETS}/${spreadsheetId}/values/${range(sheet, 'A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: { values: [values] } });
  const updated = (await res.json()).updates?.updatedRange || '';
  return Number(updated.match(/![A-Z]+(\d+)/)?.[1]);
}

export async function readCell(spreadsheetId, sheet, a1) {
  const res = await api(`${SHEETS}/${spreadsheetId}/values/${range(sheet, a1)}`);
  return (await res.json()).values?.[0]?.[0] ?? '';
}

export async function writeCell(spreadsheetId, sheet, a1, value) {
  await api(`${SHEETS}/${spreadsheetId}/values/${range(sheet, a1)}?valueInputOption=RAW`, {
    method: 'PUT', body: { values: [[value]] },
  });
}

export async function createSpreadsheet(title, sheet, parentId) {
  const res = await api(SHEETS, {
    method: 'POST',
    body: {
      properties: { title, locale: 'pt_BR', timeZone: 'America/Sao_Paulo' },
      sheets: [{ properties: { title: sheet, gridProperties: { frozenRowCount: 1 } } }],
    },
  });
  const { spreadsheetId } = await res.json();
  if (parentId) await api(`${DRIVE}/${spreadsheetId}?addParents=${parentId}&removeParents=root`, { method: 'PATCH', body: {} });
  return spreadsheetId;
}

export async function setHeader(spreadsheetId, sheet, header) {
  await api(`${SHEETS}/${spreadsheetId}/values/${range(sheet, 'A1')}?valueInputOption=RAW`, {
    method: 'PUT', body: { values: [header] },
  });
}

const sheetCache = new Set();
/** Garante que existe uma aba com esse nome e cabeçalho (uma aba por casting). */
export async function ensureSheet(spreadsheetId, sheet, header) {
  if (sheetCache.has(sheet)) return;
  const res = await api(`${SHEETS}/${spreadsheetId}?fields=sheets.properties.title`);
  const titles = ((await res.json()).sheets || []).map((s) => s.properties.title);
  if (!titles.includes(sheet)) {
    await api(`${SHEETS}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: { requests: [{ addSheet: { properties: { title: sheet, gridProperties: { frozenRowCount: 1 } } } }] },
    });
  }
  if (!titles.includes(sheet) || !(await readCell(spreadsheetId, sheet, 'A1'))) await setHeader(spreadsheetId, sheet, header);
  sheetCache.add(sheet);
}

const letterToIndex = (l) => l.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const indexToLetter = (n) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** Aumenta o número de colunas da aba se for preciso (abas novas têm só A–Z). */
async function ensureColumns(spreadsheetId, sheet, needed) {
  const res = await api(`${SHEETS}/${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties.columnCount)`);
  const props = ((await res.json()).sheets || []).map((x) => x.properties).find((p) => p.title === sheet);
  if (!props) return;
  const count = props.gridProperties?.columnCount || 26;
  if (count >= needed) return;
  await api(`${SHEETS}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: { requests: [{ appendDimension: { sheetId: props.sheetId, dimension: 'COLUMNS', length: needed - count } }] },
  });
}

/** Grava uma linha de valores a partir de uma célula (ex.: 'AD5' → AD5, AE5, AF5…). */
export async function writeRange(spreadsheetId, sheet, a1, values) {
  const [, col, row] = a1.match(/^([A-Z]+)(\d+)$/);
  const last = letterToIndex(col) + values.length - 1;
  if (last >= 26) await ensureColumns(spreadsheetId, sheet, last + 1);
  await api(`${SHEETS}/${spreadsheetId}/values/${range(sheet, `${a1}:${indexToLetter(last)}${row}`)}?valueInputOption=RAW`, {
    method: 'PUT', body: { values: [values] },
  });
}

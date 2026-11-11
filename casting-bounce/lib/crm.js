// Garante que a planilha tem as colunas do CRM (planilhas antigas ganham as colunas no fim).
import config from '../casting.config.js';
import { header, colLetter } from './columns.js';
import { g, SHEET_ID } from './store.js';

export async function ensureHeader() {
  const rows = await g.readRows(SHEET_ID(), config.slug);
  const head = rows[0] || [];
  const want = header(config);
  const missing = want.filter((l) => !head.includes(l));
  if (missing.length) {
    await g.writeRange(SHEET_ID(), config.slug, `${colLetter(head.length)}1`, missing);
    head.push(...missing);
  }
  return { head, rows };
}

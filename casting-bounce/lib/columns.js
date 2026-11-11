// Colunas da planilha, geradas a partir do casting.config.js
import { allFields } from '../shared/rules.js';

export const CRM_COLS = [
  { key: '_etapa', label: 'Etapa (CRM)' },
  { key: '_notas', label: 'Anotações (CRM)' },
  { key: '_atualizado', label: 'Atualizado em (CRM)' },
];

export function columns(config) {
  const cols = [
    { key: '_status', label: 'Status' },
    { key: '_recebido', label: 'Recebido em' },
  ];
  for (const f of allFields(config)) {
    cols.push({ key: f.name, label: f.label, type: f.type });
    if (f.other) cols.push({ key: `${f.name}_outros`, label: `${f.label} — outros` });
  }
  cols.push({ key: '_pasta', label: 'Pasta no Drive (fotos e vídeos)' });
  cols.push(...CRM_COLS);
  return cols;
}

export const header = (config) => columns(config).map((c) => c.label);

export function row(config, values, extra) {
  return columns(config).map((c) => {
    if (c.key in extra) return extra[c.key];
    if (c.type === 'files') return `${extra._files?.[c.key] ?? 0} arquivo(s)`;
    const v = values[c.key];
    if (Array.isArray(v)) return v.join(', ');
    return v == null ? '' : String(v);
  });
}

export const colLetter = (n) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
export const pastaColumn = (config) => colLetter(columns(config).findIndex((c) => c.key === '_pasta'));

// CRM: muda a etapa e/ou as anotações de uma inscrição (grava nas colunas da planilha).
import config from '../../casting.config.js';
import { CRM_COLS, colLetter } from '../../lib/columns.js';
import { g, SHEET_ID } from '../../lib/store.js';
import { guard } from '../../lib/admin-auth.js';
import { ensureHeader } from '../../lib/crm.js';

const label = (key) => CRM_COLS.find((c) => c.key === key).label;

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const etapas = config.crm?.etapas || [];
    if (body.etapa != null && !etapas.includes(body.etapa)) return res.status(400).json({ message: 'Etapa inválida.' });
    if (body.etapa == null && body.notas == null) return res.status(400).json({ message: 'Nada para salvar.' });

    const { head, rows } = await ensureHeader();
    const pastaIdx = head.findIndex((h) => h.startsWith('Pasta no Drive'));

    // confere que a linha ainda é da mesma pessoa (alguém pode ter ordenado/apagado linhas na planilha)
    let linha = Number(body.linha);
    const pastaDe = (n) => g.folderIdFromLink(rows[n - 1]?.[pastaIdx] || '');
    if (body.pasta && pastaDe(linha) !== body.pasta) {
      linha = rows.findIndex((_, i) => i > 0 && pastaDe(i + 1) === body.pasta) + 1;
    }
    if (!(linha >= 2 && linha <= rows.length)) return res.status(404).json({ message: 'Inscrição não encontrada na planilha.' });

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const set = async (key, value) => {
      const i = head.indexOf(label(key));
      await g.writeRange(SHEET_ID(), config.slug, `${colLetter(i)}${linha}`, [value]);
    };
    if (body.etapa != null) await set('_etapa', body.etapa);
    if (body.notas != null) await set('_notas', String(body.notas).slice(0, 5000));
    await set('_atualizado', agora);

    res.status(200).json({ ok: true, linha, atualizado: agora });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Não foi possível salvar na planilha.' });
  }
}

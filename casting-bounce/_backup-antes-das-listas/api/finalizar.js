// 2º passo: depois dos uploads, confere os arquivos na pasta e marca a linha da planilha.
import config from '../casting.config.js';
import { g, SHEET_ID } from '../lib/store.js';
import { verify } from '../lib/sign.js';
import { pastaColumn, columns, colLetter } from '../lib/columns.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  try {
    const { folderId, row, total, token } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!verify(`${folderId}|${row}|${total}`, token)) return res.status(403).json({ message: 'Envio inválido.' });

    const link = await g.folderLink(folderId);
    const head = (await g.readRows(SHEET_ID(), config.slug))[0] || [];
    const pastaIdx = head.indexOf(columns(config).find((c) => c.key === '_pasta').label);
    const col = pastaIdx >= 0 ? colLetter(pastaIdx) : pastaColumn(config);
    if ((await g.readCell(SHEET_ID(), config.slug, `${col}${row}`)) !== link)
      return res.status(409).json({ message: 'Inscrição não encontrada.' });

    const arquivos = await g.listFolder(folderId);
    const status = arquivos.length >= total
      ? `✅ COMPLETO (${arquivos.length} arquivos)`
      : `⚠ INCOMPLETO (${arquivos.length} de ${total} arquivos)`;
    await g.writeCell(SHEET_ID(), config.slug, `A${row}`, status);
    res.status(200).json({ ok: true, completo: arquivos.length >= total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Erro ao finalizar.' });
  }
}

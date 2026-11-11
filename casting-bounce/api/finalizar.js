// 2º passo: depois dos uploads, confere os arquivos na pasta e marca a linha da planilha.
import config from '../casting.config.js';
import { g, SHEET_ID } from '../lib/store.js';
import { verify } from '../lib/sign.js';
import { columns } from '../lib/columns.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  try {
    const { folderId, row, total, token } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!verify(`${folderId}|${row}|${total}`, token)) return res.status(403).json({ message: 'Envio inválido.' });

    const link = await g.folderLink(folderId);
    const rows = await g.readRows(SHEET_ID(), config.slug);
    const head = rows[0] || [];
    const pastaIdx = head.indexOf(columns(config).find((c) => c.key === '_pasta').label);
    // a linha pode ter mudado de lugar (ex.: um perfil acima foi excluído no painel): procura pela pasta
    let linha = Number(row);
    if (pastaIdx < 0 || rows[linha - 1]?.[pastaIdx] !== link) linha = rows.findIndex((r, i) => i > 0 && r[pastaIdx] === link) + 1;
    if (linha < 2) return res.status(409).json({ message: 'Inscrição não encontrada.' });

    const arquivos = await g.listFolder(folderId);
    const status = arquivos.length >= total
      ? `✅ COMPLETO (${arquivos.length} arquivos)`
      : `⚠ INCOMPLETO (${arquivos.length} de ${total} arquivos)`;
    await g.writeCell(SHEET_ID(), config.slug, `A${linha}`, status);
    res.status(200).json({ ok: true, completo: arquivos.length >= total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Erro ao finalizar.' });
  }
}

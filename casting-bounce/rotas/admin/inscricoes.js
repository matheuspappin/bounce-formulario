// Lista as inscrições a partir da planilha.
import config from '../../casting.config.js';
import { columns } from '../../lib/columns.js';
import { g, isMock, SHEET_ID, ROOT_FOLDER } from '../../lib/store.js';
import { guard } from '../../lib/admin-auth.js';
import { ensureHeader } from '../../lib/crm.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    let rows = await g.readRows(SHEET_ID(), config.slug);
    if (rows.length) rows = (await ensureHeader()).rows; // planilhas antigas ganham as colunas do CRM
    const [head = [], ...data] = rows;
    const cols = columns(config);
    const etapas = config.crm?.etapas || [];
    const byLabel = new Map(cols.map((c) => [c.label, c]));
    const keyAt = head.map((label, i) => byLabel.get(label)?.key || `col_${i}`);
    const fields = head.map((label, i) => ({ key: keyAt[i], label, type: byLabel.get(label)?.type || 'text' }));

    const inscricoes = data.map((r, i) => {
      const o = { _linha: i + 2 };
      keyAt.forEach((k, j) => { o[k] = r[j] ?? ''; });
      o._pastaId = g.folderIdFromLink(o._pasta);
      if (!o._etapa) o._etapa = etapas[0] || '';
      return o;
    }).filter((o) => o._pastaId || o.nome_completo).reverse(); // mais recentes primeiro

    const configEstilos = config.secoes?.flatMap((s) => s.campos)?.find((c) => c.name === 'estilos_dominio')?.options || [];

    res.status(200).json({
      casting: { slug: config.slug, titulo: config.hero.titulo, estilos: configEstilos },
      crm: { etapas, mensagens: config.crm?.mensagens || {} },
      fields,
      inscricoes,
      planilha: isMock ? null : `https://docs.google.com/spreadsheets/d/${SHEET_ID()}`,
      pastaRaiz: isMock ? null : `https://drive.google.com/drive/folders/${ROOT_FOLDER()}`,
    });
  } catch (e) {
    console.error(e);
    const falta = String(e.message).match(/Variável de ambiente (\w+)/)?.[1];
    res.status(500).json({ message: falta
      ? `Google não configurado na Vercel (falta ${falta}). Rode o PUBLICAR-VERCEL.bat.`
      : `Não foi possível ler a planilha: ${String(e.message).slice(0, 160)}` });
  }
}

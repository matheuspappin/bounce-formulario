// Exclui um perfil do painel:
//  1. copia a linha para a aba "Perfis excluídos" (registro do que foi apagado e quando)
//  2. tira a pessoa das listas em andamento (nas concluídas o nome fica no relatório) e desliga o link dos vídeos
//  3. manda a pasta de fotos/vídeos para a lixeira do Drive (recuperável por 30 dias)
//  4. apaga a linha da aba do casting
import config from '../../casting.config.js';
import { g, SHEET_ID } from '../../lib/store.js';
import { guard } from '../../lib/admin-auth.js';
import { ensureHeader } from '../../lib/crm.js';
import { tirarPerfilDasListas, sincronizarVideos } from '../../lib/listas.js';

const ARQUIVO = 'Perfis excluídos';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const pasta = String(b.pasta || '');
    if (!pasta) return res.status(400).json({ message: 'Perfil sem pasta no Drive.' });

    const { head, rows } = await ensureHeader();
    const pastaIdx = head.findIndex((h) => h.startsWith('Pasta no Drive'));
    const linha = rows.findIndex((r, i) => i > 0 && g.folderIdFromLink(r[pastaIdx] || '') === pasta) + 1;
    if (linha < 2) return res.status(404).json({ message: 'Perfil não encontrado na planilha (talvez já tenha sido excluído).' });

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await g.ensureSheet(SHEET_ID(), ARQUIVO, ['Excluído em', 'Casting', ...head]);
    await g.appendRow(SHEET_ID(), ARQUIVO, [agora, config.slug, ...rows[linha - 1].map((v) => v ?? '')]);

    const { antes, depois } = await tirarPerfilDasListas(pasta);
    const aviso = await sincronizarVideos(antes, depois);

    let avisoDrive = '';
    try { await g.trashFile(pasta); } catch (e) { console.error(e); avisoDrive = 'A pasta no Drive não foi para a lixeira — apague manualmente se quiser.'; }

    // confere de novo a posição (alguém pode ter mexido na planilha nesse meio tempo)
    const atual = await g.readRows(SHEET_ID(), config.slug);
    const n = atual.findIndex((r, i) => i > 0 && g.folderIdFromLink(r[pastaIdx] || '') === pasta) + 1;
    if (n >= 2) await g.deleteRow(SHEET_ID(), config.slug, n);

    res.status(200).json({ ok: true, aviso: [aviso, avisoDrive].filter(Boolean).join(' ') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: `Não foi possível excluir o perfil: ${String(e.message).slice(0, 160)}` });
  }
}

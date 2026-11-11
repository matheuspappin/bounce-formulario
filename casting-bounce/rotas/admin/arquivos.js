// Fotos e vídeos de uma inscrição (pasta no Drive).
import { g } from '../../lib/store.js';
import { guard } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const pasta = new URL(req.url, 'http://x').searchParams.get('pasta') || '';
    if (!pasta) return res.status(400).json({ message: 'Pasta não informada.' });
    const files = (await g.listFolder(pasta)).map((f) => ({
      id: f.id, nome: f.name, tipo: f.mimeType?.startsWith('video') ? 'video' : f.mimeType?.startsWith('image') ? 'foto' : 'outro',
      abrir: f.webViewLink,
    }));
    res.status(200).json({ arquivos: files });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Não foi possível listar os arquivos.' });
  }
}

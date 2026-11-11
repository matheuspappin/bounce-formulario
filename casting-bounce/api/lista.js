// Página do contratante: devolve a lista (só visualização, sem dados de contato).
import { lerListas, montarPublico, mesmaChave, STATUS } from '../lib/listas.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });
  try {
    const c = new URL(req.url, 'http://x').searchParams.get('c') || '';
    const [id, chave] = c.split('.');
    const l = id && (await lerListas()).find((x) => x.id === id);
    if (!l || l.status !== STATUS.ativa || !mesmaChave(chave, l.chave))
      return res.status(404).json({ message: 'Esta lista não está disponível. Fale com a Bounce Basement para receber um link atualizado.' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).json(await montarPublico(l));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Não foi possível carregar a lista. Tente novamente em instantes.' });
  }
}

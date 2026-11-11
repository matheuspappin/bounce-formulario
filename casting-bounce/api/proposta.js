// Página da proposta para o contratante (só visualização, sem dados de contato do elenco).
import { lerPropostas, montarPropostaPublica, STATUS } from '../lib/propostas.js';
import { mesmaChave } from '../lib/listas.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Método não permitido' });
  try {
    const c = new URL(req.url, 'http://x').searchParams.get('c') || '';
    const [id, chave] = c.split('.');
    const p = id && (await lerPropostas()).find((x) => x.id === id);
    if (!p || p.status === STATUS.excluida || !mesmaChave(chave, p.chave))
      return res.status(404).json({ message: 'Esta proposta não está disponível. Fale com a Bounce Basement para receber um link atualizado.' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(200).json(await montarPropostaPublica(p));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Não foi possível carregar a proposta. Tente novamente em instantes.' });
  }
}

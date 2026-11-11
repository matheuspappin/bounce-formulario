// Página de assinatura do contrato (link enviado ao contratante).
// GET: mostra o contrato · POST: o contratante preenche os dados e assina.
import { lerContratos, contratoPublico, assinarContratante } from '../lib/contratos.js';
import { mesmaChave } from '../lib/listas.js';
import { STATUS_CONTRATO } from '../shared/contrato.js';

async function achar(c) {
  const [id, chave] = String(c || '').split('.');
  const x = id && (await lerContratos()).find((k) => k.id === id);
  return x && x.status !== STATUS_CONTRATO.cancelado && mesmaChave(chave, x.chave) ? x : null;
}
const indisponivel = (res) => res.status(404).json({ message: 'Este contrato não está disponível. Fale com a Bounce Basement para receber um link atualizado.' });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    if (req.method === 'GET') {
      const x = await achar(new URL(req.url, 'http://x').searchParams.get('c'));
      if (!x) return indisponivel(res);
      return res.status(200).json(contratoPublico(x));
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const x = await achar(b.c);
      if (!x) return indisponivel(res);
      const feito = await assinarContratante(x, b, req);
      return res.status(200).json(contratoPublico(feito));
    }
    res.status(405).json({ message: 'Método não permitido' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Não foi possível registrar a assinatura. Tente novamente em instantes.' });
  }
}

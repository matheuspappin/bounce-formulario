import { checkPassword, configured, issueToken } from '../../lib/admin-auth.js';

const tentativas = new Map(); // freio simples contra chute de senha

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  if (!configured()) return res.status(503).json({ message: 'Senha do painel não configurada (variável ADMIN_SENHA).' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0];
  const t = tentativas.get(ip) || { n: 0, ate: 0 };
  if (t.ate > Date.now()) return res.status(429).json({ message: 'Muitas tentativas. Aguarde um minuto.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (!checkPassword(body.senha || '')) {
    t.n++; if (t.n >= 5) { t.n = 0; t.ate = Date.now() + 60_000; }
    tentativas.set(ip, t);
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ message: 'Senha incorreta.' });
  }
  tentativas.delete(ip);
  res.status(200).json({ token: issueToken() });
}

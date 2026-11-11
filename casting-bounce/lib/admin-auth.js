// Login do painel: senha em ADMIN_SENHA → token assinado válido por 12h.
import crypto from 'node:crypto';
import { isMock } from './store.js';

const senha = () => (process.env.ADMIN_SENHA || (isMock ? 'admin' : '')).trim();
const secret = () => `${senha()}|${process.env.GOOGLE_CLIENT_SECRET || 'local'}`;
const hmac = (s) => crypto.createHmac('sha256', secret()).update(s).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const configured = () => !!senha();
export const checkPassword = (p) => configured() && same(p, senha());
export function issueToken(hours = 12) {
  const exp = Date.now() + hours * 3600_000;
  return `${exp}.${hmac(`admin|${exp}`)}`;
}
export function isAuthorized(req) {
  const url = new URL(req.url, 'http://x');
  const raw = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('t') || '';
  const [exp, sig] = raw.split('.');
  return configured() && Number(exp) > Date.now() && same(sig, hmac(`admin|${exp}`));
}
export function guard(req, res) {
  if (isAuthorized(req)) return true;
  res.status(401).json({ message: 'Faça login novamente.' });
  return false;
}

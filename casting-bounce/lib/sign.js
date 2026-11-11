import crypto from 'node:crypto';
const secret = () => process.env.GOOGLE_CLIENT_SECRET || 'modo-local';
export const sign = (s) => crypto.createHmac('sha256', secret()).update(s).digest('hex');
export const verify = (s, sig) => {
  const a = Buffer.from(sign(s)); const b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

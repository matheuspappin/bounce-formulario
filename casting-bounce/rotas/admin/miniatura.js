// Miniatura de foto/vídeo do Drive (passa pelo servidor para não precisar deixar nada público).
import { g } from '../../lib/store.js';
import { guard } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    const u = new URL(req.url, 'http://x');
    const size = Math.min(Number(u.searchParams.get('s')) || 600, 1600);
    const thumb = await g.fileThumbnail(u.searchParams.get('id') || '', size);
    if (!thumb) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', thumb.type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(thumb.buffer);
  } catch (e) {
    console.error(e);
    res.statusCode = 500; res.end();
  }
}

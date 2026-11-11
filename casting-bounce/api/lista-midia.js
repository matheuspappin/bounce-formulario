// Fotos (e capas de vídeo) da página do contratante. Cada endereço é assinado pelo servidor e vale 12h,
// então só abre o que estava na lista quando a página foi carregada.
import fs from 'node:fs';
import { g, isMock } from '../lib/store.js';
import { assinarMidia } from '../lib/listas.js';
import { verify } from '../lib/sign.js';

export default async function handler(req, res) {
  try {
    const u = new URL(req.url, 'http://x');
    const id = u.searchParams.get('f') || '';
    const exp = Number(u.searchParams.get('e')) || 0;
    const sig = u.searchParams.get('s') || '';
    if (!id || exp < Date.now() || sig.length !== assinarMidia(id, exp).length || !verify(`lista-midia|${id}|${exp}`, sig)) {
      res.statusCode = 403; return res.end();
    }
    // nome do arquivo ao salvar/baixar: "Ana S - foto 1.jpg" (só letras, números, espaço, ponto e hífen)
    const nome = (u.searchParams.get('n') || '').replace(/[^\p{L}\p{N} .\-]/gu, '').trim().slice(0, 120);
    const baixar = u.searchParams.get('dl') === '1';
    if (nome) {
      const ascii = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '');
      res.setHeader('Content-Disposition', `${baixar ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`);
    }
    // modo de teste local: o vídeo vem direto do computador
    if (isMock && u.searchParams.get('video')) {
      const f = await g.readLocalFile(id);
      res.writeHead(200, { 'Content-Type': f.type });
      return fs.createReadStream(f.path).pipe(res);
    }
    const size = Math.min(Number(u.searchParams.get('w')) || 800, 1600);
    const thumb = await g.fileThumbnail(id, size);
    if (!thumb) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', thumb.type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(thumb.buffer);
  } catch (e) {
    console.error(e);
    res.statusCode = 500; res.end();
  }
}

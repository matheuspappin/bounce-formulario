/**
 * Servidor de desenvolvimento local (na Vercel ele não é usado).
 * Roda as funções da pasta api/ como a Vercel faz, lê o .env.local
 * e, se o Google ainda não estiver configurado, salva tudo em ./teste-local/.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);

// .env.local → process.env
try {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const { isMock, g } = await import('./lib/store.js');
const PORT = Number(process.env.PORT || 3001);
const DIST = path.join(ROOT, 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
  return res;
}

http.createServer(async (req, res) => {
  shim(res);
  try {
    const url = new URL(req.url, 'http://local');
    const p = decodeURIComponent(url.pathname);

    const api = p.match(/^\/api\/([a-z0-9-]+(?:\/[a-z0-9-]+)?)$/);
    if (api) {
      const file = path.join(ROOT, 'api', ...api[1].split('/')) + '.js';
      if (!fs.existsSync(file)) return res.status(404).json({ message: 'Não encontrado' });
      const raw = (await readBody(req)).toString();
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }

    if (isMock && p.startsWith('/__upload_local/') && req.method === 'PUT') {
      const ok = await g.receiveUpload(p.split('/').pop(), await readBody(req));
      return res.status(ok ? 200 : 400).json({ ok });
    }

    // modo local: abrir foto/vídeo enviado (só com login do painel)
    if (isMock && p.startsWith('/__arquivo_local/')) {
      const { isAuthorized } = await import('./lib/admin-auth.js');
      if (!isAuthorized(req)) return res.status(401).json({ message: 'Faça login no painel.' });
      const f = await g.readLocalFile(p.slice('/__arquivo_local/'.length));
      res.writeHead(200, { 'Content-Type': f.type });
      return fs.createReadStream(f.path).pipe(res);
    }

    // arquivos da página (dist/ depois do build, ou os fontes)
    const base = fs.existsSync(DIST) ? DIST : ROOT;
    let rel = p === '/' ? '/index.html' : p;
    if (!path.extname(rel)) rel += '.html'; // /privacidade → privacidade.html (igual à Vercel)
    if (base === ROOT && !/^\/(index\.html|admin\.html|lista\.html|src\/|shared\/|casting\.config\.js)/.test(rel)) rel = '/public' + rel;
    const full = path.resolve(base, '.' + rel);
    if (full.startsWith(base) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      return fs.createReadStream(full).pipe(res);
    }
    res.status(404).json({ message: 'Não encontrado' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ message: 'Erro interno.' });
  }
}).listen(PORT, () => {
  console.log(`\n  API do casting em http://localhost:${PORT}`);
  console.log(isMock
    ? '  Modo TESTE LOCAL: inscrições vão para a pasta teste-local/ (rode "npm run google" para ligar o Drive)\n'
    : '  Conectado ao Google Drive e Google Sheets\n');
});

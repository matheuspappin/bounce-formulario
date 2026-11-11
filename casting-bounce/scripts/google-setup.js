/**
 * Conecta o formulário à sua conta Google (rodar uma vez): npm run google
 *  - pede o Client ID / Client Secret (do Google Cloud)
 *  - abre o navegador para você autorizar
 *  - cria a pasta "Bounce Basement · Castings" e a planilha de inscrições no seu Drive
 *  - grava tudo no arquivo .env.local e mostra o que colar na Vercel
 */
import http from 'node:http';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import readline from 'node:readline/promises';

const ENV_FILE = '.env.local';
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const env = {};
try {
  for (const l of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2];
  }
} catch {}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, cur) => (await rl.question(cur ? `${q} [Enter = manter atual]: ` : `${q}: `)).trim() || cur;

console.log('\n=== Conectar o casting ao Google Drive ===\n');
env.GOOGLE_CLIENT_ID = await ask('Cole o Client ID', env.GOOGLE_CLIENT_ID);
env.GOOGLE_CLIENT_SECRET = await ask('Cole o Client Secret', env.GOOGLE_CLIENT_SECRET);
rl.close();
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) { console.log('\nClient ID e Secret são obrigatórios.'); process.exit(1); }

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: env.GOOGLE_CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code',
  scope: SCOPE, access_type: 'offline', prompt: 'consent',
});

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, REDIRECT);
    const c = u.searchParams.get('code');
    const err = u.searchParams.get('error');
    if (!c && !err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<body style="font-family:sans-serif;padding:40px"><h2>${c ? '✅ Autorizado! Pode fechar esta aba e voltar ao terminal.' : '❌ Autorização cancelada.'}</h2></body>`);
    server.close();
    c ? resolve(c) : reject(new Error(err));
  }).listen(PORT, '127.0.0.1', () => {
    console.log('\nAbrindo o navegador para você autorizar...');
    console.log('Se não abrir, copie este link no navegador:\n\n' + authUrl + '\n');
    const cmd = process.platform === 'win32' ? `start "" "${authUrl}"` : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
    exec(cmd);
  });
});

const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
});
const tok = await tokRes.json();
if (!tok.refresh_token) { console.log('\nNão recebi o refresh token:', tok); process.exit(1); }
env.GOOGLE_REFRESH_TOKEN = tok.refresh_token;
Object.assign(process.env, env);

const g = await import('../lib/google.js');
const config = (await import('../casting.config.js')).default;
const { header } = await import('../lib/columns.js');

if (!env.DRIVE_FOLDER_ID) {
  env.DRIVE_FOLDER_ID = (await g.createFolder('Bounce Basement · Castings')).id;
  console.log('✔ Pasta "Bounce Basement · Castings" criada no seu Drive');
}
if (!env.SHEET_ID) {
  env.SHEET_ID = await g.createSpreadsheet('Castings Bounce Basement — Inscrições', config.slug, env.DRIVE_FOLDER_ID);
  console.log('✔ Planilha de inscrições criada dentro da pasta');
}
await g.ensureSheet(env.SHEET_ID, config.slug, header(config));

const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'DRIVE_FOLDER_ID', 'SHEET_ID'];
fs.writeFileSync(ENV_FILE, [...keys, ...Object.keys(env).filter((k) => !keys.includes(k))].filter((k) => env[k]).map((k) => `${k}=${env[k]}`).join('\n') + '\n');

console.log(`\n✔ Tudo salvo em ${ENV_FILE}\n`);
console.log('Pasta no Drive:  https://drive.google.com/drive/folders/' + env.DRIVE_FOLDER_ID);
console.log('Planilha:        https://docs.google.com/spreadsheets/d/' + env.SHEET_ID);
console.log('\nNa Vercel (Project → Settings → Environment Variables), crie estas 5 variáveis:\n');
for (const k of keys) console.log(`  ${k}=${env[k]}`);
console.log('\nDepois faça um novo deploy. Pronto!\n');

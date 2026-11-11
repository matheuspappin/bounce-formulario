/**
 * Cria/atualiza o projeto na Vercel pela CLI e publica.  Uso: npm run publicar
 *  1. login na Vercel (abre o navegador na primeira vez)
 *  2. cria/vincula o projeto "casting-bounce"
 *  3. envia as variáveis do Google (.env.local) para a Vercel
 *  4. publica em produção e mostra o link
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline/promises';

const PROJETO = process.env.VERCEL_PROJETO || 'casting-bounce';
const win = process.platform === 'win32';
const KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'DRIVE_FOLDER_ID', 'SHEET_ID'];

const vercel = (args, opts = {}) =>
  spawnSync('npx', ['--yes', 'vercel@latest', ...args], { stdio: opts.input != null ? ['pipe', 'inherit', 'inherit'] : 'inherit', shell: win, ...opts });
const quiet = (args) =>
  spawnSync('npx', ['--yes', 'vercel@latest', ...args], { encoding: 'utf8', shell: win });
const passo = (t) => console.log(`\n━━━ ${t} ━━━\n`);
const parar = (t) => { console.log(`\n✖ ${t}\n`); process.exit(1); };

// variáveis do Google
const env = {};
try {
  for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2];
  }
} catch {}
// senha do painel /admin
if (!env.ADMIN_SENHA) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let senha = '';
  while (senha.length < 8) senha = (await rl.question('\nCrie uma senha para o painel /admin (mínimo 8 caracteres): ')).trim();
  rl.close();
  env.ADMIN_SENHA = senha;
  fs.appendFileSync('.env.local', `${fs.existsSync('.env.local') && !fs.readFileSync('.env.local', 'utf8').endsWith('\n') ? '\n' : ''}ADMIN_SENHA=${senha}\n`);
  console.log('✔ Senha salva no arquivo .env.local');
}

const faltando = KEYS.filter((k) => !env[k]);
if (faltando.length) {
  console.log('\n⚠  O Google ainda não está conectado (falta rodar o CONECTAR-GOOGLE.bat).');
  console.log('   O site vai ao ar, mas as inscrições só funcionam depois de conectar o Google e publicar de novo.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question('\n   Publicar mesmo assim? (s/n): ')).trim().toLowerCase();
  rl.close();
  if (r !== 's') process.exit(0);
}

passo('1/4  Login na Vercel');
if (quiet(['whoami']).status !== 0) {
  console.log('Vai abrir o navegador para você entrar na sua conta Vercel...');
  if (vercel(['login']).status !== 0) parar('Não foi possível fazer login.');
} else console.log('✔ Já está logado: ' + quiet(['whoami']).stdout.trim().split('\n').pop());

passo(`2/4  Criando / vinculando o projeto "${PROJETO}"`);
if (!fs.existsSync('.vercel/project.json')) {
  let r = vercel(['link', '--yes', '--project', PROJETO]);
  if (r.status !== 0) {
    console.log('\nResponda as perguntas abaixo (Enter aceita o padrão):');
    r = vercel(['link']);
  }
  if (r.status !== 0) parar('Não foi possível criar o projeto.');
} else console.log('✔ Projeto já vinculado (pasta .vercel)');

passo('3/4  Enviando as variáveis (Google e senha do painel)');
for (const k of [...KEYS, 'ADMIN_SENHA']) {
  if (!env[k]) { console.log(`  – ${k}: não configurada, pulando`); continue; }
  quiet(['env', 'rm', k, 'production', '--yes']); // substitui se já existir
  const r = vercel(['env', 'add', k, 'production'], { input: env[k] });
  console.log(r.status === 0 ? `  ✔ ${k}` : `  ✖ ${k} (erro ao enviar)`);
}

passo('4/4  Publicando');
const dep = vercel(['deploy', '--prod', '--yes']);
if (dep.status !== 0) parar('O deploy falhou. Veja a mensagem acima.');

console.log('\n✅ Publicado! O link de produção aparece acima (termina em .vercel.app).');
console.log('   Painel das inscrições: <seu link>/admin');
console.log('   Para usar seu domínio: vercel.com → projeto → Settings → Domains.');
console.log('   Para atualizar o site depois de mudanças, rode este arquivo de novo.\n');

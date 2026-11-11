// Sobe o servidor de inscrições (porta 3001) e o Vite (porta 5173) juntos.
import { spawn } from 'node:child_process';

const run = (cmd, args, env = {}) =>
  spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } });

const api = run('node', ['--watch', 'server.js'], { PORT: process.env.API_PORT || '3001' });
const vite = run('npx', ['vite']);

const stop = () => { api.kill(); vite.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', (c) => c && stop());
vite.on('exit', stop);

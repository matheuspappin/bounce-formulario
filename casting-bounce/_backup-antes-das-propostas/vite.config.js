import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const API = `http://localhost:${process.env.API_PORT || 3001}`;
const here = (f) => fileURLToPath(new URL(f, import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: { '/api': API, '/__upload_local': API, '/__arquivo_local': API },
  },
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: here('./index.html'), admin: here('./admin.html'), lista: here('./lista.html') } },
  },
});

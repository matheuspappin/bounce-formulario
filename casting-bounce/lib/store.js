// Usa o Google de verdade quando as credenciais existem; senão, a simulação local.
import * as real from './google.js';
import * as mock from './google-mock.js';

export const isMock = !process.env.GOOGLE_REFRESH_TOKEN && !process.env.VERCEL;
if (isMock) console.warn('⚠  Google não configurado: usando modo de teste local (arquivos em ./teste-local).');

export const g = isMock ? mock : real;
export const ROOT_FOLDER = () => (isMock ? 'root' : process.env.DRIVE_FOLDER_ID);
export const SHEET_ID = () => (isMock ? 'local' : process.env.SHEET_ID);

// Regras compartilhadas entre o formulário (navegador) e o servidor.

export const allFields = (config) => config.secoes.flatMap((s) => s.campos);

export function isVisible(field, values) {
  if (!field.showIf) return true;
  const v = values[field.showIf.field];
  return Array.isArray(v) ? v.includes(field.showIf.equals) : v === field.showIf.equals;
}

export function onlyDigits(s = '') {
  return String(s).replace(/\D/g, '');
}

export function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function ageFrom(dateStr, today = new Date()) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : '';
}

/**
 * values: { campo: string | string[] }, files: { campo: number(quantidade) }
 * retorna { campo: 'mensagem de erro' }
 */
const matches = (cond, values) => {
  const v = values[cond.field];
  return Array.isArray(v) ? v.includes(cond.equals) : v === cond.equals;
};

export function validate(config, values, fileCounts = {}) {
  const errors = {};
  for (const field of allFields(config)) {
    if (!isVisible(field, values) || field.type === 'age') continue;
    // requiredIf: obrigatório só quando outra resposta bate (ex.: experiência = Sim)
    const f = field.requiredIf ? { ...field, required: matches(field.requiredIf, values) } : field;
    const v = values[f.name];

    if (f.type === 'files') {
      const n = fileCounts[f.name] || 0;
      if (f.required && n === 0) errors[f.name] = 'Envie pelo menos um arquivo.';
      else if (f.max && n > f.max) errors[f.name] = `Máximo de ${f.max} arquivos.`;
      continue;
    }

    if (f.type === 'checkboxes') {
      const list = Array.isArray(v) ? v : v ? [v] : [];
      const outro = (values[`${f.name}_outros`] || '').trim();
      if (f.required && list.length === 0 && !outro) errors[f.name] = 'Selecione pelo menos uma opção.';
      continue;
    }

    const s = (v ?? '').toString().trim();
    if (f.required && !s) { errors[f.name] = 'Campo obrigatório.'; continue; }
    if (!s) continue;

    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[f.name] = 'E-mail inválido.';
    if (f.type === 'cpf' && !isValidCPF(s)) errors[f.name] = 'CPF inválido.';
    if (f.type === 'tel' && onlyDigits(s).length < 10) errors[f.name] = 'Informe DDD + número.';
    if (f.type === 'date' && ageFrom(s) === '') errors[f.name] = 'Data inválida.';
    else if (f.type === 'date' && f.minAge && ageFrom(s) < f.minAge) errors[f.name] = `É preciso ter ${f.minAge} anos ou mais.`;
    if (f.type === 'number') {
      const n = Number(s.replace(',', '.'));
      if (Number.isNaN(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max))
        errors[f.name] = `Valor entre ${f.min} e ${f.max}.`;
    }
    if ((f.type === 'radio' || f.type === 'select') && f.options && !f.options.includes(s))
      errors[f.name] = 'Opção inválida.';
  }
  return errors;
}

/* ---------- arquivos (fotos e vídeos): checagem com mensagem de "como resolver" ---------- */

const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', qt: 'video/quicktime', '3gp': 'video/3gpp', '3g2': 'video/3gpp2',
  webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo', mpg: 'video/mpeg', mpeg: 'video/mpeg', hevc: 'video/hevc',
};
export const fileExt = (name = '') => (String(name).match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toLowerCase();
/** Tipo do arquivo; quando o celular/navegador não informa (acontece com .mov, .heic, .3gp…), deduz pela extensão. */
export const fileMime = (file) => file.type || EXT_MIME[fileExt(file.name)] || '';

const fmtMB = (b) => (b / 1048576).toFixed(b < 10 * 1048576 ? 1 : 0).replace('.', ',') + ' MB';
const fmtDur = (s) => { s = Math.round(s); const m = Math.floor(s / 60), r = s % 60; return m ? `${m}min${r ? String(r).padStart(2, '0') : ''}` : `${r}s`; };

/**
 * Confere um arquivo contra as regras do campo.
 * file: { name, type, size, duration? }  →  null (ok) ou { codigo, titulo, passos: [] }
 */
export function fileProblem(field, file) {
  const nome = `“${file.name || 'arquivo'}”`;
  const isVideoField = field.accept === 'video/*';
  const mime = fileMime(file);
  const prefix = field.accept?.replace('/*', '/');

  if (prefix && !mime.startsWith(prefix)) {
    if (isVideoField && mime.startsWith('image/'))
      return { codigo: 'ARQ-TIPO', titulo: `${nome} é uma foto, não um vídeo.`, passos: ['Envie as fotos no campo “Fotografias”, logo acima.', 'Aqui, selecione um vídeo (MP4 ou MOV).'] };
    if (!isVideoField && mime.startsWith('video/'))
      return { codigo: 'ARQ-TIPO', titulo: `${nome} é um vídeo, não uma foto.`, passos: ['Envie os vídeos no campo “Vídeos”, logo abaixo.', 'Aqui, selecione uma foto (JPG, PNG ou HEIC).'] };
    return {
      codigo: 'ARQ-TIPO',
      titulo: `${nome} não é ${isVideoField ? 'um vídeo' : 'uma foto'} que conseguimos receber.`,
      passos: isVideoField
        ? ['Envie o vídeo em MP4 ou MOV (o formato normal da câmera do celular).',
          'Se o vídeo está no WhatsApp, Instagram ou TikTok, salve-o primeiro na galeria do celular e selecione por lá.',
          'Não envie links, documentos ou arquivos compactados (.zip).']
        : ['Envie a foto em JPG, PNG ou HEIC (o formato normal da câmera do celular).',
          'Se a foto está no WhatsApp ou Instagram, salve-a primeiro na galeria e selecione por lá.'],
    };
  }

  if (!file.size)
    return {
      codigo: 'ARQ-VAZIO',
      titulo: `${nome} chegou vazio (0 MB).`,
      passos: ['Isso costuma acontecer quando o arquivo está só na nuvem (iCloud ou Google Fotos) e ainda não foi baixado no celular.',
        'Abra o arquivo na galeria, espere carregar por completo e selecione de novo.'],
    };

  if (field.maxSizeMB && file.size > field.maxSizeMB * 1048576)
    return {
      codigo: 'ARQ-TAMANHO',
      titulo: `${nome} tem ${fmtMB(file.size)} — o limite é ${field.maxSizeMB} MB por arquivo.`,
      passos: isVideoField
        ? ['Corte o vídeo deixando só a parte principal (Galeria / Fotos → Editar → Cortar).',
          'Ou grave em 1080p em vez de 4K. No iPhone: Ajustes → Câmera → Gravar Vídeo → “1080p HD a 30 qps”.',
          'Ou diminua o tamanho com um app de “compressor de vídeo” e selecione a versão nova.']
        : ['Envie uma versão menor da foto: tire uma captura de tela (print) dela, ou use a opção de reduzir tamanho ao compartilhar.'],
    };

  if (field.maxDurationSec && Number.isFinite(file.duration) && file.duration > field.maxDurationSec + 1)
    return {
      codigo: 'ARQ-DURACAO',
      titulo: `${nome} tem ${fmtDur(file.duration)} — o máximo é ${fmtDur(field.maxDurationSec)} por vídeo.`,
      passos: ['iPhone: abra o vídeo no app Fotos → Editar → arraste as bordas amarelas da linha do tempo → OK → “Salvar como Novo Vídeo”.',
        'Android: abra na Galeria ou no Google Fotos → Editar → Cortar → Salvar cópia.',
        'Depois selecione aqui o vídeo cortado.'],
    };

  return null;
}

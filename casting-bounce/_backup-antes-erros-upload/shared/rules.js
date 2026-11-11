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

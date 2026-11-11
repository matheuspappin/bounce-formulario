// Nome que o contratante vê: primeiro nome + inicial do sobrenome (ex.: "Ana S.").
// O sobrenome nunca aparece para o cliente, para a seleção continuar passando pela Bounce.
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von']);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palavras = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);

/**
 * artistico: nome artístico/social digitado pela pessoa · completo: nome completo (só para comparar, nunca é mostrado).
 * - Se o nome artístico tem alguma palavra do sobrenome → "Primeiro S." (inicial do último sobrenome).
 * - Se não tem (ex.: "MC Lua", "Duda") → fica como está.
 * - Sem nome completo para comparar: uma palavra fica; mais de uma vira "Primeiro S.".
 */
export function nomePublico(artistico, completo) {
  const base = palavras(artistico).length ? artistico : completo;
  const b = palavras(base);
  if (!b.length) return 'Perfil';
  const c = palavras(completo).filter((w) => !PARTICULAS.has(norm(w)));
  const inicial = (w) => `${w.replace(/^[^\p{L}]+/u, '')[0]?.toUpperCase() || ''}.`;
  if (c.length >= 2) {
    const sobrenomes = new Set(c.slice(1).map(norm));
    const temSobrenome = b.slice(1).some((w) => sobrenomes.has(norm(w)));
    if (!temSobrenome) return b.join(' ');
    return `${b[0]} ${inicial(c[c.length - 1])}`;
  }
  const bb = b.filter((w) => !PARTICULAS.has(norm(w)));
  return bb.length <= 1 ? b.join(' ') : `${bb[0]} ${inicial(bb[bb.length - 1])}`;
}

/** Nome de arquivo para downloads: "Ana S - foto 1.jpg" (sem caracteres que dão problema no Windows). */
export const nomeArquivo = (nome, resto = '') =>
  `${String(nome).replace(/\./g, '').replace(/[\\/:*?"<>|]+/g, '').trim()}${resto ? ` - ${resto}` : ''}`.slice(0, 120);

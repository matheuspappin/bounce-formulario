// Campo de assinatura (só no navegador): desenhar com o dedo/mouse ou digitar o nome.
// O desenho é guardado como um caminho SVG pequeno (cabe numa célula da planilha).

const LARG = 600;
const ALT = 200;
const MAX_SVG = 30000;

let estiloOk = false;
function estilo() {
  if (estiloOk) return; estiloOk = true;
  const s = document.createElement('style');
  s.textContent = `
  .ass-pad { display: flex; flex-direction: column; gap: 8px; }
  .ass-abas { display: flex; gap: 6px; }
  .ass-abas button { font-family: inherit; font-weight: 600; font-size: 12px; letter-spacing: .08em; padding: 8px 12px; border: 1px solid #bbb; background: transparent; color: inherit; cursor: pointer; }
  .ass-abas button.on { background: #151515; color: #fff; border-color: #151515; }
  .ass-area { position: relative; border: 1px dashed #999; background: #fff; border-radius: 4px; }
  .ass-area canvas { display: block; width: 100%; height: auto; aspect-ratio: ${LARG} / ${ALT}; touch-action: none; cursor: crosshair; }
  .ass-area .ass-linha { position: absolute; left: 8%; right: 8%; bottom: 22%; border-bottom: 1px solid #ccc; pointer-events: none; }
  .ass-area .ass-dica { position: absolute; left: 8%; bottom: 8%; font-size: 12px; color: #999; pointer-events: none; }
  .ass-texto { width: 100%; font: 40px 'Caveat', 'Segoe Script', 'Brush Script MT', cursive; padding: 14px 16px; border: 1px dashed #999; background: #fff; color: #151515; border-radius: 4px; }
  .ass-limpar { align-self: flex-start; background: none; border: 0; padding: 2px 0; font: inherit; font-size: 13px; color: #666; text-decoration: underline; cursor: pointer; }
  .ass-svg { display: block; width: 100%; max-width: 280px; height: auto; }
  .ass-nome-cursivo { font: 34px 'Caveat', 'Segoe Script', 'Brush Script MT', cursive; line-height: 1.1; }
  `;
  document.head.appendChild(s);
  if (!document.querySelector('link[data-caveat]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.dataset.caveat = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap';
    document.head.appendChild(l);
  }
}

/** Cria o campo dentro de `el`. Devolve { valor() → {tipo, svg|valor} | null, limpar() }. */
export function criarPad(el, { nomeSugerido = '' } = {}) {
  estilo();
  el.innerHTML = `
    <div class="ass-pad">
      <div class="ass-abas"><button type="button" class="on" data-aba="desenho">DESENHAR</button><button type="button" data-aba="texto">DIGITAR</button></div>
      <div class="ass-area" data-p="desenho"><canvas width="${LARG}" height="${ALT}" aria-label="Área para desenhar a assinatura"></canvas>
        <span class="ass-linha"></span><span class="ass-dica">Assine aqui com o dedo ou o mouse</span></div>
      <input class="ass-texto" data-p="texto" type="text" maxlength="80" placeholder="Digite seu nome" value="" hidden>
      <button type="button" class="ass-limpar">Limpar</button>
    </div>`;
  const cv = el.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const inp = el.querySelector('.ass-texto');
  const dica = el.querySelector('.ass-dica');
  let aba = 'desenho';
  let tracos = [];
  let atual = null;

  ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#151515';
  const ponto = (e) => {
    const r = cv.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * LARG), Math.round(((e.clientY - r.top) / r.height) * ALT)];
  };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    atual = [ponto(e)]; tracos.push(atual); dica.hidden = true;
  });
  cv.addEventListener('pointermove', (e) => {
    if (!atual) return;
    const p = ponto(e); const u = atual[atual.length - 1];
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 2) return;
    ctx.beginPath(); ctx.moveTo(u[0], u[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    atual.push(p);
  });
  const fim = () => { atual = null; };
  cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim); cv.addEventListener('pointerleave', fim);

  const limpar = () => { tracos = []; ctx.clearRect(0, 0, LARG, ALT); dica.hidden = false; inp.value = ''; };
  el.querySelector('.ass-limpar').addEventListener('click', limpar);
  el.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => {
    aba = b.dataset.aba;
    el.querySelectorAll('[data-aba]').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelector('[data-p="desenho"]').hidden = aba !== 'desenho';
    inp.hidden = aba !== 'texto';
    if (aba === 'texto') { if (!inp.value) inp.value = nomeSugerido; inp.focus(); }
  }));

  return {
    limpar,
    valor() {
      if (aba === 'texto') { const v = inp.value.trim(); return v.length >= 3 ? { tipo: 'texto', valor: v } : null; }
      const pts = tracos.reduce((n, t) => n + t.length, 0);
      if (pts < 8) return null;
      const svg = tracos.map((t) => `M${t[0][0]} ${t[0][1]}${t.length === 1 ? `l0.1 0` : t.slice(1).map((p) => `L${p[0]} ${p[1]}`).join('')}`).join('');
      return svg.length > MAX_SVG ? { erro: 'Assinatura muito longa. Clique em Limpar e assine de novo.' } : { tipo: 'desenho', svg };
    },
  };
}

/** HTML para mostrar uma assinatura salva. */
export function assinaturaHtml(a, esc) {
  if (!a) return '';
  if (a.tipo === 'texto') { estilo(); return `<span class="ass-nome-cursivo">${esc(a.valor)}</span>`; }
  if (a.tipo === 'desenho' && /^[MLl0-9. ]+$/.test(a.svg || '')) {
    estilo();
    return `<svg class="ass-svg" viewBox="0 0 ${LARG} ${ALT}" xmlns="http://www.w3.org/2000/svg"><path d="${a.svg}" fill="none" stroke="#151515" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return '';
}

export const SVG_OK = (s) => typeof s === 'string' && s.length <= MAX_SVG && /^[MLl0-9. ]+$/.test(s);

// Gera o PDF da proposta a partir da própria visualização (cada slide vira uma página igual ao que aparece na tela).
// Não usa a impressão do navegador, que muda o layout. Sem bibliotecas externas:
//   1) abre a proposta num quadro invisível com largura de computador (assim o PDF sai igual também pelo celular);
//   2) copia cada slide com os estilos já calculados para dentro de um SVG e desenha numa imagem;
//   3) monta um PDF simples com uma imagem por página (e os links continuam clicáveis).
const LARGURA = 1232; // slides de 1200px, como no computador
const ESCALA = 2;     // nitidez da imagem
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function paraDataURL(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`arquivo ${r.status}`);
  const b = await r.blob();
  return new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = erro; fr.readAsDataURL(b); });
}

/** Fontes da página (Google Fonts) embutidas como dados, para o SVG desenhar com a mesma letra. */
async function fontesEmbutidas(doc) {
  let css = '';
  for (const link of doc.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"]')) {
    try {
      const t = await (await fetch(link.href)).text();
      const blocos = t.split('}').filter((b) => b.includes('@font-face') && /U\+0000-00FF/i.test(b));
      for (const b of blocos) {
        const m = b.match(/url\(([^)]+)\)/);
        if (!m) continue;
        css += `${b.replace(m[0], `url(${await paraDataURL(m[1].replace(/["']/g, ''))})`)}}\n`;
      }
    } catch (e) { console.warn('fonte não embutida', e); }
  }
  return css;
}

/** Copia o elemento com todos os estilos calculados (inclusive ::before/::after). */
function clonar(orig, ctx) {
  if (orig.nodeType === 3) return orig.cloneNode();
  if (orig.nodeType !== 1 || /^(SCRIPT|NOSCRIPT|IFRAME|VIDEO)$/.test(orig.tagName)) return null;
  const view = orig.ownerDocument.defaultView;
  const c = orig.cloneNode(false);
  const cs = view.getComputedStyle(orig);
  let st = '';
  for (let i = 0; i < cs.length; i++) { const p = cs[i]; st += `${p}:${cs.getPropertyValue(p)};`; }
  c.setAttribute('style', st);
  for (const ps of ['::before', '::after']) {
    const pc = view.getComputedStyle(orig, ps);
    if (pc.content && pc.content !== 'none' && pc.content !== 'normal') {
      const cls = `pdfps${ctx.n++}`;
      c.classList.add(cls);
      let s = '';
      for (let i = 0; i < pc.length; i++) { const p = pc[i]; s += `${p}:${pc.getPropertyValue(p)};`; }
      ctx.regras.push(`.${cls}${ps}{${s}}`);
    }
  }
  if (orig.tagName === 'IMG') {
    const src = orig.currentSrc || orig.src;
    c.removeAttribute('loading'); c.removeAttribute('srcset');
    if (ctx.imagens.has(src)) c.setAttribute('src', ctx.imagens.get(src)); else c.removeAttribute('src');
  }
  for (const filho of orig.childNodes) { const x = clonar(filho, ctx); if (x) c.appendChild(x); }
  return c;
}

async function desenharSlide(slide, fontes, imagens) {
  const w = Math.ceil(slide.offsetWidth); const h = Math.ceil(slide.offsetHeight);
  const ctx = { n: 0, regras: [], imagens };
  const copia = clonar(slide, ctx);
  copia.style.margin = '0'; copia.style.position = 'relative'; copia.style.left = '0'; copia.style.top = '0';
  const doc = document.implementation.createHTMLDocument('');
  const caixa = doc.createElement('div');
  caixa.setAttribute('style', `width:${w}px;height:${h}px;margin:0;padding:0;overflow:hidden`);
  const estilo = doc.createElement('style');
  estilo.textContent = fontes + ctx.regras.join('\n');
  caixa.append(estilo, doc.importNode(copia, true));
  const xhtml = new XMLSerializer().serializeToString(caixa);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = 'sync';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  await espera(30); // dá tempo das fontes embutidas no SVG
  const cv = document.createElement('canvas');
  cv.width = w * ESCALA; cv.height = h * ESCALA;
  const g = cv.getContext('2d');
  g.fillStyle = getComputedStyle(slide).backgroundColor || '#1c1c1c';
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(img, 0, 0, cv.width, cv.height);
  // o Safari às vezes desenha as fotos do SVG só na segunda vez
  await espera(60);
  g.drawImage(img, 0, 0, cv.width, cv.height);
  const jpeg = cv.toDataURL('image/jpeg', 0.9);
  const bin = atob(jpeg.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // links clicáveis no PDF
  const base = slide.getBoundingClientRect();
  const links = [...slide.querySelectorAll('a[href]')].map((a) => {
    const r = a.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, url: new URL(a.getAttribute('href'), slide.ownerDocument.baseURI).href };
  }).filter((l) => l.w > 0 && l.h > 0 && /^(https?|mailto):/.test(l.url));
  return { jpeg: bytes, w, h, iw: cv.width, ih: cv.height, links };
}

/** PDF mínimo: uma imagem JPEG por página + links. */
function montarPDF(paginas) {
  const enc = new TextEncoder();
  const partes = []; let tam = 0; const offs = [];
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); tam += b.length; };
  const K = 0.75; // px → pt
  const strPDF = (s) => `(${String(s).replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7e]/g, (ch) => encodeURI(ch))})`;
  let id = 3; // 1 = catálogo, 2 = páginas
  const ids = paginas.map((p) => {
    const o = { page: id++, content: id++, image: id++, annots: p.links.map(() => id++) };
    return o;
  });
  const obj = (n, corpo) => { offs[n] = tam; add(`${n} 0 obj\n${corpo}\nendobj\n`); };
  add(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10])); // %PDF-1.4 + linha binária
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${paginas.length} /Kids [${ids.map((o) => `${o.page} 0 R`).join(' ')}] >>`);
  paginas.forEach((p, i) => {
    const o = ids[i]; const W = +(p.w * K).toFixed(2); const H = +(p.h * K).toFixed(2);
    obj(o.page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${o.image} 0 R >> >> /Contents ${o.content} 0 R${o.annots.length ? ` /Annots [${o.annots.map((a) => `${a} 0 R`).join(' ')}]` : ''} >>`);
    const conteudo = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(o.content, `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
    offs[o.image] = tam;
    add(`${o.image} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.iw} /Height ${p.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    add(p.jpeg);
    add('\nendstream\nendobj\n');
    p.links.forEach((l, j) => {
      const r = [l.x * K, H - (l.y + l.h) * K, (l.x + l.w) * K, H - l.y * K].map((v) => v.toFixed(2)).join(' ');
      obj(o.annots[j], `<< /Type /Annot /Subtype /Link /Rect [${r}] /Border [0 0 0] /A << /S /URI /URI ${strPDF(l.url)} >> >>`);
    });
  });
  const xref = tam;
  let x = `xref\n0 ${id}\n0000000000 65535 f \n`;
  for (let n = 1; n < id; n++) x += `${String(offs[n]).padStart(10, '0')} 00000 n \n`;
  add(`${x}trailer\n<< /Size ${id} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, { type: 'application/pdf' });
}

/** Abre a proposta num quadro invisível com largura de computador e espera tudo carregar. */
async function abrirQuadro() {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = `position:fixed;left:-20000px;top:0;width:${LARGURA}px;height:900px;border:0;opacity:0;pointer-events:none`;
  const url = new URL(location.href); url.searchParams.set('pdf', '1');
  f.src = url.href;
  document.body.appendChild(f);
  const t0 = Date.now();
  for (;;) {
    const d = f.contentDocument;
    if (d?.querySelector('.slide.fim') || d?.querySelector('.slide.erro')) break;
    if (Date.now() - t0 > 30000) throw new Error('A proposta demorou para carregar.');
    await espera(150);
  }
  const d = f.contentDocument;
  if (d.querySelector('.slide.erro')) throw new Error('Proposta indisponível.');
  await d.fonts?.ready;
  await Promise.all([...d.images].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));
  await espera(200);
  return f;
}

/** Gera e baixa o PDF. aoProgresso(texto) mostra o andamento no botão. */
export async function gerarPDF(nomeArquivo, aoProgresso = () => {}) {
  aoProgresso('PREPARANDO…');
  const quadro = await abrirQuadro();
  try {
    const d = quadro.contentDocument;
    const imagens = new Map();
    await Promise.all([...new Set([...d.images].map((i) => i.currentSrc || i.src).filter(Boolean))].map(async (src) => {
      try { imagens.set(src, await paraDataURL(src)); } catch (e) { console.warn('imagem fora do PDF', src, e); }
    }));
    const fontes = await fontesEmbutidas(d);
    const slides = [...d.querySelectorAll('#proposta .slide')];
    const paginas = [];
    for (let i = 0; i < slides.length; i++) {
      aoProgresso(`GERANDO PDF ${i + 1}/${slides.length}…`);
      paginas.push(await desenharSlide(slides[i], fontes, imagens));
    }
    const blob = montarPDF(paginas);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    return blob;
  } finally {
    quadro.remove();
  }
}

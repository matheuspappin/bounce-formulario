// Página da proposta para o contratante: lê /api/proposta?c=<id>.<chave> e monta os "slides".
import { calcular, textoLinha, detalheLinha, brl, LETRAS } from '../shared/proposta.js';

const root = document.getElementById('proposta');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataBR = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('/') : d || '');
const nn = (n) => `//${String(n).padStart(2, '0')}`;
const paragrafos = (s) => String(s || '').split(/\n{2,}|\n/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('');

function montar({ proposta: c, elenco, nLista, contato }) {
  const r = calcular(c, nLista);
  const projeto = c.projeto || c.evento || 'proposta';
  document.title = `${c.titulo || 'Proposta'} · ${projeto}`;
  const tag = `<div class="tag"><span>proposta</span><span>${esc(projeto.toLowerCase())}</span></div>`;
  let n = 0;
  const slides = [];

  // capa
  slides.push(`
    <section class="slide capa">
      <p class="topo">${esc(c.titulo || 'PROPOSTA BOUNCE BASEMENT')}</p>
      <span class="ast" aria-hidden="true">*</span>
      <h1>_${esc(projeto.toLowerCase())}//</h1>
      <div class="capa-rodape"><span class="regua"></span><p>${c.contratante ? `// para ${esc(c.contratante.toLowerCase())}` : '// bounce basement'}</p></div>
    </section>`);

  // informações gerais
  const infos = [
    ['Contratante', c.contratante], ['Projeto / evento', c.evento], ['Data', dataBR(c.data)], ['Local', c.local],
    ['Elenco', r.n ? `${r.n} ${r.n === 1 ? 'bailarina' : 'bailarinas'}` : ''],
  ].filter(([, v]) => v);
  if (infos.length || c.apresentacao) {
    n++;
    slides.push(`
      <section class="slide info">
        ${tag}
        <h2 class="titulo-dir">informações gerais</h2>
        <div class="info-corpo">
          ${infos.length ? `<dl>${infos.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
          ${c.apresentacao ? `<div class="texto">${paragrafos(c.apresentacao)}</div>` : ''}
        </div>
        <span class="num">${nn(n)}</span>
      </section>`);
  }

  // seções do escopo (casting, direção, styling…)
  for (const s of c.secoes) {
    n++;
    slides.push(`
      <section class="slide secao">
        ${tag}
        <span class="num num-topo">${nn(n)}</span>
        <div class="secao-corpo">
          <ol class="itens">${s.itens.map((it, i) => `<li><b>${LETRAS[i] || '•'})</b><span>${esc(it)}</span></li>`).join('')}</ol>
          ${s.nota ? `<p class="nota">| ${esc(s.nota)}</p>` : ''}
          ${s.linkUrl ? `<a class="botao-link" href="${esc(s.linkUrl)}" target="_blank" rel="noopener">${esc(s.linkTexto || 'Abrir link')} ↗</a>` : ''}
        </div>
        <h2 class="titulo-grande">_${esc(s.titulo.toLowerCase())}</h2>
      </section>`);
  }

  // elenco
  if (c.elenco.mostrar && elenco.length) {
    n++;
    slides.push(`
      <section class="slide elenco">
        <div class="elenco-topo"><h2>${nn(n)}_<br>ELENCO</h2>${tag}</div>
        <div class="elenco-grid">${elenco.map((p) => `
          <article class="pessoa">
            <div class="foto">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : `<span>${esc((p.nome || '?')[0])}</span>`}</div>
            <h3>${esc(p.nome.toUpperCase())}</h3>
            <ul>${p.info.map((x) => `<li>${esc(x.label)} ${esc(x.valor)}</li>`).join('')}</ul>
            <span class="slider" aria-hidden="true"></span>
          </article>`).join('')}</div>
      </section>`);
  }

  // investimento
  const linha = (it) => `<tr><td>${esc(it.descricao)}${detalheLinha(it) ? `<small>${esc(detalheLinha(it))}</small>` : ''}</td>
    <td class="v ${it.modo !== 'valor' || String(it.valor).trim() === '' ? 'esp' : ''}">${esc(textoLinha(it))}</td></tr>`;
  if (c.cacheBailarina.length || c.bounce.length) {
    n++;
    slides.push(`
      <section class="slide valores">
        ${tag}
        <span class="num num-topo">${nn(n)}</span>
        <h2 class="titulo-dir">investimento</h2>
        <div class="valores-cols">
          ${c.cacheBailarina.length ? `
          <div class="bloco">
            <p class="bloco-tit">ELENCO <span>por bailarina</span></p>
            <table>${c.cacheBailarina.map(linha).join('')}
              <tr class="sub"><td>Por bailarina</td><td class="v">${brl(r.porBailarina)}</td></tr>
              ${r.n ? `<tr class="sub forte"><td>× ${r.n} ${r.n === 1 ? 'bailarina' : 'bailarinas'}</td><td class="v">${brl(r.totalElenco)}</td></tr>` : ''}
            </table>
            ${c.condicoesBailarinas.length ? `<ul class="condicoes">${c.condicoesBailarinas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          </div>` : ''}
          ${c.bounce.length ? `
          <div class="bloco">
            <p class="bloco-tit">BOUNCE BASEMENT</p>
            <table>${c.bounce.map(linha).join('')}
              <tr class="sub forte"><td>Subtotal</td><td class="v">${brl(r.totalBounce)}</td></tr>
            </table>
          </div>` : ''}
        </div>
        <div class="total">
          <span>TOTAL</span>
          <strong>${brl(r.total)}</strong>
          ${r.aCombinar ? '<em>+ itens a combinar</em>' : ''}
        </div>
        ${c.observacoes || c.validade ? `<div class="obs">${paragrafos(c.observacoes)}${c.validade ? `<p>Validade da proposta: ${esc(c.validade)}.</p>` : ''}</div>` : ''}
      </section>`);
  }

  // fechamento
  const ct = contato || {};
  const insta = ct.instagram ? ct.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '') : '';
  slides.push(`
    <section class="slide fim">
      ${tag}
      <h2 class="titulo-grande">_obrigado//</h2>
      <div class="contato">
        ${ct.email ? `<a href="mailto:${esc(ct.email)}">${esc(ct.email)}</a>` : ''}
        ${ct.telefone ? `<a href="https://wa.me/55${esc(ct.telefone.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(ct.telefone)}</a>` : ''}
        ${insta ? `<a href="${esc(ct.instagram)}" target="_blank" rel="noopener">${esc(insta)}</a>` : ''}
        ${ct.site ? `<a href="${esc(ct.site)}" target="_blank" rel="noopener">${esc(ct.site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : ''}
        ${ct.endereco ? `<span>${esc(ct.endereco)}</span>` : ''}
      </div>
    </section>`);

  root.innerHTML = slides.join('');
}

async function iniciar() {
  const c = new URLSearchParams(location.search).get('c') || '';
  try {
    const r = await fetch(`/api/proposta?c=${encodeURIComponent(c)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || 'Proposta indisponível.');
    montar(d);
    const btn = document.getElementById('pdf');
    btn.hidden = false;
    btn.addEventListener('click', () => window.print());
  } catch (e) {
    root.innerHTML = `<section class="slide erro"><p>${esc(e.message)}</p></section>`;
  }
}
iniciar();

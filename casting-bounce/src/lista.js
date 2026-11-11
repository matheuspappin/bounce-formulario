// Página do contratante: mostra os perfis de uma lista (só visualização, sem contatos).
const root = document.getElementById('lista');
const drawer = document.getElementById('drawer');
const panel = drawer.querySelector('.drawer-panel');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (s = '') => String(s).split(',').map((x) => x.trim()).filter(Boolean);
const dataBR = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d);
const TAGS = new Set(['estilos_dominio']);
let dados = null;

async function carregar() {
  const c = new URLSearchParams(location.search).get('c') || '';
  try {
    const r = await fetch(`/api/lista?c=${encodeURIComponent(c)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || 'Não foi possível carregar a lista.');
    dados = d;
    render();
  } catch (e) {
    root.innerHTML = `<div class="lista-erro"><p class="kicker">BOUNCE BASEMENT</p><h2>LISTA INDISPONÍVEL</h2><p class="muted">${esc(e.message)}</p></div>`;
  }
}

function render() {
  const { lista, pessoas, contato } = dados;
  document.title = `${lista.nome} · Bounce Basement`;
  const meta = [lista.evento, dataBR(lista.data), lista.contratante && `Para ${lista.contratante}`].filter(Boolean);
  root.innerHTML = `
    <div class="admin-head lista-head">
      <p class="kicker">BOUNCE BASEMENT · SELEÇÃO DE ELENCO</p>
      <h2>${esc(lista.nome)}</h2>
      ${meta.length ? `<p class="lista-meta">${meta.map(esc).join('<span>·</span>')}</p>` : ''}
      <p class="muted">${pessoas.length} ${pessoas.length === 1 ? 'perfil' : 'perfis'} · clique em um perfil para ver fotos, vídeos e a ficha.</p>
    </div>
    <div class="cards-grid">
      ${pessoas.map((p, i) => {
        const v = Object.fromEntries(p.info.map((x) => [x.k, x.valor]));
        const sub = [v.genero, v.idade && `${v.idade} anos`, v.cidade].filter(Boolean);
        const tags = list(v.estilos_dominio);
        return `
        <button class="pcard" data-i="${i}">
          <div class="pcard-img">${p.fotos[0] ? `<img src="${esc(p.fotos[0])}&w=600" alt="" loading="lazy">` : `<span class="ph">${esc(p.nome[0] || '?')}</span>`}</div>
          <div class="pcard-body">
            <strong>${esc(p.nome)}</strong>
            ${sub.length ? `<span class="muted">${sub.map(esc).join(' · ')}</span>` : ''}
            <span class="tags">${tags.slice(0, 5).map((t) => `<em>${esc(t)}</em>`).join('')}${tags.length > 5 ? `<em class="more">+${tags.length - 5}</em>` : ''}</span>
            <span class="badges">${p.videos.length ? `<b>${p.videos.length} ${p.videos.length === 1 ? 'VÍDEO' : 'VÍDEOS'}</b>` : ''}${p.nota ? '<b class="ok">NOTA DA BOUNCE</b>' : ''}</span>
          </div>
        </button>`;
      }).join('') || '<p class="muted">Nenhum perfil nesta lista ainda.</p>'}
    </div>`;
  root.querySelectorAll('.pcard').forEach((c) => c.addEventListener('click', () => abrir(Number(c.dataset.i))));

  const f = document.getElementById('contato');
  f.hidden = false;
  f.innerHTML = `
    <div class="footer-inner">
      <div><p class="logo logo-lg">bounce</p><p class="muted">BOUNCE BASEMENT · PORTO ALEGRE</p></div>
      ${contato.endereco ? `<div><h4>ENDEREÇO</h4><p>${esc(contato.endereco)}</p></div>` : ''}
      <div><h4>FALE COM A BOUNCE</h4><p>${esc(contato.telefone || '')}${contato.email ? `<br><a href="mailto:${esc(contato.email)}">${esc(contato.email)}</a>` : ''}</p></div>
      ${contato.site ? `<div><h4>SITE</h4><p><a href="${esc(contato.site)}" target="_blank" rel="noopener">BOUNCEBASEMENT ↗</a></p></div>` : ''}
    </div>
    <p class="copy">Material confidencial, enviado exclusivamente para avaliação de elenco. Não compartilhe este link.</p>`;
}

function abrir(i) {
  const p = dados.pessoas[i];
  const ficha = p.info.map((x) => `<dt>${esc(x.label)}</dt><dd>${TAGS.has(x.k) || x.k === 'estilos_estudados' || x.k === 'experiencias'
    ? `<span class="tags">${list(x.valor).map((t) => `<em>${esc(t)}</em>`).join('')}</span>` : esc(x.valor)}</dd>`).join('');
  panel.innerHTML = `
    <button class="close" data-close aria-label="Fechar">×</button>
    <p class="kicker">PERFIL ${i + 1} DE ${dados.pessoas.length}</p>
    <h2>${esc(p.nome)}</h2>
    ${p.nota ? `<div class="nota-bounce"><p class="crm-label">NOTA DA BOUNCE</p><p>${esc(p.nota).replace(/\n/g, '<br>')}</p></div>` : ''}
    <h3>FOTOS</h3>
    <div class="gallery">${p.fotos.map((f) => `<figure class="midia"><a href="${esc(f)}&w=1600" target="_blank" rel="noopener"><img src="${esc(f)}&w=800" alt="" loading="lazy"></a>
      <a class="baixar" href="${esc(f)}&w=1600&dl=1" download>↓ BAIXAR</a></figure>`).join('') || '<p class="muted">Nenhuma foto.</p>'}</div>
    <h3>VÍDEOS</h3>
    <div class="gallery videos lista-videos">${p.videos.map((v, n) => `
      <figure class="midia">
        <button type="button" class="vid" data-v="${n}">
          <img src="${esc(v.capa)}&w=600" alt="" onerror="this.remove()"><span>▶ VÍDEO ${n + 1}</span>
        </button>
        ${v.baixar || v.arquivo ? `<a class="baixar" href="${esc(v.baixar || `${v.arquivo}&dl=1`)}" ${v.baixar ? 'target="_blank" rel="noopener"' : 'download'}>↓ BAIXAR</a>` : ''}
      </figure>`).join('') || '<p class="muted">Nenhum vídeo.</p>'}</div>
    <h3>FICHA</h3><dl>${ficha}</dl>
    <div class="lista-nav">
      ${i > 0 ? `<button type="button" class="btn btn-small" data-ir="${i - 1}">← ANTERIOR</button>` : '<span></span>'}
      ${i < dados.pessoas.length - 1 ? `<button type="button" class="btn btn-small" data-ir="${i + 1}">PRÓXIMO →</button>` : ''}
    </div>`;
  panel.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => tocar(b, p.videos[Number(b.dataset.v)])));
  panel.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => abrir(Number(b.dataset.ir))));
  panel.scrollTop = 0;
  drawer.hidden = false;
  document.body.style.overflow = 'hidden';
}

// o vídeo só carrega quando a pessoa clica (economiza dados no celular)
function tocar(el, v) {
  const box = document.createElement('div');
  box.className = 'vid-player';
  box.innerHTML = v.player
    ? `<iframe src="${esc(v.player)}" allow="autoplay; fullscreen" allowfullscreen loading="lazy" title="Vídeo"></iframe>`
    : `<video src="${esc(v.arquivo)}" controls autoplay playsinline></video>`;
  el.replaceWith(box);
}

function fechar() { drawer.hidden = true; document.body.style.overflow = ''; panel.innerHTML = ''; }
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) fechar(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) fechar(); });

carregar();

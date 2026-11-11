// Painel de visualização das inscrições (lê a planilha e as pastas do Drive pela API /api/admin).
import config from '../casting.config.js';

const root = document.getElementById('admin');
const nav = document.getElementById('admin-nav');
const drawer = document.getElementById('drawer');
const panel = drawer.querySelector('.drawer-panel');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (s = '') => String(s).split(',').map((x) => x.trim()).filter(Boolean);

const store = {
  get: () => { try { return sessionStorage.getItem('casting_admin') || ''; } catch { return ''; } },
  set: (t) => { try { t ? sessionStorage.setItem('casting_admin', t) : sessionStorage.removeItem('casting_admin'); } catch {} },
};
let token = store.get();
let state = { fields: [], items: [], planilha: null, pastaRaiz: null, casting: {}, crm: { etapas: [], mensagens: {} } };
let view = (() => { try { return sessionStorage.getItem('casting_view') || 'cards'; } catch { return 'cards'; } })();
let etapaFiltro = '';
const etapaIdx = (e) => Math.max(0, state.crm.etapas.indexOf(e));
const filesCache = new Map();

async function api(path) {
  const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) { logout(); throw new Error('login'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || 'Erro');
  return data;
}
const thumb = (id, s = 600) => `/api/admin/miniatura?id=${encodeURIComponent(id)}&s=${s}&t=${encodeURIComponent(token)}`;
const openLink = (f) => (f.abrir?.startsWith('/__arquivo_local/') ? `${f.abrir}?t=${encodeURIComponent(token)}` : f.abrir);

/* ---------------- LOGIN ---------------- */
function loginView(msg = '') {
  nav.innerHTML = '';
  root.className = 'login-wrap';
  root.innerHTML = `
    <form class="login" id="login">
      <p class="kicker">PAINEL DO CASTING</p>
      <h1>ENTRAR</h1>
      <label for="senha">Senha</label>
      <div class="senha-wrap">
        <input type="password" id="senha" autocomplete="current-password" autofocus>
        <button type="button" id="toggle-senha" aria-label="Mostrar senha" title="Mostrar senha">👁</button>
      </div>
      <button class="btn" type="submit">ENTRAR →</button>
      <p class="form-msg">${esc(msg)}</p>
    </form>`;
  root.querySelector('#toggle-senha').addEventListener('click', () => {
    const inp = root.querySelector('#senha');
    const btn = root.querySelector('#toggle-senha');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; btn.title = 'Ocultar senha'; }
    else { inp.type = 'password'; btn.textContent = '👁'; btn.title = 'Mostrar senha'; }
    inp.focus();
  });
  root.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha: root.querySelector('#senha').value }) });
    const data = await r.json().catch(() => ({}));
    btn.disabled = false;
    if (!r.ok) return (root.querySelector('.form-msg').textContent = data.message || 'Erro ao entrar.');
    token = data.token; store.set(token); load();
  });
}
function logout() { token = ''; store.set(''); closeDrawer(); loginView(); }

/* ---------------- LISTA ---------------- */
async function load() {
  root.className = 'section admin-main';
  root.innerHTML = '<p class="muted">Carregando inscrições…</p>';
  try { const d = await api('/api/admin/inscricoes'); state = { ...d, items: d.inscricoes || [] }; } catch (e) { if (e.message !== 'login') root.innerHTML = `<p class="form-msg">${esc(e.message)}</p>`; return; }

  nav.innerHTML = `
    ${state.planilha ? `<a href="${state.planilha}" target="_blank" rel="noopener">PLANILHA ↗</a>` : ''}
    ${state.pastaRaiz ? `<a href="${state.pastaRaiz}" target="_blank" rel="noopener">DRIVE ↗</a>` : ''}
    <a href="#" id="sair">SAIR</a>`;
  nav.querySelector('#sair').onclick = (e) => { e.preventDefault(); logout(); };

  const configuredStyles = (state.casting?.estilos && state.casting.estilos.length)
    ? state.casting.estilos
    : (config?.secoes?.flatMap((s) => s.campos)?.find((c) => c.name === 'estilos_dominio')?.options || []);

  const rawStyles = [
    ...configuredStyles,
    ...state.items.flatMap((i) => [
      ...list(i.estilos_dominio),
      ...list(i.estilos_estudados),
      i.estilos_dominio_outros,
      i.estilos_estudados_outros,
    ]),
  ];
  const estilos = [...new Set(rawStyles.map((s) => (s || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare('pt-BR', { sensitivity: 'base' }));
  const opts = (key) => [...new Set(state.items.map((i) => i[key]).filter(Boolean))].sort();
  const sel = (key, label, values) => `<select data-f="${key}"><option value="">${label}</option>${values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>`;

  root.innerHTML = `
    <div class="admin-head">
      <div>
        <p class="kicker">PAINEL · ${esc(state.casting.titulo || '')}</p>
        <h2><span id="count">${state.items.length}</span> <span id="count-label">PERFIS</span></h2>
      </div>
    </div>
    <div class="toolbar">
      <input type="text" id="q" placeholder="Buscar nome, cidade, Instagram…">
      ${sel('genero', 'Gênero', opts('genero'))}
      <select data-f="_estilo"><option value="">Estilo (domina)</option>${estilos.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>
      <select data-f="_estilo_estudado"><option value="">Estilo (já estudou)</option>${estilos.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>
      ${sel('disponivel_show', 'Show 12/12', opts('disponivel_show'))}
      ${sel('disponivel_ensaios', 'Ensaios', opts('disponivel_ensaios'))}
      ${sel('tem_experiencia', 'Experiência', opts('tem_experiencia'))}
    </div>
    <div class="stage-bar">
      <div class="stage-tabs" id="tabs"></div>
      <div class="view-toggle">
        <button type="button" data-view="cards">CARDS</button>
        <button type="button" data-view="funil">FUNIL</button>
      </div>
    </div>
    <div id="grid"></div>`;
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    view = b.dataset.view; try { sessionStorage.setItem('casting_view', view); } catch {}
    render();
  }));
  root.querySelector('#q').addEventListener('input', render);
  root.querySelectorAll('[data-f]').forEach((s) => s.addEventListener('change', render));
  render();
}

function matchStyle(target, listVal, outrosVal) {
  if (!target) return true;
  const t = target.toLowerCase();
  const items = list(listVal).map((s) => s.toLowerCase());
  if (items.includes(t)) return true;
  if (outrosVal) {
    const o = String(outrosVal).toLowerCase();
    if (o.includes(t)) return true;
    if (list(outrosVal).map((s) => s.toLowerCase()).includes(t)) return true;
  }
  return false;
}

function filtered() {
  const q = root.querySelector('#q')?.value.trim().toLowerCase() || '';
  const f = Object.fromEntries([...root.querySelectorAll('[data-f]')].map((s) => [s.dataset.f, s.value]));
  return state.items.filter((i) => {
    if (q && !Object.values(i).join(' ').toLowerCase().includes(q)) return false;
    if (f._estilo && !matchStyle(f._estilo, i.estilos_dominio, i.estilos_dominio_outros)) return false;
    if (f._estilo_estudado && !matchStyle(f._estilo_estudado, i.estilos_estudados, i.estilos_estudados_outros)) return false;
    if (view === 'cards' && etapaFiltro && i._etapa !== etapaFiltro) return false;
    return Object.entries(f).every(([k, v]) => k.startsWith('_estilo') || !v || i[k] === v);
  });
}

function renderTabs() {
  const base = state.items.filter((i) => { const e = etapaFiltro; etapaFiltro = ''; const ok = filtered().includes(i); etapaFiltro = e; return ok; });
  const n = (e) => base.filter((i) => i._etapa === e).length;
  const tabs = root.querySelector('#tabs');
  tabs.hidden = view !== 'cards';
  tabs.innerHTML = [['', 'TODOS', base.length], ...state.crm.etapas.map((e) => [e, e.toUpperCase(), n(e)])]
    .map(([v, l, c]) => `<button type="button" class="${etapaFiltro === v ? 'on' : ''}" data-etapa="${esc(v)}">${esc(l)} <span>${c}</span></button>`).join('');
  tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { etapaFiltro = b.dataset.etapa; render(); }));
  root.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
}

function render() {
  renderTabs();
  const items = filtered();
  root.querySelector('#count').textContent = items.length;
  root.querySelector('#count-label').textContent = items.length === 1 ? 'PERFIL' : 'PERFIS';
  if (view === 'funil') return renderFunnel(items);
  const grid = root.querySelector('#grid');
  grid.className = 'cards-grid';
  if (!state.items.length) { grid.innerHTML = '<p class="muted">Nenhuma inscrição ainda.</p>'; return; }
  if (!items.length) { grid.innerHTML = '<p class="muted">Nenhum perfil com esses filtros.</p>'; return; }

  const activeEstilo = root.querySelector('[data-f="_estilo"]')?.value || '';
  const activeEstudado = root.querySelector('[data-f="_estilo_estudado"]')?.value || '';
  const isMatch = (tag, target) => Boolean(target && tag && tag.toLowerCase().includes(target.toLowerCase()));

  grid.innerHTML = items.map((i) => {
    const incompleto = /INCOMPLETO|ENVIANDO/.test(i._status);
    const show = i.disponivel_show === 'Sim';

    const dominaList = [
      ...list(i.estilos_dominio),
      ...(i.estilos_dominio_outros ? [i.estilos_dominio_outros] : []),
    ];

    let tagsToShow = [...dominaList];
    if (activeEstilo && tagsToShow.some((t) => isMatch(t, activeEstilo))) {
      tagsToShow.sort((a, b) => (isMatch(b, activeEstilo) ? 1 : 0) - (isMatch(a, activeEstilo) ? 1 : 0));
    } else if (activeEstudado && !tagsToShow.some((t) => isMatch(t, activeEstudado))) {
      const estudados = [...list(i.estilos_estudados), ...(i.estilos_estudados_outros ? [i.estilos_estudados_outros] : [])];
      if (estudados.some((t) => isMatch(t, activeEstudado))) {
        tagsToShow.unshift(`${activeEstudado} (estudou)`);
      }
    }

    const maxTags = 5;
    const extraCount = tagsToShow.length - maxTags;
    const visibleTags = tagsToShow.slice(0, maxTags);

    return `
    <button class="pcard" data-linha="${i._linha}">
      <div class="pcard-img" data-pasta="${esc(i._pastaId)}"><span class="ph">${esc((i.nome_artistico || '?')[0])}</span></div>
      <div class="pcard-body">
        <strong>${esc(i.nome_artistico || i.nome_completo)}</strong>
        <span class="muted">${[i.genero, i.idade && `${i.idade} anos`, i.cidade].filter(Boolean).map(esc).join(' · ')}</span>
        <span class="tags">${visibleTags.map((e) => {
          const dest = isMatch(e, activeEstilo) || isMatch(e, activeEstudado) || e.includes('(estudou)');
          return `<em class="${dest ? 'destaque' : ''}">${esc(e)}</em>`;
        }).join('')}${extraCount > 0 ? `<em class="more">+${extraCount}</em>` : ''}</span>
        <span class="badges">
          <b class="etapa e${etapaIdx(i._etapa)}">${esc(i._etapa.toUpperCase())}</b>
          <b class="${show ? 'ok' : 'no'}">SHOW ${show ? '✓' : '✕'}</b>
          ${i.tem_experiencia === 'Sim' ? '<b>EXPERIÊNCIA</b>' : ''}
          ${incompleto ? '<b class="warn">ARQUIVOS INCOMPLETOS</b>' : ''}
        </span>
      </div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.pcard').forEach((c) => c.addEventListener('click', () => openProfile(Number(c.dataset.linha))));
  grid.querySelectorAll('.pcard-img').forEach((el) => io.observe(el));
}

/* ---------------- FUNIL (arrastar entre colunas) ---------------- */
function renderFunnel(items) {
  const n = items.length;
  root.querySelector('#count').textContent = n;
  root.querySelector('#count-label').textContent = n === 1 ? 'PERFIL' : 'PERFIS';
  const activeEstilo = root.querySelector('[data-f="_estilo"]')?.value || '';
  const activeEstudado = root.querySelector('[data-f="_estilo_estudado"]')?.value || '';
  const filterTag = activeEstilo || activeEstudado;
  const grid = root.querySelector('#grid');
  grid.className = 'funnel';
  grid.innerHTML = state.crm.etapas.map((e, idx) => {
    const col = items.filter((i) => i._etapa === e);
    return `
    <section class="fcol e${idx}" data-etapa="${esc(e)}">
      <header><span class="dot e${idx}"></span>${esc(e.toUpperCase())}<span class="n">${col.length}</span></header>
      <div class="fcards">
        ${col.map((i) => `
          <article class="fcard" draggable="true" data-linha="${i._linha}">
            <div class="pcard-img" data-pasta="${esc(i._pastaId)}"><span class="ph">${esc((i.nome_artistico || '?')[0])}</span></div>
            <div><strong>${esc(i.nome_artistico || i.nome_completo)}</strong>
              <span class="muted">${[i.genero, i.idade && `${i.idade}a`].filter(Boolean).map(esc).join(' · ')}</span>
              ${filterTag ? `<span class="tags"><em class="destaque">${esc(filterTag)}</em></span>` : ''}
              ${i._notas ? '<span class="muted nota">📝 tem anotação</span>' : ''}</div>
          </article>`).join('') || '<p class="vazio">Arraste para cá</p>'}
      </div>
    </section>`;
  }).join('');
  grid.querySelectorAll('.fcard').forEach((c) => {
    c.addEventListener('click', () => openProfile(Number(c.dataset.linha)));
    c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.linha); c.classList.add('dragging'); });
    c.addEventListener('dragend', () => c.classList.remove('dragging'));
  });
  grid.querySelectorAll('.fcol').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('over');
      const item = state.items.find((x) => x._linha === Number(e.dataTransfer.getData('text/plain')));
      if (item && item._etapa !== col.dataset.etapa) salvar(item, { etapa: col.dataset.etapa });
    });
  });
  grid.querySelectorAll('.pcard-img').forEach((el) => io.observe(el));
}

let toastTimer;
function toast(msg, erro = false) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('erro', erro); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/** Salva etapa e/ou anotações na planilha (atualiza a tela na hora e desfaz se der erro). */
async function salvar(item, { etapa, notas }) {
  const antes = { _etapa: item._etapa, _notas: item._notas };
  if (etapa != null) item._etapa = etapa;
  if (notas != null) item._notas = notas;
  render();
  if (!drawer.hidden && panel.dataset.linha == item._linha) openProfile(item._linha);
  try {
    const r = await fetch('/api/admin/atualizar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ linha: item._linha, pasta: item._pastaId, etapa, notas }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) return logout();
    if (!r.ok) throw new Error(d.message || 'Erro ao salvar');
    item._atualizado = d.atualizado;
    if (d.linha && d.linha !== item._linha) item._linha = d.linha;
    toast(etapa != null ? `${item.nome_artistico || 'Perfil'} → ${etapa}` : 'Anotação salva');
  } catch (e) {
    Object.assign(item, antes); render();
    if (!drawer.hidden && panel.dataset.linha == item._linha) openProfile(item._linha);
    toast(e.message, true);
  }
}

/* miniaturas dos cards: carrega só o que aparece na tela, 4 por vez */
const queue = []; let running = 0;
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target); queue.push(e.target); pump();
}), { rootMargin: '300px' });
function pump() {
  while (running < 4 && queue.length) {
    const el = queue.shift(); running++;
    loadCover(el).finally(() => { running--; pump(); });
  }
}
async function files(pasta) {
  if (!pasta) return [];
  if (!filesCache.has(pasta)) filesCache.set(pasta, api(`/api/admin/arquivos?pasta=${encodeURIComponent(pasta)}`).then((d) => d.arquivos).catch(() => []));
  return filesCache.get(pasta);
}
async function loadCover(el) {
  const foto = (await files(el.dataset.pasta)).find((f) => f.tipo === 'foto');
  if (!foto) return;
  const img = new Image();
  img.alt = '';
  img.onload = () => { el.innerHTML = ''; el.appendChild(img); };
  img.src = thumb(foto.id, 500);
}

/* ---------------- PERFIL ---------------- */
async function openProfile(linha) {
  const i = state.items.find((x) => x._linha === linha);
  if (!i) return;
  // mantém o texto que estava sendo digitado nas anotações se a ficha for redesenhada
  const rascunho = !drawer.hidden && panel.dataset.linha == linha ? panel.querySelector('#notas')?.value : null;
  const msg = (state.crm.mensagens[i._etapa] || '').replace(/\{nome\}/g, (i.nome_artistico || i.nome_completo || '').split(' ')[0]);
  const insta = (i.instagram || '').replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/[/?].*$/, '');
  const zap = (i.whatsapp || '').replace(/\D/g, '');
  const skip = new Set(['_status', '_pasta', 'nome_artistico', '_etapa', '_notas', '_atualizado']);
  const activeEstilo = root.querySelector('[data-f="_estilo"]')?.value || '';
  const activeEstudado = root.querySelector('[data-f="_estilo_estudado"]')?.value || '';
  const isMatchTag = (t) => (activeEstilo && t.toLowerCase() === activeEstilo.toLowerCase()) ||
                            (activeEstudado && t.toLowerCase() === activeEstudado.toLowerCase());

  const ficha = state.fields.filter((f) => !skip.has(f.key) && f.type !== 'files' && i[f.key])
    .map((f) => {
      let valHTML = esc(i[f.key]);
      if (f.key === 'estilos_dominio' || f.key === 'estilos_estudados') {
        const tags = list(i[f.key]);
        valHTML = `<span class="tags">${tags.map((t) => `<em class="${isMatchTag(t) ? 'destaque' : ''}">${esc(t)}</em>`).join('')}</span>`;
      }
      return `<dt>${esc(f.label)}</dt><dd>${valHTML}</dd>`;
    }).join('');

  panel.innerHTML = `
    <button class="close" data-close aria-label="Fechar">×</button>
    <p class="kicker">${esc(i._recebido)} · ${esc(i._status)}</p>
    <h2>${esc(i.nome_artistico || i.nome_completo)}</h2>
    <p class="muted">${esc(i.nome_completo)}</p>
    <p class="links">
      ${zap ? `<a href="https://wa.me/55${zap}" target="_blank" rel="noopener">WHATSAPP ↗</a>` : ''}
      ${insta ? `<a href="https://instagram.com/${esc(insta)}" target="_blank" rel="noopener">INSTAGRAM ↗</a>` : ''}
      ${i.email ? `<a href="mailto:${esc(i.email)}">E-MAIL ↗</a>` : ''}
      ${i._pasta?.startsWith('http') ? `<a href="${esc(i._pasta)}" target="_blank" rel="noopener">PASTA NO DRIVE ↗</a>` : ''}
    </p>
    <div class="crm-box">
      <p class="crm-label">ETAPA NO FUNIL ${i._atualizado ? `<span class="muted">· atualizado ${esc(i._atualizado)}</span>` : ''}</p>
      <div class="crm-etapas">${state.crm.etapas.map((e, idx) => `<button type="button" class="${i._etapa === e ? 'on' : ''} e${idx}" data-set-etapa="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      ${zap ? `<a class="btn btn-zap" href="https://wa.me/55${zap}${msg ? `?text=${encodeURIComponent(msg)}` : ''}" target="_blank" rel="noopener">CONTATAR NO WHATSAPP →</a>
        ${msg ? `<p class="muted msg-preview">Mensagem pronta: “${esc(msg)}”</p>` : ''}` : ''}
      <p class="crm-label">ANOTAÇÕES</p>
      <textarea id="notas" rows="4" placeholder="Ex.: ligou dia 02/11, disponível só à noite, ótima no heels…">${esc(rascunho ?? i._notas ?? '')}</textarea>
      <button type="button" class="btn btn-small" id="salvar-notas">SALVAR ANOTAÇÃO</button>
    </div>
    <h3>FOTOS</h3><div class="gallery" id="g-fotos"><p class="muted">Carregando…</p></div>
    <h3>VÍDEOS</h3><div class="gallery videos" id="g-videos"></div>
    <h3>FICHA</h3><dl>${ficha}</dl>`;
  panel.dataset.linha = i._linha;
  panel.querySelectorAll('[data-set-etapa]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.setEtapa !== i._etapa) salvar(i, { etapa: b.dataset.setEtapa });
  }));
  panel.querySelector('#salvar-notas').addEventListener('click', () => salvar(i, { notas: panel.querySelector('#notas').value }));
  drawer.hidden = false;
  document.body.style.overflow = 'hidden';

  const arqs = await files(i._pastaId);
  const fotos = arqs.filter((f) => f.tipo === 'foto');
  const videos = arqs.filter((f) => f.tipo === 'video');
  panel.querySelector('#g-fotos').innerHTML = fotos.length
    ? fotos.map((f) => `<a href="${esc(openLink(f))}" target="_blank" rel="noopener"><img src="${thumb(f.id, 1000)}" alt="" loading="lazy"></a>`).join('')
    : '<p class="muted">Nenhuma foto.</p>';
  panel.querySelector('#g-videos').innerHTML = videos.length
    ? videos.map((f, n) => `<a class="vid" href="${esc(openLink(f))}" target="_blank" rel="noopener">
        <img src="${thumb(f.id, 600)}" alt="" onerror="this.remove()"><span>▶ VÍDEO ${n + 1}</span></a>`).join('')
    : '<p class="muted">Nenhum vídeo.</p>';
}
function closeDrawer() { drawer.hidden = true; document.body.style.overflow = ''; }
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

token ? load() : loginView();

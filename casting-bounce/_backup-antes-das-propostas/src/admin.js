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
// listas para contratantes
let listas = [];
let listasErro = '';
let selecionando = false;
let destinoLista = ''; // quando vem do botão "+ ADICIONAR PERFIS" de uma lista
const selecao = new Set(); // ids das pastas selecionadas
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
  try {
    const [d, l] = await Promise.all([
      api('/api/admin/inscricoes'),
      api('/api/admin/listas').catch((e) => { if (e.message === 'login') throw e; listasErro = e.message; return { listas: [] }; }),
    ]);
    state = { ...d, items: d.inscricoes || [] };
    listas = l.listas || [];
  } catch (e) { if (e.message !== 'login') root.innerHTML = `<p class="form-msg">${esc(e.message)}</p>`; return; }

  nav.innerHTML = `
    <a href="#inscricoes" data-nav="inscricoes">INSCRIÇÕES</a>
    <a href="#listas" data-nav="listas">LISTAS</a>
    <a href="#relatorio" data-nav="relatorio">RELATÓRIO</a>
    ${state.planilha ? `<a href="${state.planilha}" target="_blank" rel="noopener">PLANILHA ↗</a>` : ''}
    ${state.pastaRaiz ? `<a href="${state.pastaRaiz}" target="_blank" rel="noopener">DRIVE ↗</a>` : ''}
    <a href="#" id="sair">SAIR</a>`;
  nav.querySelector('#sair').onclick = (e) => { e.preventDefault(); logout(); };
  route();
}

/* navegação: #inscricoes (padrão) · #listas · #lista/<id> */
function route() {
  const h = location.hash;
  const concluida = h.startsWith('#lista/') && listas.find((l) => l.id === decodeURIComponent(h.slice(7)))?.status === CONCLUIDA;
  const aba = h === '#relatorio' || concluida ? 'relatorio' : h.startsWith('#lista') ? 'listas' : 'inscricoes';
  nav.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === aba));
  closeDrawer();
  window.scrollTo(0, 0);
  document.querySelector('.sel-bar')?.remove();
  document.body.classList.remove('selecionando');
  if (h.startsWith('#lista/')) return renderListaDetalhe(decodeURIComponent(h.slice(7)));
  if (h === '#listas') return renderListas();
  if (h === '#relatorio') return renderRelatorio();
  if (!destinoLista) { selecionando = false; selecao.clear(); }
  renderInscricoes();
}
window.addEventListener('hashchange', () => { if (token && state.items?.length !== undefined && nav.innerHTML) route(); });

function renderInscricoes() {
  root.className = 'section admin-main';
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
    <div class="admin-head with-actions">
      <div>
        <p class="kicker">PAINEL · ${esc(state.casting.titulo || '')}</p>
        <h2><span id="count">${state.items.length}</span> <span id="count-label">PERFIS</span></h2>
      </div>
      <button type="button" class="btn btn-small btn-line" id="sel-toggle"></button>
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
  root.querySelector('#sel-toggle').addEventListener('click', () => {
    selecionando = !selecionando;
    if (!selecionando) {
      selecao.clear();
      if (destinoLista) { const id = destinoLista; destinoLista = ''; location.hash = `#lista/${id}`; return; }
    }
    render();
  });
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
  // a ficha pode ser aberta a partir da página de uma lista: aí redesenha a lista, não os cards
  if (!root.querySelector('#tabs')) {
    if (location.hash.startsWith('#lista/')) renderListaDetalhe(decodeURIComponent(location.hash.slice(7)));
    else if (location.hash === '#listas') renderListas();
    else if (location.hash === '#relatorio') renderRelatorio();
    return;
  }
  renderTabs();
  renderSelBar();
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
    <button class="pcard${selecao.has(i._pastaId) ? ' sel' : ''}" data-linha="${i._linha}">
      ${selecionando ? `<span class="check" aria-hidden="true">${selecao.has(i._pastaId) ? '✓' : ''}</span>` : ''}
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
          ${badgeListas(i._pastaId)}
        </span>
      </div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.pcard').forEach((c) => c.addEventListener('click', () => clicarCard(Number(c.dataset.linha))));
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
          <article class="fcard${selecao.has(i._pastaId) ? ' sel' : ''}" draggable="true" data-linha="${i._linha}">
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
    c.addEventListener('click', () => clicarCard(Number(c.dataset.linha)));
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
    ${blocoListasPerfil(i)}
    <h3>FOTOS</h3><div class="gallery" id="g-fotos"><p class="muted">Carregando…</p></div>
    <h3>VÍDEOS</h3><div class="gallery videos" id="g-videos"></div>
    <h3>FICHA</h3><dl>${ficha}</dl>
    ${i._pastaId ? `<div class="zona-perigo">
      <p class="crm-label">EXCLUIR PERFIL</p>
      <p class="muted">Tira o perfil do painel e das listas em andamento. Os dados ficam guardados na aba “Perfis excluídos” da planilha e a pasta de fotos/vídeos vai para a lixeira do Drive (dá para recuperar por 30 dias).</p>
      <button type="button" class="btn btn-small btn-perigo" id="excluir-perfil">EXCLUIR PERFIL</button>
    </div>` : ''}`;
  panel.dataset.linha = i._linha;
  panel.querySelector('#excluir-perfil')?.addEventListener('click', () => excluirPerfil(i));
  panel.querySelectorAll('[data-set-etapa]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.setEtapa !== i._etapa) salvar(i, { etapa: b.dataset.setEtapa });
  }));
  panel.querySelector('#salvar-notas').addEventListener('click', () => salvar(i, { notas: panel.querySelector('#notas').value }));
  ligarListasPerfil(i);
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

/* ============================================================
   LISTAS PARA CONTRATANTES
   ============================================================ */
const ATIVA = 'Ativa';
const ENCERRADA = 'Encerrada';
const CONCLUIDA = 'Concluída';
const itemPorPasta = (p) => state.items.find((x) => x._pastaId === p);
const listasDe = (pasta) => listas.filter((l) => l.pessoas.some((p) => p.p === pasta));
const dataBR = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('/') : d || '');
const linkLista = (l) => `${location.origin}${/^(localhost|127\.)/.test(location.hostname) ? '/lista.html' : '/lista'}?c=${l.id}.${l.chave}`;
const pessoaDe = (i) => ({ c: state.casting.slug, p: i._pastaId, nome: i.nome_artistico || i.nome_completo || '' });

function badgeListas(pasta) {
  const ls = listasDe(pasta).filter((l) => l.status === ATIVA);
  return ls.length ? `<b class="lst" title="${esc(ls.map((l) => l.nome).join(' · '))}">EM ${ls.length} ${ls.length === 1 ? 'LISTA' : 'LISTAS'}</b>` : '';
}

async function postListas(body) {
  const r = await fetch('/api/admin/listas', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  if (r.status === 401) { logout(); throw new Error('login'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || 'Erro ao salvar a lista.'), { status: r.status });
  if (rascunhoLista?.id === d.lista.id) rascunhoLista = null;
  const idx = listas.findIndex((l) => l.id === d.lista.id);
  if (d.lista.status === 'Excluída') { if (idx >= 0) listas.splice(idx, 1); }
  else if (idx >= 0) listas[idx] = d.lista; else listas.unshift(d.lista);
  if (d.aviso) setTimeout(() => toast(d.aviso, true), 2700);
  return d;
}

/* ---------- seleção de perfis ---------- */
function clicarCard(linha) {
  const i = state.items.find((x) => x._linha === linha);
  if (!i) return;
  if (!selecionando) return openProfile(linha);
  if (!i._pastaId) return toast('Este perfil não tem pasta no Drive.', true);
  selecao.has(i._pastaId) ? selecao.delete(i._pastaId) : selecao.add(i._pastaId);
  render();
}

function renderSelBar() {
  const btn = root.querySelector('#sel-toggle');
  if (btn) btn.textContent = selecionando ? 'CANCELAR SELEÇÃO' : '☐ SELECIONAR PARA LISTA';
  document.body.classList.toggle('selecionando', selecionando);
  let bar = document.querySelector('.sel-bar');
  if (!selecionando || location.hash.startsWith('#lista')) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('div'); bar.className = 'sel-bar'; document.body.appendChild(bar); }
  const destino = listas.find((l) => l.id === destinoLista);
  bar.innerHTML = `
    <span><strong>${selecao.size}</strong> ${selecao.size === 1 ? 'perfil selecionado' : 'perfis selecionados'}${destino ? ` · para <em>${esc(destino.nome)}</em>` : ''}</span>
    <button type="button" data-sel="todos">SELECIONAR OS ${filtered().length} VISÍVEIS</button>
    ${selecao.size ? '<button type="button" data-sel="limpar">LIMPAR</button>' : ''}
    <button type="button" class="btn btn-small" data-sel="adicionar" ${selecao.size ? '' : 'disabled'}>${destino ? 'ADICIONAR À LISTA →' : 'ADICIONAR A UMA LISTA →'}</button>`;
  bar.querySelector('[data-sel="todos"]').onclick = () => { filtered().forEach((i) => i._pastaId && selecao.add(i._pastaId)); render(); };
  bar.querySelector('[data-sel="limpar"]')?.addEventListener('click', () => { selecao.clear(); render(); });
  bar.querySelector('[data-sel="adicionar"]').onclick = () => {
    const pessoas = [...selecao].map(itemPorPasta).filter(Boolean).map(pessoaDe);
    if (destino) return adicionarEm(destino.id, pessoas);
    escolherLista(pessoas);
  };
}

async function adicionarEm(id, pessoas, { irParaLista = true } = {}) {
  try {
    const d = await postListas({ acao: 'adicionar', id, pessoas });
    toast(d.novos ? `${d.novos} ${d.novos === 1 ? 'perfil adicionado' : 'perfis adicionados'} a “${d.lista.nome}”` : 'Esses perfis já estavam na lista');
    fecharModal();
    if (irParaLista) { selecionando = false; selecao.clear(); destinoLista = ''; location.hash = `#lista/${id}`; }
    else atualizarTela();
    return d;
  } catch (e) { if (e.message !== 'login') toast(e.message, true); }
}

/** Redesenha a tela atual e, se a ficha estiver aberta, a ficha também. */
function atualizarTela() {
  const linha = drawer.hidden ? null : Number(panel.dataset.linha);
  render();
  if (linha) openProfile(linha);
}

/* ---------- janela "adicionar a uma lista" ---------- */
function modal(html) {
  fecharModal();
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="modal-bg" data-fechar></div><div class="modal-box" role="dialog" aria-modal="true">
    <button class="close" data-fechar aria-label="Fechar">×</button>${html}</div>`;
  m.addEventListener('click', (e) => { if (e.target.closest('[data-fechar]')) fecharModal(); });
  document.body.appendChild(m);
  return m;
}
function fecharModal() { document.querySelector('.modal')?.remove(); }

const camposLista = (l = {}) => `
  <label>Nome da lista *<input type="text" name="nome" required maxlength="120" value="${esc(l.nome || '')}" placeholder="Ex.: Show Fulano · elenco final"></label>
  <label>Evento<input type="text" name="evento" maxlength="160" value="${esc(l.evento || '')}" placeholder="Ex.: Show Fulano no Araújo Vianna"></label>
  <div class="row2">
    <label>Data do evento<input name="data" type="date" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(l.data || '') ? l.data : '')}"></label>
    <label>Contratante<input type="text" name="contratante" maxlength="160" value="${esc(l.contratante || '')}" placeholder="Empresa ou pessoa"></label>
  </div>`;

function escolherLista(pessoas, { irParaLista = true } = {}) {
  const abertas = listas.filter((l) => l.status === ATIVA);
  const m = modal(`
    <p class="kicker">${pessoas.length} ${pessoas.length === 1 ? 'PERFIL' : 'PERFIS'}</p>
    <h3>ADICIONAR A UMA LISTA</h3>
    ${abertas.length ? `<div class="modal-listas">${abertas.map((l) => `
      <button type="button" data-id="${esc(l.id)}"><strong>${esc(l.nome)}</strong>
        <span class="muted">${[l.evento, dataBR(l.data), l.contratante].filter(Boolean).map(esc).join(' · ')} · ${l.pessoas.length} perfis</span></button>`).join('')}</div>
      <p class="modal-ou">ou crie uma nova</p>` : ''}
    <form class="modal-form" id="nova-lista">
      ${camposLista()}
      <button class="btn btn-small" type="submit">CRIAR LISTA E ADICIONAR →</button>
    </form>`);
  m.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => adicionarEm(b.dataset.id, pessoas, { irParaLista })));
  m.querySelector('#nova-lista').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try {
      const d = await postListas({ acao: 'criar', ...Object.fromEntries(new FormData(e.target)), pessoas });
      toast(`Lista “${d.lista.nome}” criada`);
      fecharModal();
      if (irParaLista) { selecionando = false; selecao.clear(); destinoLista = ''; location.hash = `#lista/${d.lista.id}`; }
      else atualizarTela();
    } catch (err) { btn.disabled = false; if (err.message !== 'login') toast(err.message, true); }
  });
  (m.querySelector('[data-id]') || m.querySelector('input'))?.focus();
}

/* ---------- listas na ficha do perfil ---------- */
function blocoListasPerfil(i) {
  const ls = listasDe(i._pastaId);
  return `
    <div class="crm-box listas-box">
      <p class="crm-label">LISTAS PARA CONTRATANTES</p>
      ${ls.length ? `<div class="chips-listas">${ls.map((l) => {
        const p = l.pessoas.find((x) => x.p === i._pastaId);
        const tag = l.status === ATIVA ? '' : l.status === CONCLUIDA ? (p?.ok ? ' ✓ participou' : ' (concluída, não participou)') : ' (encerrada)';
        return `<a href="#lista/${esc(l.id)}" class="${l.status === ATIVA ? '' : l.status === CONCLUIDA && p?.ok ? 'feito' : 'off'}">${esc(l.nome)}${tag}</a>`;
      }).join('')}</div>`
        : '<p class="muted" style="margin:0">Ainda não está em nenhuma lista.</p>'}
      ${i._pastaId ? '<button type="button" class="btn btn-small btn-line" id="add-lista">+ ADICIONAR A UMA LISTA</button>' : ''}
    </div>`;
}
function ligarListasPerfil(i) {
  panel.querySelector('#add-lista')?.addEventListener('click', () => escolherLista([pessoaDe(i)], { irParaLista: false }));
  panel.querySelectorAll('.chips-listas a').forEach((a) => a.addEventListener('click', closeDrawer));
}

/* ---------- página LISTAS ---------- */
function capas(l, n = 4) {
  return l.pessoas.slice(0, n).map((p) => `<span class="pcard-img mini" data-pasta="${esc(p.p)}"><span class="ph">${esc((p.nome || '?')[0])}</span></span>`).join('');
}

function renderListas() {
  root.className = 'section admin-main';
  const ativas = listas.filter((l) => l.status === ATIVA);
  const encerradas = listas.filter((l) => l.status === ENCERRADA);
  const nConcluidas = listas.filter((l) => l.status === CONCLUIDA).length;
  const card = (l) => `
    <a class="lcard ${l.status === ATIVA ? '' : 'off'}" href="#lista/${esc(l.id)}">
      <div class="lcard-capas">${capas(l) || '<span class="muted">Lista vazia</span>'}</div>
      <div class="lcard-body">
        <span class="badges"><b class="${l.status === ATIVA ? 'ok' : 'no'}">${l.status === ATIVA ? 'LINK ATIVO' : 'ENCERRADA'}</b></span>
        <strong>${esc(l.nome)}</strong>
        <span class="muted">${[l.evento, dataBR(l.data)].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</span>
        <span class="muted">${l.contratante ? `Para ${esc(l.contratante)} · ` : ''}${l.pessoas.length} ${l.pessoas.length === 1 ? 'perfil' : 'perfis'}</span>
      </div>
    </a>`;
  root.innerHTML = `
    <div class="admin-head with-actions">
      <div>
        <p class="kicker">ENVIO PARA CONTRATANTES</p>
        <h2>${ativas.length + encerradas.length} ${ativas.length + encerradas.length === 1 ? 'LISTA' : 'LISTAS'}</h2>
      </div>
      <button type="button" class="btn btn-small" id="nova">+ NOVA LISTA</button>
    </div>
    ${listasErro ? `<p class="form-msg">${esc(listasErro)}</p>` : ''}
    <p class="muted listas-ajuda">Cada lista é um link só de visualização para um contratante: fotos, vídeos, medidas e estilos — sem contato, CPF ou endereço.
      Para montar, vá em <a href="#inscricoes">INSCRIÇÕES</a> → <b>SELECIONAR PARA LISTA</b>, ou crie uma lista vazia aqui.</p>
    ${ativas.length ? `<div class="listas-grid">${ativas.map(card).join('')}</div>` : '<p class="muted">Nenhuma lista ativa.</p>'}
    ${encerradas.length ? `<h3 class="listas-sub">ENCERRADAS</h3><div class="listas-grid">${encerradas.map(card).join('')}</div>` : ''}
    ${nConcluidas ? `<p class="muted listas-rodape">${nConcluidas} ${nConcluidas === 1 ? 'trabalho concluído está' : 'trabalhos concluídos estão'} no <a href="#relatorio">RELATÓRIO →</a></p>` : ''}`;
  root.querySelector('#nova').addEventListener('click', () => {
    const m = modal(`<h3>NOVA LISTA</h3><form class="modal-form" id="f">${camposLista()}<button class="btn btn-small" type="submit">CRIAR LISTA →</button></form>`);
    m.querySelector('input').focus();
    m.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const d = await postListas({ acao: 'criar', ...Object.fromEntries(new FormData(e.target)), pessoas: [] });
        fecharModal(); location.hash = `#lista/${d.lista.id}`;
      } catch (err) { if (err.message !== 'login') toast(err.message, true); }
    });
  });
  root.querySelectorAll('.pcard-img[data-pasta]').forEach((el) => io.observe(el));
}

/* ---------- página de UMA lista ---------- */
let rascunhoLista = null; // cópia em edição (só vai para a planilha ao salvar)

function renderListaDetalhe(id) {
  const orig = listas.find((l) => l.id === id);
  root.className = 'section admin-main';
  if (!orig) { root.innerHTML = '<p class="muted">Lista não encontrada. <a href="#listas">Voltar para as listas</a></p>'; return; }
  if (orig.status === CONCLUIDA) return renderListaConcluida(orig);
  if (!rascunhoLista || rascunhoLista.id !== id) rascunhoLista = structuredClone(orig);
  const l = rascunhoLista;
  const mudou = JSON.stringify(l) !== JSON.stringify(orig);
  const ativa = orig.status === ATIVA;
  const link = linkLista(orig);
  const msg = `Olá${orig.contratante ? `, ${orig.contratante}` : ''}! Segue a seleção de elenco da Bounce Basement${orig.evento ? ` para ${orig.evento}` : ''}: ${link}`;

  root.innerHTML = `
    <p class="voltar"><a href="#listas">← TODAS AS LISTAS</a></p>
    <div class="admin-head with-actions">
      <div><p class="kicker">LISTA PARA CONTRATANTE · ${l.pessoas.length} ${l.pessoas.length === 1 ? 'PERFIL' : 'PERFIS'}</p>
        <h2 class="lista-titulo">${esc(l.nome)}</h2></div>
      <div class="head-acoes">
        <button type="button" class="btn btn-small" id="concluir" ${l.pessoas.length ? '' : 'disabled'}>✓ CONCLUIR TRABALHO</button>
        <button type="button" class="btn btn-small btn-perigo-line" id="excluir">EXCLUIR LISTA</button>
      </div>
    </div>

    <div class="lista-cols">
      <section class="crm-box envio ${ativa ? '' : 'off'}">
        <p class="crm-label">LINK DO CONTRATANTE</p>
        ${ativa ? `
          <div class="link-box"><input type="text" readonly value="${esc(link)}" id="link"><button type="button" class="btn btn-small" id="copiar">COPIAR</button></div>
          <div class="envio-acoes">
            <a class="btn btn-small btn-zap" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">ENVIAR NO WHATSAPP →</a>
            <a class="btn btn-small btn-line" href="mailto:?subject=${encodeURIComponent(`Seleção de elenco · ${orig.nome}`)}&body=${encodeURIComponent(msg)}">E-MAIL</a>
            <a class="btn btn-small btn-line" target="_blank" rel="noopener" href="${esc(link)}">VER COMO CONTRATANTE ↗</a>
          </div>
          <p class="muted ajuda">O contratante só visualiza: fotos, vídeos e ficha (sem contato). Mudanças salvas aparecem no mesmo link.</p>
          <div class="envio-acoes">
            <button type="button" class="link-acao" data-status="${ENCERRADA}">Encerrar lista (desliga o link)</button>
            <button type="button" class="link-acao" id="novo-link">Gerar novo link (o antigo para de funcionar)</button>
          </div>`
        : `<p>Lista encerrada: o link está desligado e os vídeos não estão mais compartilhados.</p>
           <div class="envio-acoes"><button type="button" class="btn btn-small" data-status="${ATIVA}">REATIVAR LINK</button></div>`}
      </section>

      <form class="crm-box modal-form" id="dados-lista">
        <p class="crm-label">DADOS DA LISTA</p>
        ${camposLista(l)}
      </form>
    </div>

    <div class="lista-pessoas-head">
      <h3 class="listas-sub">PERFIS NA LISTA</h3>
      <button type="button" class="btn btn-small btn-line" id="add-perfis">+ ADICIONAR PERFIS</button>
    </div>
    <ol class="lista-pessoas">
      ${l.pessoas.map((p, n) => {
        const i = itemPorPasta(p.p);
        return `
        <li data-n="${n}">
          <span class="pos">${n + 1}</span>
          <span class="pcard-img mini" data-pasta="${esc(p.p)}"><span class="ph">${esc((p.nome || '?')[0])}</span></span>
          <div class="lp-info">
            <button type="button" class="lp-nome" data-perfil="${n}">${esc(i?.nome_artistico || p.nome || 'Perfil')}</button>
            <span class="muted">${i ? [i.genero, i.idade && `${i.idade} anos`, i.cidade].filter(Boolean).map(esc).join(' · ') : 'de outro casting'}
              ${i?._etapa ? ` <b class="etapa-mini e${etapaIdx(i._etapa)}">${esc(i._etapa)}</b>` : ''}</span>
            <textarea rows="1" data-nota="${n}" placeholder="Nota para o contratante (opcional) — ex.: forte em heels, já trabalhou com o artista">${esc(p.nota || '')}</textarea>
          </div>
          <div class="lp-acoes">
            <button type="button" data-mover="${n}|-1" ${n === 0 ? 'disabled' : ''} title="Subir">↑</button>
            <button type="button" data-mover="${n}|1" ${n === l.pessoas.length - 1 ? 'disabled' : ''} title="Descer">↓</button>
            <button type="button" data-tirar="${n}" title="Tirar da lista">✕</button>
          </div>
        </li>`;
      }).join('') || '<p class="muted">Nenhum perfil ainda. Clique em “+ ADICIONAR PERFIS”.</p>'}
    </ol>

    <div class="salvar-bar ${mudou ? 'show' : ''}">
      <span>Alterações não salvas</span>
      <button type="button" class="link-acao" id="descartar">Descartar</button>
      <button type="button" class="btn btn-small" id="salvar-lista">SALVAR LISTA</button>
    </div>
    <p class="muted listas-rodape">Quando o evento acontecer, clique em <b>✓ CONCLUIR TRABALHO</b>: o link é desligado e a lista vai para o <a href="#relatorio">RELATÓRIO</a> com quem participou.</p>`;

  const sujo = () => root.querySelector('.salvar-bar').classList.toggle('show', JSON.stringify(rascunhoLista) !== JSON.stringify(orig));
  const form = root.querySelector('#dados-lista');
  form.addEventListener('input', () => {
    Object.assign(l, Object.fromEntries(new FormData(form)));
    root.querySelector('.lista-titulo').textContent = l.nome || 'SEM NOME';
    sujo();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  root.querySelectorAll('[data-nota]').forEach((t) => {
    const ajusta = () => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; };
    ajusta();
    t.addEventListener('input', () => { l.pessoas[Number(t.dataset.nota)].nota = t.value; ajusta(); sujo(); });
  });
  root.querySelectorAll('[data-mover]').forEach((b) => b.addEventListener('click', () => {
    const [n, d] = b.dataset.mover.split('|').map(Number);
    const [x] = l.pessoas.splice(n, 1); l.pessoas.splice(n + d, 0, x);
    renderListaDetalhe(id);
  }));
  root.querySelectorAll('[data-tirar]').forEach((b) => b.addEventListener('click', () => {
    l.pessoas.splice(Number(b.dataset.tirar), 1); renderListaDetalhe(id);
  }));
  root.querySelectorAll('[data-perfil]').forEach((b) => b.addEventListener('click', () => {
    const i = itemPorPasta(l.pessoas[Number(b.dataset.perfil)].p);
    i ? openProfile(i._linha) : toast('Este perfil é de outro casting.', true);
  }));
  root.querySelector('#copiar')?.addEventListener('click', async () => {
    const inp = root.querySelector('#link');
    try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand('copy'); }
    toast('Link copiado');
  });
  root.querySelector('#add-perfis').addEventListener('click', () => {
    if (mudou || JSON.stringify(rascunhoLista) !== JSON.stringify(orig)) return toast('Salve ou descarte as alterações antes.', true);
    selecionando = true; destinoLista = id; selecao.clear();
    location.hash = '#inscricoes';
  });

  const enviar = async (body, okMsg) => {
    try {
      const d = await postListas({ id, ...body });
      rascunhoLista = structuredClone(d.lista);
      toast(okMsg);
      renderListaDetalhe(id);
    } catch (e) {
      if (e.message === 'login') return;
      toast(e.message, true);
      if (e.status === 409) { const r = await api('/api/admin/listas'); listas = r.listas || []; rascunhoLista = null; renderListaDetalhe(id); }
    }
  };
  root.querySelector('#salvar-lista').addEventListener('click', () => {
    if (!l.nome.trim()) return toast('Dê um nome para a lista.', true);
    enviar({ acao: 'salvar', versao: orig.versao, nome: l.nome, evento: l.evento, data: l.data, contratante: l.contratante, pessoas: l.pessoas }, 'Lista salva');
  });
  root.querySelector('#descartar').addEventListener('click', () => { rascunhoLista = null; renderListaDetalhe(id); });
  root.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    if (JSON.stringify(rascunhoLista) !== JSON.stringify(orig)) return toast('Salve ou descarte as alterações antes.', true);
    const s = b.dataset.status;
    if (s === ENCERRADA && !confirm('Encerrar a lista? O contratante não vai mais conseguir abrir o link.')) return;
    enviar({ acao: 'salvar', versao: orig.versao, status: s }, s === ATIVA ? 'Link reativado' : 'Lista encerrada');
  }));
  root.querySelector('#novo-link')?.addEventListener('click', () => {
    if (!confirm('Gerar um link novo? O link antigo para de funcionar na hora.')) return;
    enviar({ acao: 'novo-link' }, 'Novo link gerado — envie de novo ao contratante');
  });
  root.querySelector('#excluir').addEventListener('click', () => excluirLista(orig));
  root.querySelector('#concluir').addEventListener('click', () => {
    if (JSON.stringify(rascunhoLista) !== JSON.stringify(orig)) return toast('Salve ou descarte as alterações antes.', true);
    concluirLista(orig);
  });
  root.querySelectorAll('.pcard-img[data-pasta]').forEach((el) => io.observe(el));
}

async function excluirLista(l) {
  if (!confirm(`Excluir a lista “${l.nome}”?\n\nO link para de funcionar e ela some do painel e do relatório. Os perfis não são apagados.`)) return;
  try { await postListas({ acao: 'excluir', id: l.id }); rascunhoLista = null; toast('Lista excluída'); location.hash = l.status === CONCLUIDA ? '#relatorio' : '#listas'; }
  catch (e) { if (e.message !== 'login') toast(e.message, true); }
}

/* ---------- concluir trabalho ---------- */
function concluirLista(l) {
  const editando = l.status === CONCLUIDA;
  const nomeDe = (p) => itemPorPasta(p.p)?.nome_artistico || p.nome || 'Perfil';
  const m = modal(`
    <p class="kicker">${esc(l.nome)}</p>
    <h3>${editando ? 'EDITAR CONCLUSÃO' : 'CONCLUIR TRABALHO'}</h3>
    <form class="modal-form" id="f">
      <p class="crm-label">QUEM PARTICIPOU?</p>
      <div class="participantes">${l.pessoas.filter((p) => !p.excluido).map((p) => `
        <label class="part"><input type="checkbox" name="p" value="${esc(p.p)}" ${!editando || p.ok ? 'checked' : ''}><span>${esc(nomeDe(p))}</span></label>`).join('')}</div>
      <label>O que foi feito / resultado (opcional)
        <textarea name="resultado" rows="4" placeholder="Ex.: show realizado em 12/12, 2 ensaios, cachê pago, contratante pediu as mesmas para 2027…">${esc(l.resultado || '')}</textarea></label>
      ${editando ? '' : '<p class="muted" style="margin:0;font-size:13px">O link do contratante é desligado e os vídeos deixam de ser compartilhados. A lista vai para o RELATÓRIO.</p>'}
      <button class="btn btn-small" type="submit">${editando ? 'SALVAR' : '✓ CONCLUIR E MOVER PARA O RELATÓRIO'}</button>
    </form>`);
  m.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await postListas({ acao: 'concluir', id: l.id, versao: l.versao, resultado: fd.get('resultado'), participaram: fd.getAll('p') });
      fecharModal();
      toast(editando ? 'Conclusão atualizada' : 'Trabalho concluído — está no relatório');
      if (location.hash === `#lista/${l.id}`) route(); else location.hash = `#lista/${l.id}`;
    } catch (err) { btn.disabled = false; if (err.message !== 'login') toast(err.message, true); }
  });
}

function renderListaConcluida(l) {
  const vivos = l.pessoas;
  const foram = vivos.filter((p) => p.ok);
  const naoForam = vivos.filter((p) => !p.ok);
  const linha = (p) => {
    const i = !p.excluido && itemPorPasta(p.p);
    return `<li class="${p.ok ? '' : 'nao'}">
      <span class="pcard-img mini" ${i ? `data-pasta="${esc(p.p)}"` : ''}><span class="ph">${esc((p.nome || '?')[0])}</span></span>
      <div class="lp-info">
        ${i ? `<button type="button" class="lp-nome" data-perfil="${esc(p.p)}">${esc(i.nome_artistico || p.nome)}</button>` : `<span class="lp-nome">${esc(p.nome || 'Perfil')}</span>`}
        <span class="muted">${p.excluido ? 'perfil excluído do painel' : i ? [i.genero, i.idade && `${i.idade} anos`].filter(Boolean).map(esc).join(' · ') : ''}</span>
        ${p.nota ? `<span class="muted nota-lp">“${esc(p.nota)}”</span>` : ''}
      </div>
    </li>`;
  };
  root.innerHTML = `
    <p class="voltar"><a href="#relatorio">← RELATÓRIO</a></p>
    <div class="admin-head with-actions">
      <div><p class="kicker">TRABALHO CONCLUÍDO · ${esc(l.concluida)}</p><h2 class="lista-titulo">${esc(l.nome)}</h2></div>
      <div class="head-acoes">
        <button type="button" class="btn btn-small btn-line" id="editar">EDITAR CONCLUSÃO</button>
        <button type="button" class="btn btn-small btn-line" id="reabrir">REABRIR LISTA</button>
        <button type="button" class="btn btn-small btn-perigo-line" id="excluir">EXCLUIR</button>
      </div>
    </div>
    <dl class="resumo-trabalho">
      <dt>Evento</dt><dd>${esc(l.evento || '—')}</dd>
      <dt>Data</dt><dd>${esc(dataBR(l.data) || '—')}</dd>
      <dt>Contratante</dt><dd>${esc(l.contratante || '—')}</dd>
      <dt>Participaram</dt><dd>${foram.length} de ${vivos.length}</dd>
      <dt>Resultado</dt><dd>${l.resultado ? esc(l.resultado).replace(/\n/g, '<br>') : '<span class="muted">—</span>'}</dd>
    </dl>
    <h3 class="listas-sub">PARTICIPARAM (${foram.length})</h3>
    <ol class="lista-pessoas concl">${foram.map(linha).join('') || '<p class="muted">Ninguém marcado.</p>'}</ol>
    ${naoForam.length ? `<h3 class="listas-sub">ESTAVAM NA LISTA, MAS NÃO PARTICIPARAM (${naoForam.length})</h3><ol class="lista-pessoas concl">${naoForam.map(linha).join('')}</ol>` : ''}`;
  root.querySelector('#editar').addEventListener('click', () => concluirLista(l));
  root.querySelector('#excluir').addEventListener('click', () => excluirLista(l));
  root.querySelector('#reabrir').addEventListener('click', async () => {
    if (!confirm('Reabrir a lista? Ela sai do relatório e volta para LISTAS (com o link desligado).')) return;
    try { await postListas({ acao: 'reabrir', id: l.id }); toast('Lista reaberta'); route(); }
    catch (e) { if (e.message !== 'login') toast(e.message, true); }
  });
  root.querySelectorAll('[data-perfil]').forEach((b) => b.addEventListener('click', () => openProfile(itemPorPasta(b.dataset.perfil)._linha)));
  root.querySelectorAll('.pcard-img[data-pasta]').forEach((el) => io.observe(el));
}

/* ---------- RELATÓRIO ---------- */
function renderRelatorio() {
  root.className = 'section admin-main';
  const feitos = listas.filter((l) => l.status === CONCLUIDA)
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.concluida || '').localeCompare(a.concluida || ''));
  const nomeDe = (p) => (!p.excluido && itemPorPasta(p.p)?.nome_artistico) || p.nome || 'Perfil';

  // por perfil: quantos trabalhos cada pessoa fez
  const pessoas = new Map();
  for (const l of feitos) for (const p of l.pessoas.filter((x) => x.ok)) {
    const k = p.p;
    if (!pessoas.has(k)) pessoas.set(k, { nome: nomeDe(p), excluido: p.excluido, trabalhos: [] });
    pessoas.get(k).trabalhos.push(l);
  }
  const ranking = [...pessoas.entries()].sort((a, b) => b[1].trabalhos.length - a[1].trabalhos.length || a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
  const contratantes = new Set(feitos.map((l) => l.contratante).filter(Boolean));

  root.innerHTML = `
    <div class="admin-head with-actions">
      <div><p class="kicker">HISTÓRICO DE TRABALHOS</p><h2>RELATÓRIO</h2></div>
      ${feitos.length ? '<button type="button" class="btn btn-small btn-line" id="csv">BAIXAR PLANILHA (CSV)</button>' : ''}
    </div>
    <div class="rel-numeros">
      <div><strong>${feitos.length}</strong><span>${feitos.length === 1 ? 'trabalho concluído' : 'trabalhos concluídos'}</span></div>
      <div><strong>${pessoas.size}</strong><span>${pessoas.size === 1 ? 'pessoa participou' : 'pessoas participaram'}</span></div>
      <div><strong>${contratantes.size}</strong><span>${contratantes.size === 1 ? 'contratante' : 'contratantes'}</span></div>
    </div>
    ${feitos.length ? `
    <input type="text" id="busca-rel" placeholder="Buscar evento, contratante ou pessoa…">
    <h3 class="listas-sub">TRABALHOS</h3>
    <div class="rel-tabela-wrap"><table class="rel-tabela">
      <thead><tr><th>Data</th><th>Evento / lista</th><th>Contratante</th><th>Quem participou</th><th>Resultado</th></tr></thead>
      <tbody>${feitos.map((l) => {
        const foram = l.pessoas.filter((p) => p.ok);
        return `<tr data-busca="${esc([l.nome, l.evento, l.contratante, l.resultado, ...foram.map(nomeDe)].join(' ').toLowerCase())}">
          <td class="nowrap">${esc(dataBR(l.data) || '—')}</td>
          <td><a href="#lista/${esc(l.id)}"><strong>${esc(l.evento || l.nome)}</strong></a>${l.evento && l.evento !== l.nome ? `<br><span class="muted">${esc(l.nome)}</span>` : ''}</td>
          <td>${esc(l.contratante || '—')}</td>
          <td><span class="tags">${foram.map((p) => `<em>${esc(nomeDe(p))}</em>`).join('') || '<span class="muted">—</span>'}</span></td>
          <td class="rel-resultado">${esc(l.resultado || '')}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    <h3 class="listas-sub">POR PERFIL</h3>
    <div class="rel-tabela-wrap"><table class="rel-tabela">
      <thead><tr><th>Perfil</th><th>Trabalhos</th><th>Onde</th></tr></thead>
      <tbody>${ranking.map(([pasta, x]) => `<tr data-busca="${esc([x.nome, ...x.trabalhos.map((l) => `${l.evento} ${l.nome} ${l.contratante}`)].join(' ').toLowerCase())}">
        <td>${!x.excluido && itemPorPasta(pasta) ? `<button type="button" class="lp-nome" data-perfil="${esc(pasta)}">${esc(x.nome)}</button>` : `${esc(x.nome)}${x.excluido ? ' <span class="muted">(excluído)</span>' : ''}`}</td>
        <td class="num">${x.trabalhos.length}</td>
        <td>${x.trabalhos.map((l) => `<a href="#lista/${esc(l.id)}">${esc(l.evento || l.nome)}</a>${l.data ? ` <span class="muted">${esc(dataBR(l.data))}</span>` : ''}`).join(' · ')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`
    : '<p class="muted listas-ajuda">Nenhum trabalho concluído ainda. Abra uma lista em <a href="#listas">LISTAS</a> e clique em <b>✓ CONCLUIR TRABALHO</b> depois do evento.</p>'}`;

  root.querySelector('#busca-rel')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    root.querySelectorAll('tr[data-busca]').forEach((tr) => { tr.hidden = !!q && !tr.dataset.busca.includes(q); });
  });
  root.querySelectorAll('[data-perfil]').forEach((b) => b.addEventListener('click', () => openProfile(itemPorPasta(b.dataset.perfil)._linha)));
  root.querySelector('#csv')?.addEventListener('click', () => {
    const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = [['Data do evento', 'Evento', 'Lista', 'Contratante', 'Perfil', 'Participou', 'Nota', 'Resultado', 'Concluída em']];
    for (const l of feitos) for (const p of l.pessoas) {
      linhas.push([dataBR(l.data), l.evento, l.nome, l.contratante, nomeDe(p), p.ok ? 'Sim' : 'Não', p.nota, l.resultado, l.concluida]);
    }
    const blob = new Blob(['\ufeff' + linhas.map((r) => r.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-castings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

/* ---------- excluir perfil ---------- */
async function excluirPerfil(i) {
  const nome = i.nome_artistico || i.nome_completo || 'este perfil';
  const ls = listasDe(i._pastaId).filter((l) => l.status !== CONCLUIDA);
  if (!confirm(`Excluir o perfil de ${nome}?\n\n• Some do painel${ls.length ? ` e de ${ls.length} ${ls.length === 1 ? 'lista' : 'listas'} em andamento` : ''}.\n• Os dados vão para a aba “Perfis excluídos” da planilha.\n• Fotos e vídeos vão para a lixeira do Drive (30 dias para recuperar).`)) return;
  const btn = panel.querySelector('#excluir-perfil');
  if (btn) { btn.disabled = true; btn.textContent = 'EXCLUINDO…'; }
  try {
    const r = await fetch('/api/admin/excluir-perfil', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pasta: i._pastaId }),
    });
    if (r.status === 401) return logout();
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || 'Erro ao excluir.');
    closeDrawer();
    selecao.delete(i._pastaId);
    // as linhas da planilha mudaram de posição: recarrega inscrições e listas
    const [ins, ls2] = await Promise.all([api('/api/admin/inscricoes'), api('/api/admin/listas')]);
    state = { ...state, ...ins, items: ins.inscricoes || [] };
    listas = ls2.listas || [];
    rascunhoLista = null;
    render();
    toast(`Perfil de ${nome} excluído`);
    if (d.aviso) setTimeout(() => toast(d.aviso, true), 2700);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'EXCLUIR PERFIL'; }
    if (e.message !== 'login') toast(e.message, true);
  }
}

// avisa antes de sair da página com uma lista não salva
window.addEventListener('beforeunload', (e) => {
  const orig = rascunhoLista && listas.find((l) => l.id === rascunhoLista.id);
  if (orig && location.hash.startsWith('#lista/') && JSON.stringify(rascunhoLista) !== JSON.stringify(orig)) e.preventDefault();
});

token ? load() : loginView();

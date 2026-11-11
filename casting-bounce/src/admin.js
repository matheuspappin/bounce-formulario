// Painel de visualização das inscrições (lê a planilha e as pastas do Drive pela API /api/admin).
import config from '../casting.config.js';
import { calcular, textoLinha, brl, MODOS, TEXTOS_PADRAO, ROTULOS_TEXTOS, tamanhoSecao, MAX_FOTOS_SECAO } from '../shared/proposta.js';
import { STATUS_CONTRATO as SC, CAMPOS_AJUDA, textoParaHtml } from '../shared/contrato.js';
import { criarPad } from '../shared/assinatura.js';
import { configurarTour, iniciarTour, tourAuto, fechar as fecharTour } from './tour.js';
import { renderManual } from './manual.js';

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
function logout() { token = ''; store.set(''); fecharTour(); closeDrawer(); loginView(); }

/* ---------------- LISTA ---------------- */
async function load() {
  root.className = 'section admin-main';
  root.innerHTML = '<p class="muted">Carregando inscrições…</p>';
  try {
    const [d, l, pr, ct] = await Promise.all([
      api('/api/admin/inscricoes'),
      api('/api/admin/listas').catch((e) => { if (e.message === 'login') throw e; listasErro = e.message; return { listas: [] }; }),
      api('/api/admin/propostas').catch((e) => { if (e.message === 'login') throw e; propostasErro = e.message; return {}; }),
      api('/api/admin/contratos').catch((e) => { if (e.message === 'login') throw e; propostasErro = propostasErro || e.message; return {}; }),
    ]);
    state = { ...d, items: d.inscricoes || [] };
    listas = l.listas || [];
    propostas = pr.propostas || [];
    modelos = pr.modelos || [];
    camposElenco = pr.camposElenco || camposElenco;
    contratos = ct.contratos || [];
    modelosContrato = ct.modelos || [];
  } catch (e) { if (e.message !== 'login') root.innerHTML = `<p class="form-msg">${esc(e.message)}</p>`; return; }

  nav.innerHTML = `
    <a href="#inscricoes" data-nav="inscricoes">INSCRIÇÕES</a>
    <a href="#listas" data-nav="listas">LISTAS</a>
    <a href="#propostas" data-nav="propostas">PROPOSTAS</a>
    <a href="#relatorio" data-nav="relatorio">RELATÓRIO</a>
    ${state.planilha ? `<a href="${state.planilha}" target="_blank" rel="noopener">PLANILHA ↗</a>` : ''}
    ${state.pastaRaiz ? `<a href="${state.pastaRaiz}" target="_blank" rel="noopener">DRIVE ↗</a>` : ''}
    <a href="#manual" data-nav="manual">MANUAL</a>
    <a href="#" id="tour-btn" title="Tour guiado pelo painel">? TOUR</a>
    <a href="#" id="sair">SAIR</a>`;
  nav.querySelector('#sair').onclick = (e) => { e.preventDefault(); logout(); };
  nav.querySelector('#tour-btn').onclick = (e) => { e.preventDefault(); iniciarTour(); };
  configurarTour({ etapas: state.crm.etapas });
  route();
  tourAuto();
}

/* navegação: #inscricoes (padrão) · #listas · #lista/<id> */
function route() {
  const h = location.hash;
  const concluida = h.startsWith('#lista/') && listas.find((l) => l.id === decodeURIComponent(h.slice(7)))?.status === CONCLUIDA;
  const aba = h === '#manual' ? 'manual' : h === '#relatorio' || concluida ? 'relatorio' : h.startsWith('#lista') ? 'listas'
    : /^#(propostas|proposta\/|modelo\/|contrato-modelo\/)/.test(h) ? 'propostas' : 'inscricoes';
  nav.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === aba));
  closeDrawer();
  window.scrollTo(0, 0);
  document.querySelector('.sel-bar')?.remove();
  document.body.classList.remove('selecionando');
  if (h.startsWith('#lista/')) return renderListaDetalhe(decodeURIComponent(h.slice(7)));
  if (h === '#listas') return renderListas();
  if (h === '#relatorio') return renderRelatorio();
  if (h === '#manual') return renderManual(root, state.crm);
  if (h === '#propostas') return renderPropostas();
  if (h.startsWith('#proposta/')) return renderEditorProposta('proposta', decodeURIComponent(h.slice(10)));
  if (h.startsWith('#modelo/')) return renderEditorProposta('modelo', decodeURIComponent(h.slice(8)));
  if (h.startsWith('#contrato-modelo/')) return renderModeloContrato(decodeURIComponent(h.slice(17)));
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
        <button type="button" class="btn btn-small btn-line" id="proposta-lista">PROPOSTA${propostasDaLista(id).length ? ` (${propostasDaLista(id).length})` : ''}</button>
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
  root.querySelector('#proposta-lista').addEventListener('click', () => escolherProposta(id));
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

/* ============================================================
   PROPOSTAS PARA CONTRATANTES
   ============================================================ */
let propostas = [];
let modelos = [];
let propostasErro = '';
let camposElenco = { idade: 'Idade', altura: 'Altura', tamanho_blusa: 'Blusa', tamanho_calca: 'Calça' };
let rascunhoProp = null; // cópia em edição: { tipo, id, nome?, listaId?, status?, versao?, conteudo }
const STATUS_PROP = ['Rascunho', 'Enviada', 'Aprovada', 'Recusada'];
const linkProposta = (p) => `${location.origin}${/^(localhost|127\.)/.test(location.hostname) ? '/proposta.html' : '/proposta'}?c=${p.id}.${p.chave}`;
const propostasDaLista = (listaId) => propostas.filter((p) => p.listaId === listaId);
const nDaLista = (listaId) => (listas.find((l) => l.id === listaId)?.pessoas || []).filter((p) => !p.excluido).length;
const classeStatus = (s) => ({ Rascunho: '', Enviada: 'warn', Aprovada: 'ok', Recusada: 'no' }[s] || '');
const totalTexto = (c, listaId) => { const r = calcular(c, nDaLista(listaId)); return `${brl(r.total)}${r.aCombinar ? ' + a combinar' : ''}`; };

function origemRascunho() {
  if (!rascunhoProp) return null;
  if (rascunhoProp.tipo === 'modelo') {
    const m = modelos.find((x) => x.id === rascunhoProp.id);
    return m && { tipo: 'modelo', id: m.id, nome: m.nome, conteudo: m.conteudo };
  }
  const p = propostas.find((x) => x.id === rascunhoProp.id);
  return p && { tipo: 'proposta', id: p.id, listaId: p.listaId, status: p.status, versao: p.versao, conteudo: p.conteudo };
}
function propostaSuja() {
  const o = origemRascunho();
  return !!(o && /^#(proposta|modelo)\//.test(location.hash) && JSON.stringify(normalizar(rascunhoProp)) !== JSON.stringify(normalizar(o)));
}
// linhas em branco digitadas nos campos "um por linha" não contam como mudança
function normalizar(r) {
  const c = structuredClone(r);
  const limpa = (a) => (a || []).map((x) => String(x).trim()).filter(Boolean);
  c.conteudo.secoes = (c.conteudo.secoes || []).map((s) => ({ ...s, itens: limpa(s.itens) }));
  c.conteudo.condicoesBailarinas = limpa(c.conteudo.condicoesBailarinas);
  return c;
}

async function postPropostas(body) {
  const r = await fetch('/api/admin/propostas', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  if (r.status === 401) { logout(); throw new Error('login'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || 'Erro ao salvar.'), { status: r.status });
  if (d.proposta) {
    const i = propostas.findIndex((p) => p.id === d.proposta.id);
    if (d.proposta.status === 'Excluída') { if (i >= 0) propostas.splice(i, 1); }
    else if (i >= 0) propostas[i] = d.proposta; else propostas.unshift(d.proposta);
  }
  if (d.modelo) {
    const i = modelos.findIndex((m) => m.id === d.modelo.id);
    if (d.modelo.status === 'Excluído') { if (i >= 0) modelos.splice(i, 1); }
    else if (i >= 0) modelos[i] = d.modelo; else modelos.push(d.modelo);
  }
  return d;
}

/* ---------- criar proposta (escolher modelo e lista) ---------- */
function novaProposta({ listaId = '' } = {}) {
  if (!modelos.length) return toast(propostasErro || 'Nenhum modelo de proposta carregado.', true);
  const abertas = listas.filter((l) => l.status !== CONCLUIDA || l.id === listaId);
  const m = modal(`
    <p class="kicker">NOVA PROPOSTA</p>
    <h3>ESCOLHA O MODELO</h3>
    <form class="modal-form" id="f">
      <div class="modal-listas">${modelos.map((x, i) => `
        <label class="opcao"><input type="radio" name="modeloId" value="${esc(x.id)}" ${i === 0 ? 'checked' : ''}>
          <span><strong>${esc(x.nome)}</strong><span class="muted">${x.conteudo.secoes.length} seções · ${esc(totalTexto(x.conteudo, ''))} sem elenco</span></span></label>`).join('')}</div>
      <label>Elenco (lista ligada à proposta)
        <select name="listaId">
          <option value="">Sem lista — informo a quantidade de bailarinas</option>
          ${abertas.map((l) => `<option value="${esc(l.id)}" ${l.id === listaId ? 'selected' : ''}>${esc(l.nome)} · ${nDaLista(l.id)} perfis</option>`).join('')}
        </select></label>
      <p class="muted" style="margin:0;font-size:13px">Contratante, evento e data vêm da lista. Depois você ajusta tudo só nesta proposta, sem mudar o modelo.</p>
      <button class="btn btn-small" type="submit">CRIAR PROPOSTA →</button>
    </form>`);
  m.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const d = await postPropostas({ acao: 'criar', ...Object.fromEntries(new FormData(e.target)) });
      fecharModal(); toast('Proposta criada'); location.hash = `#proposta/${d.proposta.id}`;
    } catch (err) { btn.disabled = false; if (err.message !== 'login') toast(err.message, true); }
  });
}

/** Botão "PROPOSTA" na página de uma lista. */
function escolherProposta(listaId) {
  const ps = propostasDaLista(listaId);
  if (!ps.length) return novaProposta({ listaId });
  const m = modal(`
    <p class="kicker">PROPOSTAS DESTA LISTA</p>
    <h3>PROPOSTAS</h3>
    <div class="modal-listas">${ps.map((p) => `
      <button type="button" data-id="${esc(p.id)}"><strong>${esc(p.titulo)}${p.contratante ? ` · ${esc(p.contratante)}` : ''}</strong>
        <span class="muted">${esc(p.status)} · ${esc(totalTexto(p.conteudo, p.listaId))}</span></button>`).join('')}</div>
    <p class="modal-ou">ou</p>
    <button type="button" class="btn btn-small" id="nova">+ NOVA PROPOSTA PARA ESTA LISTA</button>`);
  m.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => { fecharModal(); location.hash = `#proposta/${b.dataset.id}`; }));
  m.querySelector('#nova').addEventListener('click', () => novaProposta({ listaId }));
}

/* ---------- página PROPOSTAS ---------- */
function renderPropostas() {
  root.className = 'section admin-main';
  const card = (p) => {
    const l = listas.find((x) => x.id === p.listaId);
    return `
    <a class="lcard pcard-prop ${p.status === 'Recusada' ? 'off' : ''}" href="#proposta/${esc(p.id)}">
      <div class="lcard-body">
        <span class="badges"><b class="${classeStatus(p.status)}">${esc(p.status.toUpperCase())}</b>${contratoDa(p.id) ? ` <b class="${classeContrato(contratoDa(p.id).status)}">CONTRATO: ${esc(contratoDa(p.id).status.toUpperCase())}</b>` : ''}</span>
        <strong>${esc(p.titulo)}</strong>
        <span class="muted">${p.contratante ? `Para ${esc(p.contratante)}` : 'Sem contratante'}</span>
        <span class="muted">${l ? `Elenco: ${esc(l.nome)} (${nDaLista(l.id)})` : `${esc(p.conteudo.elenco.qtd || '0')} bailarinas (sem lista)`}</span>
        <span class="prop-total">${esc(totalTexto(p.conteudo, p.listaId))}</span>
        <span class="muted prop-data">Atualizada em ${esc(p.atualizada)}</span>
      </div>
    </a>`;
  };
  const grupos = STATUS_PROP.map((s) => [s, propostas.filter((p) => p.status === s)]).filter(([, ps]) => ps.length);
  root.innerHTML = `
    <div class="admin-head with-actions">
      <div><p class="kicker">ORÇAMENTOS PARA CONTRATANTES</p>
        <h2>${propostas.length} ${propostas.length === 1 ? 'PROPOSTA' : 'PROPOSTAS'}</h2></div>
      <button type="button" class="btn btn-small" id="nova">+ NOVA PROPOSTA</button>
    </div>
    ${propostasErro ? `<p class="form-msg">${esc(propostasErro)}</p>` : ''}
    <p class="muted listas-ajuda">Cada proposta nasce de um <b>modelo</b> e pode ser ligada a uma <a href="#listas">LISTA</a> de elenco: as fotos e medidas
      do elenco entram na proposta e o valor das bailarinas é multiplicado pela quantidade de perfis. O contratante recebe um link
      (com botão para salvar em PDF). Para mandar a mesma proposta a outro contratante, use <b>DUPLICAR</b>.</p>
    ${grupos.length ? grupos.map(([s, ps]) => `<h3 class="listas-sub">${s.toUpperCase()} (${ps.length})</h3><div class="listas-grid">${ps.map(card).join('')}</div>`).join('')
      : '<p class="muted">Nenhuma proposta ainda. Crie uma aqui ou pelo botão <b>PROPOSTA</b> dentro de uma lista.</p>'}

    <div class="lista-pessoas-head modelos-head">
      <h3 class="listas-sub">MODELOS</h3>
      <button type="button" class="btn btn-small btn-line" id="novo-modelo">+ NOVO MODELO</button>
    </div>
    <p class="muted listas-ajuda">O modelo é o texto e os valores padrão. Mudar um modelo não altera propostas já criadas.</p>
    <div class="modelos-lista">${modelos.map((m) => `
      <a class="modelo-item" href="#modelo/${esc(m.id)}"><strong>${esc(m.nome)}</strong>
        <span class="muted">${m.conteudo.secoes.map((s) => esc(s.titulo)).join(' · ')}</span>
        <span class="muted">Atualizado em ${esc(m.atualizado)}</span></a>`).join('')}</div>
    ${listaModelosContrato()}`;
  ligarListaModelosContrato();

  root.querySelector('#nova').addEventListener('click', () => novaProposta());
  root.querySelector('#novo-modelo').addEventListener('click', () => {
    const m = modal(`
      <h3>NOVO MODELO</h3>
      <form class="modal-form" id="f">
        <label>Nome do modelo *<input type="text" name="nome" required maxlength="120" placeholder="Ex.: Videoclipe · só casting e coreografia"></label>
        <label>Começar a partir de
          <select name="base">${modelos.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join('')}</select></label>
        <button class="btn btn-small" type="submit">CRIAR MODELO →</button>
      </form>`);
    m.querySelector('input').focus();
    m.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const base = modelos.find((x) => x.id === fd.get('base'));
      try {
        const d = await postPropostas({ acao: 'salvar-modelo', nome: fd.get('nome'), conteudo: base?.conteudo || {} });
        fecharModal(); location.hash = `#modelo/${d.modelo.id}`;
      } catch (err) { if (err.message !== 'login') toast(err.message, true); }
    });
  });
}

/** Reduz a foto no navegador (lado maior 1600px, JPEG) antes de enviar: sobe rápido e cabe no limite da Vercel. */
async function reduzirFoto(file, max = 1600) {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) throw new Error('não é uma imagem.');
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error('não consegui abrir esta imagem (se for HEIC do iPhone, exporte como JPG).'); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.82);
}

/* ---------- editor (proposta ou modelo) ---------- */
const LINHA_VAZIA = () => ({ descricao: '', qtd: '', unidade: '', valor: '', modo: 'valor' });
const SECAO_VAZIA = () => ({ titulo: '', itens: [], nota: '', linkTexto: '', linkUrl: '', fotos: [] });
const getPath = (o, path) => path.split('.').reduce((x, k) => x?.[k], o);
function setPath(o, path, v) {
  const ks = path.split('.'); const last = ks.pop();
  const alvo = ks.reduce((x, k) => x[k], o);
  alvo[last] = v;
}

function renderEditorProposta(tipo, id) {
  root.className = 'section admin-main';
  const fonte = tipo === 'modelo' ? modelos.find((x) => x.id === id) : propostas.find((x) => x.id === id);
  if (!fonte) { root.innerHTML = `<p class="muted">${tipo === 'modelo' ? 'Modelo' : 'Proposta'} não encontrado(a). <a href="#propostas">Voltar</a></p>`; return; }
  if (!rascunhoProp || rascunhoProp.tipo !== tipo || rascunhoProp.id !== id) {
    rascunhoProp = tipo === 'modelo'
      ? { tipo, id, nome: fonte.nome, conteudo: structuredClone(fonte.conteudo) }
      : { tipo, id, listaId: fonte.listaId, status: fonte.status, versao: fonte.versao, conteudo: structuredClone(fonte.conteudo) };
  }
  const r = rascunhoProp;
  const c = r.conteudo;
  const ehProposta = tipo === 'proposta';
  const nLista = ehProposta ? nDaLista(r.listaId) : 0;
  const listaLigada = ehProposta && listas.find((l) => l.id === r.listaId);
  const v = (path) => esc(getPath(c, path) ?? '');
  const campo = (label, path, attrs = '') => `<label>${label}<input type="text" data-k="${path}" value="${v(path)}" ${attrs}></label>`;

  const tabelaPrecos = (path, titulo, ajuda) => `
    <div class="precos" data-tabela="${path}">
      <p class="crm-label">${titulo} <span class="muted">${ajuda}</span></p>
      <div class="precos-head"><span>Descrição</span><span>Qtd.</span><span>Unidade</span><span>Valor (R$)</span><span>Tipo</span><span>Total</span><span></span></div>
      ${c[path].map((it, i) => `
        <div class="precos-linha">
          <input type="text" data-k="${path}.${i}.descricao" value="${v(`${path}.${i}.descricao`)}" placeholder="Ex.: Aluguel de sala" aria-label="Descrição">
          <input type="text" inputmode="decimal" data-k="${path}.${i}.qtd" value="${v(`${path}.${i}.qtd`)}" placeholder="1" aria-label="Quantidade">
          <input type="text" data-k="${path}.${i}.unidade" value="${v(`${path}.${i}.unidade`)}" placeholder="horas" aria-label="Unidade">
          <input type="text" inputmode="decimal" data-k="${path}.${i}.valor" value="${v(`${path}.${i}.valor`)}" placeholder="0,00" aria-label="Valor" ${it.modo !== 'valor' ? 'disabled' : ''}>
          <select data-k="${path}.${i}.modo" aria-label="Tipo">${Object.entries(MODOS).map(([k, l]) => `<option value="${k}" ${it.modo === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="precos-total" data-total="${path}.${i}">${esc(textoLinha(it))}</span>
          <span class="precos-acoes">
            <button type="button" data-mover="${path}.${i}|-1" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
            <button type="button" data-mover="${path}.${i}|1" ${i === c[path].length - 1 ? 'disabled' : ''} title="Descer">↓</button>
            <button type="button" data-tirar="${path}.${i}" title="Remover">✕</button>
          </span>
        </div>`).join('')}
      <button type="button" class="link-acao" data-add="${path}">+ adicionar item</button>
    </div>`;

  root.innerHTML = `
    <p class="voltar"><a href="#propostas">← PROPOSTAS</a></p>
    <div class="admin-head with-actions">
      <div><p class="kicker">${ehProposta ? `PROPOSTA · ${esc(r.status.toUpperCase())}` : 'MODELO DE PROPOSTA'}</p>
        <h2 class="lista-titulo" id="titulo-ed">${esc(ehProposta ? c.projeto || c.evento || c.titulo || 'Proposta' : r.nome)}</h2></div>
      <div class="head-acoes">
        ${ehProposta
          ? `<button type="button" class="btn btn-small btn-line" id="duplicar">DUPLICAR P/ OUTRO CONTRATANTE</button>
             <button type="button" class="btn btn-small btn-perigo-line" id="excluir">EXCLUIR</button>`
          : `<button type="button" class="btn btn-small btn-line" id="usar">USAR ESTE MODELO →</button>
             <button type="button" class="btn btn-small btn-perigo-line" id="excluir">EXCLUIR MODELO</button>`}
      </div>
    </div>

    ${ehProposta ? (() => {
      const link = linkProposta(fonte);
      const msg = `Olá${c.contratante ? `, ${c.contratante}` : ''}! Segue a proposta da Bounce Basement${c.evento ? ` para ${c.evento}` : ''}: ${link}`;
      return `
    <div class="lista-cols">
      <section class="crm-box envio">
        <p class="crm-label">LINK DA PROPOSTA</p>
        <div class="link-box"><input type="text" readonly value="${esc(link)}" id="link"><button type="button" class="btn btn-small" id="copiar">COPIAR</button></div>
        <div class="envio-acoes">
          <a class="btn btn-small btn-zap" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">ENVIAR NO WHATSAPP →</a>
          <a class="btn btn-small btn-line" href="mailto:?subject=${encodeURIComponent(`Proposta Bounce Basement · ${fonte.titulo}`)}&body=${encodeURIComponent(msg)}">E-MAIL</a>
          <a class="btn btn-small btn-line" target="_blank" rel="noopener" href="${esc(link)}">VER / SALVAR PDF ↗</a>
        </div>
        <p class="muted ajuda">O link mostra a última versão salva. Na página, o botão <b>SALVAR EM PDF</b> gera o arquivo para anexar.</p>
        <div class="envio-acoes">
          <label class="status-sel">Status
            <select data-raiz="status">${STATUS_PROP.map((s) => `<option ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <button type="button" class="link-acao" id="novo-link">Gerar novo link (o antigo para de funcionar)</button>
        </div>
      </section>
      <div class="crm-box modal-form">
        <p class="crm-label">PARA QUEM</p>
        ${campo('Contratante', 'contratante', 'maxlength="160" placeholder="Empresa ou pessoa"')}
        <div class="row2">
          ${campo('Nome do projeto (capa)', 'projeto', 'maxlength="120" placeholder="Ex.: Show 12/12"')}
          ${campo('Evento', 'evento', 'maxlength="200"')}
        </div>
        <div class="row2">
          <label>Data<input type="date" data-k="data" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(c.data) ? c.data : '')}"></label>
          ${campo('Local', 'local', 'maxlength="200" placeholder="Cidade, casa de show…"')}
        </div>
        <label>Elenco (lista ligada)
          <select data-raiz="listaId">
            <option value="">Sem lista</option>
            ${listas.map((l) => `<option value="${esc(l.id)}" ${l.id === r.listaId ? 'selected' : ''}>${esc(l.nome)} · ${nDaLista(l.id)} perfis</option>`).join('')}
          </select></label>
      </div>
    </div>`;
    })() : `
    <div class="crm-box modal-form">
      <label>Nome do modelo<input type="text" data-raiz="nome" value="${esc(r.nome)}" maxlength="120"></label>
      <p class="muted" style="margin:0;font-size:13px">Contratante, evento, data e elenco são preenchidos em cada proposta.</p>
    </div>`}

    ${ehProposta ? boxContrato(fonte) : ''}

    <section class="crm-box modal-form ed-bloco">
      <p class="crm-label">CAPA E APRESENTAÇÃO</p>
      ${campo('Título no topo da capa', 'titulo', 'maxlength="160"')}
      <label>Texto de apresentação <span class="muted">(opcional — aparece em “informações gerais”)</span>
        <textarea data-k="apresentacao" rows="3" placeholder="Ex.: Performance com 6 bailarinas no show de 12/12…">${v('apresentacao')}</textarea></label>
    </section>

    <h3 class="listas-sub">O QUE ESTÁ INCLUÍDO</h3>
    <p class="muted listas-ajuda">Cada seção vira uma página da proposta (//01, //02…). Os itens recebem a), b), c) automaticamente.</p>
    <div class="secoes-ed">
      ${c.secoes.map((s, i) => `
        <section class="crm-box modal-form secao-ed">
          <div class="secao-ed-head">
            <span class="pos">${String(i + 1).padStart(2, '0')}</span>
            <input type="text" data-k="secoes.${i}.titulo" value="${v(`secoes.${i}.titulo`)}" placeholder="Título da seção (ex.: Casting)" aria-label="Título da seção">
            <span class="precos-acoes">
              <button type="button" data-mover="secoes.${i}|-1" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
              <button type="button" data-mover="secoes.${i}|1" ${i === c.secoes.length - 1 ? 'disabled' : ''} title="Descer">↓</button>
              <button type="button" data-tirar="secoes.${i}" title="Remover seção">✕</button>
            </span>
          </div>
          <label>Itens <span class="muted">(um por linha)</span>
            <textarea data-lines="secoes.${i}.itens" rows="${Math.max(3, s.itens.length + 1)}">${esc(s.itens.join('\n'))}</textarea></label>
          ${campo('Observação <span class="muted">(opcional, aparece em cinza)</span>', `secoes.${i}.nota`, 'maxlength="800" placeholder="Ex.: compra e aluguel de peças: a cargo do contratante"')}
          <div class="row2">
            ${campo('Texto do botão <span class="muted">(opcional)</span>', `secoes.${i}.linkTexto`, 'maxlength="80" placeholder="Ver fotos da sala"')}
            ${campo('Link do botão', `secoes.${i}.linkUrl`, 'maxlength="800" placeholder="https://…"')}
          </div>
          <div class="fotos-ed">
            <p class="crm-label">FOTOS <span class="muted">(opcional — aparecem ao lado dos itens, ex.: fotos do estúdio · até ${MAX_FOTOS_SECAO})</span></p>
            <div class="fotos-ed-grid">
              ${(s.fotos || []).map((f, j) => `
                <figure><img src="${thumb(f, 400)}" alt="">
                  <span class="precos-acoes">
                    <button type="button" data-foto-mover="${i}.${j}|-1" ${j === 0 ? 'disabled' : ''} title="Para a esquerda">←</button>
                    <button type="button" data-foto-mover="${i}.${j}|1" ${j === s.fotos.length - 1 ? 'disabled' : ''} title="Para a direita">→</button>
                    <button type="button" data-foto-tirar="${i}.${j}" title="Tirar foto">✕</button>
                  </span></figure>`).join('')}
              ${(s.fotos || []).length < MAX_FOTOS_SECAO ? `<label class="foto-add" title="Adicionar fotos">+ FOTOS<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden data-foto-add="${i}"></label>` : ''}
            </div>
          </div>
          <p class="aviso-colchete" data-aviso="${i}" hidden></p>
        </section>`).join('')}
    </div>
    <button type="button" class="btn btn-small btn-line" data-add="secoes">+ ADICIONAR SEÇÃO</button>

    <h3 class="listas-sub">ELENCO E VALORES</h3>
    <section class="crm-box modal-form ed-bloco">
      <div class="row2">
        <label class="check-linha"><input type="checkbox" data-k="elenco.mostrar" ${c.elenco.mostrar ? 'checked' : ''}>
          <span>Mostrar fotos e medidas do elenco na proposta</span></label>
        <label>Quantidade de bailarinas
          <input type="text" inputmode="numeric" data-k="elenco.qtd" value="${v('elenco.qtd')}"
            placeholder="${ehProposta ? (listaLigada ? `automático: ${nLista} da lista` : 'ex.: 6') : 'automático pela lista'}"></label>
      </div>
      <div class="campos-elenco">
        <p class="crm-label">DADOS DE CADA BAILARINA NA PROPOSTA <span class="muted">(contato, CPF e endereço nunca aparecem)</span></p>
        <div class="campos-elenco-op">${Object.entries(camposElenco).map(([k, l]) => `
          <label class="check-linha"><input type="checkbox" data-campo-elenco="${esc(k)}" ${c.elenco.campos.includes(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
      </div>
      ${tabelaPrecos('cacheBailarina', 'CACHÊ POR BAILARINA', '— multiplicado pela quantidade de bailarinas')}
      <label>Condições para as bailarinas <span class="muted">(uma por linha)</span>
        <textarea data-lines="condicoesBailarinas" rows="3">${esc(c.condicoesBailarinas.join('\n'))}</textarea></label>
      ${tabelaPrecos('bounce', 'BOUNCE BASEMENT', '— serviços da produtora')}
      <div class="resumo-prop" id="resumo"></div>
    </section>

    <section class="crm-box modal-form ed-bloco">
      <p class="crm-label">FECHAMENTO</p>
      <label>Observações <span class="muted">(opcional)</span>
        <textarea data-k="observacoes" rows="3" placeholder="Ex.: forma de pagamento, prazos, nota fiscal…">${v('observacoes')}</textarea></label>
      ${campo('Validade da proposta', 'validade', 'maxlength="80" placeholder="15 dias"')}
      <label class="check-linha"><input type="checkbox" data-k="mostrarContato" ${c.mostrarContato ? 'checked' : ''}>
        <span>Mostrar os contatos da Bounce na última página</span></label>
    </section>

    <section class="crm-box modal-form ed-bloco">
      <p class="crm-label">TEXTOS FIXOS DA APRESENTAÇÃO <span class="muted">— deixe em branco para esconder · {contratante} vira o nome do contratante</span></p>
      <label class="check-linha"><input type="checkbox" data-k="minusculas" ${c.minusculas ? 'checked' : ''}>
        <span>Nome do projeto e títulos das seções em letras minúsculas (estilo da apresentação)</span></label>
      <div class="textos-ed">${Object.keys(TEXTOS_PADRAO).map((k) => campo(esc(ROTULOS_TEXTOS[k] || k), `textos.${k}`, `maxlength="120" placeholder="${esc(TEXTOS_PADRAO[k])}"`)).join('')}</div>
      <button type="button" class="link-acao" id="textos-padrao">Voltar aos textos padrão</button>
    </section>

    <div class="salvar-bar">
      <span>Alterações não salvas</span>
      <button type="button" class="link-acao" id="descartar">Descartar</button>
      <button type="button" class="btn btn-small" id="salvar-prop">${ehProposta ? 'SALVAR PROPOSTA' : 'SALVAR MODELO'}</button>
    </div>`;

  const resumo = () => {
    const t = calcular(c, nLista);
    root.querySelector('#resumo').innerHTML = `
      <div><span>Por bailarina</span><strong>${brl(t.porBailarina)}</strong></div>
      <div><span>Elenco (${t.n || '—'} ${t.n === 1 ? 'bailarina' : 'bailarinas'})</span><strong>${t.n ? brl(t.totalElenco) : '—'}</strong></div>
      <div><span>Bounce Basement</span><strong>${brl(t.totalBounce)}</strong></div>
      <div class="tot"><span>TOTAL</span><strong>${brl(t.total)}</strong>${t.aCombinar ? '<em>+ itens a combinar</em>' : ''}</div>
      ${!ehProposta ? '<p class="muted">No modelo o elenco fica em branco: o total de verdade aparece em cada proposta.</p>' : ''}`;
    root.querySelectorAll('[data-total]').forEach((el) => { el.textContent = textoLinha(getPath(c, el.dataset.total)); });
    avisos();
  };
  function avisos() {
    root.querySelectorAll('[data-aviso]').forEach((el) => {
      const s = c.secoes[Number(el.dataset.aviso)];
      const t = s ? tamanhoSecao(s) : 0;
      el.hidden = t <= 1;
      el.textContent = t > 1 ? `⚠ Esta seção tem mais texto do que cabe em um slide. Nada é cortado: no link a página fica mais alta e, no PDF, a letra desta página diminui para caber. Se ficar pequena demais, divida em duas seções.` : '';
    });
  }
  const sujo = () => root.querySelector('.salvar-bar').classList.toggle('show', propostaSuja());
  resumo(); sujo();

  // campos do conteúdo
  root.querySelectorAll('[data-k]').forEach((el) => {
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      setPath(c, el.dataset.k, el.type === 'checkbox' ? el.checked : el.value);
      if (el.dataset.k.endsWith('.modo')) return renderEditorProposta(tipo, id);
      if (ehProposta && /^(projeto|evento)$/.test(el.dataset.k)) root.querySelector('#titulo-ed').textContent = c.projeto || c.evento || c.titulo || 'Proposta';
      resumo(); sujo();
    });
  });
  root.querySelectorAll('[data-lines]').forEach((el) => el.addEventListener('input', () => { setPath(c, el.dataset.lines, el.value.split('\n')); avisos(); sujo(); }));
  // dados das bailarinas que aparecem
  root.querySelectorAll('[data-campo-elenco]').forEach((el) => el.addEventListener('change', () => {
    const ordem = Object.keys(camposElenco);
    const set = new Set(c.elenco.campos); el.checked ? set.add(el.dataset.campoElenco) : set.delete(el.dataset.campoElenco);
    c.elenco.campos = ordem.filter((k) => set.has(k)); sujo();
  }));
  root.querySelector('#textos-padrao').addEventListener('click', () => { c.textos = { ...TEXTOS_PADRAO }; c.minusculas = true; renderEditorProposta(tipo, id); });
  // fotos das seções
  root.querySelectorAll('[data-foto-add]').forEach((inp) => inp.addEventListener('change', async () => {
    const i = Number(inp.dataset.fotoAdd);
    const sec = c.secoes[i]; sec.fotos = sec.fotos || [];
    const arquivos = [...inp.files].slice(0, MAX_FOTOS_SECAO - sec.fotos.length);
    if (!arquivos.length) return;
    const lbl = inp.closest('.foto-add'); lbl.classList.add('enviando'); lbl.firstChild.textContent = 'ENVIANDO…';
    let ok = 0;
    for (const f of arquivos) {
      try {
        const dados = await reduzirFoto(f);
        const d = await postPropostas({ acao: 'foto', dados, tipo: 'image/jpeg' });
        sec.fotos.push(d.id); ok++;
      } catch (err) { if (err.message === 'login') return; toast(`${f.name}: ${err.message}`, true); }
    }
    if (ok) toast(`${ok} ${ok === 1 ? 'foto adicionada' : 'fotos adicionadas'} — clique em SALVAR`);
    renderEditorProposta(tipo, id);
  }));
  root.querySelectorAll('[data-foto-mover]').forEach((b) => b.addEventListener('click', () => {
    const [pos, d] = b.dataset.fotoMover.split('|'); const [i, j] = pos.split('.').map(Number);
    const arr = c.secoes[i].fotos; const [x] = arr.splice(j, 1); arr.splice(j + Number(d), 0, x);
    renderEditorProposta(tipo, id);
  }));
  root.querySelectorAll('[data-foto-tirar]').forEach((b) => b.addEventListener('click', () => {
    const [i, j] = b.dataset.fotoTirar.split('.').map(Number);
    c.secoes[i].fotos.splice(j, 1); renderEditorProposta(tipo, id);
  }));
  root.querySelectorAll('[data-raiz]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
    r[el.dataset.raiz] = el.value;
    if (el.dataset.raiz === 'nome') root.querySelector('#titulo-ed').textContent = el.value || 'Modelo';
    if (el.dataset.raiz === 'listaId') return renderEditorProposta(tipo, id);
    sujo();
  }));
  // adicionar / mover / remover
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.add;
    c[k].push(k === 'secoes' ? SECAO_VAZIA() : LINHA_VAZIA());
    renderEditorProposta(tipo, id);
    const sel = k === 'secoes' ? `[data-k="secoes.${c.secoes.length - 1}.titulo"]` : `[data-k="${k}.${c[k].length - 1}.descricao"]`;
    root.querySelector(sel)?.focus();
  }));
  root.querySelectorAll('[data-mover]').forEach((b) => b.addEventListener('click', () => {
    const [path, d] = b.dataset.mover.split('|');
    const ks = path.split('.'); const n = Number(ks.pop()); const arr = getPath(c, ks.join('.'));
    const [x] = arr.splice(n, 1); arr.splice(n + Number(d), 0, x);
    renderEditorProposta(tipo, id);
  }));
  root.querySelectorAll('[data-tirar]').forEach((b) => b.addEventListener('click', () => {
    const ks = b.dataset.tirar.split('.'); const n = Number(ks.pop()); const arr = getPath(c, ks.join('.'));
    if (ks[0] === 'secoes' && (arr[n].titulo || arr[n].itens.join('').trim()) && !confirm(`Remover a seção “${arr[n].titulo || 'sem título'}”?`)) return;
    arr.splice(n, 1);
    renderEditorProposta(tipo, id);
  }));
  root.querySelectorAll('textarea').forEach((t) => {
    const ajusta = () => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; };
    ajusta(); t.addEventListener('input', ajusta);
  });

  // salvar / descartar
  root.querySelector('#descartar').addEventListener('click', () => { rascunhoProp = null; renderEditorProposta(tipo, id); });
  root.querySelector('#salvar-prop').addEventListener('click', async (e) => {
    const btn = e.target; btn.disabled = true;
    try {
      if (ehProposta) {
        await postPropostas({ acao: 'salvar', id, versao: r.versao, conteudo: c, listaId: r.listaId, status: r.status });
        toast('Proposta salva');
      } else {
        if (!r.nome.trim()) throw new Error('Dê um nome para o modelo.');
        await postPropostas({ acao: 'salvar-modelo', id, nome: r.nome, conteudo: c });
        toast('Modelo salvo');
      }
      rascunhoProp = null;
      renderEditorProposta(tipo, id);
    } catch (err) {
      btn.disabled = false;
      if (err.message === 'login') return;
      toast(err.message, true);
      if (err.status === 409) {
        const d = await api('/api/admin/propostas'); propostas = d.propostas || []; modelos = d.modelos || [];
        rascunhoProp = null; renderEditorProposta(tipo, id);
      }
    }
  });

  const exigeSalvo = () => { if (propostaSuja()) { toast('Salve ou descarte as alterações antes.', true); return false; } return true; };
  if (ehProposta) ligarContrato(fonte, exigeSalvo, () => renderEditorProposta(tipo, id));
  root.querySelector('#copiar')?.addEventListener('click', async () => {
    const inp = root.querySelector('#link');
    try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand('copy'); }
    toast(propostaSuja() ? 'Link copiado — lembre de SALVAR para o contratante ver as mudanças' : 'Link copiado');
  });
  root.querySelector('#novo-link')?.addEventListener('click', async () => {
    if (!exigeSalvo() || !confirm('Gerar um link novo? O link antigo para de funcionar na hora.')) return;
    try { await postPropostas({ acao: 'novo-link', id }); rascunhoProp = null; toast('Novo link gerado'); renderEditorProposta(tipo, id); }
    catch (err) { if (err.message !== 'login') toast(err.message, true); }
  });
  root.querySelector('#duplicar')?.addEventListener('click', async () => {
    if (!exigeSalvo()) return;
    try {
      const d = await postPropostas({ acao: 'criar', copiarDe: id });
      rascunhoProp = null; toast('Proposta duplicada — preencha o novo contratante');
      location.hash = `#proposta/${d.proposta.id}`;
    } catch (err) { if (err.message !== 'login') toast(err.message, true); }
  });
  root.querySelector('#usar')?.addEventListener('click', () => {
    if (!exigeSalvo()) return;
    novaProposta();
    const radio = document.querySelector(`.modal input[name="modeloId"][value="${CSS.escape(id)}"]`);
    if (radio) radio.checked = true;
  });
  root.querySelector('#excluir').addEventListener('click', async () => {
    const nome = ehProposta ? fonte.titulo : fonte.nome;
    if (!confirm(ehProposta ? `Excluir a proposta “${nome}”${fonte.contratante ? ` para ${fonte.contratante}` : ''}?\n\nO link para de funcionar.`
      : `Excluir o modelo “${nome}”?\n\nAs propostas já criadas com ele não mudam.`)) return;
    try {
      await postPropostas(ehProposta ? { acao: 'excluir', id } : { acao: 'excluir-modelo', id });
      rascunhoProp = null; toast(ehProposta ? 'Proposta excluída' : 'Modelo excluído'); location.hash = '#propostas';
    } catch (err) { if (err.message !== 'login') toast(err.message, true); }
  });
}

/* ============================================================
   CONTRATOS (gerados a partir da proposta, assinados no site)
   ============================================================ */
let contratos = [];
let modelosContrato = [];
const linkContrato = (c) => `${location.origin}${/^(localhost|127\.)/.test(location.hostname) ? '/contrato.html' : '/contrato'}?c=${c.id}.${c.chave}`;
const contratoDa = (propostaId) => contratos.find((c) => c.propostaId === propostaId && c.status !== SC.cancelado);
const classeContrato = (s) => ({ [SC.cliente]: 'warn', [SC.bounce]: 'warn', [SC.assinado]: 'ok' }[s] || '');

async function postContratos(body) {
  const r = await fetch('/api/admin/contratos', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  if (r.status === 401) { logout(); throw new Error('login'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.message || 'Erro ao salvar.'), { status: r.status });
  if (d.contrato) {
    const i = contratos.findIndex((c) => c.id === d.contrato.id);
    if (i >= 0) contratos[i] = d.contrato; else contratos.push(d.contrato);
  }
  if (d.modelo) {
    const i = modelosContrato.findIndex((m) => m.id === d.modelo.id);
    if (d.modelo.status === 'Excluído') { if (i >= 0) modelosContrato.splice(i, 1); }
    else if (i >= 0) modelosContrato[i] = d.modelo; else modelosContrato.push(d.modelo);
  }
  return d;
}
const pendentesColchete = (t) => [...new Set(String(t || '').match(/\[[^\]\n]{2,60}\]/g) || [])];

/** Caixa CONTRATO dentro do editor da proposta. */
function boxContrato(p) {
  const c = contratoDa(p.id);
  if (!c) {
    const m0 = modelosContrato[0];
    const falta = pendentesColchete(m0?.texto);
    return `
    <section class="crm-box contrato-box">
      <p class="crm-label">CONTRATO</p>
      <p class="muted" style="margin:0">Quando o contratante aprovar, gere o contrato: ele recebe um link para preencher os dados (CPF/CNPJ, endereço)
        e assinar no celular ou no computador. Depois você assina aqui no painel e o PDF fica pronto.</p>
      <div class="envio-acoes">
        ${modelosContrato.length > 1 ? `<label class="status-sel">Modelo <select id="modelo-contrato">${modelosContrato.map((m) => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')}</select></label>` : ''}
        <button type="button" class="btn btn-small" id="gerar-contrato">GERAR CONTRATO →</button>
        <a class="link-acao" href="#contrato-modelo/${esc(m0?.id || '')}">Editar o texto do contrato</a>
      </div>
      ${falta.length ? `<p class="aviso-colchete">⚠ O modelo ainda tem campos para preencher: ${falta.map(esc).join(', ')}. <a href="#contrato-modelo/${esc(m0.id)}">Preencher agora</a></p>` : ''}
    </section>`;
  }
  const link = linkContrato(c);
  const msg = `Olá${p.contratante ? `, ${p.contratante}` : ''}! Segue o contrato da Bounce Basement para assinatura${p.conteudo.evento ? ` (${p.conteudo.evento})` : ''}: ${link}`;
  const mudou = p.versao > c.versaoProposta && c.status === SC.cliente;
  return `
    <section class="crm-box contrato-box ${c.status === SC.assinado ? 'feito' : ''}">
      <p class="crm-label">CONTRATO <span class="badges"><b class="${classeContrato(c.status)}">${esc(c.status.toUpperCase())}</b></span></p>
      ${c.status === SC.cliente ? `
        <div class="link-box"><input type="text" readonly value="${esc(link)}" id="link-contrato"><button type="button" class="btn btn-small" id="copiar-contrato">COPIAR</button></div>
        <div class="envio-acoes">
          <a class="btn btn-small btn-zap" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">ENVIAR NO WHATSAPP →</a>
          <a class="btn btn-small btn-line" href="mailto:?subject=${encodeURIComponent(`Contrato Bounce Basement · ${p.titulo}`)}&body=${encodeURIComponent(msg)}">E-MAIL</a>
          <a class="btn btn-small btn-line" target="_blank" rel="noopener" href="${esc(link)}">VER CONTRATO ↗</a>
        </div>
        <p class="muted ajuda">A página da proposta também mostra o botão <b>ACEITAR E ASSINAR</b>. Gerado em ${esc(c.criado)} (modelo “${esc(c.modeloNome)}”).</p>
        ${mudou ? '<p class="aviso-colchete">⚠ A proposta foi alterada depois que o contrato foi gerado. Para o contrato mostrar os valores novos, cancele e gere de novo.</p>' : ''}
        <div class="envio-acoes">
          <button type="button" class="link-acao" id="novo-link-contrato">Gerar novo link</button>
          <button type="button" class="link-acao perigo" id="cancelar-contrato">Cancelar contrato</button>
        </div>`
      : c.status === SC.bounce ? `
        <p style="margin:0">✓ O contratante assinou em <b>${esc(c.assinadoCliente)}</b>${c.clienteEmail ? ` (${esc(c.clienteEmail)})` : ''}. Falta a assinatura da Bounce.</p>
        <div class="envio-acoes">
          <button type="button" class="btn btn-small" id="assinar-bounce">ASSINAR PELA BOUNCE →</button>
          <a class="btn btn-small btn-line" target="_blank" rel="noopener" href="${esc(link)}">VER CONTRATO ↗</a>
          <button type="button" class="link-acao perigo" id="cancelar-contrato">Cancelar contrato</button>
        </div>`
      : `
        <p style="margin:0">✓ Assinado pelas duas partes — contratante em ${esc(c.assinadoCliente)}, Bounce em ${esc(c.assinadoBounce)}.</p>
        <div class="envio-acoes">
          <a class="btn btn-small" target="_blank" rel="noopener" href="${esc(link)}">VER / BAIXAR PDF ↗</a>
          <button type="button" class="btn btn-small btn-line" id="copiar-contrato">COPIAR LINK</button>
          <input type="hidden" id="link-contrato" value="${esc(link)}">
        </div>
        <p class="muted ajuda">Código de verificação: <code>${esc(c.hash.slice(0, 16))}…</code></p>`}
    </section>`;
}

function ligarContrato(p, exigeSalvo, redesenhar) {
  const c = contratoDa(p.id);
  const falha = (err) => { if (err.message !== 'login') toast(err.message, true); };
  root.querySelector('#gerar-contrato')?.addEventListener('click', async (e) => {
    if (!exigeSalvo()) return;
    const m = modelosContrato.find((x) => x.id === (root.querySelector('#modelo-contrato')?.value || modelosContrato[0]?.id));
    const falta = pendentesColchete(m?.texto);
    if (falta.length && !confirm(`O modelo de contrato ainda tem campos entre colchetes:\n${falta.join('\n')}\n\nGerar mesmo assim?`)) return;
    e.target.disabled = true;
    try { await postContratos({ acao: 'gerar', propostaId: p.id, modeloId: m?.id }); toast('Contrato gerado — envie o link ao contratante'); redesenhar(); }
    catch (err) { e.target.disabled = false; falha(err); }
  });
  root.querySelector('#copiar-contrato')?.addEventListener('click', async () => {
    const inp = root.querySelector('#link-contrato');
    try { await navigator.clipboard.writeText(inp.value); } catch { inp.type = 'text'; inp.select(); document.execCommand('copy'); }
    toast('Link do contrato copiado');
  });
  root.querySelector('#novo-link-contrato')?.addEventListener('click', async () => {
    if (!confirm('Gerar um link novo para o contrato? O link antigo para de funcionar.')) return;
    try { await postContratos({ acao: 'novo-link', id: c.id }); toast('Novo link gerado'); redesenhar(); } catch (err) { falha(err); }
  });
  root.querySelector('#cancelar-contrato')?.addEventListener('click', async () => {
    if (!confirm(`Cancelar este contrato?\n\nO link para de funcionar${c.status === SC.bounce ? ' e a assinatura do contratante deixa de valer' : ''}. Você poderá gerar outro.`)) return;
    try { await postContratos({ acao: 'cancelar', id: c.id }); toast('Contrato cancelado'); redesenhar(); } catch (err) { falha(err); }
  });
  root.querySelector('#assinar-bounce')?.addEventListener('click', () => assinarPelaBounce(c, redesenhar));
}

async function assinarPelaBounce(c, depois) {
  let d;
  try { d = (await api(`/api/admin/contratos?ver=${encodeURIComponent(c.id)}`)).contrato; }
  catch (e) { if (e.message !== 'login') toast(e.message, true); return; }
  const m = modal(`
    <p class="kicker">CONTRATO · ${esc(d.projeto)}</p>
    <h3>ASSINAR PELA BOUNCE</h3>
    <div class="contrato-previa">${textoParaHtml(d.texto, esc)}</div>
    <p class="muted" style="font-size:13px">Assinado pelo contratante: <b>${esc(d.cliente?.nome || '')}</b> em ${esc(d.cliente?.em || '')}.</p>
    <form class="modal-form" id="f">
      <div class="row2">
        <label>Seu nome completo *<input name="nome" required maxlength="160" autocomplete="name"></label>
        <label>Seu CPF *<input name="cpf" required inputmode="numeric" maxlength="14"></label>
      </div>
      <label>Cargo <span class="muted">(opcional)</span><input name="cargo" maxlength="80" placeholder="Ex.: Sócia-diretora"></label>
      <p class="crm-label">ASSINATURA</p>
      <div id="pad-bounce"></div>
      <label class="check-linha"><input type="checkbox" name="aceite"> <span>Li o contrato acima e assino pela Bounce Basement.</span></label>
      <button class="btn btn-small" type="submit">ASSINAR CONTRATO →</button>
    </form>`);
  m.querySelector('.modal-box').classList.add('largo');
  const nomeInp = m.querySelector('[name=nome]');
  const pad = criarPad(m.querySelector('#pad-bounce'), { nomeSugerido: '' });
  m.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const ass = pad.valor();
    if (!ass) return toast('Faça a assinatura (desenhe ou use DIGITAR).', true);
    if (ass.erro) return toast(ass.erro, true);
    if (!e.target.aceite.checked) return toast('Marque que leu o contrato.', true);
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await postContratos({ acao: 'assinar-bounce', id: c.id, nome: fd.nome, cpf: fd.cpf, cargo: fd.cargo, aceite: true, assinatura: ass });
      fecharModal(); toast('Contrato assinado pelas duas partes ✓'); depois();
    } catch (err) { btn.disabled = false; if (err.message !== 'login') toast(err.message, true); }
  });
  nomeInp.focus();
}

/* ---------- modelos de contrato ---------- */
function listaModelosContrato() {
  return `
    <div class="lista-pessoas-head modelos-head">
      <h3 class="listas-sub">MODELOS DE CONTRATO</h3>
      <button type="button" class="btn btn-small btn-line" id="novo-modelo-contrato">+ NOVO MODELO DE CONTRATO</button>
    </div>
    <p class="muted listas-ajuda">O texto do contrato usa campos como <code>{{contratante_qualificacao}}</code> e <code>{{valores}}</code>, que se
      preenchem sozinhos com a proposta e com os dados que o contratante digita ao assinar.</p>
    <div class="modelos-lista">${modelosContrato.map((m) => {
      const falta = pendentesColchete(m.texto);
      return `<a class="modelo-item" href="#contrato-modelo/${esc(m.id)}"><strong>${esc(m.nome)}</strong>
        ${falta.length ? `<span class="aviso-colchete">⚠ ${falta.length} ${falta.length === 1 ? 'campo' : 'campos'} entre colchetes para preencher</span>` : ''}
        <span class="muted">Atualizado em ${esc(m.atualizado)}</span></a>`;
    }).join('')}</div>`;
}
function ligarListaModelosContrato() {
  root.querySelector('#novo-modelo-contrato')?.addEventListener('click', async () => {
    const nome = prompt('Nome do novo modelo de contrato (começa como cópia do primeiro):', 'Contrato · ');
    if (!nome) return;
    try {
      const d = await postContratos({ acao: 'salvar-modelo', nome, texto: modelosContrato[0]?.texto || '' });
      location.hash = `#contrato-modelo/${d.modelo.id}`;
    } catch (err) { if (err.message !== 'login') toast(err.message, true); }
  });
}

let rascunhoContrato = null;
function contratoModeloSujo() {
  if (!rascunhoContrato || !location.hash.startsWith('#contrato-modelo/')) return false;
  const m = modelosContrato.find((x) => x.id === rascunhoContrato.id);
  return !!m && (m.nome !== rascunhoContrato.nome || m.texto !== rascunhoContrato.texto);
}

function renderModeloContrato(id) {
  root.className = 'section admin-main';
  const m = modelosContrato.find((x) => x.id === id);
  if (!m) { root.innerHTML = '<p class="muted">Modelo não encontrado. <a href="#propostas">Voltar</a></p>'; return; }
  if (!rascunhoContrato || rascunhoContrato.id !== id) rascunhoContrato = { id, nome: m.nome, texto: m.texto };
  const r = rascunhoContrato;
  root.innerHTML = `
    <p class="voltar"><a href="#propostas">← PROPOSTAS</a></p>
    <div class="admin-head with-actions">
      <div><p class="kicker">MODELO DE CONTRATO</p><h2 class="lista-titulo" id="titulo-ed">${esc(r.nome)}</h2></div>
      <div class="head-acoes"><button type="button" class="btn btn-small btn-perigo-line" id="excluir">EXCLUIR MODELO</button></div>
    </div>
    <div class="contrato-ed">
      <div class="crm-box modal-form">
        <label>Nome do modelo<input type="text" id="nome" value="${esc(r.nome)}" maxlength="120"></label>
        <div id="colchetes"></div>
        <label>Texto do contrato
          <textarea id="texto" rows="30" spellcheck="true">${esc(r.texto)}</textarea></label>
        <p class="muted" style="margin:0;font-size:13px"><b># </b>título · <b>## </b>título da cláusula · <b>- </b>item de lista · <b>**texto**</b> negrito · linha em branco separa parágrafos.</p>
      </div>
      <aside class="crm-box campos-ajuda">
        <p class="crm-label">CAMPOS AUTOMÁTICOS</p>
        <p class="muted" style="margin:0;font-size:13px">Clique para inserir no texto.</p>
        ${CAMPOS_AJUDA.map(([k, d]) => `<div class="campo-ajuda">${k.split(' · ').map((x) => `<button type="button" data-ins="${esc(x)}"><code>${esc(x)}</code></button>`).join('')}<span>${esc(d)}</span></div>`).join('')}
        <p class="muted" style="margin:6px 0 0;font-size:13px">Textos entre <b>[colchetes]</b> são lembretes para você preencher (ex.: CNPJ da Bounce). O painel avisa enquanto existirem.</p>
        <p class="muted" style="margin:6px 0 0;font-size:13px">Mudar o modelo não altera contratos já gerados.</p>
      </aside>
    </div>
    <div class="salvar-bar">
      <span>Alterações não salvas</span>
      <button type="button" class="link-acao" id="descartar">Descartar</button>
      <button type="button" class="btn btn-small" id="salvar">SALVAR MODELO</button>
    </div>`;
  const ta = root.querySelector('#texto');
  const sujo = () => {
    root.querySelector('.salvar-bar').classList.toggle('show', contratoModeloSujo());
    const falta = pendentesColchete(r.texto);
    root.querySelector('#colchetes').innerHTML = falta.length ? `<p class="aviso-colchete">⚠ Falta preencher: ${falta.map(esc).join(', ')}</p>` : '';
  };
  sujo();
  ta.addEventListener('input', () => { r.texto = ta.value; sujo(); });
  root.querySelector('#nome').addEventListener('input', (e) => { r.nome = e.target.value; root.querySelector('#titulo-ed').textContent = r.nome || 'Modelo'; sujo(); });
  root.querySelectorAll('[data-ins]').forEach((b) => b.addEventListener('click', () => {
    const s = ta.selectionStart ?? ta.value.length;
    ta.setRangeText(b.dataset.ins, s, ta.selectionEnd ?? s, 'end');
    ta.focus(); r.texto = ta.value; sujo();
  }));
  root.querySelector('#descartar').addEventListener('click', () => { rascunhoContrato = null; renderModeloContrato(id); });
  root.querySelector('#salvar').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await postContratos({ acao: 'salvar-modelo', id, nome: r.nome, texto: r.texto }); rascunhoContrato = null; toast('Modelo de contrato salvo'); renderModeloContrato(id); }
    catch (err) { e.target.disabled = false; if (err.message !== 'login') toast(err.message, true); }
  });
  root.querySelector('#excluir').addEventListener('click', async () => {
    if (!confirm(`Excluir o modelo “${m.nome}”? Contratos já gerados não mudam.`)) return;
    try { await postContratos({ acao: 'excluir-modelo', id }); rascunhoContrato = null; toast('Modelo excluído'); location.hash = '#propostas'; }
    catch (err) { if (err.message !== 'login') toast(err.message, true); }
  });
}

// avisa antes de sair da página com uma lista ou proposta não salva
window.addEventListener('beforeunload', (e) => {
  if (propostaSuja() || contratoModeloSujo()) e.preventDefault();
  const orig = rascunhoLista && listas.find((l) => l.id === rascunhoLista.id);
  if (orig && location.hash.startsWith('#lista/') && JSON.stringify(rascunhoLista) !== JSON.stringify(orig)) e.preventDefault();
});

token ? load() : loginView();

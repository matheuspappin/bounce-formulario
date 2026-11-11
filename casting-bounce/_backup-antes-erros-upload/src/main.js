import config from '../casting.config.js';
import { allFields, isVisible, validate, ageFrom, onlyDigits } from '../shared/rules.js';

const app = document.getElementById('app');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const files = {}; // { campo: File[] }

/* ---------------- RENDER ---------------- */

function hero() {
  const h = config.hero;
  return `
  <section class="hero" id="topo">
    <div class="hero-bg" aria-hidden="true"><span>BOUNCE</span><span>BASEMENT</span></div>
    <div class="hero-inner">
      <p class="kicker">${esc(h.kicker)}</p>
      <h1>${esc(h.titulo)}</h1>
      <p class="lead">${esc(h.subtitulo)}</p>
      <a class="btn" href="#inscricao">${esc(h.cta)} <span aria-hidden="true">→</span></a>
    </div>
    <ul class="stats">
      ${config.destaques.map((d) => `<li><small>${esc(d.label)}</small><strong>${esc(d.valor)}</strong></li>`).join('')}
    </ul>
  </section>
  <div class="marquee" aria-hidden="true"><div>${'CASTING ✦ DANÇA URBANA ✦ DIVERSIDADE ✦ PORTO ALEGRE ✦ '.repeat(6)}</div></div>`;
}

function sobre() {
  const b = config.sobre;
  if (!b) return '';
  return `
  <section class="section sobre" id="sobre">
    <div class="sobre-grid">
      <div>
        <p class="kicker">BOUNCE BASEMENT</p>
        <h2>${esc(b.titulo)}</h2>
      </div>
      <div>
        ${b.paragrafos.map((p, i) => `<p class="${i === 0 ? 'sobre-lead' : ''}">${esc(p)}</p>`).join('')}
        ${b.itens?.length ? `<dl class="sobre-itens">${b.itens.map((it) => `<div><dt>${esc(it.label)}</dt><dd>${esc(it.valor)}</dd></div>`).join('')}</dl>` : ''}
        <a class="btn" href="#inscricao">${esc(config.hero.cta)} <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </section>`;
}

function fieldHTML(f) {
  const req = f.required ? '<span class="req">*</span>' : '';
  const hint = f.hint ? `<small class="hint">${esc(f.hint)}</small>` : '';
  const cls = `field field-${f.type} ${f.width ? 'w-' + f.width : ''}`;
  const wrap = (inner, labelFor = true) => `
    <div class="${cls}" data-field="${f.name}">
      ${labelFor ? `<label for="f-${f.name}">${esc(f.label)} ${req}</label>` : `<span class="label">${esc(f.label)} ${req}</span>`}
      ${inner}${hint}<small class="error" aria-live="polite"></small>
    </div>`;
  const common = `id="f-${f.name}" name="${f.name}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}`;

  switch (f.type) {
    case 'textarea':
      return wrap(`<textarea ${common} rows="4"></textarea>`);
    case 'select':
      return wrap(`<select ${common}><option value="">Selecione</option>${f.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`);
    case 'radio':
      return wrap(`<div class="chips">${f.options.map((o) => `
        <label class="chip"><input type="radio" name="${f.name}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>`, false);
    case 'checkboxes':
      return wrap(`<div class="chips">${f.options.map((o) => `
        <label class="chip"><input type="checkbox" name="${f.name}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>
        ${f.other ? `<input class="other" type="text" name="${f.name}_outros" placeholder="${esc(f.other)}">` : ''}`, false);
    case 'files':
      return wrap(`
        <label class="drop" for="f-${f.name}">
          <input type="file" id="f-${f.name}" ${f.accept ? `accept="${f.accept}"` : ''} multiple>
          <strong>Clique ou arraste aqui</strong>
          <span class="count">0 / ${f.max}</span>
        </label>
        <div class="previews" data-previews="${f.name}"></div>`, false);
    case 'age':
      return wrap(`<input ${common} type="text" readonly tabindex="-1" placeholder="—">`);
    case 'cpf':
      return wrap(`<input ${common} type="text" inputmode="numeric" maxlength="14" autocomplete="off">`);
    case 'tel':
      return wrap(`<input ${common} type="tel" inputmode="tel" maxlength="15" autocomplete="tel">`);
    case 'number':
      return wrap(`<input ${common} type="text" inputmode="decimal">`);
    case 'date':
      return wrap(`<input ${common} type="date" max="${(() => { const d = new Date(); d.setFullYear(d.getFullYear() - (f.minAge || 0)); return d.toISOString().slice(0, 10); })()}">`);
    default:
      return wrap(`<input ${common} type="${f.type === 'email' ? 'email' : 'text'}" ${f.type === 'email' ? 'autocomplete="email"' : ''}>`);
  }
}

function form() {
  if (!config.ativo) {
    return `<section class="section" id="inscricao"><div class="closed"><h2>INSCRIÇÕES ENCERRADAS</h2><p>${esc(config.mensagemEncerrado)}</p></div></section>`;
  }
  return `
  <section class="section" id="inscricao">
    <div class="section-head">
      <p class="kicker">FORMULÁRIO</p>
      <h2>INSCRIÇÃO</h2>
      <p class="muted">Campos com <span class="req">*</span> são obrigatórios.</p>
    </div>
    <form id="casting-form" novalidate>
      ${config.secoes.map((s, i) => `
        <div class="block" role="group" aria-labelledby="sec-${s.id}" data-section="${s.id}">
          <div class="block-head">
            <span class="num">${String(i + 1).padStart(2, '0')}</span>
            <h3 id="sec-${s.id}">${esc(s.titulo)}</h3>
            ${s.descricao ? `<p class="muted desc">${esc(s.descricao)}</p>` : ''}
          </div>
          <div class="grid">${s.campos.map(fieldHTML).join('')}</div>
        </div>`).join('')}
      <label class="consent field" data-field="_consent">
        <input type="checkbox" name="_consent" required>
        <span>${esc(config.consentimento)} <a href="/privacidade" target="_blank">Política de privacidade</a>. <span class="req">*</span></span>
        <small class="error"></small>
      </label>
      <div class="submit-row">
        <button class="btn btn-big" type="submit">ENVIAR INSCRIÇÃO <span aria-hidden="true">→</span></button>
        <div class="progress" hidden><div class="bar"></div><span class="pct">0%</span></div>
        <p class="form-msg" role="alert"></p>
      </div>
    </form>
  </section>`;
}

function footer() {
  const c = config.contato;
  document.querySelectorAll('[data-link="site"]').forEach((a) => (a.href = c.site));
  document.querySelector('.footer').innerHTML = `
    <div class="footer-inner">
      <div>
        <p class="logo logo-lg">bounce</p>
        <p class="muted">BOUNCE BASEMENT · PORTO ALEGRE</p>
      </div>
      <div><h4>ENDEREÇO</h4><p>${esc(c.endereco)}</p></div>
      <div><h4>CONTATO</h4><p>${esc(c.telefone)}<br><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p></div>
      <div><h4>SIGA</h4><p><a href="${c.instagram}" target="_blank" rel="noopener">INSTAGRAM ↗</a><br><a href="${c.youtube}" target="_blank" rel="noopener">YOUTUBE ↗</a></p></div>
    </div>
    <p class="copy">© ${new Date().getFullYear()} BOUNCE BASEMENT · <a href="/privacidade">POLÍTICA DE PRIVACIDADE</a> · <span class="copy-by">FEITO POR <a href="https://akaaihub.com" target="_blank" rel="noopener">AKAAIHUB.COM</a></span></p>`;
}

app.innerHTML = hero() + sobre() + form();
footer();

/* ---------------- COMPORTAMENTO ---------------- */

const formEl = document.getElementById('casting-form');
if (formEl) setup(formEl);

function readValues() {
  const fd = new FormData(formEl);
  const values = {};
  for (const f of allFields(config)) {
    if (f.type === 'files') continue;
    values[f.name] = f.type === 'checkboxes' ? fd.getAll(f.name) : fd.get(f.name) ?? '';
    if (f.other) values[`${f.name}_outros`] = fd.get(`${f.name}_outros`) ?? '';
  }
  return values;
}

function setError(name, msg) {
  const el = formEl.querySelector(`[data-field="${name}"]`);
  if (!el) return;
  el.classList.toggle('has-error', !!msg);
  el.querySelector('.error').textContent = msg || '';
}

function refreshVisibility() {
  const values = readValues();
  for (const f of allFields(config)) {
    const el = formEl.querySelector(`[data-field="${f.name}"]`);
    if (el) el.hidden = !isVisible(f, values);
  }
}

const maskCPF = (v) => onlyDigits(v).slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const maskTel = (v) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

function videoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => resolve(NaN); // formato não lido pelo navegador (ex.: alguns .mov) — aceita
    v.src = URL.createObjectURL(file);
  });
}

function renderPreviews(f) {
  const box = formEl.querySelector(`[data-previews="${f.name}"]`);
  const list = files[f.name] || [];
  box.innerHTML = '';
  list.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'thumb';
    const url = URL.createObjectURL(file);
    item.innerHTML = file.type.startsWith('video')
      ? `<video src="${url}" muted playsinline></video>`
      : `<img src="${url}" alt="">`;
    item.insertAdjacentHTML('beforeend', `<span class="fname">${esc(file.name)}</span><button type="button" aria-label="Remover">×</button>`);
    item.querySelector('button').onclick = () => { list.splice(i, 1); renderPreviews(f); };
    box.appendChild(item);
  });
  formEl.querySelector(`[data-field="${f.name}"] .count`).textContent = `${list.length} / ${f.max}`;
  if (list.length) setError(f.name, '');
}

async function addFiles(f, incoming) {
  const list = (files[f.name] ||= []);
  const problems = [];
  for (const file of incoming) {
    if (list.length >= f.max) { problems.push(`Limite de ${f.max} arquivos.`); break; }
    if (f.accept && !file.type.startsWith(f.accept.replace('/*', '/'))) { problems.push(`${file.name}: formato não aceito.`); continue; }
    if (f.maxSizeMB && file.size > f.maxSizeMB * 1024 * 1024) { problems.push(`${file.name}: maior que ${f.maxSizeMB} MB.`); continue; }
    if (f.maxDurationSec) {
      const d = await videoDuration(file);
      if (d > f.maxDurationSec + 1) { problems.push(`${file.name}: tem ${Math.round(d)}s (máx. ${f.maxDurationSec}s).`); continue; }
    }
    list.push(file);
  }
  renderPreviews(f);
  setError(f.name, problems.join(' '));
}

function setup(formEl) {
  for (const f of allFields(config)) {
    const input = formEl.querySelector(`#f-${f.name}`);
    if (f.type === 'cpf') input.addEventListener('input', () => (input.value = maskCPF(input.value)));
    if (f.type === 'tel') input.addEventListener('input', () => (input.value = maskTel(input.value)));
    if (f.type === 'age') {
      const src = formEl.querySelector(`#f-${f.from}`);
      src.addEventListener('change', () => { const a = ageFrom(src.value); input.value = a === '' ? '' : `${a} anos`; });
    }
    if (f.type === 'files') {
      input.addEventListener('change', () => { addFiles(f, [...input.files]); input.value = ''; });
      const drop = input.closest('.drop');
      ['dragenter', 'dragover'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (ev) => addFiles(f, [...ev.dataTransfer.files]));
    }
  }

  // revalida o campo enquanto a pessoa corrige (no 'input', não no 'blur',
  // para o layout não pular no meio de um clique em outro campo)
  const recheck = (e) => {
    refreshVisibility();
    formEl.querySelector('.form-msg').textContent = '';
    const name = e.target.name?.replace(/_outros$/, '');
    if (name && formEl.querySelector(`[data-field="${name}"].has-error`)) {
      const errs = validate(config, readValues(), countFiles());
      setError(name, errs[name]);
    }
  };
  formEl.addEventListener('input', recheck);
  formEl.addEventListener('change', (e) => { if (e.target.type === 'date') recheck(e); else refreshVisibility(); });
  refreshVisibility();

  formEl.addEventListener('submit', onSubmit);
}

const countFiles = () => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length]));

async function onSubmit(e) {
  e.preventDefault();
  const msg = formEl.querySelector('.form-msg');
  msg.textContent = '';
  const values = readValues();
  const errors = validate(config, values, countFiles());
  allFields(config).forEach((f) => setError(f.name, errors[f.name]));
  const consent = formEl.querySelector('[name="_consent"]');
  setError('_consent', consent.checked ? '' : 'É preciso autorizar para enviar.');
  if (!consent.checked) errors._consent = true;

  const keys = Object.keys(errors);
  if (keys.length) {
    msg.textContent = 'Confira os campos destacados.';
    formEl.querySelector(`[data-field="${keys[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = formEl.querySelector('button[type="submit"]');
  const prog = formEl.querySelector('.progress');
  const setProg = (p, text) => {
    prog.querySelector('.bar').style.width = p + '%';
    prog.querySelector('.pct').textContent = text;
  };
  const fail = (text, errs) => {
    window.onbeforeunload = null;
    btn.disabled = false; prog.hidden = true;
    if (errs) Object.entries(errs).forEach(([k, v]) => setError(k, v));
    msg.textContent = text;
  };
  btn.disabled = true;
  prog.hidden = false;
  setProg(0, 'Preparando envio…');
  window.onbeforeunload = () => 'O envio ainda não terminou.';

  // 1) registra a inscrição e recebe os links de upload
  let start;
  try {
    const meta = Object.fromEntries(Object.entries(files).map(([k, list]) =>
      [k, list.map((f) => ({ name: f.name, type: f.type, size: f.size }))]));
    const r = await fetch('/api/iniciar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, files: meta }),
    });
    start = await r.json().catch(() => ({}));
    if (!r.ok || !start.ok) return fail(start.message || 'Não foi possível enviar. Tente novamente.', start.errors);
  } catch {
    return fail('Erro de conexão. Verifique a internet e tente novamente.');
  }

  // 2) envia cada arquivo direto para o Google Drive
  const jobs = start.uploads.map((u) => ({ ...u, file: files[u.field][u.index] }));
  const totalBytes = jobs.reduce((n, j) => n + j.file.size, 0) || 1;
  let doneBytes = 0;
  for (const [i, job] of jobs.entries()) {
    let ok = false;
    for (let tentativa = 0; tentativa < 3 && !ok; tentativa++) {
      ok = await putFile(job.url, job.file, (loaded) => {
        const p = Math.round(((doneBytes + loaded) / totalBytes) * 100);
        setProg(p, `Enviando arquivo ${i + 1} de ${jobs.length} · ${p}%`);
      });
    }
    if (!ok) return fail(`Falha ao enviar "${job.file.name}". Verifique a internet e tente de novo.`);
    doneBytes += job.file.size;
  }

  // 3) confirma
  setProg(100, 'Finalizando…');
  try {
    await fetch('/api/finalizar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: start.folderId, row: start.row, total: start.total, token: start.token }),
    });
  } catch { }
  window.onbeforeunload = null;
  success();
}

function putFile(url, file, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress(ev.loaded);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

function success() {
  const s = config.sucesso;
  document.getElementById('inscricao').innerHTML = `
    <div class="success">
      <p class="kicker">✦ RECEBIDO</p>
      <h2>${esc(s.titulo)}</h2>
      <p>${esc(s.texto)}</p>
      <a class="btn" href="${config.contato.instagram}" target="_blank" rel="noopener">SEGUIR NO INSTAGRAM ↗</a>
    </div>`;
  document.getElementById('inscricao').scrollIntoView({ behavior: 'smooth' });
}

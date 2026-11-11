import config from '../casting.config.js';
import { allFields, isVisible, validate, ageFrom, onlyDigits, fileMime, fileProblem } from '../shared/rules.js';

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
        <p class="upload-note" hidden>Não feche esta página nem bloqueie a tela até terminar. Vídeos podem levar alguns minutos.</p>
        <div class="upload-problem" role="alert" hidden></div>
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

/* ---------- mensagens de problema (o que houve + como resolver) ---------- */

const CONTATO_WA = `https://wa.me/55${onlyDigits(config.contato.telefone)}`;
const contatoPasso = `Se nada resolver, chame a equipe no WhatsApp ${config.contato.telefone} e mande um print desta mensagem.`;
// navegador embutido do Instagram / TikTok / Facebook: é onde mais falha o envio de vídeos
const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|musical_ly|BytedanceWebview|TikTok/i.test(navigator.userAgent);
const inAppPasso = 'Você abriu o link dentro do Instagram/TikTok/Facebook. Abra no Chrome ou Safari (menu ⋯ → “Abrir no navegador”): o envio de vídeos funciona melhor por lá.';

function problemHTML(p) {
  return `<div class="problem">
    <strong class="problem-title">${esc(p.titulo)}</strong>
    ${p.passos?.length ? `<span class="problem-how">COMO RESOLVER</span><ul>${p.passos.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    ${p.codigo ? `<small class="problem-code">Código do erro: ${esc(p.codigo)}</small>` : ''}
  </div>`;
}

function setProblems(name, problems) {
  const el = formEl.querySelector(`[data-field="${name}"]`);
  if (!el) return;
  el.classList.toggle('has-error', problems.length > 0);
  el.querySelector('.error').innerHTML = problems.map(problemHTML).join('');
}

function videoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const end = (d) => {
      if (done) return;
      done = true; clearTimeout(t); URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : NaN);
    };
    // alguns celulares nunca respondem (nem com erro): sem isso a seleção do vídeo travava
    const t = setTimeout(() => end(NaN), 8000);
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    v.onloadedmetadata = () => end(v.duration);
    v.onerror = () => end(NaN); // formato não lido pelo navegador (ex.: alguns .mov) — aceita
    v.src = url;
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
    item.innerHTML = fileMime(file).startsWith('video')
      ? `<video src="${url}#t=0.1" muted playsinline preload="metadata"></video>`
      : `<img src="${url}" alt="">`;
    item.insertAdjacentHTML('beforeend', `<span class="fname">${esc(file.name)}</span><button type="button" aria-label="Remover">×</button>`);
    item.querySelector('button').onclick = () => { list.splice(i, 1); pending = null; renderPreviews(f); setProblems(f.name, []); };
    box.appendChild(item);
  });
  formEl.querySelector(`[data-field="${f.name}"] .count`).textContent = `${list.length} / ${f.max}`;
  if (list.length) setError(f.name, '');
}

async function addFiles(f, incoming) {
  if (!incoming.length) return;
  pending = null; // os arquivos mudaram: um envio interrompido não pode mais ser continuado
  const list = (files[f.name] ||= []);
  const problems = [];
  const isVideo = f.accept === 'video/*';
  const label = formEl.querySelector(`[data-field="${f.name}"] .drop strong`);
  if (isVideo) label.textContent = 'Verificando vídeos…';
  for (const file of incoming) {
    if (list.length >= f.max) {
      problems.push({ codigo: 'ARQ-LIMITE', titulo: `Você já adicionou ${f.max} ${isVideo ? 'vídeos' : 'fotos'}, que é o máximo.`,
        passos: ['Toque no × de um arquivo para removê-lo e então adicione outro.'] });
      break;
    }
    if (list.some((x) => x.name === file.name && x.size === file.size)) continue; // mesmo arquivo duas vezes
    const info = { name: file.name, type: file.type, size: file.size };
    let p = fileProblem(f, info);
    if (!p && f.maxDurationSec) { info.duration = await videoDuration(file); p = fileProblem(f, info); }
    if (p) { problems.push(p); continue; }
    list.push(file);
  }
  label.textContent = 'Clique ou arraste aqui';
  renderPreviews(f);
  setProblems(f.name, problems);
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

/* ---------------- ENVIO ---------------- */

const STALL_MS = 60_000;  // sem nenhum avanço por 1 min = conexão travada
let pending = null;       // envio interrompido que dá para continuar: { start, jobs, next, resume }
let uploading = false;
let hiddenDuringUpload = false;
let wakeLock = null;

async function requestWake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { } } // mantém a tela ligada
function releaseWake() { try { wakeLock?.release(); } catch { } wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (!uploading) return;
  if (document.hidden) hiddenDuringUpload = true;
  else requestWake();
});

const ui = () => ({
  btn: formEl.querySelector('button[type="submit"]'),
  prog: formEl.querySelector('.progress'),
  note: formEl.querySelector('.upload-note'),
  box: formEl.querySelector('.upload-problem'),
  msg: formEl.querySelector('.form-msg'),
});

function setProg(p, text) {
  const { prog } = ui();
  prog.querySelector('.bar').style.width = p + '%';
  prog.querySelector('.pct').textContent = text;
}

function begin(text) {
  const { btn, prog, note, box } = ui();
  btn.disabled = true; prog.hidden = false; note.hidden = false; box.hidden = true;
  setProg(0, text);
  uploading = true; hiddenDuringUpload = false;
  window.onbeforeunload = () => 'O envio ainda não terminou.';
  requestWake();
}

function stopBusy() {
  const { btn, prog, note } = ui();
  uploading = false; window.onbeforeunload = null; releaseWake();
  btn.disabled = false; prog.hidden = true; note.hidden = true;
}

function showFailure(problem) {
  const { btn, box, msg } = ui();
  stopBusy();
  msg.textContent = '';
  btn.innerHTML = `${pending ? 'CONTINUAR ENVIO' : 'ENVIAR INSCRIÇÃO'} <span aria-hidden="true">→</span>`;
  box.innerHTML = problemHTML(problem)
    + `<p class="problem-actions"><a href="${CONTATO_WA}" target="_blank" rel="noopener">FALAR COM A EQUIPE NO WHATSAPP ↗</a></p>`;
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function onSubmit(e) {
  e.preventDefault();
  const { msg, box } = ui();
  msg.textContent = '';
  box.hidden = true;
  if (pending) return runUploads(); // continua um envio que caiu, sem criar outra inscrição

  const values = readValues();
  const errors = validate(config, values, countFiles());
  allFields(config).forEach((f) => { if (f.type !== 'files' || errors[f.name]) setError(f.name, errors[f.name]); });
  const consent = formEl.querySelector('[name="_consent"]');
  setError('_consent', consent.checked ? '' : 'É preciso autorizar para enviar.');
  if (!consent.checked) errors._consent = true;

  const keys = Object.keys(errors);
  if (keys.length) {
    msg.textContent = 'Confira os campos destacados.';
    formEl.querySelector(`[data-field="${keys[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  begin('Preparando envio…');

  // 1) registra a inscrição e recebe os links de upload
  let start;
  try {
    const meta = Object.fromEntries(Object.entries(files).map(([k, list]) =>
      [k, list.map((f) => ({ name: f.name, type: fileMime(f), size: f.size }))]));
    const r = await fetch('/api/iniciar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, files: meta }),
    });
    start = await r.json().catch(() => ({}));
    if (start.errors && Object.keys(start.errors).length) {
      stopBusy();
      Object.entries(start.errors).forEach(([k, v]) => setError(k, v));
      msg.textContent = start.message || 'Confira os campos destacados.';
      formEl.querySelector(`[data-field="${Object.keys(start.errors)[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!r.ok || !start.ok) {
      return showFailure({
        codigo: start.codigo || `INI-${r.status}`,
        titulo: start.message || 'Não conseguimos registrar sua inscrição agora.',
        passos: ['Aguarde alguns minutos e toque em ENVIAR INSCRIÇÃO de novo. Seus dados e arquivos continuam preenchidos aqui.', contatoPasso],
      });
    }
  } catch {
    return showFailure({
      codigo: 'INI-REDE',
      titulo: 'Sem conexão com a internet.',
      passos: ['Confira se o Wi-Fi ou os dados móveis estão ligados.',
        'Depois toque em ENVIAR INSCRIÇÃO de novo. Nada do que você preencheu foi perdido.',
        ...(inApp ? [inAppPasso] : []), contatoPasso],
    });
  }

  pending = { start, jobs: start.uploads.map((u) => ({ ...u, file: files[u.field][u.index] })), next: 0, resume: false };
  return runUploads();
}

// 2) envia cada arquivo direto para o Google Drive (continua de onde parou se a conexão cair)
async function runUploads() {
  const { start, jobs } = pending;
  begin(pending.resume ? 'Retomando envio…' : 'Enviando…');
  const totalBytes = jobs.reduce((n, j) => n + j.file.size, 0) || 1;
  let doneBytes = jobs.slice(0, pending.next).reduce((n, j) => n + j.file.size, 0);

  for (let i = pending.next; i < jobs.length; i++) {
    const job = jobs[i];
    let sent = 0;
    const label = (p) => `Enviando arquivo ${i + 1} de ${jobs.length} · ${p}%`;
    const r = await uploadJob(job, {
      retomando: pending.resume,
      onProgress: (loaded) => {
        sent = loaded;
        const p = Math.round(((doneBytes + loaded) / totalBytes) * 100);
        setProg(p, label(p));
      },
      onRetry: (t) => setProg(Math.round((doneBytes + sent) / totalBytes * 100), `Conexão instável — tentando de novo (${t}/3)…`),
    });
    if (!r.ok) {
      const problem = uploadProblem(r, job, i, jobs.length, Math.round((sent / (job.file.size || 1)) * 100));
      if (r.kind === 'expirado') pending = null; else pending.resume = true;
      return showFailure(problem);
    }
    pending.resume = false;
    doneBytes += job.file.size;
    pending.next = i + 1;
  }

  // 3) confirma
  setProg(100, 'Finalizando…');
  try {
    await fetch('/api/finalizar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: start.folderId, row: start.row, total: start.total, token: start.token }),
    });
  } catch { }
  pending = null;
  stopBusy();
  success();
}

function uploadProblem(r, job, i, n, pct) {
  const nome = `“${job.file.name}”`;
  const onde = `arquivo ${i + 1} de ${n}${pct > 0 && pct < 100 ? `, ${pct}% enviado` : ''}`;
  const tela = 'Deixe esta página aberta e a tela ligada até terminar: no celular, trocar de app ou bloquear a tela pausa o envio.';
  const continuar = 'Toque em CONTINUAR ENVIO. O que já foi enviado não se perde.';
  switch (r.kind) {
    case 'expirado':
      return { codigo: 'UP-EXPIRADO', titulo: `O link de envio de ${nome} expirou (${onde}).`,
        passos: ['Isso acontece quando o envio fica parado por muito tempo.', 'Toque em ENVIAR INSCRIÇÃO para enviar de novo.', contatoPasso] };
    case 'recusado':
      return { codigo: `UP-${r.status}`, titulo: `O Google Drive recusou ${nome} (${onde}).`,
        passos: ['Confira se o arquivo abre normalmente no seu celular.',
          'Remova esse arquivo (no ×), salve uma cópia dele em MP4 (ou grave de novo) e selecione a cópia.',
          'Depois toque em ENVIAR INSCRIÇÃO.', contatoPasso] };
    case 'servidor':
      return { codigo: `UP-${r.status}`, titulo: `O Google Drive não respondeu ao receber ${nome} (${onde}).`,
        passos: ['É uma instabilidade passageira. Aguarde 1 minuto.', continuar, contatoPasso] };
    default: // queda de conexão ou envio travado
      return {
        codigo: r.kind === 'parado' ? 'UP-PARADO' : 'UP-REDE',
        titulo: r.kind === 'parado' ? `O envio de ${nome} ficou parado (${onde}).` : `A conexão caiu durante o envio de ${nome} (${onde}).`,
        passos: [
          ...(hiddenDuringUpload ? [`Você saiu desta página ou bloqueou a tela durante o envio. ${tela}`] : []),
          navigator.onLine === false ? 'Seu celular está sem internet agora. Ligue o Wi-Fi ou os dados móveis.'
            : 'Confira sua internet. Se puder, use Wi-Fi: vídeos são arquivos grandes.',
          ...(hiddenDuringUpload ? [] : [tela]),
          continuar,
          ...(inApp ? [inAppPasso] : []),
          contatoPasso,
        ],
      };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitOnline = (ms) => (navigator.onLine !== false ? Promise.resolve() : new Promise((r) => {
  const t = setTimeout(r, ms);
  window.addEventListener('online', () => { clearTimeout(t); r(); }, { once: true });
}));

async function uploadJob(job, { retomando, onProgress, onRetry }) {
  let from = 0;
  let r = { ok: false, status: 0, kind: 'rede' };
  for (let t = 0; t < 4; t++) {
    if (t > 0) { onRetry(t); await waitOnline(30_000); await sleep(2000 * t); }
    if (t > 0 || retomando) {
      // pergunta ao Drive quanto do arquivo já chegou, para continuar dali
      const st = await queryOffset(job.url, job.file.size);
      if (st.done) { onProgress(job.file.size); return { ok: true }; }
      if (st.expired) return { ok: false, kind: 'expirado', status: 404 };
      from = st.offset || 0;
    }
    r = await sendBytes(job.url, job.file, from, onProgress);
    if (r.ok) return r;
    if (r.status === 404 || r.status === 410) return { ok: false, kind: 'expirado', status: r.status };
    if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) return { ok: false, kind: 'recusado', status: r.status };
    if (r.status >= 500) r.kind = 'servidor';
  }
  return r;
}

function sendBytes(url, file, from, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let finished = false;
    let last = Date.now();
    const done = (res) => { if (finished) return; finished = true; clearInterval(dog); resolve(res); };
    const dog = setInterval(() => {
      if (Date.now() - last > STALL_MS) { done({ ok: false, status: 0, kind: 'parado' }); xhr.abort(); }
    }, 5000);
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', fileMime(file) || 'application/octet-stream');
    if (from > 0) xhr.setRequestHeader('Content-Range', `bytes ${from}-${file.size - 1}/${file.size}`);
    xhr.upload.onprogress = (ev) => { last = Date.now(); if (ev.lengthComputable) onProgress(from + ev.loaded); };
    xhr.onload = () => done(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, status: xhr.status });
    xhr.onerror = () => done({ ok: false, status: 0, kind: 'rede' });
    xhr.onabort = () => done({ ok: false, status: 0, kind: 'parado' });
    xhr.send(from > 0 ? file.slice(from) : file);
  });
}

function queryOffset(url, size) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Range', `bytes */${size}`);
    xhr.timeout = 20_000;
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) return resolve({ done: true });
      if (xhr.status === 308) {
        const m = (xhr.getResponseHeader('Range') || '').match(/bytes=0-(\d+)/);
        return resolve({ offset: m ? Number(m[1]) + 1 : 0 });
      }
      if (xhr.status === 404 || xhr.status === 410) return resolve({ expired: true });
      resolve({ offset: 0 });
    };
    xhr.onerror = xhr.ontimeout = () => resolve({ offset: 0 });
    xhr.send();
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

// aviso para quem abriu o link dentro do Instagram/TikTok/Facebook
if (formEl && inApp) {
  formEl.querySelector('.field-files')?.closest('.block')?.querySelector('.block-head')
    ?.insertAdjacentHTML('beforeend', `<p class="inapp-note">⚠ ${esc(inAppPasso)}</p>`);
}

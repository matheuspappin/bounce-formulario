// Página do contrato: o contratante lê, preenche os dados e assina. Depois mostra o contrato assinado + registro.
import { camposDoCliente, preencher, textoParaHtml, isValidCNPJ, formatarDoc, STATUS_CONTRATO as S } from '../shared/contrato.js';
import { isValidCPF, onlyDigits } from '../shared/rules.js';
import { criarPad, assinaturaHtml } from '../shared/assinatura.js';

const root = document.getElementById('contrato');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const codigo = new URLSearchParams(location.search).get('c') || '';
const destacar = (html) => html.replace(/_{6,}/g, '<span class="vazio">$&</span>');

function blocoAssinaturas(d) {
  const lado = (titulo, p) => `
    <div class="ass-bloco">
      <div class="ass-img">${p ? assinaturaHtml(p.assinatura, esc) : '<span class="ass-pendente">aguardando assinatura</span>'}</div>
      <div class="ass-legenda"><strong>${esc(titulo)}</strong>${p ? `<span>${esc(p.nome)}</span><span>CPF/CNPJ ${esc(p.documento)}</span><span>Assinado em ${esc(p.em)}</span>` : ''}</div>
    </div>`;
  return `<div class="assinaturas">${lado('CONTRATANTE', d.cliente)}${lado('CONTRATADA — BOUNCE BASEMENT', d.bounce)}</div>`;
}

function registro(d) {
  if (!d.cliente) return '';
  const linha = (titulo, p) => (p ? `
    <tr><th colspan="2">${esc(titulo)}</th></tr>
    <tr><td>Nome</td><td>${esc(p.nome)}</td></tr>
    <tr><td>CPF/CNPJ</td><td>${esc(p.documento)}</td></tr>
    ${p.email ? `<tr><td>E-mail</td><td>${esc(p.email)}</td></tr>` : ''}
    <tr><td>Data e hora</td><td>${esc(p.em)} (horário de Brasília) · ${esc(p.iso)}</td></tr>
    <tr><td>Endereço IP</td><td>${esc(p.ip || '—')}</td></tr>
    <tr><td>Navegador</td><td class="ua">${esc(p.navegador || '—')}</td></tr>` : `<tr><th colspan="2">${esc(titulo)}</th></tr><tr><td colspan="2">Aguardando assinatura.</td></tr>`);
  return `
    <section class="papel registro">
      <h2>REGISTRO DE ASSINATURAS ELETRÔNICAS</h2>
      <p>Documento nº <strong>${esc(d.id)}</strong> · ${esc(d.projeto)}</p>
      <p>Código de verificação (SHA-256 do texto assinado):<br><code>${esc(d.hash)}</code></p>
      <table>${linha('CONTRATANTE', d.cliente)}${linha('CONTRATADA — BOUNCE BASEMENT', d.bounce)}</table>
      <p class="pequeno">As assinaturas foram feitas eletronicamente pelo site da Bounce Basement, com aceite expresso do texto acima
        (art. 10, § 2º, da MP 2.200-2/2001). Qualquer alteração no texto muda o código de verificação.</p>
    </section>`;
}

function render(d) {
  document.title = `Contrato · ${d.projeto || 'Bounce Basement'}`;
  const pendente = d.status === S.cliente;
  const aviso = d.status === S.bounce
    ? '<div class="aviso ok">✓ Você assinou o contrato. Agora falta a assinatura da Bounce Basement — o contrato completo fica neste mesmo link.</div>'
    : d.status === S.assinado ? '<div class="aviso ok">✓ Contrato assinado pelas duas partes. Use <b>BAIXAR PDF</b> para guardar uma cópia.</div>'
      : '<div class="aviso">Leia o contrato, preencha seus dados no fim da página e assine. O texto se completa com os seus dados enquanto você digita.</div>';
  root.innerHTML = `
    ${aviso}
    <article class="papel" id="texto">${destacar(textoParaHtml(d.texto, esc))}${pendente ? '' : blocoAssinaturas(d)}</article>
    ${pendente ? formulario(d) : registro(d)}`;
  if (pendente) ligarFormulario(d);
}

function formulario(d) {
  return `
  <form class="papel form" id="f" novalidate>
    <h2>SEUS DADOS E ASSINATURA</h2>
    <div class="tipo">
      <label><input type="radio" name="tipo" value="PF" checked> Pessoa física (CPF)</label>
      <label><input type="radio" name="tipo" value="PJ"> Empresa (CNPJ)</label>
    </div>
    <label><span data-pf>Nome completo</span><span data-pj hidden>Razão social</span>
      <input name="nome" autocomplete="name" maxlength="160" value="${esc(d.sugestao?.nome || '')}" required></label>
    <div class="dois">
      <label><span data-pf>CPF</span><span data-pj hidden>CNPJ</span><input name="documento" inputmode="numeric" maxlength="18" required></label>
      <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="160" required></label>
    </div>
    <label>Endereço completo<input name="endereco" autocomplete="street-address" maxlength="300" placeholder="Rua, número, bairro, cidade/UF, CEP" required></label>
    <div class="dois" data-pj hidden>
      <label>Nome de quem assina pela empresa<input name="representante" maxlength="160"></label>
      <label>CPF de quem assina<input name="representanteCpf" inputmode="numeric" maxlength="14"></label>
    </div>
    <label>Telefone / WhatsApp <span class="opc">(opcional)</span><input name="telefone" type="tel" autocomplete="tel" maxlength="40"></label>
    <p class="rotulo">Assinatura</p>
    <div id="pad"></div>
    <label class="aceite"><input type="checkbox" name="aceite"> Li e concordo com todos os termos deste contrato e assino eletronicamente.</label>
    <p class="erro" id="erro" role="alert"></p>
    <button type="submit" class="btn">ASSINAR CONTRATO</button>
    <p class="pequeno">Ao assinar, registramos data, hora, endereço IP e e-mail, e geramos um código de verificação do texto.</p>
  </form>`;
}

function ligarFormulario(d) {
  const f = root.querySelector('#f');
  const pad = criarPad(f.querySelector('#pad'), { nomeSugerido: d.sugestao?.nome || '' });
  const dados = () => {
    const o = Object.fromEntries(new FormData(f));
    return { ...o, aceite: f.aceite.checked };
  };
  const atualizar = () => {
    const pj = f.tipo.value === 'PJ';
    f.querySelectorAll('[data-pj]').forEach((x) => { x.hidden = !pj; });
    f.querySelectorAll('[data-pf]').forEach((x) => { x.hidden = pj; });
    root.querySelector('#texto').innerHTML = destacar(textoParaHtml(preencher(d.texto, camposDoCliente(dados(), '(data da assinatura)')), esc));
  };
  f.addEventListener('input', atualizar);
  f.addEventListener('change', atualizar);
  ['documento', 'representanteCpf'].forEach((n) => f[n].addEventListener('blur', () => {
    if ([11, 14].includes(onlyDigits(f[n].value).length)) { f[n].value = formatarDoc(f[n].value); atualizar(); }
  }));
  atualizar();

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = f.querySelector('#erro');
    const o = dados();
    const pj = o.tipo === 'PJ';
    const problema = !o.nome.trim() ? (pj ? 'Informe a razão social.' : 'Informe seu nome completo.')
      : pj ? (!isValidCNPJ(o.documento) ? 'CNPJ inválido.' : '') : (!isValidCPF(o.documento) ? 'CPF inválido.' : '');
    const problema2 = problema || (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email.trim()) ? 'E-mail inválido.' : '')
      || (!o.endereco.trim() ? 'Informe o endereço.' : '')
      || (pj && !o.representante.trim() ? 'Informe o nome de quem assina pela empresa.' : '')
      || (pj && !isValidCPF(o.representanteCpf) ? 'CPF de quem assina inválido.' : '');
    const ass = pad.valor();
    const erro = problema2 || (!ass ? 'Faça a assinatura: desenhe no quadro ou use DIGITAR.' : ass.erro) || (!o.aceite ? 'Marque que você leu e concorda com o contrato.' : '');
    if (erro) { msg.textContent = erro; return; }
    msg.textContent = '';
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'ASSINANDO…';
    try {
      const r = await fetch('/api/contrato', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: codigo, ...o, assinatura: ass }) });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(res.message || 'Não foi possível assinar.');
      render(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false; btn.textContent = 'ASSINAR CONTRATO';
    }
  });
}

async function iniciar() {
  try {
    const r = await fetch(`/api/contrato?c=${encodeURIComponent(codigo)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || 'Contrato indisponível.');
    render(d);
    const btn = document.getElementById('pdf');
    btn.hidden = false;
    btn.addEventListener('click', () => window.print());
  } catch (e) {
    root.innerHTML = `<div class="aviso">${esc(e.message)}</div>`;
  }
}
iniciar();

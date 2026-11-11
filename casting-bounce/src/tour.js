// Tour guiado do painel (/admin): destaca cada parte da tela e explica o que ela faz.
// Os passos seguem a ordem real do trabalho: inscrição → funil → lista → proposta → contrato → relatório.
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const CHAVE = 'casting_tour_visto';
const visto = {
  get: () => { try { return localStorage.getItem(CHAVE) === '1'; } catch { return true; } },
  set: () => { try { localStorage.setItem(CHAVE, '1'); } catch {} },
};

let ctx = { etapas: [] };
export function configurarTour(c) { ctx = { ...ctx, ...c }; }

/* ---------- ações usadas pelos passos ---------- */
const fecharFicha = () => { const d = document.getElementById('drawer'); if (d && !d.hidden) d.querySelector('[data-close]')?.click(); };
const fecharModal = () => document.querySelector('.modal [data-fechar]')?.click();
async function abrirPrimeiraFicha() {
  const d = document.getElementById('drawer');
  if (d && !d.hidden) return;
  if (document.body.classList.contains('selecionando')) return;
  document.querySelector('#grid .pcard, #grid .fcard')?.click();
  await espera(150);
}
async function abrirPrimeiraLista() {
  if (location.hash.startsWith('#lista/')) return;
  if (location.hash !== '#listas') { location.hash = '#listas'; await espera(150); }
  const a = document.querySelector('a.lcard:not(.off)') || document.querySelector('a.lcard');
  if (a) { location.hash = a.getAttribute('href'); await espera(150); }
}

/* ---------- passos ---------- */
const PASSOS = [
  { id: 'inicio', titulo: 'Bem-vindo ao painel do casting',
    texto: () => 'Em uns 2 minutos você vê o caminho completo de um trabalho:\n**Inscrição → Funil → Lista → Proposta → Contrato → Relatório**.\n\nUse os botões ou as setas ← → do teclado. Esc sai do tour.' },
  { id: 'menu', hash: '#inscricoes', alvo: '#admin-nav', titulo: 'O menu',
    texto: () => 'As áreas estão na ordem em que são usadas: **INSCRIÇÕES**, **LISTAS**, **PROPOSTAS** e **RELATÓRIO**.\n**PLANILHA ↗** e **DRIVE ↗** abrem onde os dados ficam guardados. **MANUAL** e **? TOUR** ficam sempre aqui.' },
  { id: 'inscricoes', hash: '#inscricoes', acao: fecharFicha, alvo: '.admin-head', titulo: '1 · Inscrições',
    texto: () => 'Cada pessoa que preenche o site vira **uma linha na planilha** e **uma pasta no Drive** com as fotos e vídeos. O número mostra quantos perfis aparecem com os filtros de agora.' },
  { id: 'filtros', hash: '#inscricoes', alvo: '.toolbar', titulo: 'Busca e filtros',
    texto: () => 'A busca procura em qualquer campo (nome, cidade, Instagram…). Os filtros se somam: ex. Gênero + Estilo + Disponível para o show. O estilo filtrado aparece destacado nos cards.' },
  { id: 'funil', hash: '#inscricoes', acao: () => document.querySelector('[data-view="cards"]')?.click(), alvo: '#tabs', titulo: '2 · Etapas do funil',
    texto: () => `Toda inscrição nova entra em **${ctx.etapas[0] || 'Novo'}**. Você vai movendo a pessoa conforme avança:\n${ctx.etapas.join(' → ')}.\nClique numa aba para ver só aquela etapa.` },
  { id: 'visualizacao', hash: '#inscricoes', alvo: '.view-toggle', titulo: 'Cards ou funil',
    texto: () => '**CARDS** mostra as fotos. **FUNIL** mostra uma coluna por etapa: arraste o card para outra coluna e a etapa muda — já fica salvo na planilha.' },
  { id: 'card', hash: '#inscricoes', alvo: '#grid .pcard', opcional: true, titulo: 'O card do perfil',
    texto: () => 'Os selos resumem a pessoa: etapa, se pode no show, experiência, **ARQUIVOS INCOMPLETOS** (o envio de fotos/vídeos não terminou) e **EM N LISTAS**. Clique no card para abrir a ficha.' },
  { id: 'ficha', hash: '#inscricoes', acao: abrirPrimeiraFicha, alvo: '#drawer .crm-box', opcional: true, titulo: 'A ficha: etapa, contato e anotações',
    texto: () => 'Mude a etapa por aqui. **CONTATAR NO WHATSAPP** já abre com uma mensagem pronta — ela muda conforme a etapa. As **anotações** são internas: o contratante nunca vê.' },
  { id: 'ficha-listas', hash: '#inscricoes', acao: abrirPrimeiraFicha, alvo: '#drawer .listas-box', opcional: true, titulo: 'A ficha: listas e arquivos',
    texto: () => 'Mostra em quais listas a pessoa está (✓ participou, nas concluídas) e permite adicioná-la a uma. Mais abaixo ficam fotos, vídeos, a ficha completa e **EXCLUIR PERFIL**.' },
  { id: 'selecionar', hash: '#inscricoes', acao: fecharFicha, alvo: '#sel-toggle', titulo: '3 · Montar um elenco',
    texto: () => 'Clique em **SELECIONAR PARA LISTA**, marque os perfis (ou filtre e use **SELECIONAR OS N VISÍVEIS**) e depois **ADICIONAR A UMA LISTA** — escolha uma lista existente ou crie uma nova.' },
  { id: 'listas', hash: '#listas', alvo: '#nova', titulo: 'Listas para contratantes',
    texto: () => 'Cada lista é um elenco para um contratante, com **um link só de visualização**. Pode haver várias ao mesmo tempo e a mesma pessoa pode estar em várias. Também dá para criar uma lista vazia aqui.' },
  { id: 'lista-link', acao: abrirPrimeiraLista, alvo: '.envio', opcional: true, titulo: 'O link do contratante',
    texto: () => 'COPIAR, WHATSAPP ou E-MAIL mandam o link. O contratante vê fotos, vídeos, medidas e estilos — **nunca** contato, CPF, endereço, nome completo ou nascimento.\n**Encerrar** desliga o link. **Gerar novo link** invalida o antigo (use se vazar).' },
  { id: 'lista-pessoas', acao: abrirPrimeiraLista, alvo: '.lista-pessoas', opcional: true, titulo: 'Organizar o elenco',
    texto: () => 'Reordene (↑ ↓), tire (✕) e escreva uma **nota para o contratante** em cada perfil. Nada vai para o link até você clicar em **SALVAR LISTA** (a barra aparece embaixo).' },
  { id: 'lista-proposta', acao: abrirPrimeiraLista, alvo: '#proposta-lista', opcional: true, titulo: 'Da lista para a proposta',
    texto: () => 'Com o elenco pronto, **PROPOSTA** cria o orçamento já ligado a esta lista: contratante, evento, data e as fotos do elenco entram sozinhos.' },
  { id: 'propostas', hash: '#propostas', alvo: '#nova', titulo: '4 · Propostas',
    texto: () => 'Orçamentos agrupados por status: Rascunho, Enviada, Aprovada, Recusada.\nO cachê por bailarina × nº de perfis da lista; cada item pode ser **Valor**, **A combinar** ou **Cortesia** — o total é calculado sozinho. O contratante recebe um link com botão de PDF.' },
  { id: 'modelos', hash: '#propostas', alvo: '#novo-modelo', titulo: 'Modelos de proposta',
    texto: () => 'O modelo é o texto e os valores padrão. Cada proposta nasce como uma **cópia** do modelo — editar o modelo depois não muda propostas já criadas.' },
  { id: 'contrato', hash: '#propostas', alvo: '#novo-modelo-contrato', titulo: '5 · Contrato com assinatura',
    texto: () => 'Antes do 1º uso, abra o modelo de contrato e preencha o que está **[entre colchetes]**.\nFluxo: na proposta → **GERAR CONTRATO** → contratante assina pelo link → **Aguardando Bounce** → **ASSINAR PELA BOUNCE** → PDF assinado pelas duas partes.' },
  { id: 'concluir', acao: abrirPrimeiraLista, alvo: '#concluir', opcional: true, titulo: '6 · Depois do evento',
    texto: () => '**✓ CONCLUIR TRABALHO**: marque quem participou e escreva o resultado. O link é desligado e o trabalho vai para o **RELATÓRIO**.' },
  { id: 'relatorio', hash: '#relatorio', alvo: '.rel-numeros', titulo: '6 · Relatório',
    texto: () => 'Histórico dos trabalhos concluídos: data, evento, contratante, quem participou e o resultado. Mostra quantos trabalhos cada pessoa fez e tem **BAIXAR PLANILHA (CSV)**.' },
  { id: 'dados', alvo: () => document.querySelector('#admin-nav a[target="_blank"]'), opcional: true, titulo: 'Onde tudo fica guardado',
    texto: () => 'Tudo fica na sua **planilha do Google** (uma aba por casting + abas de listas, propostas, contratos e perfis excluídos) e no **Drive**. Prefira editar pelo painel: ele mantém as regras e os links funcionando.' },
  { id: 'fim', alvo: '#tour-btn', titulo: 'Pronto!',
    texto: () => 'Reveja o tour quando quiser em **? TOUR**. O **MANUAL** explica a lógica de cada etapa e tem respostas para as dúvidas mais comuns.', fim: true },
];
export const PASSOS_TOUR = PASSOS.map((p) => p.id);

/* ---------- motor ---------- */
let atual = -1;
let el = null; // camada do tour
let alvoAtual = null;
let gen = 0;

async function achar(alvo, ms = 1200) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const x = typeof alvo === 'function' ? alvo() : document.querySelector(alvo);
    if (x && x.getClientRects().length && !x.closest('[hidden]')) return x;
    await espera(80);
  }
  return null;
}

function montar() {
  if (el) return;
  el = document.createElement('div');
  el.className = 'tour';
  el.innerHTML = '<div class="tour-luz"></div><div class="tour-box" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(el);
  window.addEventListener('resize', posicionar);
  window.addEventListener('scroll', posicionar, true);
  document.addEventListener('keydown', teclas, true);
}

function teclas(e) {
  if (!el) return;
  if (e.key === 'Escape') { e.stopPropagation(); fechar(); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); ir(atual + 1, 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(atual - 1, -1); }
}

export function fechar() {
  gen++;
  visto.set();
  if (!el) return;
  window.removeEventListener('resize', posicionar);
  window.removeEventListener('scroll', posicionar, true);
  document.removeEventListener('keydown', teclas, true);
  el.remove(); el = null; alvoAtual = null; atual = -1;
}

async function ir(n, dir = 1) {
  if (n < 0) return;
  if (n >= PASSOS.length) return fechar();
  const minha = ++gen;
  const p = PASSOS[n];
  montar();
  el.classList.add('carregando');
  fecharModal();
  if (p.hash && location.hash !== p.hash && !(p.hash === '#inscricoes' && location.hash === '')) {
    location.hash = p.hash;
    await espera(150);
  }
  if (p.acao) await p.acao();
  const alvo = p.alvo ? await achar(p.alvo) : null;
  if (minha !== gen || !el) return;
  if (p.alvo && !alvo && p.opcional) return ir(n + dir, dir); // não existe agora (ex.: nenhuma lista criada): pula
  atual = n;
  alvoAtual = alvo;
  if (alvo) {
    alvo.scrollIntoView({ block: 'center', behavior: 'instant' });
    await espera(30);
  }
  desenhar(p);
  el.classList.remove('carregando');
}

function desenhar(p) {
  const total = PASSOS.length;
  const box = el.querySelector('.tour-box');
  box.innerHTML = `
    <button type="button" class="tour-x" data-t="sair" aria-label="Sair do tour">×</button>
    <p class="tour-n">${atual + 1} / ${total}</p>
    <h3>${esc(p.titulo)}</h3>
    <p class="tour-txt">${md(p.texto()).replace(/\n/g, '<br>')}</p>
    <div class="tour-prog"><span style="width:${((atual + 1) / total) * 100}%"></span></div>
    <div class="tour-acoes">
      ${atual === 0 ? '<button type="button" class="link-acao" data-t="sair">Agora não</button>'
        : '<button type="button" class="link-acao" data-t="ant">← Voltar</button>'}
      ${p.fim ? '<button type="button" class="btn btn-small btn-line" data-t="manual">ABRIR MANUAL</button>' : ''}
      <button type="button" class="btn btn-small" data-t="prox">${atual === 0 ? 'COMEÇAR →' : p.fim ? 'CONCLUIR' : 'PRÓXIMO →'}</button>
    </div>`;
  box.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.t;
    if (t === 'sair') fechar();
    else if (t === 'ant') ir(atual - 1, -1);
    else if (t === 'prox') ir(atual + 1, 1);
    else if (t === 'manual') { fechar(); location.hash = '#manual'; }
  }));
  el.classList.toggle('centro', !alvoAtual);
  posicionar();
  box.querySelector('[data-t="prox"]').focus({ preventScroll: true });
}

function posicionar() {
  if (!el) return;
  const luz = el.querySelector('.tour-luz');
  const box = el.querySelector('.tour-box');
  const vw = window.innerWidth; const vh = window.innerHeight; const m = 12;
  if (!alvoAtual || !alvoAtual.isConnected) {
    luz.style.cssText = 'display:none';
    box.style.cssText = `left:${Math.max(m, (vw - box.offsetWidth) / 2)}px; top:${Math.max(m, (vh - box.offsetHeight) / 2)}px`;
    return;
  }
  const r = alvoAtual.getBoundingClientRect();
  const pad = 6;
  const t = Math.max(4, r.top - pad); const l = Math.max(4, r.left - pad);
  const b = Math.min(vh - 4, r.bottom + pad); const rr = Math.min(vw - 4, r.right + pad);
  luz.style.cssText = `display:block; top:${t}px; left:${l}px; width:${Math.max(0, rr - l)}px; height:${Math.max(0, b - t)}px`;
  const bw = box.offsetWidth; const bh = box.offsetHeight;
  if (vw < 640) { box.style.cssText = `left:${m}px; top:${b + bh + m < vh ? b + m : Math.max(m, vh - bh - m)}px`; return; }
  const meio = Math.min(vh - bh - m, Math.max(m, t + (b - t - bh) / 2));
  const xAlinhado = Math.min(vw - bw - m, Math.max(m, l));
  let pos;
  if (b + m + bh <= vh - m) pos = [xAlinhado, b + m];            // embaixo do destaque
  else if (t - m - bh >= m) pos = [xAlinhado, t - m - bh];       // em cima
  else if (rr + m + bw <= vw - m) pos = [rr + m, meio];          // à direita
  else if (l - m - bw >= m) pos = [l - m - bw, meio];            // à esquerda
  else pos = [vw - bw - m, vh - bh - m];                         // no canto de baixo
  box.style.cssText = `left:${pos[0]}px; top:${pos[1]}px`;
}

/** Abre o tour (no começo ou num passo específico, pelo id). */
export function iniciarTour(id) {
  const n = id ? Math.max(0, PASSOS.findIndex((p) => p.id === id)) : 0;
  ir(n, 1);
}

/** Na primeira vez que o painel abre neste navegador, oferece o tour. */
export function tourAuto() {
  if (!visto.get() && !el) setTimeout(() => iniciarTour(), 600);
}

// Manual do painel (/admin → MANUAL): o passo a passo e a lógica por trás de cada etapa.
import { iniciarTour } from './tour.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tour = (id, txt = 'VER NO TOUR') => `<button type="button" class="btn btn-small btn-line man-tour" data-tour="${id}">▶ ${txt}</button>`;

const FLUXO = [
  ['inscricoes', '01', 'INSCRIÇÃO', 'A pessoa preenche o site'],
  ['funil', '02', 'FUNIL', 'Você faz a triagem'],
  ['listas', '03', 'LISTA', 'Elenco para o contratante'],
  ['propostas', '04', 'PROPOSTA', 'Orçamento com link e PDF'],
  ['contrato', '05', 'CONTRATO', 'Assinatura eletrônica'],
  ['relatorio', '06', 'RELATÓRIO', 'Quem trabalhou onde'],
];

export function renderManual(root, { etapas = [], mensagens = {} } = {}) {
  root.className = 'section admin-main manual';
  root.innerHTML = `
    <div class="admin-head with-actions">
      <div><p class="kicker">COMO USAR O PAINEL</p><h2>MANUAL</h2></div>
      ${tour('inicio', 'FAZER O TOUR GUIADO')}
    </div>
    <p class="man-lead">O painel acompanha um trabalho do começo ao fim. Cada etapa usa o resultado da anterior —
      por isso vale seguir a ordem abaixo. Clique numa etapa para ir direto à explicação.</p>

    <ol class="man-fluxo">
      ${FLUXO.map(([id, n, t, d]) => `<li><button type="button" data-ir="${id}"><span>//${n}</span><strong>${t}</strong><em>${d}</em></button></li>`).join('')}
    </ol>

    <section class="man-sec" id="man-dados">
      <h3>ONDE FICAM OS DADOS</h3>
      <p>O painel não tem banco de dados próprio: ele <b>lê e grava na sua planilha do Google</b> e nas pastas do <b>Drive</b>.
        Os botões <b>PLANILHA ↗</b> e <b>DRIVE ↗</b> do menu abrem os dois.</p>
      <div class="man-tabela"><table>
        <thead><tr><th>Onde</th><th>O que guarda</th></tr></thead>
        <tbody>
          <tr><td>Aba do casting (ex.: <code>casting-show-1212</code>)</td><td>Uma linha por inscrição + as colunas do CRM: <i>Etapa</i>, <i>Anotações</i> e <i>Atualizado em</i>.</td></tr>
          <tr><td>Aba <i>Listas para contratantes</i></td><td>Uma linha por lista (perfis, notas, link, status, quem participou).</td></tr>
          <tr><td>Abas <i>Modelos de proposta</i> e <i>Propostas</i></td><td>Os orçamentos. O conteúdo fica numa coluna em formato de texto técnico.</td></tr>
          <tr><td>Abas <i>Modelos de contrato</i> e <i>Contratos</i></td><td>Texto dos contratos, assinaturas e registro (data, IP, código).</td></tr>
          <tr><td>Aba <i>Perfis excluídos</i></td><td>Cópia de quem foi excluído pelo painel, com a data.</td></tr>
          <tr><td>Drive: <i>Bounce Basement · Castings / casting / data - Nome</i></td><td>Uma pasta por pessoa com as fotos e os vídeos.</td></tr>
        </tbody></table></div>
      <p class="man-alerta">⚠ <b>Edite pelo painel, não direto na planilha.</b> Listas, propostas e contratos guardam o conteúdo em formato técnico;
        uma edição manual errada pode quebrar o link. A planilha tem CPF e endereço: não compartilhe com quem não precisa.</p>
    </section>

    <section class="man-sec" id="man-inscricoes">
      <h3><span>//01</span> INSCRIÇÕES</h3>
      <div class="man-cols">
        <div><h4>Como funciona</h4>
          <ol>
            <li>A pessoa preenche o formulário do site.</li>
            <li>O sistema cria a <b>linha na planilha</b> e a <b>pasta no Drive</b> antes de enviar os arquivos.</li>
            <li>Fotos e vídeos vão direto do celular dela para a pasta.</li>
            <li>No fim, o sistema confere os arquivos e marca a linha como <b>✅ COMPLETO</b>.</li>
          </ol></div>
        <div><h4>A lógica</h4>
          <p>Se a pessoa fechar a página no meio do envio, a linha fica <b>⚠ INCOMPLETO</b> e o card mostra o selo
            <b>ARQUIVOS INCOMPLETOS</b>. O perfil existe, mas faltam fotos ou vídeos: chame no WhatsApp e peça para reenviar.</p>
          <p>Busca e filtros só mudam o que você vê; nada é alterado. Os filtros se somam.</p></div>
      </div>
      ${tour('inscricoes')}
    </section>

    <section class="man-sec" id="man-funil">
      <h3><span>//02</span> FUNIL (TRIAGEM)</h3>
      <div class="man-cols">
        <div><h4>Como fazer</h4>
          <ul>
            <li><b>Pela ficha:</b> clique no card e escolha a etapa.</li>
            <li><b>Pelo FUNIL:</b> arraste o card para outra coluna.</li>
            <li><b>CONTATAR NO WHATSAPP</b> abre a conversa com a mensagem pronta da etapa.</li>
            <li><b>Anotações</b> são internas (o contratante nunca vê). Clique em SALVAR ANOTAÇÃO.</li>
          </ul></div>
        <div><h4>A lógica</h4>
          <p>Toda inscrição nova começa em <b>${esc(etapas[0] || 'Novo')}</b>. A etapa é só para a sua organização:
            ela <b>não</b> coloca nem tira ninguém das listas.</p>
          <p>A tela muda na hora e salva na planilha em seguida. Se der erro, a mudança volta atrás e aparece um aviso vermelho.</p></div>
      </div>
      <div class="man-etapas">${etapas.map((e, i) => `<div><b class="etapa e${i}">${esc(e.toUpperCase())}</b>
        <span class="muted">${mensagens[e] ? `“${esc(mensagens[e].replace(/\{nome\}/g, 'Nome'))}”` : ''}</span></div>`).join('')}</div>
      <p class="muted">As etapas e as mensagens ficam em <code>casting.config.js</code> → <code>crm</code>.</p>
      ${tour('funil')}
    </section>

    <section class="man-sec" id="man-listas">
      <h3><span>//03</span> LISTAS PARA CONTRATANTES</h3>
      <div class="man-cols">
        <div><h4>Como fazer</h4>
          <ol>
            <li>Em INSCRIÇÕES → <b>SELECIONAR PARA LISTA</b>, marque os perfis.</li>
            <li><b>ADICIONAR A UMA LISTA</b> → escolha uma ou crie nova (nome, evento, data, contratante).</li>
            <li>Na lista: reordene, tire perfis e escreva uma nota para o contratante. Clique em <b>SALVAR LISTA</b>.</li>
            <li>Mande o link: <b>COPIAR</b>, <b>WHATSAPP</b> ou <b>E-MAIL</b>. Use <b>VER COMO CONTRATANTE</b> para conferir.</li>
          </ol></div>
        <div><h4>A lógica</h4>
          <ul>
            <li>O contratante <b>só visualiza</b>: fotos, vídeos, medidas, estilos e experiência. Contato, CPF, endereço,
              nome completo e nascimento <b>nunca aparecem</b>. O nome aparece como <b>primeiro nome + inicial do sobrenome</b>
              (ex.: “Ana S.”) — nome artístico sem sobrenome (ex.: “MC Lua”) fica como está. Vale para lista, proposta e contrato.</li>
            <li>Fotos e vídeos têm botão <b>↓ BAIXAR</b> e o arquivo sai com esse nome: “Ana S - foto 1.jpg”, “Ana S - video 1.mp4”.</li>
            <li>O link tem um código secreto. <b>Gerar novo link</b> troca o código (o antigo para de abrir). <b>Encerrar</b> desliga o link.</li>
            <li>Os vídeos de quem está numa lista <b>ativa</b> ficam “qualquer pessoa com o link” no Drive; ao sair de todas as
              listas ativas, o compartilhamento é desligado sozinho.</li>
            <li>Se duas pessoas editarem a mesma lista ao mesmo tempo, a segunda é avisada para recarregar — nada é sobrescrito.</li>
          </ul></div>
      </div>
      ${tour('selecionar')}
    </section>

    <section class="man-sec" id="man-propostas">
      <h3><span>//04</span> PROPOSTAS</h3>
      <div class="man-cols">
        <div><h4>Como fazer</h4>
          <ol>
            <li>Na lista do elenco, clique em <b>PROPOSTA</b> (ou PROPOSTAS → <b>+ NOVA PROPOSTA</b>).</li>
            <li>Escolha o modelo. Contratante, evento e data vêm da lista.</li>
            <li>Ajuste textos e valores só desta proposta e clique em <b>SALVAR PROPOSTA</b>.</li>
            <li>Mande o link. Na página, <b>SALVAR EM PDF</b> gera o arquivo.</li>
            <li>Mude o status conforme a resposta: Rascunho → Enviada → Aprovada / Recusada.</li>
          </ol></div>
        <div><h4>A lógica</h4>
          <ul>
            <li><b>Modelo → cópia:</b> a proposta nasce como cópia do modelo. Editar o modelo depois não muda as propostas existentes.</li>
            <li><b>Cálculo:</b> cachê por bailarina × quantidade de perfis da lista (ou a quantidade que você digitar).
              Cada item é <b>Valor</b>, <b>A combinar</b> ou <b>Cortesia</b>; o total soma sozinho.</li>
            <li>O status é só organização: o link funciona em todos. <b>Excluir</b> desliga o link.</li>
            <li><b>DUPLICAR P/ OUTRO CONTRATANTE</b> cria uma cópia independente.</li>
            <li><b>Fotos:</b> cada seção aceita até 8 fotos (ex.: fotos do estúdio), que aparecem ao lado dos itens. Coloque no
              <b>modelo</b> para todas as propostas novas já virem com elas.</li>
            <li><b>Nada é cortado:</b> se uma seção tiver texto demais, a página cresce no link e, no PDF, a letra daquela página
              diminui para caber. O editor avisa quando isso acontece.</li>
            <li><b>Textos fixos</b> (“informações gerais”, “investimento”, frase final, rodapé da capa…), os <b>dados das bailarinas</b>
              que aparecem e os <b>contatos</b> da última página são escolhidos no fim do editor.</li>
          </ul></div>
      </div>
      ${tour('propostas')}
    </section>

    <section class="man-sec" id="man-contrato">
      <h3><span>//05</span> CONTRATO</h3>
      <p class="man-alerta">Antes do primeiro uso: PROPOSTAS → MODELOS DE CONTRATO → preencha o que está <b>[entre colchetes]</b>
        (razão social, CNPJ e responsável da Bounce). O texto é um modelo base: o ideal é um advogado revisar.</p>
      <ol class="man-status">
        <li><b>GERAR CONTRATO</b><span>na proposta. O texto puxa escopo, valores, data, local e elenco.</span></li>
        <li><b class="warn">AGUARDANDO CONTRATANTE</b><span>ele abre o link, preenche CPF/CNPJ, endereço e e-mail e assina. A proposta vira <i>Aprovada</i>.</span></li>
        <li><b class="warn">AGUARDANDO BOUNCE</b><span>você clica em <b>ASSINAR PELA BOUNCE</b>.</span></li>
        <li><b class="ok">ASSINADO</b><span>o link mostra o contrato das duas partes e o <b>BAIXAR PDF</b>, com página de registro (data, hora, IP, e-mail e código).</span></li>
      </ol>
      <p>Se a proposta mudar depois de gerar o contrato, o painel avisa: <b>cancele e gere de novo</b> para atualizar os valores.</p>
      ${tour('contrato')}
    </section>

    <section class="man-sec" id="man-relatorio">
      <h3><span>//06</span> CONCLUIR E RELATÓRIO</h3>
      <div class="man-cols">
        <div><h4>Como fazer</h4>
          <ol>
            <li>Depois do evento, abra a lista → <b>✓ CONCLUIR TRABALHO</b>.</li>
            <li>Marque <b>quem participou</b> e escreva o resultado (opcional).</li>
            <li>Veja tudo em <b>RELATÓRIO</b> e use <b>BAIXAR PLANILHA (CSV)</b> se precisar.</li>
          </ol></div>
        <div><h4>A lógica</h4>
          <p>Concluir desliga o link do contratante e move a lista para o relatório. A ficha de cada perfil passa a mostrar
            “✓ participou”. Uma lista concluída pode ser editada, reaberta ou excluída (excluir tira do painel e do relatório;
            na planilha a linha fica marcada como “Excluída”).</p></div>
      </div>
      ${tour('relatorio')}
    </section>

    <section class="man-sec" id="man-status">
      <h3>RESUMO DOS STATUS</h3>
      <div class="man-tabela"><table>
        <thead><tr><th>Item</th><th>Status possíveis</th></tr></thead>
        <tbody>
          <tr><td>Inscrição</td><td>✅ COMPLETO · ⚠ INCOMPLETO (faltam arquivos)</td></tr>
          <tr><td>Funil</td><td>${etapas.map(esc).join(' → ')}</td></tr>
          <tr><td>Lista</td><td><b>Ativa</b> (link funciona) · <b>Encerrada</b> (link desligado, pode reativar) · <b>Concluída</b> (vai para o relatório)</td></tr>
          <tr><td>Proposta</td><td>Rascunho · Enviada · Aprovada · Recusada</td></tr>
          <tr><td>Contrato</td><td>Aguardando contratante → Aguardando Bounce → Assinado · Cancelado</td></tr>
        </tbody></table></div>
    </section>

    <section class="man-sec" id="man-faq">
      <h3>DÚVIDAS RÁPIDAS</h3>
      <details><summary>O link da lista vazou ou foi para a pessoa errada.</summary>
        <p>Na lista, clique em <b>Gerar novo link</b>. O antigo para de funcionar na hora; mande o novo para quem deve ver.</p></details>
      <details><summary>Como tiro alguém de uma lista sem excluir o perfil?</summary>
        <p>Abra a lista, clique no <b>✕</b> ao lado da pessoa e em <b>SALVAR LISTA</b>. O perfil continua nas inscrições.</p></details>
      <details><summary>O que acontece quando excluo um perfil?</summary>
        <p>A linha sai da aba do casting e vai para <i>Perfis excluídos</i>, a pessoa sai das listas em andamento e a pasta vai para a
          lixeira do Drive (recuperável por 30 dias). Para apagar de vez (pedido de LGPD), apague também a linha em <i>Perfis excluídos</i>
          e esvazie a lixeira do Drive.</p></details>
      <details><summary>Mudei algo e não apareceu para o contratante.</summary>
        <p>Listas e propostas só atualizam o link depois de <b>SALVAR</b>. Se a barra “Alterações não salvas” estiver aparecendo, falta salvar.</p></details>
      <details><summary>O painel pediu a senha de novo.</summary>
        <p>O login vale por 12 horas e só nesta aba. Fechar a aba também pede a senha de novo. A senha é a variável <code>ADMIN_SENHA</code>.</p></details>
      <details><summary>Quero abrir um novo casting.</summary>
        <p>Troque o <code>slug</code> em <code>casting.config.js</code> e publique: o novo casting ganha outra pasta no Drive e outra aba na mesma planilha.
          <code>ativo: false</code> encerra as inscrições.</p></details>
      <details><summary>O PDF saiu diferente do link.</summary>
        <p>O botão <b>SALVAR EM PDF</b> monta o arquivo a partir da própria visualização: cada slide vira uma página igual ao link,
          inclusive pelo celular, e o download começa sozinho (“Proposta Bounce - nome do projeto.pdf”). Os botões e links continuam
          clicáveis no PDF. Se o navegador for muito antigo, ele abre a impressão do navegador como plano B.</p></details>
      <details><summary>O Drive está ficando cheio.</summary>
        <p>A conta gratuita tem 15 GB e cada inscrição com vídeos pode passar de 300 MB. Diminua <code>maxSizeMB</code> dos vídeos,
          use uma conta Google só para castings ou aumente o espaço (Google One).</p></details>
    </section>`;

  root.querySelectorAll('[data-tour]').forEach((b) => b.addEventListener('click', () => iniciarTour(b.dataset.tour)));
  root.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => {
    root.querySelector(`#man-${b.dataset.ir}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

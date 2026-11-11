# Casting · Bounce Basement

Landing page de inscrição para castings.
**Hospedagem:** Vercel · **Fotos e vídeos:** Google Drive · **Respostas:** Google Sheets

Como funciona:
1. A pessoa preenche o formulário.
2. É criada uma pasta para ela no seu Drive (`Bounce Basement · Castings / casting-show-1212 / 2026-11-02 - Nome`).
3. As fotos e vídeos vão **direto do celular dela para essa pasta** (não passam pela Vercel, então não há limite de tamanho por lá).
4. As respostas viram uma linha na planilha, com o link da pasta e o status `✅ COMPLETO` ou `⚠ INCOMPLETO`.

---

## 1. Testar no computador

Precisa do Node.js 20+ (https://nodejs.org). No Windows, dê dois cliques em **INICIAR.bat**, ou:

```bash
npm install
npm run dev        # abre http://localhost:5173
```

Enquanto o Google não estiver configurado, o formulário roda em **modo de teste**:
as inscrições vão para a pasta `teste-local/` do projeto (com uma planilha .csv).

## 2. Configurar o Google (uma vez só, ~10 min)

1. Entre em **https://console.cloud.google.com** com a conta Google onde quer guardar os arquivos
   e crie um projeto (ex.: "Casting Bounce").
2. Menu **APIs e serviços → Biblioteca**: ative a **Google Drive API** e a **Google Sheets API**.
3. Menu **Google Auth Platform** (ou "Tela de consentimento OAuth"):
   - Tipo de usuário **Externo**, nome do app "Casting Bounce", seu e-mail.
   - Em **Público**, clique em **PUBLICAR APP** (status "Em produção").
     ⚠️ Se ficar em "Teste", a autorização expira em 7 dias e o formulário para de salvar.
4. Em **Clientes → Criar cliente**, escolha o tipo **App para computador** e copie o
   **Client ID** e o **Client Secret**.
5. Na pasta do projeto, dê dois cliques em **CONECTAR-GOOGLE.bat** (ou rode `npm run google`):
   cole o ID e o Secret, autorize no navegador.
   - O Google vai mostrar "O Google não verificou este app" — é o seu próprio app:
     clique em **Avançado → Acessar Casting Bounce**.
   - O app só consegue ver os arquivos que ele mesmo criar (permissão `drive.file`), não o resto do seu Drive.
6. O script cria a pasta **Bounce Basement · Castings** e a planilha de inscrições no seu Drive,
   salva tudo em `.env.local` e mostra as **5 variáveis** para a Vercel.

A partir daí, `npm run dev` já salva no Drive de verdade.

## 3. Publicar na Vercel

1. Suba o projeto para um repositório no GitHub (o `.env.local` **não** vai junto — ele está no `.gitignore`).
2. Em **vercel.com → Add New → Project**, importe o repositório (a Vercel detecta Vite sozinha).
3. Em **Settings → Environment Variables**, crie as 5 variáveis que o script mostrou:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID`, `SHEET_ID`.
4. Faça o deploy. Mande o link para as dançarinas. 🎉

## Painel das inscrições (/admin)

Em **seudominio/admin** (no computador: http://localhost:5173/admin.html) você vê todos os perfis:
cards com foto, filtros (gênero, estilo, disponibilidade, experiência), busca, e a ficha completa
com fotos, vídeos (abrem no Drive), WhatsApp, Instagram e pasta.

- A senha fica na variável **ADMIN_SENHA**. O PUBLICAR-VERCEL.bat pede para você criar uma na primeira vez
  e envia para a Vercel. Para trocar: edite `ADMIN_SENHA` no `.env.local` e publique de novo
  (ou mude direto na Vercel → Settings → Environment Variables).
- No modo de teste local, sem senha configurada, a senha é `admin`.
- O login vale por 12 horas.

## Manual e tour guiado (/admin → MANUAL e ? TOUR)

- **? TOUR** (no menu do painel) destaca cada parte da tela, na ordem do trabalho: inscrições → funil → lista → proposta → contrato → relatório.
  Na primeira vez que o painel abre em um navegador, o tour é oferecido sozinho (depois só pelo botão).
- **MANUAL** explica o passo a passo e a lógica de cada etapa, onde ficam os dados, os status e as dúvidas comuns.
  Cada seção tem um botão **▶ VER NO TOUR** que abre o tour naquele ponto.
- Arquivos: `src/tour.js` (passos do tour) e `src/manual.js` (texto do manual). Para mudar um texto, edite ali e publique.

## Listas para contratantes (/admin → LISTAS)

Para montar um elenco para um evento e mandar para quem contratou:

1. Em **INSCRIÇÕES**, clique em **SELECIONAR PARA LISTA**, marque os perfis (dá para usar os filtros e
   **SELECIONAR OS N VISÍVEIS**) e clique em **ADICIONAR A UMA LISTA** → escolha uma lista ou crie uma nova
   (nome, evento, data, contratante). Também dá para adicionar pela ficha de cada perfil.
2. Na página da lista: reordene, tire perfis, escreva uma **nota para o contratante** em cada um e clique em **SALVAR LISTA**.
3. **COPIAR** / **ENVIAR NO WHATSAPP** / **E-MAIL** mandam o link. O contratante só visualiza: fotos, vídeos, medidas,
   estilos e experiência. **Contato, CPF, endereço, nome completo e data de nascimento nunca aparecem.**
   Os campos visíveis ficam em `listas.campos` no `casting.config.js`.
   O nome aparece como primeiro nome + inicial do sobrenome ("Ana S.", regra em `shared/nome.js`) na lista, na proposta e no contrato,
   e os downloads saem como "Ana S - foto 1.jpg" / "Ana S - video 1.mp4" (os vídeos de listas ativas são renomeados no Drive).

- Pode ter quantas listas quiser ao mesmo tempo, e uma pessoa pode estar em várias. Cada lista é uma linha da aba
  **Listas para contratantes** da planilha. O funil do CRM continua independente.
- **Encerrar lista** desliga o link. **Gerar novo link** invalida o antigo (use se o link vazar).
- Se duas pessoas editarem a mesma lista ao mesmo tempo, a segunda é avisada para recarregar (nada é sobrescrito).
- **Vídeos:** para tocarem na página do contratante, os vídeos de quem está em alguma lista **ativa** ficam com
  "qualquer pessoa com o link pode ver" no Drive. Quando a pessoa sai de todas as listas ativas (ou a lista é
  encerrada/excluída), o compartilhamento é desligado automaticamente. As fotos passam pelo servidor e não são compartilhadas.

### Concluir trabalho e relatório

- Depois do evento, abra a lista e clique em **✓ CONCLUIR TRABALHO**: marque **quem participou** e escreva o
  resultado (opcional). O link do contratante é desligado e a lista vai para a aba **RELATÓRIO** do painel.
- O **RELATÓRIO** mostra todos os trabalhos (data, evento, contratante, quem participou, resultado), um resumo
  **por perfil** (quantos trabalhos cada pessoa fez e onde) e o botão **BAIXAR PLANILHA (CSV)**.
  Na ficha de cada perfil aparece o histórico de listas (✓ participou).
- Uma lista concluída pode ser editada, reaberta ou excluída. **Excluir lista** tira do painel e do relatório
  (a linha continua na planilha marcada como "Excluída").

## Propostas para contratantes (/admin → PROPOSTAS)

Orçamento padronizado para mandar a produtores, no mesmo visual de apresentação (fundo escuro, seções //01, //02…).

1. **Modelos:** em PROPOSTAS → MODELOS fica o texto e os valores padrão (o primeiro modelo, "Proposta padrão Bounce",
   é criado sozinho com casting, direção e criação, styling, local de ensaio, equipe e entrega pós-show).
   Dá para ter vários modelos (ex.: um só de casting, outro para videoclipe). Mudar um modelo não altera propostas já criadas.
2. **Criar a proposta:** abra a lista do elenco e clique em **PROPOSTA** (ou PROPOSTAS → + NOVA PROPOSTA). Escolha o modelo:
   contratante, evento e data vêm da lista. Ajuste o que quiser só nesta proposta e clique em **SALVAR PROPOSTA**.
3. **Valores:** o cachê por bailarina é multiplicado pela quantidade de perfis da lista (ou pela quantidade que você digitar).
   Cada item pode ser **Valor**, **A combinar** ou **Cortesia**. O total é calculado sozinho.
4. **Enviar:** COPIAR / WHATSAPP / E-MAIL mandam o link. Na página, o botão **SALVAR EM PDF** baixa o arquivo
   montado a partir da visualização (`src/pdf.js`: cada slide vira uma página igual ao link, sem usar a impressão do navegador). O elenco aparece com foto, nome artístico, idade, altura, blusa e calça —
   contato, CPF e endereço nunca aparecem.
5. **Outro contratante:** na proposta, **DUPLICAR P/ OUTRO CONTRATANTE** cria uma cópia com o mesmo conteúdo.
6. **Status:** Rascunho, Enviada, Aprovada ou Recusada (só para organizar; o link funciona em todos). **Excluir** desliga o link.

7. **Fotos nas seções:** cada seção aceita até 8 fotos (ex.: estúdio). Elas são reduzidas no navegador e guardadas na pasta
   **Fotos das propostas** do Drive; a página do contratante mostra por links temporários (nada fica público).
8. **Nada é cortado:** a página cresce com o conteúdo; no PDF, a letra de uma página com texto demais diminui para caber (até 60%).
   O editor avisa quando uma seção passa do tamanho de um slide.
9. **Textos fixos** (capa, “informações gerais”, “investimento”, frase final…), **dados das bailarinas** mostrados e **contatos** da
   última página são editáveis no fim do editor da proposta/modelo.

Ficam nas abas **Modelos de proposta** e **Propostas** da planilha (o conteúdo vai numa coluna em formato de texto: edite pelo painel).

### Contrato com assinatura eletrônica

Depois que o contratante aprovar a proposta:

1. **Antes do primeiro uso:** em PROPOSTAS → MODELOS DE CONTRATO, abra "Contrato padrão Bounce" e preencha o que está
   **[entre colchetes]** (razão social, CNPJ e responsável da Bounce). Revise as cláusulas de pagamento e cancelamento —
   o texto é um modelo base e o ideal é um advogado revisar.
2. Na proposta, clique em **GERAR CONTRATO**. O texto puxa da proposta o escopo, os valores, a data, o local e os nomes artísticos do elenco.
3. Mande o link do contrato (ou o contratante clica em **ACEITAR E ASSINAR** na própria proposta). Ele preenche CPF ou CNPJ,
   endereço e e-mail, assina com o dedo/mouse (ou digitando o nome) e aceita os termos. A proposta passa para **Aprovada**.
4. Você recebe o status **Aguardando Bounce** no painel → **ASSINAR PELA BOUNCE**. Pronto: o link mostra o contrato
   assinado pelas duas partes e o botão **BAIXAR PDF** (com uma página de registro: data, hora, IP, e-mail e código de verificação).

- Se a proposta mudar depois de gerar o contrato, o painel avisa: cancele e gere de novo para atualizar os valores.
- Tudo fica nas abas **Modelos de contrato** e **Contratos** da planilha.
- Campos que o texto aceita: `{{contratante_qualificacao}}`, `{{contratante_nome}}`, `{{assinante_nome}}`, `{{projeto}}`, `{{evento}}`,
  `{{data_evento}}`, `{{local}}`, `{{qtd_bailarinas}}`, `{{elenco}}`, `{{escopo}}`, `{{valores}}`, `{{total}}`,
  `{{condicoes_bailarinas}}`, `{{observacoes}}`, `{{validade}}`, `{{data_assinatura}}`.

### Excluir perfil

Na ficha do perfil (lá embaixo) → **EXCLUIR PERFIL**. A linha sai da aba do casting e é copiada para a aba
**Perfis excluídos** (com a data), a pessoa sai das listas em andamento (nas concluídas o nome fica no histórico)
e a pasta de fotos/vídeos vai para a **lixeira do Drive** (recuperável por 30 dias). Para apagar de vez
(ex.: pedido de LGPD), apague também a linha em "Perfis excluídos" e esvazie a lixeira do Drive.

## Espaço no Drive

A conta Google gratuita tem 15 GB (divididos com Gmail e Fotos). Cada inscrição com 3 vídeos pode
passar de 300 MB. Se for receber muitas inscrições, diminua `maxSizeMB` dos vídeos em
`casting.config.js`, use uma conta Google só para castings ou aumente o espaço (Google One).

## Reutilizar em outras seleções

Edite só o **`casting.config.js`**:
- Troque o `slug` (ex.: `casting-videoclipe-2027`): o novo casting ganha **outra subpasta no Drive e outra aba na mesma planilha**, automaticamente.
- Ajuste textos, datas (`hero`, `destaques`) e perguntas (`secoes`).
- `ativo: false` encerra as inscrições.

Tipos de campo: `text`, `email`, `tel`, `cpf`, `date`, `age`, `number`, `select`, `radio`,
`checkboxes` (com `other`), `textarea`, `files` (`max`, `maxSizeMB`, `maxDurationSec`).
`showIf: { field: 'campo', equals: 'Sim' }` mostra uma pergunta só em certos casos.

## Visual

Cores e fontes no topo de `src/style.css` (`--bg`, `--accent`, `--font-display`…).

## Estrutura

```
casting.config.js    ← perguntas e textos (edite aqui)
index.html, src/     ← página
api/iniciar.js       ← valida, cria pasta no Drive, linha na planilha, links de upload
api/finalizar.js     ← confere os arquivos e marca a inscrição como completa
api/admin/[rota].js  ← uma função só para todo o painel (limite de 12 funções do plano grátis da Vercel)
rotas/admin/*.js     ← as rotas do painel (listas, propostas, contratos, login…)
api/lista.js, lista.html ← página do contratante (só visualização)
rotas/admin/propostas.js ← modelos e propostas (painel)
api/proposta.js, proposta.html ← página da proposta (link + PDF)
lib/propostas.js     ← regras das propostas (planilha, elenco)
shared/proposta.js   ← modelo padrão e cálculo dos totais
api/contrato.js, contrato.html ← página de assinatura do contrato
rotas/admin/contratos.js ← gerar contrato, assinar pela Bounce, modelos
lib/contratos.js     ← regras dos contratos (planilha, assinatura, registro)
shared/contrato.js   ← texto padrão do contrato e campos {{...}}
shared/assinatura.js ← campo de assinatura (desenhar/digitar)
lib/listas.js        ← regras das listas (planilha, link, vídeos)
lib/google.js        ← conversa com Drive e Sheets
scripts/google-setup.js ← "npm run google"
server.js, dev.js    ← só para rodar no computador
```

**Privacidade:** a planilha tem CPF e endereço. Não compartilhe a planilha/pasta com quem não precisa.

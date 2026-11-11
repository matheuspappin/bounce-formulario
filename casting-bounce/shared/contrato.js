// Regras do contrato (painel, página de assinatura e servidor).
// O texto do contrato é um modelo com campos {{assim}}: os da proposta são preenchidos quando o contrato
// é gerado, e os do contratante quando ele preenche os dados para assinar.
import { calcular, textoLinha, detalheLinha, brl, LETRAS } from './proposta.js';
import { isValidCPF, onlyDigits } from './rules.js';

export const STATUS_CONTRATO = {
  cliente: 'Aguardando contratante', bounce: 'Aguardando Bounce', assinado: 'Assinado', cancelado: 'Cancelado',
};

export function isValidCNPJ(v) {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (len) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(c[i]) * p, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}
export const formatarCPF = (v) => onlyDigits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
export const formatarCNPJ = (v) => onlyDigits(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
export const formatarDoc = (v) => (onlyDigits(v).length === 14 ? formatarCNPJ(v) : formatarCPF(v));
/** CPF/CNPJ com o miolo escondido, para o registro de assinaturas. */
export const mascararDoc = (v) => {
  const d = onlyDigits(v);
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return formatarCNPJ(d);
  return '';
};

const dataBR = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.split('-').reverse().join('/') : d || '');

/** Campos que vêm da proposta (preenchidos ao gerar o contrato). */
export function camposDaProposta({ conteudo: c, nLista = 0, elenco = [] }) {
  const r = calcular(c, nLista);
  const linhaValor = (it, porBailarina) => {
    const det = detalheLinha(it);
    return `- ${it.descricao}${det ? ` (${det})` : ''}: ${textoLinha(it)}${porBailarina && it.modo === 'valor' && String(it.valor).trim() ? ' por bailarina' : ''}`;
  };
  const escopo = c.secoes.map((s, i) => [
    `**${i + 1}. ${s.titulo}**`,
    ...s.itens.map((it, j) => `${LETRAS[j] || '-'}) ${it}`),
    ...(s.nota ? [`Obs.: ${s.nota}`] : []),
  ].join('\n')).join('\n\n');
  const valores = [
    ...(c.cacheBailarina.length ? [`**Elenco (${r.n || '—'} ${r.n === 1 ? 'bailarina' : 'bailarinas'})**`,
      ...c.cacheBailarina.map((it) => linhaValor(it, true)),
      `- Subtotal do elenco: ${brl(r.totalElenco)}`] : []),
    ...(c.bounce.length ? ['', '**Bounce Basement**', ...c.bounce.map((it) => linhaValor(it, false)),
      `- Subtotal Bounce Basement: ${brl(r.totalBounce)}`] : []),
  ].join('\n');
  return {
    projeto: c.projeto || c.evento || '',
    evento: c.evento || c.projeto || '',
    data_evento: dataBR(c.data) || 'a definir',
    local: c.local || 'a definir',
    qtd_bailarinas: r.n ? String(r.n) : 'a definir',
    elenco: elenco.length ? elenco.join(', ') : 'a definir em comum acordo entre as partes',
    escopo,
    valores,
    total: `${brl(r.total)}${r.aCombinar ? ' (mais os itens “a combinar”)' : ''}`,
    condicoes_bailarinas: c.condicoesBailarinas.map((x) => `- ${x}`).join('\n'),
    observacoes: c.observacoes || '',
    validade: c.validade || '',
  };
}

/** Campos que vêm do contratante (preenchidos na hora de assinar). */
export function camposDoCliente(cli = {}, dataAssinatura = '') {
  const pj = cli.tipo === 'PJ';
  const nome = cli.nome || '';
  const doc = cli.documento ? formatarDoc(cli.documento) : '';
  const vazio = '________________';
  const qualificacao = pj
    ? `${nome || vazio}, pessoa jurídica inscrita no CNPJ sob o nº ${doc || vazio}, com sede em ${cli.endereco || vazio}, neste ato representada por ${cli.representante || vazio}, CPF nº ${cli.representanteCpf ? formatarCPF(cli.representanteCpf) : vazio}`
    : `${nome || vazio}, inscrito(a) no CPF sob o nº ${doc || vazio}, residente e domiciliado(a) em ${cli.endereco || vazio}`;
  return {
    contratante_nome: nome || vazio,
    contratante_documento: doc || vazio,
    contratante_endereco: cli.endereco || vazio,
    contratante_email: cli.email || vazio,
    contratante_qualificacao: qualificacao,
    assinante_nome: (pj ? cli.representante : nome) || vazio,
    data_assinatura: dataAssinatura || vazio,
  };
}

/** Troca os {{campos}} pelo valor. Campos desconhecidos ficam como estão. */
export const preencher = (texto, mapa) => String(texto || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in mapa ? mapa[k] : m));

/** Texto do contrato → HTML (## título de cláusula, - item, **negrito**, linha em branco = parágrafo). */
export function textoParaHtml(texto, esc) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return String(texto || '').split(/\n{2,}/).map((bloco) => {
    const linhas = bloco.split('\n').filter((l) => l.trim() !== '');
    if (!linhas.length) return '';
    if (linhas.length === 1 && linhas[0].startsWith('# ')) return `<h1>${inline(linhas[0].slice(2))}</h1>`;
    if (linhas[0].startsWith('## ')) {
      const resto = linhas.slice(1);
      return `<h2>${inline(linhas[0].slice(3))}</h2>${resto.length ? textoParaHtml(resto.join('\n'), esc) : ''}`;
    }
    if (linhas.every((l) => l.startsWith('- '))) return `<ul>${linhas.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${linhas.map((l) => (l.startsWith('- ') ? `• ${inline(l.slice(2))}` : inline(l))).join('<br>')}</p>`;
  }).join('');
}

export const CAMPOS_AJUDA = [
  ['{{contratante_qualificacao}}', 'nome, CPF/CNPJ e endereço do contratante (frase completa)'],
  ['{{contratante_nome}}', 'nome ou razão social do contratante'],
  ['{{assinante_nome}}', 'quem assina pelo contratante'],
  ['{{projeto}} · {{evento}}', 'nome do projeto / evento'],
  ['{{data_evento}} · {{local}}', 'data e local do evento'],
  ['{{qtd_bailarinas}} · {{elenco}}', 'quantidade e nomes artísticos do elenco'],
  ['{{escopo}}', 'as seções da proposta, com a), b), c)'],
  ['{{valores}} · {{total}}', 'tabela de valores e total'],
  ['{{condicoes_bailarinas}}', 'alimentação, deslocamento…'],
  ['{{observacoes}} · {{validade}}', 'observações da proposta'],
  ['{{data_assinatura}}', 'data em que o contratante assinou'],
];

export const CONTRATO_PADRAO = `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ARTÍSTICOS

Pelo presente instrumento particular, de um lado {{contratante_qualificacao}}, doravante denominado(a) **CONTRATANTE**; e, de outro lado, **BOUNCE BASEMENT** [RAZÃO SOCIAL COMPLETA], inscrita no CNPJ sob o nº [CNPJ DA BOUNCE], com sede na Avenida Loureiro da Silva, 1940, sala 1603, Cidade Baixa, Porto Alegre/RS, neste ato representada por [NOME DO RESPONSÁVEL], doravante denominada **CONTRATADA**, têm entre si justo e contratado o seguinte:

## CLÁUSULA 1ª — DO OBJETO
O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços de produção de elenco, direção, criação coreográfica e produção artística para o projeto **{{projeto}}**, a realizar-se em {{data_evento}}, em {{local}}, com elenco de {{qtd_bailarinas}} bailarinas.

## CLÁUSULA 2ª — DO ESCOPO
Os serviços compreendem o descrito na proposta comercial aceita pelo CONTRATANTE, a saber:

{{escopo}}

Elenco previsto: {{elenco}}. Eventuais substituições de integrantes do elenco serão comunicadas ao CONTRATANTE, mantendo-se perfil equivalente.

## CLÁUSULA 3ª — DO VALOR
Pelos serviços, o CONTRATANTE pagará à CONTRATADA o valor total de **{{total}}**, conforme a composição abaixo:

{{valores}}

Os itens indicados como “a combinar” terão seus valores definidos por escrito entre as partes (por e-mail ou aditivo) antes de sua execução.

## CLÁUSULA 4ª — DA FORMA DE PAGAMENTO
O pagamento será feito da seguinte forma: 50% (cinquenta por cento) na assinatura deste contrato e 50% (cinquenta por cento) até 2 (dois) dias antes da data do evento, mediante depósito ou PIX em conta da CONTRATADA, contra emissão de nota fiscal. O atraso sujeitará o CONTRATANTE a multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês sobre o valor em aberto.

## CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA
- Selecionar, contratar e coordenar o elenco, realizando o repasse dos cachês aos bailarinos.
- Realizar os ensaios e a direção artística conforme o escopo da Cláusula 2ª.
- Garantir a presença do elenco, uniformizado e identificado, nos horários combinados.
- Emitir nota fiscal dos valores recebidos.

## CLÁUSULA 6ª — DAS OBRIGAÇÕES DO CONTRATANTE
- Efetuar os pagamentos nas datas acordadas.
- Fornecer as informações necessárias (roteiro, músicas, horários, moodboard) com antecedência.
- Responsabilizar-se pelas seguintes condições do elenco no dia do evento:
{{condicoes_bailarinas}}
- Arcar com a compra e o aluguel de peças de figurino e eventual taxa de lavagem, quando houver.
- Garantir espaço adequado e seguro para a apresentação e camarim para o elenco.

## CLÁUSULA 7ª — DO CANCELAMENTO
Em caso de cancelamento pelo CONTRATANTE com menos de 15 (quinze) dias de antecedência do evento, será devido 50% (cinquenta por cento) do valor total; com menos de 5 (cinco) dias, o valor integral. Serviços já executados (ensaios, criação, produção de moda) serão sempre devidos. Casos fortuitos ou de força maior, devidamente comprovados, permitirão a remarcação da data em comum acordo, sem multa.

## CLÁUSULA 8ª — DO USO DE IMAGEM E DA CRIAÇÃO
O CONTRATANTE poderá utilizar imagens da apresentação para divulgação do projeto {{projeto}}, citando a Bounce Basement. Qualquer outro uso comercial das imagens do elenco depende de autorização por escrito. As coreografias criadas são de autoria da CONTRATADA, licenciadas ao CONTRATANTE para uso no projeto objeto deste contrato.

## CLÁUSULA 9ª — DA PROTEÇÃO DE DADOS
As partes tratarão os dados pessoais trocados em razão deste contrato apenas para sua execução, nos termos da Lei nº 13.709/2018 (LGPD).

## CLÁUSULA 10ª — DA ASSINATURA ELETRÔNICA
As partes reconhecem a validade deste contrato assinado eletronicamente, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001, e concordam que o registro de assinaturas (data, hora, endereço IP, e-mail e código de verificação do documento) é prova suficiente da autoria e da integridade deste instrumento.

## CLÁUSULA 11ª — DO FORO
Fica eleito o foro da Comarca de Porto Alegre/RS para dirimir quaisquer dúvidas oriundas deste contrato.

Porto Alegre, {{data_assinatura}}.`;

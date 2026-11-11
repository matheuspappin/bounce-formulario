/**
 * CONFIGURAÇÃO DO CASTING
 * ------------------------------------------------------------
 * Este é o único arquivo que você precisa editar para criar uma
 * nova seleção: troque textos, datas, adicione/remova campos.
 * O formulário, a validação, o painel /admin e a planilha CSV
 * são gerados automaticamente a partir daqui.
 *
 * Tipos de campo: text, email, tel, cpf, date, age, number,
 * select, radio, checkboxes, textarea, files
 * Opções úteis: required, placeholder, hint, options, other (campo "Outros"), minAge (datas),
 * showIf / requiredIf: { field, equals }, accept, max, maxSizeMB, maxDurationSec, width: 'half'
 */

const ESTILOS = [
  'Breaking', 'Hip Hop', 'Krump', 'House', 'Popping', 'Waacking', 'Locking',
  'Ballet', 'Jazz', 'Jazz Funk', 'Heels', 'Vogue', 'Twerking', 'Coreografias “Urbanas”', 'Contemporâneo',
];

export default {
  slug: 'casting-show-1212',
  ativo: true, // false = formulário fechado, mostra mensagem de encerramento
  mensagemEncerrado: 'As inscrições para este casting foram encerradas. Fique de olho no nosso Instagram para as próximas seleções.',

  hero: {
    kicker: 'BOUNCE BASEMENT · CASTING',
    titulo: 'PESQUISA DE PERFIL',
    subtitulo: 'Pesquisa de perfil de dançarinas com perfis diversos — mulheres trans, cis e pessoas não binárias.',
    cta: 'QUERO ME INSCREVER',
  },

  destaques: [
    { label: 'SHOW · PORTO ALEGRE', valor: '12/12' },
    { label: 'ENSAIOS', valor: '2 prévios pagos' },
    { label: 'PERFIS', valor: 'Mulher\u00a0Cis · Mulher\u00a0Trans · NB' },
  ],

  // Seção "Sobre o casting" (link SOBRE O CASTING do menu)
  sobre: {
    titulo: 'SOBRE O CASTING',
    paragrafos: [
      'Casting aberto para pesquisa de elenco para performance em show dia 12/12 + dois ensaios prévios remunerados.',
      'O show acontece em Porto Alegre (RS).',
      'Quem pode se inscrever: artistas da dança a partir de 18 anos — mulheres cis, mulheres trans e pessoas não binárias.',
      'Mais detalhes serão divulgados em breve.',
    ],
    itens: [
      { label: 'Show', valor: '12/12' },
      { label: 'Cidade', valor: 'Porto Alegre' },
      { label: 'Ensaios', valor: '2 prévios, remunerados' },
      { label: 'Idade', valor: 'A partir de 18 anos' },
      { label: 'Perfis', valor: 'Mulheres cis, mulheres trans e pessoas não binárias' },
    ],
  },

  secoes: [
    {
      id: 'dados',
      titulo: 'DADOS PESSOAIS',
      campos: [
        { name: 'nome_completo', label: 'Nome completo (para nota fiscal)', type: 'text', required: true },
        { name: 'nome_artistico', label: 'Nome artístico ou nome social', type: 'text', required: true },
        { name: 'genero', label: 'Gênero', type: 'radio', required: true, options: ['Cis', 'Trans', 'Não binário'] },
        { name: 'email', label: 'E-mail', type: 'email', required: true, width: 'half' },
        { name: 'instagram', label: 'Instagram', type: 'text', placeholder: '@seuperfil', required: true, width: 'half' },
        { name: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: '(51) 99999-9999', required: true, width: 'half' },
        { name: 'cpf', label: 'CPF', type: 'cpf', placeholder: '000.000.000-00', required: true, width: 'half' },
        { name: 'data_nascimento', label: 'Data de nascimento', type: 'date', required: true, width: 'half', minAge: 18 },
        { name: 'idade', label: 'Idade', type: 'age', from: 'data_nascimento', hint: 'Calculada automaticamente', width: 'half' },
        { name: 'endereco', label: 'Endereço', type: 'text', placeholder: 'Rua, número, complemento, bairro', required: true },
        { name: 'cidade', label: 'Cidade', type: 'text', placeholder: 'Porto Alegre / RS', required: true },
      ],
    },
    {
      id: 'medidas',
      titulo: 'MEDIDAS',
      descricao: 'Usadas para figurino. Pode ser estimativa.',
      campos: [
        { name: 'altura', label: 'Altura (m)', type: 'number', placeholder: '1,68', step: '0.01', min: 1, max: 2.3, required: true, width: 'third' },
        { name: 'tamanho_blusa', label: 'Tamanho da blusa (estimativa)', type: 'select', required: true, width: 'third',
          options: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'G1', 'G2', 'G3'] },
        { name: 'tamanho_calca', label: 'Tamanho da calça (estimativa)', type: 'select', required: true, width: 'third',
          options: ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', 'PP', 'P', 'M', 'G', 'GG', 'XGG'] },
      ],
    },
    {
      id: 'danca',
      titulo: 'DANÇA',
      campos: [
        { name: 'estilos_estudados', label: 'Estilos de dança e propostas que já estudou', type: 'checkboxes', required: true,
          options: ESTILOS, other: 'Outros. Descreva:' },
        { name: 'estilos_dominio', label: 'Estilos que domina ou está em estudo', type: 'checkboxes', required: true,
          options: ESTILOS, other: 'Outros. Descreva:' },
      ],
    },
    {
      id: 'experiencia',
      titulo: 'EXPERIÊNCIA',
      campos: [
        { name: 'tem_experiencia', label: 'Tem experiência profissional?', type: 'radio', required: true, options: ['Sim', 'Não'] },
        { name: 'experiencias', label: 'Especificação da experiência', type: 'checkboxes',
          hint: 'Se respondeu "Sim", marque todas as áreas em que já trabalhou.',
          requiredIf: { field: 'tem_experiencia', equals: 'Sim' },
          options: ['Comercial', 'Videoclipe', 'Montagem de espetáculo', 'Show', 'Animação', 'Professor/Educador', 'Coreógrafo', 'Diretor'] },
        { name: 'experiencia_detalhes', label: 'Conte um pouco (opcional)', type: 'textarea',
          placeholder: 'Trabalhos, artistas, companhias, anos…' },
      ],
    },
    {
      id: 'material',
      titulo: 'FOTOS E VÍDEOS',
      descricao: 'Fotos de corpo inteiro e rosto ajudam muito. Nos vídeos: 1 estilo entrevista (falando seu nome, idade, cidade, o que dança e por que dança) + até 3 vídeos dançando, de preferência em estilos diferentes.',
      campos: [
        { name: 'fotos', label: 'Fotografias (até 5)', type: 'files', accept: 'image/*', max: 5, maxSizeMB: 15, required: true,
          hint: 'JPG, PNG ou HEIC · até 15 MB cada' },
        { name: 'videos', label: 'Vídeos (até 4, de até 1min30 cada)', type: 'files', accept: 'video/*', max: 4, maxSizeMB: 250,
          maxDurationSec: 90, required: true,
          hint: '1 vídeo estilo entrevista (nome, idade, cidade, o que dança e por que dança) + até 3 vídeos dançando · MP4 ou MOV · até 1min30 e 250 MB cada' },
      ],
    },
    {
      id: 'disponibilidade',
      titulo: 'DISPONIBILIDADE',
      campos: [
        { name: 'disponivel_show', label: 'Tem disponibilidade para o SHOW no dia 12/12 em PORTO ALEGRE?', type: 'radio', required: true,
          options: ['Sim', 'Não'] },
        { name: 'disponivel_ensaios', label: 'Tem disponibilidade para os dois ensaios prévios (pagos)?', type: 'radio', required: true,
          options: ['Sim', 'Não', 'Depende das datas'] },
        { name: 'observacoes', label: 'Observações (opcional)', type: 'textarea', placeholder: 'Algo que devemos saber?' },
      ],
    },
  ],

  // CRM do painel /admin: etapas do funil (a primeira é a de quem acabou de se inscrever)
  // e mensagens prontas de WhatsApp por etapa ({nome} = nome artístico).
  crm: {
    etapas: ['Novo', 'Contatado', 'Pré-selecionado', 'Finalista', 'Fechado', 'Não seguiu'],
    mensagens: {
      'Novo': 'Oi, {nome}! Aqui é da Bounce Basement. Recebemos sua inscrição no casting, obrigado! Em breve te damos um retorno.',
      'Contatado': 'Oi, {nome}! Tudo bem? Aqui é da Bounce Basement, sobre o casting.',
      'Pré-selecionado': 'Oi, {nome}! Aqui é da Bounce Basement. Seu perfil foi pré-selecionado para o casting do show de 12/12! Podemos conversar sobre os próximos passos?',
      'Finalista': 'Oi, {nome}! Você está entre os finalistas do casting da Bounce Basement! Vamos alinhar os ensaios e a disponibilidade para o show de 12/12?',
      'Fechado': 'Oi, {nome}! Bem-vinde ao elenco do show de 12/12 da Bounce Basement! Vamos alinhar contrato, ensaios e figurino.',
      'Não seguiu': 'Oi, {nome}! Obrigado por participar do casting da Bounce Basement. Desta vez seguimos com outros perfis, mas guardamos seu material para próximas seleções.',
    },
  },

  consentimento: 'Autorizo o uso dos meus dados, fotos e vídeos exclusivamente para fins desta seleção e de futuros castings da Bounce Basement.',
  sucesso: {
    titulo: 'INSCRIÇÃO ENVIADA!',
    texto: 'Recebemos seu perfil. Entraremos em contato pelo WhatsApp ou e-mail caso você seja selecionade.',
  },

  contato: {
    endereco: 'Avenida Loureiro da Silva, 1940 - sala 1603, Cidade Baixa, Porto Alegre | RS',
    telefone: '(51) 99664-4041',
    email: 'contato@bouncebasement.com.br',
    instagram: 'https://www.instagram.com/bouncebasement',
    youtube: 'https://www.youtube.com/channel/UCJnOW5rlA8cv3EGDeacrRRg',
    site: 'https://www.bouncebasement.com.br/',
  },
};

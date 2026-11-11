// 1º passo do envio: valida as respostas, cria a pasta da pessoa no Drive,
// registra a linha na planilha e devolve links de upload direto para o Drive.
import config from '../casting.config.js';
import { allFields, isVisible, validate, ageFrom, fileMime, fileProblem } from '../shared/rules.js';
import { columns, header, row } from '../lib/columns.js';
import { g, ROOT_FOLDER, SHEET_ID } from '../lib/store.js';
import { ensureHeader } from '../lib/crm.js';
import { sign } from '../lib/sign.js';

const ext = (name = '') => (name.match(/\.[a-z0-9]{1,5}$/i)?.[0] || '').toLowerCase();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
  if (!config.ativo) return res.status(403).json({ message: 'Inscrições encerradas.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const input = body.values || {};
    const filesIn = body.files || {};
    const fields = allFields(config);

    // limpa e normaliza as respostas
    const values = {};
    for (const f of fields) {
      if (f.type === 'files') continue;
      if (f.type === 'checkboxes') {
        const list = Array.isArray(input[f.name]) ? input[f.name] : [];
        values[f.name] = list.map(String).filter((v) => f.options.includes(v));
        if (f.other) values[`${f.name}_outros`] = String(input[`${f.name}_outros`] || '').trim().slice(0, 500);
      } else {
        values[f.name] = String(input[f.name] ?? '').trim().slice(0, 3000);
      }
    }

    // valida arquivos declarados
    const files = {};
    const fileErrors = {};
    for (const f of fields.filter((x) => x.type === 'files')) {
      const list = Array.isArray(filesIn[f.name]) ? filesIn[f.name] : [];
      files[f.name] = list.slice(0, f.max).map((x) => {
        const name = String(x.name || 'arquivo').slice(0, 200);
        return { name, type: fileMime({ name, type: String(x.type || '') }), size: Number(x.size) || 0 };
      });
      for (const x of files[f.name]) {
        const p = fileProblem(f, x);
        if (p) fileErrors[f.name] = `${p.titulo} ${p.passos[0] || ''}`.trim();
      }
    }

    const counts = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length]));
    const errors = { ...validate(config, values, counts), ...fileErrors };
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Confira os campos destacados.', errors });

    for (const f of fields) if (f.type === 'age') values[f.name] = ageFrom(values[f.from]);
    for (const f of fields) if (!isVisible(f, values)) values[f.name] = f.type === 'checkboxes' ? [] : '';

    // pasta: <raiz>/<slug do casting>/<data - nome>
    const agora = new Date();
    const quando = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dia = agora.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const castingFolder = await g.findOrCreateFolder(config.slug, ROOT_FOLDER());
    const pessoa = `${dia} - ${values.nome_artistico || values.nome_completo}`.replace(/[\\/]/g, '-').slice(0, 120);
    const folder = await g.createFolder(pessoa, castingFolder);
    const link = await g.folderLink(folder.id);

    // planilha: uma aba por casting
    await g.ensureSheet(SHEET_ID(), config.slug, header(config));
    const { head } = await ensureHeader();
    // monta a linha na ordem das colunas que a planilha realmente tem
    const cols = columns(config);
    const linha = row(config, values, { _status: '⏳ ENVIANDO ARQUIVOS', _recebido: quando, _pasta: link, _files: counts,
      _etapa: config.crm?.etapas?.[0] || '', _notas: '', _atualizado: '' });
    const ordered = head.map((label) => { const i = cols.findIndex((c) => c.label === label); return i >= 0 ? linha[i] : ''; });
    const rowNumber = await g.appendRow(SHEET_ID(), config.slug, ordered);

    // sessões de upload (o navegador envia direto ao Drive)
    const origin = req.headers.origin || '';
    const jobs = [];
    for (const [field, list] of Object.entries(files)) {
      list.forEach((x, i) => jobs.push({ field, index: i, name: `${field}-${i + 1}${ext(x.name)}`, x }));
    }
    const uploads = await Promise.all(jobs.map(async (j) => ({
      field: j.field, index: j.index,
      url: await g.createUploadSession({ name: j.name, mimeType: j.x.type, size: j.x.size, parentId: folder.id, origin }),
    })));

    const total = jobs.length;
    res.status(200).json({ ok: true, folderId: folder.id, row: rowNumber, total, token: sign(`${folder.id}|${rowNumber}|${total}`), uploads });
  } catch (e) {
    // código ajuda a equipe a identificar o problema quando a pessoa manda print
    const codigo = /autenticar|invalid_grant|GOOGLE_|Variável de ambiente/i.test(String(e?.message)) ? 'INI-GOOGLE'
      : /Google 4\d\d/.test(String(e?.message)) ? 'INI-DRIVE' : 'INI-500';
    console.error(`[iniciar] ${codigo}:`, e);
    res.status(500).json({ codigo, message: 'Não conseguimos registrar sua inscrição agora (instabilidade no nosso sistema).' });
  }
}


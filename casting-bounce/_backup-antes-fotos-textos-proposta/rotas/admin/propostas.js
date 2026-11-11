// Propostas comerciais (painel): modelos e propostas para contratantes.
import { guard } from '../../lib/admin-auth.js';
import {
  lerModelos, salvarModelo, excluirModelo, lerPropostas, criarProposta, alterarProposta, novaChave, STATUS,
} from '../../lib/propostas.js';

const publica = ({ _linha, ...x }) => x;
const conflito = (p, versao) => {
  if (versao != null && Number(versao) !== p.versao)
    throw Object.assign(new Error('Esta proposta foi alterada em outro lugar. Recarregue para ver a versão atual.'), { status: 409 });
};

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    if (req.method === 'GET') {
      const [modelos, propostas] = await Promise.all([lerModelos(), lerPropostas()]);
      return res.status(200).json({
        modelos: modelos.map(publica),
        propostas: propostas.filter((p) => p.status !== STATUS.excluida).map(publica),
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const id = String(b.id || '');

    switch (b.acao) {
      case 'salvar-modelo':
        return res.status(200).json({ modelo: publica(await salvarModelo({ id, nome: b.nome, conteudo: b.conteudo })) });
      case 'excluir-modelo':
        return res.status(200).json({ modelo: publica(await excluirModelo(id)) });
      case 'criar':
        return res.status(200).json({ proposta: publica(await criarProposta({
          modeloId: String(b.modeloId || ''), listaId: b.listaId == null ? undefined : String(b.listaId), copiarDe: b.copiarDe ? String(b.copiarDe) : '',
        })) });
      case 'salvar':
        return res.status(200).json({ proposta: publica(await alterarProposta(id, (p) => {
          conflito(p, b.versao);
          if (b.conteudo != null) p.conteudo = b.conteudo;
          if (b.listaId != null) p.listaId = String(b.listaId);
          if (b.status != null) p.status = String(b.status);
        })) });
      case 'novo-link':
        return res.status(200).json({ proposta: publica(await alterarProposta(id, (p) => { p.chave = novaChave(); })) });
      case 'excluir':
        return res.status(200).json({ proposta: publica(await alterarProposta(id, (p) => { p.status = STATUS.excluida; })) });
      default:
        return res.status(400).json({ message: 'Ação inválida.' });
    }
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Não foi possível salvar na planilha.' });
  }
}

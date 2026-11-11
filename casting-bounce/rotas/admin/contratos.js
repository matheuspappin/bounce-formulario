// Contratos (painel): modelos de contrato, gerar a partir da proposta, cancelar, assinar pela Bounce.
import { guard } from '../../lib/admin-auth.js';
import {
  lerModelosContrato, salvarModeloContrato, excluirModeloContrato, lerContratos, gerarContrato,
  cancelarContrato, novoLinkContrato, assinarBounce, contratoPublico,
} from '../../lib/contratos.js';

const resumo = (c) => ({
  id: c.id, propostaId: c.propostaId, status: c.status, contratante: c.contratante, chave: c.chave, criado: c.criado,
  atualizado: c.atualizado, modeloNome: c.modeloNome, versaoProposta: c.versaoProposta, hash: c.hash,
  assinadoCliente: c.cliente?.em || '', assinadoBounce: c.bounce?.em || '', clienteEmail: c.cliente?.email || '',
});
const modelo = ({ _linha, ...m }) => m;

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    if (req.method === 'GET') {
      const u = new URL(req.url, 'http://x');
      const [modelos, contratos] = await Promise.all([lerModelosContrato(), lerContratos()]);
      // ?ver=<id>: o contrato completo (texto e assinaturas) para o painel
      const ver = u.searchParams.get('ver');
      if (ver) {
        const c = contratos.find((x) => x.id === ver);
        if (!c) return res.status(404).json({ message: 'Contrato não encontrado.' });
        return res.status(200).json({ contrato: { ...resumo(c), ...contratoPublico(c) } });
      }
      return res.status(200).json({ modelos: modelos.map(modelo), contratos: contratos.map(resumo) });
    }
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const id = String(b.id || '');
    switch (b.acao) {
      case 'salvar-modelo': return res.status(200).json({ modelo: modelo(await salvarModeloContrato({ id, nome: b.nome, texto: b.texto })) });
      case 'excluir-modelo': return res.status(200).json({ modelo: modelo(await excluirModeloContrato(id)) });
      case 'gerar': return res.status(200).json({ contrato: resumo(await gerarContrato({ propostaId: String(b.propostaId || ''), modeloId: String(b.modeloId || '') })) });
      case 'cancelar': return res.status(200).json({ contrato: resumo(await cancelarContrato(id)) });
      case 'novo-link': return res.status(200).json({ contrato: resumo(await novoLinkContrato(id)) });
      case 'assinar-bounce': return res.status(200).json({ contrato: resumo(await assinarBounce(id, b, req)) });
      default: return res.status(400).json({ message: 'Ação inválida.' });
    }
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Não foi possível salvar na planilha.' });
  }
}

// Uma única função para todo o painel (/api/admin/...): o plano gratuito da Vercel aceita no máximo 12 funções.
// Cada rota continua no seu arquivo, dentro de rotas/admin/.
import arquivos from '../../rotas/admin/arquivos.js';
import atualizar from '../../rotas/admin/atualizar.js';
import contratos from '../../rotas/admin/contratos.js';
import excluirPerfil from '../../rotas/admin/excluir-perfil.js';
import inscricoes from '../../rotas/admin/inscricoes.js';
import listas from '../../rotas/admin/listas.js';
import login from '../../rotas/admin/login.js';
import miniatura from '../../rotas/admin/miniatura.js';
import propostas from '../../rotas/admin/propostas.js';

const ROTAS = {
  arquivos, atualizar, contratos, 'excluir-perfil': excluirPerfil, inscricoes, listas, login, miniatura, propostas,
};

export default async function handler(req, res) {
  const nome = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop();
  const rota = ROTAS[nome];
  if (!rota) return res.status(404).json({ message: 'Não encontrado' });
  return rota(req, res);
}

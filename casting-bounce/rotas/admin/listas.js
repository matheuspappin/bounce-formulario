// Listas para contratantes (painel): listar, criar, adicionar perfis, editar, encerrar, excluir, trocar o link.
import { guard } from '../../lib/admin-auth.js';
import { lerListas, criarLista, alterarLista, sincronizarVideos, limparPessoas, novaChave, STATUS, MAX_PESSOAS } from '../../lib/listas.js';

const publica = ({ _linha, ...l }) => l;

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    if (req.method === 'GET') {
      const listas = (await lerListas()).filter((l) => l.status !== STATUS.excluida).map(publica);
      return res.status(200).json({ listas });
    }
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    let r;

    if (b.acao === 'criar') {
      const antes = await lerListas();
      const lista = await criarLista(b);
      const aviso = await sincronizarVideos(antes, [...antes, lista]);
      return res.status(200).json({ lista: publica(lista), aviso });
    }

    if (b.acao === 'adicionar') {
      let novos = 0;
      r = await alterarLista(String(b.id || ''), (l) => {
        const add = limparPessoas(b.pessoas).filter((p) => !l.pessoas.some((x) => x.p === p.p));
        if (l.pessoas.length + add.length > MAX_PESSOAS)
          throw Object.assign(new Error(`Uma lista pode ter no máximo ${MAX_PESSOAS} perfis.`), { status: 400 });
        l.pessoas = [...l.pessoas, ...add];
        novos = add.length;
      });
      r.novos = novos;
    } else if (b.acao === 'salvar') {
      r = await alterarLista(String(b.id || ''), (l) => {
        // se outra pessoa mexeu na lista depois que você abriu, não sobrescreve
        if (b.versao != null && Number(b.versao) !== l.versao)
          throw Object.assign(new Error('Esta lista foi alterada em outro lugar. Recarregue para ver a versão atual.'), { status: 409 });
        for (const k of ['nome', 'evento', 'data', 'contratante']) if (b[k] != null) l[k] = String(b[k]);
        if (b.status != null) {
          if (![STATUS.ativa, STATUS.encerrada].includes(b.status)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
          l.status = b.status;
        }
        if (b.pessoas != null) l.pessoas = limparPessoas(b.pessoas);
      });
    } else if (b.acao === 'concluir') {
      // trabalho feito: desliga o link e guarda no relatório quem participou e o resultado
      const participaram = new Set(Array.isArray(b.participaram) ? b.participaram.map(String) : []);
      r = await alterarLista(String(b.id || ''), (l) => {
        if (b.versao != null && Number(b.versao) !== l.versao)
          throw Object.assign(new Error('Esta lista foi alterada em outro lugar. Recarregue para ver a versão atual.'), { status: 409 });
        if (l.status !== STATUS.concluida) l.concluida = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        l.status = STATUS.concluida;
        l.resultado = String(b.resultado ?? l.resultado ?? '').trim().slice(0, 3000);
        l.pessoas = l.pessoas.map((p) => ({ ...p, ok: participaram.has(p.p) }));
      });
    } else if (b.acao === 'reabrir') {
      // volta a ser editável, com o link desligado (reative o link se quiser mandar de novo)
      r = await alterarLista(String(b.id || ''), (l) => {
        l.status = STATUS.encerrada; l.concluida = '';
        l.pessoas = l.pessoas.filter((p) => !p.excluido).map(({ ok, ...p }) => p);
      });
    } else if (b.acao === 'excluir') {
      r = await alterarLista(String(b.id || ''), (l) => { l.status = STATUS.excluida; });
    } else if (b.acao === 'novo-link') {
      r = await alterarLista(String(b.id || ''), (l) => { l.chave = novaChave(); });
    } else {
      return res.status(400).json({ message: 'Ação inválida.' });
    }

    const aviso = await sincronizarVideos(r.listasAntes, r.listasDepois);
    res.status(200).json({ lista: publica(r.lista), novos: r.novos, aviso });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Não foi possível salvar a lista na planilha.' });
  }
}

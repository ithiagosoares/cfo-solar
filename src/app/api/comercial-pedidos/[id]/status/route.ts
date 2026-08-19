// Server-only. Endpoint dedicado para edição inline de etapa_funil / status_venda
// a partir das tabelas de Pedidos Comerciais e Vendas (dropdown com auto-save).
// Vendedor só edita pedido cujo vendedor_id bate com o header x-vendedor-id
// (nunca aceitar vendedor_id vindo do corpo/query) — ver CLAUDE.md, seção 3.
import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { buscarPedidoPorId, atualizarPedido, ETAPAS_FUNIL, STATUS_VENDA_VALORES } from '@/lib/comercial-pedidos-repository'
import type { DadosAtualizacaoPedido } from '@/lib/comercial-pedidos-repository'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const pedido = await buscarPedidoPorId(id)
  if (!pedido) return Response.json({ ok: false, error: 'Pedido não encontrado' }, { status: 404 })

  if (papel === 'vendedor') {
    const vendedorId = getVendedorId(request)
    if (pedido.vendedorId !== vendedorId) {
      return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { etapaFunil, statusVenda } = body
  if (etapaFunil === undefined && statusVenda === undefined) {
    return Response.json({ ok: false, error: 'Informe etapaFunil ou statusVenda' }, { status: 400 })
  }
  if (etapaFunil !== undefined && !ETAPAS_FUNIL.includes(etapaFunil as never)) {
    return Response.json({ ok: false, error: 'etapaFunil inválida' }, { status: 400 })
  }
  if (statusVenda !== undefined && !STATUS_VENDA_VALORES.includes(statusVenda as never)) {
    return Response.json({ ok: false, error: 'statusVenda inválido' }, { status: 400 })
  }

  const dados: DadosAtualizacaoPedido = {}
  if (etapaFunil !== undefined)  dados.etapaFunil  = etapaFunil as DadosAtualizacaoPedido['etapaFunil']
  if (statusVenda !== undefined) dados.statusVenda = statusVenda as DadosAtualizacaoPedido['statusVenda']

  try {
    await atualizarPedido(id, dados)
    const atualizado = await buscarPedidoPorId(id)
    return Response.json({ ok: true, pedido: atualizado })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

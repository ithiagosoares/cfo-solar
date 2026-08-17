import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import {
  buscarPedidoPorId,
  atualizarPedido,
  arquivarPedido,
} from '@/lib/comercial-pedidos-repository'
import type { DadosAtualizacaoPedido, StatusPedido } from '@/lib/comercial-pedidos-repository'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const pedido = await buscarPedidoPorId(id)
  if (!pedido) return Response.json({ ok: false, error: 'Orçamento não encontrado' }, { status: 404 })

  if (papel === 'vendedor') {
    const vendedorId = getVendedorId(request)
    if (pedido.vendedorId !== vendedorId) {
      return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
    }
  }

  return Response.json({ ok: true, pedido })
}

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
  if (!pedido) return Response.json({ ok: false, error: 'Orçamento não encontrado' }, { status: 404 })

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

  // Ação de arquivamento
  if (body.arquivar !== undefined) {
    try {
      await arquivarPedido(id, body.arquivar === true)
      return Response.json({ ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      return Response.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  const dados: DadosAtualizacaoPedido = {}
  if (body.empresa       !== undefined) dados.empresa       = String(body.empresa)
  if (body.filial        !== undefined) dados.filial        = String(body.filial)
  if (body.cliente       !== undefined) dados.cliente       = String(body.cliente)
  if (body.status        !== undefined) dados.status        = body.status as StatusPedido
  if (body.valorOrcado   !== undefined) dados.valorOrcado   = Number(body.valorOrcado)
  if (body.dataOrcamento !== undefined) dados.dataOrcamento = body.dataOrcamento as string | null
  if (body.valorVendido  !== undefined) dados.valorVendido  = body.valorVendido !== null ? Number(body.valorVendido) : null
  if (body.dataVenda     !== undefined) dados.dataVenda     = body.dataVenda as string | null

  try {
    await atualizarPedido(id, dados)
    const atualizado = await buscarPedidoPorId(id)
    return Response.json({ ok: true, pedido: atualizado })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

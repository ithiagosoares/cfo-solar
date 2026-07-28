import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { inserirPedidoManual, listarPedidos } from '@/lib/comercial-pedidos-repository'
import type { DadosPedidoManual, StatusPedido } from '@/lib/comercial-pedidos-repository'

const PAPEIS_CRIACAO = new Set(['administrador', 'gestor', 'vendedor'])

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  const { searchParams } = new URL(request.url)

  const pagina    = Math.max(1, parseInt(searchParams.get('pagina')    ?? '1',  10))
  const porPagina = Math.max(1, parseInt(searchParams.get('porPagina') ?? '20', 10))

  const filtros: { vendedorId?: string; pagina: number; porPagina: number } = { pagina, porPagina }

  // vendedor vê apenas a própria carteira — nunca aceita vendedor_id da query string
  if (papel === 'vendedor') {
    const vendedorId = getVendedorId(request)
    if (!vendedorId) {
      return Response.json({ ok: false, error: 'Vendedor sem carteira configurada' }, { status: 403 })
    }
    filtros.vendedorId = vendedorId
  } else if (searchParams.get('vendedor_id')) {
    filtros.vendedorId = searchParams.get('vendedor_id')!
  }

  try {
    const result = await listarPedidos(filtros)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_CRIACAO.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const {
    empresa, filial, cliente, valorOrcado,
    dataOrcamento, status, valorVendido, dataVenda,
    vendedorId: vendedorIdBody,
  } = body

  if (!empresa || typeof empresa !== 'string')
    return Response.json({ ok: false, error: 'empresa é obrigatório' }, { status: 400 })
  if (!filial || typeof filial !== 'string')
    return Response.json({ ok: false, error: 'filial é obrigatório' }, { status: 400 })
  if (!cliente || typeof cliente !== 'string')
    return Response.json({ ok: false, error: 'cliente é obrigatório' }, { status: 400 })
  if (typeof valorOrcado !== 'number' || valorOrcado <= 0)
    return Response.json({ ok: false, error: 'valorOrcado inválido' }, { status: 400 })
  if (status !== 'orcado' && status !== 'vendido')
    return Response.json({ ok: false, error: 'status inválido' }, { status: 400 })

  // vendedor: ignora vendedorId do corpo, usa o próprio id do header
  let resolvedVendedorId: string | null
  if (papel === 'vendedor') {
    resolvedVendedorId = getVendedorId(request)
    if (!resolvedVendedorId) {
      return Response.json({ ok: false, error: 'Vendedor sem carteira configurada' }, { status: 403 })
    }
  } else {
    resolvedVendedorId = typeof vendedorIdBody === 'string' ? vendedorIdBody : null
  }

  const dados: DadosPedidoManual = {
    vendedorId:    resolvedVendedorId,
    empresa:       empresa as string,
    filial:        filial  as string,
    cliente:       cliente as string,
    valorOrcado:   valorOrcado as number,
    dataOrcamento: typeof dataOrcamento === 'string' ? dataOrcamento : null,
    status:        status as StatusPedido,
    valorVendido:  status === 'vendido' && typeof valorVendido === 'number' ? valorVendido : null,
    dataVenda:     status === 'vendido' && typeof dataVenda   === 'string'  ? dataVenda   : null,
  }

  try {
    await inserirPedidoManual(dados)
    return Response.json({ ok: true }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

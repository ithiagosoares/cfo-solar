// Server-only — usa supabaseAdmin via listarVendas. NUNCA importar de 'use client'.
// Vendedor: vendedor_id sempre vem do header x-vendedor-id injetado pelo proxy,
// NUNCA de query params (regra de segurança).
import { type NextRequest } from 'next/server'
import { requireComercialAccess, getPapel, getVendedorId } from '@/lib/comercial-auth'
import { listarVendas } from '@/lib/comercial-pedidos-repository'

const POR_PAGINA = 20

export async function GET(request: NextRequest) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  const { searchParams } = request.nextUrl

  const pagina    = Math.max(1, parseInt(searchParams.get('pagina')    ?? '1',              10))
  const porPagina = Math.min(100, Math.max(1, parseInt(searchParams.get('porPagina') ?? String(POR_PAGINA), 10)))
  const dataInicio = searchParams.get('periodoInicio') ?? undefined
  const dataFim    = searchParams.get('periodoFim')    ?? undefined

  const filtros: Parameters<typeof listarVendas>[0] = { pagina, porPagina }
  if (dataInicio) filtros.dataInicio = dataInicio
  if (dataFim)    filtros.dataFim    = dataFim

  if (papel === 'vendedor') {
    const vendedorId = getVendedorId(request)
    if (!vendedorId) {
      return Response.json({ ok: false, error: 'Vendedor não identificado' }, { status: 403 })
    }
    filtros.vendedorId = vendedorId
  }

  try {
    const { vendas, total, totalVendido } = await listarVendas(filtros)
    return Response.json({ ok: true, vendas, total, totalVendido })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

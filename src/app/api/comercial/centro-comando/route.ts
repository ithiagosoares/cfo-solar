// GET /api/comercial/centro-comando — resumo do dia para o topo do /dashboard.
// vendedor: vendedorId sempre vem do header x-vendedor-id injetado pelo proxy,
// nunca de query params (regra de segurança — CLAUDE.md §3).

import { requireComercialAccess, getPapel, getVendedorId } from '@/lib/comercial-auth'
import { buscarCentroComando } from '@/lib/comercial-centro-comando'

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Papel não identificado' }, { status: 403 })

  let vendedorId: string | null = null
  if (papel === 'vendedor') {
    vendedorId = getVendedorId(request)
    if (!vendedorId) {
      return Response.json({ ok: false, error: 'Vendedor não identificado no contexto da requisição.' }, { status: 403 })
    }
  }

  try {
    const resumo = await buscarCentroComando({ papel, vendedorId })
    return Response.json({ ok: true, ...resumo })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/centro-comando] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

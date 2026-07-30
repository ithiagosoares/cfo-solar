// Server-only — usa supabaseAdmin via listarVendas. NUNCA importar de 'use client'.
// Vendedor: vendedor_id sempre vem do header x-vendedor-id injetado pelo proxy,
// NUNCA de query params (regra de segurança).
import { type NextRequest } from 'next/server'
import { requireComercialAccess, getPapel, getVendedorId } from '@/lib/comercial-auth'
import { listarVendas } from '@/lib/comercial-pedidos-repository'
import { buscarTotaisOficiais } from '@/lib/vendedores-totais-repository'

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

  let vendedorId: string | null = null
  if (papel === 'vendedor') {
    vendedorId = getVendedorId(request)
    if (!vendedorId) {
      return Response.json({ ok: false, error: 'Vendedor não identificado' }, { status: 403 })
    }
    filtros.vendedorId = vendedorId
  }

  try {
    const [{ vendas, total, totalVendido }, totaisOficiais] = await Promise.all([
      listarVendas(filtros),
      // Busca total oficial apenas quando período completo for informado
      dataInicio && dataFim
        ? buscarTotaisOficiais(dataInicio, dataFim, vendedorId ?? undefined)
        : Promise.resolve([]),
    ])

    // Agrega total oficial por vendedor (preferindo rentabilidade quando ambas as fontes existem)
    let totalVendidoOficial: number | null = null
    let quantidadeVendasOficial: number | null = null
    let fonteOficial: string | null = null
    let divergenciaOficial: number | null = null

    if (totaisOficiais.length > 0) {
      // Para vendedor individual: soma todos os registros dele (pode ter duas fontes; preferir rentabilidade)
      // Para visão geral: não aplicamos total oficial agregado (múltiplos vendedores)
      if (vendedorId) {
        const rentabilidade = totaisOficiais.find(t => t.fonte === 'rentabilidade_vendedor')
        const totalVenda    = totaisOficiais.find(t => t.fonte === 'total_venda_vendedor')
        const preferido     = rentabilidade ?? totalVenda

        if (preferido) {
          totalVendidoOficial      = preferido.valorTotalOficial
          quantidadeVendasOficial  = preferido.quantidadeVendas
          fonteOficial             = preferido.fonte
          const diff = Math.abs(totalVendido - totalVendidoOficial)
          divergenciaOficial       = diff > 0.01 ? diff : null
        }
      }
    }

    return Response.json({
      ok: true,
      vendas,
      total,
      totalVendido,
      totalVendidoOficial,
      quantidadeVendasOficial,
      fonteOficial,
      divergenciaOficial,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

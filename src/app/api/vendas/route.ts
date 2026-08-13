// Server-only — usa supabaseAdmin via listarVendas. NUNCA importar de 'use client'.
// Vendedor: vendedor_id sempre vem do header x-vendedor-id injetado pelo proxy,
// NUNCA de query params (regra de segurança).
import { type NextRequest } from 'next/server'
import { requireComercialAccess, getPapel, getVendedorId } from '@/lib/comercial-auth'
import { listarVendas } from '@/lib/comercial-pedidos-repository'
import {
  buscarTotaisOficiaisMensais,
  deduplicarTotaisOficiais,
  agregarTotaisOficiaisPorNome,
} from '@/lib/vendedores-totais-repository'

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
    const [{ vendas, total, totalVendido }, totaisOficiaisRaw] = await Promise.all([
      listarVendas(filtros),
      // Busca totais apenas quando período completo for informado
      dataInicio && dataFim
        ? buscarTotaisOficiaisMensais(dataInicio, dataFim, vendedorId ?? undefined)
        : Promise.resolve([]),
    ])

    let totalVendidoOficial: number | null = null
    let quantidadeVendasOficial: number | null = null
    let fonteOficial: string | null = null
    let divergenciaOficial: number | null = null

    // Total oficial apenas para vendedor individual (agrega corretamente entre filiais)
    if (vendedorId && totaisOficiaisRaw.length > 0) {
      const agregados = agregarTotaisOficiaisPorNome(deduplicarTotaisOficiais(totaisOficiaisRaw))
      const ag = [...agregados.values()][0]
      if (ag) {
        totalVendidoOficial     = ag.valorTotalOficial
        quantidadeVendasOficial = ag.quantidadeVendas
        fonteOficial            = ag.fonte
        const diff = Math.abs(totalVendido - totalVendidoOficial)
        divergenciaOficial = diff > 0.01 ? diff : null
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

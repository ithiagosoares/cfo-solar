// GET /api/comercial/dashboard
//
// Query params:
//   periodoInicio  string  ISO date obrigatório — ex: '2026-01-01'
//   periodoFim     string  ISO date obrigatório — ex: '2026-07-31'
//   empresa        string  opcional
//   filial         string  opcional
//
// Segurança de papel:
//   vendedor  → vendedorId forçado do header x-vendedor-id (nunca da query string)
//             → rankings omitidos (comparativo entre vendedores não faz sentido)
//   admin/gestor → acesso total; aceita empresa/filial da query

import {
  calcularDesempenhoPorVendedor,
  calcularIndicadoresPorVendedor,
  buscarGrandesOportunidades,
  calcularRankings,
} from '@/lib/comercial-indicadores'
import type { FiltrosComerciais } from '@/lib/comercial-indicadores'
import { requireComercialAccess, getPapel, getVendedorId } from '@/lib/comercial-auth'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)

    const periodoInicio = searchParams.get('periodoInicio')
    const periodoFim    = searchParams.get('periodoFim')

    if (!periodoInicio || !periodoFim) {
      return Response.json(
        { ok: false, error: 'periodoInicio e periodoFim são obrigatórios.' },
        { status: 400 },
      )
    }

    if (!ISO_DATE.test(periodoInicio) || !ISO_DATE.test(periodoFim)) {
      return Response.json(
        { ok: false, error: 'periodoInicio e periodoFim devem estar no formato AAAA-MM-DD.' },
        { status: 400 },
      )
    }

    if (periodoInicio > periodoFim) {
      return Response.json(
        { ok: false, error: 'periodoInicio não pode ser posterior a periodoFim.' },
        { status: 400 },
      )
    }

    const periodo = { inicio: periodoInicio, fim: periodoFim }
    const papel   = getPapel(request)

    // Vendedor: filtro de carteira obrigatório vindo do header — nunca aceita da query
    const filtros: FiltrosComerciais = {}

    if (papel === 'vendedor') {
      const vendedorId = getVendedorId(request)
      if (!vendedorId) {
        return Response.json(
          { ok: false, error: 'Vendedor não identificado no contexto da requisição.' },
          { status: 403 },
        )
      }
      filtros.vendedorId = vendedorId
    } else {
      // Admin/gestor: filtros opcionais de empresa/filial da query
      const empresa = searchParams.get('empresa')
      const filial  = searchParams.get('filial')
      if (empresa) filtros.empresa = empresa
      if (filial)  filtros.filial  = filial
    }

    // Rankings: não fazem sentido para vendedor (só veria a si mesmo)
    const [desempenho, indicadores, oportunidades, rankings] = await Promise.all([
      calcularDesempenhoPorVendedor(periodo, filtros),
      calcularIndicadoresPorVendedor(periodo, filtros),
      buscarGrandesOportunidades(periodo, filtros),
      papel === 'vendedor' ? Promise.resolve(null) : calcularRankings(periodo, filtros),
    ])

    return Response.json({
      ok: true,
      periodo,
      filtros,
      desempenhoPorVendedor:    desempenho.series,
      granularidade:            desempenho.granularidade,
      labels:                   desempenho.labels,
      totalComercialAtualizado: desempenho.totalComercialAtualizado,
      indicadoresPorVendedor:   indicadores,
      grandesOportunidades:     oportunidades,
      rankings,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/dashboard] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

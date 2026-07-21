// GET /api/comercial/dashboard
//
// Query params:
//   periodoInicio  string  ISO date obrigatório — ex: '2026-01-01'
//   periodoFim     string  ISO date obrigatório — ex: '2026-07-31'
//   empresa        string  opcional
//   filial         string  opcional
//
// Retorna um único JSON com todos os indicadores do Dashboard Comercial.

import {
  calcularDesempenhoPorVendedor,
  calcularIndicadoresPorVendedor,
  buscarGrandesOportunidades,
  calcularRankings,
} from '@/lib/comercial-indicadores'
import { requireComercialAccess } from '@/lib/comercial-auth'

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
    const filtros = {
      empresa: searchParams.get('empresa') ?? undefined,
      filial:  searchParams.get('filial')  ?? undefined,
    }

    const [desempenho, indicadores, oportunidades, rankings] = await Promise.all([
      calcularDesempenhoPorVendedor(periodo, filtros),
      calcularIndicadoresPorVendedor(periodo, filtros),
      buscarGrandesOportunidades(periodo, filtros),
      calcularRankings(periodo, filtros),
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

// GET /api/comercial/meses-disponiveis
// Retorna lista de "YYYY-MM" que têm dado no sistema (comercial_pedidos ∪ vendedores_totais_oficiais).
// Qualquer papel autenticado pode acessar (a lista é agregada, não sensível por vendedor).

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPapel } from '@/lib/comercial-auth'

export async function GET(request: Request) {
  const papel = getPapel(request)
  if (!papel || papel === 'sem_acesso') {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  const [pedidosResult, totaisResult] = await Promise.all([
    supabaseAdmin
      .from('comercial_pedidos')
      .select('data_orcamento')
      .not('data_orcamento', 'is', null)
      .limit(10000),
    supabaseAdmin
      .from('vendedores_totais_oficiais')
      .select('periodo_inicio')
      .limit(1000),
  ])

  const mesesSet = new Set<string>()

  for (const row of (pedidosResult.data ?? [])) {
    const m = (row.data_orcamento as string | null)?.slice(0, 7)
    if (m) mesesSet.add(m)
  }
  for (const row of (totaisResult.data ?? [])) {
    const m = (row.periodo_inicio as string | null)?.slice(0, 7)
    if (m) mesesSet.add(m)
  }

  const meses = [...mesesSet].sort()

  return Response.json({ ok: true, meses })
}

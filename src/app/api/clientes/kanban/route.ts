// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface ClienteKanban {
  cnpj: string
  razaoSocial: string
  cidade: string
  estado: string
  statusCrm: string
  ultimoContato: string | null
  totalVendido: number
}

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })

  type ClienteRow = {
    cnpj: string
    razao_social: string
    cidade: string
    estado: string
    status_crm: string
    ultimo_contato: string | null
    vendedor_id: string | null
    criado_por: string
  }

  let query = supabaseAdmin
    .from('clientes')
    .select('cnpj, razao_social, cidade, estado, status_crm, ultimo_contato, vendedor_id, criado_por')
    .eq('arquivado', false)

  if (papel === 'vendedor') {
    const vendedorId = getVendedorId(request)
    if (!vendedorId) return Response.json({ ok: false, error: 'vendedor_id não encontrado' }, { status: 403 })
    query = query.eq('vendedor_id', vendedorId)
  } else if (papel === 'sdr') {
    const email = request.headers.get('x-user-email') ?? ''
    query = query.eq('criado_por', email)
  }

  const { data: clientes, error: clientesError } = await query
  if (clientesError) return Response.json({ ok: false, error: clientesError.message }, { status: 500 })

  const rows = (clientes ?? []) as ClienteRow[]
  const cnpjs = rows.map(c => c.cnpj)

  const totaisPorCnpj: Record<string, number> = {}
  if (cnpjs.length > 0) {
    type TotalRow = { cliente_cnpj: string; valor_vendido: number | null }
    const { data: totais } = await supabaseAdmin
      .from('comercial_pedidos')
      .select('cliente_cnpj, valor_vendido')
      .in('cliente_cnpj', cnpjs)
      .eq('status', 'vendido')
      .eq('arquivado', false)
      .not('valor_vendido', 'is', null)

    for (const row of (totais ?? []) as TotalRow[]) {
      totaisPorCnpj[row.cliente_cnpj] = (totaisPorCnpj[row.cliente_cnpj] ?? 0) + (row.valor_vendido ?? 0)
    }
  }

  const resultado: ClienteKanban[] = rows.map(c => ({
    cnpj:          c.cnpj,
    razaoSocial:   c.razao_social,
    cidade:        c.cidade,
    estado:        c.estado,
    statusCrm:     c.status_crm,
    ultimoContato: c.ultimo_contato,
    totalVendido:  totaisPorCnpj[c.cnpj] ?? 0,
  }))

  return Response.json({ ok: true, clientes: resultado })
}

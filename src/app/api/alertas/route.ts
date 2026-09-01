import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { calcularAlertas } from '@/lib/alertas'

// Papéis com botão de Notificações — mesmos 3 mencionados no pedido de produto
// (vendedor vê só a própria carteira; gestor/administrador veem tudo).
const PAPEIS_COM_ALERTAS = new Set(['administrador', 'gestor', 'vendedor'])

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel || !PAPEIS_COM_ALERTAS.has(papel)) {
    return Response.json({ ok: true, alertas: [] })
  }

  // vendedor_id sempre lido do header injetado pelo proxy (sessão autenticada),
  // nunca da query string — ver CLAUDE.md §3.
  const vendedorId = getVendedorId(request)

  try {
    const alertas = await calcularAlertas({ papel, vendedorId })
    return Response.json({ ok: true, alertas })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[GET /api/alertas] erro:', msg, err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

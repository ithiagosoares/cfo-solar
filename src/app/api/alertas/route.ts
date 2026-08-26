import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { calcularAlertas } from '@/lib/alertas'

// Papéis com botão de Notificações — mesmos 3 mencionados no pedido de produto
// (vendedor vê só a própria carteira; gestor/administrador veem tudo).
const PAPEIS_COM_ALERTAS = new Set(['administrador', 'gestor', 'vendedor'])

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papelHeader = request.headers.get('x-papel')
  const vendedorIdHeader = request.headers.get('x-vendedor-id')
  console.log('[api/alertas] headers recebidos — x-papel:', JSON.stringify(papelHeader), 'x-vendedor-id:', JSON.stringify(vendedorIdHeader))

  const papel = getPapel(request)
  if (!papel || !PAPEIS_COM_ALERTAS.has(papel)) {
    console.log('[api/alertas] papel', JSON.stringify(papel), 'não está em PAPEIS_COM_ALERTAS — retornando alertas: [] sem chamar calcularAlertas')
    return Response.json({ ok: true, alertas: [] })
  }

  // vendedor_id sempre lido do header injetado pelo proxy (sessão autenticada),
  // nunca da query string — ver CLAUDE.md §3.
  const vendedorId = getVendedorId(request)

  try {
    const alertas = await calcularAlertas({ papel, vendedorId })
    console.log('[api/alertas] retorno de calcularAlertas — total:', alertas.length, '— conteúdo:', JSON.stringify(alertas))

    const respostaJson = { ok: true, alertas }
    console.log('[api/alertas] JSON final enviado ao cliente:', JSON.stringify(respostaJson))
    return Response.json(respostaJson)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[GET /api/alertas] erro:', msg, err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

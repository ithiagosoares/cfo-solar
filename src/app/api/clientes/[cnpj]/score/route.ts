import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { buscarCliente, normalizarCNPJ } from '@/lib/clientes-repository'
import { calcularScoreIa } from '@/lib/score-repository'

// Mesmo padrão de verificarPermissao em /api/clientes/[cnpj]/atividades/route.ts:
// vendedor → só clientes da própria carteira; sdr → só os que criou;
// admin/gestor → qualquer um.
function verificarPermissao(
  papel: string,
  request: Request,
  clienteVendedorId: string | null,
  clienteCriadoPor: string,
): Response | null {
  if (papel === 'vendedor') {
    const vendedorId = getVendedorId(request)
    if (clienteVendedorId !== vendedorId) {
      return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
    }
  } else if (papel === 'sdr') {
    const email = request.headers.get('x-user-email')
    if (clienteCriadoPor !== email) {
      return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
    }
  }
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })

  const { cnpj } = await params
  const cliente = await buscarCliente(normalizarCNPJ(cnpj))
  if (!cliente) return Response.json({ ok: false, error: 'Cliente não encontrado' }, { status: 404 })

  const bloqueado = verificarPermissao(papel, request, cliente.vendedorId, cliente.criadoPor)
  if (bloqueado) return bloqueado

  try {
    const score = await calcularScoreIa(cliente.cnpj)
    return Response.json({ ok: true, ...score })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[GET /api/clientes/[cnpj]/score] erro:', msg, err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

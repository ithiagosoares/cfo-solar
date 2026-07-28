import { getPapel } from '@/lib/comercial-auth'
import { atribuirVendedor, normalizarCNPJ } from '@/lib/clientes-repository'

const PAPEIS_ATRIBUICAO = new Set(['administrador', 'gestor'])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_ATRIBUICAO.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  const { cnpj } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const vendedorId = body.vendedor_id
  if (vendedorId !== null && typeof vendedorId !== 'string') {
    return Response.json({ ok: false, error: 'vendedor_id deve ser uuid ou null' }, { status: 400 })
  }

  try {
    const cliente = await atribuirVendedor(normalizarCNPJ(cnpj), vendedorId as string | null)
    return Response.json({ ok: true, cliente })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = msg === 'Cliente não encontrado' ? 404 : 500
    return Response.json({ ok: false, error: msg }, { status })
  }
}

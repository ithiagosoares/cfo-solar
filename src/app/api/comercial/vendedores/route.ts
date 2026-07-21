import { listarVendedores, criarVendedor } from '@/lib/vendedores-repository'
import { requireComercialAccess } from '@/lib/comercial-auth'

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const apenasAtivos = searchParams.get('todos') !== '1'
    const vendedores = await listarVendedores(apenasAtivos)
    return Response.json({ ok: true, vendedores })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied
  try {
    const body = await request.json() as { nome?: unknown }
    if (!body.nome || typeof body.nome !== 'string') {
      return Response.json({ ok: false, error: 'Nome é obrigatório' }, { status: 400 })
    }
    const vendedor = await criarVendedor(body.nome)
    return Response.json({ ok: true, vendedor }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = msg.includes('já existe') ? 409 : 500
    return Response.json({ ok: false, error: msg }, { status })
  }
}

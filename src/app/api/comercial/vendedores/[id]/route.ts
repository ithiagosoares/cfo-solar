import { atualizarVendedor } from '@/lib/vendedores-repository'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const dados = await request.json() as { nome?: string; ativo?: boolean }
    const vendedor = await atualizarVendedor(id, dados)
    return Response.json({ ok: true, vendedor })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

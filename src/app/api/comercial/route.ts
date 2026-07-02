// Server-only route handler — único ponto da app que importa upper-client.
// Nunca expor tokenAcesso, UPPER_EMAIL ou UPPER_SENHA em nenhuma resposta.
import { buscarTodosPedidos } from '@/lib/upper-client'

export async function GET() {
  try {
    const pedidos = await buscarTodosPedidos()
    console.log(`[/api/comercial] Pedidos retornados: ${pedidos.length}`)
    return Response.json({
      ok: true,
      pedidos,
      sincronizadoEm: new Date().toISOString(),
    })
  } catch (err) {
    // err.message já é escrito sem credenciais (ver upper-client.ts) — seguro
    // de retornar ao cliente.
    const msg = err instanceof Error ? err.message : 'Erro desconhecido ao buscar pedidos da Upper'
    console.error('[/api/comercial]', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

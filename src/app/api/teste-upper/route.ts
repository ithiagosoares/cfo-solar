import { autenticarUpper, buscarPedidos } from '@/lib/upper-client'

// Endpoint isolado, só para validar autenticação + busca de dados de ponta a
// ponta antes de construir qualquer integração real. Não persiste nada, não
// tem interface — só retorna o JSON crú da Upper para inspeção manual.
export async function GET() {
  try {
    await autenticarUpper()
    const pedidos = await buscarPedidos()
    return Response.json({ ok: true, pedidos })
  } catch (err) {
    // err.message já é escrito sem credenciais (ver upper-client.ts) — seguro
    // de retornar ao cliente.
    const msg = err instanceof Error ? err.message : 'Erro desconhecido ao testar integração com a Upper'
    console.error('[/api/teste-upper]', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

import { getPapel, requireComercialAccess } from '@/lib/comercial-auth'
import { listarListas, criarLista } from '@/lib/crm-listas-repository'

// Criar lista é ação estrutural do board (afeta a visão de todo mundo) —
// restrita a administrador/gestor, mesmo padrão de "Gerenciar Vendedores".
const PAPEIS_ESTRUTURA = new Set(['administrador', 'gestor'])

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  try {
    const listas = await listarListas()
    return Response.json({ ok: true, listas })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_ESTRUTURA.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { nome, cor } = body
  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return Response.json({ ok: false, error: 'nome é obrigatório' }, { status: 400 })
  }

  try {
    const lista = await criarLista(nome, typeof cor === 'string' && cor ? cor : '#3A6080')
    return Response.json({ ok: true, lista }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

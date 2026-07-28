import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { criarCliente, listarClientes } from '@/lib/clientes-repository'
import type { FiltrosCliente, TipoCliente, OrigemCliente, StatusCliente } from '@/lib/clientes-repository'

const PAPEIS_CRIACAO = new Set(['sdr', 'administrador', 'gestor', 'vendedor'])

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  const { searchParams } = new URL(request.url)

  const filtros: FiltrosCliente = {}

  if (searchParams.get('status')) filtros.status = searchParams.get('status') as StatusCliente
  if (searchParams.get('tipo'))   filtros.tipo   = searchParams.get('tipo')   as TipoCliente
  if (searchParams.get('origem')) filtros.origem = searchParams.get('origem') as OrigemCliente

  // Filtros automáticos por papel — ignoram query params para garantir isolamento:
  if (papel === 'vendedor') {
    // Vendedor vê apenas a própria carteira; nunca aceita vendedor_id da query
    const vendedorId = getVendedorId(request)
    if (!vendedorId) {
      return Response.json({ ok: false, error: 'Vendedor sem carteira configurada' }, { status: 403 })
    }
    filtros.vendedorId = vendedorId
  } else if (papel === 'sdr') {
    // SDR vê apenas o que criou — sempre, sem exceção
    const email = request.headers.get('x-user-email')
    if (email) filtros.criadoPor = email
  } else {
    // administrador / gestor: filtros opcionais via query params
    if (searchParams.get('vendedor_id')) filtros.vendedorId = searchParams.get('vendedor_id')!
    if (searchParams.get('meus') === '1') {
      const email = request.headers.get('x-user-email')
      if (email) filtros.criadoPor = email
    }
  }

  try {
    const clientes = await listarClientes(filtros)
    return Response.json({ ok: true, clientes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_CRIACAO.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  // criado_por vem do header injetado pelo proxy — nunca do corpo da requisição
  const criadoPor = request.headers.get('x-user-email')
  if (!criadoPor) {
    return Response.json({ ok: false, error: 'Usuário não identificado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { cnpj, razaoSocial, tipo, origem, vendedorId: vendedorIdBody } = body as {
    cnpj?: unknown
    razaoSocial?: unknown
    tipo?: unknown
    origem?: unknown
    vendedorId?: unknown
  }

  if (!cnpj || typeof cnpj !== 'string') {
    return Response.json({ ok: false, error: 'cnpj é obrigatório' }, { status: 400 })
  }
  if (!razaoSocial || typeof razaoSocial !== 'string') {
    return Response.json({ ok: false, error: 'razaoSocial é obrigatório' }, { status: 400 })
  }
  if (tipo !== 'distribuidora' && tipo !== 'integrador') {
    return Response.json({ ok: false, error: 'tipo deve ser "distribuidora" ou "integrador"' }, { status: 400 })
  }
  if (origem !== 'prospeccao' && origem !== 'lead') {
    return Response.json({ ok: false, error: 'origem deve ser "prospeccao" ou "lead"' }, { status: 400 })
  }

  // vendedorId: vendedor usa o próprio id (do header) — nunca aceita valor do corpo
  let resolvedVendedorId: string | null
  if (papel === 'vendedor') {
    resolvedVendedorId = getVendedorId(request)
    if (!resolvedVendedorId) {
      return Response.json({ ok: false, error: 'Vendedor sem carteira configurada' }, { status: 403 })
    }
  } else {
    resolvedVendedorId = typeof vendedorIdBody === 'string' ? vendedorIdBody : null
  }

  try {
    const cliente = await criarCliente(
      {
        cnpj: cnpj as string,
        razaoSocial: razaoSocial as string,
        tipo: tipo as TipoCliente,
        origem: origem as OrigemCliente,
        vendedorId: resolvedVendedorId,
      },
      criadoPor,
    )
    return Response.json({ ok: true, cliente }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = msg === 'CNPJ inválido' ? 422
      : msg === 'CNPJ já cadastrado' ? 409
      : 500
    return Response.json({ ok: false, error: msg }, { status })
  }
}

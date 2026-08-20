import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { criarCliente, listarClientes } from '@/lib/clientes-repository'
import type { FiltrosCliente, TipoCliente, OrigemCliente, StatusCliente } from '@/lib/clientes-repository'

const POR_PAGINA_MAX = 100

const PAPEIS_CRIACAO = new Set(['sdr', 'administrador', 'gestor', 'vendedor'])

export async function GET(request: Request) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  const { searchParams } = new URL(request.url)

  const filtros: FiltrosCliente = {}

  if (searchParams.get('status'))    filtros.status    = searchParams.get('status')    as StatusCliente
  if (searchParams.get('listaId'))   filtros.listaId   = searchParams.get('listaId')!
  if (searchParams.get('tipo'))      filtros.tipo      = searchParams.get('tipo')      as TipoCliente
  if (searchParams.get('origem'))    filtros.origem    = searchParams.get('origem')    as OrigemCliente
  if (searchParams.get('busca'))             filtros.busca             = searchParams.get('busca')!
  if (searchParams.get('arquivados') === '1') filtros.mostrarArquivados = true

  const pagina    = parseInt(searchParams.get('pagina')    ?? '1',  10)
  const porPagina = parseInt(searchParams.get('porPagina') ?? '20', 10)
  filtros.pagina    = isNaN(pagina)    ? 1  : Math.max(1, pagina)
  filtros.porPagina = isNaN(porPagina) ? 20 : Math.min(POR_PAGINA_MAX, Math.max(1, porPagina))

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
    const { clientes, total } = await listarClientes(filtros)
    return Response.json({ ok: true, clientes, total })
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

  const {
    cnpj, razaoSocial, tipo, origem,
    origemLeadDetalhe,
    cidade, estado, telefone,
    nomeContato, emailContato,
    vendedorId: vendedorIdBody,
    listaId,
  } = body as {
    cnpj?: unknown; razaoSocial?: unknown; tipo?: unknown; origem?: unknown
    origemLeadDetalhe?: unknown
    cidade?: unknown; estado?: unknown; telefone?: unknown
    nomeContato?: unknown; emailContato?: unknown
    vendedorId?: unknown
    listaId?: unknown
  }

  // Validações obrigatórias de estrutura
  if (!cnpj || typeof cnpj !== 'string')
    return Response.json({ ok: false, error: 'cnpj é obrigatório' }, { status: 400 })
  if (!razaoSocial || typeof razaoSocial !== 'string')
    return Response.json({ ok: false, error: 'razaoSocial é obrigatório' }, { status: 400 })
  if (tipo !== 'distribuidora' && tipo !== 'integrador')
    return Response.json({ ok: false, error: 'tipo deve ser "distribuidora" ou "integrador"' }, { status: 400 })
  if (origem !== 'prospeccao' && origem !== 'lead')
    return Response.json({ ok: false, error: 'origem deve ser "prospeccao" ou "lead"' }, { status: 400 })

  // Campos de contato obrigatórios
  if (!cidade || typeof cidade !== 'string' || !cidade.trim())
    return Response.json({ ok: false, error: 'cidade é obrigatória' }, { status: 400 })
  if (!estado || typeof estado !== 'string' || estado.trim().length !== 2)
    return Response.json({ ok: false, error: 'estado deve ser a sigla com 2 letras (ex: SP)' }, { status: 400 })
  if (!telefone || typeof telefone !== 'string' || !telefone.trim())
    return Response.json({ ok: false, error: 'telefone é obrigatório' }, { status: 400 })

  // origemLeadDetalhe: obrigatório para lead, ignorado para prospecção
  if (origem === 'lead' && (!origemLeadDetalhe || typeof origemLeadDetalhe !== 'string'))
    return Response.json({ ok: false, error: 'Canal de origem é obrigatório para leads' }, { status: 400 })

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
        cnpj:                cnpj as string,
        razaoSocial:         razaoSocial as string,
        tipo:                tipo as TipoCliente,
        origem:              origem as OrigemCliente,
        origemLeadDetalhe:   origem === 'lead' ? (origemLeadDetalhe as string) : null,
        cidade:              cidade as string,
        estado:              estado as string,
        telefone:            telefone as string,
        nomeContato:         typeof nomeContato  === 'string' ? nomeContato  : null,
        emailContato:        typeof emailContato === 'string' ? emailContato : null,
        vendedorId:          resolvedVendedorId,
        listaId:             typeof listaId === 'string' && listaId ? listaId : undefined,
      },
      criadoPor,
    )
    return Response.json({ ok: true, cliente }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = msg === 'CNPJ inválido'    ? 422
      : msg === 'CNPJ já cadastrado'          ? 409
      : msg.includes('obrigatório')           ? 400
      : msg.includes('obrigatória')           ? 400
      : 500
    return Response.json({ ok: false, error: msg }, { status })
  }
}

import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { buscarCliente, normalizarCNPJ } from '@/lib/clientes-repository'
import {
  listarAtividades,
  criarAtividade,
  resolverNomesUsuarios,
} from '@/lib/atividades-repository'
import type { TipoAtividade, ResultadoAtividade } from '@/lib/atividades-repository'
import { TIPOS_ATIVIDADE, RESULTADOS_ATIVIDADE, resultadoValidoParaTipo } from '@/lib/atividade-config'

// Mesmo padrão de verificarPermissao em /api/clientes/[cnpj]/route.ts:
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

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
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
    const atividades = await listarAtividades(cliente.cnpj)
    const nomes = await resolverNomesUsuarios(atividades.map(a => a.usuarioId))
    return Response.json({
      ok: true,
      atividades: atividades.map(a => ({ ...a, nomeUsuario: nomes[a.usuarioId] ?? 'Usuário' })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[GET /api/clientes/[cnpj]/atividades] erro:', msg, err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })

  const usuarioId = request.headers.get('x-user-id')
  if (!usuarioId) return Response.json({ ok: false, error: 'Usuário não identificado' }, { status: 403 })

  const { cnpj } = await params
  const cliente = await buscarCliente(normalizarCNPJ(cnpj))
  if (!cliente) return Response.json({ ok: false, error: 'Cliente não encontrado' }, { status: 404 })

  const bloqueado = verificarPermissao(papel, request, cliente.vendedorId, cliente.criadoPor)
  if (bloqueado) return bloqueado

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { tipo, resultado, notas, dataRealizado, dataAgendada } = body

  if (!tipo || typeof tipo !== 'string' || !TIPOS_ATIVIDADE.includes(tipo as TipoAtividade)) {
    return Response.json({ ok: false, error: 'Tipo é obrigatório' }, { status: 400 })
  }
  if (resultado !== undefined && resultado !== null) {
    if (typeof resultado !== 'string' || !RESULTADOS_ATIVIDADE.includes(resultado as ResultadoAtividade)) {
      return Response.json({ ok: false, error: 'Resultado inválido' }, { status: 400 })
    }
    if (!resultadoValidoParaTipo(tipo as TipoAtividade, resultado as ResultadoAtividade)) {
      return Response.json(
        { ok: false, error: `Resultado "${resultado}" não é válido para o tipo "${tipo}"` },
        { status: 400 },
      )
    }
  }
  if (dataRealizado && (resultado === undefined || resultado === null)) {
    return Response.json({ ok: false, error: 'Resultado é obrigatório para atividades já realizadas' }, { status: 400 })
  }
  if (dataAgendada && typeof dataAgendada === 'string' && dataAgendada < hojeIso()) {
    return Response.json({ ok: false, error: 'Data agendada não pode ser no passado' }, { status: 400 })
  }

  try {
    const atividade = await criarAtividade({
      clienteCnpj: cliente.cnpj,
      tipo: tipo as TipoAtividade,
      resultado: (resultado as ResultadoAtividade | null) ?? null,
      dataRealizado: typeof dataRealizado === 'string' ? dataRealizado : null,
      dataAgendada: typeof dataAgendada === 'string' ? dataAgendada : null,
      notas: typeof notas === 'string' ? notas : null,
      usuarioId,
    })
    return Response.json({ ok: true, atividade }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 400 })
  }
}

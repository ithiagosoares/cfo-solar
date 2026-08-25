import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import { buscarCliente, normalizarCNPJ } from '@/lib/clientes-repository'
import {
  buscarAtividadePorId,
  atualizarAtividade,
  arquivarAtividade,
} from '@/lib/atividades-repository'
import type { ResultadoAtividade } from '@/lib/atividades-repository'
import { RESULTADOS_ATIVIDADE, resultadoValidoParaTipo } from '@/lib/atividade-config'

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

async function resolverClienteEAtividade(request: Request, cnpj: string, id: string) {
  const papel = getPapel(request)
  if (!papel) return { erro: Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 }) } as const

  const cnpjNorm = normalizarCNPJ(cnpj)
  const cliente = await buscarCliente(cnpjNorm)
  if (!cliente) {
    console.error('[PATCH/DELETE atividades] cliente não encontrado — cnpj (raw):', cnpj, 'cnpj (normalizado):', cnpjNorm)
    return { erro: Response.json({ ok: false, error: 'Cliente não encontrado' }, { status: 404 }) } as const
  }

  const bloqueado = verificarPermissao(papel, request, cliente.vendedorId, cliente.criadoPor)
  if (bloqueado) return { erro: bloqueado } as const

  const atividade = await buscarAtividadePorId(id)
  if (!atividade) {
    console.error('[PATCH/DELETE atividades] atividade não encontrada — id:', id, 'cliente.cnpj:', cliente.cnpj)
    return { erro: Response.json({ ok: false, error: 'Atividade não encontrada' }, { status: 404 }) } as const
  }
  if (atividade.clienteCnpj !== cliente.cnpj) {
    console.error(
      '[PATCH/DELETE atividades] cnpj da atividade não bate com o cliente da URL — id:', id,
      'atividade.clienteCnpj:', JSON.stringify(atividade.clienteCnpj),
      'cliente.cnpj:', JSON.stringify(cliente.cnpj),
    )
    return { erro: Response.json({ ok: false, error: 'Atividade não encontrada' }, { status: 404 }) } as const
  }

  return { cliente, atividade } as const
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cnpj: string; id: string }> },
) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const { cnpj, id } = await params
  const resolvido = await resolverClienteEAtividade(request, cnpj, id)
  if ('erro' in resolvido) return resolvido.erro
  const { atividade } = resolvido

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const { resultado, notas, marcarRealizado } = body

  if (resultado !== undefined && resultado !== null) {
    if (typeof resultado !== 'string' || !RESULTADOS_ATIVIDADE.includes(resultado as ResultadoAtividade)) {
      return Response.json({ ok: false, error: 'Resultado inválido' }, { status: 400 })
    }
    if (!resultadoValidoParaTipo(atividade.tipo, resultado as ResultadoAtividade)) {
      return Response.json(
        { ok: false, error: `Resultado "${resultado}" não é válido para o tipo "${atividade.tipo}"` },
        { status: 400 },
      )
    }
  }
  if (marcarRealizado === true && !resultado && !atividade.resultado) {
    return Response.json({ ok: false, error: 'Resultado é obrigatório para marcar como realizado' }, { status: 400 })
  }

  try {
    const atualizada = await atualizarAtividade(id, {
      resultado: resultado !== undefined ? (resultado as ResultadoAtividade | null) : undefined,
      notas: notas !== undefined ? (notas as string | null) : undefined,
      marcarRealizado: marcarRealizado === true,
    })
    return Response.json({ ok: true, atividade: atualizada })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ cnpj: string; id: string }> },
) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const { cnpj, id } = await params
  const resolvido = await resolverClienteEAtividade(request, cnpj, id)
  if ('erro' in resolvido) return resolvido.erro

  try {
    await arquivarAtividade(id)
    return Response.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

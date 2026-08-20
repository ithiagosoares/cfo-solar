import { getPapel, getVendedorId, requireComercialAccess } from '@/lib/comercial-auth'
import {
  buscarCliente,
  atualizarCliente,
  arquivarCliente,
  normalizarCNPJ,
} from '@/lib/clientes-repository'
import type { DadosAtualizacaoCliente, CanalPreferido, TipoCliente, OrigemCliente } from '@/lib/clientes-repository'

// Verifica se o usuário tem permissão sobre o cliente.
// vendedor → apenas os da própria carteira (vendedor_id = x-vendedor-id header)
// sdr      → apenas os que ele criou (criado_por = x-user-email header)
// admin/gestor → qualquer um
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

  return Response.json({ ok: true, cliente })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const denied = requireComercialAccess(request)
  if (denied) return denied

  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })

  const { cnpj } = await params
  const cnpjNorm = normalizarCNPJ(cnpj)

  // Busca o cliente para checar permissão antes de aceitar o body
  const clienteExistente = await buscarCliente(cnpjNorm)
  if (!clienteExistente) return Response.json({ ok: false, error: 'Cliente não encontrado' }, { status: 404 })

  const bloqueado = verificarPermissao(papel, request, clienteExistente.vendedorId, clienteExistente.criadoPor)
  if (bloqueado) return bloqueado

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  // Ação de arquivamento
  if (body.arquivar !== undefined) {
    try {
      await arquivarCliente(cnpjNorm, body.arquivar === true)
      const atualizado = await buscarCliente(cnpjNorm)
      return Response.json({ ok: true, cliente: atualizado })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      return Response.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  const dados: DadosAtualizacaoCliente = {}

  if (body.razaoSocial       !== undefined) dados.razaoSocial       = String(body.razaoSocial)
  if (body.tipo              !== undefined) dados.tipo               = body.tipo as TipoCliente
  if (body.origem            !== undefined) dados.origem             = body.origem as OrigemCliente
  if (body.origemLeadDetalhe !== undefined) dados.origemLeadDetalhe  = body.origemLeadDetalhe as string | null
  if (body.cidade            !== undefined) dados.cidade             = String(body.cidade)
  if (body.estado            !== undefined) dados.estado             = String(body.estado)
  if (body.telefone          !== undefined) dados.telefone           = String(body.telefone)
  if (body.nomeContato       !== undefined) dados.nomeContato        = body.nomeContato as string | null
  if (body.emailContato      !== undefined) dados.emailContato       = body.emailContato as string | null
  if (body.listaId           !== undefined) dados.listaId            = String(body.listaId)
  if (body.posicao           !== undefined) dados.posicao            = Number(body.posicao)
  if (body.ultimoContato     !== undefined) dados.ultimoContato      = body.ultimoContato as string | null
  if (body.proximaAcao       !== undefined) dados.proximaAcao        = body.proximaAcao as string | null
  if (body.proximaAcaoData   !== undefined) dados.proximaAcaoData    = body.proximaAcaoData as string | null
  if (body.observacoes       !== undefined) dados.observacoes        = body.observacoes as string | null
  if (body.canalPreferido    !== undefined) dados.canalPreferido     = body.canalPreferido as CanalPreferido | null
  if (body.produtoInteresse  !== undefined) dados.produtoInteresse   = body.produtoInteresse as string | null

  try {
    const cliente = await atualizarCliente(cnpjNorm, dados)
    return Response.json({ ok: true, cliente })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    if (msg === 'Nenhum campo para atualizar') return Response.json({ ok: false, error: msg }, { status: 400 })
    if (msg === 'Cliente não encontrado')       return Response.json({ ok: false, error: msg }, { status: 404 })
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

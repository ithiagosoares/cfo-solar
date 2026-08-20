import { getPapel } from '@/lib/comercial-auth'
import { atualizarLista } from '@/lib/crm-listas-repository'
import type { DadosAtualizacaoLista } from '@/lib/crm-listas-repository'

// Renomear/reordenar/arquivar lista é ação estrutural do board — restrita a
// administrador/gestor. Mover cartões entre listas é feito via PATCH em
// /api/clientes/[cnpj], que segue as permissões normais de cliente.
const PAPEIS_ESTRUTURA = new Set(['administrador', 'gestor'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_ESTRUTURA.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const dados: DadosAtualizacaoLista = {}
  if (body.nome      !== undefined) dados.nome      = String(body.nome)
  if (body.cor       !== undefined) dados.cor       = String(body.cor)
  if (body.posicao   !== undefined) dados.posicao   = Number(body.posicao)
  if (body.arquivado !== undefined) dados.arquivado = body.arquivado === true

  try {
    const lista = await atualizarLista(id, dados)
    return Response.json({ ok: true, lista })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = msg === 'Lista não encontrada' ? 404 : msg === 'Nenhum campo para atualizar' ? 400 : 500
    return Response.json({ ok: false, error: msg }, { status })
  }
}

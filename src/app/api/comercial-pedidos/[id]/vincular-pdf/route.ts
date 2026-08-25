// POST /api/comercial-pedidos/[id]/vincular-pdf
//
// Segundo passo do fluxo de anexo de PDF: grava em comercial_pedidos e
// comercial_pedidos_itens os dados já extraídos e já enviados ao Drive por
// /upload-pdf (não recebe o arquivo de novo — só as referências e os campos
// extraídos, que o usuário confirmou no preview). [id] é o pedido de destino do
// vínculo — pode ser diferente do [id] usado em /upload-pdf quando o usuário
// corrigiu uma correspondência duvidosa escolhendo outro candidato.

import { getPapel, verificarPermissaoPedido } from '@/lib/comercial-auth'
import { buscarPedidoPorId, vincularPdfPedido } from '@/lib/comercial-pedidos-repository'
import { substituirItensPedido, type DadosItemPedido } from '@/lib/comercial-pedidos-itens-repository'

interface ItemBody {
  codigo?: string | null
  descricao: string
  quantidade: number
  unidade?: string | null
  valorUnitario: number
  valorTotal: number
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const papel = getPapel(request)
  if (!papel) return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const pedido = await buscarPedidoPorId(id)
  if (!pedido) return Response.json({ ok: false, error: 'Orçamento não encontrado' }, { status: 404 })

  const negado = verificarPermissaoPedido(papel, request, pedido.vendedorId)
  if (negado) return negado

  let body: {
    driveFileId?: string
    driveUrl?: string
    vendedorAtribuidoId?: string | null
    numeroPedidoExtraido?: string | null
    itens?: ItemBody[]
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.driveFileId || !body.driveUrl) {
    return Response.json({ ok: false, error: 'driveFileId e driveUrl são obrigatórios' }, { status: 400 })
  }

  const itens: DadosItemPedido[] = (body.itens ?? []).map(i => ({
    codigo:        i.codigo ?? null,
    descricao:     i.descricao,
    quantidade:    Number(i.quantidade),
    unidade:       i.unidade ?? null,
    valorUnitario: Number(i.valorUnitario),
    valorTotal:    Number(i.valorTotal),
  }))

  try {
    await vincularPdfPedido(id, {
      pdfUrl:                body.driveUrl,
      pdfGoogleDriveId:      body.driveFileId,
      vendedorAtribuidoId:   body.vendedorAtribuidoId ?? null,
      numeroPedidoExtraido:  body.numeroPedidoExtraido ?? null,
    })
    await substituirItensPedido(id, itens)

    const atualizado = await buscarPedidoPorId(id)
    return Response.json({ ok: true, pedido: atualizado })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial-pedidos/[id]/vincular-pdf] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET /api/comercial-pedidos/[id]/pdf
//
// Proxy de download do PDF anexado ao pedido. Nunca expomos o link direto do
// Google Drive ao cliente como caminho de acesso — o arquivo no Drive é privado
// à service account; todo acesso passa por aqui, onde a permissão é sempre
// validada contra o dono real do pedido (vendedor_id), nunca por posse do link.

import { getPapel, verificarPermissaoPedido } from '@/lib/comercial-auth'
import { buscarPedidoPorId } from '@/lib/comercial-pedidos-repository'
import { baixarPdfDoDrive } from '@/lib/google-drive-client'

export async function GET(
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

  if (!pedido.pdfGoogleDriveId) {
    return Response.json({ ok: false, error: 'Este orçamento não tem PDF anexado' }, { status: 404 })
  }

  try {
    const buffer = await baixarPdfDoDrive(pedido.pdfGoogleDriveId)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="orcamento-${pedido.numeroPedido ?? pedido.id}.pdf"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial-pedidos/[id]/pdf] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

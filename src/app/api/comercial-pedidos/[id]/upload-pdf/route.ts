// POST /api/comercial-pedidos/[id]/upload-pdf
//
// Recebe multipart/form-data com um único campo `file` (o PDF do orçamento).
// Faz upload do arquivo para o Google Drive (service account dedicada), extrai os
// dados do PDF (determinístico, via pdfjs-dist — nunca IA, CLAUDE.md seção 9) e
// compara com o pedido [id] indicado. NÃO grava nada em comercial_pedidos ou
// comercial_pedidos_itens aqui — isso só acontece em /vincular-pdf, depois que o
// usuário confirma o preview. Esta rota só faz upload + extração + veredito.
//
// Resposta:
//   { ok: true, status: 'segura'|'duvidosa', extraido, driveFileId, driveUrl,
//     candidatos? }

import { getPapel, verificarPermissaoPedido } from '@/lib/comercial-auth'
import { buscarPedidoPorId, buscarCandidatosPedido } from '@/lib/comercial-pedidos-repository'
import { enviarPdfParaDrive } from '@/lib/google-drive-client'
import { extrairDadosOrcamentoPdf, resolverVendedorPorNomeExtraido } from '@/lib/pdf-orcamento-parser'
import { avaliarCorrespondencia } from '@/lib/comercial-pedidos-pdf-match'
import { listarVendedores } from '@/lib/vendedores-repository'

const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024 // 20 MB

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ ok: false, error: 'Requisição inválida (esperado multipart/form-data)' }, { status: 400 })
  }

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File)) {
    return Response.json({ ok: false, error: 'Arquivo não enviado (campo "file")' }, { status: 400 })
  }
  if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ ok: false, error: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return Response.json({ ok: false, error: 'Arquivo excede o tamanho máximo de 20 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  try {
    const [drive, extraido, vendedores] = await Promise.all([
      enviarPdfParaDrive(buffer, arquivo.name),
      extrairDadosOrcamentoPdf(buffer),
      listarVendedores(false),
    ])

    const vendedorResolvido = extraido.vendedorNomeExtraido
      ? resolverVendedorPorNomeExtraido(extraido.vendedorNomeExtraido, vendedores)
      : null

    const correspondencia = avaliarCorrespondencia(extraido, pedido)

    if (correspondencia.status === 'segura') {
      return Response.json({
        ok: true,
        status: 'segura',
        extraido,
        vendedorAtribuidoId: vendedorResolvido?.id ?? null,
        driveFileId: drive.id,
        driveUrl: drive.webViewLink,
      })
    }

    const candidatos = await buscarCandidatosPedido({
      numeroPedido: extraido.numeroPedido,
      valorAproximado: extraido.valorTotal,
      vendedorId: papel === 'vendedor' ? pedido.vendedorId : null,
    })

    return Response.json({
      ok: true,
      status: 'duvidosa',
      motivos: correspondencia.motivos,
      extraido,
      vendedorAtribuidoId: vendedorResolvido?.id ?? null,
      driveFileId: drive.id,
      driveUrl: drive.webViewLink,
      candidatos,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial-pedidos/[id]/upload-pdf] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

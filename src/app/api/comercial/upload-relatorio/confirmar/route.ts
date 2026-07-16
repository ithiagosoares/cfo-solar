// POST /api/comercial/upload-relatorio/confirmar
//   Insere os registros em comercial_pedidos e marca a importação como confirmada.
//   Body: { importacaoId: string, mapeamentoVendedores: Record<string, string> }
//
// DELETE /api/comercial/upload-relatorio/confirmar?importacaoId=xxx
//   Marca a importação como cancelada sem inserir nada em comercial_pedidos.

import {
  buscarImportacao,
  atualizarStatusImportacao,
} from '@/lib/comercial-importacoes-repository'
import { inserirPedidosImportacao } from '@/lib/comercial-pedidos-repository'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      importacaoId?: string
      mapeamentoVendedores?: Record<string, string>
    }

    const { importacaoId, mapeamentoVendedores = {} } = body

    if (!importacaoId) {
      return Response.json({ ok: false, error: 'importacaoId é obrigatório' }, { status: 400 })
    }

    const importacao = await buscarImportacao(importacaoId)

    if (importacao.status !== 'pendente_revisao') {
      return Response.json(
        { ok: false, error: `Importação já foi processada com status "${importacao.status}"` },
        { status: 409 },
      )
    }

    // Atualiza o status ANTES de inserir: se o insert falhar, o status já está
    // 'confirmado' e o guard acima bloqueia qualquer retry com 409, evitando
    // reinserção de duplicatas.
    await atualizarStatusImportacao(importacaoId, 'confirmado')

    await inserirPedidosImportacao(
      importacao.registrosPreview,
      importacaoId,
      mapeamentoVendedores,
    )

    return Response.json({ ok: true, totalInserido: importacao.registrosPreview.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/upload-relatorio/confirmar] POST erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const importacaoId = searchParams.get('importacaoId')

    if (!importacaoId) {
      return Response.json({ ok: false, error: 'importacaoId é obrigatório' }, { status: 400 })
    }

    await atualizarStatusImportacao(importacaoId, 'descartado')

    return Response.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/upload-relatorio/confirmar] DELETE erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

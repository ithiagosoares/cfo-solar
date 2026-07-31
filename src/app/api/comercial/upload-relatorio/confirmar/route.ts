// POST /api/comercial/upload-relatorio/confirmar
//   Insere os registros em comercial_pedidos e marca a importação como confirmada.
//   Se a importação contiver totais/rentabilidade por vendedor, persiste em
//   vendedores_totais_oficiais usando o período do upload.
//   Body: { importacaoId: string, mapeamentoVendedores: Record<string, string> }
//
// DELETE /api/comercial/upload-relatorio/confirmar?importacaoId=xxx
//   Marca a importação como cancelada sem inserir nada em comercial_pedidos.

import {
  buscarImportacao,
  atualizarStatusImportacao,
} from '@/lib/comercial-importacoes-repository'
import { inserirPedidosImportacao } from '@/lib/comercial-pedidos-repository'
import { upsertTotaisOficiais, type TotalOficialInput } from '@/lib/vendedores-totais-repository'
import { listarVendedores } from '@/lib/vendedores-repository'
import { getPapel } from '@/lib/comercial-auth'

const PAPEIS_UPLOAD = new Set(['administrador', 'gestor'])

export async function POST(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_UPLOAD.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }
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

    // Inserir pedidos (standalone upload não tem registros — pula silenciosamente)
    if (importacao.registrosPreview.length > 0) {
      await inserirPedidosImportacao(
        importacao.registrosPreview,
        importacaoId,
        mapeamentoVendedores,
      )
    }

    // ── Persistir totais oficiais (quando período e relatórios estiverem presentes) ──
    let totaisOficiaisInseridos = 0

    const temTotaisERP = importacao.totaisVendedor.length > 0 || importacao.rentabilidadeVendedor.length > 0
    const temPeriodo   = !!importacao.periodoInicio && !!importacao.periodoFim

    if (temTotaisERP && temPeriodo) {
      const periodoInicio = importacao.periodoInicio!
      const periodoFim    = importacao.periodoFim!

      // Mapear nomes → IDs: primeiro pelos cadastrados, depois pelas sobreposições manuais
      const vendedoresCadastrados = await listarVendedores(false)
      const idPorNome = new Map(
        vendedoresCadastrados.map(v => [v.nome.toLowerCase().trim(), v.id])
      )
      // mapeamentoVendedores chaves são nomes não-reconhecidos mapeados manualmente pelo usuário
      for (const [nome, id] of Object.entries(mapeamentoVendedores)) {
        idPorNome.set(nome.toLowerCase().trim(), id)
      }

      const inputs: TotalOficialInput[] = []

      const filial = importacao.filial

      for (const r of importacao.rentabilidadeVendedor) {
        const vendedorId = idPorNome.get(r.vendedor.toLowerCase().trim())
        console.log(`[confirmar-totais] rentabilidade | nome: "${r.vendedor}" | id: ${vendedorId ?? 'NÃO RESOLVIDO'} | filial: ${filial ?? 'null'} | valor: ${r.valorTotal}`)
        if (!vendedorId) continue  // nome não resolvido — ignorar

        inputs.push({
          vendedorId,
          periodoInicio,
          periodoFim,
          valorTotalOficial: r.valorTotal,
          quantidadeVendas:  r.quantidadeVendas,
          fonte:             'rentabilidade_vendedor',
          filial,
          importacaoId,
        })
      }

      for (const t of importacao.totaisVendedor) {
        const vendedorId = idPorNome.get(t.vendedor.toLowerCase().trim())
        console.log(`[confirmar-totais] total_venda | nome: "${t.vendedor}" | id: ${vendedorId ?? 'NÃO RESOLVIDO'} | filial: ${filial ?? 'null'} | valor: ${t.valorTotal}`)
        if (!vendedorId) continue

        // Inserimos mesmo que o vendedor já tenha entrada em rentabilidade_vendedor —
        // fontes distintas; buscarTotaisOficiais / calcularDesempenhoPorVendedor preferem rentabilidade.
        inputs.push({
          vendedorId,
          periodoInicio,
          periodoFim,
          valorTotalOficial: t.valorTotal,
          quantidadeVendas:  null,
          fonte:             'total_venda_vendedor',
          filial,
          importacaoId,
        })
      }

      if (inputs.length > 0) {
        await upsertTotaisOficiais(inputs)
        totaisOficiaisInseridos = inputs.length
      }
    }

    return Response.json({
      ok: true,
      totalInserido: importacao.registrosPreview.length,
      totaisOficiaisInseridos,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/upload-relatorio/confirmar] POST erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_UPLOAD.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }
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

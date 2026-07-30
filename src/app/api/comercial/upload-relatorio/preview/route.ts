// POST /api/comercial/upload-relatorio/preview
//
// Recebe multipart/form-data com:
//   arquivos:      File[] (.html)
//   empresa:       string
//   filial:        string
//   periodoInicio: string (ISO date, opcional — obrigatório se não houver pedidos_orcamento)
//   periodoFim:    string (ISO date, opcional — obrigatório se não houver pedidos_orcamento)
//
// Processa sem inserir em comercial_pedidos. Salva em comercial_importacoes
// (status = 'pendente_revisao') e retorna o preview para revisão humana.
//
// Suporta dois modos:
//   Completo:   inclui pedidos_orcamento + totais/rentabilidade opcionais
//   Standalone: apenas totais/rentabilidade (sem pedidos) — alimenta vendedores_totais_oficiais

import {
  identificarTipoRelatorio,
  parsePedidosOrcamento,
  parseTotaisPorVendedor,
  parseRentabilidadePorVendedor,
  extrairOrigemRelatorio,
} from '@/lib/comercial-relatorios-parser'
import { validarDivergencias } from '@/lib/comercial-validacao'
import { listarVendedores } from '@/lib/vendedores-repository'
import { criarImportacao, type RegistroPreview } from '@/lib/comercial-importacoes-repository'
import { getPapel } from '@/lib/comercial-auth'

const PAPEIS_UPLOAD = new Set(['administrador', 'gestor'])

const FILIAL_PARA_UF: Record<string, string> = {
  'São Paulo': 'SP',
  'Paraná':    'PR',
}

const EMPRESAS_VALIDAS = [
  'Solar System Matriz',
  'Solar System Filial PR',
  'Level2',
  'Ni Hao',
  'AluMarket',
]
const FILIAIS_VALIDAS = ['São Paulo', 'Paraná']

export async function POST(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_UPLOAD.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }
  try {
    // ── 1. Ler form data ────────────────────────────────────────────────────
    const formData = await request.formData()

    const empresa       = (formData.get('empresa')       as string | null)?.trim() ?? ''
    const filial        = (formData.get('filial')        as string | null)?.trim() ?? ''
    const periodoInicio = (formData.get('periodoInicio') as string | null)?.trim() || null
    const periodoFim    = (formData.get('periodoFim')    as string | null)?.trim() || null

    if (!EMPRESAS_VALIDAS.includes(empresa)) {
      return Response.json({ ok: false, error: `Empresa inválida: "${empresa}"` }, { status: 400 })
    }
    if (!FILIAIS_VALIDAS.includes(filial)) {
      return Response.json({ ok: false, error: `Filial inválida: "${filial}"` }, { status: 400 })
    }

    const arquivosRaw = formData.getAll('arquivos') as File[]
    if (arquivosRaw.length === 0) {
      return Response.json({ ok: false, error: 'Nenhum arquivo recebido.' }, { status: 400 })
    }

    // ── 2. Ler conteúdo e identificar tipo de cada arquivo ──────────────────
    const avisos: string[] = []
    const arquivosProcessados: { nome: string; tipo: string; html: string }[] = []

    for (const arquivo of arquivosRaw) {
      const html = await arquivo.text()
      const tipo = identificarTipoRelatorio(html)

      if (tipo === 'desconhecido') {
        avisos.push(`Arquivo "${arquivo.name}" não reconhecido — ignorado no processamento.`)
      }

      arquivosProcessados.push({ nome: arquivo.name, tipo, html })
    }

    // ── 3. Verificar conteúdo disponível ────────────────────────────────────
    const principalArq = arquivosProcessados.find(a => a.tipo === 'pedidos_orcamento')
    const totaisArq    = arquivosProcessados.find(a => a.tipo === 'totais_vendedor')
    const rentArq      = arquivosProcessados.find(a => a.tipo === 'rentabilidade_vendedor')

    const temPedidos = !!principalArq
    const temTotais  = !!totaisArq || !!rentArq

    if (!temPedidos && !temTotais) {
      return Response.json(
        {
          ok: false,
          error: 'Nenhum relatório reconhecido. Inclua ao menos o relatório de Pedidos de Orçamento ou um relatório de totais/rentabilidade por vendedor.',
          avisos,
        },
        { status: 400 },
      )
    }

    // Upload standalone (apenas totais/rentabilidade) exige período explícito
    if (!temPedidos && (!periodoInicio || !periodoFim)) {
      return Response.json(
        {
          ok: false,
          error: 'Para upload de totais sem relatório de orçamentos, informe o período (início e fim).',
          avisos,
        },
        { status: 400 },
      )
    }

    // ── 4. Parsear arquivos identificados ───────────────────────────────────
    const pedidos      = principalArq ? parsePedidosOrcamento(principalArq.html) : []
    const totais       = totaisArq    ? parseTotaisPorVendedor(totaisArq.html)     : []
    const rentabilidade = rentArq     ? parseRentabilidadePorVendedor(rentArq.html) : []

    // ── 5. Validar divergências (só relevante quando há pedidos para comparar) ─
    const divergencias = temPedidos ? validarDivergencias(pedidos, totais, rentabilidade) : []

    // ── 6. Resolver vendedores ──────────────────────────────────────────────
    const vendedoresCadastrados = await listarVendedores(false)  // inclui inativos

    const vendedorPorNome = new Map(
      vendedoresCadastrados.map(v => [v.nome.toLowerCase().trim(), v])
    )

    // Nomes únicos de TODOS os relatórios (pedidos + totais + rentabilidade)
    const nomesDesPedidos   = pedidos.map(p => p.vendedor.trim()).filter(Boolean)
    const nomesDesTotais    = totais.map(t => t.vendedor.trim()).filter(Boolean)
    const nomesDasRent      = rentabilidade.map(r => r.vendedor.trim()).filter(Boolean)
    const nomesUnicos       = [...new Set([...nomesDesPedidos, ...nomesDesTotais, ...nomesDasRent])]
    const vendedoresNaoReconhecidos = nomesUnicos.filter(
      nome => !vendedorPorNome.has(nome.toLowerCase())
    )

    // ── 7. Mapear para RegistroPreview (pedidos) ────────────────────────────
    const registros: RegistroPreview[] = pedidos.map(p => {
      const cadastrado = vendedorPorNome.get(p.vendedor.trim().toLowerCase())
      const fechado = p.situacao === 'FECHADO'

      return {
        vendedorId:          cadastrado?.id ?? null,
        vendedorNome:        p.vendedor,
        vendedorReconhecido: !!cadastrado,
        empresa,
        filial,
        cliente:             p.cliente,
        valorOrcado:         p.valor,
        dataOrcamento:       p.dataEmissao,
        status:              fechado ? 'vendido' : 'orcado',
        valorVendido:        fechado ? p.valor : null,
        dataVenda:           fechado ? p.dataEmissao : null,
        origem:              'upload_estruturado' as const,
        numeroOrcamento:     p.pedido,
      }
    })

    // ── 8. Verificar consistência de filial (UF do cabeçalho vs. seleção) ───
    const ufEsperada = FILIAL_PARA_UF[filial]
    const avisosFilial: { arquivoNome: string; ufDetectada: string; filialSelecionada: string }[] = []

    for (const arq of arquivosProcessados) {
      const { uf } = extrairOrigemRelatorio(arq.html)
      if (uf && ufEsperada && uf !== ufEsperada) {
        avisosFilial.push({ arquivoNome: arq.nome, ufDetectada: uf, filialSelecionada: filial })
      }
    }

    // ── 9. Salvar em comercial_importacoes (pendente_revisao) ───────────────
    const importacao = await criarImportacao({
      empresa,
      filial,
      arquivosProcessados: arquivosProcessados.map(a => ({ nome: a.nome, tipo: a.tipo })),
      totalRegistros:      registros.length,
      divergencias,
      vendedoresNaoReconhecidos,
      registrosPreview:    registros,
      periodoInicio,
      periodoFim,
      totaisVendedor:       totais,
      rentabilidadeVendedor: rentabilidade,
    })

    // ── 10. Resumo de totais encontrados (para exibição no preview) ─────────
    const totaisEncontrados = [
      ...totais.map(t => ({ vendedor: t.vendedor, valorTotal: t.valorTotal, quantidadeVendas: null as number | null, fonte: 'totais_vendedor' as const })),
      ...rentabilidade.map(r => ({ vendedor: r.vendedor, valorTotal: r.valorTotal, quantidadeVendas: r.quantidadeVendas, fonte: 'rentabilidade_vendedor' as const })),
    ]

    // ── 11. Resposta ────────────────────────────────────────────────────────
    return Response.json({
      ok: true,
      importacaoId: importacao.id,
      avisos,
      avisosFilial,
      registros,
      divergencias,
      vendedoresNaoReconhecidos,
      totaisEncontrados,
      resumo: {
        totalRegistros:   registros.length,
        totalAberto:      registros.filter(r => r.status === 'orcado').length,
        totalFechado:     registros.filter(r => r.status === 'vendido').length,
        totalValorOrcado: registros.reduce((s, r) => s + r.valorOrcado, 0),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/upload-relatorio/preview] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

// POST /api/comercial/upload-relatorio/preview
//
// Recebe multipart/form-data com:
//   arquivos: File[] (.html)
//   empresa:  string
//   filial:   string
//
// Processa sem inserir em comercial_pedidos. Salva um registro em
// comercial_importacoes (status = 'pendente_revisao') e retorna o preview
// para revisão humana antes da confirmação.

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
import { requireComercialAccess } from '@/lib/comercial-auth'

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
  const denied = requireComercialAccess(request)
  if (denied) return denied
  try {
    // ── 1. Ler form data ────────────────────────────────────────────────────
    const formData = await request.formData()

    const empresa = (formData.get('empresa') as string | null)?.trim() ?? ''
    const filial  = (formData.get('filial')  as string | null)?.trim() ?? ''

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

    // ── 3. Verificar se relatório principal está presente ───────────────────
    const principalArq = arquivosProcessados.find(a => a.tipo === 'pedidos_orcamento')
    if (!principalArq) {
      return Response.json(
        {
          ok: false,
          error: 'Relatório de pedidos/orçamentos não encontrado. Inclua o arquivo do tipo "pedidos_orcamento".',
          avisos,
        },
        { status: 400 },
      )
    }

    // ── 4. Parsear arquivos identificados ───────────────────────────────────
    const pedidos = parsePedidosOrcamento(principalArq.html)

    const totaisArq = arquivosProcessados.find(a => a.tipo === 'totais_vendedor')
    const totais = totaisArq ? parseTotaisPorVendedor(totaisArq.html) : []

    const rentArq = arquivosProcessados.find(a => a.tipo === 'rentabilidade_vendedor')
    const rentabilidade = rentArq ? parseRentabilidadePorVendedor(rentArq.html) : []

    // ── 5. Validar divergências entre relatórios ────────────────────────────
    const divergencias = validarDivergencias(pedidos, totais, rentabilidade)

    // ── 6. Resolver vendedores (match case-insensitive na tabela vendedores) ─
    const vendedoresCadastrados = await listarVendedores(false)  // inclui inativos

    // Índice: nome lowercase → { id, nome }
    const vendedorPorNome = new Map(
      vendedoresCadastrados.map(v => [v.nome.toLowerCase().trim(), v])
    )

    const nomesUnicos = [...new Set(pedidos.map(p => p.vendedor.trim()).filter(Boolean))]
    const vendedoresNaoReconhecidos = nomesUnicos.filter(
      nome => !vendedorPorNome.has(nome.toLowerCase())
    )

    // ── 7. Mapear para o formato de comercial_pedidos ───────────────────────
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
        // data_venda é assumida igual à data de emissão do orçamento quando status = 'vendido',
        // pois o relatório da Upper não expõe uma coluna de data de fechamento separada.
        // É uma aproximação documentada — não representa a data exata da venda.
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
      totalRegistros: registros.length,
      divergencias,
      vendedoresNaoReconhecidos,
      registrosPreview: registros,
    })

    // ── 10. Resposta ────────────────────────────────────────────────────────
    return Response.json({
      ok: true,
      importacaoId: importacao.id,
      avisos,
      avisosFilial,
      registros,
      divergencias,
      vendedoresNaoReconhecidos,
      resumo: {
        totalRegistros: registros.length,
        totalAberto:    registros.filter(r => r.status === 'orcado').length,
        totalFechado:   registros.filter(r => r.status === 'vendido').length,
        totalValorOrcado: registros.reduce((s, r) => s + r.valorOrcado, 0),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/upload-relatorio/preview] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

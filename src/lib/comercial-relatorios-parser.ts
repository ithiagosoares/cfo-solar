// Parser determinístico para relatórios HTML exportados pelo SSG (FastReport 5.0).
// Nenhuma chamada à IA — 100% baseado em estrutura HTML/CSS do relatório.
//
// FastReport 5.0 gera uma tabela por relatório onde:
//   - Cada banda (header, detail, group header/footer) vira um <tr>
//   - Cada campo da banda vira um <td> com classe CSS de estilo (ex: "s3", "s5")
//   - As classes CSS são renumeradas dinamicamente — NÃO confiar em nomes fixos
//     (arquivos "TUDO" com coluna de logo extra deslocam a numeração)
//   - Linhas de grupo com vendedor: texto "Nome do vendedor: X" em célula única (colspan)
//   - Linhas de dado: <td>s com os campos em ordem fixa
//
// identificarTipoRelatorio() usa texto puro ($('body').text()), não seletores CSS.
// Se os títulos dos relatórios mudarem, ajuste TITULOS_TIPO abaixo.

import { load } from 'cheerio'

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type TipoRelatorio =
  | 'pedidos_orcamento'
  | 'totais_vendedor'
  | 'rentabilidade_vendedor'
  | 'rentabilidade_linha'
  | 'lista_orcamentos'
  | 'desconhecido'

export interface PedidoOrcamento {
  vendedor: string
  pedido: string
  dataEmissao: string   // "YYYY-MM-DD"
  cliente: string
  situacao: string      // "ABERTO" | "FECHADO" — mantido como veio do relatório
  valor: number
}

export interface TotaisVendedor {
  vendedor: string
  valorTotal: number
}

export interface RentabilidadeVendedor {
  vendedor: string
  quantidadeVendas: number
  valorTotal: number
}

// ─── Mapeamento de título → tipo ───────────────────────────────────────────────

// Chaves em lowercase. Trim é feito antes da comparação.
const TITULOS_TIPO: Record<string, TipoRelatorio> = {
  'relatório de pedidos de orçamento':
    'pedidos_orcamento',
  'total de venda, margem de contribuição e lucro por vendedor':
    'totais_vendedor',
  'rentabilidade por vendedor':
    'rentabilidade_vendedor',
  'rentabilidade':
    'rentabilidade_linha',
  'lista de orçamentos':
    'lista_orcamentos',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// "1.234,56" → 1234.56   "1234.56" → 1234.56   "" → 0
function parseValorBR(texto: string): number {
  const limpo = texto.trim().replace(/[^\d,.-]/g, '')
  if (!limpo) return 0
  // Formato BR: ponto = milhar, vírgula = decimal
  if (limpo.includes(',')) {
    return parseFloat(limpo.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(limpo) || 0
}

// "dd/mm/yyyy" → "YYYY-MM-DD". Retorna original se não parsear.
function parseDataBR(texto: string): string {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return texto.trim()
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// Retorna o último elemento não-vazio do array.
function ultimoNaoVazio(arr: string[]): string {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== '') return arr[i]
  }
  return ''
}

// ─── Identificação de tipo ────────────────────────────────────────────────────
//
// NÃO usa seletor de classe CSS (.s3, etc.) — o FastReport renumera as classes
// dinamicamente conforme o número de estilos do documento (arquivos "TUDO" com
// coluna de logo extra deslocam a numeração, quebrando seletores fixos).
// Em vez disso, busca os títulos conhecidos no texto puro do documento.
// Ordem do loop importa: "rentabilidade por vendedor" deve ser verificado antes
// de "rentabilidade" para evitar false-positive do mais específico.

export function identificarTipoRelatorio(html: string): TipoRelatorio {
  const $ = load(html)
  const texto = $('body').text().toLowerCase()

  for (const [titulo, tipo] of Object.entries(TITULOS_TIPO)) {
    if (texto.includes(titulo)) return tipo
  }
  return 'desconhecido'
}

// ─── Origem do relatório (CNPJ e UF da filial emissora) ───────────────────────
//
// Extrai do cabeçalho do relatório:
//   CNPJ: "CNPJ: 58501548000103" → "58501548000103"
//   UF:   padrão "CIDADE - UF - CEP" (ex: "ARUJA - SP - 07430350") → "SP"
//
// Retorna null nos campos que não forem detectáveis.
export function extrairOrigemRelatorio(html: string): { cnpj: string | null; uf: string | null } {
  const $ = load(html)
  const texto = $('body').text()

  const matchCnpj = texto.match(/CNPJ\s*:\s*([\d./\-]+)/i)
  const cnpj = matchCnpj ? matchCnpj[1].replace(/\D/g, '') || null : null

  // "- SP - 07430350"  ou  "- PR - 83401520"
  const matchUf = texto.match(/-\s*([A-Z]{2})\s*-\s*\d{5,8}/)
  const uf = matchUf ? matchUf[1] : null

  return { cnpj, uf }
}

// ─── Parser: Pedidos de Orçamento ─────────────────────────────────────────────
//
// Estrutura das linhas:
//   Grupo header  → célula única (colspan) com "Nome do vendedor: <nome>"
//   Linha de dado → [Pedido, Emissão (dd/mm/yyyy), Cód.Cliente, Nome Cliente, Situação, Valor]
//   Linha subtotal → não tem coluna de data (começam com contagem + valor direto) — ignoradas

const REGEX_DATA = /^\d{1,2}\/\d{1,2}\/\d{4}$/
const REGEX_VENDEDOR = /Nome do vendedor[:\s]+(.+)/i

export function parsePedidosOrcamento(html: string): PedidoOrcamento[] {
  const $ = load(html)
  const resultado: PedidoOrcamento[] = []
  let vendedorAtual = ''

  $('tr').each((_, tr) => {
    // Coletar texto de todas as células (posição preservada para indexação)
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get()
    if (cells.every(c => c === '')) return

    const textoLinha = cells.filter(Boolean).join(' ')

    // ── Linha de grupo: "Nome do vendedor: X" ──────────────────────────────
    const matchVendedor = textoLinha.match(REGEX_VENDEDOR)
    if (matchVendedor) {
      vendedorAtual = matchVendedor[1].trim()
      return
    }

    if (!vendedorAtual) return

    // ── Linha de dado: deve ter uma célula com data dd/mm/yyyy ─────────────
    const dateIdx = cells.findIndex(c => REGEX_DATA.test(c))
    if (dateIdx < 0) return  // subtotal ou cabeçalho — ignorar

    // Situação: ABERTO ou FECHADO
    const situacaoIdx = cells.findIndex(c => c === 'ABERTO' || c === 'FECHADO')
    if (situacaoIdx < 0) return

    // Pedido: célula imediatamente antes da data
    const pedido = dateIdx > 0 ? cells[dateIdx - 1] : ''

    // Nome do cliente: célula imediatamente antes da situação
    const cliente = situacaoIdx > 0 ? cells[situacaoIdx - 1] : ''

    // Valor: último valor numérico não-vazio da linha
    const valor = parseValorBR(ultimoNaoVazio(cells))

    resultado.push({
      vendedor: vendedorAtual,
      pedido,
      dataEmissao: parseDataBR(cells[dateIdx]),
      cliente,
      situacao: cells[situacaoIdx],
      valor,
    })
  })

  return resultado
}

// ─── Helper: detectar linha de cabeçalho e construir mapa nome→índice ─────────
//
// Percorre os <tr> procurando o primeiro que contenha ao menos `minMatches`
// células cujo texto normalizado apareça em `labelsConhecidos`.
// Preserva posições originais — NÃO filtra células vazias.
// Retorna Map<label_normalizado → índice_na_linha> ou null se não encontrar.

function detectarCabecalho(
  $: ReturnType<typeof load>,
  labelsConhecidos: string[],
  minMatches = 2,
): Map<string, number> | null {
  const conhecidos = new Set(labelsConhecidos.map(l => l.toLowerCase().trim()))
  let mapa: Map<string, number> | null = null
  let encontrado = false

  $('tr').each((_, tr) => {
    if (encontrado) return
    const cells = $(tr).find('td').map((__, td) => $(td).text().trim()).get()
    let hits = 0
    for (const c of cells) if (conhecidos.has(c.toLowerCase().trim())) hits++
    if (hits >= minMatches) {
      mapa = new Map()
      cells.forEach((c, i) => { if (c) mapa!.set(c.toLowerCase().trim(), i) })
      encontrado = true
    }
  })

  return mapa
}

// Retorna o primeiro índice encontrado para qualquer dos candidatos no mapa.
function resolverIdx(mapa: Map<string, number> | null, ...candidatos: string[]): number | null {
  if (!mapa) return null
  for (const c of candidatos) {
    const idx = mapa.get(c.toLowerCase().trim())
    if (idx !== undefined) return idx
  }
  return null
}

// ─── Parser: Totais por Vendedor ──────────────────────────────────────────────
//
// Relatório "Total de venda, margem de contribuição e lucro por vendedor".
// Colunas confirmadas contra arquivos reais (SP e PR):
//   Nome do Vendedor | Total Prod. | M.C. | %M.C. | Lucro | %Lucro
//
// O parser detecta o cabeçalho e resolve os índices pelo nome da coluna.
// NÃO usa ultimoNaoVazio() — nos arquivos reais a última coluna é %Lucro,
// não Total Prod.

export function parseTotaisPorVendedor(html: string): TotaisVendedor[] {
  const $ = load(html)
  const resultado: TotaisVendedor[] = []

  const LABELS_CAB = [
    'nome do vendedor', 'total prod.', 'm.c.', '%m.c.', 'lucro', '%lucro',
    'funcionário', 'funcionario', 'código', 'codigo',
  ]

  const cab    = detectarCabecalho($, LABELS_CAB)
  const idxNome  = resolverIdx(cab, 'nome do vendedor', 'funcionário', 'funcionario')
  const idxTotal = resolverIdx(cab, 'total prod.', 'total prod')

  // Textos que identificam linhas de cabeçalho ou totais — a serem ignorados
  const SKIP = new Set([
    'nome do vendedor', 'funcionário', 'funcionario', 'nome', 'vendedor',
    'total prod.', 'total prod', 'm.c.', '%m.c.', 'lucro', '%lucro',
    'código', 'codigo',
  ])

  $('tr').each((_, tr) => {
    // Preservar posições originais — NÃO filtrar células vazias
    const cells = $(tr).find('td').map((__, td) => $(td).text().trim()).get()
    const naoVazias = cells.filter(Boolean)
    if (naoVazias.length < 2) return

    // Pular linhas de cabeçalho (qualquer célula que seja um label conhecido)
    if (naoVazias.some(c => SKIP.has(c.toLowerCase()))) return

    // Extrair nome do vendedor pelo índice detectado no cabeçalho
    const vendedor = (idxNome !== null ? cells[idxNome] : naoVazias[0])?.trim() ?? ''
    // Ignorar células numéricas puras (Código) e linhas de total
    if (!vendedor || /^\d+$/.test(vendedor) || /^total/i.test(vendedor)) return

    // Extrair "Total Prod." pelo índice detectado — nunca usar a última célula
    const valorTotal = idxTotal !== null
      ? parseValorBR(cells[idxTotal] ?? '')
      : parseValorBR(naoVazias[1] ?? '')  // fallback posicional se não há cabeçalho
    if (!valorTotal) return

    resultado.push({ vendedor, valorTotal })
  })

  return resultado
}

// ─── Parser: Rentabilidade por Vendedor ───────────────────────────────────────
//
// Colunas confirmadas contra arquivos reais (SP e PR):
//   Código | Funcionário | Vendas | Vlr. total | Custo total | Taxa cartão |
//   % lucro bruto | Vlr. lucro bruto
//
// "Código" é o código numérico do funcionário — ignorado para fins de
// identificação do vendedor. O nome vem sempre de "Funcionário".

export function parseRentabilidadePorVendedor(html: string): RentabilidadeVendedor[] {
  const $ = load(html)
  const resultado: RentabilidadeVendedor[] = []

  const LABELS_CAB = [
    'código', 'codigo', 'funcionário', 'funcionario',
    'vendas', 'vlr. total', 'vlr.total', 'custo total', '% lucro bruto', 'vlr. lucro bruto',
  ]

  const cab       = detectarCabecalho($, LABELS_CAB)
  const idxNome   = resolverIdx(cab, 'funcionário', 'funcionario', 'nome do vendedor')
  const idxVendas = resolverIdx(cab, 'vendas')
  const idxTotal  = resolverIdx(cab, 'vlr. total', 'vlr.total')

  const SKIP = new Set([
    'código', 'codigo', 'funcionário', 'funcionario', 'nome', 'vendedor',
    'vendas', 'vlr. total', 'vlr.total', 'custo total', '% lucro bruto', 'vlr. lucro bruto',
    'taxa cartão', 'taxa cartao',
  ])

  $('tr').each((_, tr) => {
    const cells = $(tr).find('td').map((__, td) => $(td).text().trim()).get()
    const naoVazias = cells.filter(Boolean)
    if (naoVazias.length < 3) return

    if (naoVazias.some(c => SKIP.has(c.toLowerCase()))) return

    const vendedor = (idxNome !== null ? cells[idxNome] : naoVazias.find(c => !/^\d+$/.test(c)))?.trim() ?? ''
    if (!vendedor || /^\d+$/.test(vendedor) || /^total/i.test(vendedor)) return

    const quantidadeVendas = idxVendas !== null
      ? parseInt(cells[idxVendas] ?? '') || 0
      : parseInt(naoVazias.find(c => /^\d+$/.test(c)) ?? '') || 0

    const valorTotal = idxTotal !== null
      ? parseValorBR(cells[idxTotal] ?? '')
      : 0  // sem cabeçalho não há como determinar a coluna correta com segurança
    if (!valorTotal) return

    resultado.push({ vendedor, quantidadeVendas, valorTotal })
  })

  return resultado
}

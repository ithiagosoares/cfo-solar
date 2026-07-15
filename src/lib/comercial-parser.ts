// Parser para relatórios HTML exportados do sistema Upper (ERP comercial).
// Não usa bibliotecas externas — extrai tabelas via regex para evitar dependências.
//
// COMO AJUSTAR SE OS NOMES DE COLUNAS MUDAREM:
//   Edite os mapas MAPA_COLUNAS_* abaixo. As chaves são o texto do cabeçalho
//   (lowercase, trimmed). Os valores são os campos do objeto de saída.
//
// COMO AJUSTAR A DETECÇÃO DE TIPO:
//   Edite a função identificarTipoRelatorio() — ela usa includes() no HTML completo.

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type TipoRelatorio =
  | 'pedidos_orcamento'
  | 'totais_vendedor'
  | 'rentabilidade_vendedor'
  | 'desconhecido'

export interface PedidoOrcamentoParseado {
  numero: string
  vendedor: string
  cliente: string
  dataEmissao: string   // "YYYY-MM-DD"
  valor: number
  situacao: string      // ex: "FECHADO", "ABERTO", "CANCELADO" — mantido como veio
  raw: Record<string, string>
}

export interface TotaisVendedorParseado {
  vendedor: string
  totalOrcado: number
  totalFechado: number
  raw: Record<string, string>
}

export interface RentabilidadeParseado {
  vendedor: string
  faturamento: number
  custo: number
  margem: number
  raw: Record<string, string>
}

export interface Divergencia {
  tipo: 'valor_total_vendedor'
  vendedor: string
  descricao: string
  valorPedidos: number
  valorTotais: number
  diferenca: number
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

// Extrai todas as tabelas HTML como arrays de linhas × colunas (texto limpo).
function extrairTabelas(html: string): Array<{ headers: string[]; rows: string[][] }> {
  const tabelas: Array<{ headers: string[]; rows: string[][] }> = []

  for (const [, corpoTabela] of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const linhas: string[][] = []

    for (const [, conteudoLinha] of corpoTabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const celulas = [...conteudoLinha.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(([, c]) => stripHtml(c))
      if (celulas.some(c => c !== '')) linhas.push(celulas)
    }

    if (linhas.length < 2) continue  // precisa de header + ao menos 1 linha de dado

    tabelas.push({ headers: linhas[0], rows: linhas.slice(1) })
  }

  return tabelas
}

// Mapeia uma linha de tabela para um objeto usando o cabeçalho como chave.
function linhaParaObj(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = row[i] ?? '' })
  return obj
}

// Converte "DD/MM/YYYY" → "YYYY-MM-DD". Retorna a string original se não parsear.
function parseDataBR(data: string): string {
  const m = data.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return data
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// Converte "1.234,56" ou "1234.56" → number.
function parseValorBR(valor: string): number {
  if (!valor) return 0
  const limpo = valor.replace(/[^\d,.-]/g, '')
  // formato BR: ponto como milhar, vírgula como decimal
  if (limpo.includes(',')) {
    return parseFloat(limpo.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(limpo) || 0
}

// Procura um valor no objeto raw por múltiplas chaves candidatas.
function buscarCampo(obj: Record<string, string>, candidatos: string[]): string {
  for (const c of candidatos) {
    if (obj[c] !== undefined && obj[c] !== '') return obj[c]
  }
  return ''
}

// ─── Identificação de tipo ────────────────────────────────────────────────────

export function identificarTipoRelatorio(html: string): TipoRelatorio {
  const lower = html.toLowerCase()

  if (lower.includes('rentabilidade') && lower.includes('vendedor')) {
    return 'rentabilidade_vendedor'
  }
  if (
    (lower.includes('total') || lower.includes('resumo') || lower.includes('totaliz')) &&
    lower.includes('vendedor')
  ) {
    return 'totais_vendedor'
  }
  if (
    lower.includes('orçamento') ||
    lower.includes('orcamento') ||
    lower.includes('pedido de venda') ||
    lower.includes('relação de pedidos')
  ) {
    return 'pedidos_orcamento'
  }

  return 'desconhecido'
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

// Nomes de colunas aceitos para cada campo. Ajuste conforme o relatório real.
const CAMPOS_PEDIDOS = {
  numero:      ['número', 'numero', 'nº', 'n°', 'cod', 'código', 'codigo'],
  vendedor:    ['vendedor', 'representante', 'consultor', 'responsável', 'responsavel'],
  cliente:     ['cliente', 'razão social', 'razao social', 'nome'],
  dataEmissao: ['data emissão', 'data emissao', 'emissão', 'emissao', 'data', 'dt. emissão'],
  valor:       ['valor', 'total', 'valor total', 'vl. total', 'vlr total'],
  situacao:    ['situação', 'situacao', 'status', 'situac.'],
}

export function parsePedidosOrcamento(html: string): PedidoOrcamentoParseado[] {
  const tabelas = extrairTabelas(html)
  const pedidos: PedidoOrcamentoParseado[] = []

  // Usa a primeira tabela que contenha ao menos os campos de vendedor + cliente + valor
  for (const { headers, rows } of tabelas) {
    const headersLower = headers.map(h => h.toLowerCase().trim())
    const temVendedor = CAMPOS_PEDIDOS.vendedor.some(c => headersLower.includes(c))
    const temValor = CAMPOS_PEDIDOS.valor.some(c => headersLower.includes(c))
    if (!temVendedor || !temValor) continue

    for (const row of rows) {
      const obj = linhaParaObj(headers, row)

      const vendedor    = buscarCampo(obj, CAMPOS_PEDIDOS.vendedor).trim()
      const cliente     = buscarCampo(obj, CAMPOS_PEDIDOS.cliente).trim()
      const valorStr    = buscarCampo(obj, CAMPOS_PEDIDOS.valor)
      const dataStr     = buscarCampo(obj, CAMPOS_PEDIDOS.dataEmissao)
      const situacao    = buscarCampo(obj, CAMPOS_PEDIDOS.situacao).toUpperCase().trim()
      const numero      = buscarCampo(obj, CAMPOS_PEDIDOS.numero).trim()

      if (!vendedor && !cliente) continue  // linha de subtotal/rodapé

      pedidos.push({
        numero,
        vendedor,
        cliente,
        dataEmissao: parseDataBR(dataStr),
        valor: parseValorBR(valorStr),
        situacao: situacao || 'ABERTO',
        raw: obj,
      })
    }

    break  // usou a tabela principal; não processar tabelas de rodapé
  }

  return pedidos
}

const CAMPOS_TOTAIS = {
  vendedor:     ['vendedor', 'representante', 'consultor', 'responsável', 'responsavel'],
  totalOrcado:  ['total orçado', 'total orcado', 'total', 'orçado', 'orcado', 'vl. total'],
  totalFechado: ['total fechado', 'fechado', 'vendido', 'confirmado'],
}

export function parseTotaisVendedor(html: string): TotaisVendedorParseado[] {
  const tabelas = extrairTabelas(html)
  const totais: TotaisVendedorParseado[] = []

  for (const { headers, rows } of tabelas) {
    const headersLower = headers.map(h => h.toLowerCase().trim())
    const temVendedor = CAMPOS_TOTAIS.vendedor.some(c => headersLower.includes(c))
    if (!temVendedor) continue

    for (const row of rows) {
      const obj = linhaParaObj(headers, row)
      const vendedor = buscarCampo(obj, CAMPOS_TOTAIS.vendedor).trim()
      if (!vendedor) continue

      totais.push({
        vendedor,
        totalOrcado:  parseValorBR(buscarCampo(obj, CAMPOS_TOTAIS.totalOrcado)),
        totalFechado: parseValorBR(buscarCampo(obj, CAMPOS_TOTAIS.totalFechado)),
        raw: obj,
      })
    }
    break
  }

  return totais
}

const CAMPOS_RENT = {
  vendedor:    ['vendedor', 'representante', 'consultor'],
  faturamento: ['faturamento', 'receita', 'venda', 'total vendido'],
  custo:       ['custo', 'cmv', 'cme'],
  margem:      ['margem', 'lucro', 'resultado', 'margem %', 'margem bruta'],
}

export function parseRentabilidadeVendedor(html: string): RentabilidadeParseado[] {
  const tabelas = extrairTabelas(html)
  const resultados: RentabilidadeParseado[] = []

  for (const { headers, rows } of tabelas) {
    const headersLower = headers.map(h => h.toLowerCase().trim())
    const temVendedor = CAMPOS_RENT.vendedor.some(c => headersLower.includes(c))
    if (!temVendedor) continue

    for (const row of rows) {
      const obj = linhaParaObj(headers, row)
      const vendedor = buscarCampo(obj, CAMPOS_RENT.vendedor).trim()
      if (!vendedor) continue

      resultados.push({
        vendedor,
        faturamento: parseValorBR(buscarCampo(obj, CAMPOS_RENT.faturamento)),
        custo:       parseValorBR(buscarCampo(obj, CAMPOS_RENT.custo)),
        margem:      parseValorBR(buscarCampo(obj, CAMPOS_RENT.margem)),
        raw: obj,
      })
    }
    break
  }

  return resultados
}

// ─── Validação de divergências ─────────────────────────────────────────────────

export function validarDivergencias(
  pedidos: PedidoOrcamentoParseado[],
  totais?: TotaisVendedorParseado[],
  rentabilidade?: RentabilidadeParseado[],
): Divergencia[] {
  const divergencias: Divergencia[] = []

  if (!totais?.length) return divergencias

  // Soma valor dos pedidos por vendedor (só fechados para comparar com totalFechado)
  const somaFechadoPorVendedor = new Map<string, number>()
  const somaOrcadoPorVendedor = new Map<string, number>()
  for (const p of pedidos) {
    const key = p.vendedor.toLowerCase()
    somaOrcadoPorVendedor.set(key, (somaOrcadoPorVendedor.get(key) ?? 0) + p.valor)
    if (p.situacao === 'FECHADO') {
      somaFechadoPorVendedor.set(key, (somaFechadoPorVendedor.get(key) ?? 0) + p.valor)
    }
  }

  for (const t of totais) {
    const key = t.vendedor.toLowerCase()
    const somaPedidos = somaOrcadoPorVendedor.get(key) ?? 0
    const diff = Math.abs(somaPedidos - t.totalOrcado)
    if (diff > 0.5) {   // tolerância de R$ 0,50 para arredondamentos
      divergencias.push({
        tipo: 'valor_total_vendedor',
        vendedor: t.vendedor,
        descricao: `Soma dos pedidos (${somaPedidos.toFixed(2)}) difere do total do vendedor (${t.totalOrcado.toFixed(2)})`,
        valorPedidos: somaPedidos,
        valorTotais: t.totalOrcado,
        diferenca: diff,
      })
    }
  }

  void rentabilidade  // reservado para validações futuras

  return divergencias
}

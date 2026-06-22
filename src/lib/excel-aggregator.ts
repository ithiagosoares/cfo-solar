import * as XLSX from 'xlsx'

export interface CategoriaDespesa {
  categoria: string
  valor: number
  percentualDoTotal: number
  grupo: 'fixo' | 'variavel' | 'outro'
}

export interface ResumoCustos {
  custosFixos: number
  custosVariaveis: number
  outros: number
}

export interface EmpresaAgregada {
  nome: string
  entradas: number
  saidas: number
  saldo: number
  despesasPorCategoria: CategoriaDespesa[]
  resumoCustos: ResumoCustos
  categorizacaoDisponivel: boolean
}

export interface ClienteAgregado {
  nome: string
  valor: number
  empresa: string
}

export interface DadosAgregados {
  periodo: string
  faturamento: { vendido: number; faturado: number }
  empresas: EmpresaAgregada[]
  consolidado: {
    totalEntradas: number
    totalSaidas: number
    saldoGrupo: number
    despesasPorCategoriaGrupo: CategoriaDespesa[]
    resumoCustosGrupo: ResumoCustos
  }
  clientes: ClienteAgregado[]
  movimentacoesInternas: { total: number; quantidade: number }
  antecipacoes: { total: number; quantidade: number }
  transferenciasNaoIdentificadas: { total: number; quantidade: number }
}

const MAPA_EMPRESAS: Record<string, string> = {
  'MATRIZ MAIO': 'Solar System Matriz',
  'FILIAL MAIO': 'Solar System Filial PR',
  'LEVEL': 'Level2',
  'NI HAO': 'Ni Hao',
  'ALUMARKET': 'AluMarket',
}

const TOKENS_INTERNOS = ['SSG SOLAR', 'SOLAR SYSTEM GROUP', 'LEVEL2', 'NI HAO', 'ALUMARKET', 'ALU MARKET']
const TOKENS_ANTECIPACAO = ['FIDC', 'SECURITIZADORA', 'RICO C', 'GENESIS', 'LOTUS PERFORMANCE']

// Used to summarize despesasPorCategoria into a fixed/variável/outros split.
const CUSTOS_VARIAVEIS = ['MATERIA PRIMA', 'FRETE', 'COMBUSTIVEL', 'COMISSAO', 'COMISSÃO', 'PUBLICIDADE', 'EMBALAGEM']
const CUSTOS_FIXOS = [
  'SALARIO', 'SALÁRIO', 'PRO LABORE', 'PRÓ LABORE', 'ALUGUEL', 'ENERGIA', 'INTERNET',
  'SOFTWARE', 'CONTABILIDADE', 'SEGURANCA', 'SEGURANÇA', 'FGTS', 'INSS',
]

function contemToken(texto: string, tokens: string[]): boolean {
  const t = texto.toUpperCase()
  return tokens.some(tok => t.includes(tok))
}

function ehEmprestimo(classificacao: string, descricao: string): boolean {
  const c = classificacao.toUpperCase()
  const d = descricao.toUpperCase()
  return c.includes('EMPRESTIMO') || c.includes('EMPRÉSTIMO') || d.includes('EMPRESTIMO') || d.includes('EMPRÉSTIMO')
}

// A 14-digit run in the description (CNPJ length) combined with a perfectly
// round R$1.000 multiple is a strong signal of an inter-company loan that
// wasn't tagged with an EMPRESTIMO classification — banks usually don't pay
// clients in exact thousands.
function contemCNPJ(texto: string): boolean {
  return /(?<!\d)\d{14}(?!\d)/.test(texto)
}

function ehMultiploDeMil(valor: number): boolean {
  const centavos = Math.round(valor * 100)
  return centavos % 100_000 === 0
}

function ehTransferenciaInternaNaoIdentificada(descricao: string, valor: number): boolean {
  return contemCNPJ(descricao) && ehMultiploDeMil(valor)
}

function classificarGrupoCusto(categoria: string): 'fixo' | 'variavel' | 'outro' {
  const c = categoria.toUpperCase()
  if (CUSTOS_VARIAVEIS.some(tok => c.includes(tok))) return 'variavel'
  if (CUSTOS_FIXOS.some(tok => c.includes(tok))) return 'fixo'
  return 'outro'
}

function construirCategorias(mapa: Map<string, number>, total: number): CategoriaDespesa[] {
  return Array.from(mapa.entries())
    .map(([categoria, valor]) => ({
      categoria,
      valor,
      percentualDoTotal: total > 0 ? (valor / total) * 100 : 0,
      grupo: classificarGrupoCusto(categoria),
    }))
    .sort((a, b) => b.valor - a.valor)
}

function construirResumoCustos(mapa: Map<string, number>): ResumoCustos {
  const resumo: ResumoCustos = { custosFixos: 0, custosVariaveis: 0, outros: 0 }
  for (const [categoria, valor] of mapa) {
    const grupo = classificarGrupoCusto(categoria)
    if (grupo === 'fixo') resumo.custosFixos += valor
    else if (grupo === 'variavel') resumo.custosVariaveis += valor
    else resumo.outros += valor
  }
  return resumo
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Converts a machine period key ("2026-05") into a display label ("Maio de 2026").
export function formatarPeriodoLabel(periodo: string): string {
  const match = periodo.match(/^(\d{4})-(\d{2})$/)
  if (!match) return periodo
  const [, ano, mesStr] = match
  const nomeMes = MESES_PT[parseInt(mesStr, 10) - 1] ?? mesStr
  return `${nomeMes} de ${ano}`
}

// Computes the calendar month immediately before the given period key, handling year rollover.
export function periodoAnterior(periodo: string): string {
  const match = periodo.match(/^(\d{4})-(\d{2})$/)
  if (!match) return periodo
  let ano = parseInt(match[1], 10)
  let mes = parseInt(match[2], 10) - 1
  if (mes === 0) { mes = 12; ano -= 1 }
  return `${ano}-${String(mes).padStart(2, '0')}`
}

function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    // Brazilian format (1.022.107,43) vs US/plain format (1022107.43 or "R$ 1,022.43")
    const hasBrFormat = v.includes(',') && v.lastIndexOf('.') < v.lastIndexOf(',')
    const cleaned = hasBrFormat
      ? v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
      : v.replace(/[R$\s,]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

interface ColunasExtrato {
  headerIdx: number
  tipo: number
  valor: number
  descricao: number
  classificacao: number
}

/**
 * Header labels vary per bank/sheet (e.g. "ENTRADA/SAÍDA" vs "ENTRADA/SAIDA",
 * "Histórico"+"DESCRIÇÃO" vs "DESCRIÇÃO"+"CLASSIFICAÇÃO"). When a sheet has both
 * a "Histórico" and a "DESCRIÇÃO" column, "Histórico" holds the actual transaction
 * description/payee and "DESCRIÇÃO" is really the category — so the roles are
 * resolved rather than assumed by column order.
 */
function detectarColunasExtrato(linhas: unknown[][]): ColunasExtrato {
  for (let i = 0; i < Math.min(10, linhas.length); i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue

    let tipo = -1, valor = -1, historico = -1, descricaoCategoria = -1, classificacao = -1

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').toUpperCase().trim()
      if (!cell) continue
      if ((cell.includes('ENTRADA/') || cell === 'TIPO') && tipo === -1) tipo = j
      if (cell.includes('HIST') && historico === -1) historico = j
      if (cell.includes('VALOR') && valor === -1) valor = j
      if (cell.includes('CLASSIFIC') && classificacao === -1) classificacao = j
      if (cell.includes('DESCRI') && descricaoCategoria === -1) descricaoCategoria = j
    }

    if (tipo !== -1 && valor !== -1) {
      const descricaoFinal = historico !== -1 ? historico : descricaoCategoria
      const classificacaoFinal = classificacao !== -1 ? classificacao : (historico !== -1 ? descricaoCategoria : -1)
      return { headerIdx: i, tipo, valor, descricao: descricaoFinal, classificacao: classificacaoFinal }
    }
  }

  return { headerIdx: -1, tipo: -1, valor: -1, descricao: -1, classificacao: -1 }
}

interface ResultadoExtrato {
  entradas: number
  saidas: number
  clientes: Map<string, number>
  internoTotal: number
  internoQtd: number
  antecipacaoTotal: number
  antecipacaoQtd: number
  transferenciaNaoIdentificadaTotal: number
  transferenciaNaoIdentificadaQtd: number
  despesasPorCategoria: Map<string, number>
  categorizacaoDisponivel: boolean
}

function agregarExtrato(ws: XLSX.WorkSheet): ResultadoExtrato {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][]
  const cols = detectarColunasExtrato(linhas)
  const temColunaClassificacao = cols.classificacao !== -1

  const resultado: ResultadoExtrato = {
    entradas: 0,
    saidas: 0,
    clientes: new Map(),
    internoTotal: 0,
    internoQtd: 0,
    antecipacaoTotal: 0,
    antecipacaoQtd: 0,
    transferenciaNaoIdentificadaTotal: 0,
    transferenciaNaoIdentificadaQtd: 0,
    despesasPorCategoria: new Map(),
    categorizacaoDisponivel: temColunaClassificacao,
  }

  if (cols.headerIdx === -1) return resultado

  for (let i = cols.headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue

    const tipoCell = String(row[cols.tipo] ?? '').toUpperCase().trim()
    const direcao = tipoCell.startsWith('ENTRADA') ? 'entrada' : tipoCell.startsWith('SAIDA') ? 'saida' : null
    if (!direcao) continue

    const magnitude = Math.abs(parseValor(row[cols.valor]))
    if (magnitude === 0) continue

    const descricao = cols.descricao >= 0 ? String(row[cols.descricao] ?? '').trim() : ''
    const classificacao = cols.classificacao >= 0 ? String(row[cols.classificacao] ?? '').trim() : ''

    if (direcao === 'saida') {
      // FECHAMENTO computes saídas as "gastos sem considerar empréstimos entre
      // empresas". When a classification column exists, trust it exclusively —
      // a row classified "DEVOLUÇÃO CLIENTE" or "MATERIA PRIMA" is a real expense
      // even if the payee name happens to mention a group company (e.g. a refund
      // routed through SSG Solar). Without a classification column, fall back to
      // description-token matching since that's the only signal available.
      const excluirSaida = temColunaClassificacao
        ? ehEmprestimo(classificacao, '')
        : (contemToken(descricao, TOKENS_INTERNOS) || ehEmprestimo('', descricao))

      if (excluirSaida) continue
      resultado.saidas += magnitude

      if (temColunaClassificacao) {
        const chave = classificacao || 'Sem categoria'
        resultado.despesasPorCategoria.set(chave, (resultado.despesasPorCategoria.get(chave) ?? 0) + magnitude)
      }
      continue
    }

    // direcao === 'entrada' — FECHAMENTO computes entradas as "somente de clientes"
    if (contemToken(descricao, TOKENS_INTERNOS) || contemToken(classificacao, TOKENS_INTERNOS)) {
      resultado.internoTotal += magnitude
      resultado.internoQtd++
      continue
    }
    if (contemToken(descricao, TOKENS_ANTECIPACAO) || contemToken(classificacao, TOKENS_ANTECIPACAO)) {
      resultado.antecipacaoTotal += magnitude
      resultado.antecipacaoQtd++
      continue
    }
    if (ehEmprestimo(classificacao, descricao)) continue

    // Catches loans that lack an explicit EMPRESTIMO classification: a 14-digit
    // CNPJ in the description plus a perfectly round R$1.000 value is treated
    // as a suspected unidentified inter-company transfer, not client revenue.
    if (ehTransferenciaInternaNaoIdentificada(descricao, magnitude)) {
      resultado.transferenciaNaoIdentificadaTotal += magnitude
      resultado.transferenciaNaoIdentificadaQtd++
      continue
    }

    resultado.entradas += magnitude
    if (descricao) {
      const chave = descricao.substring(0, 60).toUpperCase().trim()
      resultado.clientes.set(chave, (resultado.clientes.get(chave) ?? 0) + magnitude)
    }
  }

  return resultado
}

interface FechamentoTotais {
  faturamentoVendido: number
  faturamentoFaturado: number
  entradasBanco: number
  saidasBanco: number
}

function parsearFechamento(ws: XLSX.WorkSheet): FechamentoTotais {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][]

  let faturamentoVendido = 0
  let faturamentoFaturado = 0
  let entradasBanco = 0
  let saidasBanco = 0

  type Secao = 'none' | 'faturamento' | 'entradas' | 'saidas'
  let secao: Secao = 'none'
  let vendidoCol = -1
  let faturadoCol = -1

  for (const row of linhas) {
    if (!Array.isArray(row)) continue
    const cells = row.map(c => String(c ?? '').toUpperCase().trim())
    const label = cells[0]
    const rowText = cells.join(' ')

    if (cells.includes('VENDIDO')) {
      secao = 'faturamento'
      vendidoCol = cells.indexOf('VENDIDO')
      const fi = cells.indexOf('FATURADO')
      faturadoCol = fi !== -1 ? fi : -1
      continue
    }

    if (rowText.includes('ENTRADAS NO BANCO')) {
      secao = 'entradas'
      continue
    }

    if (label === 'SAIDAS' || label === 'SAÍDAS') {
      secao = 'saidas'
      continue
    }

    if (label === 'TOTAL') {
      if (secao === 'faturamento') {
        if (vendidoCol !== -1) faturamentoVendido = parseValor(row[vendidoCol])
        if (faturadoCol !== -1) faturamentoFaturado = parseValor(row[faturadoCol])
        secao = 'none'
      } else if (secao === 'entradas') {
        for (let j = 1; j < row.length; j++) {
          const val = parseValor(row[j])
          if (val > 0) { entradasBanco = val; break }
        }
        secao = 'none'
      } else if (secao === 'saidas') {
        for (let j = 1; j < row.length; j++) {
          const val = parseValor(row[j])
          if (val > 0) { saidasBanco = val; break }
        }
        secao = 'none'
      }
    }
  }

  return { faturamentoVendido, faturamentoFaturado, entradasBanco, saidasBanco }
}

export function agregarExcel(buffer: ArrayBuffer, periodoInformado?: string): DadosAgregados {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  const empresas: EmpresaAgregada[] = []
  const clientesGlobais = new Map<string, { valor: number; empresa: string }>()
  const despesasGrupoMap = new Map<string, number>()
  let internoTotal = 0
  let internoQtd = 0
  let antecipacaoTotal = 0
  let antecipacaoQtd = 0
  let transferenciaNaoIdentificadaTotal = 0
  let transferenciaNaoIdentificadaQtd = 0
  let fechamento: FechamentoTotais | null = null

  for (const nomeAba of workbook.SheetNames) {
    const ws = workbook.Sheets[nomeAba]
    const upper = nomeAba.toUpperCase().trim()

    if (upper === 'FECHAMENTO') {
      fechamento = parsearFechamento(ws)
      continue
    }

    const chave = Object.keys(MAPA_EMPRESAS).find(k => upper.includes(k) || k.includes(upper))
    const nomeEmpresa = chave ? MAPA_EMPRESAS[chave] : nomeAba

    const r = agregarExtrato(ws)
    const despesasPorCategoria = construirCategorias(r.despesasPorCategoria, r.saidas)
    const resumoCustos = construirResumoCustos(r.despesasPorCategoria)

    empresas.push({
      nome: nomeEmpresa,
      entradas: r.entradas,
      saidas: r.saidas,
      saldo: r.entradas - r.saidas,
      despesasPorCategoria,
      resumoCustos,
      categorizacaoDisponivel: r.categorizacaoDisponivel,
    })

    if (r.categorizacaoDisponivel) {
      for (const [categoria, valor] of r.despesasPorCategoria) {
        despesasGrupoMap.set(categoria, (despesasGrupoMap.get(categoria) ?? 0) + valor)
      }
    }

    for (const [nomeCliente, valor] of r.clientes) {
      const existente = clientesGlobais.get(nomeCliente)
      if (existente) existente.valor += valor
      else clientesGlobais.set(nomeCliente, { valor, empresa: nomeEmpresa })
    }

    internoTotal += r.internoTotal
    internoQtd += r.internoQtd
    antecipacaoTotal += r.antecipacaoTotal
    antecipacaoQtd += r.antecipacaoQtd
    transferenciaNaoIdentificadaTotal += r.transferenciaNaoIdentificadaTotal
    transferenciaNaoIdentificadaQtd += r.transferenciaNaoIdentificadaQtd
  }

  const clientes: ClienteAgregado[] = Array.from(clientesGlobais.entries())
    .map(([nome, d]) => ({ nome, valor: d.valor, empresa: d.empresa }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 30)

  const faturamento = {
    vendido: fechamento?.faturamentoVendido ?? 0,
    faturado: fechamento?.faturamentoFaturado ?? 0,
  }

  const totalEntradas = fechamento?.entradasBanco ?? empresas.reduce((s, e) => s + e.entradas, 0)
  const totalSaidas = fechamento?.saidasBanco ?? empresas.reduce((s, e) => s + e.saidas, 0)

  // Percentages within the group breakdown are computed against the total of
  // companies that actually have a classification column (NI HAO has none and
  // is excluded from despesasGrupoMap entirely), so the top-10 chart adds up to
  // 100% across the categories it can actually show.
  const totalCategorizadoGrupo = Array.from(despesasGrupoMap.values()).reduce((s, v) => s + v, 0)
  const despesasPorCategoriaGrupo = construirCategorias(despesasGrupoMap, totalCategorizadoGrupo)
  const resumoCustosGrupo = construirResumoCustos(despesasGrupoMap)

  const consolidado = {
    totalEntradas,
    totalSaidas,
    saldoGrupo: totalEntradas - totalSaidas,
    despesasPorCategoriaGrupo,
    resumoCustosGrupo,
  }

  const periodo = periodoInformado
    ? formatarPeriodoLabel(periodoInformado)
    : new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return {
    periodo,
    faturamento,
    empresas,
    consolidado,
    clientes,
    movimentacoesInternas: { total: internoTotal, quantidade: internoQtd },
    antecipacoes: { total: antecipacaoTotal, quantidade: antecipacaoQtd },
    transferenciasNaoIdentificadas: { total: transferenciaNaoIdentificadaTotal, quantidade: transferenciaNaoIdentificadaQtd },
  }
}

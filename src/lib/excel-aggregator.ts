import * as XLSX from 'xlsx'
import { mapearCategoria, SEM_CLASSIFICACAO_MANUAL } from './mapeamento-categorias'

export type GrupoCusto = 'fixo' | 'variavel' | 'capex' | 'servico_da_divida' | 'pro_labore' | 'nao_recorrente' | 'sem_classificacao' | 'outro'

export interface CategoriaDespesa {
  categoria: string
  valor: number
  percentualDoTotal: number
  grupo: GrupoCusto
}

export interface ResumoCustos {
  custosFixos: number
  custosVariaveis: number
  capex: number
  servicoDaDivida: number
  proLabore: number
  despesaNaoRecorrente: number
  semClassificacao: number
  quantidadeSemClassificacao: number
  outros: number
}

export interface EmpresaAgregada {
  nome: string
  entradas: number
  // Caixa físico que entrou no banco, incluindo antecipação de recebíveis e
  // intercompany recebido — diferente de "entradas" (receita operacional pura,
  // usada na margem operacional), que deliberadamente exclui os dois.
  entradasBancoReal: number
  saidas: number
  saldo: number
  despesasOperacionais: number
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
  // disponivel é false quando nenhuma aba do arquivo continha VENDIDO+FATURADO —
  // vendido/faturado ficam zerados nesse caso, e o dashboard deve avisar o usuário
  // em vez de mostrar R$0,00 silenciosamente.
  faturamento: { vendido: number; faturado: number; disponivel: boolean }
  empresas: EmpresaAgregada[]
  consolidado: {
    totalEntradas: number
    totalSaidas: number
    saldoGrupo: number
    despesasOperacionaisGrupo: number
    despesasPorCategoriaGrupo: CategoriaDespesa[]
    resumoCustosGrupo: ResumoCustos
  }
  clientes: ClienteAgregado[]
  movimentacoesInternas: { total: number; quantidade: number }
  antecipacoes: { total: number; quantidade: number }
  semClassificacaoManual: { total: number; quantidade: number }
  // Abas que não bateram com nenhuma empresa conhecida, nem formato de extrato,
  // nem formato de resumo direcionado — não entram como empresa fantasma com
  // zeros, só ficam registradas aqui para diagnóstico.
  abasNaoReconhecidas: string[]
}

export interface LancamentoBruto {
  empresa: string
  direcao: 'entrada' | 'saida'
  valor: number
  descricao: string
  classificacaoManual: string
}

// categoria comes from mapearCategoria() — one of the 10 official category keys,
// SEM_CLASSIFICACAO_MANUAL, or a slugified version of whatever the colaboradora
// wrote that didn't match the dictionary. Deliberately a plain string, not a
// closed enum, since the dictionary's fallback path can produce arbitrary slugs.
export interface LancamentoClassificado extends LancamentoBruto {
  categoria: string
}

const MAPA_EMPRESAS: Record<string, string> = {
  'MATRIZ MAIO': 'Solar System Matriz',
  'FILIAL MAIO': 'Solar System Filial PR',
  'LEVEL': 'Level2',
  'NI HAO': 'Ni Hao',
  'ALUMARKET': 'AluMarket',
}

// Buckets that represent real expense categories and contribute to ResumoCustos /
// despesasPorCategoria. "intercompany" saídas are excluded entirely (not a real
// expense). Any categoria not listed here (a custom slug from the colaboradora's
// own wording) falls back to "outro" at the lookup site below.
const GRUPO_POR_CATEGORIA: Partial<Record<string, GrupoCusto>> = {
  despesa_fixa: 'fixo',
  despesa_variavel: 'variavel',
  capex: 'capex',
  servico_da_divida: 'servico_da_divida',
  pro_labore: 'pro_labore',
  despesa_nao_recorrente: 'nao_recorrente',
  [SEM_CLASSIFICACAO_MANUAL]: 'sem_classificacao',
}

function construirCategorias(mapa: Map<string, { valor: number; grupo: GrupoCusto }>, total: number): CategoriaDespesa[] {
  return Array.from(mapa.entries())
    .map(([categoria, { valor, grupo }]) => ({
      categoria,
      valor,
      percentualDoTotal: total > 0 ? (valor / total) * 100 : 0,
      grupo,
    }))
    .sort((a, b) => b.valor - a.valor)
}

// valor chega aqui já convertido por parseValor() em extrairLancamentos — este
// guard é uma segunda camada de defesa contra dados malformados (ou contra
// estruturas antigas, persistidas antes de um campo existir), não o ponto
// principal de conversão.
function valorSeguro(valor: number, contexto: string): number {
  if (Number.isFinite(valor)) return valor
  console.warn(`[excel-aggregator] valor não numérico em "${contexto}" — tratando como 0. Valor bruto:`, valor)
  return 0
}

function construirResumoCustos(itens: Array<{ valor: number; grupo: GrupoCusto; descricao?: string }>): ResumoCustos {
  const resumo: ResumoCustos = {
    custosFixos: 0, custosVariaveis: 0, capex: 0, servicoDaDivida: 0, proLabore: 0,
    despesaNaoRecorrente: 0, semClassificacao: 0, quantidadeSemClassificacao: 0, outros: 0,
  }
  for (const { valor: valorBruto, grupo, descricao } of itens) {
    const valor = valorSeguro(valorBruto, descricao ?? grupo)
    if (grupo === 'fixo') resumo.custosFixos += valor
    else if (grupo === 'variavel') resumo.custosVariaveis += valor
    else if (grupo === 'capex') resumo.capex += valor
    else if (grupo === 'servico_da_divida') resumo.servicoDaDivida += valor
    else if (grupo === 'pro_labore') resumo.proLabore += valor
    else if (grupo === 'nao_recorrente') resumo.despesaNaoRecorrente += valor
    else if (grupo === 'sem_classificacao') { resumo.semClassificacao += valor; resumo.quantidadeSemClassificacao += 1 }
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

    let tipo = -1, valor = -1, historico = -1, descricaoCategoria = -1, classificacao = -1, saldo = -1

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').toUpperCase().trim()
      if (!cell) continue
      if ((cell.includes('ENTRADA/') || cell === 'TIPO') && tipo === -1) tipo = j
      if (cell.includes('HIST') && historico === -1) historico = j
      if (cell.includes('VALOR') && valor === -1) valor = j
      if (cell.includes('CLASSIFIC') && classificacao === -1) classificacao = j
      if (cell.includes('DESCRI') && descricaoCategoria === -1) descricaoCategoria = j
      if (cell.includes('SALDO') && saldo === -1) saldo = j
    }

    if (tipo !== -1 && valor !== -1) {
      const descricaoFinal = historico !== -1 ? historico : descricaoCategoria
      let classificacaoFinal = classificacao !== -1 ? classificacao : (historico !== -1 ? descricaoCategoria : -1)
      // Some sheets carry the classification in a column with no header label at
      // all — but it always sits in the single gap between "Valor" and "Saldo"
      // (e.g. the April file's MATRIZ/FILIAL/ALUMARKET sheets).
      if (classificacaoFinal === -1 && saldo !== -1 && saldo - valor === 2) {
        classificacaoFinal = valor + 1
      }
      return { headerIdx: i, tipo, valor, descricao: descricaoFinal, classificacao: classificacaoFinal }
    }
  }

  return { headerIdx: -1, tipo: -1, valor: -1, descricao: -1, classificacao: -1 }
}

export interface ResumoDirecionado {
  entradas: number
  saidas: number
}

function valorAdjacente(row: unknown[], colunaLabel: number): number {
  for (let j = colunaLabel + 1; j < row.length; j++) {
    if (String(row[j] ?? '').trim() !== '') return parseValor(row[j])
  }
  return 0
}

/**
 * Algumas abas (ex: NI HAO no arquivo de abril) não trazem extrato linha a
 * linha — são um resumo direto com rótulos e valores, tipo:
 *   VENDAS              R$ 124.262,00
 *   ENTRADAS            R$ 231.854,40
 *   SAIDAS              R$ 236.045,90
 * Detecta isso por uma célula com texto EXATO "ENTRADAS" (plural, sozinha —
 * não "ENTRADA/SAIDA" do cabeçalho de extrato) e outra com "SAIDAS"/"SAÍDAS"
 * nas primeiras 20 linhas, em qualquer aba — não é específico de uma empresa.
 */
function detectarResumoDirecionado(linhas: unknown[][]): ResumoDirecionado | null {
  let entradas: number | null = null
  let saidas: number | null = null

  for (let i = 0; i < Math.min(20, linhas.length); i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').toUpperCase().trim()
      if (cell === 'ENTRADAS' && entradas === null) entradas = valorAdjacente(row, j)
      else if ((cell === 'SAIDAS' || cell === 'SAÍDAS') && saidas === null) saidas = valorAdjacente(row, j)
    }
  }

  if (entradas === null || saidas === null) return null
  return { entradas, saidas }
}

interface ExtratoBruto {
  lancamentos: LancamentoBruto[]
  categorizacaoDisponivel: boolean
  // false quando a aba não tem nem um cabeçalho de extrato reconhecível (nem
  // "TIPO"/"ENTRADA/SAIDA" + "VALOR") — sinal de que a aba não é um extrato
  // bancário, não que seja um extrato vazio.
  headerEncontrado: boolean
}

// Pure structured reading — no category/inclusion decisions are made here.
// Every row with a valid direção and a non-zero valor becomes a raw lançamento;
// classificarLancamentos() decides what each one actually means.
function extrairLancamentos(ws: XLSX.WorkSheet, nomeEmpresa: string): ExtratoBruto {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][]
  const cols = detectarColunasExtrato(linhas)
  const categorizacaoDisponivel = cols.classificacao !== -1
  const lancamentos: LancamentoBruto[] = []

  if (cols.headerIdx === -1) return { lancamentos, categorizacaoDisponivel, headerEncontrado: false }

  for (let i = cols.headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue

    const tipoCell = String(row[cols.tipo] ?? '').toUpperCase().trim()
    const direcao = tipoCell.startsWith('ENTRADA') ? 'entrada' : tipoCell.startsWith('SAIDA') ? 'saida' : null
    if (!direcao) continue

    const valor = Math.abs(parseValor(row[cols.valor]))
    if (valor === 0) continue

    const descricao = cols.descricao >= 0 ? String(row[cols.descricao] ?? '').trim() : ''
    const classificacaoManual = cols.classificacao >= 0 ? String(row[cols.classificacao] ?? '').trim() : ''

    lancamentos.push({ empresa: nomeEmpresa, direcao, valor, descricao, classificacaoManual })
  }

  return { lancamentos, categorizacaoDisponivel, headerEncontrado: true }
}

interface FechamentoTotais {
  faturamentoVendido: number
  faturamentoFaturado: number
  // null (não number) distingue "seção ausente neste arquivo" de "seção
  // presente e o total deu zero" — agregarExcel só cai para a soma por empresa
  // no primeiro caso.
  entradasBanco: number | null
  saidasBanco: number | null
}

// Disparadores de seção tolerantes a variação de rótulo entre arquivos — o
// rótulo "SAIDAS" do arquivo de maio e "PAGAMENTOS" do arquivo de abril
// representam a mesma coisa (saídas do banco), só com nomes diferentes.
const TERMOS_ENTRADAS = ['ENTRADAS NO BANCO', 'ENTRADAS']
const TERMOS_SAIDAS = ['SAIDAS', 'SAÍDAS', 'PAGAMENTOS']

function linhaVazia(row: unknown[]): boolean {
  return !row.some(c => String(c ?? '').trim() !== '')
}

// Primeiro valor positivo a partir de uma coluna — usado para extrair o total
// de uma linha sem assumir em qual coluna exatamente ele está (varia entre
// arquivos: "SAIDAS" do maio tem rótulo na col0 e valor na col1; "PAGAMENTOS"
// do abril tem valor na col1 e rótulo na col2).
function primeiroValorPositivo(row: unknown[], aPartirDe: number): number | null {
  for (let j = aPartirDe; j < row.length; j++) {
    const val = parseValor(row[j])
    if (val > 0) return val
  }
  return null
}

/** Detecta se uma planilha é a aba de fechamento pelo CONTEÚDO (não pelo nome) —
 * a primeira aba cujas primeiras 15 linhas contenham "VENDIDO" e "FATURADO" é
 * tratada como fechamento, seja ela chamada "FECHAMENTO", "Planilha5", etc. */
function pareceFechamento(linhas: unknown[][]): boolean {
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue
    const cells = row.map(c => String(c ?? '').toUpperCase().trim())
    if (cells.includes('VENDIDO') && cells.includes('FATURADO')) return true
  }
  return false
}

function parsearFechamento(ws: XLSX.WorkSheet): FechamentoTotais {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][]

  let faturamentoVendido = 0
  let faturamentoFaturado = 0
  let entradasBanco: number | null = null
  let saidasBanco: number | null = null

  let vendidoCol = -1
  let faturadoCol = -1
  let dentroFaturamento = false
  let candidatoVendido = 0
  let candidatoFaturado = 0

  type SecaoFluxo = 'none' | 'entradas' | 'saidas'
  let secaoFluxo: SecaoFluxo = 'none'
  let candidatoFluxo = 0

  // Estratégia comum às três seções: ao percorrer as linhas de dados, o
  // candidato é sempre sobrescrito (nunca somado) pelo valor da linha atual.
  // Como a última linha antes de uma linha vazia é sempre o total — seja ele
  // explicitamente rotulado "TOTAL" (maio) ou apenas a última linha da lista
  // sem rótulo (abril) — o candidato no momento da linha vazia já é o total
  // correto, sem depender de encontrar o texto "TOTAL" em nenhuma coluna fixa.
  for (const row of linhas) {
    if (!Array.isArray(row)) continue
    const cells = row.map(c => String(c ?? '').toUpperCase().trim())
    const rowText = cells.join(' ')
    const vazia = linhaVazia(row)

    if (!dentroFaturamento && vendidoCol === -1 && cells.includes('VENDIDO') && cells.includes('FATURADO')) {
      vendidoCol = cells.indexOf('VENDIDO')
      faturadoCol = cells.indexOf('FATURADO')
      dentroFaturamento = true
      continue
    }

    if (dentroFaturamento) {
      if (vazia) {
        faturamentoVendido = candidatoVendido
        faturamentoFaturado = candidatoFaturado
        dentroFaturamento = false
      } else {
        const v = parseValor(row[vendidoCol])
        const f = parseValor(row[faturadoCol])
        if (v > 0 || f > 0) { candidatoVendido = v; candidatoFaturado = f }
        continue
      }
    }

    if (secaoFluxo === 'none') {
      if (TERMOS_ENTRADAS.some(t => rowText.includes(t))) { secaoFluxo = 'entradas'; candidatoFluxo = 0; continue }
      if (TERMOS_SAIDAS.some(t => rowText.includes(t))) { secaoFluxo = 'saidas'; candidatoFluxo = 0; continue }
    } else {
      if (vazia) {
        if (secaoFluxo === 'entradas') entradasBanco = candidatoFluxo
        else saidasBanco = candidatoFluxo
        secaoFluxo = 'none'
      } else {
        const val = primeiroValorPositivo(row, 1)
        if (val !== null) candidatoFluxo = val
      }
    }
  }

  // Seções que terminam no fim do arquivo (sem linha vazia final) também
  // precisam fechar com o último candidato visto.
  if (dentroFaturamento) { faturamentoVendido = candidatoVendido; faturamentoFaturado = candidatoFaturado }
  if (secaoFluxo === 'entradas') entradasBanco = candidatoFluxo
  else if (secaoFluxo === 'saidas') saidasBanco = candidatoFluxo

  return { faturamentoVendido, faturamentoFaturado, entradasBanco, saidasBanco }
}

function agregarEmpresa(nome: string, lancamentos: LancamentoClassificado[], categorizacaoDisponivel: boolean): EmpresaAgregada {
  let entradas = 0
  let entradasBancoReal = 0
  let saidas = 0
  const despesasMap = new Map<string, { valor: number; grupo: GrupoCusto }>()
  const itensCusto: Array<{ valor: number; grupo: GrupoCusto; descricao: string }> = []

  for (const l of lancamentos) {
    if (l.categoria === 'intercompany' || l.categoria === 'antecipacao_recebiveis') {
      // Não é venda — não conta em "entradas" (receita operacional). Mas se o
      // dinheiro entrou de fato no banco (antecipação de uma securitizadora/FIDC,
      // ou um PIX recebido de outra empresa do grupo), ele é caixa real disponível
      // e conta em "entradasBancoReal".
      if (l.direcao === 'entrada') {
        entradasBancoReal += valorSeguro(l.valor, l.descricao || l.classificacaoManual || nome)
      }
      continue
    }

    const valor = valorSeguro(l.valor, l.descricao || l.classificacaoManual || nome)

    if (l.direcao === 'entrada') {
      // Any entrada that isn't intercompany/antecipação is cash actually received —
      // count it whether or not the colaboradora (or the dictionary) put a specific
      // label on it. Most revenue rows never get a manual tag at all, so requiring
      // an exact "receita_operacional" match here would silently drop real revenue.
      entradas += valor
      entradasBancoReal += valor
      continue
    }

    // direção === 'saida' — every remaining categoria is a real cash outflow.
    saidas += valor
    const grupo = GRUPO_POR_CATEGORIA[l.categoria] ?? 'outro'
    itensCusto.push({ valor, grupo, descricao: l.descricao })

    if (categorizacaoDisponivel) {
      const chave = l.classificacaoManual || l.descricao.substring(0, 60).toUpperCase().trim() || 'Sem categoria'
      const existente = despesasMap.get(chave)
      if (existente) existente.valor += valor
      else despesasMap.set(chave, { valor, grupo })
    }
  }

  const despesasPorCategoria = construirCategorias(despesasMap, saidas)
  const resumoCustos = construirResumoCustos(categorizacaoDisponivel ? itensCusto : [])

  return {
    nome,
    entradas,
    entradasBancoReal,
    saidas,
    saldo: entradas - saidas,
    despesasOperacionais: resumoCustos.custosFixos + resumoCustos.custosVariaveis,
    despesasPorCategoria,
    resumoCustos,
    categorizacaoDisponivel,
  }
}

export function agregarExcel(buffer: ArrayBuffer, periodoInformado?: string): DadosAgregados {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  const lancamentosPorEmpresa = new Map<string, LancamentoBruto[]>()
  const categorizacaoPorEmpresa = new Map<string, boolean>()
  const resumosDirecionados = new Map<string, ResumoDirecionado>()
  const abasNaoReconhecidas: string[] = []
  let fechamento: FechamentoTotais | null = null

  for (const nomeAba of workbook.SheetNames) {
    const ws = workbook.Sheets[nomeAba]
    const upper = nomeAba.toUpperCase().trim()

    // A aba de fechamento é identificada pelo CONTEÚDO (VENDIDO+FATURADO nas
    // primeiras linhas), não pelo nome — arquivos diferentes já usaram
    // "FECHAMENTO" e "Planilha5" para a mesma coisa. A primeira aba encontrada
    // com esse conteúdo é usada; abas seguintes não são reavaliadas.
    if (!fechamento) {
      const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][]
      if (pareceFechamento(linhas)) {
        fechamento = parsearFechamento(ws)
        continue
      }
    }

    const chave = Object.keys(MAPA_EMPRESAS).find(k => upper.includes(k) || k.includes(upper))
    const nomeEmpresa = chave ? MAPA_EMPRESAS[chave] : nomeAba

    // Verificado antes do parser de extrato linha a linha — algumas abas (não
    // só NI HAO, qualquer uma) trazem só um resumo ENTRADAS/SAIDAS em vez de
    // lançamento por lançamento. Sem detalhe de lançamentos, não há o que
    // classificar nem categorizar; só os dois totais entram no consolidado.
    const linhasAba = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][]
    const resumo = detectarResumoDirecionado(linhasAba)
    if (resumo) {
      resumosDirecionados.set(nomeEmpresa, resumo)
      continue
    }

    const { lancamentos, categorizacaoDisponivel, headerEncontrado } = extrairLancamentos(ws, nomeEmpresa)

    // Sem match de nome de empresa conhecida, sem formato de resumo e sem nem
    // um cabeçalho de extrato reconhecível — não é uma empresa do grupo, é uma
    // aba qualquer (notas, rascunho, etc). Não entra como empresa fantasma
    // zerada; só fica registrada para diagnóstico.
    if (!chave && !headerEncontrado) {
      abasNaoReconhecidas.push(nomeAba)
      continue
    }

    lancamentosPorEmpresa.set(nomeEmpresa, lancamentos)
    categorizacaoPorEmpresa.set(nomeEmpresa, categorizacaoDisponivel)
  }

  // Deterministic dictionary lookup — the colaboradora's manual classification is
  // the source of truth, mapearCategoria() just translates her wording into the
  // formal category keys. No AI call, no batching needed.
  //
  // Entradas almost never carry a manual tag at all in this spreadsheet's
  // convention — that's normal for a sale, not a data-quality gap. An untagged
  // entrada with no dictionary match defaults to receita_operacional rather than
  // sem_classificacao_manual, so that warning stays a meaningful signal scoped to
  // what actually needs the colaboradora's attention: untagged saídas.
  const todosLancamentos = Array.from(lancamentosPorEmpresa.values()).flat()
  const classificados: LancamentoClassificado[] = todosLancamentos.map(l => {
    const categoria = mapearCategoria(l.classificacaoManual, l.descricao)
    return {
      ...l,
      categoria: categoria === SEM_CLASSIFICACAO_MANUAL && l.direcao === 'entrada' ? 'receita_operacional' : categoria,
    }
  })

  const classificadosPorEmpresa = new Map<string, LancamentoClassificado[]>()
  for (const l of classificados) {
    const lista = classificadosPorEmpresa.get(l.empresa) ?? []
    lista.push(l)
    classificadosPorEmpresa.set(l.empresa, lista)
  }

  const empresas: EmpresaAgregada[] = []
  const clientesGlobais = new Map<string, { valor: number; empresa: string }>()
  const despesasGrupoMap = new Map<string, { valor: number; grupo: GrupoCusto }>()
  const itensCustoGrupo: Array<{ valor: number; grupo: GrupoCusto; descricao: string }> = []
  let internoTotal = 0
  let internoQtd = 0
  let antecipacaoTotal = 0
  let antecipacaoQtd = 0
  let semClassificacaoTotal = 0
  let semClassificacaoQtd = 0

  for (const nomeEmpresa of lancamentosPorEmpresa.keys()) {
    const lancamentosClassificados = classificadosPorEmpresa.get(nomeEmpresa) ?? []
    const categorizacaoDisponivel = categorizacaoPorEmpresa.get(nomeEmpresa) ?? false

    const empresaAgregada = agregarEmpresa(nomeEmpresa, lancamentosClassificados, categorizacaoDisponivel)
    empresas.push(empresaAgregada)

    if (categorizacaoDisponivel) {
      for (const cat of empresaAgregada.despesasPorCategoria) {
        const existente = despesasGrupoMap.get(cat.categoria)
        if (existente) existente.valor += cat.valor
        else despesasGrupoMap.set(cat.categoria, { valor: cat.valor, grupo: cat.grupo })
        itensCustoGrupo.push({ valor: cat.valor, grupo: cat.grupo, descricao: cat.categoria })
      }
    }

    // Iterates the classified list directly (order-preserving 1:1 transform of the
    // raw lançamentos) — never re-matches by value, since duplicate rows with the
    // same descrição/valor (e.g. repeated R$5.000 PIX from the same CNPJ) would
    // collide under a value-based lookup.
    for (const l of lancamentosClassificados) {
      const valor = valorSeguro(l.valor, l.descricao || l.classificacaoManual || nomeEmpresa)

      if (l.categoria === SEM_CLASSIFICACAO_MANUAL) {
        semClassificacaoTotal += valor
        semClassificacaoQtd++
      }

      if (l.categoria === 'intercompany') {
        internoTotal += valor
        internoQtd++
        continue
      }
      if (l.direcao !== 'entrada') continue

      if (l.categoria === 'antecipacao_recebiveis') {
        antecipacaoTotal += valor
        antecipacaoQtd++
      } else if (l.descricao) {
        // Any other entrada (receita_operacional — the default for untagged
        // entradas — a dictionary category, or a custom slug) is treated as a sale.
        const chave = l.descricao.substring(0, 60).toUpperCase().trim()
        const existenteCliente = clientesGlobais.get(chave)
        if (existenteCliente) existenteCliente.valor += valor
        else clientesGlobais.set(chave, { valor, empresa: nomeEmpresa })
      }
    }
  }

  // Abas só-resumo (sem lançamento por lançamento) entram no consolidado pelos
  // dois totais direto — não há detalhe para categorizar, então seguem a mesma
  // convenção de "sem categorização disponível" usada quando a coluna de
  // classificação simplesmente não existe.
  for (const [nomeEmpresa, { entradas, saidas }] of resumosDirecionados) {
    empresas.push({
      nome: nomeEmpresa,
      entradas,
      entradasBancoReal: entradas,
      saidas,
      saldo: entradas - saidas,
      despesasOperacionais: 0,
      despesasPorCategoria: [],
      resumoCustos: construirResumoCustos([]),
      categorizacaoDisponivel: false,
    })
  }

  const clientes: ClienteAgregado[] = Array.from(clientesGlobais.entries())
    .map(([nome, d]) => ({ nome, valor: d.valor, empresa: d.empresa }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 30)

  const faturamento = {
    vendido: fechamento?.faturamentoVendido ?? 0,
    faturado: fechamento?.faturamentoFaturado ?? 0,
    disponivel: fechamento !== null,
  }

  // "Entradas no Banco"/"Saldo do Grupo" precisam refletir caixa real — toda
  // antecipação de recebíveis e todo intercompany recebido entraram fisicamente
  // na conta, mesmo não sendo venda nova. Por isso usam entradasBancoReal, não
  // "entradas" (receita operacional pura, usada na margem operacional de cada
  // empresa). Quando a aba de fechamento já traz o total bancário, ele prevalece
  // por já ser o número real do banco.
  const totalEntradas = fechamento?.entradasBanco ?? empresas.reduce((s, e) => s + e.entradasBancoReal, 0)
  const totalSaidas = fechamento?.saidasBanco ?? empresas.reduce((s, e) => s + e.saidas, 0)

  const totalCategorizadoGrupo = Array.from(despesasGrupoMap.values()).reduce((s, v) => s + v.valor, 0)
  const despesasPorCategoriaGrupo = construirCategorias(despesasGrupoMap, totalCategorizadoGrupo)
  const resumoCustosGrupo = construirResumoCustos(itensCustoGrupo)

  const consolidado = {
    totalEntradas,
    totalSaidas,
    saldoGrupo: totalEntradas - totalSaidas,
    despesasOperacionaisGrupo: resumoCustosGrupo.custosFixos + resumoCustosGrupo.custosVariaveis,
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
    semClassificacaoManual: { total: semClassificacaoTotal, quantidade: semClassificacaoQtd },
    abasNaoReconhecidas,
  }
}

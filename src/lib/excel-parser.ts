import * as XLSX from 'xlsx'
import type {
  DadosConsolidados,
  DadosEmpresa,
  TransacaoFinanceira,
  ClientePrincipal,
  AlertaFinanceiro,
  KPIDashboard,
  DadosFechamento,
  CodigoEmpresa,
} from '@/types/financeiro'

const META_MENSAL = 2_000_000

const FGI_FIXO = {
  gimenes: 5_000,
  barramares: 18_000,
  alumarketHera: 23_000,
  total: 46_000,
}

const MAPA_EMPRESAS: Record<string, { codigo: CodigoEmpresa; nome: string }> = {
  'MATRIZ MAIO': { codigo: 'SS1', nome: 'Solar System Matriz' },
  'FILIAL MAIO': { codigo: 'SS2', nome: 'Solar System Filial PR' },
  'LEVEL': { codigo: 'LEVEL', nome: 'Level2' },
  'NI HAO': { codigo: 'NIHAO', nome: 'Ni Hao' },
  'ALUMARKET': { codigo: 'ALUMARKET', nome: 'AluMarket' },
}

const TOKENS_INTERNOS = [
  'SOLAR SYSTEM', 'LEVEL2', 'NI HAO', 'NIHAO', 'ALUMARKET',
  'SS FILIAL', 'SS MATRIZ', 'TRANSFERENCIA INTERNA', 'TRANSF INTERNA',
]

const TOKENS_ANTECIPADORES = [
  'RICO C SECURITIZADORA', 'RICO SECURITIZADORA', 'GENESIS FIDC', 'LOTUS PERFORMANCE',
]

function ehMovimentacaoInterna(descricao: string): boolean {
  const d = descricao.toUpperCase()
  return TOKENS_INTERNOS.some(t => d.includes(t))
}

function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function parseData(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'number') {
    try {
      const info = XLSX.SSF.parse_date_code(v)
      return `${String(info.d).padStart(2, '0')}/${String(info.m).padStart(2, '0')}/${info.y}`
    } catch {
      return ''
    }
  }
  return String(v)
}

function detectarColunas(linhas: unknown[][]): {
  headerIdx: number
  data: number
  descricao: number
  valor: number
  tipo: number
} {
  const resultado = { headerIdx: 0, data: -1, descricao: -1, valor: -1, tipo: -1 }

  for (let i = 0; i < Math.min(8, linhas.length); i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').toUpperCase().trim()
      if (['DATA', 'DT', 'DATE'].includes(cell) && resultado.data === -1) {
        resultado.data = j
        resultado.headerIdx = i
      }
      if (['DESCRICAO', 'DESCRIÇÃO', 'HISTORICO', 'HISTÓRICO', 'DESCR', 'OBS'].includes(cell) && resultado.descricao === -1) {
        resultado.descricao = j
      }
      if (['VALOR', 'VLR', 'AMOUNT', 'CREDITO', 'CRÉDITO', 'DEBITO', 'DÉBITO'].includes(cell) && resultado.valor === -1) {
        resultado.valor = j
      }
      if (['TIPO', 'TYPE', 'DC', 'D/C', 'CR/DB'].includes(cell) && resultado.tipo === -1) {
        resultado.tipo = j
      }
    }

    if (resultado.data !== -1 && resultado.valor !== -1) break
  }

  // Fallback: inferir colunas por conteúdo
  if (resultado.data === -1 || resultado.valor === -1) {
    for (let i = 0; i < Math.min(15, linhas.length); i++) {
      const row = linhas[i]
      if (!Array.isArray(row)) continue

      let dCol = -1, vCol = -1, dscCol = -1

      for (let j = 0; j < row.length; j++) {
        const cell = row[j]
        if (!cell) continue
        const s = String(cell)
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s) && dCol === -1) dCol = j
        if (typeof cell === 'number' && Math.abs(cell) > 1 && vCol === -1) vCol = j
        if (typeof cell === 'string' && cell.length > 4 && dscCol === -1 && j !== dCol) dscCol = j
      }

      if (dCol !== -1 && vCol !== -1) {
        resultado.headerIdx = i
        resultado.data = dCol
        resultado.valor = vCol
        if (resultado.descricao === -1) resultado.descricao = dscCol
        break
      }
    }
  }

  return resultado
}

function parsearAba(ws: XLSX.WorkSheet, nomeAba: string): DadosEmpresa {
  const chave = Object.keys(MAPA_EMPRESAS).find(
    k => nomeAba.toUpperCase().includes(k) || k.includes(nomeAba.toUpperCase()),
  )
  const config = chave ? MAPA_EMPRESAS[chave] : { codigo: 'SS1' as CodigoEmpresa, nome: nomeAba }

  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  const cols = detectarColunas(linhas)
  const transacoes: TransacaoFinanceira[] = []

  for (let i = cols.headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue

    const descricao = cols.descricao >= 0 ? String(row[cols.descricao] ?? '').trim() : ''
    const valorRaw = cols.valor >= 0 ? row[cols.valor] : null
    const valor = parseValor(valorRaw)

    if (!valor && !descricao) continue

    const interno = ehMovimentacaoInterna(descricao)
    const tipo: TransacaoFinanceira['tipo'] = interno
      ? 'transferencia'
      : valor >= 0
        ? 'receita'
        : 'despesa'

    transacoes.push({
      data: parseData(cols.data >= 0 ? row[cols.data] : ''),
      descricao,
      valor,
      tipo,
    })
  }

  const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
  const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Math.abs(t.valor), 0)

  // Agrupar fluxo por mês (DD/MM/YYYY → MM/YYYY)
  const porMes: Record<string, { entradas: number; saidas: number }> = {}
  for (const t of transacoes) {
    const periodo = t.data.length >= 7 ? t.data.substring(3, 10) : 'S/D'
    porMes[periodo] ??= { entradas: 0, saidas: 0 }
    if (t.valor > 0) porMes[periodo].entradas += t.valor
    else porMes[periodo].saidas += Math.abs(t.valor)
  }

  return {
    nome: config.nome,
    codigo: config.codigo,
    transacoes,
    saldo: receitas - despesas,
    receitas,
    despesas,
    fluxoMensal: Object.entries(porMes).map(([periodo, d]) => ({
      periodo,
      entradas: d.entradas,
      saidas: d.saidas,
      saldo: d.entradas - d.saidas,
    })),
  }
}

function parsearFechamento(ws: XLSX.WorkSheet): DadosFechamento {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  let receitaTotal = 0
  let despesaTotal = 0
  let resultadoLiquido = 0
  const antecipacoes = { rico: 0, genesis: 0, lotus: 0, total: 0 }

  for (const row of linhas) {
    if (!Array.isArray(row)) continue
    for (let i = 0; i < row.length - 1; i++) {
      const label = String(row[i] ?? '').toUpperCase().trim()
      const val = parseValor(row[i + 1])
      if (!val) continue

      if (label.includes('RECEITA') && val > receitaTotal) receitaTotal = val
      else if (label.includes('DESPESA') && val > despesaTotal) despesaTotal = val
      else if ((label.includes('RESULTADO') || label.includes('LUCRO') || label.includes('LIQUIDO'))) resultadoLiquido = val
      else if (label.includes('RICO')) antecipacoes.rico += Math.abs(val)
      else if (label.includes('GENESIS')) antecipacoes.genesis += Math.abs(val)
      else if (label.includes('LOTUS')) antecipacoes.lotus += Math.abs(val)
    }
  }

  antecipacoes.total = antecipacoes.rico + antecipacoes.genesis + antecipacoes.lotus

  return {
    receitaTotal,
    despesaTotal,
    resultadoLiquido: resultadoLiquido || receitaTotal - despesaTotal,
    fgi: { ...FGI_FIXO },
    antecipacoes,
  }
}

function extrairClientes(empresas: DadosEmpresa[]): ClientePrincipal[] {
  const mapa: Record<string, { valor: number; empresa: string }> = {}

  for (const empresa of empresas) {
    for (const t of empresa.transacoes) {
      if (t.tipo !== 'receita' || t.valor <= 0) continue
      if (ehMovimentacaoInterna(t.descricao)) continue

      const chave = t.descricao.substring(0, 50).toUpperCase().trim()
      mapa[chave] ??= { valor: 0, empresa: empresa.nome }
      mapa[chave].valor += t.valor
    }
  }

  const totalReceitas = Object.values(mapa).reduce((s, c) => s + c.valor, 0)

  return Object.entries(mapa)
    .sort(([, a], [, b]) => b.valor - a.valor)
    .slice(0, 25)
    .map(([nome, dados]) => ({
      nome,
      valor: dados.valor,
      empresa: dados.empresa,
      percentual: totalReceitas > 0 ? (dados.valor / totalReceitas) * 100 : 0,
    }))
}

function gerarAlertas(
  empresas: DadosEmpresa[],
  clientes: ClientePrincipal[],
  kpis: KPIDashboard,
): AlertaFinanceiro[] {
  const alertas: AlertaFinanceiro[] = []

  if (kpis.comprometimentoFGI > 30) {
    alertas.push({
      tipo: 'danger',
      titulo: 'FGI Crítico',
      mensagem: `Comprometimento do FGI em ${kpis.comprometimentoFGI.toFixed(1)}% do faturamento — acima de 30%`,
      valor: FGI_FIXO.total,
    })
  } else if (kpis.comprometimentoFGI > 20) {
    alertas.push({
      tipo: 'warning',
      titulo: 'FGI Elevado',
      mensagem: `Comprometimento do FGI em ${kpis.comprometimentoFGI.toFixed(1)}% — monitorar de perto`,
      valor: FGI_FIXO.total,
    })
  } else if (kpis.faturamentoTotal > 0) {
    alertas.push({
      tipo: 'success',
      titulo: 'FGI Controlado',
      mensagem: `Comprometimento do FGI em ${kpis.comprometimentoFGI.toFixed(1)}% — dentro do limite saudável`,
      valor: FGI_FIXO.total,
    })
  }

  if (kpis.progressoMeta < 50) {
    alertas.push({
      tipo: 'danger',
      titulo: 'Meta Abaixo do Esperado',
      mensagem: `Progresso da meta R$2M em ${kpis.progressoMeta.toFixed(1)}% — necessário acelerar captação`,
    })
  } else if (kpis.progressoMeta < 80) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Meta em Andamento',
      mensagem: `Progresso da meta R$2M em ${kpis.progressoMeta.toFixed(1)}%`,
    })
  } else {
    alertas.push({
      tipo: 'success',
      titulo: 'Meta no Caminho Certo',
      mensagem: `Progresso da meta R$2M em ${kpis.progressoMeta.toFixed(1)}% — excelente performance`,
    })
  }

  if (clientes.length > 0 && clientes[0].percentual > 40) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Concentração de Cliente',
      mensagem: `${clientes[0].nome} representa ${clientes[0].percentual.toFixed(1)}% das receitas — risco de dependência`,
    })
  }

  if (kpis.margemBruta < 10 && kpis.faturamentoTotal > 0) {
    alertas.push({
      tipo: 'danger',
      titulo: 'Margem Bruta Crítica',
      mensagem: `Margem bruta de ${kpis.margemBruta.toFixed(1)}% — abaixo do mínimo operacional`,
    })
  } else if (kpis.margemBruta < 20 && kpis.faturamentoTotal > 0) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Margem Bruta Baixa',
      mensagem: `Margem bruta de ${kpis.margemBruta.toFixed(1)}% — avaliar custos operacionais`,
    })
  }

  const negativos = empresas.filter(e => e.saldo < 0)
  if (negativos.length > 0) {
    alertas.push({
      tipo: 'danger',
      titulo: 'Saldo Negativo',
      mensagem: `${negativos.map(e => e.nome).join(', ')} com saldo negativo — ação imediata necessária`,
    })
  }

  return alertas
}

export function parsearExcel(buffer: ArrayBuffer): DadosConsolidados {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  const empresas: DadosEmpresa[] = []
  let fechamento: DadosFechamento | undefined

  for (const nomAba of workbook.SheetNames) {
    const ws = workbook.Sheets[nomAba]
    const upper = nomAba.toUpperCase().trim()

    if (upper === 'FECHAMENTO') {
      fechamento = parsearFechamento(ws)
    } else {
      const config = Object.keys(MAPA_EMPRESAS).find(k => upper.includes(k) || k.includes(upper))
      if (config || empresas.length < 5) {
        empresas.push(parsearAba(ws, nomAba))
      }
    }
  }

  const clientes = extrairClientes(empresas)

  const faturamento = empresas.reduce((s, e) => s + e.receitas, 0)
  const despesas = empresas.reduce((s, e) => s + e.despesas, 0)
  const saldo = empresas.reduce((s, e) => s + e.saldo, 0)
  const margemBruta = faturamento > 0 ? ((faturamento - despesas) / faturamento) * 100 : 0
  const comprometimentoFGI = faturamento > 0 ? (FGI_FIXO.total / faturamento) * 100 : 0
  const progressoMeta = Math.min((faturamento / META_MENSAL) * 100, 100)

  const kpis: KPIDashboard = {
    saldoConsolidado: saldo,
    faturamentoTotal: faturamento,
    margemBruta,
    comprometimentoFGI,
    progressoMeta,
  }

  const alertas = gerarAlertas(empresas, clientes, kpis)
  const periodo = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return { empresas, kpis, clientes, alertas, fechamento, periodo }
}

export { TOKENS_ANTECIPADORES, FGI_FIXO, META_MENSAL }

export type NivelAlerta = 'danger' | 'warning' | 'info' | 'success'

export type GrupoCusto = 'fixo' | 'variavel' | 'outro'

export interface CategoriaDespesa {
  categoria: string
  valor: number
  percentualDoTotal: number
  grupo: GrupoCusto
}

export interface ResumoCustos {
  custosFixos: number
  custosVariaveis: number
  outros: number
}

export interface EmpresaAnalise {
  nome: string
  entradas: number
  saidas: number
  saldo: number
  despesasPorCategoria: CategoriaDespesa[]
  resumoCustos: ResumoCustos
  categorizacaoDisponivel: boolean
}

export interface ClienteAnalise {
  nome: string
  valor: number
  empresa: string
}

export interface AlertaAnalise {
  nivel: NivelAlerta
  titulo: string
  descricao: string
}

export interface RecomendacaoAnalise {
  prioridade: number
  acao: string
}

export interface MensagemChat {
  role: 'user' | 'assistant'
  content: string
}

export interface PeriodoResumo {
  periodo: string
  faturamentoVendido: number
  faturamentoFaturado: number
  totalEntradas: number
  totalSaidas: number
  saldoGrupo: number
  criadoEm: string
  atualizadoEm: string
}

export interface VariacaoKpi {
  valorA: number
  valorB: number
  variacaoPercentual: number
}

export interface VariacaoEmpresa {
  nome: string
  entradas: VariacaoKpi
  saidas: VariacaoKpi
  saldo: VariacaoKpi
}

export interface Variacoes {
  faturamentoVendido: VariacaoKpi
  faturamentoFaturado: VariacaoKpi
  saldoGrupo: VariacaoKpi
  totalEntradas: VariacaoKpi
  totalSaidas: VariacaoKpi
  empresas: VariacaoEmpresa[]
}

export interface ComparativoResponse {
  relatorioA: RelatorioCompleto
  relatorioB: RelatorioCompleto
  variacoes: Variacoes
}

export interface RelatorioCompleto {
  periodo: string
  periodoChave: string // formato "AAAA-MM", usado como chave no histórico e em comparações entre meses
  faturamento: {
    vendido: number
    faturado: number
  }
  empresas: EmpresaAnalise[]
  consolidado: {
    totalEntradas: number
    totalSaidas: number
    saldoGrupo: number
    despesasPorCategoriaGrupo: CategoriaDespesa[]
    resumoCustosGrupo: ResumoCustos
  }
  clientes: ClienteAnalise[]
  analise: {
    resumoExecutivo: string
    alertas: AlertaAnalise[]
    recomendacoes: RecomendacaoAnalise[]
  }
}

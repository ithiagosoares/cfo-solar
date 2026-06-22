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

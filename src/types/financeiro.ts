export interface TransacaoFinanceira {
  data: string
  descricao: string
  valor: number
  tipo: 'receita' | 'despesa' | 'transferencia'
  categoria?: string
}

export interface FluxoCaixa {
  periodo: string
  entradas: number
  saidas: number
  saldo: number
}

export type CodigoEmpresa = 'SS1' | 'SS2' | 'LEVEL' | 'NIHAO' | 'ALUMARKET'

export interface DadosEmpresa {
  nome: string
  codigo: CodigoEmpresa
  transacoes: TransacaoFinanceira[]
  saldo: number
  receitas: number
  despesas: number
  fluxoMensal: FluxoCaixa[]
}

export interface ClientePrincipal {
  nome: string
  valor: number
  empresa: string
  percentual: number
}

export interface KPIDashboard {
  saldoConsolidado: number
  faturamentoTotal: number
  margemBruta: number
  comprometimentoFGI: number
  progressoMeta: number
  variacaoFaturamento?: number
  variacaoSaldo?: number
}

export type TipoAlerta = 'danger' | 'warning' | 'success' | 'info'

export interface AlertaFinanceiro {
  tipo: TipoAlerta
  titulo: string
  mensagem: string
  valor?: number
}

export interface DadosFechamento {
  receitaTotal: number
  despesaTotal: number
  resultadoLiquido: number
  fgi: {
    gimenes: number
    barramares: number
    alumarketHera: number
    total: number
  }
  antecipacoes: {
    rico: number
    genesis: number
    lotus: number
    total: number
  }
}

export interface DadosConsolidados {
  empresas: DadosEmpresa[]
  kpis: KPIDashboard
  clientes: ClientePrincipal[]
  alertas: AlertaFinanceiro[]
  fechamento?: DadosFechamento
  periodo: string
}

export interface RelatorioIA {
  resumoExecutivo: string
  analiseFluxo: string
  analiseClientes: string
  analiseFGI: string
  recomendacoes: string[]
  alertasPrioritarios: string[]
  perspectiva: string
}

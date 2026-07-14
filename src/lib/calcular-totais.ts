import type { LancamentoClassificadoV2 } from './classificador-ia-v2'
import type { DadosAgregados } from './excel-aggregator'
import type { RelatorioResumo } from './relatorios-repository'

// Pure arithmetic over already-classified lançamentos — no AI calls happen here.

export interface TotalPorCategoria {
  categoria: string
  valor: number
  quantidade: number
}

export interface TotalPorEmpresa {
  empresa: string
  entradas: number
  saidas: number
  saldo: number
}

export interface TotaisCalculados {
  totalGeral: { entradas: number; saidas: number; saldo: number }
  porCategoria: TotalPorCategoria[]
  porEmpresa: TotalPorEmpresa[]
}

export function calcularTotais(lancamentos: LancamentoClassificadoV2[]): TotaisCalculados {
  const categorias = new Map<string, TotalPorCategoria>()
  const empresas = new Map<string, TotalPorEmpresa>()
  let entradasGeral = 0
  let saidasGeral = 0

  for (const l of lancamentos) {
    const cat = categorias.get(l.categoria) ?? { categoria: l.categoria, valor: 0, quantidade: 0 }
    cat.valor += l.valor
    cat.quantidade += 1
    categorias.set(l.categoria, cat)

    const emp = empresas.get(l.empresa) ?? { empresa: l.empresa, entradas: 0, saidas: 0, saldo: 0 }
    if (l.tipo === 'entrada') {
      emp.entradas += l.valor
      entradasGeral += l.valor
    } else {
      emp.saidas += l.valor
      saidasGeral += l.valor
    }
    emp.saldo = emp.entradas - emp.saidas
    empresas.set(l.empresa, emp)
  }

  return {
    totalGeral: { entradas: entradasGeral, saidas: saidasGeral, saldo: entradasGeral - saidasGeral },
    porCategoria: Array.from(categorias.values()).sort((a, b) => b.valor - a.valor),
    porEmpresa: Array.from(empresas.values()).sort((a, b) => b.entradas - a.entradas),
  }
}

// ─── MÉTRICAS DERIVADAS ───────────────────────────────────────────────────────
// Funções determinísticas para KPIs derivados que serão pré-computados em código
// e entregues à IA como fatos prontos — nunca deixar a IA calcular percentuais
// ou comparações a partir dos dados brutos, pois já gerou erro real (antecipação
// reportada como 80% quando o valor real era 26%).

function brl(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function pct(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }) + '%'
}

// ─── 1. Dependência de Antecipação ───────────────────────────────────────────

export interface DependenciaAntecipacao {
  valorAntecipado: number
  entradasTotais: number
  percentualDoCaixa: number
  // Legível: "R$ 284.176,00 ÷ R$ 1.090.795,00 = 26,1%"
  formula: string
}

/**
 * Quanto do caixa real que entrou no banco veio de antecipação de recebíveis
 * (securitizadora / FIDC) em vez de venda nova.
 *
 * Usa DadosAgregados.antecipacoes.total, calculado deterministicamente por
 * agregarExcel() via classificação de lançamentos como 'antecipacao_recebiveis'.
 * Não reclassifica nem soma novamente — apenas deriva o percentual.
 *
 * TODO (próximo passo, separado): antecipacoes.total não exclui estornos
 * bancários do mesmo período (ex: crédito da securitizadora revertido por falha).
 * O tratamento de estornos deve ser implementado no parser do excel-aggregator.
 */
export function calcularDependenciaAntecipacao(dados: DadosAgregados): DependenciaAntecipacao {
  const valorAntecipado = dados.antecipacoes.total
  const entradasTotais = dados.consolidado.totalEntradas
  const percentualDoCaixa = entradasTotais > 0 ? (valorAntecipado / entradasTotais) * 100 : 0

  return {
    valorAntecipado,
    entradasTotais,
    percentualDoCaixa,
    formula: `${brl(valorAntecipado)} ÷ ${brl(entradasTotais)} = ${pct(percentualDoCaixa)}`,
  }
}

// ─── 2. Evolução do Caixa ────────────────────────────────────────────────────

export interface EvolucaoCaixa {
  saldoAtual: number
  entradasAtual: number
  // null quando não há relatório do mês anterior salvo no banco
  saldoAnterior: number | null
  entradasAnterior: number | null
  variacaoAbsolutaSaldo: number | null
  variacaoPercentualSaldo: number | null
  variacaoAbsolutaEntradas: number | null
  variacaoPercentualEntradas: number | null
  // Legível: "Saldo: R$ X vs R$ Y → +R$ Z (+12,3%) | Entradas: ..."
  formula: string
}

/**
 * Compara saldo do grupo e entradas totais com o mês anterior.
 *
 * "Saldo do grupo" (totalEntradas − totalSaidas) é o conceito de caixa do
 * dashboard — quanto sobrou ou faltou no período inteiro. Passa-se null para
 * periodoAnterior quando não há relatório salvo (ex: primeiro mês no sistema).
 *
 * A variação percentual do saldo usa Math.abs(anterior) no denominador para
 * produzir resultado interpretável quando o saldo anterior é negativo.
 */
export function calcularEvolucaoCaixa(
  atual: DadosAgregados,
  anterior: RelatorioResumo | null,
): EvolucaoCaixa {
  const saldoAtual = atual.consolidado.saldoGrupo
  const entradasAtual = atual.consolidado.totalEntradas

  if (!anterior) {
    return {
      saldoAtual,
      entradasAtual,
      saldoAnterior: null,
      entradasAnterior: null,
      variacaoAbsolutaSaldo: null,
      variacaoPercentualSaldo: null,
      variacaoAbsolutaEntradas: null,
      variacaoPercentualEntradas: null,
      formula: `Saldo atual: ${brl(saldoAtual)} | Entradas: ${brl(entradasAtual)} (sem mês anterior disponível)`,
    }
  }

  const saldoAnterior = anterior.saldoGrupo
  const entradasAnterior = anterior.totalEntradas

  const variacaoAbsolutaSaldo = saldoAtual - saldoAnterior
  const variacaoPercentualSaldo =
    saldoAnterior !== 0 ? (variacaoAbsolutaSaldo / Math.abs(saldoAnterior)) * 100 : null

  const variacaoAbsolutaEntradas = entradasAtual - entradasAnterior
  const variacaoPercentualEntradas =
    entradasAnterior !== 0 ? (variacaoAbsolutaEntradas / Math.abs(entradasAnterior)) * 100 : null

  const sinalSaldo = variacaoAbsolutaSaldo >= 0 ? '+' : ''
  const sinalEntradas = variacaoAbsolutaEntradas >= 0 ? '+' : ''
  const sufixoSaldo = variacaoPercentualSaldo !== null
    ? ` (${sinalSaldo}${pct(variacaoPercentualSaldo)})` : ''
  const sufixoEntradas = variacaoPercentualEntradas !== null
    ? ` (${sinalEntradas}${pct(variacaoPercentualEntradas)})` : ''

  const formula =
    `Saldo: ${brl(saldoAtual)} vs ${brl(saldoAnterior)} → ${sinalSaldo}${brl(variacaoAbsolutaSaldo)}${sufixoSaldo}` +
    ` | Entradas: ${brl(entradasAtual)} vs ${brl(entradasAnterior)} → ${sinalEntradas}${brl(variacaoAbsolutaEntradas)}${sufixoEntradas}`

  return {
    saldoAtual,
    entradasAtual,
    saldoAnterior,
    entradasAnterior,
    variacaoAbsolutaSaldo,
    variacaoPercentualSaldo,
    variacaoAbsolutaEntradas,
    variacaoPercentualEntradas,
    formula,
  }
}

// ─── 3. Capital de Giro ───────────────────────────────────────────────────────

export interface CapitalDeGiro {
  entradasOperacionais: number  // receita real de vendas (exclui antecipação e intercompany)
  saidasTotais: number          // todo caixa que saiu do banco (inclui CAPEX, FGI, pró-labore)
  // gap > 0 → saídas superam receita operacional; está sendo financiado externamente
  // gap ≤ 0 → operação gera caixa suficiente para cobrir todas as saídas
  necessidadeEstimada: number
  // Legível: "R$ X (saídas) − R$ Y (entradas operacionais) = R$ Z → gap de R$ Z precisa de financiamento"
  formula: string
}

/**
 * Proxy inicial da necessidade de capital de giro: saídas totais menos receita
 * operacional pura.
 *
 * Fórmula: gap = totalSaidas − Σ(empresa.entradas)
 *   - empresa.entradas já exclui antecipação de recebíveis e intercompany
 *     (ver agregarEmpresa() em excel-aggregator.ts) — representa venda real.
 *   - totalSaidas inclui tudo: OPEX, CAPEX, FGI, pró-labore. Esses compromissos
 *     existem e precisam de caixa, independentemente da origem.
 *
 * ATENÇÃO: esta é uma estimativa de proxy, não o Cálculo de Capital de Giro
 * Líquido (CGL = ativo circulante − passivo circulante), que exige balanço
 * patrimonial. Valide a interpretação com os diretores antes de usar em
 * apresentações externas.
 */
export function calcularCapitalDeGiro(dados: DadosAgregados): CapitalDeGiro {
  const entradasOperacionais = dados.empresas.reduce((soma, e) => soma + e.entradas, 0)
  const saidasTotais = dados.consolidado.totalSaidas
  const necessidadeEstimada = saidasTotais - entradasOperacionais

  const descricaoGap = necessidadeEstimada > 0
    ? `gap de ${brl(necessidadeEstimada)} financiado externamente (antecipação / crédito / intercompany)`
    : `superávit operacional de ${brl(Math.abs(necessidadeEstimada))}`

  const formula =
    `${brl(saidasTotais)} (saídas) − ${brl(entradasOperacionais)} (entradas operacionais) = ${brl(necessidadeEstimada)} → ${descricaoGap}`

  return { entradasOperacionais, saidasTotais, necessidadeEstimada, formula }
}

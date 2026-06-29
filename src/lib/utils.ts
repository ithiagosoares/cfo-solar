import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

export function formatMoedaCompacta(valor: number): string {
  if (Math.abs(valor) >= 1_000_000) {
    return `R$ ${(valor / 1_000_000).toFixed(2).replace('.', ',')}M`
  }
  if (Math.abs(valor) >= 1_000) {
    return `R$ ${(valor / 1_000).toFixed(1).replace('.', ',')}k`
  }
  return formatMoeda(valor)
}

export function formatPercentual(valor: number, casas = 1): string {
  return `${valor.toFixed(casas).replace('.', ',')}%`
}

/**
 * Margin ratios computed against a near-zero denominator (e.g. a company with
 * R$0,10 in entradas and R$30k in saídas) are mathematically correct but
 * visually meaningless — hide the literal percentage beyond +/-500%.
 */
export function formatMargem(valor: number, casas = 1): string {
  if (valor < -500 || valor > 500) return 'Sem receita operacional'
  return formatPercentual(valor, casas)
}

export function formatNumero(valor: number): string {
  return new Intl.NumberFormat('pt-BR').format(valor)
}

export function calcularVariacao(atual: number, anterior: number): number {
  if (anterior === 0) return 0
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

export function classeVariacao(variacao: number): string {
  if (variacao > 0) return 'text-emerald-400'
  if (variacao < 0) return 'text-red-400'
  return 'text-slate-400'
}

export function sinalVariacao(variacao: number): string {
  if (variacao > 0) return '▲'
  if (variacao < 0) return '▼'
  return '—'
}

const MESES_PT_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Converts a machine period key ("2026-05") into a short display label ("Mai/2026").
export function formatarPeriodoCurto(periodo: string): string {
  const match = periodo.match(/^(\d{4})-(\d{2})$/)
  if (!match) return periodo
  const [, ano, mesStr] = match
  const mes = MESES_PT_CURTO[parseInt(mesStr, 10) - 1] ?? mesStr
  return `${mes}/${ano}`
}

// Converts an ISO timestamp into "DD/MM/AAAA" for display in tables.
export function formatData(isoString: string): string {
  const data = new Date(isoString)
  if (Number.isNaN(data.getTime())) return isoString
  return data.toLocaleDateString('pt-BR')
}

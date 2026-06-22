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

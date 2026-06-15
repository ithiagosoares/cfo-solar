'use client'

import type { LucideIcon } from 'lucide-react'
import { cn, formatMoeda, formatPercentual, classeVariacao, sinalVariacao } from '@/lib/utils'

interface KPICardProps {
  titulo: string
  valor: number
  formato?: 'moeda' | 'percentual' | 'numero' | 'moeda-compacta'
  variacao?: number
  Icon: LucideIcon
  cor?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'
  descricao?: string
  valorFormatado?: string
}

const CORES: Record<NonNullable<KPICardProps['cor']>, string> = {
  blue:   'text-blue-400 bg-blue-500/10',
  green:  'text-emerald-400 bg-emerald-500/10',
  red:    'text-red-400 bg-red-500/10',
  yellow: 'text-amber-400 bg-amber-500/10',
  purple: 'text-purple-400 bg-purple-500/10',
  orange: 'text-orange-400 bg-orange-500/10',
}

function formatar(valor: number, formato: KPICardProps['formato']): string {
  switch (formato) {
    case 'moeda':          return formatMoeda(valor)
    case 'moeda-compacta': return formatMoeda(valor)
    case 'percentual':     return formatPercentual(valor)
    case 'numero':         return valor.toLocaleString('pt-BR')
    default:               return String(valor)
  }
}

export function KPICard({
  titulo,
  valor,
  formato = 'moeda',
  variacao,
  Icon,
  cor = 'blue',
  descricao,
  valorFormatado,
}: KPICardProps) {
  return (
    <div
      className="rounded-xl border p-5 transition-all duration-200 hover:border-blue-500/40 animate-fadeIn"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
            {titulo}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight truncate" style={{ color: '#e2e8f0' }}>
            {valorFormatado ?? formatar(valor, formato)}
          </p>
          {variacao !== undefined && (
            <p className={cn('mt-1 text-xs font-medium', classeVariacao(variacao))}>
              {sinalVariacao(variacao)} {Math.abs(variacao).toFixed(1)}% vs mês anterior
            </p>
          )}
          {descricao && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: '#64748b' }}>
              {descricao}
            </p>
          )}
        </div>
        <div className={cn('shrink-0 rounded-lg p-2.5', CORES[cor])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

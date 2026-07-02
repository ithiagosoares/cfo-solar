'use client'

import type { LucideIcon } from 'lucide-react'
import { formatMoeda, formatPercentual } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

interface KPICardProps {
  titulo: string
  valor: number
  formato?: 'moeda' | 'percentual' | 'numero' | 'moeda-compacta'
  variacao?: number
  // Mantido opcional só por compatibilidade com chamadas existentes — o
  // layout editorial de KPI (ponto/ícone removido) não renderiza ícone.
  Icon?: LucideIcon
  cor?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'
  descricao?: string
  valorFormatado?: string
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

function classeVariacao(variacao: number): string {
  if (variacao > 0) return styles.variacaoUp
  if (variacao < 0) return styles.variacaoDown
  return styles.variacaoFlat
}

function sinalVariacao(variacao: number): string {
  if (variacao > 0) return '▲'
  if (variacao < 0) return '▼'
  return '—'
}

export function KPICard({
  titulo,
  valor,
  formato = 'moeda',
  variacao,
  cor,
  descricao,
  valorFormatado,
}: KPICardProps) {
  return (
    <div className={styles.kpi}>
      <p className={styles.kl}>{titulo}</p>
      <p className={`${styles.kv} ${styles.serif} ${styles.num}`} style={cor === 'red' ? { color: 'var(--critico)' } : undefined}>
        {valorFormatado ?? formatar(valor, formato)}
      </p>
      {variacao !== undefined && (
        <p className={`${styles.variacao} ${classeVariacao(variacao)}`} style={{ marginTop: 8 }}>
          {sinalVariacao(variacao)} {Math.abs(variacao).toFixed(1)}% vs mês anterior
        </p>
      )}
      {descricao && <p className={styles.kd}>{descricao}</p>}
    </div>
  )
}

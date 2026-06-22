'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { EmpresaAnalise } from '@/types/financeiro'
import { formatMoeda, formatMargem } from '@/lib/utils'

const COR_EMPRESA: Record<string, string> = {
  'Solar System Matriz':    '#3b82f6',
  'Solar System Filial PR': '#8b5cf6',
  'Level2':                 '#22c55e',
  'Ni Hao':                 '#f59e0b',
  'AluMarket':              '#ef4444',
}

function corEmpresa(nome: string): string {
  if (COR_EMPRESA[nome]) return COR_EMPRESA[nome]
  // Fallback via fuzzy match
  const n = nome.toUpperCase()
  if (n.includes('MATRIZ')) return '#3b82f6'
  if (n.includes('FILIAL')) return '#8b5cf6'
  if (n.includes('LEVEL'))  return '#22c55e'
  if (n.includes('NI HAO') || n.includes('NIHAO')) return '#f59e0b'
  if (n.includes('ALU'))    return '#ef4444'
  return '#64748b'
}

export function EmpresaCard({ empresa }: { empresa: EmpresaAnalise }) {
  const cor = corEmpresa(empresa.nome)
  const margem = empresa.entradas > 0
    ? ((empresa.entradas - empresa.saidas) / empresa.entradas) * 100
    : 0
  const percentualSaldo = empresa.entradas > 0
    ? (empresa.saldo / empresa.entradas) * 100
    : 0

  const Icone = empresa.saldo > 0 ? TrendingUp : empresa.saldo < 0 ? TrendingDown : Minus
  const corSaldo = empresa.saldo > 0 ? '#22c55e' : empresa.saldo < 0 ? '#ef4444' : '#64748b'

  return (
    <div
      className="rounded-xl border p-5 transition-all duration-200 hover:border-blue-500/30 animate-fadeIn"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <span
            className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: `${cor}20`, color: cor }}
          >
            {empresa.nome.split(' ').slice(-1)[0]}
          </span>
          <h3 className="mt-2 font-semibold leading-tight" style={{ color: '#e2e8f0' }}>
            {empresa.nome}
          </h3>
        </div>
        <Icone className="h-5 w-5 shrink-0 mt-1" style={{ color: corSaldo }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Entradas</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: '#22c55e' }}>
            {formatMoeda(empresa.entradas)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Saídas</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: '#ef4444' }}>
            {formatMoeda(empresa.saidas)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Saldo</p>
          <p className="text-base font-bold tabular-nums" style={{ color: corSaldo }}>
            {formatMoeda(empresa.saldo)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Margem</p>
          <p className="text-sm font-semibold" style={{ color: margem >= 15 ? '#22c55e' : margem >= 5 ? '#f59e0b' : '#ef4444' }}>
            {formatMargem(margem)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1" style={{ color: '#64748b' }}>
          <span>Saldo/Entradas</span>
          <span>{formatMargem(percentualSaldo)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#2d3148' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(Math.abs(percentualSaldo), 100)}%`,
              background: empresa.saldo >= 0 ? cor : '#ef4444',
            }}
          />
        </div>
      </div>
    </div>
  )
}

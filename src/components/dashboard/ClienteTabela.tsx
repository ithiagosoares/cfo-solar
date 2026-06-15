'use client'

import type { ClientePrincipal } from '@/types/financeiro'
import { formatMoeda, formatPercentual } from '@/lib/utils'

interface ClienteTabelaProps {
  clientes: ClientePrincipal[]
}

const BADGE_CORES = [
  'bg-blue-500/15 text-blue-300',
  'bg-purple-500/15 text-purple-300',
  'bg-emerald-500/15 text-emerald-300',
  'bg-amber-500/15 text-amber-300',
  'bg-rose-500/15 text-rose-300',
]

function badgeCor(empresa: string): string {
  let hash = 0
  for (let i = 0; i < empresa.length; i++) hash = empresa.charCodeAt(i) + hash * 31
  return BADGE_CORES[Math.abs(hash) % BADGE_CORES.length]
}

export function ClienteTabela({ clientes }: ClienteTabelaProps) {
  if (clientes.length === 0) {
    return (
      <div
        className="rounded-xl border p-6 text-center animate-fadeIn"
        style={{ background: '#1a1d27', borderColor: '#2d3148' }}
      >
        <p className="text-sm" style={{ color: '#64748b' }}>Nenhum cliente identificado</p>
      </div>
    )
  }

  const maxValor = clientes[0]?.valor ?? 1

  return (
    <div
      className="rounded-xl border animate-fadeIn overflow-hidden"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: '#2d3148' }}>
        <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
          Carteira de Clientes
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3148' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Cliente</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Valor</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Part.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Empresa</th>
              <th className="px-4 py-3 w-32 text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: i < clientes.length - 1 ? '1px solid #1e2130' : 'none' }}
              >
                <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748b' }}>
                  {String(i + 1).padStart(2, '0')}
                </td>
                <td className="px-4 py-3 font-medium max-w-[200px] truncate" style={{ color: '#e2e8f0' }}>
                  {cliente.nome}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: '#e2e8f0' }}>
                  {formatMoeda(cliente.valor)}
                </td>
                <td className="px-4 py-3 text-right font-medium" style={{ color: cliente.percentual > 30 ? '#f59e0b' : '#94a3b8' }}>
                  {formatPercentual(cliente.percentual)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${badgeCor(cliente.empresa)}`}>
                    {cliente.empresa}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#2d3148' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(cliente.valor / maxValor) * 100}%`,
                        background: i === 0 ? '#3b82f6' : '#4b5563',
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

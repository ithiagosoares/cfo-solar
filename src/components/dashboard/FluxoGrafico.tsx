'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { EmpresaAnalise } from '@/types/financeiro'
import { formatMoedaCompacta } from '@/lib/utils'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border p-3 shadow-xl text-sm"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <p className="font-semibold mb-2" style={{ color: '#e2e8f0' }}>{label}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatMoedaCompacta(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function FluxoGrafico({ empresas }: { empresas: EmpresaAnalise[] }) {
  const data = empresas.map(e => ({
    nome: e.nome.split(' ').slice(-1)[0],
    nomeCompleto: e.nome,
    Entradas: e.entradas,
    Saídas: e.saidas,
    Saldo: e.saldo,
  }))

  if (data.every(d => d.Entradas === 0 && d.Saídas === 0)) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
        <p className="text-sm" style={{ color: '#64748b' }}>Sem dados de fluxo para exibir</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border p-5 animate-fadeIn"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
        Fluxo por Empresa
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" vertical={false} />
          <XAxis
            dataKey="nome"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#2d3148' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatMoedaCompacta}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }}
            iconType="square"
          />
          <Bar dataKey="Entradas" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="Saídas"   fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="Saldo"    fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

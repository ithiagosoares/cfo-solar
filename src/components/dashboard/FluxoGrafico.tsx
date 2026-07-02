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
import { formatMoedaCompacta, formatMoeda } from '@/lib/utils'
import { CORES } from '@/lib/tema'
import styles from '@/styles/editorial.module.css'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: CORES.bg, border: `1px solid ${CORES.line2}`, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: CORES.ink }}>{label}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.name}: {formatMoeda(entry.value)}
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
      <div style={{ padding: '60px 0', textAlign: 'center', color: CORES.ink3, fontSize: 13 }}>
        Sem dados de fluxo para exibir
      </div>
    )
  }

  return (
    <div>
      <div className={styles.shead} style={{ marginBottom: 24 }}>
        <div className={`${styles.stitle} ${styles.serif}`}>Fluxo por Empresa</div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="1 4" stroke={CORES.line} vertical={false} />
          <XAxis dataKey="nome" tick={{ fill: CORES.ink3, fontSize: 11 }} axisLine={{ stroke: CORES.line }} tickLine={false} />
          <YAxis tickFormatter={formatMoedaCompacta} tick={{ fill: CORES.ink3, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: CORES.paper }} />
          <Legend wrapperStyle={{ fontSize: 12, color: CORES.ink2 }} iconType="square" />
          <Bar dataKey="Entradas" fill={CORES.marca}    radius={[0, 0, 0, 0]} maxBarSize={32} />
          <Bar dataKey="Saídas"   fill={CORES.line2}    radius={[0, 0, 0, 0]} maxBarSize={32} />
          <Bar dataKey="Saldo"    fill={CORES.destaque} radius={[0, 0, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

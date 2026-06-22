'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import type { CategoriaDespesa, EmpresaAnalise, GrupoCusto } from '@/types/financeiro'
import { formatMoeda, formatMoedaCompacta, formatPercentual } from '@/lib/utils'

const COR_GRUPO: Record<GrupoCusto, string> = {
  fixo: '#f59e0b',
  variavel: '#3b82f6',
  outro: '#64748b',
}

const LABEL_GRUPO: Record<GrupoCusto, string> = {
  fixo: 'Custo fixo',
  variavel: 'Custo variável',
  outro: 'Outros',
}

interface TooltipPayload {
  active?: boolean
  payload?: Array<{ payload: CategoriaDespesa }>
}

function CustomTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border p-3 shadow-xl text-sm" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
      <p className="font-semibold mb-1" style={{ color: '#e2e8f0' }}>{item.categoria}</p>
      <p style={{ color: COR_GRUPO[item.grupo] }}>{formatMoeda(item.valor)}</p>
      <p className="text-xs mt-1" style={{ color: '#64748b' }}>
        {formatPercentual(item.percentualDoTotal)} · {LABEL_GRUPO[item.grupo]}
      </p>
    </div>
  )
}

function LegendaGrupos() {
  return (
    <div className="flex flex-wrap gap-4 mt-3">
      {(Object.keys(LABEL_GRUPO) as GrupoCusto[]).map(grupo => (
        <div key={grupo} className="flex items-center gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_GRUPO[grupo] }} />
          {LABEL_GRUPO[grupo]}
        </div>
      ))}
    </div>
  )
}

interface ResumoCustosBarraProps {
  custosFixos: number
  custosVariaveis: number
  outros: number
}

function ResumoCustosBarra({ custosFixos, custosVariaveis, outros }: ResumoCustosBarraProps) {
  const total = custosFixos + custosVariaveis + outros
  if (total === 0) return null

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[
        { label: 'Custos Fixos', valor: custosFixos, cor: COR_GRUPO.fixo },
        { label: 'Custos Variáveis', valor: custosVariaveis, cor: COR_GRUPO.variavel },
        { label: 'Outros', valor: outros, cor: COR_GRUPO.outro },
      ].map(item => (
        <div key={item.label} className="rounded-lg border px-3 py-2.5" style={{ background: '#161925', borderColor: '#2d3148' }}>
          <p className="text-xs" style={{ color: '#64748b' }}>{item.label}</p>
          <p className="text-sm font-bold mt-0.5 tabular-nums" style={{ color: item.cor }}>
            {formatMoeda(item.valor)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            {formatPercentual(total > 0 ? (item.valor / total) * 100 : 0)}
          </p>
        </div>
      ))}
    </div>
  )
}

interface DespesasPorCategoriaProps {
  despesasGrupo: CategoriaDespesa[]
  resumoCustosGrupo: ResumoCustosBarraProps
  empresas: EmpresaAnalise[]
}

export function DespesasPorCategoria({ despesasGrupo, resumoCustosGrupo, empresas }: DespesasPorCategoriaProps) {
  const [filtro, setFiltro] = useState<string>('grupo')

  const empresaSelecionada = filtro !== 'grupo' ? empresas.find(e => e.nome === filtro) ?? null : null
  const semCategorizacao = empresaSelecionada !== null && !empresaSelecionada.categorizacaoDisponivel

  const dadosAtivos = empresaSelecionada ? empresaSelecionada.despesasPorCategoria : despesasGrupo
  const resumoAtivo = empresaSelecionada ? empresaSelecionada.resumoCustos : resumoCustosGrupo
  const top10 = dadosAtivos.slice(0, 10)

  const tituloChart = empresaSelecionada ? empresaSelecionada.nome : 'Grupo (todas as empresas)'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltro('grupo')}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: filtro === 'grupo' ? '#3b82f6' : '#1a1d27',
            color: filtro === 'grupo' ? '#fff' : '#94a3b8',
            border: filtro === 'grupo' ? 'none' : '1px solid #2d3148',
          }}
        >
          Grupo (todas)
        </button>
        {empresas.map(e => (
          <button
            key={e.nome}
            onClick={() => setFiltro(e.nome)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: filtro === e.nome ? '#3b82f6' : '#1a1d27',
              color: filtro === e.nome ? '#fff' : '#94a3b8',
              border: filtro === e.nome ? 'none' : '1px solid #2d3148',
            }}
          >
            {e.nome}
          </button>
        ))}
      </div>

      {semCategorizacao ? (
        <div className="rounded-xl border p-8 text-center animate-fadeIn" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#e2e8f0' }}>
            Total de despesas — {empresaSelecionada!.nome}
          </p>
          <p className="text-2xl font-bold tabular-nums mb-3" style={{ color: '#ef4444' }}>
            {formatMoeda(empresaSelecionada!.saidas)}
          </p>
          <p
            className="inline-block rounded-full px-3 py-1 text-xs"
            style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}
          >
            Categorização não disponível para este canal
          </p>
        </div>
      ) : top10.length === 0 ? (
        <div className="rounded-xl border p-8 text-center animate-fadeIn" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
          <p className="text-sm" style={{ color: '#64748b' }}>Sem despesas categorizadas para exibir.</p>
        </div>
      ) : (
        <div className="rounded-xl border p-5 animate-fadeIn" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
            Top {top10.length} Categorias de Despesa
          </h3>
          <p className="text-xs mb-4" style={{ color: '#4b5563' }}>{tituloChart}</p>

          <ResumoCustosBarra {...resumoAtivo} />

          <ResponsiveContainer width="100%" height={Math.max(280, top10.length * 36)}>
            <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={formatMoedaCompacta}
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="categoria"
                width={150}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#2d3148' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {top10.map((entry, i) => (
                  <Cell key={i} fill={COR_GRUPO[entry.grupo]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <LegendaGrupos />
        </div>
      )}
    </div>
  )
}

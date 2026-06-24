'use client'

import { useEffect, useState } from 'react'
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
import { ArrowUp, ArrowDown, Minus, GitCompare, Sparkles, AlertTriangle } from 'lucide-react'
import type { ComparativoResponse, PeriodoResumo } from '@/types/financeiro'
import { formatMoeda, formatMoedaCompacta, formatPercentual, formatarPeriodoCurto, calcularVariacao } from '@/lib/utils'
import { FGI_FIXO } from '@/lib/constantes'

// ─── KPI comparison card ────────────────────────────────────────────────────────

function corVariacao(variacaoPercentual: number, inverterLogica: boolean): string {
  if (variacaoPercentual === 0) return '#64748b'
  const melhora = inverterLogica ? variacaoPercentual < 0 : variacaoPercentual > 0
  return melhora ? '#22c55e' : '#ef4444'
}

function KpiComparativoCard({
  titulo,
  valorA,
  valorB,
  variacaoPercentual,
  inverterLogica = false,
  formato = 'moeda',
}: {
  titulo: string
  valorA: number
  valorB: number
  variacaoPercentual: number
  inverterLogica?: boolean
  formato?: 'moeda' | 'percentual'
}) {
  const cor = corVariacao(variacaoPercentual, inverterLogica)
  const formatar = formato === 'percentual' ? (v: number) => formatPercentual(v) : formatMoeda
  const Seta = variacaoPercentual > 0 ? ArrowUp : variacaoPercentual < 0 ? ArrowDown : Minus

  return (
    <div className="rounded-xl border p-4 animate-fadeIn" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>{titulo}</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs mb-0.5" style={{ color: '#4b5563' }}>A</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: '#94a3b8' }}>{formatar(valorA)}</p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: '#4b5563' }}>B</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: '#e2e8f0' }}>{formatar(valorB)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-2.5 border-t" style={{ borderColor: '#2d3148' }}>
        <Seta className="h-3.5 w-3.5" style={{ color: cor }} />
        <span className="text-sm font-bold tabular-nums" style={{ color: cor }}>
          {formatPercentual(Math.abs(variacaoPercentual))}
        </span>
        <span className="text-xs" style={{ color: '#64748b' }}>de A para B</span>
      </div>
    </div>
  )
}

// ─── Grouped bar chart: entradas by empresa, A vs B ─────────────────────────────

function GraficoEntradasComparativo({
  variacoes,
  labelA,
  labelB,
}: {
  variacoes: ComparativoResponse['variacoes']['empresas']
  labelA: string
  labelB: string
}) {
  const dados = variacoes.map(v => ({ nome: v.nome, A: v.entradas.valorA, B: v.entradas.valorB }))

  return (
    <div className="rounded-xl border p-5 animate-fadeIn" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
        Entradas por Empresa — {labelA} vs {labelB}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={dados} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" vertical={false} />
          <XAxis dataKey="nome" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#2d3148' }} tickLine={false} />
          <YAxis tickFormatter={formatMoedaCompacta} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => formatMoeda(Number(value))}
            contentStyle={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            cursor={{ fill: 'rgba(59,130,246,0.06)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          <Bar dataKey="A" name={labelA} fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="B" name={labelB} fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────────

export function ComparativoView() {
  const [historico, setHistorico] = useState<PeriodoResumo[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [periodoA, setPeriodoA] = useState('')
  const [periodoB, setPeriodoB] = useState('')
  const [dados, setDados] = useState<ComparativoResponse | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [insight, setInsight] = useState('')
  const [carregandoInsight, setCarregandoInsight] = useState(false)

  useEffect(() => {
    fetch('/api/historico')
      .then(res => res.json())
      .then(json => {
        const lista: PeriodoResumo[] = Array.isArray(json.relatorios) ? json.relatorios : []
        setHistorico(lista)
        if (lista.length >= 2) {
          setPeriodoB(lista[0].periodo)
          setPeriodoA(lista[1].periodo)
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoHistorico(false))
  }, [])

  const selecaoValida = Boolean(periodoA) && Boolean(periodoB) && periodoA !== periodoB

  useEffect(() => {
    if (!selecaoValida) return

    let cancelado = false

    async function carregarComparativo() {
      setCarregando(true)
      setErro(null)
      try {
        const res = await fetch(`/api/comparativo?periodoA=${periodoA}&periodoB=${periodoB}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Erro ao comparar períodos')
        if (cancelado) return
        setInsight('')
        setDados(json as ComparativoResponse)
        gerarInsight(json as ComparativoResponse, () => cancelado)
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao comparar períodos')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregarComparativo()
    return () => { cancelado = true }
  }, [periodoA, periodoB, selecaoValida])

  async function gerarInsight(comp: ComparativoResponse, isCancelado: () => boolean) {
    setCarregandoInsight(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relatorio: comp.relatorioA,
          mensagens: [{
            role: 'user',
            content: `Compare os dados do período ${comp.relatorioB.periodo} com o período ${comp.relatorioA.periodo} (que está no contexto do sistema) e destaque a mudança mais relevante em até 2 frases.\n\nDADOS COMPLETOS DO PERÍODO ${comp.relatorioB.periodo} (para comparação):\n${JSON.stringify(comp.relatorioB, null, 2)}`,
          }],
        }),
      })
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Erro ao gerar insight')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (isCancelado()) return
        acumulado += decoder.decode(value, { stream: true })
        setInsight(acumulado)
      }
    } catch (e) {
      if (!isCancelado()) setInsight(e instanceof Error ? `Não foi possível gerar o insight: ${e.message}` : 'Não foi possível gerar o insight automático.')
    } finally {
      if (!isCancelado()) setCarregandoInsight(false)
    }
  }

  if (carregandoHistorico) {
    return <div className="py-24 text-center text-sm" style={{ color: '#64748b' }}>Carregando histórico…</div>
  }

  if (historico.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center animate-fadeIn">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(59,130,246,0.1)' }}>
          <GitCompare className="h-7 w-7" style={{ color: '#3b82f6' }} />
        </div>
        <p className="font-semibold max-w-sm" style={{ color: '#e2e8f0' }}>
          Envie pelo menos 2 meses diferentes para habilitar o comparativo
        </p>
      </div>
    )
  }

  const labelA = dados ? dados.relatorioA.periodo : formatarPeriodoCurto(periodoA)
  const labelB = dados ? dados.relatorioB.periodo : formatarPeriodoCurto(periodoB)
  const comprometimentoFGI = (vendido: number): number => vendido > 0 ? (FGI_FIXO.total / vendido) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: '#94a3b8' }}>Período A</label>
          <select
            value={periodoA}
            onChange={e => setPeriodoA(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#2d3148', color: '#e2e8f0', background: '#161925' }}
          >
            {historico.map(h => (
              <option key={h.periodo} value={h.periodo}>{formatarPeriodoCurto(h.periodo)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: '#94a3b8' }}>Período B</label>
          <select
            value={periodoB}
            onChange={e => setPeriodoB(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#2d3148', color: '#e2e8f0', background: '#161925' }}
          >
            {historico.map(h => (
              <option key={h.periodo} value={h.periodo}>{formatarPeriodoCurto(h.periodo)}</option>
            ))}
          </select>
        </div>
      </div>

      {periodoA === periodoB && (
        <div
          className="flex items-center gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm"
          style={{ background: 'rgba(245,158,11,0.08)', borderLeftColor: '#f59e0b', border: '1px solid rgba(120,80,10,0.4)', borderLeftWidth: 4 }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} />
          <span style={{ color: '#fcd34d' }}>Escolha dois períodos diferentes para comparar.</span>
        </div>
      )}

      {erro && (
        <div
          className="flex items-center gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', borderLeftColor: '#ef4444', border: '1px solid rgba(127,29,29,0.4)', borderLeftWidth: 4 }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />
          <span style={{ color: '#fca5a5' }}>{erro}</span>
        </div>
      )}

      {carregando && (
        <div className="py-12 text-center text-sm" style={{ color: '#64748b' }}>Comparando períodos…</div>
      )}

      {dados && selecaoValida && !carregando && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <KpiComparativoCard titulo="Saldo do Grupo" {...dados.variacoes.saldoGrupo} />
            <KpiComparativoCard titulo="Faturamento Vendido" {...dados.variacoes.faturamentoVendido} />
            <KpiComparativoCard titulo="Faturamento Faturado" {...dados.variacoes.faturamentoFaturado} />
            <KpiComparativoCard titulo="Total Entradas" {...dados.variacoes.totalEntradas} />
            <KpiComparativoCard titulo="Total Saídas" {...dados.variacoes.totalSaidas} inverterLogica />
            <KpiComparativoCard
              titulo="Comprometimento FGI"
              valorA={comprometimentoFGI(dados.variacoes.faturamentoVendido.valorA)}
              valorB={comprometimentoFGI(dados.variacoes.faturamentoVendido.valorB)}
              variacaoPercentual={calcularVariacao(
                comprometimentoFGI(dados.variacoes.faturamentoVendido.valorB),
                comprometimentoFGI(dados.variacoes.faturamentoVendido.valorA),
              )}
              formato="percentual"
              inverterLogica
            />
          </div>

          <GraficoEntradasComparativo variacoes={dados.variacoes.empresas} labelA={labelA} labelB={labelB} />

          <div className="rounded-xl border p-5 animate-fadeIn" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: '#22c55e' }} />
              <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
                Insight Automático
              </h3>
            </div>
            {carregandoInsight && !insight ? (
              <p className="text-sm" style={{ color: '#64748b' }}>Gerando insight…</p>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#cbd5e1' }}>{insight}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

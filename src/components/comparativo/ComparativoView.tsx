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
import { ArrowUp, ArrowDown, Minus, GitCompare, AlertTriangle } from 'lucide-react'
import type { ComparativoResponse, PeriodoResumo } from '@/types/financeiro'
import { formatMoeda, formatMoedaCompacta, formatPercentual, formatarPeriodoCurto, calcularVariacao } from '@/lib/utils'
import { FGI_FIXO } from '@/lib/constantes'
import { CORES } from '@/lib/tema'
import styles from '@/styles/editorial.module.css'

// ─── KPI comparison card ────────────────────────────────────────────────────────

function corVariacao(variacaoPercentual: number, inverterLogica: boolean): string {
  if (variacaoPercentual === 0) return CORES.ink3
  const melhora = inverterLogica ? variacaoPercentual < 0 : variacaoPercentual > 0
  return melhora ? CORES.positivo : CORES.critico
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
    <div className={styles.kpi}>
      <p className={styles.kl}>{titulo}</p>
      <div className="grid grid-cols-2 gap-3 mt-3 mb-3">
        <div>
          <p className={styles.over} style={{ marginBottom: 3 }}>A</p>
          <p className={`${styles.num}`} style={{ fontSize: 14, fontWeight: 600, color: CORES.ink2 }}>{formatar(valorA)}</p>
        </div>
        <div>
          <p className={styles.over} style={{ marginBottom: 3 }}>B</p>
          <p className={`${styles.num}`} style={{ fontSize: 14, fontWeight: 600 }}>{formatar(valorB)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5" style={{ paddingTop: 10, borderTop: `1px solid var(--line)` }}>
        <Seta className="h-3 w-3" style={{ color: cor }} />
        <span className={`${styles.num} ${styles.variacao}`} style={{ color: cor }}>
          {formatPercentual(Math.abs(variacaoPercentual))}
        </span>
        <span style={{ fontSize: 11, color: CORES.ink3 }}>de A para B</span>
      </div>
    </div>
  )
}

// ─── Grouped bar chart ──────────────────────────────────────────────────────────

function GraficoEntradasComparativo({
  variacoes,
  labelA,
  labelB,
}: {
  variacoes: ComparativoResponse['variacoes']['empresas']
  labelA: string
  labelB: string
}) {
  const dados = variacoes.map(v => ({ nome: v.nome.split(' ').pop(), A: v.entradas.valorA, B: v.entradas.valorB }))

  return (
    <div>
      <div className={styles.shead} style={{ marginBottom: 20 }}>
        <div className={`${styles.stitle} ${styles.serif}`}>Entradas por Empresa</div>
        <div className={styles.over}>{labelA} vs {labelB}</div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={dados} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="1 4" stroke={CORES.line} vertical={false} />
          <XAxis dataKey="nome" tick={{ fill: CORES.ink3, fontSize: 11 }} axisLine={{ stroke: CORES.line }} tickLine={false} />
          <YAxis tickFormatter={formatMoedaCompacta} tick={{ fill: CORES.ink3, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => formatMoeda(Number(value))}
            contentStyle={{ background: CORES.bg, border: `1px solid ${CORES.line2}` }}
            labelStyle={{ color: CORES.ink, fontWeight: 600 }}
            cursor={{ fill: CORES.paper }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CORES.ink2 }} />
          <Bar dataKey="A" name={labelA} fill={CORES.line2}  radius={[0, 0, 0, 0]} maxBarSize={28} />
          <Bar dataKey="B" name={labelB} fill={CORES.marca}  radius={[0, 0, 0, 0]} maxBarSize={28} />
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
    return <div className="py-24 text-center" style={{ fontSize: 13, color: CORES.ink3 }}>Carregando histórico…</div>
  }

  if (historico.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center animate-fadeIn">
        <GitCompare className="h-7 w-7" style={{ color: CORES.ink3 }} />
        <p style={{ fontWeight: 600, maxWidth: 360, lineHeight: 1.5 }}>
          Envie pelo menos 2 meses diferentes para habilitar o comparativo
        </p>
      </div>
    )
  }

  const labelA = dados ? dados.relatorioA.periodo : formatarPeriodoCurto(periodoA)
  const labelB = dados ? dados.relatorioB.periodo : formatarPeriodoCurto(periodoB)
  const comprometimentoFGI = (vendido: number): number => vendido > 0 ? (FGI_FIXO.total / vendido) * 100 : 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className={styles.shead} style={{ marginBottom: 16 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Comparativo de Períodos</div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Período A</label>
            <select value={periodoA} onChange={e => setPeriodoA(e.target.value)} className={styles.select}>
              {historico.map(h => (
                <option key={h.periodo} value={h.periodo}>{formatarPeriodoCurto(h.periodo)}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Período B</label>
            <select value={periodoB} onChange={e => setPeriodoB(e.target.value)} className={styles.select}>
              {historico.map(h => (
                <option key={h.periodo} value={h.periodo}>{formatarPeriodoCurto(h.periodo)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {periodoA === periodoB && (
        <div className={`${styles.notice} ${styles.alertaDanger}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Escolha dois períodos diferentes para comparar.</span>
        </div>
      )}

      {erro && (
        <div className={`${styles.notice} ${styles.alertaDanger}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{erro}</span>
        </div>
      )}

      {carregando && (
        <div className="py-12 text-center" style={{ fontSize: 13, color: CORES.ink3 }}>Comparando períodos…</div>
      )}

      {dados && selecaoValida && !carregando && (
        <>
          <div className={styles.kpis} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <KpiComparativoCard titulo="Saldo do Grupo" {...dados.variacoes.saldoGrupo} />
            <KpiComparativoCard titulo="Faturamento Vendido" {...dados.variacoes.faturamentoVendido} />
            <KpiComparativoCard titulo="Faturamento Faturado" {...dados.variacoes.faturamentoFaturado} />
          </div>
          <div className={styles.kpis} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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

          <div>
            <div className={styles.shead} style={{ marginBottom: 12 }}>
              <div className={`${styles.stitle} ${styles.serif}`}>Insight Automático</div>
            </div>
            {carregandoInsight && !insight ? (
              <p style={{ fontSize: 13, color: CORES.ink3 }}>Gerando insight…</p>
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.75, color: CORES.ink2, whiteSpace: 'pre-wrap' }}>{insight}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

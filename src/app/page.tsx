'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload,
  BarChart2,
  Users,
  FileText,
  Building2,
  TrendingUp,
  Target,
  DollarSign,
  AlertTriangle,
  Download,
  RefreshCw,
  Sun,
  ChevronRight,
  Briefcase,
} from 'lucide-react'
import { parsearExcel, FGI_FIXO, META_MENSAL } from '@/lib/excel-parser'
import { gerarPDF } from '@/lib/pdf-generator'
import { KPICard } from '@/components/dashboard/KPICard'
import { FluxoGrafico } from '@/components/dashboard/FluxoGrafico'
import { AlertasPanel } from '@/components/dashboard/AlertasPanel'
import { ClienteTabela } from '@/components/dashboard/ClienteTabela'
import { EmpresaCard } from '@/components/dashboard/EmpresaCard'
import { RelatorioView } from '@/components/relatorio/RelatorioView'
import type { DadosConsolidados, RelatorioIA } from '@/types/financeiro'
import { formatMoeda, formatPercentual } from '@/lib/utils'

type Aba = 'dashboard' | 'empresas' | 'clientes' | 'relatorio'

const ABAS: { id: Aba; label: string; Icon: typeof BarChart2 }[] = [
  { id: 'dashboard', label: 'Dashboard',    Icon: BarChart2 },
  { id: 'empresas',  label: 'Empresas',     Icon: Building2 },
  { id: 'clientes',  label: 'Clientes',     Icon: Users     },
  { id: 'relatorio', label: 'Relatório IA', Icon: FileText  },
]

// ─── Upload Screen ─────────────────────────────────────────────────────────────

function TelaUpload({
  onUpload,
  loading,
  erro,
}: {
  onUpload: (file: File) => void
  loading: boolean
  erro: string | null
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0f1117' }}>
      <div className="flex items-center gap-3 mb-10">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: 'rgba(59,130,246,0.15)' }}
        >
          <Sun className="h-6 w-6" style={{ color: '#3b82f6' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#e2e8f0' }}>CFO Solar</h1>
          <p className="text-xs" style={{ color: '#64748b' }}>Grupo Solar System</p>
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => ref.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed p-14 text-center transition-all duration-200 w-full max-w-lg"
        style={{
          borderColor: isDragging ? '#3b82f6' : '#2d3148',
          background: isDragging ? 'rgba(59,130,246,0.06)' : '#1a1d27',
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-10 w-10 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: '#2d3148', borderTopColor: '#3b82f6' }}
            />
            <p className="font-medium" style={{ color: '#e2e8f0' }}>Processando planilha…</p>
          </div>
        ) : (
          <>
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ background: 'rgba(59,130,246,0.1)' }}
            >
              <Upload className="h-6 w-6" style={{ color: '#3b82f6' }} />
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: '#e2e8f0' }}>
              Arraste o arquivo Excel aqui
            </p>
            <p className="text-sm mb-4" style={{ color: '#64748b' }}>
              ou clique para selecionar
            </p>
            <p className="text-xs leading-relaxed" style={{ color: '#4b5563' }}>
              Suporta .xlsx e .xls com as abas:<br />
              MATRIZ MAIO · FILIAL MAIO · LEVEL · NI HAO · ALUMARKET · FECHAMENTO
            </p>
          </>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
      />

      {erro && (
        <div
          className="mt-4 rounded-lg border-l-4 px-4 py-3 w-full max-w-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', borderLeftColor: '#ef4444', border: '1px solid rgba(127,29,29,0.4)', borderLeftWidth: 4 }}
        >
          <span style={{ color: '#fca5a5' }}>{erro}</span>
        </div>
      )}

      <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-lg">
        {[
          { icon: BarChart2, label: 'KPIs Consolidados', desc: '5 empresas em tempo real' },
          { icon: Target,    label: 'Meta R$ 2M',        desc: 'Acompanhamento automático' },
          { icon: FileText,  label: 'Relatório IA',      desc: 'Análise por Claude' },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="rounded-xl border p-4 text-center"
            style={{ background: '#1a1d27', borderColor: '#2d3148' }}
          >
            <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: '#3b82f6' }} />
            <p className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>{label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const pct = Math.min((valor / max) * 100, 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#2d3148' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: cor }}
      />
    </div>
  )
}

// ─── Dashboard View ─────────────────────────────────────────────────────────────

function DashboardView({ dados }: { dados: DadosConsolidados }) {
  const { kpis, empresas, alertas } = dados

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard
          titulo="Saldo Consolidado"
          valor={kpis.saldoConsolidado}
          formato="moeda"
          Icon={DollarSign}
          cor={kpis.saldoConsolidado >= 0 ? 'green' : 'red'}
          variacao={kpis.variacaoSaldo}
        />
        <KPICard
          titulo="Faturamento Total"
          valor={kpis.faturamentoTotal}
          formato="moeda"
          Icon={TrendingUp}
          cor="blue"
          variacao={kpis.variacaoFaturamento}
        />
        <KPICard
          titulo="Margem Bruta"
          valor={kpis.margemBruta}
          formato="percentual"
          Icon={BarChart2}
          cor={kpis.margemBruta >= 20 ? 'green' : kpis.margemBruta >= 10 ? 'yellow' : 'red'}
        />
        <KPICard
          titulo="Comprometimento FGI"
          valor={kpis.comprometimentoFGI}
          formato="percentual"
          Icon={AlertTriangle}
          cor={kpis.comprometimentoFGI <= 20 ? 'green' : kpis.comprometimentoFGI <= 30 ? 'yellow' : 'red'}
          descricao="R$ 46.000/mês fixo"
        />
        <KPICard
          titulo="Meta R$ 2M"
          valor={kpis.progressoMeta}
          formato="percentual"
          Icon={Target}
          cor={kpis.progressoMeta >= 80 ? 'green' : kpis.progressoMeta >= 50 ? 'yellow' : 'red'}
          descricao={`${formatMoeda(kpis.faturamentoTotal)} de ${formatMoeda(META_MENSAL)}`}
        />
      </div>

      {/* Meta progress + FGI breakdown */}
      <div
        className="rounded-xl border px-5 py-4 animate-fadeIn"
        style={{ background: '#1a1d27', borderColor: '#2d3148' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
              Progresso da Meta Mensal
            </p>
            <p className="mt-1 text-lg font-bold" style={{ color: '#e2e8f0' }}>
              {formatMoeda(kpis.faturamentoTotal)}{' '}
              <span className="text-sm font-normal" style={{ color: '#64748b' }}>
                / {formatMoeda(META_MENSAL)}
              </span>
            </p>
          </div>
          <span
            className="text-xl font-bold"
            style={{ color: kpis.progressoMeta >= 80 ? '#22c55e' : kpis.progressoMeta >= 50 ? '#f59e0b' : '#ef4444' }}
          >
            {formatPercentual(kpis.progressoMeta)}
          </span>
        </div>
        <ProgressBar
          valor={kpis.faturamentoTotal}
          max={META_MENSAL}
          cor={kpis.progressoMeta >= 80 ? '#22c55e' : kpis.progressoMeta >= 50 ? '#f59e0b' : '#ef4444'}
        />

        <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-3" style={{ borderColor: '#2d3148' }}>
          {[
            { label: 'Gimenes', valor: FGI_FIXO.gimenes },
            { label: 'Barramares', valor: FGI_FIXO.barramares },
            { label: 'AluMkt/Hera', valor: FGI_FIXO.alumarketHera },
            { label: 'Total FGI', valor: FGI_FIXO.total, destaque: true },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-xs" style={{ color: '#64748b' }}>{item.label}</p>
              <p
                className="text-sm font-bold mt-0.5 tabular-nums"
                style={{ color: item.destaque ? '#3b82f6' : '#94a3b8' }}
              >
                {formatMoeda(item.valor)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FluxoGrafico empresas={empresas} />
        </div>
        <AlertasPanel alertas={alertas} />
      </div>
    </div>
  )
}

// ─── Empresas View ──────────────────────────────────────────────────────────────

function EmpresasView({ dados }: { dados: DadosConsolidados }) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>Empresas do Grupo</h2>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          Performance financeira individual — {dados.periodo}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {dados.empresas.map(empresa => (
          <EmpresaCard key={empresa.codigo} empresa={empresa} />
        ))}
      </div>

      <div
        className="mt-6 rounded-xl border p-5 animate-fadeIn overflow-x-auto"
        style={{ background: '#1a1d27', borderColor: '#2d3148' }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#64748b' }}>
          Visão Consolidada
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3148' }}>
              {['Empresa', 'Receitas', 'Despesas', 'Saldo', 'Margem', 'Transações'].map(h => (
                <th key={h} className="pb-2 pr-6 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.empresas.map(e => {
              const margem = e.receitas > 0 ? ((e.receitas - e.despesas) / e.receitas) * 100 : 0
              return (
                <tr key={e.codigo} style={{ borderBottom: '1px solid #1e2130' }}>
                  <td className="py-2.5 pr-6 font-medium" style={{ color: '#e2e8f0' }}>{e.nome}</td>
                  <td className="py-2.5 pr-6 tabular-nums" style={{ color: '#22c55e' }}>{formatMoeda(e.receitas)}</td>
                  <td className="py-2.5 pr-6 tabular-nums" style={{ color: '#ef4444' }}>{formatMoeda(e.despesas)}</td>
                  <td className="py-2.5 pr-6 tabular-nums font-semibold" style={{ color: e.saldo >= 0 ? '#22c55e' : '#ef4444' }}>
                    {formatMoeda(e.saldo)}
                  </td>
                  <td className="py-2.5 pr-6" style={{ color: margem >= 15 ? '#22c55e' : margem >= 5 ? '#f59e0b' : '#ef4444' }}>
                    {formatPercentual(margem)}
                  </td>
                  <td className="py-2.5 tabular-nums" style={{ color: '#94a3b8' }}>{e.transacoes.length}</td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid #2d3148' }}>
              <td className="pt-3 pr-6 font-bold" style={{ color: '#3b82f6' }}>TOTAL</td>
              <td className="pt-3 pr-6 tabular-nums font-bold" style={{ color: '#22c55e' }}>
                {formatMoeda(dados.kpis.faturamentoTotal)}
              </td>
              <td className="pt-3 pr-6 tabular-nums font-bold" style={{ color: '#ef4444' }}>
                {formatMoeda(dados.empresas.reduce((s, e) => s + e.despesas, 0))}
              </td>
              <td className="pt-3 pr-6 tabular-nums font-bold" style={{ color: dados.kpis.saldoConsolidado >= 0 ? '#22c55e' : '#ef4444' }}>
                {formatMoeda(dados.kpis.saldoConsolidado)}
              </td>
              <td className="pt-3 pr-6 font-bold" style={{ color: dados.kpis.margemBruta >= 15 ? '#22c55e' : '#f59e0b' }}>
                {formatPercentual(dados.kpis.margemBruta)}
              </td>
              <td className="pt-3 tabular-nums font-bold" style={{ color: '#94a3b8' }}>
                {dados.empresas.reduce((s, e) => s + e.transacoes.length, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [dados, setDados] = useState<DadosConsolidados | null>(null)
  const [relatorio, setRelatorio] = useState<RelatorioIA | null>(null)
  const [loading, setLoading] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<Aba>('dashboard')
  const [nomeArquivo, setNomeArquivo] = useState('')

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true)
    setErro(null)
    setRelatorio(null)
    try {
      const buffer = await file.arrayBuffer()
      const resultado = parsearExcel(buffer)
      setDados(resultado)
      setNomeArquivo(file.name)
      setAbaAtiva('dashboard')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar o arquivo Excel.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAnalisar = useCallback(async () => {
    if (!dados) return
    setAnalisando(true)
    setErro(null)
    setAbaAtiva('relatorio')
    try {
      const res = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro na API')
      setRelatorio(json as RelatorioIA)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro na análise com IA.')
      setAbaAtiva('dashboard')
    } finally {
      setAnalisando(false)
    }
  }, [dados])

  const handleExportPDF = useCallback(() => {
    if (dados && relatorio) gerarPDF(dados, relatorio)
  }, [dados, relatorio])

  if (!dados) {
    return <TelaUpload onUpload={handleUpload} loading={loading} erro={erro} />
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f1117' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ background: 'rgba(15,17,23,0.92)', backdropFilter: 'blur(12px)', borderColor: '#2d3148' }}
      >
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5 mr-4">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'rgba(59,130,246,0.15)' }}
            >
              <Sun className="h-4 w-4" style={{ color: '#3b82f6' }} />
            </div>
            <span className="font-bold text-sm hidden sm:block" style={{ color: '#e2e8f0' }}>
              CFO Solar
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Briefcase className="h-3.5 w-3.5 shrink-0" style={{ color: '#64748b' }} />
            <span className="text-xs truncate max-w-[200px]" style={{ color: '#64748b' }}>
              {nomeArquivo}
            </span>
            <ChevronRight className="h-3 w-3 shrink-0" style={{ color: '#4b5563' }} />
            <span className="text-xs font-medium capitalize" style={{ color: '#94a3b8' }}>
              {dados.periodo}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
              />
              <span
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                style={{ borderColor: '#2d3148', color: '#94a3b8' }}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Trocar arquivo</span>
              </span>
            </label>

            <button
              onClick={handleAnalisar}
              disabled={analisando}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-60"
              style={{ background: '#3b82f6', color: '#fff' }}
            >
              {analisando
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : <FileText className="h-3.5 w-3.5" />
              }
              <span className="hidden sm:block">{analisando ? 'Analisando…' : 'Analisar IA'}</span>
            </button>

            {relatorio && (
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ borderColor: '#2d3148', color: '#94a3b8' }}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:block">PDF</span>
              </button>
            )}
          </div>
        </div>

        {erro && (
          <div
            className="border-b px-5 py-2 text-xs"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(127,29,29,0.5)', color: '#fca5a5' }}
          >
            {erro}
          </div>
        )}

        <div className="mx-auto flex max-w-screen-2xl gap-0.5 px-5">
          {ABAS.map(({ id, label, Icon }) => {
            const ativa = abaAtiva === id
            return (
              <button
                key={id}
                onClick={() => setAbaAtiva(id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2"
                style={{
                  color: ativa ? '#3b82f6' : '#64748b',
                  borderBottomColor: ativa ? '#3b82f6' : 'transparent',
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {id === 'relatorio' && relatorio && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#22c55e' }} />
                )}
              </button>
            )
          })}
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-5 py-6">
        {abaAtiva === 'dashboard' && <DashboardView dados={dados} />}
        {abaAtiva === 'empresas'  && <EmpresasView dados={dados} />}
        {abaAtiva === 'clientes'  && <ClienteTabela clientes={dados.clientes} />}
        {abaAtiva === 'relatorio' && (
          <RelatorioView
            relatorio={relatorio}
            analisando={analisando}
            onAnalisar={handleAnalisar}
          />
        )}
      </main>
    </div>
  )
}

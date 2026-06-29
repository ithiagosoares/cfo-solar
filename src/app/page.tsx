'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
  Sun,
  ChevronRight,
  Briefcase,
  CheckCircle,
  FileSpreadsheet,
  PieChart,
  MessageCircle,
  History,
  Calendar,
  GitCompare,
  ShoppingCart,
} from 'lucide-react'
import { gerarPDF } from '@/lib/pdf-generator'
import { NavTabs } from '@/components/layout/NavTabs'
import { KPICard } from '@/components/dashboard/KPICard'
import { FluxoGrafico } from '@/components/dashboard/FluxoGrafico'
import { AlertasPanel } from '@/components/dashboard/AlertasPanel'
import { ClienteTabela } from '@/components/dashboard/ClienteTabela'
import { EmpresaCard } from '@/components/dashboard/EmpresaCard'
import { DespesasPorCategoria } from '@/components/dashboard/DespesasPorCategoria'
import { RelatorioView } from '@/components/relatorio/RelatorioView'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { ComparativoView } from '@/components/comparativo/ComparativoView'
import type { RelatorioCompleto, MensagemChat, PeriodoResumo } from '@/types/financeiro'
import { formatMoeda, formatPercentual, formatMargem, calcularVariacao, formatarPeriodoCurto } from '@/lib/utils'
import { FGI_FIXO, META_MENSAL } from '@/lib/constantes'

type Aba = 'dashboard' | 'empresas' | 'despesas' | 'clientes' | 'comercial' | 'relatorio' | 'comparativo' | 'chat' | 'upload'

const ABAS: { id: Aba; label: string; Icon: typeof BarChart2; href?: string }[] = [
  { id: 'dashboard',    label: 'Dashboard',         Icon: BarChart2 },
  { id: 'empresas',     label: 'Empresas',          Icon: Building2 },
  { id: 'despesas',     label: 'Despesas',          Icon: PieChart  },
  { id: 'clientes',     label: 'Clientes',          Icon: Users     },
  { id: 'comercial',    label: 'Comercial',         Icon: ShoppingCart, href: '/comercial' },
  { id: 'relatorio',    label: 'Relatório IA',      Icon: FileText  },
  { id: 'comparativo',  label: 'Comparativo',       Icon: GitCompare },
  { id: 'chat',         label: 'Chat',              Icon: MessageCircle },
  { id: 'upload',       label: 'Adicionar Arquivo', Icon: Upload    },
]

// ─── Full-screen loading state (initial Supabase check + analyzing) ────────────────

function TelaCarregando({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: '#0f1117' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(59,130,246,0.15)' }}>
          <Sun className="h-5 w-5" style={{ color: '#3b82f6' }} />
        </div>
        <span className="font-bold" style={{ color: '#e2e8f0' }}>CFO Solar</span>
      </div>
      <div
        className="h-14 w-14 rounded-full border-4 border-t-transparent animate-spin"
        style={{
          borderTopColor: '#3b82f6',
          borderRightColor: '#2d3148',
          borderBottomColor: '#2d3148',
          borderLeftColor: '#2d3148',
        }}
      />
      <div className="text-center">
        <p className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>{titulo}</p>
        <p className="mt-1 text-sm" style={{ color: '#64748b' }}>{subtitulo}</p>
      </div>
    </div>
  )
}

// ─── Upload Panel (embedded tab, not full-screen) ──────────────────────────────────

function UploadPanel({
  arquivo,
  erro,
  periodo,
  onPeriodoChange,
  onFileSelect,
  onAnalisar,
}: {
  arquivo: File | null
  erro: string | null
  periodo: string
  onPeriodoChange: (periodo: string) => void
  onFileSelect: (file: File) => void
  onAnalisar: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }

  return (
    <div className="flex flex-col items-center px-4 py-4">
      <div className="mb-6 text-center">
        <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>Adicionar novo relatório</h2>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          Envie a planilha mensal para gerar uma nova análise com IA e salvar no histórico.
        </p>
      </div>

      {arquivo ? (
        /* File selected — show preview + analyze button */
        <div
          className="w-full max-w-lg rounded-2xl border p-10 text-center"
          style={{ background: '#1a1d27', borderColor: '#2d3148' }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ background: 'rgba(34,197,94,0.12)' }}
          >
            <FileSpreadsheet className="h-7 w-7" style={{ color: '#22c55e' }} />
          </div>
          <p className="font-semibold" style={{ color: '#e2e8f0' }}>{arquivo.name}</p>
          <p className="text-xs mt-1 mb-5" style={{ color: '#64748b' }}>
            {(arquivo.size / 1024).toFixed(0)} KB · pronto para análise
          </p>

          <div className="mb-5 text-left">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94a3b8' }}>
              <Calendar className="h-3.5 w-3.5" />
              Período da planilha
            </label>
            <input
              type="month"
              value={periodo}
              onChange={e => onPeriodoChange(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#2d3148', color: '#e2e8f0' }}
            />
          </div>

          <button
            onClick={onAnalisar}
            className="w-full rounded-xl py-3 text-sm font-bold transition-all"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            Analisar com IA
          </button>
          <button
            onClick={() => ref.current?.click()}
            className="mt-3 w-full rounded-xl border py-2.5 text-xs font-medium transition-all"
            style={{ borderColor: '#2d3148', color: '#64748b' }}
          >
            Trocar arquivo
          </button>
        </div>
      ) : (
        /* Empty drop zone */
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
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ background: 'rgba(59,130,246,0.1)' }}
          >
            <Upload className="h-6 w-6" style={{ color: '#3b82f6' }} />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: '#e2e8f0' }}>
            Arraste o arquivo Excel aqui
          </p>
          <p className="text-sm mb-4" style={{ color: '#64748b' }}>ou clique para selecionar</p>
          <p className="text-xs leading-relaxed" style={{ color: '#4b5563' }}>
            Suporta .xlsx e .xls com as abas:<br />
            MATRIZ MAIO · FILIAL MAIO · LEVEL · NI HAO · ALUMARKET · FECHAMENTO
          </p>
        </div>
      )}

      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f) }}
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
          { icon: BarChart2,    label: 'KPIs Consolidados', desc: '5 empresas em tempo real' },
          { icon: Target,       label: 'Meta R$ 2M',        desc: 'Acompanhamento automático' },
          { icon: FileText,     label: 'Análise por IA',    desc: 'Claude lê a planilha direto' },
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

// ─── Empty state for data tabs when nothing is loaded yet ──────────────────────────

function EstadoVazio({ onIrParaUpload }: { onIrParaUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center animate-fadeIn">
      <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(59,130,246,0.1)' }}>
        <FileSpreadsheet className="h-7 w-7" style={{ color: '#3b82f6' }} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: '#e2e8f0' }}>Nenhum relatório carregado ainda</p>
        <p className="mt-1 text-sm" style={{ color: '#64748b' }}>
          Envie uma planilha na aba &quot;Adicionar Arquivo&quot; para começar.
        </p>
      </div>
      <button
        onClick={onIrParaUpload}
        className="rounded-lg px-4 py-2 text-xs font-semibold transition-all"
        style={{ background: '#3b82f6', color: '#fff' }}
      >
        Ir para Adicionar Arquivo
      </button>
    </div>
  )
}

// ─── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const pct = Math.min((valor / max) * 100, 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#2d3148' }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: cor }} />
    </div>
  )
}

// ─── Dashboard View ─────────────────────────────────────────────────────────────

function DashboardView({ relatorio, mesAnterior }: { relatorio: RelatorioCompleto; mesAnterior: PeriodoResumo | null }) {
  const { faturamento, consolidado, empresas, analise, antecipacoes } = relatorio

  const margemLiquida = consolidado.totalEntradas > 0
    ? ((consolidado.totalEntradas - consolidado.totalSaidas) / consolidado.totalEntradas) * 100
    : 0
  const comprometimentoFGI = faturamento.vendido > 0
    ? (FGI_FIXO.total / faturamento.vendido) * 100
    : 0
  const progressoMeta = Math.min((faturamento.vendido / META_MENSAL) * 100, 100)
  // "Entradas no Banco" já inclui antecipação de recebíveis (dinheiro real no banco,
  // mas adiantado com desconto, não venda nova) — esse indicador preserva a
  // visibilidade do risco sem voltar a excluir a antecipação do saldo real.
  const dependenciaAntecipacao = consolidado.totalEntradas > 0
    ? (antecipacoes.total / consolidado.totalEntradas) * 100
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* dados antigos persistidos antes deste campo existir trazem undefined em
          runtime mesmo com o tipo dizendo boolean — só avisa quando o backend
          confirmou explicitamente que não achou a aba de fechamento. */}
      {faturamento.disponivel === false && (
        <div
          className="flex items-center gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm"
          style={{ background: 'rgba(245,158,11,0.08)', borderLeftColor: '#f59e0b', border: '1px solid rgba(120,80,10,0.4)', borderLeftWidth: 4 }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} />
          <span style={{ color: '#fcd34d' }}>
            Não foi possível localizar dados de Faturamento Vendido/Faturado nesta planilha —
            verifique se existe uma aba de fechamento.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard
          titulo="Saldo do Grupo"
          valor={consolidado.saldoGrupo}
          formato="moeda"
          Icon={DollarSign}
          cor={consolidado.saldoGrupo >= 0 ? 'green' : 'red'}
          variacao={mesAnterior ? calcularVariacao(consolidado.saldoGrupo, mesAnterior.saldoGrupo) : undefined}
          descricao={antecipacoes.total > 0 ? `Dependência de Antecipação: ${formatPercentual(dependenciaAntecipacao)} do saldo bancário` : undefined}
        />
        <KPICard
          titulo="Faturamento Vendido"
          valor={faturamento.vendido}
          formato="moeda"
          Icon={TrendingUp}
          cor="blue"
          variacao={mesAnterior ? calcularVariacao(faturamento.vendido, mesAnterior.faturamentoVendido) : undefined}
        />
        <KPICard
          titulo="Faturamento Faturado"
          valor={faturamento.faturado}
          formato="moeda"
          Icon={CheckCircle}
          cor="blue"
          variacao={mesAnterior ? calcularVariacao(faturamento.faturado, mesAnterior.faturamentoFaturado) : undefined}
          descricao={`${formatPercentual(faturamento.vendido > 0 ? (faturamento.faturado / faturamento.vendido) * 100 : 0)} do vendido`}
        />
        <KPICard
          titulo="Comprometimento FGI"
          valor={comprometimentoFGI}
          formato="percentual"
          Icon={AlertTriangle}
          cor={comprometimentoFGI <= 20 ? 'green' : comprometimentoFGI <= 30 ? 'yellow' : 'red'}
          descricao="R$ 46.000/mês fixo"
        />
        <KPICard
          titulo="Meta R$ 2M"
          valor={progressoMeta}
          formato="percentual"
          Icon={Target}
          cor={progressoMeta >= 80 ? 'green' : progressoMeta >= 50 ? 'yellow' : 'red'}
          descricao={`${formatMoeda(faturamento.vendido)} de ${formatMoeda(META_MENSAL)}`}
        />
      </div>

      {/* Entradas vs Saídas + FGI breakdown */}
      <div
        className="rounded-xl border px-5 py-4 animate-fadeIn"
        style={{ background: '#1a1d27', borderColor: '#2d3148' }}
      >
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>
              Entradas no Banco
            </p>
            <p className="text-xl font-bold tabular-nums" style={{ color: '#22c55e' }}>
              {formatMoeda(consolidado.totalEntradas)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>
              Saídas do Banco
            </p>
            <p className="text-xl font-bold tabular-nums" style={{ color: '#ef4444' }}>
              {formatMoeda(consolidado.totalSaidas)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
            Progresso da Meta Mensal
          </p>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: progressoMeta >= 80 ? '#22c55e' : progressoMeta >= 50 ? '#f59e0b' : '#ef4444' }}
          >
            {formatPercentual(progressoMeta)}
          </span>
        </div>
        <ProgressBar
          valor={faturamento.vendido}
          max={META_MENSAL}
          cor={progressoMeta >= 80 ? '#22c55e' : progressoMeta >= 50 ? '#f59e0b' : '#ef4444'}
        />

        <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-3" style={{ borderColor: '#2d3148' }}>
          {[
            { label: 'Gimenes',     valor: FGI_FIXO.gimenes },
            { label: 'Barramares',  valor: FGI_FIXO.barramares },
            { label: 'AluMkt/Hera', valor: FGI_FIXO.alumarketHera },
            { label: 'Total FGI',   valor: FGI_FIXO.total, destaque: true },
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

        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: '#2d3148' }}>
          <p className="text-xs" style={{ color: '#64748b' }}>Margem líquida de caixa</p>
          <span
            className="text-sm font-bold"
            style={{ color: margemLiquida >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {formatPercentual(margemLiquida)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FluxoGrafico empresas={empresas} />
        </div>
        <AlertasPanel alertas={analise.alertas} />
      </div>
    </div>
  )
}

// ─── Empresas View ──────────────────────────────────────────────────────────────

function EmpresasView({ relatorio }: { relatorio: RelatorioCompleto }) {
  const { empresas, faturamento, consolidado, periodo } = relatorio

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>Empresas do Grupo</h2>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
          Performance financeira individual — {periodo}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {empresas.map(empresa => (
          <EmpresaCard key={empresa.nome} empresa={empresa} />
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
              {['Empresa', 'Entradas', 'Saídas', 'Saldo', 'Margem Operacional'].map(h => (
                <th key={h} className="pb-2 pr-6 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empresas.map(e => {
              const margem = e.entradas > 0 ? ((e.entradas - e.despesasOperacionais) / e.entradas) * 100 : 0
              return (
                <tr key={e.nome} style={{ borderBottom: '1px solid #1e2130' }}>
                  <td className="py-2.5 pr-6 font-medium" style={{ color: '#e2e8f0' }}>{e.nome}</td>
                  <td className="py-2.5 pr-6 tabular-nums" style={{ color: '#22c55e' }}>{formatMoeda(e.entradas)}</td>
                  <td className="py-2.5 pr-6 tabular-nums" style={{ color: '#ef4444' }}>{formatMoeda(e.saidas)}</td>
                  <td className="py-2.5 pr-6 tabular-nums font-semibold" style={{ color: e.saldo >= 0 ? '#22c55e' : '#ef4444' }}>
                    {formatMoeda(e.saldo)}
                  </td>
                  <td className="py-2.5" style={{ color: margem >= 15 ? '#22c55e' : margem >= 5 ? '#f59e0b' : '#ef4444' }}>
                    {formatMargem(margem)}
                  </td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid #2d3148' }}>
              <td className="pt-3 pr-6 font-bold" style={{ color: '#3b82f6' }}>CONSOLIDADO</td>
              <td className="pt-3 pr-6 tabular-nums font-bold" style={{ color: '#22c55e' }}>
                {formatMoeda(consolidado.totalEntradas)}
              </td>
              <td className="pt-3 pr-6 tabular-nums font-bold" style={{ color: '#ef4444' }}>
                {formatMoeda(consolidado.totalSaidas)}
              </td>
              <td className="pt-3 pr-6 tabular-nums font-bold" style={{ color: consolidado.saldoGrupo >= 0 ? '#22c55e' : '#ef4444' }}>
                {formatMoeda(consolidado.saldoGrupo)}
              </td>
              <td className="pt-3 font-semibold" style={{ color: '#94a3b8' }}>
                {formatMoeda(faturamento.vendido)} vendido
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
  const [relatorio, setRelatorio] = useState<RelatorioCompleto | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<Aba>('dashboard')
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [mensagensChat, setMensagensChat] = useState<MensagemChat[]>([])
  const [periodoUpload, setPeriodoUpload] = useState(() => new Date().toISOString().slice(0, 7))
  const [historico, setHistorico] = useState<PeriodoResumo[]>([])
  const [trocandoPeriodo, setTrocandoPeriodo] = useState(false)
  const [carregandoInicial, setCarregandoInicial] = useState(true)

  // On first load, show whatever is most recent in Supabase instead of forcing an
  // upload — the upload flow only kicks in if there's truly nothing saved yet.
  useEffect(() => {
    let cancelado = false
    async function carregarMaisRecente() {
      try {
        const res = await fetch('/api/historico')
        const json = await res.json()
        const lista: PeriodoResumo[] = Array.isArray(json.relatorios) ? json.relatorios : []
        if (cancelado) return
        if (lista.length === 0) {
          setAbaAtiva('upload')
          return
        }
        const resDetalhe = await fetch(`/api/historico?periodo=${lista[0].periodo}`)
        const detalhe = await resDetalhe.json()
        if (cancelado) return
        if (resDetalhe.ok) {
          setRelatorio(detalhe as RelatorioCompleto)
          setNomeArquivo(`Histórico — ${detalhe.periodo}`)
        } else {
          setAbaAtiva('upload')
        }
      } catch {
        if (!cancelado) setAbaAtiva('upload')
      } finally {
        if (!cancelado) setCarregandoInicial(false)
      }
    }
    carregarMaisRecente()
    return () => { cancelado = true }
  }, [])

  useEffect(() => {
    if (!relatorio) return
    fetch('/api/historico')
      .then(res => res.json())
      .then(json => { if (Array.isArray(json.relatorios)) setHistorico(json.relatorios) })
      .catch(() => {})
  }, [relatorio?.periodoChave])

  const indiceAtual = relatorio ? historico.findIndex(h => h.periodo === relatorio.periodoChave) : -1
  const mesAnterior = indiceAtual !== -1 && indiceAtual + 1 < historico.length ? historico[indiceAtual + 1] : null

  const handleFileSelect = useCallback((file: File) => {
    setArquivo(file)
    setNomeArquivo(file.name)
    setErro(null)
  }, [])

  const handleAnalisar = useCallback(async () => {
    if (!arquivo) return
    setAnalisando(true)
    setErro(null)
    try {
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      formData.append('periodo', periodoUpload)
      const res = await fetch('/api/analisar', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro na API')
      setRelatorio(json as RelatorioCompleto)
      setArquivo(null)
      setMensagensChat([])
      setAbaAtiva('dashboard')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao analisar com IA.')
    } finally {
      setAnalisando(false)
    }
  }, [arquivo, periodoUpload])

  const handleSelecionarPeriodo = useCallback(async (periodo: string) => {
    if (!periodo || periodo === relatorio?.periodoChave) return
    setTrocandoPeriodo(true)
    setErro(null)
    try {
      const res = await fetch(`/api/historico?periodo=${periodo}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar período')
      setRelatorio(json as RelatorioCompleto)
      setNomeArquivo(`Histórico — ${json.periodo}`)
      setMensagensChat([])
      setAbaAtiva('dashboard')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar período selecionado.')
    } finally {
      setTrocandoPeriodo(false)
    }
  }, [relatorio?.periodoChave])

  const handleExportPDF = useCallback(() => {
    if (relatorio) gerarPDF(relatorio)
  }, [relatorio])

  if (carregandoInicial) {
    return <TelaCarregando titulo="Carregando dados mais recentes…" subtitulo="Verificando relatórios salvos no Supabase." />
  }

  if (analisando) {
    return (
      <TelaCarregando
        titulo="Analisando planilha com IA…"
        subtitulo="Claude está lendo e interpretando os dados financeiros. Aguarde até 90 segundos."
      />
    )
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Sun className="h-4 w-4" style={{ color: '#3b82f6' }} />
            </div>
            <span className="font-bold text-sm hidden sm:block" style={{ color: '#e2e8f0' }}>CFO Solar</span>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Briefcase className="h-3.5 w-3.5 shrink-0" style={{ color: '#64748b' }} />
            <span className="text-xs truncate max-w-[200px]" style={{ color: '#64748b' }}>
              {relatorio ? nomeArquivo : 'Nenhum relatório carregado'}
            </span>
            {relatorio && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" style={{ color: '#4b5563' }} />
                <span className="text-xs font-medium capitalize" style={{ color: '#94a3b8' }}>{relatorio.periodo}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {relatorio && historico.length > 0 && (
              <div className="relative flex items-center">
                <History className="pointer-events-none absolute left-2.5 h-3.5 w-3.5" style={{ color: '#64748b' }} />
                <select
                  value={relatorio.periodoChave}
                  onChange={e => handleSelecionarPeriodo(e.target.value)}
                  disabled={trocandoPeriodo}
                  className="appearance-none rounded-lg border bg-transparent py-1.5 pl-8 pr-3 text-xs font-medium outline-none disabled:opacity-60"
                  style={{ borderColor: '#2d3148', color: '#94a3b8', background: '#161925' }}
                >
                  {!historico.some(h => h.periodo === relatorio.periodoChave) && (
                    <option value={relatorio.periodoChave}>{relatorio.periodo}</option>
                  )}
                  {historico.map(h => (
                    <option key={h.periodo} value={h.periodo}>{formatarPeriodoCurto(h.periodo)}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleExportPDF}
              disabled={!relatorio}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
              style={{ borderColor: '#2d3148', color: '#94a3b8' }}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:block">PDF</span>
            </button>
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

        <NavTabs itens={ABAS} ativo={abaAtiva} onSelecionar={setAbaAtiva} />
      </header>

      <main className="mx-auto max-w-screen-2xl px-5 py-6">
        {abaAtiva === 'upload' && (
          <UploadPanel
            arquivo={arquivo}
            erro={erro}
            periodo={periodoUpload}
            onPeriodoChange={setPeriodoUpload}
            onFileSelect={handleFileSelect}
            onAnalisar={handleAnalisar}
          />
        )}
        {abaAtiva === 'dashboard' && (
          relatorio ? <DashboardView relatorio={relatorio} mesAnterior={mesAnterior} /> : <EstadoVazio onIrParaUpload={() => setAbaAtiva('upload')} />
        )}
        {abaAtiva === 'empresas' && (
          relatorio ? <EmpresasView relatorio={relatorio} /> : <EstadoVazio onIrParaUpload={() => setAbaAtiva('upload')} />
        )}
        {abaAtiva === 'despesas' && (
          relatorio ? (
            <DespesasPorCategoria
              despesasGrupo={relatorio.consolidado.despesasPorCategoriaGrupo}
              resumoCustosGrupo={relatorio.consolidado.resumoCustosGrupo}
              empresas={relatorio.empresas}
            />
          ) : <EstadoVazio onIrParaUpload={() => setAbaAtiva('upload')} />
        )}
        {abaAtiva === 'clientes' && (
          relatorio ? <ClienteTabela clientes={relatorio.clientes} /> : <EstadoVazio onIrParaUpload={() => setAbaAtiva('upload')} />
        )}
        {abaAtiva === 'relatorio' && (
          relatorio ? <RelatorioView analise={relatorio.analise} /> : <EstadoVazio onIrParaUpload={() => setAbaAtiva('upload')} />
        )}
        {abaAtiva === 'comparativo' && <ComparativoView />}
        {abaAtiva === 'chat' && (
          <ChatPanel
            relatorio={relatorio}
            mensagens={mensagensChat}
            onMensagensChange={setMensagensChat}
          />
        )}
      </main>
    </div>
  )
}

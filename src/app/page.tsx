'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload,
  BarChart2,
  FileText,
  Target,
  AlertTriangle,
  Download,
  ChevronRight,
  Briefcase,
  FileSpreadsheet,
  History,
  Calendar,
} from 'lucide-react'
import { gerarPDF } from '@/lib/pdf-generator'
import { NavTabs, type ItemNavTab } from '@/components/layout/NavTabs'
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
import styles from '@/styles/editorial.module.css'

type Aba = 'dashboard' | 'empresas' | 'despesas' | 'clientes' | 'comercial' | 'relatorio' | 'comparativo' | 'chat' | 'upload'

const ABAS: ItemNavTab<Aba>[] = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'empresas',     label: 'Empresas' },
  { id: 'despesas',     label: 'Despesas' },
  { id: 'clientes',     label: 'Clientes' },
  { id: 'comercial',    label: 'Comercial', href: '/comercial' },
  { id: 'relatorio',    label: 'Relatório IA' },
  { id: 'comparativo',  label: 'Comparativo' },
  { id: 'chat',         label: 'Chat' },
  { id: 'upload',       label: 'Adicionar Arquivo' },
]

// ─── Full-screen loading state (initial Supabase check + analyzing) ────────────────

function TelaCarregando({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className={styles.page} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <span className={styles.serif} style={{ fontSize: 21, fontWeight: 600 }}>CFO Solar</span>
      <div
        className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
      />
      <div className="text-center">
        <p style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</p>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--ink3)' }}>{subtitulo}</p>
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
      <div className="mb-8 text-center">
        <h2 className={styles.serif} style={{ fontSize: 19, fontWeight: 600 }}>Adicionar novo relatório</h2>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--ink2)' }}>
          Envie a planilha mensal para gerar uma nova análise com IA e salvar no histórico.
        </p>
      </div>

      {arquivo ? (
        <div className={styles.panel} style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <FileSpreadsheet className="mx-auto mb-3 h-7 w-7" style={{ color: 'var(--ink3)' }} />
          <p style={{ fontWeight: 600 }}>{arquivo.name}</p>
          <p className="mt-1 mb-5" style={{ fontSize: 12, color: 'var(--ink3)' }}>
            {(arquivo.size / 1024).toFixed(0)} KB · pronto para análise
          </p>

          <div className={styles.field} style={{ marginBottom: 20, textAlign: 'left' }}>
            <label className={styles.fieldLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar className="h-3.5 w-3.5" />
              Período da planilha
            </label>
            <input
              type="month"
              value={periodo}
              onChange={e => onPeriodoChange(e.target.value)}
              className={styles.input}
            />
          </div>

          <button onClick={onAnalisar} className={styles.btnPrimary} style={{ width: '100%' }}>
            Analisar com IA
          </button>
          <button onClick={() => ref.current?.click()} className={styles.btn} style={{ width: '100%', marginTop: 10 }}>
            Trocar arquivo
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => ref.current?.click()}
          className="cursor-pointer text-center transition-all duration-200"
          style={{
            width: '100%', maxWidth: 480, padding: '56px 24px',
            border: `1px dashed ${isDragging ? 'var(--foreground)' : 'var(--line2)'}`,
            background: isDragging ? 'var(--paper)' : 'none',
          }}
        >
          <Upload className="mx-auto mb-3 h-6 w-6" style={{ color: 'var(--ink3)' }} />
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Arraste o arquivo Excel aqui
          </p>
          <p className="mb-4" style={{ fontSize: 13, color: 'var(--ink2)' }}>ou clique para selecionar</p>
          <p style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--ink3)' }}>
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
        <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ maxWidth: 480, width: '100%', marginTop: 20 }}>
          <span>{erro}</span>
        </div>
      )}

      <div className="mt-12 grid grid-cols-3 gap-0" style={{ width: '100%', maxWidth: 480, border: '1px solid var(--line)' }}>
        {[
          { icon: BarChart2, label: 'KPIs Consolidados', desc: '5 empresas em tempo real' },
          { icon: Target,    label: 'Meta R$ 2M',        desc: 'Acompanhamento automático' },
          { icon: FileText,  label: 'Análise por IA',    desc: 'Claude lê a planilha direto' },
        ].map(({ icon: Icon, label, desc }, i) => (
          <div key={label} className="text-center" style={{ padding: '18px 12px', borderLeft: i > 0 ? '1px solid var(--line)' : 'none' }}>
            <Icon className="mx-auto mb-2 h-4 w-4" style={{ color: 'var(--ink3)' }} />
            <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
            <p className="mt-0.5" style={{ fontSize: 11, color: 'var(--ink3)' }}>{desc}</p>
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
      <FileSpreadsheet className="h-8 w-8" style={{ color: 'var(--ink3)' }} />
      <div>
        <p style={{ fontWeight: 600 }}>Nenhum relatório carregado ainda</p>
        <p className="mt-1" style={{ fontSize: 13, color: 'var(--ink2)' }}>
          Envie uma planilha na aba &quot;Adicionar Arquivo&quot; para começar.
        </p>
      </div>
      <button onClick={onIrParaUpload} className={styles.btnPrimary}>
        Ir para Adicionar Arquivo
      </button>
    </div>
  )
}

// ─── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const pct = Math.min((valor / max) * 100, 100)
  return (
    <div className={styles.progress}>
      <div className={styles.progressFill} style={{ width: `${pct}%`, background: cor }} />
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
  const dependenciaAntecipacao = consolidado.totalEntradas > 0
    ? (antecipacoes.total / consolidado.totalEntradas) * 100
    : 0
  const corMeta = progressoMeta >= 100 ? 'var(--positivo)' : progressoMeta >= 50 ? 'var(--destaque)' : 'var(--critico)'

  return (
    <div className="flex flex-col gap-8">
      {/* dados antigos persistidos antes deste campo existir trazem undefined em
          runtime mesmo com o tipo dizendo boolean — só avisa quando o backend
          confirmou explicitamente que não achou a aba de fechamento. */}
      {faturamento.disponivel === false && (
        <div className={`${styles.notice} ${styles.alertaDanger}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            Não foi possível localizar dados de Faturamento Vendido/Faturado nesta planilha —
            verifique se existe uma aba de fechamento.
          </span>
        </div>
      )}

      <div className={`${styles.kpis} ${styles.kpiGrid5}`} style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <KPICard
          titulo="Saldo do Grupo"
          valor={consolidado.saldoGrupo}
          formato="moeda"
          cor={consolidado.saldoGrupo >= 0 ? 'green' : 'red'}
          variacao={mesAnterior ? calcularVariacao(consolidado.saldoGrupo, mesAnterior.saldoGrupo) : undefined}
          descricao={antecipacoes.total > 0 ? `Dependência de Antecipação: ${formatPercentual(dependenciaAntecipacao)} do saldo bancário` : undefined}
        />
        <KPICard
          titulo="Faturamento Vendido"
          valor={faturamento.vendido}
          formato="moeda"
          variacao={mesAnterior ? calcularVariacao(faturamento.vendido, mesAnterior.faturamentoVendido) : undefined}
        />
        <KPICard
          titulo="Faturamento Faturado"
          valor={faturamento.faturado}
          formato="moeda"
          variacao={mesAnterior ? calcularVariacao(faturamento.faturado, mesAnterior.faturamentoFaturado) : undefined}
          descricao={`${formatPercentual(faturamento.vendido > 0 ? (faturamento.faturado / faturamento.vendido) * 100 : 0)} do vendido`}
        />
        <KPICard
          titulo="Comprometimento FGI"
          valor={comprometimentoFGI}
          formato="percentual"
          cor={comprometimentoFGI <= 20 ? 'green' : comprometimentoFGI <= 30 ? 'yellow' : 'red'}
          descricao="R$ 46.000/mês fixo"
        />
        <KPICard
          titulo="Meta R$ 2M"
          valor={progressoMeta}
          formato="percentual"
          cor={progressoMeta >= 80 ? 'green' : progressoMeta >= 50 ? 'yellow' : 'red'}
          descricao={`${formatMoeda(faturamento.vendido)} de ${formatMoeda(META_MENSAL)}`}
        />
      </div>

      {/* Entradas vs Saídas + FGI breakdown */}
      <div className={styles.panel}>
        <div className="grid grid-cols-2 gap-6 mb-5">
          <div>
            <p className={styles.kl}>Entradas no Banco</p>
            <p className={`${styles.serif} ${styles.num}`} style={{ fontSize: 26, marginTop: 6, color: 'var(--positivo)' }}>
              {formatMoeda(consolidado.totalEntradas)}
            </p>
          </div>
          <div>
            <p className={styles.kl}>Saídas do Banco</p>
            <p className={`${styles.serif} ${styles.num}`} style={{ fontSize: 26, marginTop: 6, color: 'var(--critico)' }}>
              {formatMoeda(consolidado.totalSaidas)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className={styles.kl}>Progresso da Meta Mensal</p>
          <span className={`${styles.serif} ${styles.num}`} style={{ fontSize: 17, fontWeight: 600, color: corMeta }}>
            {formatPercentual(progressoMeta)}
          </span>
        </div>
        <ProgressBar valor={faturamento.vendido} max={META_MENSAL} cor={corMeta} />

        <div className="mt-5 pt-5 grid grid-cols-4 gap-3" style={{ borderTop: '1px solid var(--line)' }}>
          {[
            { label: 'Gimenes',     valor: FGI_FIXO.gimenes },
            { label: 'Barramares',  valor: FGI_FIXO.barramares },
            { label: 'AluMkt/Hera', valor: FGI_FIXO.alumarketHera },
            { label: 'Total FGI',   valor: FGI_FIXO.total, destaque: true },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p style={{ fontSize: 11, color: 'var(--ink3)' }}>{item.label}</p>
              <p className={`${styles.num} mt-0.5`} style={{ fontSize: 13, fontWeight: 600, color: item.destaque ? 'var(--foreground)' : 'var(--ink2)' }}>
                {formatMoeda(item.valor)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)' }}>
          <p style={{ fontSize: 12, color: 'var(--ink3)' }}>Margem líquida de caixa</p>
          <span style={{ fontSize: 13, fontWeight: 600, color: margemLiquida >= 0 ? 'var(--positivo)' : 'var(--critico)' }}>
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
      <div className="mb-6">
        <h2 className={styles.serif} style={{ fontSize: 19, fontWeight: 600 }}>Empresas do Grupo</h2>
        <p className="mt-0.5" style={{ fontSize: 13, color: 'var(--ink2)' }}>
          Performance financeira individual — {periodo}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {empresas.map(empresa => (
          <EmpresaCard key={empresa.nome} empresa={empresa} />
        ))}
      </div>

      <div className="mt-8 overflow-x-auto">
        <div className={styles.shead}>
          <div className={`${styles.stitle} ${styles.serif}`}>Visão Consolidada</div>
        </div>
        <div className={`${styles.thead} ${styles.t5}`} style={{ marginTop: 18 }}>
          <div>Empresa</div>
          <div className={styles.right}>Entradas</div>
          <div className={styles.right}>Saídas</div>
          <div className={styles.right}>Saldo</div>
          <div className={styles.right}>Margem Op.</div>
        </div>
        {empresas.map(e => {
          const margem = e.entradas > 0 ? ((e.entradas - e.despesasOperacionais) / e.entradas) * 100 : 0
          return (
            <div key={e.nome} className={`${styles.trow} ${styles.t5}`}>
              <div className={styles.fn}>{e.nome}</div>
              <div className={`${styles.right} ${styles.num}`} style={{ color: 'var(--positivo)' }}>{formatMoeda(e.entradas)}</div>
              <div className={`${styles.right} ${styles.num}`} style={{ color: 'var(--critico)' }}>{formatMoeda(e.saidas)}</div>
              <div className={`${styles.right} ${styles.num}`} style={{ fontWeight: 600, color: e.saldo >= 0 ? 'var(--positivo)' : 'var(--critico)' }}>
                {formatMoeda(e.saldo)}
              </div>
              <div className={styles.right} style={{ color: margem >= 15 ? 'var(--positivo)' : margem >= 5 ? 'var(--pendente)' : 'var(--critico)' }}>
                {formatMargem(margem)}
              </div>
            </div>
          )
        })}
        <div className={`${styles.trow} ${styles.t5}`} style={{ borderTop: '2px solid var(--line2)', borderBottom: 'none' }}>
          <div className={styles.fn} style={{ fontWeight: 700 }}>CONSOLIDADO</div>
          <div className={`${styles.right} ${styles.num}`} style={{ fontWeight: 700, color: 'var(--positivo)' }}>
            {formatMoeda(consolidado.totalEntradas)}
          </div>
          <div className={`${styles.right} ${styles.num}`} style={{ fontWeight: 700, color: 'var(--critico)' }}>
            {formatMoeda(consolidado.totalSaidas)}
          </div>
          <div className={`${styles.right} ${styles.num}`} style={{ fontWeight: 700, color: consolidado.saldoGrupo >= 0 ? 'var(--positivo)' : 'var(--critico)' }}>
            {formatMoeda(consolidado.saldoGrupo)}
          </div>
          <div className={styles.right} style={{ fontWeight: 600, color: 'var(--ink2)' }}>
            {formatMoeda(faturamento.vendido)} vendido
          </div>
        </div>
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
  const [abaAtiva, setAbaAtiva] = useState<Aba>(() => {
    // Lê o parâmetro ?tab= da URL para que links diretos (ex: /?tab=relatorio)
    // abram a aba correta sem precisar de um segundo clique.
    if (typeof window === 'undefined') return 'dashboard'
    const tab = new URLSearchParams(window.location.search).get('tab') as Aba | null
    const validas: Aba[] = ['dashboard', 'empresas', 'despesas', 'clientes', 'relatorio', 'comparativo', 'chat', 'upload']
    return (tab && validas.includes(tab)) ? tab : 'dashboard'
  })
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
    <div className={styles.page}>
      <div className={`${styles.hdr} ${styles.htop}`}>
        <div className={styles.wrap}>
          <div className={styles.brand} style={{ justifyContent: 'space-between', width: '100%' }}>
            <div className="flex items-baseline gap-3.5">
              <span className={`${styles.bname} ${styles.serif}`}>CFO Solar</span>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--ink3)' }}>
                <Briefcase className="h-3 w-3" />
                {relatorio ? nomeArquivo : 'Nenhum relatório carregado'}
                {relatorio && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    <span style={{ color: 'var(--ink2)', fontWeight: 500 }} className="capitalize">{relatorio.periodo}</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {relatorio && historico.length > 0 && (
                <div className="relative flex items-center">
                  <History className="pointer-events-none absolute left-0 h-3.5 w-3.5" style={{ color: 'var(--ink3)' }} />
                  <select
                    value={relatorio.periodoChave}
                    onChange={e => handleSelecionarPeriodo(e.target.value)}
                    disabled={trocandoPeriodo}
                    className={styles.select}
                    style={{ paddingLeft: 20 }}
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

              <button onClick={handleExportPDF} disabled={!relatorio} className={styles.btn} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:block">PDF</span>
              </button>
            </div>
          </div>

          {erro && (
            <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginBottom: 12 }}>
              <span>{erro}</span>
            </div>
          )}

          <NavTabs itens={ABAS} ativo={abaAtiva} onSelecionar={setAbaAtiva} />
        </div>
      </div>

      <main className={styles.wrap} style={{ paddingTop: 34, paddingBottom: 60 }}>
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

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Users, TrendingUp, PhoneCall, AlertTriangle, Wallet, Target } from 'lucide-react'
import styles from '@/styles/editorial.module.css'
import { formatMoeda, formatData } from '@/lib/utils'
import { CORES } from '@/lib/tema'

// Paleta de acento própria deste painel — deliberadamente mais vibrante que o
// resto do app (que usa só a paleta editorial de @/lib/tema). Cada seção usa
// uma cor fixa, não aleatória, pra funcionar como código de cor consistente
// (azul = carteira/clientes, verde = vendas, roxo = priorização, laranja =
// atenção, rosa = urgência/crítico).
interface CorAcento { fg: string; bg: string; border: string; ink: string }

const ACCENT: Record<'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'amber', CorAcento> = {
  blue:   { fg: '#2563EB', bg: '#EFF4FF', border: '#DCE6FB', ink: '#1E40AF' },
  green:  { fg: '#10B981', bg: '#ECFDF5', border: '#D6F5E8', ink: '#047857' },
  purple: { fg: '#A855F7', bg: '#F6EEFF', border: '#EEDCFC', ink: '#7E22CE' },
  orange: { fg: '#F97316', bg: '#FFF4EB', border: '#FCE3CC', ink: '#C2410C' },
  pink:   { fg: '#EC4899', bg: '#FDF0F7', border: '#FAE0EE', ink: '#BE185D' },
  amber:  { fg: '#C78A2E', bg: '#FBF2E2', border: '#F2DEB4', ink: '#9C6B1F' },
}

// ─── Tipos da resposta da API (/api/comercial/centro-comando) ─────────────────

type NivelAlerta = 'critico' | 'aviso' | 'info'

interface AlertaItem {
  id: string
  tipo: string
  nivel: NivelAlerta
  clienteCnpj: string
  razaoSocial: string
  vendedorNome: string | null
  data: string | null
  mensagem: string
}

interface PrioridadeSugerida {
  id: string
  cliente: string
  vendedor: string
  valorOrcado: number
  dataOrcamento: string | null
  previsaoFechamento: string | null
  etapaFunil: string | null
}

interface PontoEvolucaoCarteira { mes: string; clientes: number }

interface CentroComandoResumo {
  ok: boolean
  error?: string
  alertas: AlertaItem[]
  vendasHoje: { total: number; quantidade: number }
  orcamentosHoje: number
  clientesNovosHoje: { total: number; leads: number }
  carteira: { em_fila: number; atribuido: number; liberado: number }
  funil: Record<string, number>
  prioridades: PrioridadeSugerida[]
  valorPotencialAberto: number
  meta: { realizadoMes: number; alvo: number | null }
  evolucaoCarteira: PontoEvolucaoCarteira[]
  saudeCarteira: { score: number; formula: string }
}

const ETAPAS_ORDEM = ['Novo', 'Em contato', 'Negociação', 'Aguardando decisão', 'Fechado', 'Perdido']

const TIPOS_ESQUECIDO = new Set(['cliente_esfriando', 'sem_atividade'])

function diasAtras(dataIso: string | null): string {
  if (!dataIso) return '—'
  const diff = Math.floor((Date.now() - new Date(dataIso).getTime()) / 86_400_000)
  if (diff <= 0) return 'Orçado hoje'
  if (diff === 1) return 'Orçado há 1 dia'
  return `Orçado há ${diff} dias`
}

function diasDesde(dataIso: string | null): number {
  if (!dataIso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(dataIso).getTime()) / 86_400_000))
}

const cardBase: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--line)',
  transition: 'transform .2s ease, box-shadow .2s ease',
}

function elevar(e: React.MouseEvent<HTMLElement>, entrando: boolean) {
  const el = e.currentTarget as HTMLElement
  el.style.transform = entrando ? 'translateY(-3px)' : 'translateY(0)'
  el.style.boxShadow = entrando ? '0 10px 24px rgba(17,24,39,.10)' : 'none'
}

function CardBriefing({ label, valor, accent, Icon }: { label: string; valor: string | number; accent: CorAcento; Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }) {
  const texto = String(valor)
  const fontSize = texto.length > 9 ? 17 : texto.length > 6 ? 20 : 25
  return (
    <div
      style={{ ...cardBase, background: 'var(--cor-superficie)', padding: '18px 18px 16px', minWidth: 0 }}
      onMouseEnter={e => elevar(e, true)}
      onMouseLeave={e => elevar(e, false)}
    >
      <div style={{ width: 34, height: 34, borderRadius: 10, background: accent.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} color={accent.fg} strokeWidth={2} />
      </div>
      <div
        className={`${styles.num} ${styles.serif}`}
        style={{ fontSize, fontWeight: 600, color: 'var(--foreground)', marginTop: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        title={texto}
      >
        {valor}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ListaAlertas({ alertas, vazio, nivel }: { alertas: AlertaItem[]; vazio: string; nivel: 'critico' | 'aviso' }) {
  const cfg = nivel === 'critico' ? ACCENT.pink : ACCENT.orange
  if (alertas.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink3)' }}>{vazio}</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {alertas.slice(0, 5).map(a => (
        <a
          key={a.id}
          href={`/clientes/${a.clienteCnpj}`}
          style={{
            display: 'block', textDecoration: 'none', color: 'inherit',
            background: cfg.bg, borderLeft: `3px solid ${cfg.fg}`, borderRadius: '0 10px 10px 0',
            padding: '10px 14px', transition: 'background .15s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = cfg.border }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = cfg.bg }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.razaoSocial}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>{a.mensagem}</div>
        </a>
      ))}
    </div>
  )
}

const rechartsTick = { fill: CORES.ink3, fontSize: 11 }
const rechartsTooltipStyle = { background: CORES.paper, border: `1px solid ${CORES.line2}`, borderRadius: 10, fontSize: 12.5 }

// Gauge semicircular com o preenchimento animando na montagem — mesma lógica
// de "só o essencial visível de cara" do resto do app, mas com movimento.
function GaugeSaude({ score }: { score: number }) {
  const [animado, setAnimado] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimado(true), 80)
    return () => clearTimeout(t)
  }, [])

  const r = 72
  const comprimento = Math.PI * r
  const cor = score >= 70 ? ACCENT.green.fg : score >= 50 ? ACCENT.orange.fg : ACCENT.pink.fg
  const corInk = score >= 70 ? ACCENT.green.ink : score >= 50 ? ACCENT.orange.ink : ACCENT.pink.ink
  const preenchido = animado ? (score / 100) * comprimento : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={180} height={104} viewBox="0 0 180 104">
        <path d="M 14 96 A 76 76 0 0 1 166 96" fill="none" stroke="var(--line2)" strokeWidth={14} strokeLinecap="round" />
        <path
          d="M 14 96 A 76 76 0 0 1 166 96"
          fill="none"
          stroke={cor}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${comprimento}`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 36, fontWeight: 600, color: corInk, marginTop: -20 }}>{score}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>
        {score >= 70 ? 'Carteira saudável' : score >= 50 ? 'Atenção recomendada' : 'Revisão urgente'}
      </div>
    </div>
  )
}

export function CentroComando({ papel, vendedorId, nome }: { papel: string; vendedorId: string | null; nome: string | null }) {
  const [dados, setDados] = useState<CentroComandoResumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const idsGradiente = useRef({ pipeline: `pipelineGrad-${Math.random().toString(36).slice(2)}`, evolucao: `evoGrad-${Math.random().toString(36).slice(2)}` }).current

  useEffect(() => {
    const headers: HeadersInit = {}
    if (papel === 'vendedor' && vendedorId) headers['x-vendedor-id'] = vendedorId

    fetch('/api/comercial/centro-comando', { headers })
      .then(r => r.json() as Promise<CentroComandoResumo>)
      .then(d => {
        if (!d.ok) throw new Error(d.error ?? 'Erro ao carregar o Centro de Comando')
        setDados(d)
      })
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro desconhecido'))
      .finally(() => setCarregando(false))
  }, [papel, vendedorId])

  const eVendedor = papel === 'vendedor'

  if (erro) {
    return (
      <p style={{ fontSize: 13, color: 'var(--critico)', padding: '24px 4px', marginBottom: 36 }}>
        Erro ao carregar o Centro de Comando: {erro}
      </p>
    )
  }

  const alertas         = dados?.alertas ?? []
  const acoesCriticas   = alertas.filter(a => a.nivel === 'critico')
  const acoesAtencao    = alertas.filter(a => a.nivel !== 'critico')
  const clientesEmRisco = alertas.filter(a => TIPOS_ESQUECIDO.has(a.tipo))
  const clientesEsquecidos = [...clientesEmRisco].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))

  const carteira = dados?.carteira ?? { em_fila: 0, atribuido: 0, liberado: 0 }
  const totalCarteira = carteira.em_fila + carteira.atribuido + carteira.liberado
  const totalOportunidades = Object.values(dados?.funil ?? {}).reduce((a, b) => a + b, 0)

  const pieCarteira = [
    { name: 'Liberado', value: carteira.liberado, cor: ACCENT.green.fg },
    { name: 'Em Fila', value: carteira.em_fila, cor: ACCENT.amber.fg },
    { name: 'Atribuído', value: carteira.atribuido, cor: ACCENT.blue.fg },
  ]

  const barFunil = ETAPAS_ORDEM.map(etapa => ({ etapa, quantidade: dados?.funil[etapa] ?? 0 })).filter(e => e.quantidade > 0 || totalOportunidades === 0)

  const saude = dados?.saudeCarteira ?? { score: 0, formula: '—' }

  return (
    <div style={{ marginBottom: 48 }}>

      {/* [1] Cabeçalho */}
      <div
        style={{
          background: `linear-gradient(135deg, var(--cor-destaque) 0%, ${ACCENT.blue.fg} 100%)`,
          color: '#fff',
          padding: '36px 40px',
          borderRadius: 20,
          marginBottom: 26,
          boxShadow: '0 12px 28px rgba(37,99,235,.18)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -60, top: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
        <div style={{ position: 'relative' }}>
          <div className={styles.serif} style={{ fontSize: 30, fontWeight: 600, fontStyle: 'italic' }}>
            Olá{nome ? `, ${nome}` : ''}
          </div>
          <p style={{ fontSize: 13.5, opacity: 0.92, marginTop: 6 }}>
            Aqui está o resumo da {eVendedor ? 'sua carteira' : 'carteira'} hoje.
          </p>
        </div>
      </div>

      {/* [2] Briefing geral */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 26 }}>
        <CardBriefing label="Clientes na carteira" valor={carregando ? '—' : totalCarteira} accent={ACCENT.blue} Icon={Users} />
        <CardBriefing label="Oportunidades abertas" valor={carregando ? '—' : totalOportunidades} accent={ACCENT.green} Icon={TrendingUp} />
        <CardBriefing label="Follow-ups pra hoje" valor={carregando ? '—' : acoesCriticas.length} accent={ACCENT.pink} Icon={PhoneCall} />
        <CardBriefing label="Clientes em risco" valor={carregando ? '—' : clientesEmRisco.length} accent={ACCENT.orange} Icon={AlertTriangle} />
        <CardBriefing label="Valor potencial aberto" valor={carregando ? '—' : formatMoeda(dados?.valorPotencialAberto ?? 0)} accent={ACCENT.purple} Icon={Wallet} />
        <CardBriefing label="Realizado no mês" valor={carregando ? '—' : formatMoeda(dados?.meta.realizadoMes ?? 0)} accent={ACCENT.amber} Icon={Target} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 22, marginBottom: 22 }}>

        {/* [3] O que aconteceu hoje */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>O que aconteceu hoje?</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div style={{ background: 'var(--paper)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 20, color: 'var(--foreground)' }}>{dados!.vendasHoje.quantidade}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 4 }}>Vendas</div>
                <div className={styles.num} style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{formatMoeda(dados!.vendasHoje.total)}</div>
              </div>
              <div style={{ background: 'var(--paper)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 20, color: 'var(--foreground)' }}>{dados!.orcamentosHoje}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 4 }}>Orçamentos</div>
              </div>
              <div style={{ background: 'var(--paper)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 20, color: 'var(--foreground)' }}>{dados!.clientesNovosHoje.total}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 4 }}>Clientes Novos</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{dados!.clientesNovosHoje.leads} lead(s)</div>
              </div>
            </div>
          )}
        </div>

        {/* [4] O que tenho que fazer hoje */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>O que tenho que fazer hoje?</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : (
            <ListaAlertas alertas={acoesCriticas} vazio="Nenhuma ação crítica pendente." nivel="critico" />
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 22, marginBottom: 22 }}>

        {/* [5] O que merece atenção */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>O que merece atenção?</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : (
            <ListaAlertas alertas={acoesAtencao} vazio="Nada precisando de atenção no momento." nivel="aviso" />
          )}
        </div>

        {/* [6] Pipeline — barras horizontais com gradiente */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Pipeline</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : totalOportunidades === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum orçamento em aberto no momento.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barFunil} layout="vertical" margin={{ left: 8, right: 16 }}>
                <defs>
                  <linearGradient id={idsGradiente.pipeline} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={ACCENT.amber.border} />
                    <stop offset="100%" stopColor="var(--cor-destaque)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 4" stroke={CORES.line} horizontal={false} />
                <XAxis type="number" tick={rechartsTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="etapa" type="category" width={110} tick={rechartsTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={rechartsTooltipStyle} cursor={{ fill: CORES.paper }} />
                <Bar dataKey="quantidade" fill={`url(#${idsGradiente.pipeline})`} radius={[0, 8, 8, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 22, marginBottom: 22 }}>

        {/* [7] Como está minha carteira — donut com total ao centro */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>{eVendedor ? 'Como está minha carteira?' : 'Como está a carteira?'}</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : totalCarteira === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum cliente na carteira ainda.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieCarteira} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" nameKey="name" strokeWidth={2} stroke="var(--cor-superficie)">
                      {pieCarteira.map((p, i) => <Cell key={i} fill={p.cor} />)}
                    </Pie>
                    <Tooltip contentStyle={rechartsTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 22, fontWeight: 600 }}>{totalCarteira}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink3)' }}>clientes</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pieCarteira.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.cor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5 }}>{p.name} <b className={styles.num}>{p.value}</b></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* [8] Prioridade sugerida */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>Prioridade sugerida</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginBottom: 14 }}>Maiores orçamentos em aberto — ordenado por valor.</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : (dados?.prioridades.length ?? 0) === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum orçamento em aberto no momento.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dados!.prioridades.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 2px', borderBottom: i < dados!.prioridades.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span className={styles.num} style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--paper)', color: 'var(--ink2)', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>
                    {!eVendedor && <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{p.vendedor}</div>}
                  </div>
                  <span className={styles.num} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cor-destaque)', flexShrink: 0 }}>{formatMoeda(p.valorOrcado)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* [9] Maiores oportunidades */}
      <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22, marginBottom: 22 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Maiores oportunidades</div>
        {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : (dados?.prioridades.length ?? 0) === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhuma oportunidade em aberto.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            {dados!.prioridades.map(p => (
              <div
                key={p.id}
                style={{ borderRadius: 14, padding: 16, background: 'var(--paper)', border: '1px solid var(--line)', transition: 'transform .2s ease, box-shadow .2s ease' }}
                onMouseEnter={e => elevar(e, true)}
                onMouseLeave={e => elevar(e, false)}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>
                {!eVendedor && <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 2 }}>{p.vendedor}</div>}
                <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 19, fontWeight: 600, color: 'var(--cor-destaque)', marginTop: 8 }}>{formatMoeda(p.valorOrcado)}</div>
                <div style={{ marginTop: 10, display: 'inline-block', fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink2)', background: 'var(--cor-superficie)', borderRadius: 6, padding: '3px 8px' }}>
                  {p.etapaFunil ?? 'Novo'}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 8 }}>
                  {p.previsaoFechamento ? `Previsão: ${formatData(p.previsaoFechamento)}` : diasAtras(p.dataOrcamento)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22, marginBottom: 22 }}>

        {/* [10] Saúde da carteira — gauge animado */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Saúde da carteira</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                <GaugeSaude score={saude.score} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                {saude.formula}
              </p>
            </>
          )}
        </div>

        {/* [11] Evolução da carteira */}
        <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22, gridColumn: 'span 2' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 16 }}>Evolução da carteira · últimos 6 meses</div>
          {carregando ? <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dados?.evolucaoCarteira ?? []}>
                <defs>
                  <linearGradient id={idsGradiente.evolucao} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cor-destaque)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--cor-destaque)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 4" stroke={CORES.line} vertical={false} />
                <XAxis dataKey="mes" tick={rechartsTick} axisLine={{ stroke: CORES.line }} tickLine={false} />
                <YAxis tick={rechartsTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={rechartsTooltipStyle} />
                <Area type="monotone" dataKey="clientes" stroke="var(--cor-destaque)" strokeWidth={2.5} fill={`url(#${idsGradiente.evolucao})`} dot={{ fill: 'var(--cor-destaque)', r: 4 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* [12] Clientes esquecidos */}
      <div style={{ ...cardBase, background: 'var(--cor-superficie)', padding: 22 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>Clientes esquecidos</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginBottom: 16 }}>
          Esfriando ou sem nenhum contato registrado — mesmo critério do sino de notificações.
        </div>
        {carregando ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p>
        ) : clientesEsquecidos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum cliente esquecido no momento.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--line2)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Cliente</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Situação</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)' }}>Dias</th>
                </tr>
              </thead>
              <tbody>
                {clientesEsquecidos.slice(0, 10).map((c, i) => {
                  const dias = diasDesde(c.data)
                  const badge = dias > 30 ? ACCENT.pink : ACCENT.orange
                  return (
                    <tr
                      key={c.id}
                      style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'var(--paper)' : 'transparent', transition: 'background .15s ease' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--line)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'var(--paper)' : 'transparent' }}
                    >
                      <td style={{ padding: '11px 6px' }}>
                        <a href={`/clientes/${c.clienteCnpj}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>{c.razaoSocial}</a>
                      </td>
                      <td style={{ padding: '11px 6px', color: 'var(--ink2)' }}>{c.mensagem}</td>
                      <td style={{ padding: '11px 6px', textAlign: 'right' }}>
                        <span className={styles.num} style={{ fontWeight: 700, color: badge.ink, background: badge.bg, borderRadius: 6, padding: '3px 9px' }}>{dias}d</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

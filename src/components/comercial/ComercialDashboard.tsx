'use client'

import { useState, useEffect, useMemo } from 'react'
import styles from '@/styles/editorial.module.css'
import { formatMoeda, formatData } from '@/lib/utils'
import { MetricaComFormula } from '@/components/relatorio/MetricaComFormula'

// ─── Tipos da resposta da API ──────────────────────────────────────────────────

interface SerieVendedor {
  vendedor: string
  valoresPorPeriodo: { label: string; valor: number }[]
  total: number
}

interface IndicadoresVendedor {
  vendedor: string
  orcamentos: number
  clientesOrcados: number
  valorOrcado: number
  pedidosVendidos: number
  clientesCompradores: number
  valorVendido: number
  taxaConversaoFinanceira: number | null
  taxaConversaoComercial: number | null
}

interface OportunidadePedido {
  id: string
  cliente: string
  valorOrcado: number
  dataOrcamento: string | null
  proximaAcao: string | null
  previsaoFechamento: string | null
  empresa: string | null
  filial: string | null
}

interface GrandesOportunidades {
  vendedor: string
  oportunidades: OportunidadePedido[]
  totalPipeline: number
}

type OppComVendedor = OportunidadePedido & { vendedor: string }

const LIMITE_OPP = 10

interface EntradaRanking {
  posicao: number
  vendedor: string
  valor: number
  detalhes: Record<string, number | string | null>
  formula: string
}

interface DadosDashboard {
  ok: boolean
  error?: string
  granularidade: 'semana' | 'mes'
  labels: string[]
  desempenhoPorVendedor: SerieVendedor[]
  totalComercialAtualizado: number
  indicadoresPorVendedor: IndicadoresVendedor[]
  grandesOportunidades: GrandesOportunidades[]
  rankings: {
    porFilial: { saoPaulo: EntradaRanking[]; parana: EntradaRanking[] }
    porValorOrcado: EntradaRanking[]
    porValorVendido: EntradaRanking[]
    conversaoFinanceira: EntradaRanking[]
    produtividade: EntradaRanking[]
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function periodoParaDatas(period: '4s' | '3m') {
  const hoje = new Date()
  const fim = hoje.toISOString().slice(0, 10)
  const ini = new Date(hoje)
  if (period === '4s') ini.setDate(hoje.getDate() - 28)
  else ini.setMonth(hoje.getMonth() - 3)
  return { inicio: ini.toISOString().slice(0, 10), fim }
}

function formatLabel(label: string): string {
  const weekMatch = label.match(/^(\d{4})-W(\d{2})$/)
  if (weekMatch) return `Sem. ${parseInt(weekMatch[2])}`

  const monthMatch = label.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${meses[parseInt(monthMatch[2]) - 1]}/${monthMatch[1].slice(2)}`
  }
  return label
}

function diasAtras(dataIso: string | null): string {
  if (!dataIso) return '—'
  const diff = Math.floor((Date.now() - new Date(dataIso).getTime()) / 86_400_000)
  if (diff === 0) return 'Orçado hoje'
  if (diff === 1) return 'Orçado há 1 dia'
  return `Orçado há ${diff} dias`
}

// ─── Estados auxiliares ────────────────────────────────────────────────────────

function SemDados({ mensagem }: { mensagem?: string }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 4px' }}>
      {mensagem ?? 'Nenhum dado importado para este período ainda. Faça upload de um relatório para começar.'}
    </p>
  )
}

function SkeletonRows({ linhas, cols }: { linhas: number; cols: number }) {
  return (
    <>
      {Array.from({ length: linhas }).map((_, ri) => (
        <tr key={ri}>
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} style={{ ...tdStyle, ...(ci > 0 ? { textAlign: 'right' as const } : {}) }}>
              <div
                className="animate-pulse"
                style={{ height: 13, background: 'var(--line2)', borderRadius: 2, width: ci === 0 ? '65%' : '50%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ─── Ranking row sem fórmula ───────────────────────────────────────────────────

function RankRow({ r, meta }: { r: EntradaRanking; meta?: string }) {
  return (
    <div className={styles.rRow}>
      <span className={styles.rPos}>{r.posicao}</span>
      <span className={styles.rName}>{r.vendedor}</span>
      {meta && <span className={styles.rMeta}>{meta}</span>}
      <span className={`${styles.rVal} ${styles.num}`}>{formatMoeda(r.valor)}</span>
    </div>
  )
}

// ─── Tipos de aba de ranking ───────────────────────────────────────────────────

type RankTab = 'filial' | 'orcado' | 'vendido' | 'conversao' | 'produtividade' | 'geral'

const RANK_TABS: { id: RankTab; label: string }[] = [
  { id: 'filial',        label: 'Por Filial' },
  { id: 'orcado',        label: 'Valor Orçado' },
  { id: 'vendido',       label: 'Valor Vendido' },
  { id: 'conversao',     label: '% Conversão' },
  { id: 'produtividade', label: 'Produtividade' },
  { id: 'geral',         label: 'Análise Geral' },
]

// ─── Componente principal ──────────────────────────────────────────────────────

type TipoPeriodo = '4s' | '3m' | 'personalizado'

const OPCOES_PERIODO: { id: TipoPeriodo; label: string }[] = [
  { id: '4s',           label: 'Últimas 4 semanas' },
  { id: '3m',           label: 'Últimos 3 meses' },
  { id: 'personalizado', label: 'Personalizado' },
]

export function ComercialDashboard() {
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('4s')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim]     = useState('')
  const [rankTab, setRankTab] = useState<RankTab>('filial')
  const [dados, setDados] = useState<DadosDashboard | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [vendedoresSelecionados, setVendedoresSelecionados] = useState<Set<string>>(new Set())
  const [expandidoOpp, setExpandidoOpp] = useState(false)

  // Período ativo como string estável — null quando personalizado ainda incompleto/inválido
  const periodoAtivo = useMemo<string | null>(() => {
    if (tipoPeriodo === 'personalizado') {
      if (!customInicio || !customFim || customInicio > customFim) return null
      return `${customInicio}|${customFim}`
    }
    const p = periodoParaDatas(tipoPeriodo)
    return `${p.inicio}|${p.fim}`
  }, [tipoPeriodo, customInicio, customFim])

  useEffect(() => {
    if (!periodoAtivo) return
    const [inicio, fim] = periodoAtivo.split('|')
    setCarregando(true)
    setErro(null)

    fetch(`/api/comercial/dashboard?periodoInicio=${inicio}&periodoFim=${fim}`)
      .then(r => r.json())
      .then((d: DadosDashboard) => {
        if (!d.ok) throw new Error(d.error ?? 'Erro ao carregar indicadores')
        setDados(d)
      })
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro desconhecido'))
      .finally(() => setCarregando(false))
  }, [periodoAtivo])

  useEffect(() => {
    if (!dados) return
    setVendedoresSelecionados(new Set(dados.grandesOportunidades.map(g => g.vendedor)))
    setExpandidoOpp(false)
  }, [dados])

  // ─── Dados derivados ────────────────────────────────────────────────────────

  const primeiraCarreg = carregando && dados === null
  const vazio = !carregando && dados !== null && dados.desempenhoPorVendedor.length === 0

  const labels = (dados?.labels ?? []).map(formatLabel)
  const expectedCols = (tipoPeriodo === '3m' ? 3 : 6) + 2  // estimativa para skeleton

  const seriesRows = (dados?.desempenhoPorVendedor ?? []).map(s => ({
    nome: s.vendedor,
    periods: s.valoresPorPeriodo.map(v => formatMoeda(v.valor)),
    total: formatMoeda(s.total),
  }))

  const indic = dados?.indicadoresPorVendedor ?? []
  const indicRows = [
    { label: 'Orçamentos',          values: indic.map(v => String(v.orcamentos)) },
    { label: 'Clientes Orçados',     values: indic.map(v => String(v.clientesOrcados)) },
    { label: 'Valor Orçado',         values: indic.map(v => formatMoeda(v.valorOrcado)) },
    { label: 'Pedidos Vendidos',     values: indic.map(v => String(v.pedidosVendidos)) },
    { label: 'Clientes Compradores', values: indic.map(v => String(v.clientesCompradores)) },
    { label: 'Valor Vendido',        values: indic.map(v => formatMoeda(v.valorVendido)) },
  ]

  const oportunidades = dados?.grandesOportunidades ?? []
  const rankings = dados?.rankings

  const oppsVisiveis: OppComVendedor[] = oportunidades
    .filter(g => vendedoresSelecionados.has(g.vendedor))
    .flatMap(g => g.oportunidades.map(op => ({ ...op, vendedor: g.vendedor })))
    .sort((a, b) => b.valorOrcado - a.valorOrcado)

  const oppsExibidas = expandidoOpp ? oppsVisiveis : oppsVisiveis.slice(0, LIMITE_OPP)

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (erro) {
    return (
      <div className="flex flex-col animate-fadeIn">
        <p style={{ fontSize: 13, color: 'var(--critico)', padding: '24px 4px' }}>
          Erro ao carregar indicadores: {erro}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col animate-fadeIn">

      {/* ── Filtro de período ─────────────────────────────────────────────── */}
      <div className={styles.filtroBar} style={{ marginBottom: 36 }}>
        {OPCOES_PERIODO.map(op => (
          <button
            key={op.id}
            onClick={() => { setTipoPeriodo(op.id); if (op.id !== 'personalizado') { setCustomInicio(''); setCustomFim('') } }}
            className={`${styles.pfiltro} ${tipoPeriodo === op.id ? styles.pfiltroOn : ''}`}
            disabled={carregando && tipoPeriodo !== op.id}
          >
            {op.label}
          </button>
        ))}
        {tipoPeriodo === 'personalizado' && (
          <div className={styles.filtroCustom}>
            <span className={styles.filtroLbl}>De</span>
            <input
              type="date"
              value={customInicio}
              onChange={e => setCustomInicio(e.target.value)}
              className={styles.filtroDate}
            />
            <span className={styles.filtroLbl}>Até</span>
            <input
              type="date"
              value={customFim}
              onChange={e => setCustomFim(e.target.value)}
              className={styles.filtroDate}
            />
            {customInicio && customFim && customInicio > customFim && (
              <span style={{ fontSize: 12, color: 'var(--critico)' }}>
                Data início posterior ao fim
              </span>
            )}
            {!periodoAtivo && (!customInicio || !customFim) && (
              <span style={{ fontSize: 12, color: 'var(--ink3)' }}>
                Preencha as duas datas para carregar
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Desempenho por Vendedor ──────────────────────────────────────── */}
      <div>
        <div style={{ marginBottom: 20 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Desempenho por Vendedor</div>
          <div className={styles.scap}>
            {carregando
              ? 'Carregando indicadores…'
              : 'Valor vendido por vendedor no período selecionado.'}
          </div>
        </div>

        {vazio ? (
          <SemDados />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={thFirstStyle}>Vendedor</th>
                  {(primeiraCarreg
                    ? Array.from({ length: expectedCols - 2 }, (_, i) => `Col ${i + 1}`)
                    : labels
                  ).map(l => <th key={l} style={thStyle}>{primeiraCarreg ? '' : l}</th>)}
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>
              <tbody>
                {primeiraCarreg ? (
                  <SkeletonRows linhas={3} cols={expectedCols} />
                ) : (
                  seriesRows.map(v => (
                    <tr key={v.nome}>
                      <td style={tdStyle}>{v.nome}</td>
                      {v.periods.map((p, i) => (
                        <td key={i} style={{ ...tdStyle, textAlign: 'right' }} className={styles.num}>{p}</td>
                      ))}
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }} className={styles.num}>
                        {v.total}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!vazio && (
          <div className={styles.totalLine}>
            <div className={styles.over}>Total Comercial Atualizado</div>
            <div className={`${styles.totalVal} ${styles.serif} ${styles.num}`}>
              {primeiraCarreg ? '—' : formatMoeda(dados?.totalComercialAtualizado ?? 0)}
            </div>
          </div>
        )}
      </div>

      {/* ── Indicadores por Vendedor ─────────────────────────────────────── */}
      <div className={styles.dsection}>
        <div className={`${styles.stitle} ${styles.serif}`}>Indicadores por Vendedor</div>
        <div className={styles.scap}>
          {dados?.granularidade === 'mes'
            ? `${(dados?.labels ?? []).map(formatLabel).join(', ')}`
            : 'Período selecionado'}
        </div>

        {vazio ? (
          <SemDados />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={thFirstStyle}>Indicador</th>
                  {primeiraCarreg
                    ? Array.from({ length: 3 }).map((_, i) => <th key={i} style={thStyle} />)
                    : indic.map(v => <th key={v.vendedor} style={thStyle}>{v.vendedor}</th>)
                  }
                </tr>
              </thead>
              <tbody>
                {primeiraCarreg ? (
                  <SkeletonRows linhas={6} cols={4} />
                ) : (
                  indicRows.map(ind => (
                    <tr key={ind.label}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{ind.label}</td>
                      {ind.values.map((val, i) => (
                        <td key={i} style={{ ...tdStyle, textAlign: 'right' }} className={styles.num}>{val}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Grandes Oportunidades da Semana ─────────────────────────────── */}
      <div className={styles.dsection}>
        <div className={`${styles.stitle} ${styles.serif}`}>Grandes Oportunidades da Semana</div>
        <div className={styles.scap}>
          Pedidos orçados em aberto · top {LIMITE_OPP} por valor. Filtre por vendedor abaixo.
        </div>

        {primeiraCarreg ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 4px' }}>
            Carregando oportunidades…
          </p>
        ) : oportunidades.length === 0 ? (
          <SemDados mensagem="Nenhum orçamento em aberto para este período." />
        ) : (
          <>
            {/* Seleção de vendedores */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 28px', margin: '16px 0 22px', paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
              {oportunidades.map(g => (
                <label
                  key={g.vendedor}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}
                >
                  <input
                    type="checkbox"
                    checked={vendedoresSelecionados.has(g.vendedor)}
                    onChange={() =>
                      setVendedoresSelecionados(prev => {
                        const s = new Set(prev)
                        s.has(g.vendedor) ? s.delete(g.vendedor) : s.add(g.vendedor)
                        return s
                      })
                    }
                    style={{ accentColor: 'var(--accentCom)', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13 }}>{g.vendedor}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink3)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoeda(g.totalPipeline)}
                  </span>
                </label>
              ))}
            </div>

            {oppsExibidas.length === 0 ? (
              <SemDados mensagem="Nenhum vendedor selecionado." />
            ) : (
              <>
                {oppsExibidas.map(op => (
                  <div
                    key={op.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, padding: '14px 2px', borderBottom: '1px solid var(--line)' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.oppVendedor} style={{ marginBottom: 5 }}>{op.vendedor}</div>
                      <div className={styles.oppCliente}>{op.cliente}</div>
                      <div className={styles.oppDesc} style={{ marginTop: 3 }}>
                        {op.previsaoFechamento
                          ? `Previsão: ${formatData(op.previsaoFechamento)}`
                          : op.proximaAcao ?? '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className={`${styles.oppVal} ${styles.num}`}>{formatMoeda(op.valorOrcado)}</div>
                      <div className={styles.oppTag} style={{ marginTop: 6 }}>{diasAtras(op.dataOrcamento)}</div>
                    </div>
                  </div>
                ))}

                {oppsVisiveis.length > LIMITE_OPP && (
                  <button
                    onClick={() => setExpandidoOpp(e => !e)}
                    style={{ marginTop: 16, background: 'none', border: 'none', padding: 0, color: 'var(--accentCom)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.02em' }}
                  >
                    {expandidoOpp
                      ? 'Ocultar'
                      : `Ver mais ${oppsVisiveis.length - LIMITE_OPP} oportunidade${oppsVisiveis.length - LIMITE_OPP !== 1 ? 's' : ''}`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Ranking de Vendedores ────────────────────────────────────────── */}
      <div className={styles.dsection}>
        <div className={`${styles.stitle} ${styles.serif}`}>Ranking de Vendedores</div>
        <div className={styles.scap}>Posição e os números que a sustentam.</div>

        <div className={styles.rankTabs}>
          {RANK_TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.rankTab} ${rankTab === t.id ? styles.rankTabOn : ''}`}
              onClick={() => setRankTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {vazio && rankTab !== 'geral' ? (
          <SemDados />
        ) : (
          <>
            {/* Por Filial */}
            {rankTab === 'filial' && (() => {
              const filiais = [
                { nome: 'São Paulo', entradas: rankings?.porFilial.saoPaulo ?? [] },
                { nome: 'Paraná',    entradas: rankings?.porFilial.parana ?? [] },
              ]
              return primeiraCarreg ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 4px' }}>Carregando…</p>
              ) : filiais.map(fl => fl.entradas.length === 0 ? null : (
                <div key={fl.nome} className={styles.rankBlock}>
                  <div className={styles.rbHead}>
                    <span className={styles.rbName}>{fl.nome}</span>
                    <span className={`${styles.rbTotal} ${styles.num}`}>
                      {formatMoeda(fl.entradas.reduce((s, r) => s + r.valor, 0))}
                    </span>
                  </div>
                  <div className={styles.rankList}>
                    {fl.entradas.map(r => <RankRow key={r.vendedor} r={r} />)}
                  </div>
                </div>
              ))
            })()}

            {/* Valor Orçado */}
            {rankTab === 'orcado' && (
              primeiraCarreg ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 4px' }}>Carregando…</p>
              ) : (
                <div className={styles.rankList}>
                  {(rankings?.porValorOrcado ?? []).map(r => (
                    <RankRow
                      key={r.vendedor}
                      r={r}
                      meta={`${Number(r.detalhes.orcamentos ?? 0)} orçamentos`}
                    />
                  ))}
                </div>
              )
            )}

            {/* Valor Vendido */}
            {rankTab === 'vendido' && (
              primeiraCarreg ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 4px' }}>Carregando…</p>
              ) : (
                <div className={styles.rankList}>
                  {(rankings?.porValorVendido ?? []).map(r => (
                    <RankRow
                      key={r.vendedor}
                      r={r}
                      meta={formatMoeda(Number(r.detalhes.valorOrcado ?? 0)) + ' orçado'}
                    />
                  ))}
                </div>
              )
            )}

            {/* % Conversão — usa MetricaComFormula (conversão financeira) */}
            {rankTab === 'conversao' && (
              primeiraCarreg ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 4px' }}>Carregando…</p>
              ) : (
                <div className={styles.rankList}>
                  {(rankings?.conversaoFinanceira ?? []).map(r => {
                    const valorVendido = Number(r.detalhes.valorVendido ?? 0)
                    const valorOrcado  = Number(r.detalhes.valorOrcado  ?? 0)
                    return (
                      <div key={r.vendedor} className={styles.rRow} style={{ alignItems: 'flex-start' }}>
                        <span className={styles.rPos}>{r.posicao}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <MetricaComFormula
                            variant="compact"
                            label={r.vendedor}
                            valor={Math.round(r.valor * 100) + '%'}
                            formula={`${r.formula} · ${formatMoeda(valorVendido)} vendido de ${formatMoeda(valorOrcado)} orçado`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Produtividade — usa MetricaComFormula */}
            {rankTab === 'produtividade' && (
              primeiraCarreg ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 4px' }}>Carregando…</p>
              ) : (
                <div className={styles.rankList}>
                  {(rankings?.produtividade ?? []).map(r => {
                    const orcamentos    = Number(r.detalhes.orcamentos        ?? 0)
                    const clientes      = Number(r.detalhes.clientesDistintos  ?? 0)
                    const mediaDiaria   = r.detalhes.mediaDiaria != null ? Number(r.detalhes.mediaDiaria) : null
                    const detalheTexto  = `${orcamentos} orçamentos + ${clientes} clientes distintos` +
                      (mediaDiaria !== null ? ` = ${mediaDiaria}/dia útil` : '')
                    return (
                      <div key={r.vendedor} className={styles.rRow} style={{ alignItems: 'flex-start' }}>
                        <span className={styles.rPos}>{r.posicao}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <MetricaComFormula
                            variant="compact"
                            label={r.vendedor}
                            valor={String(r.valor)}
                            formula={`${r.formula} · ${detalheTexto}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Análise Geral — placeholder até integração narrativa */}
            {rankTab === 'geral' && (
              <div className={styles.gAnalysis}>
                <p style={{ fontStyle: 'italic' }}>
                  A análise narrativa será exibida aqui após integração completa dos dados do período.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Estilos de tabela compartilhados ─────────────────────────────────────────

const thStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
  borderBottom: '1px solid var(--line2)',
  padding: '12px 16px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const thFirstStyle: React.CSSProperties = { ...thStyle, textAlign: 'left' }

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13.5,
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
}

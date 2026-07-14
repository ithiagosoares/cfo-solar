'use client'

import { useState } from 'react'
import styles from '@/styles/editorial.module.css'
import { formatMoeda } from '@/lib/utils'

// Dados de referência (mock) — a conectar com a API do Upper
type VendedorBase = {
  nome: string
  filial: string
  orcamentos: number
  clientesOrcados: number
  valorOrcado: number
  pedidosVendidos: number
  clientesCompradores: number
  valorVendido: number
  semanas: number[]
  meses: number[]
}

const VENDEDORES: VendedorBase[] = [
  { nome: 'Carla Nunes',    filial: 'São Paulo', orcamentos: 44, clientesOrcados: 26, valorOrcado: 612000, pedidosVendidos: 34, clientesCompradores: 21, valorVendido: 498000, semanas: [130000,115000,128000,125000], meses: [165000,168000,165000] },
  { nome: 'Ana Ferreira',   filial: 'São Paulo', orcamentos: 38, clientesOrcados: 22, valorOrcado: 420000, pedidosVendidos: 29, clientesCompradores: 18, valorVendido: 356000, semanas: [82000,95000,78000,101000], meses: [118000,120000,118000] },
  { nome: 'Bruno Castilho', filial: 'São Paulo', orcamentos: 31, clientesOrcados: 19, valorOrcado: 298000, pedidosVendidos: 20, clientesCompradores: 14, valorVendido: 227000, semanas: [52000,60000,55000,60000], meses: [75000,76000,76000] },
  { nome: 'Elaine Sousa',   filial: 'Paraná',    orcamentos: 29, clientesOrcados: 17, valorOrcado: 265000, pedidosVendidos: 22, clientesCompradores: 15, valorVendido: 248000, semanas: [58000,64000,60000,66000], meses: [82000,83000,83000] },
  { nome: 'Diego Martins',  filial: 'Paraná',    orcamentos: 24, clientesOrcados: 15, valorOrcado: 214000, pedidosVendidos: 16, clientesCompradores: 11, valorVendido: 162000, semanas: [38000,40000,41000,43000], meses: [54000,54000,54000] },
]

const OPORTUNIDADES = [
  { vendedor: 'Carla Nunes',    cliente: 'Neo Solar Distribuidora',  produto: 'Estrutura Solo 4 Módulos — lote de 18 un.', valor: 128000, quando: 'Orçado há 3 dias' },
  { vendedor: 'Ana Ferreira',   cliente: 'EcoVolt Energia',          produto: 'Perfil de Alumínio 40mm — lote de 300 barras', valor: 64500, quando: 'Orçado há 5 dias' },
  { vendedor: 'Elaine Sousa',   cliente: 'Fotovolt Sul',             produto: 'Cabo Solar 6mm² — 1.200m', valor: 33800, quando: 'Orçado há 1 dia' },
  { vendedor: 'Diego Martins',  cliente: 'Sol Nascente Engenharia',  produto: 'Trilho de Fixação 2.10m — lote de 90 barras', valor: 47200, quando: 'Orçado há 6 dias' },
]

const GERAL_PARAGRAPHS = [
  'Carla Nunes segue como a maior geradora de receita da filial São Paulo, sustentada por contratos de maior porte com um número mais concentrado de clientes.',
  'Elaine Sousa tem a maior taxa de conversão da empresa, transformando quase todo o valor orçado em venda — um padrão de eficiência que se destaca mesmo com volume menor de propostas.',
  'A filial São Paulo responde por praticamente o triplo do valor vendido da filial Paraná, mas o ticket médio por vendedor é mais equilibrado entre as duas regiões do que sugere a diferença total.',
  'Diego Martins tem o menor volume absoluto do time neste trimestre, mas mantém conversão estável — o ponto de atenção está no volume de orçamentos gerados, não na eficiência de fechamento.',
]

type RankTab = 'filial' | 'orcado' | 'vendido' | 'conversao' | 'produtividade' | 'geral'

function withPos<T>(arr: T[], valFn: (v: T) => number, valFmt: (v: T) => string, metaFn?: (v: T) => string) {
  return [...arr]
    .sort((a, b) => valFn(b) - valFn(a))
    .map((v, i) => ({ pos: i + 1, nome: (v as VendedorBase).nome, val: valFmt(v), meta: metaFn?.(v) }))
}

export function ComercialDashboard() {
  const [period, setPeriod] = useState<'4s' | '3m'>('4s')
  const [rankTab, setRankTab] = useState<RankTab>('filial')

  const periodLabels = period === '4s'
    ? ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4']
    : ['Mês 1', 'Mês 2', 'Mês 3']

  const vendPeriodRows = VENDEDORES.map(v => ({
    nome: v.nome,
    periods: (period === '4s' ? v.semanas : v.meses).map(n => formatMoeda(n)),
    total: formatMoeda(v.valorVendido),
  }))

  const totalComercial = VENDEDORES.reduce((s, v) => s + v.valorVendido, 0)

  const indicadores = [
    { label: 'Orçamentos',           values: VENDEDORES.map(v => String(v.orcamentos)) },
    { label: 'Clientes Orçados',      values: VENDEDORES.map(v => String(v.clientesOrcados)) },
    { label: 'Valor Orçado',          values: VENDEDORES.map(v => formatMoeda(v.valorOrcado)) },
    { label: 'Pedidos Vendidos',      values: VENDEDORES.map(v => String(v.pedidosVendidos)) },
    { label: 'Clientes Compradores',  values: VENDEDORES.map(v => String(v.clientesCompradores)) },
    { label: 'Valor Vendido',         values: VENDEDORES.map(v => formatMoeda(v.valorVendido)) },
  ]

  const oppByVendor = Object.values(
    OPORTUNIDADES.reduce<Record<string, typeof OPORTUNIDADES>>((acc, it) => {
      ;(acc[it.vendedor] ??= []).push(it)
      return acc
    }, {})
  ).map(items => ({ vendedor: items[0].vendedor, items }))

  const rankOrcado = withPos(VENDEDORES, v => v.valorOrcado, v => formatMoeda(v.valorOrcado))
  const rankVendido = withPos(VENDEDORES, v => v.valorVendido, v => formatMoeda(v.valorVendido))
  const rankConversao = withPos(
    VENDEDORES,
    v => v.valorVendido / v.valorOrcado,
    v => Math.round((v.valorVendido / v.valorOrcado) * 100) + '%',
    v => `${formatMoeda(v.valorVendido)} vendido de ${formatMoeda(v.valorOrcado)} orçado`,
  )
  const rankProdutividade = withPos(
    VENDEDORES,
    v => v.valorVendido / v.pedidosVendidos,
    v => formatMoeda(Math.round(v.valorVendido / v.pedidosVendidos)) + ' / pedido',
    v => `${v.pedidosVendidos} pedidos vendidos`,
  )
  const rankFilial = ['São Paulo', 'Paraná'].map(filial => {
    const membros = VENDEDORES.filter(v => v.filial === filial)
    return {
      filial,
      total: formatMoeda(membros.reduce((s, v) => s + v.valorVendido, 0)),
      vendedores: withPos(membros, v => v.valorVendido, v => formatMoeda(v.valorVendido)),
    }
  })

  const RANK_TABS: { id: RankTab; label: string }[] = [
    { id: 'filial', label: 'Por Filial' },
    { id: 'orcado', label: 'Valor Orçado' },
    { id: 'vendido', label: 'Valor Vendido' },
    { id: 'conversao', label: '% Conversão' },
    { id: 'produtividade', label: 'Produtividade' },
    { id: 'geral', label: 'Análise Geral' },
  ]

  return (
    <div className="flex flex-col animate-fadeIn">

      {/* ── Desempenho por Vendedor ─────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
          <div>
            <div className={`${styles.stitle} ${styles.serif}`}>Desempenho por Vendedor</div>
            <div className={styles.scap}>Valor vendido por vendedor no período selecionado.</div>
          </div>
          <select
            className={styles.periodSel}
            value={period}
            onChange={e => setPeriod(e.target.value as '4s' | '3m')}
          >
            <option value="4s">Últimas 4 semanas</option>
            <option value="3m">Últimos 3 meses</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={thFirstStyle}>Vendedor</th>
                {periodLabels.map(l => <th key={l} style={thStyle}>{l}</th>)}
                <th style={thStyle}>Total</th>
              </tr>
            </thead>
            <tbody>
              {vendPeriodRows.map(v => (
                <tr key={v.nome}>
                  <td style={tdStyle}>{v.nome}</td>
                  {v.periods.map((p, i) => <td key={i} style={{ ...tdStyle, textAlign: 'right' }} className={styles.num}>{p}</td>)}
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }} className={styles.num}>{v.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.totalLine}>
          <div className={styles.over}>Total Comercial Atualizado</div>
          <div className={`${styles.totalVal} ${styles.serif} ${styles.num}`}>{formatMoeda(totalComercial)}</div>
        </div>
      </div>

      {/* ── Indicadores por Vendedor ──────────────────────────────────── */}
      <div className={styles.dsection}>
        <div className={`${styles.stitle} ${styles.serif}`}>Indicadores por Vendedor</div>
        <div className={styles.scap}>Ano fiscal 2026 · 2º trimestre</div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={thFirstStyle}>Indicador</th>
                {VENDEDORES.map(v => <th key={v.nome} style={thStyle}>{v.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {indicadores.map(ind => (
                <tr key={ind.label}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{ind.label}</td>
                  {ind.values.map((val, i) => (
                    <td key={i} style={{ ...tdStyle, textAlign: 'right' }} className={styles.num}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Grandes Oportunidades da Semana ───────────────────────────── */}
      <div className={styles.dsection}>
        <div className={`${styles.stitle} ${styles.serif}`}>Grandes Oportunidades da Semana</div>
        <div className={styles.scap}>Pedidos orçados que ainda não viraram venda, por vendedor.</div>

        <div className={styles.oppGrid}>
          {oppByVendor.map(g => (
            <div key={g.vendedor} className={styles.oppCard}>
              <div className={styles.oppVendedor}>{g.vendedor}</div>
              {g.items.map((it, i) => (
                <div key={i} className={styles.oppItem}>
                  <div className={styles.oppCliente}>{it.cliente}</div>
                  <div className={styles.oppDesc}>{it.produto}</div>
                  <div className={styles.oppMeta}>
                    <span className={styles.oppTag}>{it.quando}</span>
                    <span className={`${styles.oppVal} ${styles.num}`}>{formatMoeda(it.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Ranking de Vendedores ─────────────────────────────────────── */}
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

        {rankTab === 'filial' && rankFilial.map(fl => (
          <div key={fl.filial} className={styles.rankBlock}>
            <div className={styles.rbHead}>
              <span className={styles.rbName}>{fl.filial}</span>
              <span className={`${styles.rbTotal} ${styles.num}`}>{fl.total}</span>
            </div>
            <div className={styles.rankList}>
              {fl.vendedores.map(r => (
                <div key={r.nome} className={styles.rRow}>
                  <span className={styles.rPos}>{r.pos}</span>
                  <span className={styles.rName}>{r.nome}</span>
                  <span className={`${styles.rVal} ${styles.num}`}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {rankTab === 'orcado' && (
          <div className={styles.rankList}>
            {rankOrcado.map(r => (
              <div key={r.nome} className={styles.rRow}>
                <span className={styles.rPos}>{r.pos}</span>
                <span className={styles.rName}>{r.nome}</span>
                <span className={`${styles.rVal} ${styles.num}`}>{r.val}</span>
              </div>
            ))}
          </div>
        )}

        {rankTab === 'vendido' && (
          <div className={styles.rankList}>
            {rankVendido.map(r => (
              <div key={r.nome} className={styles.rRow}>
                <span className={styles.rPos}>{r.pos}</span>
                <span className={styles.rName}>{r.nome}</span>
                <span className={`${styles.rVal} ${styles.num}`}>{r.val}</span>
              </div>
            ))}
          </div>
        )}

        {rankTab === 'conversao' && (
          <div className={styles.rankList}>
            {rankConversao.map(r => (
              <div key={r.nome} className={styles.rRow}>
                <span className={styles.rPos}>{r.pos}</span>
                <span className={styles.rName}>{r.nome}</span>
                <span className={styles.rMeta}>{r.meta}</span>
                <span className={`${styles.rVal} ${styles.num}`}>{r.val}</span>
              </div>
            ))}
          </div>
        )}

        {rankTab === 'produtividade' && (
          <div className={styles.rankList}>
            {rankProdutividade.map(r => (
              <div key={r.nome} className={styles.rRow}>
                <span className={styles.rPos}>{r.pos}</span>
                <span className={styles.rName}>{r.nome}</span>
                <span className={styles.rMeta}>{r.meta}</span>
                <span className={`${styles.rVal} ${styles.num}`}>{r.val}</span>
              </div>
            ))}
          </div>
        )}

        {rankTab === 'geral' && (
          <div className={styles.gAnalysis}>
            {GERAL_PARAGRAPHS.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared table styles ──────────────────────────────────────────────────────

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

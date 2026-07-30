'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { formatMoeda } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

const POR_PAGINA = 20

type Periodo = '4s' | '3m' | 'personalizado'

interface VendaResumo {
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  valorVendido: number
  dataVenda: string
  origem: string
  numeroPedido: string | null
}

interface VendasApiResponse {
  ok: boolean
  vendas?: VendaResumo[]
  total?: number
  totalVendido?: number
  totalVendidoOficial?: number | null
  quantidadeVendasOficial?: number | null
  fonteOficial?: string | null
  divergenciaOficial?: number | null
}

function periodoParaDatas(p: '4s' | '3m'): { inicio: string; fim: string } {
  const hoje = new Date()
  const fim  = hoje.toISOString().slice(0, 10)
  const ini  = new Date(hoje)
  if (p === '4s') ini.setDate(hoje.getDate() - 28)
  else ini.setMonth(hoje.getMonth() - 3)
  return { inicio: ini.toISOString().slice(0, 10), fim }
}

function fmtData(d: string): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export default function VendasPage() {
  const [papel, setPapel] = useState<string | null>(null)
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

  const [periodo, setPeriodo] = useState<Periodo>('3m')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState<{ inicio: string; fim: string }>(
    () => periodoParaDatas('3m'),
  )

  const [vendas, setVendas] = useState<VendaResumo[]>([])
  const [total, setTotal] = useState(0)
  const [totalVendido, setTotalVendido] = useState(0)
  const [totalVendidoOficial, setTotalVendidoOficial] = useState<number | null>(null)
  const [quantidadeVendasOficial, setQuantidadeVendasOficial] = useState<number | null>(null)
  const [divergenciaOficial, setDivergenciaOficial] = useState<number | null>(null)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)

  const eVendedor = papel === 'vendedor'

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string }>)
      .then(d => setPapel(d.papel ?? 'sem_acesso'))
      .catch(() => setPapel('sem_acesso'))
  }, [])

  useEffect(() => {
    if (papel === null || papel === 'vendedor') return
    fetch('/api/comercial/vendedores')
      .then(r => r.json() as Promise<{ ok: boolean; vendedores?: { id: string; nome: string }[] }>)
      .then(json => {
        if (json.ok && json.vendedores) {
          const mapa: Record<string, string> = {}
          json.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }
      })
      .catch(() => {})
  }, [papel])

  useEffect(() => {
    if (papel !== null) buscarVendas(1, true)
  }, [papel, filtroAtivo.inicio, filtroAtivo.fim]) // eslint-disable-line react-hooks/exhaustive-deps

  async function buscarVendas(pagina: number, reset: boolean) {
    if (reset) setCarregandoLista(true)
    else setCarregandoMais(true)
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) })
      if (filtroAtivo.inicio) params.set('periodoInicio', filtroAtivo.inicio)
      if (filtroAtivo.fim)    params.set('periodoFim',    filtroAtivo.fim)

      const res  = await fetch(`/api/vendas?${params}`)
      const json = await res.json() as VendasApiResponse
      if (!json.ok) return
      const novas = json.vendas ?? []
      setVendas(prev => reset ? novas : [...prev, ...novas])
      setTotal(json.total ?? 0)
      setTotalVendido(json.totalVendido ?? 0)
      setTotalVendidoOficial(json.totalVendidoOficial ?? null)
      setQuantidadeVendasOficial(json.quantidadeVendasOficial ?? null)
      setDivergenciaOficial(json.divergenciaOficial ?? null)
      setPaginaAtual(pagina)
    } finally {
      if (reset) setCarregandoLista(false)
      else setCarregandoMais(false)
    }
  }

  function selecionarPreset(p: '4s' | '3m') {
    setPeriodo(p)
    setFiltroAtivo(periodoParaDatas(p))
  }

  function aplicarPersonalizado() {
    if (!customInicio || !customFim) return
    setFiltroAtivo({ inicio: customInicio, fim: customFim })
  }

  if (papel === null) {
    return (
      <div className={styles.page} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
        />
      </div>
    )
  }

  const temMais = vendas.length < total
  const colGrid = eVendedor
    ? '2.5fr 1.2fr 1.3fr .9fr'
    : '2fr 1fr 1.2fr 1.3fr .9fr'

  // Valor a exibir como total principal: oficial (ERP) se disponível, senão calculado
  const valorExibido  = totalVendidoOficial ?? totalVendido
  const usouOficial   = totalVendidoOficial !== null

  return (
    <div className={styles.page} style={{ minHeight: '100vh' }}>

      {/* Topo */}
      <div style={{ borderBottom: '1px solid var(--line)', padding: '18px 0' }}>
        <div className={styles.wrap} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a
            href="/inicio"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Início
          </a>
          <img src="/logo.png" alt="CFO.IA" style={{ height: 36, width: 'auto' }} />
        </div>
      </div>

      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72 }}>

        {/* Cabeçalho */}
        <div className={styles.shead} style={{ marginBottom: 28, alignItems: 'flex-end' }}>
          <div>
            <h1 className={styles.serif} style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
              {eVendedor ? 'Minhas vendas' : 'Vendas'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink2)' }}>
              {eVendedor
                ? 'Orçamentos convertidos em venda na sua carteira.'
                : 'Orçamentos convertidos em venda no período selecionado.'}
            </p>
          </div>
        </div>

        {/* Seletor de período */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28, alignItems: 'center' }}>
          {(['4s', '3m'] as const).map(p => (
            <button
              key={p}
              onClick={() => selecionarPreset(p)}
              className={periodo === p ? styles.btnPrimary : styles.btn}
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              {p === '4s' ? 'Últ. 4 semanas' : 'Últ. 3 meses'}
            </button>
          ))}
          <button
            onClick={() => setPeriodo('personalizado')}
            className={periodo === 'personalizado' ? styles.btnPrimary : styles.btn}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            Personalizado
          </button>

          {periodo === 'personalizado' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 4 }}>
              <input
                type="date"
                value={customInicio}
                onChange={e => setCustomInicio(e.target.value)}
                style={{
                  fontSize: 12, padding: '5px 10px',
                  border: '1px solid var(--line2)', borderRadius: 4,
                  background: 'var(--cor-superficie)', color: 'var(--cor-texto)',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--ink3)' }}>até</span>
              <input
                type="date"
                value={customFim}
                onChange={e => setCustomFim(e.target.value)}
                style={{
                  fontSize: 12, padding: '5px 10px',
                  border: '1px solid var(--line2)', borderRadius: 4,
                  background: 'var(--cor-superficie)', color: 'var(--cor-texto)',
                }}
              />
              <button
                onClick={aplicarPersonalizado}
                disabled={!customInicio || !customFim}
                className={styles.btnPrimary}
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                Aplicar
              </button>
            </div>
          )}
        </div>

        {/* Card de resumo */}
        {!carregandoLista && (
          <div
            className={styles.panel}
            style={{ marginBottom: 32, display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}
          >
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>
                Total vendido
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <p className={styles.num} style={{ fontSize: 28, fontWeight: 700, color: 'var(--cor-destaque)' }}>
                  {formatMoeda(valorExibido)}
                </p>
                {usouOficial && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cor-destaque)', letterSpacing: '.05em' }}>
                    ✓ Total oficial
                  </span>
                )}
              </div>

              {/* Divergência: listagem calculada difere do total ERP */}
              {divergenciaOficial !== null && divergenciaOficial > 0.01 && (
                <p style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6, lineHeight: 1.5 }}>
                  Diferença de {formatMoeda(divergenciaOficial)} em relação à listagem
                  {quantidadeVendasOficial !== null && total > 0 && quantidadeVendasOficial > total
                    ? ` — ${quantidadeVendasOficial - total} venda(s) sem orçamento correspondente`
                    : ''}.
                </p>
              )}
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>
                Vendas no período
              </p>
              <p className={styles.num} style={{ fontSize: 28, fontWeight: 700 }}>
                {quantidadeVendasOficial ?? total}
                {quantidadeVendasOficial !== null && (
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink3)', marginLeft: 6 }}>
                    (oficial)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Lista */}
        {carregandoLista ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p>
        ) : vendas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
            {eVendedor
              ? 'Nenhuma venda encontrada para o período.'
              : 'Nenhuma venda registrada no período selecionado.'}
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <span className={styles.over}>{total} registros</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {/* Cabeçalho da tabela */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: colGrid,
                  gap: '0 16px',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line2)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--ink3)',
                  minWidth: 520,
                }}
              >
                <div>Cliente</div>
                {!eVendedor && <div>Vendedor</div>}
                <div>Empresa / Filial</div>
                <div style={{ textAlign: 'right' }}>Valor Vendido</div>
                <div>Data Venda</div>
              </div>

              {/* Linhas */}
              {vendas.map((v, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colGrid,
                    gap: '0 16px',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 13,
                    alignItems: 'center',
                    minWidth: 520,
                  }}
                >
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.cliente}
                  </div>
                  {!eVendedor && (
                    <div style={{ color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.vendedorId ? (mapaVendedores[v.vendedorId] ?? '—') : '—'}
                    </div>
                  )}
                  <div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.empresa}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 1 }}>{v.filial}</div>
                  </div>
                  <div className={styles.num} style={{ textAlign: 'right', fontSize: 13 }}>
                    {formatMoeda(v.valorVendido)}
                  </div>
                  <div className={styles.num} style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
                    {fmtData(v.dataVenda)}
                  </div>
                </div>
              ))}
            </div>

            {temMais && (
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={() => buscarVendas(paginaAtual + 1, false)}
                  disabled={carregandoMais}
                  className={styles.btn}
                  style={{ fontSize: 13 }}
                >
                  {carregandoMais ? 'Carregando…' : `Carregar mais (${total - vendas.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

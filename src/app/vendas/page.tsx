'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatMoeda } from '@/lib/utils'
import AppLayout from '@/components/layout/AppLayout'
import { FilterBar, FilterInput, FilterSelect, FilterMonth, FilterNumberRange } from '@/components/filters/FilterBar'
import styles from '@/styles/editorial.module.css'

const POR_PAGINA = 20

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

function defaultPeriodo(): { inicio: string; fim: string } {
  const hoje = new Date()
  const fim  = hoje.toISOString().slice(0, 10)
  const ini  = new Date(hoje)
  ini.setMonth(hoje.getMonth() - 3)
  return { inicio: ini.toISOString().slice(0, 10), fim }
}

function mesParaRange(mes: string): { inicio: string; fim: string } {
  // mes = 'YYYY-MM'
  const [y, m] = mes.split('-').map(Number)
  const inicio = `${y}-${String(m).padStart(2, '0')}-01`
  const ultimo = new Date(y, m, 0).getDate()
  const fim    = `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
  return { inicio, fim }
}

type Filtros = { busca: string; mes: string; valorMin: string; valorMax: string; vendedorId: string }
const FILTROS_ZERO: Filtros = { busca: '', mes: '', valorMin: '', valorMax: '', vendedorId: '' }

function temFiltroAtivo(f: Filtros) {
  return f.busca || f.mes || f.valorMin || f.valorMax || f.vendedorId
}

function fmtData(d: string): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export default function VendasPage() {
  const [papel, setPapel] = useState<string | null>(null)
  const [vendedoresOpt, setVendedoresOpt] = useState<{ id: string; nome: string }[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

  const [filtro, setFiltro] = useState<Filtros>(FILTROS_ZERO)
  const [filtroAtivo, setFiltroAtivo] = useState<Filtros>(FILTROS_ZERO)

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
          setVendedoresOpt(json.vendedores)
          const mapa: Record<string, string> = {}
          json.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }
      })
      .catch(() => {})
  }, [papel])

  const buscarVendas = useCallback(async (pagina: number, reset: boolean, fa: Filtros) => {
    if (reset) setCarregandoLista(true)
    else setCarregandoMais(true)
    try {
      const periodo = fa.mes ? mesParaRange(fa.mes) : defaultPeriodo()
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) })
      params.set('periodoInicio', periodo.inicio)
      params.set('periodoFim',    periodo.fim)
      if (fa.busca)     params.set('busca',      fa.busca)
      if (fa.valorMin)  params.set('valorMin',   fa.valorMin)
      if (fa.valorMax)  params.set('valorMax',   fa.valorMax)
      if (fa.vendedorId) params.set('vendedor_id', fa.vendedorId)
      window.history.replaceState(null, '', `?${params}`)

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
  }, [])

  useEffect(() => {
    if (papel !== null) buscarVendas(1, true, filtroAtivo)
  }, [papel, filtroAtivo]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltrar() { setFiltroAtivo({ ...filtro }) }
  function handleLimpar()  { setFiltro(FILTROS_ZERO); setFiltroAtivo(FILTROS_ZERO) }

  if (papel === null) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
          />
        </div>
      </AppLayout>
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
    <AppLayout>
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

        {/* Filtros */}
        <FilterBar
          onFiltrar={handleFiltrar}
          onLimpar={handleLimpar}
          resultLabel={!carregandoLista && temFiltroAtivo(filtroAtivo)
            ? `${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`
            : undefined}
        >
          <FilterInput
            label="Cliente"
            value={filtro.busca}
            onChange={v => setFiltro(f => ({ ...f, busca: v }))}
            placeholder="Buscar cliente…"
          />
          <FilterMonth
            label="Mês"
            value={filtro.mes}
            onChange={v => setFiltro(f => ({ ...f, mes: v }))}
            width={165}
          />
          <FilterNumberRange
            label="Valor vendido (R$)"
            from={filtro.valorMin}
            to={filtro.valorMax}
            onFrom={v => setFiltro(f => ({ ...f, valorMin: v }))}
            onTo={v => setFiltro(f => ({ ...f, valorMax: v }))}
          />
          {!eVendedor && vendedoresOpt.length > 0 && (
            <FilterSelect
              label="Vendedor"
              value={filtro.vendedorId}
              onChange={v => setFiltro(f => ({ ...f, vendedorId: v }))}
              options={vendedoresOpt.map(v => ({ value: v.id, label: v.nome }))}
              width={170}
            />
          )}
        </FilterBar>

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
            {!temFiltroAtivo(filtroAtivo) && (
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <span className={styles.over}>{total} registros</span>
              </div>
            )}
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
                  onClick={() => buscarVendas(paginaAtual + 1, false, filtroAtivo)}
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
    </AppLayout>
  )
}

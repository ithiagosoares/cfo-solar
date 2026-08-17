'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { formatMoeda } from '@/lib/utils'
import AppLayout from '@/components/layout/AppLayout'
import { FilterBar, FilterInput, FilterSelect, FilterDateRange, FilterCheckbox } from '@/components/filters/FilterBar'
import styles from '@/styles/editorial.module.css'

const POR_PAGINA = 20

type StatusPedido = 'orcado' | 'vendido' | 'perdido'

interface PedidoResumo {
  id: string
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  valorOrcado: number
  dataOrcamento: string | null
  status: StatusPedido
  valorVendido: number | null
  dataVenda: string | null
  origem: string
  numeroPedido: string | null
  criadoEm: string
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

const STATUS_OPTS = [
  { value: 'orcado',  label: 'Aberto' },
  { value: 'vendido', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
]

type Filtros = { busca: string; status: string; dataInicio: string; dataFim: string; vendedorId: string; mostrarArquivados: boolean }
const FILTROS_ZERO: Filtros = { busca: '', status: '', dataInicio: '', dataFim: '', vendedorId: '', mostrarArquivados: false }

function filtrosParaUrl(f: Filtros, pagina: number): URLSearchParams {
  const p = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) })
  if (f.busca)       p.set('busca',      f.busca)
  if (f.status)      p.set('status',     f.status)
  if (f.dataInicio)  p.set('dataInicio', f.dataInicio)
  if (f.dataFim)     p.set('dataFim',    f.dataFim)
  if (f.vendedorId)          p.set('vendedor_id', f.vendedorId)
  if (f.mostrarArquivados)   p.set('arquivados', '1')
  return p
}

function temFiltroAtivo(f: Filtros) {
  return f.busca || f.status || f.dataInicio || f.dataFim || f.vendedorId
}

export default function OrcamentosPage() {
  const [papel, setPapel] = useState<string | null>(null)
  const [vendedoresOpt, setVendedoresOpt] = useState<{ id: string; nome: string }[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

  const [filtro, setFiltro] = useState<Filtros>(FILTROS_ZERO)
  const [filtroAtivo, setFiltroAtivo] = useState<Filtros>(FILTROS_ZERO)

  const [pedidos, setPedidos] = useState<PedidoResumo[]>([])
  const [total, setTotal] = useState(0)
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

  const buscarPedidos = useCallback(async (pagina: number, reset: boolean, fa: Filtros) => {
    if (reset) setCarregandoLista(true)
    else setCarregandoMais(true)
    try {
      const params = filtrosParaUrl(fa, pagina)
      // Update URL without re-render
      window.history.replaceState(null, '', `?${params}`)
      const res = await fetch(`/api/orcamentos?${params}`)
      const json = await res.json() as { ok: boolean; pedidos?: PedidoResumo[]; total?: number }
      if (!json.ok) return
      const novos = json.pedidos ?? []
      setPedidos(prev => reset ? novos : [...prev, ...novos])
      setTotal(json.total ?? 0)
      setPaginaAtual(pagina)
    } finally {
      if (reset) setCarregandoLista(false)
      else setCarregandoMais(false)
    }
  }, [])

  useEffect(() => {
    if (papel !== null) buscarPedidos(1, true, filtroAtivo)
  }, [papel, filtroAtivo]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltrar() {
    setFiltroAtivo({ ...filtro })
  }

  function handleLimpar() {
    setFiltro(FILTROS_ZERO)
    setFiltroAtivo(FILTROS_ZERO)
  }

  async function arquivarInLinha(id: string, arquivar: boolean) {
    const res = await fetch(`/api/orcamentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arquivar }),
    })
    if (res.ok) buscarPedidos(1, true, filtroAtivo)
  }

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

  const temMais = pedidos.length < total
  const colGrid = eVendedor
    ? '2fr 1.3fr .9fr .9fr .65fr auto'
    : '2fr .9fr 1.3fr .9fr .9fr .65fr auto'

  return (
    <AppLayout>
      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72 }}>

        <div className={styles.shead} style={{ marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <h1 className={styles.serif} style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
              {eVendedor ? 'Minha carteira' : 'Orçamentos'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink2)' }}>
              {eVendedor
                ? 'Orçamentos e pedidos da sua carteira.'
                : 'Todos os orçamentos e pedidos cadastrados.'}
            </p>
          </div>
          <a
            href="/orcamentos/cadastro"
            className={styles.btnPrimary}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, textDecoration: 'none', flexShrink: 0 }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Cadastrar
          </a>
        </div>

        <FilterBar
          onFiltrar={handleFiltrar}
          onLimpar={handleLimpar}
          resultLabel={!carregandoLista && temFiltroAtivo(filtroAtivo)
            ? `${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`
            : undefined}
        >
          <FilterInput
            label="Empresa"
            value={filtro.busca}
            onChange={v => setFiltro(f => ({ ...f, busca: v }))}
            placeholder="Buscar empresa…"
          />
          <FilterSelect
            label="Status"
            value={filtro.status}
            onChange={v => setFiltro(f => ({ ...f, status: v }))}
            options={STATUS_OPTS}
            width={130}
          />
          <FilterDateRange
            label="Data do orçamento"
            from={filtro.dataInicio}
            to={filtro.dataFim}
            onFrom={v => setFiltro(f => ({ ...f, dataInicio: v }))}
            onTo={v => setFiltro(f => ({ ...f, dataFim: v }))}
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
          <FilterCheckbox
            label="Mostrar arquivados"
            checked={filtro.mostrarArquivados}
            onChange={v => {
              setFiltro(f => ({ ...f, mostrarArquivados: v }))
              setFiltroAtivo(f => ({ ...f, mostrarArquivados: v }))
            }}
          />
        </FilterBar>

        {carregandoLista ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p>
        ) : pedidos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
            {eVendedor ? 'Nenhum orçamento na sua carteira ainda.' : 'Nenhum orçamento cadastrado ainda.'}
          </p>
        ) : (
          <>
            {!temFiltroAtivo(filtroAtivo) && (
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <span className={styles.over}>{total} registros</span>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
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
                  minWidth: 560,
                }}
              >
                <div>Cliente</div>
                {!eVendedor && <div>Vendedor</div>}
                <div>Empresa / Filial</div>
                <div style={{ textAlign: 'right' }}>Valor Orçado</div>
                <div>Data</div>
                <div>Status</div>
                <div />
              </div>

              {pedidos.map((p) => (
                <a
                  key={p.id}
                  href={`/orcamentos/${p.id}/editar`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colGrid,
                    gap: '0 16px',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 13,
                    alignItems: 'center',
                    minWidth: 560,
                    textDecoration: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--cor-destaque-suave)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.cliente}
                  </div>
                  {!eVendedor && (
                    <div style={{ color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.vendedorId ? (mapaVendedores[p.vendedorId] ?? '—') : '—'}
                    </div>
                  )}
                  <div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.empresa}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 1 }}>{p.filial}</div>
                  </div>
                  <div className={styles.num} style={{ textAlign: 'right', fontSize: 13 }}>
                    {formatMoeda(p.valorOrcado)}
                  </div>
                  <div className={styles.num} style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
                    {fmtData(p.dataOrcamento)}
                  </div>
                  <div>
                    <span className={p.status === 'vendido' ? styles.badgeVen : p.status === 'perdido' ? styles.badgePer : styles.badgeOrc}>
                      {p.status === 'vendido' ? 'Vendido' : p.status === 'perdido' ? 'Perdido' : 'Orçado'}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); void arquivarInLinha(p.id, !filtroAtivo.mostrarArquivados) }}
                      style={{
                        background: 'none',
                        border: '1px solid var(--cor-borda-sutil)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 11,
                        color: 'var(--cor-texto-suave)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {filtroAtivo.mostrarArquivados ? 'Restaurar' : 'Arquivar'}
                    </button>
                  </div>
                </a>
              ))}
            </div>

            {temMais && (
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={() => buscarPedidos(paginaAtual + 1, false, filtroAtivo)}
                  disabled={carregandoMais}
                  className={styles.btn}
                  style={{ fontSize: 13 }}
                >
                  {carregandoMais ? 'Carregando…' : `Carregar mais (${total - pedidos.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </AppLayout>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { formatMoeda } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

const POR_PAGINA = 20

type StatusPedido = 'orcado' | 'vendido'

interface PedidoResumo {
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

export default function OrcamentosPage() {
  const [papel, setPapel] = useState<string | null>(null)
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

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
          const mapa: Record<string, string> = {}
          json.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }
      })
      .catch(() => {})
  }, [papel])

  useEffect(() => {
    if (papel !== null) buscarPedidos(1, true)
  }, [papel]) // eslint-disable-line react-hooks/exhaustive-deps

  async function buscarPedidos(pagina: number, reset: boolean) {
    if (reset) setCarregandoLista(true)
    else setCarregandoMais(true)
    try {
      const res = await fetch(`/api/orcamentos?pagina=${pagina}&porPagina=${POR_PAGINA}`)
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

  const temMais = pedidos.length < total
  const colGrid = eVendedor
    ? '2fr 1.3fr .9fr .9fr .65fr'
    : '2fr .9fr 1.3fr .9fr .9fr .65fr'

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

        {/* Cabeçalho da seção */}
        <div className={styles.shead} style={{ marginBottom: 28, alignItems: 'flex-end' }}>
          <div>
            <h1 className={`${styles.serif}`} style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
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

        {carregandoLista ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p>
        ) : pedidos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
            {eVendedor ? 'Nenhum orçamento na sua carteira ainda.' : 'Nenhum orçamento cadastrado ainda.'}
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <span className={styles.over}>{total} registros</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {/* Cabeçalho */}
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
              </div>

              {/* Linhas */}
              {pedidos.map((p, i) => (
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
                    minWidth: 560,
                  }}
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
                    <span className={p.status === 'vendido' ? styles.badgeVen : styles.badgeOrc}>
                      {p.status === 'vendido' ? 'Vendido' : 'Orçado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {temMais && (
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={() => buscarPedidos(paginaAtual + 1, false)}
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
    </div>
  )
}

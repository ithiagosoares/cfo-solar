'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatMoeda } from '@/lib/utils'
import AppLayout from '@/components/layout/AppLayout'
import UploadOrcamentoPdf from '@/components/comercial/UploadOrcamentoPdf'
import styles from '@/styles/editorial.module.css'

const POR_PAGINA = 30

interface PedidoSemPdf {
  id: string
  numeroPedido: string | null
  cliente: string
  empresa: string
  filial: string
  valorOrcado: number
  dataOrcamento: string | null
  vendedorId: string | null
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export default function PaginaImportacaoOrcamento() {
  const [papel, setPapel] = useState<string | null>(null)
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

  const [pedidos, setPedidos] = useState<PedidoSemPdf[]>([])
  const [total, setTotal] = useState(0)
  const [totalComPdf, setTotalComPdf] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)

  const [selecionado, setSelecionado] = useState<PedidoSemPdf | null>(null)

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

  const buscarPedidos = useCallback(async (pagina: number, reset: boolean) => {
    if (reset) setCarregando(true)
    else setCarregandoMais(true)
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA), sem_pdf: '1' })
      const res = await fetch(`/api/orcamentos?${params}`)
      const json = await res.json() as { ok: boolean; pedidos?: PedidoSemPdf[]; total?: number }
      if (!json.ok) return
      const novos = json.pedidos ?? []
      setPedidos(prev => reset ? novos : [...prev, ...novos])
      setTotal(json.total ?? 0)
      setPaginaAtual(pagina)
    } finally {
      if (reset) setCarregando(false)
      else setCarregandoMais(false)
    }
  }, [])

  const buscarTotalComPdf = useCallback(async () => {
    const res = await fetch(`/api/orcamentos?pagina=1&porPagina=1&com_pdf=1`)
    const json = await res.json() as { ok: boolean; total?: number }
    if (json.ok) setTotalComPdf(json.total ?? 0)
  }, [])

  useEffect(() => {
    if (papel === null) return
    buscarPedidos(1, true)
    buscarTotalComPdf()
  }, [papel, buscarPedidos, buscarTotalComPdf])

  function handleVinculado() {
    setSelecionado(null)
    buscarPedidos(1, true)
    buscarTotalComPdf()
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

  const eVendedor = papel === 'vendedor'
  const temMais = pedidos.length < total

  return (
    <AppLayout>
      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72 }}>

        <div className={styles.shead} style={{ marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <h1 className={styles.serif} style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
              Importar PDF de Orçamento
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink2)' }}>
              Selecione um orçamento já cadastrado e anexe o PDF correspondente para extrair os itens automaticamente.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* ── ESQUERDA: métricas + lista ─────────────────────────────────── */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div className={styles.panel}>
                <div className={styles.panelTitulo}>Aguardando PDF</div>
                <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 32, fontWeight: 500 }}>{total}</div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelTitulo}>Com PDF vinculado</div>
                <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 32, fontWeight: 500 }}>{totalComPdf}</div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelTitulo}>Total de orçamentos</div>
                <div className={`${styles.num} ${styles.serif}`} style={{ fontSize: 32, fontWeight: 500 }}>{total + totalComPdf}</div>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelTitulo}>Orçamentos aguardando PDF</div>

              {carregando ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p>
              ) : pedidos.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
                  Nenhum orçamento aguardando PDF{eVendedor ? ' na sua carteira' : ''}.
                </p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: eVendedor ? '.8fr 1.6fr .9fr .8fr' : '.8fr 1.6fr .9fr .8fr 1fr',
                        gap: '0 14px',
                        padding: '0 4px 11px',
                        borderBottom: '1px solid var(--line2)',
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: '.11em',
                        textTransform: 'uppercase' as const,
                        color: 'var(--ink3)',
                        minWidth: 560,
                      }}
                    >
                      <div>Nº Pedido</div>
                      <div>Cliente</div>
                      <div style={{ textAlign: 'right' }}>Valor</div>
                      <div>Data</div>
                      {!eVendedor && <div>Vendedor</div>}
                    </div>

                    {pedidos.map(p => {
                      const ativo = selecionado?.id === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelecionado(p)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: eVendedor ? '.8fr 1.6fr .9fr .8fr' : '.8fr 1.6fr .9fr .8fr 1fr',
                            gap: '0 14px',
                            padding: '14px 4px',
                            borderBottom: '1px solid var(--line)',
                            background: ativo ? 'var(--cor-destaque-suave)' : 'none',
                            border: 'none',
                            borderBottomWidth: 1,
                            borderBottomStyle: 'solid',
                            borderBottomColor: 'var(--line)',
                            width: '100%',
                            minWidth: 560,
                            textAlign: 'left',
                            cursor: 'pointer',
                            font: 'inherit',
                            color: 'inherit',
                          }}
                        >
                          <div className={styles.num} style={{ fontWeight: 500 }}>
                            {p.numeroPedido ? `#${p.numeroPedido}` : '—'}
                          </div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>
                          <div className={styles.num} style={{ textAlign: 'right' }}>{formatMoeda(p.valorOrcado)}</div>
                          <div className={styles.num} style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{fmtData(p.dataOrcamento)}</div>
                          {!eVendedor && (
                            <div style={{ fontSize: 12.5, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.vendedorId ? (mapaVendedores[p.vendedorId] ?? '—') : '—'}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {temMais && (
                    <div style={{ marginTop: 20 }}>
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
            </div>
          </div>

          {/* ── DIREITA: painel de importação, sempre visível ──────────────── */}
          <div className={styles.panel} style={{ position: 'sticky', top: 24 }}>
            <div className={styles.panelTitulo}>Importação</div>

            {selecionado ? (
              <div>
                <div
                  style={{
                    background: 'var(--cor-destaque-suave)',
                    border: '1px solid var(--cor-borda)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 18,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {selecionado.numeroPedido ? `#${selecionado.numeroPedido}` : 'Sem número'} — {selecionado.cliente}
                  </div>
                  <div className={styles.num} style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>
                    {formatMoeda(selecionado.valorOrcado)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelecionado(null)}
                    style={{
                      marginTop: 8,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: 12,
                      color: 'var(--ink3)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textDecoration: 'underline',
                    }}
                  >
                    Trocar orçamento
                  </button>
                </div>

                <UploadOrcamentoPdf
                  pedidoId={selecionado.id}
                  jaTemPdf={false}
                  onVinculado={handleVinculado}
                />
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
                Selecione um orçamento na lista à esquerda para anexar o PDF correspondente.
              </p>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  )
}

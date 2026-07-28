'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import { formatMoeda } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

// ─── Constantes ───────────────────────────────────────────────────────────────

const EMPRESAS = [
  'CFO Solar Estruturas Ltda',
  'CFO Solar Distribuição Norte',
  'CFO Solar Participações',
  'CFO Solar Comercial Sul',
  'CFO Solar Trading Ltda',
]

const POR_PAGINA = 20

// ─── Tipos ───────────────────────────────────────────────────────────────────

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

type FormState = {
  vendedorId: string | null
  vendedorNome: string
  empresa: string
  filial: string
  cliente: string
  valorOrcado: string
  dataOrcamento: string
  status: StatusPedido
  valorVendido: string
  dataVenda: string
}

const FORM_INICIAL: FormState = {
  vendedorId:    null,
  vendedorNome:  '',
  empresa:       EMPRESAS[0],
  filial:        'São Paulo',
  cliente:       '',
  valorOrcado:   '',
  dataOrcamento: '',
  status:        'orcado',
  valorVendido:  '',
  dataVenda:     '',
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function OrcamentosCadastroPage() {
  // Papel do usuário — determina o comportamento da tela
  const [papel, setPapel] = useState<string | null>(null)
  const eVendedor = papel === 'vendedor'

  // Formulário
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  // Vendedores para o combobox (apenas para não-vendedores)
  const [vendedoresOpt, setVendedoresOpt] = useState<OpcaoCombobox[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})
  const [carregandoVend, setCarregandoVend] = useState(true)

  // Lista paginada de pedidos
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([])
  const [total, setTotal] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)

  // Efeito 1: descobrir o papel do usuário
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string }>)
      .then(d => setPapel(d.papel ?? 'sem_acesso'))
      .catch(() => setPapel('sem_acesso'))
  }, [])

  // Efeito 2: carregar vendedores (combobox — apenas para não-vendedores)
  useEffect(() => {
    if (papel === null) return
    if (papel === 'vendedor') { setCarregandoVend(false); return }

    fetch('/api/comercial/vendedores')
      .then(r => r.json() as Promise<{ ok: boolean; vendedores?: { id: string; nome: string }[] }>)
      .then(json => {
        if (json.ok && json.vendedores) {
          setVendedoresOpt(json.vendedores.map(v => ({ id: v.id, label: v.nome })))
          const mapa: Record<string, string> = {}
          json.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoVend(false))
  }, [papel])

  // Efeito 3: carga inicial da lista quando papel é conhecido
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

  function upd(patch: Partial<FormState>) {
    setForm(f => ({ ...f, ...patch }))
    setFeedback(null)
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setFeedback(null)

    if (!form.cliente.trim() || !form.valorOrcado) return
    if (!eVendedor && !form.vendedorId) {
      setFeedback({ tipo: 'erro', msg: 'Selecione um vendedor.' })
      return
    }

    const body: Record<string, unknown> = {
      empresa:       form.empresa,
      filial:        form.filial,
      cliente:       form.cliente.trim(),
      valorOrcado:   parseFloat(form.valorOrcado) || 0,
      dataOrcamento: form.dataOrcamento || null,
      status:        form.status,
      valorVendido:  form.status === 'vendido' ? (parseFloat(form.valorVendido) || null) : null,
      dataVenda:     form.status === 'vendido' ? (form.dataVenda || null) : null,
    }
    // vendedor: servidor usa x-vendedor-id do header; admin/gestor: envia do formulário
    if (!eVendedor) body.vendedorId = form.vendedorId

    setSalvando(true)
    try {
      const res = await fetch('/api/orcamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; error?: string }

      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao cadastrar orçamento.' })
        return
      }

      setFeedback({ tipo: 'ok', msg: `Orçamento de ${form.cliente.trim()} cadastrado com sucesso.` })
      setForm(FORM_INICIAL)
      buscarPedidos(1, true) // recarrega do início
    } finally {
      setSalvando(false)
    }
  }

  async function criarVendedor(nome: string): Promise<OpcaoCombobox> {
    const res = await fetch('/api/comercial/vendedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    const json = await res.json() as { ok: boolean; vendedor?: { id: string; nome: string }; error?: string }
    if (!json.ok || !json.vendedor) throw new Error(json.error ?? 'Erro ao criar vendedor')
    const nova: OpcaoCombobox = { id: json.vendedor.id, label: json.vendedor.nome }
    setVendedoresOpt(prev => [...prev, nova].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')))
    setMapaVendedores(prev => ({ ...prev, [nova.id]: nova.label }))
    return nova
  }

  // Aguarda papel ser carregado
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

  // Colunas da lista variam por papel
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

        {/* ── Formulário ──────────────────────────────────────────────── */}
        <div className={`${styles.stitle} ${styles.serif}`}>Cadastro de Orçamento</div>
        <div className={styles.scap}>
          {eVendedor
            ? 'Registre um novo orçamento ou pedido — será associado à sua carteira automaticamente.'
            : 'Registre um novo orçamento ou pedido comercial.'}
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20, marginTop: 32 }}>

          {/* Vendedor (apenas para admin/gestor) */}
          {!eVendedor && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Vendedor</label>
              <ComboboxBusca
                opcoes={vendedoresOpt}
                valorId={form.vendedorId}
                valorLabel={form.vendedorNome}
                onChange={opcao => upd({ vendedorId: opcao?.id ?? null, vendedorNome: opcao?.label ?? '' })}
                onCriarNovo={criarVendedor}
                placeholder="Nome do vendedor"
                carregando={carregandoVend}
              />
            </div>
          )}

          {/* Empresa */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Empresa</label>
            <select className={styles.select} value={form.empresa} onChange={e => upd({ empresa: e.target.value })}>
              {EMPRESAS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
            </select>
          </div>

          {/* Filial */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Filial</label>
            <select className={styles.select} value={form.filial} onChange={e => upd({ filial: e.target.value })}>
              <option value="São Paulo">São Paulo</option>
              <option value="Paraná">Paraná</option>
            </select>
          </div>

          {/* Cliente */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Cliente</label>
            <input
              type="text"
              placeholder="Razão social do cliente"
              value={form.cliente}
              onChange={e => upd({ cliente: e.target.value })}
              className={styles.input}
              required
            />
          </div>

          {/* Valor Orçado */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Valor Orçado</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex.: 45000"
              value={form.valorOrcado}
              onChange={e => upd({ valorOrcado: e.target.value })}
              className={styles.input}
              required
            />
          </div>

          {/* Data do Orçamento */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Data do Orçamento</label>
            <input
              type="date"
              value={form.dataOrcamento}
              onChange={e => upd({ dataOrcamento: e.target.value })}
              className={styles.input}
            />
          </div>

          {/* Status */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Status</label>
            <div className={styles.toggle2}>
              <button
                type="button"
                className={`${styles.tgBtn} ${form.status === 'orcado' ? styles.tgBtnOn : ''}`}
                onClick={() => upd({ status: 'orcado' })}
              >
                Orçado
              </button>
              <button
                type="button"
                className={`${styles.tgBtn} ${form.status === 'vendido' ? styles.tgBtnOn : ''}`}
                onClick={() => upd({ status: 'vendido' })}
              >
                Vendido
              </button>
            </div>
          </div>

          {/* Campos condicionais para vendido */}
          {form.status === 'vendido' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Valor Vendido</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex.: 45000"
                  value={form.valorVendido}
                  onChange={e => upd({ valorVendido: e.target.value })}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Data da Venda</label>
                <input
                  type="date"
                  value={form.dataVenda}
                  onChange={e => upd({ dataVenda: e.target.value })}
                  className={styles.input}
                />
              </div>
            </>
          )}

          {/* Feedback */}
          {feedback && (
            <div
              className={feedback.tipo === 'erro' ? `${styles.notice} ${styles.alertaDanger}` : styles.notice}
              style={{
                margin: 0,
                ...(feedback.tipo === 'ok'
                  ? { borderLeftColor: 'var(--positivo)', color: 'var(--positivo)' }
                  : {}),
              }}
            >
              <span>{feedback.msg}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={salvando}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {salvando ? 'Salvando…' : 'Cadastrar Orçamento'}
          </button>
        </form>

        {/* ── Lista de orçamentos ──────────────────────────────────────── */}
        <div style={{ marginTop: 56 }}>
          <div className={styles.shead} style={{ marginBottom: 12 }}>
            <div className={`${styles.stitle} ${styles.serif}`} style={{ fontSize: 18 }}>
              {eVendedor ? 'Minha carteira' : 'Orçamentos'}
            </div>
            {!carregandoLista && (
              <div className={styles.over}>{total} registros</div>
            )}
          </div>

          {carregandoLista ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>Carregando…</p>
          ) : pedidos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>
              {eVendedor ? 'Nenhum orçamento na sua carteira ainda.' : 'Nenhum orçamento cadastrado ainda.'}
            </p>
          ) : (
            <>
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
                    textTransform: 'uppercase',
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

              {/* Carregar mais */}
              {temMais && (
                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
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
      </main>
    </div>
  )
}

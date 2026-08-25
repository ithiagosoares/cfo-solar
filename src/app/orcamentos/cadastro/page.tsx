'use client'

import { useState, useEffect, useCallback } from 'react'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import Modal from '@/components/ui/Modal'
import { formatMoeda } from '@/lib/utils'
import AppLayout from '@/components/layout/AppLayout'
import { FilterCheckbox } from '@/components/filters/FilterBar'
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
  arquivado?: boolean
}

type FormState = {
  vendedorId: string | null
  vendedorNome: string
  empresa: string
  filial: string
  cliente: string
  numeroPedido: string
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
  numeroPedido:  '',
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
  const [papel, setPapel] = useState<string | null>(null)
  const [meuVendedorId, setMeuVendedorId] = useState<string | null>(null)
  const eVendedor = papel === 'vendedor'

  // Modal
  const [modalAberto, setModalAberto] = useState(false)

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
  const [mostrarArquivados, setMostrarArquivados] = useState(false)

  // Efeito 1: descobrir o papel e o vendedor_id do usuário
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string; vendedorId?: string | null }>)
      .then(d => {
        setPapel(d.papel ?? 'sem_acesso')
        setMeuVendedorId(d.vendedorId ?? null)
      })
      .catch(() => setPapel('sem_acesso'))
  }, [])

  // Efeito 2: carregar vendedores — combobox para admin/gestor, e para resolver o
  // nome do próprio vendedor logado (campo somente-leitura pré-preenchido)
  useEffect(() => {
    if (papel === null) return

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

  // Efeito 3: carga inicial da lista quando papel ou mostrarArquivados muda
  useEffect(() => {
    if (papel !== null) buscarPedidos(1, true, mostrarArquivados)
  }, [papel, mostrarArquivados]) // eslint-disable-line react-hooks/exhaustive-deps

  const buscarPedidos = useCallback(async (pagina: number, reset: boolean, arq: boolean) => {
    if (reset) setCarregandoLista(true)
    else setCarregandoMais(true)
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) })
      if (arq) params.set('arquivados', '1')
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

  async function arquivarInLinha(id: string, arquivar: boolean) {
    const res = await fetch(`/api/orcamentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arquivar }),
    })
    if (res.ok) buscarPedidos(1, true, mostrarArquivados)
  }

  function upd(patch: Partial<FormState>) {
    setForm(f => ({ ...f, ...patch }))
    setFeedback(null)
  }

  function fecharModal() {
    setModalAberto(false)
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
    if (!form.numeroPedido.trim()) {
      setFeedback({ tipo: 'erro', msg: 'Informe o número do pedido.' })
      return
    }

    const numeroPedido = form.numeroPedido.trim()
    const body: Record<string, unknown> = {
      empresa:       form.empresa,
      filial:        form.filial,
      cliente:       form.cliente.trim(),
      numeroPedido,
      valorOrcado:   parseFloat(form.valorOrcado) || 0,
      dataOrcamento: form.dataOrcamento || null,
      status:        form.status,
      valorVendido:  form.status === 'vendido' ? (parseFloat(form.valorVendido) || null) : null,
      dataVenda:     form.status === 'vendido' ? (form.dataVenda || null) : null,
    }
    if (!eVendedor) body.vendedorId = form.vendedorId

    setSalvando(true)
    try {
      const res = await fetch('/api/orcamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; error?: string; criado?: boolean }

      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao cadastrar orçamento.' })
        return
      }

      // Sucesso: mostra o resultado da deduplicação, limpa a lista e fecha o modal
      setFeedback({
        tipo: 'ok',
        msg: json.criado
          ? 'Novo pedido criado.'
          : `Pedido #${numeroPedido} já existe. Dados atualizados.`,
      })
      buscarPedidos(1, true, mostrarArquivados)
      setTimeout(() => {
        setForm(FORM_INICIAL)
        setFeedback(null)
        setModalAberto(false)
      }, 1400)
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
      {/* ── Modal de cadastro ─────────────────────────────────────────── */}
      <Modal
        aberto={modalAberto}
        onFechar={fecharModal}
        titulo={eVendedor ? 'Novo Orçamento' : 'Cadastrar Orçamento'}
        largura={480}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Vendedor: dropdown de busca para admin/gestor; somente-leitura,
              pré-preenchido com o próprio nome, para o papel vendedor */}
          {eVendedor ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Vendedor</label>
              <input
                type="text"
                value={(meuVendedorId && mapaVendedores[meuVendedorId]) || 'Carregando…'}
                readOnly
                className={styles.input}
                style={{ background: 'var(--cor-fundo, #f5f5f5)', color: 'var(--ink2)', cursor: 'default' }}
              />
            </div>
          ) : (
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

          {/* Número do Pedido — chave de deduplicação junto com a empresa */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Número do Pedido</label>
            <input
              type="text"
              placeholder="Ex.: 1503"
              value={form.numeroPedido}
              onChange={e => upd({ numeroPedido: e.target.value })}
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

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className={styles.btn} onClick={fecharModal}>
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Cadastrar Orçamento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Lista de orçamentos ───────────────────────────────────────── */}
      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72 }}>
        <div className={styles.shead} style={{ marginBottom: 12, alignItems: 'center' }}>
          <div className={`${styles.stitle} ${styles.serif}`}>
            {eVendedor ? 'Minha carteira' : 'Orçamentos'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <FilterCheckbox
              label="Mostrar arquivados"
              checked={mostrarArquivados}
              onChange={v => setMostrarArquivados(v)}
            />
            {!carregandoLista && (
              <div className={styles.over}>{total} registros</div>
            )}
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className={styles.btnPrimary}
              style={{ fontSize: 13 }}
            >
              + Novo Orçamento
            </button>
          </div>
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
                <div />
              </div>

              {/* Linhas */}
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
                      onClick={e => { e.preventDefault(); e.stopPropagation(); void arquivarInLinha(p.id, !mostrarArquivados) }}
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
                      {mostrarArquivados ? 'Restaurar' : 'Arquivar'}
                    </button>
                  </div>
                </a>
              ))}
            </div>

            {/* Carregar mais */}
            {temMais && (
              <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => buscarPedidos(paginaAtual + 1, false, mostrarArquivados)}
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

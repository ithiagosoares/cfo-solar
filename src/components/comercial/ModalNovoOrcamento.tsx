'use client'

import { useState, useEffect } from 'react'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import Modal from '@/components/ui/Modal'
import ImportarOrcamentoPdf from './ImportarOrcamentoPdf'
import { FILIAIS, EMPRESA_POR_FILIAL } from '@/lib/empresa-filial'
import styles from '@/styles/editorial.module.css'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StatusPedido = 'orcado' | 'vendido' | 'perdido'
type Aba = 'manual' | 'pdf'

type FormState = {
  vendedorId: string | null
  vendedorNome: string
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
  filial:        'São Paulo',
  cliente:       '',
  numeroPedido:  '',
  valorOrcado:   '',
  dataOrcamento: '',
  status:        'orcado',
  valorVendido:  '',
  dataVenda:     '',
}

interface Props {
  aberto: boolean
  onFechar: () => void
  onSalvo: (msg: string) => void
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ModalNovoOrcamento({ aberto, onFechar, onSalvo }: Props) {
  const [papel, setPapel] = useState<string | null>(null)
  const [meuVendedorId, setMeuVendedorId] = useState<string | null>(null)
  const eVendedor = papel === 'vendedor'

  const [aba, setAba] = useState<Aba>('manual')
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  const [vendedoresOpt, setVendedoresOpt] = useState<OpcaoCombobox[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})
  const [carregandoVend, setCarregandoVend] = useState(true)

  // O <dialog> do Modal fica sempre montado (só abre/fecha via showModal()/close()),
  // então resetar por efeito ligado a `aberto` causaria setState síncrono dentro de
  // efeito. Em vez disso, reseta no evento real de fechamento — clique em Cancelar,
  // clique fora, Esc, ou fechamento programático após salvar (todos passam por aqui,
  // já que o Modal chama onFechar tanto no clique quanto no evento nativo "close").
  function fecharEResetar() {
    setForm(FORM_INICIAL)
    setFeedback(null)
    setAba('manual')
    onFechar()
  }

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string; vendedorId?: string | null }>)
      .then(d => {
        setPapel(d.papel ?? 'sem_acesso')
        setMeuVendedorId(d.vendedorId ?? null)
      })
      .catch(() => setPapel('sem_acesso'))
  }, [])

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

  function upd(patch: Partial<FormState>) {
    setForm(f => ({ ...f, ...patch }))
    setFeedback(null)
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
      empresa:       EMPRESA_POR_FILIAL[form.filial as keyof typeof EMPRESA_POR_FILIAL],
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

      onSalvo(json.criado
        ? 'Novo pedido criado.'
        : `Pedido #${numeroPedido} já existe. Dados atualizados.`)
    } finally {
      setSalvando(false)
    }
  }

  const tabBtn = (ativa: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '9px 0',
    borderRadius: 8,
    border: 'none',
    background: ativa ? 'var(--cor-destaque)' : 'transparent',
    color: ativa ? '#fff' : 'var(--cor-texto-suave)',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background .12s, color .12s',
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={fecharEResetar}
      titulo={eVendedor ? 'Novo Orçamento' : 'Cadastrar Orçamento'}
      largura={480}
    >
      {/* Abas */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        borderRadius: 10,
        background: 'var(--cor-fundo)',
        marginBottom: 20,
      }}>
        <button type="button" style={tabBtn(aba === 'manual')} onClick={() => setAba('manual')}>
          Cadastro Manual
        </button>
        <button type="button" style={tabBtn(aba === 'pdf')} onClick={() => setAba('pdf')}>
          Importar PDF
        </button>
      </div>

      {aba === 'pdf' ? (
        <ImportarOrcamentoPdf onCriado={onSalvo} />
      ) : (
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

          {/* Filial — empresa é derivada automaticamente (ver EMPRESA_POR_FILIAL) */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Filial</label>
            <select className={styles.select} value={form.filial} onChange={e => upd({ filial: e.target.value })}>
              {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
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

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className={styles.btn} onClick={fecharEResetar}>
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
      )}
    </Modal>
  )
}

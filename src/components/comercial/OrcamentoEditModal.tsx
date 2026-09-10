'use client'

import { useState, useEffect, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import UploadOrcamentoPdf from './UploadOrcamentoPdf'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { ETAPA_FUNIL_OPCOES, STATUS_VENDA_OPCOES } from '@/lib/status-pedido-config'
import { FILIAIS, EMPRESA_POR_FILIAL, type Filial } from '@/lib/empresa-filial'
import { formatMoeda } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StatusPedido = 'orcado' | 'vendido' | 'perdido'
type Aba = 'info' | 'pdf' | 'itens'

const STATUS_OPT = [
  { value: 'orcado',  label: 'Aberto' },
  { value: 'vendido', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
] as const

interface PedidoCompleto {
  id: string
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  clienteCnpj: string | null
  valorOrcado: number
  dataOrcamento: string | null
  status: StatusPedido
  valorVendido: number | null
  dataVenda: string | null
  origem: string
  numeroPedido: string | null
  criadoEm: string
  etapaFunil: string | null
  statusVenda: string | null
  pdfUrl: string | null
  pdfGoogleDriveId: string | null
}

interface ClienteContato {
  nomeContato: string | null
  email: string | null
  telefone: string
}

interface ItemPedido {
  id: string
  codigo: string | null
  descricao: string
  quantidade: number
  unidade: string | null
  valorUnitario: number
  valorTotal: number
}

interface Props {
  pedidoId: string | null
  onFechar: () => void
  onSalvo: (msg: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDataHora(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function mascaraCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

const numStyle: React.CSSProperties = {
  fontFamily: 'var(--font-plex-mono), "IBM Plex Mono", monospace',
  fontVariantNumeric: 'tabular-nums lining-nums',
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function OrcamentoEditModal({ pedidoId, onFechar, onSalvo }: Props) {
  const aberto = pedidoId !== null

  const [aba, setAba] = useState<Aba>('info')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  const [papel, setPapel] = useState<string | null>(null)
  const [vendedoresOpt, setVendedoresOpt] = useState<OpcaoCombobox[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

  // Campos editáveis
  const [vendedorId,    setVendedorId]    = useState<string | null>(null)
  const [filial,        setFilial]        = useState<Filial>('São Paulo')
  const [cliente,       setCliente]       = useState('')
  const [status,        setStatus]        = useState<StatusPedido>('orcado')
  const [etapaFunil,    setEtapaFunil]    = useState('Novo')
  const [statusVenda,   setStatusVenda]   = useState('Venda Fechada')
  const [dataOrcamento, setDataOrcamento] = useState('')
  const [valorOrcado,   setValorOrcado]   = useState('')
  const [valorVendido,  setValorVendido]  = useState('')
  const [dataVenda,     setDataVenda]     = useState('')

  // Dados somente leitura
  const [numeroPedido, setNumeroPedido] = useState<string | null>(null)
  const [criadoEm,     setCriadoEm]     = useState('')
  const [clienteCnpj,  setClienteCnpj]  = useState<string | null>(null)
  const [contato,      setContato]      = useState<ClienteContato | null>(null)
  const [origem,       setOrigem]       = useState('')
  const [pdfUrl,       setPdfUrl]       = useState<string | null>(null)
  const [itens,        setItens]        = useState<ItemPedido[]>([])

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
          setVendedoresOpt(json.vendedores.map(v => ({ id: v.id, label: v.nome })))
          const mapa: Record<string, string> = {}
          json.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }
      })
      .catch(() => {})
  }, [papel])

  const carregarPedido = useCallback((id: string) => {
    return fetch(`/api/orcamentos/${id}`)
      .then(r => r.json() as Promise<{ ok: boolean; pedido?: PedidoCompleto; itens?: ItemPedido[]; error?: string }>)
      .then(json => {
        if (!json.ok || !json.pedido) {
          setErro(json.error ?? 'Orçamento não encontrado.')
          return
        }
        const p = json.pedido
        setFilial(p.filial === 'Paraná' ? 'Paraná' : 'São Paulo')
        setVendedorId(p.vendedorId)
        setCliente(p.cliente)
        setStatus(p.status)
        setEtapaFunil(p.etapaFunil ?? 'Novo')
        setStatusVenda(p.statusVenda ?? 'Venda Fechada')
        setDataOrcamento(p.dataOrcamento ?? '')
        setValorOrcado(String(p.valorOrcado))
        setValorVendido(p.valorVendido !== null ? String(p.valorVendido) : '')
        setDataVenda(p.dataVenda ?? '')
        setNumeroPedido(p.numeroPedido)
        setCriadoEm(p.criadoEm)
        setClienteCnpj(p.clienteCnpj)
        setOrigem(p.origem)
        setPdfUrl(p.pdfGoogleDriveId ? `/api/comercial-pedidos/${id}/pdf` : null)
        setItens(json.itens ?? [])

        if (p.clienteCnpj) {
          fetch(`/api/clientes/${p.clienteCnpj}`)
            .then(r => r.json() as Promise<{ ok: boolean; cliente?: { nomeContato?: string | null; email?: string | null; telefone?: string } }>)
            .then(cJson => {
              if (cJson.ok && cJson.cliente) {
                setContato({
                  nomeContato: cJson.cliente.nomeContato ?? null,
                  email:       cJson.cliente.email ?? null,
                  telefone:    cJson.cliente.telefone ?? '',
                })
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => setErro('Erro de rede ao carregar orçamento.'))
  }, [])

  // Recarrega sempre que um novo pedido é aberto (mesma instância do modal
  // fica montada o tempo todo — ver Modal.tsx — só troca de <dialog> aberto).
  useEffect(() => {
    if (!pedidoId) return
    setCarregando(true)
    setErro(null)
    setFeedback(null)
    setAba('info')
    setContato(null)
    carregarPedido(pedidoId).finally(() => setCarregando(false))
  }, [pedidoId, carregarPedido])

  function fecharEResetar() {
    onFechar()
  }

  async function salvarStatusPedido(campo: 'etapaFunil' | 'statusVenda', valor: string) {
    if (!pedidoId) return
    const res = await fetch(`/api/comercial-pedidos/${pedidoId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campo]: valor }),
    })
    if (!res.ok) throw new Error('Falha ao salvar status')
    if (campo === 'etapaFunil') setEtapaFunil(valor)
    else setStatusVenda(valor)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pedidoId) return
    setFeedback(null)
    setSalvando(true)

    const body: Record<string, unknown> = {
      empresa:       EMPRESA_POR_FILIAL[filial],
      filial,
      vendedorId,
      cliente:       cliente.trim(),
      status,
      valorOrcado:   parseFloat(valorOrcado) || 0,
      dataOrcamento: dataOrcamento || null,
    }
    if (status === 'vendido') {
      body.valorVendido = valorVendido ? (parseFloat(valorVendido) || null) : null
      body.dataVenda    = dataVenda || null
    }

    try {
      const res  = await fetch(`/api/orcamentos/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao salvar.' })
      } else {
        onSalvo('Orçamento salvo com sucesso.')
      }
    } catch {
      setFeedback({ tipo: 'erro', msg: 'Erro de rede ao salvar.' })
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

  if (!aberto) return null

  const subtotal = parseFloat(valorOrcado) || 0

  return (
    <Modal
      aberto={aberto}
      onFechar={fecharEResetar}
      titulo={numeroPedido ? `Editar Orçamento #${numeroPedido}` : 'Editar Orçamento'}
      largura={640}
    >
      {carregando ? (
        <p style={{ fontSize: 13, color: 'var(--cor-texto-suave)' }}>Carregando…</p>
      ) : erro ? (
        <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ margin: 0 }}><span>{erro}</span></div>
      ) : (
        <>
          {/* Abas */}
          <div style={{
            display: 'flex',
            gap: 6,
            padding: 4,
            borderRadius: 10,
            background: 'var(--cor-fundo)',
            marginBottom: 20,
          }}>
            <button type="button" style={tabBtn(aba === 'info')} onClick={() => setAba('info')}>
              Informações
            </button>
            <button type="button" style={tabBtn(aba === 'pdf')} onClick={() => setAba('pdf')}>
              Upload PDF
            </button>
            <button type="button" style={tabBtn(aba === 'itens')} onClick={() => setAba('itens')}>
              Itens{itens.length > 0 ? ` (${itens.length})` : ''}
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--cor-texto-suave)', marginBottom: 16, marginTop: -8 }}>
            {origem === 'manual' ? 'Cadastro manual' : 'Importado do ERP'} · Criado em {criadoEm ? fmtDataHora(criadoEm) : '—'}
          </p>

          {/* ── Aba: Informações ──────────────────────────────────────── */}
          {aba === 'info' && (
            <form id="form-orcamento-edit" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Vendedor</label>
                  {papel === 'administrador' || papel === 'gestor' ? (
                    <ComboboxBusca
                      opcoes={vendedoresOpt}
                      valorId={vendedorId}
                      valorLabel={vendedorId ? (mapaVendedores[vendedorId] ?? '') : ''}
                      onChange={opcao => setVendedorId(opcao?.id ?? null)}
                      placeholder="Sem vendedor atribuído"
                    />
                  ) : (
                    <input
                      readOnly
                      value={vendedorId ? (mapaVendedores[vendedorId] ?? 'Carregando…') : '—'}
                      className={styles.input}
                      style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto-suave)', cursor: 'default' }}
                    />
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Filial</label>
                  <select
                    value={filial}
                    onChange={e => setFilial(e.target.value as Filial)}
                    className={styles.select}
                  >
                    {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as StatusPedido)}
                    className={styles.select}
                  >
                    {STATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Data do Orçamento</label>
                  <input
                    type="date"
                    value={dataOrcamento}
                    onChange={e => setDataOrcamento(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Cliente (Razão Social)</label>
                <input
                  type="text"
                  value={cliente}
                  onChange={e => setCliente(e.target.value)}
                  className={styles.input}
                  placeholder="Razão social do cliente"
                  required
                />
              </div>

              {clienteCnpj && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px' }}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>CNPJ</label>
                    <input readOnly value={mascaraCNPJ(clienteCnpj)} className={styles.input} style={{ ...numStyle, fontSize: 12.5, background: 'var(--cor-fundo)', color: 'var(--cor-texto-suave)' }} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Contato</label>
                    <input readOnly value={contato?.nomeContato ?? '—'} className={styles.input} style={{ background: 'var(--cor-fundo)', color: 'var(--cor-texto-suave)' }} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Telefone</label>
                    <input readOnly value={contato?.telefone ?? '—'} className={styles.input} style={{ ...numStyle, fontSize: 12.5, background: 'var(--cor-fundo)', color: 'var(--cor-texto-suave)' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: status === 'vendido' ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: '20px 24px' }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Valor Orçado</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorOrcado}
                    onChange={e => setValorOrcado(e.target.value)}
                    className={styles.input}
                    style={numStyle}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Subtotal</label>
                  <div className={styles.input} style={{ ...numStyle, display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--cor-destaque)', background: 'var(--cor-fundo)' }}>
                    {formatMoeda(subtotal)}
                  </div>
                </div>

                {status === 'vendido' && (
                  <>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Valor Vendido</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valorVendido}
                        onChange={e => setValorVendido(e.target.value)}
                        className={styles.input}
                        style={numStyle}
                        placeholder="0,00"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Data da Venda</label>
                      <input
                        type="date"
                        value={dataVenda}
                        onChange={e => setDataVenda(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--cor-borda-sutil)' }}>
                <div className={styles.field} style={{ paddingTop: 16 }}>
                  <label className={styles.fieldLabel}>Etapa do Funil</label>
                  <StatusSelect
                    value={etapaFunil}
                    opcoes={ETAPA_FUNIL_OPCOES}
                    onSave={valor => salvarStatusPedido('etapaFunil', valor)}
                  />
                </div>
                {status === 'vendido' && (
                  <div className={styles.field} style={{ paddingTop: 16 }}>
                    <label className={styles.fieldLabel}>Status da Venda</label>
                    <StatusSelect
                      value={statusVenda}
                      opcoes={STATUS_VENDA_OPCOES}
                      onSave={valor => salvarStatusPedido('statusVenda', valor)}
                    />
                  </div>
                )}
              </div>

              {feedback && (
                <div
                  className={feedback.tipo === 'erro' ? `${styles.notice} ${styles.alertaDanger}` : styles.notice}
                  style={{ margin: 0, ...(feedback.tipo === 'ok' ? { borderLeftColor: 'var(--positivo)', color: 'var(--positivo)' } : {}) }}
                >
                  <span>{feedback.msg}</span>
                </div>
              )}
            </form>
          )}

          {/* ── Aba: Upload PDF ───────────────────────────────────────── */}
          {aba === 'pdf' && pedidoId && (
            <UploadOrcamentoPdf
              pedidoId={pedidoId}
              jaTemPdf={!!pdfUrl}
              onVinculado={() => carregarPedido(pedidoId)}
            />
          )}

          {/* ── Aba: Itens ────────────────────────────────────────────── */}
          {aba === 'itens' && (
            itens.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--cor-texto-suave)' }}>Nenhum item vinculado a este orçamento.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--cor-borda-sutil)', color: 'var(--cor-texto-suave)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 6px' }}>Código</th>
                      <th style={{ textAlign: 'left', padding: '4px 6px' }}>Descrição</th>
                      <th style={{ textAlign: 'right', padding: '4px 6px' }}>Qtd.</th>
                      <th style={{ textAlign: 'right', padding: '4px 6px' }}>Vlr. Unit.</th>
                      <th style={{ textAlign: 'right', padding: '4px 6px' }}>Vlr. Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--cor-borda-sutil)' }}>
                        <td style={{ padding: '4px 6px' }}>{item.codigo ?? '—'}</td>
                        <td style={{ padding: '4px 6px' }}>{item.descricao}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', ...numStyle }}>{item.quantidade}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', ...numStyle }}>{formatMoeda(item.valorUnitario)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', ...numStyle }}>{formatMoeda(item.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Rodapé (sticky) ───────────────────────────────────────── */}
          <div
            style={{
              position: 'sticky',
              bottom: -32,
              marginTop: 24,
              marginLeft: -24,
              marginRight: -24,
              marginBottom: -32,
              padding: '14px 24px',
              background: 'var(--paper)',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button type="button" className={styles.btn} onClick={fecharEResetar}>
              Cancelar
            </button>
            {aba === 'info' && (
              <button type="submit" form="form-orcamento-edit" className={styles.btnPrimary} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

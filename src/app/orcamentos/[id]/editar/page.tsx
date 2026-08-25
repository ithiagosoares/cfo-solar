'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatMoeda } from '@/lib/utils'
import AppLayout from '@/components/layout/AppLayout'
import UploadOrcamentoPdf from '@/components/comercial/UploadOrcamentoPdf'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import { FILIAIS, EMPRESA_POR_FILIAL, type Filial } from '@/lib/empresa-filial'
import styles from '@/styles/editorial.module.css'

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATUS_OPT = [
  { value: 'orcado',  label: 'Aberto' },
  { value: 'vendido', label: 'Ganho' },
  { value: 'perdido', label: 'Perdido' },
] as const

type StatusPedido = 'orcado' | 'vendido' | 'perdido'

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  arquivado?: boolean
  pdfUrl?: string | null
  pdfGoogleDriveId?: string | null
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

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--cor-label)',
  marginBottom: 6,
}

const sectionDivStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--cor-texto-secundario)',
  paddingBottom: 10,
  borderBottom: '1px solid var(--cor-borda-sutil)',
  marginBottom: 20,
  marginTop: 28,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--cor-borda-sutil)',
  borderRadius: 8,
  background: 'var(--cor-superficie)',
  color: 'var(--cor-texto)',
  fontFamily: 'inherit',
  fontSize: 13.5,
  padding: '9px 12px',
  outline: 'none',
  transition: 'border-color .15s',
}

const inputROStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'var(--cor-fundo)',
  color: 'var(--cor-texto-suave)',
  cursor: 'default',
}

const numStyle: React.CSSProperties = {
  fontFamily: 'var(--font-plex-mono), "IBM Plex Mono", monospace',
  fontVariantNumeric: 'tabular-nums lining-nums',
  fontWeight: 600,
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--cor-destaque)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--cor-borda-sutil)'
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function EditarOrcamentoPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]             = useState<string | null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [feedback, setFeedback]     = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  // Vendedor responsável, papel do usuário logado
  const [papel,         setPapel]         = useState<string | null>(null)
  const [vendedorId,    setVendedorId]    = useState<string | null>(null)
  const [vendedoresOpt, setVendedoresOpt] = useState<OpcaoCombobox[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

  // Campos editáveis
  const [filial,        setFilial]        = useState<Filial>('São Paulo')
  const [cliente,       setCliente]       = useState('')
  const [status,        setStatus]        = useState<StatusPedido>('orcado')
  const [dataOrcamento, setDataOrcamento] = useState('')
  const [valorOrcado,   setValorOrcado]   = useState('')
  const [valorVendido,  setValorVendido]  = useState('')
  const [dataVenda,     setDataVenda]     = useState('')

  const [arquivado,     setArquivado]     = useState(false)
  const [arquivando,    setArquivando]    = useState(false)

  // Dados somente leitura
  const [numeroPedido,  setNumeroPedido]  = useState<string | null>(null)
  const [criadoEm,      setCriadoEm]      = useState('')
  const [clienteCnpj,   setClienteCnpj]  = useState<string | null>(null)
  const [contato,       setContato]       = useState<ClienteContato | null>(null)
  const [origem,        setOrigem]        = useState('')
  const [pdfUrl,        setPdfUrl]        = useState<string | null>(null)
  const [itens,         setItens]         = useState<ItemPedido[]>([])

  function carregarPedido() {
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
        setDataOrcamento(p.dataOrcamento ?? '')
        setValorOrcado(String(p.valorOrcado))
        setValorVendido(p.valorVendido !== null ? String(p.valorVendido) : '')
        setDataVenda(p.dataVenda ?? '')
        setNumeroPedido(p.numeroPedido)
        setCriadoEm(p.criadoEm)
        setClienteCnpj(p.clienteCnpj)
        setOrigem(p.origem)
        setArquivado(p.arquivado ?? false)
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
  }

  useEffect(() => {
    carregarPedido().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string }>)
      .then(d => setPapel(d.papel ?? 'sem_acesso'))
      .catch(() => setPapel('sem_acesso'))
  }, [])

  useEffect(() => {
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
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      const res  = await fetch(`/api/orcamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao salvar.' })
      } else {
        setFeedback({ tipo: 'ok', msg: 'Orçamento salvo com sucesso.' })
        setTimeout(() => router.push('/orcamentos'), 1000)
      }
    } catch {
      setFeedback({ tipo: 'erro', msg: 'Erro de rede ao salvar.' })
    } finally {
      setSalvando(false)
    }
  }

  async function handleArquivar() {
    setArquivando(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/orcamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivar: !arquivado }),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao arquivar.' })
      } else {
        setArquivado(!arquivado)
        setFeedback({ tipo: 'ok', msg: arquivado ? 'Orçamento restaurado.' : 'Orçamento arquivado.' })
      }
    } catch {
      setFeedback({ tipo: 'erro', msg: 'Erro de rede.' })
    } finally {
      setArquivando(false)
    }
  }

  // ── Estados especiais ────────────────────────────────────────────────────

  if (carregando) {
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

  if (erro) {
    return (
      <AppLayout>
        <main className={styles.wrap} style={{ paddingTop: 40 }}>
          <div className={`${styles.notice} ${styles.alertaDanger}`}><span>{erro}</span></div>
        </main>
      </AppLayout>
    )
  }

  const subtotal = parseFloat(valorOrcado) || 0

  // ── Formulário ───────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72 }}>

        {/* Breadcrumb */}
        <a
          href="/orcamentos"
          style={{ fontSize: 13, color: 'var(--cor-texto-suave)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}
        >
          ← Orçamentos
        </a>

        {/* Cabeçalho */}
        <h1 className={styles.serif} style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
          Editar Orçamento
        </h1>
        <p style={{ fontSize: 13, color: 'var(--cor-texto-suave)', marginBottom: 32 }}>
          {numeroPedido ? `Nº ${numeroPedido}` : 'Cadastro manual'} · {origem === 'manual' ? 'Manual' : 'Upload ERP'}
        </p>

        {/* Card principal — borda âmbar */}
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 680,
            border: '1.5px solid var(--cor-destaque)',
            borderRadius: 20,
            padding: '24px 26px',
            background: 'var(--cor-superficie)',
          }}
        >

          {/* ── Seção: Dados do Orçamento ─────────────────────────────── */}
          <div style={sectionDivStyle}>Dados do Orçamento</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>

            <div>
              <label style={labelStyle}>Número do Orçamento</label>
              <input
                readOnly
                value={numeroPedido ?? '—'}
                style={{ ...inputROStyle, ...numStyle }}
              />
            </div>

            <div>
              <label style={labelStyle}>Vendedor</label>
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
                  style={inputROStyle}
                />
              )}
            </div>

            <div>
              <label style={labelStyle}>Data de Criação</label>
              <input
                readOnly
                value={fmtDataHora(criadoEm)}
                style={inputROStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as StatusPedido)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={onFocus}
                onBlur={onBlur}
              >
                {STATUS_OPT.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Data do Orçamento</label>
              <input
                type="date"
                value={dataOrcamento}
                onChange={e => setDataOrcamento(e.target.value)}
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </div>

          </div>

          {/* ── Seção: Cliente ────────────────────────────────────────── */}
          <div style={sectionDivStyle}>Cliente</div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Filial</label>
            <select
              value={filial}
              onChange={e => setFilial(e.target.value as Filial)}
              style={{ ...inputStyle, cursor: 'pointer' }}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Cliente (Razão Social)</label>
            <input
              type="text"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder="Razão social do cliente"
              required
            />
          </div>

          {/* Contato do cliente (read-only, da tabela clientes) */}
          {clienteCnpj && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px', marginBottom: 4 }}>
              <div>
                <label style={labelStyle}>CNPJ</label>
                <input readOnly value={mascaraCNPJ(clienteCnpj)} style={{ ...inputROStyle, ...numStyle, fontSize: 12.5 }} />
              </div>
              <div>
                <label style={labelStyle}>Contato</label>
                <input readOnly value={contato?.nomeContato ?? '—'} style={inputROStyle} />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input readOnly value={contato?.telefone ?? '—'} style={{ ...inputROStyle, ...numStyle, fontSize: 12.5 }} />
              </div>
            </div>
          )}
          {clienteCnpj && contato?.email && (
            <div style={{ marginTop: 16, marginBottom: 4 }}>
              <label style={labelStyle}>E-mail</label>
              <input readOnly value={contato.email} style={inputROStyle} />
            </div>
          )}

          {/* ── Seção: Valores ────────────────────────────────────────── */}
          <div style={sectionDivStyle}>Valores</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' }}>

            <div>
              <label style={labelStyle}>Valor Orçado</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorOrcado}
                onChange={e => setValorOrcado(e.target.value)}
                style={{ ...inputStyle, ...numStyle }}
                onFocus={onFocus}
                onBlur={onBlur}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Subtotal</label>
              <div style={{
                ...inputROStyle,
                ...numStyle,
                display: 'flex',
                alignItems: 'center',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--cor-destaque)',
              }}>
                {formatMoeda(subtotal)}
              </div>
            </div>

            {status === 'vendido' && (
              <>
                <div>
                  <label style={labelStyle}>Valor Vendido</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorVendido}
                    onChange={e => setValorVendido(e.target.value)}
                    style={{ ...inputStyle, ...numStyle }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Data da Venda</label>
                  <input
                    type="date"
                    value={dataVenda}
                    onChange={e => setDataVenda(e.target.value)}
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </>
            )}

          </div>

          {/* Total grande */}
          {status === 'vendido' && valorVendido && (
            <div style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: '1px solid var(--cor-borda-sutil)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cor-texto-secundario)' }}>
                Total Vendido
              </span>
              <span style={{ ...numStyle, fontSize: 28, fontWeight: 700, color: 'var(--cor-destaque)' }}>
                {formatMoeda(parseFloat(valorVendido) || 0)}
              </span>
            </div>
          )}

          {/* ── Seção: Anexo (PDF do orçamento) ─────────────────────────── */}
          <div style={sectionDivStyle}>Anexo</div>

          {pdfUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: 13 }}>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cor-destaque)', fontWeight: 600, textDecoration: 'none' }}>
                Ver PDF do orçamento →
              </a>
              {itens.length > 0 && (
                <span style={{ color: 'var(--cor-texto-suave)' }}>{itens.length} item(ns) extraído(s)</span>
              )}
            </div>
          )}

          {itens.length > 0 && (
            <div style={{ marginBottom: 16, overflowX: 'auto' }}>
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
          )}

          <UploadOrcamentoPdf pedidoId={id} jaTemPdf={!!pdfUrl} onVinculado={carregarPedido} />

          {/* ── Ações ────────────────────────────────────────────────── */}
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={salvando}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: '1.5px solid var(--cor-destaque)',
                background: salvando ? 'var(--cor-borda)' : 'var(--cor-destaque)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: salvando ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { if (!salvando) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cor-destaque-hover)' }}
              onMouseLeave={e => { if (!salvando) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cor-destaque)' }}
            >
              {salvando ? 'Salvando…' : 'Salvar orçamento'}
            </button>

            <a
              href="/orcamentos"
              style={{ fontSize: 13, color: 'var(--cor-texto-suave)', textDecoration: 'none' }}
            >
              Cancelar
            </a>

            <button
              type="button"
              onClick={handleArquivar}
              disabled={arquivando}
              style={{
                marginLeft: 'auto',
                padding: '9px 16px',
                borderRadius: 10,
                border: '1px solid var(--cor-borda-sutil)',
                background: 'none',
                color: arquivado ? 'var(--ink2)' : 'var(--cor-texto-suave)',
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: arquivando ? 'not-allowed' : 'pointer',
                transition: 'border-color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cor-destaque)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cor-borda-sutil)' }}
            >
              {arquivando ? '…' : arquivado ? 'Restaurar' : 'Arquivar'}
            </button>
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: feedback.tipo === 'ok' ? 'var(--cor-sucesso-bg)' : 'var(--cor-erro-bg)',
                color: feedback.tipo === 'ok' ? 'var(--cor-sucesso)' : 'var(--cor-erro)',
                border: `1px solid ${feedback.tipo === 'ok' ? 'var(--cor-sucesso)' : 'var(--cor-erro)'}`,
              }}
            >
              {feedback.msg}
            </div>
          )}

        </form>
      </main>
    </AppLayout>
  )
}

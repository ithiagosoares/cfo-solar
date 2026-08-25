'use client'

import { useRef, useState } from 'react'
import { formatMoeda, formatData } from '@/lib/utils'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ItemExtraido {
  codigo: string | null
  descricao: string
  quantidade: number
  unidade: string | null
  valorUnitario: number
  valorTotal: number
}

interface DadosExtraidos {
  numeroPedido: string | null
  dataOrcamento: string | null
  vendedorNomeExtraido: string | null
  clienteNome: string | null
  clienteCnpj: string | null
  valorTotal: number | null
  itens: ItemExtraido[]
  camposNaoEncontrados: string[]
}

interface Candidato {
  id: string
  cliente: string
  numeroPedido: string | null
  valorOrcado: number
  dataOrcamento: string | null
}

interface RespostaUpload {
  ok: boolean
  error?: string
  status?: 'segura' | 'duvidosa'
  motivos?: string[]
  extraido?: DadosExtraidos
  vendedorAtribuidoId?: string | null
  driveFileId?: string
  driveUrl?: string
  candidatos?: Candidato[]
}

type Fase =
  | { tipo: 'idle' }
  | { tipo: 'enviando' }
  | { tipo: 'preview'; resp: RespostaUpload }
  | { tipo: 'vinculando' }
  | { tipo: 'concluido' }
  | { tipo: 'erro'; msg: string }

interface Props {
  pedidoId: string
  jaTemPdf: boolean
  onVinculado?: () => void
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const dropZoneBase: React.CSSProperties = {
  border: '1.5px dashed var(--cor-borda-sutil)',
  borderRadius: 14,
  padding: '28px 20px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color .15s, background .15s',
  background: 'var(--cor-fundo)',
}

const botaoPrimario: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 10,
  border: '1.5px solid var(--cor-destaque)',
  background: 'var(--cor-destaque)',
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const botaoSecundario: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 10,
  border: '1px solid var(--cor-borda-sutil)',
  background: 'none',
  color: 'var(--cor-texto-suave)',
  fontFamily: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
}

const numStyle: React.CSSProperties = {
  fontFamily: 'var(--font-plex-mono), "IBM Plex Mono", monospace',
  fontVariantNumeric: 'tabular-nums lining-nums',
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function UploadOrcamentoPdf({ pedidoId, jaTemPdf, onVinculado }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: 'idle' })
  const [arrastando, setArrastando] = useState(false)
  const [candidatoEscolhido, setCandidatoEscolhido] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function enviarArquivo(arquivo: File) {
    setFase({ tipo: 'enviando' })
    setCandidatoEscolhido(null)

    const formData = new FormData()
    formData.append('file', arquivo)

    try {
      const res = await fetch(`/api/comercial-pedidos/${pedidoId}/upload-pdf`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json() as RespostaUpload
      if (!res.ok || !json.ok) {
        setFase({ tipo: 'erro', msg: json.error ?? 'Erro ao processar o PDF.' })
        return
      }
      setFase({ tipo: 'preview', resp: json })
      if (json.status === 'duvidosa') setCandidatoEscolhido(null)
    } catch {
      setFase({ tipo: 'erro', msg: 'Erro de rede ao enviar o arquivo.' })
    }
  }

  async function confirmarVinculo(idDestino: string, resp: RespostaUpload) {
    setFase({ tipo: 'vinculando' })
    try {
      const res = await fetch(`/api/comercial-pedidos/${idDestino}/vincular-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId: resp.driveFileId,
          driveUrl: resp.driveUrl,
          vendedorAtribuidoId: resp.vendedorAtribuidoId ?? null,
          numeroPedidoExtraido: resp.extraido?.numeroPedido ?? null,
          itens: resp.extraido?.itens ?? [],
        }),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setFase({ tipo: 'erro', msg: json.error ?? 'Erro ao vincular o PDF.' })
        return
      }
      setFase({ tipo: 'concluido' })
      onVinculado?.()
    } catch {
      setFase({ tipo: 'erro', msg: 'Erro de rede ao vincular o PDF.' })
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastando(false)
    const arquivo = e.dataTransfer.files?.[0]
    if (arquivo) enviarArquivo(arquivo)
  }

  function handleSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (arquivo) enviarArquivo(arquivo)
    e.target.value = ''
  }

  // ── Estado: idle / enviando ─────────────────────────────────────────────

  if (fase.tipo === 'idle' || fase.tipo === 'enviando') {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleSelecionar}
          style={{ display: 'none' }}
          disabled={fase.tipo === 'enviando'}
        />
        <div
          onClick={() => fase.tipo === 'idle' && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          onDrop={fase.tipo === 'idle' ? handleDrop : undefined}
          style={{
            ...dropZoneBase,
            borderColor: arrastando ? 'var(--cor-destaque)' : 'var(--cor-borda-sutil)',
            background: arrastando ? 'var(--cor-destaque-bg, var(--cor-fundo))' : 'var(--cor-fundo)',
            opacity: fase.tipo === 'enviando' ? 0.6 : 1,
            cursor: fase.tipo === 'enviando' ? 'default' : 'pointer',
          }}
        >
          {fase.tipo === 'enviando' ? (
            <p style={{ fontSize: 13, color: 'var(--cor-texto-suave)' }}>Enviando e extraindo dados do PDF…</p>
          ) : (
            <>
              <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                {jaTemPdf ? 'Substituir PDF do orçamento' : 'Arraste o PDF do orçamento aqui'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--cor-texto-suave)' }}>ou clique para selecionar um arquivo</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Estado: erro ─────────────────────────────────────────────────────────

  if (fase.tipo === 'erro') {
    return (
      <div>
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 13,
          background: 'var(--cor-erro-bg)',
          color: 'var(--cor-erro)',
          border: '1px solid var(--cor-erro)',
          marginBottom: 12,
        }}>
          {fase.msg}
        </div>
        <button type="button" style={botaoSecundario} onClick={() => setFase({ tipo: 'idle' })}>Tentar novamente</button>
      </div>
    )
  }

  // ── Estado: concluído ────────────────────────────────────────────────────

  if (fase.tipo === 'concluido') {
    return (
      <div style={{
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        background: 'var(--cor-sucesso-bg)',
        color: 'var(--cor-sucesso)',
        border: '1px solid var(--cor-sucesso)',
      }}>
        PDF vinculado com sucesso.
      </div>
    )
  }

  // ── Estado: vinculando ───────────────────────────────────────────────────

  if (fase.tipo === 'vinculando') {
    return <p style={{ fontSize: 13, color: 'var(--cor-texto-suave)' }}>Vinculando…</p>
  }

  // ── Estado: preview (segura ou duvidosa) ─────────────────────────────────

  const { resp } = fase
  const ex = resp.extraido

  return (
    <div>
      {resp.status === 'segura' && ex && (
        <div style={{
          border: '1px solid var(--cor-sucesso)',
          background: 'var(--cor-sucesso-bg)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 14,
          fontSize: 13,
          color: 'var(--cor-sucesso)',
        }}>
          Encontrado: Orçamento {ex.numeroPedido ? `#${ex.numeroPedido}` : ''} — {ex.clienteNome ?? 'cliente não identificado'}
          {ex.dataOrcamento ? ` — ${formatData(ex.dataOrcamento)}` : ''}
        </div>
      )}

      {resp.status === 'duvidosa' && (
        <div style={{
          border: '1px solid var(--cor-alerta, #C78A2E)',
          background: 'var(--cor-alerta-bg, #FBF3E4)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 14,
          fontSize: 13,
        }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Não foi possível confirmar a correspondência com este orçamento.</p>
          {resp.motivos && resp.motivos.length > 0 && (
            <ul style={{ margin: '4px 0 0 18px', color: 'var(--cor-texto-suave)' }}>
              {resp.motivos.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      {ex && (ex.camposNaoEncontrados.length > 0) && (
        <p style={{ fontSize: 11.5, color: 'var(--cor-texto-suave)', marginBottom: 14 }}>
          Campos não identificados no PDF: {ex.camposNaoEncontrados.join(', ')}
        </p>
      )}

      {ex && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 16, fontSize: 13 }}>
          <div><span style={{ color: 'var(--cor-texto-suave)' }}>Nº Pedido: </span><span style={numStyle}>{ex.numeroPedido ?? '—'}</span></div>
          <div><span style={{ color: 'var(--cor-texto-suave)' }}>Data: </span>{ex.dataOrcamento ? formatData(ex.dataOrcamento) : '—'}</div>
          <div><span style={{ color: 'var(--cor-texto-suave)' }}>Cliente: </span>{ex.clienteNome ?? '—'}</div>
          <div><span style={{ color: 'var(--cor-texto-suave)' }}>Vendedor (PDF): </span>{ex.vendedorNomeExtraido ?? '—'}</div>
          <div><span style={{ color: 'var(--cor-texto-suave)' }}>Valor Total: </span><span style={numStyle}>{ex.valorTotal !== null ? formatMoeda(ex.valorTotal) : '—'}</span></div>
          <div><span style={{ color: 'var(--cor-texto-suave)' }}>Itens: </span>{ex.itens.length}</div>
        </div>
      )}

      {ex && ex.itens.length > 0 && (
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
              {ex.itens.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--cor-borda-sutil)' }}>
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

      {resp.status === 'segura' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" style={botaoPrimario} onClick={() => confirmarVinculo(pedidoId, resp)}>Confirmar e vincular</button>
          <button type="button" style={botaoSecundario} onClick={() => setFase({ tipo: 'idle' })}>Cancelar</button>
        </div>
      )}

      {resp.status === 'duvidosa' && (
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
            {resp.candidatos && resp.candidatos.length > 0
              ? 'Selecione o orçamento correto para vincular este PDF:'
              : 'Nenhum orçamento candidato encontrado. Confirme mesmo assim para vincular a este orçamento, ou cancele.'}
          </p>

          {resp.candidatos && resp.candidatos.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {resp.candidatos.map(c => (
                <label
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${candidatoEscolhido === c.id ? 'var(--cor-destaque)' : 'var(--cor-borda-sutil)'}`,
                    cursor: 'pointer',
                    fontSize: 12.5,
                  }}
                >
                  <input
                    type="radio"
                    name="candidato-pdf"
                    checked={candidatoEscolhido === c.id}
                    onChange={() => setCandidatoEscolhido(c.id)}
                  />
                  <span>
                    {c.numeroPedido ? `#${c.numeroPedido} — ` : ''}{c.cliente} — <span style={numStyle}>{formatMoeda(c.valorOrcado)}</span>
                    {c.dataOrcamento ? ` — ${formatData(c.dataOrcamento)}` : ''}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              style={botaoPrimario}
              onClick={() => confirmarVinculo(candidatoEscolhido ?? pedidoId, resp)}
            >
              {candidatoEscolhido ? 'Confirmar e vincular ao selecionado' : 'Confirmar e vincular a este orçamento'}
            </button>
            <button type="button" style={botaoSecundario} onClick={() => setFase({ tipo: 'idle' })}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

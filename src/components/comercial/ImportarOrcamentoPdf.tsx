'use client'

import { useRef, useState } from 'react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RespostaCriacao {
  ok: boolean
  error?: string
  criado?: boolean
  numeroPedido?: string
  cliente?: string
  camposNaoEncontrados?: string[]
}

type Fase =
  | { tipo: 'idle' }
  | { tipo: 'enviando' }
  | { tipo: 'erro'; msg: string }

interface Props {
  onCriado: (msg: string) => void
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const dropZoneBase: React.CSSProperties = {
  border: '1.5px dashed var(--cor-borda-sutil)',
  borderRadius: 14,
  padding: '36px 20px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color .15s, background .15s',
  background: 'var(--cor-fundo)',
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

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ImportarOrcamentoPdf({ onCriado }: Props) {
  const [fase, setFase] = useState<Fase>({ tipo: 'idle' })
  const [arrastando, setArrastando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function enviarArquivo(arquivo: File) {
    setFase({ tipo: 'enviando' })

    const formData = new FormData()
    formData.append('file', arquivo)

    try {
      const res = await fetch('/api/comercial-pedidos/criar-de-pdf', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json() as RespostaCriacao
      if (!res.ok || !json.ok) {
        setFase({ tipo: 'erro', msg: json.error ?? 'Erro ao processar o PDF.' })
        return
      }
      setFase({ tipo: 'idle' })
      onCriado(json.criado
        ? 'Novo pedido criado.'
        : `Pedido #${json.numeroPedido} já existe. Dados atualizados.`)
    } catch {
      setFase({ tipo: 'erro', msg: 'Erro de rede ao enviar o arquivo.' })
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
              Arraste o PDF do orçamento aqui
            </p>
            <p style={{ fontSize: 12, color: 'var(--cor-texto-suave)' }}>ou clique para selecionar um arquivo</p>
            <p style={{ fontSize: 11.5, color: 'var(--cor-texto-suave)', marginTop: 12 }}>
              Cliente, valor, data, filial e itens são extraídos automaticamente do PDF.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

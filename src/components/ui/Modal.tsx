'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  aberto: boolean
  onFechar: () => void
  titulo: string
  children: React.ReactNode
  largura?: number
}

export default function Modal({ aberto, onFechar, titulo, children, largura = 500 }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (aberto && !el.open) el.showModal()
    if (!aberto && el.open) el.close()
  }, [aberto])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => onFechar()
    el.addEventListener('close', handler)
    return () => el.removeEventListener('close', handler)
  }, [onFechar])

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      onFechar()
    }
  }

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      style={{
        border: 'none',
        borderRadius: 14,
        padding: 0,
        width: `min(${largura}px, calc(100vw - 32px))`,
        maxHeight: 'calc(100vh - 64px)',
        overflow: 'hidden auto',
        background: 'var(--paper)',
        boxShadow: '0 8px 40px rgba(0,0,0,.22)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-plex-sans), "IBM Plex Sans", sans-serif',
        fontSize: 14,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px 14px',
        borderBottom: '1px solid var(--line)',
        position: 'sticky',
        top: 0,
        background: 'var(--paper)',
        zIndex: 1,
      }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{titulo}</span>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink3)',
            fontSize: 22,
            lineHeight: 1,
            padding: '2px 6px',
            borderRadius: 6,
            fontFamily: 'inherit',
            transition: 'color .12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink3)' }}
        >
          ×
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '24px 24px 32px' }}>
        {children}
      </div>
    </dialog>
  )
}

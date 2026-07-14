'use client'

import { useState, useEffect, useRef } from 'react'
import styles from '@/styles/editorial.module.css'

export interface OpcaoCombobox {
  id: string
  label: string
}

interface ComboboxBuscaProps {
  opcoes: OpcaoCombobox[]
  valorId: string | null
  valorLabel: string
  onChange: (opcao: OpcaoCombobox | null) => void
  onCriarNovo?: (label: string) => Promise<OpcaoCombobox>
  placeholder?: string
  carregando?: boolean
}

export function ComboboxBusca({
  opcoes,
  valorId,
  valorLabel,
  onChange,
  onCriarNovo,
  placeholder = 'Buscar…',
  carregando = false,
}: ComboboxBuscaProps) {
  const [texto, setTexto] = useState(valorLabel)
  const [aberto, setAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // sincronizar texto quando o valor externo mudar
  useEffect(() => {
    setTexto(valorLabel)
  }, [valorLabel])

  useEffect(() => {
    if (!aberto) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
        // restaurar label do valor selecionado se o texto ficou parcial
        setTexto(valorLabel)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [aberto, valorLabel])

  const filtradas = texto.trim()
    ? opcoes.filter(o => o.label.toLowerCase().includes(texto.toLowerCase()))
    : opcoes

  const matchExato = opcoes.some(o => o.label.toLowerCase() === texto.trim().toLowerCase())
  const podeCriar = !!onCriarNovo && texto.trim().length > 0 && !matchExato

  async function selecionar(opcao: OpcaoCombobox) {
    onChange(opcao)
    setTexto(opcao.label)
    setAberto(false)
  }

  async function handleCriar() {
    if (!onCriarNovo || !texto.trim()) return
    setCriando(true)
    try {
      const nova = await onCriarNovo(texto.trim())
      onChange(nova)
      setTexto(nova.label)
      setAberto(false)
    } finally {
      setCriando(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        className={styles.input}
        value={texto}
        placeholder={carregando ? 'Carregando…' : placeholder}
        disabled={carregando || criando}
        onChange={e => { setTexto(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
      />

      {aberto && (filtradas.length > 0 || podeCriar) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--background)',
            border: '1px solid var(--line2)',
            boxShadow: '0 4px 12px rgba(0,0,0,.08)',
            zIndex: 100,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {filtradas.map(opcao => (
            <button
              key={opcao.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); selecionar(opcao) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 14px',
                textAlign: 'left',
                background: opcao.id === valorId ? 'var(--paper)' : 'none',
                border: 'none',
                fontSize: 13,
                color: 'var(--foreground)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {opcao.label}
            </button>
          ))}

          {podeCriar && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleCriar() }}
              disabled={criando}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 14px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: filtradas.length > 0 ? '1px solid var(--line)' : 'none',
                fontSize: 13,
                color: 'var(--ink3)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {criando ? 'Criando…' : `+ Criar "${texto.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

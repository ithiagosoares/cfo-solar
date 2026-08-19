'use client'

import { useEffect, useState } from 'react'
import type { StatusOption } from '@/lib/status-pedido-config'

const SETA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M.5.5l3.5 3.5 3.5-3.5' stroke='%23555' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`

interface StatusSelectProps {
  value: string
  opcoes: StatusOption[]
  onSave: (novoValor: string) => Promise<void>
  disabled?: boolean
}

// Dropdown inline com auto-save otimista: aplica a mudança na hora, reverte se
// a requisição falhar. Usado nas colunas de Etapa do Funil / Status da Venda.
export function StatusSelect({ value, opcoes, onSave, disabled }: StatusSelectProps) {
  const [valorLocal, setValorLocal] = useState(value)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => setValorLocal(value), [value])

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoValor = e.target.value
    const anterior = valorLocal
    setValorLocal(novoValor)
    setSalvando(true)
    try {
      await onSave(novoValor)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1500)
    } catch {
      setValorLocal(anterior)
    } finally {
      setSalvando(false)
    }
  }

  const cor = opcoes.find(o => o.value === valorLocal) ?? opcoes[0]

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
    >
      <select
        value={valorLocal}
        onChange={e => { void handleChange(e) }}
        disabled={disabled || salvando}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          border: 'none',
          borderRadius: 999,
          padding: '3px 22px 3px 9px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.03em',
          cursor: disabled ? 'default' : 'pointer',
          backgroundImage: disabled ? 'none' : SETA,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
          backgroundSize: '8px',
          backgroundColor: cor?.bg,
          color: cor?.fg,
          fontFamily: 'inherit',
          outline: 'none',
          opacity: salvando ? 0.6 : 1,
          transition: 'opacity .15s',
        }}
      >
        {opcoes.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {salvo && <span style={{ color: '#15803d', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
    </div>
  )
}

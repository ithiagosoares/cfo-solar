'use client'
import type { ReactNode } from 'react'

const BASE: React.CSSProperties = {
  border: '1px solid #DCD8D0',
  borderRadius: 8,
  background: 'var(--cor-superficie)',
  color: 'var(--cor-texto)',
  fontFamily: 'inherit',
  fontSize: 13,
  padding: '7px 11px',
  outline: 'none',
  transition: 'border-color .15s',
  width: '100%',
  boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: 'var(--cor-label)',
  display: 'block',
  marginBottom: 4,
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'var(--cor-destaque)'
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.target.style.borderColor = '#DCD8D0'
}

export function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  width = 180,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width }}>
      <span style={LABEL}>{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget.closest('form') as HTMLFormElement | null)?.requestSubmit() } }}
        style={BASE}
        onFocus={focusBorder}
        onBlur={blurBorder}
      />
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  width = 150,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  width?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width }}>
      <span style={LABEL}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...BASE, cursor: 'pointer' }}
        onFocus={focusBorder}
        onBlur={blurBorder}
      >
        <option value="">Todos</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function FilterDateRange({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={LABEL}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="date"
          value={from}
          onChange={e => onFrom(e.target.value)}
          style={{ ...BASE, width: 136 }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        />
        <span style={{ fontSize: 12, color: 'var(--cor-texto-suave)', flexShrink: 0 }}>até</span>
        <input
          type="date"
          value={to}
          onChange={e => onTo(e.target.value)}
          style={{ ...BASE, width: 136 }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        />
      </div>
    </div>
  )
}

export function FilterMonth({
  label,
  value,
  onChange,
  width = 150,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  width?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width }}>
      <span style={LABEL}>{label}</span>
      <input
        type="month"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={BASE}
        onFocus={focusBorder}
        onBlur={blurBorder}
      />
    </div>
  )
}

export function FilterNumberRange({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={LABEL}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="number"
          min={0}
          step={0.01}
          value={from}
          placeholder="Mín."
          onChange={e => onFrom(e.target.value)}
          style={{ ...BASE, width: 110 }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        />
        <span style={{ fontSize: 12, color: 'var(--cor-texto-suave)', flexShrink: 0 }}>até</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={to}
          placeholder="Máx."
          onChange={e => onTo(e.target.value)}
          style={{ ...BASE, width: 110 }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        />
      </div>
    </div>
  )
}

export function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', alignSelf: 'flex-end', paddingBottom: 8 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--cor-destaque)' }}
      />
      <span style={{ fontSize: 13, color: 'var(--cor-texto-suave)', userSelect: 'none' }}>{label}</span>
    </label>
  )
}

export function FilterBar({
  children,
  onFiltrar,
  onLimpar,
  resultLabel,
}: {
  children: ReactNode
  onFiltrar: () => void
  onLimpar: () => void
  resultLabel?: string
}) {
  return (
    <form
      onSubmit={e => { e.preventDefault(); onFiltrar() }}
      style={{
        background: '#F7F6F3',
        padding: 16,
        borderRadius: 10,
        border: '1px solid #E4E0D8',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {children}
        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
          <button
            type="submit"
            style={{
              background: 'var(--cor-destaque)',
              color: '#fff',
              border: '1.5px solid var(--cor-destaque)',
              borderRadius: 8,
              padding: '7px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background .12s, border-color .12s',
              lineHeight: 1.4,
            }}
            onMouseEnter={e => {
              const b = e.currentTarget
              b.style.background = 'var(--cor-destaque-hover)'
              b.style.borderColor = 'var(--cor-destaque-hover)'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget
              b.style.background = 'var(--cor-destaque)'
              b.style.borderColor = 'var(--cor-destaque)'
            }}
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={onLimpar}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--cor-texto-suave)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '7px 6px',
              borderRadius: 8,
              transition: 'color .12s',
              lineHeight: 1.4,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cor-texto)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--cor-texto-suave)' }}
          >
            Limpar
          </button>
        </div>
      </div>
      {resultLabel && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--cor-texto-suave)' }}>
          {resultLabel}
        </p>
      )}
    </form>
  )
}

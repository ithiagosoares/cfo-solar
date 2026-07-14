'use client'

import styles from '@/styles/editorial.module.css'

interface MetricaComFormulaProps {
  label: string
  /** Valor principal pré-formatado: "26,1%", "R$ 284.176", "+12,3%" */
  valor: string
  /** Base de cálculo em texto legível — sempre visível, sem clique */
  formula: string
  cor?: 'normal' | 'danger' | 'warning' | 'success'
  /** Nota opcional exibida abaixo da fórmula em itálico */
  nota?: string
  /**
   * 'card'    — wrapper .kpi com padding completo, para uso em grids .kpis
   * 'compact' — sem wrapper de card, para uso dentro de painéis existentes
   */
  variant?: 'card' | 'compact'
}

const COR_VALOR: Record<string, string> = {
  normal:  'var(--foreground)',
  danger:  'var(--critico)',
  warning: 'var(--pendente)',
  success: 'var(--positivo)',
}

export function MetricaComFormula({
  label,
  valor,
  formula,
  cor = 'normal',
  nota,
  variant = 'card',
}: MetricaComFormulaProps) {
  const corValor = COR_VALOR[cor] ?? 'var(--foreground)'

  if (variant === 'compact') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <p className={styles.kl}>{label}</p>
          <span
            className={`${styles.serif} ${styles.num}`}
            style={{ fontSize: 14, fontWeight: 600, color: corValor }}
          >
            {valor}
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>
          {formula}
        </p>
        {nota && (
          <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3, lineHeight: 1.4, fontStyle: 'italic' }}>
            {nota}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={styles.kpi}>
      <p className={styles.kl}>{label}</p>
      <p
        className={`${styles.kvSmall} ${styles.serif} ${styles.num}`}
        style={{ color: corValor }}
      >
        {valor}
      </p>
      <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 8, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>
        {formula}
      </p>
      {nota && (
        <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>
          {nota}
        </p>
      )}
    </div>
  )
}

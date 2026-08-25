'use client'

import { AlertTriangle, AlertCircle } from 'lucide-react'
import styles from '@/styles/editorial.module.css'
import type { Alerta } from '@/lib/cliente-inteligencia'

interface AbaAlertasProps {
  alertas: Alerta[]
}

export function AbaAlertas({ alertas }: AbaAlertasProps) {
  if (alertas.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum alerta no momento.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {alertas.map((a, i) => {
        const critico = a.severidade === 'risco'
        const Icon = critico ? AlertTriangle : AlertCircle
        return (
          <div key={i} className={`${styles.notice} ${critico ? styles.alertaDanger : ''}`} style={{ margin: 0 }}>
            <Icon style={{ width: 14, height: 14 }} />
            <span>{a.mensagem}</span>
          </div>
        )
      })}
    </div>
  )
}

export default AbaAlertas

'use client'

import styles from '@/styles/editorial.module.css'
import type { Potencial, DetalheScore } from '@/lib/cliente-inteligencia'

const COR_POTENCIAL: Record<Potencial, { bg: string; fg: string }> = {
  Alto:  { bg: '#EDF3F1', fg: '#3E6B63' },
  Médio: { bg: '#F3E4CC', fg: '#8C5A1D' },
  Baixo: { bg: '#FAEDEA', fg: '#A8452F' },
}

interface ScoreCardProps {
  score: number
  potencial: Potencial
  detalhe: DetalheScore
}

function LinhaDetalhe({ label, valor, max }: { label: string; valor: number; max: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink2)' }}>
      <span>{label}</span>
      <span className={styles.num}>{valor}/{max}</span>
    </div>
  )
}

export function ScoreCard({ score, potencial, detalhe }: ScoreCardProps) {
  const cor = COR_POTENCIAL[potencial]
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitulo}>Score</div>
      <div className={`${styles.serif} ${styles.num}`} style={{ fontSize: 46, lineHeight: 1 }}>{score}</div>
      <span
        style={{
          display: 'inline-block', marginTop: 10, padding: '3px 10px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: '.03em',
          background: cor.bg, color: cor.fg,
        }}
      >
        Potencial {potencial}
      </span>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: '1px solid var(--line2)' }}>
        <LinhaDetalhe label="Recência" valor={detalhe.recencia} max={35} />
        <LinhaDetalhe label="Frequência" valor={detalhe.frequencia} max={25} />
        <LinhaDetalhe label="Ticket médio" valor={detalhe.ticketMedio} max={20} />
        <LinhaDetalhe label="Ciclo" valor={detalhe.ciclo} max={20} />
      </div>
    </div>
  )
}

export default ScoreCard

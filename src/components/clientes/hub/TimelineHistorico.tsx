'use client'

import AtividadeCard, { type AtividadeComNome } from './AtividadeCard'

interface TimelineHistoricoProps {
  atividades: AtividadeComNome[]
}

export function TimelineHistorico({ atividades }: TimelineHistoricoProps) {
  const realizadas = atividades
    .filter(a => a.dataRealizado !== null)
    .sort((a, b) => (b.dataRealizado ?? '').localeCompare(a.dataRealizado ?? ''))

  if (realizadas.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum contato registrado ainda.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {realizadas.map(a => <AtividadeCard key={a.id} atividade={a} variante="historico" />)}
    </div>
  )
}

export default TimelineHistorico

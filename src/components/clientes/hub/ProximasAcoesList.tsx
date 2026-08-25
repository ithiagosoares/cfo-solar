'use client'

import AtividadeCard, { type AtividadeComNome } from './AtividadeCard'

interface ProximasAcoesListProps {
  atividades: AtividadeComNome[]
  onMarcarRealizado: (atividade: AtividadeComNome) => void
}

export function ProximasAcoesList({ atividades, onMarcarRealizado }: ProximasAcoesListProps) {
  const proximas = atividades
    .filter(a => a.dataAgendada !== null && a.dataRealizado === null)
    .sort((a, b) => (a.dataAgendada ?? '').localeCompare(b.dataAgendada ?? ''))

  if (proximas.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhuma ação agendada.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {proximas.map(a => (
        <AtividadeCard key={a.id} atividade={a} variante="proxima" onMarcarRealizado={() => onMarcarRealizado(a)} />
      ))}
    </div>
  )
}

export default ProximasAcoesList

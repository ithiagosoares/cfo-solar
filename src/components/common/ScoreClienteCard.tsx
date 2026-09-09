'use client'

import { useEffect, useState } from 'react'
import styles from '@/styles/editorial.module.css'
import type { ScoreIaCompleto } from '@/lib/score-repository'

type Cor = ScoreIaCompleto['cor']

const COR_SCORE: Record<Cor, { bg: string; fg: string; barra: string }> = {
  green:  { bg: '#EDF3F1', fg: '#3E6B63', barra: '#3E6B63' },
  yellow: { bg: '#F3E4CC', fg: '#8C5A1D', barra: '#8C5A1D' },
  red:    { bg: '#FAEDEA', fg: '#A8452F', barra: '#A8452F' },
}

const ESTRELAS: Record<Cor, string> = {
  green: '★★★★★',
  yellow: '★★★☆☆',
  red: '★★☆☆☆',
}

interface ScoreClienteCardProps {
  clienteCnpj: string
  size?: 'small' | 'medium' | 'large'
  showExplanation?: boolean
}

type EstadoBusca =
  | { status: 'carregando' }
  | { status: 'erro'; mensagem: string }
  | { status: 'ok'; score: ScoreIaCompleto }

export function ScoreClienteCard({ clienteCnpj, size = 'medium', showExplanation = true }: ScoreClienteCardProps) {
  const [estado, setEstado] = useState<EstadoBusca>({ status: 'carregando' })

  useEffect(() => {
    let cancelado = false
    setEstado({ status: 'carregando' })

    fetch(`/api/clientes/${clienteCnpj}/score`)
      .then(r => r.json() as Promise<{ ok: boolean; error?: string } & Partial<ScoreIaCompleto>>)
      .then(json => {
        if (cancelado) return
        if (!json.ok || json.scoreFinal === undefined) {
          setEstado({ status: 'erro', mensagem: json.error ?? 'Não foi possível calcular o score.' })
          return
        }
        setEstado({
          status: 'ok',
          score: {
            clienteCnpj: json.clienteCnpj!,
            scoreFinal: json.scoreFinal,
            detalhes: json.detalhes!,
            explicacao: json.explicacao!,
            cor: json.cor!,
            top2: json.top2!,
          },
        })
      })
      .catch(() => { if (!cancelado) setEstado({ status: 'erro', mensagem: 'Erro de rede ao calcular o score.' }) })

    return () => { cancelado = true }
  }, [clienteCnpj])

  if (estado.status === 'carregando') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelTitulo}>Score IA</div>
        <div style={{ height: 46, display: 'flex', alignItems: 'center', color: 'var(--ink3)', fontSize: 12.5 }}>
          Calculando…
        </div>
      </div>
    )
  }

  if (estado.status === 'erro') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelTitulo}>Score IA</div>
        <div className={styles.notice}>
          <span>{estado.mensagem}</span>
        </div>
      </div>
    )
  }

  const { score } = estado
  const cor = COR_SCORE[score.cor]
  const tamanhoNumero = size === 'small' ? 28 : size === 'large' ? 52 : 46

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitulo}>Score IA</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div className={`${styles.serif} ${styles.num}`} style={{ fontSize: tamanhoNumero, lineHeight: 1 }}>
          {score.scoreFinal}
          <span style={{ fontSize: tamanhoNumero * 0.35, color: 'var(--ink3)' }}>/100</span>
        </div>
        {size !== 'small' && (
          <span style={{ fontSize: 13, color: cor.fg, letterSpacing: '.02em' }}>{ESTRELAS[score.cor]}</span>
        )}
      </div>

      <div className={styles.progress} style={{ marginTop: 12, background: cor.bg }}>
        <div className={styles.progressFill} style={{ width: `${score.scoreFinal}%`, background: cor.barra }} />
      </div>

      {size !== 'small' && showExplanation && (
        <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
          {score.explicacao}
        </p>
      )}

      {size === 'large' && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: '1px solid var(--line2)' }}>
          {(Object.entries(score.detalhes) as [string, { valor: number; explicacao: string }][]).map(([nome, criterio]) => (
            <div key={nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink2)' }}>
              <span style={{ textTransform: 'capitalize' }}>{formatarNomeCriterio(nome)}</span>
              <span className={styles.num}>{criterio.valor}/100</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatarNomeCriterio(nome: string): string {
  const mapa: Record<string, string> = {
    frequencia: 'Frequência',
    recencia: 'Recência',
    valorTotal: 'Valor total',
    ticketMedio: 'Ticket médio',
    responsividade: 'Responsividade',
    consistencia: 'Consistência',
    engajamento: 'Engajamento',
    taxaResposta: 'Taxa de resposta',
  }
  return mapa[nome] ?? nome
}

export default ScoreClienteCard

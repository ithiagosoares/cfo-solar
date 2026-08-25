'use client'

import { ETAPAS_PIPELINE_CLIENTE, type EtapaPipelineCliente } from '@/lib/cliente-inteligencia'

interface AbaPipelineProps {
  etapaAtual: EtapaPipelineCliente
}

const COR_ETAPA: Record<EtapaPipelineCliente, { bg: string; fg: string }> = {
  'Novo Lead':   { bg: '#F3E4CC', fg: '#8C5A1D' },
  'Contato':     { bg: '#E3EAF0', fg: '#3A6080' },
  'Qualificado': { bg: '#FEF3C7', fg: '#B45309' },
  'Orçado':      { bg: '#F3F4F6', fg: '#6B7280' },
  'Negociação':  { bg: '#FEF3C7', fg: '#B45309' },
  'Fechado':     { bg: '#EDF3F1', fg: '#3E6B63' },
  'Perdido':     { bg: '#FAEDEA', fg: '#A8452F' },
}

// Etapas em ordem visual fixa. 'Qualificado' nunca é a etapa calculada
// automaticamente hoje (ver src/lib/cliente-inteligencia.ts) — fica só como
// referência no funil até existir um sinal de qualificação no cadastro.
export function AbaPipeline({ etapaAtual }: AbaPipelineProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
      {ETAPAS_PIPELINE_CLIENTE.map(etapa => {
        const atual = etapa === etapaAtual
        const cor = COR_ETAPA[etapa]
        return (
          <div
            key={etapa}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 999,
              border: atual ? `2px solid ${cor.fg}` : '1px solid var(--line2)',
              background: atual ? cor.bg : 'transparent',
              color: atual ? cor.fg : 'var(--ink3)',
              fontWeight: atual ? 700 : 500,
              fontSize: 13,
            }}
          >
            {etapa}
          </div>
        )
      })}
      <p style={{ width: '100%', marginTop: 12, fontSize: 12.5, color: 'var(--ink3)' }}>
        Etapa calculada automaticamente a partir da situação de cadastro e dos orçamentos/vendas do cliente.
      </p>
    </div>
  )
}

export default AbaPipeline

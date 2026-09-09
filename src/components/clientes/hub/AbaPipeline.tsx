'use client'

import { ETAPAS_PIPELINE_CLIENTE, type EtapaPipelineCliente } from '@/lib/cliente-inteligencia'
import type { PedidoResumo } from '@/lib/comercial-pedidos-repository'
import { formatMoeda } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

interface AbaPipelineProps {
  etapaAtual: EtapaPipelineCliente
  pedidosAbertos: PedidoResumo[]
  onMarcarVendido: (pedido: { id: string; cliente: string; valorOrcado: number }) => void
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
export function AbaPipeline({ etapaAtual, pedidosAbertos, onMarcarVendido }: AbaPipelineProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
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

      <div>
        <div className={styles.panelTitulo}>Orçamentos em aberto</div>
        {pedidosAbertos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum orçamento em aberto para este cliente.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pedidosAbertos.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  padding: '12px 0', borderBottom: '1px solid var(--line)',
                }}
              >
                <div>
                  <span style={{ fontSize: 13.5 }}>
                    {p.numeroPedido ? `Orçamento #${p.numeroPedido}` : 'Orçamento sem número'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink3)', marginLeft: 10 }}>
                    {fmtData(p.dataOrcamento)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span className={styles.num} style={{ fontSize: 13.5 }}>{formatMoeda(p.valorOrcado)}</span>
                  <button
                    type="button"
                    onClick={() => onMarcarVendido({ id: p.id, cliente: p.cliente, valorOrcado: p.valorOrcado })}
                    style={{
                      background: 'none', border: '1px solid var(--positivo)', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--positivo)',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    Vendido
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AbaPipeline

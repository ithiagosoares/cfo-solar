'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Info, XCircle, ChevronDown } from 'lucide-react'
import type { AlertaAnalise, NivelAlerta } from '@/types/financeiro'
import styles from '@/styles/editorial.module.css'

const CONFIG: Record<NivelAlerta, { Icon: typeof AlertTriangle; corBorda: string; corTexto: string }> = {
  danger:  { Icon: XCircle,       corBorda: 'var(--critico)',  corTexto: 'var(--critico)'  },
  warning: { Icon: AlertTriangle, corBorda: 'var(--pendente)', corTexto: 'var(--pendente)' },
  success: { Icon: CheckCircle,   corBorda: 'var(--positivo)', corTexto: 'var(--positivo)' },
  info:    { Icon: Info,          corBorda: 'var(--info)',     corTexto: 'var(--info)'     },
}

export function AlertasPanel({ alertas }: { alertas: AlertaAnalise[] }) {
  const [expandido, setExpandido] = useState<number | null>(null)
  const ordem: NivelAlerta[] = ['danger', 'warning', 'info', 'success']
  const ordenados = [...alertas].sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel))

  return (
    <div>
      <div className={styles.shead} style={{ marginBottom: 14 }}>
        <div className={`${styles.stitle} ${styles.serif}`}>Alertas</div>
        {alertas.length > 0 && (
          <div className={styles.over} style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: 10 }}>
            {alertas.length}
          </div>
        )}
      </div>

      {ordenados.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum alerta ativo.</p>
      ) : (
        <div style={{ border: '1px solid var(--line)' }}>
          {ordenados.map((alerta, i) => {
            const cfg = CONFIG[alerta.nivel] ?? CONFIG.info
            const { Icon } = cfg
            const aberto = expandido === i
            const ultimo = i === ordenados.length - 1
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandido(aberto ? null : i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    padding: '11px 14px',
                    background: aberto ? 'var(--paper)' : 'none',
                    border: 'none',
                    borderBottom: (!ultimo || aberto) ? '1px solid var(--line)' : 'none',
                    borderLeft: `3px solid ${cfg.corBorda}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.corTexto }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.35 }}>
                    {alerta.titulo}
                  </span>
                  <ChevronDown
                    className="h-3 w-3 shrink-0"
                    style={{
                      color: 'var(--ink3)',
                      transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform .18s',
                    }}
                  />
                </button>
                {aberto && (
                  <div style={{
                    padding: '10px 14px 12px 36px',
                    background: 'var(--paper)',
                    borderBottom: !ultimo ? '1px solid var(--line)' : 'none',
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>
                      {alerta.descricao}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'
import type { AlertaAnalise, NivelAlerta } from '@/types/financeiro'

const CONFIG: Record<NivelAlerta, { Icon: typeof AlertTriangle; cor: string; borda: string; bg: string }> = {
  danger:  { Icon: XCircle,       cor: '#ef4444', borda: '#7f1d1d', bg: 'rgba(239,68,68,0.08)' },
  warning: { Icon: AlertTriangle, cor: '#f59e0b', borda: '#78350f', bg: 'rgba(245,158,11,0.08)' },
  success: { Icon: CheckCircle,   cor: '#22c55e', borda: '#14532d', bg: 'rgba(34,197,94,0.08)'  },
  info:    { Icon: Info,          cor: '#3b82f6', borda: '#1e3a5f', bg: 'rgba(59,130,246,0.08)' },
}

export function AlertasPanel({ alertas }: { alertas: AlertaAnalise[] }) {
  if (alertas.length === 0) {
    return (
      <div
        className="rounded-xl border p-5 animate-fadeIn"
        style={{ background: '#1a1d27', borderColor: '#2d3148' }}
      >
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
          Alertas
        </h3>
        <p className="text-sm" style={{ color: '#64748b' }}>Nenhum alerta ativo.</p>
      </div>
    )
  }

  const ordem: NivelAlerta[] = ['danger', 'warning', 'info', 'success']
  const ordenados = [...alertas].sort(
    (a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel),
  )

  return (
    <div
      className="rounded-xl border p-5 animate-fadeIn"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
        Alertas
      </h3>
      <div className="flex flex-col gap-2">
        {ordenados.map((alerta, i) => {
          const cfg = CONFIG[alerta.nivel] ?? CONFIG.info
          const { Icon } = cfg
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border-l-4 p-3"
              style={{
                background: cfg.bg,
                borderLeftColor: cfg.cor,
                borderTop: `1px solid ${cfg.borda}`,
                borderRight: `1px solid ${cfg.borda}`,
                borderBottom: `1px solid ${cfg.borda}`,
              }}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: cfg.cor }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
                  {alerta.titulo}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                  {alerta.descricao}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

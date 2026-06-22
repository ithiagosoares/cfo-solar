'use client'

import { AlertTriangle, CheckCircle, ChevronRight, XCircle, Info } from 'lucide-react'
import type { RelatorioCompleto, NivelAlerta } from '@/types/financeiro'

type Analise = RelatorioCompleto['analise']

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border overflow-hidden animate-fadeIn"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <div className="border-b px-5 py-3" style={{ borderColor: '#2d3148', background: '#161925' }}>
        <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
          {titulo}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

const ICONE_NIVEL: Record<NivelAlerta, typeof AlertTriangle> = {
  danger:  XCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info:    Info,
}

const COR_NIVEL: Record<NivelAlerta, { cor: string; bg: string; borda: string }> = {
  danger:  { cor: '#ef4444', bg: 'rgba(239,68,68,0.08)',   borda: 'rgba(127,29,29,0.4)' },
  warning: { cor: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  borda: 'rgba(120,53,15,0.4)' },
  success: { cor: '#22c55e', bg: 'rgba(34,197,94,0.08)',   borda: 'rgba(20,83,45,0.4)'  },
  info:    { cor: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  borda: 'rgba(30,58,95,0.4)'  },
}

export function RelatorioView({ analise }: { analise: Analise }) {
  const alertasDanger = analise.alertas.filter(a => a.nivel === 'danger')
  const outrosAlertas = analise.alertas.filter(a => a.nivel !== 'danger')
  const recsOrdenadas = [...analise.recomendacoes].sort((a, b) => a.prioridade - b.prioridade)

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* Resumo Executivo */}
      <Secao titulo="Resumo Executivo">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#cbd5e1' }}>
          {analise.resumoExecutivo}
        </p>
      </Secao>

      {/* Alertas Críticos */}
      {alertasDanger.length > 0 && (
        <Secao titulo="Alertas Críticos — Ação Imediata">
          <ul className="flex flex-col gap-2">
            {alertasDanger.map((alerta, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border-l-4 px-4 py-3"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  borderLeftColor: '#ef4444',
                  border: '1px solid rgba(127,29,29,0.4)',
                  borderLeftWidth: 4,
                }}
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>{alerta.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{alerta.descricao}</p>
                </div>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {/* Outros alertas */}
      {outrosAlertas.length > 0 && (
        <Secao titulo="Alertas e Observações">
          <ul className="flex flex-col gap-2">
            {outrosAlertas.map((alerta, i) => {
              const cfg = COR_NIVEL[alerta.nivel] ?? COR_NIVEL.info
              const Icon = ICONE_NIVEL[alerta.nivel] ?? Info
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border-l-4 px-4 py-3"
                  style={{
                    background: cfg.bg,
                    borderLeftColor: cfg.cor,
                    border: `1px solid ${cfg.borda}`,
                    borderLeftWidth: 4,
                  }}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: cfg.cor }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{alerta.titulo}</p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{alerta.descricao}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </Secao>
      )}

      {/* Recomendações */}
      <Secao titulo="Recomendações — Ordenadas por Prioridade">
        {recsOrdenadas.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748b' }}>Nenhuma recomendação registrada.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recsOrdenadas.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
                >
                  {rec.prioridade}
                </span>
                <div className="flex items-start gap-2 pt-0.5">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#3b82f6' }} />
                  <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>{rec.acao}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <div className="flex items-center gap-2 text-xs py-2" style={{ color: '#4b5563' }}>
        <CheckCircle className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
        Análise gerada por Claude (claude-sonnet-4-6) com base nos dados do arquivo carregado.
      </div>
    </div>
  )
}

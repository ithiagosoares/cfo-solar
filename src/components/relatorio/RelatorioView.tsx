'use client'

import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import type { RelatorioCompleto, NivelAlerta } from '@/types/financeiro'
import styles from '@/styles/editorial.module.css'

type Analise = RelatorioCompleto['analise']

const ICONE_NIVEL: Record<NivelAlerta, typeof AlertTriangle> = {
  danger:  XCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info:    Info,
}

const COR_NIVEL: Record<NivelAlerta, string> = {
  danger:  'var(--critico)',
  warning: 'var(--pendente)',
  success: 'var(--positivo)',
  info:    'var(--info)',
}

export function RelatorioView({ analise }: { analise: Analise }) {
  const alertasDanger = analise.alertas.filter(a => a.nivel === 'danger')
  const outrosAlertas = analise.alertas.filter(a => a.nivel !== 'danger')
  const recsOrdenadas = [...analise.recomendacoes].sort((a, b) => a.prioridade - b.prioridade)

  return (
    <div className="flex flex-col gap-8 animate-fadeIn">
      <section>
        <div className={styles.shead} style={{ marginBottom: 12 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Resumo Executivo</div>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ink2)', whiteSpace: 'pre-wrap' }}>
          {analise.resumoExecutivo}
        </p>
      </section>

      {alertasDanger.length > 0 && (
        <section>
          <div className={styles.shead} style={{ marginBottom: 12 }}>
            <div className={`${styles.stitle} ${styles.serif}`}>Alertas — Ação Imediata</div>
          </div>
          <div className="flex flex-col gap-2">
            {alertasDanger.map((alerta, i) => (
              <div key={i} className={styles.notice} style={{ borderLeftColor: 'var(--critico)' }}>
                <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--critico)' }} />
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{alerta.titulo}</p>
                  <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>{alerta.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {outrosAlertas.length > 0 && (
        <section>
          <div className={styles.shead} style={{ marginBottom: 12 }}>
            <div className={`${styles.stitle} ${styles.serif}`}>Alertas e Observações</div>
          </div>
          <div className="flex flex-col gap-2">
            {outrosAlertas.map((alerta, i) => {
              const cor = COR_NIVEL[alerta.nivel] ?? 'var(--info)'
              const Icon = ICONE_NIVEL[alerta.nivel] ?? Info
              return (
                <div key={i} className={styles.notice} style={{ borderLeftColor: cor }}>
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cor }} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{alerta.titulo}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>{alerta.descricao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className={styles.shead} style={{ marginBottom: 12 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Recomendações</div>
          <div className={styles.over}>por prioridade</div>
        </div>
        {recsOrdenadas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhuma recomendação registrada.</p>
        ) : (
          <div className="flex flex-col gap-0">
            {recsOrdenadas.map((rec, i) => (
              <div key={i} className={styles.prow}>
                <div className="flex items-start gap-4">
                  <span className={`${styles.num}`} style={{ fontSize: 11, color: 'var(--ink3)', minWidth: 20, paddingTop: 3 }}>
                    {String(rec.prioridade).padStart(2, '0')}
                  </span>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink2)' }}>{rec.acao}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--ink3)', paddingTop: 8 }}>
        <CheckCircle className="h-3 w-3" style={{ color: 'var(--positivo)' }} />
        Análise gerada por Claude (claude-sonnet-4-6) com base nos dados do arquivo carregado.
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import styles from '@/styles/editorial.module.css'
import { TIPO_CONFIG, RESULTADO_CONFIG, URGENCIA_CONFIG, calcularUrgencia } from '@/lib/atividade-config'
import type { Atividade } from '@/lib/atividades-repository'

export interface AtividadeComNome extends Atividade {
  nomeUsuario: string
}

interface AtividadeCardProps {
  atividade: AtividadeComNome
  variante: 'historico' | 'proxima'
  onMarcarRealizado?: () => void
}

function fmtDataHora(iso: string): string {
  const dt = new Date(iso)
  return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function AtividadeCard({ atividade, variante, onMarcarRealizado }: AtividadeCardProps) {
  const [expandido, setExpandido] = useState(false)
  const tipoCfg = TIPO_CONFIG[atividade.tipo]
  const Icon = tipoCfg.icon
  const resultadoCfg = atividade.resultado ? RESULTADO_CONFIG[atividade.resultado] : null
  const urgenciaCfg = variante === 'proxima' && atividade.dataAgendada
    ? URGENCIA_CONFIG[calcularUrgencia(atividade.dataAgendada)]
    : null

  return (
    <div className={styles.panel} style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: tipoCfg.bg, color: tipoCfg.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon style={{ width: 16, height: 16 }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tipoCfg.fg }}>{atividade.tipo}</span>

          {resultadoCfg && atividade.resultado && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', padding: '2px 8px', borderRadius: 999,
              background: resultadoCfg.bg, color: resultadoCfg.fg,
            }}>
              {atividade.resultado}
            </span>
          )}

          {urgenciaCfg && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', padding: '2px 8px', borderRadius: 999,
              background: urgenciaCfg.bg, color: urgenciaCfg.fg,
            }}>
              {urgenciaCfg.label}
            </span>
          )}

          <span className={styles.num} style={{ fontSize: 12, color: 'var(--ink3)', marginLeft: 'auto' }}>
            {variante === 'historico' && atividade.dataRealizado ? fmtDataHora(atividade.dataRealizado) : null}
            {variante === 'proxima' && atividade.dataAgendada ? fmtData(atividade.dataAgendada) : null}
          </span>
        </div>

        {atividade.notas && (
          <div
            onClick={() => setExpandido(v => !v)}
            style={{
              fontSize: 13, color: 'var(--ink2)', marginTop: 6, cursor: 'pointer', whiteSpace: 'pre-wrap',
              display: '-webkit-box',
              WebkitLineClamp: expandido ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: expandido ? 'visible' : 'hidden',
            }}
          >
            {atividade.notas}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{atividade.nomeUsuario}</span>
          {variante === 'proxima' && onMarcarRealizado && (
            <button type="button" onClick={onMarcarRealizado} className={styles.btn} style={{ padding: '4px 12px', fontSize: 11.5 }}>
              Realizado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AtividadeCard

'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { EmpresaAnalise } from '@/types/financeiro'
import { formatMoedaCompacta, formatMargem } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

export function EmpresaCard({ empresa }: { empresa: EmpresaAnalise }) {
  // Margem operacional exclui capex, serviço da dívida, pró-labore e despesa
  // não-recorrente — usa despesasOperacionais, não o caixa total (saidas).
  const margem = empresa.entradas > 0
    ? ((empresa.entradas - empresa.despesasOperacionais) / empresa.entradas) * 100
    : 0
  const corSaldo = empresa.saldo >= 0 ? 'var(--positivo)' : 'var(--critico)'
  const corMargem = margem >= 15 ? 'var(--positivo)' : margem >= 5 ? 'var(--pendente)' : 'var(--critico)'
  const Icone = empresa.saldo > 0 ? TrendingUp : empresa.saldo < 0 ? TrendingDown : Minus

  // Abreviação: último segmento do nome (ex: "Solar System Matriz" → "Matriz")
  const abrev = empresa.nome.split(' ').pop() ?? empresa.nome

  const linhas: Array<{ label: string; valor: string; cor: string; bold?: boolean }> = [
    { label: 'Entradas', valor: formatMoedaCompacta(empresa.entradas), cor: 'var(--positivo)' },
    { label: 'Saídas',   valor: formatMoedaCompacta(empresa.saidas),   cor: 'var(--critico)'  },
    { label: 'Saldo',    valor: formatMoedaCompacta(empresa.saldo),    cor: corSaldo, bold: true },
    { label: 'Margem',   valor: formatMargem(margem),                  cor: corMargem },
  ]

  const pctSaldo = empresa.entradas > 0 ? (empresa.saldo / empresa.entradas) * 100 : 0

  return (
    <div className={styles.panel} style={{ padding: '16px 18px' }}>
      {/* Cabeçalho: abreviação + ícone */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className={styles.over} style={{ color: 'var(--marca)', letterSpacing: '.12em' }}>{abrev}</span>
        <Icone className="h-3.5 w-3.5 shrink-0" style={{ color: corSaldo, marginTop: 1 }} />
      </div>

      {/* Nome completo com overflow ellipsis */}
      <p style={{
        fontWeight: 600,
        fontSize: 12.5,
        lineHeight: 1.3,
        marginBottom: 14,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--foreground)',
      }}>
        {empresa.nome}
      </p>

      {/* Métricas em lista de uma coluna */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {linhas.map(({ label, valor, cor, bold }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 10.5, color: 'var(--ink3)', flexShrink: 0 }}>{label}</span>
            <span
              className={styles.num}
              style={{ fontSize: 12.5, fontWeight: bold ? 700 : 500, color: cor, whiteSpace: 'nowrap' }}
            >
              {valor}
            </span>
          </div>
        ))}
      </div>

      {/* Barra de progresso saldo/entradas */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--ink3)' }}>Saldo / Entradas</span>
          <span className={styles.num} style={{ fontSize: 10, color: 'var(--ink3)' }}>
            {formatMargem(pctSaldo)}
          </span>
        </div>
        <div className={styles.progress}>
          <div
            className={styles.progressFill}
            style={{
              width: `${Math.min(Math.abs(pctSaldo), 100)}%`,
              background: empresa.saldo >= 0 ? 'var(--destaque)' : 'var(--critico)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

'use client'

import type { ClienteAnalise } from '@/types/financeiro'
import { formatMoeda, formatPercentual } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

export function ClienteTabela({ clientes }: { clientes: ClienteAnalise[] }) {
  if (clientes.length === 0) {
    return <p className="py-8 text-center" style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum cliente identificado</p>
  }

  const totalValor = clientes.reduce((s, c) => s + c.valor, 0)
  const maxValor = clientes[0]?.valor ?? 1

  return (
    <div>
      <div className={styles.shead}>
        <div className={`${styles.stitle} ${styles.serif}`}>Carteira de Clientes</div>
        <div className={styles.over}>{clientes.length} registros</div>
      </div>

      <div className={`${styles.thead} ${styles.t6}`} style={{ marginTop: 18 }}>
        <div>#</div>
        <div>Cliente</div>
        <div className={styles.right}>Valor</div>
        <div className={styles.right}>Part.</div>
        <div>Empresa</div>
        <div></div>
      </div>
      {clientes.map((cliente, i) => {
        const percentual = totalValor > 0 ? (cliente.valor / totalValor) * 100 : 0
        return (
          <div key={i} className={`${styles.trow} ${styles.t6}`}>
            <div className={styles.num} style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'monospace' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cliente.nome}
            </div>
            <div className={`${styles.right} ${styles.num}`} style={{ fontWeight: 600 }}>
              {formatMoeda(cliente.valor)}
            </div>
            <div className={`${styles.right}`} style={{ fontSize: 13, color: percentual > 30 ? 'var(--pendente)' : 'var(--ink2)' }}>
              {formatPercentual(percentual)}
            </div>
            <div>
              <span className={styles.stat} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: 13 }}>
                <span className={`${styles.dot} ${styles.dBlue}`} />
                {cliente.empresa}
              </span>
            </div>
            <div className={styles.progress} style={{ alignSelf: 'center' }}>
              <div
                className={styles.progressFill}
                style={{ width: `${(cliente.valor / maxValor) * 100}%`, background: i === 0 ? 'var(--foreground)' : 'var(--line2)' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import styles from '@/styles/editorial.module.css'
import { formatMoeda } from '@/lib/utils'
import type { Cliente } from '@/lib/clientes-repository'
import type { PedidoResumo } from '@/lib/comercial-pedidos-repository'
import { vendas12Meses, type ResultadoChanceRecompra, type ProdutoTop } from '@/lib/cliente-inteligencia'

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

interface AbaInteligenciaProps {
  cliente: Cliente
  pedidos: PedidoResumo[]
  chanceRecompra: ResultadoChanceRecompra
  produtosTop: ProdutoTop[]
}

export function AbaInteligencia({ cliente, pedidos, chanceRecompra, produtosTop }: AbaInteligenciaProps) {
  const vendidos = pedidos.filter(p => p.status === 'vendido' && p.valorVendido !== null)
  const ticketMedio = vendidos.length > 0
    ? vendidos.reduce((acc, p) => acc + (p.valorVendido ?? 0), 0) / vendidos.length
    : 0
  const frequencia12m = vendas12Meses(pedidos)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className={`${styles.kpis} ${styles.kpiGrid5}`}>
        <div className={styles.kpi}>
          <p className={styles.kl}>Ticket médio</p>
          <p className={`${styles.kv} ${styles.serif} ${styles.num}`}>{formatMoeda(ticketMedio)}</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kl}>Vendas em 12 meses</p>
          <p className={`${styles.kv} ${styles.serif} ${styles.num}`}>{frequencia12m}</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kl}>Última compra</p>
          <p className={`${styles.kv} ${styles.serif} ${styles.num}`}>{fmtData(cliente.dataUltimaCompra)}</p>
        </div>
        <div className={styles.kpi}>
          <p className={styles.kl}>Chance de recompra</p>
          <p className={`${styles.kv} ${styles.serif}`}>{chanceRecompra.nivel}</p>
          {chanceRecompra.diasDesdeUltimaCompra !== null && (
            <p className={styles.kd}>{chanceRecompra.diasDesdeUltimaCompra} dias desde a última compra</p>
          )}
        </div>
      </div>

      <div>
        <div className={styles.panelTitulo}>Produtos mais comprados</div>
        {produtosTop.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum item de pedido registrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {produtosTop.map(p => (
              <div key={p.descricao} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 14 }}>{p.descricao}</span>
                <span style={{ fontSize: 13, color: 'var(--ink2)', flexShrink: 0 }} className={styles.num}>
                  {p.quantidade} un · {formatMoeda(p.valorTotal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AbaInteligencia

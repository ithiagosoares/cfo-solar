'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import type { Cliente } from '@/lib/clientes-repository'
import styles from '@/styles/editorial.module.css'

function mascaraCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

const ORIGEM_LABEL: Record<string, string> = { prospeccao: 'Prospecção', lead: 'Lead' }

interface CabecalhoClienteProps {
  cliente: Cliente
  nomeVendedor: string
  filial: string | null
}

export function CabecalhoCliente({ cliente, nomeVendedor, filial }: CabecalhoClienteProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
      <div>
        <div className={`${styles.stitle} ${styles.serif}`}>{cliente.razaoSocial}</div>
        <div className={styles.scap} style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          {mascaraCNPJ(cliente.cnpj)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 13, color: 'var(--ink2)' }}>
          <span>{cliente.cidade}/{cliente.estado}</span>
          <span>{cliente.telefone}</span>
          <span>{ORIGEM_LABEL[cliente.origem] ?? cliente.origem}</span>
          <span>{nomeVendedor}</span>
          {filial && <span>{filial}</span>}
          <span>Cliente desde {fmtData(cliente.criadoEm)}</span>
          <span>Última compra {fmtData(cliente.dataUltimaCompra)}</span>
        </div>
      </div>
      <Link
        href={`/clientes/${cliente.cnpj}/editar`}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink3)', textDecoration: 'none', flexShrink: 0 }}
      >
        <Pencil style={{ width: 13, height: 13 }} />
        Editar cadastro
      </Link>
    </div>
  )
}

export default CabecalhoCliente

'use client'

import Link from 'next/link'
import styles from '@/styles/editorial.module.css'

export interface ItemNavTab<T extends string = string> {
  id: T
  label: string
  // Itens com href navegam para uma rota própria (Link); sem href, disparam
  // onSelecionar (troca de aba interna na mesma página).
  href?: string
}

interface NavTabsProps<T extends string> {
  itens: ItemNavTab<T>[]
  ativo: T
  onSelecionar?: (id: T) => void
  /** Substitui styles.tabOn para áreas com acento diferente (ex: Comercial) */
  activeTabCls?: string
}

export function NavTabs<T extends string>({ itens, ativo, onSelecionar, activeTabCls }: NavTabsProps<T>) {
  return (
    <nav className={styles.nav}>
      {itens.map(({ id, label, href }) => {
        const ativa = ativo === id
        const className = `${styles.tab} ${ativa ? (activeTabCls ?? styles.tabOn) : ''}`

        if (href) {
          return (
            <Link key={id} href={href} className={className}>{label}</Link>
          )
        }

        return (
          <button key={id} onClick={() => onSelecionar?.(id)} className={className}>
            {label}
          </button>
        )
      })}
    </nav>
  )
}

'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export interface ItemNavTab<T extends string = string> {
  id: T
  label: string
  Icon: LucideIcon
  // Itens com href navegam para uma rota própria (Link); sem href, disparam
  // onSelecionar (troca de aba interna na mesma página).
  href?: string
}

interface NavTabsProps<T extends string> {
  itens: ItemNavTab<T>[]
  ativo: T
  onSelecionar?: (id: T) => void
}

export function NavTabs<T extends string>({ itens, ativo, onSelecionar }: NavTabsProps<T>) {
  return (
    <div className="mx-auto flex max-w-screen-2xl gap-0.5 px-5">
      {itens.map(({ id, label, Icon, href }) => {
        const ativa = ativo === id
        const className = 'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2'
        const style = {
          color: ativa ? '#3b82f6' : '#64748b',
          borderBottomColor: ativa ? '#3b82f6' : 'transparent',
        }

        if (href) {
          return (
            <Link key={id} href={href} className={className} style={style}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          )
        }

        return (
          <button key={id} onClick={() => onSelecionar?.(id)} className={className} style={style}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

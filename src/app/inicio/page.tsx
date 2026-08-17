'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from '@/styles/editorial.module.css'

type Papel = 'administrador' | 'gestor' | 'sdr' | 'vendedor' | 'sem_acesso'

interface Card {
  href: string
  titulo: string
  desc: string
  papeis: Papel[]
}

const CARDS: Card[] = [
  {
    href: '/dashboard',
    titulo: 'Dashboard',
    desc: 'Indicadores financeiros, margens e resultados consolidados.',
    papeis: ['administrador', 'gestor', 'vendedor'],
  },
  {
    href: '/clientes/kanban',
    titulo: 'Kanban de Clientes',
    desc: 'Visualize e mova clientes entre estágios do funil de CRM.',
    papeis: ['administrador', 'gestor', 'sdr', 'vendedor'],
  },
  {
    href: '/clientes/cadastro',
    titulo: 'Clientes',
    desc: 'Cadastro, busca e edição da carteira de clientes.',
    papeis: ['administrador', 'gestor', 'sdr', 'vendedor'],
  },
  {
    href: '/orcamentos',
    titulo: 'Orçamentos',
    desc: 'Acompanhe orçamentos ativos, vendas e status de cada pedido.',
    papeis: ['administrador', 'gestor', 'vendedor'],
  },
  {
    href: '/vendas',
    titulo: 'Vendas',
    desc: 'Relatório de vendas realizadas com totais por vendedor.',
    papeis: ['administrador', 'gestor', 'vendedor'],
  },
  {
    href: '/comercial/upload',
    titulo: 'Upload Comercial',
    desc: 'Importação de planilhas de orçamentos e pedidos.',
    papeis: ['administrador', 'gestor'],
  },
  {
    href: '/admin/vendedores',
    titulo: 'Vendedores',
    desc: 'Gestão de vendedores e suas filiais.',
    papeis: ['administrador'],
  },
  {
    href: '/admin/usuarios',
    titulo: 'Usuários',
    desc: 'Controle de acesso e papéis de cada usuário.',
    papeis: ['administrador'],
  },
]

export default function InicioPage() {
  const [papel, setPapel] = useState<Papel | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((d: { papel?: Papel }) => {
        if (d.papel === 'sem_acesso') {
          window.location.replace('/acesso-negado')
        } else {
          setPapel(d.papel ?? null)
        }
      })
      .catch(() => setPapel('administrador'))
  }, [])

  if (!papel) {
    return (
      <div className={styles.page} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }} />
      </div>
    )
  }

  const cardsVisiveis = CARDS.filter(c => c.papeis.includes(papel))

  return (
    <div className={styles.page}>
      <div className={styles.htop}>
        <div className={styles.wrap}>
          <div className={styles.brand} style={{ paddingBottom: 22 }}>
            <span className={styles.bname}>CFO Solar</span>
            <span className={styles.bsub}>Grupo Solar System</span>
          </div>
        </div>
      </div>

      <div className={styles.wrap}>
        <div className={styles.sect}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {cardsVisiveis.map(card => (
              <Link key={card.href} href={card.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '20px 20px 18px',
                  cursor: 'pointer',
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--marca)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,.07)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)', marginBottom: 7 }}>
                    {card.titulo}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
                    {card.desc}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

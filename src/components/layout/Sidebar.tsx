'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart2, FileText, TrendingUp, Upload,
  UserPlus, FilePlus, Users, Shield, LogOut,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from '@/styles/editorial.module.css'

type Papel = 'administrador' | 'gestor' | 'sdr' | 'vendedor' | 'sem_acesso'

interface MeData {
  papel: Papel
  nome: string | null
  email: string
}

interface MenuItem {
  label: string
  href: string
  icon: React.ComponentType<{ style?: React.CSSProperties }>
  papeis?: Papel[]
}

interface MenuSection {
  label: string
  papeis: Papel[]
  items: MenuItem[]
}

const MENU: MenuSection[] = [
  {
    label: 'Comercial',
    papeis: ['administrador', 'gestor', 'vendedor'],
    items: [
      { label: 'Dashboard Comercial', href: '/dashboard',        icon: BarChart2 },
      { label: 'Orçamentos',          href: '/orcamentos',       icon: FileText },
      { label: 'Vendas',              href: '/vendas',           icon: TrendingUp },
      { label: 'Upload de Relatório', href: '/comercial/upload', icon: Upload, papeis: ['administrador', 'gestor'] },
    ],
  },
  {
    label: 'Cadastros',
    papeis: ['administrador', 'gestor', 'sdr', 'vendedor'],
    items: [
      { label: 'Cadastro de Cliente',    href: '/clientes/cadastro',    icon: UserPlus },
      { label: 'Cadastro de Orçamento',  href: '/orcamentos/cadastro',  icon: FilePlus, papeis: ['administrador', 'gestor', 'vendedor'] },
    ],
  },
  {
    label: 'Administração',
    papeis: ['administrador'],
    items: [
      { label: 'Gerenciar Vendedores',  href: '/admin/vendedores', icon: Users },
      { label: 'Usuários do Sistema',   href: '/admin/usuarios',   icon: Shield },
    ],
  },
]

const LABEL_PAPEL: Record<Papel, string> = {
  administrador: 'Administrador',
  gestor:        'Gestor',
  sdr:           'SDR',
  vendedor:      'Vendedor',
  sem_acesso:    'Sem acesso',
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [me, setMe] = useState<MeData | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((d: MeData) => setMe(d))
      .catch(() => {})
  }, [])

  async function handleSair() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const papel         = me?.papel ?? 'sem_acesso'
  const nomeExibicao  = me?.nome ?? me?.email ?? '…'

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.sidebarLogo}>
        <span className={styles.sidebarLogoText}>CFO.IA</span>
      </div>

      {/* Menu */}
      <nav className={styles.sidebarNav}>
        {MENU.map(section => {
          if (!section.papeis.includes(papel)) return null
          const visibleItems = section.items.filter(
            item => !item.papeis || item.papeis.includes(papel),
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={section.label} className={styles.sidebarSection}>
              <span className={styles.sidebarSectionLabel}>{section.label}</span>
              {visibleItems.map(item => {
                const Icon     = item.icon
                const isActive = pathname === item.href
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                  >
                    <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                    {item.label}
                  </a>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarUserInfo}>
          <div className={styles.sidebarUserName}>{nomeExibicao}</div>
          {me && <div className={styles.sidebarUserRole}>{LABEL_PAPEL[papel]}</div>}
        </div>
        <button
          onClick={handleSair}
          className={styles.sidebarLogout}
          aria-label="Sair"
          title="Sair"
        >
          <LogOut style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </aside>
  )
}

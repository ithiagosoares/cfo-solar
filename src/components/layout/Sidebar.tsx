'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart2, FileText, TrendingUp, Upload,
  UserPlus, Users, Shield, LogOut, Kanban, Bell,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from '@/styles/editorial.module.css'
import NotificacoesModal from './NotificacoesModal'
import type { AlertaItem } from '@/lib/alertas'
import { ouvirAtividadeSalva } from '@/lib/alertas-eventos'

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
      { label: 'Kanban de Clientes',     href: '/clientes/kanban',      icon: Kanban },
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

// Mesmos 3 papéis com acesso ao botão de Notificações em /api/alertas.
const PAPEIS_COM_ALERTAS: Papel[] = ['administrador', 'gestor', 'vendedor']

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [me, setMe] = useState<MeData | null>(null)
  const [alertas, setAlertas] = useState<AlertaItem[]>([])
  const [carregandoAlertas, setCarregandoAlertas] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((d: MeData) => setMe(d))
      .catch(() => {})
  }, [])

  // carregandoAlertas só cobre a primeira carga — refetches disparados pelo
  // modal (após uma ação rápida) atualizam a lista em silêncio, sem spinner.
  const recarregarAlertas = useCallback(async () => {
    console.log('[Sidebar] recarregarAlertas() chamada — iniciando fetch de /api/alertas')
    try {
      const json = await fetch('/api/alertas').then(r => r.json()) as { ok: boolean; alertas?: AlertaItem[] }
      const novaLista = json.ok && json.alertas ? json.alertas : []
      setAlertas(novaLista)
      console.log('[Sidebar] Refetch completo, novo estado:', novaLista)
    } catch (e) {
      console.log('[Sidebar] Refetch falhou:', e)
      setAlertas([])
    } finally {
      setCarregandoAlertas(false)
    }
  }, [])

  // On-demand: recalcula a cada carregamento da sidebar (cada navegação), sem cron.
  useEffect(() => {
    fetch('/api/alertas')
      .then(r => r.json())
      .then((json: { ok: boolean; alertas?: AlertaItem[] }) => setAlertas(json.ok && json.alertas ? json.alertas : []))
      .catch(() => setAlertas([]))
      .finally(() => setCarregandoAlertas(false))
  }, [])

  // ModalRegistrarAtividade/ModalAgendarAtividade também são usados fora da
  // NotificacoesModal (ex: página de detalhe do cliente), então precisam de
  // um jeito de avisar a Sidebar mesmo sem referência ao onRecarregar dela.
  useEffect(() => {
    console.log('[Sidebar] Registrando listener de alertas-eventos')
    const handler = () => {
      console.log('[Sidebar] Evento recebido, refetchando alertas')
      void recarregarAlertas()
    }
    return ouvirAtividadeSalva(handler)
  }, [recarregarAlertas])

  async function handleSair() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const papel         = me?.papel ?? 'sem_acesso'
  const nomeExibicao  = me?.nome ?? me?.email ?? '…'
  const temAlertas    = PAPEIS_COM_ALERTAS.includes(papel)
  const totalCriticos = alertas.filter(a => a.nivel === 'critico').length

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

        {temAlertas && (
          <div className={styles.sidebarSection}>
            <button
              onClick={() => setModalAberto(true)}
              className={styles.sidebarItem}
              style={{
                width: '100%', border: 'none', background: 'none', cursor: 'pointer',
                font: 'inherit', textAlign: 'left',
              }}
            >
              <Bell style={{ width: 16, height: 16, flexShrink: 0 }} />
              Notificações
              {totalCriticos > 0 && (
                <span style={{
                  marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                  background: '#ef4444', color: '#fff',
                  fontSize: 11, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
                }}>
                  {totalCriticos}
                </span>
              )}
            </button>
          </div>
        )}
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

      {temAlertas && (
        <NotificacoesModal
          aberto={modalAberto}
          onFechar={() => setModalAberto(false)}
          alertas={alertas}
          carregando={carregandoAlertas}
          ehGestor={papel === 'administrador' || papel === 'gestor'}
          onRecarregar={recarregarAlertas}
        />
      )}
    </aside>
  )
}

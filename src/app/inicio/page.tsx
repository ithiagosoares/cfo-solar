'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart2, Upload, UserPlus, FilePlus, Users, FileText, LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from '@/styles/editorial.module.css'

type Papel = 'administrador' | 'gestor' | 'sdr' | 'vendedor' | 'sem_acesso'

interface MeResponse {
  papel: Papel
  nome: string | null
  email: string
}

interface Modulo {
  titulo: string
  descricao: string
  href: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  papeis: Papel[]
}

const MODULOS: Modulo[] = [
  {
    titulo: 'Dashboard Comercial',
    descricao: 'Visão geral de orçamentos, vendas e indicadores de performance.',
    href: '/comercial',
    icon: BarChart2,
    papeis: ['administrador', 'gestor', 'vendedor'],
  },
  {
    titulo: 'Orçamentos',
    descricao: 'Lista de orçamentos e pedidos da carteira comercial.',
    href: '/orcamentos',
    icon: FileText,
    papeis: ['administrador', 'gestor', 'vendedor'],
  },
  {
    titulo: 'Upload de Relatório',
    descricao: 'Importar relatório de orçamentos do sistema Upper.',
    href: '/comercial/upload',
    icon: Upload,
    papeis: ['administrador', 'gestor'],
  },
  {
    titulo: 'Cadastro de Cliente',
    descricao: 'Cadastrar novo cliente CNPJ na carteira comercial.',
    href: '/clientes/cadastro',
    icon: UserPlus,
    papeis: ['administrador', 'gestor', 'sdr'],
  },
  {
    titulo: 'Cadastro de Orçamento',
    descricao: 'Registrar orçamento manualmente sem upload de relatório.',
    href: '/orcamentos/cadastro',
    icon: FilePlus,
    papeis: ['administrador', 'gestor'],
  },
  {
    titulo: 'Usuários do Sistema',
    descricao: 'Gerenciar usuários, papéis e permissões de acesso.',
    href: '/admin/usuarios',
    icon: Users,
    papeis: ['administrador'],
  },
]

const LABEL_PAPEL: Record<Papel, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  sdr: 'SDR',
  vendedor: 'Vendedor',
  sem_acesso: 'Sem acesso',
}

export default function InicioPage() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((d: MeResponse) => {
        if (d.papel === 'sem_acesso') {
          router.replace('/acesso-negado')
          return
        }
        setMe(d)
        setCarregando(false)
      })
      .catch(() => setCarregando(false))
  }, [router])

  async function handleSair() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (carregando) {
    return (
      <div className={styles.page} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
        />
      </div>
    )
  }

  if (!me) return null

  const modulosVisiveis = MODULOS.filter(m => m.papeis.includes(me.papel))
  const nomeExibicao = me.nome ?? me.email

  return (
    <div className={styles.page} style={{ minHeight: '100vh' }}>
      {/* Topo */}
      <div style={{ borderBottom: '1px solid var(--line)', padding: '18px 0' }}>
        <div className={styles.wrap} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/logo.png" alt="CFO.IA" style={{ height: 40, width: 'auto' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{nomeExibicao}</p>
              <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 1 }}>
                {LABEL_PAPEL[me.papel]}
              </p>
            </div>
            <button
              onClick={handleSair}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--ink3)', background: 'none', border: 'none',
                cursor: 'pointer', padding: '6px 0',
              }}
              aria-label="Sair"
            >
              <LogOut style={{ width: 14, height: 14 }} />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <main className={styles.wrap} style={{ paddingTop: 48, paddingBottom: 72 }}>
        <h1 className={styles.serif} style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>
          Gestor Comercial
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 40 }}>
          Selecione um módulo para continuar.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {modulosVisiveis.map(modulo => {
            const Icon = modulo.icon
            return (
              <a
                key={modulo.href}
                href={modulo.href}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className={styles.panel}
                  style={{
                    cursor: 'pointer',
                    transition: 'border-color .15s',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--marca)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
                >
                  <Icon style={{ width: 22, height: 22, color: 'var(--ink3)' }} />
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{modulo.titulo}</p>
                    <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>{modulo.descricao}</p>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </main>
    </div>
  )
}

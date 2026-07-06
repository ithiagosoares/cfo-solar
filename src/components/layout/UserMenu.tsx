'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from '@/styles/editorial.module.css'

export interface UsuarioInfo {
  email: string
  role: 'admin' | 'viewer'
  nome: string | null
  avatar: string | null
}

interface UserMenuProps {
  usuario: UsuarioInfo
}

export function UserMenu({ usuario }: UserMenuProps) {
  const router = useRouter()

  async function handleSair() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const nomeExibicao = usuario.nome ?? usuario.email

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {usuario.avatar && (
        <img
          src={usuario.avatar}
          alt={nomeExibicao}
          referrerPolicy="no-referrer"
          style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }}
        />
      )}
      <span style={{ fontSize: 12, color: 'var(--ink3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nomeExibicao}
      </span>
      {usuario.role === 'admin' && (
        <a
          href="/admin/usuarios"
          className={styles.btn}
          style={{ fontSize: 12, padding: '5px 12px', textDecoration: 'none' }}
        >
          Usuários
        </a>
      )}
      <button
        onClick={handleSair}
        className={styles.btn}
        style={{ fontSize: 12, padding: '5px 12px' }}
      >
        Sair
      </button>
    </div>
  )
}

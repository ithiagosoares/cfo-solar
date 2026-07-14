'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FileDown, Users, LogOut } from 'lucide-react'
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
  onImportarArquivo?: () => void
  onExportPDF?: () => void
  podeExportarPDF?: boolean
}

export function UserMenu({ usuario, onImportarArquivo, onExportPDF, podeExportarPDF }: UserMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [open])

  async function handleSair() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const nomeExibicao = usuario.nome ?? usuario.email
  const inicial = nomeExibicao.charAt(0).toUpperCase()

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Avatar clickável */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 30, height: 30, borderRadius: '50%',
          border: open ? '2px solid var(--foreground)' : '2px solid var(--line2)',
          background: 'var(--paper)',
          cursor: 'pointer', padding: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color .15s',
          flexShrink: 0,
        }}
        aria-label="Menu do usuário"
      >
        {usuario.avatar ? (
          <img
            src={usuario.avatar}
            alt={nomeExibicao}
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }}>
            {inicial}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            minWidth: 200, background: 'var(--background)',
            border: '1px solid var(--line2)',
            boxShadow: '0 4px 16px rgba(0,0,0,.08)',
            zIndex: 50,
          }}
        >
          {/* Cabeçalho: nome/email */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--line)',
              fontSize: 12,
              color: 'var(--ink3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nomeExibicao}
          </div>

          {/* Itens */}
          <div style={{ padding: '6px 0' }}>
            {usuario.role !== 'viewer' && (
              <button
                className={styles.menuItem}
                onClick={() => { onImportarArquivo?.(); setOpen(false) }}
              >
                <FileDown className="h-3.5 w-3.5" />
                Importar PDF
              </button>
            )}
            {podeExportarPDF && (
              <button
                className={styles.menuItem}
                onClick={() => { onExportPDF?.(); setOpen(false) }}
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar PDF
              </button>
            )}

            {usuario.role === 'admin' && (
              <>
                <a
                  href="/admin/usuarios"
                  className={styles.menuItem}
                  onClick={() => setOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <Users className="h-3.5 w-3.5" />
                  Usuários do sistema
                </a>
                <a
                  href="/admin/vendedores"
                  className={styles.menuItem}
                  onClick={() => setOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <Users className="h-3.5 w-3.5" />
                  Vendedores
                </a>
              </>
            )}

            <button
              className={styles.menuItem}
              onClick={handleSair}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

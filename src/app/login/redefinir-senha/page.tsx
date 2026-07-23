'use client'

import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from '@/styles/editorial.module.css'

type Estado = 'verificando' | 'form' | 'link_invalido' | 'sucesso'

export default function RedefinirSenhaPage() {
  const [estado, setEstado] = useState<Estado>('verificando')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const jaVerificou = useRef(false)

  useEffect(() => {
    if (jaVerificou.current) return
    jaVerificou.current = true

    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const type = params.get('type')

    if (!tokenHash || type !== 'recovery') {
      setEstado('link_invalido')
      return
    }

    const supabase = createSupabaseBrowserClient()
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error }) => {
      setEstado(error ? 'link_invalido' : 'form')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setCarregando(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado — solicite uma nova recuperação.')
      setCarregando(false)
      return
    }
    setEstado('sucesso')
    setCarregando(false)
    setTimeout(() => { window.location.href = '/' }, 3000)
  }

  const shell = (children: React.ReactNode) => (
    <div
      className={styles.page}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 360, width: '100%', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="CFO.IA" style={{ height: 48, width: 'auto', margin: '-8px 0 4px' }} />
        </div>
        {children}
      </div>
    </div>
  )

  if (estado === 'verificando') {
    return shell(
      <p style={{ fontSize: 13, color: 'var(--ink3)', textAlign: 'center' }}>Verificando…</p>
    )
  }

  if (estado === 'link_invalido') {
    return shell(
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ borderLeft: '3px solid var(--critico)', padding: '14px 18px' }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--critico)', marginBottom: 6 }}>
            Link expirado ou já utilizado
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
            Links de recuperação de senha têm validade de 1 hora e só podem ser usados uma vez.
          </p>
        </div>
        <a
          href="/login/recuperar-senha"
          className={styles.btnPrimary}
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          Solicitar nova recuperação
        </a>
        <a href="/login" style={{ fontSize: 12.5, color: 'var(--ink3)', textDecoration: 'none', textAlign: 'center' }}>
          ← Voltar ao login
        </a>
      </div>
    )
  }

  if (estado === 'sucesso') {
    return shell(
      <div style={{ borderLeft: '3px solid var(--positivo)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--positivo)' }}>Senha redefinida</p>
        <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
          Sua senha foi atualizada com sucesso. Redirecionando…
        </p>
      </div>
    )
  }

  return shell(
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 4, lineHeight: 1.6 }}>
        Escolha uma nova senha para sua conta.
      </p>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Nova senha</label>
        <input
          type="password"
          required
          value={novaSenha}
          onChange={e => setNovaSenha(e.target.value)}
          placeholder="mínimo 6 caracteres"
          minLength={6}
          disabled={carregando}
          className={styles.input}
          autoFocus
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Confirmar nova senha</label>
        <input
          type="password"
          required
          value={confirmar}
          onChange={e => setConfirmar(e.target.value)}
          placeholder="repita a senha"
          disabled={carregando}
          className={styles.input}
        />
      </div>
      {erro && (
        <p style={{ fontSize: 12.5, color: 'var(--critico)' }}>{erro}</p>
      )}
      <button
        type="submit"
        disabled={carregando}
        className={styles.btnPrimary}
      >
        {carregando ? 'Salvando…' : 'Redefinir senha'}
      </button>
    </form>
  )
}

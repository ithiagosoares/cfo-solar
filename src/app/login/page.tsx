'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from '@/styles/editorial.module.css'

export default function LoginPage() {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregandoSenha, setCarregandoSenha] = useState(false)

  async function handleGoogleLogin() {
    setCarregando(true)
    setErro(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://nihaobr.com.br/auth/callback' },
    })
    if (error) {
      setErro('Não foi possível iniciar o login. Tente novamente.')
      setCarregando(false)
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setCarregandoSenha(true)
    setErro(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('Email ou senha incorretos.')
      setCarregandoSenha(false)
      return
    }
    window.location.href = '/'
  }

  const algumCarregando = carregando || carregandoSenha

  return (
    <div
      className={styles.page}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          width: '100%',
          maxWidth: 360,
          padding: '0 24px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <img
            src="/logo.png"
            alt="CFO.IA"
            style={{ height: 56, width: 'auto', margin: '-10px 0 4px' }}
          />
          <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 8, letterSpacing: '.02em' }}>
            Painel financeiro · Grupo Solar System
          </p>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={algumCarregando}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              border: '1px solid var(--line2)',
              background: 'none',
              padding: '11px 24px',
              cursor: algumCarregando ? 'default' : 'pointer',
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 14,
              color: 'var(--foreground)',
              opacity: algumCarregando ? 0.5 : 1,
              transition: 'border-color .15s, color .15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {carregando ? 'Aguarde…' : 'Entrar com Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--line2)', margin: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--ink3)' }}>ou</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--line2)', margin: 0 }} />
          </div>

          {/* Email + senha */}
          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              disabled={algumCarregando}
              className={styles.input}
              style={{ width: '100%' }}
            />
            <input
              type="password"
              required
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Senha"
              disabled={algumCarregando}
              className={styles.input}
              style={{ width: '100%' }}
            />
            <button
              type="submit"
              disabled={algumCarregando}
              style={{
                border: '1px solid var(--line2)',
                background: 'none',
                padding: '11px 24px',
                cursor: algumCarregando ? 'default' : 'pointer',
                width: '100%',
                fontFamily: 'inherit',
                fontSize: 14,
                color: 'var(--foreground)',
                opacity: algumCarregando ? 0.5 : 1,
                transition: 'border-color .15s',
                marginTop: 2,
              }}
            >
              {carregandoSenha ? 'Aguarde…' : 'Entrar com email'}
            </button>
            <a
              href="/login/recuperar-senha"
              style={{
                fontSize: 12,
                color: 'var(--ink3)',
                textAlign: 'right',
                textDecoration: 'none',
                marginTop: 2,
              }}
            >
              Esqueci minha senha
            </a>
          </form>

          {erro && (
            <p style={{ fontSize: 12.5, color: 'var(--critico)', textAlign: 'center' }}>
              {erro}
            </p>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--ink3)', textAlign: 'center', letterSpacing: '.01em' }}>
          Acesso restrito a usuários autorizados
        </p>
      </div>
    </div>
  )
}

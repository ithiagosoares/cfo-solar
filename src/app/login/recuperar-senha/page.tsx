'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import styles from '@/styles/editorial.module.css'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://nihaobr.com.br/login/redefinir-senha',
    })
    // Nunca confirmar se o email existe ou não (prevenção de enumeração).
    // Exibimos sucesso independente do resultado, exceto erros de rede/config.
    if (error && error.status !== 400) {
      setErro('Não foi possível enviar o email. Tente novamente em instantes.')
      setCarregando(false)
      return
    }
    setEnviado(true)
    setCarregando(false)
  }

  if (enviado) {
    return (
      <div
        className={styles.page}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
      >
        <div style={{ maxWidth: 360, width: '100%', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <img src="/logo.png" alt="CFO.IA" style={{ height: 48, width: 'auto', alignSelf: 'center' }} />
          <div
            style={{
              borderLeft: '3px solid var(--positivo)',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--positivo)' }}>Email enviado</p>
            <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
              Se o endereço <strong style={{ color: 'var(--foreground)' }}>{email}</strong> estiver cadastrado,
              você receberá as instruções em breve. Verifique também a caixa de spam.
            </p>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.6 }}>
            O link expira em 1 hora. Se não receber, volte aqui e solicite novamente.
          </p>
          <a href="/login" style={{ fontSize: 12.5, color: 'var(--ink2)', textDecoration: 'none' }}>
            ← Voltar ao login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      className={styles.page}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 360, width: '100%', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="CFO.IA" style={{ height: 48, width: 'auto', margin: '-8px 0 4px' }} />
          <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 8 }}>Recuperação de senha</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Email da conta</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@empresa.com"
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
            {carregando ? 'Enviando…' : 'Enviar instruções'}
          </button>
        </form>

        <a href="/login" style={{ fontSize: 12.5, color: 'var(--ink3)', textDecoration: 'none', textAlign: 'center' }}>
          ← Voltar ao login
        </a>
      </div>
    </div>
  )
}

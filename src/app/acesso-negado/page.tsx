import Link from 'next/link'
import styles from '@/styles/editorial.module.css'

export default function AcessoNegadoPage() {
  return (
    <div
      className={styles.page}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 24,
      }}
    >
      <img src="/logo.png" alt="CFO.IA" style={{ height: 48, width: 'auto', margin: '-8px 0' }} />

      <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 24px' }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)', marginBottom: 10 }}>
          Acesso não autorizado
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.65 }}>
          Seu email não está na lista de usuários autorizados. Entre em contato com o administrador.
        </p>
      </div>

      <Link
        href="/login"
        className={styles.btn}
        style={{ display: 'inline-block', textDecoration: 'none' }}
      >
        Voltar ao login
      </Link>
    </div>
  )
}

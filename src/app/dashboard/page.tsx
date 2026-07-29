'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ComercialDashboard } from '@/components/comercial/ComercialDashboard'
import styles from '@/styles/editorial.module.css'

interface MeResponse {
  papel: string
  vendedorId: string | null
  nome: string | null
  email: string
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((d: MeResponse) => setMe(d))
      .catch(() => {})
  }, [])

  if (!me) {
    return (
      <div className={styles.page} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
        />
      </div>
    )
  }

  return (
    <div className={styles.page} style={{ minHeight: '100vh' }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: '18px 0' }}>
        <div className={styles.wrap} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a
            href="/inicio"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Início
          </a>
          <img src="/logo.png" alt="CFO.IA" style={{ height: 36, width: 'auto' }} />
        </div>
      </div>

      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72 }}>
        <h1 className={styles.serif} style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
          Dashboard Comercial
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 36 }}>
          Desempenho por vendedor, indicadores e oportunidades em aberto.
        </p>
        <ComercialDashboard papel={me.papel} vendedorId={me.vendedorId} />
      </main>
    </div>
  )
}

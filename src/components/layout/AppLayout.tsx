'use client'

import Sidebar from './Sidebar'
import styles from '@/styles/editorial.module.css'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cor-fundo)' }}>
      <Sidebar />
      <div className={styles.appContent}>
        {children}
      </div>
    </div>
  )
}

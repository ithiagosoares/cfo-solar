'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import styles from '@/styles/editorial.module.css'

interface StatusConexao {
  conectado: boolean
  conectadoPor: string | null
  conectadoEm: string | null
}

export default function AdminGoogleDrivePage() {
  return (
    <Suspense fallback={null}>
      <AdminGoogleDriveConteudo />
    </Suspense>
  )
}

function AdminGoogleDriveConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<StatusConexao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch('/api/admin/google-drive/status')
      if (res.status === 403) { router.push('/'); return }
      const json = await res.json() as { ok: boolean; status?: StatusConexao; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Erro ao carregar status')
      setStatus(json.status ?? null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()

    const statusParam = searchParams.get('status')
    const mensagem = searchParams.get('mensagem')
    if (statusParam === 'ok' || statusParam === 'erro') {
      setFeedback({ tipo: statusParam === 'ok' ? 'ok' : 'erro', msg: mensagem ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fmtData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR')
  }

  return (
    <AppLayout>
      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72, maxWidth: 640 }}>
        <h1 className={styles.serif} style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
          Google Drive
        </h1>
        <p style={{ fontSize: 13, color: 'var(--cor-texto-suave)', marginBottom: 32 }}>
          Conta usada para armazenar os PDFs de orçamento anexados aos pedidos.
        </p>

        {feedback && (
          <div style={{
            marginBottom: 20,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: feedback.tipo === 'ok' ? 'var(--cor-sucesso-bg)' : 'var(--cor-erro-bg)',
            color: feedback.tipo === 'ok' ? 'var(--cor-sucesso)' : 'var(--cor-erro)',
            border: `1px solid ${feedback.tipo === 'ok' ? 'var(--cor-sucesso)' : 'var(--cor-erro)'}`,
          }}>
            {feedback.msg}
          </div>
        )}

        {erro && (
          <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginBottom: 20 }}>
            <span>{erro}</span>
          </div>
        )}

        <div style={{
          border: '1.5px solid var(--cor-borda-sutil)',
          borderRadius: 16,
          padding: '20px 24px',
        }}>
          {carregando ? (
            <p style={{ fontSize: 13, color: 'var(--cor-texto-suave)' }}>Carregando…</p>
          ) : status?.conectado ? (
            <>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cor-sucesso)', marginBottom: 8 }}>
                ● Conectado
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--cor-texto-suave)', marginBottom: 4 }}>
                Conectado por: {status.conectadoPor ?? '—'}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--cor-texto-suave)', marginBottom: 16 }}>
                Desde: {status.conectadoEm ? fmtData(status.conectadoEm) : '—'}
              </p>
              <a
                href="/api/admin/google-drive/conectar"
                style={{
                  display: 'inline-block',
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--cor-borda-sutil)',
                  fontSize: 13,
                  textDecoration: 'none',
                  color: 'var(--cor-texto)',
                }}
              >
                Reconectar com outra conta
              </a>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cor-texto-suave)', marginBottom: 16 }}>
                ○ Não conectado
              </p>
              <a
                href="/api/admin/google-drive/conectar"
                style={{
                  display: 'inline-block',
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cor-destaque)',
                  background: 'var(--cor-destaque)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Conectar Google Drive
              </a>
            </>
          )}
        </div>
      </main>
    </AppLayout>
  )
}

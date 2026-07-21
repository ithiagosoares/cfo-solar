'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from '@/styles/editorial.module.css'

interface UsuarioCadastrado {
  id: string
  email: string
  role: 'admin' | 'viewer'
  comercial_role: 'gestor' | null
  nome: string | null
  criado_em: string
  criado_por: string | null
}

export default function AdminUsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<UsuarioCadastrado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novoEmail, setNovoEmail] = useState('')
  const [novoRole, setNovoRole] = useState<'admin' | 'viewer'>('viewer')
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [salvandoComercial, setSalvandoComercial] = useState<Record<string, boolean>>({})

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch('/api/admin/usuarios')
      if (res.status === 403) { router.push('/'); return }
      if (!res.ok) throw new Error('Erro ao carregar usuários')
      const json = await res.json() as { usuarios: UsuarioCadastrado[] }
      setUsuarios(json.usuarios)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    setErroForm(null)
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: novoEmail, role: novoRole, nome: novoNome || undefined }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao adicionar')
      setNovoEmail('')
      setNovoNome('')
      setNovoRole('viewer')
      await carregar()
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Erro ao adicionar')
    } finally {
      setSalvando(false)
    }
  }

  async function handleAlterarComercialRole(email: string, novoValor: 'gestor' | null) {
    setSalvandoComercial(prev => ({ ...prev, [email]: true }))
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, comercial_role: novoValor }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar acesso comercial')
    } finally {
      setSalvandoComercial(prev => ({ ...prev, [email]: false }))
    }
  }

  async function handleRemover(email: string) {
    if (!confirm(`Remover acesso de ${email}?`)) return
    try {
      const res = await fetch(`/api/admin/usuarios?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao remover')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover')
    }
  }

  return (
    <div className={styles.page} style={{ minHeight: '100vh' }}>
      <div className={`${styles.hdr} ${styles.htop}`}>
        <div className={styles.wrap}>
          <div className={styles.brand} style={{ alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="CFO.IA" style={{ height: 52, width: 'auto', margin: '-9px 0' }} />
              <span className={styles.bsub}>Administração · Usuários</span>
            </div>
            <a href="/" className={styles.btn} style={{ fontSize: 12, padding: '5px 12px', textDecoration: 'none' }}>
              ← Dashboard
            </a>
          </div>
        </div>
      </div>

      <div className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className={styles.shead} style={{ marginBottom: 24 }}>
          <h1 className={styles.stitle}>Usuários autorizados</h1>
        </div>

        {erro && (
          <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginBottom: 20 }}>
            <span>{erro}</span>
          </div>
        )}

        {/* Formulário de adição */}
        <div className={styles.panel} style={{ marginBottom: 40, maxWidth: 540 }}>
          <p className={styles.panelTitulo}>Adicionar usuário</p>
          <form onSubmit={handleAdicionar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email</label>
              <input
                type="email"
                required
                value={novoEmail}
                onChange={e => setNovoEmail(e.target.value)}
                placeholder="email@empresa.com"
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nome (opcional)</label>
              <input
                type="text"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Nome completo"
                className={styles.input}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Role</label>
              <select
                value={novoRole}
                onChange={e => setNovoRole(e.target.value as 'admin' | 'viewer')}
                className={styles.select}
              >
                <option value="viewer">viewer — acesso somente leitura</option>
                <option value="admin">admin — acesso total + gestão de usuários</option>
              </select>
            </div>
            {erroForm && (
              <p style={{ fontSize: 12.5, color: 'var(--critico)' }}>{erroForm}</p>
            )}
            <button type="submit" disabled={salvando} className={styles.btnPrimary} style={{ alignSelf: 'flex-start' }}>
              {salvando ? 'Salvando���' : 'Adicionar'}
            </button>
          </form>
        </div>

        {/* Tabela de usuários */}
        {carregando ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p>
        ) : (
          <div>
            <div className={`${styles.thead} ${styles.t4}`} style={{ gridTemplateColumns: '2fr 1fr 1fr 1.4fr .6fr' }}>
              <div>Email</div>
              <div>Nome</div>
              <div>Role</div>
              <div>Comercial</div>
              <div />
            </div>
            {usuarios.map(u => (
              <div
                key={u.id}
                className={`${styles.trow} ${styles.t4}`}
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1.4fr .6fr' }}
              >
                <div style={{ fontSize: 14 }}>{u.email}</div>
                <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{u.nome ?? '—'}</div>
                <div>
                  <span
                    className={styles.stat}
                    style={{ color: u.role === 'admin' ? 'var(--marca)' : 'var(--ink2)' }}
                  >
                    <span
                      className={styles.dot}
                      style={{ background: u.role === 'admin' ? 'var(--marca)' : 'var(--ink3)' }}
                    />
                    {u.role}
                  </span>
                </div>
                <div style={{ fontSize: 12.5 }}>
                  {u.role === 'admin' ? (
                    <span style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>
                      Diretor — automático
                    </span>
                  ) : (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: salvandoComercial[u.email] ? 'wait' : 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={u.comercial_role === 'gestor'}
                        disabled={salvandoComercial[u.email]}
                        onChange={e => handleAlterarComercialRole(u.email, e.target.checked ? 'gestor' : null)}
                      />
                      <span style={{ color: u.comercial_role === 'gestor' ? 'var(--marca)' : 'var(--ink3)' }}>
                        {u.comercial_role === 'gestor' ? 'Gestor' : 'Sem acesso'}
                      </span>
                    </label>
                  )}
                </div>
                <div className={styles.right}>
                  <button
                    onClick={() => handleRemover(u.email)}
                    className={styles.btn}
                    style={{ fontSize: 11.5, padding: '4px 10px', color: 'var(--critico)', borderColor: 'var(--critico)' }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            {usuarios.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink3)', paddingTop: 16 }}>Nenhum usuário cadastrado.</p>
            )}
            <p style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 16, lineHeight: 1.5 }}>
              * O nível <strong>Vendedor</strong> (acesso restrito à própria carteira) ainda não está disponível nesta versão.
              Por ora, <em>Gestor</em> é o único papel comercial atribuível.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

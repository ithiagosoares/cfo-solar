'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import styles from '@/styles/editorial.module.css'

type Papel = 'administrador' | 'gestor' | 'sdr' | 'vendedor' | 'sem_acesso'

interface UsuarioCadastrado {
  id: string
  email: string
  role: 'admin' | 'viewer'
  comercial_role: 'gestor' | null
  papel: Papel
  vendedor_id: string | null
  nome: string | null
  criado_em: string
  criado_por: string | null
}

interface Vendedor {
  id: string
  nome: string
}

const COR_PAPEL: Record<Papel, string> = {
  administrador: 'var(--marca)',
  gestor: 'var(--positivo)',
  sdr: 'var(--destaque)',
  vendedor: 'var(--pendente)',
  sem_acesso: 'var(--ink3)',
}

export default function AdminUsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<UsuarioCadastrado[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Form: adicionar usuário
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoPapel, setNovoPapel] = useState<Papel>('sem_acesso')
  const [novoVendedorId, setNovoVendedorId] = useState('')
  const [criarComSenha, setCriarComSenha] = useState(false)
  const [senhaTmp, setSenhaTmp] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [senhaExibida, setSenhaExibida] = useState<string | null>(null)

  // Edição de papel por linha
  const [papelSelecionado, setPapelSelecionado] = useState<Record<string, Papel>>({})
  const [vendedorIdSelecionado, setVendedorIdSelecionado] = useState<Record<string, string>>({})
  const [salvandoPapel, setSalvandoPapel] = useState<Record<string, boolean>>({})

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const [resU, resV] = await Promise.all([
        fetch('/api/admin/usuarios'),
        fetch('/api/comercial/vendedores'),
      ])
      if (resU.status === 403) { router.push('/'); return }
      if (!resU.ok) throw new Error('Erro ao carregar usuários')
      const jsonU = await resU.json() as { usuarios: UsuarioCadastrado[] }
      setUsuarios(jsonU.usuarios)

      const papeis: Record<string, Papel> = {}
      const vendIds: Record<string, string> = {}
      for (const u of jsonU.usuarios) {
        papeis[u.email] = u.papel ?? 'sem_acesso'
        if (u.vendedor_id) vendIds[u.email] = u.vendedor_id
      }
      setPapelSelecionado(papeis)
      setVendedorIdSelecionado(vendIds)

      if (resV.ok) {
        const jsonV = await resV.json() as { vendedores: Vendedor[] }
        setVendedores(jsonV.vendedores ?? [])
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdicionar(e: { preventDefault(): void }) {
    e.preventDefault()
    setErroForm(null)
    setSalvando(true)
    setSenhaExibida(null)
    try {
      const body: Record<string, unknown> = {
        email: novoEmail,
        papel: novoPapel,
        nome: novoNome || undefined,
        vendedor_id: novoPapel === 'vendedor' ? novoVendedorId : undefined,
      }
      if (criarComSenha && senhaTmp) body.senha_temporaria = senhaTmp

      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { error?: string; conta_auth_criada?: boolean }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao adicionar')

      if (json.conta_auth_criada) setSenhaExibida(senhaTmp)

      setNovoEmail('')
      setNovoNome('')
      setNovoPapel('sem_acesso')
      setNovoVendedorId('')
      setSenhaTmp('')
      setCriarComSenha(false)
      await carregar()
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Erro ao adicionar')
    } finally {
      setSalvando(false)
    }
  }

  async function handleAlterarPapel(email: string, papel: Papel, vendedorId?: string) {
    setSalvandoPapel(prev => ({ ...prev, [email]: true }))
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, papel, vendedor_id: vendedorId ?? null }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar papel')
    } finally {
      setSalvandoPapel(prev => ({ ...prev, [email]: false }))
    }
  }

  function handlePapelChange(email: string, novoPapelRow: Papel) {
    setPapelSelecionado(prev => ({ ...prev, [email]: novoPapelRow }))
    if (novoPapelRow !== 'vendedor') {
      handleAlterarPapel(email, novoPapelRow)
    }
    // se 'vendedor', aguarda seleção do vendedor_id antes de salvar
  }

  function handleVendedorIdChange(email: string, vendedorId: string) {
    setVendedorIdSelecionado(prev => ({ ...prev, [email]: vendedorId }))
    if (vendedorId) {
      handleAlterarPapel(email, 'vendedor', vendedorId)
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
    <AppLayout>
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
              <label className={styles.fieldLabel}>Papel</label>
              <select
                value={novoPapel}
                onChange={e => { setNovoPapel(e.target.value as Papel); setNovoVendedorId('') }}
                className={styles.select}
              >
                <option value="administrador">Administrador — acesso total + gestão de usuários</option>
                <option value="gestor">Gestor — acesso comercial completo</option>
                <option value="sdr">SDR — acesso comercial</option>
                <option value="vendedor">Vendedor — acesso à própria carteira</option>
                <option value="sem_acesso">Sem acesso — cadastrado mas sem permissão</option>
              </select>
            </div>
            {novoPapel === 'vendedor' && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Vendedor vinculado</label>
                <select
                  required
                  value={novoVendedorId}
                  onChange={e => setNovoVendedorId(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Selecione um vendedor…</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
                {vendedores.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--critico)', marginTop: 4, display: 'block' }}>
                    Nenhum vendedor ativo cadastrado. Cadastre um primeiro em Administração → Vendedores.
                  </span>
                )}
              </div>
            )}
            <div className={styles.field}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={criarComSenha}
                  onChange={e => { setCriarComSenha(e.target.checked); setSenhaTmp('') }}
                />
                <span style={{ fontSize: 13, color: 'var(--ink2)' }}>
                  Criar conta com senha (para quem não usa Google)
                </span>
              </label>
            </div>
            {criarComSenha && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Senha temporária</label>
                <input
                  type="text"
                  required={criarComSenha}
                  value={senhaTmp}
                  onChange={e => setSenhaTmp(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  minLength={6}
                  className={styles.input}
                />
                <span style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                  O usuário poderá alterar a senha depois pelo fluxo de recuperação.
                </span>
              </div>
            )}
            {erroForm && (
              <p style={{ fontSize: 12.5, color: 'var(--critico)' }}>{erroForm}</p>
            )}
            <button type="submit" disabled={salvando} className={styles.btnPrimary} style={{ alignSelf: 'flex-start' }}>
              {salvando ? 'Salvando…' : 'Adicionar'}
            </button>
          </form>
        </div>

        {/* Banner: senha temporária gerada — exibida uma única vez */}
        {senhaExibida && (
          <div
            style={{
              border: '1px solid var(--positivo)',
              borderLeft: '3px solid var(--positivo)',
              padding: '16px 20px',
              marginBottom: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--positivo)' }}>
              Conta criada com sucesso
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink2)' }}>
              Repasse a senha abaixo ao usuário —{' '}
              <strong style={{ color: 'var(--foreground)' }}>não será exibida novamente</strong>:
            </p>
            <code
              style={{
                display: 'block',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '.06em',
                padding: '10px 14px',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                userSelect: 'all',
                color: 'var(--foreground)',
              }}
            >
              {senhaExibida}
            </code>
            <button
              onClick={() => setSenhaExibida(null)}
              className={styles.btn}
              style={{ alignSelf: 'flex-start', fontSize: 12, marginTop: 4 }}
            >
              Fechar
            </button>
          </div>
        )}

        {/* Tabela de usuários */}
        {carregando ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando…</p>
        ) : (
          <div>
            <div
              className={`${styles.thead} ${styles.t4}`}
              style={{ gridTemplateColumns: '1.8fr 1fr 1.6fr auto' }}
            >
              <div>Email</div>
              <div>Nome</div>
              <div>Papel</div>
              <div />
            </div>
            {usuarios.map(u => {
              const papelAtual = papelSelecionado[u.email] ?? u.papel ?? 'sem_acesso'
              const vendedorAtual = vendedorIdSelecionado[u.email] ?? u.vendedor_id ?? ''
              const ocupado = !!salvandoPapel[u.email]

              return (
                <div
                  key={u.id}
                  className={`${styles.trow} ${styles.t4}`}
                  style={{ gridTemplateColumns: '1.8fr 1fr 1.6fr auto', alignItems: 'start' }}
                >
                  <div style={{ fontSize: 13.5 }}>{u.email}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{u.nome ?? '—'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: COR_PAPEL[papelAtual],
                          opacity: ocupado ? 0.4 : 1,
                        }}
                      />
                      <select
                        value={papelAtual}
                        disabled={ocupado}
                        onChange={e => handlePapelChange(u.email, e.target.value as Papel)}
                        className={styles.select}
                        style={{ fontSize: 12.5, padding: '3px 8px' }}
                      >
                        <option value="administrador">Administrador</option>
                        <option value="gestor">Gestor</option>
                        <option value="sdr">SDR</option>
                        <option value="vendedor">Vendedor</option>
                        <option value="sem_acesso">Sem acesso</option>
                      </select>
                      {ocupado && (
                        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>salvando…</span>
                      )}
                    </div>
                    {papelAtual === 'vendedor' && (
                      <select
                        value={vendedorAtual}
                        disabled={ocupado}
                        onChange={e => handleVendedorIdChange(u.email, e.target.value)}
                        className={styles.select}
                        style={{ fontSize: 12, padding: '3px 8px', marginLeft: 15 }}
                      >
                        <option value="">Selecione o vendedor…</option>
                        {vendedores.map(v => (
                          <option key={v.id} value={v.id}>{v.nome}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <button
                      onClick={() => handleRemover(u.email)}
                      className={styles.btn}
                      style={{ fontSize: 11.5, padding: '4px 10px', color: 'var(--critico)', borderColor: 'var(--critico)' }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              )
            })}
            {usuarios.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink3)', paddingTop: 16 }}>Nenhum usuário cadastrado.</p>
            )}
            <p style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 16, lineHeight: 1.5 }}>
              * SDR e Vendedor têm acesso ao módulo comercial.
              A restrição de carteira para Vendedor (acesso apenas à própria carteira) será implementada em fase futura.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

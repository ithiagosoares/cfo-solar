'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from '@/styles/editorial.module.css'

interface Vendedor {
  id: string
  nome: string
  ativo: boolean
  criadoEm: string
}

export default function AdminVendedoresPage() {
  const router = useRouter()
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch('/api/comercial/vendedores?todos=1')
      if (res.status === 403) { router.push('/'); return }
      const json = await res.json() as { ok: boolean; vendedores?: Vendedor[]; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Erro ao carregar')
      setVendedores(json.vendedores ?? [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function adicionarVendedor() {
    if (!novoNome.trim()) return
    setSalvando(true)
    setErroForm(null)
    try {
      const res = await fetch('/api/comercial/vendedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome.trim() }),
      })
      const json = await res.json() as { ok: boolean; vendedor?: Vendedor; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Erro ao criar')
      setNovoNome('')
      await carregar()
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(v: Vendedor) {
    try {
      await fetch(`/api/comercial/vendedores/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !v.ativo }),
      })
      await carregar()
    } catch {
      // falha silenciosa — a lista será recarregada na próxima ação
    }
  }

  async function salvarNome(id: string) {
    if (!editNome.trim()) return
    try {
      await fetch(`/api/comercial/vendedores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editNome.trim() }),
      })
      setEditandoId(null)
      await carregar()
    } catch {
      // falha silenciosa
    }
  }

  const ativos = vendedores.filter(v => v.ativo)
  const inativos = vendedores.filter(v => !v.ativo)

  return (
    <div className={styles.page}>
      <div className={styles.wrap} style={{ maxWidth: 680, paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}>
            ← Voltar
          </a>
        </div>

        <div className={`${styles.stitle} ${styles.serif}`} style={{ marginBottom: 6 }}>
          Gestão de Vendedores
        </div>
        <div className={styles.scap} style={{ marginBottom: 32 }}>
          Cadastre, renomeie ou desative vendedores. Somente vendedores ativos aparecem no formulário de cadastro manual.
        </div>

        {/* ── Adicionar novo ──────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 40, alignItems: 'flex-end' }}>
          <div className={styles.field} style={{ flex: 1, marginBottom: 0 }}>
            <label className={styles.fieldLabel}>Novo vendedor</label>
            <input
              type="text"
              placeholder="Nome completo"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') adicionarVendedor() }}
              className={styles.input}
              disabled={salvando}
            />
          </div>
          <button
            className={styles.btnPrimary}
            onClick={adicionarVendedor}
            disabled={salvando || !novoNome.trim()}
            style={{ flexShrink: 0 }}
          >
            {salvando ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>

        {erroForm && (
          <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginBottom: 20 }}>
            {erroForm}
          </div>
        )}

        {/* ── Lista ───────────────────────────────────────────── */}
        {carregando && (
          <div style={{ color: 'var(--ink3)', fontSize: 13 }}>Carregando…</div>
        )}
        {erro && (
          <div className={`${styles.notice} ${styles.alertaDanger}`}>{erro}</div>
        )}

        {!carregando && !erro && (
          <>
            {/* Ativos */}
            <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--ink3)', textTransform: 'uppercase' }}>
              Ativos ({ativos.length})
            </div>

            {ativos.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 32 }}>Nenhum vendedor ativo.</div>
            )}

            {ativos.map(v => (
              <VendedorRow
                key={v.id}
                vendedor={v}
                editandoId={editandoId}
                editNome={editNome}
                onIniciarEdicao={() => { setEditandoId(v.id); setEditNome(v.nome) }}
                onCancelarEdicao={() => setEditandoId(null)}
                onSalvarNome={() => salvarNome(v.id)}
                onEditNomeChange={setEditNome}
                onToggleAtivo={() => toggleAtivo(v)}
              />
            ))}

            {/* Inativos */}
            {inativos.length > 0 && (
              <>
                <div style={{ marginTop: 32, marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--ink3)', textTransform: 'uppercase' }}>
                  Inativos ({inativos.length})
                </div>
                {inativos.map(v => (
                  <VendedorRow
                    key={v.id}
                    vendedor={v}
                    editandoId={editandoId}
                    editNome={editNome}
                    onIniciarEdicao={() => { setEditandoId(v.id); setEditNome(v.nome) }}
                    onCancelarEdicao={() => setEditandoId(null)}
                    onSalvarNome={() => salvarNome(v.id)}
                    onEditNomeChange={setEditNome}
                    onToggleAtivo={() => toggleAtivo(v)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────

interface VendedorRowProps {
  vendedor: Vendedor
  editandoId: string | null
  editNome: string
  onIniciarEdicao: () => void
  onCancelarEdicao: () => void
  onSalvarNome: () => void
  onEditNomeChange: (v: string) => void
  onToggleAtivo: () => void
}

function VendedorRow({
  vendedor,
  editandoId,
  editNome,
  onIniciarEdicao,
  onCancelarEdicao,
  onSalvarNome,
  onEditNomeChange,
  onToggleAtivo,
}: VendedorRowProps) {
  const editando = editandoId === vendedor.id

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--line)',
        opacity: vendedor.ativo ? 1 : 0.5,
      }}
    >
      {editando ? (
        <>
          <input
            type="text"
            value={editNome}
            onChange={e => onEditNomeChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSalvarNome()
              if (e.key === 'Escape') onCancelarEdicao()
            }}
            autoFocus
            style={{
              flex: 1,
              fontSize: 13,
              padding: '5px 8px',
              border: '1px solid var(--line2)',
              background: 'var(--paper)',
              color: 'var(--foreground)',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={onSalvarNome}
            style={{ fontSize: 12, color: 'var(--marca)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Salvar
          </button>
          <button
            onClick={onCancelarEdicao}
            style={{ fontSize: 12, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancelar
          </button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--foreground)' }}>{vendedor.nome}</span>
          <button
            onClick={onIniciarEdicao}
            style={{ fontSize: 12, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Renomear
          </button>
          <button
            onClick={onToggleAtivo}
            style={{
              fontSize: 12,
              color: vendedor.ativo ? 'var(--ink3)' : 'var(--marca)',
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {vendedor.ativo ? 'Desativar' : 'Reativar'}
          </button>
        </>
      )}
    </div>
  )
}

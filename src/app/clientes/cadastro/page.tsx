'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import styles from '@/styles/editorial.module.css'

// ─── CNPJ helpers (client-side — não importar de clientes-repository, que usa supabaseAdmin) ─

function normalizarCNPJ(raw: string): string {
  return raw.replace(/\D/g, '')
}

function mascaraCNPJ(raw: string): string {
  const d = normalizarCNPJ(raw).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function validarCNPJ(raw: string): boolean {
  const d = normalizarCNPJ(raw)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const soma = (pesos: number[]) => pesos.reduce((acc, w, i) => acc + Number(d[i]) * w, 0)
  const digito = (s: number) => { const r = s % 11; return r < 2 ? 0 : 11 - r }
  const d1 = digito(soma([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  const d2 = digito(soma([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  return Number(d[12]) === d1 && Number(d[13]) === d2
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ClienteResumo {
  cnpj: string
  razaoSocial: string
  status: 'em_fila' | 'atribuido' | 'liberado'
  vendedorId: string | null
}

const STATUS_LABEL: Record<string, string> = {
  em_fila:   'Em fila',
  atribuido: 'Atribuído',
  liberado:  'Liberado',
}

const STATUS_COR: Record<string, string> = {
  em_fila:   'var(--ink3)',
  atribuido: 'var(--positivo)',
  liberado:  'var(--destaque)',
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function CadastroClientePage() {
  // Papel do usuário — determina comportamento da tela
  const [papel, setPapel] = useState<string | null>(null)
  const eVendedor = papel === 'vendedor'

  // Formulário
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [tipo, setTipo] = useState<'distribuidora' | 'integrador'>('integrador')
  const [origem, setOrigem] = useState<'prospeccao' | 'lead'>('prospeccao')
  const [vendedorId, setVendedorId] = useState<string | null>(null)
  const [vendedorLabel, setVendedorLabel] = useState('')

  // UI
  const [erroCnpj, setErroCnpj] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  // Vendedores para o combobox (só carregados quando papel ≠ vendedor)
  const [vendedoresOpt, setVendedoresOpt] = useState<OpcaoCombobox[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})
  const [carregandoVend, setCarregandoVend] = useState(true)

  // Lista de clientes — versão incrementada dispara reload
  const [listaVersion, setListaVersion] = useState(0)
  const [lista, setLista] = useState<ClienteResumo[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)

  // Efeito 1: descobrir o papel do usuário logado
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string }>)
      .then(d => setPapel(d.papel ?? 'sem_acesso'))
      .catch(() => setPapel('sem_acesso'))
  }, [])

  // Efeito 2: carregar lista de vendedores (combobox — apenas para não-vendedores)
  useEffect(() => {
    if (papel === null) return
    if (papel === 'vendedor') { setCarregandoVend(false); return }

    fetch('/api/comercial/vendedores')
      .then(r => r.json() as Promise<{ ok: boolean; vendedores?: { id: string; nome: string }[] }>)
      .then(json => {
        if (json.ok && json.vendedores) {
          setVendedoresOpt(json.vendedores.map(v => ({ id: v.id, label: v.nome })))
          const mapa: Record<string, string> = {}
          json.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoVend(false))
  }, [papel])

  // Efeito 3: carregar lista de clientes — repete quando papel muda ou após submit
  useEffect(() => {
    if (papel === null) return
    setCarregandoLista(true)

    // vendedor e sdr: servidor auto-filtra por papel (carteira ou criado_por)
    // admin/gestor: precisam de ?meus=1 para ver apenas o que cadastraram
    const url = (papel === 'vendedor' || papel === 'sdr')
      ? '/api/clientes'
      : '/api/clientes?meus=1'

    fetch(url)
      .then(r => r.json() as Promise<{ ok: boolean; clientes?: ClienteResumo[] }>)
      .then(json => { if (json.ok && json.clientes) setLista(json.clientes.slice(0, 20)) })
      .catch(() => {})
      .finally(() => setCarregandoLista(false))
  }, [papel, listaVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCnpj(mascaraCNPJ(e.target.value))
    setErroCnpj(null)
    setFeedback(null)
  }

  function handleCnpjBlur() {
    const digits = normalizarCNPJ(cnpj)
    if (digits.length === 0) return
    if (digits.length < 14) { setErroCnpj('CNPJ incompleto — deve ter 14 dígitos.'); return }
    if (!validarCNPJ(digits)) setErroCnpj('CNPJ inválido — verifique os dígitos verificadores.')
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setFeedback(null)

    const digits = normalizarCNPJ(cnpj)
    if (!validarCNPJ(digits)) { setErroCnpj('CNPJ inválido.'); return }
    if (!razaoSocial.trim()) return

    setSalvando(true)
    try {
      const body: Record<string, unknown> = {
        cnpj: digits,
        razaoSocial: razaoSocial.trim(),
        tipo,
        origem,
      }
      // vendedor: não envia vendedorId — servidor usa x-vendedor-id do header
      if (!eVendedor) body.vendedorId = vendedorId ?? null

      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; error?: string }

      if (res.status === 409) { setFeedback({ tipo: 'erro', msg: 'Este CNPJ já está cadastrado.' }); return }
      if (!res.ok) { setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao cadastrar cliente.' }); return }

      setFeedback({ tipo: 'ok', msg: `Cliente ${razaoSocial.trim()} cadastrado com sucesso.` })
      setCnpj('')
      setRazaoSocial('')
      setTipo('integrador')
      setOrigem('prospeccao')
      setVendedorId(null)
      setVendedorLabel('')
      setErroCnpj(null)
      setListaVersion(v => v + 1) // dispara reload da lista
    } finally {
      setSalvando(false)
    }
  }

  // Aguarda papel ser carregado antes de renderizar o formulário
  if (papel === null) {
    return (
      <div className={styles.page} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
        />
      </div>
    )
  }

  const listaTitulo = eVendedor ? 'Minha carteira' : 'Meus cadastros recentes'
  const listaVazia = eVendedor
    ? 'Nenhum cliente na sua carteira ainda.'
    : 'Nenhum cliente cadastrado por você ainda.'

  // Colunas: vendedor não precisa da coluna Responsável (seria sempre ele mesmo)
  const colGrid = eVendedor ? '160px 1fr 100px' : '160px 1fr 100px 140px'

  return (
    <div className={styles.page} style={{ minHeight: '100vh' }}>
      {/* Topo */}
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
        <div className={`${styles.stitle} ${styles.serif}`}>Cadastro de Cliente</div>
        <div className={styles.scap}>
          {eVendedor
            ? 'Cadastre um cliente CNPJ — ele será atribuído automaticamente à sua carteira.'
            : 'Preencha o CNPJ e os dados do cliente para adicionar à carteira comercial.'}
        </div>

        {/* ── Formulário ──────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20, marginTop: 32 }}>

          {/* CNPJ */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>CNPJ</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={handleCnpjChange}
              onBlur={handleCnpjBlur}
              className={styles.input}
              style={erroCnpj ? { borderColor: 'var(--critico)' } : undefined}
              required
            />
            {erroCnpj && (
              <p style={{ fontSize: 12, color: 'var(--critico)', marginTop: 4 }}>{erroCnpj}</p>
            )}
          </div>

          {/* Razão Social */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Razão Social</label>
            <input
              type="text"
              placeholder="Nome da empresa"
              value={razaoSocial}
              onChange={e => { setRazaoSocial(e.target.value); setFeedback(null) }}
              className={styles.input}
              required
            />
          </div>

          {/* Tipo */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Tipo</label>
            <select
              className={styles.select}
              value={tipo}
              onChange={e => setTipo(e.target.value as 'distribuidora' | 'integrador')}
            >
              <option value="integrador">Integrador</option>
              <option value="distribuidora">Distribuidora</option>
            </select>
          </div>

          {/* Origem */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Origem</label>
            <select
              className={styles.select}
              value={origem}
              onChange={e => setOrigem(e.target.value as 'prospeccao' | 'lead')}
            >
              <option value="prospeccao">Prospecção</option>
              <option value="lead">Lead</option>
            </select>
          </div>

          {/* Responsável — apenas para sdr / administrador / gestor */}
          {!eVendedor && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Responsável
                <span style={{ fontWeight: 400, color: 'var(--ink3)', marginLeft: 6 }}>(opcional)</span>
              </label>
              <ComboboxBusca
                opcoes={vendedoresOpt}
                valorId={vendedorId}
                valorLabel={vendedorLabel}
                onChange={opcao => {
                  setVendedorId(opcao?.id ?? null)
                  setVendedorLabel(opcao?.label ?? '')
                }}
                placeholder="Selecionar vendedor…"
                carregando={carregandoVend}
              />
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div
              className={feedback.tipo === 'erro' ? `${styles.notice} ${styles.alertaDanger}` : styles.notice}
              style={{
                margin: 0,
                ...(feedback.tipo === 'ok'
                  ? { borderLeftColor: 'var(--positivo)', color: 'var(--positivo)' }
                  : {}),
              }}
            >
              <span>{feedback.msg}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={salvando || !!erroCnpj}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {salvando ? 'Salvando…' : 'Cadastrar Cliente'}
          </button>
        </form>

        {/* ── Lista de clientes ────────────────────────────────────────── */}
        <div style={{ marginTop: 56 }}>
          <div className={styles.shead} style={{ marginBottom: 12 }}>
            <div className={`${styles.stitle} ${styles.serif}`} style={{ fontSize: 18 }}>
              {listaTitulo}
            </div>
            {!carregandoLista && (
              <div className={styles.over}>{lista.length} registros</div>
            )}
          </div>

          {carregandoLista ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>Carregando…</p>
          ) : lista.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>{listaVazia}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {/* Cabeçalho */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: colGrid,
                  gap: '0 16px',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line2)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink3)',
                }}
              >
                <div>CNPJ</div>
                <div>Razão Social</div>
                <div>Status</div>
                {!eVendedor && <div>Responsável</div>}
              </div>

              {lista.map(c => (
                <div
                  key={c.cnpj}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colGrid,
                    gap: '0 16px',
                    padding: '11px 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 13,
                    alignItems: 'center',
                  }}
                >
                  <div className={styles.num} style={{ fontSize: 12, color: 'var(--ink2)' }}>
                    {mascaraCNPJ(c.cnpj)}
                  </div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.razaoSocial}
                  </div>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: STATUS_COR[c.status] }}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  {!eVendedor && (
                    <div style={{ color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.vendedorId ? (mapaVendedores[c.vendedorId] ?? '—') : '—'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

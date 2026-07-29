'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import styles from '@/styles/editorial.module.css'

// ─── CNPJ helpers (client-side) ──────────────────────────────────────────────

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

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

const ORIGEM_LEAD_OPT = [
  { value: 'indicacao',         label: 'Indicação' },
  { value: 'site_formulario',   label: 'Site / Formulário' },
  { value: 'instagram',         label: 'Instagram' },
  { value: 'facebook',          label: 'Facebook' },
  { value: 'google_ads',        label: 'Google Ads' },
  { value: 'whatsapp',          label: 'WhatsApp' },
  { value: 'feira_evento',      label: 'Feira / Evento' },
  { value: 'ligacao_receptiva', label: 'Ligação Receptiva' },
  { value: 'parceiro_revenda',  label: 'Parceiro / Revenda' },
  { value: 'outro',             label: 'Outro' },
]

const STATUS_CRM_LABEL: Record<string, string> = {
  novo_lead:     'Novo Lead',
  em_contato:    'Em Contato',
  negociando:    'Negociando',
  cliente_ativo: 'Cliente Ativo',
  inativo:       'Inativo',
  perdido:       'Perdido',
}

const STATUS_CRM_COR: Record<string, { bg: string; fg: string }> = {
  novo_lead:     { bg: '#dbeafe', fg: '#1e40af' },
  em_contato:    { bg: '#bfdbfe', fg: '#1d4ed8' },
  negociando:    { bg: '#fef3c7', fg: '#b45309' },
  cliente_ativo: { bg: '#dcfce7', fg: '#15803d' },
  inativo:       { bg: '#f3f4f6', fg: '#6b7280' },
  perdido:       { bg: '#fee2e2', fg: '#dc2626' },
}

const ORIGEM_LABEL: Record<string, string> = {
  prospeccao: 'Prospecção',
  lead:       'Lead',
}

const CRM_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M.5.5l3.5 3.5 3.5-3.5' stroke='%23555' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`

const POR_PAGINA = 20

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ClienteResumo {
  cnpj: string
  razaoSocial: string
  status: string
  vendedorId: string | null
  criadoPor: string
  criadoEm: string
  dataUltimaCompra: string | null
  statusCrm: string
  origem: string
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function CadastroClientePage() {
  const router = useRouter()

  // Dados do usuário logado
  const [papel, setPapel] = useState<string | null>(null)
  const [meEmail, setMeEmail] = useState<string | null>(null)
  const [meVendedorId, setMeVendedorId] = useState<string | null>(null)
  const eVendedor = papel === 'vendedor'

  // Formulário
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [tipo, setTipo] = useState<'distribuidora' | 'integrador'>('integrador')
  const [origem, setOrigem] = useState<'prospeccao' | 'lead'>('prospeccao')
  const [origemLeadDetalhe, setOrigemLeadDetalhe] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [telefone, setTelefone] = useState('')
  const [vendedorId, setVendedorId] = useState<string | null>(null)
  const [vendedorLabel, setVendedorLabel] = useState('')

  // UI do formulário
  const [erroCnpj, setErroCnpj] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  // Vendedores para o combobox
  const [vendedoresOpt, setVendedoresOpt] = useState<OpcaoCombobox[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})
  const [carregandoVend, setCarregandoVend] = useState(true)

  // Lista paginada
  const [listaVersion, setListaVersion] = useState(0)
  const [lista, setLista] = useState<ClienteResumo[]>([])
  const [total, setTotal] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)

  // CRM inline editing
  const [crmLocal, setCrmLocal] = useState<Record<string, string>>({})
  const [crmSaving, setCrmSaving] = useState<Set<string>>(new Set())
  const [crmSaved, setCrmSaved] = useState<Set<string>>(new Set())

  // Efeito 1: buscar dados do usuário logado
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string; email?: string; vendedorId?: string | null }>)
      .then(d => {
        setPapel(d.papel ?? 'sem_acesso')
        setMeEmail(d.email ?? null)
        setMeVendedorId(d.vendedorId ?? null)
      })
      .catch(() => setPapel('sem_acesso'))
  }, [])

  // Efeito 2: carregar lista de vendedores (apenas para não-vendedores)
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

  // Efeito 3: carga inicial e reload após submit
  useEffect(() => {
    if (papel !== null) buscarClientes(1, true)
  }, [papel, listaVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  async function buscarClientes(pagina: number, reset: boolean) {
    if (reset) setCarregandoLista(true)
    else setCarregandoMais(true)
    try {
      const base = (papel === 'vendedor' || papel === 'sdr')
        ? '/api/clientes'
        : '/api/clientes?meus=1'
      const sep = base.includes('?') ? '&' : '?'
      const url = `${base}${sep}pagina=${pagina}&porPagina=${POR_PAGINA}`

      const res = await fetch(url)
      const json = await res.json() as { ok: boolean; clientes?: ClienteResumo[]; total?: number }
      if (!json.ok) return

      const novos = json.clientes ?? []
      setLista(prev => reset ? novos : [...prev, ...novos])
      setTotal(json.total ?? 0)
      setPaginaAtual(pagina)

      setCrmLocal(prev => {
        const next = { ...prev }
        novos.forEach(c => { if (!(c.cnpj in next)) next[c.cnpj] = c.statusCrm })
        return next
      })
    } finally {
      if (reset) setCarregandoLista(false)
      else setCarregandoMais(false)
    }
  }

  async function handleStatusCrmChange(cnpj: string, novoStatus: string) {
    const statusAnterior = crmLocal[cnpj] ?? 'novo_lead'
    setCrmLocal(prev => ({ ...prev, [cnpj]: novoStatus }))
    setCrmSaving(prev => { const s = new Set(prev); s.add(cnpj); return s })

    try {
      const res = await fetch(`/api/clientes/${cnpj}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusCrm: novoStatus }),
      })
      if (!res.ok) {
        setCrmLocal(prev => ({ ...prev, [cnpj]: statusAnterior }))
      } else {
        setCrmSaved(prev => { const s = new Set(prev); s.add(cnpj); return s })
        setTimeout(() => {
          setCrmSaved(prev => { const s = new Set(prev); s.delete(cnpj); return s })
        }, 1500)
      }
    } catch {
      setCrmLocal(prev => ({ ...prev, [cnpj]: statusAnterior }))
    } finally {
      setCrmSaving(prev => { const s = new Set(prev); s.delete(cnpj); return s })
    }
  }

  function podeEditar(c: ClienteResumo): boolean {
    if (!papel) return false
    if (papel === 'administrador' || papel === 'gestor') return true
    if (papel === 'vendedor') return c.vendedorId === meVendedorId
    if (papel === 'sdr') return c.criadoPor === meEmail
    return false
  }

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
    if (!telefone.trim() || !cidade.trim() || !estado) {
      setFeedback({ tipo: 'erro', msg: 'Telefone, cidade e estado são obrigatórios.' })
      return
    }
    if (origem === 'lead' && !origemLeadDetalhe) {
      setFeedback({ tipo: 'erro', msg: 'Selecione o canal de origem do lead.' })
      return
    }

    setSalvando(true)
    try {
      const body: Record<string, unknown> = {
        cnpj:              digits,
        razaoSocial:       razaoSocial.trim(),
        tipo,
        origem,
        origemLeadDetalhe: origem === 'lead' ? origemLeadDetalhe : undefined,
        cidade:            cidade.trim(),
        estado,
        telefone:          telefone.trim(),
      }
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
      setOrigemLeadDetalhe('')
      setCidade('')
      setEstado('')
      setTelefone('')
      setVendedorId(null)
      setVendedorLabel('')
      setErroCnpj(null)
      setListaVersion(v => v + 1)
    } finally {
      setSalvando(false)
    }
  }

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
  const temMais = lista.length < total
  const colGrid = '140px 1fr 88px 100px 164px 90px 32px'

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
              onChange={e => { setOrigem(e.target.value as 'prospeccao' | 'lead'); setOrigemLeadDetalhe('') }}
            >
              <option value="prospeccao">Prospecção</option>
              <option value="lead">Lead</option>
            </select>
          </div>

          {/* Canal de origem — apenas quando Origem = Lead */}
          {origem === 'lead' && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Canal de origem</label>
              <select
                className={styles.select}
                value={origemLeadDetalhe}
                onChange={e => setOrigemLeadDetalhe(e.target.value)}
                required
              >
                <option value="">Selecionar canal…</option>
                {ORIGEM_LEAD_OPT.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Telefone */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Telefone</label>
            <input
              type="tel"
              placeholder="(11) 98765-4321"
              value={telefone}
              onChange={e => { setTelefone(e.target.value); setFeedback(null) }}
              className={styles.input}
              required
            />
          </div>

          {/* Cidade + Estado lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: '0 16px' }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Cidade</label>
              <input
                type="text"
                placeholder="São Paulo"
                value={cidade}
                onChange={e => { setCidade(e.target.value); setFeedback(null) }}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>UF</label>
              <select
                className={styles.select}
                value={estado}
                onChange={e => setEstado(e.target.value)}
                required
              >
                <option value="">—</option>
                {ESTADOS_BR.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
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
              <div className={styles.over}>{total} registros</div>
            )}
          </div>

          {carregandoLista ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>Carregando…</p>
          ) : lista.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>{listaVazia}</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                {/* Cabeçalho */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: colGrid,
                    gap: '0 12px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line2)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink3)',
                    minWidth: 720,
                  }}
                >
                  <div>CNPJ</div>
                  <div>Razão Social</div>
                  <div>Cadastrado</div>
                  <div>Última Compra</div>
                  <div>Status CRM</div>
                  <div>Origem</div>
                  <div />
                </div>

                {lista.map(c => {
                  const statusAtual = crmLocal[c.cnpj] ?? c.statusCrm
                  const cor = STATUS_CRM_COR[statusAtual] ?? STATUS_CRM_COR.inativo
                  const editavel = podeEditar(c)

                  return (
                    <div
                      key={c.cnpj}
                      onClick={() => { if (editavel) router.push(`/clientes/${c.cnpj}/editar`) }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: colGrid,
                        gap: '0 12px',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--line)',
                        fontSize: 13,
                        alignItems: 'center',
                        cursor: editavel ? 'pointer' : 'default',
                        minWidth: 720,
                      }}
                      onMouseEnter={e => { if (editavel) (e.currentTarget as HTMLElement).style.background = 'var(--paper)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {/* CNPJ */}
                      <div className={styles.num} style={{ fontSize: 12, color: 'var(--ink2)' }}>
                        {mascaraCNPJ(c.cnpj)}
                      </div>

                      {/* Razão Social */}
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {c.razaoSocial}
                      </div>

                      {/* Cadastrado em */}
                      <div className={styles.num} style={{ fontSize: 12, color: 'var(--ink3)' }}>
                        {fmtData(c.criadoEm)}
                      </div>

                      {/* Última Compra */}
                      <div className={styles.num} style={{ fontSize: 12, color: c.dataUltimaCompra ? 'var(--ink2)' : 'var(--ink3)' }}>
                        {fmtData(c.dataUltimaCompra)}
                      </div>

                      {/* Status CRM — select inline auto-save */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={e => e.stopPropagation()}
                      >
                        <select
                          value={statusAtual}
                          onChange={e => handleStatusCrmChange(c.cnpj, e.target.value)}
                          disabled={crmSaving.has(c.cnpj)}
                          style={{
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            border: 'none',
                            borderRadius: 999,
                            padding: '3px 22px 3px 9px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '.03em',
                            cursor: 'pointer',
                            backgroundImage: CRM_ARROW,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 6px center',
                            backgroundSize: '8px',
                            backgroundColor: cor.bg,
                            color: cor.fg,
                            fontFamily: 'inherit',
                            outline: 'none',
                            opacity: crmSaving.has(c.cnpj) ? 0.6 : 1,
                            transition: 'opacity .15s',
                          }}
                        >
                          {Object.entries(STATUS_CRM_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        {crmSaved.has(c.cnpj) && (
                          <span style={{ color: '#15803d', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>
                        )}
                      </div>

                      {/* Origem */}
                      <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
                        {ORIGEM_LABEL[c.origem] ?? c.origem}
                      </div>

                      {/* Editar */}
                      <div>
                        {editavel && (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: '.05em',
                              textTransform: 'uppercase',
                              color: 'var(--marca)',
                            }}
                          >
                            ›
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Carregar mais */}
              {temMais && (
                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button
                    onClick={() => buscarClientes(paginaAtual + 1, false)}
                    disabled={carregandoMais}
                    className={styles.btn}
                    style={{ fontSize: 13 }}
                  >
                    {carregandoMais ? 'Carregando…' : `Carregar mais (${total - lista.length} restantes)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

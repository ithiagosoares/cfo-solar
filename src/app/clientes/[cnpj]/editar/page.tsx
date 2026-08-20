'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { useListasCrm } from '@/hooks/useListasCrm'
import styles from '@/styles/editorial.module.css'

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

const CANAL_OPT = [
  { value: '',          label: 'Não definido' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'telefone',  label: 'Telefone' },
  { value: 'email',     label: 'E-mail' },
]

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ClienteCompleto {
  cnpj: string
  razaoSocial: string
  tipo: string
  origem: string
  origemLeadDetalhe: string | null
  cidade: string
  estado: string
  telefone: string
  nomeContato: string | null
  email: string | null
  listaId: string
  ultimoContato: string | null
  proximaAcao: string | null
  proximaAcaoData: string | null
  observacoes: string | null
  canalPreferido: string | null
  produtoInteresse: string | null
  // Automáticos (somente leitura)
  vendedorId: string | null
  dataAtribuicao: string | null
  dataVencimento: string | null
  dataUltimaCompra: string | null
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  arquivado?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mascaraCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('T')[0].split('-')
  return `${dd}/${m}/${y}`
}

function fmtDataHora(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-componente de seção ──────────────────────────────────────────────────

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink3)', paddingBottom: 10, borderBottom: '1px solid var(--line2)', marginBottom: 24 }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function CampoLeitura({ label, valor }: { label: string; valor: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--ink2)', paddingTop: 4 }}>{valor}</span>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function EditarClientePage() {
  const router = useRouter()
  const params = useParams()
  const cnpj = params.cnpj as string

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [arquivando, setArquivando] = useState(false)
  const [arquivado, setArquivado] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  // Mapa de vendedores para exibir o nome do responsável
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})

  // Dados cadastrais
  const [razaoSocial, setRazaoSocial] = useState('')
  const [tipo, setTipo] = useState('integrador')
  const [origemState, setOrigemState] = useState('prospeccao')
  const [origemLeadDetalhe, setOrigemLeadDetalhe] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nomeContato, setNomeContato] = useState('')
  const [emailContato, setEmailContato] = useState('')

  // Dados CRM
  const { listas } = useListasCrm()
  const [listaId, setListaId] = useState('')
  const [ultimoContato, setUltimoContato] = useState('')
  const [proximaAcao, setProximaAcao] = useState('')
  const [proximaAcaoData, setProximaAcaoData] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [canalPreferido, setCanalPreferido] = useState('')
  const [produtoInteresse, setProdutoInteresse] = useState('')

  // Dados somente-leitura
  const [clienteRO, setClienteRO] = useState<Pick<
    ClienteCompleto,
    'cnpj' | 'vendedorId' | 'dataAtribuicao' | 'dataVencimento' | 'dataUltimaCompra' | 'criadoPor' | 'criadoEm' | 'atualizadoEm'
  > | null>(null)

  // Carregar cliente e vendedores em paralelo
  useEffect(() => {
    Promise.all([
      fetch(`/api/clientes/${cnpj}`).then(r => r.json() as Promise<{ ok: boolean; cliente?: ClienteCompleto; error?: string }>),
      fetch('/api/comercial/vendedores').then(r => r.json() as Promise<{ ok: boolean; vendedores?: { id: string; nome: string }[] }>),
    ])
      .then(([clienteJson, vendJson]) => {
        if (!clienteJson.ok) {
          setErro(clienteJson.error ?? 'Não foi possível carregar o cliente.')
          return
        }
        const c = clienteJson.cliente!
        setRazaoSocial(c.razaoSocial)
        setTipo(c.tipo)
        setOrigemState(c.origem)
        setOrigemLeadDetalhe(c.origemLeadDetalhe ?? '')
        setCidade(c.cidade)
        setEstado(c.estado)
        setTelefone(c.telefone)
        setNomeContato(c.nomeContato ?? '')
        setEmailContato(c.email ?? '')
        setListaId(c.listaId)
        setUltimoContato(c.ultimoContato ?? '')
        setProximaAcao(c.proximaAcao ?? '')
        setProximaAcaoData(c.proximaAcaoData ?? '')
        setObservacoes(c.observacoes ?? '')
        setCanalPreferido(c.canalPreferido ?? '')
        setProdutoInteresse(c.produtoInteresse ?? '')
        setArquivado(c.arquivado ?? false)
        setClienteRO({
          cnpj:             c.cnpj,
          vendedorId:       c.vendedorId,
          dataAtribuicao:   c.dataAtribuicao,
          dataVencimento:   c.dataVencimento,
          dataUltimaCompra: c.dataUltimaCompra,
          criadoPor:        c.criadoPor,
          criadoEm:         c.criadoEm,
          atualizadoEm:     c.atualizadoEm,
        })

        if (vendJson.ok && vendJson.vendedores) {
          const mapa: Record<string, string> = {}
          vendJson.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }
      })
      .catch(() => setErro('Erro de rede ao carregar o cliente.'))
      .finally(() => setCarregando(false))
  }, [cnpj])

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setFeedback(null)
    setSalvando(true)

    const body: Record<string, unknown> = {
      razaoSocial:       razaoSocial.trim(),
      tipo,
      origem:            origemState,
      origemLeadDetalhe: origemState === 'lead' ? (origemLeadDetalhe || null) : null,
      cidade:            cidade.trim(),
      estado,
      telefone:          telefone.trim(),
      nomeContato:       nomeContato.trim() || null,
      emailContato:      emailContato.trim() || null,
      listaId,
      ultimoContato:     ultimoContato || null,
      proximaAcao:       proximaAcao.trim() || null,
      proximaAcaoData:   proximaAcaoData || null,
      observacoes:       observacoes.trim() || null,
      canalPreferido:    canalPreferido || null,
      produtoInteresse:  produtoInteresse.trim() || null,
    }

    try {
      const res = await fetch(`/api/clientes/${cnpj}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao salvar.' })
      } else {
        setFeedback({ tipo: 'ok', msg: 'Cliente atualizado com sucesso.' })
        setTimeout(() => router.push('/clientes/cadastro'), 900)
      }
    } catch {
      setFeedback({ tipo: 'erro', msg: 'Erro de rede ao salvar.' })
    } finally {
      setSalvando(false)
    }
  }

  async function handleArquivar() {
    setArquivando(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/clientes/${cnpj}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivar: !arquivado }),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao arquivar.' })
      } else {
        setArquivado(!arquivado)
        setFeedback({ tipo: 'ok', msg: arquivado ? 'Cliente restaurado.' : 'Cliente arquivado.' })
      }
    } catch {
      setFeedback({ tipo: 'erro', msg: 'Erro de rede.' })
    } finally {
      setArquivando(false)
    }
  }

  // ── Renderização de estados especiais ────────────────────────────────────

  if (carregando) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
          />
        </div>
      </AppLayout>
    )
  }

  if (erro) {
    return (
      <AppLayout>
        <main className={styles.wrap} style={{ paddingTop: 40 }}>
          <div className={`${styles.notice} ${styles.alertaDanger}`}>
            <span>{erro}</span>
          </div>
        </main>
      </AppLayout>
    )
  }

  // ── Formulário principal ─────────────────────────────────────────────────

  const nomeVendedor = clienteRO?.vendedorId
    ? (mapaVendedores[clienteRO.vendedorId] ?? clienteRO.vendedorId)
    : '—'

  return (
    <AppLayout>
      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 80 }}>
        <div className={`${styles.stitle} ${styles.serif}`}>Editar Cliente</div>
        <div className={styles.scap} style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          {mascaraCNPJ(cnpj)}
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>

          {/* ── 1. Dados Cadastrais ─────────────────────────────────── */}
          <Secao titulo="Dados Cadastrais">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <Campo label="Razão Social">
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={e => setRazaoSocial(e.target.value)}
                  className={styles.input}
                  required
                />
              </Campo>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <Campo label="Tipo">
                  <select className={styles.select} value={tipo} onChange={e => setTipo(e.target.value)}>
                    <option value="integrador">Integrador</option>
                    <option value="distribuidora">Distribuidora</option>
                  </select>
                </Campo>

                <Campo label="Origem">
                  <select
                    className={styles.select}
                    value={origemState}
                    onChange={e => { setOrigemState(e.target.value); setOrigemLeadDetalhe('') }}
                  >
                    <option value="prospeccao">Prospecção</option>
                    <option value="lead">Lead</option>
                  </select>
                </Campo>
              </div>

              {origemState === 'lead' && (
                <Campo label="Canal de origem do lead">
                  <select
                    className={styles.select}
                    value={origemLeadDetalhe}
                    onChange={e => setOrigemLeadDetalhe(e.target.value)}
                  >
                    <option value="">Não informado</option>
                    {ORIGEM_LEAD_OPT.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Campo>
              )}

              <Campo label="Telefone">
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  className={styles.input}
                  required
                />
              </Campo>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: '0 16px' }}>
                <Campo label="Cidade">
                  <input
                    type="text"
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    className={styles.input}
                    required
                  />
                </Campo>
                <Campo label="UF">
                  <select className={styles.select} value={estado} onChange={e => setEstado(e.target.value)} required>
                    <option value="">—</option>
                    {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </Campo>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <Campo label="Nome do contato">
                  <input
                    type="text"
                    value={nomeContato}
                    onChange={e => setNomeContato(e.target.value)}
                    className={styles.input}
                    placeholder="Opcional"
                  />
                </Campo>
                <Campo label="E-mail do contato">
                  <input
                    type="email"
                    value={emailContato}
                    onChange={e => setEmailContato(e.target.value)}
                    className={styles.input}
                    placeholder="Opcional"
                  />
                </Campo>
              </div>

            </div>
          </Secao>

          {/* ── 2. Dados de CRM ─────────────────────────────────────── */}
          <Secao titulo="Dados de CRM">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <Campo label="Lista">
                  <select className={styles.select} value={listaId} onChange={e => setListaId(e.target.value)}>
                    {listas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </Campo>

                <Campo label="Canal preferido">
                  <select className={styles.select} value={canalPreferido} onChange={e => setCanalPreferido(e.target.value)}>
                    {CANAL_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Campo>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <Campo label="Último contato">
                  <input
                    type="date"
                    value={ultimoContato}
                    onChange={e => setUltimoContato(e.target.value)}
                    className={styles.input}
                  />
                </Campo>
                <Campo label="Data da próxima ação">
                  <input
                    type="date"
                    value={proximaAcaoData}
                    onChange={e => setProximaAcaoData(e.target.value)}
                    className={styles.input}
                  />
                </Campo>
              </div>

              <Campo label="Próxima ação">
                <input
                  type="text"
                  value={proximaAcao}
                  onChange={e => setProximaAcao(e.target.value)}
                  className={styles.input}
                  placeholder="Descrição da próxima ação"
                />
              </Campo>

              <Campo label="Produto de interesse">
                <input
                  type="text"
                  value={produtoInteresse}
                  onChange={e => setProdutoInteresse(e.target.value)}
                  className={styles.input}
                  placeholder="Opcional"
                />
              </Campo>

              <Campo label="Observações">
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Notas livres sobre o cliente"
                  style={{
                    border: '1px solid var(--cor-borda-sutil)',
                    borderRadius: 8,
                    background: 'var(--cor-superficie)',
                    color: 'var(--foreground)',
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    padding: '9px 12px',
                    outline: 'none',
                    resize: 'vertical',
                    width: '100%',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--cor-destaque)' }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--cor-borda-sutil)' }}
                />
              </Campo>

            </div>
          </Secao>

          {/* ── 3. Informações automáticas (somente leitura) ─────────── */}
          {clienteRO && (
            <Secao titulo="Informações automáticas">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
                <CampoLeitura label="Responsável" valor={nomeVendedor} />
                <CampoLeitura label="Data de atribuição" valor={fmtData(clienteRO.dataAtribuicao)} />
                <CampoLeitura label="Data de vencimento" valor={fmtData(clienteRO.dataVencimento)} />
                <CampoLeitura label="Última compra" valor={fmtData(clienteRO.dataUltimaCompra)} />
                <CampoLeitura label="Cadastrado por" valor={clienteRO.criadoPor} />
                <CampoLeitura label="Data de cadastro" valor={fmtDataHora(clienteRO.criadoEm)} />
                <CampoLeitura label="Última atualização" valor={fmtDataHora(clienteRO.atualizadoEm)} />
              </div>
            </Secao>
          )}

          {/* Feedback e botão */}
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 20 }}>
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

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={salvando}
              >
                {salvando ? 'Salvando…' : 'Salvar alterações'}
              </button>
              <a
                href="/clientes/cadastro"
                style={{ fontSize: 13, color: 'var(--ink3)', textDecoration: 'none' }}
              >
                Cancelar
              </a>
              <button
                type="button"
                onClick={handleArquivar}
                disabled={arquivando}
                style={{
                  marginLeft: 'auto',
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--cor-borda-sutil)',
                  background: 'none',
                  color: arquivado ? 'var(--ink2)' : 'var(--cor-texto-suave)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  cursor: arquivando ? 'not-allowed' : 'pointer',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cor-destaque)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cor-borda-sutil)' }}
              >
                {arquivando ? '…' : arquivado ? 'Restaurar' : 'Arquivar'}
              </button>
            </div>
          </div>

        </form>
      </main>
    </AppLayout>
  )
}

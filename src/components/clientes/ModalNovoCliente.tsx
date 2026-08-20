'use client'

import { useState } from 'react'
import { ComboboxBusca, type OpcaoCombobox } from '@/components/ui/ComboboxBusca'
import Modal from '@/components/ui/Modal'
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

// ─── Componente ──────────────────────────────────────────────────────────────

interface ModalNovoClienteProps {
  aberto: boolean
  onFechar: () => void
  onCriado: () => void
  eVendedor: boolean
  vendedoresOpt: OpcaoCombobox[]
  carregandoVend: boolean
  listaId?: string
}

export function ModalNovoCliente({
  aberto, onFechar, onCriado, eVendedor, vendedoresOpt, carregandoVend, listaId,
}: ModalNovoClienteProps) {
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

  const [erroCnpj, setErroCnpj] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  function limparForm() {
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
    setFeedback(null)
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

  function fecharModal() {
    onFechar()
    limparForm()
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
      if (listaId) body.listaId = listaId

      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; error?: string }

      if (res.status === 409) { setFeedback({ tipo: 'erro', msg: 'Este CNPJ já está cadastrado.' }); return }
      if (!res.ok) { setFeedback({ tipo: 'erro', msg: json.error ?? 'Erro ao cadastrar cliente.' }); return }

      limparForm()
      onCriado()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal aberto={aberto} onFechar={fecharModal} titulo={eVendedor ? 'Novo Cliente' : 'Cadastrar Cliente'} largura={500}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className={styles.btn} onClick={fecharModal}>
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={salvando || !!erroCnpj}
          >
            {salvando ? 'Salvando…' : 'Cadastrar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

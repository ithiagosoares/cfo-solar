'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import styles from '@/styles/editorial.module.css'
import { TIPOS_ATIVIDADE, type TipoAtividade } from '@/lib/atividade-config'
import { notificarAtividadeSalva } from '@/lib/alertas-eventos'

interface ModalAgendarAtividadeProps {
  aberto: boolean
  cnpj: string
  onFechar: () => void
  onSalvo: () => void
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ModalAgendarAtividade({ aberto, cnpj, onFechar, onSalvo }: ModalAgendarAtividadeProps) {
  const [tipo, setTipo] = useState<TipoAtividade>('Visita')
  const [dataAgendada, setDataAgendada] = useState('')
  const [notas, setNotas] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fecharEResetar() {
    setTipo('Visita')
    setDataAgendada('')
    setNotas('')
    setErro(null)
    onFechar()
  }

  async function handleSalvar(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!dataAgendada) {
      setErro('Data é obrigatória.')
      return
    }
    if (dataAgendada < hojeIso()) {
      setErro('A data agendada não pode ser no passado.')
      return
    }
    setSalvando(true)
    setErro(null)

    try {
      const res = await fetch(`/api/clientes/${cnpj}/atividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, dataAgendada, notas: notas.trim() || null, dataRealizado: null }),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Erro ao salvar.')
        return
      }
      notificarAtividadeSalva()
      onSalvo()
      fecharEResetar()
    } catch {
      setErro('Erro de rede ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal aberto={aberto} onFechar={fecharEResetar} titulo="Agendar ação" largura={420}>
      <form onSubmit={e => { void handleSalvar(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoAtividade)} className={styles.select} required>
            {TIPOS_ATIVIDADE.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Data agendada</label>
          <input
            type="date"
            value={dataAgendada}
            min={hojeIso()}
            onChange={e => setDataAgendada(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="O que precisa ser feito"
            className={styles.input}
            style={{ resize: 'vertical' }}
          />
        </div>

        {erro && (
          <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ margin: 0 }}>
            <span>{erro}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={fecharEResetar} className={styles.btn}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ModalAgendarAtividade

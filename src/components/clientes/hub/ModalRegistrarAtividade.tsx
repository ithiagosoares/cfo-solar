'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import styles from '@/styles/editorial.module.css'
import { TIPOS_ATIVIDADE, RESULTADOS_POR_TIPO, type TipoAtividade, type ResultadoAtividade } from '@/lib/atividade-config'
import type { AtividadeComNome } from './AtividadeCard'

interface ModalRegistrarAtividadeProps {
  aberto: boolean
  cnpj: string
  // Quando informado, o modal entra em modo "concluir": tipo travado nesta
  // atividade, PATCH em vez de POST. Quando null, cria uma atividade nova.
  atividadeParaConcluir: AtividadeComNome | null
  onFechar: () => void
  onSalvo: () => void
}

// modo "criar": tipo é um <select> em estado local, resetado no fechamento
// real (nunca via useEffect ligado a `aberto` — o <dialog> do Modal fica
// sempre montado, então isso causaria setState síncrono dentro de efeito,
// mesmo problema já corrigido em ModalRegistrarContato.tsx na sessão anterior).
// modo "concluir": tipo vem direto da prop (imutável nesse fluxo), sem estado.
export function ModalRegistrarAtividade({ aberto, cnpj, atividadeParaConcluir, onFechar, onSalvo }: ModalRegistrarAtividadeProps) {
  const concluindo = atividadeParaConcluir !== null

  const [tipo, setTipo] = useState<TipoAtividade>('Ligação')
  const [resultado, setResultado] = useState<ResultadoAtividade | ''>('')
  const [notas, setNotas] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Tipo efetivo do formulário: travado na atividade sendo concluída, ou o
  // <select> em modo criação. Resultado sempre depende deste — nunca mostrar
  // opções de outro tipo (ex: "Não Contactado" pra uma "Ligação").
  const tipoEfetivo = concluindo ? atividadeParaConcluir.tipo : tipo
  const opcoesResultado = RESULTADOS_POR_TIPO[tipoEfetivo]

  function handleMudarTipo(novoTipo: TipoAtividade) {
    setTipo(novoTipo)
    // se o resultado já escolhido não existe pro novo tipo, limpa — nunca deixa
    // uma combinação inválida selecionada
    setResultado(atual => (atual && RESULTADOS_POR_TIPO[novoTipo].includes(atual) ? atual : ''))
  }

  function fecharEResetar() {
    setTipo('Ligação')
    setResultado('')
    setNotas('')
    setErro(null)
    onFechar()
  }

  async function handleSalvar(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!resultado) {
      setErro('Resultado é obrigatório.')
      return
    }
    setSalvando(true)
    setErro(null)

    try {
      const res = concluindo
        ? await fetch(`/api/clientes/${cnpj}/atividades/${atividadeParaConcluir.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marcarRealizado: true, resultado, notas: notas.trim() || null }),
          })
        : await fetch(`/api/clientes/${cnpj}/atividades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo,
              resultado,
              notas: notas.trim() || null,
              dataRealizado: new Date().toISOString(),
            }),
          })

      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Erro ao salvar.')
        return
      }
      onSalvo()
      fecharEResetar()
    } catch {
      setErro('Erro de rede ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal aberto={aberto} onFechar={fecharEResetar} titulo={concluindo ? 'Concluir ação' : 'Registrar contato'} largura={420}>
      <form onSubmit={e => { void handleSalvar(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tipo</label>
          {concluindo ? (
            <div style={{ fontSize: 13.5, padding: '9px 0' }}>{atividadeParaConcluir.tipo}</div>
          ) : (
            <select
              value={tipo}
              onChange={e => handleMudarTipo(e.target.value as TipoAtividade)}
              className={styles.select}
              required
            >
              {TIPOS_ATIVIDADE.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Resultado</label>
          <select
            value={resultado}
            onChange={e => setResultado(e.target.value as ResultadoAtividade)}
            className={styles.select}
            required
          >
            <option value="">Selecione…</option>
            {opcoesResultado.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="O que foi conversado"
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

export default ModalRegistrarAtividade

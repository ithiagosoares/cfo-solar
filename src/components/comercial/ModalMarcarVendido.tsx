'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import styles from '@/styles/editorial.module.css'
import { formatMoeda } from '@/lib/utils'

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface PedidoParaVender {
  id: string
  cliente: string
  valorOrcado: number
}

interface ModalMarcarVendidoProps {
  pedido: PedidoParaVender | null
  onFechar: () => void
  onSalvo: (msg: string) => void
}

// Reaproveita o PATCH genérico de orçamento (/api/orcamentos/[id]) em vez de
// criar uma rota dedicada — mesma lógica de transição de status já centralizada
// em atualizarPedido() (ver CLAUDE.md, seção 7, regra 4: nunca duplicar cálculo
// em duas telas).
export function ModalMarcarVendido({ pedido, onFechar, onSalvo }: ModalMarcarVendidoProps) {
  const [dataVenda, setDataVenda] = useState(hojeIso())
  const [valorVendido, setValorVendido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fecharEResetar() {
    setDataVenda(hojeIso())
    setValorVendido('')
    setErro(null)
    onFechar()
  }

  async function handleConfirmar(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!pedido) return

    if (!dataVenda) {
      setErro('Data da venda é obrigatória.')
      return
    }
    if (dataVenda > hojeIso()) {
      setErro('A data da venda não pode ser no futuro.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const res = await fetch(`/api/orcamentos/${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'vendido',
          dataVenda,
          valorVendido: valorVendido.trim() ? Number(valorVendido) : pedido.valorOrcado,
        }),
      })
      const json = await res.json() as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Erro ao registrar venda.')
        return
      }
      onSalvo('Venda registrada com sucesso!')
      fecharEResetar()
    } catch {
      setErro('Erro de rede ao registrar venda.')
    } finally {
      setSalvando(false)
    }
  }

  if (!pedido) return null

  return (
    <Modal aberto={pedido !== null} onFechar={fecharEResetar} titulo="Registrar venda" largura={420}>
      <form onSubmit={e => { void handleConfirmar(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink2)' }}>
          {pedido.cliente} — <span className={styles.num}>{formatMoeda(pedido.valorOrcado)}</span>
        </p>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Data da venda</label>
          <input
            type="date"
            value={dataVenda}
            max={hojeIso()}
            onChange={e => setDataVenda(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Valor vendido (opcional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valorVendido}
            onChange={e => setValorVendido(e.target.value)}
            placeholder={formatMoeda(pedido.valorOrcado)}
            className={styles.input}
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
            {salvando ? 'Registrando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ModalMarcarVendido

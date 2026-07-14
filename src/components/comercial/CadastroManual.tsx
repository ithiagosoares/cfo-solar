'use client'

import { useState } from 'react'
import styles from '@/styles/editorial.module.css'
import { formatMoeda } from '@/lib/utils'

type StatusPedido = 'orcado' | 'vendido'

interface Pedido {
  vendedor: string
  empresa: string
  filial: string
  cliente: string
  valorOrcado: number
  dataOrcamento: string
  status: StatusPedido
  valorVendido: number | null
  dataVenda: string | null
}

const VENDEDORES_OPT = ['Carla Nunes', 'Ana Ferreira', 'Bruno Castilho', 'Elaine Sousa', 'Diego Martins']
const EMPRESAS_OPT = [
  'CFO Solar Estruturas Ltda',
  'CFO Solar Distribuição Norte',
  'CFO Solar Participações',
  'CFO Solar Comercial Sul',
  'CFO Solar Trading Ltda',
]
const CLIENTES_OPT = ['Neo Solar Distribuidora', 'EcoVolt Energia', 'Sol Nascente Engenharia', 'Helios Montagens', 'Fotovolt Sul']

const PEDIDOS_INICIAIS: Pedido[] = [
  { vendedor: 'Carla Nunes', empresa: 'CFO Solar Estruturas Ltda', filial: 'São Paulo', cliente: 'Neo Solar Distribuidora', valorOrcado: 128000, dataOrcamento: '2026-07-10', status: 'orcado', valorVendido: null, dataVenda: null },
  { vendedor: 'Ana Ferreira', empresa: 'CFO Solar Distribuição Norte', filial: 'São Paulo', cliente: 'EcoVolt Energia', valorOrcado: 64500, dataOrcamento: '2026-07-11', status: 'vendido', valorVendido: 61200, dataVenda: '2026-07-12' },
  { vendedor: 'Elaine Sousa', empresa: 'CFO Solar Participações', filial: 'Paraná', cliente: 'Fotovolt Sul', valorOrcado: 33800, dataOrcamento: '2026-07-12', status: 'orcado', valorVendido: null, dataVenda: null },
  { vendedor: 'Diego Martins', empresa: 'CFO Solar Comercial Sul', filial: 'Paraná', cliente: 'Sol Nascente Engenharia', valorOrcado: 47200, dataOrcamento: '2026-07-09', status: 'vendido', valorVendido: 47200, dataVenda: '2026-07-13' },
  { vendedor: 'Bruno Castilho', empresa: 'CFO Solar Trading Ltda', filial: 'São Paulo', cliente: 'Helios Montagens', valorOrcado: 29500, dataOrcamento: '2026-07-13', status: 'orcado', valorVendido: null, dataVenda: null },
]

type FormState = {
  vendedor: string
  empresa: string
  filial: string
  cliente: string
  valorOrcado: string
  dataOrcamento: string
  status: StatusPedido
  valorVendido: string
  dataVenda: string
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export function CadastroManual() {
  const [pedidos, setPedidos] = useState<Pedido[]>(PEDIDOS_INICIAIS)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editValor, setEditValor] = useState('')
  const [editData, setEditData] = useState('')
  const [form, setForm] = useState<FormState>({
    vendedor: VENDEDORES_OPT[0],
    empresa: EMPRESAS_OPT[0],
    filial: 'São Paulo',
    cliente: '',
    valorOrcado: '',
    dataOrcamento: '',
    status: 'orcado',
    valorVendido: '',
    dataVenda: '',
  })

  function updateForm(patch: Partial<FormState>) {
    setForm(f => ({ ...f, ...patch }))
  }

  function submitForm() {
    if (!form.cliente || !form.valorOrcado) return
    const novo: Pedido = {
      vendedor: form.vendedor,
      empresa: form.empresa,
      filial: form.filial,
      cliente: form.cliente,
      valorOrcado: parseFloat(form.valorOrcado) || 0,
      dataOrcamento: form.dataOrcamento || new Date().toISOString().slice(0, 10),
      status: form.status,
      valorVendido: form.status === 'vendido' ? (parseFloat(form.valorVendido) || 0) : null,
      dataVenda: form.status === 'vendido' ? (form.dataVenda || null) : null,
    }
    setPedidos(p => [novo, ...p])
    setForm({ vendedor: VENDEDORES_OPT[0], empresa: EMPRESAS_OPT[0], filial: 'São Paulo', cliente: '', valorOrcado: '', dataOrcamento: '', status: 'orcado', valorVendido: '', dataVenda: '' })
  }

  function confirmSale(i: number) {
    const val = parseFloat(editValor) || 0
    setPedidos(prev => {
      const arr = [...prev]
      arr[i] = { ...arr[i], status: 'vendido', valorVendido: val, dataVenda: editData || null }
      return arr
    })
    setEditIdx(null)
    setEditValor('')
    setEditData('')
  }

  return (
    <div className="flex flex-col animate-fadeIn">

      {/* ── Formulário de cadastro ────────────────────────────────────── */}
      <div>
        <div className={`${styles.stitle} ${styles.serif}`}>Cadastro Manual</div>
        <div className={styles.scap}>Registrar um novo orçamento ou pedido comercial.</div>

        <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Vendedor</label>
            <select className={styles.select} value={form.vendedor} onChange={e => updateForm({ vendedor: e.target.value })}>
              {VENDEDORES_OPT.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Empresa</label>
            <select className={styles.select} value={form.empresa} onChange={e => updateForm({ empresa: e.target.value })}>
              {EMPRESAS_OPT.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Filial</label>
            <select className={styles.select} value={form.filial} onChange={e => updateForm({ filial: e.target.value })}>
              <option value="São Paulo">São Paulo</option>
              <option value="Paraná">Paraná</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Cliente</label>
            <input
              type="text"
              list="clientesList"
              placeholder="Nome do cliente"
              value={form.cliente}
              onChange={e => updateForm({ cliente: e.target.value })}
              className={styles.input}
            />
            <datalist id="clientesList">
              {CLIENTES_OPT.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Valor Orçado</label>
            <input
              type="number"
              placeholder="Ex.: 45000"
              value={form.valorOrcado}
              onChange={e => updateForm({ valorOrcado: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Data do Orçamento</label>
            <input
              type="date"
              value={form.dataOrcamento}
              onChange={e => updateForm({ dataOrcamento: e.target.value })}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Status</label>
            <div className={styles.toggle2}>
              <button
                className={`${styles.tgBtn} ${form.status === 'orcado' ? styles.tgBtnOn : ''}`}
                onClick={() => updateForm({ status: 'orcado' })}
              >
                Orçado
              </button>
              <button
                className={`${styles.tgBtn} ${form.status === 'vendido' ? styles.tgBtnOn : ''}`}
                onClick={() => updateForm({ status: 'vendido' })}
              >
                Vendido
              </button>
            </div>
          </div>

          {form.status === 'vendido' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Valor Vendido</label>
                <input
                  type="number"
                  placeholder="Ex.: 45000"
                  value={form.valorVendido}
                  onChange={e => updateForm({ valorVendido: e.target.value })}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Data da Venda</label>
                <input
                  type="date"
                  value={form.dataVenda}
                  onChange={e => updateForm({ dataVenda: e.target.value })}
                  className={styles.input}
                />
              </div>
            </>
          )}

          <button onClick={submitForm} className={styles.btnPrimary} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
            Adicionar Orçamento
          </button>
        </div>
      </div>

      {/* ── Orçamentos da Semana ──────────────────────────────────────── */}
      <div style={{ marginTop: 56 }}>
        <div className={styles.shead} style={{ marginBottom: 12 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Orçamentos da Semana</div>
          <div className={styles.over}>{pedidos.length} registros</div>
        </div>
        <div className={styles.scap}>Pedidos cadastrados na semana atual. Marque como vendido diretamente na lista.</div>

        <div className={styles.wkHead}>
          <div>Cliente</div>
          <div>Vendedor</div>
          <div>Empresa / Filial</div>
          <div>Valor Orçado</div>
          <div>Data Orçamento</div>
          <div>Status</div>
          <div style={{ textAlign: 'right' }}>Ação</div>
        </div>

        {pedidos.map((p, i) => (
          <div key={i}>
            <div className={styles.wkRow}>
              <div className={styles.wkCli}>{p.cliente}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink2)' }}>{p.vendedor}</div>
              <div>
                <div style={{ fontSize: 13.5 }}>{p.empresa}</div>
                <div className={styles.wkSub}>{p.filial}</div>
              </div>
              <div className={styles.num} style={{ fontSize: 13.5 }}>{formatMoeda(p.valorOrcado)}</div>
              <div className={styles.num} style={{ fontSize: 13.5 }}>{fmtDate(p.dataOrcamento)}</div>
              <div>
                <span className={p.status === 'vendido' ? styles.badgeVen : styles.badgeOrc}>
                  {p.status === 'vendido' ? 'Vendido' : 'Orçado'}
                </span>
              </div>
              <div className={styles.wkAct}>
                {p.status === 'orcado' && (
                  <button
                    className={styles.wkLink}
                    onClick={() => {
                      setEditIdx(i)
                      setEditValor(String(p.valorOrcado))
                      setEditData('')
                    }}
                  >
                    Marcar como Vendido
                  </button>
                )}
                {p.status === 'vendido' && (
                  <span className={styles.wkSub}>{p.valorVendido != null ? formatMoeda(p.valorVendido) : '—'}</span>
                )}
              </div>
            </div>

            {editIdx === i && (
              <div className={styles.editPanel}>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>Valor Vendido</label>
                  <input
                    type="number"
                    placeholder="Ex.: 45000"
                    value={editValor}
                    onChange={e => setEditValor(e.target.value)}
                    className={styles.editInput}
                    style={{ width: 160 }}
                  />
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>Data da Venda</label>
                  <input
                    type="date"
                    value={editData}
                    onChange={e => setEditData(e.target.value)}
                    className={styles.editInput}
                  />
                </div>
                <div style={{ display: 'flex', gap: 14, paddingBottom: 8 }}>
                  <button className={`${styles.actBtn} ${styles.actOk}`} onClick={() => confirmSale(i)}>Confirmar</button>
                  <button className={`${styles.actBtn} ${styles.actNo}`} onClick={() => { setEditIdx(null); setEditValor(''); setEditData('') }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

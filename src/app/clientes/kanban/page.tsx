'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy, horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { Plus, X, Archive } from 'lucide-react'
import { ModalNovoCliente } from '@/components/clientes/ModalNovoCliente'
import styles from '@/styles/editorial.module.css'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ListaCrm {
  id: string
  nome: string
  cor: string
  posicao: number
  arquivado: boolean
}

interface ClienteKanban {
  cnpj: string
  razaoSocial: string
  cidade: string
  estado: string
  listaId: string
  posicao: number
  ultimoContato: string | null
  totalVendido: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCNPJ(raw: string): string {
  return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatBRL(val: number): string {
  if (val === 0) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val)
}

function tempoSemContato(ultimo: string | null): string {
  if (!ultimo) return 'Sem contato'
  const dias = Math.floor((Date.now() - new Date(ultimo).getTime()) / 86_400_000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 30) return `${dias}d atrás`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return meses === 1 ? '1 mês' : `${meses} meses`
  const anos = Math.floor(meses / 12)
  return anos === 1 ? '1 ano' : `${anos} anos`
}

// posicao é numeric (estilo Trello): entre dois vizinhos, usa a média — nunca
// precisa reindexar a lista inteira a cada drag.
function posicaoEntre(antes: number | null, depois: number | null): number {
  if (antes === null && depois === null) return 1000
  if (antes === null) return depois! - 1000
  if (depois === null) return antes + 1000
  return (antes + depois) / 2
}

// ─── Cartão ───────────────────────────────────────────────────────────────────

function CartaoCliente({ cliente, cor }: { cliente: ClienteKanban; cor: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cliente.cnpj,
    data: { type: 'cartao', listaId: cliente.listaId },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
        position: isDragging ? 'relative' : undefined,
        cursor: 'grab',
        marginBottom: 8,
        touchAction: 'none',
      }}
    >
      <Link
        href={`/clientes/${cliente.cnpj}/editar`}
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        onClick={e => { if (isDragging) e.preventDefault() }}
      >
        <div style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '10px 12px',
          boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,.12)' : undefined,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--foreground)', marginBottom: 2, lineHeight: 1.3 }}>
            {cliente.razaoSocial}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            {formatCNPJ(cliente.cnpj)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
            {cliente.cidade} / {cliente.estado}
          </div>
          {cliente.totalVendido > 0 && (
            <div style={{ fontSize: 12, color: 'var(--positivo)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              {formatBRL(cliente.totalVendido)}
            </div>
          )}
          <div style={{ fontSize: 11, color: cor, marginTop: 6, fontWeight: 500 }}>
            {tempoSemContato(cliente.ultimoContato)}
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── Coluna (lista) ─────────────────────────────────────────────────────────

function ListaColuna({
  lista, clientes, podeGerenciar, onAdicionarCartao, onRenomear, onArquivar,
}: {
  lista: ListaCrm
  clientes: ClienteKanban[]
  podeGerenciar: boolean
  onAdicionarCartao: () => void
  onRenomear: (novoNome: string) => void
  onArquivar: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lista.id,
    data: { type: 'lista-header' },
  })

  const [editando, setEditando] = useState(false)
  const [nomeEdit, setNomeEdit] = useState(lista.nome)

  function confirmarRenomeio() {
    setEditando(false)
    const nome = nomeEdit.trim()
    if (nome && nome !== lista.nome) onRenomear(nome)
    else setNomeEdit(lista.nome)
  }

  const ids = clientes.map(c => c.cnpj)

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex', flexDirection: 'column', flex: '0 0 260px', minWidth: 0,
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 2px', cursor: podeGerenciar ? 'grab' : 'default' }}
      >
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: lista.cor, flexShrink: 0 }} />
        {editando ? (
          <input
            autoFocus
            value={nomeEdit}
            onChange={e => setNomeEdit(e.target.value)}
            onBlur={confirmarRenomeio}
            onKeyDown={e => { if (e.key === 'Enter') confirmarRenomeio(); if (e.key === 'Escape') { setNomeEdit(lista.nome); setEditando(false) } }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              border: '1px solid var(--line2)', borderRadius: 4, padding: '1px 4px', width: '100%',
              background: 'var(--paper)', color: 'var(--foreground)', fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            onClick={e => { if (podeGerenciar) { e.stopPropagation(); setEditando(true) } }}
            onPointerDown={e => { if (podeGerenciar) e.stopPropagation() }}
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink2)', cursor: podeGerenciar ? 'text' : 'default' }}
          >
            {lista.nome}
          </span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: 11, color: 'var(--ink3)',
          background: 'var(--line)', borderRadius: 10, padding: '1px 7px',
          fontFamily: 'var(--font-mono)', flexShrink: 0,
        }}>
          {clientes.length}
        </span>
        {podeGerenciar && (
          <button
            type="button"
            title="Arquivar lista"
            onClick={e => { e.stopPropagation(); onArquivar() }}
            onPointerDown={e => e.stopPropagation()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', padding: 2, display: 'flex', flexShrink: 0 }}
          >
            <Archive style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 100,
          borderRadius: 8,
          padding: '6px 6px 2px',
          background: 'transparent',
          border: '1.5px dashed var(--line)',
          transition: 'background .15s, border-color .15s',
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {clientes.map(c => <CartaoCliente key={c.cnpj} cliente={c} cor={lista.cor} />)}
        </SortableContext>
        {clientes.length === 0 && (
          <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 11, color: 'var(--ink3)' }}>
            —
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAdicionarCartao}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
          background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'inherit', padding: '4px 2px',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink3)')}
      >
        <Plus style={{ width: 13, height: 13 }} />
        Adicionar cartão
      </button>
    </div>
  )
}

// ─── Nova lista ──────────────────────────────────────────────────────────────

function NovaListaBotao({ onCriar }: { onCriar: (nome: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')

  function confirmar() {
    const n = nome.trim()
    if (n) onCriar(n)
    setNome('')
    setAberto(false)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          flex: '0 0 260px', minHeight: 40, display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--line)', border: 'none', borderRadius: 8, color: 'var(--ink2)',
          cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '10px 12px', height: 'fit-content',
        }}
      >
        <Plus style={{ width: 14, height: 14 }} />
        Adicionar outra lista
      </button>
    )
  }

  return (
    <div style={{ flex: '0 0 260px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
      <input
        autoFocus
        value={nome}
        onChange={e => setNome(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setAberto(false) }}
        placeholder="Nome da lista…"
        style={{
          width: '100%', border: '1px solid var(--line2)', borderRadius: 6, padding: '6px 8px',
          fontSize: 13, fontFamily: 'inherit', background: 'var(--background)', color: 'var(--foreground)', outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={confirmar} className={styles.btnPrimary} style={{ fontSize: 12, padding: '5px 12px' }}>
          Adicionar
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); setNome('') }}
          style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const [papel, setPapel] = useState<string | null>(null)
  const [listas, setListas] = useState<ListaCrm[]>([])
  const [clientes, setClientes] = useState<ClienteKanban[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [vendedoresOpt, setVendedoresOpt] = useState<{ id: string; label: string }[]>([])
  const [modalListaId, setModalListaId] = useState<string | null>(null)

  const podeGerenciarListas = papel === 'administrador' || papel === 'gestor'
  const eVendedor = papel === 'vendedor'

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string }>)
      .then(d => setPapel(d.papel ?? 'sem_acesso'))
      .catch(() => setPapel('sem_acesso'))
  }, [])

  useEffect(() => {
    if (papel === null || papel === 'vendedor') return
    fetch('/api/comercial/vendedores')
      .then(r => r.json() as Promise<{ ok: boolean; vendedores?: { id: string; nome: string }[] }>)
      .then(json => { if (json.ok && json.vendedores) setVendedoresOpt(json.vendedores.map(v => ({ id: v.id, label: v.nome }))) })
      .catch(() => {})
  }, [papel])

  const carregarTudo = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [resListas, resClientes] = await Promise.all([
        fetch('/api/crm-listas'),
        fetch('/api/clientes/kanban'),
      ])
      const jsonListas = await resListas.json() as { ok: boolean; listas?: ListaCrm[]; error?: string }
      const jsonClientes = await resClientes.json() as { ok: boolean; clientes?: ClienteKanban[]; error?: string }
      if (!resListas.ok || !jsonListas.ok) throw new Error(jsonListas.error ?? 'Erro ao carregar listas')
      if (!resClientes.ok || !jsonClientes.ok) throw new Error(jsonClientes.error ?? 'Erro ao carregar clientes')
      setListas((jsonListas.listas ?? []).sort((a, b) => a.posicao - b.posicao))
      setClientes(jsonClientes.clientes ?? [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregarTudo() }, [carregarTudo]) // eslint-disable-line react-hooks/set-state-in-effect

  const clientesFiltrados = busca.trim()
    ? clientes.filter(c =>
        c.razaoSocial.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj.includes(busca.replace(/\D/g, ''))
      )
    : clientes

  async function criarLista(nome: string) {
    const res = await fetch('/api/crm-listas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }),
    })
    const json = await res.json() as { ok: boolean; lista?: ListaCrm }
    if (json.ok && json.lista) setListas(prev => [...prev, json.lista!])
  }

  async function renomearLista(id: string, nome: string) {
    setListas(prev => prev.map(l => l.id === id ? { ...l, nome } : l))
    await fetch(`/api/crm-listas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }),
    })
  }

  async function arquivarLista(id: string) {
    const lista = listas.find(l => l.id === id)
    const temCartoes = clientes.some(c => c.listaId === id)
    if (temCartoes && !window.confirm(`A lista "${lista?.nome}" tem cartões. Arquivar mesmo assim? Os cartões ficam escondidos do quadro até a lista ser restaurada.`)) {
      return
    }
    setListas(prev => prev.filter(l => l.id !== id))
    await fetch(`/api/crm-listas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arquivado: true }),
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeType = active.data.current?.type as string | undefined

    if (activeType === 'lista-header') {
      if (over.data.current?.type !== 'lista-header') return
      const oldIndex = listas.findIndex(l => l.id === active.id)
      const newIndex = listas.findIndex(l => l.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordenadas = arrayMove(listas, oldIndex, newIndex)
      const novaPosicao = posicaoEntre(
        reordenadas[newIndex - 1]?.posicao ?? null,
        reordenadas[newIndex + 1]?.posicao ?? null,
      )
      setListas(reordenadas.map(l => l.id === active.id ? { ...l, posicao: novaPosicao } : l))
      fetch(`/api/crm-listas/${active.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ posicao: novaPosicao }),
      }).catch(() => void carregarTudo())
      return
    }

    if (activeType === 'cartao') {
      const cnpj = String(active.id)
      const cartao = clientes.find(c => c.cnpj === cnpj)
      if (!cartao) return

      const overType = over.data.current?.type as string | undefined
      let listaDestinoId: string
      let irmaos: ClienteKanban[]
      let indiceAlvo: number

      if (overType === 'cartao') {
        const overCliente = clientes.find(c => c.cnpj === String(over.id))
        if (!overCliente) return
        listaDestinoId = overCliente.listaId
        irmaos = clientes.filter(c => c.listaId === listaDestinoId && c.cnpj !== cnpj).sort((a, b) => a.posicao - b.posicao)
        indiceAlvo = irmaos.findIndex(c => c.cnpj === overCliente.cnpj)
        if (indiceAlvo === -1) indiceAlvo = irmaos.length
      } else if (overType === 'lista-header') {
        listaDestinoId = String(over.id)
        irmaos = clientes.filter(c => c.listaId === listaDestinoId && c.cnpj !== cnpj).sort((a, b) => a.posicao - b.posicao)
        indiceAlvo = irmaos.length
      } else {
        return
      }

      const novaPosicao = posicaoEntre(
        irmaos[indiceAlvo - 1]?.posicao ?? null,
        irmaos[indiceAlvo]?.posicao ?? null,
      )
      if (listaDestinoId === cartao.listaId && novaPosicao === cartao.posicao) return

      const listaAnterior = cartao.listaId
      const posicaoAnterior = cartao.posicao
      setClientes(prev => prev.map(c => c.cnpj === cnpj ? { ...c, listaId: listaDestinoId, posicao: novaPosicao } : c))

      fetch(`/api/clientes/${cnpj}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listaId: listaDestinoId, posicao: novaPosicao }),
      }).then(res => {
        if (!res.ok) setClientes(prev => prev.map(c => c.cnpj === cnpj ? { ...c, listaId: listaAnterior, posicao: posicaoAnterior } : c))
      }).catch(() => {
        setClientes(prev => prev.map(c => c.cnpj === cnpj ? { ...c, listaId: listaAnterior, posicao: posicaoAnterior } : c))
      })
    }
  }

  return (
    <div className={styles.page}>
      <ModalNovoCliente
        aberto={modalListaId !== null}
        onFechar={() => setModalListaId(null)}
        onCriado={() => { setModalListaId(null); void carregarTudo() }}
        eVendedor={eVendedor}
        vendedoresOpt={vendedoresOpt}
        carregandoVend={false}
        listaId={modalListaId ?? undefined}
      />

      <div className={styles.htop}>
        <div className={styles.wrap}>
          <div className={styles.brand}>
            <Link href="/clientes" className={styles.link}>
              <span className={styles.bname}>Clientes</span>
            </Link>
            <span className={styles.bsub}>Kanban CRM</span>
          </div>
          <nav className={styles.nav}>
            <Link href="/clientes/cadastro" className={styles.tab}>Lista</Link>
            <Link href="/clientes/kanban" className={`${styles.tab} ${styles.tabOn}`}>Kanban</Link>
          </nav>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--background)' }}>
        <div className={styles.wrap} style={{ padding: '14px 32px' }}>
          <input
            type="search"
            placeholder="Buscar por nome ou CNPJ…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              height: 36, padding: '0 12px', borderRadius: 6,
              border: '1px solid var(--line)', background: 'var(--paper)',
              fontSize: 13, color: 'var(--foreground)', fontFamily: 'inherit',
              width: 280, outline: 'none',
            }}
          />
        </div>
      </div>

      <div className={styles.wrap} style={{ padding: '24px 32px 48px' }}>
        {carregando && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div className="h-7 w-7 rounded-full border-2 animate-spin"
              style={{ borderTopColor: 'var(--marca)', borderRightColor: 'var(--line)', borderBottomColor: 'var(--line)', borderLeftColor: 'var(--line)' }} />
          </div>
        )}

        {erro && (
          <div style={{ color: 'var(--critico)', fontSize: 13, padding: '20px 0' }}>{erro}</div>
        )}

        {!carregando && !erro && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={listas.map(l => l.id)} strategy={horizontalListSortingStrategy}>
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
                {listas.map(lista => (
                  <ListaColuna
                    key={lista.id}
                    lista={lista}
                    clientes={clientesFiltrados.filter(c => c.listaId === lista.id).sort((a, b) => a.posicao - b.posicao)}
                    podeGerenciar={podeGerenciarListas}
                    onAdicionarCartao={() => setModalListaId(lista.id)}
                    onRenomear={nome => void renomearLista(lista.id, nome)}
                    onArquivar={() => void arquivarLista(lista.id)}
                  />
                ))}
                {podeGerenciarListas && <NovaListaBotao onCriar={nome => void criarLista(nome)} />}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

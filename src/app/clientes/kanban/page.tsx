'use client'

import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core'
import Link from 'next/link'
import styles from '@/styles/editorial.module.css'

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLUNAS = [
  { id: 'novo_lead',     label: 'Novo Lead',     cor: '#3A6080' },
  { id: 'em_contato',    label: 'Em Contato',    cor: '#A07830' },
  { id: 'negociando',    label: 'Negociando',    cor: '#C78A2E' },
  { id: 'cliente_ativo', label: 'Cliente Ativo', cor: '#3E6B63' },
  { id: 'inativo',       label: 'Inativo',       cor: '#8A857C' },
  { id: 'perdido',       label: 'Perdido',       cor: '#A8452F' },
] as const

type StatusCrm = (typeof COLUNAS)[number]['id']

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ClienteKanban {
  cnpj: string
  razaoSocial: string
  cidade: string
  estado: string
  statusCrm: StatusCrm
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

// ─── Card ─────────────────────────────────────────────────────────────────────

function KanbanCard({ cliente, cor }: { cliente: ClienteKanban; cor: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: cliente.cnpj })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
        opacity: isDragging ? 0.6 : 1,
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

// ─── Coluna ───────────────────────────────────────────────────────────────────

function KanbanColuna({ id, label, cor, clientes }: {
  id: string
  label: string
  cor: string
  clientes: ClienteKanban[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 240px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 2px' }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: cor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink2)' }}>
          {label}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, color: 'var(--ink3)',
          background: 'var(--line)', borderRadius: 10, padding: '1px 7px',
          fontFamily: 'var(--font-mono)',
        }}>
          {clientes.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 100,
          borderRadius: 8,
          padding: '6px 6px 2px',
          background: isOver ? `${cor}18` : 'transparent',
          border: `1.5px dashed ${isOver ? cor : 'var(--line)'}`,
          transition: 'background .15s, border-color .15s',
        }}
      >
        {clientes.map(c => <KanbanCard key={c.cnpj} cliente={c} cor={cor} />)}
        {clientes.length === 0 && (
          <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 11, color: 'var(--ink3)' }}>
            —
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const [clientes, setClientes]     = useState<ClienteKanban[]>([])
  const [busca, setBusca]           = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]             = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const buscarClientes = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch('/api/clientes/kanban')
      const json = await res.json() as { ok: boolean; clientes?: ClienteKanban[]; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Erro ao carregar clientes')
      setClientes(json.clientes ?? [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void buscarClientes() }, [buscarClientes])

  const clientesFiltrados = busca.trim()
    ? clientes.filter(c =>
        c.razaoSocial.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj.includes(busca.replace(/\D/g, ''))
      )
    : clientes

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const cnpj       = String(active.id)
    const novoStatus = String(over.id) as StatusCrm
    const cliente    = clientes.find(c => c.cnpj === cnpj)
    if (!cliente || cliente.statusCrm === novoStatus) return

    // Atualização otimista
    const anteriorStatus = cliente.statusCrm
    setClientes(prev => prev.map(c => c.cnpj === cnpj ? { ...c, statusCrm: novoStatus } : c))

    try {
      const res = await fetch(`/api/clientes/${cnpj}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusCrm: novoStatus }),
      })
      if (!res.ok) {
        setClientes(prev => prev.map(c => c.cnpj === cnpj ? { ...c, statusCrm: anteriorStatus } : c))
      }
    } catch {
      setClientes(prev => prev.map(c => c.cnpj === cnpj ? { ...c, statusCrm: anteriorStatus } : c))
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
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

      {/* Barra de busca */}
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

      {/* Conteúdo */}
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
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
              {COLUNAS.map(col => (
                <KanbanColuna
                  key={col.id}
                  id={col.id}
                  label={col.label}
                  cor={col.cor}
                  clientes={clientesFiltrados.filter(c => c.statusCrm === col.id)}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  )
}

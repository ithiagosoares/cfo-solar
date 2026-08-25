'use client'

import Link from 'next/link'
import { PhoneCall, FileText, CalendarClock, MessageCircle, Mail } from 'lucide-react'
import styles from '@/styles/editorial.module.css'
import type { Cliente } from '@/lib/clientes-repository'

interface AcoesRapidasProps {
  cliente: Cliente
  onRegistrarContato: () => void
  onAgendarVisita: () => void
}

function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

const btnEstilo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start', textDecoration: 'none', width: '100%' }

export function AcoesRapidas({ cliente, onRegistrarContato, onAgendarVisita }: AcoesRapidasProps) {
  const whatsappHref = cliente.telefone ? `https://wa.me/55${apenasDigitos(cliente.telefone)}` : null
  const emailHref = cliente.email ? `mailto:${cliente.email}` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button type="button" onClick={onRegistrarContato} className={styles.btn} style={btnEstilo}>
        <PhoneCall style={{ width: 14, height: 14, flexShrink: 0 }} /> Registrar Contato
      </button>
      <Link href="/orcamentos" className={styles.btn} style={btnEstilo}>
        <FileText style={{ width: 14, height: 14, flexShrink: 0 }} /> Novo Orçamento
      </Link>
      <button type="button" onClick={onAgendarVisita} className={styles.btn} style={btnEstilo}>
        <CalendarClock style={{ width: 14, height: 14, flexShrink: 0 }} /> Agendar Visita
      </button>
      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.btn} style={btnEstilo}>
          <MessageCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> WhatsApp
        </a>
      )}
      {emailHref && (
        <a href={emailHref} className={styles.btn} style={btnEstilo}>
          <Mail style={{ width: 14, height: 14, flexShrink: 0 }} /> Email
        </a>
      )}
    </div>
  )
}

export default AcoesRapidas

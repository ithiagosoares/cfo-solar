// Config compartilhada de ícones/cores/urgência de atividades. Puro (sem
// supabaseAdmin) — seguro para importar em componentes 'use client'. Mesmo
// padrão de status-pedido-config.ts.

import {
  PhoneCall, Mail, MapPin, Users, MessageSquare, MessageCircle, MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import type { TipoAtividade, ResultadoAtividade } from './atividades-repository'

// Re-exportados daqui pra componentes 'use client' terem uma única fonte
// client-safe (valores + tipos) e nunca precisarem importar de
// atividades-repository.ts, que puxa supabaseAdmin — ver histórico do bug
// "erro vem do browser" (import de valor de arquivo server-only vaza
// credenciais pro bundle do cliente).
export type { TipoAtividade, ResultadoAtividade }

export const TIPOS_ATIVIDADE: readonly TipoAtividade[] =
  ['Ligação', 'Email', 'Visita', 'Reunião', 'SMS', 'WhatsApp', 'Outro']

// Resultados válidos por tipo — ex: "Ligação" nunca aceita "Não Contactado"
// (se foi registrada como ligação, é porque houve contato). Fonte única de
// verdade tanto pro <select> de resultado (front) quanto pra validação do
// POST/PATCH (back) — nunca duplicar essa lista em outro lugar.
export const RESULTADOS_POR_TIPO: Record<TipoAtividade, readonly ResultadoAtividade[]> = {
  'Ligação':  ['Contactado', 'Interessado', 'Não Interessado', 'Agendado', 'Cancelado'],
  'Email':    ['Enviado', 'Respondido', 'Não Respondido'],
  'Visita':   ['Realizado', 'Cancelado', 'Reagendado'],
  'Reunião':  ['Confirmada', 'Cancelada', 'Reagendada'],
  'SMS':      ['Enviado', 'Respondido'],
  'WhatsApp': ['Enviado', 'Respondido'],
  'Outro':    ['Concluído', 'Cancelado'],
}

// União de todos os resultados aceitos numa gravação nova — 'Não Contactado'
// fica de fora (nenhum tipo o oferece mais), mas continua um valor válido do
// tipo TS/da constraint do banco só pra exibir registros antigos.
export const RESULTADOS_ATIVIDADE: readonly ResultadoAtividade[] =
  [...new Set(Object.values(RESULTADOS_POR_TIPO).flat())]

export function resultadoValidoParaTipo(tipo: TipoAtividade, resultado: ResultadoAtividade): boolean {
  return RESULTADOS_POR_TIPO[tipo].includes(resultado)
}

interface CorPar {
  bg: string
  fg: string
}

// Reaproveita a paleta já usada em status-pedido-config.ts onde dá (info,
// positivo, destaque, pendente); os 2 pares extras (Email/WhatsApp) seguem a
// mesma família visual (bg suave + fg saturado) já que não há tokens prontos
// pra 7 categorias distintas.
export const TIPO_CONFIG: Record<TipoAtividade, CorPar & { icon: LucideIcon }> = {
  'Ligação': { icon: PhoneCall,       bg: '#E3EAF0', fg: '#3A6080' }, // azul-petróleo
  'Email':   { icon: Mail,            bg: '#EDE7F3', fg: '#5A4070' }, // roxo (--fornecedor)
  'Visita':  { icon: MapPin,          bg: '#F3E4CC', fg: '#8C5A1D' }, // âmbar
  'Reunião': { icon: Users,           bg: '#EDF3F1', fg: '#3E6B63' }, // verde
  'SMS':     { icon: MessageSquare,   bg: '#F3ECD9', fg: '#A07830' }, // dourado
  'WhatsApp':{ icon: MessageCircle,   bg: '#DCEAE5', fg: '#1F4A40' }, // verde escuro
  'Outro':   { icon: MoreHorizontal,  bg: '#F3F4F6', fg: '#6B7280' }, // cinza
}

export const RESULTADO_CONFIG: Record<ResultadoAtividade, CorPar> = {
  'Contactado':       { bg: '#EDF3F1', fg: '#3E6B63' }, // verde
  'Não Contactado':   { bg: '#F3F4F6', fg: '#6B7280' }, // cinza (legado, não oferecido mais)
  'Interessado':      { bg: '#DCEAE5', fg: '#1F4A40' }, // verde escuro
  'Não Interessado':  { bg: '#FAEDEA', fg: '#A8452F' }, // vermelho
  'Agendado':         { bg: '#E3EAF0', fg: '#3A6080' }, // azul-petróleo
  'Cancelado':        { bg: '#FAEDEA', fg: '#A8452F' }, // vermelho
  'Enviado':          { bg: '#E3EAF0', fg: '#3A6080' }, // azul-petróleo
  'Respondido':       { bg: '#EDF3F1', fg: '#3E6B63' }, // verde
  'Não Respondido':   { bg: '#F3F4F6', fg: '#6B7280' }, // cinza
  'Realizado':        { bg: '#EDF3F1', fg: '#3E6B63' }, // verde
  'Reagendado':       { bg: '#F3ECD9', fg: '#A07830' }, // dourado
  'Confirmada':       { bg: '#EDF3F1', fg: '#3E6B63' }, // verde
  'Cancelada':        { bg: '#FAEDEA', fg: '#A8452F' }, // vermelho
  'Reagendada':       { bg: '#F3ECD9', fg: '#A07830' }, // dourado
  'Concluído':        { bg: '#DCEAE5', fg: '#1F4A40' }, // verde escuro
}

export type Urgencia = 'hoje' | 'amanha' | 'semana' | 'longe'

export const URGENCIA_CONFIG: Record<Urgencia, CorPar & { label: string }> = {
  hoje:   { bg: '#FAEDEA', fg: '#A8452F', label: 'Hoje' },      // vermelho
  amanha: { bg: '#FEF3C7', fg: '#B45309', label: 'Amanhã' },    // laranja
  semana: { bg: '#FEF9C3', fg: '#854D0E', label: 'Esta semana' }, // amarelo
  longe:  { bg: '#F3F4F6', fg: '#6B7280', label: 'Mais tarde' }, // cinza
}

// dataAgendada em 'YYYY-MM-DD'. Atrasado (no passado) conta como 'hoje' —
// mesma urgência máxima, nunca deve ficar cinza por estar vencido.
export function calcularUrgencia(dataAgendada: string): Urgencia {
  const hoje = new Date().toISOString().slice(0, 10)
  const diasAte = Math.round(
    (new Date(`${dataAgendada}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) / 86400000,
  )
  if (diasAte <= 0) return 'hoje'
  if (diasAte === 1) return 'amanha'
  if (diasAte <= 7) return 'semana'
  return 'longe'
}

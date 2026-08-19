// Config compartilhada de cores/labels para etapa_funil e status_venda de comercial_pedidos.
// Puro (sem supabaseAdmin) — seguro para importar em componentes 'use client'.
// Valores devem ficar em sincronia com os CHECK constraints da tabela (ver supabase/schema.sql)
// e com os tipos EtapaFunil/StatusVenda em comercial-pedidos-repository.ts.

export interface StatusOption {
  value: string
  label: string
  bg: string
  fg: string
}

export const ETAPA_FUNIL_OPCOES: StatusOption[] = [
  { value: 'Novo',                label: 'Novo',                bg: '#F3E4CC', fg: '#8C5A1D' }, // âmbar
  { value: 'Em contato',          label: 'Em contato',          bg: '#E3EAF0', fg: '#3A6080' }, // azul-petróleo
  { value: 'Negociação',          label: 'Negociação',          bg: '#FEF3C7', fg: '#B45309' },
  { value: 'Aguardando decisão',  label: 'Aguardando decisão',  bg: '#F3F4F6', fg: '#6B7280' },
  { value: 'Fechado',             label: 'Fechado',             bg: '#EDF3F1', fg: '#3E6B63' }, // verde
  { value: 'Perdido',             label: 'Perdido',             bg: '#FAEDEA', fg: '#A8452F' }, // vermelho
]

export const STATUS_VENDA_OPCOES: StatusOption[] = [
  { value: 'Venda Fechada',                label: 'Venda Fechada',                bg: '#E3EAF0', fg: '#3A6080' }, // azul-petróleo
  { value: 'Faturamento Pendente',         label: 'Faturamento Pendente',         bg: '#F3E4CC', fg: '#8C5A1D' }, // âmbar
  { value: 'Aguardando emissão de NF',     label: 'Aguardando emissão de NF',     bg: '#FEF3C7', fg: '#B45309' }, // âmbar
  { value: 'Faturado',                     label: 'Faturado',                     bg: '#E3EAF0', fg: '#3A6080' }, // azul
  { value: 'Entregue',                     label: 'Entregue',                     bg: '#EDF3F1', fg: '#3E6B63' }, // verde
  { value: 'Problema Reportado',           label: 'Problema Reportado',           bg: '#FAEDEA', fg: '#A8452F' }, // vermelho
  { value: 'Pós-venda Concluído',          label: 'Pós-venda Concluído',          bg: '#DCEAE5', fg: '#1F4A40' }, // verde escuro
]

export function opcaoPorValor(opcoes: StatusOption[], valor: string): StatusOption | undefined {
  return opcoes.find(o => o.value === valor)
}

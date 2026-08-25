// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'comercial_pedidos_itens'

export interface ItemPedido {
  id: string
  pedidoId: string
  codigo: string | null
  descricao: string
  quantidade: number
  unidade: string | null
  valorUnitario: number
  valorTotal: number
}

export interface DadosItemPedido {
  codigo: string | null
  descricao: string
  quantidade: number
  unidade: string | null
  valorUnitario: number
  valorTotal: number
}

interface ItemPedidoRow {
  id: string
  comercial_pedido_id: string
  codigo: string | null
  descricao: string
  quantidade: number
  unidade: string | null
  valor_unitario: number
  valor_total: number
}

function mapearLinha(row: ItemPedidoRow): ItemPedido {
  return {
    id: row.id,
    pedidoId: row.comercial_pedido_id,
    codigo: row.codigo,
    descricao: row.descricao,
    quantidade: row.quantidade,
    unidade: row.unidade,
    valorUnitario: row.valor_unitario,
    valorTotal: row.valor_total,
  }
}

export async function listarItensPedido(pedidoId: string): Promise<ItemPedido[]> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('*')
    .eq('comercial_pedido_id', pedidoId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Falha ao listar itens do pedido: ${error.message}`)
  return (data ?? []).map(row => mapearLinha(row as ItemPedidoRow))
}

// Substitui todos os itens de um pedido pelos novos — idempotente, permite
// reprocessar o mesmo PDF ou corrigir o vínculo sem gerar duplicatas.
export async function substituirItensPedido(pedidoId: string, itens: DadosItemPedido[]): Promise<void> {
  const { error: erroDelete } = await supabaseAdmin
    .from(TABELA)
    .delete()
    .eq('comercial_pedido_id', pedidoId)
  if (erroDelete) throw new Error(`Falha ao limpar itens anteriores do pedido: ${erroDelete.message}`)

  if (itens.length === 0) return

  const rows = itens.map(i => ({
    comercial_pedido_id: pedidoId,
    codigo:              i.codigo,
    descricao:           i.descricao,
    quantidade:          i.quantidade,
    unidade:             i.unidade,
    valor_unitario:      i.valorUnitario,
    valor_total:         i.valorTotal,
  }))

  const { error } = await supabaseAdmin.from(TABELA).insert(rows)
  if (error) throw new Error(`Falha ao inserir itens do pedido: ${error.message}`)
}

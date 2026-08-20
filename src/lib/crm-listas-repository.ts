// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
// Listas do Kanban de Clientes, no modelo Trello: usuário cria, renomeia,
// reordena e arquiva. posicao é numeric — reordenar calcula a média entre
// os vizinhos em vez de reindexar tudo a cada drag.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'crm_listas'

export interface ListaCrm {
  id: string
  nome: string
  cor: string
  posicao: number
  arquivado: boolean
}

interface ListaCrmRow {
  id: string
  nome: string
  cor: string
  posicao: number
  arquivado: boolean
}

function mapearLinha(row: ListaCrmRow): ListaCrm {
  return { id: row.id, nome: row.nome, cor: row.cor, posicao: row.posicao, arquivado: row.arquivado }
}

export async function listarListas(incluirArquivadas = false): Promise<ListaCrm[]> {
  let query = supabaseAdmin
    .from(TABELA)
    .select('id, nome, cor, posicao, arquivado')
    .order('posicao', { ascending: true })

  if (!incluirArquivadas) query = query.eq('arquivado', false)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar listas: ${error.message}`)
  return (data ?? []).map(row => mapearLinha(row as ListaCrmRow))
}

// Nova lista entra sempre no final (maior posicao + 1000).
export async function criarLista(nome: string, cor: string): Promise<ListaCrm> {
  if (!nome.trim()) throw new Error('Nome da lista é obrigatório')

  const { data: ultima } = await supabaseAdmin
    .from(TABELA)
    .select('posicao')
    .order('posicao', { ascending: false })
    .limit(1)
    .maybeSingle()

  const posicao = ((ultima as { posicao: number } | null)?.posicao ?? 0) + 1000

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .insert({ nome: nome.trim(), cor, posicao })
    .select('id, nome, cor, posicao, arquivado')
    .single()

  if (error) throw new Error(`Falha ao criar lista: ${error.message}`)
  return mapearLinha(data as ListaCrmRow)
}

export interface DadosAtualizacaoLista {
  nome?: string
  cor?: string
  posicao?: number
  arquivado?: boolean
}

export async function atualizarLista(id: string, dados: DadosAtualizacaoLista): Promise<ListaCrm> {
  const patch: Record<string, unknown> = {}
  if (dados.nome      !== undefined) patch.nome      = dados.nome.trim()
  if (dados.cor       !== undefined) patch.cor       = dados.cor
  if (dados.posicao   !== undefined) patch.posicao   = dados.posicao
  if (dados.arquivado !== undefined) patch.arquivado = dados.arquivado

  if (Object.keys(patch).length === 0) throw new Error('Nenhum campo para atualizar')

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .update(patch)
    .eq('id', id)
    .select('id, nome, cor, posicao, arquivado')
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new Error('Lista não encontrada')
    throw new Error(`Falha ao atualizar lista: ${error.message}`)
  }
  return mapearLinha(data as ListaCrmRow)
}

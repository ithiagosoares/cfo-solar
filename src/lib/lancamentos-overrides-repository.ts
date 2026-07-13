// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'lancamentos_overrides'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface LancamentoOverrideRow {
  id: string
  periodo: string
  empresa: string | null
  data_lancamento: string
  descricao_original: string
  valor: number
  categoria_original: string | null
  categoria_corrigida: string
  natureza_corrigida: string | null
  motivo: string | null
  criado_por: string | null
  created_at: string
}

export interface LancamentoOverride {
  id: string
  periodo: string
  empresa: string | null
  dataLancamento: string
  descricaoOriginal: string
  valor: number
  categoriaOriginal: string | null
  categoriaCorrigida: string
  naturezaCorrigida: string | null
  motivo: string | null
  criadoPor: string | null
  criadoEm: string
}

export interface NovoOverride {
  periodo: string
  empresa?: string | null
  dataLancamento: string
  descricaoOriginal: string
  valor: number
  categoriaOriginal?: string | null
  categoriaCorrigida: string
  naturezaCorrigida?: string | null
  motivo?: string | null
  criadoPor?: string | null
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapearLinha(row: LancamentoOverrideRow): LancamentoOverride {
  return {
    id: row.id,
    periodo: row.periodo,
    empresa: row.empresa,
    dataLancamento: row.data_lancamento,
    descricaoOriginal: row.descricao_original,
    valor: row.valor,
    categoriaOriginal: row.categoria_original,
    categoriaCorrigida: row.categoria_corrigida,
    naturezaCorrigida: row.natureza_corrigida,
    motivo: row.motivo,
    criadoPor: row.criado_por,
    criadoEm: row.created_at,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listarOverrides(periodo: string): Promise<LancamentoOverride[]> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('*')
    .eq('periodo', periodo)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Falha ao listar overrides do período ${periodo}: ${error.message}`)
  }

  return (data ?? []).map(row => mapearLinha(row as LancamentoOverrideRow))
}

export async function criarOverride(dados: NovoOverride): Promise<LancamentoOverride> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .insert({
      periodo: dados.periodo,
      empresa: dados.empresa ?? null,
      data_lancamento: dados.dataLancamento,
      descricao_original: dados.descricaoOriginal,
      valor: dados.valor,
      categoria_original: dados.categoriaOriginal ?? null,
      categoria_corrigida: dados.categoriaCorrigida,
      natureza_corrigida: dados.naturezaCorrigida ?? null,
      motivo: dados.motivo ?? null,
      criado_por: dados.criadoPor ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[lancamentos-overrides-repository] criarOverride erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao criar override: ${error.message}`)
  }

  return mapearLinha(data as LancamentoOverrideRow)
}

export async function removerOverride(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABELA)
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[lancamentos-overrides-repository] removerOverride erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao remover override ${id}: ${error.message}`)
  }
}

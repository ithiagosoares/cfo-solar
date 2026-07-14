// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'vendedores'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface VendedorRow {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

export interface Vendedor {
  id: string
  nome: string
  ativo: boolean
  criadoEm: string
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapearLinha(row: VendedorRow): Vendedor {
  return {
    id: row.id,
    nome: row.nome,
    ativo: row.ativo,
    criadoEm: row.created_at,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listarVendedores(apenasAtivos = true): Promise<Vendedor[]> {
  let query = supabaseAdmin.from(TABELA).select('*').order('nome')
  if (apenasAtivos) query = query.eq('ativo', true)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar vendedores: ${error.message}`)

  return (data ?? []).map(row => mapearLinha(row as VendedorRow))
}

export async function criarVendedor(nome: string): Promise<Vendedor> {
  const nomeNorm = nome.trim()

  const { data: existente } = await supabaseAdmin
    .from(TABELA)
    .select('id')
    .ilike('nome', nomeNorm)
    .maybeSingle()

  if (existente) throw new Error(`Vendedor "${nomeNorm}" já existe.`)

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .insert({ nome: nomeNorm })
    .select()
    .single()

  if (error) {
    console.error('[vendedores-repository] criarVendedor erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao criar vendedor: ${error.message}`)
  }

  return mapearLinha(data as VendedorRow)
}

export async function atualizarVendedor(
  id: string,
  dados: { nome?: string; ativo?: boolean },
): Promise<Vendedor> {
  const patch: Record<string, unknown> = {}
  if (dados.nome !== undefined) patch.nome = dados.nome.trim()
  if (dados.ativo !== undefined) patch.ativo = dados.ativo

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[vendedores-repository] atualizarVendedor erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao atualizar vendedor: ${error.message}`)
  }

  return mapearLinha(data as VendedorRow)
}

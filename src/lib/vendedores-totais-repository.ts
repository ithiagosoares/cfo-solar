// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
// Tabela: vendedores_totais_oficiais
// Fonte de verdade para totais de venda por vendedor, extraída de relatórios ERP agregados.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'vendedores_totais_oficiais'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FonteTotalOficial = 'total_venda_vendedor' | 'rentabilidade_vendedor'

export interface TotalOficialInput {
  vendedorId:        string
  periodoInicio:     string  // ISO date 'YYYY-MM-DD'
  periodoFim:        string
  valorTotalOficial: number
  quantidadeVendas?: number | null
  fonte:             FonteTotalOficial
  filial:            string | null
  importacaoId:      string | null
}

export interface TotalOficial {
  vendedorId:        string
  vendedorNome:      string
  periodoInicio:     string
  periodoFim:        string
  valorTotalOficial: number
  quantidadeVendas:  number | null
  fonte:             FonteTotalOficial
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// Upserta totais. Conflito na constraint (vendedor_id, periodo_inicio, periodo_fim, fonte, filial) → atualiza.
export async function upsertTotaisOficiais(totais: TotalOficialInput[]): Promise<void> {
  if (totais.length === 0) return

  for (const t of totais) {
    console.log(`[upsert-totais] vendedor_id: ${t.vendedorId} | fonte: ${t.fonte} | filial: ${t.filial ?? 'null'} | periodo: ${t.periodoInicio}→${t.periodoFim} | valor: ${t.valorTotalOficial}`)
  }

  const { error } = await supabaseAdmin
    .from(TABELA)
    .upsert(
      totais.map(t => ({
        vendedor_id:         t.vendedorId,
        periodo_inicio:      t.periodoInicio,
        periodo_fim:         t.periodoFim,
        valor_total_oficial: t.valorTotalOficial,
        quantidade_vendas:   t.quantidadeVendas ?? null,
        fonte:               t.fonte,
        filial:              t.filial,
        importacao_id:       t.importacaoId,
      })),
      { onConflict: 'vendedor_id,periodo_inicio,periodo_fim,fonte,filial' },
    )

  if (error) {
    console.error('[vendedores-totais-repository] upsert erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao persistir totais oficiais: ${error.message}`)
  }
}

// ─── Helpers de query ─────────────────────────────────────────────────────────

type Row = {
  vendedor_id:         string
  periodo_inicio:      string
  periodo_fim:         string
  valor_total_oficial: number
  quantidade_vendas:   number | null
  fonte:               string
  // Supabase pode retornar o join como objeto ou array dependendo da versão do client
  vendedores:          { nome: string } | { nome: string }[] | null
}

function mapearRow(row: Row): TotalOficial {
  return {
    vendedorId:        row.vendedor_id,
    vendedorNome:      Array.isArray(row.vendedores)
                         ? (row.vendedores[0]?.nome ?? '')
                         : (row.vendedores?.nome ?? ''),
    periodoInicio:     row.periodo_inicio,
    periodoFim:        row.periodo_fim,
    valorTotalOficial: row.valor_total_oficial,
    quantidadeVendas:  row.quantidade_vendas,
    fonte:             row.fonte as FonteTotalOficial,
  }
}

// Busca totais para um período EXATO (periodo_inicio = X AND periodo_fim = Y).
// Usado pela página de vendas e pela coluna TOTAL do Dashboard.
export async function buscarTotaisOficiais(
  periodoInicio: string,
  periodoFim:    string,
  vendedorId?:   string,
): Promise<TotalOficial[]> {
  let query = supabaseAdmin
    .from(TABELA)
    .select('vendedor_id, periodo_inicio, periodo_fim, valor_total_oficial, quantidade_vendas, fonte, vendedores(nome)')
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fim', periodoFim)

  if (vendedorId) query = query.eq('vendedor_id', vendedorId)

  const { data, error } = await query

  if (error) {
    console.error('[vendedores-totais-repository] buscar erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao buscar totais oficiais: ${error.message}`)
  }

  return (data ?? []).map(row => mapearRow(row as Row))
}

// Busca TODOS os registros cujo período está CONTIDO dentro do range informado
// (periodo_inicio >= X AND periodo_fim <= Y). Retorna tanto registros exatos como
// sub-períodos mensais. Usado pelo Dashboard para enriquecer células mensais.
export async function buscarTotaisOficiaisMensais(
  periodoInicio: string,
  periodoFim:    string,
  vendedorId?:   string,
): Promise<TotalOficial[]> {
  let query = supabaseAdmin
    .from(TABELA)
    .select('vendedor_id, periodo_inicio, periodo_fim, valor_total_oficial, quantidade_vendas, fonte, vendedores(nome)')
    .gte('periodo_inicio', periodoInicio)
    .lte('periodo_fim', periodoFim)

  if (vendedorId) query = query.eq('vendedor_id', vendedorId)

  const { data, error } = await query

  if (error) {
    console.error('[vendedores-totais-repository] buscarMensais erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao buscar totais oficiais mensais: ${error.message}`)
  }

  return (data ?? []).map(row => mapearRow(row as Row))
}

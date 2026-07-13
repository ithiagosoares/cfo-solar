// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'investimentos_capex'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TipoParcela = 'mensal_recorrente' | 'parcelado' | 'sem_parcelamento'
export type StatusInvestimento = 'em_andamento' | 'concluido' | 'cancelado'

interface InvestimentoCapexRow {
  id: string
  nome: string
  empresa: string | null
  tipo_parcela: TipoParcela
  valor_parcela: number | null
  parcela_atual: number | null
  total_parcelas: number | null
  termino_previsto: string | null
  status: StatusInvestimento
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface InvestimentoCapex {
  id: string
  nome: string
  empresa: string | null
  tipoParcela: TipoParcela
  valorParcela: number | null
  parcelaAtual: number | null
  totalParcelas: number | null
  terminoPrevisto: string | null
  status: StatusInvestimento
  observacoes: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface NovoInvestimento {
  nome: string
  empresa?: string | null
  tipoParcela: TipoParcela
  valorParcela?: number | null
  parcelaAtual?: number | null
  totalParcelas?: number | null
  terminoPrevisto?: string | null
  status?: StatusInvestimento
  observacoes?: string | null
}

export type AtualizacaoInvestimento = Partial<NovoInvestimento>

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapearLinha(row: InvestimentoCapexRow): InvestimentoCapex {
  return {
    id: row.id,
    nome: row.nome,
    empresa: row.empresa,
    tipoParcela: row.tipo_parcela,
    valorParcela: row.valor_parcela,
    parcelaAtual: row.parcela_atual,
    totalParcelas: row.total_parcelas,
    terminoPrevisto: row.termino_previsto,
    status: row.status,
    observacoes: row.observacoes,
    criadoEm: row.created_at,
    atualizadoEm: row.updated_at,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listarInvestimentos(
  filtroStatus?: StatusInvestimento,
): Promise<InvestimentoCapex[]> {
  let query = supabaseAdmin
    .from(TABELA)
    .select('*')
    .order('created_at', { ascending: true })

  if (filtroStatus) {
    query = query.eq('status', filtroStatus)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Falha ao listar investimentos CAPEX: ${error.message}`)
  }

  return (data ?? []).map(row => mapearLinha(row as InvestimentoCapexRow))
}

export async function criarInvestimento(dados: NovoInvestimento): Promise<InvestimentoCapex> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .insert({
      nome: dados.nome,
      empresa: dados.empresa ?? null,
      tipo_parcela: dados.tipoParcela,
      valor_parcela: dados.valorParcela ?? null,
      parcela_atual: dados.parcelaAtual ?? null,
      total_parcelas: dados.totalParcelas ?? null,
      termino_previsto: dados.terminoPrevisto ?? null,
      status: dados.status ?? 'em_andamento',
      observacoes: dados.observacoes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[investimentos-capex-repository] criarInvestimento erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao criar investimento CAPEX: ${error.message}`)
  }

  return mapearLinha(data as InvestimentoCapexRow)
}

export async function atualizarInvestimento(
  id: string,
  dados: AtualizacaoInvestimento,
): Promise<InvestimentoCapex> {
  const campos: Partial<InvestimentoCapexRow> = { updated_at: new Date().toISOString() }

  if (dados.nome !== undefined)           campos.nome = dados.nome
  if (dados.empresa !== undefined)        campos.empresa = dados.empresa ?? null
  if (dados.tipoParcela !== undefined)    campos.tipo_parcela = dados.tipoParcela
  if (dados.valorParcela !== undefined)   campos.valor_parcela = dados.valorParcela ?? null
  if (dados.parcelaAtual !== undefined)   campos.parcela_atual = dados.parcelaAtual ?? null
  if (dados.totalParcelas !== undefined)  campos.total_parcelas = dados.totalParcelas ?? null
  if (dados.terminoPrevisto !== undefined) campos.termino_previsto = dados.terminoPrevisto ?? null
  if (dados.status !== undefined)         campos.status = dados.status
  if (dados.observacoes !== undefined)    campos.observacoes = dados.observacoes ?? null

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[investimentos-capex-repository] atualizarInvestimento erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao atualizar investimento CAPEX ${id}: ${error.message}`)
  }

  return mapearLinha(data as InvestimentoCapexRow)
}

export async function removerInvestimento(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABELA)
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[investimentos-capex-repository] removerInvestimento erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao remover investimento CAPEX ${id}: ${error.message}`)
  }
}

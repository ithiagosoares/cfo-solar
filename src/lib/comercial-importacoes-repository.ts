// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'
import type { Divergencia } from './comercial-validacao'

export type { Divergencia }

const TABELA = 'comercial_importacoes'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ArquivoProcessado {
  nome: string
  tipo: string
}

export interface RegistroPreview {
  vendedorId: string | null
  vendedorNome: string
  vendedorReconhecido: boolean
  empresa: string
  filial: string
  cliente: string
  valorOrcado: number
  dataOrcamento: string
  status: 'orcado' | 'vendido'
  valorVendido: number | null
  // data_venda é assumida igual à data de emissão do orçamento quando status = 'vendido',
  // pois o relatório da Upper não expõe uma coluna de data de fechamento separada.
  // É uma aproximação documentada — não representa a data exata da venda.
  dataVenda: string | null
  origem: 'upload_estruturado'
  numeroOrcamento: string
}

export interface NovaImportacao {
  empresa: string
  filial: string
  arquivosProcessados: ArquivoProcessado[]
  totalRegistros: number
  divergencias: Divergencia[]
  vendedoresNaoReconhecidos: string[]
  registrosPreview: RegistroPreview[]
}

// Espelho das colunas reais da tabela (snake_case).
// Nomes confirmados contra o banco em 2026-07-15:
//   arquivos (não arquivos_processados), registros_total (não total_registros),
//   confirmado_at (não confirmado_em), registros_preview (adicionada via ALTER TABLE).
interface ImportacaoRow {
  id: string
  status: string
  empresa: string | null
  filial: string | null
  arquivos: ArquivoProcessado[]
  registros_total: number
  divergencias: Divergencia[]
  vendedores_nao_reconhecidos: string[]
  registros_preview: RegistroPreview[]
  created_at: string
  confirmado_at: string | null
}

export interface ComercialImportacao {
  id: string
  status: string
  empresa: string | null
  filial: string | null
  arquivosProcessados: ArquivoProcessado[]
  totalRegistros: number
  divergencias: Divergencia[]
  vendedoresNaoReconhecidos: string[]
  registrosPreview: RegistroPreview[]
  criadoEm: string
  confirmadoEm: string | null
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapearLinha(row: ImportacaoRow): ComercialImportacao {
  return {
    id: row.id,
    status: row.status,
    empresa: row.empresa,
    filial: row.filial,
    arquivosProcessados: row.arquivos,
    totalRegistros: row.registros_total,
    divergencias: row.divergencias,
    vendedoresNaoReconhecidos: row.vendedores_nao_reconhecidos,
    registrosPreview: row.registros_preview,
    criadoEm: row.created_at,
    confirmadoEm: row.confirmado_at,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function criarImportacao(dados: NovaImportacao): Promise<ComercialImportacao> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .insert({
      empresa: dados.empresa,
      filial: dados.filial,
      arquivos: dados.arquivosProcessados,
      registros_total: dados.totalRegistros,
      divergencias: dados.divergencias,
      vendedores_nao_reconhecidos: dados.vendedoresNaoReconhecidos,
      registros_preview: dados.registrosPreview,
    })
    .select()
    .single()

  if (error) {
    console.error('[comercial-importacoes-repository] criarImportacao erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao registrar importação: ${error.message}`)
  }

  return mapearLinha(data as ImportacaoRow)
}

export async function buscarImportacao(id: string): Promise<ComercialImportacao> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`Importação ${id} não encontrada: ${error.message}`)

  return mapearLinha(data as ImportacaoRow)
}

export async function atualizarStatusImportacao(
  id: string,
  status: 'confirmado' | 'descartado',
): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABELA)
    .update({
      status,
      confirmado_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[comercial-importacoes-repository] atualizarStatus erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao atualizar status da importação: ${error.message}`)
  }
}

import { supabaseAdmin } from './supabase-admin'
import type { DadosAgregados } from './excel-aggregator'
import type { RelatorioCompleto } from '@/types/financeiro'

export type AnaliseIA = RelatorioCompleto['analise']

const TABELA = 'relatorios_mensais'

interface LinhaRelatorio {
  periodo: string
  faturamento_vendido: number
  faturamento_faturado: number
  total_entradas: number
  total_saidas: number
  saldo_grupo: number
  dados_completos: DadosAgregados
  analise: AnaliseIA
  criado_em: string
  atualizado_em: string
}

export interface RelatorioSalvo {
  periodo: string
  faturamentoVendido: number
  faturamentoFaturado: number
  totalEntradas: number
  totalSaidas: number
  saldoGrupo: number
  dadosCompletos: DadosAgregados
  analise: AnaliseIA
  criadoEm: string
  atualizadoEm: string
}

export interface RelatorioResumo {
  periodo: string
  faturamentoVendido: number
  faturamentoFaturado: number
  totalEntradas: number
  totalSaidas: number
  saldoGrupo: number
  criadoEm: string
  atualizadoEm: string
}

function mapearLinha(linha: LinhaRelatorio): RelatorioSalvo {
  return {
    periodo: linha.periodo,
    faturamentoVendido: linha.faturamento_vendido,
    faturamentoFaturado: linha.faturamento_faturado,
    totalEntradas: linha.total_entradas,
    totalSaidas: linha.total_saidas,
    saldoGrupo: linha.saldo_grupo,
    dadosCompletos: linha.dados_completos,
    analise: linha.analise,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  }
}

export async function salvarRelatorio(periodo: string, dados: DadosAgregados, analise: AnaliseIA): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABELA)
    .upsert(
      {
        periodo,
        faturamento_vendido: dados.faturamento.vendido,
        faturamento_faturado: dados.faturamento.faturado,
        total_entradas: dados.consolidado.totalEntradas,
        total_saidas: dados.consolidado.totalSaidas,
        saldo_grupo: dados.consolidado.saldoGrupo,
        dados_completos: dados,
        analise,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'periodo' },
    )

  if (error) {
    console.error('[relatorios-repository] salvarRelatorio erro completo:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao salvar relatório no Supabase: ${error.message}`)
  }
}

export async function buscarRelatorioPorPeriodo(periodo: string): Promise<RelatorioSalvo | null> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('*')
    .eq('periodo', periodo)
    .maybeSingle()

  if (error) {
    throw new Error(`Falha ao buscar relatório do período ${periodo}: ${error.message}`)
  }
  if (!data) return null
  return mapearLinha(data as LinhaRelatorio)
}

export async function listarRelatorios(limite = 24): Promise<RelatorioResumo[]> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('periodo, faturamento_vendido, faturamento_faturado, total_entradas, total_saidas, saldo_grupo, criado_em, atualizado_em')
    .order('periodo', { ascending: false })
    .limit(limite)

  if (error) {
    throw new Error(`Falha ao listar relatórios: ${error.message}`)
  }

  return (data ?? []).map(linha => ({
    periodo: linha.periodo,
    faturamentoVendido: linha.faturamento_vendido,
    faturamentoFaturado: linha.faturamento_faturado,
    totalEntradas: linha.total_entradas,
    totalSaidas: linha.total_saidas,
    saldoGrupo: linha.saldo_grupo,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  }))
}

export async function buscarUltimosNMeses(n: number): Promise<RelatorioSalvo[]> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('*')
    .order('periodo', { ascending: false })
    .limit(n)

  if (error) {
    throw new Error(`Falha ao buscar últimos ${n} meses: ${error.message}`)
  }

  return (data ?? []).map(linha => mapearLinha(linha as LinhaRelatorio))
}

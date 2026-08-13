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
  filial:            string | null
  criadoEm:          string
}

// ─── Normalização de filial ───────────────────────────────────────────────────

// Mapeia variações e siglas para os dois valores canônicos aceitos pelo sistema.
// Garante que 'PR', 'pr', 'Parana' → 'Paraná' e 'SP', 'sp', 'Sao Paulo' → 'São Paulo'.
const FILIAL_NORMALIZACAO: Record<string, string> = {
  'sp':        'São Paulo',
  'sao paulo': 'São Paulo',
  'são paulo': 'São Paulo',
  'pr':        'Paraná',
  'parana':    'Paraná',
  'paraná':    'Paraná',
}

export function normalizarFilial(filial: string | null | undefined): string | null {
  if (!filial) return null
  const key = filial.toLowerCase().trim()
  return FILIAL_NORMALIZACAO[key] ?? filial
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// Upserta totais. Conflito na constraint (vendedor_id, periodo_inicio, periodo_fim, fonte, filial) → atualiza.
export async function upsertTotaisOficiais(totais: TotalOficialInput[]): Promise<void> {
  if (totais.length === 0) return

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
        filial:              normalizarFilial(t.filial),
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
  filial:              string | null
  created_at:          string
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
    filial:            row.filial ?? null,
    criadoEm:          row.created_at,
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
    .select('vendedor_id, periodo_inicio, periodo_fim, valor_total_oficial, quantidade_vendas, fonte, filial, created_at, vendedores(nome)')
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
    .select('vendedor_id, periodo_inicio, periodo_fim, valor_total_oficial, quantidade_vendas, fonte, filial, created_at, vendedores(nome)')
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

// ─── Agregação compartilhada (usada pelo Dashboard e pela tela /vendas) ───────

export interface AgregadoOficial {
  valorTotalOficial: number
  quantidadeVendas:  number | null
  fonte:             FonteTotalOficial
  vendedorId:        string
  vendedorNome:      string
}

// Remove registros sobrepostos causados por reimportações.
// Para cada grupo (vendedorNome, filial, fonte), ordena por criadoEm desc e descarta
// registros cujo período se sobreponha com um já mantido.
// Períodos genuinamente complementares (jan + fev) não se sobrepõem e são mantidos.
export function deduplicarTotaisOficiais(registros: TotalOficial[]): TotalOficial[] {
  const grupos = new Map<string, TotalOficial[]>()
  for (const r of registros) {
    const chave = `${r.vendedorNome}|||${r.filial ?? ''}|||${r.fonte}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(r)
  }

  const resultado: TotalOficial[] = []
  for (const [chave, grupo] of grupos) {
    if (grupo.length === 1) {
      resultado.push(grupo[0])
      continue
    }

    const ordenados = [...grupo].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    const mantidos: TotalOficial[] = []

    for (const rec of ordenados) {
      const sobrepoem = mantidos.some(
        m => m.periodoInicio <= rec.periodoFim && rec.periodoInicio <= m.periodoFim
      )
      if (sobrepoem) {
        console.warn(
          `[totais-oficiais] sobreposição detectada e ignorada: "${chave}" | ` +
          `${rec.periodoInicio}→${rec.periodoFim} (criadoEm: ${rec.criadoEm})`
        )
      } else {
        mantidos.push(rec)
      }
    }

    resultado.push(...mantidos)
  }

  return resultado
}

// Agrega totais oficiais em 3 passos, eliminando dupla contagem entre filiais:
//   1. Soma por (vendedorNome, filial, fonte)
//   2. Por (vendedorNome, filial), escolhe rentabilidade_vendedor > total_venda_vendedor
//   3. Soma os melhores valores de cada filial por vendedor
// A entrada deve ter sido passada por deduplicarTotaisOficiais antes.
export function agregarTotaisOficiaisPorNome(totais: TotalOficial[]): Map<string, AgregadoOficial> {
  // Step 1
  const porVendFilialFonte = new Map<string, AgregadoOficial>()
  for (const t of totais) {
    const chave = `${t.vendedorNome}|||${t.filial ?? ''}|||${t.fonte}`
    const existing = porVendFilialFonte.get(chave)
    if (!existing) {
      porVendFilialFonte.set(chave, {
        valorTotalOficial: t.valorTotalOficial,
        quantidadeVendas:  t.quantidadeVendas ?? null,
        fonte:             t.fonte,
        vendedorId:        t.vendedorId,
        vendedorNome:      t.vendedorNome,
      })
    } else {
      existing.valorTotalOficial += t.valorTotalOficial
      if (t.quantidadeVendas !== null) {
        existing.quantidadeVendas = (existing.quantidadeVendas ?? 0) + t.quantidadeVendas
      }
    }
  }

  // Step 2
  const candidatosPorFilial = new Map<string, AgregadoOficial[]>()
  for (const [chave, ag] of porVendFilialFonte) {
    const partes    = chave.split('|||')
    const filialKey = `${partes[0]}|||${partes[1]}`
    if (!candidatosPorFilial.has(filialKey)) candidatosPorFilial.set(filialKey, [])
    candidatosPorFilial.get(filialKey)!.push(ag)
  }

  const melhorPorFilial = new Map<string, AgregadoOficial>()
  for (const [filialKey, candidatos] of candidatosPorFilial) {
    if (candidatos.length > 1) {
      const fontes = candidatos.map(c => c.fonte).join(', ')
      console.warn(`[totais-oficiais] múltiplas fontes para filial "${filialKey}": [${fontes}] — usando rentabilidade_vendedor`)
    }
    const rentab = candidatos.find(c => c.fonte === 'rentabilidade_vendedor')
    melhorPorFilial.set(filialKey, rentab ?? candidatos[0])
  }

  // Step 3
  const porNome = new Map<string, AgregadoOficial>()
  for (const [, ag] of melhorPorFilial) {
    const existing = porNome.get(ag.vendedorNome)
    if (!existing) {
      porNome.set(ag.vendedorNome, { ...ag })
    } else {
      existing.valorTotalOficial += ag.valorTotalOficial
      if (ag.quantidadeVendas !== null) {
        existing.quantidadeVendas = (existing.quantidadeVendas ?? 0) + ag.quantidadeVendas
      }
      if (ag.fonte === 'rentabilidade_vendedor') existing.fonte = 'rentabilidade_vendedor'
    }
  }

  return porNome
}

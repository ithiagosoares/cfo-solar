// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
//
// Todas as funções são determinísticas: nenhuma chamada à API de IA.
// Filtros comuns: periodo { inicio, fim }, empresa?, filial?

import { supabaseAdmin } from './supabase-admin'

// ─── Tipos de filtro ──────────────────────────────────────────────────────────

export interface PeriodoFiltro {
  inicio: string  // ISO date: '2026-01-01'
  fim:    string  // ISO date: '2026-01-31'
}

export interface FiltrosComerciais {
  empresa?: string
  filial?:  string
}

// ─── Tipo base de row retornado do banco ──────────────────────────────────────

interface PedidoRow {
  id:             string
  vendedor_id:    string | null
  empresa:        string | null
  filial:         string | null
  cliente:        string
  valor_orcado:   number
  data_orcamento: string | null
  status:         'orcado' | 'vendido'
  valor_vendido:  number | null
  data_venda:     string | null
  proxima_acao:     string | null
  previsao_fechamento: string | null
  vendedores:     { nome: string } | null
}

// ─── Query base ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000

// Busca todos os pedidos do período em lotes de PAGE_SIZE para nunca truncar.
// O loop termina quando um lote retorna menos de PAGE_SIZE linhas — sinal de
// que chegamos ao fim, independente do volume total.
async function buscarPedidos(
  periodo: PeriodoFiltro,
  filtros: FiltrosComerciais,
): Promise<PedidoRow[]> {
  const todos: PedidoRow[] = []
  let from = 0

  while (true) {
    let query = supabaseAdmin
      .from('comercial_pedidos')
      .select('*, vendedores(nome)')
      .gte('data_orcamento', periodo.inicio)
      .lte('data_orcamento', periodo.fim)
      .range(from, from + PAGE_SIZE - 1)

    if (filtros.empresa) query = query.eq('empresa', filtros.empresa)
    if (filtros.filial)  query = query.eq('filial',  filtros.filial)

    const { data, error } = await query

    if (error) {
      console.error('[comercial-indicadores] buscarPedidos erro:', JSON.stringify(error, null, 2))
      throw new Error(`Falha ao buscar pedidos: ${error.message}`)
    }

    const lote = (data ?? []) as PedidoRow[]
    todos.push(...lote)
    if (lote.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return todos
}

// ─── Utilitários de data ──────────────────────────────────────────────────────

// Retorna 'semana' quando o período for ≤ 60 dias, 'mes' caso contrário.
function granularidadePeriodo(periodo: PeriodoFiltro): 'semana' | 'mes' {
  const diff =
    (new Date(periodo.fim).getTime() - new Date(periodo.inicio).getTime()) /
    (1000 * 60 * 60 * 24)
  return diff <= 60 ? 'semana' : 'mes'
}

// Retorna a label do sub-período para uma data ISO conforme a granularidade.
// Ex: granularidade 'mes' → '2026-05'; granularidade 'semana' → '2026-W19'
function labelSubPeriodo(dataIso: string, granularidade: 'semana' | 'mes'): string {
  const d = new Date(dataIso)
  if (granularidade === 'mes') {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  // ISO week number (segunda-feira como início da semana)
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const weekNum =
    Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// Gera a sequência ordenada de labels de sub-períodos dentro do range.
function gerarLabels(periodo: PeriodoFiltro, granularidade: 'semana' | 'mes'): string[] {
  const labels: string[] = []
  const cursor = new Date(periodo.inicio)
  const fim    = new Date(periodo.fim)

  while (cursor <= fim) {
    const label = labelSubPeriodo(cursor.toISOString().slice(0, 10), granularidade)
    if (!labels.includes(label)) labels.push(label)

    if (granularidade === 'mes') {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      cursor.setUTCDate(1)
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
  }

  return labels
}

// Conta dias úteis (seg-sex) em um range.
function diasUteis(inicio: string, fim: string): number {
  let count  = 0
  const cur  = new Date(inicio)
  const end  = new Date(fim)
  while (cur <= end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

// ─── 1. Desempenho por vendedor (série temporal) ──────────────────────────────

export interface SerieVendedor {
  vendedor:         string
  valoresPorPeriodo: { label: string; valor: number }[]
  total:            number
}

export interface ResultadoDesempenho {
  series:                   SerieVendedor[]
  totalComercialAtualizado: number
  granularidade:            'semana' | 'mes'
  labels:                   string[]
}

export async function calcularDesempenhoPorVendedor(
  periodo:  PeriodoFiltro,
  filtros:  FiltrosComerciais = {},
): Promise<ResultadoDesempenho> {
  const pedidos = await buscarPedidos(periodo, filtros)
  const granularidade = granularidadePeriodo(periodo)
  const labels = gerarLabels(periodo, granularidade)

  // Agrupa valor_vendido por vendedor e sub-período
  const mapa = new Map<string, Map<string, number>>()

  for (const p of pedidos) {
    if (p.status !== 'vendido') continue
    const nomeVendedor = p.vendedores?.nome ?? '(sem vendedor)'
    const dataRef      = p.data_venda ?? p.data_orcamento
    if (!dataRef) continue

    const label = labelSubPeriodo(dataRef, granularidade)

    if (!mapa.has(nomeVendedor)) mapa.set(nomeVendedor, new Map())
    const subMapa = mapa.get(nomeVendedor)!
    subMapa.set(label, (subMapa.get(label) ?? 0) + (p.valor_vendido ?? 0))
  }

  let totalComercialAtualizado = 0

  const series: SerieVendedor[] = Array.from(mapa.entries()).map(([vendedor, subMapa]) => {
    const valoresPorPeriodo = labels.map(label => ({
      label,
      valor: subMapa.get(label) ?? 0,
    }))
    const total = valoresPorPeriodo.reduce((s, v) => s + v.valor, 0)
    totalComercialAtualizado += total
    return { vendedor, valoresPorPeriodo, total }
  })

  // Ordena por total decrescente
  series.sort((a, b) => b.total - a.total)

  return { series, totalComercialAtualizado, granularidade, labels }
}

// ─── 2. Indicadores por vendedor (tabela de performance) ─────────────────────

export interface IndicadoresVendedor {
  vendedor:           string
  orcamentos:         number   // count total de pedidos no período
  clientesOrcados:    number   // count distinct cliente
  valorOrcado:        number   // sum valor_orcado
  pedidosVendidos:    number   // count onde status='vendido'
  clientesCompradores: number  // count distinct cliente onde status='vendido'
  valorVendido:       number   // sum valor_vendido
  // Fórmula: taxa de conversão financeira = valorVendido / valorOrcado
  taxaConversaoFinanceira: number | null
  // Fórmula: taxa de conversão comercial = clientesCompradores / clientesOrcados
  taxaConversaoComercial:  number | null
}

export async function calcularIndicadoresPorVendedor(
  periodo:  PeriodoFiltro,
  filtros:  FiltrosComerciais = {},
): Promise<IndicadoresVendedor[]> {
  const pedidos = await buscarPedidos(periodo, filtros)

  const mapa = new Map<string, {
    clientes:           Set<string>
    clientesCompradores: Set<string>
    orcamentos:         number
    valorOrcado:        number
    pedidosVendidos:    number
    valorVendido:       number
  }>()

  for (const p of pedidos) {
    const nome = p.vendedores?.nome ?? '(sem vendedor)'

    if (!mapa.has(nome)) {
      mapa.set(nome, {
        clientes:           new Set(),
        clientesCompradores: new Set(),
        orcamentos:         0,
        valorOrcado:        0,
        pedidosVendidos:    0,
        valorVendido:       0,
      })
    }

    const acc = mapa.get(nome)!
    acc.orcamentos++
    acc.valorOrcado += p.valor_orcado
    acc.clientes.add(p.cliente)

    if (p.status === 'vendido') {
      acc.pedidosVendidos++
      acc.valorVendido += p.valor_vendido ?? 0
      acc.clientesCompradores.add(p.cliente)
    }
  }

  const resultado: IndicadoresVendedor[] = Array.from(mapa.entries()).map(([vendedor, acc]) => {
    const clientesOrcados    = acc.clientes.size
    const clientesCompradores = acc.clientesCompradores.size

    return {
      vendedor,
      orcamentos:          acc.orcamentos,
      clientesOrcados,
      valorOrcado:         acc.valorOrcado,
      pedidosVendidos:     acc.pedidosVendidos,
      clientesCompradores,
      valorVendido:        acc.valorVendido,
      // Fórmula: valorVendido / valorOrcado (0 quando não há orçamentos)
      taxaConversaoFinanceira: acc.valorOrcado > 0
        ? acc.valorVendido / acc.valorOrcado
        : null,
      // Fórmula: clientesCompradores / clientesOrcados (null quando sem clientes)
      taxaConversaoComercial: clientesOrcados > 0
        ? clientesCompradores / clientesOrcados
        : null,
    }
  })

  resultado.sort((a, b) => b.valorVendido - a.valorVendido)
  return resultado
}

// ─── 3. Grandes oportunidades (pipeline em aberto) ────────────────────────────

export interface OportunidadePedido {
  id:                  string
  cliente:             string
  valorOrcado:         number
  dataOrcamento:       string | null
  proximaAcao:         string | null
  previsaoFechamento:  string | null
  empresa:             string | null
  filial:              string | null
}

export interface GrandesOportunidadesPorVendedor {
  vendedor:     string
  oportunidades: OportunidadePedido[]
  totalPipeline: number
}

export async function buscarGrandesOportunidades(
  periodo:  PeriodoFiltro,
  filtros:  FiltrosComerciais = {},
): Promise<GrandesOportunidadesPorVendedor[]> {
  const pedidos = await buscarPedidos(periodo, filtros)

  const mapa = new Map<string, OportunidadePedido[]>()

  for (const p of pedidos) {
    if (p.status !== 'orcado') continue
    const nome = p.vendedores?.nome ?? '(sem vendedor)'

    if (!mapa.has(nome)) mapa.set(nome, [])
    mapa.get(nome)!.push({
      id:                 p.id,
      cliente:            p.cliente,
      valorOrcado:        p.valor_orcado,
      dataOrcamento:      p.data_orcamento,
      proximaAcao:        p.proxima_acao ?? null,
      previsaoFechamento: p.previsao_fechamento ?? null,
      empresa:            p.empresa,
      filial:             p.filial,
    })
  }

  const resultado: GrandesOportunidadesPorVendedor[] = Array.from(mapa.entries()).map(
    ([vendedor, oportunidades]) => {
      // Ordena por valor decrescente dentro de cada vendedor
      oportunidades.sort((a, b) => b.valorOrcado - a.valorOrcado)
      const totalPipeline = oportunidades.reduce((s, o) => s + o.valorOrcado, 0)
      return { vendedor, oportunidades, totalPipeline }
    },
  )

  // Agrupa por maior pipeline total
  resultado.sort((a, b) => b.totalPipeline - a.totalPipeline)
  return resultado
}

// ─── 4. Rankings ─────────────────────────────────────────────────────────────

export interface EntradaRanking {
  posicao:  number
  vendedor: string
  valor:    number
  // Dados comprobatórios — variam conforme o ranking
  detalhes: Record<string, number | string | null>
  formula:  string
}

export interface Rankings {
  // Vendedores rankeados por valor vendido, separados por filial
  porFilial: {
    saoPaulo: EntradaRanking[]
    parana:   EntradaRanking[]
  }
  // Ranking por soma de valor_orcado (total de orçamentos emitidos)
  porValorOrcado: EntradaRanking[]
  // Ranking por soma de valor_vendido (vendas efetivadas)
  porValorVendido: EntradaRanking[]
  // Ranking por conversão financeira: valorVendido / valorOrcado
  conversaoFinanceira: EntradaRanking[]
  // Ranking por conversão comercial: clientesCompradores / clientesOrcados
  conversaoComercial: EntradaRanking[]
  // Ranking por produtividade: orcamentos + clientesDistintos (com média diária se ≥5 dias úteis)
  produtividade: EntradaRanking[]
  // Ranking por pipeline: soma de valor_orcado onde status='orcado'
  pipeline: EntradaRanking[]
}

export async function calcularRankings(
  periodo:  PeriodoFiltro,
  filtros:  FiltrosComerciais = {},
): Promise<Rankings> {
  const pedidos = await buscarPedidos(periodo, filtros)
  const duDias  = diasUteis(periodo.inicio, periodo.fim)
  const temMediaDiaria = duDias >= 5

  // Acumuladores por vendedor
  interface Acc {
    valorOrcado:         number
    valorVendido:        number
    orcamentos:          number
    clientes:            Set<string>
    clientesCompradores: Set<string>
    pipeline:            number
    filial:              string | null
  }

  const geral  = new Map<string, Acc>()
  const spMapa = new Map<string, { valorVendido: number; orcamentos: number }>()
  const prMapa = new Map<string, { valorVendido: number; orcamentos: number }>()

  for (const p of pedidos) {
    const nome = p.vendedores?.nome ?? '(sem vendedor)'

    if (!geral.has(nome)) {
      geral.set(nome, {
        valorOrcado:         0,
        valorVendido:        0,
        orcamentos:          0,
        clientes:            new Set(),
        clientesCompradores: new Set(),
        pipeline:            0,
        filial:              p.filial,
      })
    }

    const acc = geral.get(nome)!
    acc.orcamentos++
    acc.valorOrcado += p.valor_orcado
    acc.clientes.add(p.cliente)

    if (p.status === 'vendido') {
      acc.valorVendido += p.valor_vendido ?? 0
      acc.clientesCompradores.add(p.cliente)
    } else {
      acc.pipeline += p.valor_orcado
    }

    // Sub-mapas por filial
    const filialNorm = (p.filial ?? '').toLowerCase()
    if (filialNorm.includes('paulo') || filialNorm.includes('sp')) {
      if (!spMapa.has(nome)) spMapa.set(nome, { valorVendido: 0, orcamentos: 0 })
      const sp = spMapa.get(nome)!
      sp.orcamentos++
      if (p.status === 'vendido') sp.valorVendido += p.valor_vendido ?? 0
    } else if (filialNorm.includes('paran') || filialNorm.includes('pr')) {
      if (!prMapa.has(nome)) prMapa.set(nome, { valorVendido: 0, orcamentos: 0 })
      const pr = prMapa.get(nome)!
      pr.orcamentos++
      if (p.status === 'vendido') pr.valorVendido += p.valor_vendido ?? 0
    }
  }

  function posicionar(lista: EntradaRanking[]): EntradaRanking[] {
    return lista
      .sort((a, b) => b.valor - a.valor)
      .map((e, i) => ({ ...e, posicao: i + 1 }))
  }

  // Por valor orcado
  const porValorOrcado = posicionar(
    Array.from(geral.entries()).map(([vendedor, acc]) => ({
      posicao:  0,
      vendedor,
      valor:    acc.valorOrcado,
      detalhes: { orcamentos: acc.orcamentos },
      formula:  'Σ valor_orcado',
    })),
  )

  // Por valor vendido
  const porValorVendido = posicionar(
    Array.from(geral.entries()).map(([vendedor, acc]) => ({
      posicao:  0,
      vendedor,
      valor:    acc.valorVendido,
      detalhes: { pedidosVendidos: acc.clientesCompradores.size, valorOrcado: acc.valorOrcado },
      formula:  'Σ valor_vendido',
    })),
  )

  // Conversão financeira: valorVendido / valorOrcado
  const conversaoFinanceira = posicionar(
    Array.from(geral.entries())
      .filter(([, acc]) => acc.valorOrcado > 0)
      .map(([vendedor, acc]) => {
        const taxa = acc.valorVendido / acc.valorOrcado
        return {
          posicao:  0,
          vendedor,
          valor:    taxa,
          detalhes: {
            valorVendido: acc.valorVendido,
            valorOrcado:  acc.valorOrcado,
          },
          formula: 'valorVendido ÷ valorOrcado',
        }
      }),
  )

  // Conversão comercial: clientesCompradores / clientesOrcados
  const conversaoComercial = posicionar(
    Array.from(geral.entries())
      .filter(([, acc]) => acc.clientes.size > 0)
      .map(([vendedor, acc]) => {
        const taxa = acc.clientesCompradores.size / acc.clientes.size
        return {
          posicao:  0,
          vendedor,
          valor:    taxa,
          detalhes: {
            clientesCompradores: acc.clientesCompradores.size,
            clientesOrcados:     acc.clientes.size,
          },
          formula: 'clientesCompradores ÷ clientesOrcados',
        }
      }),
  )

  // Produtividade: orcamentos + clientesDistintos (+ média diária se ≥5 dias úteis)
  const produtividade = posicionar(
    Array.from(geral.entries()).map(([vendedor, acc]) => {
      const score = acc.orcamentos + acc.clientes.size
      const mediaDiaria = temMediaDiaria ? score / duDias : null
      return {
        posicao:  0,
        vendedor,
        valor:    score,
        detalhes: {
          orcamentos:       acc.orcamentos,
          clientesDistintos: acc.clientes.size,
          diasUteis:         duDias,
          ...(mediaDiaria !== null ? { mediaDiaria: Number(mediaDiaria.toFixed(2)) } : {}),
        },
        formula: temMediaDiaria
          ? '(orcamentos + clientesDistintos) ÷ diasUteis'
          : 'orcamentos + clientesDistintos',
      }
    }),
  )

  // Pipeline: soma de valor_orcado onde status='orcado'
  const pipeline = posicionar(
    Array.from(geral.entries()).map(([vendedor, acc]) => ({
      posicao:  0,
      vendedor,
      valor:    acc.pipeline,
      detalhes: { valorOrcadoTotal: acc.valorOrcado, valorVendido: acc.valorVendido },
      formula:  'Σ valor_orcado onde status = orcado',
    })),
  )

  // Por filial — São Paulo
  const saoPaulo = posicionar(
    Array.from(spMapa.entries()).map(([vendedor, v]) => ({
      posicao:  0,
      vendedor,
      valor:    v.valorVendido,
      detalhes: { orcamentos: v.orcamentos },
      formula:  'Σ valor_vendido (filial São Paulo)',
    })),
  )

  // Por filial — Paraná
  const parana = posicionar(
    Array.from(prMapa.entries()).map(([vendedor, v]) => ({
      posicao:  0,
      vendedor,
      valor:    v.valorVendido,
      detalhes: { orcamentos: v.orcamentos },
      formula:  'Σ valor_vendido (filial Paraná)',
    })),
  )

  return {
    porFilial:           { saoPaulo, parana },
    porValorOrcado,
    porValorVendido,
    conversaoFinanceira,
    conversaoComercial,
    produtividade,
    pipeline,
  }
}

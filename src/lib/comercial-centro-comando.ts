// Server-only — usa supabaseAdmin (diretamente aqui, e indiretamente via
// funções já existentes). Agrega dados para o "Centro de Comando" no topo do
// /dashboard — visão do dia pro vendedor/gestor. Reaproveita cálculo já
// existente em alertas.ts, comercial-indicadores.ts,
// comercial-pedidos-repository.ts e clientes-repository.ts, nunca duplica
// (CLAUDE.md §7.4). Em especial, "clientes esquecidos" e "clientes em risco"
// vêm dos mesmos alertas cliente_esfriando/sem_atividade já calculados por
// calcularAlertas() — não existe uma segunda regra de "dias sem contato".
//
// Determinístico — nenhum cálculo aqui usa IA. A priorização (prioridades)
// reaproveita buscarGrandesOportunidades, que já ordena por valor orçado. A
// "saúde da carteira" é uma soma de pontos com pesos fixos e documentados
// (ver calcularSaudeCarteira) — não um score aprendido, e a fórmula é sempre
// exibida junto do número (mesmo padrão de MetricaComFormula).

import { supabaseAdmin } from './supabase-admin'
import { calcularAlertas, type AlertaItem } from './alertas'
import { listarVendas, listarPedidos, contarPorEtapaFunil, ETAPAS_FUNIL, type EtapaFunil } from './comercial-pedidos-repository'
import { listarClientes, type StatusCliente } from './clientes-repository'
import { buscarGrandesOportunidades, type OportunidadePedido } from './comercial-indicadores'
import type { Papel } from './comercial-auth'

export interface OpcoesCentroComando {
  papel: Papel
  vendedorId: string | null
}

export interface PrioridadeSugerida extends OportunidadePedido {
  vendedor: string
}

export interface PontoEvolucaoCarteira {
  mes: string        // "jan/26"
  clientes: number
}

export interface SaudeCarteira {
  score: number       // 0-100
  formula: string      // base de cálculo em texto legível, sempre exibida junto
}

export interface CentroComandoResumo {
  alertas: AlertaItem[]
  vendasHoje: { total: number; quantidade: number }
  orcamentosHoje: number
  clientesNovosHoje: { total: number; leads: number }
  carteira: Record<StatusCliente, number>
  funil: Record<EtapaFunil, number>
  prioridades: PrioridadeSugerida[]
  valorPotencialAberto: number
  meta: { realizadoMes: number; alvo: null }
  evolucaoCarteira: PontoEvolucaoCarteira[]
  saudeCarteira: SaudeCarteira
}

const LIMITE_PRIORIDADES = 5
const MESES_EVOLUCAO = 6
const NOMES_MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function inicioDoMesIso(hoje: string): string {
  return `${hoje.slice(0, 7)}-01`
}

// ─── Clientes novos hoje (total + leads) ───────────────────────────────────
// Sem função existente pra isso (FiltrosCliente não tem filtro de data) —
// query direta, no mesmo estilo de alertas.ts.

async function contarClientesNovosHoje(vendedorId: string | undefined): Promise<{ total: number; leads: number }> {
  const hoje = hojeIso()
  const amanha = new Date(`${hoje}T00:00:00Z`)
  amanha.setUTCDate(amanha.getUTCDate() + 1)

  let query = supabaseAdmin
    .from('clientes')
    .select('origem')
    .eq('arquivado', false)
    .gte('created_at', `${hoje}T00:00:00Z`)
    .lt('created_at', amanha.toISOString())

  if (vendedorId) query = query.eq('vendedor_id', vendedorId)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao contar clientes novos hoje: ${error.message}`)

  const linhas = (data as { origem: string | null }[]) ?? []
  return { total: linhas.length, leads: linhas.filter(l => l.origem === 'lead').length }
}

// ─── Evolução da carteira (últimos 6 meses) ────────────────────────────────

async function buscarEvolucaoCarteira(vendedorId: string | undefined): Promise<PontoEvolucaoCarteira[]> {
  const hoje = new Date()
  const pontos: PontoEvolucaoCarteira[] = []

  for (let i = MESES_EVOLUCAO - 1; i >= 0; i--) {
    const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1))
    const inicioProximoMes = new Date(Date.UTC(inicioMes.getUTCFullYear(), inicioMes.getUTCMonth() + 1, 1))

    let query = supabaseAdmin
      .from('clientes')
      .select('cnpj', { count: 'exact', head: true })
      .eq('arquivado', false)
      .gte('created_at', inicioMes.toISOString())
      .lt('created_at', inicioProximoMes.toISOString())

    if (vendedorId) query = query.eq('vendedor_id', vendedorId)

    const { count, error } = await query
    if (error) throw new Error(`Falha ao calcular evolução da carteira: ${error.message}`)

    pontos.push({ mes: `${NOMES_MES_CURTO[inicioMes.getUTCMonth()]}/${String(inicioMes.getUTCFullYear()).slice(2)}`, clientes: count ?? 0 })
  }

  return pontos
}

// ─── Saúde da carteira — soma de pontos com pesos fixos, sempre com fórmula visível ──

function calcularSaudeCarteira(
  carteira: Record<StatusCliente, number>,
  alertas: AlertaItem[],
  funil: Record<EtapaFunil, number>,
): SaudeCarteira {
  const criticos = alertas.filter(a => a.nivel === 'critico').length
  const atencao  = alertas.filter(a => a.nivel !== 'critico').length
  const emNegociacaoOuFechado = (funil['Negociação'] ?? 0) + (funil['Fechado'] ?? 0) > 0
  const totalCarteira = carteira.em_fila + carteira.atribuido + carteira.liberado
  const percentualLiberado = totalCarteira > 0 ? carteira.liberado / totalCarteira : 0

  let score = 60
  score -= criticos * 8
  score -= atencao * 3
  if (emNegociacaoOuFechado) score += 10
  if (percentualLiberado > 0.3) score += 10
  score = Math.max(0, Math.min(100, score))

  const formula =
    `60 base − 8×${criticos} alerta(s) crítico(s) − 3×${atencao} em atenção` +
    `${emNegociacaoOuFechado ? ' + 10 (há pedidos em negociação/fechado)' : ''}` +
    `${percentualLiberado > 0.3 ? ' + 10 (>30% da carteira liberada)' : ''}`

  return { score, formula }
}

export async function buscarCentroComando(opts: OpcoesCentroComando): Promise<CentroComandoResumo> {
  const hoje = hojeIso()
  const inicioMes = inicioDoMesIso(hoje)
  const vendedorId = opts.vendedorId ?? undefined

  const [
    alertas, vendasHojeRes, vendasMesRes, orcamentosHojeRes, clientesNovosHoje,
    statusCounts, funil, oportunidadesPorVendedor, evolucaoCarteira,
  ] = await Promise.all([
    calcularAlertas({ papel: opts.papel, vendedorId: opts.vendedorId }),
    listarVendas({ vendedorId, dataInicio: hoje, dataFim: hoje, porPagina: 1 }),
    listarVendas({ vendedorId, dataInicio: inicioMes, dataFim: hoje, porPagina: 1 }),
    listarPedidos({ vendedorId, dataInicio: hoje, dataFim: hoje, porPagina: 1 }),
    contarClientesNovosHoje(vendedorId),
    Promise.all(
      (['em_fila', 'atribuido', 'liberado'] as const).map(status =>
        listarClientes({ status: [status], vendedorId, porPagina: 1 }),
      ),
    ),
    contarPorEtapaFunil({ vendedorId }),
    // Período amplo — priorização deve considerar todo o pipeline em aberto,
    // não só o mês corrente.
    buscarGrandesOportunidades({ inicio: '2000-01-01', fim: hoje }, { vendedorId }),
    buscarEvolucaoCarteira(vendedorId),
  ])

  const [emFila, atribuido, liberado] = statusCounts
  const carteira: Record<StatusCliente, number> = { em_fila: emFila.total, atribuido: atribuido.total, liberado: liberado.total }

  const prioridades: PrioridadeSugerida[] = oportunidadesPorVendedor
    .flatMap(g => g.oportunidades.map(o => ({ ...o, vendedor: g.vendedor })))
    .sort((a, b) => b.valorOrcado - a.valorOrcado)
    .slice(0, LIMITE_PRIORIDADES)

  const valorPotencialAberto = oportunidadesPorVendedor.reduce((soma, g) => soma + g.totalPipeline, 0)

  return {
    alertas,
    vendasHoje: { total: vendasHojeRes.totalVendido, quantidade: vendasHojeRes.total },
    orcamentosHoje: orcamentosHojeRes.total,
    clientesNovosHoje,
    carteira,
    funil,
    prioridades,
    valorPotencialAberto,
    // Não existe meta comercial configurada no sistema hoje — alvo fica null
    // de propósito (fallback seguro), em vez de inventar um número.
    meta: { realizadoMes: vendasMesRes.totalVendido, alvo: null },
    evolucaoCarteira,
    saudeCarteira: calcularSaudeCarteira(carteira, alertas, funil),
  }
}

export { ETAPAS_FUNIL }

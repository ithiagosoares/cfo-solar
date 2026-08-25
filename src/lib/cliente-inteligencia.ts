// Puro — sem supabaseAdmin, importável em componentes 'use client' (mesmo padrão
// de status-pedido-config.ts). Todo cálculo aqui é regra fixa e determinística,
// nunca IA — ver CLAUDE.md, seção 9 ("não usa IA para calcular dados").
//
// Consome Cliente + PedidoResumo já carregados pela página do hub — não faz
// nenhuma query própria.

import type { Cliente } from './clientes-repository'
import type { PedidoResumo } from './comercial-pedidos-repository'
import type { ItemPedido } from './comercial-pedidos-itens-repository'

export type Potencial = 'Alto' | 'Médio' | 'Baixo'
export type ChanceRecompra = 'Alta' | 'Média' | 'Baixa'
export type EtapaPipelineCliente =
  | 'Novo Lead' | 'Contato' | 'Qualificado' | 'Orçado' | 'Negociação' | 'Fechado' | 'Perdido'

// Etapas fixas do funil visual do cliente. 'Qualificado' nunca é retornada por
// calcularEtapaPipeline — o schema atual não tem um sinal de qualificação
// distinto de "atribuído mas sem orçamento" (Contato). Fica só como referência
// visual no funil até existir esse dado.
export const ETAPAS_PIPELINE_CLIENTE: readonly EtapaPipelineCliente[] =
  ['Novo Lead', 'Contato', 'Qualificado', 'Orçado', 'Negociação', 'Fechado', 'Perdido']

export interface DetalheScore {
  recencia: number
  frequencia: number
  ticketMedio: number
  ciclo: number
}

export interface ResultadoScore {
  score: number
  detalhe: DetalheScore
}

export interface ResultadoChanceRecompra {
  nivel: ChanceRecompra
  diasDesdeUltimaCompra: number | null
}

export interface ProdutoTop {
  descricao: string
  quantidade: number
  valorTotal: number
}

export type Alerta = { severidade: 'atencao' | 'risco'; mensagem: string }

// ─── Helpers de data ─────────────────────────────────────────────────────────
// Datas de negócio nesta tabela são strings ISO 'YYYY-MM-DD', comparáveis
// lexicograficamente — mesmo padrão usado em buscarUltimaAtividade().

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Dias entre dataIso e a referência (hoje por padrão). Positivo = dataIso no
// passado; negativo = dataIso no futuro.
function diasEntre(dataIso: string, referencia: string = hojeIso()): number {
  const a = new Date(`${dataIso}T00:00:00`).getTime()
  const b = new Date(`${referencia}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

// Última atividade conhecida do cliente: a mais recente entre ultimo_contato
// (CRM) e as datas de orçamento/venda de qualquer pedido vinculado a ele.
export function ultimaAtividade(cliente: Cliente, pedidos: PedidoResumo[]): string | null {
  let max: string | null = cliente.ultimoContato ?? null
  for (const p of pedidos) {
    if (p.dataOrcamento && (!max || p.dataOrcamento > max)) max = p.dataOrcamento
    if (p.dataVenda && (!max || p.dataVenda > max)) max = p.dataVenda
  }
  return max
}

// ─── Score (0–100) ───────────────────────────────────────────────────────────

function pontosRecencia(cliente: Cliente, pedidos: PedidoResumo[]): number {
  const ultima = ultimaAtividade(cliente, pedidos)
  if (!ultima) return 0
  const dias = diasEntre(ultima)
  if (dias <= 0) return 35
  if (dias >= 90) return 0
  return Math.round(35 * (1 - dias / 90))
}

// Nº de pedidos vendidos nos últimos 12 meses — usado no score, na chance de
// recompra e na Aba Inteligência (evita recalcular a mesma coisa em 3 lugares).
export function vendas12Meses(pedidos: PedidoResumo[]): number {
  return pedidos.filter(
    p => p.status === 'vendido' && p.dataVenda !== null && diasEntre(p.dataVenda) <= 365,
  ).length
}

function pontosFrequencia(pedidos: PedidoResumo[]): number {
  const vendas12m = vendas12Meses(pedidos)
  if (vendas12m === 0) return 0
  if (vendas12m === 1) return 10
  if (vendas12m <= 3) return 18
  return 25
}

function pontosTicketMedio(pedidos: PedidoResumo[]): number {
  const vendidos = pedidos.filter(p => p.status === 'vendido' && p.valorVendido !== null)
  if (vendidos.length === 0) return 0
  const media = vendidos.reduce((acc, p) => acc + (p.valorVendido ?? 0), 0) / vendidos.length
  if (media < 5000) return 5
  if (media < 20000) return 12
  if (media < 50000) return 18
  return 20
}

function pontosCiclo(cliente: Cliente): number {
  if (!cliente.dataVencimento) return 10
  return diasEntre(cliente.dataVencimento) > 0 ? 0 : 20
}

export function calcularScore(cliente: Cliente, pedidos: PedidoResumo[]): ResultadoScore {
  const detalhe: DetalheScore = {
    recencia: pontosRecencia(cliente, pedidos),
    frequencia: pontosFrequencia(pedidos),
    ticketMedio: pontosTicketMedio(pedidos),
    ciclo: pontosCiclo(cliente),
  }
  return { score: detalhe.recencia + detalhe.frequencia + detalhe.ticketMedio + detalhe.ciclo, detalhe }
}

export function calcularPotencial(score: number): Potencial {
  if (score >= 70) return 'Alto'
  if (score >= 40) return 'Médio'
  return 'Baixo'
}

// ─── Chance de recompra ──────────────────────────────────────────────────────

export function calcularChanceRecompra(cliente: Cliente, pedidos: PedidoResumo[]): ResultadoChanceRecompra {
  const diasDesdeUltimaCompra = cliente.dataUltimaCompra ? diasEntre(cliente.dataUltimaCompra) : null
  const vendas12m = vendas12Meses(pedidos)

  let nivel: ChanceRecompra = 'Baixa'
  if (diasDesdeUltimaCompra !== null && diasDesdeUltimaCompra <= 60 && vendas12m >= 2) nivel = 'Alta'
  else if (diasDesdeUltimaCompra !== null && diasDesdeUltimaCompra <= 120) nivel = 'Média'

  return { nivel, diasDesdeUltimaCompra }
}

// ─── Produtos top ────────────────────────────────────────────────────────────

export function top3Produtos(itens: ItemPedido[]): ProdutoTop[] {
  const porDescricao = new Map<string, ProdutoTop>()
  for (const item of itens) {
    const atual = porDescricao.get(item.descricao) ?? { descricao: item.descricao, quantidade: 0, valorTotal: 0 }
    atual.quantidade += item.quantidade
    atual.valorTotal += item.valorTotal
    porDescricao.set(item.descricao, atual)
  }
  return [...porDescricao.values()].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 3)
}

// ─── Pipeline do cliente ─────────────────────────────────────────────────────
// Mapeia o cliente numa das 7 etapas fixas, a partir do que já existe no
// schema (clientes.status + comercial_pedidos.status/etapa_funil) — sem
// nenhum campo novo.

export function calcularEtapaPipeline(cliente: Cliente, pedidos: PedidoResumo[]): EtapaPipelineCliente {
  if (pedidos.some(p => p.status === 'vendido')) return 'Fechado'

  const orcados = pedidos.filter(p => p.status === 'orcado')
  const perdidos = pedidos.filter(p => p.status === 'perdido')

  if (pedidos.length > 0 && orcados.length === 0 && perdidos.length === pedidos.length) return 'Perdido'

  if (orcados.length > 0) {
    const maisRecente = [...orcados].sort(
      (a, b) => (b.dataOrcamento ?? '').localeCompare(a.dataOrcamento ?? ''),
    )[0]
    if (maisRecente.etapaFunil === 'Negociação' || maisRecente.etapaFunil === 'Aguardando decisão') {
      return 'Negociação'
    }
    return 'Orçado'
  }

  return cliente.status === 'em_fila' ? 'Novo Lead' : 'Contato'
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

export function calcularAlertas(cliente: Cliente, pedidos: PedidoResumo[]): Alerta[] {
  const alertas: Alerta[] = []
  const etapa = calcularEtapaPipeline(cliente, pedidos)

  if (etapa !== 'Fechado' && etapa !== 'Perdido') {
    const ultima = ultimaAtividade(cliente, pedidos)
    const diasSemAtividade = ultima ? diasEntre(ultima) : null
    if (diasSemAtividade === null || diasSemAtividade > 15) {
      alertas.push({
        severidade: 'risco',
        mensagem: diasSemAtividade === null
          ? 'Cliente esfriando — nenhum contato registrado ainda'
          : `Cliente esfriando — sem contato há ${diasSemAtividade} dias`,
      })
    }
  }

  if (cliente.dataVencimento) {
    const diasVencido = diasEntre(cliente.dataVencimento)
    if (diasVencido > 0) {
      alertas.push({ severidade: 'atencao', mensagem: `Fora do ciclo — vencido há ${diasVencido} dias` })
    }
  }

  if (cliente.proximaAcaoData) {
    const diasAtraso = diasEntre(cliente.proximaAcaoData)
    const contatoDepoisDaAcao = !!cliente.ultimoContato && cliente.ultimoContato >= cliente.proximaAcaoData
    if (diasAtraso > 0 && !contatoDepoisDaAcao) {
      alertas.push({
        severidade: 'atencao',
        mensagem: `Próxima ação atrasada${cliente.proximaAcao ? ` (${cliente.proximaAcao})` : ''} — prevista há ${diasAtraso} dias`,
      })
    }
  }

  return alertas
}

// ─── Filial mais recente ─────────────────────────────────────────────────────
// clientes não tem campo de filial — usado no cabeçalho, derivado do pedido
// mais recente (por data_orcamento).

export function filialMaisRecente(pedidos: PedidoResumo[]): string | null {
  if (pedidos.length === 0) return null
  const ordenados = [...pedidos].sort(
    (a, b) => (b.dataOrcamento ?? b.criadoEm).localeCompare(a.dataOrcamento ?? a.criadoEm),
  )
  return ordenados[0].filial
}

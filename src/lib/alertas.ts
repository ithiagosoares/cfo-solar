// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
// Sistema de Alertas centralizado: on-demand, recalcula a cada chamada (sem cron,
// sem cache) — ver /api/alertas. Reaproveita ultimaAtividade() de
// cliente-inteligencia.ts pra "esfriando"/"sem atividade" em vez de duplicar a
// regra de recência (CLAUDE.md §7.4 — nunca duplicar lógica de cálculo).

import { supabaseAdmin } from './supabase-admin'
import { listarVendedores } from './vendedores-repository'
import { ultimaAtividade } from './cliente-inteligencia'
import type { Cliente, StatusCliente } from './clientes-repository'
import type { PedidoResumo } from './comercial-pedidos-repository'
import type { TipoAtividade } from './atividades-repository'
import type { Papel } from './comercial-auth'

// Categorias de atividade agendada, por proximidade da data — ver
// categorizarAtividadeAgendada() abaixo. 'atividade_semana' é uma janela
// rolante de 7 dias (hoje+2 até hoje+7), não a semana civil — decisão tomada
// porque nenhuma definição de semana civil (seg-dom ou dom-sáb) dá um
// intervalo de tamanho fixo e previsível pro vendedor.
export type TipoAlertaAtividade = 'atividade_atrasada' | 'atividade_hoje' | 'atividade_amanha' | 'atividade_semana'
export type TipoAlerta = TipoAlertaAtividade | 'cliente_esfriando' | 'sem_atividade'
export type NivelAlerta = 'critico' | 'aviso' | 'info'

export interface AlertaItem {
  id: string
  tipo: TipoAlerta
  nivel: NivelAlerta
  clienteCnpj: string
  razaoSocial: string
  vendedorId: string | null
  vendedorNome: string | null
  data: string | null
  mensagem: string
  atividadeId: string | null
  atividadeTipo: TipoAtividade | null
}

const DIAS_ESFRIANDO = 15
const DIAS_GRACE_SEM_ATIVIDADE = 7

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function diasEntre(dataIso: string, referencia: string = hojeIso()): number {
  const a = new Date(`${dataIso}T00:00:00`).getTime()
  const b = new Date(`${referencia}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// UTC (não horário local) — mesma convenção de hojeIso(), pra nunca comparar
// uma data UTC com uma aritmética em horário local.
function adicionarDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const DIAS_JANELA_ESTA_SEMANA = 7

// Atrasado (< hoje) / Hoje (= hoje) / Amanhã (= hoje+1) / Esta Semana
// (hoje+2 até hoje+DIAS_JANELA_ESTA_SEMANA) / null (além da janela, não vira alerta).
function categorizarAtividadeAgendada(
  dataAgendada: string,
  hoje: string,
): { tipo: TipoAlertaAtividade; nivel: NivelAlerta } | null {
  if (dataAgendada < hoje) return { tipo: 'atividade_atrasada', nivel: 'critico' }
  if (dataAgendada === hoje) return { tipo: 'atividade_hoje', nivel: 'critico' }
  if (dataAgendada === adicionarDias(hoje, 1)) return { tipo: 'atividade_amanha', nivel: 'aviso' }
  if (dataAgendada <= adicionarDias(hoje, DIAS_JANELA_ESTA_SEMANA)) return { tipo: 'atividade_semana', nivel: 'info' }
  return null
}

function mensagemAtividade(tipo: TipoAlertaAtividade, row: AtividadePendenteRow): string {
  switch (tipo) {
    case 'atividade_atrasada': return `${row.tipo} vencida em ${fmtData(row.data_agendada)}`
    case 'atividade_hoje': return `${row.tipo} agendada para hoje`
    case 'atividade_amanha': return `${row.tipo} agendada para amanhã`
    case 'atividade_semana': return `${row.tipo} agendada para ${fmtData(row.data_agendada)}`
  }
}

interface ClienteAlerta {
  cnpj: string
  razaoSocial: string
  vendedorId: string | null
  status: StatusCliente
  dataAtribuicao: string | null
  ultimoContato: string | null
  criadoEm: string
}

interface ClienteRowMin {
  cnpj: string
  razao_social: string
  vendedor_id: string | null
  status: StatusCliente
  data_atribuicao: string | null
  ultimo_contato: string | null
  created_at: string
}

interface AtividadePendenteRow {
  id: string
  cliente_cnpj: string
  tipo: TipoAtividade
  data_agendada: string
  notas: string | null
}

interface PedidoMinRow {
  cliente_cnpj: string
  data_orcamento: string | null
  data_venda: string | null
}

export interface OpcoesCalcularAlertas {
  papel: Papel
  vendedorId: string | null
}

// ─── Query 1: clientes visíveis pro papel/vendedor ───────────────────────────

async function buscarClientesVisiveis(opts: OpcoesCalcularAlertas): Promise<ClienteAlerta[]> {
  let query = supabaseAdmin
    .from('clientes')
    .select('cnpj, razao_social, vendedor_id, status, data_atribuicao, ultimo_contato, created_at')
    .eq('arquivado', false)

  if (opts.papel === 'vendedor') {
    if (!opts.vendedorId) return []
    query = query.eq('vendedor_id', opts.vendedorId)
  }

  const { data, error } = await query
  if (error) throw new Error(`Falha ao buscar clientes para alertas: ${error.message}`)

  return (data as ClienteRowMin[] ?? []).map(row => ({
    cnpj: row.cnpj,
    razaoSocial: row.razao_social,
    vendedorId: row.vendedor_id,
    status: row.status,
    dataAtribuicao: row.data_atribuicao,
    ultimoContato: row.ultimo_contato,
    criadoEm: row.created_at,
  }))
}

// ─── Query 2: atividades pendentes (vencidas + urgentes) ─────────────────────

// fimJanela: corte superior (inclusive) — sem limite inferior, pra sempre
// pegar TODAS as atrasadas, não importa há quanto tempo.
async function buscarAtividadesPendentes(cnpjs: string[], fimJanela: string): Promise<AtividadePendenteRow[]> {
  if (cnpjs.length === 0) return []

  const { data, error } = await supabaseAdmin
    .from('atividades')
    .select('id, cliente_cnpj, tipo, data_agendada, notas')
    .eq('arquivado', false)
    .is('data_realizado', null)
    .not('data_agendada', 'is', null)
    .lte('data_agendada', fimJanela)
    .in('cliente_cnpj', cnpjs)

  if (error) throw new Error(`Falha ao buscar atividades pendentes: ${error.message}`)

  return (data as AtividadePendenteRow[]) ?? []
}

// ─── Query 3: pedidos (só pra recência — ultimaAtividade) ────────────────────

async function buscarPedidosMin(cnpjs: string[]): Promise<Map<string, PedidoMinRow[]>> {
  const mapa = new Map<string, PedidoMinRow[]>()
  if (cnpjs.length === 0) return mapa

  const { data, error } = await supabaseAdmin
    .from('comercial_pedidos')
    .select('cliente_cnpj, data_orcamento, data_venda')
    .eq('arquivado', false)
    .in('cliente_cnpj', cnpjs)

  if (error) throw new Error(`Falha ao buscar pedidos para alertas: ${error.message}`)

  for (const row of (data as PedidoMinRow[]) ?? []) {
    const lista = mapa.get(row.cliente_cnpj) ?? []
    lista.push(row)
    mapa.set(row.cliente_cnpj, lista)
  }
  return mapa
}

// ─── Cálculo principal ────────────────────────────────────────────────────────

export async function calcularAlertas(opts: OpcoesCalcularAlertas): Promise<AlertaItem[]> {
  const clientes = await buscarClientesVisiveis(opts)
  if (clientes.length === 0) return []

  const hoje = hojeIso()
  const fimJanela = adicionarDias(hoje, DIAS_JANELA_ESTA_SEMANA)

  const cnpjs = clientes.map(c => c.cnpj)
  const [atividadesPendentes, pedidosPorCnpj, vendedores] = await Promise.all([
    buscarAtividadesPendentes(cnpjs, fimJanela),
    buscarPedidosMin(cnpjs),
    listarVendedores(false),
  ])

  console.log(
    '[alertas] calcularAlertas —', clientes.length, 'clientes visíveis,',
    atividadesPendentes.length, 'atividades pendentes até', fimJanela, '(hoje =', hoje, ')',
  )

  const mapaClientes = new Map(clientes.map(c => [c.cnpj, c]))
  const mapaVendedores = new Map(vendedores.map(v => [v.id, v.nome]))

  const alertas: AlertaItem[] = []

  // Atividade agendada (data_realizado nulo) categorizada por proximidade —
  // ver categorizarAtividadeAgendada(). O filtro .lte(fimJanela) da query já
  // garante que nada além da janela chega aqui, mas o `continue` abaixo é a
  // mesma regra de categorização, defensivo contra o corte da query divergir.
  for (const row of atividadesPendentes) {
    const cliente = mapaClientes.get(row.cliente_cnpj)
    if (!cliente) continue

    const categoria = categorizarAtividadeAgendada(row.data_agendada, hoje)
    if (!categoria) continue

    alertas.push({
      id: row.id,
      tipo: categoria.tipo,
      nivel: categoria.nivel,
      clienteCnpj: cliente.cnpj,
      razaoSocial: cliente.razaoSocial,
      vendedorId: cliente.vendedorId,
      vendedorNome: cliente.vendedorId ? (mapaVendedores.get(cliente.vendedorId) ?? null) : null,
      data: row.data_agendada,
      mensagem: mensagemAtividade(categoria.tipo, row),
      atividadeId: row.id,
      atividadeTipo: row.tipo,
    })
  }

  // Cliente Esfriando / Sem Atividade Recente — só carteira ativa (status='atribuido').
  // Esfriando: já teve contato/pedido, mas passou de DIAS_ESFRIANDO dias sem nada novo.
  // Sem Atividade: nunca teve contato nem pedido registrado, e já passou o prazo de
  // carência (DIAS_GRACE_SEM_ATIVIDADE dias desde a atribuição) — cliente novo "parado".
  for (const cliente of clientes) {
    if (cliente.status !== 'atribuido') continue

    const pedidosMin = (pedidosPorCnpj.get(cliente.cnpj) ?? []).map(p => ({
      dataOrcamento: p.data_orcamento,
      dataVenda: p.data_venda,
    })) as unknown as PedidoResumo[]
    const clienteParaCalculo = { ultimoContato: cliente.ultimoContato } as unknown as Cliente
    const ultima = ultimaAtividade(clienteParaCalculo, pedidosMin)

    const vendedorNome = cliente.vendedorId ? (mapaVendedores.get(cliente.vendedorId) ?? null) : null

    if (ultima !== null) {
      const dias = diasEntre(ultima)
      if (dias > DIAS_ESFRIANDO) {
        alertas.push({
          id: `cliente_esfriando:${cliente.cnpj}`,
          tipo: 'cliente_esfriando',
          nivel: 'aviso',
          clienteCnpj: cliente.cnpj,
          razaoSocial: cliente.razaoSocial,
          vendedorId: cliente.vendedorId,
          vendedorNome,
          data: ultima,
          mensagem: `Sem contato há ${dias} dias`,
          atividadeId: null,
          atividadeTipo: null,
        })
      }
    } else {
      const referencia = cliente.dataAtribuicao ?? cliente.criadoEm
      const dias = diasEntre(referencia.slice(0, 10))
      if (dias > DIAS_GRACE_SEM_ATIVIDADE) {
        alertas.push({
          id: `sem_atividade:${cliente.cnpj}`,
          tipo: 'sem_atividade',
          nivel: 'info',
          clienteCnpj: cliente.cnpj,
          razaoSocial: cliente.razaoSocial,
          vendedorId: cliente.vendedorId,
          vendedorNome,
          data: referencia,
          mensagem: `Nenhum contato registrado desde a atribuição (${dias} dias)`,
          atividadeId: null,
          atividadeTipo: null,
        })
      }
    }
  }

  const ordemNivel: Record<NivelAlerta, number> = { critico: 0, aviso: 1, info: 2 }
  alertas.sort((a, b) => {
    const porNivel = ordemNivel[a.nivel] - ordemNivel[b.nivel]
    if (porNivel !== 0) return porNivel
    return (a.data ?? '').localeCompare(b.data ?? '')
  })

  console.log('[alertas] array final — total:', alertas.length, '— conteúdo:', JSON.stringify(alertas))

  return alertas
}

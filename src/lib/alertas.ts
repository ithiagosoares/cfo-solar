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

export type TipoAlerta = 'acao_vencida' | 'acao_urgente' | 'cliente_esfriando' | 'sem_atividade'
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

async function buscarAtividadesPendentes(cnpjs: string[]): Promise<AtividadePendenteRow[]> {
  if (cnpjs.length === 0) return []

  const cutoff = hojeIso()
  console.log('[alertas] query 2 — cutoff usado no .lte(data_agendada, cutoff):', cutoff)

  const { data, error } = await supabaseAdmin
    .from('atividades')
    .select('id, cliente_cnpj, tipo, data_agendada, notas')
    .eq('arquivado', false)
    .is('data_realizado', null)
    .not('data_agendada', 'is', null)
    .lte('data_agendada', cutoff)
    .in('cliente_cnpj', cnpjs)

  if (error) throw new Error(`Falha ao buscar atividades pendentes: ${error.message}`)

  // Diagnóstico: roda a MESMA query sem o .lte, só pra comparar o que o corte
  // de data está descartando — não altera o valor retornado, só loga.
  const { data: semCorte, error: erroSemCorte } = await supabaseAdmin
    .from('atividades')
    .select('id, cliente_cnpj, tipo, data_agendada, notas')
    .eq('arquivado', false)
    .is('data_realizado', null)
    .not('data_agendada', 'is', null)
    .in('cliente_cnpj', cnpjs)

  if (erroSemCorte) {
    console.log('[alertas] query 2 (diagnóstico sem corte de data) falhou:', erroSemCorte.message)
  } else {
    const idsComCorte = new Set((data ?? []).map((r: AtividadePendenteRow) => r.id))
    const excluidasPeloCorte = (semCorte ?? []).filter((r: AtividadePendenteRow) => !idsComCorte.has(r.id))
    console.log(
      '[alertas] query 2 (diagnóstico) — SEM o .lte encontrou:', (semCorte ?? []).length,
      '— COM o .lte encontrou:', (data ?? []).length,
      '— excluídas pelo corte de data:', JSON.stringify(excluidasPeloCorte.map((r: AtividadePendenteRow) => ({
        id: r.id, cliente_cnpj: r.cliente_cnpj, data_agendada: r.data_agendada,
      }))),
    )
  }

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
  console.log('[alertas] calcularAlertas — opts recebidas:', JSON.stringify(opts))

  const clientes = await buscarClientesVisiveis(opts)
  console.log(
    '[alertas] query 1 (clientes visíveis) — total:', clientes.length,
    '— cnpjs:', JSON.stringify(clientes.map(c => ({ cnpj: c.cnpj, status: c.status, vendedorId: c.vendedorId }))),
  )
  if (clientes.length === 0) {
    console.log('[alertas] nenhum cliente visível pra este papel/vendedor — retornando [] sem consultar atividades/pedidos')
    return []
  }

  const cnpjs = clientes.map(c => c.cnpj)
  const [atividadesPendentes, pedidosPorCnpj, vendedores] = await Promise.all([
    buscarAtividadesPendentes(cnpjs),
    buscarPedidosMin(cnpjs),
    listarVendedores(false),
  ])

  console.log('[alertas] query 2 (atividades pendentes) — total:', atividadesPendentes.length, '— raw:', JSON.stringify(atividadesPendentes))
  console.log(
    '[alertas] query 3 (pedidos por cnpj) — cnpjs com pedido:', pedidosPorCnpj.size,
    '— detalhe:', JSON.stringify([...pedidosPorCnpj.entries()]),
  )

  const mapaClientes = new Map(clientes.map(c => [c.cnpj, c]))
  const mapaVendedores = new Map(vendedores.map(v => [v.id, v.nome]))

  // ─── Diagnóstico de fuso horário — hojeIso() usa toISOString() (UTC). Se o
  // servidor rodar num fuso atrás de UTC (ex: America/Sao_Paulo, UTC-3), perto
  // da virada do dia local o UTC já pode estar num dia seguinte, deslocando
  // "hoje" pra frente e fazendo uma atividade de HOJE parecer "vencida" (ou
  // pior, ficar de fora do filtro .lte da query 2). Logs abaixo só comparam,
  // nada é alterado ainda.
  const agora = new Date()
  const hojeUTC = hojeIso()
  const hojeLocal = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  console.log('[alertas] diagnóstico de data/fuso:', JSON.stringify({
    'new Date().toString()': agora.toString(),
    'new Date().toISOString()': agora.toISOString(),
    'new Date().getTimezoneOffset() (min, positivo = atrás de UTC)': agora.getTimezoneOffset(),
    'hoje via hojeIso() [toISOString().slice(0,10)] (UTC)': hojeUTC,
    'hoje via getFullYear/getMonth/getDate (local do servidor)': hojeLocal,
    'UTC e local DIVERGEM?': hojeUTC !== hojeLocal,
  }))
  const hoje = hojeUTC
  console.log('[alertas] hoje usado nas comparações abaixo (= hojeIso(), UTC):', hoje)

  const alertas: AlertaItem[] = []

  // Ação Vencida / Ação Urgente — atividade agendada com data_realizado nulo.
  for (const row of atividadesPendentes) {
    const cliente = mapaClientes.get(row.cliente_cnpj)
    const diasAteHoje = diasEntre(row.data_agendada, hoje)
    const vencida = row.data_agendada < hoje
    const ehHoje = row.data_agendada === hoje
    console.log('[alertas] comparação data_agendada vs hoje (bruta):', JSON.stringify({
      cliente_cnpj: row.cliente_cnpj,
      'row.data_agendada (raw)': row.data_agendada,
      'typeof row.data_agendada': typeof row.data_agendada,
      'row.data_agendada.length': row.data_agendada?.length,
      'hoje (raw)': hoje,
      'typeof hoje': typeof hoje,
      'hoje.length': hoje.length,
      'row.data_agendada === hoje (estrita)': row.data_agendada === hoje,
      'row.data_agendada < hoje': row.data_agendada < hoje,
      'row.data_agendada > hoje': row.data_agendada > hoje,
      'row.data_agendada vs hojeLocal ===': row.data_agendada === hojeLocal,
    }))
    console.log('[alertas] atividade pendente encontrada:', JSON.stringify({
      cliente_cnpj: row.cliente_cnpj,
      tipo: row.tipo,
      data_agendada: row.data_agendada,
      dias_ate_hoje: diasAteHoje,
      e_hoje: ehHoje,
      e_vencida: vencida,
      classificacao_atual: vencida ? 'acao_vencida' : 'acao_urgente',
      cliente_encontrado_no_mapa: !!cliente,
    }))

    if (!cliente) {
      console.log('[alertas] ATENÇÃO: atividade', row.id, 'referencia cliente_cnpj', row.cliente_cnpj, 'que NÃO está no mapa de clientes visíveis — pulando (não vira alerta)')
      continue
    }

    alertas.push({
      id: row.id,
      tipo: vencida ? 'acao_vencida' : 'acao_urgente',
      nivel: 'critico',
      clienteCnpj: cliente.cnpj,
      razaoSocial: cliente.razaoSocial,
      vendedorId: cliente.vendedorId,
      vendedorNome: cliente.vendedorId ? (mapaVendedores.get(cliente.vendedorId) ?? null) : null,
      data: row.data_agendada,
      mensagem: vencida
        ? `${row.tipo} vencida em ${fmtData(row.data_agendada)}`
        : `${row.tipo} agendada para hoje`,
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

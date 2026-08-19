// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
// Exporta também inserirPedidoManual e listarPedidos usados por /api/orcamentos.

import { supabaseAdmin } from './supabase-admin'
import type { RegistroPreview } from './comercial-importacoes-repository'

const TABELA = 'comercial_pedidos'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type StatusPedido = 'orcado' | 'vendido' | 'perdido'
export type EtapaFunil  = 'Novo' | 'Em contato' | 'Negociação' | 'Aguardando decisão' | 'Fechado' | 'Perdido'
export type StatusVenda = 'Venda Fechada' | 'Faturamento Pendente' | 'Aguardando emissão de NF' | 'Faturado' | 'Entregue' | 'Problema Reportado' | 'Pós-venda Concluído'

export const ETAPAS_FUNIL: readonly EtapaFunil[] =
  ['Novo', 'Em contato', 'Negociação', 'Aguardando decisão', 'Fechado', 'Perdido']
export const STATUS_VENDA_VALORES: readonly StatusVenda[] =
  ['Venda Fechada', 'Faturamento Pendente', 'Aguardando emissão de NF', 'Faturado', 'Entregue', 'Problema Reportado', 'Pós-venda Concluído']

export interface PedidoResumo {
  id: string
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  clienteCnpj: string | null
  valorOrcado: number
  dataOrcamento: string | null
  status: StatusPedido
  valorVendido: number | null
  dataVenda: string | null
  origem: string
  numeroPedido: string | null
  criadoEm: string
  arquivado: boolean
  etapaFunil: EtapaFunil | null
  statusVenda: StatusVenda | null
}

export interface PedidoCompleto extends PedidoResumo {
  importacaoId: string | null
}

export interface DadosPedidoManual {
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  valorOrcado: number
  dataOrcamento: string | null
  status: StatusPedido
  valorVendido: number | null
  dataVenda: string | null
}

// ─── Helpers internos ────────────────────────────────────────────────────────

// Tenta resolver cliente_cnpj por correspondência normalizada de razao_social.
// Carrega todos os clientes em memória — tabela pequena no início do projeto.
// Retorna mapa nome_original → cnpj (só para os nomes que encontraram correspondência).
async function resolverClienteCnpj(nomes: string[]): Promise<Record<string, string>> {
  if (nomes.length === 0) return {}

  const { data } = await supabaseAdmin.from('clientes').select('cnpj, razao_social')
  if (!data || data.length === 0) return {}

  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ')
  const porNomeNorm: Record<string, string> = {}
  for (const row of data as { cnpj: string; razao_social: string }[]) {
    porNomeNorm[norm(row.razao_social)] = row.cnpj
  }

  const resultado: Record<string, string> = {}
  for (const nome of nomes) {
    const cnpj = porNomeNorm[norm(nome)]
    if (cnpj) resultado[nome] = cnpj
  }
  return resultado
}

// Atualiza data_ultima_compra do cliente apenas quando a data_venda do pedido for
// mais recente que a já registrada. Operação best-effort: falhas são logadas mas não
// propagadas, pois o pedido já foi inserido com sucesso neste ponto.
async function atualizarDataUltimaCompra(cnpj: string, dataVenda: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('clientes')
    .update({ data_ultima_compra: dataVenda })
    .eq('cnpj', cnpj)
    .or(`data_ultima_compra.is.null,data_ultima_compra.lt.${dataVenda}`)

  if (error) {
    console.warn('[comercial-pedidos-repository] falha ao atualizar data_ultima_compra:', error.message)
  }
}

// Insere múltiplos registros de uma importação em comercial_pedidos.
// mapeamentoVendedores: nome_original_no_relatorio -> vendedor_id resolvido pelo usuário.
// Se o registro já tem vendedorId (reconhecido automaticamente), o mapeamento é ignorado.
// cliente_cnpj é preenchido quando razao_social do cliente já existe em clientes; null caso contrário.
export async function inserirPedidosImportacao(
  registros: RegistroPreview[],
  importacaoId: string,
  mapeamentoVendedores: Record<string, string>,
): Promise<void> {
  if (registros.length === 0) return

  const nomesUnicos = [...new Set(registros.map(r => r.cliente).filter(Boolean))]
  const cnpjPorNome = await resolverClienteCnpj(nomesUnicos)

  const rows = registros.map(r => ({
    vendedor_id:     r.vendedorId ?? mapeamentoVendedores[r.vendedorNome] ?? null,
    empresa:         r.empresa,
    filial:          r.filial,
    cliente:         r.cliente,
    cliente_cnpj:    cnpjPorNome[r.cliente] ?? null,
    valor_orcado:    r.valorOrcado,
    data_orcamento:  r.dataOrcamento || null,
    status:          r.status,
    valor_vendido:   r.valorVendido,
    data_venda:      r.dataVenda || null,
    numero_pedido:   r.numeroOrcamento || null,
    origem:          'upload_estruturado' as const,
    importacao_id:   importacaoId,
    status_venda:    r.status === 'vendido' ? ('Venda Fechada' as StatusVenda) : null,
  }))

  const semNumeroPedido = rows.filter(r => r.numero_pedido === null)
  if (semNumeroPedido.length > 0) {
    console.warn(
      `[comercial-pedidos-repository] ${semNumeroPedido.length} registro(s) sem numero_pedido — ` +
      `não protegidos pela constraint uniq_pedido_empresa. Clientes: ${semNumeroPedido.map(r => r.cliente).join(', ')}`,
    )
  }

  // upsert: se (numero_pedido, empresa) já existe, atualiza os campos com os dados
  // mais recentes em vez de inserir duplicata. Registros com numero_pedido = null
  // não conflitam (NULL ≠ NULL no Postgres) e continuam sendo inseridos normalmente.
  const { error } = await supabaseAdmin
    .from(TABELA)
    .upsert(rows, { onConflict: 'numero_pedido,empresa' })

  if (error) {
    console.error('[comercial-pedidos-repository] inserirPedidosImportacao erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao inserir pedidos: ${error.message}`)
  }

  // Sincroniza data_ultima_compra dos clientes vinculados para os pedidos vendidos
  const vendidosComCnpj = rows.filter(r => r.status === 'vendido' && r.data_venda && r.cliente_cnpj)
  await Promise.all(vendidosComCnpj.map(r => atualizarDataUltimaCompra(r.cliente_cnpj!, r.data_venda!)))
}

// Insere um único pedido cadastrado manualmente (origem='manual', sem numero_pedido).
// Registros manuais com numero_pedido=null não conflitam pela constraint
// uniq_pedido_empresa (NULL ≠ NULL no Postgres) — INSERT simples é seguro.
export async function inserirPedidoManual(dados: DadosPedidoManual): Promise<void> {
  const cnpjPorNome = dados.cliente
    ? await resolverClienteCnpj([dados.cliente])
    : {}

  const { error } = await supabaseAdmin
    .from(TABELA)
    .insert({
      vendedor_id:    dados.vendedorId,
      empresa:        dados.empresa,
      filial:         dados.filial,
      cliente:        dados.cliente,
      cliente_cnpj:   cnpjPorNome[dados.cliente] ?? null,
      valor_orcado:   dados.valorOrcado,
      data_orcamento: dados.dataOrcamento || null,
      status:         dados.status,
      valor_vendido:  dados.status === 'vendido' ? dados.valorVendido : null,
      data_venda:     dados.status === 'vendido' ? (dados.dataVenda || null) : null,
      status_venda:   dados.status === 'vendido' ? ('Venda Fechada' as StatusVenda) : null,
      numero_pedido:  null,
      origem:         'manual' as const,
      importacao_id:  null,
    })

  if (error) throw new Error(`Falha ao inserir pedido manual: ${error.message}`)

  // Sincroniza data_ultima_compra se o pedido foi cadastrado como vendido
  if (dados.status === 'vendido' && dados.dataVenda) {
    const cnpjCliente = cnpjPorNome[dados.cliente] ?? null
    if (cnpjCliente) await atualizarDataUltimaCompra(cnpjCliente, dados.dataVenda)
  }
}

// ─── VendaResumo ─────────────────────────────────────────────────────────────

export interface VendaResumo {
  id: string
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  valorVendido: number
  dataVenda: string
  origem: string
  numeroPedido: string | null
  statusVenda: StatusVenda | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

// Lista pedidos com paginação. Filtra por vendedor_id quando informado.
// Ordena por data de criação decrescente (mais recente primeiro).
export async function listarPedidos(filtros: {
  vendedorId?: string
  busca?: string
  status?: StatusPedido
  dataInicio?: string
  dataFim?: string
  mostrarArquivados?: boolean
  pagina?: number
  porPagina?: number
} = {}): Promise<{ pedidos: PedidoResumo[]; total: number }> {
  const pagina    = Math.max(1, filtros.pagina    ?? 1)
  const porPagina = Math.min(100, Math.max(1, filtros.porPagina ?? 20))
  const from      = (pagina - 1) * porPagina
  const to        = from + porPagina - 1

  type Row = {
    id: string
    vendedor_id: string | null
    empresa: string
    filial: string
    cliente: string
    cliente_cnpj: string | null
    valor_orcado: number
    data_orcamento: string | null
    status: StatusPedido
    valor_vendido: number | null
    data_venda: string | null
    origem: string
    numero_pedido: string | null
    created_at: string
    arquivado: boolean
    etapa_funil: EtapaFunil | null
    status_venda: StatusVenda | null
  }

  let query = supabaseAdmin
    .from(TABELA)
    .select(
      'id, vendedor_id, empresa, filial, cliente, cliente_cnpj, valor_orcado, data_orcamento, status, valor_vendido, data_venda, origem, numero_pedido, created_at, arquivado, etapa_funil, status_venda',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filtros.vendedorId)  query = query.eq('vendedor_id', filtros.vendedorId)
  if (filtros.busca)      query = query.ilike('empresa', `%${filtros.busca}%`)
  if (filtros.status)     query = query.eq('status', filtros.status)
  if (filtros.dataInicio) query = query.gte('data_orcamento', filtros.dataInicio)
  if (filtros.dataFim)    query = query.lte('data_orcamento', filtros.dataFim)
  query = query.eq('arquivado', filtros.mostrarArquivados === true)

  const { data, error, count } = await query

  if (error) throw new Error(`Falha ao listar pedidos: ${error.message}`)

  return {
    pedidos: (data ?? []).map((row: Row) => ({
      id:            row.id,
      vendedorId:    row.vendedor_id,
      empresa:       row.empresa,
      filial:        row.filial,
      cliente:       row.cliente,
      clienteCnpj:   row.cliente_cnpj,
      valorOrcado:   row.valor_orcado,
      dataOrcamento: row.data_orcamento,
      status:        row.status,
      valorVendido:  row.valor_vendido,
      dataVenda:     row.data_venda,
      origem:        row.origem,
      numeroPedido:  row.numero_pedido,
      criadoEm:      row.created_at,
      arquivado:     row.arquivado,
      etapaFunil:    row.etapa_funil,
      statusVenda:   row.status_venda,
    })),
    total: count ?? 0,
  }
}

// Busca um único pedido pelo id (UUID). Retorna null se não encontrado.
export async function buscarPedidoPorId(id: string): Promise<PedidoCompleto | null> {
  type Row = {
    id: string
    vendedor_id: string | null
    empresa: string
    filial: string
    cliente: string
    cliente_cnpj: string | null
    valor_orcado: number
    data_orcamento: string | null
    status: StatusPedido
    valor_vendido: number | null
    data_venda: string | null
    origem: string
    numero_pedido: string | null
    importacao_id: string | null
    created_at: string
    arquivado: boolean
    etapa_funil: EtapaFunil | null
    status_venda: StatusVenda | null
  }

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('id, vendedor_id, empresa, filial, cliente, cliente_cnpj, valor_orcado, data_orcamento, status, valor_vendido, data_venda, origem, numero_pedido, importacao_id, created_at, arquivado, etapa_funil, status_venda')
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as Row
  return {
    id:            row.id,
    vendedorId:    row.vendedor_id,
    empresa:       row.empresa,
    filial:        row.filial,
    cliente:       row.cliente,
    clienteCnpj:   row.cliente_cnpj,
    valorOrcado:   row.valor_orcado,
    dataOrcamento: row.data_orcamento,
    status:        row.status,
    valorVendido:  row.valor_vendido,
    dataVenda:     row.data_venda,
    origem:        row.origem,
    numeroPedido:  row.numero_pedido,
    importacaoId:  row.importacao_id,
    criadoEm:      row.created_at,
    arquivado:     row.arquivado,
    etapaFunil:    row.etapa_funil,
    statusVenda:   row.status_venda,
  }
}

export interface DadosAtualizacaoPedido {
  empresa?: string
  filial?: string
  cliente?: string
  status?: StatusPedido
  valorOrcado?: number
  dataOrcamento?: string | null
  valorVendido?: number | null
  dataVenda?: string | null
  etapaFunil?: EtapaFunil
  statusVenda?: StatusVenda
}

// Atualiza campos editáveis de um pedido. Retorna true se atualizado com sucesso.
// Centraliza a regra "status virou vendido -> status_venda = 'Venda Fechada'" aqui,
// para valer em qualquer chamador (PATCH genérico de orçamento, endpoint de status, etc.)
// sem duplicar a lógica em cada rota — ver CLAUDE.md, seção 7, regra 4.
export async function atualizarPedido(id: string, dados: DadosAtualizacaoPedido): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (dados.empresa       !== undefined) patch.empresa       = dados.empresa
  if (dados.filial        !== undefined) patch.filial        = dados.filial
  if (dados.cliente       !== undefined) patch.cliente       = dados.cliente
  if (dados.status        !== undefined) patch.status        = dados.status
  if (dados.valorOrcado   !== undefined) patch.valor_orcado  = dados.valorOrcado
  if (dados.dataOrcamento !== undefined) patch.data_orcamento = dados.dataOrcamento
  if (dados.valorVendido  !== undefined) patch.valor_vendido = dados.valorVendido
  if (dados.dataVenda     !== undefined) patch.data_venda    = dados.dataVenda
  if (dados.etapaFunil    !== undefined) patch.etapa_funil   = dados.etapaFunil
  if (dados.statusVenda   !== undefined) patch.status_venda  = dados.statusVenda

  // Se status mudou para orcado ou perdido, limpa campos de venda (status_venda
  // só faz sentido pós-venda). Se virou vendido, garante status_venda preenchido
  // — a menos que o chamador já tenha passado um statusVenda explícito nesta mesma chamada.
  if (dados.status === 'orcado' || dados.status === 'perdido') {
    patch.valor_vendido = null
    patch.data_venda    = null
    patch.status_venda  = null
  } else if (dados.status === 'vendido' && dados.statusVenda === undefined) {
    patch.status_venda = 'Venda Fechada' as StatusVenda
  }

  const { error } = await supabaseAdmin
    .from(TABELA)
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(`Falha ao atualizar pedido: ${error.message}`)
}

// Lista registros com status='vendido', filtrados por período e vendedor.
// Retorna lista paginada + total de registros + soma de valor_vendido no período.
// Ordena por data_venda decrescente.
export async function listarVendas(filtros: {
  vendedorId?: string
  busca?: string
  valorMin?: number
  valorMax?: number
  dataInicio?: string
  dataFim?: string
  pagina?: number
  porPagina?: number
} = {}): Promise<{ vendas: VendaResumo[]; total: number; totalVendido: number }> {
  const pagina    = Math.max(1, filtros.pagina    ?? 1)
  const porPagina = Math.min(100, Math.max(1, filtros.porPagina ?? 20))
  const from      = (pagina - 1) * porPagina
  const to        = from + porPagina - 1

  type Row = {
    id: string
    vendedor_id: string | null
    empresa: string
    filial: string
    cliente: string
    valor_vendido: number | null
    data_venda: string | null
    origem: string
    numero_pedido: string | null
    status_venda: StatusVenda | null
  }

  let dataQuery = supabaseAdmin
    .from(TABELA)
    .select(
      'id, vendedor_id, empresa, filial, cliente, valor_vendido, data_venda, origem, numero_pedido, status_venda',
      { count: 'exact' },
    )
    .eq('status', 'vendido')
    .eq('arquivado', false)
    .order('data_venda', { ascending: false })
    .range(from, to)

  let sumQuery = supabaseAdmin
    .from(TABELA)
    .select('valor_vendido')
    .eq('status', 'vendido')
    .eq('arquivado', false)

  if (filtros.vendedorId) {
    dataQuery = dataQuery.eq('vendedor_id', filtros.vendedorId)
    sumQuery  = sumQuery.eq('vendedor_id', filtros.vendedorId)
  }
  if (filtros.busca) {
    dataQuery = dataQuery.ilike('cliente', `%${filtros.busca}%`)
    sumQuery  = sumQuery.ilike('cliente', `%${filtros.busca}%`)
  }
  if (filtros.valorMin !== undefined) {
    dataQuery = dataQuery.gte('valor_vendido', filtros.valorMin)
    sumQuery  = sumQuery.gte('valor_vendido', filtros.valorMin)
  }
  if (filtros.valorMax !== undefined) {
    dataQuery = dataQuery.lte('valor_vendido', filtros.valorMax)
    sumQuery  = sumQuery.lte('valor_vendido', filtros.valorMax)
  }
  if (filtros.dataInicio) {
    dataQuery = dataQuery.gte('data_venda', filtros.dataInicio)
    sumQuery  = sumQuery.gte('data_venda', filtros.dataInicio)
  }
  if (filtros.dataFim) {
    dataQuery = dataQuery.lte('data_venda', filtros.dataFim)
    sumQuery  = sumQuery.lte('data_venda', filtros.dataFim)
  }

  const [dataResult, sumResult] = await Promise.all([dataQuery, sumQuery])

  if (dataResult.error) throw new Error(`Falha ao listar vendas: ${dataResult.error.message}`)
  if (sumResult.error)  throw new Error(`Falha ao calcular total vendido: ${sumResult.error.message}`)

  const totalVendido = (sumResult.data ?? []).reduce(
    (acc: number, row: { valor_vendido: number | null }) => acc + (row.valor_vendido ?? 0),
    0,
  )

  return {
    vendas: (dataResult.data ?? []).map((row: Row) => ({
      id:           row.id,
      vendedorId:   row.vendedor_id,
      empresa:      row.empresa,
      filial:       row.filial,
      cliente:      row.cliente,
      valorVendido: row.valor_vendido ?? 0,
      dataVenda:    row.data_venda ?? '',
      origem:       row.origem,
      numeroPedido: row.numero_pedido,
      statusVenda:  row.status_venda,
    })),
    total:        dataResult.count ?? 0,
    totalVendido,
  }
}

export async function arquivarPedido(id: string, arquivar: boolean): Promise<void> {
  const patch: Record<string, unknown> = {
    arquivado:    arquivar,
    arquivado_em: arquivar ? new Date().toISOString() : null,
  }
  const { error } = await supabaseAdmin
    .from(TABELA)
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(`Falha ao arquivar pedido: ${error.message}`)
}

// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
// Exporta também salvarPedidoManual e listarPedidos usados por /api/orcamentos.

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
  pdfUrl: string | null
  pdfGoogleDriveId: string | null
  vendedorAtribuido: string | null
}

export interface DadosPedidoManual {
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  numeroPedido: string
  valorOrcado: number
  dataOrcamento: string | null
  status: StatusPedido
  valorVendido: number | null
  dataVenda: string | null
}

export interface ResultadoPedidoManual {
  id: string
  criado: boolean
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

// Cria ou atualiza um pedido cadastrado manualmente (origem='manual'), deduplicando
// pela chave de negócio (numero_pedido, empresa) — a mesma usada pelo upsert de
// importação de ERP (ver uniq_pedido_empresa em schema.sql). Se já existe um pedido
// com esse par, atualiza apenas os dados do pedido (filial, cliente, valores, datas,
// status) e preserva vendedor_id/origem originais — reenviar o mesmo número de pedido
// nunca reatribui o dono. Se não existe, insere um registro novo.
export async function salvarPedidoManual(dados: DadosPedidoManual): Promise<ResultadoPedidoManual> {
  const cnpjPorNome = dados.cliente
    ? await resolverClienteCnpj([dados.cliente])
    : {}
  const clienteCnpj = cnpjPorNome[dados.cliente] ?? null

  const camposPedido = {
    filial:         dados.filial,
    cliente:        dados.cliente,
    cliente_cnpj:   clienteCnpj,
    valor_orcado:   dados.valorOrcado,
    data_orcamento: dados.dataOrcamento || null,
    status:         dados.status,
    valor_vendido:  dados.status === 'vendido' ? dados.valorVendido : null,
    data_venda:     dados.status === 'vendido' ? (dados.dataVenda || null) : null,
    status_venda:   dados.status === 'vendido' ? ('Venda Fechada' as StatusVenda) : null,
  }

  const { data: existente, error: erroBusca } = await supabaseAdmin
    .from(TABELA)
    .select('id')
    .eq('numero_pedido', dados.numeroPedido)
    .eq('empresa', dados.empresa)
    .maybeSingle()

  if (erroBusca) throw new Error(`Falha ao verificar pedido existente: ${erroBusca.message}`)

  if (existente) {
    const { error } = await supabaseAdmin.from(TABELA).update(camposPedido).eq('id', existente.id)
    if (error) throw new Error(`Falha ao atualizar pedido: ${error.message}`)

    if (dados.status === 'vendido' && dados.dataVenda && clienteCnpj) {
      await atualizarDataUltimaCompra(clienteCnpj, dados.dataVenda)
    }
    return { id: existente.id, criado: false }
  }

  const { data: inserido, error } = await supabaseAdmin
    .from(TABELA)
    .insert({
      vendedor_id:   dados.vendedorId,
      empresa:       dados.empresa,
      numero_pedido: dados.numeroPedido,
      origem:        'manual' as const,
      importacao_id: null,
      ...camposPedido,
    })
    .select('id')
    .single()

  // Corrida rara: outro pedido com o mesmo (numero_pedido, empresa) foi inserido
  // entre a checagem acima e este insert — trata como atualização em vez de erro.
  if (error?.code === '23505') {
    const { data: concorrente, error: erroConcorrente } = await supabaseAdmin
      .from(TABELA)
      .select('id')
      .eq('numero_pedido', dados.numeroPedido)
      .eq('empresa', dados.empresa)
      .single()
    if (erroConcorrente || !concorrente) throw new Error('Falha ao resolver conflito de pedido duplicado')

    const { error: erroUpdate } = await supabaseAdmin.from(TABELA).update(camposPedido).eq('id', concorrente.id)
    if (erroUpdate) throw new Error(`Falha ao atualizar pedido: ${erroUpdate.message}`)
    return { id: concorrente.id, criado: false }
  }

  if (error || !inserido) throw new Error(`Falha ao inserir pedido manual: ${error?.message ?? 'erro desconhecido'}`)

  if (dados.status === 'vendido' && dados.dataVenda && clienteCnpj) {
    await atualizarDataUltimaCompra(clienteCnpj, dados.dataVenda)
  }
  return { id: inserido.id, criado: true }
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
    pdf_url: string | null
    pdf_google_drive_id: string | null
    vendedor_atribuido: string | null
  }

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('id, vendedor_id, empresa, filial, cliente, cliente_cnpj, valor_orcado, data_orcamento, status, valor_vendido, data_venda, origem, numero_pedido, importacao_id, created_at, arquivado, etapa_funil, status_venda, pdf_url, pdf_google_drive_id, vendedor_atribuido')
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
    pdfUrl:            row.pdf_url,
    pdfGoogleDriveId:  row.pdf_google_drive_id,
    vendedorAtribuido: row.vendedor_atribuido,
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

// ─── Anexo de PDF de orçamento ────────────────────────────────────────────────

export interface FiltrosCandidatoPedido {
  numeroPedido: string | null
  valorAproximado: number | null
  vendedorId: string | null
}

export interface CandidatoPedido {
  id: string
  cliente: string
  numeroPedido: string | null
  valorOrcado: number
  dataOrcamento: string | null
}

const TOLERANCIA_VALOR_CANDIDATO_PERCENTUAL = 0.05
const TOLERANCIA_VALOR_CANDIDATO_MINIMA = 1
const LIMITE_CANDIDATOS = 10

type RowCandidato = {
  id: string
  cliente: string
  numero_pedido: string | null
  valor_orcado: number
  data_orcamento: string | null
}

// Sugere pedidos possíveis para o usuário escolher manualmente quando a
// correspondência automática do PDF ficou "duvidosa" (ver comercial-pedidos-pdf-match.ts).
// Combina dois sinais, sem exigir os dois ao mesmo tempo: número do pedido exato
// (forte, quando o PDF trouxe um) e valor aproximado (tolerância de 5%, mínimo
// R$1 — mais folgada que a usada em avaliarCorrespondencia, pois aqui é só uma
// sugestão pro usuário revisar, não uma decisão automática). vendedorId restringe
// a busca à própria carteira quando quem está chamando é vendedor — nunca deve
// sugerir pedido de outro vendedor pra ele vincular (CLAUDE.md, seção 3).
export async function buscarCandidatosPedido(filtros: FiltrosCandidatoPedido): Promise<CandidatoPedido[]> {
  const encontrados = new Map<string, RowCandidato>()

  if (filtros.numeroPedido) {
    let query = supabaseAdmin
      .from(TABELA)
      .select('id, cliente, numero_pedido, valor_orcado, data_orcamento')
      .eq('numero_pedido', filtros.numeroPedido)
      .eq('arquivado', false)
    if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId)

    const { data, error } = await query
    if (error) throw new Error(`Falha ao buscar candidatos por número do pedido: ${error.message}`)
    for (const row of (data ?? []) as RowCandidato[]) encontrados.set(row.id, row)
  }

  if (filtros.valorAproximado !== null && encontrados.size < LIMITE_CANDIDATOS) {
    const tolerancia = Math.max(
      TOLERANCIA_VALOR_CANDIDATO_MINIMA,
      filtros.valorAproximado * TOLERANCIA_VALOR_CANDIDATO_PERCENTUAL,
    )
    let query = supabaseAdmin
      .from(TABELA)
      .select('id, cliente, numero_pedido, valor_orcado, data_orcamento')
      .gte('valor_orcado', filtros.valorAproximado - tolerancia)
      .lte('valor_orcado', filtros.valorAproximado + tolerancia)
      .eq('arquivado', false)
      .order('data_orcamento', { ascending: false })
      .limit(LIMITE_CANDIDATOS)
    if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId)

    const { data, error } = await query
    if (error) throw new Error(`Falha ao buscar candidatos por valor: ${error.message}`)
    for (const row of (data ?? []) as RowCandidato[]) {
      if (!encontrados.has(row.id)) encontrados.set(row.id, row)
    }
  }

  return [...encontrados.values()]
    .slice(0, LIMITE_CANDIDATOS)
    .map(row => ({
      id:            row.id,
      cliente:       row.cliente,
      numeroPedido:  row.numero_pedido,
      valorOrcado:   row.valor_orcado,
      dataOrcamento: row.data_orcamento,
    }))
}

export interface DadosVinculoPdf {
  pdfUrl: string
  pdfGoogleDriveId: string
  vendedorAtribuidoId: string | null
  numeroPedidoExtraido?: string | null
}

// Vincula um PDF (já enviado ao Drive) a um pedido. Se o pedido ainda não tem
// vendedor_id definido, usa o vendedor resolvido a partir do PDF como fallback —
// nunca sobrescreve um vendedor_id já existente, e nunca aceita esse valor vindo
// direto do cliente sem ter passado pela extração/resolução determinística. Mesma
// lógica de fallback para numero_pedido: pedidos cadastrados manualmente (via
// /orcamentos/cadastro) nunca têm esse campo preenchido — o PDF é a chance de
// enriquecer o registro com a chave real do ERP, sem nunca sobrescrever um valor
// já existente.
export async function vincularPdfPedido(id: string, dados: DadosVinculoPdf): Promise<void> {
  const pedido = await buscarPedidoPorId(id)
  if (!pedido) throw new Error('Pedido não encontrado')

  const patch: Record<string, unknown> = {
    pdf_url:             dados.pdfUrl,
    pdf_google_drive_id: dados.pdfGoogleDriveId,
    vendedor_atribuido:  dados.vendedorAtribuidoId,
  }
  if (!pedido.vendedorId && dados.vendedorAtribuidoId) {
    patch.vendedor_id = dados.vendedorAtribuidoId
  }
  if (!pedido.numeroPedido && dados.numeroPedidoExtraido) {
    patch.numero_pedido = dados.numeroPedidoExtraido
  }

  const { error } = await supabaseAdmin.from(TABELA).update(patch).eq('id', id)
  if (error) throw new Error(`Falha ao vincular PDF ao pedido: ${error.message}`)
}

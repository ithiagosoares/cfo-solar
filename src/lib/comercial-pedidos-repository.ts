// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
// Exporta também inserirPedidoManual e listarPedidos usados por /api/orcamentos.

import { supabaseAdmin } from './supabase-admin'
import type { RegistroPreview } from './comercial-importacoes-repository'

const TABELA = 'comercial_pedidos'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type StatusPedido = 'orcado' | 'vendido'

export interface PedidoResumo {
  vendedorId: string | null
  empresa: string
  filial: string
  cliente: string
  valorOrcado: number
  dataOrcamento: string | null
  status: StatusPedido
  valorVendido: number | null
  dataVenda: string | null
  origem: string
  numeroPedido: string | null
  criadoEm: string
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

// Lista pedidos com paginação. Filtra por vendedor_id quando informado.
// Ordena por data de criação decrescente (mais recente primeiro).
export async function listarPedidos(filtros: {
  vendedorId?: string
  pagina?: number
  porPagina?: number
} = {}): Promise<{ pedidos: PedidoResumo[]; total: number }> {
  const pagina    = Math.max(1, filtros.pagina    ?? 1)
  const porPagina = Math.min(100, Math.max(1, filtros.porPagina ?? 20))
  const from      = (pagina - 1) * porPagina
  const to        = from + porPagina - 1

  type Row = {
    vendedor_id: string | null
    empresa: string
    filial: string
    cliente: string
    valor_orcado: number
    data_orcamento: string | null
    status: StatusPedido
    valor_vendido: number | null
    data_venda: string | null
    origem: string
    numero_pedido: string | null
    created_at: string
  }

  let query = supabaseAdmin
    .from(TABELA)
    .select(
      'vendedor_id, empresa, filial, cliente, valor_orcado, data_orcamento, status, valor_vendido, data_venda, origem, numero_pedido, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId)

  const { data, error, count } = await query

  if (error) throw new Error(`Falha ao listar pedidos: ${error.message}`)

  return {
    pedidos: (data ?? []).map((row: Row) => ({
      vendedorId:    row.vendedor_id,
      empresa:       row.empresa,
      filial:        row.filial,
      cliente:       row.cliente,
      valorOrcado:   row.valor_orcado,
      dataOrcamento: row.data_orcamento,
      status:        row.status,
      valorVendido:  row.valor_vendido,
      dataVenda:     row.data_venda,
      origem:        row.origem,
      numeroPedido:  row.numero_pedido,
      criadoEm:      row.created_at,
    })),
    total: count ?? 0,
  }
}

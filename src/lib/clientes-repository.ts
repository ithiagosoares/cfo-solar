// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'clientes'

// ─── Validação de CNPJ ───────────────────────────────────────────────────────

export function validarCNPJ(raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false

  const soma = (pesos: number[]) =>
    pesos.reduce((acc, w, i) => acc + Number(d[i]) * w, 0)
  const digito = (s: number) => { const r = s % 11; return r < 2 ? 0 : 11 - r }

  const d1 = digito(soma([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  const d2 = digito(soma([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))

  return Number(d[12]) === d1 && Number(d[13]) === d2
}

export function normalizarCNPJ(raw: string): string {
  return raw.replace(/\D/g, '')
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TipoCliente      = 'distribuidora' | 'integrador'
export type OrigemCliente    = 'prospeccao' | 'lead'
export type StatusCliente    = 'em_fila' | 'atribuido' | 'liberado'
export type StatusCrm        = 'novo_lead' | 'em_contato' | 'negociando' | 'cliente_ativo' | 'inativo' | 'perdido'
export type CanalPreferido   = 'whatsapp' | 'telefone' | 'email'
export type OrigemLeadDetalhe =
  | 'indicacao' | 'site_formulario' | 'instagram' | 'facebook' | 'google_ads'
  | 'whatsapp' | 'feira_evento' | 'ligacao_receptiva' | 'parceiro_revenda' | 'outro'

interface ClienteRow {
  cnpj: string
  razao_social: string
  tipo: TipoCliente
  origem: OrigemCliente
  origem_lead_detalhe: OrigemLeadDetalhe | null
  cidade: string
  estado: string
  telefone: string
  nome_contato: string | null
  email: string | null
  vendedor_id: string | null
  data_atribuicao: string | null
  data_vencimento: string | null
  status: StatusCliente
  status_crm: StatusCrm
  ultimo_contato: string | null
  proxima_acao: string | null
  proxima_acao_data: string | null
  observacoes: string | null
  canal_preferido: CanalPreferido | null
  produto_interesse: string | null
  data_ultima_compra: string | null
  criado_por: string
  created_at: string
  updated_at: string
}

export interface Cliente {
  cnpj: string
  razaoSocial: string
  tipo: TipoCliente
  origem: OrigemCliente
  origemLeadDetalhe: OrigemLeadDetalhe | null
  cidade: string
  estado: string
  telefone: string
  nomeContato: string | null
  email: string | null
  vendedorId: string | null
  dataAtribuicao: string | null
  dataVencimento: string | null
  status: StatusCliente
  statusCrm: StatusCrm
  ultimoContato: string | null
  proximaAcao: string | null
  proximaAcaoData: string | null
  observacoes: string | null
  canalPreferido: CanalPreferido | null
  produtoInteresse: string | null
  dataUltimaCompra: string | null
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export interface DadosNovoCliente {
  cnpj: string
  razaoSocial: string
  tipo: TipoCliente
  origem: OrigemCliente
  origemLeadDetalhe?: string | null
  cidade: string
  estado: string
  telefone: string
  nomeContato?: string | null
  emailContato?: string | null
  vendedorId?: string | null
}

export interface FiltrosCliente {
  status?: StatusCliente
  vendedorId?: string
  tipo?: TipoCliente
  origem?: OrigemCliente
  criadoPor?: string
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapearLinha(row: ClienteRow): Cliente {
  return {
    cnpj:               row.cnpj,
    razaoSocial:        row.razao_social,
    tipo:               row.tipo,
    origem:             row.origem,
    origemLeadDetalhe:  row.origem_lead_detalhe,
    cidade:             row.cidade,
    estado:             row.estado,
    telefone:           row.telefone,
    nomeContato:        row.nome_contato,
    email:              row.email,
    vendedorId:         row.vendedor_id,
    dataAtribuicao:     row.data_atribuicao,
    dataVencimento:     row.data_vencimento,
    status:             row.status,
    statusCrm:          row.status_crm,
    ultimoContato:      row.ultimo_contato,
    proximaAcao:        row.proxima_acao,
    proximaAcaoData:    row.proxima_acao_data,
    observacoes:        row.observacoes,
    canalPreferido:     row.canal_preferido,
    produtoInteresse:   row.produto_interesse,
    dataUltimaCompra:   row.data_ultima_compra,
    criadoPor:          row.criado_por,
    criadoEm:           row.created_at,
    atualizadoEm:       row.updated_at,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function criarCliente(dados: DadosNovoCliente, criadoPor: string): Promise<Cliente> {
  const cnpj = normalizarCNPJ(dados.cnpj)
  if (!validarCNPJ(cnpj)) throw new Error('CNPJ inválido')

  // Campos obrigatórios independente de origem
  if (!dados.cidade?.trim())   throw new Error('Cidade é obrigatória')
  if (!dados.estado?.trim() || dados.estado.trim().length !== 2) throw new Error('Estado deve ser a sigla com 2 letras (ex: SP)')
  if (!dados.telefone?.trim()) throw new Error('Telefone é obrigatório')

  // Validação condicional de origemLeadDetalhe
  let origemLeadDetalhe: string | null = null
  if (dados.origem === 'lead') {
    if (!dados.origemLeadDetalhe) throw new Error('Canal de origem é obrigatório para leads')
    origemLeadDetalhe = dados.origemLeadDetalhe
  }
  // Para 'prospeccao', origemLeadDetalhe fica null independente do que veio

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .insert({
      cnpj,
      razao_social:        dados.razaoSocial.trim(),
      tipo:                dados.tipo,
      origem:              dados.origem,
      origem_lead_detalhe: origemLeadDetalhe,
      cidade:              dados.cidade.trim(),
      estado:              dados.estado.trim().toUpperCase(),
      telefone:            dados.telefone.trim(),
      nome_contato:        dados.nomeContato?.trim() || null,
      email:               dados.emailContato?.trim() || null,
      vendedor_id:         dados.vendedorId ?? null,
      criado_por:          criadoPor,
    })
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'CNPJ já cadastrado' : error.message
    throw new Error(msg)
  }

  return mapearLinha(data as ClienteRow)
}

export async function listarClientes(filtros: FiltrosCliente = {}): Promise<Cliente[]> {
  let query = supabaseAdmin
    .from(TABELA)
    .select('*')
    .order('created_at', { ascending: false })

  if (filtros.status)     query = query.eq('status',     filtros.status)
  if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId)
  if (filtros.tipo)       query = query.eq('tipo',       filtros.tipo)
  if (filtros.origem)     query = query.eq('origem',     filtros.origem)
  if (filtros.criadoPor)  query = query.eq('criado_por', filtros.criadoPor)

  const { data, error } = await query
  if (error) throw new Error(`Falha ao listar clientes: ${error.message}`)

  return (data ?? []).map(row => mapearLinha(row as ClienteRow))
}

export async function atribuirVendedor(cnpj: string, vendedorId: string | null): Promise<Cliente> {
  const cnpjNorm = normalizarCNPJ(cnpj)

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .update({ vendedor_id: vendedorId })
    .eq('cnpj', cnpjNorm)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new Error('Cliente não encontrado')
    throw new Error(`Falha ao atribuir vendedor: ${error.message}`)
  }

  return mapearLinha(data as ClienteRow)
}

// Retorna a data mais recente entre data_orcamento e data_venda de qualquer pedido
// vinculado a esse CNPJ. Retorna null se não houver nenhum pedido vinculado.
// Datas em formato ISO (YYYY-MM-DD) — ordenáveis lexicograficamente.
export async function buscarUltimaAtividade(cnpj: string): Promise<string | null> {
  const cnpjNorm = normalizarCNPJ(cnpj)

  const { data, error } = await supabaseAdmin
    .from('comercial_pedidos')
    .select('data_orcamento, data_venda')
    .eq('cliente_cnpj', cnpjNorm)

  if (error) throw new Error(`Falha ao buscar atividade: ${error.message}`)
  if (!data || data.length === 0) return null

  let maxData: string | null = null
  for (const row of data as { data_orcamento: string | null; data_venda: string | null }[]) {
    if (row.data_orcamento && (!maxData || row.data_orcamento > maxData)) maxData = row.data_orcamento
    if (row.data_venda && (!maxData || row.data_venda > maxData)) maxData = row.data_venda
  }
  return maxData
}

export async function liberarCliente(cnpj: string): Promise<Cliente> {
  const cnpjNorm = normalizarCNPJ(cnpj)

  // Não altera vendedor_id — o trigger só recalcula status quando vendedor_id muda.
  // Atualizar apenas status='liberado' não dispara nenhuma lógica de datas.
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .update({ status: 'liberado' })
    .eq('cnpj', cnpjNorm)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new Error('Cliente não encontrado')
    throw new Error(`Falha ao liberar cliente: ${error.message}`)
  }

  return mapearLinha(data as ClienteRow)
}

// Usada pelo cron de vencimentos. Diferente de liberarCliente (liberação manual),
// esta variante também zera a atribuição: vendedor_id = null, datas = null, status = 'liberado'.
//
// Requer dois UPDATEs sequenciais por causa do trigger calcular_status_cliente:
//   1. Zerar vendedor_id → trigger seta status='em_fila' e limpa as datas automaticamente.
//   2. Setar status='liberado' → trigger não dispara lógica (vendedor_id não mudou).
export async function liberarClienteVencido(cnpj: string): Promise<void> {
  const cnpjNorm = normalizarCNPJ(cnpj)

  const { error: e1 } = await supabaseAdmin
    .from(TABELA)
    .update({ vendedor_id: null })
    .eq('cnpj', cnpjNorm)

  if (e1) throw new Error(`Falha ao remover atribuição de ${cnpjNorm}: ${e1.message}`)

  const { error: e2 } = await supabaseAdmin
    .from(TABELA)
    .update({ status: 'liberado' })
    .eq('cnpj', cnpjNorm)

  if (e2) throw new Error(`Falha ao marcar ${cnpjNorm} como liberado: ${e2.message}`)
}

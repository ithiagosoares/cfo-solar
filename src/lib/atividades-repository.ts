// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'
// TIPOS_ATIVIDADE mora em atividade-config.ts (puro, client-safe) — este
// arquivo só reusa o array pra validação, nunca o reexporta como valor daqui.
// Nunca importar VALORES deste arquivo (atividades-repository.ts) de um
// componente 'use client' — só `import type`. Ver atividade-config.ts.
import { TIPOS_ATIVIDADE, resultadoValidoParaTipo } from './atividade-config'

const TABELA = 'atividades'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TipoAtividade = 'Ligação' | 'Email' | 'Visita' | 'Reunião' | 'SMS' | 'WhatsApp' | 'Outro'

// 'Não Contactado' não é mais oferecido pra nenhum tipo (ver RESULTADOS_POR_TIPO
// em atividade-config.ts) — mantido só no tipo pra continuar renderizando
// atividades antigas que já tinham esse valor gravado.
export type ResultadoAtividade =
  | 'Contactado' | 'Não Contactado' | 'Interessado' | 'Não Interessado' | 'Agendado' | 'Cancelado'
  | 'Enviado' | 'Respondido' | 'Não Respondido'
  | 'Realizado' | 'Reagendado'
  | 'Confirmada' | 'Cancelada' | 'Reagendada'
  | 'Concluído'

export interface Atividade {
  id: string
  clienteCnpj: string
  tipo: TipoAtividade
  resultado: ResultadoAtividade | null
  dataRealizado: string | null
  dataAgendada: string | null
  notas: string | null
  usuarioId: string
  criadoEm: string
  atualizadoEm: string
  arquivado: boolean
  arquivadoEm: string | null
}

interface AtividadeRow {
  id: string
  cliente_cnpj: string
  tipo: TipoAtividade
  resultado: ResultadoAtividade | null
  data_realizado: string | null
  data_agendada: string | null
  notas: string | null
  usuario_id: string
  criado_em: string
  atualizado_em: string
  arquivado: boolean
  arquivado_em: string | null
}

function mapearLinha(row: AtividadeRow): Atividade {
  return {
    id: row.id,
    clienteCnpj: row.cliente_cnpj,
    tipo: row.tipo,
    resultado: row.resultado,
    dataRealizado: row.data_realizado,
    dataAgendada: row.data_agendada,
    notas: row.notas,
    usuarioId: row.usuario_id,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    arquivado: row.arquivado,
    arquivadoEm: row.arquivado_em,
  }
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Sincronização com clientes.ultimo_contato ───────────────────────────────
// Kanban ("tempo sem contato") e o Score/Alertas do hub (cliente-inteligencia.ts)
// leem clientes.ultimo_contato. Toda atividade com data_realizado preenchida é
// um contato de verdade, então mantemos esse campo em dia — best-effort, mesmo
// padrão de atualizarDataUltimaCompra em comercial-pedidos-repository.ts.
async function sincronizarUltimoContato(clienteCnpj: string, dataRealizado: string): Promise<void> {
  const dataIso = dataRealizado.slice(0, 10)
  const { error } = await supabaseAdmin
    .from('clientes')
    .update({ ultimo_contato: dataIso })
    .eq('cnpj', clienteCnpj)
    .or(`ultimo_contato.is.null,ultimo_contato.lt.${dataIso}`)

  if (error) {
    console.warn('[atividades-repository] falha ao sincronizar ultimo_contato:', error.message)
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarAtividades(clienteCnpj: string): Promise<Atividade[]> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('*')
    .eq('cliente_cnpj', clienteCnpj)
    .eq('arquivado', false)
    .order('criado_em', { ascending: false })

  if (error) throw new Error(`Falha ao listar atividades: ${error.message}`)
  return (data ?? []).map(row => mapearLinha(row as AtividadeRow))
}

export async function buscarAtividadePorId(id: string): Promise<Atividade | null> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Falha ao buscar atividade: ${error.message}`)
  }
  return data ? mapearLinha(data as AtividadeRow) : null
}

export interface DadosNovaAtividade {
  clienteCnpj: string
  tipo: TipoAtividade
  resultado: ResultadoAtividade | null
  dataRealizado: string | null
  dataAgendada: string | null
  notas: string | null
  usuarioId: string
}

export async function criarAtividade(dados: DadosNovaAtividade): Promise<Atividade> {
  if (!TIPOS_ATIVIDADE.includes(dados.tipo)) throw new Error('Tipo de atividade inválido')
  if (dados.dataRealizado && !dados.resultado) throw new Error('Resultado é obrigatório para atividades já realizadas')
  if (dados.resultado && !resultadoValidoParaTipo(dados.tipo, dados.resultado)) {
    throw new Error(`Resultado "${dados.resultado}" não é válido para o tipo "${dados.tipo}"`)
  }
  if (dados.dataAgendada && dados.dataAgendada < hojeIso()) throw new Error('Data agendada não pode ser no passado')

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .insert({
      cliente_cnpj: dados.clienteCnpj,
      tipo: dados.tipo,
      resultado: dados.resultado,
      data_realizado: dados.dataRealizado,
      data_agendada: dados.dataAgendada,
      notas: dados.notas,
      usuario_id: dados.usuarioId,
    })
    .select()
    .single()

  if (error) throw new Error(`Falha ao criar atividade: ${error.message}`)

  const atividade = mapearLinha(data as AtividadeRow)
  if (dados.dataRealizado) await sincronizarUltimoContato(atividade.clienteCnpj, dados.dataRealizado)

  return atividade
}

export interface DadosAtualizacaoAtividade {
  resultado?: ResultadoAtividade | null
  notas?: string | null
  marcarRealizado?: boolean
}

export async function atualizarAtividade(id: string, dados: DadosAtualizacaoAtividade): Promise<Atividade> {
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (dados.resultado !== undefined) patch.resultado = dados.resultado
  if (dados.notas !== undefined) patch.notas = dados.notas

  let novaDataRealizado: string | null = null
  if (dados.marcarRealizado) {
    novaDataRealizado = new Date().toISOString()
    patch.data_realizado = novaDataRealizado
  }

  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new Error('Atividade não encontrada')
    throw new Error(`Falha ao atualizar atividade: ${error.message}`)
  }

  const atividade = mapearLinha(data as AtividadeRow)
  if (novaDataRealizado) await sincronizarUltimoContato(atividade.clienteCnpj, novaDataRealizado)

  return atividade
}

export async function arquivarAtividade(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABELA)
    .update({ arquivado: true, arquivado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`Falha ao arquivar atividade: ${error.message}`)
}

// ─── Nome de exibição do usuário ──────────────────────────────────────────────
// usuario_id referencia auth.users(id). Não há FK entre usuarios_autorizados e
// auth.users (usuarios_autorizados é resolvido por e-mail em todo o resto do
// app — ver proxy.ts), então resolvemos sempre via e-mail: auth.admin.getUserById
// -> email -> usuarios_autorizados.nome. Fallback pro e-mail, depois pra
// 'Usuário' se a chamada admin falhar.
export async function resolverNomesUsuarios(usuarioIds: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(usuarioIds)]
  const mapa: Record<string, string> = {}
  if (unicos.length === 0) return mapa

  const resultados = await Promise.all(unicos.map(async (id): Promise<[string, string]> => {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
      if (error || !data.user?.email) return [id, 'Usuário']

      const email = data.user.email
      const { data: autorizado } = await supabaseAdmin
        .from('usuarios_autorizados')
        .select('nome')
        .eq('email', email)
        .maybeSingle()

      const nome = (autorizado as { nome: string | null } | null)?.nome
      return [id, nome || email]
    } catch {
      return [id, 'Usuário']
    }
  }))

  for (const [id, nome] of resultados) mapa[id] = nome
  return mapa
}

// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
// Guarda o refresh_token OAuth do Google Drive (conta pessoal, não service
// account — ver supabase/schema.sql, seção "integracoes_google_drive", para o
// motivo). Linha única (singleton): cada nova conexão substitui a anterior.
//
// usuario_id é o UUID real do Supabase Auth (session.user.id — vem do header
// x-user-id, injetado pelo proxy a partir de supabase.auth.getUser()), não o id
// de usuarios_autorizados (tabela própria da aplicação, chaveada por email) nem
// o email em si — a tabela exige uuid.

import { supabaseAdmin } from './supabase-admin'

const TABELA = 'integracoes_google_drive'

export interface StatusConexaoDrive {
  conectado: boolean
  conectadoPor: string | null // e-mail resolvido via Admin API a partir de usuario_id, só para exibição
  conectadoEm: string | null
}

export async function salvarRefreshToken(refreshToken: string, usuarioId: string): Promise<void> {
  // Singleton: apaga qualquer linha anterior antes de inserir a nova conexão.
  const { error: erroDelete } = await supabaseAdmin.from(TABELA).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (erroDelete) throw new Error(`Falha ao limpar conexão anterior do Google Drive: ${erroDelete.message}`)

  const { error } = await supabaseAdmin.from(TABELA).insert({
    refresh_token: refreshToken,
    usuario_id: usuarioId,
  })
  if (error) throw new Error(`Falha ao salvar conexão do Google Drive: ${error.message}`)
}

export async function obterRefreshToken(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('refresh_token')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Falha ao ler conexão do Google Drive: ${error.message}`)
  return (data as { refresh_token: string } | null)?.refresh_token ?? null
}

export async function obterStatusConexao(): Promise<StatusConexaoDrive> {
  const { data, error } = await supabaseAdmin
    .from(TABELA)
    .select('usuario_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Falha ao ler status de conexão do Google Drive: ${error.message}`)
  const row = data as { usuario_id: string; created_at: string } | null

  if (!row) return { conectado: false, conectadoPor: null, conectadoEm: null }

  // Resolve o e-mail só para exibição na tela — a tabela guarda apenas o uuid.
  let email: string | null = null
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.usuario_id)
    email = userData?.user?.email ?? null
  } catch {
    // Falha ao resolver e-mail não deve quebrar a exibição de status — mostra sem nome.
  }

  return {
    conectado: true,
    conectadoPor: email,
    conectadoEm: row.created_at,
  }
}

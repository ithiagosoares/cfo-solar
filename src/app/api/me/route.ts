import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data } = await supabaseAdmin
    .from('usuarios_autorizados')
    .select('email, role, nome')
    .eq('email', user.email)
    .single()

  if (!data) {
    return NextResponse.json({ error: 'Usuário não autorizado' }, { status: 403 })
  }

  return NextResponse.json({
    email: data.email,
    role: data.role as 'admin' | 'viewer',
    nome: data.nome ?? (user.user_metadata?.full_name as string | undefined) ?? data.email,
    avatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  })
}

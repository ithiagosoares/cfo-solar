import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data } = await supabaseAdmin
    .from('usuarios_autorizados')
    .select('role')
    .eq('email', user.email)
    .single()

  return data?.role === 'admin' ? user : null
}

export async function GET() {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('usuarios_autorizados')
    .select('id, email, role, comercial_role, nome, criado_em, criado_por')
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ usuarios: data })
}

export async function POST(request: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json() as { email?: string; role?: string; nome?: string; senha_temporaria?: string }
  const { email, role, nome, senha_temporaria } = body

  if (!email || !role || !['admin', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'email e role (admin|viewer) são obrigatórios' }, { status: 400 })
  }

  const emailNorm = email.toLowerCase().trim()

  let authUserId: string | undefined

  if (senha_temporaria) {
    if (senha_temporaria.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNorm,
      password: senha_temporaria,
      email_confirm: true,
    })
    if (authError) {
      const msg = authError.message.toLowerCase().includes('already been registered')
        ? 'Este email já possui uma conta no sistema de autenticação'
        : authError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    authUserId = authData.user.id
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios_autorizados')
    .insert({ email: emailNorm, role, nome: nome ?? null, criado_por: admin.email })
    .select()
    .single()

  if (error) {
    // Rollback: se criamos um usuário Auth mas o insert no DB falhou, remover o Auth user
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
    }
    const msg = error.code === '23505' ? 'Email já cadastrado' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ usuario: data, conta_auth_criada: !!senha_temporaria }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json() as { email?: string; comercial_role?: 'gestor' | null }
  const { email, comercial_role } = body

  if (!email) {
    return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })
  }
  if (comercial_role !== 'gestor' && comercial_role !== null && comercial_role !== undefined) {
    return NextResponse.json({ error: 'comercial_role deve ser "gestor" ou null' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios_autorizados')
    .update({ comercial_role: comercial_role ?? null })
    .eq('email', email.toLowerCase())
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ usuario: data })
}

export async function DELETE(request: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })

  const OWNER_EMAIL = 'thiago25.mss@gmail.com'
  const emailNorm = email.toLowerCase()

  if (emailNorm === OWNER_EMAIL) {
    return NextResponse.json({ error: 'Este usuário não pode ser removido' }, { status: 403 })
  }

  if (emailNorm === admin.email?.toLowerCase()) {
    return NextResponse.json({ error: 'Você não pode remover sua própria conta' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('usuarios_autorizados')
    .delete()
    .eq('email', email.toLowerCase())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

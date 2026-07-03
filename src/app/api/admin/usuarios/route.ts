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
    .select('id, email, role, nome, criado_em, criado_por')
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ usuarios: data })
}

export async function POST(request: NextRequest) {
  const admin = await verificarAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json() as { email?: string; role?: string; nome?: string }
  const { email, role, nome } = body

  if (!email || !role || !['admin', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'email e role (admin|viewer) são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios_autorizados')
    .insert({ email: email.toLowerCase().trim(), role, nome: nome ?? null, criado_por: admin.email })
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Email já cadastrado' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ usuario: data }, { status: 201 })
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

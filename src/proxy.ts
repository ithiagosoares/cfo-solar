import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROTAS_PUBLICAS = ['/login', '/auth/callback', '/acesso-negado']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (ROTAS_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              httpOnly: true,
            }),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  console.log('[proxy] sessão obtida:', user?.email ?? 'sem sessão')

  if (!user?.email) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  console.log('[proxy] verificando autorização para:', user.email)
  console.log('[proxy] SUPABASE_URL presente:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('[proxy] SERVICE_ROLE_KEY presente:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Verifica autorização em usuarios_autorizados via service_role (bypassa RLS)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: autorizado, error: erroQuery } = await admin
    .from('usuarios_autorizados')
    .select('role')
    .eq('email', user.email)
    .single()

  console.log('[proxy] resultado da query:', JSON.stringify({ data: autorizado, error: erroQuery }))

  if (!autorizado) {
    console.log('[proxy] redirecionando para acesso-negado — motivo:', 'usuário não encontrado na tabela')
    return NextResponse.redirect(new URL('/acesso-negado', request.url))
  }

  // Injeta role e email nos headers para uso em API routes / Server Components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-role', autorizado.role)
  requestHeaders.set('x-user-email', user.email)

  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } })

  // Copia cookies de sessão do response anterior (setados via setAll durante getUser)
  response.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  return finalResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|icon\\.png|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|login|auth|acesso-negado).*)',
  ],
}

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROTAS_PUBLICAS = ['/login', '/auth/callback', '/acesso-negado']

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Rede de segurança: Google às vezes redireciona o code para / em vez de /auth/callback
  if (pathname === '/' && searchParams.has('code')) {
    const callbackUrl = new URL('/auth/callback', request.url)
    searchParams.forEach((value, key) => callbackUrl.searchParams.set(key, value))
    return NextResponse.redirect(callbackUrl)
  }

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
    const redir = NextResponse.redirect(new URL('/login', request.url))
    redir.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    redir.headers.set('Pragma', 'no-cache')
    return redir
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
    .select('role, comercial_role, papel, vendedor_id')
    .eq('email', user.email)
    .single()

  console.log('[proxy] resultado da query:', JSON.stringify({ data: autorizado, error: erroQuery }))

  if (!autorizado) {
    console.log('[proxy] redirecionando para acesso-negado — motivo:', 'usuário não encontrado na tabela')
    const redir = NextResponse.redirect(new URL('/acesso-negado', request.url))
    redir.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    redir.headers.set('Pragma', 'no-cache')
    return redir
  }

  // Calcula o nível comercial (lógica legada — mantida para rotas do financeiro):
  //   admin financeiro → diretor comercial (acesso total)
  //   comercial_role='gestor' → gestor comercial
  //   null → sem acesso ao módulo comercial
  const comercialRole =
    autorizado.role === 'admin' ? 'diretor' :
    autorizado.comercial_role === 'gestor' ? 'gestor' :
    null

  // Papel único — novo sistema de controle de acesso comercial
  const papel = (autorizado.papel as string) ?? 'sem_acesso'
  const vendedorId = (autorizado.vendedor_id as string | null) ?? null

  // sem_acesso → bloqueia qualquer página autenticada; /acesso-negado já é rota pública
  if (papel === 'sem_acesso') {
    const redir = NextResponse.redirect(new URL('/acesso-negado', request.url))
    redir.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    redir.headers.set('Pragma', 'no-cache')
    return redir
  }

  // Módulo financeiro + página raiz original desativados — código mantido mas sem roteamento.
  // O Dashboard Comercial vive em /dashboard; a raiz (/) é a página original combinada, agora inativa.
  const APIS_FINANCEIRO = ['/api/analisar', '/api/historico', '/api/chat', '/api/comparativo']
  const eFinanceiro =
    pathname === '/' ||
    APIS_FINANCEIRO.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (eFinanceiro) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: false, error: 'Módulo desativado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const redir = NextResponse.redirect(new URL('/inicio', request.url))
    redir.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return redir
  }

  // Módulo legado Upper desativado — página /comercial removida do roteamento.
  // /comercial/upload (sistema de import de relatórios, Supabase) continua ativo.
  // /api/comercial (busca live da Upper) e /api/teste-upper ficam como código morto
  // mas inacessíveis via UI — limpeza definitiva em sprint posterior.
  const eComercialLegado =
    pathname === '/comercial' ||
    (pathname.startsWith('/comercial/') && !pathname.startsWith('/comercial/upload'))
  if (eComercialLegado) {
    const redir = NextResponse.redirect(new URL('/inicio', request.url))
    redir.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return redir
  }

  // Mapa de rotas gerenciadas — define quais papéis têm acesso a cada rota.
  // Verificação usa o prefixo mais específico (sorted by length desc), portanto
  // rotas mais longas têm precedência (ex: /clientes/cadastro antes de /clientes).
  const PAPEIS_POR_ROTA: Record<string, readonly string[]> = {
    '/orcamentos/cadastro': ['administrador', 'gestor', 'vendedor'],
    '/clientes/cadastro':   ['administrador', 'gestor', 'sdr', 'vendedor'],
    '/clientes/kanban':     ['administrador', 'gestor', 'sdr', 'vendedor'],
    '/admin/vendedores':    ['administrador'],
    '/admin/usuarios':      ['administrador'],
    '/comercial/upload':    ['administrador', 'gestor'],
    '/orcamentos':          ['administrador', 'gestor', 'vendedor'],
    '/dashboard':           ['administrador', 'gestor', 'vendedor'],
    '/vendas':              ['administrador', 'gestor', 'vendedor'],
    '/clientes':            ['administrador', 'gestor', 'sdr', 'vendedor'],
  }
  const rotasOrdenadas = Object.entries(PAPEIS_POR_ROTA)
    .sort(([a], [b]) => b.length - a.length)

  for (const [rota, papeis] of rotasOrdenadas) {
    if (pathname === rota || pathname.startsWith(rota + '/')) {
      if (!(papeis as string[]).includes(papel)) {
        // Papel sem permissão para esta rota → hub (não acesso-negado, que é só para sem_acesso)
        const redir = NextResponse.redirect(new URL('/inicio', request.url))
        redir.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
        return redir
      }
      break // rota mais específica encontrada, parar
    }
  }

  // Injeta role, email, nível comercial e papel nos headers para uso em API routes / Server Components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-role', autorizado.role)
  requestHeaders.set('x-user-email', user.email)
  requestHeaders.set('x-comercial-role', comercialRole ?? '')
  requestHeaders.set('x-papel', papel)
  requestHeaders.set('x-vendedor-id', vendedorId ?? '')

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

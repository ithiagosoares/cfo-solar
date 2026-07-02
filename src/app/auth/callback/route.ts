import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabaseResponse = NextResponse.redirect(new URL(next, origin))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options)
            })
          },
        },
      },
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[callback] sessão criada:', !!data.session, '| email:', data.session?.user?.email ?? 'n/a')

    if (!error) {
      return supabaseResponse
    }

    console.error('[callback] erro na troca de código:', error.message)
  }

  return NextResponse.redirect(new URL('/login?erro=callback_falhou', origin))
}

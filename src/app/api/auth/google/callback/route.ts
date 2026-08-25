// GET /api/auth/google/callback
//
// Troca o `code` do Google por um refresh_token e grava em
// integracoes_google_drive (substitui qualquer conexão anterior — singleton).
// Valida o `state` contra o cookie setado em /api/admin/google-drive/conectar
// para evitar que alguém force a vinculação de uma conta Google que não foi o
// próprio admin quem iniciou o fluxo. Caminho registrado como redirect URI
// autorizado no Google Cloud Console — não mover sem atualizar lá também.

import { getPapel } from '@/lib/comercial-auth'
import { salvarRefreshToken } from '@/lib/google-drive-integracao-repository'

function limparCookieState(): string {
  return 'gdrive_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
}

export async function GET(request: Request) {
  const papel = getPapel(request)
  if (papel !== 'administrador') {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const erroGoogle = url.searchParams.get('error')

  const cookieHeader = request.headers.get('cookie') ?? ''
  const stateCookie = cookieHeader.match(/gdrive_oauth_state=([^;]+)/)?.[1] ?? null

  if (erroGoogle) {
    return redirecionarComResultado('erro', `Autorização recusada pelo Google: ${erroGoogle}`)
  }
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return redirecionarComResultado('erro', 'Estado inválido — inicie a conexão novamente.')
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    return redirecionarComResultado('erro', 'Configuração OAuth incompleta no servidor.')
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    })

    if (!res.ok) {
      const texto = await res.text()
      console.error('[/api/auth/google/callback] falha ao trocar code:', texto)
      return redirecionarComResultado('erro', 'Falha ao trocar código de autorização com o Google.')
    }

    const json = await res.json() as { refresh_token?: string; access_token: string }
    if (!json.refresh_token) {
      return redirecionarComResultado(
        'erro',
        'Google não retornou refresh_token. Revogue o acesso em myaccount.google.com/permissions e tente conectar de novo.',
      )
    }

    const usuarioId = request.headers.get('x-user-id')
    if (!usuarioId) {
      return redirecionarComResultado('erro', 'Sessão sem x-user-id — não foi possível identificar o usuário.')
    }
    await salvarRefreshToken(json.refresh_token, usuarioId)

    return redirecionarComResultado('ok', 'Google Drive conectado com sucesso.')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/auth/google/callback] erro:', msg)
    return redirecionarComResultado('erro', msg)
  }
}

function redirecionarComResultado(status: 'ok' | 'erro', mensagem: string): Response {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const destino = new URL('/admin/google-drive', appUrl || 'http://localhost:3000')
  destino.searchParams.set('status', status)
  destino.searchParams.set('mensagem', mensagem)

  const headers = new Headers({ Location: destino.toString() })
  headers.append('Set-Cookie', limparCookieState())
  return new Response(null, { status: 302, headers })
}

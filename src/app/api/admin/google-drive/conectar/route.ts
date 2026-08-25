// GET /api/admin/google-drive/conectar
//
// Início do fluxo OAuth2 (conta Google pessoal, não service account — ver
// google-drive-client.ts para o motivo). Só administrador pode conectar/
// reconectar, já que troca a conta usada por TODO o sistema para armazenar PDFs
// de orçamento. Redireciona para a tela de consentimento do Google com
// access_type=offline + prompt=consent para garantir um refresh_token mesmo em
// reconexões (o Google só emite refresh_token na primeira autorização, a menos
// que prompt=consent force um novo).

import { randomBytes } from 'node:crypto'
import { getPapel } from '@/lib/comercial-auth'

export async function GET(request: Request) {
  const papel = getPapel(request)
  if (papel !== 'administrador') {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return Response.json(
      { ok: false, error: 'GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_REDIRECT_URI precisam estar definidos em .env.local' },
      { status: 500 },
    )
  }

  const state = randomBytes(24).toString('hex')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)

  const headers = new Headers({ Location: url.toString() })
  headers.append(
    'Set-Cookie',
    // Path=/ — o callback vive em /api/auth/google/callback, prefixo diferente
    // de onde este cookie é setado, então precisa ser legível em todo o site.
    `gdrive_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  )

  return new Response(null, { status: 302, headers })
}

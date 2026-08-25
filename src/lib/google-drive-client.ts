// Server-only. Nunca importar de 'use client'. Cliente mínimo para a Drive API v3
// usando OAuth2 de uma conta Google pessoal (não service account — testado e
// descartado: service account sem Shared Drive não tem quota de storage própria
// no Drive, erro 403 storageQuotaExceeded, limitação da API do Google). O fluxo
// de autorização (uma vez, via /api/admin/google-drive/conectar) grava um
// refresh_token em integracoes_google_drive; esta lib troca esse refresh_token
// por um access_token novo a cada chamada (com cache em memória por processo).
//
// Env vars necessárias (.env.local / Vercel):
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REDIRECT_URI     — precisa bater exatamente com o registrado
//                                   no Google Cloud Console (inclui protocolo,
//                                   host e path)
//   GOOGLE_DRIVE_FOLDER_ID        — pasta no Drive (da conta conectada) onde os
//                                   PDFs de orçamento são salvos

import { obterRefreshToken } from './google-drive-integracao-repository'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function lerCredenciaisOAuth(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET precisam estar definidos em .env.local')
  }
  return { clientId, clientSecret }
}

// Cache em memória do access_token dentro do mesmo processo/lambda — evita
// trocar o refresh_token a cada chamada dentro da mesma execução. Token dura
// ~1h, damos folga de 60s.
let tokenCache: { token: string; expiraEm: number } | null = null

async function obterAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.token

  const refreshToken = await obterRefreshToken()
  if (!refreshToken) {
    throw new Error(
      'Google Drive não está conectado. Peça a um administrador para acessar /admin/google-drive e conectar a conta.',
    )
  }

  const { clientId, clientSecret } = lerCredenciaisOAuth()

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    throw new Error(`Falha ao renovar acesso ao Google Drive: ${res.status} ${await res.text()}`)
  }

  const json = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { token: json.access_token, expiraEm: Date.now() + (json.expires_in - 60) * 1000 }
  return json.access_token
}

export interface ArquivoDriveEnviado {
  id: string
  webViewLink: string
}

export async function enviarPdfParaDrive(buffer: Buffer, nomeArquivo: string): Promise<ArquivoDriveEnviado> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID precisa estar definido em .env.local')

  const accessToken = await obterAccessToken()

  const metadata = { name: nomeArquivo, parents: [folderId] }
  const boundary = `gdrive-${Math.random().toString(36).slice(2)}`

  const corpo = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/pdf\r\n\r\n`,
      'utf-8',
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`, 'utf-8'),
  ])

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: corpo,
    },
  )

  if (!res.ok) {
    throw new Error(`Falha ao enviar PDF para o Google Drive: ${res.status} ${await res.text()}`)
  }

  return await res.json() as ArquivoDriveEnviado
}

export async function baixarPdfDoDrive(fileId: string): Promise<Buffer> {
  const accessToken = await obterAccessToken()

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Falha ao baixar PDF do Google Drive: ${res.status} ${await res.text()}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// GET /api/admin/google-drive/status — usado pela página /admin/google-drive
// para mostrar se há uma conta conectada, desde quando e por quem.

import { getPapel } from '@/lib/comercial-auth'
import { obterStatusConexao } from '@/lib/google-drive-integracao-repository'

export async function GET(request: Request) {
  const papel = getPapel(request)
  if (papel !== 'administrador') {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const status = await obterStatusConexao()
    return Response.json({ ok: true, status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

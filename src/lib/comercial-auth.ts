// Server-only. Nunca importar de 'use client'.
// Verifica o header x-comercial-role injetado pelo proxy.

export type ComercialRole = 'diretor' | 'gestor'

const ROLES_VALIDAS = new Set<string>(['diretor', 'gestor'])

export function getComercialRole(request: Request): ComercialRole | null {
  const role = request.headers.get('x-comercial-role') ?? ''
  return ROLES_VALIDAS.has(role) ? (role as ComercialRole) : null
}

// Retorna uma Response 403 se o usuário não tem acesso comercial, null caso contrário.
// Uso típico no início de cada handler:
//   const denied = requireComercialAccess(request)
//   if (denied) return denied
export function requireComercialAccess(request: Request): Response | null {
  if (getComercialRole(request) === null) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }
  return null
}

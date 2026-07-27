// Server-only. Nunca importar de 'use client'.
// Verifica os headers x-papel e x-comercial-role injetados pelo proxy.

export type Papel = 'administrador' | 'gestor' | 'sdr' | 'vendedor'
export type ComercialRole = 'diretor' | 'gestor'

const PAPEIS_COMERCIAIS = new Set<string>(['administrador', 'gestor', 'sdr', 'vendedor'])
const ROLES_VALIDAS = new Set<string>(['diretor', 'gestor'])

export function getPapel(request: Request): Papel | null {
  const papel = request.headers.get('x-papel') ?? ''
  return PAPEIS_COMERCIAIS.has(papel) ? (papel as Papel) : null
}

export function getVendedorId(request: Request): string | null {
  return request.headers.get('x-vendedor-id') || null
}

// Mantida para compatibilidade com código existente
export function getComercialRole(request: Request): ComercialRole | null {
  const role = request.headers.get('x-comercial-role') ?? ''
  return ROLES_VALIDAS.has(role) ? (role as ComercialRole) : null
}

// Retorna uma Response 403 se o usuário não tem acesso comercial, null caso contrário.
// Usa x-papel (novo sistema) com fallback para x-comercial-role (legado).
// Uso típico no início de cada handler:
//   const denied = requireComercialAccess(request)
//   if (denied) return denied
export function requireComercialAccess(request: Request): Response | null {
  if (getPapel(request) !== null) return null
  if (getComercialRole(request) !== null) return null
  return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
}

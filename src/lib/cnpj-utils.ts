// Helpers puros de CNPJ — sem dependência de Supabase, para poder ser usado tanto
// pelo repositório de clientes quanto por parsers (ex: pdf-orcamento-parser.ts)
// sem arrastar um client de banco só para normalizar uma string.

export function validarCNPJ(raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false

  const soma = (pesos: number[]) =>
    pesos.reduce((acc, w, i) => acc + Number(d[i]) * w, 0)
  const digito = (s: number) => { const r = s % 11; return r < 2 ? 0 : 11 - r }

  const d1 = digito(soma([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  const d2 = digito(soma([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))

  return Number(d[12]) === d1 && Number(d[13]) === d2
}

export function normalizarCNPJ(raw: string): string {
  return raw.replace(/\D/g, '')
}

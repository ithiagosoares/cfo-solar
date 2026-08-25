// Helpers de formatação numérica/data no padrão brasileiro, compartilhados entre
// parsers de relatório (HTML, PDF) — evita duplicar a mesma conta em dois lugares
// (CLAUDE.md, seção 7, regra 4).

// "1.234,56" → 1234.56   "1234.56" → 1234.56   "" → 0
export function parseValorBR(texto: string): number {
  const limpo = texto.trim().replace(/[^\d,.-]/g, '')
  if (!limpo) return 0
  // Formato BR: ponto = milhar, vírgula = decimal
  if (limpo.includes(',')) {
    return parseFloat(limpo.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(limpo) || 0
}

// "dd/mm/yyyy" → "YYYY-MM-DD". Retorna original se não parsear.
export function parseDataBR(texto: string): string {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return texto.trim()
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

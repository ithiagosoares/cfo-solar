// Pure, deterministic dictionary lookup — no AI call anywhere in this file. The
// colaboradora's manual classification (classificacaoManual) is the source of
// truth; this module only translates her wording into formal category keys using
// the 10 official rules as a translation dictionary, not as independent judgment.
// Extend MAPEAMENTO as new real-world terms are observed in spreadsheets.

export const SEM_CLASSIFICACAO_MANUAL = 'sem_classificacao_manual'

const MAPEAMENTO: Record<string, string> = {
  GIMENES: 'servico_da_divida',
  BARRAMARES: 'servico_da_divida',
  FGI: 'servico_da_divida',
  HERA: 'servico_da_divida',
  SOFTWARE: 'despesa_fixa',
  SALARIO: 'despesa_fixa',
  'PRO LABORE': 'pro_labore',
  ALUGUEL: 'despesa_fixa',
  COMBUSTIVEL: 'despesa_variavel',
  'VALE COMBUSTIVEL': 'despesa_variavel',
  'MATERIA PRIMA': 'despesa_variavel',
  FRETE: 'despesa_variavel',
  COMISSAO: 'despesa_variavel',
  INVESTIMENTO: 'capex',
  MAQUINA: 'capex',
  EQUIPAMENTO: 'capex',
  SECURITIZADORA: 'antecipacao_recebiveis',
  FIDC: 'antecipacao_recebiveis',
  'LIQUIDO DE DESCONTO': 'antecipacao_recebiveis',
  'SEL MIGRACAO': 'antecipacao_recebiveis',
  'CR COB BLOQ COMP CONF RECEBIMENTO': 'antecipacao_recebiveis',
  EMPRESTIMO: 'intercompany',
  'SSG SOLAR': 'intercompany',
  ALUMARKET: 'intercompany',
  LEVEL2: 'intercompany',
  'NI HAO': 'intercompany',

  // Termos adicionais observados nas planilhas reais (FECHAMENTO MAIO/ABRIL) —
  // todos recorrentes/rotineiros, por isso despesa_fixa ou despesa_variavel.
  INSS: 'despesa_fixa',
  FGTS: 'despesa_fixa',
  VT: 'despesa_fixa',
  'CESTA BASICA': 'despesa_fixa',
  RESCISAO: 'despesa_fixa',
  TARIFA: 'despesa_fixa',
  CONTABILIDADE: 'despesa_fixa',
  INTERNET: 'despesa_fixa',
  TELEFONE: 'despesa_fixa',
  'ENERGIA ELETRICA': 'despesa_fixa',
  'AGUA E ESGOTO': 'despesa_fixa',
  SEGURO: 'despesa_fixa',
  ALVARA: 'despesa_fixa',
  'CARTAO PONTO': 'despesa_fixa',
  'MEDICINA OCUPACIONAL': 'despesa_fixa',
  PEDAGIO: 'despesa_variavel',
  'PASSAGEM AEREA': 'despesa_variavel',
  HOTEL: 'despesa_variavel',
  LANCHES: 'despesa_variavel',
  FAXINA: 'despesa_variavel',
  'REEMBOLSO VIAGEM': 'despesa_variavel',
  'REEMBOLSO DESPESAS': 'despesa_variavel',
  PROPAGANDA: 'despesa_variavel',
  'USO E CONSUMO': 'despesa_variavel',
  CORREIOS: 'despesa_variavel',
  SUPERMERCADO: 'despesa_variavel',
  POSTO: 'despesa_variavel',
  'PAGAR ME': 'despesa_fixa',
  'TAR REG TIT COB': 'despesa_fixa',

  // Deduções específicas da plataforma Mercado Livre (canal Ni Hao/Level2, regra 3)
  // — texto gerado pela própria plataforma na ausência de uma classificação manual,
  // já que esse canal não tem coluna de classificação preenchida pela colaboradora.
  'MERCADO LI': 'despesa_variavel', // cobre "MERCADO LIVRE" e a variante "MERCADO LIBRE"
  'RESERVA POR VENDAS': 'despesa_variavel',
  'DEBITO POR DIVIDA': 'despesa_variavel',
  'DINHEIRO RETIDO': 'despesa_variavel',
  'ASSINATURA MELI': 'despesa_fixa',
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugificar(texto: string): string {
  return normalizar(texto).toLowerCase().replace(/\s+/g, '_')
}

// Normalized once at module load so dictionary keys tolerate accent/punctuation
// variants in the spreadsheet (e.g. "MATERIA- PRIMA", "PRO-LABORE", "SEL/MIGRACAO"
// all normalize to the same key as their canonical form above).
const MAPEAMENTO_NORMALIZADO: ReadonlyArray<readonly [string, string]> = Object.entries(MAPEAMENTO)
  .map(([chave, categoria]) => [normalizar(chave), categoria] as const)

function buscarCorrespondencia(textoNormalizado: string): string | null {
  if (!textoNormalizado) return null
  for (const [chave, categoria] of MAPEAMENTO_NORMALIZADO) {
    if (textoNormalizado.includes(chave)) return categoria
  }
  return null
}

/**
 * classificacaoManual is checked before descricao — it's the colaboradora's own
 * word, treated as source of truth. Falling back to descricao only matters for
 * the (rarer) rows where the manual column is blank but the bank's own text
 * already names the counterparty (e.g. "LIQUIDO DE DESCONTO" entradas, which the
 * colaboradora never tags manually).
 */
export function mapearCategoria(classificacaoManual: string, descricao: string): string {
  const manualNorm = normalizar(classificacaoManual)
  const descricaoNorm = normalizar(descricao)

  const porManual = buscarCorrespondencia(manualNorm)
  if (porManual) return porManual

  const porDescricao = buscarCorrespondencia(descricaoNorm)
  if (porDescricao) return porDescricao

  if (manualNorm) return slugificar(classificacaoManual)

  return SEM_CLASSIFICACAO_MANUAL
}

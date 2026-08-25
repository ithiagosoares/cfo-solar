// Cadastro manual e importação por PDF atendem só vendedores da Solar System —
// empresa é sempre derivada da filial, nunca escolhida à parte. Level2/Ni Hao/
// AluMarket só entram via upload de relatório do ERP (ver EMPRESAS_VALIDAS em
// /api/comercial/upload-relatorio/preview/route.ts).

export const FILIAIS = ['São Paulo', 'Paraná'] as const
export type Filial = typeof FILIAIS[number]

export const EMPRESA_POR_FILIAL: Record<Filial, string> = {
  'São Paulo': 'Solar System Matriz',
  'Paraná':    'Solar System Filial PR',
}

// UF extraída do cabeçalho do PDF/relatório (ex: "COLOMBO - PR - 83401520") → filial.
export const UF_PARA_FILIAL: Record<string, Filial> = {
  SP: 'São Paulo',
  PR: 'Paraná',
}

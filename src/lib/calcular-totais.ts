import type { LancamentoClassificadoV2 } from './classificador-ia-v2'

// Pure arithmetic over already-classified lançamentos — no AI calls happen here.

export interface TotalPorCategoria {
  categoria: string
  valor: number
  quantidade: number
}

export interface TotalPorEmpresa {
  empresa: string
  entradas: number
  saidas: number
  saldo: number
}

export interface TotaisCalculados {
  totalGeral: { entradas: number; saidas: number; saldo: number }
  porCategoria: TotalPorCategoria[]
  porEmpresa: TotalPorEmpresa[]
}

export function calcularTotais(lancamentos: LancamentoClassificadoV2[]): TotaisCalculados {
  const categorias = new Map<string, TotalPorCategoria>()
  const empresas = new Map<string, TotalPorEmpresa>()
  let entradasGeral = 0
  let saidasGeral = 0

  for (const l of lancamentos) {
    const cat = categorias.get(l.categoria) ?? { categoria: l.categoria, valor: 0, quantidade: 0 }
    cat.valor += l.valor
    cat.quantidade += 1
    categorias.set(l.categoria, cat)

    const emp = empresas.get(l.empresa) ?? { empresa: l.empresa, entradas: 0, saidas: 0, saldo: 0 }
    if (l.tipo === 'entrada') {
      emp.entradas += l.valor
      entradasGeral += l.valor
    } else {
      emp.saidas += l.valor
      saidasGeral += l.valor
    }
    emp.saldo = emp.entradas - emp.saidas
    empresas.set(l.empresa, emp)
  }

  return {
    totalGeral: { entradas: entradasGeral, saidas: saidasGeral, saldo: entradasGeral - saidasGeral },
    porCategoria: Array.from(categorias.values()).sort((a, b) => b.valor - a.valor),
    porEmpresa: Array.from(empresas.values()).sort((a, b) => b.entradas - a.entradas),
  }
}

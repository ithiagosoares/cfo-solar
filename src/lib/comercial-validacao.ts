// Validação de divergências entre relatórios comerciais.
// Comparação puramente aritmética — sem chamadas à API ou ao banco.
// A decisão de bloquear, avisar ou ignorar fica na camada de API.

import type { PedidoOrcamento, TotaisVendedor, RentabilidadeVendedor } from './comercial-relatorios-parser'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface Divergencia {
  vendedor: string
  valorPedidosFechados: number
  valorRelatorioVendas: number
  diferenca: number
  fonte: 'totais_vendedor' | 'rentabilidade_vendedor'
}

// ─── Validação ─────────────────────────────────────────────────────────────────

const TOLERANCIA = 0.01  // R$ 0,01 — cobre diferenças de arredondamento

export function validarDivergencias(
  pedidos: PedidoOrcamento[],
  totaisVendedor: TotaisVendedor[],
  rentabilidadeVendedor: RentabilidadeVendedor[],
): Divergencia[] {
  // Soma de valor onde situacao = 'FECHADO' por vendedor (lowercase para comparação)
  const fechadosPorVendedor = new Map<string, number>()
  for (const p of pedidos) {
    if (p.situacao === 'FECHADO') {
      const key = p.vendedor.trim().toLowerCase()
      fechadosPorVendedor.set(key, (fechadosPorVendedor.get(key) ?? 0) + p.valor)
    }
  }

  const divergencias: Divergencia[] = []

  // ── Comparar com totaisVendedor ────────────────────────────────────────────
  for (const t of totaisVendedor) {
    const key = t.vendedor.trim().toLowerCase()
    const valorFechado = fechadosPorVendedor.get(key) ?? 0
    const diff = Math.abs(valorFechado - t.valorTotal)
    if (diff > TOLERANCIA) {
      divergencias.push({
        vendedor: t.vendedor,
        valorPedidosFechados: valorFechado,
        valorRelatorioVendas: t.valorTotal,
        diferenca: diff,
        fonte: 'totais_vendedor',
      })
    }
  }

  // ── Comparar com rentabilidadeVendedor ─────────────────────────────────────
  for (const r of rentabilidadeVendedor) {
    const key = r.vendedor.trim().toLowerCase()
    const valorFechado = fechadosPorVendedor.get(key) ?? 0
    const diff = Math.abs(valorFechado - r.valorTotal)
    if (diff > TOLERANCIA) {
      divergencias.push({
        vendedor: r.vendedor,
        valorPedidosFechados: valorFechado,
        valorRelatorioVendas: r.valorTotal,
        diferenca: diff,
        fonte: 'rentabilidade_vendedor',
      })
    }
  }

  return divergencias
}

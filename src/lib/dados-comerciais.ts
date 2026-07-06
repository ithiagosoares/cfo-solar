import {
  PEDIDOS_MOCK,
  PESSOAS_MOCK,
  COMPRAS_MOCK,
  SALDO_ESTOQUE_MOCK,
  PRECO_UNITARIO_MOCK,
} from './upper-mock-data'
import type { PedidoUpper, PessoaUpper } from './upper-mock-data'
import type { PedidoUpperReal } from '@/types/upper'

export interface DadosComerciais {
  pedidos: PedidoUpper[]
  pessoas: PessoaUpper[]
  compras: typeof COMPRAS_MOCK
  saldoEstoque: typeof SALDO_ESTOQUE_MOCK
  // true enquanto os pedidos vierem do mock — a tela usa isso para decidir
  // se mostra o banner de "dados de demonstração" e o indicador de sincronização.
  origemMock: boolean
  // ISO timestamp da última sincronização com a Upper (só presente quando origemMock: false)
  sincronizadoEm?: string
}

// ─── Mapeamento de dados reais da Upper → PedidoUpper ─────────────────────────

function mapearSituacaoFaturamento(sit: string): string {
  const n = sit.toLowerCase()
  if (n === 'aguardando') return 'PENDENTE'
  if (n === 'faturado') return 'FATURADO'
  return 'EM_PRODUCAO'
}

function mapearPedidoReal(p: PedidoUpperReal): PedidoUpper {
  return {
    id: p.id,
    idCliente: 0, // não disponível na estrutura real do /pedido
    nomeCliente: p.destinatario.xNome || p.destinatario.xFant || '(sem identificação)',
    dataCadastro: p.dataEmissao || p.ide?.dhEmi || '',
    dataPrevisaoEntrega: p.dataEmissao || p.ide?.dhEmi || '', // não disponível na listagem
    situacaoFaturamento: mapearSituacaoFaturamento(p.situacaoFaturamento),
    itens: [], // sempre vazio na listagem geral — só disponível em /pedido/:id
    valorDocumento: p.total?.valorDocumento,
  }
}

// ─── calcularValorPedido ──────────────────────────────────────────────────────
// Quando o pedido vem da API real, usa total.valorDocumento (campo confirmado).
// Quando vem do mock (itens detalhados disponíveis), calcula via PRECO_UNITARIO_MOCK.
export function calcularValorPedido(pedido: PedidoUpper): number {
  if (pedido.valorDocumento != null) return pedido.valorDocumento
  return pedido.itens.reduce((soma, item) => {
    const preco = PRECO_UNITARIO_MOCK[item.referenciaProduto] ?? 0
    return soma + item.quantidade * preco
  }, 0)
}

// ─── calcularCurvaABCD ────────────────────────────────────────────────────────
// Pareto / Curva ABC adaptada para 4 faixas:
//   A: clientes que representam os primeiros 50% do faturamento acumulado
//   B: de 50% até 80%
//   C: de 80% até 95%
//   D: os últimos 5% (menor representatividade)
// Usa "pessoas" como lista canônica de clientes para evitar nomes divergentes
// entre pedidos. Clientes do cadastro sem nenhum pedido são excluídos, pois
// 0% de participação não é atribuível a nenhuma faixa de Pareto.
export interface ClienteCurvaABCD {
  nome: string
  cidade: string | null
  valorTotal: number
  percentualFaturamento: number
  percentualAcumulado: number
  curva: 'A' | 'B' | 'C' | 'D'
}

export function calcularCurvaABCD(pedidos: PedidoUpper[], pessoas: PessoaUpper[]): ClienteCurvaABCD[] {
  const clientesConhecidos = new Map(
    pessoas.filter(p => p.tipo === 'cliente').map(p => [p.nome, p]),
  )

  const valorPorCliente = new Map<string, number>()
  for (const pedido of pedidos) {
    const valor = calcularValorPedido(pedido)
    if (valor === 0) continue
    valorPorCliente.set(pedido.nomeCliente, (valorPorCliente.get(pedido.nomeCliente) ?? 0) + valor)
  }

  const totalGeral = Array.from(valorPorCliente.values()).reduce((s, v) => s + v, 0)
  const ordenado = Array.from(valorPorCliente.entries()).sort((a, b) => b[1] - a[1])

  let acumulado = 0
  return ordenado.map(([nome, valorTotal]) => {
    const percentualFaturamento = totalGeral > 0 ? (valorTotal / totalGeral) * 100 : 0
    acumulado += percentualFaturamento
    const curva: 'A' | 'B' | 'C' | 'D' =
      acumulado <= 50 ? 'A'
      : acumulado <= 80 ? 'B'
      : acumulado <= 95 ? 'C'
      : 'D'
    return {
      nome,
      cidade: clientesConhecidos.get(nome)?.cidade ?? null,
      valorTotal,
      percentualFaturamento,
      percentualAcumulado: acumulado,
      curva,
    }
  })
}

// ─── buscarDadosComerciais ────────────────────────────────────────────────────
// Chama /api/comercial (route handler server-side) para buscar pedidos reais
// da Upper. Em caso de qualquer erro, cai silenciosamente no mock para que
// a tela nunca fique em branco por instabilidade da API.
//
// Pessoas, compras e estoque continuam mock até que os endpoints da Upper
// sejam validados.
export async function buscarDadosComerciais(): Promise<DadosComerciais> {
  try {
    const res = await fetch('/api/comercial', { cache: 'no-store' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
    }
    const json = await res.json() as { ok: boolean; pedidos?: PedidoUpperReal[]; sincronizadoEm?: string; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'Falha ao buscar pedidos reais')

    const pedidos = (json.pedidos ?? []).map(mapearPedidoReal)
    return {
      pedidos,
      pessoas: PESSOAS_MOCK,
      compras: COMPRAS_MOCK,
      saldoEstoque: SALDO_ESTOQUE_MOCK,
      origemMock: false,
      sincronizadoEm: json.sincronizadoEm ?? new Date().toISOString(),
    }
  } catch (e) {
    console.error('[dados-comerciais] Fallback para mock — erro ao buscar dados reais:', e instanceof Error ? e.message : String(e))
    return {
      pedidos: PEDIDOS_MOCK,
      pessoas: PESSOAS_MOCK,
      compras: COMPRAS_MOCK,
      saldoEstoque: SALDO_ESTOQUE_MOCK,
      origemMock: true,
    }
  }
}

// Decide se os dados extraídos de um PDF de orçamento correspondem com segurança
// a um pedido já cadastrado. Não é match exato — número do pedido é a chave forte
// (quando presente nos dois lados), data e valor entram com tolerância (o PDF pode
// ter sido reimpresso em outro dia, ou o valor pode ter arredondamento de centavos).

import type { DadosExtraidosOrcamento } from './pdf-orcamento-parser'
import type { PedidoResumo } from './comercial-pedidos-repository'

export type StatusCorrespondencia = 'segura' | 'duvidosa'

export interface ResultadoCorrespondencia {
  status: StatusCorrespondencia
  motivos: string[]
}

const TOLERANCIA_DIAS = 3
const TOLERANCIA_VALOR_PERCENTUAL = 0.01
const TOLERANCIA_VALOR_MINIMA = 1

function diasEntre(isoA: string, isoB: string): number {
  const a = new Date(isoA + 'T00:00:00Z').getTime()
  const b = new Date(isoB + 'T00:00:00Z').getTime()
  return Math.abs(a - b) / (1000 * 60 * 60 * 24)
}

export function avaliarCorrespondencia(
  extraido: DadosExtraidosOrcamento,
  pedido: Pick<PedidoResumo, 'numeroPedido' | 'dataOrcamento' | 'valorOrcado'>,
): ResultadoCorrespondencia {
  const motivos: string[] = []

  // Pedidos antigos, cadastrados manualmente antes de numero_pedido virar obrigatório
  // no formulário (ver ModalNovoOrcamento), podem não ter esse campo preenchido.
  // Nesse caso a ausência não deve, sozinha, empurrar o resultado para
  // "duvidosa": data+valor batendo bem já é evidência suficiente. Só penaliza quando
  // os dois lados têm número e eles divergem.
  const numeroPresente = extraido.numeroPedido !== null && pedido.numeroPedido !== null
  const numeroOk = !numeroPresente || extraido.numeroPedido === pedido.numeroPedido
  if (numeroPresente && !numeroOk) motivos.push('Número do pedido não corresponde')
  if (!numeroPresente) motivos.push('Número do pedido não pôde ser comparado')

  let dataOk = true
  if (extraido.dataOrcamento && pedido.dataOrcamento) {
    const diff = diasEntre(extraido.dataOrcamento, pedido.dataOrcamento)
    dataOk = diff <= TOLERANCIA_DIAS
    if (!dataOk) motivos.push(`Data do orçamento diverge em ${Math.round(diff)} dia(s)`)
  }

  let valorOk = true
  if (extraido.valorTotal !== null) {
    const diff = Math.abs(extraido.valorTotal - pedido.valorOrcado)
    const tolerancia = Math.max(TOLERANCIA_VALOR_MINIMA, pedido.valorOrcado * TOLERANCIA_VALOR_PERCENTUAL)
    valorOk = diff <= tolerancia
    if (!valorOk) motivos.push('Valor total diverge do valor orçado')
  }

  const segura = numeroOk && dataOk && valorOk
  return { status: segura ? 'segura' : 'duvidosa', motivos: segura ? [] : motivos }
}

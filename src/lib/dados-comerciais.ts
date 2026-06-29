import { PEDIDOS_MOCK, PESSOAS_MOCK, COMPRAS_MOCK, SALDO_ESTOQUE_MOCK } from './upper-mock-data'
import type { PedidoUpper, PessoaUpper, CompraUpper, SaldoEstoqueUpper } from './upper-mock-data'

export interface DadosComerciais {
  pedidos: PedidoUpper[]
  pessoas: PessoaUpper[]
  compras: CompraUpper[]
  saldoEstoque: SaldoEstoqueUpper[]
  // true enquanto os dados vierem do mock — a tela usa isso só para decidir
  // se mostra o banner de "dados de demonstração".
  origemMock: boolean
}

// Único ponto de acesso a dados comerciais usado pela tela /comercial. Hoje
// retorna o mock porque a API da Upper está com erro 500 de infraestrutura
// do lado deles (ver upper-client.ts). Quando eles resolverem, troca-se só o
// corpo desta função para chamar buscarPedidos()/buscarPessoas()/
// buscarCompras()/buscarSaldoEstoque() de upper-client.ts — a tela em si não
// precisa mudar.
export async function buscarDadosComerciais(): Promise<DadosComerciais> {
  return {
    pedidos: PEDIDOS_MOCK,
    pessoas: PESSOAS_MOCK,
    compras: COMPRAS_MOCK,
    saldoEstoque: SALDO_ESTOQUE_MOCK,
    origemMock: true,
  }
}

// Tipos que refletem a estrutura REAL confirmada da API Upper Softwares
// (web.uppersoftwares.com.br:4480/api/v1). Estes tipos são server-side only
// e jamais devem ser importados de um componente 'use client'.

export interface PedidoUpperReal {
  id: string
  usuarioId: string | null
  // Sempre null no momento — vendedor não disponível via API (confirmado)
  usuarioResponsavelId: string | null
  status: string
  situacaoFinanceiro: string
  situacaoFaturamento: string
  empresaId: string
  dataEmissao: string
  ide: { dhEmi: string }
  destinatario: {
    xNome: string
    xFant: string
    cnpjCpf: string
  }
  total: {
    valorDocumento: number
  }
  // Sempre vazio na listagem geral — itens só vêm no endpoint /pedido/:id
  itens: unknown[]
  createdAt: string
  updatedAt: string
}

export interface RespostaPaginadaUpper {
  registros: number
  pagina: number
  totalRegistros: number
  // O campo que contém o array de itens varia — confirmado 'itens' na Upper
  data?: unknown[]
  pedidos?: unknown[]
  itens?: unknown[]
  items?: unknown[]
  result?: unknown[]
  lista?: unknown[]
}

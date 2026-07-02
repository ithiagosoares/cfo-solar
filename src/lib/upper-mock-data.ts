// Dados fictícios para a tela Comercial, usados enquanto a API da Upper
// Softwares não libera dados reais (erro 500 de infraestrutura do lado deles
// — ver upper-client.ts). O formato de PedidoUpper segue EXATAMENTE o Swagger
// confirmado pela Upper. PessoaUpper/CompraUpper/SaldoEstoqueUpper ainda não
// têm a estrutura real confirmada — os nomes de campo aqui são um palpite
// razoável e devem ser ajustados quando soubermos o formato real.

export interface ItemPedidoUpper {
  idProduto: number
  idVariacaoProduto: number
  nomeCompletoProduto: string
  referenciaProduto: string
  uniMedProduto: string
  quantidade: number
  id: string
}

export interface PedidoUpper {
  dataCadastro: string
  idCliente: number
  nomeCliente: string
  dataPrevisaoEntrega: string
  situacaoFaturamento: string
  itens: ItemPedidoUpper[]
  id: string
  // Valor monetário real do documento — preenchido quando vem da API Upper
  // (total.valorDocumento). Undefined quando vem do mock (usa PRECO_UNITARIO_MOCK).
  valorDocumento?: number
}

export interface PessoaUpper {
  id: string
  nome: string
  tipo: 'cliente' | 'fornecedor'
  cidade: string
}

export interface CompraUpper {
  id: string
  fornecedor: string
  data: string
  valor: number
  produto: string
}

export interface SaldoEstoqueUpper {
  id: string
  produto: string
  quantidade: number
  local: string
}

function item(idProduto: number, nomeCompletoProduto: string, referenciaProduto: string, uniMedProduto: string, quantidade: number, idVariacaoProduto = 0): ItemPedidoUpper {
  return { idProduto, idVariacaoProduto, nomeCompletoProduto, referenciaProduto, uniMedProduto, quantidade, id: `ITM-${idProduto}-${quantidade}` }
}

export const PEDIDOS_MOCK: PedidoUpper[] = [
  {
    id: 'PED-0001', idCliente: 1, nomeCliente: 'Neo Solar Distribuidora',
    dataCadastro: '2026-06-28T09:15:00.000Z', dataPrevisaoEntrega: '2026-07-10T00:00:00.000Z',
    situacaoFaturamento: 'PENDENTE',
    itens: [item(1, 'Perfil de Alumínio 40mm', 'PA-040', 'M', 120), item(3, 'Parafuso Inox M8', 'PI-M8', 'PC', 500)],
  },
  {
    id: 'PED-0002', idCliente: 2, nomeCliente: 'Route 66 Energia',
    dataCadastro: '2026-06-27T11:40:00.000Z', dataPrevisaoEntrega: '2026-07-05T00:00:00.000Z',
    situacaoFaturamento: 'FATURADO',
    itens: [item(5, 'Suporte Triangular', 'ST-001', 'PC', 80)],
  },
  {
    id: 'PED-0003', idCliente: 3, nomeCliente: 'Polimax Estruturas',
    dataCadastro: '2026-06-26T14:11:35.044Z', dataPrevisaoEntrega: '2026-07-08T00:00:00.000Z',
    situacaoFaturamento: 'EM_PRODUCAO',
    itens: [item(2, 'Perfil de Alumínio 60mm', 'PA-060', 'M', 200), item(7, 'Grampo de Fixação', 'GF-003', 'PC', 300), item(4, 'Parafuso Inox M10', 'PI-M10', 'PC', 600)],
  },
  {
    id: 'PED-0004', idCliente: 4, nomeCliente: 'Aurora Energia Renovável',
    dataCadastro: '2026-06-25T08:05:00.000Z', dataPrevisaoEntrega: '2026-07-02T00:00:00.000Z',
    situacaoFaturamento: 'PENDENTE',
    itens: [item(8, 'Trilho de Fixação', 'TF-004', 'M', 150)],
  },
  {
    id: 'PED-0005', idCliente: 5, nomeCliente: 'Helios Metalúrgica',
    dataCadastro: '2026-06-24T16:30:00.000Z', dataPrevisaoEntrega: '2026-07-01T00:00:00.000Z',
    situacaoFaturamento: 'FATURADO',
    itens: [item(9, 'Conector MC4', 'CMC4', 'PC', 1000), item(10, 'Mão Francesa', 'MF-005', 'PC', 40)],
  },
  {
    id: 'PED-0006', idCliente: 6, nomeCliente: 'Solaris Construções',
    dataCadastro: '2026-06-23T10:20:00.000Z', dataPrevisaoEntrega: '2026-07-06T00:00:00.000Z',
    situacaoFaturamento: 'EM_PRODUCAO',
    itens: [item(6, 'Suporte para Telha Cerâmica', 'STC-002', 'PC', 60), item(3, 'Parafuso Inox M8', 'PI-M8', 'PC', 240)],
  },
  {
    id: 'PED-0007', idCliente: 7, nomeCliente: 'Vortex Energia Solar',
    dataCadastro: '2026-06-21T13:00:00.000Z', dataPrevisaoEntrega: '2026-06-30T00:00:00.000Z',
    situacaoFaturamento: 'PENDENTE',
    itens: [item(1, 'Perfil de Alumínio 40mm', 'PA-040', 'M', 90)],
  },
  {
    id: 'PED-0008', idCliente: 8, nomeCliente: 'Bravo Estruturas Metálicas',
    dataCadastro: '2026-06-20T09:45:00.000Z', dataPrevisaoEntrega: '2026-07-03T00:00:00.000Z',
    situacaoFaturamento: 'FATURADO',
    itens: [item(11, 'Arruela de Vedação', 'AV-006', 'PC', 800), item(4, 'Parafuso Inox M10', 'PI-M10', 'PC', 400), item(7, 'Grampo de Fixação', 'GF-003', 'PC', 150)],
  },
  {
    id: 'PED-0009', idCliente: 9, nomeCliente: 'Zenith Solar Projetos',
    dataCadastro: '2026-06-19T15:10:00.000Z', dataPrevisaoEntrega: '2026-06-29T00:00:00.000Z',
    situacaoFaturamento: 'EM_PRODUCAO',
    itens: [item(10, 'Mão Francesa', 'MF-005', 'PC', 60)],
  },
  {
    id: 'PED-0010', idCliente: 10, nomeCliente: 'Tucano Engenharia Solar',
    dataCadastro: '2026-06-18T08:30:00.000Z', dataPrevisaoEntrega: '2026-07-01T00:00:00.000Z',
    situacaoFaturamento: 'PENDENTE',
    itens: [item(5, 'Suporte Triangular', 'ST-001', 'PC', 110), item(8, 'Trilho de Fixação', 'TF-004', 'M', 70)],
  },
  {
    id: 'PED-0011', idCliente: 11, nomeCliente: 'Millenium Energia',
    dataCadastro: '2026-06-16T12:00:00.000Z', dataPrevisaoEntrega: '2026-06-28T00:00:00.000Z',
    situacaoFaturamento: 'FATURADO',
    itens: [item(2, 'Perfil de Alumínio 60mm', 'PA-060', 'M', 180)],
  },
  {
    id: 'PED-0012', idCliente: 12, nomeCliente: 'ER Projetos Solares',
    dataCadastro: '2026-06-15T17:20:00.000Z', dataPrevisaoEntrega: '2026-06-27T00:00:00.000Z',
    situacaoFaturamento: 'FATURADO',
    itens: [item(3, 'Parafuso Inox M8', 'PI-M8', 'PC', 320), item(9, 'Conector MC4', 'CMC4', 'PC', 450)],
  },
  {
    id: 'PED-0013', idCliente: 1, nomeCliente: 'Neo Solar Distribuidora',
    dataCadastro: '2026-06-13T09:00:00.000Z', dataPrevisaoEntrega: '2026-06-25T00:00:00.000Z',
    situacaoFaturamento: 'EM_PRODUCAO',
    itens: [item(7, 'Grampo de Fixação', 'GF-003', 'PC', 220)],
  },
  {
    id: 'PED-0014', idCliente: 2, nomeCliente: 'Route 66 Energia',
    dataCadastro: '2026-06-11T10:40:00.000Z', dataPrevisaoEntrega: '2026-06-24T00:00:00.000Z',
    situacaoFaturamento: 'PENDENTE',
    itens: [item(1, 'Perfil de Alumínio 40mm', 'PA-040', 'M', 60), item(6, 'Suporte para Telha Cerâmica', 'STC-002', 'PC', 40)],
  },
  {
    id: 'PED-0015', idCliente: 3, nomeCliente: 'Polimax Estruturas',
    dataCadastro: '2026-06-09T14:25:00.000Z', dataPrevisaoEntrega: '2026-06-20T00:00:00.000Z',
    situacaoFaturamento: 'FATURADO',
    itens: [item(4, 'Parafuso Inox M10', 'PI-M10', 'PC', 500)],
  },
  {
    id: 'PED-0016', idCliente: 4, nomeCliente: 'Aurora Energia Renovável',
    dataCadastro: '2026-06-06T11:15:00.000Z', dataPrevisaoEntrega: '2026-06-18T00:00:00.000Z',
    situacaoFaturamento: 'FATURADO',
    itens: [item(8, 'Trilho de Fixação', 'TF-004', 'M', 100), item(9, 'Conector MC4', 'CMC4', 'PC', 300), item(10, 'Mão Francesa', 'MF-005', 'PC', 25), item(11, 'Arruela de Vedação', 'AV-006', 'PC', 600)],
  },
  {
    id: 'PED-0017', idCliente: 5, nomeCliente: 'Helios Metalúrgica',
    dataCadastro: '2026-06-03T09:50:00.000Z', dataPrevisaoEntrega: '2026-06-15T00:00:00.000Z',
    situacaoFaturamento: 'EM_PRODUCAO',
    itens: [item(5, 'Suporte Triangular', 'ST-001', 'PC', 70)],
  },
  {
    id: 'PED-0018', idCliente: 6, nomeCliente: 'Solaris Construções',
    dataCadastro: '2026-05-31T08:00:00.000Z', dataPrevisaoEntrega: '2026-06-12T00:00:00.000Z',
    situacaoFaturamento: 'PENDENTE',
    itens: [item(2, 'Perfil de Alumínio 60mm', 'PA-060', 'M', 140), item(3, 'Parafuso Inox M8', 'PI-M8', 'PC', 280)],
  },
]

export const PESSOAS_MOCK: PessoaUpper[] = [
  { id: 'PES-01', nome: 'Neo Solar Distribuidora', tipo: 'cliente', cidade: 'Curitiba' },
  { id: 'PES-02', nome: 'Route 66 Energia', tipo: 'cliente', cidade: 'Londrina' },
  { id: 'PES-03', nome: 'Polimax Estruturas', tipo: 'cliente', cidade: 'São Paulo' },
  { id: 'PES-04', nome: 'Aurora Energia Renovável', tipo: 'cliente', cidade: 'Maringá' },
  { id: 'PES-05', nome: 'Helios Metalúrgica', tipo: 'cliente', cidade: 'Joinville' },
  { id: 'PES-06', nome: 'Solaris Construções', tipo: 'cliente', cidade: 'Curitiba' },
  { id: 'PES-07', nome: 'Vortex Energia Solar', tipo: 'cliente', cidade: 'Cascavel' },
  { id: 'PES-08', nome: 'Bravo Estruturas Metálicas', tipo: 'cliente', cidade: 'Ponta Grossa' },
  { id: 'PES-09', nome: 'Zenith Solar Projetos', tipo: 'cliente', cidade: 'Florianópolis' },
  { id: 'PES-10', nome: 'Tucano Engenharia Solar', tipo: 'cliente', cidade: 'Campo Grande' },
  { id: 'PES-11', nome: 'Millenium Energia', tipo: 'cliente', cidade: 'Goiânia' },
  { id: 'PES-12', nome: 'ER Projetos Solares', tipo: 'cliente', cidade: 'Belo Horizonte' },
  { id: 'PES-13', nome: 'Metalúrgica Sul Alumínio', tipo: 'fornecedor', cidade: 'Joinville' },
  { id: 'PES-14', nome: 'Parafusos Brasil Ltda', tipo: 'fornecedor', cidade: 'São Paulo' },
  { id: 'PES-15', nome: 'Aço Forte Distribuidora', tipo: 'fornecedor', cidade: 'Curitiba' },
  { id: 'PES-16', nome: 'Inox Premium Fixadores', tipo: 'fornecedor', cidade: 'Blumenau' },
]

export const COMPRAS_MOCK: CompraUpper[] = [
  { id: 'COM-01', fornecedor: 'Metalúrgica Sul Alumínio', data: '2026-06-20T10:00:00.000Z', valor: 48500, produto: 'Perfil de Alumínio 40mm' },
  { id: 'COM-02', fornecedor: 'Metalúrgica Sul Alumínio', data: '2026-06-12T10:00:00.000Z', valor: 32100, produto: 'Perfil de Alumínio 60mm' },
  { id: 'COM-03', fornecedor: 'Metalúrgica Sul Alumínio', data: '2026-05-30T10:00:00.000Z', valor: 27800, produto: 'Trilho de Fixação' },
  { id: 'COM-04', fornecedor: 'Parafusos Brasil Ltda', data: '2026-06-22T10:00:00.000Z', valor: 9800, produto: 'Parafuso Inox M8' },
  { id: 'COM-05', fornecedor: 'Parafusos Brasil Ltda', data: '2026-06-14T10:00:00.000Z', valor: 11200, produto: 'Parafuso Inox M10' },
  { id: 'COM-06', fornecedor: 'Parafusos Brasil Ltda', data: '2026-06-02T10:00:00.000Z', valor: 6400, produto: 'Arruela de Vedação' },
  { id: 'COM-07', fornecedor: 'Aço Forte Distribuidora', data: '2026-06-18T10:00:00.000Z', valor: 21300, produto: 'Suporte Triangular' },
  { id: 'COM-08', fornecedor: 'Aço Forte Distribuidora', data: '2026-06-05T10:00:00.000Z', valor: 14750, produto: 'Suporte para Telha Cerâmica' },
  { id: 'COM-09', fornecedor: 'Inox Premium Fixadores', data: '2026-06-24T10:00:00.000Z', valor: 8900, produto: 'Grampo de Fixação' },
  { id: 'COM-10', fornecedor: 'Inox Premium Fixadores', data: '2026-06-10T10:00:00.000Z', valor: 5600, produto: 'Mão Francesa' },
  { id: 'COM-11', fornecedor: 'Inox Premium Fixadores', data: '2026-05-28T10:00:00.000Z', valor: 13400, produto: 'Conector MC4' },
]

export const SALDO_ESTOQUE_MOCK: SaldoEstoqueUpper[] = [
  { id: 'EST-01', produto: 'Perfil de Alumínio 40mm', quantidade: 340, local: 'Galpão 1' },
  { id: 'EST-02', produto: 'Perfil de Alumínio 60mm', quantidade: 185, local: 'Galpão 1' },
  { id: 'EST-03', produto: 'Parafuso Inox M8', quantidade: 1250, local: 'Galpão 2' },
  { id: 'EST-04', produto: 'Parafuso Inox M10', quantidade: 7, local: 'Galpão 2' },
  { id: 'EST-05', produto: 'Suporte Triangular', quantidade: 92, local: 'Galpão 1' },
  { id: 'EST-06', produto: 'Suporte para Telha Cerâmica', quantidade: 4, local: 'Galpão 1' },
  { id: 'EST-07', produto: 'Grampo de Fixação', quantidade: 410, local: 'Galpão 2' },
  { id: 'EST-08', produto: 'Trilho de Fixação', quantidade: 9, local: 'Galpão 1' },
  { id: 'EST-09', produto: 'Conector MC4', quantidade: 880, local: 'Galpão 3' },
  { id: 'EST-10', produto: 'Mão Francesa', quantidade: 6, local: 'Galpão 1' },
  { id: 'EST-11', produto: 'Arruela de Vedação', quantidade: 520, local: 'Galpão 3' },
]

// Preço unitário fictício por referência de produto — usado EXCLUSIVAMENTE
// para calcular valores monetários ilustrativos nas seções de demonstração
// (Performance por Vendedor, Curva ABCD). O schema real do PedidoUpper
// (confirmado no Swagger) não tem campo de preço por item nem por pedido —
// só quantidade. Os valores calculados a partir daqui são ILUSTRATIVOS e
// aparecem apenas em contexto de demonstração já explicitamente sinalizado.
export const PRECO_UNITARIO_MOCK: Record<string, number> = {
  'PA-040':  38,    // Perfil de Alumínio 40mm (por metro)
  'PA-060':  52,    // Perfil de Alumínio 60mm (por metro)
  'PI-M8':   0.45,  // Parafuso Inox M8 (por peça)
  'PI-M10':  0.65,  // Parafuso Inox M10 (por peça)
  'ST-001':  24,    // Suporte Triangular (por peça)
  'STC-002': 19,    // Suporte para Telha Cerâmica (por peça)
  'GF-003':  3.20,  // Grampo de Fixação (por peça)
  'TF-004':  22,    // Trilho de Fixação (por metro)
  'CMC4':    8.50,  // Conector MC4 (por peça)
  'MF-005':  14,    // Mão Francesa (por peça)
  'AV-006':  0.30,  // Arruela de Vedação (por peça)
}

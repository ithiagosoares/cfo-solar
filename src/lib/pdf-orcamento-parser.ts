// Parser determinístico para o PDF de "Orçamento" gerado pelo ERP (SSG). Nenhuma
// chamada à IA — extração 100% baseada em texto + coordenadas (x,y) dos itens de
// texto do PDF, via pdfjs-dist. Ver CLAUDE.md, seção 6, para as lições equivalentes
// já aprendidas com os relatórios HTML (que se aplicam aqui: nunca confiar em ordem/
// posição fixa de coluna, resolver por conteúdo/rótulo real).
//
// Estrutura conhecida do PDF de orçamento (ver amostra "Orçamento 1503 - Megassolar"):
//   - Cabeçalho: "Pedido: <n> Data: <dd/mm/aaaa> Vendedor: <nome completo>"
//   - Cliente:   "Código/Nome: <cod>-<razão social> CPF/CNPJ: <cnpj> ..."
//   - Tabela "Itens do pedido": Código | Nome do Produto | Quantidade | Un. | Vlr. Unit. | Vlr. Sub-total
//   - PEGADINHA: cada item pode ter uma sub-tabela "Composição do item" logo abaixo
//     (nome do componente | Un. | Quantidade) — é a composição interna do kit, NÃO é
//     um item do pedido. Distinguimos pela forma da linha, não por estado/flag: uma
//     linha de item real começa com um código numérico isolado e tem 4 campos finais
//     (quantidade, un, vlr. unit., vlr. sub-total); uma linha de composição não tem
//     código numérico no início e só tem 2 campos finais (un, quantidade).
//   - Totais: tabela rótulo/valor onde a linha cujo primeiro campo é exatamente
//     "Total:" (não "Sub-Total:") traz o valor total do orçamento.

import { parseValorBR, parseDataBR } from './formato-br'
import { normalizarCNPJ } from './cnpj-utils'
import { UF_PARA_FILIAL, type Filial } from './empresa-filial'
import path from 'node:path'

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface ItemExtraido {
  codigo: string | null
  descricao: string
  quantidade: number
  unidade: string | null
  valorUnitario: number
  valorTotal: number
}

export interface DadosExtraidosOrcamento {
  numeroPedido: string | null
  dataOrcamento: string | null   // ISO (YYYY-MM-DD)
  vendedorNomeExtraido: string | null
  clienteNome: string | null
  clienteCnpj: string | null     // normalizado, só dígitos
  valorTotal: number | null
  filial: Filial | null          // derivada da UF no cabeçalho do emitente (ver extrairFilial)
  itens: ItemExtraido[]
  camposNaoEncontrados: string[] // para diagnosticar extração de baixa confiança
}

// ─── Extração de texto posicionado (pdfjs-dist) ────────────────────────────────

interface ItemTexto { texto: string; x: number; y: number }

// Agrupa itens de texto em "linhas" por proximidade vertical (y), ordena cada
// linha da esquerda para a direita (x) e junta num único texto por linha —
// reconstrói a leitura em tabela sem depender da ordem em que o PDF armazena os
// runs de texto internamente, nem de quantos runs compõem cada célula visual
// (pdfjs pode fundir ou separar runs adjacentes de forma imprevisível; extrair
// por regex sobre a linha inteira é mais robusto do que contar posições/índices
// de "célula" — mesma lição do CLAUDE.md seção 6 para os relatórios HTML).
function agruparEmLinhas(itens: ItemTexto[]): string[] {
  const TOLERANCIA_Y = 2.5
  const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x)

  const linhas: ItemTexto[][] = []
  for (const item of ordenados) {
    const linhaAtual = linhas[linhas.length - 1]
    if (linhaAtual && Math.abs(linhaAtual[0].y - item.y) <= TOLERANCIA_Y) {
      linhaAtual.push(item)
    } else {
      linhas.push([item])
    }
  }

  return linhas
    .map(linha =>
      linha
        .sort((a, b) => a.x - b.x)
        .map(i => i.texto)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}

// Extrai o texto do PDF já reconstruído em linhas (uma por linha visual da
// tabela, uma página após a outra). Roda em runtime Node (não Edge) — pdfjs-dist
// precisa de APIs de Node para o build "legacy".
export async function extrairLinhasPdf(buffer: Buffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // pdfjs valida a URL como string POSIX (precisa terminar em "/") — path.sep
  // no Windows gera "\" e quebra essa validação, então normalizamos aqui.
  const standardFontDataUrl = path.join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts').split(path.sep).join('/') + '/'

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    // isEvalSupported não existe mais em pdfjs-dist 6.x — a lib parou de usar
    // eval() internamente nesta versão, então a flag ficou obsoleta.
    disableFontFace: true,
    standardFontDataUrl,
  }).promise

  const todasLinhas: string[] = []

  for (let pagina = 1; pagina <= doc.numPages; pagina++) {
    const page = await doc.getPage(pagina)
    const conteudo = await page.getTextContent()

    const itens: ItemTexto[] = conteudo.items
      .filter(item => 'str' in item && (item as { str: string }).str.trim() !== '')
      .map(item => {
        const i = item as { str: string; transform: number[] }
        return { texto: i.str, x: i.transform[4], y: i.transform[5] }
      })

    todasLinhas.push(...agruparEmLinhas(itens))
  }

  return todasLinhas
}

// ─── Extração de campos ─────────────────────────────────────────────────────────

// Sem acento — normalizarComparacao() sempre remove diacríticos da linha antes
// de comparar, então os rótulos de referência também precisam estar sem acento.
const CABECALHOS_ITENS_TABELA = ['codigo', 'nome do produto', 'quantidade']
const MARCADORES_FIM_ITENS = ['qtde itens:', 'qtde total:', 'observacoes', 'totais']

function normalizarComparacao(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function extrairCabecalho(linhas: string[]): {
  numeroPedido: string | null
  dataOrcamento: string | null
  vendedorNomeExtraido: string | null
} {
  for (const linha of linhas) {
    const m = linha.match(/Pedido:\s*(\d+)\s+Data:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+Vendedor:\s*(.+)$/i)
    if (m) {
      return {
        numeroPedido: m[1],
        dataOrcamento: parseDataBR(m[2]),
        vendedorNomeExtraido: m[3].trim(),
      }
    }
  }
  return { numeroPedido: null, dataOrcamento: null, vendedorNomeExtraido: null }
}

function extrairCliente(linhas: string[]): { clienteNome: string | null; clienteCnpj: string | null } {
  for (const linha of linhas) {
    const m = linha.match(/Código\/Nome:\s*(?:\d+-)?(.+?)\s+CPF\/CNPJ:\s*([\d./-]+)/i)
    if (m) {
      return { clienteNome: m[1].trim(), clienteCnpj: normalizarCNPJ(m[2]) }
    }
  }
  return { clienteNome: null, clienteCnpj: null }
}

// Filial do emitente, a partir do padrão "CIDADE - UF - CEP" no cabeçalho
// (ex: "COLOMBO - PR - 83401520") — mesmo padrão usado em extrairOrigemRelatorio()
// para os relatórios HTML (comercial-relatorios-parser.ts). UF sem mapeamento
// conhecido (nem SP nem PR) → null, não adivinha.
function extrairFilial(linhas: string[]): Filial | null {
  for (const linha of linhas) {
    const m = linha.match(/-\s*([A-Z]{2})\s*-\s*\d{5,8}/)
    if (m) return UF_PARA_FILIAL[m[1]] ?? null
  }
  return null
}

// Pega o valor da linha que COMEÇA com "Total:" — nunca "Sub-Total:" (a
// checagem de sub-total fica redundante com a âncora ^, mas mantida por
// clareza) nem linhas como "Qtde Total: 8" (contagem de itens, não valor;
// "Total:" aparece no meio dessas linhas, então \b sozinho pega o número errado).
function extrairValorTotal(linhas: string[]): number | null {
  for (const linha of linhas) {
    if (/sub-total/i.test(linha)) continue
    const m = linha.match(/^total:\s*([\d.,]+)/i)
    if (m) return parseValorBR(m[1])
  }
  return null
}

// Uma linha de item real do pedido: <código numérico> <descrição...> <quantidade> UN <vlr unit> <vlr subtotal>.
// Linhas de composição do kit (nome do componente + Un. + Quantidade, sem código
// numérico no início) nunca batem neste padrão — ficam de fora sem precisar de
// nenhum estado/flag adicional para rastrear "dentro da composição".
const RE_LINHA_ITEM = /^(\d{2,6})\s+(.+?)\s+([\d.,]+)\s+UN\.?\s+([\d.,]+)\s+([\d.,]+)\s*$/i

function tentarParsearLinhaItem(linha: string): ItemExtraido | null {
  const m = linha.match(RE_LINHA_ITEM)
  if (!m) return null

  const descricao = m[2].trim()
  if (!descricao) return null

  return {
    codigo: m[1],
    descricao,
    quantidade: parseValorBR(m[3]),
    unidade: 'UN',
    valorUnitario: parseValorBR(m[4]),
    valorTotal: parseValorBR(m[5]),
  }
}

function extrairItens(linhas: string[]): ItemExtraido[] {
  let dentroTabela = false
  const itens: ItemExtraido[] = []

  for (const linha of linhas) {
    const linhaNorm = normalizarComparacao(linha)

    if (!dentroTabela) {
      if (CABECALHOS_ITENS_TABELA.every(rotulo => linhaNorm.includes(rotulo))) {
        dentroTabela = true
      }
      continue
    }

    if (MARCADORES_FIM_ITENS.some(marcador => linhaNorm.startsWith(marcador))) {
      break
    }

    const item = tentarParsearLinhaItem(linha)
    // Linhas que não batem com o padrão de item real (cabeçalhos de sub-seção,
    // linhas de composição do kit, etc.) são simplesmente ignoradas — não é erro.
    if (item) itens.push(item)
  }

  return itens
}

// ─── API principal ───────────────────────────────────────────────────────────

export function parseOrcamentoPdf(linhas: string[]): DadosExtraidosOrcamento {
  const cabecalho = extrairCabecalho(linhas)
  const cliente = extrairCliente(linhas)
  const valorTotal = extrairValorTotal(linhas)
  const filial = extrairFilial(linhas)
  const itens = extrairItens(linhas)

  const camposNaoEncontrados: string[] = []
  if (!cabecalho.numeroPedido) camposNaoEncontrados.push('numeroPedido')
  if (!cabecalho.dataOrcamento) camposNaoEncontrados.push('dataOrcamento')
  if (!cabecalho.vendedorNomeExtraido) camposNaoEncontrados.push('vendedorNomeExtraido')
  if (!cliente.clienteNome) camposNaoEncontrados.push('clienteNome')
  if (valorTotal === null) camposNaoEncontrados.push('valorTotal')
  if (!filial) camposNaoEncontrados.push('filial')
  if (itens.length === 0) camposNaoEncontrados.push('itens')

  return {
    numeroPedido: cabecalho.numeroPedido,
    dataOrcamento: cabecalho.dataOrcamento,
    vendedorNomeExtraido: cabecalho.vendedorNomeExtraido,
    clienteNome: cliente.clienteNome,
    clienteCnpj: cliente.clienteCnpj,
    valorTotal,
    filial,
    itens,
    camposNaoEncontrados,
  }
}

export async function extrairDadosOrcamentoPdf(buffer: Buffer): Promise<DadosExtraidosOrcamento> {
  const linhas = await extrairLinhasPdf(buffer)
  return parseOrcamentoPdf(linhas)
}

// ─── Resolução de vendedor a partir do nome completo extraído ──────────────────
//
// O PDF imprime o nome completo do vendedor (ex: "PEDRO ERNESTO DOS REIS"), mas
// vendedores.nome é cadastrado como primeiro nome apenas (ex: "Pedro") — mesma
// convenção usada nos relatórios HTML (CLAUDE.md, seção 4). Resolve por prefixo/
// token, nunca por substring solta, para evitar falso-positivo. Ambíguo ou sem
// match → null (não adivinha; fica para o usuário resolver manualmente).
export function resolverVendedorPorNomeExtraido<T extends { nome: string }>(
  nomeExtraido: string,
  vendedores: T[],
): T | null {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
  const alvo = norm(nomeExtraido)
  if (!alvo) return null

  const candidatos = vendedores.filter(v => {
    const nomeV = norm(v.nome)
    if (!nomeV) return false
    return alvo === nomeV || alvo.startsWith(nomeV + ' ') || alvo.endsWith(' ' + nomeV) || alvo.includes(' ' + nomeV + ' ')
  })

  return candidatos.length === 1 ? candidatos[0] : null
}

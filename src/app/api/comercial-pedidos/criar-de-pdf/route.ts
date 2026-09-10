// POST /api/comercial-pedidos/criar-de-pdf
//
// Cria (ou atualiza, se numero_pedido+empresa já existir) um orçamento inteiro a
// partir de um único PDF — diferente de /upload-pdf + /vincular-pdf, que só
// anexam um PDF a um pedido já cadastrado. Aqui todos os campos (cliente, valor,
// data, filial, número do pedido) vêm da extração do próprio PDF; o usuário não
// digita nada além de soltar o arquivo.
//
// Resposta: { ok: true, criado, numeroPedido, cliente, pedido }

import { getPapel, getVendedorId } from '@/lib/comercial-auth'
import { salvarPedidoManual, vincularPdfPedido, buscarPedidoPorId } from '@/lib/comercial-pedidos-repository'
import { substituirItensPedido } from '@/lib/comercial-pedidos-itens-repository'
import { enviarPdfParaDrive } from '@/lib/google-drive-client'
import { extrairDadosOrcamentoPdf, resolverVendedorPorNomeExtraido } from '@/lib/pdf-orcamento-parser'
import { listarVendedores } from '@/lib/vendedores-repository'
import { EMPRESA_POR_FILIAL } from '@/lib/empresa-filial'

const PAPEIS_CRIACAO = new Set(['administrador', 'gestor', 'vendedor'])
const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024 // 20 MB

// Campos sem os quais não dá pra criar um pedido de verdade — vendedorNomeExtraido
// e dataOrcamento ficam de fora: vendedor cai para null (usuário atribui depois) e
// data é opcional no cadastro manual também.
const CAMPOS_OBRIGATORIOS = new Set(['numeroPedido', 'clienteNome', 'valorTotal', 'filial'])

export async function POST(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_CRIACAO.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ ok: false, error: 'Requisição inválida (esperado multipart/form-data)' }, { status: 400 })
  }

  const arquivo = formData.get('file')
  if (!(arquivo instanceof File)) {
    return Response.json({ ok: false, error: 'Arquivo não enviado (campo "file")' }, { status: 400 })
  }
  if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ ok: false, error: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return Response.json({ ok: false, error: 'Arquivo excede o tamanho máximo de 20 MB' }, { status: 400 })
  }

  // vendedor: ignora qualquer atribuição vinda do PDF, usa sempre o próprio id
  // (nunca confiar em nome extraído de um arquivo pra decidir dono do registro)
  let vendedorIdForcado: string | null = null
  if (papel === 'vendedor') {
    vendedorIdForcado = getVendedorId(request)
    if (!vendedorIdForcado) {
      return Response.json({ ok: false, error: 'Vendedor sem carteira configurada' }, { status: 403 })
    }
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  try {
    const [drive, extraido, vendedores] = await Promise.all([
      enviarPdfParaDrive(buffer, arquivo.name),
      extrairDadosOrcamentoPdf(buffer),
      listarVendedores(false),
    ])

    const faltando = extraido.camposNaoEncontrados.filter(c => CAMPOS_OBRIGATORIOS.has(c))
    if (faltando.length > 0) {
      return Response.json({
        ok: false,
        error: `Não foi possível extrair do PDF: ${faltando.join(', ')}`,
        camposNaoEncontrados: extraido.camposNaoEncontrados,
      }, { status: 422 })
    }

    const vendedorId = vendedorIdForcado
      ?? (extraido.vendedorNomeExtraido
        ? resolverVendedorPorNomeExtraido(extraido.vendedorNomeExtraido, vendedores)?.id ?? null
        : null)

    const filial = extraido.filial!
    const empresa = EMPRESA_POR_FILIAL[filial]

    const resultado = await salvarPedidoManual({
      vendedorId,
      empresa,
      filial,
      cliente: extraido.clienteNome!,
      clienteCnpj: extraido.clienteCnpj,
      clienteCidade: extraido.clienteCidade,
      clienteEstado: extraido.clienteEstado,
      clienteTelefone: extraido.clienteTelefone,
      clienteContato: extraido.clienteContato,
      clienteEmail: extraido.clienteEmail,
      criadoPor: request.headers.get('x-user-email'),
      numeroPedido: extraido.numeroPedido!,
      valorOrcado: extraido.valorTotal!,
      dataOrcamento: extraido.dataOrcamento,
      status: 'orcado',
      valorVendido: null,
      dataVenda: null,
    })

    await vincularPdfPedido(resultado.id, {
      pdfUrl: drive.webViewLink,
      pdfGoogleDriveId: drive.id,
      vendedorAtribuidoId: vendedorId,
      numeroPedidoExtraido: extraido.numeroPedido,
    })
    await substituirItensPedido(resultado.id, extraido.itens)

    const pedido = await buscarPedidoPorId(resultado.id)

    return Response.json({
      ok: true,
      criado: resultado.criado,
      numeroPedido: extraido.numeroPedido,
      cliente: extraido.clienteNome,
      pedido,
    }, { status: resultado.criado ? 201 : 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial-pedidos/criar-de-pdf] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

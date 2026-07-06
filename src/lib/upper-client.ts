// Server-only — usa credenciais de UPPER_EMAIL/UPPER_SENHA. Nunca importar
// este arquivo de um componente 'use client'. Nunca logar email, senha,
// tokenAcesso ou refreshToken — nem em console.log, nem em mensagens de erro
// que possam chegar à tela do navegador.

import type { PedidoUpperReal, RespostaPaginadaUpper } from '@/types/upper'

const LOGIN_URL = 'https://web.uppersoftwares.com.br:4480/api/v1/usuario/login'
const API_BASE_URL = 'https://web.uppersoftwares.com.br:4480/api/v1'

interface LoginUpperResponse {
  id: string
  tokenAcesso: string
  refreshToken: string
  createdAt: string
}

// Primeira versão deliberadamente simples: autentica de novo a cada chamada,
// sem guardar token entre requisições. Evita lidar com expiração/refresh por
// enquanto — só otimizamos para token persistente se o volume de chamadas
// justificar.
export async function autenticarUpper(): Promise<string> {
  const email = process.env.UPPER_EMAIL
  const senha = process.env.UPPER_SENHA

  if (!email || !senha) {
    throw new Error('UPPER_EMAIL e UPPER_SENHA precisam estar definidos em .env.local')
  }

  let resposta: Response
  try {
    resposta = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
  } catch {
    // Erro de rede (DNS, timeout, conexão recusada) — nunca inclui o body da
    // requisição (que contém a senha) na mensagem.
    throw new Error('Falha de rede ao autenticar na API da Upper Softwares')
  }

  if (resposta.status === 401 || resposta.status === 403) {
    throw new Error('Credenciais da Upper Softwares inválidas ou expiradas (login rejeitado)')
  }

  if (!resposta.ok) {
    throw new Error(`Falha ao autenticar na API da Upper Softwares (status ${resposta.status})`)
  }

  let dados: LoginUpperResponse
  try {
    dados = await resposta.json()
  } catch {
    throw new Error('Resposta de login da Upper Softwares não é um JSON válido')
  }

  if (!dados.tokenAcesso) {
    throw new Error('Resposta de login da Upper Softwares não trouxe tokenAcesso')
  }

  return dados.tokenAcesso
}

interface OpcoesRequisicaoUpper {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

// Autentica do zero a cada chamada (ver comentário em autenticarUpper) e faz
// a requisição real contra web.uppersoftwares.com.br:4480. Retorna o JSON já
// desserializado — o formato real de cada endpoint ainda não é conhecido,
// por isso o retorno é "unknown" e cabe ao chamador inspecionar a estrutura.
export async function fazerRequisicaoUpper(endpoint: string, opcoes: OpcoesRequisicaoUpper = {}): Promise<unknown> {
  const tokenAcesso = await autenticarUpper()
  const url = `${API_BASE_URL}${endpoint}`

  let resposta: Response
  try {
    resposta = await fetch(url, {
      method: opcoes.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${tokenAcesso}`,
        ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
    })
  } catch {
    throw new Error(`Falha de rede ao chamar a API da Upper Softwares (${endpoint})`)
  }

  if (!resposta.ok) {
    // Log só de servidor (nunca vai para o cliente/navegador) — corpo
    // completo da resposta de erro da Upper, para conseguir reportar a
    // mensagem real ao suporte deles. A Error lançada abaixo continua
    // genérica, sem o corpo, pois essa mensagem pode acabar visível na tela.
    let corpoErro: string
    try {
      corpoErro = await resposta.text()
    } catch {
      corpoErro = '(não foi possível ler o corpo da resposta de erro)'
    }
    console.error(`[upper-client] Erro ${resposta.status} em "${endpoint}" — corpo completo da resposta:`, corpoErro)

    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error(`Acesso negado pela API da Upper Softwares em "${endpoint}" (token rejeitado, status ${resposta.status})`)
    }
    throw new Error(`Falha ao chamar a API da Upper Softwares em "${endpoint}" (status ${resposta.status})`)
  }

  try {
    return await resposta.json()
  } catch {
    throw new Error(`Resposta de "${endpoint}" na API da Upper Softwares não é um JSON válido`)
  }
}

// Tenta extrair o array de itens do formato de resposta paginada da Upper,
// que pode usar chaves diferentes dependendo do endpoint.
function extrairItemsDaResposta(resposta: unknown): unknown[] {
  if (Array.isArray(resposta)) return resposta
  if (typeof resposta === 'object' && resposta !== null) {
    const obj = resposta as Record<string, unknown>
    for (const key of ['data', 'pedidos', 'itens', 'items', 'result', 'lista', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

// Busca pedidos dos últimos 30 dias — apenas primeira página (50 itens).
// Tenta filtrar por data via query params (dataInicio/dataFim); se a API
// ignorar esses parâmetros, filtra no cliente depois de receber a resposta.
export async function buscarTodosPedidos(): Promise<PedidoUpperReal[]> {
  const tokenAcesso = await autenticarUpper()

  const hoje = new Date()
  const dataInicio = new Date(hoje)
  dataInicio.setDate(hoje.getDate() - 30)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const params = new URLSearchParams({
    pag: '1',
    qtd: '50',
    dataInicio: fmt(dataInicio),
    dataFim: fmt(hoje),
  })
  const url = `${API_BASE_URL}/pedido?${params}`
  console.log('[upper-client] buscarTodosPedidos — URL:', url)

  let resposta: Response
  try {
    resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenAcesso}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error('Falha de rede ao buscar pedidos')
  }

  console.log('[upper-client] buscarTodosPedidos — status HTTP:', resposta.status)

  if (!resposta.ok) {
    let corpoErro: string
    try { corpoErro = await resposta.text() } catch { corpoErro = '(ilegível)' }
    console.error(`[upper-client] Erro ${resposta.status} em /pedido:`, corpoErro)
    throw new Error(`Falha ao buscar pedidos (status ${resposta.status})`)
  }

  const json: unknown = await resposta.json()

  // Log das chaves do objeto raiz para diagnóstico (sem expor dados sensíveis)
  if (typeof json === 'object' && json !== null) {
    const obj = json as RespostaPaginadaUpper
    console.log('[upper-client] buscarTodosPedidos — chaves da resposta:', Object.keys(obj),
      '| totalRegistros:', obj.totalRegistros ?? '(não presente)')
  }

  const itens = extrairItemsDaResposta(json)
  console.log('[upper-client] buscarTodosPedidos — itens extraídos:', itens.length)

  // Filtra no cliente caso a API não suporte os parâmetros de data
  const limiteMs = dataInicio.getTime()
  const filtrados = (itens as PedidoUpperReal[]).filter(p => {
    const dataStr = p.dataEmissao || p.ide?.dhEmi
    return dataStr ? new Date(dataStr).getTime() >= limiteMs : true
  })

  console.log(`[upper-client] buscarTodosPedidos — após filtro 30 dias: ${filtrados.length} pedidos`)

  return filtrados
}

// Funções específicas por recurso — usam autenticarUpper() individualmente
// (ver comentário acima). Quando "filtros" não é informado, usa o endpoint
// simples (GET); quando informado, usa o endpoint de filtros (POST).

export function buscarPedidos(paginacao?: { pag?: number; qtd?: number }): Promise<unknown> {
  const params = new URLSearchParams()
  if (paginacao?.pag != null) params.set('pag', String(paginacao.pag))
  if (paginacao?.qtd != null) params.set('qtd', String(paginacao.qtd))
  const qs = params.toString()
  return fazerRequisicaoUpper(`/pedido${qs ? `?${qs}` : ''}`)
}

export function buscarPedidoPorId(id: string | number): Promise<unknown> {
  return fazerRequisicaoUpper(`/pedido/${id}`)
}

export function buscarPessoas(filtros?: Record<string, unknown>): Promise<unknown> {
  return filtros
    ? fazerRequisicaoUpper('/pessoa/filtros', { method: 'POST', body: filtros })
    : fazerRequisicaoUpper('/pessoa')
}

export function buscarProdutos(filtros?: Record<string, unknown>): Promise<unknown> {
  return filtros
    ? fazerRequisicaoUpper('/produto/filtros', { method: 'POST', body: filtros })
    : fazerRequisicaoUpper('/produto')
}

export function buscarCompras(filtros?: Record<string, unknown>): Promise<unknown> {
  return filtros
    ? fazerRequisicaoUpper('/compra/filtros', { method: 'POST', body: filtros })
    : fazerRequisicaoUpper('/compra')
}

// A API da Upper só foi indicada com endpoint de filtros para saldo de
// estoque (sem alternativa GET simples) — sempre POST, com body vazio
// quando nenhum filtro é informado.
export function buscarSaldoEstoque(filtros?: Record<string, unknown>): Promise<unknown> {
  return fazerRequisicaoUpper('/saldo-estoque/filtros', { method: 'POST', body: filtros ?? {} })
}

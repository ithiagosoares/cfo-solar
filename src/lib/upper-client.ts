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

// Busca todos os pedidos dentro dos últimos 30 dias, paginando automaticamente.
// A API retorna do mais recente ao mais antigo — para quando o último item da
// página for anterior ao início do período ou quando não houver mais páginas.
export async function buscarTodosPedidos(): Promise<PedidoUpperReal[]> {
  const tokenAcesso = await autenticarUpper()

  const hoje = new Date()
  hoje.setHours(23, 59, 59, 999)
  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - 30)
  dataInicio.setHours(0, 0, 0, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const LIMITE_PAGINAS = 20
  const ITENS_POR_PAGINA = 50
  let pagina = 1
  const todosPedidos: PedidoUpperReal[] = []

  while (pagina <= LIMITE_PAGINAS) {
    const params = new URLSearchParams({
      pag: String(pagina),
      qtd: String(ITENS_POR_PAGINA),
      dataInicio: fmt(dataInicio),
      dataFim: fmt(hoje),
    })
    const url = `${API_BASE_URL}/pedido?${params}`
    console.log(`[upper-client] buscando página ${pagina} — URL:`, url)

    let resposta: Response
    try {
      resposta = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenAcesso}` },
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new Error(`Falha de rede ao buscar pedidos (página ${pagina})`)
    }

    console.log(`[upper-client] página ${pagina} — status HTTP:`, resposta.status)

    if (!resposta.ok) {
      let corpoErro: string
      try { corpoErro = await resposta.text() } catch { corpoErro = '(ilegível)' }
      console.error(`[upper-client] Erro ${resposta.status} em /pedido (página ${pagina}):`, corpoErro)
      throw new Error(`Falha ao buscar pedidos (status ${resposta.status})`)
    }

    const json: unknown = await resposta.json()

    if (pagina === 1 && typeof json === 'object' && json !== null) {
      const obj = json as RespostaPaginadaUpper
      console.log('[upper-client] chaves da resposta:', Object.keys(obj),
        '| totalRegistros:', obj.totalRegistros ?? '(não presente)')
    }

    const itens = extrairItemsDaResposta(json) as PedidoUpperReal[]
    console.log(`[upper-client] página ${pagina} — itens recebidos: ${itens.length}`)

    todosPedidos.push(...itens)

    // Sem mais páginas
    if (itens.length < ITENS_POR_PAGINA) break

    // API retorna do mais recente ao mais antigo — se o último item da página
    // já é anterior ao início do período, não há mais pedidos relevantes
    const ultimoItem = itens[itens.length - 1]
    if (ultimoItem?.dataEmissao) {
      const dataUltimo = new Date(ultimoItem.dataEmissao)
      if (dataUltimo.getTime() < dataInicio.getTime()) break
    }

    pagina++
  }

  // createdAt é sempre "0001-01-01T00:00:00" (.NET null date) — usar só dataEmissao
  const filtrados = todosPedidos.filter(p => {
    if (!p.dataEmissao) return false
    const t = new Date(p.dataEmissao).getTime()
    return t >= dataInicio.getTime() && t <= hoje.getTime()
  })

  console.log(`[upper-client] páginas buscadas: ${pagina} | total bruto: ${todosPedidos.length} | após filtro: ${filtrados.length}`)

  // Investigação de vendedor: tenta resolver usuarioId → nome via /pessoa/:id
  const comUsuario = filtrados.find(p => p.usuarioId)
  if (comUsuario?.usuarioId) {
    console.log('[upper-client] investigando vendedor — usuarioId:', comUsuario.usuarioId)
    try {
      const resPessoa = await fetch(`${API_BASE_URL}/pessoa/${comUsuario.usuarioId}`, {
        headers: { Authorization: `Bearer ${tokenAcesso}` },
        signal: AbortSignal.timeout(5_000),
      })
      if (resPessoa.ok) {
        const pessoa = await resPessoa.json() as Record<string, unknown>
        console.log('[upper-client] /pessoa/:usuarioId retornou — campos:', Object.keys(pessoa),
          '| nome:', pessoa.nome ?? pessoa.xNome ?? pessoa.nomeCompleto ?? '(campo não identificado)')
      } else {
        console.log('[upper-client] /pessoa/:usuarioId status:', resPessoa.status, '— endpoint pode não existir para este tipo de id')
      }
    } catch {
      console.log('[upper-client] /pessoa/:usuarioId falhou — usuarioId provavelmente não é id de Pessoa')
    }
  } else {
    console.log('[upper-client] nenhum pedido com usuarioId preenchido nos últimos 30 dias')
  }

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

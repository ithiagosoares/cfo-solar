// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.
//
// Score IA: modelo de 8 critérios ponderados sobre dados reais de
// comercial_pedidos (vendas) e atividades (contatos/CRM) — 100% determinístico,
// nenhuma chamada de modelo de linguagem envolvida (ver CLAUDE.md, seção 9;
// "IA" aqui é só o rótulo de produto usado nas telas).
//
// Adaptações em relação ao brief original: o schema real usa
// comercial_pedidos.status ('orcado'/'vendido'/'perdido'), não status_venda
// ('Fechado'/'Faturado') — "venda" = status='vendido' + data_venda preenchida.
// Responsividade e Taxa de Resposta usam atividades.resultado: não existe um
// segundo timestamp de "resposta do cliente" no schema atual, então:
//   - Responsividade = taxa de engajamento positivo em contato direto
//     (Ligação/Visita/Reunião) — proxy para "cliente responde bem quando
//     abordado diretamente".
//   - Taxa de Resposta = taxa de resposta em comunicação escrita
//     (Email/SMS/WhatsApp) — usa o resultado 'Respondido'/'Não Respondido'
//     que já existe nesses tipos (ver atividade-config.ts).

import { supabaseAdmin } from './supabase-admin'

const JANELA_FREQUENCIA_DIAS = 365
const JANELA_ENGAJAMENTO_DIAS = 90
const JANELA_TAXA_RESPOSTA_DIAS = 180
const JANELA_RESPONSIVIDADE_DIAS = 90

const PESOS = {
  frequencia: 0.20,
  recencia: 0.20,
  valorTotal: 0.15,
  ticketMedio: 0.15,
  responsividade: 0.10,
  consistencia: 0.10,
  engajamento: 0.05,
  taxaResposta: 0.05,
} as const

export type NomeCriterio = keyof typeof PESOS

export interface CriterioScore {
  valor: number // 0-100
  explicacao: string
}

export type DetalhesScore = Record<NomeCriterio, CriterioScore>

export interface ScoreIaCompleto {
  clienteCnpj: string
  scoreFinal: number
  detalhes: DetalhesScore
  explicacao: string
  cor: 'green' | 'yellow' | 'red'
  top2: { nome: string; valor: number }[]
}

// ─── Helpers de data ─────────────────────────────────────────────────────────
// Mesmo padrão de cliente-inteligencia.ts: datas 'YYYY-MM-DD', comparáveis
// lexicograficamente.

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// data_venda/data_orcamento (comercial_pedidos) são 'date' puro ('YYYY-MM-DD');
// data_realizado (atividades) é timestamp ('YYYY-MM-DDTHH:mm:ss.sss') — sempre
// normaliza pelos 10 primeiros caracteres antes de comparar, senão o Date fica
// inválido (`${ts}T00:00:00` vira uma string com dois "T") e diasEntre = NaN.
function diasEntre(dataIso: string, referencia: string = hojeIso()): number {
  const a = new Date(`${dataIso.slice(0, 10)}T00:00:00`).getTime()
  const b = new Date(`${referencia.slice(0, 10)}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

function formatarMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ─── Dados brutos ─────────────────────────────────────────────────────────────

interface VendaRow {
  valorVendido: number
  dataVenda: string
}

interface AtividadeRow {
  tipo: string
  resultado: string | null
  dataRealizado: string | null
}

async function buscarVendas(clienteCnpj: string): Promise<VendaRow[]> {
  const { data, error } = await supabaseAdmin
    .from('comercial_pedidos')
    .select('valor_vendido, data_venda')
    .eq('cliente_cnpj', clienteCnpj)
    .eq('status', 'vendido')
    .eq('arquivado', false)
    .not('data_venda', 'is', null)
    .not('valor_vendido', 'is', null)

  if (error) throw new Error(`Falha ao buscar vendas para score: ${error.message}`)
  return (data ?? []).map(r => ({
    valorVendido: r.valor_vendido as number,
    dataVenda: r.data_venda as string,
  }))
}

async function buscarAtividades(clienteCnpj: string): Promise<AtividadeRow[]> {
  const { data, error } = await supabaseAdmin
    .from('atividades')
    .select('tipo, resultado, data_realizado')
    .eq('cliente_cnpj', clienteCnpj)
    .eq('arquivado', false)

  if (error) throw new Error(`Falha ao buscar atividades para score: ${error.message}`)
  return (data ?? []).map(r => ({
    tipo: r.tipo as string,
    resultado: r.resultado as string | null,
    dataRealizado: r.data_realizado as string | null,
  }))
}

// Soma valor_vendido por cliente, para toda a carteira com venda — usado só
// para achar os percentis de Valor Total/Ticket Médio (comparação do cliente
// com o resto da carteira). Uma query só, reaproveitada pelos dois critérios.
interface DistribuicaoCarteira {
  totais: number[]
  ticketsMedios: number[]
}

async function buscarDistribuicaoCarteira(): Promise<DistribuicaoCarteira> {
  const { data, error } = await supabaseAdmin
    .from('comercial_pedidos')
    .select('cliente_cnpj, valor_vendido')
    .eq('status', 'vendido')
    .eq('arquivado', false)
    .not('cliente_cnpj', 'is', null)
    .not('valor_vendido', 'is', null)

  if (error) throw new Error(`Falha ao buscar distribuição da carteira: ${error.message}`)

  const porCliente = new Map<string, number[]>()
  for (const row of (data ?? []) as { cliente_cnpj: string; valor_vendido: number }[]) {
    const lista = porCliente.get(row.cliente_cnpj) ?? []
    lista.push(row.valor_vendido)
    porCliente.set(row.cliente_cnpj, lista)
  }

  const totais: number[] = []
  const ticketsMedios: number[] = []
  for (const valores of porCliente.values()) {
    const soma = valores.reduce((a, b) => a + b, 0)
    totais.push(soma)
    ticketsMedios.push(soma / valores.length)
  }
  return { totais, ticketsMedios }
}

function percentil(valoresOrdenados: number[], p: number): number {
  if (valoresOrdenados.length === 0) return 0
  const idx = Math.min(valoresOrdenados.length - 1, Math.floor(p * valoresOrdenados.length))
  return valoresOrdenados[idx]
}

function scorePorPercentil(valor: number, distribuicao: number[]): number {
  if (valor <= 0 || distribuicao.length === 0) return 0
  const ordenado = [...distribuicao].sort((a, b) => a - b)
  const p90 = percentil(ordenado, 0.90)
  const p75 = percentil(ordenado, 0.75)
  const p50 = percentil(ordenado, 0.50)
  if (valor >= p90) return 100
  if (valor >= p75) return 75
  if (valor >= p50) return 50
  return 25
}

// ─── Critérios individuais ───────────────────────────────────────────────────

function calcularFrequencia(vendas: VendaRow[]): CriterioScore {
  const total = vendas.filter(v => diasEntre(v.dataVenda) <= JANELA_FREQUENCIA_DIAS).length
  const valor = Math.min(100, Math.round((total / 12) * 100))
  const explicacao =
    total === 0 ? 'Cliente sem compras nos últimos 12 meses' :
    total === 1 ? 'Cliente compra raramente (1 compra/ano)' :
    total <= 3  ? `Cliente compra ocasionalmente (${total} compras/ano)` :
                  `Cliente compra frequentemente (${total} compras/ano)`
  return { valor, explicacao }
}

function calcularRecencia(vendas: VendaRow[]): CriterioScore {
  if (vendas.length === 0) return { valor: 0, explicacao: 'Nenhuma compra registrada' }

  const ultima = vendas.reduce((max, v) => (v.dataVenda > max ? v.dataVenda : max), vendas[0].dataVenda)
  const dias = diasEntre(ultima)

  let bruto: number
  if (dias <= 7) bruto = 100
  else if (dias <= 30) bruto = 100 - ((dias - 7) / 23) * 30
  else if (dias <= 60) bruto = 70 - ((dias - 30) / 30) * 30
  else if (dias <= 90) bruto = 40 - ((dias - 60) / 30) * 20
  else bruto = 0
  const valor = Math.round(Math.max(0, bruto))

  const explicacao = dias <= 30
    ? `Cliente comprou há ${dias} dias (dentro do ciclo normal)`
    : `Cliente não compra há ${dias} dias (fora do ciclo esperado)`
  return { valor, explicacao }
}

function calcularValorTotal(vendas: VendaRow[], distribuicaoTotais: number[]): CriterioScore {
  const total = vendas.reduce((acc, v) => acc + v.valorVendido, 0)
  const valor = scorePorPercentil(total, distribuicaoTotais)
  const explicacao =
    total === 0 ? 'Cliente sem valor comprado registrado' :
    valor >= 75 ? `Cliente já gastou ${formatarMoeda(total)} (acima da média da carteira)` :
    valor >= 50 ? `Cliente gasta na média da carteira (${formatarMoeda(total)} total)` :
                  `Cliente gasta pouco (${formatarMoeda(total)} total)`
  return { valor, explicacao }
}

function calcularTicketMedio(vendas: VendaRow[], distribuicaoTickets: number[]): CriterioScore {
  if (vendas.length === 0) return { valor: 0, explicacao: 'Sem vendas para calcular ticket médio' }

  const media = vendas.reduce((acc, v) => acc + v.valorVendido, 0) / vendas.length
  const valor = scorePorPercentil(media, distribuicaoTickets)
  const explicacao =
    valor >= 75 ? `Cliente tem ticket alto (${formatarMoeda(media)} em média)` :
    valor >= 50 ? `Cliente tem ticket médio (${formatarMoeda(media)})` :
                  `Cliente tem ticket pequeno (${formatarMoeda(media)})`
  return { valor, explicacao }
}

const RESULTADOS_ENGAJAMENTO_POSITIVO = new Set([
  'Contactado', 'Interessado', 'Agendado', 'Realizado', 'Confirmada',
])

function calcularResponsividade(atividades: AtividadeRow[]): CriterioScore {
  const diretas = atividades.filter(a =>
    (a.tipo === 'Ligação' || a.tipo === 'Visita' || a.tipo === 'Reunião')
    && a.dataRealizado !== null
    && diasEntre(a.dataRealizado) <= JANELA_RESPONSIVIDADE_DIAS
    && a.resultado !== null,
  )
  if (diretas.length === 0) return { valor: 0, explicacao: 'Sem contatos diretos recentes para avaliar' }

  const positivas = diretas.filter(a => RESULTADOS_ENGAJAMENTO_POSITIVO.has(a.resultado!)).length
  const percentual = Math.round((positivas / diretas.length) * 100)
  const explicacao = percentual >= 70
    ? `Cliente responde bem a contato direto (${percentual}% de engajamento)`
    : `Cliente engaja pouco no contato direto (${percentual}%)`
  return { valor: percentual, explicacao }
}

// Coeficiente de variação dos intervalos entre vendas consecutivas — exige ao
// menos 3 vendas (2 intervalos) para ter algum sentido estatístico.
function calcularConsistencia(vendas: VendaRow[]): CriterioScore {
  const datas = [...new Set(vendas.map(v => v.dataVenda))].sort()
  if (datas.length < 3) {
    return { valor: 0, explicacao: 'Histórico insuficiente para avaliar consistência (menos de 3 compras)' }
  }

  const intervalos: number[] = []
  for (let i = 1; i < datas.length; i++) intervalos.push(diasEntre(datas[i - 1], datas[i]))

  const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length
  if (media === 0) return { valor: 0, explicacao: 'Histórico insuficiente para avaliar consistência' }

  const variancia = intervalos.reduce((acc, d) => acc + (d - media) ** 2, 0) / intervalos.length
  const coefVariacao = Math.sqrt(variancia) / media

  const valor =
    coefVariacao < 0.2 ? 100 :
    coefVariacao < 0.4 ? 70 :
    coefVariacao < 0.6 ? 40 : 10

  const explicacao = valor >= 70
    ? `Cliente tem padrão consistente (compra a cada ~${Math.round(media)} dias)`
    : 'Cliente é imprevisível (ciclo de compra varia muito)'
  return { valor, explicacao }
}

function calcularEngajamento(atividades: AtividadeRow[]): CriterioScore {
  const total = atividades.filter(
    a => a.dataRealizado !== null && diasEntre(a.dataRealizado) <= JANELA_ENGAJAMENTO_DIAS,
  ).length

  const valor =
    total >= 15 ? 100 :
    total >= 10 ? 70 :
    total >= 5  ? 40 :
    total >= 1  ? 20 : 0

  const explicacao = total === 0
    ? 'Pouca interação com o cliente'
    : `Cliente ativo (${total} contatos nos últimos 90 dias)`
  return { valor, explicacao }
}

function calcularTaxaResposta(atividades: AtividadeRow[]): CriterioScore {
  const comunicacoes = atividades.filter(a =>
    (a.tipo === 'Email' || a.tipo === 'SMS' || a.tipo === 'WhatsApp')
    && a.dataRealizado !== null
    && diasEntre(a.dataRealizado) <= JANELA_TAXA_RESPOSTA_DIAS
    && (a.resultado === 'Respondido' || a.resultado === 'Não Respondido'),
  )
  if (comunicacoes.length === 0) return { valor: 0, explicacao: 'Sem comunicações registradas para avaliar' }

  const respondidas = comunicacoes.filter(a => a.resultado === 'Respondido').length
  const taxa = respondidas / comunicacoes.length

  const valor =
    taxa >= 0.8 ? 100 :
    taxa >= 0.6 ? 70 :
    taxa >= 0.4 ? 40 :
    taxa >= 0.2 ? 20 : 0

  return { valor, explicacao: `Cliente responde a ${Math.round(taxa * 100)}% das comunicações` }
}

// ─── Explicação dinâmica ─────────────────────────────────────────────────────

const NOMES_CRITERIOS: Record<NomeCriterio, string> = {
  frequencia: 'Frequência',
  recencia: 'Recência',
  valorTotal: 'Valor Total',
  ticketMedio: 'Ticket Médio',
  responsividade: 'Responsividade',
  consistencia: 'Consistência',
  engajamento: 'Engajamento',
  taxaResposta: 'Taxa de Resposta',
}

function gerarExplicacao(
  score: number,
  detalhes: DetalhesScore,
  top2: { nome: NomeCriterio; valor: number }[],
): string {
  const [primeiro, segundo] = top2

  if (score >= 80) {
    return `Pontuação alta (${score}/100). ${detalhes[primeiro.nome].explicacao}. ${detalhes[segundo.nome].explicacao}.`
  }
  if (score >= 50) {
    return `Pontuação moderada (${score}/100). ${detalhes[primeiro.nome].explicacao}, mas ${NOMES_CRITERIOS[segundo.nome].toLowerCase()} precisa melhorar.`
  }
  return `Pontuação baixa (${score}/100). ${detalhes.recencia.explicacao}. Recomenda-se reativar ou aumentar contatos.`
}

// ─── Cálculo (sem cache) ──────────────────────────────────────────────────────

async function calcularScoreIaSemCache(clienteCnpj: string): Promise<ScoreIaCompleto> {
  const [vendas, atividades, distribuicao] = await Promise.all([
    buscarVendas(clienteCnpj),
    buscarAtividades(clienteCnpj),
    buscarDistribuicaoCarteira(),
  ])

  const detalhes: DetalhesScore = {
    frequencia: calcularFrequencia(vendas),
    recencia: calcularRecencia(vendas),
    valorTotal: calcularValorTotal(vendas, distribuicao.totais),
    ticketMedio: calcularTicketMedio(vendas, distribuicao.ticketsMedios),
    responsividade: calcularResponsividade(atividades),
    consistencia: calcularConsistencia(vendas),
    engajamento: calcularEngajamento(atividades),
    taxaResposta: calcularTaxaResposta(atividades),
  }

  const nomesCriterios = Object.keys(PESOS) as NomeCriterio[]
  const scoreFinal = Math.round(
    nomesCriterios.reduce((acc, nome) => acc + detalhes[nome].valor * PESOS[nome], 0),
  )

  const top2Raw = nomesCriterios
    .map(nome => ({ nome, valor: detalhes[nome].valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 2) as [{ nome: NomeCriterio; valor: number }, { nome: NomeCriterio; valor: number }]

  const cor: ScoreIaCompleto['cor'] = scoreFinal >= 80 ? 'green' : scoreFinal >= 50 ? 'yellow' : 'red'

  return {
    clienteCnpj,
    scoreFinal,
    detalhes,
    explicacao: gerarExplicacao(scoreFinal, detalhes, top2Raw),
    cor,
    top2: top2Raw.map(t => ({ nome: NOMES_CRITERIOS[t.nome], valor: t.valor })),
  }
}

// ─── Cache (24h) ──────────────────────────────────────────────────────────────
// Tabela clientes_score_cache — ver bloco SQL no fim deste arquivo pra rodar
// manualmente no Supabase (CLAUDE.md, seção 8: migration sempre em bloco
// separado, service_role via RLS using(false) + GRANT explícito).

const TABELA_CACHE = 'clientes_score_cache'
const JANELA_CACHE_HORAS = 24

interface ScoreCacheRow {
  cliente_cnpj: string
  score_final: number
  detalhes: DetalhesScore
  explicacao: string
  cor: ScoreIaCompleto['cor']
  top2: { nome: string; valor: number }[]
  calculado_em: string
}

async function buscarScoreCache(clienteCnpj: string): Promise<ScoreIaCompleto | null> {
  const { data, error } = await supabaseAdmin
    .from(TABELA_CACHE)
    .select('*')
    .eq('cliente_cnpj', clienteCnpj)
    .maybeSingle()

  // Tabela pode ainda não existir num ambiente que não rodou a migration —
  // nesse caso, cai pro cálculo direto em vez de quebrar o endpoint.
  if (error || !data) return null

  const row = data as ScoreCacheRow
  const horasDesdeCalculo = (Date.now() - new Date(row.calculado_em).getTime()) / 3_600_000
  if (horasDesdeCalculo > JANELA_CACHE_HORAS) return null

  return {
    clienteCnpj: row.cliente_cnpj,
    scoreFinal: row.score_final,
    detalhes: row.detalhes,
    explicacao: row.explicacao,
    cor: row.cor,
    top2: row.top2,
  }
}

// Best-effort — falha ao gravar cache não deve derrubar a resposta do score,
// já calculado com sucesso neste ponto (mesmo padrão de
// atualizarDataUltimaCompra em comercial-pedidos-repository.ts).
async function salvarScoreCache(score: ScoreIaCompleto): Promise<void> {
  const { error } = await supabaseAdmin
    .from(TABELA_CACHE)
    .upsert({
      cliente_cnpj: score.clienteCnpj,
      score_final: score.scoreFinal,
      detalhes: score.detalhes,
      explicacao: score.explicacao,
      cor: score.cor,
      top2: score.top2,
      calculado_em: new Date().toISOString(),
    })

  if (error) console.warn('[score-repository] falha ao gravar cache do score:', error.message)
}

// ─── Função principal (reutilizável em toda a plataforma) ────────────────────
// Cacheada por 24h em clientes_score_cache — recalcula sob demanda quando o
// cache está frio, ausente, ou a tabela ainda não existe neste ambiente.

export async function calcularScoreIa(clienteCnpj: string): Promise<ScoreIaCompleto> {
  const cache = await buscarScoreCache(clienteCnpj)
  if (cache) return cache

  const score = await calcularScoreIaSemCache(clienteCnpj)
  await salvarScoreCache(score)
  return score
}

export const NOMES_CRITERIOS_SCORE = NOMES_CRITERIOS
export const PESOS_SCORE = PESOS

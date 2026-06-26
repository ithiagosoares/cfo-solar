import Anthropic from '@anthropic-ai/sdk'
import { REGRAS_CONTABEIS } from './regras-contabeis'
import type { LancamentoBruto } from './excel-aggregator'

export type CategoriaOficial =
  | 'receita_operacional'
  | 'antecipacao_recebiveis'
  | 'intercompany'
  | 'despesa_fixa'
  | 'despesa_variavel'
  | 'capex'
  | 'servico_da_divida'
  | 'pro_labore'
  | 'despesa_nao_recorrente'
  | 'outro'

export interface LancamentoClassificado extends LancamentoBruto {
  categoria: CategoriaOficial
}

const CATEGORIAS_VALIDAS: readonly CategoriaOficial[] = [
  'receita_operacional', 'antecipacao_recebiveis', 'intercompany',
  'despesa_fixa', 'despesa_variavel', 'capex', 'servico_da_divida',
  'pro_labore', 'despesa_nao_recorrente', 'outro',
]

function ehCategoriaValida(valor: unknown): valor is CategoriaOficial {
  return typeof valor === 'string' && (CATEGORIAS_VALIDAS as string[]).includes(valor)
}

// Keeps each Claude call's output small and reliable. ~100 lançamentos per
// request keeps prompt + JSON response comfortably inside max_tokens even for
// the most verbose descriptions, and is the batch size the analysis was
// explicitly designed around.
const TAMANHO_LOTE = 100

const SISTEMA_CLASSIFICADOR = `Você é um classificador contábil especializado no Grupo Solar System (energia solar, 5 empresas).

Sua única tarefa é classificar cada lançamento bancário em EXATAMENTE uma das categorias oficiais abaixo,
aplicando as REGRAS CONTÁBEIS OFICIAIS fornecidas no próximo bloco de contexto. Essas regras têm PRIORIDADE
MÁXIMA sobre a classificação manual da planilha (campo "classificacao_manual") — a classificação manual é
apenas contexto de apoio preenchido por uma colaboradora, pode estar errada, e NÃO é a decisão final.

CATEGORIAS OFICIAIS (responda com exatamente um destes valores, em minúsculas, com underscore):
- receita_operacional — entrada: venda real para cliente, incluindo Mercado Livre (Ni Hao = ML SP, Level2 = ML PR)
- antecipacao_recebiveis — entrada: antecipação de duplicatas/recebíveis (regra 1)
- intercompany — entrada OU saída: transferência entre empresas do grupo ou parceiros FGI (regra 2)
- despesa_fixa — saída: salários, encargos, aluguel, contabilidade, internet, segurança, energia, softwares, benefícios
- despesa_variavel — saída: matéria-prima, fretes, combustíveis, comissões, embalagens, alimentação operacional, EPIs, limpeza, manutenção
- capex — saída: máquinas, equipamentos, ferramentais, melhorias estruturais (regra 8)
- servico_da_divida — saída: parcelas de FGI (regra 6)
- pro_labore — saída: retiradas de pró-labore dos sócios (regra 7)
- despesa_nao_recorrente — saída: impostos de erro operacional ou evento extraordinário (regra 5)
- outro — quando não há informação suficiente para classificar com confiança

Responda SOMENTE com um JSON array, sem markdown, sem blocos de código, sem texto antes ou depois, no formato:
[{"indice": 0, "categoria": "despesa_fixa"}, {"indice": 1, "categoria": "intercompany"}]

O array de saída deve ter EXATAMENTE o mesmo número de itens que o número de lançamentos recebidos, um item
por índice, na mesma ordem. Não recalcule nem altere valores — apenas classifique.`

function construirPromptLote(lote: LancamentoBruto[]): string {
  const linhas = lote
    .map((l, i) => `${i}: empresa="${l.empresa}" | direcao=${l.direcao} | valor=${l.valor.toFixed(2)} | descricao="${l.descricao}" | classificacao_manual="${l.classificacaoManual}"`)
    .join('\n')
  return `Classifique os ${lote.length} lançamentos abaixo (um por linha, formato "índice: campos"):\n\n${linhas}\n\nRetorne o JSON array com {"indice", "categoria"} para cada um dos ${lote.length} índices.`
}

async function classificarLote(client: Anthropic, lote: LancamentoBruto[]): Promise<CategoriaOficial[]> {
  const resultadoPadrao: CategoriaOficial[] = lote.map(() => 'outro')

  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: [
      { type: 'text', text: SISTEMA_CLASSIFICADOR, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: REGRAS_CONTABEIS, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: construirPromptLote(lote) }],
  })

  const message = await stream.finalMessage()
  console.log('[classificador-ia] uso de tokens (cache):', JSON.stringify(message.usage, null, 2))

  if (message.stop_reason === 'max_tokens') {
    console.error(`[classificador-ia] lote de ${lote.length} lançamentos cortado por max_tokens — usando "outro" para o lote inteiro`)
    return resultadoPadrao
  }

  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[classificador-ia] resposta sem bloco de texto — usando "outro" para o lote inteiro')
    return resultadoPadrao
  }

  let texto = textBlock.text.trim()
  const match = texto.match(/\[[\s\S]*\]/)
  if (match) texto = match[0]

  try {
    const parsed = JSON.parse(texto) as Array<{ indice?: unknown; categoria?: unknown }>
    const resultado = [...resultadoPadrao]
    for (const item of parsed) {
      if (typeof item.indice !== 'number' || item.indice < 0 || item.indice >= lote.length) continue
      resultado[item.indice] = ehCategoriaValida(item.categoria) ? item.categoria : 'outro'
    }
    return resultado
  } catch (e) {
    console.error('[classificador-ia] falha ao parsear JSON do lote — usando "outro" para o lote inteiro', e)
    return resultadoPadrao
  }
}

export async function classificarLancamentos(lancamentos: LancamentoBruto[]): Promise<LancamentoClassificado[]> {
  if (lancamentos.length === 0) return []
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada — necessária para a classificação contábil')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const lotes: LancamentoBruto[][] = []
  for (let i = 0; i < lancamentos.length; i += TAMANHO_LOTE) {
    lotes.push(lancamentos.slice(i, i + TAMANHO_LOTE))
  }

  const resultado: LancamentoClassificado[] = []
  for (let i = 0; i < lotes.length; i++) {
    console.log(`[classificador-ia] processando lote ${i + 1}/${lotes.length} (${lotes[i].length} lançamentos)`)
    const categorias = await classificarLote(client, lotes[i])
    lotes[i].forEach((l, idx) => resultado.push({ ...l, categoria: categorias[idx] }))
  }

  return resultado
}

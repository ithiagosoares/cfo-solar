import Anthropic from '@anthropic-ai/sdk'
import { REGRAS_CONTABEIS } from './regras-contabeis'

// Experimental, isolated classifier — NOT wired into excel-aggregator.ts or any
// production route. Lives alongside classificador-ia.ts (the one actually used by
// /api/analisar and /api/chat) so the two approaches can be compared before deciding
// which one to keep. See src/app/api/teste-classificador/route.ts for the test harness.

export type CategoriaClassificacaoV2 =
  | 'receita_operacional'
  | 'despesa_fixa'
  | 'despesa_variavel'
  | 'intercompany'
  | 'antecipacao_recebiveis'
  | 'servico_da_divida'
  | 'capex'
  | 'pro_labore'
  | 'despesa_nao_recorrente'
  | 'revisar_manualmente'

export type ConfiancaClassificacao = 'alta' | 'media' | 'baixa'

export interface LancamentoBrutoV2 {
  data: string
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  empresa: string
  classificacaoManual?: string
}

export interface LancamentoClassificadoV2 extends LancamentoBrutoV2 {
  categoria: CategoriaClassificacaoV2
  subcategoria?: string
  confianca: ConfiancaClassificacao
}

const CATEGORIAS_VALIDAS: readonly CategoriaClassificacaoV2[] = [
  'receita_operacional', 'despesa_fixa', 'despesa_variavel', 'intercompany',
  'antecipacao_recebiveis', 'servico_da_divida', 'capex', 'pro_labore',
  'despesa_nao_recorrente', 'revisar_manualmente',
]

const CONFIANCAS_VALIDAS: readonly ConfiancaClassificacao[] = ['alta', 'media', 'baixa']

function ehCategoriaValida(valor: unknown): valor is CategoriaClassificacaoV2 {
  return typeof valor === 'string' && (CATEGORIAS_VALIDAS as string[]).includes(valor)
}

function ehConfiancaValida(valor: unknown): valor is ConfiancaClassificacao {
  return typeof valor === 'string' && (CONFIANCAS_VALIDAS as string[]).includes(valor)
}

const TAMANHO_LOTE = 150

const SISTEMA_CLASSIFICADOR = `Você é um classificador financeiro do Grupo Solar System.

Use as REGRAS CONTÁBEIS OFICIAIS fornecidas no próximo bloco de contexto como prioridade MÁXIMA.

INSTRUÇÕES DE CLASSIFICAÇÃO:
- Para cada lançamento abaixo, retorne a categoria correta dentre: receita_operacional, despesa_fixa,
  despesa_variavel, intercompany, antecipacao_recebiveis, servico_da_divida, capex, pro_labore,
  despesa_nao_recorrente, revisar_manualmente
- Use as 10 regras acima como prioridade máxima, mesmo que a classificacaoManual do lançamento diga
  outra coisa — a classificação manual é apenas contexto de apoio, pode estar errada
- Quando não houver classificacaoManual, use seu conhecimento geral sobre empresas e ferramentas de
  mercado para inferir a categoria (ex: nomes de plataformas de marketing/CRM = despesa_fixa categoria
  "software"; postos de combustível = despesa_variavel categoria "combustivel"; bancos/financeiras
  conhecidas = avaliar se é servico_da_divida)
- Se não conseguir classificar com confiança razoável, use "revisar_manualmente" em vez de chutar

CALIBRAÇÃO DE CONFIANÇA (importante — leia com atenção):
Você deve usar confiança ALTA sempre que o nome na descrição contiver palavras-chave reconhecíveis
(nome de credor conhecido, nome de empresa do grupo, nome de tipo de estabelecimento como
posto/farmácia/restaurante, ou termo financeiro específico como SECURITIZADORA/FIDC/BLOQ COMP).
Reserve "revisar_manualmente" e confiança baixa EXCLUSIVAMENTE para nomes de pessoa física sem
qualquer contexto adicional, ou descrições genéricas sem nenhuma pista (ex: apenas um número de CNPJ
sem nome). Não é necessário certeza absoluta para confiança alta — se a inferência é razoável e há
uma palavra-chave clara na descrição, classifique com confiança alta. Confiança média é para casos
onde a categoria é provável mas não tem palavra-chave explícita. Confiança baixa/revisar_manualmente
deve ser a MINORIA dos casos, não a maioria.

EXEMPLOS DE CLASSIFICAÇÃO CORRETA (siga este padrão de confiança):
- "PIX ENVIADO GIMENES GIMENES" → categoria: servico_da_divida, confianca: alta (nome do credor
  Gimenes aparece claramente na descrição)
- "PIX ENVIADO FERNANDO GIMENES TEJEDA" → categoria: servico_da_divida, confianca: alta (Gimenes é o
  credor FGI; nome de pessoa física associado ao credor ainda conta como pagamento ao credor)
- "PAGAMENTO DE BOLETO RICO C SECURITIZADORA" → categoria: antecipacao_recebiveis, confianca: alta
  (securitizadora = antecipação de recebíveis pela regra 1)
- "PIX ENVIADO SSG SOLAR SYSTEM GROUP CO" → categoria: intercompany, confianca: alta (empresa do
  grupo, pela regra 2)
- "PIX ENVIADO ALUMARKET" → categoria: intercompany, confianca: alta
- "PIX ENVIADO POSTOS YANI" → categoria: despesa_variavel, subcategoria: combustivel, confianca: alta
  (nome claramente indica posto de combustível)
- "PIX ENVIADO NOBRE CONTABIL" → categoria: despesa_fixa, subcategoria: contabilidade, confianca: alta
  (nome indica escritório de contabilidade)
- "PIX ENVIADO CRISTINA SILVA SANTOS" (sem mais contexto, nome de pessoa física desconhecida, sem
  classificação manual) → categoria: revisar_manualmente, confianca: baixa (não há como saber o que é
  sem mais contexto)

Retorne APENAS um array JSON, sem markdown, sem blocos de código, sem texto antes ou depois, um item
por lançamento NA MESMA ORDEM recebida, cada item no formato:
{"categoria": "despesa_fixa", "subcategoria": "internet", "confianca": "alta"}

O array de saída deve ter EXATAMENTE o mesmo número de itens que o número de lançamentos recebidos.
Não recalcule nem altere valores — apenas classifique.`

function construirPromptLote(lote: LancamentoBrutoV2[]): string {
  const json = JSON.stringify(
    lote.map(l => ({
      data: l.data,
      descricao: l.descricao,
      valor: l.valor,
      tipo: l.tipo,
      empresa: l.empresa,
      classificacaoManual: l.classificacaoManual ?? '',
    })),
  )
  return `LANÇAMENTOS (${lote.length} itens):\n${json}\n\nRetorne o array JSON com {"categoria", "subcategoria", "confianca"} para cada um dos ${lote.length} itens, na mesma ordem.`
}

interface ClassificacaoBruta {
  categoria: CategoriaClassificacaoV2
  subcategoria?: string
  confianca: ConfiancaClassificacao
}

async function classificarLote(client: Anthropic, lote: LancamentoBrutoV2[]): Promise<ClassificacaoBruta[]> {
  const resultadoPadrao: ClassificacaoBruta[] = lote.map(() => ({ categoria: 'revisar_manualmente', confianca: 'baixa' }))

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
  console.log('[classificador-ia-v2] uso de tokens (cache):', JSON.stringify(message.usage, null, 2))

  if (message.stop_reason === 'max_tokens') {
    console.error(`[classificador-ia-v2] lote de ${lote.length} lançamentos cortado por max_tokens — usando "revisar_manualmente" para o lote inteiro`)
    return resultadoPadrao
  }

  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[classificador-ia-v2] resposta sem bloco de texto — usando "revisar_manualmente" para o lote inteiro')
    return resultadoPadrao
  }

  let texto = textBlock.text.trim()
  const match = texto.match(/\[[\s\S]*\]/)
  if (match) texto = match[0]

  try {
    const parsed = JSON.parse(texto) as Array<{ categoria?: unknown; subcategoria?: unknown; confianca?: unknown }>
    return lote.map((_, i) => {
      const item = parsed[i]
      if (!item) return resultadoPadrao[i]
      return {
        categoria: ehCategoriaValida(item.categoria) ? item.categoria : 'revisar_manualmente',
        subcategoria: typeof item.subcategoria === 'string' && item.subcategoria.trim() ? item.subcategoria.trim() : undefined,
        confianca: ehConfiancaValida(item.confianca) ? item.confianca : 'baixa',
      }
    })
  } catch (e) {
    console.error('[classificador-ia-v2] falha ao parsear JSON do lote — usando "revisar_manualmente" para o lote inteiro', e)
    return resultadoPadrao
  }
}

export async function classificarLancamentos(lancamentos: LancamentoBrutoV2[]): Promise<LancamentoClassificadoV2[]> {
  if (lancamentos.length === 0) return []
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada — necessária para a classificação contábil')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const lotes: LancamentoBrutoV2[][] = []
  for (let i = 0; i < lancamentos.length; i += TAMANHO_LOTE) {
    lotes.push(lancamentos.slice(i, i + TAMANHO_LOTE))
  }

  const resultado: LancamentoClassificadoV2[] = []
  for (let i = 0; i < lotes.length; i++) {
    console.log(`[classificador-ia-v2] processando lote ${i + 1}/${lotes.length} (${lotes[i].length} lançamentos)`)
    const classificacoes = await classificarLote(client, lotes[i])
    lotes[i].forEach((l, idx) => resultado.push({ ...l, ...classificacoes[idx] }))
  }

  const total = resultado.length
  const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0'
  const alta = resultado.filter(l => l.confianca === 'alta').length
  const media = resultado.filter(l => l.confianca === 'media').length
  const baixa = resultado.filter(l => l.confianca === 'baixa').length
  const revisar = resultado.filter(l => l.categoria === 'revisar_manualmente').length
  console.log(
    `[classificador-ia-v2] distribuição final (${total} lançamentos): ` +
    `${pct(alta)}% alta, ${pct(media)}% média, ${pct(baixa)}% baixa, ${pct(revisar)}% revisar_manualmente`,
  )

  return resultado
}

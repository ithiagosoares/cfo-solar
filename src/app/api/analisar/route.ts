import Anthropic from '@anthropic-ai/sdk'
import { agregarExcel, periodoAnterior, formatarPeriodoLabel } from '@/lib/excel-aggregator'
import { salvarRelatorio, buscarRelatorioPorPeriodo } from '@/lib/relatorios-repository'
import type { RelatorioCompleto } from '@/types/financeiro'

export const maxDuration = 60

const SISTEMA = `Você é um analista financeiro especializado no Grupo Solar System (energia solar, 5 empresas).

Os números abaixo já estão calculados e são definitivos — eles vieram de um cálculo determinístico
feito em código sobre os extratos bancários e a aba FECHAMENTO. NÃO recalcule, NÃO some, NÃO
verifique a aritmética. Sua única tarefa é INTERPRETAR os números e produzir texto executivo.

CONTEXTO DO NEGÓCIO:
- FGI fixo mensal: R$46.000 (Gimenes R$5.000 + Barramares R$18.000 + Hera/AluMarket R$23.000)
- Meta mensal de faturamento vendido: R$2.000.000
- "movimentacoesInternas" e "antecipacoes" já foram excluídas dos totais de entradas/saídas —
  são mostradas apenas como contexto de quanto capital circulou entre empresas do grupo ou via
  antecipação de recebíveis (RICO C Securitizadora, Genesis FIDC, Lotus Performance FIDC).
- Se um bloco "COMPARATIVO COM O MÊS ANTERIOR" for fornecido no contexto, inclua no resumoExecutivo
  uma comparação objetiva (variação de faturamento, saldo, entradas/saídas) com base nesses números.
  Se esse bloco não for fornecido, não mencione mês anterior nem invente comparação.`

const ESTRUTURA_SAIDA = `{
  "resumoExecutivo": "2-3 parágrafos objetivos sobre a situação financeira do grupo, citando os números fornecidos",
  "alertas": [
    { "nivel": "danger", "titulo": "Título do alerta", "descricao": "Descrição com números reais dos dados fornecidos" }
  ],
  "recomendacoes": [
    { "prioridade": 1, "acao": "Ação específica, prática e mensurável" }
  ]
}`

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY não configurada no .env.local' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo')
    const periodoRaw = formData.get('periodo')

    if (!arquivo || !(arquivo instanceof Blob)) {
      return Response.json({ error: 'Arquivo Excel não enviado' }, { status: 400 })
    }

    if (arquivo.size > 20 * 1024 * 1024) {
      return Response.json({ error: 'Arquivo muito grande (máximo 20 MB)' }, { status: 400 })
    }

    if (typeof periodoRaw !== 'string' || !/^\d{4}-\d{2}$/.test(periodoRaw)) {
      return Response.json({ error: 'Período inválido. Informe no formato AAAA-MM (ex: 2026-05).' }, { status: 400 })
    }
    const periodoChave = periodoRaw

    const buffer = await arquivo.arrayBuffer()

    // Deterministic calculation in plain JS — no arithmetic is delegated to the model.
    const dados = agregarExcel(buffer, periodoChave)

    // Best-effort lookup of the prior calendar month so Claude can produce an
    // automatic comparison — absence of a previous report should never block analysis.
    let resumoMesAnterior = ''
    try {
      const mesAnterior = await buscarRelatorioPorPeriodo(periodoAnterior(periodoChave))
      if (mesAnterior) {
        resumoMesAnterior = `
COMPARATIVO COM O MÊS ANTERIOR (${formatarPeriodoLabel(periodoAnterior(periodoChave))}):
Faturamento Vendido: ${mesAnterior.faturamentoVendido}
Faturamento Faturado: ${mesAnterior.faturamentoFaturado}
Total Entradas: ${mesAnterior.totalEntradas}
Total Saídas: ${mesAnterior.totalSaidas}
Saldo do Grupo: ${mesAnterior.saldoGrupo}
`
      }
    } catch (e) {
      console.error('[/api/analisar] falha ao buscar mês anterior (não bloqueante)', e)
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: SISTEMA,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Interprete os dados financeiros já calculados abaixo e retorne um JSON com EXATAMENTE esta estrutura:

${ESTRUTURA_SAIDA}

REGRAS PARA O JSON:
- "nivel" nos alertas deve ser exatamente um de: "danger", "warning", "info", "success"
- Gere 4-6 alertas cobrindo: FGI, meta, saldo do grupo, concentração de clientes, margem, empresas com saldo negativo
- Gere 5-7 recomendações práticas ordenadas por prioridade (1 = mais urgente)
- Seja específico — cite os valores reais abaixo, não invente números novos`,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: `${resumoMesAnterior}
DADOS JÁ CALCULADOS (definitivos, não recalcule):
${JSON.stringify(dados, null, 2)}

Retorne SOMENTE o JSON válido, sem markdown, sem blocos de código, sem texto antes ou depois.`,
            },
          ],
        },
      ],
    })

    const message = await stream.finalMessage()

    console.log('[/api/analisar] Resposta completa da Anthropic API:', JSON.stringify(message, null, 2))
    console.log('[/api/analisar] Uso de tokens (cache):', JSON.stringify(message.usage, null, 2))

    if (message.stop_reason === 'max_tokens') {
      throw new Error(
        'A resposta da IA foi cortada por limite de tokens (max_tokens). Reduza o tamanho da planilha ou aumente max_tokens.',
      )
    }

    const textBlock = message.content.find(b => b.type === 'text')

    if (!textBlock || textBlock.type !== 'text') {
      const tiposRecebidos = message.content.map(b => b.type).join(', ') || 'nenhum'
      throw new Error(
        `Resposta inválida da API Claude — nenhum bloco de texto retornado (stop_reason: ${message.stop_reason}, blocos recebidos: ${tiposRecebidos})`,
      )
    }

    let texto = textBlock.text.trim()
    const match = texto.match(/\{[\s\S]*\}/)
    if (match) texto = match[0]

    if (!texto) {
      throw new Error('Bloco de texto retornado pela IA está vazio')
    }

    const analise = JSON.parse(texto) as RelatorioCompleto['analise']

    // Persisted as a best-effort side effect — a Supabase outage shouldn't block
    // the user from getting their analysis, just from having it saved for later.
    try {
      await salvarRelatorio(periodoChave, dados, analise)
    } catch (e) {
      console.error('[/api/analisar] falha ao salvar no Supabase (não bloqueante)', e)
    }

    const relatorio: RelatorioCompleto = {
      periodo: dados.periodo,
      periodoChave,
      faturamento: dados.faturamento,
      empresas: dados.empresas,
      consolidado: dados.consolidado,
      clientes: dados.clientes,
      analise,
    }

    return Response.json(relatorio)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno desconhecido'
    console.error('[/api/analisar]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

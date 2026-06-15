import Anthropic from '@anthropic-ai/sdk'
import type { DadosConsolidados, RelatorioIA } from '@/types/financeiro'
import { formatMoeda, formatPercentual } from '@/lib/utils'

const FGI_TOTAL = 46_000

function montarContexto(dados: DadosConsolidados): string {
  const { empresas, kpis, clientes, alertas, fechamento } = dados

  const linhasEmpresas = empresas
    .map(
      e =>
        `  • ${e.nome} (${e.codigo}): Receitas ${formatMoeda(e.receitas)} | Despesas ${formatMoeda(e.despesas)} | Saldo ${formatMoeda(e.saldo)}`,
    )
    .join('\n')

  const linhasClientes = clientes
    .slice(0, 10)
    .map((c, i) => `  ${i + 1}. ${c.nome}: ${formatMoeda(c.valor)} (${formatPercentual(c.percentual)}) — ${c.empresa}`)
    .join('\n')

  const linhasAlertas = alertas
    .map(a => `  [${a.tipo.toUpperCase()}] ${a.titulo}: ${a.mensagem}`)
    .join('\n')

  const blocoFechamento = fechamento
    ? `
=== FECHAMENTO CONSOLIDADO ===
Receita Total   : ${formatMoeda(fechamento.receitaTotal)}
Despesa Total   : ${formatMoeda(fechamento.despesaTotal)}
Resultado Líq.  : ${formatMoeda(fechamento.resultadoLiquido)}
Antecipações    : RICO ${formatMoeda(fechamento.antecipacoes.rico)} | Genesis ${formatMoeda(fechamento.antecipacoes.genesis)} | Lotus ${formatMoeda(fechamento.antecipacoes.lotus)}
`
    : ''

  return `
RELATÓRIO FINANCEIRO — GRUPO SOLAR SYSTEM
Período: ${dados.periodo}

=== KPIs PRINCIPAIS ===
Saldo Consolidado    : ${formatMoeda(kpis.saldoConsolidado)}
Faturamento Total    : ${formatMoeda(kpis.faturamentoTotal)}
Margem Bruta         : ${formatPercentual(kpis.margemBruta)}
FGI Fixo Mensal      : ${formatMoeda(FGI_TOTAL)} (Gimenes R$5k + Barramares R$18k + AluMarket/Hera R$23k)
Comprometimento FGI  : ${formatPercentual(kpis.comprometimentoFGI)} do faturamento
Progresso Meta R$2M  : ${formatPercentual(kpis.progressoMeta)}

=== PERFORMANCE POR EMPRESA ===
${linhasEmpresas}

=== TOP 10 CLIENTES (por receita operacional) ===
${linhasClientes}

=== ALERTAS AUTOMÁTICOS ===
${linhasAlertas}
${blocoFechamento}
=== CONTEXTO DO NEGÓCIO ===
• 5 empresas: Solar System Matriz (SS1), Solar System Filial PR (SS2), Level2, Ni Hao, AluMarket
• Meta mensal: R$ 2.000.000 em vendas consolidadas
• Clientes estratégicos: Neo Solar e Route 66
• Antecipadores de recebíveis: RICO C Securitizadora, Genesis FIDC, Lotus Performance FIDC
• Movimentações entre empresas do grupo NÃO são receita operacional
`.trim()
}

export async function analisarComClaude(dados: DadosConsolidados): Promise<RelatorioIA> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const contexto = montarContexto(dados)

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: `Você é o CFO do Grupo Solar System, especialista em análise financeira para empresas de energia solar.
Forneça análises objetivas, práticas e orientadas a ação.
Responda em português brasileiro, de forma executiva e direta.
Seja específico com números e percentuais.`,
    messages: [
      {
        role: 'user',
        content: `Analise os dados financeiros abaixo e gere um relatório executivo completo.

${contexto}

Responda SOMENTE com um objeto JSON válido (sem markdown, sem código blocks), com exatamente estes campos:
{
  "resumoExecutivo": "2-3 parágrafos resumindo a situação financeira consolidada do grupo",
  "analiseFluxo": "análise detalhada do fluxo de caixa, performance por empresa e pontos de atenção",
  "analiseClientes": "análise da carteira de clientes, concentração, riscos e oportunidades",
  "analiseFGI": "análise do comprometimento com FGI (R$46k/mês fixo), impacto no resultado e comparativo com faturamento",
  "recomendacoes": ["lista de 5-7 recomendações práticas e prioritárias, ordenadas por urgência"],
  "alertasPrioritarios": ["lista de 3-5 alertas que requerem ação imediata do CFO"],
  "perspectiva": "perspectiva e projeções para os próximos 30 dias"
}`,
      },
    ],
  })

  const message = await stream.finalMessage()

  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Resposta inválida retornada pela API do Claude')
  }

  let texto = textBlock.text.trim()

  // Remove possíveis blocos de markdown
  const jsonMatch = texto.match(/\{[\s\S]*\}/)
  if (jsonMatch) texto = jsonMatch[0]

  try {
    const parsed = JSON.parse(texto)
    return {
      resumoExecutivo: parsed.resumoExecutivo ?? '',
      analiseFluxo: parsed.analiseFluxo ?? '',
      analiseClientes: parsed.analiseClientes ?? '',
      analiseFGI: parsed.analiseFGI ?? '',
      recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes : [],
      alertasPrioritarios: Array.isArray(parsed.alertasPrioritarios) ? parsed.alertasPrioritarios : [],
      perspectiva: parsed.perspectiva ?? '',
    }
  } catch (err) {
    throw new Error(`Falha ao interpretar resposta da IA: ${err instanceof Error ? err.message : 'JSON inválido'}`)
  }
}

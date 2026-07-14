import Anthropic from '@anthropic-ai/sdk'
import { agregarExcel, periodoAnterior, formatarPeriodoLabel } from '@/lib/excel-aggregator'
import type { OverrideLancamento, GrupoCusto } from '@/lib/excel-aggregator'
import { salvarRelatorio, buscarRelatorioPorPeriodo } from '@/lib/relatorios-repository'
import type { RelatorioSalvo } from '@/lib/relatorios-repository'
import { listarOverrides } from '@/lib/lancamentos-overrides-repository'
import { PERFIL_FINANCEIRO } from '@/lib/perfil-financeiro'
import { REGRAS_CONTABEIS } from '@/lib/regras-contabeis'
import { MODELO_COMERCIAL } from '@/lib/modelo-comercial'
import { EVENTOS_PONTUAIS } from '@/lib/eventos-pontuais'
import { calcularDependenciaAntecipacao, calcularEvolucaoCaixa, calcularCapitalDeGiro } from '@/lib/calcular-totais'
import type { RelatorioCompleto } from '@/types/financeiro'

export const maxDuration = 180

// Maps natureza_corrigida (from lancamentos_overrides) to the GrupoCusto bucket
// used in ResumoCustos, so overrides with custom categoria labels still roll up
// correctly (e.g. "Serra Cortesa" with natureza "capex" → bucket 'capex').
const NATUREZA_PARA_GRUPO: Partial<Record<string, GrupoCusto>> = {
  capex:       'capex',
  opex:        'variavel',
  financeiro:  'servico_da_divida',
  pessoal:     'pro_labore',
}

const SISTEMA = `Você é um analista financeiro especializado no Grupo Solar System (energia solar, 5 empresas).

Os números abaixo já estão calculados e são definitivos — eles vieram de um cálculo determinístico
feito em código sobre os extratos bancários e a aba FECHAMENTO, já aplicando as REGRAS CONTÁBEIS
OFICIAIS fornecidas a seguir (cada lançamento já foi reclassificado conforme essas regras — capex,
serviço da dívida, pró-labore, intercompany e antecipação de recebíveis já estão corretamente
separados de despesa operacional regular). NÃO recalcule, NÃO some, NÃO verifique a aritmética. Sua
única tarefa é INTERPRETAR os números e produzir texto executivo, usando as regras contábeis e o
perfil financeiro como contexto qualitativo para enriquecer alertas e recomendações.

CONTEXTO DO NEGÓCIO:
- FGI fixo mensal: R$46.000 (Gimenes R$5.000 + Barramares R$18.000 + Hera/AluMarket R$23.000)
- Meta mensal de faturamento vendido: R$2.000.000
- DOIS NÚMEROS DE "ENTRADA" DISTINTOS, NÃO CONFUNDA UM COM O OUTRO:
  1. "consolidado.totalEntradas" (e "saldoGrupo" derivado dele) = CAIXA REAL que entrou
     fisicamente no banco do grupo — inclui venda, antecipação de recebíveis (RICO C
     Securitizadora, Genesis FIDC, Lotus Performance FIDC) e intercompany recebido de outra
     empresa do grupo. É o número certo para falar de "saldo de caixa" e "saúde financeira
     do caixa".
  2. "empresas[].entradas" (por empresa) = RECEITA OPERACIONAL PURA — exclui antecipação e
     intercompany de propósito. É a base certa para falar de "venda", "faturamento" e margem
     operacional (junto com "despesasOperacionais"). NÃO use este número para descrever saldo
     de caixa, e não use o número de caixa para descrever quanto a empresa vendeu.
  3. "antecipacoes.total" é quanto do caixa real (item 1) veio de antecipação — não é venda
     nova, é adiantamento de um valor que a empresa já vendeu, com desconto. Se esse valor for
     uma fração grande do total de entradas, isso é um sinal de dependência de antecipação que
     vale destacar como alerta (o caixa está "puxado para frente", não é sustentável crescer
     assim indefinidamente).
- "movimentacoesInternas" mostra apenas a magnitude de capital que circulou entre empresas do
  grupo (qualquer direção) — não é despesa nem receita do grupo como um todo, é dinheiro que já
  era do grupo só mudando de conta.
- "despesasOperacionais" (empresa e grupo) exclui capex, serviço da dívida, pró-labore e despesa
  não-recorrente — é a base correta para discutir margem operacional. "saidas" é o caixa total
  que saiu do banco (inclui capex/dívida/pró-labore), correto para discutir saldo de caixa.
- Se um bloco "COMPARATIVO COM O MÊS ANTERIOR" for fornecido no contexto, inclua no resumoExecutivo
  uma comparação objetiva (variação de faturamento, saldo, entradas/saídas) com base nesses números.
  Se esse bloco não for fornecido, não mencione mês anterior nem invente comparação.
- Você também recebe a seguir um PERFIL FINANCEIRO FIXO do grupo (regras de classificação, dívidas,
  particularidades de cada empresa, clientes, metas), as REGRAS CONTÁBEIS OFICIAIS completas, e o
  MODELO COMERCIAL fixo (funil Orçamento → Pedido → Faturamento, vendedores, indicadores). Use-os
  para enriquecer alertas e recomendações com contexto qualitativo que os números isolados não
  mostram — por exemplo: não trate movimentações de capital de giro entre empresas do grupo (ex:
  AluMarket↔Matriz) como dívida externa, e considere compromissos futuros já conhecidos (como o
  aumento do FGI para ~R$69.000/mês a partir de agosto/2026) ao avaliar risco. Não duplique
  informações que já estão no CONTEXTO DO NEGÓCIO acima.
- O módulo comercial descrito no MODELO COMERCIAL ainda não está integrado ao sistema — não há dados
  reais de orçamentos, pedidos, vendedores ou conversão disponíveis hoje. NÃO invente nomes de
  vendedores, números de conversão, orçamentos ou pedidos; só use o MODELO COMERCIAL como contexto
  qualitativo de como o negócio funciona, não como fonte de números.

DIMENSÕES DE ANÁLISE ESPERADAS:
A análise deve ir além de somar entradas e saídas. Integre as dimensões abaixo ao longo do
resumoExecutivo, alertas e recomendações — não como seções separadas, mas como camadas analíticas
que enriquecem a leitura dos números quando os dados as suportarem:

1. FLUXO DE CAIXA: Avalie o comportamento do caixa no período — se houve pressão de liquidez
   (saídas operacionais + financeiras superiores às entradas orgânicas), se o saldo final indica
   folga ou aperto, e se o padrão é sustentável.

2. CAPITAL DE GIRO: Estime a real necessidade de capital de giro. Antecipação de recebíveis mascara
   a necessidade — quando "antecipacoes.total" é relevante, o caixa está "puxado para frente" e a
   empresa precisaria de capital adicional sem esse recurso. Deixe isso explícito.

3. EVOLUÇÃO MÊS A MÊS: Quando disponível o bloco "COMPARATIVO COM O MÊS ANTERIOR", comente a
   tendência de faturamento, saldo e estrutura de custos. O grupo está crescendo, estável ou em
   retração? A variação é operacional ou financeira?

4. INVESTIMENTOS CAPEX: Identifique lançamentos classificados como categoria "capex" nos dados.
   Comente o nível de investimento em relação ao caixa disponível — CAPEX alto num mês de caixa
   apertado é sinal de pressão de liquidez adicional que o gestor precisa enxergar.

5. ESTRUTURA DE CUSTOS (OPEX × CAPEX × FINANCEIRO): Separe claramente no resumoExecutivo os três
   destinos do caixa de saída: OPEX (despesa_fixa + despesa_variavel + pro_labore = custo
   operacional recorrente), CAPEX (investimentos), e FINANCEIRO (servico_da_divida +
   antecipacao_recebiveis = custo de capital e dívida). Isso mostra ao gestor onde cada real foi.

6. DEPENDÊNCIA BANCÁRIA E DE CRÉDITO: Atenção especial a Watts e AluMarket — empresas do grupo
   sem receita operacional própria que dependem de capital intercompany. Quando
   "antecipacoes.total / consolidado.totalEntradas" superar 30%, alerte sobre dependência
   estrutural de antecipação (caixa artificialmente inflado). Identifique também se o nível de
   serviço da dívida está consumindo parcela expressiva do caixa gerado.

7. OPORTUNIDADES DE MELHORIA: Baseado na estrutura de custos observada, aponte onde há potencial
   de otimização — ex: custo financeiro de antecipação alto (aponta para melhora de prazo de
   recebimento), CAPEX concentrado (possível renegociação de parcelas), despesa variável
   desproporcional em uma empresa específica, empresa com margem negativa recorrente.

8. INDICADORES BANCÁRIOS: Quando os dados permitirem, inclua métricas relevantes para eventual
   negociação com banco: (a) custo financeiro total do período (servico_da_divida +
   desconto de antecipação, se disponível); (b) cobertura de dívida — quanto do caixa operacional
   cobre as obrigações financeiras; (c) dependência de antecipação como percentual do caixa.

PROIBIÇÃO DE CÁLCULOS PRÓPRIOS — REGRA ABSOLUTA:
Você NUNCA deve calcular, estimar, somar, dividir ou derivar qualquer porcentagem,
total, média, variação ou comparação a partir dos dados brutos do JSON. Todo número
que aparecer no relatório deve vir de um dos seguintes lugares:
  (a) diretamente do JSON de dados fornecido (ex: "consolidado.totalEntradas"),
  (b) do bloco "MÉTRICAS JÁ CALCULADAS" fornecido no contexto da análise.
Se uma métrica que você gostaria de mencionar não estiver disponível em nenhum
desses dois lugares, escreva explicitamente que "o dado não está disponível" —
nunca estime, aproxime ou calcule por conta própria. Isso inclui percentuais de
dependência de antecipação, variações mês a mês, margens, proporções de CAPEX e
qualquer outro indicador derivado. A violação desta regra já causou um erro real
nesta aplicação: dependência de antecipação reportada como 80% quando o valor
correto era 26%.`

const ESTRUTURA_SAIDA = `{
  "resumoExecutivo": "3-4 parágrafos cobrindo: (1) desempenho de caixa e receita operacional do período, com comparativo mês anterior quando disponível; (2) estrutura de custos separando OPEX, CAPEX e custos financeiros com os valores reais; (3) capital de giro e nível de dependência de antecipação de recebíveis; (4) situação das empresas sem receita própria (Watts, AluMarket) e principais riscos ou oportunidades identificados",
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

    const nomeArquivo = 'name' in arquivo && typeof arquivo.name === 'string' ? arquivo.name : ''
    const extensaoValida = /\.(xlsx|xls)$/i.test(nomeArquivo)
    const MIME_TYPES_EXCEL = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/octet-stream', // alguns navegadores/SOs não preenchem o MIME corretamente
      '',
    ]
    if (!extensaoValida || !MIME_TYPES_EXCEL.includes(arquivo.type)) {
      return Response.json({ error: 'Envie um arquivo .xlsx ou .xls válido' }, { status: 400 })
    }

    if (arquivo.size > 20 * 1024 * 1024) {
      return Response.json({ error: 'Arquivo muito grande (máximo 20 MB)' }, { status: 400 })
    }

    if (typeof periodoRaw !== 'string' || !/^\d{4}-\d{2}$/.test(periodoRaw)) {
      return Response.json({ error: 'Período inválido. Informe no formato AAAA-MM (ex: 2026-05).' }, { status: 400 })
    }
    const periodoChave = periodoRaw

    const buffer = await arquivo.arrayBuffer()

    // Busca overrides cadastrados para este período — não bloqueante: uma falha
    // aqui não impede a análise, só desativa as correções pontuais deste mês.
    let overrides: OverrideLancamento[] = []
    try {
      const overridesDb = await listarOverrides(periodoChave)
      overrides = overridesDb.map(o => ({
        empresa: o.empresa,
        valor: o.valor,
        categoriaOriginal: o.categoriaOriginal,
        categoriaCorrigida: o.categoriaCorrigida,
        grupoCorrigido: o.naturezaCorrigida ? NATUREZA_PARA_GRUPO[o.naturezaCorrigida] : undefined,
      }))
      if (overrides.length) {
        console.log(`[/api/analisar] ${overrides.length} override(s) carregados para ${periodoChave}`)
      }
    } catch (e) {
      console.error('[/api/analisar] falha ao buscar overrides (não bloqueante)', e)
    }

    // Extraction and classification are both deterministic — mapearCategoria()
    // translates the colaboradora's manual classification into formal categories
    // via a dictionary lookup, then the summation runs in plain JS. No AI involved
    // until the interpretive step below (resumoExecutivo/alertas/recomendações).
    const dados = agregarExcel(buffer, periodoChave, overrides.length ? overrides : undefined)

    // Best-effort lookup of the prior calendar month — absence of a previous report
    // should never block analysis. relatorioAnterior is also passed to calcularEvolucaoCaixa.
    let relatorioAnterior: RelatorioSalvo | null = null
    let resumoMesAnterior = ''
    try {
      relatorioAnterior = await buscarRelatorioPorPeriodo(periodoAnterior(periodoChave))
      if (relatorioAnterior) {
        resumoMesAnterior = `
COMPARATIVO COM O MÊS ANTERIOR (${formatarPeriodoLabel(periodoAnterior(periodoChave))}):
Faturamento Vendido: ${relatorioAnterior.faturamentoVendido}
Faturamento Faturado: ${relatorioAnterior.faturamentoFaturado}
Total Entradas: ${relatorioAnterior.totalEntradas}
Total Saídas: ${relatorioAnterior.totalSaidas}
Saldo do Grupo: ${relatorioAnterior.saldoGrupo}
`
      }
    } catch (e) {
      console.error('[/api/analisar] falha ao buscar mês anterior (não bloqueante)', e)
    }

    // Pre-compute derived metrics in code so Claude never needs to calculate
    // percentages or comparisons from raw data (which caused a real error: 80%
    // reported for antecipação dependency when the correct value was 26%).
    const metricas = {
      dependenciaAntecipacao: calcularDependenciaAntecipacao(dados),
      evolucaoCaixa: calcularEvolucaoCaixa(dados, relatorioAnterior),
      capitalDeGiro: calcularCapitalDeGiro(dados),
    }
    console.log(`[/api/analisar] métricas pré-calculadas — antecipação: ${metricas.dependenciaAntecipacao.formula} | capital de giro: ${metricas.capitalDeGiro.formula}`)

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
        {
          type: 'text',
          text: PERFIL_FINANCEIRO,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: REGRAS_CONTABEIS,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: MODELO_COMERCIAL,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: EVENTOS_PONTUAIS,
          // Sem cache_control — a API aceita no máximo 4 breakpoints de cache; os 4
          // blocos acima (SISTEMA, PERFIL_FINANCEIRO, REGRAS_CONTABEIS, MODELO_COMERCIAL)
          // já usam o limite. EVENTOS_PONTUAIS muda todo mês, então pouco benefício em
          // cachear de qualquer forma.
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
- Gere 5-8 alertas cobrindo: FGI e serviço da dívida, meta de faturamento, saldo do grupo, dependência de antecipação de recebíveis, CAPEX sobre o caixa, empresas sem receita própria (Watts/AluMarket), margem operacional, concentração de clientes — use apenas os que os dados suportarem
- Gere 5-7 recomendações práticas ordenadas por prioridade (1 = mais urgente), incluindo pelo menos uma sobre estrutura de custos ou eficiência financeira quando os dados indicarem oportunidade
- Seja específico — cite os valores reais abaixo, não invente números novos`,
              // Sem cache_control aqui de propósito — a API aceita no máximo 4
              // blocos com cache_control por request, e os 4 blocos do system
              // (SISTEMA + PERFIL_FINANCEIRO + REGRAS_CONTABEIS + MODELO_COMERCIAL)
              // já usam o limite inteiro. Esse bloco é pequeno comparado aos
              // documentos de referência, então a perda de cache aqui é mínima.
            },
            {
              type: 'text',
              text: `${resumoMesAnterior}
MÉTRICAS JÁ CALCULADAS — USE ESTES VALORES, NÃO RECALCULE:
- Dependência de Antecipação de Recebíveis: ${metricas.dependenciaAntecipacao.formula}
- Evolução do Caixa (saldo e entradas vs mês anterior): ${metricas.evolucaoCaixa.formula}
- Estimativa de Necessidade de Capital de Giro: ${metricas.capitalDeGiro.formula}

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
      antecipacoes: dados.antecipacoes,
      analise,
    }

    return Response.json(relatorio)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno desconhecido'
    console.error('[/api/analisar]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

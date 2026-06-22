import Anthropic from '@anthropic-ai/sdk'
import type { MensagemChat, RelatorioCompleto } from '@/types/financeiro'

export const maxDuration = 30

const SISTEMA_CHAT = `Você é um assistente financeiro do Grupo Solar System, empresa de energia solar com 5 empresas: Solar System Matriz, Solar System Filial PR, Level2, Ni Hao e AluMarket.

No próximo bloco de contexto você recebe os dados financeiros já calculados do período (entradas, saídas, saldo por empresa, despesas por categoria, carteira de clientes) e a análise executiva já gerada (resumo, alertas, recomendações). Responda às perguntas do usuário com base SOMENTE nesses dados — nunca invente números, nomes de clientes ou valores que não estejam no contexto fornecido. Se a pergunta não puder ser respondida com os dados disponíveis, diga isso claramente em vez de supor.

CONTEXTO FIXO DO NEGÓCIO:
- FGI fixo mensal: R$46.000 (Gimenes R$5.000 + Barramares R$18.000 + Hera/AluMarket R$23.000)
- Meta mensal de faturamento vendido: R$2.000.000
- Movimentações internas entre empresas do grupo e antecipações de recebíveis (FIDC, Securitizadoras) já foram excluídas dos totais de entradas/saídas.

Responda em português, de forma direta e objetiva — como um CFO experiente conversando com a diretoria. Evite parágrafos longos quando uma resposta curta resolve.`

function sanitizarMensagens(input: unknown): MensagemChat[] {
  if (!Array.isArray(input)) return []
  return input.filter(
    (m): m is MensagemChat =>
      m &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.trim() !== '',
  )
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY não configurada no .env.local' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const mensagens = sanitizarMensagens(body?.mensagens)
    const relatorio = body?.relatorio as RelatorioCompleto | undefined

    if (mensagens.length === 0) {
      return Response.json({ error: 'Nenhuma mensagem enviada' }, { status: 400 })
    }
    if (!relatorio) {
      return Response.json({ error: 'Dados financeiros não enviados' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Repeats identically on every turn of the same conversation — this is the
    // block that's actually large enough to clear Haiku's 2048-token cache
    // minimum, unlike the short system prompt above.
    const contextoDados = `DADOS FINANCEIROS E ANÁLISE JÁ CALCULADOS — Período: ${relatorio.periodo}

${JSON.stringify(relatorio, null, 2)}`

    const anthropicStream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: [
        { type: 'text', text: SISTEMA_CHAT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contextoDados, cache_control: { type: 'ephemeral' } },
      ],
      messages: mensagens.map(m => ({ role: m.role, content: m.content })),
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        anthropicStream.on('text', (text) => {
          controller.enqueue(encoder.encode(text))
        })
        try {
          const finalMessage = await anthropicStream.finalMessage()
          console.log('[/api/chat] Uso de tokens (cache):', JSON.stringify(finalMessage.usage, null, 2))
          controller.close()
        } catch (err) {
          console.error('[/api/chat] erro no stream', err)
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno desconhecido'
    console.error('[/api/chat]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

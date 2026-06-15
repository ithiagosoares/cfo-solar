import { analisarComClaude } from '@/lib/claude-client'
import type { DadosConsolidados } from '@/types/financeiro'

export const maxDuration = 90

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY não configurada. Adicione ao arquivo .env.local.' },
        { status: 500 },
      )
    }

    const dados: DadosConsolidados = await request.json()

    if (!dados?.empresas || !dados?.kpis) {
      return Response.json(
        { error: 'Dados inválidos ou incompletos. Carregue o arquivo Excel primeiro.' },
        { status: 400 },
      )
    }

    const relatorio = await analisarComClaude(dados)
    return Response.json(relatorio)
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro interno desconhecido'
    console.error('[/api/analisar]', mensagem)
    return Response.json({ error: mensagem }, { status: 500 })
  }
}

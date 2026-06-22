import { listarRelatorios, buscarRelatorioPorPeriodo } from '@/lib/relatorios-repository'
import type { RelatorioCompleto } from '@/types/financeiro'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo')

    if (periodo) {
      const registro = await buscarRelatorioPorPeriodo(periodo)
      if (!registro) {
        return Response.json({ error: `Nenhum relatório salvo para o período ${periodo}` }, { status: 404 })
      }

      const relatorio: RelatorioCompleto = {
        periodo: registro.dadosCompletos.periodo,
        periodoChave: registro.periodo,
        faturamento: registro.dadosCompletos.faturamento,
        empresas: registro.dadosCompletos.empresas,
        consolidado: registro.dadosCompletos.consolidado,
        clientes: registro.dadosCompletos.clientes,
        analise: registro.analise,
      }
      return Response.json(relatorio)
    }

    const relatorios = await listarRelatorios()
    return Response.json({ relatorios })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno desconhecido'
    console.error('[/api/historico]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

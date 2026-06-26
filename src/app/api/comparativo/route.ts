import { buscarRelatorioPorPeriodo, type RelatorioSalvo } from '@/lib/relatorios-repository'
import { calcularVariacao } from '@/lib/utils'
import type { ComparativoResponse, RelatorioCompleto, VariacaoEmpresa, VariacaoKpi } from '@/types/financeiro'

function mapearParaRelatorioCompleto(registro: RelatorioSalvo): RelatorioCompleto {
  return {
    periodo: registro.dadosCompletos.periodo,
    periodoChave: registro.periodo,
    faturamento: registro.dadosCompletos.faturamento,
    empresas: registro.dadosCompletos.empresas,
    consolidado: registro.dadosCompletos.consolidado,
    clientes: registro.dadosCompletos.clientes,
    antecipacoes: registro.dadosCompletos.antecipacoes,
    analise: registro.analise,
  }
}

// Variação é sempre lida como "de A para B" (A é a base, B é o comparado).
function variacaoKpi(valorA: number, valorB: number): VariacaoKpi {
  return { valorA, valorB, variacaoPercentual: calcularVariacao(valorB, valorA) }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodoA = searchParams.get('periodoA')
    const periodoB = searchParams.get('periodoB')

    if (!periodoA || !periodoB) {
      return Response.json({ error: 'Informe periodoA e periodoB (formato AAAA-MM)' }, { status: 400 })
    }

    const [registroA, registroB] = await Promise.all([
      buscarRelatorioPorPeriodo(periodoA),
      buscarRelatorioPorPeriodo(periodoB),
    ])

    const faltando = [!registroA && periodoA, !registroB && periodoB].filter(Boolean)
    if (faltando.length > 0) {
      return Response.json({ error: `Nenhum relatório salvo para: ${faltando.join(', ')}` }, { status: 404 })
    }

    const relatorioA = mapearParaRelatorioCompleto(registroA!)
    const relatorioB = mapearParaRelatorioCompleto(registroB!)

    const empresasA = new Map(relatorioA.empresas.map(e => [e.nome, e]))
    const empresasB = new Map(relatorioB.empresas.map(e => [e.nome, e]))
    const nomesEmpresas = Array.from(new Set([...empresasA.keys(), ...empresasB.keys()]))

    const variacoesEmpresas: VariacaoEmpresa[] = nomesEmpresas.map(nome => {
      const a = empresasA.get(nome)
      const b = empresasB.get(nome)
      return {
        nome,
        entradas: variacaoKpi(a?.entradas ?? 0, b?.entradas ?? 0),
        saidas: variacaoKpi(a?.saidas ?? 0, b?.saidas ?? 0),
        saldo: variacaoKpi(a?.saldo ?? 0, b?.saldo ?? 0),
      }
    })

    const resposta: ComparativoResponse = {
      relatorioA,
      relatorioB,
      variacoes: {
        faturamentoVendido: variacaoKpi(relatorioA.faturamento.vendido, relatorioB.faturamento.vendido),
        faturamentoFaturado: variacaoKpi(relatorioA.faturamento.faturado, relatorioB.faturamento.faturado),
        saldoGrupo: variacaoKpi(relatorioA.consolidado.saldoGrupo, relatorioB.consolidado.saldoGrupo),
        totalEntradas: variacaoKpi(relatorioA.consolidado.totalEntradas, relatorioB.consolidado.totalEntradas),
        totalSaidas: variacaoKpi(relatorioA.consolidado.totalSaidas, relatorioB.consolidado.totalSaidas),
        empresas: variacoesEmpresas,
      },
    }

    return Response.json(resposta)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno desconhecido'
    console.error('[/api/comparativo]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

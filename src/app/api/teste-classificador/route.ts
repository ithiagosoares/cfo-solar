import * as XLSX from 'xlsx'
import { classificarLancamentos, type LancamentoBrutoV2 } from '@/lib/classificador-ia-v2'
import { calcularTotais } from '@/lib/calcular-totais'

// Isolated experiment endpoint — does NOT touch excel-aggregator.ts or /api/analisar.
// Extraction logic below is intentionally a self-contained duplicate (not imported
// from excel-aggregator.ts) so this stays fully decoupled from the production path
// until a decision is made on whether to swap classifiers.

export const maxDuration = 180

const MAPA_EMPRESAS: Record<string, string> = {
  MATRIZ: 'Solar System Matriz',
  FILIAL: 'Solar System Filial PR',
  LEVEL: 'Level2',
  'NI HAO': 'Ni Hao',
  ALUMARKET: 'AluMarket',
}

function nomeEmpresaDaAba(nomeAba: string): string {
  const upper = nomeAba.toUpperCase().trim()
  const chave = Object.keys(MAPA_EMPRESAS).find(k => upper.includes(k))
  return chave ? MAPA_EMPRESAS[chave] : nomeAba
}

function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const hasBrFormat = v.includes(',') && v.lastIndexOf('.') < v.lastIndexOf(',')
    const cleaned = hasBrFormat
      ? v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
      : v.replace(/[R$\s,]/g, '')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

interface ColunasExtrato {
  headerIdx: number
  data: number
  tipo: number
  valor: number
  descricao: number
  classificacao: number
}

function detectarColunas(linhas: unknown[][]): ColunasExtrato {
  for (let i = 0; i < Math.min(10, linhas.length); i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue

    let data = -1, tipo = -1, valor = -1, historico = -1, descricaoCategoria = -1, classificacao = -1, saldo = -1

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').toUpperCase().trim()
      if (!cell) continue
      if (cell === 'DATA' && data === -1) data = j
      if ((cell.includes('ENTRADA/') || cell === 'TIPO') && tipo === -1) tipo = j
      if (cell.includes('HIST') && historico === -1) historico = j
      if (cell.includes('VALOR') && valor === -1) valor = j
      if (cell.includes('CLASSIFIC') && classificacao === -1) classificacao = j
      if (cell.includes('DESCRI') && descricaoCategoria === -1) descricaoCategoria = j
      if (cell.includes('SALDO') && saldo === -1) saldo = j
    }

    if (tipo !== -1 && valor !== -1) {
      const descricaoFinal = historico !== -1 ? historico : descricaoCategoria
      let classificacaoFinal = classificacao !== -1 ? classificacao : (historico !== -1 ? descricaoCategoria : -1)
      // Some sheets carry the classification in a column with no header label at
      // all — but it always sits in the single gap between "Valor" and "Saldo".
      if (classificacaoFinal === -1 && saldo !== -1 && saldo - valor === 2) {
        classificacaoFinal = valor + 1
      }
      return { headerIdx: i, data, tipo, valor, descricao: descricaoFinal, classificacao: classificacaoFinal }
    }
  }

  return { headerIdx: -1, data: -1, tipo: -1, valor: -1, descricao: -1, classificacao: -1 }
}

function extrairLancamentos(ws: XLSX.WorkSheet, nomeEmpresa: string): LancamentoBrutoV2[] {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false }) as unknown[][]
  const cols = detectarColunas(linhas)
  if (cols.headerIdx === -1) return []

  const lancamentos: LancamentoBrutoV2[] = []
  for (let i = cols.headerIdx + 1; i < linhas.length; i++) {
    const row = linhas[i]
    if (!Array.isArray(row)) continue

    const tipoCell = String(row[cols.tipo] ?? '').toUpperCase().trim()
    const tipo = tipoCell.startsWith('ENTRADA') ? 'entrada' : tipoCell.startsWith('SAIDA') ? 'saida' : null
    if (!tipo) continue

    const valor = Math.abs(parseValor(row[cols.valor]))
    if (valor === 0) continue

    const data = cols.data >= 0 ? String(row[cols.data] ?? '').trim() : ''
    const descricao = cols.descricao >= 0 ? String(row[cols.descricao] ?? '').trim() : ''
    const classificacaoManual = cols.classificacao >= 0 ? String(row[cols.classificacao] ?? '').trim() : ''

    lancamentos.push({ data, descricao, valor, tipo, empresa: nomeEmpresa, classificacaoManual: classificacaoManual || undefined })
  }

  return lancamentos
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo')

    if (!arquivo || !(arquivo instanceof Blob)) {
      return Response.json({ error: 'Arquivo Excel não enviado' }, { status: 400 })
    }
    if (arquivo.size > 20 * 1024 * 1024) {
      return Response.json({ error: 'Arquivo muito grande (máximo 20 MB)' }, { status: 400 })
    }

    const buffer = await arquivo.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

    const todosLancamentos: LancamentoBrutoV2[] = []
    for (const nomeAba of workbook.SheetNames) {
      const upper = nomeAba.toUpperCase().trim()
      if (upper === 'FECHAMENTO' || upper.startsWith('PLANILHA')) continue
      const nomeEmpresa = nomeEmpresaDaAba(nomeAba)
      todosLancamentos.push(...extrairLancamentos(workbook.Sheets[nomeAba], nomeEmpresa))
    }

    console.log(`[teste-classificador] ${todosLancamentos.length} lançamentos extraídos, classificando via IA…`)
    const classificados = await classificarLancamentos(todosLancamentos)
    const totais = calcularTotais(classificados)

    return Response.json({ totalLancamentos: classificados.length, totais, lancamentos: classificados })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno desconhecido'
    console.error('[/api/teste-classificador]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

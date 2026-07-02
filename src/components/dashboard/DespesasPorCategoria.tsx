'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import type { CategoriaDespesa, EmpresaAnalise, GrupoCusto } from '@/types/financeiro'
import { formatMoeda, formatMoedaCompacta, formatPercentual } from '@/lib/utils'
import { CORES } from '@/lib/tema'
import styles from '@/styles/editorial.module.css'

const COR_GRUPO: Record<GrupoCusto, string> = {
  fixo:             CORES.pendente,
  variavel:         CORES.info,
  capex:            CORES.fornecedor,
  servico_da_divida: CORES.critico,
  pro_labore:       '#5f6f78',
  nao_recorrente:   CORES.baixo,
  sem_classificacao: '#9a6a22',
  outro:            CORES.ink3,
}

const LABEL_GRUPO: Record<GrupoCusto, string> = {
  fixo:             'Custo fixo',
  variavel:         'Custo variável',
  capex:            'CAPEX',
  servico_da_divida: 'Serviço da dívida',
  pro_labore:       'Pró-labore',
  nao_recorrente:   'Não recorrente',
  sem_classificacao: 'Sem classificação',
  outro:            'Outros',
}

interface TooltipPayload {
  active?: boolean
  payload?: Array<{ payload: CategoriaDespesa }>
}

function CustomTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div style={{ background: CORES.bg, border: `1px solid ${CORES.line2}`, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 4, color: CORES.ink }}>{item.categoria}</p>
      <p style={{ color: COR_GRUPO[item.grupo], fontWeight: 600 }}>{formatMoeda(item.valor)}</p>
      <p style={{ fontSize: 11, color: CORES.ink3, marginTop: 4 }}>
        {formatPercentual(item.percentualDoTotal)} · {LABEL_GRUPO[item.grupo]}
      </p>
    </div>
  )
}

function LegendaGrupos() {
  return (
    <div className="flex flex-wrap gap-4 mt-4">
      {(Object.keys(LABEL_GRUPO) as GrupoCusto[]).map(grupo => (
        <div key={grupo} className="flex items-center gap-1.5" style={{ fontSize: 11, color: CORES.ink2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: COR_GRUPO[grupo], display: 'inline-block', flexShrink: 0 }} />
          {LABEL_GRUPO[grupo]}
        </div>
      ))}
    </div>
  )
}

interface ResumoCustosBarraProps {
  custosFixos: number
  custosVariaveis: number
  capex: number
  servicoDaDivida: number
  proLabore: number
  despesaNaoRecorrente: number
  semClassificacao: number
  quantidadeSemClassificacao: number
  outros: number
}

function AvisoSemClassificacao({ quantidade, valor }: { quantidade: number; valor: number }) {
  if (!quantidade) return null
  // Defesa em profundidade: os valores já devem chegar numéricos e corretos da
  // origem (excel-aggregator.ts), mas relatórios salvos antes deste campo existir
  // (Supabase) trazem undefined em runtime mesmo com o tipo dizendo "number".
  const valorTexto = Number.isFinite(valor) ? formatMoeda(valor) : 'valor não identificado'
  return (
    <div className={`${styles.notice}`} style={{ borderLeftColor: 'var(--pendente)', marginBottom: 12 }}>
      <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--pendente)' }} />
      <span style={{ fontSize: 12.5 }}>
        {quantidade} lançamento{quantidade > 1 ? 's' : ''} sem categoria definida pela colaboradora
        ({valorTexto}) — verifique a planilha original.
      </span>
    </div>
  )
}

function ResumoCustosBarra({
  custosFixos = 0, custosVariaveis = 0, capex = 0, servicoDaDivida = 0, proLabore = 0,
  despesaNaoRecorrente = 0, semClassificacao = 0, quantidadeSemClassificacao = 0, outros = 0,
}: ResumoCustosBarraProps) {
  const total = custosFixos + custosVariaveis + outros
  if (total === 0 && capex === 0 && servicoDaDivida === 0 && proLabore === 0 && despesaNaoRecorrente === 0 && semClassificacao === 0) return null

  const itensOp = [
    { label: 'Custos Fixos', valor: custosFixos, cor: COR_GRUPO.fixo },
    { label: 'Custos Variáveis', valor: custosVariaveis, cor: COR_GRUPO.variavel },
    { label: 'Outros', valor: outros, cor: COR_GRUPO.outro },
  ]
  const itensFora = [
    { label: 'CAPEX', valor: capex, cor: COR_GRUPO.capex },
    { label: 'Serviço da Dívida', valor: servicoDaDivida, cor: COR_GRUPO.servico_da_divida },
    { label: 'Pró-labore', valor: proLabore, cor: COR_GRUPO.pro_labore },
    { label: 'Não Recorrente', valor: despesaNaoRecorrente, cor: COR_GRUPO.nao_recorrente },
  ].filter(item => item.valor > 0)

  return (
    <div style={{ marginBottom: 20 }}>
      <AvisoSemClassificacao quantidade={quantidadeSemClassificacao} valor={semClassificacao} />

      <div className="grid grid-cols-3 gap-0" style={{ border: `1px solid var(--line)`, marginBottom: itensFora.length > 0 ? 12 : 0 }}>
        {itensOp.map((item, i) => (
          <div key={item.label} style={{ padding: '14px 18px', borderLeft: i > 0 ? `1px solid var(--line)` : 'none' }}>
            <p className={styles.kl}>{item.label}</p>
            <p className={`${styles.num} mt-1.5`} style={{ fontSize: 16, fontWeight: 600, color: item.cor }}>
              {formatMoeda(item.valor)}
            </p>
            <p className={`${styles.num}`} style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
              {formatPercentual(total > 0 ? (item.valor / total) * 100 : 0)}
            </p>
          </div>
        ))}
      </div>

      {itensFora.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>
            Fora da despesa operacional — não compõem a margem operacional:
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${itensFora.length}, minmax(0, 1fr))` }}>
            {itensFora.map(item => (
              <div key={item.label} style={{ padding: '12px 16px', border: `1px solid var(--line)`, borderLeft: `2px solid ${item.cor}` }}>
                <p className={styles.kl}>{item.label}</p>
                <p className={`${styles.num} mt-1`} style={{ fontSize: 15, fontWeight: 600, color: item.cor }}>
                  {formatMoeda(item.valor)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DespesasPorCategoriaProps {
  despesasGrupo: CategoriaDespesa[]
  resumoCustosGrupo: ResumoCustosBarraProps
  empresas: EmpresaAnalise[]
}

export function DespesasPorCategoria({ despesasGrupo, resumoCustosGrupo, empresas }: DespesasPorCategoriaProps) {
  const [filtro, setFiltro] = useState<string>('grupo')

  const empresaSelecionada = filtro !== 'grupo' ? empresas.find(e => e.nome === filtro) ?? null : null
  const semCategorizacao = empresaSelecionada !== null && !empresaSelecionada.categorizacaoDisponivel

  const dadosAtivos = empresaSelecionada ? empresaSelecionada.despesasPorCategoria : despesasGrupo
  const resumoAtivo = empresaSelecionada ? empresaSelecionada.resumoCustos : resumoCustosGrupo
  const top10 = dadosAtivos.slice(0, 10)
  const tituloChart = empresaSelecionada ? empresaSelecionada.nome : 'Grupo (todas as empresas)'

  return (
    <div className="flex flex-col gap-5">
      <div className={styles.subnav} style={{ margin: 0 }}>
        <button onClick={() => setFiltro('grupo')} className={`${styles.stab} ${filtro === 'grupo' ? styles.stabOn : ''}`}>
          Grupo (todas)
        </button>
        {empresas.map(e => (
          <button key={e.nome} onClick={() => setFiltro(e.nome)} className={`${styles.stab} ${filtro === e.nome ? styles.stabOn : ''}`}>
            {e.nome.split(' ').pop()}
          </button>
        ))}
      </div>

      {semCategorizacao ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p className={styles.kl}>Total de despesas — {empresaSelecionada!.nome}</p>
          <p className={`${styles.serif} ${styles.num}`} style={{ fontSize: 32, color: 'var(--critico)', marginTop: 10 }}>
            {formatMoeda(empresaSelecionada!.saidas)}
          </p>
          <p className={styles.over} style={{ marginTop: 8 }}>Categorização não disponível para este canal</p>
        </div>
      ) : top10.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink3)', padding: '24px 0' }}>Sem despesas categorizadas para exibir.</p>
      ) : (
        <div>
          <div className={styles.shead}>
            <div className={`${styles.stitle} ${styles.serif}`}>Top {top10.length} Categorias de Despesa</div>
            <div className={styles.over}>{tituloChart}</div>
          </div>

          <div style={{ marginTop: 20 }}>
            <ResumoCustosBarra {...resumoAtivo} />
          </div>

          <ResponsiveContainer width="100%" height={Math.max(280, top10.length * 36)}>
            <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="1 4" stroke={CORES.line} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={formatMoedaCompacta}
                tick={{ fill: CORES.ink3, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="categoria"
                width={160}
                tick={{ fill: CORES.ink2, fontSize: 11 }}
                axisLine={{ stroke: CORES.line }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: CORES.paper }} />
              <Bar dataKey="valor" radius={[0, 2, 2, 0]} maxBarSize={20}>
                {top10.map((entry, i) => (
                  <Cell key={i} fill={COR_GRUPO[entry.grupo]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <LegendaGrupos />
        </div>
      )}
    </div>
  )
}

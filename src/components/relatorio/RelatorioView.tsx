'use client'

import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import type { RelatorioCompleto, NivelAlerta, PeriodoResumo } from '@/types/financeiro'
import { MetricaComFormula } from './MetricaComFormula'
import { formatMoeda, formatPercentual } from '@/lib/utils'
import styles from '@/styles/editorial.module.css'

type Analise = RelatorioCompleto['analise']

const ICONE_NIVEL: Record<NivelAlerta, typeof AlertTriangle> = {
  danger:  XCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info:    Info,
}

const COR_NIVEL: Record<NivelAlerta, string> = {
  danger:  'var(--critico)',
  warning: 'var(--pendente)',
  success: 'var(--positivo)',
  info:    'var(--info)',
}

interface RelatorioViewProps {
  relatorio: RelatorioCompleto
  mesAnterior: PeriodoResumo | null
}

export function RelatorioView({ relatorio, mesAnterior }: RelatorioViewProps) {
  const { analise, consolidado, antecipacoes, empresas } = relatorio

  // ── Indicadores calculados em código (nunca pela IA) ─────────────────────

  // 1. Dependência de Antecipação de Recebíveis
  const pctAntecipacao = consolidado.totalEntradas > 0
    ? (antecipacoes.total / consolidado.totalEntradas) * 100
    : 0
  const formulaAntecipacao =
    `${formatMoeda(antecipacoes.total)} ÷ ${formatMoeda(consolidado.totalEntradas)} = ${formatPercentual(pctAntecipacao)}`
  const corAntecipacao = pctAntecipacao > 50 ? 'danger' : pctAntecipacao > 30 ? 'warning' : 'normal'
  const notaAntecipacao = pctAntecipacao > 30
    ? 'Acima de 30% indica dependência estrutural de crédito (caixa puxado para frente).'
    : undefined

  // 2. Evolução do Caixa (saldo vs mês anterior)
  const saldoAtual = consolidado.saldoGrupo
  const saldoAnterior = mesAnterior?.saldoGrupo ?? null
  const variacaoAbsSaldo = saldoAnterior !== null ? saldoAtual - saldoAnterior : null
  const variacaoPctSaldo =
    saldoAnterior !== null && saldoAnterior !== 0
      ? ((saldoAtual - saldoAnterior) / Math.abs(saldoAnterior)) * 100
      : null
  const valorEvolucao =
    variacaoPctSaldo !== null
      ? `${variacaoPctSaldo >= 0 ? '+' : ''}${formatPercentual(variacaoPctSaldo)}`
      : formatMoeda(saldoAtual)
  const formulaEvolucao =
    saldoAnterior !== null && mesAnterior
      ? `Saldo ${formatMoeda(saldoAtual)} vs ${formatMoeda(saldoAnterior)} (${mesAnterior.periodo}) → ${variacaoAbsSaldo !== null && variacaoAbsSaldo >= 0 ? '+' : ''}${formatMoeda(variacaoAbsSaldo ?? 0)}`
      : `Saldo atual: ${formatMoeda(saldoAtual)} — sem mês anterior disponível`
  const corEvolucao: 'normal' | 'danger' | 'warning' | 'success' =
    variacaoPctSaldo === null ? 'normal'
    : variacaoPctSaldo >= 5  ? 'success'
    : variacaoPctSaldo >= 0  ? 'normal'
    : variacaoPctSaldo > -10 ? 'warning'
    : 'danger'

  // 3. Estimativa de Capital de Giro
  // gap = saídas totais − receita operacional pura (empresa.entradas já exclui antecipação e intercompany)
  const entradasOperacionais = empresas.reduce((soma, e) => soma + e.entradas, 0)
  const gap = consolidado.totalSaidas - entradasOperacionais
  const valorGap = `${gap > 0 ? '+' : ''}${formatMoeda(gap)}`
  const formulaGap =
    `${formatMoeda(consolidado.totalSaidas)} (saídas) − ${formatMoeda(entradasOperacionais)} (receita operacional) = ${formatMoeda(gap)}`
  const notaGap =
    gap > 0
      ? 'Positivo: saídas > receita operacional — diferença financiada por antecipação, crédito ou intercompany.'
      : 'Negativo: receita operacional cobre todas as saídas — não há necessidade de financiamento externo.'
  const corGap: 'normal' | 'danger' | 'warning' | 'success' =
    gap > consolidado.totalSaidas * 0.4 ? 'danger'
    : gap > 0 ? 'warning'
    : 'success'

  // ── Render ────────────────────────────────────────────────────────────────

  const alertasDanger = analise.alertas.filter(a => a.nivel === 'danger')
  const outrosAlertas = analise.alertas.filter(a => a.nivel !== 'danger')
  const recsOrdenadas = [...analise.recomendacoes].sort((a, b) => a.prioridade - b.prioridade)

  return (
    <div className="flex flex-col gap-8 animate-fadeIn">

      {/* ── Indicadores calculados ──────────────────────────────────────── */}
      <section>
        <div className={styles.shead} style={{ marginBottom: 12 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Indicadores Calculados</div>
          <div className={styles.over}>base de cálculo auditável</div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 16, lineHeight: 1.5 }}>
          Métricas derivadas calculadas em código — os mesmos valores entregues à IA como fatos,
          não como dados brutos para ela interpretar.
        </p>
        <div className={`${styles.kpis}`} style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
          <MetricaComFormula
            label="Dependência de Antecipação"
            valor={antecipacoes.total > 0 ? formatPercentual(pctAntecipacao) : '—'}
            formula={antecipacoes.total > 0 ? formulaAntecipacao : 'Sem operações de antecipação no período'}
            cor={antecipacoes.total > 0 ? corAntecipacao as 'normal' | 'danger' | 'warning' | 'success' : 'normal'}
            nota={notaAntecipacao}
          />
          <MetricaComFormula
            label="Evolução do Caixa"
            valor={valorEvolucao}
            formula={formulaEvolucao}
            cor={corEvolucao}
          />
          <MetricaComFormula
            label="Capital de Giro (proxy)"
            valor={valorGap}
            formula={formulaGap}
            cor={corGap}
            nota={notaGap}
          />
        </div>
      </section>

      {/* ── Resumo Executivo ────────────────────────────────────────────── */}
      <section>
        <div className={styles.shead} style={{ marginBottom: 12 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Resumo Executivo</div>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ink2)', whiteSpace: 'pre-wrap' }}>
          {analise.resumoExecutivo}
        </p>
      </section>

      {alertasDanger.length > 0 && (
        <section>
          <div className={styles.shead} style={{ marginBottom: 12 }}>
            <div className={`${styles.stitle} ${styles.serif}`}>Alertas — Ação Imediata</div>
          </div>
          <div className="flex flex-col gap-2">
            {alertasDanger.map((alerta, i) => (
              <div key={i} className={styles.notice} style={{ borderLeftColor: 'var(--critico)' }}>
                <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--critico)' }} />
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{alerta.titulo}</p>
                  <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>{alerta.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {outrosAlertas.length > 0 && (
        <section>
          <div className={styles.shead} style={{ marginBottom: 12 }}>
            <div className={`${styles.stitle} ${styles.serif}`}>Alertas e Observações</div>
          </div>
          <div className="flex flex-col gap-2">
            {outrosAlertas.map((alerta, i) => {
              const cor = COR_NIVEL[alerta.nivel] ?? 'var(--info)'
              const Icon = ICONE_NIVEL[alerta.nivel] ?? Info
              return (
                <div key={i} className={styles.notice} style={{ borderLeftColor: cor }}>
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cor }} />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{alerta.titulo}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.55 }}>{alerta.descricao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className={styles.shead} style={{ marginBottom: 12 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Recomendações</div>
          <div className={styles.over}>por prioridade</div>
        </div>
        {recsOrdenadas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhuma recomendação registrada.</p>
        ) : (
          <div className="flex flex-col gap-0">
            {recsOrdenadas.map((rec, i) => (
              <div key={i} className={styles.prow}>
                <div className="flex items-start gap-4">
                  <span className={`${styles.num}`} style={{ fontSize: 11, color: 'var(--ink3)', minWidth: 20, paddingTop: 3 }}>
                    {String(rec.prioridade).padStart(2, '0')}
                  </span>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink2)' }}>{rec.acao}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--ink3)', paddingTop: 8 }}>
        <CheckCircle className="h-3 w-3" style={{ color: 'var(--positivo)' }} />
        Análise gerada por Claude (claude-haiku-4-5) com base nos dados do arquivo carregado.
        Os indicadores acima foram calculados deterministicamente antes da análise.
      </div>
    </div>
  )
}

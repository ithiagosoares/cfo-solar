'use client'

import { AlertTriangle, CheckCircle, ChevronRight, FileText, RefreshCw } from 'lucide-react'
import type { RelatorioIA } from '@/types/financeiro'

interface RelatorioViewProps {
  relatorio: RelatorioIA | null
  analisando: boolean
  onAnalisar?: () => void
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border overflow-hidden animate-fadeIn"
      style={{ background: '#1a1d27', borderColor: '#2d3148' }}
    >
      <div className="border-b px-5 py-3" style={{ borderColor: '#2d3148', background: '#161925' }}>
        <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
          {titulo}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function TextoAnalise({ texto }: { texto: string }) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#cbd5e1' }}>
      {texto}
    </p>
  )
}

function ListaItems({ items, cor }: { items: string[]; cor: string }) {
  if (!items.length) {
    return <p className="text-sm" style={{ color: '#64748b' }}>Nenhum item registrado.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#cbd5e1' }}>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color: cor }} />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function RelatorioView({ relatorio, analisando, onAnalisar }: RelatorioViewProps) {
  if (analisando) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 animate-fadeIn">
        <div className="relative">
          <div
            className="h-16 w-16 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#2d3148', borderTopColor: '#3b82f6' }}
          />
        </div>
        <div className="text-center">
          <p className="font-semibold text-lg" style={{ color: '#e2e8f0' }}>Analisando com IA…</p>
          <p className="mt-1 text-sm" style={{ color: '#64748b' }}>
            Claude está processando os dados financeiros. Isso pode levar até 30 segundos.
          </p>
        </div>
      </div>
    )
  }

  if (!relatorio) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 animate-fadeIn">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(59,130,246,0.1)' }}
        >
          <FileText className="h-8 w-8" style={{ color: '#3b82f6' }} />
        </div>
        <div className="text-center max-w-sm">
          <p className="font-semibold text-lg" style={{ color: '#e2e8f0' }}>Relatório IA não gerado</p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: '#64748b' }}>
            Clique em &quot;Analisar com IA&quot; no cabeçalho para gerar o relatório executivo completo com análise por Claude.
          </p>
        </div>
        {onAnalisar && (
          <button
            onClick={onAnalisar}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            <RefreshCw className="h-4 w-4" />
            Gerar Relatório IA
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* Resumo Executivo */}
      <Secao titulo="Resumo Executivo">
        <TextoAnalise texto={relatorio.resumoExecutivo} />
      </Secao>

      {/* Alertas Prioritários */}
      {relatorio.alertasPrioritarios.length > 0 && (
        <Secao titulo="Alertas Prioritários — Ação Imediata">
          <ul className="flex flex-col gap-2">
            {relatorio.alertasPrioritarios.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border-l-4 px-4 py-3"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  borderLeftColor: '#ef4444',
                  border: '1px solid rgba(127,29,29,0.4)',
                  borderLeftWidth: 4,
                }}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />
                <span className="text-sm leading-relaxed" style={{ color: '#fca5a5' }}>{item}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Análise de Fluxo */}
        <Secao titulo="Análise do Fluxo de Caixa">
          <TextoAnalise texto={relatorio.analiseFluxo} />
        </Secao>

        {/* Análise de Clientes */}
        <Secao titulo="Análise de Clientes">
          <TextoAnalise texto={relatorio.analiseClientes} />
        </Secao>

        {/* Análise FGI */}
        <Secao titulo="Análise FGI — R$ 46.000/mês">
          <TextoAnalise texto={relatorio.analiseFGI} />
        </Secao>

        {/* Perspectiva */}
        <Secao titulo="Perspectiva — Próximos 30 Dias">
          <TextoAnalise texto={relatorio.perspectiva} />
        </Secao>
      </div>

      {/* Recomendações */}
      <Secao titulo="Recomendações">
        <ListaItems items={relatorio.recomendacoes} cor="#3b82f6" />
      </Secao>

      {/* Rodapé */}
      <div className="flex items-center gap-2 text-xs py-2" style={{ color: '#4b5563' }}>
        <CheckCircle className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
        Análise gerada por Claude (claude-sonnet-4-6) com base nos dados do arquivo carregado.
      </div>
    </div>
  )
}

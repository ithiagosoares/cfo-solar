'use client'

import type { RelatorioCompleto } from '@/types/financeiro'
import { formatMoeda, formatPercentual } from '@/lib/utils'

const FGI_TOTAL = 46_000
const META = 2_000_000

export function gerarPDF(relatorio: RelatorioCompleto): void {
  const { periodo, faturamento, consolidado, empresas, clientes, analise } = relatorio

  const totalValorClientes = clientes.reduce((s, c) => s + c.valor, 0)
  const margemLiquida = consolidado.totalEntradas > 0
    ? ((consolidado.totalEntradas - consolidado.totalSaidas) / consolidado.totalEntradas) * 100
    : 0
  const comprometimentoFGI = faturamento.vendido > 0
    ? (FGI_TOTAL / faturamento.vendido) * 100
    : 0
  const progressoMeta = Math.min((faturamento.vendido / META) * 100, 100)

  const alertasHtml = analise.alertas
    .map(a => `<div class="alert alert-${a.nivel}"><div class="alert-title">${a.titulo}</div><div>${a.descricao}</div></div>`)
    .join('')

  const empresasHtml = empresas
    .map(e => {
      const m = e.entradas > 0 ? ((e.entradas - e.saidas) / e.entradas) * 100 : 0
      return `<tr>
        <td><strong>${e.nome}</strong></td>
        <td>${formatMoeda(e.entradas)}</td>
        <td>${formatMoeda(e.saidas)}</td>
        <td style="font-weight:700;color:${e.saldo >= 0 ? '#16a34a' : '#dc2626'}">${formatMoeda(e.saldo)}</td>
        <td style="color:${m >= 15 ? '#16a34a' : m >= 5 ? '#d97706' : '#dc2626'}">${formatPercentual(m)}</td>
      </tr>`
    })
    .join('')

  const clientesHtml = clientes
    .slice(0, 20)
    .map((c, i) => {
      const pct = totalValorClientes > 0 ? (c.valor / totalValorClientes) * 100 : 0
      return `<tr>
        <td>${i + 1}</td>
        <td>${c.nome}</td>
        <td>${formatMoeda(c.valor)}</td>
        <td>${formatPercentual(pct)}</td>
        <td>${c.empresa}</td>
      </tr>`
    })
    .join('')

  const recsHtml = [...analise.recomendacoes]
    .sort((a, b) => a.prioridade - b.prioridade)
    .map(r => `<div class="rec-item"><strong>${r.prioridade}.</strong> ${r.acao}</div>`)
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório CFO — Grupo Solar System — ${periodo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.55; }
  .page { max-width: 1000px; margin: 0 auto; padding: 32px; }
  .header { background: #0f1117; color: #e2e8f0; padding: 28px 32px; margin: -32px -32px 32px; }
  .header h1 { font-size: 22pt; font-weight: 700; }
  .header p  { color: #94a3b8; margin-top: 6px; font-size: 10pt; }
  .section   { margin-bottom: 28px; }
  .section-title { font-size: 13pt; font-weight: 700; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; margin-bottom: 14px; }
  .kpi-grid  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .kpi-card  { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .kpi-label { font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .kpi-value { font-size: 17pt; font-weight: 700; margin-top: 3px; }
  .positive  { color: #16a34a; }
  .negative  { color: #dc2626; }
  .neutral   { color: #1e293b; }
  table  { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th     { background: #f8fafc; color: #374151; font-weight: 600; text-align: left; padding: 7px 10px; border-bottom: 2px solid #e2e8f0; }
  td     { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #f8fafc; }
  .alert  { padding: 9px 13px; border-radius: 6px; margin-bottom: 7px; font-size: 10pt; }
  .alert-danger  { background: #fef2f2; border-left: 4px solid #dc2626; }
  .alert-warning { background: #fffbeb; border-left: 4px solid #d97706; }
  .alert-success { background: #f0fdf4; border-left: 4px solid #16a34a; }
  .alert-info    { background: #eff6ff; border-left: 4px solid #3b82f6; }
  .alert-title   { font-weight: 700; }
  .text-block    { background: #f8fafc; border-radius: 6px; padding: 14px; font-size: 10pt; line-height: 1.65; white-space: pre-wrap; }
  .rec-item { padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 10pt; }
  .fgi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
  .fgi-item { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
  .fgi-label { display: block; font-size: 8pt; color: #64748b; text-transform: uppercase; }
  .fgi-value { display: block; font-size: 14pt; font-weight: 700; color: #1e40af; margin-top: 4px; }
  .pb { page-break-before: always; padding-top: 16px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pb { page-break-before: always; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <h1>Relatório CFO — Grupo Solar System</h1>
    <p>Período: ${periodo} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
  </div>

  <div class="section">
    <div class="section-title">Resumo Executivo</div>
    <div class="text-block">${analise.resumoExecutivo}</div>
  </div>

  <div class="section">
    <div class="section-title">KPIs Principais</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Saldo do Grupo</div>
        <div class="kpi-value ${consolidado.saldoGrupo >= 0 ? 'positive' : 'negative'}">${formatMoeda(consolidado.saldoGrupo)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Faturamento Vendido</div>
        <div class="kpi-value neutral">${formatMoeda(faturamento.vendido)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Faturamento Faturado</div>
        <div class="kpi-value neutral">${formatMoeda(faturamento.faturado)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Entradas no Banco</div>
        <div class="kpi-value positive">${formatMoeda(consolidado.totalEntradas)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Saídas do Banco</div>
        <div class="kpi-value negative">${formatMoeda(consolidado.totalSaidas)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Margem Líquida</div>
        <div class="kpi-value ${margemLiquida >= 0 ? 'positive' : 'negative'}">${formatPercentual(margemLiquida)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">FGI Mensal (fixo)</div>
        <div class="kpi-value neutral">R$ 46.000</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Comprometimento FGI</div>
        <div class="kpi-value ${comprometimentoFGI <= 20 ? 'positive' : 'negative'}">${formatPercentual(comprometimentoFGI)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Progresso Meta R$2M</div>
        <div class="kpi-value ${progressoMeta >= 80 ? 'positive' : progressoMeta >= 50 ? 'neutral' : 'negative'}">${formatPercentual(progressoMeta)}</div>
      </div>
    </div>
    <div class="fgi-grid">
      <div class="fgi-item"><span class="fgi-label">Gimenes</span><span class="fgi-value">R$ 5.000</span></div>
      <div class="fgi-item"><span class="fgi-label">Barramares</span><span class="fgi-value">R$ 18.000</span></div>
      <div class="fgi-item"><span class="fgi-label">AluMkt/Hera</span><span class="fgi-value">R$ 23.000</span></div>
      <div class="fgi-item" style="background:#eff6ff"><span class="fgi-label">Total FGI</span><span class="fgi-value">R$ 46.000</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Performance por Empresa</div>
    <table>
      <thead><tr><th>Empresa</th><th>Entradas</th><th>Saídas</th><th>Saldo</th><th>Margem</th></tr></thead>
      <tbody>${empresasHtml}</tbody>
    </table>
  </div>

  <div class="section pb">
    <div class="section-title">Carteira de Clientes — Top 20</div>
    <table>
      <thead><tr><th>#</th><th>Cliente</th><th>Valor</th><th>Participação</th><th>Empresa</th></tr></thead>
      <tbody>${clientesHtml}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Alertas e Riscos</div>
    ${alertasHtml}
  </div>

  <div class="section">
    <div class="section-title">Recomendações</div>
    ${recsHtml}
  </div>

</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Bloqueio de pop-up detectado. Permita pop-ups para este site e tente novamente.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

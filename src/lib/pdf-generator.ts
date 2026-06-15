'use client'

import type { DadosConsolidados, RelatorioIA } from '@/types/financeiro'
import { formatMoeda, formatPercentual } from '@/lib/utils'

export function gerarPDF(dados: DadosConsolidados, relatorio: RelatorioIA): void {
  const { empresas, kpis, clientes, alertas } = dados

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório CFO — Grupo Solar System — ${dados.periodo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.55; }
  .page { max-width: 1000px; margin: 0 auto; padding: 32px; }
  .header { background: #0f1117; color: #e2e8f0; padding: 28px 32px; margin: -32px -32px 32px; }
  .header h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.02em; }
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
  .rec-item { padding: 5px 0; border-bottom: 1px solid #f1f5f9; font-size: 10pt; }
  .rec-item::before { content: "→ "; color: #3b82f6; font-weight: 700; }
  .pb { page-break-before: always; padding-top: 16px; }
  .fgi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
  .fgi-item { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
  .fgi-item span { display: block; }
  .fgi-label { font-size: 8pt; color: #64748b; text-transform: uppercase; }
  .fgi-value { font-size: 14pt; font-weight: 700; color: #1e40af; margin-top: 4px; }
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
    <p>Período: ${dados.periodo} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
  </div>

  <div class="section">
    <div class="section-title">Resumo Executivo</div>
    <div class="text-block">${relatorio.resumoExecutivo}</div>
  </div>

  <div class="section">
    <div class="section-title">KPIs Principais</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Saldo Consolidado</div>
        <div class="kpi-value ${kpis.saldoConsolidado >= 0 ? 'positive' : 'negative'}">${formatMoeda(kpis.saldoConsolidado)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Faturamento Total</div>
        <div class="kpi-value neutral">${formatMoeda(kpis.faturamentoTotal)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Margem Bruta</div>
        <div class="kpi-value ${kpis.margemBruta >= 15 ? 'positive' : 'negative'}">${formatPercentual(kpis.margemBruta)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">FGI Mensal (fixo)</div>
        <div class="kpi-value neutral">R$ 46.000</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Comprometimento FGI</div>
        <div class="kpi-value ${kpis.comprometimentoFGI <= 20 ? 'positive' : 'negative'}">${formatPercentual(kpis.comprometimentoFGI)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Progresso Meta R$2M</div>
        <div class="kpi-value ${kpis.progressoMeta >= 80 ? 'positive' : kpis.progressoMeta >= 50 ? 'neutral' : 'negative'}">${formatPercentual(kpis.progressoMeta)}</div>
      </div>
    </div>

    <div class="fgi-grid" style="margin-top:16px">
      <div class="fgi-item"><span class="fgi-label">Gimenes</span><span class="fgi-value">R$ 5.000</span></div>
      <div class="fgi-item"><span class="fgi-label">Barramares</span><span class="fgi-value">R$ 18.000</span></div>
      <div class="fgi-item"><span class="fgi-label">AluMkt/Hera</span><span class="fgi-value">R$ 23.000</span></div>
      <div class="fgi-item" style="background:#eff6ff"><span class="fgi-label">Total FGI</span><span class="fgi-value" style="color:#1e40af">R$ 46.000</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Performance por Empresa</div>
    <table>
      <thead><tr><th>Empresa</th><th>Código</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr></thead>
      <tbody>
        ${empresas
          .map(
            e => `<tr>
          <td><strong>${e.nome}</strong></td>
          <td>${e.codigo}</td>
          <td>${formatMoeda(e.receitas)}</td>
          <td>${formatMoeda(e.despesas)}</td>
          <td style="font-weight:700;color:${e.saldo >= 0 ? '#16a34a' : '#dc2626'}">${formatMoeda(e.saldo)}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="section pb">
    <div class="section-title">Carteira de Clientes — Top 15</div>
    <table>
      <thead><tr><th>#</th><th>Cliente</th><th>Valor</th><th>Participação</th><th>Empresa</th></tr></thead>
      <tbody>
        ${clientes
          .slice(0, 15)
          .map(
            (c, i) => `<tr>
          <td>${i + 1}</td>
          <td>${c.nome}</td>
          <td>${formatMoeda(c.valor)}</td>
          <td>${formatPercentual(c.percentual)}</td>
          <td>${c.empresa}</td>
        </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Alertas e Riscos</div>
    ${alertas.map(a => `<div class="alert alert-${a.tipo}"><div class="alert-title">${a.titulo}</div><div>${a.mensagem}</div></div>`).join('')}
  </div>

  <div class="section">
    <div class="section-title">Análise do Fluxo de Caixa</div>
    <div class="text-block">${relatorio.analiseFluxo}</div>
  </div>

  <div class="section">
    <div class="section-title">Análise FGI</div>
    <div class="text-block">${relatorio.analiseFGI}</div>
  </div>

  <div class="section">
    <div class="section-title">Análise de Clientes</div>
    <div class="text-block">${relatorio.analiseClientes}</div>
  </div>

  <div class="section pb">
    <div class="section-title">Alertas Prioritários</div>
    ${relatorio.alertasPrioritarios.map(a => `<div class="alert alert-danger"><div>${a}</div></div>`).join('')}
  </div>

  <div class="section">
    <div class="section-title">Recomendações</div>
    ${relatorio.recomendacoes.map(r => `<div class="rec-item">${r}</div>`).join('')}
  </div>

  <div class="section">
    <div class="section-title">Perspectiva — Próximos 30 Dias</div>
    <div class="text-block">${relatorio.perspectiva}</div>
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

'use client'

import { FileText } from 'lucide-react'
import { formatMoeda } from '@/lib/utils'
import type { PedidoResumo } from '@/lib/comercial-pedidos-repository'

interface DetalhePedido {
  pdfUrl: string | null
}

interface AbaDocumentosProps {
  pedidos: PedidoResumo[]
  detalhes: Record<string, DetalhePedido>
}

function fmtData(d: string | null): string {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

export function AbaDocumentos({ pedidos, detalhes }: AbaDocumentosProps) {
  const comPdf = pedidos.filter(p => detalhes[p.id]?.pdfUrl)

  if (comPdf.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum PDF de orçamento anexado ainda.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {comPdf.map(p => (
        <a
          key={p.id}
          href={detalhes[p.id].pdfUrl!}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
            borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'inherit',
          }}
        >
          <FileText style={{ width: 16, height: 16, color: 'var(--ink3)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 }}>Orçamento{p.numeroPedido ? ` nº ${p.numeroPedido}` : ''}</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{fmtData(p.dataOrcamento)} · {formatMoeda(p.valorOrcado)}</div>
          </div>
        </a>
      ))}
    </div>
  )
}

export default AbaDocumentos

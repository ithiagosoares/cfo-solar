'use client'

import { useRef, useState } from 'react'
import type { LancamentoClassificadoV2 } from '@/lib/classificador-ia-v2'
import type { TotaisCalculados } from '@/lib/calcular-totais'
import { formatMoeda } from '@/lib/utils'

// Internal debug tool — validates classificador-ia.ts output before it's wired into
// /api/analisar. Not linked from the main nav; reachable directly at /teste-classificador.
// Does not persist anything to Supabase, just displays whatever /api/teste-classificador returns.

interface RespostaTeste {
  totalLancamentos: number
  totais: TotaisCalculados
  lancamentos: LancamentoClassificadoV2[]
}

const COR_DESTAQUE = 'rgba(245,158,11,0.12)'

export default function TesteClassificadorPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<RespostaTeste | null>(null)
  const [busca, setBusca] = useState('')

  async function classificar() {
    if (!arquivo) return
    setCarregando(true)
    setErro(null)
    try {
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      const res = await fetch('/api/teste-classificador', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao classificar')
      setResultado(json as RespostaTeste)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao classificar')
    } finally {
      setCarregando(false)
    }
  }

  const lancamentos = resultado?.lancamentos ?? []
  const buscaLower = busca.trim().toLowerCase()
  const lancamentosFiltrados = buscaLower
    ? lancamentos.filter(l => l.descricao.toLowerCase().includes(buscaLower))
    : lancamentos

  const resumo = {
    total: lancamentos.length,
    alta: lancamentos.filter(l => l.confianca === 'alta').length,
    media: lancamentos.filter(l => l.confianca === 'media').length,
    baixa: lancamentos.filter(l => l.confianca === 'baixa').length,
    revisar: lancamentos.filter(l => l.categoria === 'revisar_manualmente').length,
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#0f1117', color: '#e2e8f0' }}>
      <div className="mx-auto max-w-6xl flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold">Teste do Classificador IA (debug interno)</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Ferramenta de validação — não salva nada, só mostra o resultado de /api/teste-classificador.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setArquivo(f) }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border px-3 py-2 text-xs font-medium"
            style={{ borderColor: '#2d3148', color: '#94a3b8', background: '#161925' }}
          >
            Escolher arquivo
          </button>
          <span className="text-sm" style={{ color: arquivo ? '#e2e8f0' : '#4b5563' }}>
            {arquivo ? arquivo.name : 'Nenhum arquivo selecionado'}
          </span>
          <button
            onClick={classificar}
            disabled={!arquivo || carregando}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40"
            style={{ background: '#3b82f6', color: '#fff' }}
          >
            {carregando ? 'Classificando…' : 'Classificar'}
          </button>
        </div>

        {erro && (
          <div className="rounded-lg border-l-4 px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', borderLeftColor: '#ef4444', borderLeftWidth: 4 }}>
            <span style={{ color: '#fca5a5' }}>{erro}</span>
          </div>
        )}

        {resultado && (
          <>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Total', valor: resumo.total, cor: '#e2e8f0' },
                { label: 'Confiança Alta', valor: resumo.alta, cor: '#22c55e' },
                { label: 'Confiança Média', valor: resumo.media, cor: '#3b82f6' },
                { label: 'Confiança Baixa', valor: resumo.baixa, cor: '#f59e0b' },
                { label: 'Revisar Manualmente', valor: resumo.revisar, cor: '#ef4444' },
              ].map(item => (
                <div key={item.label} className="rounded-lg border p-3" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
                  <p className="text-xs" style={{ color: '#64748b' }}>{item.label}</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: item.cor }}>{item.valor}</p>
                </div>
              ))}
            </div>

            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Filtrar por descrição (ex: RD STATION)…"
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#2d3148', color: '#e2e8f0', background: '#161925' }}
            />

            <div className="rounded-xl border overflow-x-auto" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #2d3148' }}>
                    {['Data', 'Descrição', 'Valor', 'Empresa', 'Categoria', 'Subcategoria', 'Confiança'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancamentosFiltrados.map((l, i) => {
                    const destacar = l.confianca === 'baixa' || l.categoria === 'revisar_manualmente'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1e2130', background: destacar ? COR_DESTAQUE : undefined }}>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#94a3b8' }}>{l.data}</td>
                        <td className="px-3 py-1.5" style={{ color: '#e2e8f0' }}>{l.descricao}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap tabular-nums" style={{ color: l.tipo === 'entrada' ? '#22c55e' : '#ef4444' }}>
                          {formatMoeda(l.valor)}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#94a3b8' }}>{l.empresa}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap font-medium" style={{ color: '#e2e8f0' }}>{l.categoria}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#64748b' }}>{l.subcategoria ?? '—'}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: l.confianca === 'alta' ? '#22c55e' : l.confianca === 'media' ? '#3b82f6' : '#f59e0b' }}>
                          {l.confianca}
                        </td>
                      </tr>
                    )
                  })}
                  {lancamentosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm" style={{ color: '#64748b' }}>
                        Nenhum lançamento encontrado para &quot;{busca}&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs" style={{ color: '#4b5563' }}>
              {lancamentosFiltrados.length} de {lancamentos.length} lançamentos exibidos.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-4" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Total por Categoria</h2>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {resultado.totais.porCategoria.map(c => (
                    <li key={c.categoria} className="flex justify-between">
                      <span style={{ color: '#94a3b8' }}>{c.categoria} <span style={{ color: '#4b5563' }}>({c.quantidade})</span></span>
                      <span className="tabular-nums font-medium" style={{ color: '#e2e8f0' }}>{formatMoeda(c.valor)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border p-4" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Total por Empresa</h2>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {resultado.totais.porEmpresa.map(e => (
                    <li key={e.empresa} className="flex justify-between">
                      <span style={{ color: '#94a3b8' }}>{e.empresa}</span>
                      <span className="tabular-nums font-medium" style={{ color: e.saldo >= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatMoeda(e.saldo)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm" style={{ borderColor: '#2d3148' }}>
                  <span style={{ color: '#64748b' }}>Total Geral</span>
                  <span className="tabular-nums font-bold" style={{ color: resultado.totais.totalGeral.saldo >= 0 ? '#22c55e' : '#ef4444' }}>
                    {formatMoeda(resultado.totais.totalGeral.saldo)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useCallback } from 'react'
import styles from '@/styles/editorial.module.css'
import { formatMoeda } from '@/lib/utils'

// ─── Tipos (espelho do backend, sem importar código server-only) ──────────────

interface RegistroPreview {
  vendedorId: string | null
  vendedorNome: string
  vendedorReconhecido: boolean
  empresa: string
  filial: string
  cliente: string
  valorOrcado: number
  dataOrcamento: string
  status: 'orcado' | 'vendido'
  valorVendido: number | null
  dataVenda: string | null
  origem: 'upload_estruturado'
  numeroOrcamento: string
}

interface Divergencia {
  vendedor: string
  valorPedidosFechados: number
  valorRelatorioVendas: number
  diferenca: number
  fonte: 'totais_vendedor' | 'rentabilidade_vendedor'
}

interface PreviewResult {
  importacaoId: string
  avisos: string[]
  registros: RegistroPreview[]
  divergencias: Divergencia[]
  vendedoresNaoReconhecidos: string[]
  resumo: {
    totalRegistros: number
    totalAberto: number
    totalFechado: number
    totalValorOrcado: number
  }
}

interface OpcaoVendedor {
  id: string
  nome: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const EMPRESAS = [
  'Solar System Matriz',
  'Solar System Filial PR',
  'Level2',
  'Ni Hao',
  'AluMarket',
]

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ComercialUploadPage() {
  // ── Upload phase ────────────────────────────────────────────────────────────
  const [arquivos, setArquivos] = useState<File[]>([])
  const [empresa, setEmpresa] = useState('')
  const [filial, setFilial] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erroUpload, setErroUpload] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Preview phase ───────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [vendedoresOpt, setVendedoresOpt] = useState<OpcaoVendedor[]>([])
  // resolucoes: nome_original -> vendedor_id resolvido (string vazia = pendente)
  const [resolucoes, setResolucoes] = useState<Record<string, string>>({})
  const [criando, setCriando] = useState<Record<string, boolean>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null)
  const [concluido, setConcluido] = useState<{ total: number } | null>(null)

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const adicionarArquivos = useCallback((lista: FileList | null) => {
    if (!lista) return
    const htmlFiles = Array.from(lista).filter(
      f => f.name.endsWith('.html') || f.name.endsWith('.htm'),
    )
    setArquivos(prev => {
      const existentes = new Set(prev.map(f => f.name))
      return [...prev, ...htmlFiles.filter(f => !existentes.has(f.name))]
    })
  }, [])

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    adicionarArquivos(e.dataTransfer.files)
  }

  // ── Processar upload ─────────────────────────────────────────────────────────

  async function processarArquivos() {
    if (!arquivos.length || !empresa || !filial) return
    setProcessando(true)
    setErroUpload(null)
    try {
      const fd = new FormData()
      fd.append('empresa', empresa)
      fd.append('filial', filial)
      arquivos.forEach(f => fd.append('arquivos', f))

      const res  = await fetch('/api/comercial/upload-relatorio/preview', { method: 'POST', body: fd })
      const json = await res.json() as PreviewResult & { ok: boolean; error?: string }

      if (!json.ok) throw new Error(json.error ?? 'Erro ao processar arquivos')

      setPreview(json)

      // Inicializar resolucoes: vazio para cada vendedor não reconhecido
      setResolucoes(Object.fromEntries(json.vendedoresNaoReconhecidos.map(n => [n, ''])))

      // Buscar vendedores cadastrados para o select de mapeamento
      const vRes  = await fetch('/api/comercial/vendedores')
      const vJson = await vRes.json() as { ok: boolean; vendedores?: { id: string; nome: string }[] }
      if (vJson.ok && vJson.vendedores) {
        setVendedoresOpt(vJson.vendedores.map(v => ({ id: v.id, nome: v.nome })))
      }
    } catch (e) {
      setErroUpload(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setProcessando(false)
    }
  }

  // ── Cadastrar vendedor na hora ─────────────────────────────────────────────

  async function criarVendedor(nomeOriginal: string) {
    setCriando(p => ({ ...p, [nomeOriginal]: true }))
    try {
      const res  = await fetch('/api/comercial/vendedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeOriginal }),
      })
      const json = await res.json() as { ok: boolean; vendedor?: { id: string; nome: string }; error?: string }
      if (!json.ok || !json.vendedor) throw new Error(json.error ?? 'Erro ao criar')

      setVendedoresOpt(prev =>
        [...prev, { id: json.vendedor!.id, nome: json.vendedor!.nome }]
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      )
      setResolucoes(p => ({ ...p, [nomeOriginal]: json.vendedor!.id }))
    } catch {
      // falha silenciosa — o usuário pode tentar novamente
    } finally {
      setCriando(p => ({ ...p, [nomeOriginal]: false }))
    }
  }

  // ── Confirmar importação ──────────────────────────────────────────────────

  const todosResolvidos = !preview ||
    preview.vendedoresNaoReconhecidos.every(n => !!resolucoes[n])

  async function confirmar() {
    if (!preview || !todosResolvidos) return
    setConfirmando(true)
    setErroConfirmar(null)
    try {
      const res  = await fetch('/api/comercial/upload-relatorio/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importacaoId: preview.importacaoId,
          mapeamentoVendedores: resolucoes,
        }),
      })
      const json = await res.json() as { ok: boolean; totalInserido?: number; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'Erro ao confirmar')
      setConcluido({ total: json.totalInserido ?? preview.registros.length })
    } catch (e) {
      setErroConfirmar(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setConfirmando(false)
    }
  }

  // ── Descartar importação ──────────────────────────────────────────────────

  async function descartar() {
    if (!preview) return
    setDescartando(true)
    try {
      await fetch(
        `/api/comercial/upload-relatorio/confirmar?importacaoId=${preview.importacaoId}`,
        { method: 'DELETE' },
      )
    } finally {
      setDescartando(false)
      setPreview(null)
      setArquivos([])
      setResolucoes({})
      setErroUpload(null)
    }
  }

  // ─── Estado: concluído ───────────────────────────────────────────────────────

  if (concluido) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap} style={{ maxWidth: 560, paddingTop: 80, paddingBottom: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 20, color: 'var(--marca)' }}>✓</div>
          <div className={`${styles.stitle} ${styles.serif}`} style={{ marginBottom: 8 }}>
            Importação confirmada
          </div>
          <div className={styles.scap} style={{ marginBottom: 32 }}>
            {concluido.total} registro{concluido.total !== 1 ? 's foram inseridos' : ' foi inserido'} em comercial_pedidos.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              className={styles.btnPrimary}
              onClick={() => {
                setPreview(null); setArquivos([]); setResolucoes({})
                setConcluido(null)
              }}
            >
              Nova importação
            </button>
            <button
              onClick={() => window.history.back()}
              style={btnGhostStyle}
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Estado: revisão (preview carregado) ──────────────────────────────────────

  if (preview) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 80 }}>
          {/* Navegação */}
          <button onClick={descartar} disabled={descartando} style={btnGhostStyle}>
            ← Voltar ao upload
          </button>

          <div className={`${styles.stitle} ${styles.serif}`} style={{ marginTop: 24, marginBottom: 6 }}>
            Revisão da Importação
          </div>
          <div className={styles.scap} style={{ marginBottom: 32 }}>
            Nenhum registro foi inserido ainda. Confira os dados abaixo e confirme quando estiver pronto.
          </div>

          {/* Avisos de arquivos não reconhecidos */}
          {preview.avisos.map((a, i) => (
            <div key={i} className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginBottom: 8 }}>
              <span>{a}</span>
            </div>
          ))}

          {/* ── Resumo ──────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
            <StatCard label="Total" value={String(preview.resumo.totalRegistros)} />
            <StatCard label="Em aberto"  value={String(preview.resumo.totalAberto)} />
            <StatCard label="Fechados"   value={String(preview.resumo.totalFechado)} />
            <StatCard label="Valor total" value={formatMoeda(preview.resumo.totalValorOrcado)} />
          </div>

          {/* ── Vendedores não reconhecidos ──────────────────────────────────── */}
          {preview.vendedoresNaoReconhecidos.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <SectionLabel texto={`${preview.vendedoresNaoReconhecidos.length} vendedor(es) não cadastrado(s)`} />
              <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 0, marginBottom: 20 }}>
                Mapeie cada nome para um vendedor existente ou cadastre-o como novo. Obrigatório antes de confirmar.
              </p>

              {preview.vendedoresNaoReconhecidos.map(nome => {
                const resolvido = !!resolucoes[nome]
                return (
                  <div
                    key={nome}
                    style={{
                      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                      padding: '12px 0', borderBottom: '1px solid var(--line)',
                    }}
                  >
                    {/* Indicador */}
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: resolvido ? 'var(--marca)' : '#c8a000',
                    }} />

                    {/* Nome original */}
                    <span style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 500 }}>
                      {nome}
                    </span>

                    {/* Select para mapear */}
                    <select
                      className={styles.select}
                      style={{ flex: '1 1 220px', maxWidth: 280 }}
                      value={resolucoes[nome] ?? ''}
                      onChange={e => setResolucoes(p => ({ ...p, [nome]: e.target.value }))}
                      disabled={criando[nome]}
                    >
                      <option value="">— Mapear para vendedor existente —</option>
                      {vendedoresOpt.map(v => (
                        <option key={v.id} value={v.id}>{v.nome}</option>
                      ))}
                    </select>

                    {/* Botão criar */}
                    <button
                      onClick={() => criarVendedor(nome)}
                      disabled={criando[nome] || resolvido}
                      style={{
                        ...btnGhostStyle,
                        padding: '5px 14px', fontSize: 12, flexShrink: 0,
                        opacity: resolvido ? 0.4 : 1,
                      }}
                    >
                      {criando[nome] ? 'Criando…' : 'Cadastrar como novo'}
                    </button>

                    {resolvido && (
                      <span style={{ fontSize: 12, color: 'var(--marca)', flexShrink: 0 }}>
                        ✓ Resolvido
                      </span>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {/* ── Divergências (informativo, não bloqueia) ──────────────────────── */}
          {preview.divergencias.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <SectionLabel texto={`${preview.divergencias.length} divergência(s) encontrada(s)`} />
              <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 0, marginBottom: 12 }}>
                Diferenças entre a soma dos pedidos fechados e os relatórios de vendas. Apenas informativo — não bloqueia a confirmação.
              </p>
              {preview.divergencias.map((d, i) => (
                <div key={i} className={styles.notice} style={{ marginBottom: 8, flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{d.vendedor}</span>
                  <span style={{ fontSize: 12 }}>
                    Pedidos fechados: <strong>{formatMoeda(d.valorPedidosFechados)}</strong>
                    {' · '}
                    {d.fonte === 'totais_vendedor' ? 'Relatório totais' : 'Relatório rentabilidade'}: <strong>{formatMoeda(d.valorRelatorioVendas)}</strong>
                    {' · '}
                    Diferença: <strong>{formatMoeda(d.diferenca)}</strong>
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* ── Tabela de registros ───────────────────────────────────────────── */}
          <section style={{ marginBottom: 40 }}>
            <SectionLabel texto={`${preview.registros.length} registros para importar`} />

            <div style={tbHead}>
              <span>Nº Orçamento</span>
              <span>Cliente</span>
              <span>Vendedor</span>
              <span style={{ textAlign: 'right' }}>Valor</span>
              <span>Situação</span>
            </div>

            {preview.registros.map((r, i) => (
              <div key={i} style={tbRow}>
                <span style={{ fontSize: 12, color: 'var(--ink3)', fontVariantNumeric: 'tabular-nums' }}>
                  {r.numeroOrcamento || '—'}
                </span>
                <span style={{ fontSize: 13 }}>{r.cliente}</span>
                <span style={{ fontSize: 13, color: r.vendedorReconhecido ? 'var(--ink2)' : 'var(--pendente)' }}>
                  {r.vendedorNome}
                  {!r.vendedorReconhecido && (
                    <span style={{ fontSize: 11, marginLeft: 4 }}>(pendente)</span>
                  )}
                </span>
                <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoeda(r.valorOrcado)}
                </span>
                <span>
                  <StatusBadge status={r.status} />
                </span>
              </div>
            ))}
          </section>

          {/* ── Ações ────────────────────────────────────────────────────────── */}
          {erroConfirmar && (
            <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginBottom: 16 }}>
              <span>{erroConfirmar}</span>
            </div>
          )}

          <div
            style={{
              display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
              paddingTop: 24, borderTop: '1px solid var(--line)',
            }}
          >
            <button
              className={styles.btnPrimary}
              onClick={confirmar}
              disabled={!todosResolvidos || confirmando || descartando}
            >
              {confirmando ? 'Confirmando…' : 'Confirmar Importação'}
            </button>

            <button
              onClick={descartar}
              disabled={descartando || confirmando}
              style={{ ...btnGhostStyle, color: 'var(--ink3)' }}
            >
              {descartando ? 'Descartando…' : 'Descartar e cancelar'}
            </button>

            {!todosResolvidos && (
              <span style={{ fontSize: 12, color: 'var(--ink3)' }}>
                Resolva todos os vendedores não cadastrados para habilitar a confirmação.
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Estado: upload ───────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.wrap} style={{ maxWidth: 680, paddingTop: 40, paddingBottom: 60 }}>
        <button onClick={() => window.history.back()} style={btnGhostStyle}>
          ← Voltar
        </button>

        <div className={`${styles.stitle} ${styles.serif}`} style={{ marginTop: 24, marginBottom: 6 }}>
          Upload de Relatório Comercial
        </div>
        <div className={styles.scap} style={{ marginBottom: 32 }}>
          Importe relatórios em formato <strong>HTML</strong> exportados do SSG para revisão antes de inserir no banco.
          Selecione ao menos o relatório de Pedidos de Orçamento. Os demais são opcionais.
        </div>

        {/* ── Drop zone ───────────────────────────────────────────────────── */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--foreground)' : 'var(--line2)'}`,
            background: isDragging ? 'var(--paper)' : 'transparent',
            padding: '44px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 24,
            transition: 'border-color .15s, background .15s',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 10 }}>
            Arraste arquivos <strong>.html</strong> aqui ou clique para selecionar
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.7 }}>
            Relatórios aceitos (formato HTML):<br />
            Rentabilidade · Rentabilidade por Vendedor · Total de Venda, Margem de Contribuição e Lucro por Vendedor<br />
            Lista de Orçamentos · Relatório de Pedidos de Orçamento
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".html,.htm"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
            onChange={e => adicionarArquivos(e.target.files)}
          />
        </div>

        {/* ── Lista de arquivos selecionados ──────────────────────────────── */}
        {arquivos.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {arquivos.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13,
                }}
              >
                <span style={{ flex: 1 }}>{f.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink3)', flexShrink: 0 }}>
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setArquivos(p => p.filter((_, j) => j !== i)) }}
                  style={{ fontSize: 11, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Empresa + Filial ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
          <div className={styles.field} style={{ flex: 1, marginBottom: 0 }}>
            <label className={styles.fieldLabel}>Empresa</label>
            <select
              className={styles.select}
              value={empresa}
              onChange={e => setEmpresa(e.target.value)}
            >
              <option value="">Selecione a empresa</option>
              {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className={styles.field} style={{ flex: '0 0 200px', marginBottom: 0 }}>
            <label className={styles.fieldLabel}>Unidade</label>
            <select
              className={styles.select}
              value={filial}
              onChange={e => setFilial(e.target.value)}
            >
              <option value="">Selecione</option>
              <option value="São Paulo">São Paulo</option>
              <option value="Paraná">Paraná</option>
            </select>
          </div>
        </div>

        {erroUpload && (
          <div className={`${styles.notice} ${styles.alertaDanger}`} style={{ marginBottom: 20 }}>
            <span>{erroUpload}</span>
          </div>
        )}

        <button
          className={styles.btnPrimary}
          onClick={processarArquivos}
          disabled={!arquivos.length || !empresa || !filial || processando}
        >
          {processando ? 'Processando…' : 'Processar e revisar'}
        </button>
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: '1 1 120px', padding: '18px 20px',
      background: 'var(--paper)', border: '1px solid var(--line)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink3)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function SectionLabel({ texto }: { texto: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
      color: 'var(--ink3)', textTransform: 'uppercase', marginBottom: 12,
    }}>
      {texto}
    </div>
  )
}

function StatusBadge({ status }: { status: 'orcado' | 'vendido' }) {
  const fechado = status === 'vendido'
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: 700, padding: '2px 8px',
      background: fechado ? 'var(--marca)' : 'var(--paper)',
      color: fechado ? 'var(--background)' : 'var(--ink3)',
      border: fechado ? 'none' : '1px solid var(--line2)',
    }}>
      {fechado ? 'Fechado' : 'Aberto'}
    </span>
  )
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────

const btnGhostStyle: React.CSSProperties = {
  fontSize: 13, background: 'none', border: '1px solid var(--line2)',
  color: 'var(--ink2)', cursor: 'pointer', fontFamily: 'inherit',
  padding: '6px 14px',
}

const tbHead: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 1fr 160px 110px 80px',
  gap: 12, padding: '8px 0',
  borderBottom: '2px solid var(--line2)',
  fontSize: 11, fontWeight: 700, color: 'var(--ink3)', letterSpacing: '.04em',
}

const tbRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 1fr 160px 110px 80px',
  gap: 12, padding: '9px 0',
  borderBottom: '1px solid var(--line)',
  alignItems: 'center',
}

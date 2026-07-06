'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  buscarDadosComerciais,
  calcularCurvaABCD,
  type DadosComerciais,
  type ClienteCurvaABCD,
} from '@/lib/dados-comerciais'
import {
  PESSOAS_MOCK,
  type PedidoUpper,
} from '@/lib/upper-mock-data'
import { formatMoeda, formatData, formatPercentual } from '@/lib/utils'
import { CORES } from '@/lib/tema'
import { NavTabs, type ItemNavTab } from '@/components/layout/NavTabs'
import { UserMenu, type UsuarioInfo } from '@/components/layout/UserMenu'
import styles from '@/styles/editorial.module.css'

const LIMITE_ESTOQUE_CRITICO = 10
const LIMITE_ESTOQUE_ATENCAO = 30

const ABAS_NAV: ItemNavTab<string>[] = [
  { id: 'dashboard',   label: 'Dashboard',        href: '/' },
  { id: 'empresas',    label: 'Empresas',          href: '/?tab=empresas' },
  { id: 'despesas',    label: 'Despesas',          href: '/?tab=despesas' },
  { id: 'clientes',    label: 'Clientes',          href: '/?tab=clientes' },
  { id: 'comercial',   label: 'Comercial' },
  { id: 'relatorio',   label: 'Relatório IA',      href: '/?tab=relatorio' },
  { id: 'comparativo', label: 'Comparativo',       href: '/?tab=comparativo' },
  { id: 'chat',        label: 'Chat',              href: '/?tab=chat' },
  { id: 'upload',      label: 'Adicionar Arquivo', href: '/?tab=upload' },
]

const LABEL_SITUACAO: Record<string, string> = {
  PENDENTE:    'pendente',
  FATURADO:    'faturado',
  EM_PRODUCAO: 'em produção',
}

const DOT_SITUACAO: Record<string, string> = {
  PENDENTE:    styles.dPend,
  FATURADO:    styles.dGreen,
  EM_PRODUCAO: styles.dBlue,
}

const COR_CURVA: Record<ClienteCurvaABCD['curva'], string> = {
  A: CORES.positivo,
  B: CORES.info,
  C: CORES.pendente,
  D: CORES.ink3,
}

// ─── Filtro de período ────────────────────────────────────────────────────────

type TipoPeriodo = 'hoje' | '7dias' | '30dias' | 'personalizado'

const LABELS_PERIODO: Record<TipoPeriodo, string> = {
  hoje:          'Hoje',
  '7dias':       '7 Dias',
  '30dias':      '30 Dias',
  personalizado: 'Personalizado',
}

interface FiltroPeriodo {
  tipo: TipoPeriodo
  dataInicio: Date
  dataFim: Date
}

function construirFiltro(tipo: TipoPeriodo, customInicio: string, customFim: string): FiltroPeriodo {
  const fim = new Date()
  fim.setHours(23, 59, 59, 999)
  switch (tipo) {
    case 'hoje': {
      const inicio = new Date(fim)
      inicio.setHours(0, 0, 0, 0)
      return { tipo, dataInicio: inicio, dataFim: fim }
    }
    case '7dias': {
      const inicio = new Date(fim)
      inicio.setDate(fim.getDate() - 7)
      inicio.setHours(0, 0, 0, 0)
      return { tipo, dataInicio: inicio, dataFim: fim }
    }
    case 'personalizado': {
      const inicio = customInicio
        ? new Date(customInicio + 'T00:00:00')
        : new Date(fim.getFullYear(), fim.getMonth(), 1)
      const fimCustom = customFim ? new Date(customFim + 'T23:59:59') : fim
      return { tipo, dataInicio: inicio, dataFim: fimCustom }
    }
    default: { // '30dias'
      const inicio = new Date(fim)
      inicio.setDate(fim.getDate() - 30)
      inicio.setHours(0, 0, 0, 0)
      return { tipo: '30dias', dataInicio: inicio, dataFim: fim }
    }
  }
}

function filtrarPorPeriodo(pedidos: PedidoUpper[], filtro: FiltroPeriodo): PedidoUpper[] {
  const inicio = filtro.dataInicio.getTime()
  const fim = filtro.dataFim.getTime()
  const filtrados = pedidos.filter(p => {
    const t = new Date(p.dataCadastro).getTime()
    return t >= inicio && t <= fim
  })
  const dias = filtro.tipo === 'hoje' ? 1 : filtro.tipo === '7dias' ? 7 : filtro.tipo === '30dias' ? 30 : null
  console.log('[comercial] pedidos da Upper:', pedidos.length, '| após filtro de', dias ?? 'personalizado', 'dias:', filtrados.length)
  return filtrados
}

function descricaoPeriodo(filtro: FiltroPeriodo): string {
  switch (filtro.tipo) {
    case 'hoje': return 'de hoje'
    case '7dias': return 'dos últimos 7 dias'
    case 'personalizado': {
      const de = filtro.dataInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const ate = filtro.dataFim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      return `de ${de} a ${ate}`
    }
    default: return 'dos últimos 30 dias'
  }
}

// ─── Inline SVGs ──────────────────────────────────────────────────────────────

function IconeInfo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="12.5" />
      <circle cx="12" cy="16" r=".4" />
    </svg>
  )
}

function IconeChevron({ aberto }: { aberto: boolean }) {
  return (
    <svg className={`${styles.chev} ${aberto ? styles.chevOpen : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

// ─── Linha de pedido expansível ───────────────────────────────────────────────

function LinhaPedido({ pedido, expandido, onToggle }: { pedido: PedidoUpper; expandido: boolean; onToggle: () => void }) {
  return (
    <div>
      <button onClick={onToggle} className={styles.orow}>
        <div className={styles.cli}>
          <IconeChevron aberto={expandido} />
          {pedido.nomeCliente}
        </div>
        <div className={`${styles.cdt} ${styles.num}`}>{formatData(pedido.dataCadastro)}</div>
        <div className={`${styles.cdt} ${styles.num}`}>{formatData(pedido.dataPrevisaoEntrega)}</div>
        <div>
          <span className={styles.stat}>
            <span className={`${styles.dot} ${DOT_SITUACAO[pedido.situacaoFaturamento] ?? styles.dBlue}`} />
            {LABEL_SITUACAO[pedido.situacaoFaturamento] ?? pedido.situacaoFaturamento}
          </span>
        </div>
        <div className={`${styles.qty} ${styles.num}`}>{pedido.itens.length}</div>
      </button>
      {expandido && pedido.itens.length > 0 && (
        <div className={styles.exp}>
          <div className={styles.ehead}>
            <div>Produto</div>
            <div>Referência</div>
            <div className={styles.right}>Qtd</div>
            <div>Unidade</div>
          </div>
          {pedido.itens.map(item => (
            <div key={item.id} className={styles.erow}>
              <div className={styles.eprod}>{item.nomeCompletoProduto}</div>
              <div className={styles.eref}>{item.referenciaProduto}</div>
              <div className={`${styles.etxt} ${styles.num} ${styles.right}`}>{item.quantidade}</div>
              <div className={styles.etxt}>{item.uniMedProduto}</div>
            </div>
          ))}
        </div>
      )}
      {expandido && pedido.itens.length === 0 && (
        <div className={styles.exp}>
          <p style={{ fontSize: 12, color: 'var(--ink3)', padding: '8px 0' }}>
            Detalhes dos itens disponíveis apenas via endpoint individual (/pedido/:id).
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Curva ABCD de Clientes ───────────────────────────────────────────────────

function SecaoCurvaABCD({ pedidos }: { pedidos: PedidoUpper[] }) {
  const [sortDesc, setSortDesc] = useState(true)

  const curva = useMemo(
    () => calcularCurvaABCD(pedidos, PESSOAS_MOCK),
    [pedidos],
  )

  const ordenado = useMemo(
    () => sortDesc ? curva : [...curva].sort((a, b) => a.valorTotal - b.valorTotal),
    [curva, sortDesc],
  )

  const resumoPorCurva = useMemo(() => {
    const m: Record<string, { qtd: number; pct: number }> = {
      A: { qtd: 0, pct: 0 }, B: { qtd: 0, pct: 0 },
      C: { qtd: 0, pct: 0 }, D: { qtd: 0, pct: 0 },
    }
    for (const c of curva) {
      m[c.curva].qtd++
      m[c.curva].pct += c.percentualFaturamento
    }
    return Object.entries(m).map(([curvaLabel, d]) => ({ curva: curvaLabel, ...d }))
  }, [curva])

  if (curva.length === 0) {
    return (
      <section style={{ marginTop: 52 }}>
        <div className={styles.shead} style={{ marginBottom: 8 }}>
          <div className={`${styles.stitle} ${styles.serif}`}>Curva ABCD de Clientes</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Sem dados de clientes para o período selecionado.</p>
      </section>
    )
  }

  return (
    <section style={{ marginTop: 52 }}>
      <div className={styles.shead} style={{ marginBottom: 8 }}>
        <div className={`${styles.stitle} ${styles.serif}`}>Curva ABCD de Clientes</div>
        <div className={styles.over}>{curva.length} clientes</div>
      </div>

      {/* Gráfico de resumo */}
      <div style={{ marginBottom: 32 }}>
        <p className={styles.over} style={{ marginBottom: 12 }}>Distribuição por faixa</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={resumoPorCurva} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="1 4" stroke={CORES.line} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: CORES.ink3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="curva" width={24} tick={{ fill: CORES.ink2, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)}%`, '% faturamento']}
              contentStyle={{ background: CORES.bg, border: `1px solid ${CORES.line2}`, fontSize: 12 }}
              cursor={{ fill: CORES.paper }}
            />
            <Bar dataKey="pct" maxBarSize={24} radius={[0, 2, 2, 0]}>
              {resumoPorCurva.map((entry) => (
                <Cell key={entry.curva} fill={COR_CURVA[entry.curva as ClienteCurvaABCD['curva']]} />
              ))}
              <LabelList
                dataKey="qtd"
                position="right"
                style={{ fontSize: 11, fill: CORES.ink2 }}
                formatter={(v: unknown) => `${v} cliente${Number(v) !== 1 ? 's' : ''}`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela detalhada */}
      <div className={`${styles.thead} ${styles.t5}`}>
        <div>Cliente</div>
        <div
          className={`${styles.right} ${styles.thSortable}`}
          onClick={() => setSortDesc(s => !s)}
          title="Ordenar por valor"
        >
          Valor Total {sortDesc ? '↓' : '↑'}
        </div>
        <div className={styles.right}>% Faturamento</div>
        <div className={styles.right}>% Acumulado</div>
        <div className={styles.right}>Curva</div>
      </div>
      {ordenado.map((c: ClienteCurvaABCD) => (
        <div key={c.nome} className={`${styles.trow} ${styles.t5}`}>
          <div>
            <p className={styles.fn}>{c.nome}</p>
            {c.cidade && <p className={`${styles.over} mt-0.5`} style={{ letterSpacing: '.05em' }}>{c.cidade}</p>}
          </div>
          <div className={`${styles.right} ${styles.money} ${styles.serif} ${styles.num}`}>
            {formatMoeda(c.valorTotal)}
          </div>
          <div className={`${styles.right} ${styles.num}`} style={{ color: CORES.ink2 }}>
            {formatPercentual(c.percentualFaturamento)}
          </div>
          <div className={`${styles.right} ${styles.num}`} style={{ color: CORES.ink3 }}>
            {formatPercentual(c.percentualAcumulado)}
          </div>
          <div className={styles.right}>
            <span
              className={styles.curvaBadge}
              style={{ borderColor: COR_CURVA[c.curva], color: COR_CURVA[c.curva] }}
            >
              {c.curva}
            </span>
          </div>
        </div>
      ))}
    </section>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type SubAba = 'pessoas' | 'compras' | 'estoque'

export default function ComercialPage() {
  const [dados, setDados] = useState<DadosComerciais | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<UsuarioInfo | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then((d: UsuarioInfo) => setUsuario(d))
      .catch(() => {})
  }, [])
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [subAba, setSubAba] = useState<SubAba>('pessoas')
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('30dias')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')

  useEffect(() => {
    buscarDadosComerciais()
      .then(setDados)
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar dados comerciais'))
  }, [])

  const filtro = useMemo(
    () => construirFiltro(tipoPeriodo, customInicio, customFim),
    [tipoPeriodo, customInicio, customFim],
  )

  const pedidosFiltrados = useMemo(
    () => dados ? filtrarPorPeriodo(dados.pedidos, filtro) : [],
    [dados, filtro],
  )

  function toggle(id: string) {
    setExpandidos(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const abasNavVisiveis = usuario?.role === 'viewer'
    ? ABAS_NAV.filter(a => a.id !== 'upload')
    : ABAS_NAV

  const cabecalho = (
    <div className={`${styles.hdr} ${styles.htop}`}>
      <div className={styles.wrap}>
        <div className={styles.brand} style={{ alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CFO.IA" style={{ height: 52, width: 'auto', margin: '-9px 0' }} />
            <div className={styles.bsub}>Painel financeiro · Estruturas para energia solar</div>
          </div>
          {usuario && <UserMenu usuario={usuario} />}
        </div>
        <NavTabs itens={abasNavVisiveis} ativo="comercial" />
      </div>
    </div>
  )

  const bannerDemo = (
    <div className={styles.demo}>
      <IconeInfo />
      <span><b>Ambiente de demonstração.</b> Os valores nesta tela são fictícios — a integração com a Upper Softwares está pendente de liberação pelo fornecedor.</span>
    </div>
  )

  if (erro) {
    return (
      <div className={styles.page}>
        {cabecalho}
        <div className={`${styles.wrap} ${styles.sect}`}>
          {bannerDemo}
          <p style={{ color: 'var(--critico)' }}>{erro}</p>
        </div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className={styles.page}>
        {cabecalho}
        <div className={`${styles.wrap} ${styles.sect}`}>
          <p style={{ color: 'var(--ink3)', fontSize: 13 }}>Conectando à Upper Softwares…</p>
        </div>
      </div>
    )
  }

  const pedidosOrdenados = [...pedidosFiltrados].sort(
    (a, b) => new Date(b.dataCadastro).getTime() - new Date(a.dataCadastro).getTime(),
  )
  const aguardandoFaturamento = pedidosFiltrados.filter(p => p.situacaoFaturamento === 'PENDENTE').length
  const faturados = pedidosFiltrados.filter(p => p.situacaoFaturamento === 'FATURADO').length
  const estoqueBaixo = dados.saldoEstoque.filter(s => s.quantidade < LIMITE_ESTOQUE_ATENCAO)
  const estoqueCritico = dados.saldoEstoque.filter(s => s.quantidade < LIMITE_ESTOQUE_CRITICO)

  const totalAguardando = pedidosFiltrados
    .filter(p => p.situacaoFaturamento === 'PENDENTE')
    .reduce((s, p) => s + (p.valorDocumento ?? 0), 0)
  const totalFaturado = pedidosFiltrados
    .filter(p => p.situacaoFaturamento === 'FATURADO')
    .reduce((s, p) => s + (p.valorDocumento ?? 0), 0)

  const comprasPorFornecedor = new Map<string, { total: number; quantidade: number }>()
  for (const c of dados.compras) {
    const existente = comprasPorFornecedor.get(c.fornecedor)
    if (existente) { existente.total += c.valor; existente.quantidade++ }
    else comprasPorFornecedor.set(c.fornecedor, { total: c.valor, quantidade: 1 })
  }
  const linhasCompras = Array.from(comprasPorFornecedor.entries()).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className={styles.page}>
      {cabecalho}

      <div className={`${styles.wrap} ${styles.sect}`}>

        {/* Banner condicional: demo quando mock, indicador de sync quando real */}
        {dados.origemMock ? bannerDemo : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 11.5, color: CORES.ink3 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: CORES.positivo, flexShrink: 0 }} />
            <span>
              Dados sincronizados com a Upper Softwares em{' '}
              <span className={styles.num}>{dados.sincronizadoEm ? formatData(dados.sincronizadoEm) : '—'}</span>
              {' '}· exibindo {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''}{' '}
              {descricaoPeriodo(filtro)}
            </span>
          </div>
        )}

        {/* Filtro de período */}
        <div className={styles.filtroBar}>
          {(['hoje', '7dias', '30dias', 'personalizado'] as TipoPeriodo[]).map(t => (
            <button
              key={t}
              onClick={() => setTipoPeriodo(t)}
              className={`${styles.pfiltro} ${tipoPeriodo === t ? styles.pfiltroOn : ''}`}
            >
              {LABELS_PERIODO[t]}
            </button>
          ))}
          {tipoPeriodo === 'personalizado' && (
            <div className={styles.filtroCustom}>
              <span className={styles.filtroLbl}>De</span>
              <input
                type="date"
                value={customInicio}
                onChange={e => setCustomInicio(e.target.value)}
                className={styles.filtroDate}
              />
              <span className={styles.filtroLbl}>Até</span>
              <input
                type="date"
                value={customFim}
                onChange={e => setCustomFim(e.target.value)}
                className={styles.filtroDate}
              />
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <div className={styles.kl}>Total de Pedidos</div>
            <div className={`${styles.kv} ${styles.serif} ${styles.num}`}>{pedidosFiltrados.length}</div>
            <div className={styles.kd}>{dados.pedidos.length} carregados da Upper</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kl}>Aguardando Faturamento</div>
            <div className={`${styles.kv} ${styles.serif} ${styles.num}`}>{aguardandoFaturamento}</div>
            <div className={styles.kd}>
              {!dados.origemMock && totalAguardando > 0
                ? formatMoeda(totalAguardando)
                : 'Valor em aberto não disponível via API'}
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kl}>Faturados</div>
            <div className={`${styles.kv} ${styles.serif} ${styles.num}`}>{faturados}</div>
            <div className={styles.kd}>
              {!dados.origemMock && totalFaturado > 0
                ? formatMoeda(totalFaturado)
                : 'Valor faturado não disponível via API'}
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kl}>Itens c/ Estoque Baixo</div>
            <div className={`${styles.kv} ${styles.serif} ${styles.num} ${estoqueCritico.length > 0 ? styles.crit : ''}`}>{estoqueBaixo.length}</div>
            <div className={styles.kd}>{estoqueCritico.length} em nível crítico</div>
          </div>
        </div>

        {/* Pedidos Recentes */}
        <div className={styles.shead}>
          <div className={`${styles.stitle} ${styles.serif}`}>Pedidos Recentes</div>
          <div className={styles.over}>{pedidosFiltrados.length} registros</div>
        </div>
        {dados.origemMock && (
          <div className={styles.scap}>Selecione um pedido para visualizar os itens.</div>
        )}

        <div className={styles.ohead}>
          <div>Cliente</div>
          <div>Data Emissão</div>
          <div>Previsão Entrega</div>
          <div>Situação</div>
          <div className={styles.right}>Itens</div>
        </div>
        {pedidosOrdenados.length === 0 ? (
          <p style={{ padding: '24px 4px', fontSize: 13, color: 'var(--ink3)' }}>
            Nenhum pedido encontrado para o período selecionado.
          </p>
        ) : (
          pedidosOrdenados.map(pedido => (
            <LinhaPedido
              key={pedido.id}
              pedido={pedido}
              expandido={expandidos.has(pedido.id)}
              onToggle={() => toggle(pedido.id)}
            />
          ))
        )}

        {/* Curva ABCD — ilustrativa (preço por item não disponível na listagem da Upper) */}
        <SecaoCurvaABCD pedidos={pedidosFiltrados} />

        {/* Sub-seções: Pessoas / Compras / Estoque */}
        <div className={styles.subnav} style={{ marginTop: 52 }}>
          <button onClick={() => setSubAba('pessoas')} className={`${styles.stab} ${subAba === 'pessoas' ? styles.stabOn : ''}`}>
            Clientes e Fornecedores
          </button>
          <button onClick={() => setSubAba('compras')} className={`${styles.stab} ${subAba === 'compras' ? styles.stabOn : ''}`}>
            Compras por Fornecedor
          </button>
          <button onClick={() => setSubAba('estoque')} className={`${styles.stab} ${subAba === 'estoque' ? styles.stabOn : ''}`}>
            Estoque
          </button>
        </div>

        {subAba === 'pessoas' && (
          <div className={styles.pgrid}>
            {dados.pessoas.map(p => (
              <div key={p.id} className={styles.prow}>
                <div>
                  <div className={styles.pn}>{p.nome}</div>
                  <div className={styles.pc}>{p.cidade}</div>
                </div>
                <span className={styles.stat}>
                  <span className={`${styles.dot} ${p.tipo === 'fornecedor' ? styles.dForn : styles.dCli}`} />
                  {p.tipo}
                </span>
              </div>
            ))}
          </div>
        )}

        {subAba === 'compras' && (
          <div>
            <div className={`${styles.thead} ${styles.tcomp}`}>
              <div>Fornecedor</div>
              <div className={styles.right}>Total Comprado</div>
              <div className={styles.right}>Compras</div>
            </div>
            {linhasCompras.map(([fornecedor, d]) => (
              <div key={fornecedor} className={`${styles.trow} ${styles.tcomp}`}>
                <div className={styles.fn}>{fornecedor}</div>
                <div className={`${styles.right} ${styles.money} ${styles.serif} ${styles.num}`}>{formatMoeda(d.total)}</div>
                <div className={`${styles.right} ${styles.num} ${styles.cdt}`}>{d.quantidade} compras</div>
              </div>
            ))}
          </div>
        )}

        {subAba === 'estoque' && (
          <div>
            <div className={`${styles.thead} ${styles.tstk}`}>
              <div>Produto</div>
              <div>Local</div>
              <div className={styles.right}>Qtd</div>
              <div className={styles.right}>Situação</div>
            </div>
            {dados.saldoEstoque.map(s => {
              const critico = s.quantidade < LIMITE_ESTOQUE_CRITICO
              const baixo = !critico && s.quantidade < LIMITE_ESTOQUE_ATENCAO
              return (
                <div key={s.id} className={`${styles.trow} ${styles.tstk}`}>
                  <div className={styles.fn}>{s.produto}</div>
                  <div className={styles.cdt}>{s.local}</div>
                  <div className={`${styles.right} ${styles.stkq} ${styles.serif} ${styles.num} ${critico ? styles.crit : ''}`}>{s.quantidade}</div>
                  <div className={`${styles.note} ${critico ? styles.nCrit : baixo ? styles.nLow : ''}`}>
                    {critico ? 'Crítico' : baixo ? 'Baixo' : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  Sun,
  BarChart2,
  Building2,
  PieChart,
  Users,
  FileText,
  GitCompare,
  MessageCircle,
  Upload,
  ShoppingCart,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Package,
  Truck,
} from 'lucide-react'
import { NavTabs, type ItemNavTab } from '@/components/layout/NavTabs'
import { KPICard } from '@/components/dashboard/KPICard'
import { buscarDadosComerciais, type DadosComerciais } from '@/lib/dados-comerciais'
import type { PedidoUpper } from '@/lib/upper-mock-data'
import { formatMoeda, formatData } from '@/lib/utils'

const LIMITE_ESTOQUE_CRITICO = 10
const LIMITE_ESTOQUE_ATENCAO = 30

type AbaNav = 'dashboard' | 'empresas' | 'despesas' | 'clientes' | 'comercial' | 'relatorio' | 'comparativo' | 'chat' | 'upload'

const ABAS_NAV: ItemNavTab<AbaNav>[] = [
  { id: 'dashboard',   label: 'Dashboard',         Icon: BarChart2,    href: '/' },
  { id: 'empresas',    label: 'Empresas',          Icon: Building2,    href: '/' },
  { id: 'despesas',    label: 'Despesas',          Icon: PieChart,     href: '/' },
  { id: 'clientes',    label: 'Clientes',          Icon: Users,        href: '/' },
  { id: 'comercial',   label: 'Comercial',         Icon: ShoppingCart },
  { id: 'relatorio',   label: 'Relatório IA',      Icon: FileText,     href: '/' },
  { id: 'comparativo', label: 'Comparativo',       Icon: GitCompare,   href: '/' },
  { id: 'chat',        label: 'Chat',              Icon: MessageCircle, href: '/' },
  { id: 'upload',      label: 'Adicionar Arquivo', Icon: Upload,       href: '/' },
]

const COR_SITUACAO: Record<string, string> = {
  PENDENTE: '#f59e0b',
  FATURADO: '#22c55e',
  EM_PRODUCAO: '#3b82f6',
}

function BadgeSituacao({ situacao }: { situacao: string }) {
  const cor = COR_SITUACAO[situacao] ?? '#64748b'
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${cor}20`, color: cor }}
    >
      {situacao.replace('_', ' ')}
    </span>
  )
}

function SecaoContainer({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5 animate-fadeIn" style={{ background: '#1a1d27', borderColor: '#2d3148' }}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
        {titulo}
      </h3>
      {children}
    </div>
  )
}

function LinhaPedido({ pedido, expandido, onToggle }: { pedido: PedidoUpper; expandido: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: expandido ? 'none' : '1px solid #1e2130' }}
      >
        <td className="py-2.5 pr-6">
          <div className="flex items-center gap-1.5">
            {expandido ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: '#64748b' }} />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: '#64748b' }} />
            )}
            <span className="font-medium" style={{ color: '#e2e8f0' }}>{pedido.nomeCliente}</span>
          </div>
        </td>
        <td className="py-2.5 pr-6 tabular-nums" style={{ color: '#94a3b8' }}>{formatData(pedido.dataCadastro)}</td>
        <td className="py-2.5 pr-6 tabular-nums" style={{ color: '#94a3b8' }}>{formatData(pedido.dataPrevisaoEntrega)}</td>
        <td className="py-2.5 pr-6"><BadgeSituacao situacao={pedido.situacaoFaturamento} /></td>
        <td className="py-2.5 tabular-nums" style={{ color: '#94a3b8' }}>{pedido.itens.length}</td>
      </tr>
      {expandido && (
        <tr style={{ borderBottom: '1px solid #1e2130' }}>
          <td colSpan={5} className="pb-3 pl-9 pr-6">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {['Produto', 'Referência', 'Quantidade', 'Unidade'].map(h => (
                    <th key={h} className="pb-1.5 pr-4 text-left font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedido.itens.map(item => (
                  <tr key={item.id}>
                    <td className="py-1 pr-4" style={{ color: '#cbd5e1' }}>{item.nomeCompletoProduto}</td>
                    <td className="py-1 pr-4" style={{ color: '#64748b' }}>{item.referenciaProduto}</td>
                    <td className="py-1 pr-4 tabular-nums" style={{ color: '#cbd5e1' }}>{item.quantidade}</td>
                    <td className="py-1 pr-4" style={{ color: '#64748b' }}>{item.uniMedProduto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

function SecaoPedidos({ pedidos }: { pedidos: PedidoUpper[] }) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpandidos(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const ordenados = [...pedidos].sort((a, b) => new Date(b.dataCadastro).getTime() - new Date(a.dataCadastro).getTime())

  return (
    <SecaoContainer titulo="Pedidos Recentes">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3148' }}>
              {['Cliente', 'Data Cadastro', 'Previsão Entrega', 'Situação', 'Qtd Itens'].map(h => (
                <th key={h} className="pb-2 pr-6 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenados.map(pedido => (
              <LinhaPedido key={pedido.id} pedido={pedido} expandido={expandidos.has(pedido.id)} onToggle={() => toggle(pedido.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </SecaoContainer>
  )
}

function SecaoPessoas({ pessoas }: { pessoas: DadosComerciais['pessoas'] }) {
  return (
    <SecaoContainer titulo="Clientes e Fornecedores">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pessoas.map(p => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border px-3.5 py-2.5" style={{ background: '#161925', borderColor: '#2d3148' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{p.nome}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>{p.cidade}</p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: p.tipo === 'cliente' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                color: p.tipo === 'cliente' ? '#3b82f6' : '#a855f7',
              }}
            >
              {p.tipo}
            </span>
          </div>
        ))}
      </div>
    </SecaoContainer>
  )
}

function SecaoCompras({ compras }: { compras: DadosComerciais['compras'] }) {
  const porFornecedor = new Map<string, { total: number; quantidade: number }>()
  for (const c of compras) {
    const existente = porFornecedor.get(c.fornecedor)
    if (existente) { existente.total += c.valor; existente.quantidade++ }
    else porFornecedor.set(c.fornecedor, { total: c.valor, quantidade: 1 })
  }
  const linhas = Array.from(porFornecedor.entries()).sort((a, b) => b[1].total - a[1].total)

  return (
    <SecaoContainer titulo="Compras por Fornecedor">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #2d3148' }}>
            {['Fornecedor', 'Total Comprado', 'Qtd Compras'].map(h => (
              <th key={h} className="pb-2 pr-6 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(([fornecedor, dados]) => (
            <tr key={fornecedor} style={{ borderBottom: '1px solid #1e2130' }}>
              <td className="py-2.5 pr-6 font-medium" style={{ color: '#e2e8f0' }}>{fornecedor}</td>
              <td className="py-2.5 pr-6 tabular-nums" style={{ color: '#22c55e' }}>{formatMoeda(dados.total)}</td>
              <td className="py-2.5 tabular-nums" style={{ color: '#94a3b8' }}>{dados.quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SecaoContainer>
  )
}

function SecaoEstoque({ saldoEstoque }: { saldoEstoque: DadosComerciais['saldoEstoque'] }) {
  function corQuantidade(quantidade: number): string {
    if (quantidade < LIMITE_ESTOQUE_CRITICO) return '#ef4444'
    if (quantidade < LIMITE_ESTOQUE_ATENCAO) return '#f59e0b'
    return '#e2e8f0'
  }

  return (
    <SecaoContainer titulo="Estoque">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #2d3148' }}>
            {['Produto', 'Local', 'Quantidade'].map(h => (
              <th key={h} className="pb-2 pr-6 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {saldoEstoque.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #1e2130' }}>
              <td className="py-2.5 pr-6 font-medium" style={{ color: '#e2e8f0' }}>{s.produto}</td>
              <td className="py-2.5 pr-6" style={{ color: '#94a3b8' }}>{s.local}</td>
              <td className="py-2.5 tabular-nums font-semibold" style={{ color: corQuantidade(s.quantidade) }}>
                {s.quantidade}
                {s.quantidade < LIMITE_ESTOQUE_CRITICO && ' — crítico'}
                {s.quantidade >= LIMITE_ESTOQUE_CRITICO && s.quantidade < LIMITE_ESTOQUE_ATENCAO && ' — atenção'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SecaoContainer>
  )
}

type SubAba = 'pessoas' | 'compras' | 'estoque'

const SUB_ABAS: { id: SubAba; label: string; Icon: typeof Users }[] = [
  { id: 'pessoas', label: 'Clientes e Fornecedores', Icon: Users },
  { id: 'compras',  label: 'Compras por Fornecedor',  Icon: Truck },
  { id: 'estoque',  label: 'Estoque',                 Icon: Package },
]

export default function ComercialPage() {
  const [dados, setDados] = useState<DadosComerciais | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [subAba, setSubAba] = useState<SubAba>('pessoas')

  useEffect(() => {
    buscarDadosComerciais()
      .then(setDados)
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar dados comerciais'))
      .finally(() => setCarregando(false))
  }, [])

  const totalPedidos = dados?.pedidos.length ?? 0
  const aguardandoFaturamento = dados?.pedidos.filter(p => p.situacaoFaturamento === 'PENDENTE').length ?? 0
  const faturados = dados?.pedidos.filter(p => p.situacaoFaturamento === 'FATURADO').length ?? 0
  const itensEstoqueBaixo = dados?.saldoEstoque.filter(s => s.quantidade < LIMITE_ESTOQUE_CRITICO).length ?? 0

  return (
    <div className="min-h-screen" style={{ background: '#0f1117' }}>
      <header
        className="sticky top-0 z-30 border-b"
        style={{ background: 'rgba(15,17,23,0.92)', backdropFilter: 'blur(12px)', borderColor: '#2d3148' }}
      >
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5 mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Sun className="h-4 w-4" style={{ color: '#3b82f6' }} />
            </div>
            <span className="font-bold text-sm hidden sm:block" style={{ color: '#e2e8f0' }}>CFO Solar</span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ClipboardList className="h-3.5 w-3.5 shrink-0" style={{ color: '#64748b' }} />
            <span className="text-xs" style={{ color: '#64748b' }}>Módulo Comercial — dados Upper Softwares</span>
          </div>
        </div>
        <NavTabs itens={ABAS_NAV} ativo="comercial" />
      </header>

      <main className="mx-auto max-w-screen-2xl px-5 py-6 flex flex-col gap-6">
        <div
          className="flex items-center gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm"
          style={{ background: 'rgba(245,158,11,0.08)', borderLeftColor: '#f59e0b', border: '1px solid rgba(120,80,10,0.4)', borderLeftWidth: 4 }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} />
          <span style={{ color: '#fcd34d' }}>
            Exibindo dados de demonstração — integração com Upper Softwares pendente de liberação pelo fornecedor.
          </span>
        </div>

        {carregando && (
          <p className="text-sm" style={{ color: '#64748b' }}>Carregando dados comerciais…</p>
        )}

        {erro && (
          <div
            className="flex items-center gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', borderLeftColor: '#ef4444', borderLeftWidth: 4 }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />
            <span style={{ color: '#fca5a5' }}>{erro}</span>
          </div>
        )}

        {dados && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KPICard titulo="Total de Pedidos" valor={totalPedidos} formato="numero" Icon={ClipboardList} cor="blue" />
              <KPICard titulo="Aguardando Faturamento" valor={aguardandoFaturamento} formato="numero" Icon={AlertTriangle} cor="yellow" />
              <KPICard titulo="Faturados" valor={faturados} formato="numero" Icon={ShoppingCart} cor="green" />
              <KPICard titulo="Itens com Estoque Baixo" valor={itensEstoqueBaixo} formato="numero" Icon={Package} cor="red" />
            </div>

            <SecaoPedidos pedidos={dados.pedidos} />

            <div className="flex flex-wrap gap-2">
              {SUB_ABAS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSubAba(id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: subAba === id ? '#3b82f6' : '#1a1d27',
                    color: subAba === id ? '#fff' : '#94a3b8',
                    border: subAba === id ? 'none' : '1px solid #2d3148',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {subAba === 'pessoas' && <SecaoPessoas pessoas={dados.pessoas} />}
            {subAba === 'compras' && <SecaoCompras compras={dados.compras} />}
            {subAba === 'estoque' && <SecaoEstoque saldoEstoque={dados.saldoEstoque} />}
          </>
        )}
      </main>
    </div>
  )
}

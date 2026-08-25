'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { NavTabs, type ItemNavTab } from '@/components/layout/NavTabs'
import styles from '@/styles/editorial.module.css'
import type { Cliente } from '@/lib/clientes-repository'
import type { PedidoResumo } from '@/lib/comercial-pedidos-repository'
import type { ItemPedido } from '@/lib/comercial-pedidos-itens-repository'
import {
  calcularScore,
  calcularPotencial,
  calcularChanceRecompra,
  calcularEtapaPipeline,
  calcularAlertas,
  top3Produtos,
  filialMaisRecente,
} from '@/lib/cliente-inteligencia'

import CabecalhoCliente from '@/components/clientes/hub/CabecalhoCliente'
import ScoreCard from '@/components/clientes/hub/ScoreCard'
import AcoesRapidas from '@/components/clientes/hub/AcoesRapidas'
import ModalRegistrarAtividade from '@/components/clientes/hub/ModalRegistrarAtividade'
import ModalAgendarAtividade from '@/components/clientes/hub/ModalAgendarAtividade'
import AbaInteligencia from '@/components/clientes/hub/AbaInteligencia'
import AbaPipeline from '@/components/clientes/hub/AbaPipeline'
import TimelineHistorico from '@/components/clientes/hub/TimelineHistorico'
import AbaDocumentos from '@/components/clientes/hub/AbaDocumentos'
import ProximasAcoesList from '@/components/clientes/hub/ProximasAcoesList'
import AbaAlertas from '@/components/clientes/hub/AbaAlertas'
import type { AtividadeComNome } from '@/components/clientes/hub/AtividadeCard'

type AbaId = 'inteligencia' | 'pipeline' | 'historico' | 'documentos' | 'proximasAcoes' | 'alertas'

interface DetalhePedido {
  itens: ItemPedido[]
  pdfUrl: string | null
}

export default function ClienteHubPage() {
  const params = useParams()
  const cnpj = params.cnpj as string

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([])
  const [mapaVendedores, setMapaVendedores] = useState<Record<string, string>>({})
  const [detalhesPedidos, setDetalhesPedidos] = useState<Record<string, DetalhePedido>>({})
  const [atividades, setAtividades] = useState<AtividadeComNome[]>([])
  const [abaAtiva, setAbaAtiva] = useState<AbaId>('inteligencia')
  const [modalNovoContato, setModalNovoContato] = useState(false)
  const [modalAgendar, setModalAgendar] = useState(false)
  const [atividadeConcluir, setAtividadeConcluir] = useState<AtividadeComNome | null>(null)

  const recarregarCliente = useCallback(async () => {
    const json = await fetch(`/api/clientes/${cnpj}`).then(r => r.json()) as { ok: boolean; cliente?: Cliente }
    if (json.ok && json.cliente) setCliente(json.cliente)
  }, [cnpj])

  const recarregarAtividades = useCallback(async () => {
    const json = await fetch(`/api/clientes/${cnpj}/atividades`).then(r => r.json()) as { ok: boolean; atividades?: AtividadeComNome[] }
    if (json.ok && json.atividades) setAtividades(json.atividades)
  }, [cnpj])

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const [clienteJson, vendJson, atividadesJson] = await Promise.all([
          fetch(`/api/clientes/${cnpj}`).then(r => r.json() as Promise<{ ok: boolean; cliente?: Cliente; error?: string }>),
          fetch('/api/comercial/vendedores').then(r => r.json() as Promise<{ ok: boolean; vendedores?: { id: string; nome: string }[] }>),
          fetch(`/api/clientes/${cnpj}/atividades`).then(r => r.json() as Promise<{ ok: boolean; atividades?: AtividadeComNome[] }>),
        ])
        if (cancelado) return

        if (!clienteJson.ok || !clienteJson.cliente) {
          setErro(clienteJson.error ?? 'Não foi possível carregar o cliente.')
          return
        }
        setCliente(clienteJson.cliente)

        if (vendJson.ok && vendJson.vendedores) {
          const mapa: Record<string, string> = {}
          vendJson.vendedores.forEach(v => { mapa[v.id] = v.nome })
          setMapaVendedores(mapa)
        }

        setAtividades(atividadesJson.ok && atividadesJson.atividades ? atividadesJson.atividades : [])

        const pedidosJson = await fetch(`/api/orcamentos?clienteCnpj=${encodeURIComponent(clienteJson.cliente.cnpj)}&porPagina=100`)
          .then(r => r.json() as Promise<{ ok: boolean; pedidos?: PedidoResumo[] }>)
        if (cancelado) return

        const listaPedidos = pedidosJson.ok && pedidosJson.pedidos ? pedidosJson.pedidos : []
        setPedidos(listaPedidos)

        if (listaPedidos.length > 0) {
          const detalhes = await Promise.all(
            listaPedidos.map(p =>
              fetch(`/api/orcamentos/${p.id}`)
                .then(r => r.json() as Promise<{ ok: boolean; pedido?: { pdfUrl: string | null }; itens?: ItemPedido[] }>)
                .catch(() => null),
            ),
          )
          if (cancelado) return

          const mapaDetalhes: Record<string, DetalhePedido> = {}
          detalhes.forEach((d, i) => {
            if (d?.ok) {
              mapaDetalhes[listaPedidos[i].id] = { itens: d.itens ?? [], pdfUrl: d.pedido?.pdfUrl ?? null }
            }
          })
          setDetalhesPedidos(mapaDetalhes)
        } else {
          setDetalhesPedidos({})
        }
      } catch {
        if (!cancelado) setErro('Erro de rede ao carregar o cliente.')
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    void carregar()
    return () => { cancelado = true }
  }, [cnpj])

  const todosItens = useMemo(() => Object.values(detalhesPedidos).flatMap(d => d.itens), [detalhesPedidos])
  const resultadoScore = useMemo(() => cliente ? calcularScore(cliente, pedidos) : null, [cliente, pedidos])
  const potencial = useMemo(() => resultadoScore ? calcularPotencial(resultadoScore.score) : null, [resultadoScore])
  const chanceRecompra = useMemo(() => cliente ? calcularChanceRecompra(cliente, pedidos) : null, [cliente, pedidos])
  const etapaPipeline = useMemo(() => cliente ? calcularEtapaPipeline(cliente, pedidos) : null, [cliente, pedidos])
  const alertas = useMemo(() => cliente ? calcularAlertas(cliente, pedidos) : [], [cliente, pedidos])
  const produtosTop = useMemo(() => top3Produtos(todosItens), [todosItens])
  const filial = useMemo(() => filialMaisRecente(pedidos), [pedidos])

  const detalhesPdf = useMemo(() => {
    const mapa: Record<string, { pdfUrl: string | null }> = {}
    for (const [id, d] of Object.entries(detalhesPedidos)) mapa[id] = { pdfUrl: d.pdfUrl }
    return mapa
  }, [detalhesPedidos])

  const ABAS: ItemNavTab<AbaId>[] = [
    { id: 'inteligencia', label: 'Inteligência' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'historico', label: 'Histórico' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'proximasAcoes', label: 'Próximas Ações' },
    { id: 'alertas', label: alertas.length > 0 ? `Alertas (${alertas.length})` : 'Alertas' },
  ]

  if (carregando) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderTopColor: 'var(--foreground)', borderRightColor: 'var(--line2)', borderBottomColor: 'var(--line2)', borderLeftColor: 'var(--line2)' }}
          />
        </div>
      </AppLayout>
    )
  }

  if (erro || !cliente || !resultadoScore || !potencial || !chanceRecompra || !etapaPipeline) {
    return (
      <AppLayout>
        <main className={styles.wrap} style={{ paddingTop: 40 }}>
          <div className={`${styles.notice} ${styles.alertaDanger}`}>
            <span>{erro ?? 'Não foi possível carregar o cliente.'}</span>
          </div>
        </main>
      </AppLayout>
    )
  }

  const nomeVendedor = cliente.vendedorId ? (mapaVendedores[cliente.vendedorId] ?? cliente.vendedorId) : 'Sem vendedor'

  return (
    <AppLayout>
      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 80 }}>
        <CabecalhoCliente cliente={cliente} nomeVendedor={nomeVendedor} filial={filial} />

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32, marginTop: 32, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 24 }}>
            <ScoreCard score={resultadoScore.score} potencial={potencial} detalhe={resultadoScore.detalhe} />
            <AcoesRapidas
              cliente={cliente}
              onRegistrarContato={() => setModalNovoContato(true)}
              onAgendarVisita={() => setModalAgendar(true)}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <NavTabs itens={ABAS} ativo={abaAtiva} onSelecionar={setAbaAtiva} />
            <div style={{ marginTop: 28 }}>
              {abaAtiva === 'inteligencia' && (
                <AbaInteligencia cliente={cliente} pedidos={pedidos} chanceRecompra={chanceRecompra} produtosTop={produtosTop} />
              )}
              {abaAtiva === 'pipeline' && <AbaPipeline etapaAtual={etapaPipeline} />}
              {abaAtiva === 'historico' && <TimelineHistorico atividades={atividades} />}
              {abaAtiva === 'documentos' && <AbaDocumentos pedidos={pedidos} detalhes={detalhesPdf} />}
              {abaAtiva === 'proximasAcoes' && (
                <ProximasAcoesList atividades={atividades} onMarcarRealizado={setAtividadeConcluir} />
              )}
              {abaAtiva === 'alertas' && <AbaAlertas alertas={alertas} />}
            </div>
          </div>
        </div>
      </main>

      <ModalRegistrarAtividade
        aberto={modalNovoContato || atividadeConcluir !== null}
        cnpj={cnpj}
        atividadeParaConcluir={atividadeConcluir}
        onFechar={() => { setModalNovoContato(false); setAtividadeConcluir(null) }}
        onSalvo={() => { void recarregarAtividades(); void recarregarCliente() }}
      />
      <ModalAgendarAtividade
        aberto={modalAgendar}
        cnpj={cnpj}
        onFechar={() => setModalAgendar(false)}
        onSalvo={() => { void recarregarAtividades() }}
      />
    </AppLayout>
  )
}

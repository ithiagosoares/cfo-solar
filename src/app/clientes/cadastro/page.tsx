'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { FilterBar, FilterInput, FilterSelect, FilterCheckbox } from '@/components/filters/FilterBar'
import { ModalNovoCliente } from '@/components/clientes/ModalNovoCliente'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useListasCrm } from '@/hooks/useListasCrm'
import styles from '@/styles/editorial.module.css'

function mascaraCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

const ORIGEM_LABEL: Record<string, string> = {
  prospeccao: 'Prospecção',
  lead:       'Lead',
}

const POR_PAGINA = 20

type FiltroCliente = { busca: string; listaId: string; vendedorId: string; mostrarArquivados: boolean }
const FILTRO_ZERO: FiltroCliente = { busca: '', listaId: '', vendedorId: '', mostrarArquivados: false }

function temFiltroAtivo(f: FiltroCliente) {
  return f.busca || f.listaId || f.vendedorId
}

interface ClienteResumo {
  cnpj: string
  razaoSocial: string
  status: string
  vendedorId: string | null
  criadoPor: string
  criadoEm: string
  dataUltimaCompra: string | null
  listaId: string
  origem: string
  arquivado?: boolean
}

export default function CadastroClientePage() {
  const router = useRouter()

  const [papel, setPapel] = useState<string | null>(null)
  const [meEmail, setMeEmail] = useState<string | null>(null)
  const [meVendedorId, setMeVendedorId] = useState<string | null>(null)
  const eVendedor = papel === 'vendedor'

  const { listas } = useListasCrm()
  const listaOpcoes = listas.map(l => ({ value: l.id, label: l.nome, bg: `${l.cor}22`, fg: l.cor }))

  const [modalAberto, setModalAberto] = useState(false)

  const [vendedoresOpt, setVendedoresOpt] = useState<{ id: string; label: string }[]>([])
  const [carregandoVend, setCarregandoVend] = useState(true)

  const [filtro, setFiltro] = useState<FiltroCliente>(FILTRO_ZERO)
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroCliente>(FILTRO_ZERO)

  const [listaVersion, setListaVersion] = useState(0)
  const [lista, setLista] = useState<ClienteResumo[]>([])
  const [total, setTotal] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json() as Promise<{ papel?: string; email?: string; vendedorId?: string | null }>)
      .then(d => {
        setPapel(d.papel ?? 'sem_acesso')
        setMeEmail(d.email ?? null)
        setMeVendedorId(d.vendedorId ?? null)
      })
      .catch(() => setPapel('sem_acesso'))
  }, [])

  useEffect(() => {
    if (papel === null) return
    if (papel === 'vendedor') { setCarregandoVend(false); return } // eslint-disable-line react-hooks/set-state-in-effect

    fetch('/api/comercial/vendedores')
      .then(r => r.json() as Promise<{ ok: boolean; vendedores?: { id: string; nome: string }[] }>)
      .then(json => {
        if (json.ok && json.vendedores) {
          setVendedoresOpt(json.vendedores.map(v => ({ id: v.id, label: v.nome })))
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoVend(false))
  }, [papel])

  const buscarClientes = useCallback(async (pagina: number, reset: boolean, fa: FiltroCliente) => {
    if (reset) setCarregandoLista(true)
    else setCarregandoMais(true)
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) })
      if (papel !== 'vendedor' && papel !== 'sdr') params.set('meus', '1')
      if (fa.busca)               params.set('busca',       fa.busca)
      if (fa.listaId)             params.set('listaId',     fa.listaId)
      if (fa.vendedorId)          params.set('vendedor_id', fa.vendedorId)
      if (fa.mostrarArquivados)   params.set('arquivados',  '1')
      window.history.replaceState(null, '', `?${params}`)

      const res = await fetch(`/api/clientes?${params}`)
      const json = await res.json() as { ok: boolean; clientes?: ClienteResumo[]; total?: number }
      if (!json.ok) return

      const novos = json.clientes ?? []
      setLista(prev => reset ? novos : [...prev, ...novos])
      setTotal(json.total ?? 0)
      setPaginaAtual(pagina)
    } finally {
      if (reset) setCarregandoLista(false)
      else setCarregandoMais(false)
    }
  }, [papel])

  useEffect(() => {
    if (papel !== null) buscarClientes(1, true, filtroAtivo) // eslint-disable-line react-hooks/set-state-in-effect
  }, [papel, listaVersion, filtroAtivo]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltrar() { setFiltroAtivo({ ...filtro }) }
  function handleLimpar()  { setFiltro(FILTRO_ZERO); setFiltroAtivo(FILTRO_ZERO) }

  async function arquivarClienteInLinha(cnpj: string, arquivar: boolean) {
    const res = await fetch(`/api/clientes/${cnpj}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arquivar }),
    })
    if (res.ok) setListaVersion(v => v + 1)
  }

  async function salvarLista(cnpj: string, novaListaId: string) {
    const res = await fetch(`/api/clientes/${cnpj}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listaId: novaListaId }),
    })
    if (!res.ok) throw new Error('Falha ao salvar lista')
    setLista(prev => prev.map(c => c.cnpj === cnpj ? { ...c, listaId: novaListaId } : c))
  }

  function podeEditar(c: ClienteResumo): boolean {
    if (!papel) return false
    if (papel === 'administrador' || papel === 'gestor') return true
    if (papel === 'vendedor') return c.vendedorId === meVendedorId
    if (papel === 'sdr') return c.criadoPor === meEmail
    return false
  }

  if (papel === null) {
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

  const listaTitulo = eVendedor ? 'Minha carteira' : 'Clientes'
  const listaVazia = eVendedor
    ? 'Nenhum cliente na sua carteira ainda.'
    : 'Nenhum cliente cadastrado por você ainda.'
  const temMais = lista.length < total
  const colGrid = '140px 1fr 88px 100px 164px 90px auto'

  return (
    <AppLayout>
      <ModalNovoCliente
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onCriado={() => { setModalAberto(false); setListaVersion(v => v + 1) }}
        eVendedor={eVendedor}
        vendedoresOpt={vendedoresOpt}
        carregandoVend={carregandoVend}
      />

      <main className={styles.wrap} style={{ paddingTop: 40, paddingBottom: 72 }}>
        <div className={styles.shead} style={{ marginBottom: 16, alignItems: 'center' }}>
          <div className={`${styles.stitle} ${styles.serif}`}>
            {listaTitulo}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {!carregandoLista && !temFiltroAtivo(filtroAtivo) && (
              <div className={styles.over}>{total} registros</div>
            )}
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className={styles.btnPrimary}
              style={{ fontSize: 13 }}
            >
              + Novo Cliente
            </button>
          </div>
        </div>

        <FilterBar
          onFiltrar={handleFiltrar}
          onLimpar={handleLimpar}
          resultLabel={!carregandoLista && temFiltroAtivo(filtroAtivo)
            ? `${total} resultado${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`
            : undefined}
        >
          <FilterInput
            label="Empresa"
            value={filtro.busca}
            onChange={v => setFiltro(f => ({ ...f, busca: v }))}
            placeholder="Buscar razão social…"
          />
          <FilterSelect
            label="Lista"
            value={filtro.listaId}
            onChange={v => setFiltro(f => ({ ...f, listaId: v }))}
            options={listas.map(l => ({ value: l.id, label: l.nome }))}
            width={150}
          />
          {!eVendedor && vendedoresOpt.length > 0 && (
            <FilterSelect
              label="Responsável"
              value={filtro.vendedorId}
              onChange={v => setFiltro(f => ({ ...f, vendedorId: v }))}
              options={vendedoresOpt.map(v => ({ value: v.id, label: v.label }))}
              width={170}
            />
          )}
          <FilterCheckbox
            label="Mostrar arquivados"
            checked={filtro.mostrarArquivados}
            onChange={v => {
              setFiltro(f => ({ ...f, mostrarArquivados: v }))
              setFiltroAtivo(f => ({ ...f, mostrarArquivados: v }))
            }}
          />
        </FilterBar>

        {carregandoLista ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>Carregando…</p>
        ) : lista.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 16 }}>{listaVazia}</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: colGrid,
                  gap: '0 12px',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line2)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink3)',
                  minWidth: 720,
                }}
              >
                <div>CNPJ</div>
                <div>Razão Social</div>
                <div>Cadastrado</div>
                <div>Última Compra</div>
                <div>Lista</div>
                <div>Origem</div>
                <div />
              </div>

              {lista.map(c => {
                const editavel = podeEditar(c)

                return (
                  <div
                    key={c.cnpj}
                    onClick={() => { if (editavel) router.push(`/clientes/${c.cnpj}/editar`) }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: colGrid,
                      gap: '0 12px',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--line)',
                      fontSize: 13,
                      alignItems: 'center',
                      cursor: editavel ? 'pointer' : 'default',
                      minWidth: 720,
                    }}
                    onMouseEnter={e => { if (editavel) (e.currentTarget as HTMLElement).style.background = 'var(--paper)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div className={styles.num} style={{ fontSize: 12, color: 'var(--ink2)' }}>
                      {mascaraCNPJ(c.cnpj)}
                    </div>

                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {c.razaoSocial}
                    </div>

                    <div className={styles.num} style={{ fontSize: 12, color: 'var(--ink3)' }}>
                      {fmtData(c.criadoEm)}
                    </div>

                    <div className={styles.num} style={{ fontSize: 12, color: c.dataUltimaCompra ? 'var(--ink2)' : 'var(--ink3)' }}>
                      {fmtData(c.dataUltimaCompra)}
                    </div>

                    <div>
                      {editavel && listaOpcoes.length > 0 ? (
                        <StatusSelect
                          value={c.listaId}
                          opcoes={listaOpcoes}
                          onSave={valor => salvarLista(c.cnpj, valor)}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink2)' }}>
                          {listas.find(l => l.id === c.listaId)?.nome ?? '—'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
                      {ORIGEM_LABEL[c.origem] ?? c.origem}
                    </div>

                    <div onClick={e => e.stopPropagation()}>
                      {editavel && (
                        <button
                          type="button"
                          onClick={() => void arquivarClienteInLinha(c.cnpj, !(c.arquivado ?? false))}
                          style={{
                            background: 'none',
                            border: '1px solid var(--cor-borda-sutil)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            color: 'var(--cor-texto-suave)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {filtroAtivo.mostrarArquivados ? 'Restaurar' : 'Arquivar'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {temMais && (
              <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => buscarClientes(paginaAtual + 1, false, filtroAtivo)}
                  disabled={carregandoMais}
                  className={styles.btn}
                  style={{ fontSize: 13 }}
                >
                  {carregandoMais ? 'Carregando…' : `Carregar mais (${total - lista.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </AppLayout>
  )
}

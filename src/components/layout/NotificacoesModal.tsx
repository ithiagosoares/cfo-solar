'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock, CalendarClock, Calendar, AlertCircle, Info, ExternalLink } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import styles from '@/styles/editorial.module.css'
import type { AlertaItem, NivelAlerta, TipoAlerta } from '@/lib/alertas'
import ModalRegistrarAtividade from '@/components/clientes/hub/ModalRegistrarAtividade'
import ModalAgendarAtividade from '@/components/clientes/hub/ModalAgendarAtividade'
import type { AtividadeComNome } from '@/components/clientes/hub/AtividadeCard'

interface NotificacoesModalProps {
  aberto: boolean
  onFechar: () => void
  alertas: AlertaItem[]
  carregando: boolean
  ehGestor: boolean
  onRecarregar: () => void
}

const NIVEL_CONFIG: Record<NivelAlerta, { fg: string; bg: string; label: string; Icon: typeof AlertTriangle }> = {
  critico: { fg: '#ef4444', bg: '#FEE2E2', label: 'Crítico', Icon: AlertTriangle },
  aviso:   { fg: '#f97316', bg: '#FFEDD5', label: 'Aviso',   Icon: AlertCircle },
  info:    { fg: '#eab308', bg: '#FEF9C3', label: 'Info',    Icon: Info },
}

const TIPO_ICON: Record<TipoAlerta, typeof AlertTriangle> = {
  atividade_atrasada: AlertTriangle,
  atividade_hoje: Clock,
  atividade_amanha: CalendarClock,
  atividade_semana: Calendar,
  cliente_esfriando: AlertCircle,
  sem_atividade: Info,
}

const TIPO_LABEL: Record<TipoAlerta, string> = {
  atividade_atrasada: 'Atrasado',
  atividade_hoje: 'Hoje',
  atividade_amanha: 'Amanhã',
  atividade_semana: 'Esta Semana',
  cliente_esfriando: 'Cliente Esfriando',
  sem_atividade: 'Sem Atividade Recente',
}

const TIPO_ACAO_LABEL: Record<TipoAlerta, string> = {
  atividade_atrasada: 'Marcar Realizado',
  atividade_hoje: 'Realizar Agora',
  atividade_amanha: 'Confirmar',
  atividade_semana: 'Acompanhar',
  cliente_esfriando: 'Registrar Contato',
  sem_atividade: 'Agendar Visita',
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

type FiltroNivel = 'todos' | 'critico' | 'aviso'

// Placeholder mínimo satisfazendo AtividadeComNome — o modal em modo "concluir"
// só lê .id e .tipo (ver ModalRegistrarAtividade.tsx), o resto nunca é exibido.
function atividadeParaConcluirPlaceholder(alerta: AlertaItem): AtividadeComNome {
  return {
    id: alerta.atividadeId ?? '',
    clienteCnpj: alerta.clienteCnpj,
    tipo: alerta.atividadeTipo ?? 'Outro',
    resultado: null,
    dataRealizado: null,
    dataAgendada: alerta.data,
    notas: null,
    usuarioId: '',
    criadoEm: '',
    atualizadoEm: '',
    arquivado: false,
    arquivadoEm: null,
    nomeUsuario: '',
  }
}

export function NotificacoesModal({ aberto, onFechar, alertas, carregando, ehGestor, onRecarregar }: NotificacoesModalProps) {
  const router = useRouter()
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>('todos')
  const [filtroVendedor, setFiltroVendedor] = useState('')

  const [contatoAlvo, setContatoAlvo] = useState<AlertaItem | null>(null)
  const [agendarAlvo, setAgendarAlvo] = useState<AlertaItem | null>(null)
  const [concluirAlvo, setConcluirAlvo] = useState<AlertaItem | null>(null)

  const vendedoresPresentes = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const a of alertas) {
      if (a.vendedorId) mapa.set(a.vendedorId, a.vendedorNome ?? a.vendedorId)
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [alertas])

  const alertasFiltrados = useMemo(() => {
    return alertas.filter(a => {
      if (filtroNivel === 'critico' && a.nivel !== 'critico') return false
      if (filtroNivel === 'aviso' && a.nivel === 'critico') return false
      if (filtroVendedor && a.vendedorId !== filtroVendedor) return false
      return true
    })
  }, [alertas, filtroNivel, filtroVendedor])

  const totalCriticos = alertas.filter(a => a.nivel === 'critico').length

  function irParaCliente(cnpj: string) {
    onFechar()
    router.push(`/clientes/${cnpj}`)
  }

  function handleAcaoRapida(alerta: AlertaItem) {
    // As 4 categorias de atividade agendada (atrasada/hoje/amanhã/semana)
    // sempre concluem a mesma atividade pendente — só o rótulo do botão muda.
    if (alerta.tipo === 'cliente_esfriando') setContatoAlvo(alerta)
    else if (alerta.tipo === 'sem_atividade') setAgendarAlvo(alerta)
    else setConcluirAlvo(alerta)
  }

  function handleSalvo() {
    setContatoAlvo(null)
    setAgendarAlvo(null)
    setConcluirAlvo(null)
    onRecarregar()
  }

  return (
    <>
      <Modal aberto={aberto} onFechar={onFechar} titulo="Notificações" largura={640}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['todos', 'critico', 'aviso'] as FiltroNivel[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltroNivel(f)}
                className={styles.btn}
                style={{
                  padding: '6px 14px',
                  fontSize: 12.5,
                  ...(filtroNivel === f
                    ? { background: 'var(--cor-destaque)', color: '#fff', borderColor: 'var(--cor-destaque)' }
                    : {}),
                }}
              >
                {f === 'todos' ? 'Tudo' : f === 'critico' ? 'Críticos' : 'Avisos'}
              </button>
            ))}
          </div>

          {ehGestor && vendedoresPresentes.length > 0 && (
            <select
              value={filtroVendedor}
              onChange={e => setFiltroVendedor(e.target.value)}
              className={styles.select}
              style={{ maxWidth: 200 }}
            >
              <option value="">Vendedor: Todos</option>
              {vendedoresPresentes.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          )}

          {totalCriticos > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink3)' }}>
              {totalCriticos} crítico{totalCriticos > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {carregando ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Carregando alertas…</p>
        ) : alertasFiltrados.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>Nenhum alerta no momento.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alertasFiltrados.map(alerta => {
              const nivelCfg = NIVEL_CONFIG[alerta.nivel]
              const Icon = TIPO_ICON[alerta.tipo]
              return (
                <div
                  key={alerta.id}
                  className={styles.panel}
                  style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, background: nivelCfg.bg, color: nivelCfg.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon style={{ width: 16, height: 16 }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: nivelCfg.fg }}>
                        {TIPO_LABEL[alerta.tipo]}
                      </span>
                      <span style={{ fontSize: 13.5, color: 'var(--ink2)' }}>— {alerta.razaoSocial}</span>
                      {alerta.data && (
                        <span className={styles.num} style={{ fontSize: 11.5, color: 'var(--ink3)', marginLeft: 'auto' }}>
                          {fmtData(alerta.data)}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 3 }}>{alerta.mensagem}</div>

                    {ehGestor && alerta.vendedorNome && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>Vendedor: {alerta.vendedorNome}</div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => irParaCliente(alerta.clienteCnpj)}
                        className={styles.btn}
                        style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ExternalLink style={{ width: 12, height: 12 }} />
                        Ir pra Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcaoRapida(alerta)}
                        className={styles.btnPrimary}
                        style={{ padding: '5px 12px', fontSize: 12 }}
                      >
                        {TIPO_ACAO_LABEL[alerta.tipo]}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      <ModalRegistrarAtividade
        aberto={contatoAlvo !== null || concluirAlvo !== null}
        cnpj={(contatoAlvo ?? concluirAlvo)?.clienteCnpj ?? ''}
        atividadeParaConcluir={concluirAlvo ? atividadeParaConcluirPlaceholder(concluirAlvo) : null}
        onFechar={() => { setContatoAlvo(null); setConcluirAlvo(null) }}
        onSalvo={handleSalvo}
      />
      <ModalAgendarAtividade
        aberto={agendarAlvo !== null}
        cnpj={agendarAlvo?.clienteCnpj ?? ''}
        onFechar={() => setAgendarAlvo(null)}
        onSalvo={handleSalvo}
      />
    </>
  )
}

export default NotificacoesModal

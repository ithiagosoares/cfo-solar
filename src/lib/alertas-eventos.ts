// Bus mínimo em `window` pra avisar a Sidebar que os alertas podem ter mudado.
// Necessário porque ModalRegistrarAtividade/ModalAgendarAtividade são usados
// tanto de dentro da NotificacoesModal (que já tem onRecarregar) quanto direto
// da página de detalhe do cliente (clientes/[cnpj]/page.tsx), que não tem
// nenhuma referência ao estado de alertas da Sidebar.

const EVENTO_ALERTAS_ATUALIZAR = 'alertas:atualizar'

// DEBUG temporário — contador de listeners ativos, só pra confirmar no console
// que o Sidebar de fato registrou um listener antes do dispatch acontecer.
let listenersAtivos = 0

export function notificarAtividadeSalva(): void {
  console.log('[alertas-eventos] notificarAtividadeSalva() chamada — listenersAtivos:', listenersAtivos)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENTO_ALERTAS_ATUALIZAR))
    console.log('[alertas-eventos] Notificando atividade salva — evento despachado em window')
  } else {
    console.log('[alertas-eventos] window indefinido (SSR?) — evento NÃO despachado')
  }
}

export function ouvirAtividadeSalva(callback: () => void): () => void {
  listenersAtivos++
  console.log('[alertas-eventos] Listener registrado — total agora:', listenersAtivos)
  window.addEventListener(EVENTO_ALERTAS_ATUALIZAR, callback)
  return () => {
    listenersAtivos--
    console.log('[alertas-eventos] Listener removido — total agora:', listenersAtivos)
    window.removeEventListener(EVENTO_ALERTAS_ATUALIZAR, callback)
  }
}

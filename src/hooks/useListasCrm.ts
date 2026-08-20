'use client'

import { useEffect, useState, useCallback } from 'react'

export interface ListaCrm {
  id: string
  nome: string
  cor: string
  posicao: number
  arquivado: boolean
}

// Busca as listas do Kanban de Clientes (fonte única para o board e para o
// filtro/coluna "Lista" da tabela de clientes). `recarregar` permite atualizar
// depois de criar/renomear/arquivar uma lista.
export function useListasCrm() {
  const [listas, setListas] = useState<ListaCrm[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/crm-listas')
      const json = await res.json() as { ok: boolean; listas?: ListaCrm[] }
      if (json.ok) setListas(json.listas ?? [])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void carregar() }, [carregar]) // eslint-disable-line react-hooks/set-state-in-effect

  return { listas, carregando, recarregar: carregar }
}

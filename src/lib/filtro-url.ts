'use client'

// Compartilhado pelas 3 páginas de listagem com filtro (/orcamentos, /clientes,
// /vendas) — ler o estado de filtro da URL ao montar (link compartilhável) e
// escrever de volta a cada mudança. Cada página mantém seu próprio formato de
// Filtros; aqui só fica a parte genérica de ler/escrever query string — ver
// CLAUDE.md, seção 7, regra 4 (nunca duplicar lógica em duas telas).

import { useEffect } from 'react'

export function lerFiltrosDaUrl(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

// Lê um parâmetro separado por vírgula da URL (usado pelos filtros multi-select).
export function paramArray(params: URLSearchParams, chave: string): string[] {
  const bruto = params.get(chave)
  return bruto ? bruto.split(',').filter(Boolean) : []
}

// Escreve os filtros ativos na URL sempre que mudarem, sem adicionar entrada
// no histórico (replaceState) — não interfere no botão "voltar" do navegador.
export function useFiltrosNaUrl<T>(filtroAtivo: T, paraQueryString: (f: T) => URLSearchParams): void {
  useEffect(() => {
    const qs = paraQueryString(filtroAtivo).toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAtivo])
}

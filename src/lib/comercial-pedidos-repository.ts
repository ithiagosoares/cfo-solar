// Server-only — usa supabaseAdmin (service_role key). Nunca importar de 'use client'.

import { supabaseAdmin } from './supabase-admin'
import type { RegistroPreview } from './comercial-importacoes-repository'

const TABELA = 'comercial_pedidos'

// Insere múltiplos registros de uma importação em comercial_pedidos.
// mapeamentoVendedores: nome_original_no_relatorio -> vendedor_id resolvido pelo usuário.
// Se o registro já tem vendedorId (reconhecido automaticamente), o mapeamento é ignorado.
export async function inserirPedidosImportacao(
  registros: RegistroPreview[],
  importacaoId: string,
  mapeamentoVendedores: Record<string, string>,
): Promise<void> {
  if (registros.length === 0) return

  const rows = registros.map(r => ({
    vendedor_id:     r.vendedorId ?? mapeamentoVendedores[r.vendedorNome] ?? null,
    empresa:         r.empresa,
    filial:          r.filial,
    cliente:         r.cliente,
    valor_orcado:    r.valorOrcado,
    data_orcamento:  r.dataOrcamento || null,
    status:          r.status,
    valor_vendido:   r.valorVendido,
    data_venda:      r.dataVenda || null,
    origem:          'upload_estruturado' as const,
    importacao_id:   importacaoId,
  }))

  const { error } = await supabaseAdmin.from(TABELA).insert(rows)

  if (error) {
    console.error('[comercial-pedidos-repository] inserirPedidosImportacao erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao inserir pedidos: ${error.message}`)
  }
}

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
    numero_pedido:   r.numeroOrcamento || null,
    origem:          'upload_estruturado' as const,
    importacao_id:   importacaoId,
  }))

  const semNumeroPedido = rows.filter(r => r.numero_pedido === null)
  if (semNumeroPedido.length > 0) {
    console.warn(
      `[comercial-pedidos-repository] ${semNumeroPedido.length} registro(s) sem numero_pedido — ` +
      `não protegidos pela constraint uniq_pedido_empresa. Clientes: ${semNumeroPedido.map(r => r.cliente).join(', ')}`,
    )
  }

  // upsert: se (numero_pedido, empresa) já existe, atualiza os campos com os dados
  // mais recentes em vez de inserir duplicata. Registros com numero_pedido = null
  // não conflitam (NULL ≠ NULL no Postgres) e continuam sendo inseridos normalmente.
  const { error } = await supabaseAdmin
    .from(TABELA)
    .upsert(rows, { onConflict: 'numero_pedido,empresa' })

  if (error) {
    console.error('[comercial-pedidos-repository] inserirPedidosImportacao erro:', JSON.stringify(error, null, 2))
    throw new Error(`Falha ao inserir pedidos: ${error.message}`)
  }
}

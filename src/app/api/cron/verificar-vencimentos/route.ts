// Job de vencimentos — disparado diariamente pela Vercel (ver vercel.json).
// A Vercel injeta automaticamente o header Authorization: Bearer <CRON_SECRET>
// nos disparos nativos. Para teste manual em dev:
//   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/verificar-vencimentos

import { supabaseAdmin } from '@/lib/supabase-admin'
import { buscarUltimaAtividade, liberarClienteVencido } from '@/lib/clientes-repository'

interface ClienteVencidoRow {
  cnpj: string
  data_atribuicao: string | null
  data_vencimento: string | null
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
  }

  const hoje = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const { data: vencidos, error } = await supabaseAdmin
    .from('clientes')
    .select('cnpj, data_atribuicao, data_vencimento')
    .eq('status', 'atribuido')
    .lt('data_vencimento', hoje)

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const candidatos = (vencidos ?? []) as ClienteVencidoRow[]
  const cnpjsLiberados: string[] = []
  const erros: { cnpj: string; erro: string }[] = []

  for (const cliente of candidatos) {
    try {
      const ultimaAtividade = await buscarUltimaAtividade(cliente.cnpj)

      // Liberar se não houve nenhuma atividade APÓS a atribuição ao vendedor atual.
      // Atividade anterior à atribuição indica que o cliente já existia antes do vínculo
      // e não representa trabalho gerado por esse vendedor.
      //
      // NOTA FUTURA: o vencimento atual é fixo a partir de data_atribuicao.
      // Se a regra evoluir para "3/6 meses desde a ÚLTIMA atividade", seria necessário
      // recalcular data_vencimento a cada novo pedido com cliente_cnpj preenchido,
      // via trigger em comercial_pedidos — não implementado agora.
      const atividadeAposAtribuicao =
        ultimaAtividade !== null &&
        ultimaAtividade >= (cliente.data_atribuicao ?? hoje)

      if (!atividadeAposAtribuicao) {
        await liberarClienteVencido(cliente.cnpj)
        cnpjsLiberados.push(cliente.cnpj)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      erros.push({ cnpj: cliente.cnpj, erro: msg })
    }
  }

  return Response.json({
    ok: erros.length === 0,
    verificados: candidatos.length,
    liberados: cnpjsLiberados.length,
    cnpjs: cnpjsLiberados,
    ...(erros.length > 0 && { erros }),
  })
}

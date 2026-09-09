// GET /api/comercial/upload-relatorio/ultima
//   Retorna a última importação confirmada (registros já inseridos), com o
//   nome de quem fez o upload — usado no banner "Último upload" da tela.

import { buscarUltimaImportacaoConfirmada } from '@/lib/comercial-importacoes-repository'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPapel } from '@/lib/comercial-auth'

const PAPEIS_UPLOAD = new Set(['administrador', 'gestor'])

export async function GET(request: Request) {
  const papel = getPapel(request)
  if (!papel || !PAPEIS_UPLOAD.has(papel)) {
    return Response.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const importacao = await buscarUltimaImportacaoConfirmada()
    if (!importacao) return Response.json({ ok: true, importacao: null })

    let nomeCriador = importacao.criadoPor
    if (importacao.criadoPor) {
      const { data } = await supabaseAdmin
        .from('usuarios_autorizados')
        .select('nome')
        .eq('email', importacao.criadoPor)
        .maybeSingle()
      const nome = (data as { nome: string | null } | null)?.nome
      if (nome) nomeCriador = nome
    }

    return Response.json({
      ok: true,
      importacao: {
        confirmadoEm: importacao.confirmadoEm,
        empresa: importacao.empresa,
        filial: importacao.filial,
        periodoInicio: importacao.periodoInicio,
        periodoFim: importacao.periodoFim,
        totalRegistros: importacao.totalRegistros,
        criadoPor: nomeCriador,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[/api/comercial/upload-relatorio/ultima] erro:', msg)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}

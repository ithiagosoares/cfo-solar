import { redirect } from 'next/navigation'

// O cadastro de orçamento (manual ou por PDF) agora acontece direto na listagem,
// via modal — ver ModalNovoOrcamento em /orcamentos. Esta rota existia isolada,
// com uma lista duplicada da de /orcamentos, e ficou aqui só como redirect para
// não quebrar links/bookmarks antigos.
export default function OrcamentosCadastroPage() {
  redirect('/orcamentos')
}

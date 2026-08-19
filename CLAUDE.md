# CLAUDE.md — Gestor Comercial (Grupo Solar System)

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão. Ele define quem você é neste projeto, como o sistema funciona, e as regras que NÃO podem ser quebradas. Leia por completo antes de fazer qualquer alteração.

---

## 1. O que é este projeto

**Gestor Comercial** é o sistema de gestão comercial do Grupo Solar System (empresas: Solar System Matriz, Solar System Filial PR, Level2, Ni Hao, AluMarket). Ele nasceu como parte do "CFO Solar" (que também tinha um módulo financeiro), mas o financeiro foi **desativado** — o código ainda existe no repositório, mas não é mais acessível nem mantido. Este projeto agora é 100% comercial: gestão de vendedores, clientes, orçamentos e vendas.

**Objetivo do sistema:** dar aos vendedores, SDRs, gestores e administradores do grupo uma visão confiável e auditável do funil comercial — clientes, orçamentos, vendas — alimentada por relatórios reais do ERP da empresa (SSG, gerado por FastReport), sem depender de planilhas soltas ou WhatsApp.

**Documentos de referência complementares** (buscar no histórico de conversas do usuário se precisar de mais detalhe):
- `HANDOFF-projeto-financeiro.md` — regras e dados do módulo financeiro (desativado, histórico)
- `HANDOFF-dados-comerciais.md` — schema, vendedores, faturamento validado, lições de parsing
- `NORTH-STAR-visao-ia-comercial.md` — visão de produto de longo prazo (CRM com IA, score, chat) — **não é o escopo atual**, é referência estratégica futura. Não implemente nada dessa visão sem confirmação explícita do usuário.

---

## 2. Stack técnico

- **Frontend:** Next.js (App Router, Turbopack), React, TypeScript, Tailwind CSS
- **Backend/Dados:** Supabase (PostgreSQL + Auth + RLS)
- **Hospedagem:** Vercel (deploy + Vercel Cron para jobs agendados)
- **Email transacional:** Resend (domínio próprio verificado)
- **Parsing de relatórios:** Cheerio (parsing determinístico de HTML — **nunca IA** para extração de dados)
- **Ícones:** lucide-react

**Identidade visual:** tipografia EB Garamond (títulos) + IBM Plex Sans (interface) + IBM Plex Mono (números). Paleta clara, âmbar (`--cor-destaque`) para ações, azul-petróleo (`--cor-informativo`) para dado neutro. Verde/âmbar/vermelho para status semânticos (sucesso/atenção/risco).

---

## 3. Papéis de acesso

| Papel | Acesso |
|---|---|
| `administrador` | Tudo, incluindo gestão de usuários e vendedores |
| `gestor` | Tudo, exceto administração de usuários |
| `sdr` | Cadastro de clientes (só os que ele mesmo cadastrou) |
| `vendedor` | Dashboard, Orçamentos, Vendas, Cadastro de Cliente — sempre restrito à própria carteira |
| `sem_acesso` | Bloqueado, redireciona para `/acesso-negado` |

**Regra de segurança inviolável:** toda rota de API deve validar o papel do usuário (via header injetado pelo proxy) e, quando o papel for `vendedor`, **nunca aceitar filtro de vendedor_id vindo da query/body da requisição** — sempre forçar o vendedor_id do próprio usuário autenticado no backend. Já tivemos brechas assim antes.

---

## 4. Schema principal (tabelas-chave)

- `vendedores` — nome (chave de matching com relatórios do ERP, deve ser EXATO), ativo
- `clientes` — CNPJ como chave primária, tipo (distribuidora/integrador), origem, vendedor_id (nullable), data_vencimento (calculada automaticamente: +3 meses integrador / +6 meses distribuidor), status_crm (com cores), campos de CRM (ultimo_contato, proxima_acao, observacoes), arquivado (soft delete)
- `comercial_pedidos` — orçamentos/vendas individuais, vinculados a vendedor_id, numero_pedido (chave de deduplicação junto com empresa), status técnico (orçado/vendido — **nunca editar à mão, vem do ERP**), status_funil (editável, funil comercial), status_pos_venda (editável, pós-venda leve), arquivado (soft delete)
- `comercial_importacoes` — log de cada upload de relatório
- `vendedores_totais_oficiais` — totais oficiais por vendedor/filial/período/fonte, vindos dos relatórios de resumo do ERP (não dos pedidos individuais) — **fonte de verdade** para os valores exibidos no Dashboard e em Vendas
- `usuarios_autorizados` — papel, vendedor_id (quando papel=vendedor)

---

## 5. Regras de negócio que não podem ser quebradas

1. **`comercial_pedidos.status` (orçado/vendido) é dado do ERP, não é editável pelo usuário.** Reflete o que o relatório de orçamento disse. Nunca confundir com `status_funil` ou `status_pos_venda`, que são camadas de acompanhamento comercial por cima, editáveis livremente.

2. **Nem todo orçamento fechado no ERP corresponde a uma venda real, e vice-versa.** Existe divergência conhecida entre "orçamento marcado fechado" (dado de `comercial_pedidos`) e "venda faturada" (dado de `vendedores_totais_oficiais`, vindo de relatórios de Rentabilidade/Total de Venda). Isso é comportamento esperado do ERP da empresa, não bug — alguns vendedores (ex: Matheus) têm vendas reais sem orçamento formal correspondente. Nesses casos, o total exibido deve vir de `vendedores_totais_oficiais` (com selo "✓ oficial"), não da soma de `comercial_pedidos`.

3. **Total de um vendedor sempre soma TODAS as filiais (São Paulo + Paraná).** Nunca mostrar só uma filial isolada como se fosse o total. A lógica de agregação correta é: agrupar por (vendedor, filial, fonte) → escolher UMA fonte por filial de forma determinística (nunca por timestamp/ordem de criação, sempre por prioridade fixa: `rentabilidade_vendedor` antes de `total_venda_vendedor`) → somar entre filiais.

4. **Períodos oficiais podem se sobrepor por reimportação (ex: um relatório termina em 30, outro em 31 do mesmo mês).** Antes de somar registros de `vendedores_totais_oficiais`, verificar sobreposição de período dentro do mesmo grupo (vendedor+filial+fonte) e usar só o mais recente entre sobrepostos — nunca somar duas vezes o mesmo dado.

5. **Exclusão é sempre suave (soft delete).** Nunca fazer `DELETE` de cliente ou orçamento por ação do usuário — sempre marcar `arquivado = true`. Arquivar não deve afetar totais históricos/financeiros já calculados.

6. **CNPJ é chave única de cliente.** Se um vendedor tenta cadastrar um CNPJ já atribuído a outro vendedor ativo, bloquear com mensagem clara (nome do responsável + data de vencimento). Se o CNPJ existe mas está sem vendedor (em fila ou liberado por vencimento), o cadastro deve **assumir** esse cliente para o novo vendedor, não tentar criar duplicata.

---

## 6. Lições de parsing de relatório do ERP (SSG / FastReport)

- **Sempre usar HTML, nunca PDF.** PDF corrompe texto em quebras de página (linhas de vendedores diferentes se misturam). HTML preserva a estrutura de tabela.
- **Identificar tipo de relatório por TEXTO do título, nunca por classe CSS.** O FastReport renumera classes CSS dinamicamente conforme quantos estilos o documento tem (ex: relatórios com logo têm uma coluna a mais que desloca a numeração). Buscar o texto literal do título (`"Relatório de pedidos de orçamento"`, `"Total de venda, margem de contribuição e lucro por vendedor"`, etc.) em qualquer célula, nunca `td.s3` ou `td.s4`.
- **Resolver colunas pelo nome do cabeçalho real, nunca por posição/índice fixo.** A mesma coluna pode aparecer em posições diferentes em relatórios de filiais diferentes (ex: coluna "Classificação" trocada com "Descrição" entre abas).
- **O "Relatório de pedidos de orçamento" tem estrutura AGRUPADA** (seções por `"Nome do vendedor: X"`, com subtotal por vendedor) — não é uma tabela plana de cabeçalho→linhas→total como os relatórios de resumo. Um parser genérico de "cabeçalho + linhas até Totais:" não funciona nele.
- **Sempre confirmar que o relatório foi exportado com agrupamento por vendedor** — sem isso, o arquivo não tem nenhuma menção a "vendedor" e o parser não encontra nada.

---

## 7. Padrão de investigação de bugs (siga sempre)

1. Se a causa não é óbvia, **investigue antes de corrigir** — reporte dados brutos (query SQL, log), não aplique correção às cegas.
2. Se um bug "não devia estar acontecendo", **adicione log temporário** mostrando os valores brutos exatos, antes de tentar mais uma correção especulativa.
3. Se uma correção não teve efeito nenhum, **suspeite primeiro de deploy não concluído** (verificar hash do commit no Vercel) antes de assumir que o código está errado.
4. **Nunca duplique lógica de cálculo em duas telas.** Se duas telas fazem a mesma conta, extraia uma função compartilhada.
5. Todo teste de correção precisa de um **valor esperado concreto** (ex: "Débora deve mostrar R$ 191.602,67"), nunca "deve estar correto".

---

## 8. Segurança (não negociável)

- `SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY` (se algum dia usada) **nunca** em componente `'use client'` — só em route handlers/server-side.
- Toda tabela nova precisa de RLS habilitado com política `using (false)` (bloqueia anon/authenticated, não afeta service_role) **e** os `GRANT` explícitos (`GRANT ALL ... TO service_role`) — já tivemos "permission denied" por esquecer isso.
- SQL de migration sempre em bloco separado, para ser rodado manualmente no Supabase — nunca assumir que uma coluna existe sem confirmar.

---

## 9. O que este sistema explicitamente NÃO faz (por decisão, não por limitação)

- Não usa IA para extrair, classificar ou calcular dados — tudo é código determinístico.
- Não tem módulo de produção/logística/pós-venda completo (só um campo leve de `status_pos_venda` para follow-up).
- Não tem Score IA, chat comercial, ou motor de recomendação (visão futura, documentada em `NORTH-STAR-visao-ia-comercial.md`, fora do escopo atual).
- Não integra com Mercado Livre ainda (pausado, sem credencial).
- Não dá login individual para vendedores fazerem tudo sozinhos sem supervisão de admin/gestor além do que já está definido nos 4 papéis.

---

## 10. Antes de qualquer prompt grande

Se a tarefa pedida parecer se sobrepor à visão do `NORTH-STAR-visao-ia-comercial.md` (Score IA, chat, pós-venda completo, matching automático de cliente, etc.), **pare e confirme com o usuário** se isso deve mesmo entrar agora ou se é para depois — não expanda escopo por conta própria.
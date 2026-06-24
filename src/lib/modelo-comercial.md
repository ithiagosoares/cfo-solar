# MODELO COMERCIAL — GRUPO SOLAR SYSTEM

## Funil de Vendas
O funil comercial do grupo segue 3 estágios:
Orçamento → Pedido (venda) → Faturamento

- Orçamento: proposta enviada ao cliente, ainda não confirmada
- Pedido: orçamento aceito pelo cliente, venda confirmada
- Faturamento: nota fiscal emitida referente ao pedido (pode ocorrer em data
  posterior à venda, conforme prazo de produção/entrega)

## Equipe Comercial (Vendedores)
Ingrid, Matheus, Débora, Pedro, Genival, Arhur e Peixoto

## Indicadores do Funil
Para cada vendedor, os indicadores relevantes são:
- Orçado: soma de orçamentos emitidos no período
- Vendido: soma de pedidos confirmados no período
- Conversão %: Vendido / Orçado
- Ticket médio: Vendido / quantidade de pedidos
- Prazo médio: tempo médio entre orçamento e pedido confirmado

Para cada cliente:
- Quantidade de orçamentos recebidos
- Quantidade de compras efetivadas
- Volume total comprado
- Tempo desde a última compra

Por região (SP, PR, RJ, MG e outras conforme dados disponíveis):
- Volume de vendas
- Número de clientes ativos

## Perguntas estratégicas que este modelo deve responder quando os dados
estiverem disponíveis
- Quais clientes receberam orçamento acima de determinado valor e não
  compraram em um período (clientes "perdidos" ou "em risco")
- Quanto da carteira de um mês está em clientes recorrentes vs novos
- Qual vendedor converte melhor pedidos de alto valor
- Quais clientes reduziram frequência de compra (possível migração para
  concorrência)
- Quanto falta faturar no mês para atingir a meta, considerando o pipeline
  de orçamentos em aberto

## Relação com o Financeiro
O funil comercial se conecta ao financeiro da seguinte forma:
- Um Pedido confirmado gera expectativa de entrada de caixa, mas a entrada
  real (financeiro) só ocorre no Faturamento + prazo de pagamento do cliente
- Por isso pode haver defasagem entre "vendas do mês" (comercial) e
  "faturamento do mês" (financeiro) — já observado no histórico do grupo:
  Maio/2026 teve R$1.022.107 vendido mas apenas R$729.357 faturado
- A meta de R$2.000.000/mês (jun-dez/2026) é medida pelo valor vendido, não
  pelo faturado

## Status: dados ainda não integrados
Este documento descreve o MODELO de como o funil comercial funciona. Os dados
reais de Orçamentos e Pedidos por vendedor/cliente/região ainda não estão
conectados ao sistema (integração futura com o sistema Upper). Quando esses
dados existirem, a IA deve aplicar esses conceitos para gerar análises de
conversão, ticket médio e risco de churn de cliente.

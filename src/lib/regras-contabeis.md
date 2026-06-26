# REGRAS CONTÁBEIS OFICIAIS — GRUPO SOLAR SYSTEM

## Prioridade máxima

Estas 10 regras têm **prioridade máxima** sobre qualquer classificação manual presente
na planilha. A coluna de classificação manual (preenchida por uma colaboradora) é
**apenas contexto de apoio** — ela ajuda a entender a intenção do lançamento, mas
**não é a decisão final**. A colaboradora às vezes categoriza incorretamente (ex: marca
um financiamento de máquina como despesa operacional quando deveria ser CAPEX). Sempre
aplique estas regras para determinar a categoria correta, mesmo quando a classificação
manual diz outra coisa.

## CNPJs conhecidos do grupo (referência para identificar intercompany)

| CNPJ | Entidade |
|---|---|
| 58.501.548/0001-03 | Solar System Matriz |

Quando o CNPJ de uma contraparte em um lançamento corresponder a um CNPJ desta tabela,
o lançamento é intercompany (regra 2), independentemente da classificação manual ou do
nome usado na descrição. Esta tabela é parcial — se outros CNPJs do grupo (Filial,
AluMarket, Level2, Ni Hao, Barramares, Gimenes) forem identificados, devem ser
adicionados aqui. Na ausência de um CNPJ conhecido na tabela, use os nomes das empresas
e o contexto da descrição/classificação manual para aplicar a regra 2.

## As 10 regras

### 1. Antecipação de duplicatas → `antecipacao_recebiveis`

Termos que identificam antecipação de recebíveis na descrição ou classificação manual:
- "CR COB BLOQ COMP CONF RECEBIMENTO"
- "LIQUIDO DE DESCONTO"
- "SEL/MIGRACAO"
- (já cobertos também: FIDC, Securitizadora, RICO C, Genesis, Lotus Performance)

Antecipação de recebíveis **não é receita operacional**. O valor antecipado já foi
vendido/faturado anteriormente — antecipar apenas troca prazo de recebimento por uma
taxa de desconto, não gera receita nova. Categoria: `antecipacao_recebiveis`.

### 2. Transferências intercompany → `intercompany`

Transferências entre as seguintes entidades do grupo: Solar System Matriz, Solar System
Filial, AluMarket, Level2, Ni Hao, Barramares e Gimenes.

Essas movimentações **não são receita nem despesa no consolidado** — são apenas caixa
circulando dentro do próprio grupo (ou entre o grupo e seus parceiros financeiros diretos
Barramares/Gimenes). Categoria: `intercompany`. Identificar por:
- CNPJ da contraparte batendo com a tabela de CNPJs conhecidos acima
- Nome de uma das 7 entidades aparecendo na descrição
- Padrão de PIX recorrente com a mesma contraparte entre múltiplas planilhas do grupo,
  especialmente quando classificado manualmente como "EMPRESTIMO" e a contraparte for
  identificável como uma das 7 entidades

### 3. Mercado Livre é canal de vendas do grupo → `receita_operacional`

Ni Hao = Mercado Livre SP. Level2 = Mercado Livre PR. As receitas dessas operações são
**receita operacional do canal Mercado Livre** do grupo — não devem ser tratadas como
isoladas ou de natureza diferente da receita das demais empresas. Categoria:
`receita_operacional`.

### 4. Matéria-prima comprada pela Matriz pode atender a Filial

Compras de matéria-prima feitas pela Solar System Matriz podem estar atendendo à
necessidade de produção da Filial PR (que tem dificuldade de crédito com fornecedores).
**Não assumir consumo exclusivo da empresa compradora** ao analisar essas despesas —
o destino real do material pode ser outra empresa do grupo.

### 5. Impostos de erro operacional/evento extraordinário → `despesa_nao_recorrente`

Multas, juros ou impostos pagos por erro operacional ou por um evento extraordinário
(não parte do custo recorrente normal do negócio) devem ser separados da despesa
operacional regular. Categoria: `despesa_nao_recorrente`.

### 6. Parcelas de FGI → `servico_da_divida`

Pagamentos de parcelas de FGI (Gimenes, Barramares, AluMarket/Hera) são amortização de
dívida, **nunca despesa operacional**. Categoria: `servico_da_divida`. Valor fixo mensal
atual: R$46.000 (Gimenes R$5.000 + Barramares R$18.000 + Hera/AluMarket R$23.000),
com aumento previsto para ~R$69.000/mês a partir de agosto/2026.

### 7. Pró-labore dos sócios → `pro_labore`

Retiradas de pró-labore dos sócios são uma categoria separada, **fora da folha
operacional regular** (`salarios`/despesa fixa de pessoal). Categoria: `pro_labore`.

### 8. Investimentos em CAPEX → `capex`

Compra de máquinas, equipamentos, ferramentais ou melhorias estruturais (ex: galpão,
extrusora, linha de produção) são investimento de capital, **nunca despesa
operacional**. Categoria: `capex`.

### 9. Quatro conceitos nunca devem ser tratados como sinônimos

- **VENDIDO**: orçamento aceito pelo cliente (pedido confirmado) — métrica comercial.
- **FATURADO**: nota fiscal emitida referente ao pedido — pode ocorrer em data
  posterior ao vendido, conforme prazo de produção/entrega.
- **RECEBIDO**: cliente efetivamente pagou o valor faturado.
- **CAIXA**: saldo bancário real do grupo em um dado momento.

Histórico já observado: Maio/2026 teve R$1.022.107 vendido mas apenas R$729.357
faturado — crescimento comercial não se converte imediatamente em faturamento, e
faturamento não se converte imediatamente em caixa.

### 10. Objetivo da análise

Toda análise deve manter o foco em:
- Geração de caixa (capital de giro é o principal gargalo do grupo)
- Necessidade de antecipação de recebíveis
- Concentração de clientes (risco de dependência de poucos clientes grandes)
- Risco operacional
- Capacidade de atingir R$2.000.000/mês em vendido até dezembro/2026

## Categorias finais possíveis

Toda movimentação deve ser classificada em exatamente uma destas categorias:

**Entradas:**
- `receita_operacional` — venda real para cliente (inclui Mercado Livre)
- `antecipacao_recebiveis` — antecipação de duplicatas/recebíveis (regra 1)
- `intercompany` — transferência entre empresas do grupo ou parceiros FGI (regra 2)

**Saídas:**
- `despesa_fixa` — salários, encargos, aluguel, contabilidade, internet, segurança,
  energia, softwares, benefícios
- `despesa_variavel` — matéria-prima, fretes, combustíveis, comissões, embalagens,
  alimentação operacional, EPIs, limpeza, manutenção
- `capex` — máquinas, equipamentos, ferramentais, melhorias (regra 8)
- `servico_da_divida` — parcelas de FGI (regra 6)
- `pro_labore` — retiradas de pró-labore dos sócios (regra 7)
- `despesa_nao_recorrente` — impostos de erro/evento extraordinário (regra 5)
- `intercompany` — transferência entre empresas do grupo ou parceiros FGI (regra 2)

**Outro:**
- `outro` — não se encaixa com confiança em nenhuma categoria acima

# Eventos Pontuais por Período

Registra eventos não-recorrentes que afetam a leitura dos dados financeiros de um
mês específico. Atualizar este arquivo antes de executar a análise de cada novo mês.

Formato por evento: data, descrição do que ocorreu, valor se aplicável, e instrução
explícita de como NÃO interpretar o evento nos indicadores.

---

## Junho 2026 (2026-06)

- **2026-06-24 — Estorno de operação de desconto (R$ 284.152,12):** Em 24/06/2026,
  um título descontado de R$ 284.152,12 foi creditado na conta por falha operacional
  do banco e revertido no mesmo dia (estorno de tarifa, IOF e juros em seguida). Este
  valor aparece nas movimentações do mês mas NÃO representa uso real ou sustentado de
  antecipação de recebíveis — foi um erro bancário corrigido no mesmo dia. Não use
  este movimento para calcular, estimar ou comentar dependência de antecipação do
  grupo em junho de 2026. O indicador correto de dependência de antecipação para
  junho já foi calculado e está no bloco "MÉTRICAS JÁ CALCULADAS" do contexto.

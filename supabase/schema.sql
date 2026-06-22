create table relatorios_mensais (
  id uuid primary key default gen_random_uuid(),
  periodo text not null unique, -- formato "2026-05"
  faturamento_vendido numeric not null,
  faturamento_faturado numeric not null,
  total_entradas numeric not null,
  total_saidas numeric not null,
  saldo_grupo numeric not null,
  dados_completos jsonb not null, -- DadosAgregados inteiro (empresas, despesas por categoria, clientes, etc.)
  analise jsonb not null, -- AnaliseIA inteira (resumoExecutivo, alertas, recomendacoes)
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create index idx_relatorios_periodo on relatorios_mensais(periodo);

-- Run this if you get "permission denied for table relatorios_mensais" even with
-- the service_role key — some projects don't auto-propagate default privileges
-- to service_role for tables created via the SQL editor.
grant select, insert, update, delete on relatorios_mensais to service_role;
grant usage, select on all sequences in schema public to service_role;

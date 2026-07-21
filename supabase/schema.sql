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

-- ─── lancamentos_overrides — adicionado 2026-07-13 ────────────────────────

create table lancamentos_overrides (
  id uuid primary key default gen_random_uuid(),
  periodo text not null,              -- ex: '2026-06'
  empresa text,
  data_lancamento date not null,
  descricao_original text not null,
  valor numeric not null,
  categoria_original text,
  categoria_corrigida text not null,
  natureza_corrigida text,            -- capex | opex | financeiro | pessoal
  motivo text,
  criado_por text,
  created_at timestamptz default now()
);

create index idx_overrides_periodo on lancamentos_overrides(periodo);

grant select, insert, update, delete on lancamentos_overrides to service_role;

-- ─── Seed inicial — rodar manualmente no SQL Editor do Supabase ───────────
-- data_lancamento usa 2026-06-30 como placeholder (data exata não afeta matching)

/*
insert into lancamentos_overrides
  (periodo, empresa, data_lancamento, descricao_original, valor, categoria_original, categoria_corrigida, natureza_corrigida, motivo, criado_por)
values
  ('2026-06', 'AluMarket', '2026-06-30', '(verificar no extrato)', 1041.67,
   'pro_labore', 'despesa_comercial_veiculo_estrategico', 'opex',
   'Despesa de veículo comercial — reclassificada de pró-labore', 'seed'),

  ('2026-06', null, '2026-06-30', '(verificar no extrato)', 3505.50,
   null, 'Serra Cortesa', 'capex',
   'Parcela de máquina Serra Cortesa', 'seed'),

  ('2026-06', null, '2026-06-30', '(verificar no extrato)', 3208.37,
   null, 'Carregador do eletroposto', 'capex',
   'Parcela do carregador do eletroposto', 'seed'),

  ('2026-06', null, '2026-06-30', '(verificar no extrato)', 4458.29,
   'pro_labore', 'mobilidade_corporativa_byd_fernando', 'opex',
   'BYD Fernando — mobilidade corporativa reclassificada de pró-labore', 'seed'),

  ('2026-06', null, '2026-06-30', '(verificar no extrato)', 4108.82,
   'pro_labore', 'mobilidade_corporativa_tcross_matheus', 'opex',
   'T-Cross Matheus — mobilidade corporativa reclassificada de pró-labore', 'seed');
*/

-- ─── vendedores — adicionado 2026-07-14 ──────────────────────────────────────

create table vendedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz default now()
);

create index idx_vendedores_ativo on vendedores(ativo);

grant select, insert, update, delete on vendedores to service_role;

alter table vendedores enable row level security;
create policy "apenas_service_role" on vendedores using (false);

-- ─── Seed inicial — rodar manualmente no SQL Editor do Supabase ───────────

/*
insert into vendedores (nome) values
  ('Ingrid'),
  ('Matheus'),
  ('Débora'),
  ('Pedro'),
  ('Genival Peixoto'),
  ('Arthur');
*/

-- ─── comercial_pedidos — adicionado 2026-07-14 ────────────────────────────

create table comercial_pedidos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid references vendedores(id),
  empresa text,
  filial text,
  cliente text not null,
  valor_orcado numeric not null,
  data_orcamento date,
  status text not null default 'orcado' check (status in ('orcado', 'vendido')),
  valor_vendido numeric,
  data_venda date,
  origem text not null default 'manual' check (origem in ('manual', 'upload_estruturado')),
  importacao_id uuid references comercial_importacoes(id),
  created_at timestamptz default now()
);

-- Se a tabela já existir sem essas colunas, rodar:
-- alter table comercial_pedidos add column if not exists origem text not null default 'manual' check (origem in ('manual', 'upload_estruturado'));
-- alter table comercial_pedidos add column if not exists importacao_id uuid references comercial_importacoes(id);

create index idx_pedidos_vendedor on comercial_pedidos(vendedor_id);
create index idx_pedidos_status on comercial_pedidos(status);

grant select, insert, update, delete on comercial_pedidos to service_role;

alter table comercial_pedidos enable row level security;
create policy "apenas_service_role" on comercial_pedidos using (false);

-- ─── comercial_importacoes — adicionado 2026-07-15 ───────────────────────────

create table comercial_importacoes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pendente_revisao' check (status in ('pendente_revisao', 'confirmada', 'cancelada')),
  empresa text,
  filial text,
  periodo_inicio date,
  periodo_fim date,
  arquivos jsonb not null default '[]',              -- [{ nome, tipo }]
  registros_total int not null default 0,
  divergencias jsonb not null default '[]',
  vendedores_nao_reconhecidos jsonb not null default '[]',  -- [string]
  registros_preview jsonb not null default '[]',     -- registros mapeados para comercial_pedidos
  criado_por text,
  created_at timestamptz default now(),
  confirmado_at timestamptz
);

-- Se a tabela já existe com nomes antigos, rodar:
-- alter table comercial_importacoes rename column arquivos_processados to arquivos;
-- alter table comercial_importacoes rename column total_registros to registros_total;
-- alter table comercial_importacoes rename column confirmado_em to confirmado_at;
-- alter table comercial_importacoes add column if not exists registros_preview jsonb not null default '[]';
-- alter table comercial_importacoes add column if not exists periodo_inicio date;
-- alter table comercial_importacoes add column if not exists periodo_fim date;
-- alter table comercial_importacoes add column if not exists criado_por text;

grant select, insert, update, delete on comercial_importacoes to service_role;

alter table comercial_importacoes enable row level security;
create policy "apenas_service_role" on comercial_importacoes using (false);

-- ─── usuarios_autorizados — comercial_role — adicionado 2026-07-21 ─────────
-- Nível de acesso ao módulo comercial, independente do papel financeiro.
-- null   = sem acesso ao comercial (exceto admins financeiros, que são 'diretor' por derivação)
-- gestor = acesso completo ao comercial, sem ser admin financeiro
-- (diretor deriva de role='admin'; vendedor reservado para etapa futura)
--
-- Rodar no SQL Editor do Supabase:
--   alter table usuarios_autorizados
--     add column if not exists comercial_role text
--     check (comercial_role in ('gestor'));

-- ─── comercial_pedidos — numero_pedido — adicionado 2026-07-16 ──────────────
-- Armazena o número do pedido/orçamento original do ERP (ex: "998", "887"),
-- extraído da primeira coluna do relatório "Relatório de pedidos de orçamento".
-- A chave real de negócio é (numero_pedido, empresa) — único no ERP de origem.
-- O upsert no endpoint de confirmação usa esse par para deduplicar uploads sobrepostos.
--
-- Migrations a rodar no SQL Editor do Supabase (em ordem):
--
-- 1. Adicionar coluna (se ainda não existir):
--   alter table comercial_pedidos add column if not exists numero_pedido text;
--
-- 2. Diagnóstico de duplicatas ANTES de alterar a constraint
--    (rodar e aguardar limpeza manual se houver resultados):
--   select numero_pedido, empresa, count(*) as total
--   from comercial_pedidos
--   where numero_pedido is not null
--   group by numero_pedido, empresa
--   having count(*) > 1
--   order by total desc;
--
-- 3. Substituir constraint antiga pela nova após limpeza:
--   alter table comercial_pedidos drop constraint if exists uniq_pedido_importacao;
--   alter table comercial_pedidos
--     add constraint uniq_pedido_empresa unique (numero_pedido, empresa);

-- ─── investimentos_capex — adicionado 2026-07-13 ───────────────────────────

create table investimentos_capex (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  tipo_parcela text not null check (tipo_parcela in ('mensal_recorrente', 'parcelado', 'sem_parcelamento')),
  valor_parcela numeric,
  parcela_atual int,
  total_parcelas int,
  termino_previsto date,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido', 'cancelado')),
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_investimentos_status on investimentos_capex(status);

grant select, insert, update, delete on investimentos_capex to service_role;

-- ─── Seed inicial — rodar manualmente no SQL Editor do Supabase ───────────
-- (ou copiar para um script de seed separado)

/*
insert into investimentos_capex (nome, tipo_parcela, valor_parcela, termino_previsto, status) values
  ('Empilhadeira Elétrica', 'mensal_recorrente', 10000, '2027-01-31', 'em_andamento');

insert into investimentos_capex (nome, tipo_parcela, parcela_atual, total_parcelas, termino_previsto, status) values
  ('Serra Cortesa', 'parcelado', 5, 6, '2026-07-31', 'em_andamento');

insert into investimentos_capex (nome, tipo_parcela, parcela_atual, total_parcelas, termino_previsto, status) values
  ('Carregador do Eletroposto', 'parcelado', 10, 12, '2027-04-30', 'em_andamento');

insert into investimentos_capex (nome, tipo_parcela, status) values
  ('Ferramentas', 'sem_parcelamento', 'em_andamento');

insert into investimentos_capex (nome, tipo_parcela, status, observacoes) values
  ('Prensa', 'sem_parcelamento', 'em_andamento', 'Aguardando detalhamento de valor e prazo');
*/

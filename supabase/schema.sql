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

-- ─── comercial_pedidos — etapa_funil / status_venda — adicionado 2026-08-19 ─
-- etapa_funil: estágio do pedido no funil comercial (editável livremente pelo usuário).
-- status_venda: acompanhamento leve de pós-venda, só relevante quando status='vendido'.
-- Ambos os campos NÃO são o status técnico do ERP (comercial_pedidos.status) — são
-- camadas de acompanhamento comercial por cima, como status_pos_venda já era.
-- Já rodado manualmente no SQL Editor do Supabase:
--
--   alter table comercial_pedidos add column etapa_funil text default 'Novo';
--   alter table comercial_pedidos add column status_venda text default null;
--   alter table comercial_pedidos add constraint etapa_funil_check
--     check (etapa_funil in ('Novo', 'Em contato', 'Negociação', 'Aguardando decisão', 'Fechado', 'Perdido'));
--   alter table comercial_pedidos add constraint status_venda_check
--     check (status_venda is null or status_venda in (
--       'Venda Fechada', 'Faturamento Pendente', 'Aguardando emissão de NF',
--       'Faturado', 'Entregue', 'Problema Reportado', 'Pós-venda Concluído'
--     ));
--
-- Nenhum GRANT/RLS adicional necessário — as colunas novas herdam o grant a
-- service_role e a policy "apenas_service_role" já existentes na tabela.

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

-- ─── crm_listas — adicionado 2026-08-19 ────────────────────────────────────
-- Substitui o funil fixo clientes.status_crm (6 valores hardcoded) por listas
-- dinâmicas no modelo do Trello: usuário cria/renomeia/reordena/arquiva listas,
-- e cada cliente (cartão) pertence a uma lista com uma posição própria dentro
-- dela. Fonte única — vale tanto para /clientes/kanban quanto para a coluna
-- "Lista" da tabela em /clientes/cadastro, para não duplicar o conceito de
-- funil em dois lugares (CLAUDE.md, seção 7, regra 4).
--
-- posicao é numeric (não int): ao arrastar um cartão/lista para entre dois
-- vizinhos, calculamos a média das posições deles em vez de reindexar a
-- lista inteira a cada drag — é assim que o Trello faz por baixo dos panos.
--
-- Rodar no SQL Editor do Supabase, NA ORDEM:

-- 1. Criar a tabela de listas:
create table crm_listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default '#3A6080',
  posicao numeric not null default 0,
  arquivado boolean not null default false,
  created_at timestamptz default now()
);

create index idx_crm_listas_posicao on crm_listas(posicao);

grant select, insert, update, delete on crm_listas to service_role;
alter table crm_listas enable row level security;
create policy "apenas_service_role" on crm_listas using (false);

-- 2. Semear as 6 listas iniciais, preservando nome/cor/ordem do Kanban atual
--    (IDs fixos para o backfill do passo 4 não depender de matching por nome):
insert into crm_listas (id, nome, cor, posicao) values
  ('a0000000-0000-4000-8000-000000000001', 'Novo Lead',     '#3A6080', 1000),
  ('a0000000-0000-4000-8000-000000000002', 'Em Contato',    '#A07830', 2000),
  ('a0000000-0000-4000-8000-000000000003', 'Negociando',    '#C78A2E', 3000),
  ('a0000000-0000-4000-8000-000000000004', 'Cliente Ativo', '#3E6B63', 4000),
  ('a0000000-0000-4000-8000-000000000005', 'Inativo',       '#8A857C', 5000),
  ('a0000000-0000-4000-8000-000000000006', 'Perdido',       '#A8452F', 6000);

-- 3. Adicionar as colunas novas em clientes (lista_id ainda nullable — vira
--    NOT NULL só depois do backfill no passo 4):
alter table clientes add column lista_id uuid references crm_listas(id);
alter table clientes add column posicao numeric not null default 0;

-- 4. Backfill: migrar status_crm -> lista_id, e gerar uma posicao inicial
--    por cliente dentro da lista (ordenado pelo created_at existente):
update clientes set lista_id = case status_crm
  when 'novo_lead'     then 'a0000000-0000-4000-8000-000000000001'
  when 'em_contato'    then 'a0000000-0000-4000-8000-000000000002'
  when 'negociando'    then 'a0000000-0000-4000-8000-000000000003'
  when 'cliente_ativo' then 'a0000000-0000-4000-8000-000000000004'
  when 'inativo'       then 'a0000000-0000-4000-8000-000000000005'
  when 'perdido'       then 'a0000000-0000-4000-8000-000000000006'
  else 'a0000000-0000-4000-8000-000000000001'
end::uuid;

alter table clientes alter column lista_id set not null;

with numerado as (
  select cnpj, (row_number() over (partition by lista_id order by created_at))::numeric * 1000 as rn
  from clientes
)
update clientes c set posicao = numerado.rn
from numerado
where c.cnpj = numerado.cnpj;

-- 5. Diagnóstico — confirmar que todo mundo migrou antes de seguir (deve dar 0):
--   select count(*) from clientes where lista_id is null;

-- 6. SÓ DEPOIS de validar o app funcionando com lista_id — remove a coluna
--    antiga (o CHECK constraint dela cai junto, não precisa dropar à parte):
-- alter table clientes drop column status_crm;

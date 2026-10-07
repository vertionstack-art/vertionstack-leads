-- CRM: funis com etapas, e cada lead numa etapa.
--
-- A etapa não substitui o status do lead, ela aponta para ele: toda etapa diz
-- a que situação corresponde (contatado, negociando, fechado...). Mover o card
-- muda o status, e é por isso que o Financeiro e os filtros do painel
-- continuam certos sem saber que o CRM existe.

create table if not exists funis (
  id         uuid primary key default gen_random_uuid(),
  conta_id   uuid not null references contas(id) on delete cascade,
  nome       text not null check (length(nome) between 1 and 40),
  posicao    int not null default 0,
  criado_em  timestamptz not null default now()
);
create index if not exists funis_conta_idx on funis (conta_id, posicao);

create table if not exists etapas (
  id         uuid primary key default gen_random_uuid(),
  conta_id   uuid not null references contas(id) on delete cascade,
  funil_id   uuid not null references funis(id) on delete cascade,
  nome       text not null check (length(nome) between 1 and 30),
  cor        text not null default 'zinco' check (cor in ('zinco', 'ceu', 'lavanda', 'manteiga', 'rosa', 'menta')),
  situacao   text not null default 'negociando' check (situacao in ('novo', 'contatado', 'negociando', 'fechado', 'descartado')),
  posicao    int not null default 0
);
create index if not exists etapas_funil_idx on etapas (funil_id, posicao);

alter table leads add column if not exists etapa_id uuid references etapas(id) on delete set null;
-- desde quando está na etapa: é o "parado há 9 dias" do card
alter table leads add column if not exists etapa_em timestamptz;
-- ordem dentro da coluna; número quebrado para encaixar entre dois sem renumerar
alter table leads add column if not exists etapa_ordem double precision;
create index if not exists leads_conta_etapa_idx on leads (conta_id, etapa_id) where etapa_id is not null;

alter table funis  enable row level security;
alter table etapas enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_vertion') then
    grant select, insert, update, delete on funis, etapas to app_vertion;
  end if;
end $$;

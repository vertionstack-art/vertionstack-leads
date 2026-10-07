-- Busca de leads pelo Google (Places API), no lugar da extensão.
--
-- Cada chamada ao Google custa (Text Search Enterprise), então tudo é
-- contado: por conta e por dia, quantas chamadas, quantos comércios vieram e
-- quantos viraram lead. É daqui que sai o custo real por lead, e é aqui que o
-- servidor confere o teto diário de gasto antes de chamar o Google de novo.
create table if not exists busca_google (
  conta_id    uuid not null references contas(id) on delete cascade,
  dia         date not null,
  chamadas    int not null default 0,
  resultados  int not null default 0,
  leads       int not null default 0,
  primary key (conta_id, dia)
);
create index if not exists busca_google_dia_idx on busca_google (dia);

alter table busca_google enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_vertion') then
    grant select, insert, update, delete on busca_google to app_vertion;
  end if;
end $$;

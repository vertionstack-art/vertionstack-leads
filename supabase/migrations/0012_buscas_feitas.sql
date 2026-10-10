-- Memória das buscas no Google de cada conta, para não pagar de novo por
-- resultado repetido.
--
-- O Google devolve as mesmas páginas para a mesma pergunta. Sem esta memória,
-- repetir "Barbearia em Gurupi" gastaria buscas só para trazer leads que já
-- estão no painel. Com ela: pergunta esgotada não chama o Google de novo, e
-- pergunta pela metade continua da página onde parou (enquanto o token de
-- página do Google ainda vale).
create table if not exists buscas_feitas (
  conta_id      uuid not null references contas(id) on delete cascade,
  -- "barbearia em centro, gurupi - to", normalizada
  pergunta      text not null,
  paginas       int not null default 0,
  proxima       text,
  proxima_em    timestamptz,
  esgotada      boolean not null default false,
  atualizada_em timestamptz not null default now(),
  primary key (conta_id, pergunta)
);

alter table buscas_feitas enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_vertion') then
    grant select, insert, update, delete on buscas_feitas to app_vertion;
  end if;
end $$;

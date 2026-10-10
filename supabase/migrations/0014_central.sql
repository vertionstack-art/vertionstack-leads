-- O que a central de administração precisa e a ferramenta não guardava.

-- Toda vez que alguém abre a página de pagamento da Stripe. Sem isto não dá
-- para saber quem chegou a iniciar a compra e desistiu. pago_em é preenchido
-- pelo aviso da Stripe quando a compra conclui.
create table if not exists checkouts (
  id        text primary key, -- id da sessão de checkout na Stripe
  conta_id  uuid not null references contas(id) on delete cascade,
  plano     text not null,
  forma     text not null,
  criado_em timestamptz not null default now(),
  pago_em   timestamptz
);
create index if not exists checkouts_conta_idx on checkouts (conta_id, criado_em desc);

alter table checkouts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_vertion') then
    grant select, insert, update, delete on checkouts to app_vertion;
  end if;
end $$;

-- Os dados de login de cada pessoa (quando criou, último acesso, se confirmou
-- o e-mail). Ficam no schema auth, que o servidor não lê direto; só esta
-- função lê por ele, e só o servidor pode chamá-la.
create or replace function public.usuarios_para_central()
returns table (id uuid, email text, criado_em timestamptz, ultimo_acesso timestamptz, email_confirmado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at from auth.users u
$$;

revoke all on function public.usuarios_para_central() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_vertion') then
    grant execute on function public.usuarios_para_central() to app_vertion;
  end if;
end $$;

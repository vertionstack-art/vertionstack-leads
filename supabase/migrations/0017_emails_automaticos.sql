-- E-mails automáticos (10/10/2026): boas-vindas, teste acabando/acabou,
-- plano vencendo/vencido e compra que ficou pela metade.

-- Cada e-mail sai uma vez por motivo: "chave" diferencia repetições
-- legítimas (o vencimento de cada período, cada checkout).
create table if not exists emails_enviados (
  id bigserial primary key,
  conta_id uuid not null references contas (id) on delete cascade,
  tipo text not null,
  chave text not null default '',
  enviado_em timestamptz not null default now(),
  unique (conta_id, tipo, chave)
);
alter table emails_enviados enable row level security;

-- Avisos que não são da conta em si (compra pela metade) respeitam o "não
-- quero receber"; os de conta (teste, vencimento) sempre saem.
alter table contas add column if not exists emails_aviso boolean not null default true;

-- O e-mail de login de quem é dono da conta. Fica no schema auth, que o
-- servidor não lê direto; só esta função lê, e só o servidor pode chamá-la.
create or replace function public.emails_dos_donos(contas_ids uuid[])
returns table (conta_id uuid, email text, nome text)
language sql stable security definer set search_path = '' as $$
  select m.conta_id, u.email::text, m.nome
  from public.membros m join auth.users u on u.id = m.user_id
  where m.papel = 'dono' and m.conta_id = any(contas_ids)
$$;

revoke all on function public.emails_dos_donos(uuid[]) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_vertion') then
    grant execute on function public.emails_dos_donos(uuid[]) to app_vertion;
  end if;
end $$;

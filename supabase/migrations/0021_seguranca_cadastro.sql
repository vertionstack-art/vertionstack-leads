-- 0021: duas trancas a mais.
--
-- 1) Cadastro só pelo nosso servidor. A chave pública do Supabase permite
--    chamar /auth/v1/signup direto, pulando a tela de cadastro (aceite dos
--    Termos, limite de tentativas, trava do teste grátis). O servidor agora
--    grava um passe de uso único antes de chamar o signUp e o manda junto;
--    o gancho "Before User Created" do Supabase Auth só deixa criar a conta
--    por e-mail quando o passe existe e é daquele e-mail. Login com Google
--    passa direto (o Google já confirmou quem é).
--
-- 2) As chaves públicas (anon e authenticated) perdem toda permissão nas
--    tabelas. O RLS já bloqueava; isto é a segunda tranca, e inclui o
--    TRUNCATE, que o RLS não cobre. O servidor usa o papel app_vertion.

create table if not exists public.cadastros_liberados (
  passe text primary key,
  email text not null,
  criado_em timestamptz not null default now()
);
alter table public.cadastros_liberados enable row level security;
grant select, insert, delete on public.cadastros_liberados to app_vertion;
grant select, delete on public.cadastros_liberados to supabase_auth_admin;

create or replace function public.antes_de_criar_usuario(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  provedor text := coalesce(event->'user'->'app_metadata'->>'provider', 'email');
  v_passe text := event->'user'->'user_metadata'->>'porta';
  v_email text := lower(event->'user'->>'email');
  achou int;
begin
  if provedor <> 'email' then
    return '{}'::jsonb;
  end if;
  delete from public.cadastros_liberados c
   where c.passe = v_passe
     and c.email = v_email
     and c.criado_em > now() - interval '15 minutes';
  get diagnostics achou = row_count;
  -- aproveita para varrer passes vencidos
  delete from public.cadastros_liberados where criado_em < now() - interval '1 day';
  if achou = 1 then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Crie a conta pelo site.'));
end;
$$;

revoke all on function public.antes_de_criar_usuario(jsonb) from public, anon, authenticated;
grant execute on function public.antes_de_criar_usuario(jsonb) to supabase_auth_admin;

-- segunda tranca: as chaves públicas não mexem em tabela nenhuma
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

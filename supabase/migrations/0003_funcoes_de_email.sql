-- O servidor precisa saber o e-mail de cada membro (tela de admin) e achar
-- alguém pelo e-mail (juntar na equipe). O papel do servidor não lê o
-- schema auth direto; estas duas funções leem por ele, e só elas.
-- Fechadas para anon/authenticated: a API pública do Supabase não chama.
create or replace function public.email_do_usuario(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select email::text from auth.users where id = uid
$$;

create or replace function public.usuario_pelo_email(mail text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(mail) limit 1
$$;

revoke all on function public.email_do_usuario(uuid) from public, anon, authenticated;
revoke all on function public.usuario_pelo_email(text) from public, anon, authenticated;
grant execute on function public.email_do_usuario(uuid) to app_vertion;
grant execute on function public.usuario_pelo_email(text) to app_vertion;

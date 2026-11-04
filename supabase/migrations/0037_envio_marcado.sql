-- 0037: e-mail do exterior com hora marcada — 04/11/2026.
--
-- O Lucas pediu para poder mandar agora, daqui a 5 minutos, ou espaçado de
-- 5 em 5 / 10 em 10 minutos, além do padrão (horário comercial de lá).
-- enviar_em guarda a hora marcada; vazio = horário comercial de lá.
--
-- O GitHub Actions só roda a cada 15 min (e atrasa), então quem dispara na
-- hora certa é o pg_cron do próprio Supabase: a cada minuto, SÓ se houver
-- e-mail marcado vencido, chama a rota do cron com uma senha que nasce e
-- fica aqui no banco (ninguém precisa copiar para a Vercel: a rota lê daqui).

alter table emails_frios add column if not exists enviar_em timestamptz;
create index if not exists emails_frios_enviar_em on emails_frios (enviar_em) where status = 'aprovado';

create table if not exists segredos_internos (
  nome text primary key,
  valor text not null,
  criado_em timestamptz not null default now()
);
alter table segredos_internos enable row level security;
grant select on segredos_internos to app_vertion;
insert into segredos_internos (nome, valor)
values ('cron_emails', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (nome) do nothing;

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'emails-marcados',
  '* * * * *',
  $$
    select net.http_get(
      url := 'https://leads.vertionstack.com/api/cron/emails?agendados=1',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select valor from public.segredos_internos where nome = 'cron_emails')),
      timeout_milliseconds := 55000
    )
    where exists (select 1 from public.emails_frios where status = 'aprovado' and enviar_em is not null and enviar_em <= now());
  $$
);

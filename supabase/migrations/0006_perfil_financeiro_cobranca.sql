-- Perfil: os dados da empresa de quem assina, que aparecem na proposta enviada
-- ao cliente dele (antes toda proposta saía como "Vertion Stack").
alter table contas add column if not exists empresa_nome text;
alter table contas add column if not exists empresa_whatsapp text;
alter table contas add column if not exists empresa_email text;
alter table contas add column if not exists empresa_site text;
alter table contas add column if not exists empresa_cidade text;
alter table contas add column if not exists empresa_documento text;
alter table contas add column if not exists meta_mensal_centavos integer check (meta_mensal_centavos is null or meta_mensal_centavos >= 0);
alter table contas add column if not exists assinatura_cancela_em timestamptz;
alter table contas add column if not exists pagamento_falhou boolean not null default false;

create table if not exists pagamentos (
  id              text primary key,
  conta_id        uuid references contas(id) on delete set null,
  plano           text not null check (plano in ('basic', 'pro')),
  forma           text not null check (forma in ('cartao', 'pix')),
  valor_centavos  integer not null,
  pago_em         timestamptz not null default now(),
  descricao       text
);
create index if not exists pagamentos_conta_idx on pagamentos (conta_id, pago_em desc);
create index if not exists pagamentos_data_idx on pagamentos (pago_em desc);
alter table pagamentos enable row level security;
grant select, insert, update, delete on pagamentos to app_vertion;

create or replace function public.apagar_usuario(uid uuid)
returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = uid
$$;
revoke all on function public.apagar_usuario(uuid) from public, anon, authenticated;
grant execute on function public.apagar_usuario(uuid) to app_vertion;

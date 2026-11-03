-- 0033: e-mail para leads do exterior — 03/11/2026.
--
-- Um e-mail só por empresa (sem etapas), escrito pela IA em inglês a partir
-- do que a busca achou. O Lucas lê, edita se quiser e aprova; o envio sai
-- pelo Gmail dele aos poucos, no horário comercial do país do lead, com
-- teto por dia (lib/email-frio).
--
-- emails_frios: o e-mail de cada lead (rascunho → aprovado → enviado).
-- emails_bloqueados: quem pediu para não receber mais. Vale para sempre e
--   para todas as contas: e-mail que pediu para sair não recebe de novo.

create table if not exists emails_frios (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  lead_id text not null,
  para text not null,
  assunto text not null,
  corpo text not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aprovado', 'enviando', 'enviado', 'erro', 'cancelado')),
  -- fuso do lead (America/Chicago...): o envio espera o horário comercial de lá
  fuso text not null,
  modelo text,
  criado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  enviado_em timestamptz,
  erro text,
  message_id text,
  unique (conta_id, lead_id)
);
create index if not exists emails_frios_fila on emails_frios (status, aprovado_em) where status = 'aprovado';
alter table emails_frios enable row level security;

create table if not exists emails_bloqueados (
  email text primary key,
  em timestamptz not null default now(),
  origem text not null default 'link'
);
alter table emails_bloqueados enable row level security;

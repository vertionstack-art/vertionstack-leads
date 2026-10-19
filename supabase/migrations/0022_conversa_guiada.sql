-- 0022: conversa guiada do WhatsApp (19/10/2026).
--
-- Por enquanto só o administrador usa (a rota confere ADMIN_EMAILS). Nada é
-- enviado daqui: a mensagem abre no WhatsApp da pessoa e quem aperta enviar
-- é ela. Aqui fica o registro da conversa, o roteiro marcado e o gasto da IA.

-- o que foi dito na conversa, dos dois lados (a resposta do cliente é colada à mão)
create table if not exists conversa_mensagens (
  id bigint generated always as identity primary key,
  conta_id uuid not null references contas (id) on delete cascade,
  lead_id text not null,
  autor text not null check (autor in ('eu', 'cliente')),
  texto text not null,
  passo text,
  criado_em timestamptz not null default now()
);
create index if not exists conversa_mensagens_lead on conversa_mensagens (conta_id, lead_id, criado_em);
alter table conversa_mensagens enable row level security;

-- os passos do roteiro já cumpridos com cada lead
create table if not exists conversa_passos (
  conta_id uuid not null references contas (id) on delete cascade,
  lead_id text not null,
  passo text not null,
  feito_em timestamptz not null default now(),
  primary key (conta_id, lead_id, passo)
);
alter table conversa_passos enable row level security;

-- cada pedido à IA: tokens e custo em dólar, para o medidor de uso e os limites
create table if not exists uso_ia (
  id bigint generated always as identity primary key,
  conta_id uuid not null references contas (id) on delete cascade,
  lead_id text,
  modelo text not null,
  entrada int not null default 0,
  saida int not null default 0,
  cache_lida int not null default 0,
  cache_gravada int not null default 0,
  custo_usd numeric(10, 6) not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists uso_ia_conta on uso_ia (conta_id, criado_em);
alter table uso_ia enable row level security;

-- limites de gasto da IA, em dólar (o painel mostra também em reais)
alter table contas add column if not exists ia_limite_dia_usd numeric(8, 2) not null default 1.00;
alter table contas add column if not exists ia_limite_mes_usd numeric(8, 2) not null default 15.00;

grant select, insert, update, delete on conversa_mensagens, conversa_passos, uso_ia to app_vertion;

-- Vertion Leads no Supabase: contas, assinatura, plano grátis e chave da extensão.
--
-- Regra de segurança que vale para o arquivo inteiro: o navegador NUNCA fala
-- direto com estas tabelas. Todas têm RLS ligado e nenhuma política, então a
-- chave pública do Supabase (anon) não lê nem grava nada. Quem lê e grava é o
-- servidor da Vercel, e ele sempre filtra pela conta de quem está logado —
-- trocar um id na URL não muda a conta, porque a conta vem da sessão.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ contas

-- A conta é o "dono" dos leads. Uma pessoa sozinha tem uma conta; você e o
-- João dividem a mesma, como hoje.
create table if not exists contas (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  -- gratis: 10 leads novos por semana | pago: sem limite | cortesia: sem limite e sem cobrança
  plano             text not null default 'gratis' check (plano in ('gratis', 'pago', 'cortesia')),
  -- até quando a mensalidade paga vale (já com a tolerância); null fora do plano pago
  pago_ate          timestamptz,
  asaas_cliente_id  text unique,
  asaas_assinatura_id text unique,
  bloqueada         boolean not null default false,
  criada_em         timestamptz not null default now()
);

create table if not exists membros (
  conta_id   uuid not null references contas(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,
  papel      text not null default 'membro' check (papel in ('dono', 'membro')),
  entrou_em  timestamptz not null default now(),
  primary key (conta_id, user_id)
);
-- por enquanto cada pessoa pertence a uma conta só
create unique index if not exists membros_um_por_usuario on membros (user_id);

-- ------------------------------------------------- chave da extensão

-- A chave aparece uma vez só, na hora de gerar; aqui fica só o hash.
-- Vazou o banco, as chaves continuam inúteis.
create table if not exists chaves_extensao (
  id           uuid primary key default gen_random_uuid(),
  conta_id     uuid not null references contas(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  hash         text not null unique,
  -- os primeiros caracteres, para a pessoa reconhecer qual chave é no painel
  prefixo      text not null,
  criada_em    timestamptz not null default now(),
  ultimo_uso   timestamptz,
  revogada_em  timestamptz
);

-- Cada chave vale em no máximo 2 computadores. A extensão manda um id de
-- aparelho gerado na instalação; o terceiro é recusado até a pessoa liberar
-- um no painel.
create table if not exists aparelhos (
  chave_id      uuid not null references chaves_extensao(id) on delete cascade,
  aparelho_id   text not null,
  primeiro_uso  timestamptz not null default now(),
  ultimo_uso    timestamptz not null default now(),
  primary key (chave_id, aparelho_id)
);

-- ----------------------------------------------------- plano grátis

-- Contador de leads novos por semana (segunda a domingo, horário de Brasília).
-- É um contador e não uma contagem da tabela de leads de propósito: se fosse
-- contagem, apagar leads devolveria a cota e o limite viraria enfeite.
create table if not exists uso_semanal (
  conta_id  uuid not null references contas(id) on delete cascade,
  semana    date not null,
  novos     integer not null default 0,
  primary key (conta_id, semana)
);

-- ------------------------------------------------------------ leads

-- Mesma tabela de hoje, agora com dono. A chave passa a ser (conta, id):
-- duas contas podem ter o mesmo comércio do Maps sem uma enxergar a outra.
create table if not exists leads (
  conta_id            uuid not null references contas(id) on delete cascade,
  id                  text not null,
  name                text not null,
  category            text,
  search_term         text,
  city                text,
  phone               text,
  address             text,
  website             text,
  website_kind        text not null default 'none',
  website_label       text,
  is_lead             boolean not null default true,
  rating              double precision,
  reviews             integer,
  maps_url            text,
  lat                 double precision,
  lng                 double precision,
  hours               text,
  status              text not null default 'novo',
  notes               text,
  site_status         text,
  site_detalhe        text,
  site_verificado_em  timestamptz,
  coletado_por        text,
  responsavel         text,
  proposta            jsonb,
  instagram           text,
  origem              text not null default 'maps',
  previa_url          text,
  cnpj                jsonb,
  briefing            jsonb,
  contato             boolean not null default false,
  contatado_em        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (conta_id, id)
);
create index if not exists leads_conta_criado_idx on leads (conta_id, created_at desc);
create index if not exists leads_conta_kind_idx on leads (conta_id, website_kind);
create index if not exists leads_conta_status_idx on leads (conta_id, status);
create index if not exists leads_conta_city_idx on leads (conta_id, city);

-- ------------------------------------------------- limites e registros

-- Limite de tentativas (login, cadastro, esqueci a senha, envio da extensão).
-- Janela fixa por chave: "login:ip:1.2.3.4", "login:email:x@y", etc.
create table if not exists limites (
  chave    text not null,
  janela   timestamptz not null,
  n        integer not null default 0,
  primary key (chave, janela)
);

-- Tudo que o Asaas avisa fica guardado, e o id do evento impede processar
-- o mesmo pagamento duas vezes quando o aviso chega repetido.
create table if not exists eventos_pagamento (
  id          text primary key,
  tipo        text not null,
  conta_id    uuid references contas(id) on delete set null,
  corpo       jsonb not null,
  recebido_em timestamptz not null default now()
);

-- As duas tabelas que já existem no Neon para o /admin.
create table if not exists acessos (
  id         bigserial primary key,
  ip         text not null,
  rota       text not null,
  usuario    text,
  resultado  text not null default 'ok',
  cidade     text,
  pais       text,
  navegador  text,
  quando     timestamptz not null default now()
);
create index if not exists acessos_ip_idx on acessos (ip);
create index if not exists acessos_quando_idx on acessos (quando desc);

create table if not exists bloqueios (
  ip      text primary key,
  motivo  text,
  por     text,
  quando  timestamptz not null default now()
);

-- ------------------------------------------------------------- RLS

-- Liga e não cria política nenhuma: o acesso pela API pública fica fechado.
alter table contas            enable row level security;
alter table membros           enable row level security;
alter table chaves_extensao   enable row level security;
alter table aparelhos         enable row level security;
alter table uso_semanal       enable row level security;
alter table leads             enable row level security;
alter table limites           enable row level security;
alter table eventos_pagamento enable row level security;
alter table acessos           enable row level security;
alter table bloqueios         enable row level security;

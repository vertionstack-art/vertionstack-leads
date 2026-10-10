-- E-mail do lead, modelos de mensagem, alertas da central (10/10/2026).

-- O e-mail do comércio: achado no site/Linktree na busca, digitado no
-- cadastro manual, vindo da planilha ou preenchido na ficha.
alter table leads add column if not exists email text;

-- Os modelos de mensagem de cada conta: o jeito de abordar da pessoa, com
-- marcadores ({comercio}, {cidade}...) trocados na hora pela ficha do lead.
create table if not exists modelos_mensagem (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  nome text not null,
  texto text not null,
  criado_em timestamptz not null default now()
);
create index if not exists modelos_mensagem_conta on modelos_mensagem (conta_id, criado_em);
alter table modelos_mensagem enable row level security;

-- Alerta por e-mail quando alguém mexe na central: no máximo um por tipo a
-- cada 10 minutos, para uma tentativa em série não lotar a caixa de entrada.
create table if not exists alertas_central (
  tipo text primary key,
  enviado_em timestamptz not null,
  repeticoes int not null default 0
);
alter table alertas_central enable row level security;

-- Limpeza do que era da extensão e do disparador (ambos aposentados em
-- 10/10/2026). Aplicado depois de o código novo estar no ar.
drop table if exists aparelhos;
drop table if exists chaves_extensao;
alter table leads drop column if exists contato;

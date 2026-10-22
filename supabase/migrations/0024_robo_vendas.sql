-- 0024: robô de vendas no WhatsApp (22/10/2026). Só a conta da Vertion.
--
-- A primeira mensagem sai sempre do clique da pessoa. O robô só responde a
-- quem respondeu: lê a conversa, segue o roteiro e, quando precisa dela
-- (prévia, proposta, preço, negociação), avisa e espera.

-- o robô em cada conversa
create table if not exists robo_conversas (
  conta_id uuid not null references contas (id) on delete cascade,
  lead_id text not null,
  ligado boolean not null default false,
  -- o que o robô prometeu e espera de você: previa, proposta, preco, humano
  aguardando text check (aguardando in ('previa', 'proposta', 'preco', 'humano')),
  aguardando_motivo text,
  aguardando_desde timestamptz,
  -- trava para duas respostas não saírem ao mesmo tempo
  processando_ate timestamptz,
  -- a última mensagem do cliente que o robô já respondeu (conversa_mensagens.id)
  respondido_ate bigint not null default 0,
  respostas_dia date,
  respostas_no_dia int not null default 0,
  -- por que parou sozinho (você respondeu, cliente pediu para parar, limite)
  pausado_motivo text,
  atualizado_em timestamptz not null default now(),
  primary key (conta_id, lead_id)
);
alter table robo_conversas enable row level security;

-- os avisos para a pessoa ("Barbearia do Zé quer ver a ideia")
create table if not exists robo_avisos (
  id bigint generated always as identity primary key,
  conta_id uuid not null references contas (id) on delete cascade,
  lead_id text not null,
  tipo text not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists robo_avisos_abertos on robo_avisos (conta_id, criado_em) where resolvido_em is null;
alter table robo_avisos enable row level security;

-- o interruptor geral do robô na conta
alter table contas add column if not exists robo_ativo boolean not null default false;

-- a mensagem foi escrita pelo robô (o balão mostra "Robô")
alter table conversa_mensagens add column if not exists robo boolean not null default false;

grant select, insert, update, delete on robo_conversas, robo_avisos to app_vertion;
grant usage on sequence robo_avisos_id_seq to app_vertion;

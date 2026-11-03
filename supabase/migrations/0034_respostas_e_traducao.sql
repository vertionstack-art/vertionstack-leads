-- 0034: respostas dos e-mails do exterior e tradução do nicho — 03/11/2026.
--
-- A cada 15 minutos a ferramenta lê a caixa do Gmail do Lucas, acha quem
-- respondeu a um e-mail frio (pelo cabeçalho da resposta ou pelo endereço),
-- entende a resposta (interessado, pergunta, sem interesse, pediu para sair,
-- resposta automática, e-mail que voltou) e move o lead no CRM sozinha.
--
-- emails_respostas: cada resposta lida, uma vez só (message_id).
-- emails_frios.resposta_*: a última resposta, para a fila mostrar.
-- traducoes_nicho: o nicho digitado em português e como ele vai para o
--   Google de cada país, para não pedir a mesma tradução à IA de novo.

create table if not exists emails_respostas (
  message_id text primary key,
  email_frio_id uuid not null references emails_frios (id) on delete cascade,
  conta_id uuid not null references contas (id) on delete cascade,
  lead_id text not null,
  de text not null,
  assunto text,
  trecho text,
  tipo text not null,
  resumo text,
  recebida_em timestamptz not null,
  lida_em timestamptz not null default now()
);
create index if not exists emails_respostas_lead on emails_respostas (conta_id, lead_id);
alter table emails_respostas enable row level security;

alter table emails_frios add column if not exists respondido_em timestamptz;
alter table emails_frios add column if not exists resposta_tipo text;
alter table emails_frios add column if not exists resposta_resumo text;

create table if not exists traducoes_nicho (
  pt text not null,
  pais text not null,
  en text not null,
  criado_em timestamptz not null default now(),
  primary key (pt, pais)
);
alter table traducoes_nicho enable row level security;

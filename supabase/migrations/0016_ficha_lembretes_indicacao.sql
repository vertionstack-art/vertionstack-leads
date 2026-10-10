-- Ficha do lead, lembretes do CRM, primeiros passos e indicação (10/10/2026).

-- Histórico do lead: tudo que aconteceu com ele, em ordem. O "entrou na
-- lista" não precisa de linha aqui: vem do created_at do próprio lead.
create table if not exists lead_eventos (
  id bigserial primary key,
  conta_id uuid not null,
  lead_id text not null,
  -- status, nota, whatsapp, proposta, proposta_fechada, proposta_aberta, previa, etapa, lembrete, lembrete_feito
  tipo text not null,
  detalhe text,
  quem text,
  criado_em timestamptz not null default now(),
  foreign key (conta_id, lead_id) references leads (conta_id, id) on delete cascade
);
create index if not exists lead_eventos_lead on lead_eventos (conta_id, lead_id, criado_em desc);
alter table lead_eventos enable row level security;

-- Lembrete: "ligar dia 12". Um por lead; feito = apaga.
alter table leads add column if not exists lembrete_em timestamptz;
alter table leads add column if not exists lembrete_texto text;
create index if not exists leads_lembrete on leads (conta_id, lembrete_em) where lembrete_em is not null;

-- Primeiros passos: a pessoa pode esconder o guia antes de terminar.
alter table contas add column if not exists passos_ocultos boolean not null default false;

-- Indicação: cada conta tem um código; quem chegou por ele fica anotado, e
-- o bônus só é creditado quando o indicado paga um plano.
alter table contas add column if not exists codigo_convite text unique;
alter table contas add column if not exists leads_bonus int not null default 0;
alter table contas add column if not exists buscas_bonus int not null default 0;

create table if not exists indicacoes (
  conta_indicada uuid primary key references contas (id) on delete cascade,
  conta_indicadora uuid not null references contas (id) on delete cascade,
  criada_em timestamptz not null default now(),
  pago_em timestamptz,
  -- 'aguardando' até o indicado pagar; 'creditada' quando o bônus entrou;
  -- 'recusada' quando indicado e indicador dividem computador, navegador ou e-mail
  situacao text not null default 'aguardando' check (situacao in ('aguardando', 'creditada', 'recusada')),
  motivo text
);
create index if not exists indicacoes_indicadora on indicacoes (conta_indicadora, criada_em desc);
alter table indicacoes enable row level security;

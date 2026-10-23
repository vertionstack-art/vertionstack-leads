-- 0028: o robô atende também quem chama o WhatsApp da Vertion sem ser lead
-- (veio do Instagram, da landing page, de indicação) — 23/10/2026.
--
-- robo_atende_novos: número desconhecido que manda mensagem vira lead
--   (origem 'whatsapp') e o robô atende. Interruptor próprio em Conversas.
-- zap_ignorados: números que nunca viram lead nem recebem robô (amigos,
--   família), marcados pelo botão "Ignorar este número" na conversa.

alter table contas add column if not exists robo_atende_novos boolean not null default false;

create table if not exists zap_ignorados (
  conta_id uuid not null references contas (id) on delete cascade,
  numero text not null,
  criado_em timestamptz not null default now(),
  primary key (conta_id, numero)
);
alter table zap_ignorados enable row level security;
grant select, insert, update, delete on zap_ignorados to app_vertion;

-- pedido do dono para a conta da Vertion
update contas set robo_atende_novos = true
where id = (select conta_id from membros where user_id = (select public.usuario_pelo_email('vertionstack@gmail.com')) limit 1);

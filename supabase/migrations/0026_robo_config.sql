-- 0026: o que o dono ensina ao robô de vendas (23/10/2026): apresentação,
-- jeito de escrever, sobre a empresa, serviços, prazos, pagamento,
-- portfólio, agenda, perguntas frequentes, o que é proibido, horário e as
-- correções feitas no "Testar o robô". Formato em web/lib/robo-config.ts.

alter table contas add column if not exists robo_config jsonb not null default '{}'::jsonb;

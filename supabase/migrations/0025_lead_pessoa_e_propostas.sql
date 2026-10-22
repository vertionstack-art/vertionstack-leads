-- 0025: cadastro de lead (comércio ou pessoa) e propostas avulsas (23/10/2026).
--
-- tipo: o lead é um comércio (veio do Maps ou cadastrado) ou uma pessoa que
--   quer um projeto (indicação, conversa).
-- interesse: o que ele quer (site, landing page, sistema, automação...), ids de lib/interesses.
-- ideia: a ideia que ele contou, para levar para a reunião.
-- so_proposta: proposta feita sem cadastrar cliente. O registro existe para o
--   link público, o PDF, o aceite online e o Financeiro funcionarem iguais,
--   mas não aparece na lista de leads.

alter table leads add column if not exists tipo text not null default 'comercio' check (tipo in ('comercio', 'pessoa'));
alter table leads add column if not exists interesse text[] not null default '{}';
alter table leads add column if not exists ideia text;
alter table leads add column if not exists so_proposta boolean not null default false;

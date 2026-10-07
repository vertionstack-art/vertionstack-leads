-- O plano Free deixa de ser permanente e vira um teste: 30 leads novos no
-- total, sem prazo e sem renovar. Decidido com o Lucas em 07/10/2026.
--
-- Contador próprio, e não soma do uso_semanal, para o histórico semanal
-- continuar servindo só ao admin e o teste não depender de calendário.
alter table contas add column if not exists teste_usados int not null default 0;
-- por que esta conta ficou sem teste (outra conta já usou neste computador,
-- navegador, rede ou e-mail); null = teste liberado
alter table contas add column if not exists teste_negado text;

-- As contas já existentes no Free começam o teste com o que já usaram nesta
-- semana, para ninguém ganhar 30 leads de presente no meio da semana.
update contas c set teste_usados = coalesce((select sum(novos) from uso_semanal u where u.conta_id = c.id), 0)
where teste_usados = 0;

-- Rastros deixados por cada conta, para uma pessoa não criar conta atrás de
-- conta e usar o teste para sempre. Só o hash: o IP, o e-mail e os ids de
-- aparelho não ficam guardados em texto.
--   navegador: cookie de longa duração gravado no primeiro acesso
--   aparelho:  id da instalação da extensão
--   rede:      IP + navegador (user-agent) juntos, para não pegar quem só divide a operadora
--   email:     e-mail normalizado (gmail sem pontos e sem +apelido)
-- Os rastros sobrevivem à conta (on delete set null): apagar a conta e criar
-- outra com o mesmo e-mail ou no mesmo computador não devolve o teste.
create table if not exists sinais_teste (
  id         bigint generated always as identity primary key,
  conta_id   uuid references contas(id) on delete set null,
  tipo       text not null check (tipo in ('navegador', 'aparelho', 'rede', 'email')),
  valor      text not null,
  -- a conta dona deste rastro já puxou lead do teste
  usou_teste boolean not null default false,
  visto_em   timestamptz not null default now()
);
create unique index if not exists sinais_teste_unico on sinais_teste (tipo, valor, conta_id);
create index if not exists sinais_teste_valor_idx on sinais_teste (tipo, valor);
create index if not exists sinais_teste_conta_idx on sinais_teste (conta_id);

alter table sinais_teste enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_vertion') then
    grant select, insert, update, delete on sinais_teste to app_vertion;
    grant usage, select on sequence sinais_teste_id_seq to app_vertion;
  end if;
end $$;

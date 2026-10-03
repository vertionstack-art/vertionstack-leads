-- A conta que recebe os leads vindos do Neon (Lucas e João). Os links de
-- proposta antigos, já mandados a clientes, não carregam conta no endereço:
-- eles são procurados nesta conta.
alter table contas add column if not exists legado boolean not null default false;
create unique index if not exists contas_uma_legada on contas (legado) where legado;

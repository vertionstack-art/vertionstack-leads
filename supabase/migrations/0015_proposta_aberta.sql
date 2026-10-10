-- "O cliente abriu a sua proposta": quando e quantas vezes o link público da
-- proposta foi aberto. Antes isso só ia para o log de acessos da central; o
-- freelancer não via. Não conta a prévia que o WhatsApp gera ao colar o link
-- (robô), nem o próprio dono da conta abrindo para conferir, e várias aberturas
-- seguidas da mesma pessoa contam uma vez a cada 30 minutos.
alter table leads add column if not exists proposta_primeira_em timestamptz;
alter table leads add column if not exists proposta_aberta_em timestamptz;
alter table leads add column if not exists proposta_aberturas int not null default 0;

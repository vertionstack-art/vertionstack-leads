-- "O que você vende?" (11/10/2026): a conta diz o que vende (sites, redes
-- sociais, tráfego, design, serviços para empresas ou outro) e para quem; a
-- busca escolhe os leads e a temperatura por isso. Cada lead guarda para
-- qual oferta foi achado, e se o site dele tem marca de anúncio (pixel/tag).
alter table contas add column if not exists oferta text not null default 'sites';
alter table contas add column if not exists oferta_texto text;
alter table contas add column if not exists oferta_publico text[] not null default '{}';
alter table leads add column if not exists oferta text not null default 'sites';
alter table leads add column if not exists sem_anuncio boolean;

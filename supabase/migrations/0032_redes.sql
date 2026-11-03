-- 0032: redes da empresa — 02/11/2026.
--
-- Para dar preço lá fora, o Lucas precisa ver o tamanho do digital da
-- empresa: site, Instagram, Facebook, LinkedIn, Yelp... A busca do exterior
-- guarda os links que a própria empresa publica no site dela.
--
-- redes: { "instagram": "https://...", "facebook": "https://...", ... }

alter table leads add column if not exists redes jsonb;

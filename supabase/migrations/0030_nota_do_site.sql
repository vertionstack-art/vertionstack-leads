-- 0030: nota do site — 01/11/2026.
--
-- Quem tem site no ar deixou de ser descartado na busca: o site ganha uma
-- nota de 0 a 10 (velocidade no celular pelo PageSpeed do Google + o que dá
-- para ver no HTML) e quem tira até 6 vira lead, com os problemas ao lado.
--
-- site_nota: a nota (meio ponto de precisão).
-- site_avaliacao: os problemas achados, a velocidade medida, quando foi
--   medido e, se você pedir na ficha, a avaliação escrita pela IA.

alter table leads add column if not exists site_nota numeric(3,1);
alter table leads add column if not exists site_avaliacao jsonb;

-- 0035: a demo vai em todo e-mail do exterior — 03/11/2026.
--
-- Regra do Lucas: todo e-mail frio leva o link do site de demonstração que
-- ele fez para aquela empresa. A IA escreve contando com a demo e marca o
-- lugar com [DEMO]; ele cola o link no rascunho, e sem link não aprova.
-- No envio, [DEMO] vira o link.

alter table emails_frios add column if not exists demo_url text;

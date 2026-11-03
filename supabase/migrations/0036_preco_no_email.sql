-- 0036: o valor do site no e-mail do exterior — 03/11/2026.
--
-- O Lucas digita o valor no rascunho e a frase com o preço entra no texto,
-- logo depois da demo. Guardado aqui para a frase voltar quando a IA
-- reescrever o e-mail ("Escrever outro").

alter table emails_frios add column if not exists preco numeric(10,2);
alter table emails_frios add column if not exists moeda text;

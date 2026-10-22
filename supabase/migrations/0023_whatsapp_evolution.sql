-- 0023: WhatsApp da Vertion ligado pela Evolution API (22/10/2026).
--
-- Só a conta da Vertion usa (podeUsarConversa). Toda mensagem sai pelo
-- clique da pessoa; nada é enviado sozinho. As respostas dos leads chegam
-- pelo webhook e caem em conversa_mensagens.
--
-- externo_id é o id da mensagem no WhatsApp: a que a ferramenta envia volta
-- pelo webhook com o mesmo id, e o índice único impede que ela entre duas vezes.

alter table conversa_mensagens add column if not exists externo_id text;
create unique index if not exists conversa_mensagens_externo on conversa_mensagens (conta_id, externo_id) where externo_id is not null;

-- 0029: copiloto comercial — 23/10/2026.
--
-- site_leitura: o que a ferramenta leu no site do lead (título, se tem
--   formulário, botão de WhatsApp, agendamento...). Fatos observados, para
--   a IA não inventar diagnóstico. Lido de novo depois de 14 dias.
-- uso_ia.tarefa / ms: qual pedido foi (abordagem, resposta, follow-up,
--   robô...) e quanto demorou, para medir desempenho.
-- conversa_mensagens.origem_ia: a mensagem enviada saiu de qual tarefa do
--   copiloto (null = escrita à mão ou do roteiro), para comparar o que
--   recebe resposta.

alter table leads add column if not exists site_leitura jsonb;
alter table leads add column if not exists site_lido_em timestamptz;

alter table uso_ia add column if not exists tarefa text;
alter table uso_ia add column if not exists ms int;

alter table conversa_mensagens add column if not exists origem_ia text;

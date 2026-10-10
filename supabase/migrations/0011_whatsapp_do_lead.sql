-- O WhatsApp de verdade de cada lead, separado do telefone do Maps.
--
-- O Google entrega um telefone só, e muitas vezes é fixo. O WhatsApp sai de
-- duas fontes, em ordem de confiança:
--   link:    um link wa.me / api.whatsapp.com que a própria empresa publicou
--            (Linktree, bit.ly, site) — é o número que ela quer que chamem;
--   celular: o telefone do Maps é celular (11 dígitos com 9) — muito provável.
-- telefone_tipo guarda se o telefone do Maps é 'celular' ou 'fixo'.
alter table leads add column if not exists whatsapp text;
alter table leads add column if not exists whatsapp_fonte text
  check (whatsapp_fonte is null or whatsapp_fonte in ('link', 'celular'));
alter table leads add column if not exists telefone_tipo text
  check (telefone_tipo is null or telefone_tipo in ('celular', 'fixo'));

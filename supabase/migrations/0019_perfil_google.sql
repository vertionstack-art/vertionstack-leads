-- Quantas fotos o comércio tem no perfil do Google (null = não veio da busca
-- do Google). Perfil sem foto ou sem horário vira argumento na temperatura.
-- O horário de funcionamento usa a coluna "hours", que já existia.
alter table leads add column if not exists fotos_google int;

-- Foto de perfil, já reduzida no navegador para 256×256 (alguns KB) e
-- guardada como data URL. Só JPEG, PNG ou WebP: SVG fica de fora porque pode
-- carregar script. O teto de tamanho impede usar o banco como depósito.
alter table membros add column if not exists foto text
  check (foto is null or (length(foto) <= 300000 and foto ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$'));

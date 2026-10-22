-- 0027: "Aqui é o Lucas" (23/10/2026). A mensagem pronta não adivinha
-- gênero: cada pessoa escolhe em Meu perfil se aparece "Aqui é o Lucas",
-- "Aqui é a Ana" ou "Aqui é Lucas" (padrão, sem artigo).

alter table membros add column if not exists artigo text not null default '' check (artigo in ('', 'o', 'a'));

-- pedido do dono para a conta da Vertion
update membros set artigo = 'o' where user_id = (select public.usuario_pelo_email('vertionstack@gmail.com'));

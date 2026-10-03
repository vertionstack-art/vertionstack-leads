-- Três planos pagos de fato: basic e pro. 'pago' fica aceito só por compatibilidade
-- (vira pro na leitura); 'cortesia' é a conta da Vertion, sem limite.
alter table contas drop constraint if exists contas_plano_check;
alter table contas add constraint contas_plano_check check (plano in ('gratis', 'basic', 'pro', 'pago', 'cortesia'));
update contas set plano = 'pro' where plano = 'pago';

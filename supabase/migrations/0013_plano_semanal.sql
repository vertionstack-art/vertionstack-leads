-- Plano de 7 dias (R$ 14,90, pagamento avulso no cartão ou Pix, não renova).
-- Decidido com o Lucas em 10/10/2026.
alter table contas drop constraint if exists contas_plano_check;
alter table contas add constraint contas_plano_check check (plano in ('gratis', 'semanal', 'basic', 'pro', 'pago', 'cortesia'));

alter table pagamentos drop constraint if exists pagamentos_plano_check;
alter table pagamentos add constraint pagamentos_plano_check check (plano in ('semanal', 'basic', 'pro'));

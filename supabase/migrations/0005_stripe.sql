-- Cobrança pela Stripe: o cliente da Stripe e a assinatura no cartão (se houver).
alter table contas add column if not exists stripe_cliente_id text unique;
alter table contas add column if not exists stripe_assinatura_id text unique;
-- como a pessoa está pagando agora: 'cartao' renova sozinho, 'pix' é mês a mês
alter table contas add column if not exists forma_pagamento text check (forma_pagamento in ('cartao', 'pix'));

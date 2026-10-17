-- "Aprimorar leads quentes" (15/10/2026): o CNPJ do lead é procurado na Casa
-- dos Dados pelo telefone e pelo nome. Cada lead é tentado uma vez só, porque
-- cada pesquisa custa crédito: aprimorado_em diz quando foi, e aprimorado o
-- que deu ('achado', 'nao_achado', 'ambiguo'). Os dados da empresa ficam na
-- coluna cnpj, que já existe.
alter table leads add column if not exists aprimorado_em timestamptz;
alter table leads add column if not exists aprimorado text;

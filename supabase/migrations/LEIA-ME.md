# Migrações do Supabase

Já aplicadas no projeto `vertion-leads` (pphdllprqlrffuxywxmz), nesta ordem:

1. `0001_contas_e_assinatura.sql`
2. `papel_do_servidor` — cria o usuário de banco `app_vertion` (login, bypassrls)
   que o servidor da Vercel usa. Não está aqui de propósito: leva a senha
   (em forma de hash) e ela não deve ir para o GitHub. A senha em texto vive
   só no `.env.local` e na variável `SUPABASE_DB_URL` da Vercel.
3. `0002_conta_legada.sql`
4. `0003_funcoes_de_email.sql`
5. `0004_planos_basic_pro.sql`
6. `0005_stripe.sql`
7. `0006_perfil_financeiro_cobranca.sql`
8. `0007_foto_de_perfil.sql`
9. `0008_crm_funis.sql`
10. `0009_teste_gratis.sql`
11. `0010_busca_google.sql`
12. `0011_whatsapp_do_lead.sql`
13. `0012_buscas_feitas.sql`
14. `0013_plano_semanal.sql`
15. `0014_central.sql`
16. `0015_proposta_aberta.sql`

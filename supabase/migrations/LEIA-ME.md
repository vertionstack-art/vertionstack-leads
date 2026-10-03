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

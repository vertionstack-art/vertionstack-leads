# Vertion Leads

Ferramenta paga para freelancers que vendem site: acha no Google os comércios
de uma cidade que ainda não têm site próprio e leva cada um do primeiro
contato até o dinheiro no Financeiro.

No ar em **https://leads.vertionstack.com** (quem não está logado vê a página
de venda; quem está logado vê o painel).

## O que tem dentro

| Parte | O que faz |
|---|---|
| Busca | Google Places (API New), filtro de precisão (empresa grande, site escondido, sem contato, só WhatsApp) e memória de buscas para não pagar repetido |
| Painel | Leads com temperatura (quente/morno/frio e o motivo), conferência de sites, ficha do lead |
| Ficha do lead | WhatsApp com mensagem pronta ou modelo salvo, e-mail, lembrete, histórico |
| Importar | Planilha CSV própria (não gasta a cota semanal) |
| CRM | Funis, etapas, "Para hoje" e card parado |
| Proposta | Link público e PDF, selo de "proposta aberta" |
| Financeiro | Clientes fechados, entrada, mensalidade, meta |
| Planos | Teste grátis (30 leads), 7 dias, Basic e Pro pela Stripe (cartão e Pix) |
| Indicação | 50 leads e 5 buscas de bônus quando o indicado paga |
| E-mails | Resend: boas-vindas, teste acabando/acabou, plano vencendo/vencido, compra pela metade |
| Central | Administração escondida (endereço secreto + aparelho liberado + Google Authenticator), com alerta por e-mail |

## Pastas

```
web/                   o site (Next.js 16, Tailwind v4)
  app/                 páginas e rotas de API (app/api/*)
  lib/                 regras: conta, planos, busca, pagamento, e-mails, CRM…
  proxy.ts             sessão, página pública, central escondida, convite
  vercel.json          agendamento diário dos avisos por e-mail
supabase/migrations/   o banco, em ordem (aplicar na ordem do número)
DESIGN.md / PRODUCT.md o sistema visual e as decisões de produto
```

A extensão do Chrome e o disparador de WhatsApp foram aposentados em
10/10/2026 e saíram do repositório (ficam no histórico do Git).

## Rodar no computador

```bash
cd web
npm install
npm run dev
```

Precisa de um `web/.env.local` com as variáveis abaixo (os valores ficam na
Vercel, nunca no repositório).

## Variáveis (só os nomes)

- **Banco e login (Supabase):** `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Administração:** `ADMIN_EMAILS`, `ADMIN_CAMINHO`, `ADMIN_CHAVE`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRECO_BASIC`, `STRIPE_PRECO_PRO`, `STRIPE_PIX`
- **Google:** `GOOGLE_PLACES_KEY` (opcionais: `BUSCA_TETO_MES`, `BUSCA_TETO_DIA`, `BUSCA_TETO_TESTES`)
- **E-mails:** `RESEND_API_KEY`, `CRON_SECRET` (opcionais: `EMAIL_REMETENTE`, `EMPRESA_EMAIL`)
- **Teste grátis:** `TESTE_SAL`
- **Textos legais:** `LEGAL_NOME`, `LEGAL_DOCUMENTO`, `LEGAL_EMAIL`, `LEGAL_FORO`
- **Não apagar:** `INGEST_TOKEN` (segredo dos links antigos de proposta)

## Publicar

Todo `git push` na `main` publica sozinho na Vercel. Mudança no banco vai
como um arquivo novo em `supabase/migrations/` e é aplicada no Supabase.

Cópia de segurança diária do banco: `.github/workflows/copia-de-seguranca.yml`
(criptografada, guardada 30 dias em Actions → Artifacts).

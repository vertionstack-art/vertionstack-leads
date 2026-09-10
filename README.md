# Vertion Leads

Ferramenta de prospecção: varre o Google Maps procurando comércios e separa
**quem ainda não tem site próprio** — que é exatamente quem você quer abordar
para vender site, landing page ou automação.

São duas peças que conversam:

| Peça | O que faz | Onde roda |
|---|---|---|
| **Extensão do Chrome** | Varre o Maps e coleta os comércios | No seu navegador |
| **Painel** | Recebe, organiza e vira sua lista de trabalho | Na Vercel |

---

## O detalhe que faz a ferramenta valer

O Google Maps mente sobre site. Três armadilhas que a ferramenta resolve:

**1. Instagram não é site.** Muito comércio cadastra o Instagram no campo
"Site". No Maps aparece o botãozinho e parece que já tem presença digital.
Não tem — e é lead quente.

**2. O botão da lista às vezes é outra coisa.** Numa busca por barbearias, o
único link que aparece nos cards é o **"Agendar on-line"** (`appbarber`,
`trinks`). Quem lê a lista sem cuidado marca esses como "já tem site" e perde
a venda. A ferramenta só aceita como site o link que o Google marca de fato
como *Website*.

**3. iFood, Doctoralia e VivaReal também não são site.** São presença alugada.
O comércio paga comissão e não tem nada que seja dele.

Por isso cada comércio recebe uma classificação:

| Situação | Significa | Vale abordar? |
|---|---|---|
| **Sem site** | Nada cadastrado | Sim |
| **Só rede social** | Instagram, Facebook, WhatsApp, Linktree | Sim |
| **Só marketplace** | iFood, Doctoralia, VivaReal, Trinks | Sim |
| **Site fraco** | `business.site`, Wix grátis, Blogspot | Sim |
| **Tem site próprio** | Domínio de verdade | Não |

---

## Instalação

### Parte 1 — Publicar o painel

1. Entre em [vercel.com](https://vercel.com) e faça login **com a conta do GitHub**.
2. Clique em **Add New → Project**.
3. Escolha o repositório `vertionstack-leads` e clique em **Import**.
4. Em **Root Directory**, clique em *Edit* e selecione a pasta **`web`**. Esse passo é obrigatório.
5. Clique em **Deploy** e espere.
6. Copie o endereço que a Vercel te der (algo como `https://vertionstack-leads.vercel.app`).

### Parte 2 — Ligar o banco de dados

Sem isso os leads somem quando o servidor descansa.

1. No projeto da Vercel, abra a aba **Storage**.
2. **Create Database → Neon → Continue** e aceite o plano gratuito.
3. **Connect** no projeto. A Vercel cria a variável `DATABASE_URL` sozinha.
4. Vá em **Deployments**, clique nos três pontinhos do último e escolha **Redeploy**.

### Parte 3 — Criar as duas senhas

Na Vercel, em **Settings → Environment Variables**, crie duas:

| Nome | Valor | Para quê |
|---|---|---|
| `DASHBOARD_PASSWORD` | uma senha sua | Entrar no painel |
| `INGEST_TOKEN` | a chave que a extensão gerou | A extensão poder enviar |

A chave da extensão você pega no passo seguinte. Depois de criar as duas,
faça **Redeploy** de novo.

### Parte 4 — Instalar a extensão

1. Baixe este repositório (botão verde **Code → Download ZIP**) e descompacte.
2. No Chrome, abra `chrome://extensions`.
3. Ligue o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação**.
5. Escolha a pasta **`extension`** de dentro do que você descompactou.
6. O ícone roxo aparece na barra. Clique nele, depois na engrenagem.
7. Cole o endereço da Vercel no primeiro campo.
8. **Copie a chave do segundo campo** — é ela que vai no `INGEST_TOKEN` lá na Vercel.
9. Clique em **Salvar** e depois em **Testar conexão**.

Se aparecer *"Conectado. O painel está gravando no banco de dados."*, acabou.

---

## Usando

1. Abra o Google Maps numa aba.
2. Clique no ícone da extensão.
3. Escreva onde procurar. **Prefira bairro a cidade inteira** — o Maps entrega
   no máximo algumas dezenas de resultados por busca, então `Savassi BH`
   rende muito mais que `Belo Horizonte` sozinho.
4. Escolha os tipos de comércio.
5. Clique em **Iniciar coleta** e vá fazer outra coisa.

A aba do Maps vai trocar de página sozinha — é a extensão abrindo a ficha de
quem parece não ter site, para confirmar. Não mexa nessa aba enquanto roda;
pode usar o resto do navegador normalmente.

Ao terminar, abra o painel. Clique em **oportunidades** para ver só quem vale
a pena, use o botão **WhatsApp** para puxar conversa, e vá marcando *Contatado*,
*Negociando*, *Fechado*.

Uma nova varredura no mesmo bairro **não apaga suas anotações nem seus status** —
ela só atualiza os dados que vieram do Google.

---

## Quando alguma coisa não funcionar

**"Não consegui rodar dentro do Google Maps"**
A aba do Maps foi aberta antes da extensão existir. Aperte F5 nela.

**A coleta parou no meio**
O Google às vezes pede confirmação de robô. Resolva na aba do Maps e comece
de novo — o que já foi coletado está salvo.

**Vem pouco resultado**
Normal: o Maps limita cada busca. Varra bairro a bairro em vez da cidade toda.

**O painel diz "Sem banco de dados"**
A Parte 2 não foi concluída, ou faltou o Redeploy depois de conectar o Neon.

**A extensão diz que a chave é inválida**
O `INGEST_TOKEN` da Vercel está diferente da chave nas configurações da
extensão. Compare os dois com cuidado e refaça o Redeploy.

---

## Para quem for mexer no código

```
extension/          extensão Chrome (Manifest V3)
  content.js        o scraper — máquina de estados que sobrevive a recarregamentos
  background.js     estado da coleta, fila de envio, retentativa
  popup.*           a telinha do ícone
  lib/classify.js   decide o que conta como site de verdade
web/                painel Next.js
  app/api/leads/    recebe da extensão, lista, exporta CSV
  lib/db.ts         Postgres (Neon), com modo memória para rodar local
  lib/classify.ts   mesma lógica do classificador, do lado do servidor
```

O classificador existe nos dois lados de propósito: a extensão precisa dele
offline, e o servidor reclassifica tudo que chega porque não se confia em
dado vindo de um cliente HTTP. **Se editar as listas de domínio, edite nos dois.**

Rodando o painel na sua máquina:

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Sem `DATABASE_URL` ele funciona em memória — bom para testar, inútil em produção.

### Por que o scraper é uma máquina de estados

Três coisas descobertas testando contra o Maps de verdade, todas anotadas no
começo do `content.js`:

- O site só aparece na ficha do lugar (`a[data-item-id="authority"]`), e a
  ficha **não abre com clique programático** — nem `.click()`, nem sequência
  completa de eventos de mouse. Só navegando até a URL dela.
- Navegar recarrega a página e mata o script. Por isso o trabalho vive em
  `chrome.storage.local` e é retomado a cada carregamento.
- Buscar digitando na caixa não funciona a partir de uma ficha aberta: o
  título da página muda mas a lista nunca aparece. A busca é feita por URL.

E uma no scroll: `scrollTo({behavior:'smooth'})` não move o contêiner da
lista. Só a atribuição direta `scrollTop = scrollHeight`.

---

## Sobre uso responsável

A ferramenta lê dados públicos de empresas — nome, telefone comercial,
endereço, site — no mesmo ritmo de uma pessoa navegando, com pausas entre as
ações. Ainda assim, varredura automatizada contraria os termos de uso do
Google, e varreduras muito longas podem levar a bloqueio temporário do seu IP.
Vá por bairro, sem pressa.

Para contato comercial no Brasil, dado de empresa é diferente de dado pessoal,
mas vale o bom senso de sempre: identifique-se, diga como chegou até eles e
respeite quem pedir para não ser mais procurado.

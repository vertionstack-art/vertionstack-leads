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

O Google Maps mente sobre site. Quatro armadilhas que a ferramenta resolve:

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

**4. E tem site que existe só no cadastro.** Domínio vencido, página parada
em "em construção", conta de hospedagem suspensa, endereço que virou
redirecionamento pro Instagram. O Google continua exibindo o botão. O painel
tem um botão **Conferir sites** que abre cada endereço e diz quais não estão
de pé — esses voltam para a lista de oportunidades. Não custa nada: é o
próprio painel abrindo o site.

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

### Parte 3 — Criar os acessos

Na Vercel, em **Settings → Environment Variables**, crie duas variáveis:

| Nome | Para quê |
|---|---|
| `USUARIOS` | quem entra no painel |
| `INGEST_TOKEN` | quais extensões podem enviar leads |

As duas usam o mesmo formato, `nome:valor`, separando pessoas por vírgula:

```
USUARIOS=lucas:umaSenhaBoa,joao:outraSenhaBoa
INGEST_TOKEN=lucas:vl_aaaa1111...,joao:vl_bbbb2222...
```

Nomes em minúsculas, sem espaço e sem acento. As senhas você escolhe; as
chaves são as que cada extensão gera sozinha (veja a Parte 4).

**Por que cada um com a sua:** é assim que o painel sabe quem coletou cada
comércio e quem já está cuidando dele — vocês param de ligar duas vezes para
a mesma pizzaria. E dá para tirar o acesso de uma pessoa sem trocar o de
todo mundo.

Trabalhando sozinho, cadastre só o seu:

```
USUARIOS=lucas:umaSenhaBoa
INGEST_TOKEN=lucas:vl_aaaa1111...
```

Depois de criar as duas, faça **Redeploy**.

> O formato antigo continua funcionando: uma `DASHBOARD_PASSWORD` sozinha e
> um `INGEST_TOKEN` sem nome viram o usuário `equipe`. Quem já tinha
> configurado assim não precisa mexer em nada.

### Parte 4 — Instalar a extensão

O próprio painel entrega a extensão e repete estas instruções: entre nele e
clique em **Extensão**, no canto superior direito.

1. Baixe o arquivo pelo botão **Baixar extensão** e descompacte num lugar
   definitivo — se você apagar ou mover a pasta depois, o Chrome desativa a
   extensão.
2. No Chrome, abra `chrome://extensions`.
3. Ligue o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e escolha a pasta descompactada.
5. O ícone roxo aparece na barra. Clique nele, depois na engrenagem.
6. Cole o endereço do painel e a mesma chave que está no `INGEST_TOKEN`.
7. Clique em **Salvar** e depois em **Testar conexão**.

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

Antes de sair ligando, clique em **Conferir N sites** no topo. O painel abre um
por um os endereços cadastrados e marca quais estão fora do ar, vazios, sem
HTTPS ou com certificado vencido. Quem não passa no teste volta para as
oportunidades e aparece no filtro *Site não está de pé* — são as conversas mais
fáceis que você vai ter, porque o dono geralmente nem sabe.

Uma nova varredura no mesmo bairro **não apaga suas anotações nem seus status** —
ela só atualiza os dados que vieram do Google.

### O botão COPY

Cada lead tem um botão **COPY**. Ele abre o prompt de abordagem daquele
comércio, pronto para colar no ChatGPT: copie, clique em **Abrir chat**, cole
com Ctrl+V e o chat devolve briefing, três mensagens de WhatsApp, roteiro de
ligação, as objeções mais prováveis com resposta, e uma faixa de preço.

O prompt não é um modelo fixo com o nome trocado. O diagnóstico muda conforme
o que foi encontrado, porque o argumento de venda é outro em cada caso:

| Situação do lead | O ângulo que o prompt monta |
|---|---|
| Site fora do ar | Ele paga por algo que não abre e provavelmente não sabe |
| Certificado vencido | O navegador afasta o cliente com aviso vermelho |
| Só Instagram | Audiência alugada, não aparece no Google |
| Só iFood/Doctoralia | Paga comissão e não é dono do cliente |
| Sem site | Quem busca na região acha o concorrente |

Cada um vem com um aviso de **como não estragar a conversa** — no caso do site
fora do ar, por exemplo, chegar avisando de um problema em vez de vendendo, já
que o dono pode ter sido abandonado por quem fez o site.

A nota do Google entra no argumento: um comércio com 4,9 e 890 avaliações tem
prova social pronta que hoje não tem onde ser mostrada.

### O botão PROPOSTA

Ao lado do COPY, abre o simulador. Você marca o porte do cliente, como a
empresa é registrada, e clica em cada serviço para escolher em que plano ele
entra — **E** (Essencial), **C** (Completo) ou **P** (Premium). Os planos são
cumulativos: o que está no Essencial aparece nos três.

Do lado direito saem as três propostas, já com o valor de entrada, a
mensalidade e **quanto sobra para você** depois dos custos. No fim, um botão
copia tudo formatado para colar no WhatsApp do cliente.

**As regras de preço que o simulador respeita:**

| Regra | Valor | O que faz |
|---|---|---|
| Piso | R$ 387,45 | Nunca passa disso para baixo — é o custo |
| Alvo mínimo | R$ 500 | Avisa quando o Essencial fica abaixo |
| Teto do Premium | R$ 1.200 × porte | Corta o que estourar |

O teto acompanha o porte: micro para em R$ 1.200, pequena em R$ 1.620, média
em R$ 2.220, grande em R$ 3.120. Quando o Premium estoura, ele é cortado no
teto e o simulador avisa — se o cliente comporta mais, o certo é subir o
porte, não forçar a mão.

O custo de cada item aparece na lista (o domínio custa R$ 45/ano e entra como
"incluso" para o cliente). Sem esse número, é fácil fechar negócio no
prejuízo achando que se negociou bem.

### Trabalhando em dupla

Os dois veem a mesma lista, e o painel mostra quem é quem:

- **Quem coletou** vem da chave que a extensão usou para enviar.
- **Quem está cuidando** é quem mexeu no status por último. Aparece embaixo do
  status como *com você* ou *com joão*.
- O seletor **Todo mundo / Meus / Sem dono / De fulano** filtra a lista.

Antes de ligar, olhe se o lead já está com alguém. Se aparecer *com joão*, ele
chegou primeiro. Para devolver um lead para a fila, volte o status para
**Novo** — isso solta o responsável e ele vira *sem dono* de novo.

Os dois nomes saem também no CSV, nas colunas *Responsável* e *Coletado por*.

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
extensão. Compare os dois com cuidado e refaça o Redeploy. Com mais de uma
pessoa, confira também se a vírgula e os dois-pontos estão no lugar:
`lucas:vl_aaa,joao:vl_bbb`.

**"Usuário ou senha incorretos"**
Confira o nome: ele é o que está antes dos dois-pontos em `USUARIOS`, sempre
em minúsculas. Mudar a senha de alguém desconecta só essa pessoa.

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
  app/extensao/     página de download e instalação da extensão
  lib/db.ts         Postgres (Neon), com modo memória para rodar local
  lib/classify.ts   mesma lógica do classificador, do lado do servidor
  lib/verificar-site.ts   abre o site do lead e diz se está mesmo no ar
  scripts/          empacota a extension/ em .zip durante o build
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

### Duas armadilhas do verificador de sites

Site feito em React monta o conteúdo por JavaScript: o HTML que chega tem
título e scripts e quase nenhum texto. Medido num site real de barbearia,
30 KB de HTML para 77 caracteres visíveis. Julgar "página vazia" só pelo
texto marcaria justamente os sites bem-feitos como abandonados — por isso a
regra exige que o HTML inteiro também seja pequeno.

E tempo esgotado não é o mesmo que site morto. DNS que não resolve e conexão
recusada são conclusivos; um timeout pode ser só lentidão. O primeiro caso
vira oportunidade, o segundo fica como *não conclusivo*, para a lista não
encher de lead falso.

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

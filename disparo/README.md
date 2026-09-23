# Vertion Disparo

Programa que roda no seu PC e manda a mensagem de abertura no WhatsApp
para os leads que você marcou no painel.

O caminho é este: no **Vertion Leads** você clica em **CONTACT** nos
comércios que quer abordar → abre este programa → ele carrega essa fila,
confere os números, e vai abrindo o WhatsApp em cada conversa com a
mensagem já escrita.

A mensagem sai assim, com o nome do comércio dentro e o artigo certo:

> Fiz uma coisa aqui pensando **na** Churrascaria do João e queria mostrar
> pra vocês. Teria algum responsável com quem eu possa falar ?

> Fiz uma coisa aqui pensando **no** Restaurante do Zé e queria mostrar
> pra vocês. Teria algum responsável com quem eu possa falar ?

---

## Antes de usar, leia isto

Disparo em massa no WhatsApp é o padrão que a Meta usa para identificar
robô, e o número em risco é o seu canal de vendas. Não existe configuração
que zere esse risco — o que existe é ir devagar.

Por isso o programa já vem com três freios ligados:

| Freio | Padrão | Para quê |
|---|---|---|
| Pausa entre mensagens | 45 a 110 segundos, sorteada | intervalo fixo é assinatura de robô |
| Teto por dia | 40 | continua contando se você fechar e abrir |
| Descanso | 15 min a cada 12 envios | quebra a sequência longa |

**Quanto mais devagar, mais seguro.** Se for começar agora, comece com o
teto em 15 ou 20 por dia na primeira semana.

---

## Instalação (uma vez só)

**1.** Tenha o **WhatsApp instalado no PC** e já conectado com o seu
número. É o app do Windows, não o site.

**2.** Abra o **Prompt de Comando** na pasta `disparo` e rode:

```bash
pip install -r requirements.txt
```

**3.** Copie o arquivo `config.exemplo.json` e renomeie a cópia para
`config.json`.

**4.** Abra o `config.json` no Bloco de Notas e troque
`PONHA-AQUI-A-SUA-CHAVE` pela sua chave — é a mesma que você colocou nas
configurações da extensão.

---

## Usando

Dê **duplo clique em `Vertion Disparo.bat`**. A janela abre.

1. Confira o endereço do painel e a chave (ficam salvos para a próxima).
2. Clique em **Carregar fila**.
3. A lista mostra quem vai receber. Os que aparecem em cinza têm número
   que não serve, e a coluna da direita diz o motivo — telefone fixo, 0800,
   DDD que não existe, sem telefone.
4. Clique no quadradinho da esquerda para tirar alguém desta rodada.
5. Confira a mensagem na caixa de baixo.
6. **Começar a enviar**.

**Enquanto roda, não mexa no mouse nem no teclado.** O programa controla o
teclado de verdade para apertar Enter no WhatsApp — se você clicar em
outra janela, ele para e avisa em vez de digitar no lugar errado.

Para interromper, **Parar**. Ele termina o envio em curso e para antes do
próximo.

---

## O que acontece depois do envio

Cada mensagem que sai, no painel:

- sai da fila do CONTACT
- ganha a data do envio
- muda o status para **contatado**

Por isso rodar de novo nunca manda duas vezes para o mesmo comércio.

---

## Configuração

Tudo no `config.json`:

| Campo | O que é |
|---|---|
| `painel_url` | endereço do Vertion Leads |
| `chave` | a mesma chave da extensão |
| `modelo` | o texto da mensagem; aceita `{artigo}` e `{nome}` |
| `pausa_min_segundos` / `pausa_max_segundos` | faixa da pausa entre envios |
| `limite_por_dia` | teto diário |
| `descanso_a_cada` / `descanso_minutos` | pausa longa a cada N envios |
| `incluir_telefone_fixo` | `true` tenta mandar em fixo também |

Vale variar o `modelo` de vez em quando. Mandar exatamente o mesmo texto
para centenas de números é um dos sinais mais fáceis de detectar.

---

## Quando der problema

**"Chave recusada"** — a chave do `config.json` não bate com o
`INGEST_TOKEN` da Vercel.

**"O WhatsApp não está na frente"** — o app não abriu a tempo, ou você
clicou em outra janela. Se acontecer sempre, confirme que o WhatsApp está
aberto e logado antes de começar.

**"Falta o pyautogui"** — o passo 2 da instalação não rodou.

**A fila está vazia** — nenhum lead marcado com CONTACT no painel.

---

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `app.py` | a janela |
| `nucleo.py` | a lógica do disparo, sem tela |
| `painel.py` | busca a fila e carimba quem recebeu |
| `telefone.py` | descarta número que não serve |
| `mensagem.py` | monta a frase com "na/no" certo |
| `whatsapp.py` | abre o chat e aperta Enter |
| `config.json` | suas configurações (não vai para o GitHub) |
| `enviados.json` | contagem do dia (não vai para o GitHub) |

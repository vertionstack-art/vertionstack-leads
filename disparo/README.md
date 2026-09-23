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
| Pausa entre mensagens | sorteada dentro da faixa que você define | intervalo fixo é assinatura de robô |
| Teto por dia | 40 | continua contando se você fechar e abrir |
| Descanso | 15 min a cada 12 envios | quebra a sequência longa |

Tudo isso se ajusta na caixa **Ritmo**, dentro do programa. **Quanto mais
devagar, mais seguro** — não existe número certo, existe o risco que você
aceita correr com o número que é o seu canal de vendas.

---

## Gerar o .exe para outra máquina

```bash
python empacotar.py
```

Sai um `Vertion Disparo.zip` de ~20 MB com o programa inteiro dentro: quem
receber não precisa de Python nem de instalar nada, só de Windows com o
WhatsApp do PC conectado.

O script corta OpenCV, PyQt5 e numpy do pacote — eles vêm de carona com o
pyautogui e somam mais de 170 MB de coisa que este programa nunca usa.

---

## Instalação (uma vez só)

**1.** Tenha o **WhatsApp instalado no PC** e já conectado com o seu
número. É o app do Windows, não o site.

**2.** Abra o **Prompt de Comando** na pasta `disparo` e rode:

```bash
pip install -r requirements.txt
```

**3.** Pronto. A chave você cola dentro do próprio programa, no campo
**Sua chave**, na primeira vez que abrir — ele guarda sozinho para as
próximas. É a mesma chave que está nas configurações da extensão.

> Se preferir deixar tudo pronto antes, dá para copiar o
> `config.exemplo.json` para `config.json` e editar no Bloco de Notas. Mas
> não é necessário.

---

## Usando

Dê **duplo clique em `Vertion Disparo.bat`**. A janela abre.

1. Confira o endereço do painel e a chave (ficam salvos para a próxima).
2. Ajuste o **Ritmo**, se quiser — a pausa entre uma mensagem e outra sai
   sorteada entre a mínima e a máxima. Também fica salvo.
3. Clique em **Carregar fila**.
4. A lista mostra quem vai receber. Os que aparecem em cinza têm número
   que não serve, e a coluna da direita diz o motivo — telefone fixo, 0800,
   DDD que não existe, sem telefone.
5. Clique no quadradinho da esquerda para tirar alguém desta rodada.
6. Confira a mensagem na caixa de baixo.
7. **Começar a enviar**.

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
| `folga_chat_segundos` | quanto esperar o chat montar antes de digitar (padrão 1,2) |

Cada mensagem leva por volta de **4 segundos** para sair. Se no seu PC
alguma falhar com *"o WhatsApp não está na frente"*, aumente o
`folga_chat_segundos` para 2 ou 2,5 — é o tempo que o app leva para
montar a conversa.

Vale variar o `modelo` de vez em quando. Mandar exatamente o mesmo texto
para centenas de números é um dos sinais mais fáceis de detectar.

---

## Quando der problema

**"Chave recusada"** — a chave do `config.json` não bate com o
`INGEST_TOKEN` da Vercel.

**"O WhatsApp não está na frente"** — o app não abriu a tempo, ou você
clicou em outra janela. O programa tenta puxar a janela sozinho antes de
desistir; se acontecer sempre, confirme que o WhatsApp está aberto e
logado antes de começar.

**A mensagem abre o chat mas não envia** — era um defeito de verdade, já
corrigido. Se voltar a acontecer, aumente o `espera_abrir` em
`whatsapp.py`: o app pode estar demorando mais que 7 segundos para montar
a conversa no seu PC.

**"Falta o pyautogui"** — o passo 2 da instalação não rodou.

**A fila está vazia** — nenhum lead marcado com CONTACT no painel.

**Mandou o primeiro e parou** — não acontece mais: agora uma falha em um
comércio não derruba os outros, e o motivo aparece na linha dele. Se
parar mesmo assim, o arquivo `disparo.log` na pasta guarda o que houve em
cada envio.

**"Parei porque o mouse encostou no canto superior esquerdo"** — esse é o
freio de emergência, e serve para você abortar levando o mouse ali. Se
disparou sem querer, tire o mouse do canto e comece de novo.

---

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `app.py` | a janela |
| `empacotar.py` | gera o .exe e o zip para distribuir |
| `nucleo.py` | a lógica do disparo, sem tela |
| `painel.py` | busca a fila e carimba quem recebeu |
| `telefone.py` | descarta número que não serve |
| `mensagem.py` | monta a frase com "na/no" certo |
| `whatsapp.py` | abre o chat, cola a mensagem e aperta Enter |
| `config.json` | suas configurações (não vai para o GitHub) |
| `enviados.json` | contagem do dia (não vai para o GitHub) |
| `disparo.log` | o que aconteceu em cada envio (não vai para o GitHub) |

# -*- coding: utf-8 -*-
"""
Abre o chat no WhatsApp instalado no PC e manda a mensagem.

Usa o protocolo `whatsapp://send`, que o aplicativo registra quando é
instalado: o Windows entrega a chamada direto ao app, sem navegador no
meio e sem Selenium.

Duas coisas custaram caro para descobrir, e as duas estão resolvidas aqui:

**O "&" da URL não pode passar por um shell.** Chamado via `cmd /c start`,
o cmd trata "&" como separador de comandos e corta a URL no meio — o chat
abria certo e a mensagem nunca chegava na caixa. `os.startfile` entrega o
link ao Windows sem shell no caminho.

**O WhatsApp acrescenta, não substitui.** Texto que já estivesse na caixa
daquela conversa ficava grudado na frente do novo, e mandar duas vezes a
mesma frase colada é pior do que não mandar. Por isso o texto vai pela
área de transferência, depois de limpar a caixa — e não mais pela URL.
"""

from __future__ import annotations

import os
import time
import urllib.parse

try:
    import pyautogui
except ImportError:  # pragma: no cover
    pyautogui = None

try:
    import pygetwindow
except ImportError:  # pragma: no cover
    pygetwindow = None

try:
    import pyperclip
except ImportError:  # pragma: no cover
    pyperclip = None


class ErroDoWhatsApp(Exception):
    pass


def dependencias_ok() -> tuple[bool, str]:
    """Diz o que falta instalar, em vez de estourar no meio da fila."""
    faltando = [
        nome
        for nome, modulo in (("pyautogui", pyautogui), ("pygetwindow", pygetwindow), ("pyperclip", pyperclip))
        if modulo is None
    ]
    if faltando:
        return False, f"Falta instalar: {', '.join(faltando)}. Rode: pip install -r requirements.txt"
    return True, ""


def explicar(erro: Exception) -> str:
    """
    Traduz a exceção para uma frase que diga o que fazer.

    O caso que mais engana é o freio de emergência do pyautogui: ele
    dispara quando o ponteiro do mouse encosta no canto superior esquerdo
    da tela, e existe justamente para dar um jeito de abortar. Só que o
    erro dele não diz nada disso — some como "FailSafeException" e a
    pessoa fica achando que o programa quebrou sozinho.
    """
    if isinstance(erro, ErroDoWhatsApp):
        return str(erro)

    nome = type(erro).__name__
    if "FailSafe" in nome:
        return (
            "Parei porque o mouse encostou no canto superior esquerdo da tela — "
            "esse é o freio de emergência. Tire o mouse de lá e comece de novo."
        )
    if "Pyperclip" in nome:
        return (
            "Não consegui usar a área de transferência. Costuma ser outro programa "
            "segurando o Ctrl+C; feche gerenciadores de clipboard e tente de novo."
        )
    return f"{nome}: {erro}"


def _janela_do_whatsapp():
    """
    A janela do WhatsApp, se estiver na frente.

    Serve de trava antes de mexer no teclado: sem ela, um clique acidental
    em outra janela faria a mensagem ser digitada em qualquer lugar — num
    e-mail, num documento, no navegador.
    """
    if pygetwindow is None:
        return None
    try:
        ativa = pygetwindow.getActiveWindow()
    except Exception:
        return None
    if ativa is None:
        return None
    titulo = (getattr(ativa, "title", "") or "").lower()
    return ativa if "whatsapp" in titulo else None


def _trazer_para_frente(tentativas: int = 3) -> bool:
    """
    Puxa a janela do WhatsApp para a frente.

    Abrir o protocolo não basta: quando a conversa pedida já é a que está
    aberta, o Windows não tem o que mudar e deixa o foco onde estava — que
    pode ser o programa, o navegador, qualquer coisa. Sem este empurrão o
    envio parava na trava da janela em vez de acontecer.
    """
    if pygetwindow is None:
        return False
    if _janela_do_whatsapp() is not None:
        return True

    for _ in range(tentativas):
        try:
            janelas = [j for j in pygetwindow.getWindowsWithTitle("WhatsApp") if j.title]
        except Exception:
            return False
        if not janelas:
            return False

        j = janelas[0]
        try:
            if j.isMinimized:
                j.restore()
            j.activate()
        except Exception:
            # activate falha quando outra janela está segurando o foco;
            # minimizar e restaurar contorna sem depender de permissão
            try:
                j.minimize()
                time.sleep(0.3)
                j.restore()
            except Exception:
                pass
        time.sleep(0.6)
        if _janela_do_whatsapp() is not None:
            return True
    return False


def _exigir_janela(momento: str) -> None:
    if _janela_do_whatsapp() is None:
        raise ErroDoWhatsApp(
            f"O WhatsApp não está na frente ({momento}). Ele pode não ter aberto, ou você "
            "clicou em outra janela — parei para não digitar no lugar errado."
        )


def abrir_conversa(numero: str, texto: str = "") -> None:
    """
    Manda o Windows abrir o chat.

    `numero` vai só com dígitos e o 55 na frente. O `texto` é opcional e
    normalmente fica vazio: quem escreve na caixa é o `enviar`, que antes
    limpa o que estava lá.
    """
    link = "whatsapp://send?phone=" + urllib.parse.quote(numero)
    if texto:
        link += "&text=" + urllib.parse.quote(texto, safe="")
    os.startfile(link)  # noqa: S606 — link de protocolo, não executável


def _esperar_janela(teto: float) -> bool:
    """
    Espera a janela aparecer, e segue assim que ela aparecer.

    Medido neste PC, o WhatsApp vem para a frente em 0,0 a 0,3 segundo. O
    código dormia 7 segundos fixos por mensagem — quase tudo desperdício.
    O teto continua existindo para o caso de a máquina estar carregada.
    """
    limite = time.time() + teto
    while time.time() < limite:
        if _janela_do_whatsapp() is not None:
            return True
        _trazer_para_frente(tentativas=1)
        time.sleep(0.15)
    return False


def enviar(numero: str, texto: str, teto_abrir: float = 12.0, folga_chat: float = 1.2,
           espera_colar: float = 0.8) -> None:
    """
    Abre a conversa, escreve a mensagem e aperta Enter.

    O chat é aberto **com** o texto na URL de propósito, e não vazio: é
    isso que joga o foco do teclado para dentro da caixa de mensagem. Sem
    esse foco, o Ctrl+A seguinte selecionaria a conversa inteira em vez do
    conteúdo da caixa — testei, e o Delete não apaga nada enquanto o
    Ctrl+V também não cola. Tentar acertar a caixa com um clique por
    coordenada foi pior ainda: 40 pixels de erro e o clique cai no corpo
    do chat.

    Com o foco garantido, o texto que veio pela URL é apagado e reposto
    pela área de transferência. Parece redundante e não é: quando já havia
    rascunho naquela conversa, o WhatsApp acrescenta em vez de substituir,
    e a mensagem sairia duplicada.
    """
    ok, falta = dependencias_ok()
    if not ok:
        raise ErroDoWhatsApp(falta)

    abrir_conversa(numero, texto)
    if not _esperar_janela(teto_abrir):
        _exigir_janela("ao abrir a conversa")

    # a janela já apareceu; esta folga é para o chat terminar de montar
    time.sleep(folga_chat)
    _exigir_janela("ao abrir a conversa")

    pyautogui.hotkey("ctrl", "a")
    time.sleep(0.12)
    pyautogui.press("delete")
    time.sleep(0.18)

    guardado = None
    try:
        guardado = pyperclip.paste()  # devolve a área de transferência depois
    except Exception:
        pass

    try:
        pyperclip.copy(texto)
        time.sleep(0.2)
        _exigir_janela("antes de colar")
        pyautogui.hotkey("ctrl", "v")
        time.sleep(espera_colar)

        _exigir_janela("antes de enviar")
        pyautogui.press("enter")
        time.sleep(0.4)
    finally:
        # não deixar a mensagem de venda na área de transferência da pessoa
        if guardado is not None:
            try:
                time.sleep(0.3)
                pyperclip.copy(guardado)
            except Exception:
                pass


def fechar_conversa() -> None:
    """
    Ctrl+W entre um envio e outro.

    Sem isso as conversas abertas vão se empilhando, e depois de algumas
    dezenas o app fica lento o bastante para as esperas acima não darem
    mais conta.
    """
    if pyautogui is None or _janela_do_whatsapp() is None:
        return
    pyautogui.hotkey("ctrl", "w")

# -*- coding: utf-8 -*-
"""
Abre o chat no WhatsApp instalado no PC e digita a mensagem.

Usa o protocolo `whatsapp://send?phone=...&text=...`, que o aplicativo do
Windows registra quando é instalado. É o caminho mais curto que existe: o
Windows entrega a chamada direto ao app, sem navegador no meio e sem
Selenium — e o chat abre já com o texto escrito na caixa.

O que sobra é apertar Enter, e é aí que mora a decisão. O envio é
automatizado por pyautogui, que controla o teclado de verdade: enquanto o
programa roda, o computador está ocupado. Mover o mouse ou clicar em outra
janela faz a tecla cair no lugar errado, então este módulo confere qual
janela está na frente antes de cada Enter.
"""

from __future__ import annotations

import subprocess
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


class ErroDoWhatsApp(Exception):
    pass


def dependencias_ok() -> tuple[bool, str]:
    """Diz o que falta instalar, em vez de estourar no meio da fila."""
    if pyautogui is None:
        return False, "Falta o pyautogui. Rode: pip install -r requirements.txt"
    if pygetwindow is None:
        return False, "Falta o pygetwindow. Rode: pip install -r requirements.txt"
    return True, ""


def _janela_do_whatsapp():
    """
    A janela do WhatsApp, se estiver na frente.

    Serve de trava antes de apertar Enter: sem ela, um clique acidental em
    outra janela faria a mensagem ser digitada em qualquer lugar — num
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


def abrir_conversa(numero: str, texto: str) -> None:
    """
    Manda o Windows abrir o chat com a mensagem já na caixa.

    `numero` vai só com dígitos e o 55 na frente. O texto é codificado para
    caber na URL — sem isso, acento e interrogação cortam a mensagem no
    meio.
    """
    link = "whatsapp://send?phone={}&text={}".format(
        urllib.parse.quote(numero),
        urllib.parse.quote(texto, safe=""),
    )
    # start precisa de um título vazio antes do link, senão trata a URL
    # como título da janela e não abre nada
    subprocess.run(["cmd", "/c", "start", "", link], check=False, shell=False)


def enviar(numero: str, texto: str, espera_abrir: float = 6.0, espera_digitar: float = 1.5) -> None:
    """
    Abre a conversa e aperta Enter.

    As duas esperas existem porque o app não avisa quando terminou de
    carregar: a primeira dá tempo de a janela aparecer e o chat montar, e a
    segunda dá tempo de o texto chegar inteiro na caixa. Apertar Enter cedo
    demais manda mensagem pela metade, ou manda nada.
    """
    ok, falta = dependencias_ok()
    if not ok:
        raise ErroDoWhatsApp(falta)

    abrir_conversa(numero, texto)
    time.sleep(espera_abrir)

    if _janela_do_whatsapp() is None:
        raise ErroDoWhatsApp(
            "O WhatsApp não está na frente. Ele pode não ter aberto, ou você clicou "
            "em outra janela — não apertei Enter para a mensagem não cair no lugar errado."
        )

    time.sleep(espera_digitar)

    if _janela_do_whatsapp() is None:
        raise ErroDoWhatsApp("A janela do WhatsApp saiu da frente antes do envio.")

    pyautogui.press("enter")


def fechar_conversa() -> None:
    """
    Ctrl+W entre um envio e outro.

    Sem isso as conversas abertas vão se empilhando, e depois de algumas
    dezenas o app fica lento o bastante para as esperas acima não darem mais
    conta.
    """
    if pyautogui is None or _janela_do_whatsapp() is None:
        return
    pyautogui.hotkey("ctrl", "w")

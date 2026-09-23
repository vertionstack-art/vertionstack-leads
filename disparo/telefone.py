# -*- coding: utf-8 -*-
"""
Confere se um telefone do Google Maps serve para mandar WhatsApp.

Não existe jeito gratuito e confiável de perguntar ao WhatsApp "esse
número tem conta?" antes de abrir o chat — a única API que responde isso é
a oficial, que exige opt-in. O que dá para fazer aqui é o filtro de
formato, e ele elimina bastante lixo: fixo sem WhatsApp, 0800, número
truncado, DDD que não existe.

Vale o esforço porque cada número ruim custa caro em dois sentidos: abre
uma janela de erro que trava a fila, e abrir muitos chats inválidos em
sequência é um dos sinais que o WhatsApp usa para identificar disparo
automático.
"""

from __future__ import annotations

import re

# DDDs que existem de verdade. A faixa 11–99 tem buracos, e número com DDD
# inexistente é quase sempre erro de captura do Maps.
DDDS_VALIDOS = {
    11, 12, 13, 14, 15, 16, 17, 18, 19,          # São Paulo
    21, 22, 24, 27, 28,                           # Rio e Espírito Santo
    31, 32, 33, 34, 35, 37, 38,                   # Minas
    41, 42, 43, 44, 45, 46, 47, 48, 49,           # Paraná e Santa Catarina
    51, 53, 54, 55,                               # Rio Grande do Sul
    61, 62, 63, 64, 65, 66, 67, 68, 69,           # Centro-Oeste e Norte
    71, 73, 74, 75, 77, 79,                       # Bahia e Sergipe
    81, 82, 83, 84, 85, 86, 87, 88, 89,           # Nordeste
    91, 92, 93, 94, 95, 96, 97, 98, 99,           # Norte e Maranhão
}


class Resultado:
    """O que se descobriu sobre o número, com o motivo junto."""

    def __init__(self, ok: bool, numero: str = "", motivo: str = "", fixo: bool = False):
        self.ok = ok
        self.numero = numero  # só dígitos, com 55 na frente
        self.motivo = motivo
        self.fixo = fixo

    def __repr__(self) -> str:
        return f"<Resultado ok={self.ok} {self.numero or self.motivo}>"


def normalizar(bruto: str | None) -> Resultado:
    """
    Transforma o que veio do Maps em número pronto para o WhatsApp.

    Aceita "(63) 99999-1234", "+55 63 99999 1234" e "6399991234". Devolve
    sempre no formato 55DDXXXXXXXXX, que é o que o link do WhatsApp espera.
    """
    texto = (bruto or "").strip()
    d = re.sub(r"\D", "", texto)
    if not d:
        return Resultado(False, motivo="sem telefone")

    # número escrito com código internacional de outro país. Lead de fora do
    # Brasil é abordado por e-mail, não por aqui — e "+1" viraria DDD 13 sem
    # esta checagem, o que rejeitaria pelo motivo errado.
    if texto.startswith("+") and not d.startswith("55"):
        return Resultado(False, motivo="número de fora do Brasil — esse vai por e-mail")

    # 0800, 0300, 4004 e afins não têm WhatsApp e nem DDD
    if d.startswith(("0800", "0300", "0500", "0900")):
        return Resultado(False, motivo="número 0800/0300 — não tem WhatsApp")

    # tira o zero de operadora que o Maps às vezes traz ("063 99999-1234").
    # Só quando sobra um telefone de tamanho válido: senão "(00) 99999-1234"
    # viraria DDD 09 e o log diria o dígito errado.
    if d.startswith("0") and len(d) in (11, 12) and d[1] != "0":
        d = d[1:]

    if d.startswith("55") and len(d) in (12, 13):
        d = d[2:]

    if len(d) not in (10, 11):
        return Resultado(False, motivo=f"tem {len(d)} dígitos — não é telefone brasileiro completo")

    ddd = int(d[:2])
    if ddd not in DDDS_VALIDOS:
        return Resultado(False, motivo=f"DDD {d[:2]} não existe")

    assinante = d[2:]

    # celular no Brasil tem 9 dígitos e começa com 9. Com 8 dígitos é fixo,
    # e fixo raramente tem WhatsApp — passa, mas marcado, para você decidir.
    if len(assinante) == 9:
        if assinante[0] != "9":
            return Resultado(False, motivo="tem 9 dígitos mas não começa com 9")
        return Resultado(True, numero="55" + d)

    if assinante[0] in "2345":
        return Resultado(True, numero="55" + d, motivo="parece telefone fixo", fixo=True)

    # 8 dígitos começando com 9 é celular antigo, de antes do nono dígito:
    # o WhatsApp quase sempre já migrou para a versão com o 9 na frente
    return Resultado(True, numero="55" + d[:2] + "9" + assinante, motivo="acrescentei o nono dígito")


def formatar(numero: str) -> str:
    """55639999912345 → +55 (63) 99999-1234, para ler no log sem esforço."""
    d = re.sub(r"\D", "", numero or "")
    if d.startswith("55"):
        d = d[2:]
    if len(d) == 11:
        return f"+55 ({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"+55 ({d[:2]}) {d[2:6]}-{d[6:]}"
    return numero

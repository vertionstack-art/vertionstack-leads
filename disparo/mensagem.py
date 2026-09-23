# -*- coding: utf-8 -*-
"""
Monta a mensagem de abertura com o nome do comércio dentro.

O trabalho todo aqui é acertar uma palavra: "na Churrascaria do João" ou
"no Restaurante do Zé". Errar o artigo é a diferença entre uma mensagem
que parece escrita por uma pessoa e uma que parece disparo automático —
que é exatamente o que ela não pode parecer.

Português não entrega o gênero de graça. "Pizzaria" é feminino, "Salão" é
masculino, e "Restaurante" termina em -e sem dizer nada. Então são duas
camadas: uma lista de palavras que aparecem em nome de comércio, e uma
regra de terminação para o resto.
"""

from __future__ import annotations

import re
import unicodedata

# ----------------------------------------------------------------- gênero

# Palavras que abrem nome de comércio, com o gênero que ninguém adivinha
# pela terminação. É a lista que decide na maioria dos casos reais.
MASCULINOS = {
    "restaurante", "bar", "hotel", "mercado", "supermercado", "acougue",
    "salao", "atelie", "escritorio", "consultorio", "laboratorio", "centro",
    "espaco", "studio", "estudio", "instituto", "colegio", "hospital",
    "posto", "petshop", "pet", "shopping", "buffet", "motel", "clube",
    "cartorio", "deposito", "armazem", "comercio", "grupo", "ponto",
    "sabor", "templo", "ateliê", "auto", "lava", "hostel", "quiosque",
    "empório", "emporio", "bistro", "bistrô", "café", "cafe", "sushi",
    "spa", "gym", "box", "point", "recanto", "rancho", "sitio", "chalé",
    "chale", "casarao", "solar", "palacio", "mundo", "reino", "cantinho",
}

FEMININOS = {
    "barbearia", "pizzaria", "padaria", "confeitaria", "doceria", "sorveteria",
    "hamburgueria", "lanchonete", "cafeteria", "chocolateria", "churrascaria",
    "pastelaria", "clinica", "farmacia", "otica", "loja", "oficina", "academia",
    "escola", "creche", "pousada", "imobiliaria", "corretora", "agencia",
    "casa", "boutique", "joalheria", "papelaria", "floricultura", "livraria",
    "lavanderia", "serralheria", "marcenaria", "vidracaria", "borracharia",
    "funilaria", "estetica", "esmalteria", "unha", "beleza", "distribuidora",
    "empresa", "construtora", "transportadora", "pizza", "adega", "tapiocaria",
    "marmitaria", "cantina", "galeria", "arena", "vila", "fazenda", "chacara",
    "barbeira", "companhia", "sorveteira", "pescaria", "peixaria", "quitanda",
}

# Terminações que resolvem o que a lista não cobre.
FIM_FEMININO = ("a", "ade", "ao", "cao", "gem", "ice", "ura")
FIM_MASCULINO = ("o", "or", "l", "m", "r", "s", "u", "im", "om", "um")


def _sem_acento(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def _primeira_palavra(nome: str) -> str:
    """
    A palavra que manda no artigo.

    "Churrascaria do João" → churrascaria. Ignora um "O"/"A" inicial, que
    já é artigo ("A Casa do Pão" → casa), e limpa pontuação.
    """
    limpo = re.sub(r"[^\w\s]", " ", _sem_acento(nome or "")).strip().lower()
    partes = [p for p in limpo.split() if p]
    if not partes:
        return ""
    if partes[0] in {"o", "a", "os", "as"} and len(partes) > 1:
        return partes[1]
    return partes[0]


def genero_do_nome(nome: str) -> str:
    """Devolve 'f' ou 'm'. Na dúvida devolve 'f', que é o caso mais comum."""
    p = _primeira_palavra(nome)
    if not p:
        return "f"

    if p in FEMININOS:
        return "f"
    if p in MASCULINOS:
        return "m"

    # "-ão" vira "ao" sem acento e é quase sempre masculino em nome de
    # comércio (Salão, Portão, Galpão), mas "-ção" é feminino (Construção)
    if p.endswith("cao") or p.endswith("sao"):
        return "f"
    if p.endswith("ao"):
        return "m"

    # o plural de "-ção" perde o til e vira "coes": Construções, Confecções,
    # Instalações. Sem esta linha cai na regra do "-s" e sai como masculino.
    if p.endswith("coes") or p.endswith("soes") or p.endswith("oes"):
        return "f"

    if p.endswith("a"):
        return "f"
    if p.endswith(FIM_MASCULINO):
        return "m"
    return "f"


def artigo(nome: str) -> str:
    """"na" ou "no", pronto para entrar na frase."""
    return "na" if genero_do_nome(nome) == "f" else "no"


# ---------------------------------------------------------------- mensagem

MODELO = (
    "Fiz uma coisa aqui pensando {artigo} {nome} e queria mostrar pra vocês. "
    "Teria algum responsável com quem eu possa falar ?"
)


def _nome_para_frase(nome: str) -> str:
    """
    Tira o artigo que já vem no nome.

    "A Casa do Pão" com "na" na frente vira "na A Casa do Pão". O artigo
    quem põe é a frase, então o nome entra sem ele.
    """
    limpo = (nome or "").strip()
    m = re.match(r"^(?:[AaOo]|[Aa]s|[Oo]s)\s+(?=\S)", limpo)
    return limpo[m.end():] if m else limpo


def montar(nome_do_comercio: str, modelo: str | None = None) -> str:
    """
    Escreve a mensagem para um comércio.

    O modelo aceita {artigo} e {nome}, para dar espaço a variações sem
    mexer em código — mandar sempre o mesmo texto para centenas de números
    é o jeito mais rápido de o WhatsApp classificar tudo como disparo.
    """
    bruto = (nome_do_comercio or "").strip()
    return (modelo or MODELO).format(artigo=artigo(bruto), nome=_nome_para_frase(bruto))

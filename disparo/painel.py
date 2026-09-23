# -*- coding: utf-8 -*-
"""
Conversa com o Vertion Leads: busca a fila e devolve o que foi feito.

O programa não guarda lista própria de quem contatar. A fila mora no
painel, onde o botão CONTACT a monta, e é lida a cada rodada — assim o que
você marcar do celular, no meio do disparo, já entra na próxima leva, e
tirar alguém da fila tem efeito imediato.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


class ErroDoPainel(Exception):
    pass


class Painel:
    def __init__(self, url_base: str, chave: str, tempo_limite: int = 20):
        self.url_base = (url_base or "").rstrip("/")
        self.chave = chave
        self.tempo_limite = tempo_limite

    # ------------------------------------------------------------ interno

    def _pedir(self, caminho: str, metodo: str = "GET", corpo: dict | None = None) -> dict:
        url = self.url_base + caminho
        dados = json.dumps(corpo).encode("utf-8") if corpo is not None else None

        req = urllib.request.Request(url, data=dados, method=metodo)
        req.add_header("x-api-key", self.chave)
        req.add_header("accept", "application/json")
        if dados:
            req.add_header("content-type", "application/json")

        try:
            with urllib.request.urlopen(req, timeout=self.tempo_limite) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 401:
                raise ErroDoPainel(
                    "Chave recusada. Confira INGEST_TOKEN no config.json — "
                    "é a mesma chave que você pôs na extensão."
                ) from e
            raise ErroDoPainel(f"O painel respondeu {e.code} em {caminho}.") from e
        except urllib.error.URLError as e:
            raise ErroDoPainel(
                f"Não consegui falar com {self.url_base}. Confira a internet e o endereço. ({e.reason})"
            ) from e

    # ------------------------------------------------------------- leitura

    def fila(self, limite: int = 500) -> list[dict]:
        """
        Os leads marcados com CONTACT que ainda não receberam mensagem.

        Filtra o já-contatado aqui, e não no painel, porque o painel guarda
        o carimbo mas continua mostrando o lead na fila — é útil ver lá que
        aquele já foi.
        """
        p = urllib.parse.urlencode({"fila": "1", "limit": limite, "ordem": "temperatura"})
        resposta = self._pedir(f"/api/leads?{p}")
        if not resposta.get("ok"):
            raise ErroDoPainel(resposta.get("erro") or "O painel recusou a consulta.")

        leads = resposta.get("leads") or []
        return [l for l in leads if not l.get("contatadoEm")]

    # ------------------------------------------------------------- escrita

    def marcar_enviado(self, lead_id: str) -> None:
        """
        Carimba a data do envio e tira o lead da fila.

        Sai da fila de propósito: se a mensagem foi, o próximo passo é
        esperar resposta, não mandar de novo. O status vira "contatado",
        que é o mesmo que você marcaria à mão no painel.
        """
        agora = datetime.now(timezone.utc).isoformat()
        self._pedir(
            f"/api/leads/{urllib.parse.quote(lead_id, safe='')}",
            metodo="PATCH",
            corpo={"contato": False, "contatadoEm": agora, "status": "contatado"},
        )

    def anotar(self, lead_id: str, texto: str) -> None:
        """Escreve na anotação do lead — usado para registrar por que um número falhou."""
        self._pedir(
            f"/api/leads/{urllib.parse.quote(lead_id, safe='')}",
            metodo="PATCH",
            corpo={"notes": texto},
        )

    def tirar_da_fila(self, lead_id: str) -> None:
        """Tira da fila sem marcar como contatado — para número que não serve."""
        self._pedir(
            f"/api/leads/{urllib.parse.quote(lead_id, safe='')}",
            metodo="PATCH",
            corpo={"contato": False},
        )

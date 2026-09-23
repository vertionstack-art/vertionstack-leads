# -*- coding: utf-8 -*-
"""
A lógica do disparo, sem nenhuma tela.

Fica separado da interface porque são dois ritmos diferentes: aqui o
trabalho é longo e bloqueia (abrir chat, esperar, apertar Enter, dormir um
minuto), e uma janela que fica parada esperando isso aparece como
"não está respondendo" para o Windows.

Então a interface roda este código numa linha de execução própria e
escuta os avisos que ele manda de volta, em vez de chamar direto.
"""

from __future__ import annotations

import json
import random
import threading
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import mensagem
import telefone
import whatsapp
from painel import ErroDoPainel, Painel

AQUI = Path(__file__).parent
CONFIG = AQUI / "config.json"
HISTORICO = AQUI / "enviados.json"
REGISTRO = AQUI / "disparo.log"


def anotar_no_log(texto: str) -> None:
    """
    Guarda em arquivo o que aconteceu.

    Existe porque erro que só aparece na barra de estado some quando a
    janela fecha, e aí não há como saber por que a fila parou na segunda
    mensagem. Aqui fica.
    """
    try:
        with REGISTRO.open("a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S}  {texto}" + chr(10))
    except Exception:
        pass  # não vale derrubar um disparo por causa do log

PADRAO = {
    "painel_url": "https://vertionstack-leads.vercel.app",
    "chave": "",
    "modelo": mensagem.MODELO,
    "pausa_min_segundos": 45,
    "pausa_max_segundos": 110,
    "limite_por_dia": 40,
    "descanso_a_cada": 12,
    "descanso_minutos": 15,
    "incluir_telefone_fixo": False,
    # quanto esperar o WhatsApp. Medido neste PC a janela vem em 0,3s e o
    # chat monta em 1s; num computador mais lento vale aumentar a folga.
    "folga_chat_segundos": 1.2,
}


# ------------------------------------------------------------ configuração


def carregar_config() -> dict:
    cfg = dict(PADRAO)
    if CONFIG.exists():
        try:
            cfg.update(json.loads(CONFIG.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            pass
    return cfg


def salvar_config(cfg: dict) -> None:
    CONFIG.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")


# ------------------------------------------------------- contagem do dia


def enviados_hoje() -> int:
    """
    Quantas mensagens já saíram hoje.

    Em arquivo, e não em memória, porque o teto é diário: fechar e abrir o
    programa não pode zerar a conta, senão o limite não limita nada.
    """
    if not HISTORICO.exists():
        return 0
    try:
        h = json.loads(HISTORICO.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return 0
    return int(h.get("enviados", 0)) if h.get("dia") == str(date.today()) else 0


def somar_enviado() -> int:
    n = enviados_hoje() + 1
    HISTORICO.write_text(
        json.dumps({"dia": str(date.today()), "enviados": n}, indent=2), encoding="utf-8"
    )
    return n


# ------------------------------------------------------------------ fila


@dataclass
class Alvo:
    """Um lead da fila, já com o número tratado e o texto pronto."""

    lead_id: str
    nome: str
    telefone_bruto: str
    numero: str = ""
    texto: str = ""
    servivel: bool = True
    motivo: str = ""
    marcado: bool = True  # se vai nesta rodada — a interface deixa desmarcar

    @property
    def telefone_bonito(self) -> str:
        return telefone.formatar(self.numero) if self.numero else (self.telefone_bruto or "—")


def montar_fila(cfg: dict) -> tuple[list[Alvo], list[Alvo]]:
    """
    Busca a fila no painel e separa o que dá para mandar do que não dá.

    Devolve (serviveis, descartados). O descarte vem com motivo escrito
    para aparecer na tela: número ruim sem explicação parece defeito do
    programa, e a pessoa fica tentando de novo.
    """
    p = Painel(cfg["painel_url"], cfg["chave"])
    leads = p.fila()

    bons: list[Alvo] = []
    ruins: list[Alvo] = []

    for lead in leads:
        alvo = Alvo(
            lead_id=lead.get("id", ""),
            nome=lead.get("name", "?"),
            telefone_bruto=lead.get("phone") or "",
        )
        r = telefone.normalizar(alvo.telefone_bruto)

        if not r.ok:
            alvo.servivel = False
            alvo.motivo = r.motivo
            alvo.marcado = False
            ruins.append(alvo)
            continue

        if r.fixo and not cfg.get("incluir_telefone_fixo"):
            alvo.servivel = False
            alvo.motivo = "telefone fixo — raramente tem WhatsApp"
            alvo.marcado = False
            ruins.append(alvo)
            continue

        alvo.numero = r.numero
        alvo.motivo = r.motivo
        alvo.texto = mensagem.montar(alvo.nome, cfg.get("modelo"))
        bons.append(alvo)

    return bons, ruins


# --------------------------------------------------------------- disparo


@dataclass
class Aviso:
    """O que o disparo conta para a interface enquanto trabalha."""

    tipo: str  # 'enviando' | 'enviado' | 'falhou' | 'esperando' | 'fim' | 'erro'
    texto: str = ""
    indice: int = 0
    total: int = 0
    alvo: Alvo | None = None


@dataclass
class Disparo:
    """
    Percorre a lista mandando as mensagens, e pode ser parado no meio.

    O `parar` é um sinal e não um `if` solto: a espera entre mensagens
    chega a passar de um minuto, e uma variável simples só seria olhada
    quando o sono acabasse — ou seja, o botão Parar demoraria um minuto
    para responder. Com o evento, a espera acorda na hora.
    """

    cfg: dict
    alvos: list[Alvo]
    avisar: callable
    parar: threading.Event = field(default_factory=threading.Event)

    def _dormir(self, segundos: float) -> bool:
        """Espera, mas acorda na hora se pedirem para parar. False = pararam."""
        return not self.parar.wait(timeout=segundos)

    def rodar(self) -> None:
        """Roda a fila. Nada aqui pode escapar sem virar aviso na tela."""
        try:
            self._rodar()
        except Exception as e:
            anotar_no_log(f"ERRO GERAL, a fila parou: {e!r}")
            self.avisar(Aviso("fim", f"parou com erro: {whatsapp.explicar(e)}", 0, len(self.alvos)))

    def _rodar(self) -> None:
        painel = Painel(self.cfg["painel_url"], self.cfg["chave"])
        total = len(self.alvos)
        enviados = 0
        falhas = 0
        anotar_no_log(f"--- comecando fila de {total} ---")

        for i, alvo in enumerate(self.alvos, start=1):
            if self.parar.is_set():
                break

            self.avisar(Aviso("enviando", alvo.nome, i, total, alvo))

            try:
                whatsapp.enviar(
                    alvo.numero,
                    alvo.texto,
                    folga_chat=float(self.cfg.get("folga_chat_segundos") or 1.2),
                )
            except Exception as e:
                # Captura tudo, e não só o ErroDoWhatsApp.
                #
                # Antes, qualquer outra exceção — o freio de emergência do
                # pyautogui, uma falha na área de transferência — subia pela
                # thread e a matava sem dizer nada. A janela ficava parada
                # com o botão Parar aceso e a fila morta na primeira
                # mensagem, que foi exatamente o sintoma relatado.
                falhas += 1
                motivo = whatsapp.explicar(e)
                anotar_no_log(f"FALHOU {alvo.nome} ({alvo.numero}): {motivo}")
                self.avisar(Aviso("falhou", motivo, i, total, alvo))
                try:
                    painel.anotar(alvo.lead_id, f"Disparo falhou: {motivo}")
                except Exception:
                    pass
                if not self._dormir(5):
                    break
                continue

            enviados += 1
            try:
                somar_enviado()
            except Exception as e:
                anotar_no_log(f"nao consegui gravar a contagem do dia: {e}")
            anotar_no_log(f"enviado para {alvo.nome} ({alvo.numero})")
            self.avisar(Aviso("enviado", alvo.nome, i, total, alvo))

            try:
                painel.marcar_enviado(alvo.lead_id)
            except ErroDoPainel as e:
                # a mensagem saiu; não carimbar é chato mas não é motivo para
                # parar tudo — só precisa aparecer, senão manda de novo depois
                self.avisar(Aviso("falhou", f"enviei, mas não marquei no painel: {e}", i, total, alvo))

            try:
                whatsapp.fechar_conversa()
            except Exception as e:
                # fechar a conversa é higiene, não parte do envio: falhar
                # aqui nunca pode custar o resto da fila
                anotar_no_log(f"nao consegui fechar a conversa: {e}")

            if i >= total:
                break

            a_cada = int(self.cfg.get("descanso_a_cada") or 0)
            if a_cada and enviados % a_cada == 0:
                minutos = int(self.cfg.get("descanso_minutos") or 0)
                self.avisar(Aviso("esperando", f"descanso de {minutos} min depois de {enviados} envios", i, total))
                if not self._dormir(minutos * 60):
                    break
            else:
                pausa = random.uniform(
                    float(self.cfg["pausa_min_segundos"]), float(self.cfg["pausa_max_segundos"])
                )
                self.avisar(Aviso("esperando", f"aguardando {int(pausa)}s", i, total))
                if not self._dormir(pausa):
                    break

        self.avisar(Aviso("fim", f"{enviados} enviados, {falhas} falharam", enviados, total))

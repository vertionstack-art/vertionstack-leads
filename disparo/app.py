# -*- coding: utf-8 -*-
"""
Vertion Disparo — a janela.

Abre, carrega a fila que você montou com o botão CONTACT no painel, deixa
você conferir lead por lead, e só então começa a mandar.

A tela é feita em tkinter, que já vem com o Python: nada para instalar
além do que o envio em si precisa. O trabalho pesado roda numa linha de
execução separada e conversa com a janela por uma fila de avisos —
widget de tkinter só pode ser tocado pela linha principal, e mexer nele de
outra trava a interface de um jeito que não dá erro, só congela.
"""

from __future__ import annotations

import queue
import sys
import threading
import tkinter as tk
from tkinter import messagebox, ttk

import nucleo
import whatsapp
from painel import ErroDoPainel

ROXO = "#7c3aed"
TINTA = "#18181b"
CINZA = "#71717a"
FUNDO = "#fafafa"


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Vertion Disparo")
        self.geometry("880x760")
        self.minsize(780, 660)
        self.configure(bg=FUNDO)

        self.cfg = nucleo.carregar_config()
        self.bons: list[nucleo.Alvo] = []
        self.ruins: list[nucleo.Alvo] = []
        self.disparo: nucleo.Disparo | None = None
        self.avisos: queue.Queue[nucleo.Aviso] = queue.Queue()
        self.linhas: dict[str, nucleo.Alvo] = {}

        self._montar()
        self._checar_dependencias()
        self.after(120, self._ler_avisos)
        self.protocol("WM_DELETE_WINDOW", self._fechar)

    # ------------------------------------------------------------- layout

    def _montar(self) -> None:
        topo = tk.Frame(self, bg="white", padx=18, pady=14)
        topo.pack(fill="x")

        tk.Label(topo, text="Vertion Disparo", font=("Segoe UI", 17, "bold"), bg="white", fg=TINTA).pack(anchor="w")
        tk.Label(
            topo,
            text="Manda a mensagem de abertura para os leads que você marcou com CONTACT no painel.",
            font=("Segoe UI", 9),
            bg="white",
            fg=CINZA,
        ).pack(anchor="w")

        # ---------------------------------------------------- configuração
        cfg_box = tk.LabelFrame(self, text=" Conexão ", bg=FUNDO, fg=CINZA, font=("Segoe UI", 9), padx=14, pady=10)
        cfg_box.pack(fill="x", padx=16, pady=(12, 6))

        tk.Label(cfg_box, text="Endereço do painel", bg=FUNDO, fg=CINZA, font=("Segoe UI", 8)).grid(row=0, column=0, sticky="w")
        self.e_url = tk.Entry(cfg_box, width=44, font=("Segoe UI", 10))
        self.e_url.insert(0, self.cfg.get("painel_url", ""))
        self.e_url.grid(row=1, column=0, sticky="we", padx=(0, 12))

        tk.Label(cfg_box, text="Sua chave", bg=FUNDO, fg=CINZA, font=("Segoe UI", 8)).grid(row=0, column=1, sticky="w")
        self.e_chave = tk.Entry(cfg_box, width=26, font=("Segoe UI", 10), show="•")
        self.e_chave.insert(0, self.cfg.get("chave", ""))
        self.e_chave.grid(row=1, column=1, sticky="we", padx=(0, 12))

        self.b_carregar = tk.Button(
            cfg_box, text="Carregar fila", command=self._carregar, bg=TINTA, fg="white",
            font=("Segoe UI", 10, "bold"), relief="flat", padx=16, pady=5, cursor="hand2",
        )
        self.b_carregar.grid(row=1, column=2, sticky="e")
        cfg_box.columnconfigure(0, weight=1)

        # ----------------------------------------------------------- ritmo
        ritmo = tk.LabelFrame(self, text=" Ritmo ", bg=FUNDO, fg=CINZA, font=("Segoe UI", 9), padx=14, pady=10)
        ritmo.pack(fill="x", padx=16, pady=(0, 6))

        def campo(coluna: int, rotulo: str, valor) -> tk.Entry:
            quadro = tk.Frame(ritmo, bg=FUNDO)
            quadro.grid(row=0, column=coluna, sticky="w", padx=(0, 18))
            tk.Label(quadro, text=rotulo, bg=FUNDO, fg=CINZA, font=("Segoe UI", 8)).pack(anchor="w")
            e = tk.Entry(quadro, width=7, font=("Segoe UI", 10), justify="center")
            e.insert(0, str(valor))
            e.pack(anchor="w")
            return e

        self.e_pausa_min = campo(0, "Pausa mínima (seg)", self.cfg.get("pausa_min_segundos"))
        self.e_pausa_max = campo(1, "Pausa máxima (seg)", self.cfg.get("pausa_max_segundos"))
        self.e_limite = campo(2, "Máximo por dia", self.cfg.get("limite_por_dia"))
        self.e_descanso_cada = campo(3, "Descanso a cada", self.cfg.get("descanso_a_cada"))
        self.e_descanso_min = campo(4, "Descanso (min)", self.cfg.get("descanso_minutos"))

        tk.Label(
            ritmo,
            text="A pausa é sorteada entre a mínima e a máxima — intervalo fixo é o que mais "
                 "denuncia disparo automático. Quanto maior, mais seguro para o seu número.",
            bg=FUNDO, fg=CINZA, font=("Segoe UI", 8), wraplength=800, justify="left",
        ).grid(row=1, column=0, columnspan=6, sticky="w", pady=(8, 0))

        # ----------------------------------------------------------- lista
        lista_box = tk.LabelFrame(self, text=" Quem vai receber ", bg=FUNDO, fg=CINZA, font=("Segoe UI", 9), padx=10, pady=8)
        lista_box.pack(fill="both", expand=True, padx=16, pady=6)

        acoes = tk.Frame(lista_box, bg=FUNDO)
        acoes.pack(fill="x", pady=(0, 6))
        tk.Button(acoes, text="Marcar todos", command=lambda: self._marcar_todos(True),
                  font=("Segoe UI", 8), relief="flat", bg="#e4e4e7", padx=10, cursor="hand2").pack(side="left")
        tk.Button(acoes, text="Desmarcar todos", command=lambda: self._marcar_todos(False),
                  font=("Segoe UI", 8), relief="flat", bg="#e4e4e7", padx=10, cursor="hand2").pack(side="left", padx=6)
        self.l_contagem = tk.Label(acoes, text="", bg=FUNDO, fg=CINZA, font=("Segoe UI", 9))
        self.l_contagem.pack(side="right")

        colunas = ("enviar", "nome", "telefone", "situacao")
        self.tabela = ttk.Treeview(lista_box, columns=colunas, show="headings", height=11)
        self.tabela.heading("enviar", text="")
        self.tabela.heading("nome", text="Comércio")
        self.tabela.heading("telefone", text="WhatsApp")
        self.tabela.heading("situacao", text="Situação")
        self.tabela.column("enviar", width=38, anchor="center", stretch=False)
        self.tabela.column("nome", width=300)
        self.tabela.column("telefone", width=150, anchor="center")
        self.tabela.column("situacao", width=300)
        self.tabela.tag_configure("ruim", foreground="#a1a1aa")
        self.tabela.tag_configure("feito", foreground="#15803d")
        self.tabela.tag_configure("erro", foreground="#b91c1c")
        self.tabela.bind("<Button-1>", self._clique_na_tabela)

        rolagem = ttk.Scrollbar(lista_box, orient="vertical", command=self.tabela.yview)
        self.tabela.configure(yscrollcommand=rolagem.set)
        self.tabela.pack(side="left", fill="both", expand=True)
        rolagem.pack(side="right", fill="y")

        # ------------------------------------------------------- mensagem
        prev = tk.Frame(self, bg=FUNDO, padx=16)
        prev.pack(fill="x")
        tk.Label(prev, text="Mensagem que vai sair:", bg=FUNDO, fg=CINZA, font=("Segoe UI", 8)).pack(anchor="w")
        self.l_exemplo = tk.Label(
            prev, text="—", bg="white", fg=TINTA, font=("Segoe UI", 9), justify="left",
            wraplength=820, anchor="w", padx=10, pady=8, relief="solid", bd=1,
        )
        self.l_exemplo.pack(fill="x", pady=(2, 8))

        # --------------------------------------------------------- rodapé
        rodape = tk.Frame(self, bg="white", padx=16, pady=12)
        rodape.pack(fill="x", side="bottom")

        self.b_comecar = tk.Button(
            rodape, text="Começar a enviar", command=self._comecar, bg=ROXO, fg="white",
            font=("Segoe UI", 11, "bold"), relief="flat", padx=22, pady=8,
            cursor="hand2", state="disabled",
            disabledforeground="#a1a1aa",
        )
        self.b_comecar.configure(bg="#e4e4e7")
        self.b_comecar.pack(side="left")

        self.b_parar = tk.Button(
            rodape, text="Parar", command=self._parar, bg="#dc2626", fg="white",
            font=("Segoe UI", 11, "bold"), relief="flat", padx=22, pady=8,
            cursor="hand2", state="disabled",
            disabledforeground="#a1a1aa",
        )
        self.b_parar.configure(bg="#e4e4e7")
        self.b_parar.pack(side="left", padx=8)

        self.l_estado = tk.Label(rodape, text="", bg="white", fg=CINZA, font=("Segoe UI", 9), justify="left")
        self.l_estado.pack(side="left", padx=16)

        self.l_hoje = tk.Label(
            rodape, text=self._texto_hoje(), bg="white", fg=CINZA, font=("Segoe UI", 9)
        )
        self.l_hoje.pack(side="right")

    # ---------------------------------------------------------- auxiliares

    def _texto_hoje(self) -> str:
        return f"Hoje: {nucleo.enviados_hoje()} de {self.cfg.get('limite_por_dia')}"

    def _checar_dependencias(self) -> None:
        ok, falta = whatsapp.dependencias_ok()
        if not ok:
            self.l_estado.config(text=falta, fg="#b91c1c")
            self.b_carregar.config(state="disabled")

    def _estado_botao(self, botao: tk.Button, ligado: bool, cor: str) -> None:
        """Muda o estado e a cor juntos: botão apagado não pode parecer clicável."""
        botao.config(state="normal" if ligado else "disabled", bg=cor if ligado else "#e4e4e7")

    def _cfg_da_tela(self) -> dict:
        cfg = dict(self.cfg)
        cfg["painel_url"] = self.e_url.get().strip()
        cfg["chave"] = self.e_chave.get().strip()

        # campo vazio ou com letra não pode virar zero nem derrubar o
        # programa: continua valendo o que já valia
        def numero(entrada: tk.Entry, atual, minimo=0):
            try:
                v = type(atual)(entrada.get().strip().replace(",", "."))
            except (ValueError, TypeError):
                return atual
            return max(minimo, v)

        cfg["pausa_min_segundos"] = numero(self.e_pausa_min, cfg["pausa_min_segundos"], 5)
        cfg["pausa_max_segundos"] = numero(self.e_pausa_max, cfg["pausa_max_segundos"], 5)
        cfg["limite_por_dia"] = numero(self.e_limite, cfg["limite_por_dia"], 1)
        cfg["descanso_a_cada"] = numero(self.e_descanso_cada, cfg["descanso_a_cada"])
        cfg["descanso_minutos"] = numero(self.e_descanso_min, cfg["descanso_minutos"])

        # máxima menor que mínima faria o sorteio devolver valor negativo
        if cfg["pausa_max_segundos"] < cfg["pausa_min_segundos"]:
            cfg["pausa_max_segundos"] = cfg["pausa_min_segundos"]
        return cfg

    def _marcados(self) -> list[nucleo.Alvo]:
        return [a for a in self.bons if a.marcado]

    # ------------------------------------------------------------- tabela

    def _desenhar_tabela(self) -> None:
        self.tabela.delete(*self.tabela.get_children())
        self.linhas.clear()

        for a in self.bons:
            iid = self.tabela.insert(
                "", "end",
                values=("☑" if a.marcado else "☐", a.nome, a.telefone_bonito, a.motivo or "pronto"),
            )
            self.linhas[iid] = a

        for a in self.ruins:
            iid = self.tabela.insert(
                "", "end", tags=("ruim",),
                values=("—", a.nome, a.telefone_bruto or "—", a.motivo),
            )
            self.linhas[iid] = a

        self._atualizar_contagem()

    def _atualizar_contagem(self) -> None:
        n = len(self._marcados())
        cabe = max(0, int(self.cfg.get("limite_por_dia", 0)) - nucleo.enviados_hoje())
        texto = f"{n} marcados   ·   {len(self.ruins)} sem número bom"
        if n > cabe:
            texto += f"   ·   só cabem {cabe} hoje"
        self.l_contagem.config(text=texto)

        marcados = self._marcados()
        self.l_exemplo.config(text=marcados[0].texto if marcados else "—")
        self._estado_botao(self.b_comecar, bool(marcados and cabe), ROXO)

    def _clique_na_tabela(self, evento) -> None:
        """Clicar na primeira coluna liga e desliga o lead da rodada."""
        if self.tabela.identify_region(evento.x, evento.y) != "cell":
            return
        if self.tabela.identify_column(evento.x) != "#1":
            return
        iid = self.tabela.identify_row(evento.y)
        alvo = self.linhas.get(iid)
        if alvo is None or not alvo.servivel:
            return
        alvo.marcado = not alvo.marcado
        valores = list(self.tabela.item(iid, "values"))
        valores[0] = "☑" if alvo.marcado else "☐"
        self.tabela.item(iid, values=valores)
        self._atualizar_contagem()

    def _marcar_todos(self, valor: bool) -> None:
        for a in self.bons:
            a.marcado = valor
        self._desenhar_tabela()

    # ----------------------------------------------------------- carregar

    def _carregar(self) -> None:
        cfg = self._cfg_da_tela()
        if not cfg["chave"]:
            messagebox.showwarning("Falta a chave", "Ponha a sua chave — é a mesma que você usou na extensão.")
            return

        self.b_carregar.config(state="disabled", text="Carregando…")
        self.l_estado.config(text="", fg=CINZA)

        def trabalho() -> None:
            try:
                bons, ruins = nucleo.montar_fila(cfg)
            except ErroDoPainel as e:
                self.after(0, lambda: self._erro_ao_carregar(str(e)))
                return
            except Exception as e:  # rede, JSON estranho, o que for
                self.after(0, lambda: self._erro_ao_carregar(f"Falhou: {e}"))
                return
            self.after(0, lambda: self._fila_pronta(cfg, bons, ruins))

        threading.Thread(target=trabalho, daemon=True).start()

    def _erro_ao_carregar(self, texto: str) -> None:
        self.b_carregar.config(state="normal", text="Carregar fila")
        self.l_estado.config(text=texto, fg="#b91c1c")

    def _fila_pronta(self, cfg: dict, bons: list, ruins: list) -> None:
        self.cfg = cfg
        nucleo.salvar_config(cfg)  # guarda url e chave para a próxima vez
        self.bons, self.ruins = bons, ruins
        self.b_carregar.config(state="normal", text="Carregar fila")
        self._desenhar_tabela()

        if not bons and not ruins:
            self.l_estado.config(
                text="A fila está vazia. Marque CONTACT nos leads do painel.", fg=CINZA
            )
        else:
            self.l_estado.config(text="", fg=CINZA)

    # ------------------------------------------------------------- envio

    def _comecar(self) -> None:
        # relê o ritmo agora: dá para ajustar depois de carregar a fila
        self.cfg = self._cfg_da_tela()
        nucleo.salvar_config(self.cfg)
        alvos = self._marcados()
        cabe = max(0, int(self.cfg.get("limite_por_dia", 0)) - nucleo.enviados_hoje())
        alvos = alvos[:cabe]
        if not alvos:
            return

        aviso = (
            f"Vou mandar para {len(alvos)} comércios, com pausa de "
            f"{self.cfg['pausa_min_segundos']} a {self.cfg['pausa_max_segundos']} segundos "
            f"entre uma e outra.\n\n"
            f"Enquanto roda, NÃO mexa no mouse nem no teclado — o programa "
            f"controla o teclado de verdade para apertar Enter no WhatsApp. "
            f"Levar o mouse ao canto superior esquerdo é o freio de emergência.\n\n"
            f"Pode parar quando quiser no botão Parar.\n\nComeçar?"
        )
        if not messagebox.askyesno("Confirmar", aviso):
            return

        self._estado_botao(self.b_comecar, False, ROXO)
        self.b_carregar.config(state="disabled")
        self._estado_botao(self.b_parar, True, "#dc2626")

        self.disparo = nucleo.Disparo(cfg=self.cfg, alvos=alvos, avisar=self.avisos.put)
        threading.Thread(target=self.disparo.rodar, daemon=True).start()

    def _parar(self) -> None:
        if self.disparo:
            self.disparo.parar.set()
        self._estado_botao(self.b_parar, False, "#dc2626")
        self.l_estado.config(text="Parando depois do envio atual…", fg=CINZA)

    def _ler_avisos(self) -> None:
        """
        Puxa o que o disparo contou e mexe na tela.

        Roda sempre na linha principal, chamada pelo próprio tkinter — é o
        que torna seguro tocar nos widgets aqui dentro.
        """
        try:
            while True:
                a = self.avisos.get_nowait()
                self._aplicar(a)
        except queue.Empty:
            pass
        self.after(150, self._ler_avisos)

    def _aplicar(self, a: nucleo.Aviso) -> None:
        if a.tipo == "enviando":
            self.l_estado.config(text=f"[{a.indice}/{a.total}] abrindo {a.texto}…", fg=TINTA)
        elif a.tipo == "enviado":
            self.l_estado.config(text=f"[{a.indice}/{a.total}] enviado para {a.texto}", fg="#15803d")
            self._marcar_linha(a.alvo, "feito", "enviado")
            self.l_hoje.config(text=self._texto_hoje())
        elif a.tipo == "falhou":
            self.l_estado.config(text=a.texto, fg="#b91c1c")
            self._marcar_linha(a.alvo, "erro", a.texto[:60])
        elif a.tipo == "esperando":
            self.l_estado.config(text=f"[{a.indice}/{a.total}] {a.texto}", fg=CINZA)
        elif a.tipo == "fim":
            self.l_estado.config(text=f"Terminou: {a.texto}", fg=TINTA)
            self._estado_botao(self.b_parar, False, "#dc2626")
            self.b_carregar.config(state="normal")
            self._estado_botao(self.b_comecar, bool(self._marcados()), ROXO)
            self.disparo = None

    def _marcar_linha(self, alvo: nucleo.Alvo | None, tag: str, situacao: str) -> None:
        if alvo is None:
            return
        for iid, a in self.linhas.items():
            if a is alvo:
                valores = list(self.tabela.item(iid, "values"))
                valores[0] = "✓" if tag == "feito" else "!"
                valores[3] = situacao
                self.tabela.item(iid, values=valores, tags=(tag,))
                self.tabela.see(iid)
                return

    # ------------------------------------------------------------- fechar

    def _fechar(self) -> None:
        if self.disparo is not None:
            if not messagebox.askyesno("Fechar", "O disparo está rodando. Fechar mesmo assim?"):
                return
            self.disparo.parar.set()
        self.destroy()


def main() -> None:
    try:
        App().mainloop()
    except Exception as e:  # sem isso um erro fecha a janela sem dizer nada
        try:
            tk.Tk().withdraw()
            messagebox.showerror("Vertion Disparo", f"O programa parou:\n\n{e}")
        except Exception:
            print(f"Erro: {e}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()

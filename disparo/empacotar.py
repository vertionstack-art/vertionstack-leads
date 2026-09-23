# -*- coding: utf-8 -*-
"""
Gera o Vertion Disparo.exe e o zip para instalar em outra máquina.

Existe como script, e não como uma linha de comando anotada em algum
lugar, porque empacotar errado é fácil e só aparece depois: sem
`--windowed` abre um terminal preto atrás da janela, e sem os
`--hidden-import` o programa monta a tela e quebra na hora de enviar,
porque o PyInstaller não enxerga módulos que só são usados dentro de
try/except.

Rode com:  python empacotar.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

AQUI = Path(__file__).parent
NOME = "Vertion Disparo"
SAIDA = AQUI / "pacote"

LEIA_ME = """VERTION DISPARO
===============

Manda a mensagem de abertura no WhatsApp para os leads marcados com
CONTACT no painel Vertion Leads.


O QUE PRECISA NESTE COMPUTADOR
------------------------------

1. Windows.
2. WhatsApp instalado no PC e conectado com o numero que vai mandar.
   E o aplicativo, nao o site.

Nao precisa instalar Python nem mais nada. O programa ja vem inteiro.


COMO USAR
---------

1. Copie esta pasta para algum lugar fixo do computador
   (a Area de Trabalho serve).

2. Abra o "Vertion Disparo.exe".
   Na primeira vez o Windows pode perguntar se confia no programa:
   clique em "Mais informacoes" e depois em "Executar assim mesmo".

3. Cole a sua chave no campo "Sua chave".
   E a mesma chave que esta nas configuracoes da extensao do Chrome.
   O programa guarda, voce nao digita de novo.

4. Ajuste o "Ritmo" se quiser. A pausa entre uma mensagem e outra sai
   sorteada entre a minima e a maxima.

5. "Carregar fila" -> confira quem vai receber -> "Comecar a enviar".


ENQUANTO ESTIVER RODANDO
------------------------

NAO mexa no mouse nem no teclado. O programa controla o teclado de
verdade para apertar Enter no WhatsApp.

Para abortar na emergencia, leve o mouse ao canto superior esquerdo da
tela. Para parar normalmente, use o botao "Parar".


IMPORTANTE
----------

Disparo em massa e o padrao que a Meta usa para identificar robo, e o
numero em risco e o canal de vendas. Nao existe configuracao que zere
esse risco -- o que existe e ir devagar.

Quanto maior a pausa e menor o teto por dia, mais seguro.


ARQUIVOS QUE APARECEM NA PASTA
------------------------------

config.json    suas configuracoes, incluindo a chave (nao compartilhe)
enviados.json  a contagem do dia
disparo.log    o que aconteceu em cada envio -- olhe aqui quando der erro
"""


def main() -> None:
    if shutil.which("pyinstaller") is None:
        try:
            import PyInstaller  # noqa: F401
        except ImportError:
            print("Falta o PyInstaller. Rode: pip install pyinstaller")
            sys.exit(1)

    print("Empacotando… leva um minuto ou dois.")
    subprocess.run(
        [
            sys.executable, "-m", "PyInstaller",
            "--noconfirm",
            "--onefile",
            "--windowed",  # sem terminal preto atrás da janela
            "--name", NOME,
            # módulos usados dentro de try/except que o PyInstaller não vê
            "--hidden-import", "pyperclip",
            "--hidden-import", "pygetwindow",
            "--hidden-import", "pyautogui",
            # Peso morto que vem de carona com o pyautogui. Ele importa
            # pyscreeze e mouseinfo, que por sua vez podem usar OpenCV (111 MB
            # com o ffmpeg), PyQt5 (45 MB) e numpy (23 MB) — tudo isso para
            # localizar imagens na tela e mostrar caixinhas, funções que este
            # programa nunca chama. Sem cortar, o .exe passa de 100 MB.
            *[a for m in ("cv2", "PyQt5", "PyQt6", "PySide2", "PySide6",
                          "numpy", "scipy", "matplotlib", "pandas", "pytest")
                for a in ("--exclude-module", m)],
            "app.py",
        ],
        cwd=AQUI,
        check=True,
    )

    exe = AQUI / "dist" / f"{NOME}.exe"
    if not exe.exists():
        print("O .exe não foi gerado. Veja o que o PyInstaller reclamou acima.")
        sys.exit(1)

    if SAIDA.exists():
        shutil.rmtree(SAIDA)
    SAIDA.mkdir()

    shutil.copy2(exe, SAIDA / exe.name)
    (SAIDA / "LEIA-ME.txt").write_text(LEIA_ME, encoding="utf-8")
    shutil.copy2(AQUI / "config.exemplo.json", SAIDA / "config.exemplo.json")

    zip_final = AQUI / f"{NOME}.zip"
    with zipfile.ZipFile(zip_final, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for arquivo in sorted(SAIDA.iterdir()):
            z.write(arquivo, f"{NOME}/{arquivo.name}")

    mb = zip_final.stat().st_size / (1024 * 1024)
    print(f"\nPronto: {zip_final.name}  ({mb:.0f} MB)")
    print(f"Descompactado: {NOME}/  com o .exe, o LEIA-ME e o exemplo de configuração.")


if __name__ == "__main__":
    main()

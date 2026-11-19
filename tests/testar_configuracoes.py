"""Testes de regressão do ATMOS no Chrome."""
import argparse
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from queue import Empty, Queue
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread

RAIZ = Path(__file__).resolve().parents[1]
SUBDIRETORIO = "/ATMOS-Weather"


class Servidor(SimpleHTTPRequestHandler):
    def log_message(self, formato, *args):
        pass

    def translate_path(self, caminho):
        return super().translate_path(caminho.removeprefix(SUBDIRETORIO))

    def do_GET(self):
        if not self.path.startswith(SUBDIRETORIO + "/"):
            return self.send_error(404)
        if self.path != SUBDIRETORIO + "/simulacao":
            return super().do_GET()
        pagina = (RAIZ / "index.html").read_text(encoding="utf-8")
        pagina = pagina.replace("<head>", '<head><script src="./tests/simulacao.js"></script>', 1)
        pagina = "\n".join(linha for linha in pagina.splitlines() if "fonts.googleapis" not in linha
                           and "fonts.gstatic" not in linha)
        dados = pagina.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_POST(self):
        if self.path != SUBDIRETORIO + "/resultado":
            return self.send_error(404)
        dados = self.rfile.read(int(self.headers["Content-Length"])).decode()
        self.server.resultados.put(dados)
        self.send_response(204)
        self.end_headers()


def executar(servicos_reais):
    navegador = os.environ.get("ATMOS_CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Servidor, directory=RAIZ)) as servidor:
        servidor.resultados = Queue()
        Thread(target=servidor.serve_forever).start()
        try:
            with TemporaryDirectory(prefix="atmos-navegador-", ignore_cleanup_errors=True) as perfil:
                endereco = f"http://127.0.0.1:{servidor.server_port}{SUBDIRETORIO}/tests/configuracoes.html"
                if servicos_reais:
                    endereco += "?servicos-reais"
                with subprocess.Popen(
                    [navegador, "--headless", f"--user-data-dir={perfil}", "--disable-gpu",
                     "--disable-background-networking", "--no-first-run", "--window-size=1440,900",
                     f"--log-file={Path(perfil) / 'chrome.log'}", endereco],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                ) as processo:
                    try:
                        resultado = servidor.resultados.get(timeout=65 if servicos_reais else 30)
                    except Empty:
                        raise SystemExit("O navegador não enviou o resultado dos testes.") from None
                    finally:
                        processo.terminate()
                if not resultado.startswith("Aprovado."):
                    raise SystemExit(resultado)
                print(resultado)
        finally:
            servidor.shutdown()


if __name__ == "__main__":
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument("--servicos-reais", action="store_true",
                            help="Consulta a Open-Meteo e carrega o mapa do Leaflet.")
    executar(argumentos.parse_args().servicos_reais)

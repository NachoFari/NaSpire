"""
NaSpire Studio — Gestor portable de calculadoras TI-Nspire (Ecosistema NaTex).
Autor: NachoFari (https://github.com/NachoFari | https://nachofari.github.io)
"""

import http.server
import mimetypes
import os
import socket
import socketserver
import sys
import threading
import time
import urllib.parse
import webbrowser

if getattr(sys, "frozen", False):
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    EXE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    EXE_DIR = BASE_DIR

sys.path.insert(0, BASE_DIR)

from backend.api_router import ApiRouter


def find_available_port(start_port: int = 5120, max_attempts: int = 50) -> int:
    for p in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return start_port


PORT = find_available_port(5120)
ROUTER = ApiRouter(EXE_DIR if os.path.isdir(os.path.join(EXE_DIR, "tools")) else BASE_DIR)


class NaSpireHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_bytes(self, status: int, content_type: str, data: bytes, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        req_path = parsed.path
        query = {
            k: v[0]
            for k, v in urllib.parse.parse_qs(parsed.query, keep_blank_values=True).items()
        }

        if req_path.startswith("/api/"):
            status, ctype, data = ROUTER.handle_get(req_path, query)
            extra = {}
            if req_path == "/api/files/download" and status == 200:
                fname = os.path.basename(query.get("path", "archivo.tns"))
                extra["Content-Disposition"] = f'attachment; filename="{fname}"'
                ctype = "application/octet-stream"
            self._send_bytes(status, ctype, data, extra)
            return

        if req_path == "/" or req_path == "/index.html":
            index_file = os.path.join(BASE_DIR, "templates", "index.html")
            if os.path.isfile(index_file):
                with open(index_file, "rb") as f:
                    self._send_bytes(200, "text/html; charset=utf-8", f.read())
                return

        if req_path.startswith("/static/"):
            rel = req_path[len("/static/") :].lstrip("/\\")
            static_root = os.path.abspath(os.path.join(BASE_DIR, "static"))
            target = os.path.abspath(os.path.join(static_root, rel))
            if os.path.commonpath([static_root, target]) == static_root and os.path.isfile(target):
                ctype, _ = mimetypes.guess_type(target)
                with open(target, "rb") as f:
                    self._send_bytes(200, ctype or "application/octet-stream", f.read())
                return

        self._send_bytes(404, "text/plain; charset=utf-8", b"Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        req_path = parsed.path
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length > 0 else b""

        if req_path.startswith("/api/"):
            status, ctype, data = ROUTER.handle_post(req_path, body)
            self._send_bytes(status, ctype, data)
            return

        self._send_bytes(404, "application/json", b'{"ok":false,"error":"Not Found"}')


def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), NaSpireHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    url = f"http://127.0.0.1:{PORT}"
    print("==================================================")
    print("        [NaSpire Studio] Modo Nativo              ")
    print("==================================================")
    print(f"Servidor local activo en {url}")

    if "--server-only" in sys.argv:
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        return

    try:
        import webview

        webview.create_window(
            title="NaSpire Studio — TI-Nspire Manager",
            url=url,
            width=1280,
            height=820,
            min_size=(960, 620),
            background_color="#0E1015",
        )
        gui_backend = "edgechromium" if sys.platform == "win32" else None
        webview.start(gui=gui_backend, debug=False)
    except Exception as exc:
        print(f"[NaSpire] Ventana nativa no disponible ({exc}), abriendo navegador...")
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
    finally:
        ROUTER.client.disconnect()
        httpd.shutdown()
        os._exit(0)


if __name__ == "__main__":
    main()

"""
Router REST API modular de NaSpire.
Desacopla la lógica de endpoints del servidor HTTP y de pywebview.
"""

import base64
import json
import os
import urllib.parse
from typing import Any, Dict, Tuple

from backend.device_registry import get_supported_models
from backend.nspire_usb import NspireClient, NspireError
from backend.tns_builder import (
    TnsBuilder,
    TnsBuildError,
)
from backend.tns_editor import (
    TnsEditorError,
    apply_visual_page_edit,
    inspect_tns_bytes,
    pretty_xml,
    save_tns_from_files,
)
from backend.updater import APP_VERSION, check_for_updates, download_and_launch_installer


class ApiRouter:
    def __init__(self, base_dir: str) -> None:
        self.base_dir = base_dir
        self.client = NspireClient()
        self.tns = TnsBuilder(base_dir)
        self._last_info: Dict[str, Any] = {}
        self._tags_cache: Dict[str, Any] = {}

    def handle_get(self, path: str, query: Dict[str, str]) -> Tuple[int, str, bytes]:
        try:
            if path == "/api/health":
                return self._json(
                    200,
                    {
                        "ok": True,
                        "app": "NaSpire Studio",
                        "version": APP_VERSION,
                        "author": "NachoFari",
                        "github": "https://github.com/NachoFari",
                        "web": "https://nachofari.github.io",
                        "connected": self.client.is_connected,
                        "luna": self.tns.status(),
                    },
                )

            if path == "/api/updater/check":
                return self._json(200, check_for_updates())

            if path == "/api/devices/scan":
                return self._json(
                    200,
                    {
                        "ok": True,
                        "devices": NspireClient.scan_devices(),
                        "supported": get_supported_models(),
                    },
                )

            if path == "/api/device/info":
                if not self.client.is_connected:
                    return self._json(200, {"ok": True, "connected": False, "info": None})
                info = self.client.get_device_info()
                self._last_info = info
                return self._json(200, {"ok": True, "connected": True, "info": info})

            if path == "/api/files/list":
                dir_path = query.get("path", "/") or "/"
                items = self.client.list_dir(dir_path)
                return self._json(200, {"ok": True, "path": dir_path, "items": items})

            if path == "/api/files/folders":
                folders = ["/"]
                if self.client.is_connected:
                    def _walk(cur: str, depth: int):
                        if depth > 2:
                            return
                        try:
                            entries = self.client.list_dir(cur)
                        except Exception:
                            return
                        for it in entries:
                            if it.get("is_dir"):
                                folders.append(it["path"])
                                _walk(it["path"], depth + 1)
                    _walk("/", 0)
                return self._json(200, {"ok": True, "folders": folders})

            if path == "/api/files/tns-tags":
                file_path = query.get("path", "").strip()
                size_key = query.get("size", "")
                if not file_path:
                    return self._json(400, {"ok": False, "error": "Falta 'path'"})
                cache_key = f"{file_path}|{size_key}"
                if cache_key in self._tags_cache:
                    return self._json(200, {"ok": True, "path": file_path, "tags": self._tags_cache[cache_key]})
                if not self.client.is_connected:
                    return self._json(200, {"ok": True, "path": file_path, "tags": []})
                try:
                    raw = self.client.read_file(file_path)
                    info = inspect_tns_bytes(raw, os.path.basename(file_path))
                    seen = []
                    for p in info.get("pages", []):
                        lbl = p.get("label", "")
                        if lbl and lbl not in seen:
                            seen.append(lbl)
                    self._tags_cache[cache_key] = seen
                    return self._json(200, {"ok": True, "path": file_path, "tags": seen})
                except Exception:
                    self._tags_cache[cache_key] = []
                    return self._json(200, {"ok": True, "path": file_path, "tags": []})

            if path == "/api/files/download":
                file_path = query.get("path", "")
                if not file_path:
                    return self._json(400, {"ok": False, "error": "Falta parámetro 'path'"})
                data = self.client.read_file(file_path)
                fname = os.path.basename(file_path) or "archivo.tns"
                return (
                    200,
                    f'application/octet-stream; name="{fname}"',
                    data,
                )

            if path == "/api/screenshot":
                png_bytes, w, h = self.client.screenshot_png()
                b64 = base64.b64encode(png_bytes).decode("ascii")
                return self._json(
                    200,
                    {
                        "ok": True,
                        "width": w,
                        "height": h,
                        "image": f"data:image/png;base64,{b64}",
                    },
                )

            return self._json(404, {"ok": False, "error": f"Endpoint no encontrado: {path}"})
        except (NspireError, TnsBuildError, TnsEditorError) as exc:
            return self._json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            return self._json(500, {"ok": False, "error": f"Error interno: {exc}"})

    def handle_post(self, path: str, body: bytes) -> Tuple[int, str, bytes]:
        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            return self._json(400, {"ok": False, "error": "JSON inválido en el cuerpo de la petición"})

        try:
            if path == "/api/device/connect":
                info = self.client.connect()
                self._last_info = info
                return self._json(200, {"ok": True, "info": info})

            if path == "/api/device/disconnect":
                self.client.disconnect()
                self._last_info = {}
                return self._json(200, {"ok": True})

            if path == "/api/files/mkdir":
                target = payload.get("path", "").strip()
                if not target:
                    return self._json(400, {"ok": False, "error": "Ruta de carpeta vacía"})
                self.client.create_dir(target)
                return self._json(200, {"ok": True, "path": target})

            if path == "/api/files/delete":
                target = payload.get("path", "").strip()
                is_dir = bool(payload.get("is_dir", False))
                if not target:
                    return self._json(400, {"ok": False, "error": "Ruta vacía"})
                if is_dir:
                    self.client.delete_dir(target)
                else:
                    self.client.delete_file(target)
                return self._json(200, {"ok": True})

            if path == "/api/files/move":
                src = payload.get("src", "").strip()
                dst = payload.get("dst", "").strip()
                if not src or not dst:
                    return self._json(400, {"ok": False, "error": "Faltan rutas src y dst"})
                self.client.move_file(src, dst)
                return self._json(200, {"ok": True, "src": src, "dst": dst})

            if path == "/api/files/copy":
                src = payload.get("src", "").strip()
                dst = payload.get("dst", "").strip()
                if not src or not dst:
                    return self._json(400, {"ok": False, "error": "Faltan rutas src y dst"})
                self.client.copy_file(src, dst)
                return self._json(200, {"ok": True})

            if path == "/api/files/upload":
                dest_path = payload.get("path", "").strip()
                content_b64 = payload.get("content_base64", "")
                if not dest_path or not content_b64:
                    return self._json(400, {"ok": False, "error": "Falta ruta destino o contenido"})
                raw = base64.b64decode(content_b64)
                self.client.write_file(dest_path, raw)
                return self._json(200, {"ok": True, "path": dest_path, "size": len(raw)})

            if path == "/api/tns/build":
                mode = payload.get("mode", "python")
                filename = payload.get("filename", "documento_naspire")
                upload_dir = payload.get("upload_dir", "").strip()

                if mode == "python":
                    code = payload.get("code", "")
                    tns_bytes, out_name = self.tns.compile_python_to_tns(filename, code)
                elif mode == "lua":
                    code = payload.get("code", "")
                    tns_bytes, out_name = self.tns.compile_lua_to_tns(filename, code)
                elif mode == "spreadsheet":
                    columns = payload.get("columns", [])
                    rows = payload.get("rows", [])
                    formulas = payload.get("formulas", [])
                    tns_bytes, out_name = self.tns.compile_spreadsheet_to_tns(
                        filename, columns, rows, formulas
                    )
                elif mode == "functions":
                    functions = payload.get("functions", [])
                    notes = payload.get("notes", "")
                    tns_bytes, out_name = self.tns.compile_functions_notes_to_tns(
                        filename, functions, notes
                    )
                else:
                    return self._json(400, {"ok": False, "error": f"Modo desconocido: {mode}"})

                uploaded_path = None
                if upload_dir:
                    if not self.client.is_connected:
                        raise NspireError("Conecta la calculadora para subir el .tns generado.")
                    base = upload_dir.rstrip("/")
                    uploaded_path = f"{base}/{out_name}" if base else f"/{out_name}"
                    self.client.write_file(uploaded_path, tns_bytes)

                return self._json(
                    200,
                    {
                        "ok": True,
                        "filename": out_name,
                        "size": len(tns_bytes),
                        "uploaded_path": uploaded_path,
                        "content_base64": base64.b64encode(tns_bytes).decode("ascii"),
                    },
                )

            if path == "/api/tns/inspect":
                calc_path = payload.get("calc_path", "").strip()
                content_b64 = payload.get("content_base64", "")
                filename = payload.get("filename", "documento.tns")
                if calc_path:
                    if not self.client.is_connected:
                        raise NspireError("Conecta la calculadora para abrir archivos desde ella.")
                    raw = self.client.read_file(calc_path)
                    filename = os.path.basename(calc_path) or filename
                elif content_b64:
                    raw = base64.b64decode(content_b64)
                else:
                    return self._json(400, {"ok": False, "error": "Indica 'calc_path' o 'content_base64'"})
                info = inspect_tns_bytes(raw, filename)
                info["calc_path"] = calc_path
                return self._json(200, {"ok": True, **info})

            if path == "/api/tns/pretty":
                xml_str = payload.get("xml", "")
                return self._json(200, {"ok": True, "xml": pretty_xml(xml_str)})

            if path == "/api/tns/save":
                files = payload.get("files", {})
                visual_pages = payload.get("pages", [])
                for pg in visual_pages:
                    if pg.get("modified"):
                        files = apply_visual_page_edit(files, pg)
                filename = payload.get("filename", "documento_editado.tns")
                calc_path = payload.get("calc_path", "").strip()
                tns_bytes, out_name = save_tns_from_files(files, filename)
                uploaded_path = None
                if calc_path:
                    if not self.client.is_connected:
                        raise NspireError("Conecta la calculadora para guardar el archivo en ella.")
                    uploaded_path = calc_path if calc_path.startswith("/") else "/" + calc_path
                    if not uploaded_path.lower().endswith(".tns"):
                        uploaded_path = uploaded_path.rstrip("/") + "/" + out_name
                    self.client.write_file(uploaded_path, tns_bytes)
                return self._json(
                    200,
                    {
                        "ok": True,
                        "filename": out_name,
                        "size": len(tns_bytes),
                        "files": files,
                        "uploaded_path": uploaded_path,
                        "content_base64": base64.b64encode(tns_bytes).decode("ascii"),
                    },
                )

            if path == "/api/updater/install":
                url = payload.get("installer_url", "").strip()
                name = payload.get("installer_name", "").strip()
                res = download_and_launch_installer(url, name)
                # Programar cierre limpio de NaSpire en 1.2s para que el instalador actualice los archivos
                import threading, time as _t

                def _exit_soon():
                    _t.sleep(1.2)
                    os._exit(0)

                threading.Thread(target=_exit_soon, daemon=True).start()
                return self._json(200, res)

            if path == "/api/open-external":
                url = payload.get("url", "")
                if url.startswith(("https://", "http://")):
                    import webbrowser

                    webbrowser.open(url)
                    return self._json(200, {"ok": True})
                return self._json(400, {"ok": False, "error": "URL inválida"})

            return self._json(404, {"ok": False, "error": f"Endpoint no encontrado: {path}"})
        except (NspireError, TnsBuildError, TnsEditorError) as exc:
            return self._json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            return self._json(500, {"ok": False, "error": f"Error interno: {exc}"})

    @staticmethod
    def _json(status: int, obj: Dict[str, Any]) -> Tuple[int, str, bytes]:
        return status, "application/json; charset=utf-8", json.dumps(obj).encode("utf-8")

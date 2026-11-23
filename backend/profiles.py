"""
Gestor de Perfiles (Save Slots) para NaSpire Studio.
Permite guardar snapshots completos de la TI-Nspire en disco y restaurarlos
en 1 clic con progreso en vivo y protección opcional de /ndless.
"""

import base64
import json
import os
import random
import shutil
import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from backend.nspire_usb import NspireClient, NspireError


class ProfileError(Exception):
    """Error al gestionar perfiles o save slots."""


PALETTE_THEMES = ["orange", "cyan", "green", "violet", "amber", "teal"]


def _default_theme_for_slot(slot_id: int) -> str:
    if slot_id <= 3:
        return PALETTE_THEMES[slot_id - 1]
    return random.choice(PALETTE_THEMES)


class ProfileManager:
    def __init__(self, base_dir: str) -> None:
        self.base_dir = base_dir
        self.profiles_dir = self._resolve_profiles_dir(base_dir)
        self.manifest_path = os.path.join(self.profiles_dir, "slots.json")
        self._lock = threading.Lock()
        self._progress: Dict[int, Dict[str, Any]] = {}
        self._ensure_manifest()

    @staticmethod
    def _resolve_profiles_dir(base_dir: str) -> str:
        portable_dir = os.path.join(base_dir, "profiles")
        try:
            os.makedirs(portable_dir, exist_ok=True)
            probe = os.path.join(portable_dir, ".write_test")
            with open(probe, "w", encoding="utf-8") as f:
                f.write("ok")
            os.remove(probe)
            return portable_dir
        except Exception:
            local_app = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
            fallback = os.path.join(local_app, "NaSpire", "profiles")
            os.makedirs(fallback, exist_ok=True)
            return fallback

    def _slot_dir(self, slot_id: int) -> str:
        return os.path.join(self.profiles_dir, f"slot_{slot_id}")

    def _slot_files_dir(self, slot_id: int) -> str:
        return os.path.join(self._slot_dir(slot_id), "files")

    @staticmethod
    def _empty_slot(slot_id: int) -> Dict[str, Any]:
        return {
            "id": slot_id,
            "name": "",
            "saved": False,
            "files_count": 0,
            "folders_count": 0,
            "total_bytes": 0,
            "updated_at": "",
            "theme": _default_theme_for_slot(slot_id),
        }

    def _ensure_manifest(self) -> None:
        if not os.path.isfile(self.manifest_path):
            data = {"slots": [self._empty_slot(1), self._empty_slot(2), self._empty_slot(3)]}
            self._write_manifest(data)

    def _read_manifest(self) -> Dict[str, Any]:
        self._ensure_manifest()
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data.get("slots"), list) or not data["slots"]:
            data = {"slots": [self._empty_slot(1), self._empty_slot(2), self._empty_slot(3)]}
        return data

    def _write_manifest(self, data: Dict[str, Any]) -> None:
        os.makedirs(self.profiles_dir, exist_ok=True)
        tmp = self.manifest_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.manifest_path)

    def list_slots(self) -> List[Dict[str, Any]]:
        with self._lock:
            return self._read_manifest()["slots"]

    def add_slot_row(self) -> List[Dict[str, Any]]:
        with self._lock:
            data = self._read_manifest()
            slots = data["slots"]
            next_id = max((int(s["id"]) for s in slots), default=0) + 1
            for offset in range(3):
                slots.append(self._empty_slot(next_id + offset))
            self._write_manifest(data)
            return slots

    def reorder_slots(self, ordered_ids: List[int]) -> List[Dict[str, Any]]:
        with self._lock:
            data = self._read_manifest()
            by_id = {int(s["id"]): s for s in data["slots"]}
            new_list = []
            for sid in ordered_ids:
                obj = by_id.pop(int(sid), None)
                if obj is not None:
                    new_list.append(obj)
            for rem in by_id.values():
                new_list.append(rem)
            data["slots"] = new_list
            self._write_manifest(data)
            return new_list

    def rename_slot(self, slot_id: int, name: str, theme: Optional[str] = None) -> Dict[str, Any]:
        clean = (name or "").strip()[:32]
        with self._lock:
            data = self._read_manifest()
            for s in data["slots"]:
                if int(s["id"]) == int(slot_id):
                    s["name"] = clean
                    if theme and theme in PALETTE_THEMES:
                        s["theme"] = theme
                    self._write_manifest(data)
                    return s
        raise ProfileError(f"Slot {slot_id} no encontrado.")

    def _recompute_slot_stats(self, slot_obj: Dict[str, Any]) -> None:
        slot_id = int(slot_obj["id"])
        files_dir = self._slot_files_dir(slot_id)
        if not os.path.isdir(files_dir):
            slot_obj["files_count"] = 0
            slot_obj["folders_count"] = 0
            slot_obj["total_bytes"] = 0
            return
        fcount = 0
        dcount = 0
        tbytes = 0
        for root_d, dirs, fns in os.walk(files_dir):
            dcount += len(dirs)
            for fn in fns:
                fcount += 1
                tbytes += os.path.getsize(os.path.join(root_d, fn))
        slot_obj["files_count"] = fcount
        slot_obj["folders_count"] = dcount
        slot_obj["total_bytes"] = tbytes
        if fcount > 0:
            slot_obj["saved"] = True

    def list_slot_contents(self, slot_id: int) -> List[Dict[str, Any]]:
        slot_id = int(slot_id)
        files_dir = self._slot_files_dir(slot_id)
        items: List[Dict[str, Any]] = []
        if not os.path.isdir(files_dir):
            return items
        for root_d, dirs, fns in os.walk(files_dir):
            dirs.sort()
            fns.sort()
            rel_root = os.path.relpath(root_d, files_dir)
            for d in dirs:
                rel_p = d if rel_root == "." else f"{rel_root}/{d}"
                items.append({
                    "path": "/" + rel_p.replace("\\", "/").strip("/"),
                    "name": d,
                    "is_dir": True,
                    "size": 0,
                })
            for fn in fns:
                rel_p = fn if rel_root == "." else f"{rel_root}/{fn}"
                full_p = os.path.join(root_d, fn)
                items.append({
                    "path": "/" + rel_p.replace("\\", "/").strip("/"),
                    "name": fn,
                    "is_dir": False,
                    "size": os.path.getsize(full_p),
                })
        return items

    def add_file_to_slot(self, slot_id: int, calc_path: str, raw_bytes: bytes) -> Dict[str, Any]:
        slot_id = int(slot_id)
        if self.is_busy(slot_id):
            raise ProfileError("Espera a que termine la operación actual en este disco.")
        clean_path = "/" + (calc_path or "").replace("\\", "/").strip("/")
        if clean_path == "/" or ".." in clean_path.split("/"):
            raise ProfileError("Ruta de archivo inválida para el disco.")

        files_dir = self._slot_files_dir(slot_id)
        local_target = os.path.join(files_dir, *clean_path.strip("/").split("/"))
        os.makedirs(os.path.dirname(local_target), exist_ok=True)
        with open(local_target, "wb") as f:
            f.write(raw_bytes)

        now_str = datetime.now().strftime("%d/%m %H:%M")
        with self._lock:
            data = self._read_manifest()
            for s in data["slots"]:
                if int(s["id"]) == slot_id:
                    if not s.get("name"):
                        s["name"] = f"Disco {slot_id}"
                    s["saved"] = True
                    s["updated_at"] = now_str
                    self._recompute_slot_stats(s)
                    self._write_manifest(data)
                    return s
        raise ProfileError(f"Slot {slot_id} no encontrado.")

    def create_dir_in_slot(self, slot_id: int, calc_path: str) -> Dict[str, Any]:
        slot_id = int(slot_id)
        if self.is_busy(slot_id):
            raise ProfileError("Espera a que termine la operación actual en este disco.")
        clean_path = "/" + (calc_path or "").replace("\\", "/").strip("/")
        if clean_path == "/" or ".." in clean_path.split("/"):
            raise ProfileError("Ruta de carpeta inválida.")
        files_dir = self._slot_files_dir(slot_id)
        local_dir = os.path.join(files_dir, *clean_path.strip("/").split("/"))
        os.makedirs(local_dir, exist_ok=True)
        now_str = datetime.now().strftime("%d/%m %H:%M")
        with self._lock:
            data = self._read_manifest()
            for s in data["slots"]:
                if int(s["id"]) == slot_id:
                    if not s.get("name"):
                        s["name"] = f"Disco {slot_id}"
                    s["saved"] = True
                    s["updated_at"] = now_str
                    self._recompute_slot_stats(s)
                    self._write_manifest(data)
                    return s
        raise ProfileError(f"Slot {slot_id} no encontrado.")

    def delete_file_from_slot(self, slot_id: int, calc_path: str) -> Dict[str, Any]:
        slot_id = int(slot_id)
        clean_path = "/" + (calc_path or "").replace("\\", "/").strip("/")
        if clean_path == "/" or ".." in clean_path.split("/"):
            raise ProfileError("Ruta inválida.")
        files_dir = self._slot_files_dir(slot_id)
        local_target = os.path.join(files_dir, *clean_path.strip("/").split("/"))
        if os.path.isdir(local_target):
            shutil.rmtree(local_target, ignore_errors=True)
        elif os.path.isfile(local_target):
            os.remove(local_target)

        with self._lock:
            data = self._read_manifest()
            for s in data["slots"]:
                if int(s["id"]) == slot_id:
                    self._recompute_slot_stats(s)
                    if s["files_count"] == 0 and s["folders_count"] == 0:
                        s["saved"] = False
                    self._write_manifest(data)
                    return s
        raise ProfileError(f"Slot {slot_id} no encontrado.")

    def clear_slot(self, slot_id: int) -> Dict[str, Any]:
        if self.is_busy(slot_id):
            raise ProfileError("Espera a que termine la operación actual en este slot.")
        with self._lock:
            data = self._read_manifest()
            for idx, s in enumerate(data["slots"]):
                if int(s["id"]) == int(slot_id):
                    s_dir = self._slot_dir(slot_id)
                    if os.path.isdir(s_dir):
                        shutil.rmtree(s_dir, ignore_errors=True)
                    empty = self._empty_slot(slot_id)
                    data["slots"][idx] = empty
                    self._write_manifest(data)
                    return empty
        raise ProfileError(f"Slot {slot_id} no encontrado.")

    def is_busy(self, slot_id: Optional[int] = None) -> bool:
        if slot_id is not None:
            st = self._progress.get(int(slot_id))
            return bool(st and st.get("running"))
        return any(st.get("running") for st in self._progress.values())

    def get_progress(self, slot_id: int) -> Dict[str, Any]:
        return dict(
            self._progress.get(
                int(slot_id),
                {
                    "slot_id": int(slot_id),
                    "running": False,
                    "done": False,
                    "error": "",
                    "mode": "",
                    "percent": 0,
                    "phase": "Inactivo",
                    "current_file": "",
                },
            )
        )

    def _set_progress(self, slot_id: int, **kwargs: Any) -> None:
        cur = self._progress.get(int(slot_id), {"slot_id": int(slot_id)})
        cur.update(kwargs)
        self._progress[int(slot_id)] = cur

    @staticmethod
    def _is_protected_ndless(path: str, protect_ndless: bool) -> bool:
        if not protect_ndless:
            return False
        norm = "/" + path.strip("/")
        return norm.lower() == "/ndless" or norm.lower().startswith("/ndless/")

    def _scan_calc_tree(
        self, client: NspireClient, protect_ndless: bool
    ) -> Tuple[List[str], List[Tuple[str, int]]]:
        """Retorna (carpetas_en_orden_topdown, lista_de_(ruta_archivo, size))."""
        folders: List[str] = []
        files: List[Tuple[str, int]] = []

        def _walk(dir_path: str) -> None:
            entries = client.list_dir(dir_path)
            for it in entries:
                p = it["path"]
                if self._is_protected_ndless(p, protect_ndless):
                    continue
                if it.get("is_dir"):
                    folders.append(p)
                    _walk(p)
                else:
                    files.append((p, int(it.get("size") or 0)))

        _walk("/")
        return folders, files

    def start_save(
        self, client: NspireClient, slot_id: int, protect_ndless: bool = True
    ) -> Dict[str, Any]:
        if not client.is_connected:
            raise NspireError("Conecta la calculadora TI-Nspire antes de guardar un perfil.")
        if self.is_busy():
            raise ProfileError("Ya hay una operación de perfil en curso.")

        slot_id = int(slot_id)
        # Validar que exista el slot
        slots = self.list_slots()
        slot_obj = next((s for s in slots if int(s["id"]) == slot_id), None)
        if not slot_obj:
            raise ProfileError(f"Slot {slot_id} no encontrado.")

        self._set_progress(
            slot_id,
            running=True,
            done=False,
            error="",
            mode="save",
            percent=5,
            phase="Escaneando archivos en TI-Nspire...",
            current_file="/",
        )

        def _worker() -> None:
            tmp_dir = os.path.join(self._slot_dir(slot_id), "files_tmp")
            final_dir = self._slot_files_dir(slot_id)
            try:
                if os.path.isdir(tmp_dir):
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                os.makedirs(tmp_dir, exist_ok=True)

                folders, files = self._scan_calc_tree(client, protect_ndless)
                total = max(1, len(files))

                for rel_folder in folders:
                    local_folder = os.path.join(tmp_dir, *rel_folder.strip("/").split("/"))
                    os.makedirs(local_folder, exist_ok=True)

                total_bytes = 0
                for idx, (calc_file, _sz) in enumerate(files, start=1):
                    pct = 10 + int((idx / total) * 85)
                    self._set_progress(
                        slot_id,
                        percent=min(95, pct),
                        phase=f"Guardando ({idx}/{len(files)})...",
                        current_file=calc_file,
                    )
                    raw = client.read_file(calc_file)
                    total_bytes += len(raw)
                    local_file = os.path.join(tmp_dir, *calc_file.strip("/").split("/"))
                    os.makedirs(os.path.dirname(local_file), exist_ok=True)
                    with open(local_file, "wb") as f:
                        f.write(raw)

                if os.path.isdir(final_dir):
                    shutil.rmtree(final_dir, ignore_errors=True)
                os.makedirs(self._slot_dir(slot_id), exist_ok=True)
                shutil.move(tmp_dir, final_dir)

                now_str = datetime.now().strftime("%d/%m %H:%M")
                with self._lock:
                    data = self._read_manifest()
                    for s in data["slots"]:
                        if int(s["id"]) == slot_id:
                            s["saved"] = True
                            if not s.get("name"):
                                s["name"] = f"Perfil {slot_id}"
                            s["files_count"] = len(files)
                            s["folders_count"] = len(folders)
                            s["total_bytes"] = total_bytes
                            s["updated_at"] = now_str
                            break
                    self._write_manifest(data)

                self._set_progress(
                    slot_id,
                    running=False,
                    done=True,
                    percent=100,
                    phase="Guardado OK",
                    current_file=f"{len(files)} archivos respaldados",
                )
            except Exception as exc:
                if os.path.isdir(tmp_dir):
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                self._set_progress(
                    slot_id,
                    running=False,
                    done=True,
                    error=str(exc),
                    phase="Error al guardar",
                    current_file=str(exc),
                )

        threading.Thread(target=_worker, daemon=True).start()
        return self.get_progress(slot_id)

    def start_load(
        self, client: NspireClient, slot_id: int, protect_ndless: bool = True
    ) -> Dict[str, Any]:
        if not client.is_connected:
            raise NspireError("Conecta la calculadora TI-Nspire antes de cargar un perfil.")
        if self.is_busy():
            raise ProfileError("Ya hay una operación de perfil en curso.")

        slot_id = int(slot_id)
        slots = self.list_slots()
        slot_obj = next((s for s in slots if int(s["id"]) == slot_id), None)
        if not slot_obj or not slot_obj.get("saved"):
            raise ProfileError("Este slot está vacío.")

        files_dir = self._slot_files_dir(slot_id)
        if not os.path.isdir(files_dir):
            raise ProfileError("No se encontraron los archivos del perfil en disco.")

        self._set_progress(
            slot_id,
            running=True,
            done=False,
            error="",
            mode="load",
            percent=5,
            phase="Preparando calculadora...",
            current_file="/",
        )

        def _worker() -> None:
            try:
                # 1. Borrar archivos actuales de la calculadora (respetando /ndless si aplica)
                old_folders, old_files = self._scan_calc_tree(client, protect_ndless)

                # Recolectar archivos y carpetas locales del perfil
                local_folders: List[str] = []
                local_files: List[Tuple[str, str]] = []
                for root_d, dirs, fns in os.walk(files_dir):
                    dirs.sort()
                    fns.sort()
                    rel_root = os.path.relpath(root_d, files_dir)
                    for d in dirs:
                        rel_p = d if rel_root == "." else f"{rel_root}/{d}"
                        calc_d = "/" + rel_p.replace("\\", "/").strip("/")
                        if not self._is_protected_ndless(calc_d, protect_ndless):
                            local_folders.append(calc_d)
                    for fn in fns:
                        rel_p = fn if rel_root == "." else f"{rel_root}/{fn}"
                        calc_f = "/" + rel_p.replace("\\", "/").strip("/")
                        if not self._is_protected_ndless(calc_f, protect_ndless):
                            local_files.append((os.path.join(root_d, fn), calc_f))

                total_ops = max(1, len(old_files) + len(old_folders) + len(local_folders) + len(local_files))
                done_ops = 0

                def _tick(phase_txt: str, file_txt: str) -> None:
                    nonlocal done_ops
                    done_ops += 1
                    pct = 5 + int((done_ops / total_ops) * 90)
                    self._set_progress(
                        slot_id,
                        percent=min(96, pct),
                        phase=phase_txt,
                        current_file=file_txt,
                    )

                for f_path, _sz in old_files:
                    _tick("Limpiando TI...", f_path)
                    client.delete_file(f_path)

                # Borrar carpetas de más profunda a menos profunda
                for d_path in sorted(old_folders, key=lambda p: p.count("/"), reverse=True):
                    _tick("Eliminando carpetas...", d_path)
                    try:
                        client.delete_dir(d_path)
                    except Exception:
                        pass

                # 2. Crear carpetas y subir archivos del perfil
                for d_path in sorted(local_folders, key=lambda p: p.count("/")):
                    _tick("Creando carpetas...", d_path)
                    try:
                        client.create_dir(d_path)
                    except Exception:
                        pass

                for local_f, calc_f in local_files:
                    _tick("Cargando a TI...", calc_f)
                    with open(local_f, "rb") as f:
                        client.write_file(calc_f, f.read())

                time.sleep(0.15)
                self._set_progress(
                    slot_id,
                    running=False,
                    done=True,
                    percent=100,
                    phase="Cargado OK",
                    current_file=f"Perfil '{slot_obj.get('name') or slot_id}' activo",
                )
            except Exception as exc:
                self._set_progress(
                    slot_id,
                    running=False,
                    done=True,
                    error=str(exc),
                    phase="Error al cargar",
                    current_file=str(exc),
                )

        threading.Thread(target=_worker, daemon=True).start()
        return self.get_progress(slot_id)

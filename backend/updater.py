"""
Módulo de Actualización Automática de NaSpire Studio (NaSuite).
Consulta GitHub Releases (github.com/NachoFari/NaSpire), compara versiones semánticas
y descarga + ejecuta automáticamente el instalador cuando hay una nueva versión.
"""

import json
import os
import re
import ssl
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from typing import Any, Dict, Tuple

APP_VERSION = "1.0.0"
GITHUB_REPO = "NachoFari/NaSpire"
RELEASES_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"


def _parse_version(ver: str) -> Tuple[int, ...]:
    nums = re.findall(r"\d+", ver or "0")
    return tuple(int(x) for x in nums[:4]) if nums else (0,)


def _urlopen_safe(req: urllib.request.Request, timeout: int = 12):
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.URLError:
        ctx = ssl._create_unverified_context()
        return urllib.request.urlopen(req, timeout=timeout, context=ctx)


def check_for_updates() -> Dict[str, Any]:
    """Consulta el último Release en GitHub y verifica si es más nuevo que APP_VERSION."""
    req = urllib.request.Request(
        RELEASES_API_URL,
        headers={
            "User-Agent": f"NaSpire-Studio/{APP_VERSION}",
            "Accept": "application/vnd.github+json",
        },
    )
    try:
        with _urlopen_safe(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return {
                "ok": True,
                "current_version": APP_VERSION,
                "latest_version": APP_VERSION,
                "update_available": False,
                "message": "Aún no hay Releases publicados en GitHub.",
                "release_url": f"https://github.com/{GITHUB_REPO}/releases",
            }
        return {
            "ok": False,
            "current_version": APP_VERSION,
            "update_available": False,
            "error": f"GitHub respondió HTTP {exc.code}",
        }
    except Exception as exc:
        return {
            "ok": False,
            "current_version": APP_VERSION,
            "update_available": False,
            "error": f"Sin conexión a GitHub ({exc})",
        }

    tag = (data.get("tag_name") or "").strip()
    latest_clean = tag.lstrip("vV") or APP_VERSION
    update_available = _parse_version(latest_clean) > _parse_version(APP_VERSION)

    # Buscar instalador Setup .exe o ZIP portable en los assets del release
    assets = data.get("assets") or []
    installer_url = ""
    installer_name = ""
    portable_url = ""
    for a in assets:
        name = (a.get("name") or "").lower()
        dl = a.get("browser_download_url") or ""
        if name.endswith(".exe") and ("setup" in name or "installer" in name):
            installer_url = dl
            installer_name = a.get("name")
        elif name.endswith(".zip") and not portable_url:
            portable_url = dl

    return {
        "ok": True,
        "current_version": APP_VERSION,
        "latest_version": latest_clean,
        "tag": tag,
        "update_available": update_available,
        "release_name": data.get("name") or f"NaSpire v{latest_clean}",
        "notes": (data.get("body") or "").strip()[:1500],
        "release_url": data.get("html_url") or f"https://github.com/{GITHUB_REPO}/releases",
        "installer_url": installer_url,
        "installer_name": installer_name,
        "portable_url": portable_url,
    }


def download_and_launch_installer(installer_url: str, installer_name: str = "") -> Dict[str, Any]:
    """Descarga el instalador .exe del release de GitHub y lo lanza en modo actualización silenciosa."""
    if not installer_url or not installer_url.startswith("https://"):
        raise ValueError("URL de instalador inválida.")

    fname = os.path.basename(installer_name or installer_url.split("?")[0]) or "NaSpire-Setup.exe"
    if not fname.lower().endswith(".exe"):
        fname += ".exe"

    dl_dir = os.path.join(tempfile.gettempdir(), "NaSpire_Update")
    os.makedirs(dl_dir, exist_ok=True)
    target = os.path.join(dl_dir, fname)

    req = urllib.request.Request(
        installer_url,
        headers={"User-Agent": f"NaSpire-Studio/{APP_VERSION}"},
    )
    with _urlopen_safe(req, timeout=120) as resp, open(target, "wb") as out:
        while True:
            chunk = resp.read(65536)
            if not chunk:
                break
            out.write(chunk)

    # Lanzar el instalador Inno Setup con /SILENT /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS
    subprocess.Popen(
        [target, "/SILENT", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"],
        close_fds=True,
    )
    return {"ok": True, "path": target, "launching": True}

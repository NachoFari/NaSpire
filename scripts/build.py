"""
Script oficial de compilación de NaSpire Studio (NaSuite).
Genera:
  - dist/NaSpire/NaSpire.exe (Ejecutable portable)
  - dist_installer/NaSpire-Setup-v<ver>.exe (Instalador Windows vía Inno Setup 6)
  - dist_installer/NaSpire-v<ver>-Windows-Portable.zip (Paquete portable)
"""

import os
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from backend.updater import APP_VERSION


def main() -> int:
    os.chdir(ROOT)
    pyinstaller = os.path.join(ROOT, ".venv", "Scripts", "pyinstaller.exe")
    if not os.path.isfile(pyinstaller):
        pyinstaller = shutil.which("pyinstaller") or "pyinstaller"

    print(f"=== Compilando NaSpire Studio v{APP_VERSION} ===")
    cmd = [
        pyinstaller,
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name", "NaSpire",
        "--icon", "naspire.ico",
        "--add-data", "templates;templates",
        "--add-data", "static;static",
        "--add-data", "backend;backend",
        "--add-data", "tools;tools",
        "--add-data", "naspire.ico;.",
        "--collect-binaries", "libusb_package",
        "--collect-data", "libusb_package",
        "--hidden-import", "usb.backend.libusb1",
        "--hidden-import", "PIL.Image",
        "--hidden-import", "Crypto.Cipher.DES3",
        "app.py",
    ]
    if subprocess.call(cmd) != 0:
        print("[ERROR] Falló PyInstaller.")
        return 1

    dist_dir = os.path.join(ROOT, "dist", "NaSpire")
    tools_src = os.path.join(ROOT, "tools")
    tools_dst = os.path.join(dist_dir, "tools")
    if os.path.isdir(tools_src):
        shutil.copytree(tools_src, tools_dst, dirs_exist_ok=True)

    # Inno Setup 6
    iscc_candidates = [
        r"C:\Users\Nacho\AppData\Local\Programs\Inno Setup 6\ISCC.exe",
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
        shutil.which("ISCC") or "",
    ]
    iscc = next((p for p in iscc_candidates if p and os.path.isfile(p)), None)
    if iscc:
        print("=== Generando instalador Windows (Inno Setup 6) ===")
        subprocess.check_call([iscc, "installer.iss"])
    else:
        print("[AVISO] Inno Setup 6 no encontrado; se omitió el instalador.")

    # ZIP Portable
    os.makedirs(os.path.join(ROOT, "dist_installer"), exist_ok=True)
    zip_path = os.path.join(ROOT, "dist_installer", f"NaSpire-v{APP_VERSION}-Windows-Portable.zip")
    print(f"=== Empaquetando {os.path.basename(zip_path)} ===")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for folder, _, files in os.walk(dist_dir):
            for fn in files:
                full = os.path.join(folder, fn)
                rel = os.path.relpath(full, dist_dir)
                zf.write(full, rel)

    print("[OK] Build completado en dist/NaSpire y dist_installer/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

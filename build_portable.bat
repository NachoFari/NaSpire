@echo off
cd /d "%~dp0"
echo ==================================================
echo   Compilando NaSpire Studio v1.0.0 (Ejecutable + Instalador)
echo ==================================================

".venv\Scripts\pyinstaller.exe" --noconfirm --onedir --windowed ^
  --name "NaSpire" ^
  --icon "naspire.ico" ^
  --add-data "templates;templates" ^
  --add-data "static;static" ^
  --add-data "backend;backend" ^
  --add-data "tools;tools" ^
  --add-data "naspire.ico;." ^
  --collect-binaries "libusb_package" ^
  --collect-data "libusb_package" ^
  --hidden-import "usb.backend.libusb1" ^
  --hidden-import "PIL.Image" ^
  --hidden-import "Crypto.Cipher.DES3" ^
  app.py

if errorlevel 1 (
    echo [ERROR] Fallo PyInstaller.
    pause
    exit /b 1
)

if exist "tools" (
    xcopy /E /I /Y "tools" "dist\NaSpire\tools\" >nul
)

echo.
echo [OK] Ejecutable portable listo en: dist\NaSpire\NaSpire.exe

set "ISCC="
if exist "C:\Users\Nacho\AppData\Local\Programs\Inno Setup 6\ISCC.exe" set "ISCC=C:\Users\Nacho\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"

if defined ISCC (
    echo.
    echo [INFO] Compilando instalador con Inno Setup 6...
    "%ISCC%" installer.iss
    if errorlevel 1 (
        echo [ERROR] Fallo Inno Setup.
    ) else (
        echo [OK] Instalador listo en: dist_installer\NaSpire-Setup-v1.0.0.exe
    )
) else (
    echo [AVISO] No se encontro Inno Setup 6. Solo se genero el ejecutable portable.
)

echo.
echo [INFO] Empaquetando ZIP portable...
powershell -NoProfile -Command "Compress-Archive -Path 'dist\NaSpire\*' -DestinationPath 'dist_installer\NaSpire-v1.0.0-Windows-Portable.zip' -Force"
echo [OK] Todo listo en dist\NaSpire y dist_installer\

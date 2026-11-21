@echo off
cd /d "%~dp0"
echo ==================================================
echo   Subiendo NaSpire Studio a GitHub (NachoFari/NaSpire)
echo ==================================================
git status
echo.
set /p MSG="Mensaje del commit (Enter = 'Actualizacion NaSpire'): "
if "%MSG%"=="" set MSG=Actualizacion NaSpire
git add -A
git commit -m "%MSG%"
git branch -M main
git push -u origin main
echo.
pause

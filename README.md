# NaSpire Studio (NaSuite)

Gestor portable y de escritorio para calculadoras **TI-Nspire** (CX II CAS, CX II, CX II-T, CX CAS, CX y modelos clásicos), parte del ecosistema **NaSuite** junto a **NaTex** por [NachoFari](https://github.com/NachoFari).

## Características principales

- **Conexión USB nativa (NavNet + NNSE):** Detección automática y reconexión estable en Windows sin depender del navegador.
- **Explorador de archivos completo:** Navegación por carpetas, subir archivos (botón o arrastrar y soltar), descargar, renombrar, mover/reordenar arrastrando sobre carpetas, crear carpetas, eliminar y **etiquetas automáticas** de las apps internas de cada `.tns`.
- **Pantalla en Vivo (Modo Proyector) y Capturas (SS):** Proyección en tiempo real con selector de velocidad, contador de FPS, Pantalla Completa, zoom, historial y exportación a PNG.
- **Creador Visual de documentos `.tns` nativos:**
  - **Listas y Hoja de Cálculo** 100% nativa (con plantilla RK4 incluida, autorrelleno arrastrable tipo Excel, `Ctrl+D`, `Ctrl+V` desde Excel).
  - **Funciones y Notas** nativas (pestaña 1.1 Calculadora + 1.2 Notas).
  - **Scripts Python (CX II)** y **Lua** compilados con `tools/luna.exe`.
- **Editor Visual `.tns`:** Doble clic en cualquier `.tns` del explorador para editar visualmente sus pestañas (Calculadora, Hoja de Cálculo, Notas, Gráficos) y modo XML avanzado opcional.
- **Catálogo oficial TI-Nspire CX II CAS:** Buscador de funciones reales con sintaxis, descripción, ejemplo y autocompletado en vivo.
- **Iconografía 100% Pixel Art 32×32** (tema *Fox Orange / NaSuite*, sin emojis).
- **Actualización automática vía GitHub Releases.**

## Uso en desarrollo

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python app.py
```

O ejecuta `iniciar_naspire.bat`.

## Compilar ejecutable portable e instalador

Ejecuta `build_portable.bat`. Genera:
- `dist\NaSpire\NaSpire.exe` (carpeta portable)
- `dist_installer\NaSpire-Setup-v1.0.0.exe` (instalador Windows)
- `dist_installer\NaSpire-v1.0.0-Windows-Portable.zip` (ZIP portable)

## Cómo publicar una nueva versión (Auto-Updater)

1. Actualiza `APP_VERSION` en `backend/updater.py` y `MyAppVersion` en `installer.iss` (ej. `1.1.0`).
2. Ejecuta `build_portable.bat`.
3. Sube los cambios a GitHub y crea un **Release** con el tag `v1.1.0` adjuntando `NaSpire-Setup-v1.1.0.exe` (y opcionalmente el `.zip` portable).
4. Todos los usuarios de NaSpire verán automáticamente el botón **"Actualizar a v1.1.0"** dentro de la app.

---
Desarrollado por **NachoFari** — [GitHub](https://github.com/NachoFari) | [Web](https://nachofari.github.io)

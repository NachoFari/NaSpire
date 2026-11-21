# NaSpire Studio — NaSuite

Aplicación de escritorio nativa y portable para gestionar calculadoras **TI-Nspire** (CX II CAS, CX II, CX II-T, CX CAS, CX y modelos clásicos), parte del ecosistema **NaSuite** junto a **NaTex** por [NachoFari](https://github.com/NachoFari).

## Descarga e Instalación (Windows 10 / 11)

Descarga la última versión desde la sección **[Releases](https://github.com/NachoFari/NaSpire/releases)**:

- **Instalador Windows (Recomendado):** `NaSpire-Setup-v1.0.0.exe` — instala NaSpire Studio con acceso directo en el Escritorio, Menú Inicio, desinstalador y **actualizaciones automáticas**.
- **Versión 100% Portable:** `NaSpire-v1.0.0-Windows-Portable.zip` — descomprime en cualquier PC y ejecuta **`NaSpire.exe`** sin instalar nada.

## Características principales

- **Conexión USB nativa (NavNet + NNSE):** Reconexión estable en Windows sin depender del navegador ni drivers externos.
- **Explorador de archivos:** Navegación por carpetas, subida con arrastrar y soltar, descarga, renombrar, mover/reordenar arrastrando a carpetas, crear carpetas, eliminar y **etiquetas automáticas** de las apps contenidas en cada `.tns`.
- **Modo Proyector en Vivo y Capturas (SS):** Proyección en tiempo real con selector de velocidad, contador de FPS, Pantalla Completa, zoom, historial y exportación a PNG.
- **Creador Visual de documentos `.tns` nativos:**
  - **Listas y Hoja de Cálculo** 100% nativa (plantilla RK4 incluida, autorrelleno arrastrable tipo Excel, `Ctrl+D`, `Ctrl+V` desde Excel/Sheets).
  - **Funciones y Notas** nativas (1.1 Calculadora + 1.2 Notas).
  - **Scripts Python (CX II)** y **Lua** compilados con `tools/luna.exe`.
- **Editor Visual `.tns`:** Doble clic en cualquier `.tns` del explorador para editar visualmente sus pestañas (Calculadora, Hoja de Cálculo, Notas, Gráficos) y modo XML avanzado.
- **Catálogo oficial TI-Nspire CX II CAS:** Buscador de funciones reales con descripción, ejemplo y autocompletado en vivo.
- **Iconografía 100% Pixel Art 32×32** (tema *Fox Orange / NaSuite*, sin emojis).
- **Actualización automática** integrada con GitHub Releases.

## Desarrollo y Compilación desde código fuente

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python app.py
```

Para compilar el ejecutable (`NaSpire.exe`), el instalador (`NaSpire-Setup-vX.Y.Z.exe`) y el ZIP portable:

```bash
.venv\Scripts\python scripts/build.py
```

---
Desarrollado por **NachoFari** — [GitHub](https://github.com/NachoFari) | [Web](https://nachofari.github.io)

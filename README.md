<div align="center">

<img src="static/img/icons/calc.png" width="64" height="64" alt="NaSpire Studio" />

# NaSpire Studio v1.0.0

**El entorno de escritorio portable, visual y nativo para calculadoras TI-Nspire — parte de NaSuite.**

[![Descargar Instalador](https://img.shields.io/badge/Descargar-NaSpire_v1.0.0_(.exe)-FF6B35?style=for-the-badge&logo=windows)](https://github.com/NachoFari/NaSpire/releases/latest)

[![Version](https://img.shields.io/badge/version-v1.0.0-FF6B35.svg)](https://github.com/NachoFari/NaSpire/releases)
[![Python](https://img.shields.io/badge/python-3.12%2B-38bdf8.svg)](https://www.python.org/)
[![Protocol](https://img.shields.io/badge/USB-NavNet_%2B_NNSE-10B981.svg)](https://github.com/NachoFari/NaSpire)
[![Suite](https://img.shields.io/badge/ecosistema-NaSuite-f3f4f8.svg)](https://github.com/NachoFari)

*Sin depender del navegador ni drivers propietarios pesados. Conecta tu TI-Nspire, organiza archivos, proyecta la pantalla en vivo y crea documentos `.tns` nativos en segundos.*

</div>

---

## <img src="static/img/icons/download.png" width="22" height="22" alt="" /> Descarga e Instalación

### Opción 1: Instalador de Windows (`NaSpire-Setup-v1.0.0.exe`) — Recomendado
1. Descarga la última versión desde **[Releases (v1.0.0)](https://github.com/NachoFari/NaSpire/releases/latest)**.
2. Ejecuta **`NaSpire-Setup-v1.0.0.exe`**.
3. Se instalará con acceso directo en el Escritorio, Menú Inicio, desinstalador y **actualizaciones automáticas** vía GitHub Releases.

### Opción 2: Versión 100% Portable (`NaSpire-v1.0.0-Windows-Portable.zip`)
1. Descarga y descomprime el `.zip` en cualquier carpeta o pendrive.
2. Ejecuta **`NaSpire.exe`** directamente en cualquier computador con Windows 10/11 sin instalar Python ni librerías.

### Opción 3: Desde Código Fuente
```bash
git clone https://github.com/NachoFari/NaSpire.git
cd NaSpire
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python app.py
```

Para compilar el ejecutable (`NaSpire.exe`), el instalador (`NaSpire-Setup-v1.0.0.exe`) y el ZIP portable:
```bash
.venv\Scripts\python scripts/build.py
```

---

## <img src="static/img/icons/camera.png" width="22" height="22" alt="" /> Galería

<div align="center">

[![NaSpire Studio Showcase](docs/screenshots/gallery_showcase.gif)](docs/screenshots/gallery_showcase.gif)

*Vista previa en carrusel de la interfaz de NaSpire Studio v1.0.0*

</div>

<details>
<summary><b>Ver capturas individuales por sección</b></summary>
<br>

| Explorador de Archivos y Etiquetas `.tns` | Proyector en Vivo y Capturas (SS) |
| :---: | :---: |
| [![Explorador de Archivos](docs/screenshots/showcase_explorer.png)](docs/screenshots/showcase_explorer.png) | [![Proyector en Vivo y Capturas](docs/screenshots/showcase_projector.png)](docs/screenshots/showcase_projector.png) |

| Creador Visual `.tns` (Hoja Nativa / Python / Lua) | Editor Visual `.tns` por Pestañas (RK4 Solver) |
| :---: | :---: |
| [![Creador Visual .tns](docs/screenshots/showcase_creator.png)](docs/screenshots/showcase_creator.png) | [![Editor Visual .tns](docs/screenshots/showcase_editor_rk4.png)](docs/screenshots/showcase_editor_rk4.png) |

</details>

---

## <img src="static/img/icons/file_tns.png" width="22" height="22" alt="" /> Funcionalidades Principales

- <img src="static/img/icons/usb.png" width="16" height="16" alt="" /> **Conexión USB Nativa (NavNet + NNSE):** Compatible con toda la familia **TI-Nspire** (`CX II CAS`, `CX II`, `CX II-T`, `CX CAS`, `CX`, `Touchpad` y `Clickpad`), con reinicio de sesión NNSE automático sin tener que desenchufar el cable.
- <img src="static/img/icons/folder.png" width="16" height="16" alt="" /> **Explorador de Archivos Completo:** Sube archivos arrastrando desde tu PC, descarga, renombra, mueve/reordena arrastrando sobre carpetas, crea carpetas, elimina y visualiza **etiquetas automáticas** de las apps internas de cada `.tns` (`Calculadora`, `Hoja de Cálculo`, `Notas`, `Gráficos`, `Geometría`, `Datos y Estadísticas`, `Python`, `Lua`).
- <img src="static/img/icons/tv_live.png" width="16" height="16" alt="" /> **Modo Proyector en Vivo y Capturas (SS):** Proyecta la pantalla de tu calculadora en tiempo real (`1 FPS`, `~4 FPS` o `Máximo USB`) con contador de FPS, **Pantalla Completa**, zoom hasta `2.5x`, historial de sesión, copiar al portapapeles y guardar PNG.
- <img src="static/img/icons/spreadsheet.png" width="16" height="16" alt="" /> **Creador Visual de Documentos `.tns` Nativos:**
  - **Listas y Hoja de Cálculo** 100% nativa (`urn:tabulator`, método 13) con plantilla **Runge-Kutta 4 (RK4)** lista para usar.
  - **Funciones y Notas** nativas (pestaña `1.1 Calculadora` con `Define f(x)=...` + pestaña `1.2 Notas`).
  - **Scripts Python (CX II)** y **Lua** compilados con `tools/luna.exe` integrado.
- <img src="static/img/icons/edit.png" width="16" height="16" alt="" /> **Editor Visual `.tns` por Pestañas:** Haz **doble clic** en cualquier `.tns` del explorador para editar visualmente sus pestañas (`Calculadora`, `Hoja de Cálculo`, `Notas`, `Gráficos`) o cambia al modo **`</> Ver XML`** avanzado.
- <img src="static/img/icons/catalog.png" width="16" height="16" alt="" /> **Catálogo Oficial TI-Nspire CX II CAS + Autocompletado:** Buscador por categoría con funciones 100% reales del catálogo oficial TI-Nspire CAS, sintaxis, descripción, ejemplos y autocompletado flotante al escribir fórmulas.
- <img src="static/img/icons/fox.png" width="16" height="16" alt="" /> **Estética Fox Orange (NaSuite) en Pixel Art 32×32:** Interfaz oscura profesional con splash screen y biblioteca completa de iconos en pixel art 32×32 sin emojis.
- <img src="static/img/icons/download.png" width="16" height="16" alt="" /> **Auto-Updater integrado:** Verifica automáticamente nuevos Releases en GitHub y descarga/instala actualizaciones en silencio con un clic.

---

## <img src="static/img/icons/calc.png" width="22" height="22" alt="" /> Atajos de Teclado (Hojas de Cálculo y Editor)

| Atajo / Acción | Función |
| :--- | :--- |
| **Doble clic en `.tns`** | Abrir archivo directamente en el **Editor Visual `.tns`** |
| **Arrastrar esquina naranja** | Autorrellenar series numéricas o fórmulas (ajusta referencias relativas y respeta `$A$1`) |
| `Ctrl + D` | Rellenar celda actual desde la celda superior (ajustando fórmula) |
| `Ctrl + V` | Pegar tablas completas directamente desde Excel o Google Sheets |
| `Enter` / `Shift + Enter` | Moverse a la fila siguiente / anterior |
| `Tab` / `Enter` *(en autocompletado)* | Insertar función oficial TI-Nspire sugerida |

---

<div align="center">
<img src="static/img/icons/fox.png" width="20" height="20" alt="" />
Desarrollado por <b><a href="https://github.com/NachoFari">NachoFari</a></b> — <b><a href="https://nachofari.github.io">NaSuite</a></b> (NaTex + NaSpire)
</div>

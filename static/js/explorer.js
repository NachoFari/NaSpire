/**
 * Módulo Explorador de Archivos de NaSpire
 * Soporta: navegación, subir (botón o drag&drop), descargar, renombrar, mover/reordenar, crear carpeta y borrar.
 */
window.NaSpireExplorer = {
    currentPath: "/",
    items: [],
    filterText: "",
    draggedItem: null,

    init() {
        document.getElementById("btn-refresh-dir").addEventListener("click", () => this.load(this.currentPath));
        document.getElementById("btn-new-folder").addEventListener("click", () => this.createFolder());
        document.getElementById("btn-upload-files").addEventListener("click", () => {
            document.getElementById("file-upload-input").click();
        });
        document.getElementById("file-upload-input").addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length) {
                this.uploadFileList(e.target.files);
                e.target.value = "";
            }
        });
        document.getElementById("file-search").addEventListener("input", (e) => {
            this.filterText = e.target.value.toLowerCase();
            this.render();
        });

        // Drag & Drop externo (PC -> Calculadora)
        const body = document.getElementById("explorer-body");
        const overlay = document.getElementById("drop-overlay");
        body.addEventListener("dragover", (e) => {
            if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                overlay.classList.add("visible");
            }
        });
        body.addEventListener("dragleave", (e) => {
            if (e.target === body || e.target === overlay) {
                overlay.classList.remove("visible");
            }
        });
        body.addEventListener("drop", (e) => {
            overlay.classList.remove("visible");
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                e.preventDefault();
                this.uploadFileList(e.dataTransfer.files);
            }
        });
    },

    async load(path = "/") {
        if (!window.NaSpireApp.connected) {
            this.renderDisconnected();
            return;
        }
        try {
            const res = await NaSpireAPI.listDir(path);
            this.currentPath = res.path || "/";
            this.items = res.items || [];
            // Sincronizar carpeta destino en el creador .tns
            const tnsDir = document.getElementById("tns-upload-dir");
            if (tnsDir) tnsDir.value = this.currentPath;
            this.renderBreadcrumbs();
            this.render();
        } catch (err) {
            NaSpireUI.toast(`Error listando ${path}: ${err.message}`, "error");
        }
    },

    renderDisconnected() {
        document.getElementById("breadcrumbs").innerHTML = `<span class="crumb current">/ Raíz</span>`;
        document.getElementById("explorer-container").innerHTML = `
            <div class="empty-state">
                <h3>Conecta tu TI-Nspire para explorar sus archivos</h3>
                <p>Arrastra archivos desde tu PC, crea carpetas, renombra, mueve o descarga documentos.</p>
            </div>`;
    },

    renderBreadcrumbs() {
        const el = document.getElementById("breadcrumbs");
        const parts = this.currentPath.split("/").filter(Boolean);
        let html = `<span class="crumb ${parts.length === 0 ? "current" : ""}" data-path="/">/ Raíz</span>`;
        let acc = "";
        parts.forEach((p, idx) => {
            acc += "/" + p;
            const isLast = idx === parts.length - 1;
            html += `<span class="crumb-sep">/</span><span class="crumb ${isLast ? "current" : ""}" data-path="${acc}">${p}</span>`;
        });
        el.innerHTML = html;
        el.querySelectorAll(".crumb").forEach((c) => {
            c.addEventListener("click", () => this.load(c.dataset.path));
        });
    },

    render() {
        const container = document.getElementById("explorer-container");
        const filtered = this.items.filter((it) => it.name.toLowerCase().includes(this.filterText));

        if (!filtered.length && this.currentPath === "/") {
            container.innerHTML = `<div class="empty-state"><h3>Carpeta vacía</h3><p>Arrastra archivos aquí o crea una carpeta nueva.</p></div>`;
            return;
        }

        const rowsHtml = [];
        if (this.currentPath !== "/") {
            const parent = "/" + this.currentPath.split("/").filter(Boolean).slice(0, -1).join("/");
            rowsHtml.push(`
                <tr data-parent-drop="${parent}">
                    <td colspan="3">
                        <div class="file-name-cell" data-open-dir="${parent}">
                            ${NaSpireUI.icon("folder_up", 18)}
                            <span>.. (Subir un nivel)</span>
                        </div>
                    </td>
                </tr>`);
        }

        filtered.forEach((it) => {
            const isTns = !it.is_dir && it.name.toLowerCase().endsWith(".tns");
            const icon = it.is_dir
                ? NaSpireUI.icon("folder", 18)
                : (isTns ? NaSpireUI.icon("file_tns", 18) : NaSpireUI.icon("file_generic", 18));
            const badge = it.is_dir
                ? `<span class="file-badge dir">CARPETA</span>`
                : (isTns ? `<span class="file-badge tns">.TNS</span>` : `<span class="file-badge">ARCHIVO</span>`);

            rowsHtml.push(`
                <tr draggable="true" data-path="${it.path}" data-name="${it.name}" data-dir="${it.is_dir ? "1" : "0"}" data-tns="${isTns ? "1" : "0"}">
                    <td>
                        <div class="file-name-cell" ${it.is_dir ? `data-open-dir="${it.path}"` : ""} ${isTns ? `title="Doble clic para abrir en Editor .tns"` : ""}>
                            ${icon}
                            <span>${it.name}</span>
                            ${badge}
                            ${isTns ? `<span class="tns-tags-slot" data-tags-path="${it.path}" data-tags-size="${it.size}" style="display:inline-flex;gap:4px;flex-wrap:wrap;"></span>` : ""}
                        </div>
                    </td>
                    <td style="color:var(--text-muted);font-family:Consolas,monospace;font-size:12px;">
                        ${it.is_dir ? "—" : NaSpireUI.formatBytes(it.size)}
                    </td>
                    <td>
                        <div class="row-actions">
                            ${isTns ? `<button class="btn btn-sm btn-ghost" data-act="edit" title="Abrir en Editor .tns">${NaSpireUI.icon("edit", 16)}</button>` : ""}
                            ${!it.is_dir ? `<button class="btn btn-sm btn-ghost" data-act="save_disk" title="Guardar en Disco (Perfil)">${NaSpireUI.icon("floppy", 16)}</button>` : ""}
                            ${!it.is_dir ? `<button class="btn btn-sm btn-ghost" data-act="download" title="Descargar">${NaSpireUI.icon("download", 16)}</button>` : ""}
                            <button class="btn btn-sm btn-ghost" data-act="rename" title="Renombrar">${NaSpireUI.icon("rename", 16)}</button>
                            <button class="btn btn-sm btn-ghost" data-act="move" title="Mover a otra carpeta">${NaSpireUI.icon("move", 16)}</button>
                            <button class="btn btn-sm btn-ghost" data-act="delete" title="Eliminar">${NaSpireUI.icon("trash", 16)}</button>
                        </div>
                    </td>
                </tr>`);
        });

        container.innerHTML = `
            <table class="file-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th style="width:120px;">Tamaño</th>
                        <th style="width:180px;text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml.join("")}</tbody>
            </table>`;

        // Eventos de abrir carpeta
        container.querySelectorAll("[data-open-dir]").forEach((el) => {
            el.addEventListener("click", () => this.load(el.dataset.openDir));
        });

        // Cargar etiquetas de apps internas (.tns) en segundo plano sin bloquear el explorador
        this.loadTnsTagsAsync(container);

        // Eventos de filas (acciones y drag&drop interno para reordenar/mover)
        container.querySelectorAll("tbody tr").forEach((tr) => {
            const path = tr.dataset.path;
            const name = tr.dataset.name;
            const isDir = tr.dataset.dir === "1";

            if (path) {
                if (tr.dataset.tns === "1") {
                    tr.addEventListener("dblclick", () => NaSpireEditor.openFromCalc(path));
                }
                tr.addEventListener("dragstart", (e) => {
                    this.draggedItem = { path, name, isDir };
                    e.dataTransfer.setData("text/plain", path);
                });

                tr.querySelectorAll("[data-act]").forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const act = btn.dataset.act;
                        if (act === "edit") NaSpireEditor.openFromCalc(path);
                        if (act === "save_disk") NaSpireProfiles.openSaveToDiskModal({ defaultPath: path, fromCalcPath: path });
                        if (act === "download") window.location.href = NaSpireAPI.downloadUrl(path);
                        if (act === "rename") this.renameItem(path, name);
                        if (act === "move") this.moveItem(path, name);
                        if (act === "delete") this.deleteItem(path, name, isDir);
                    });
                });
            }

            // Soltar sobre carpeta o sobre ".." para mover
            const targetFolder = tr.dataset.parentDrop || (isDir ? path : null);
            if (targetFolder) {
                tr.addEventListener("dragover", (e) => {
                    if (this.draggedItem && this.draggedItem.path !== targetFolder) {
                        e.preventDefault();
                        tr.classList.add("drag-over-folder");
                    }
                });
                tr.addEventListener("dragleave", () => tr.classList.remove("drag-over-folder"));
                tr.addEventListener("drop", async (e) => {
                    tr.classList.remove("drag-over-folder");
                    if (!this.draggedItem || this.draggedItem.path === targetFolder) return;
                    e.preventDefault();
                    const src = this.draggedItem.path;
                    const base = targetFolder.replace(/\/+$/, "");
                    const dst = `${base}/${this.draggedItem.name}`;
                    this.draggedItem = null;
                    try {
                        await NaSpireAPI.moveItem(src, dst);
                        NaSpireUI.toast(`Movido a ${dst}`, "success");
                        this.load(this.currentPath);
                    } catch (err) {
                        NaSpireUI.toast(`No se pudo mover: ${err.message}`, "error");
                    }
                });
            }
        });
    },

    async loadTnsTagsAsync(container) {
        const slots = Array.from(container.querySelectorAll(".tns-tags-slot"));
        const tagColors = {
            "Calculadora": "#94a3b8",
            "Listas y Hoja de Cálculo": "#2dd4bf",
            "Notas": "#fbbf24",
            "Gráficos": "#38bdf8",
            "Geometría": "#818cf8",
            "Datos y Estadísticas": "#f472b6",
            "Python": "#4ade80",
            "Script Lua": "#c084fc",
        };
        const shortLabel = {
            "Listas y Hoja de Cálculo": "Hoja de Cálculo",
            "Datos y Estadísticas": "Datos y Estad.",
        };
        const runPath = this.currentPath;
        for (const slot of slots) {
            if (this.currentPath !== runPath || !window.NaSpireApp.connected) break;
            const path = slot.dataset.tagsPath;
            const size = Number(slot.dataset.tagsSize || 0);
            if (size > 80000) continue; // Evitar archivos enormes (ej: binarios Ndless)
            try {
                const res = await NaSpireAPI.getTnsTags(path, size);
                if (this.currentPath !== runPath) break;
                const tags = res.tags || [];
                slot.innerHTML = tags
                    .map((t) => {
                        const col = tagColors[t] || "#9499ad";
                        const txt = shortLabel[t] || t;
                        return `<span class="file-badge" style="color:${col};border-color:${col}44;background:${col}18;">${txt}</span>`;
                    })
                    .join("");
            } catch {
                // Ignorar silenciosamente si no se puede leer
            }
        }
    },

    async createFolder() {
        if (!window.NaSpireApp.connected) return NaSpireUI.toast("Conecta la calculadora primero", "error");
        const name = await NaSpireUI.promptModal({
            title: "Nueva carpeta",
            desc: `Se creará dentro de ${this.currentPath}`,
            defaultValue: "Nueva_Carpeta",
            confirmText: "Crear",
        });
        if (!name) return;
        const base = this.currentPath.replace(/\/+$/, "");
        const target = `${base}/${name}`;
        try {
            await NaSpireAPI.mkdir(target);
            NaSpireUI.toast(`Carpeta '${name}' creada`, "success");
            this.load(this.currentPath);
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    async renameItem(path, oldName) {
        const newName = await NaSpireUI.promptModal({
            title: "Renombrar",
            desc: `Ruta actual: ${path}`,
            defaultValue: oldName,
            confirmText: "Renombrar",
        });
        if (!newName || newName === oldName) return;
        const base = this.currentPath.replace(/\/+$/, "");
        const dst = `${base}/${newName}`;
        try {
            await NaSpireAPI.moveItem(path, dst);
            NaSpireUI.toast(`Renombrado a ${newName}`, "success");
            this.load(this.currentPath);
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    async moveItem(path, name) {
        const dst = await NaSpireUI.promptModal({
            title: "Mover archivo / carpeta",
            desc: "Escribe la nueva ruta completa en la calculadora (ej: /MiCarpeta/" + name + ")",
            defaultValue: path,
            confirmText: "Mover",
        });
        if (!dst || dst === path) return;
        try {
            await NaSpireAPI.moveItem(path, dst);
            NaSpireUI.toast(`Movido a ${dst}`, "success");
            this.load(this.currentPath);
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    async deleteItem(path, name, isDir) {
        if (!confirm(`¿Seguro que deseas eliminar ${isDir ? "la carpeta" : "el archivo"} "${name}" de la calculadora?`)) {
            return;
        }
        try {
            await NaSpireAPI.deleteItem(path, isDir);
            NaSpireUI.toast(`Eliminado: ${name}`, "success");
            this.load(this.currentPath);
            window.NaSpireApp.refreshInfo();
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    async uploadFileList(fileList) {
        if (!window.NaSpireApp.connected) return NaSpireUI.toast("Conecta la calculadora primero", "error");
        const base = this.currentPath.replace(/\/+$/, "");
        for (const file of Array.from(fileList)) {
            try {
                NaSpireUI.toast(`Subiendo ${file.name}...`);
                const b64 = await NaSpireUI.fileToBase64(file);
                const dest = `${base}/${file.name}`;
                await NaSpireAPI.uploadFile(dest, b64);
                NaSpireUI.toast(`Subido: ${file.name}`, "success");
            } catch (err) {
                NaSpireUI.toast(`Error subiendo ${file.name}: ${err.message}`, "error");
            }
        }
        this.load(this.currentPath);
        window.NaSpireApp.refreshInfo();
    },
};

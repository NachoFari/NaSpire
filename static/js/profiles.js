/**
 * Módulo de Perfiles (Save Slots estilo disquete pixel-art) de NaSpire Studio
 */
window.NaSpireProfiles = {
    slots: [],
    pollTimers: {},
    particleTimers: {},
    draggedSlotId: null,
    editingSlotId: null,
    editingTheme: "orange",
    creatorTargetSlotId: null,
    pendingSaveToDisk: null,

    PALETTE: {
        orange: { name: "Fox Orange", main: "#FF6B35", dark: "#C84B1D", light: "#FF8E63", glow: "rgba(255, 107, 53, 0.36)" },
        cyan:   { name: "Celeste",    main: "#2B8CBE", dark: "#1B5E82", light: "#54B4E6", glow: "rgba(56, 189, 248, 0.34)" },
        green:  { name: "Esmeralda",  main: "#10B981", dark: "#059669", light: "#34D399", glow: "rgba(16, 185, 129, 0.34)" },
        violet: { name: "Violeta",    main: "#9333EA", dark: "#6B21A8", light: "#B86BFF", glow: "rgba(192, 132, 252, 0.34)" },
        amber:  { name: "Ámbar",      main: "#D97706", dark: "#92400E", light: "#FBBF24", glow: "rgba(251, 191, 36, 0.32)" },
        teal:   { name: "Teal",       main: "#0D9488", dark: "#115E59", light: "#2DD4BF", glow: "rgba(45, 212, 191, 0.32)" },
    },

    init() {
        document.getElementById("btn-profiles-add-row")?.addEventListener("click", () => this.addRow());

        // Modal Editar Disco
        document.getElementById("profile-edit-close")?.addEventListener("click", () => this.closeModal("profile-edit-modal"));
        document.getElementById("profile-edit-cancel")?.addEventListener("click", () => this.closeModal("profile-edit-modal"));
        document.getElementById("profile-edit-save")?.addEventListener("click", () => this.saveEditModal());
        document.getElementById("btn-mini-mkdir")?.addEventListener("click", () => this.miniAddFolder());
        document.getElementById("btn-mini-upload")?.addEventListener("click", () => {
            document.getElementById("mini-file-picker")?.click();
        });
        document.getElementById("mini-file-picker")?.addEventListener("change", (e) => {
            this.miniHandleFiles(e.target.files);
            e.target.value = "";
        });
        document.getElementById("btn-mini-create-tns")?.addEventListener("click", () => this.goToCreatorForSlot());

        // Modal Guardar en Disco (desde Explorador / Creador / Editor)
        document.getElementById("std-close")?.addEventListener("click", () => this.closeModal("save-to-disk-modal"));
        document.getElementById("std-cancel")?.addEventListener("click", () => this.closeModal("save-to-disk-modal"));
        document.getElementById("std-confirm")?.addEventListener("click", () => this.confirmSaveToDisk());

        this.loadSlots();
    },

    async loadSlots() {
        try {
            const res = await NaSpireAPI.profilesList();
            this.slots = res.slots || [];
            this.render();
        } catch (err) {
            NaSpireUI.toast(`Error cargando perfiles: ${err.message}`, "error");
        }
    },

    async addRow() {
        try {
            const res = await NaSpireAPI.profilesAddRow();
            this.slots = res.slots || [];
            this.render();
            NaSpireUI.toast("Se agregaron 3 nuevos discos", "success");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    _buildFloppySvg(slot) {
        const themeKey = this.PALETTE[slot.theme] ? slot.theme : "orange";
        const pal = slot.saved ? this.PALETTE[themeKey] : { main: "#34394E", dark: "#232738", light: "#4A516D" };
        const stripColor = this.PALETTE[themeKey].main;
        return `
            <svg class="floppy-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 2 H26 L27 3 H28 L29 4 V29 H28 V30 H4 V29 H3 Z" fill="#0E1015"/>
                <path d="M4 3 H25 L28 6 V28 H4 Z" fill="${pal.main}"/>
                <rect x="4" y="3" width="21" height="1" fill="${pal.light}"/>
                <rect x="4" y="4" width="1" height="24" fill="${pal.light}"/>
                <rect x="27" y="6" width="1" height="22" fill="${pal.dark}"/>
                <rect x="4" y="27" width="24" height="1" fill="${pal.dark}"/>

                <rect x="8" y="3" width="14" height="10" fill="#101116"/>
                <rect x="17" y="4" width="4" height="8" fill="#1e2230"/>
                <rect x="18" y="5" width="2" height="6" fill="#334155"/>

                <g class="floppy-shutter">
                    <rect x="10" y="3" width="11" height="10" fill="#CBD5E1"/>
                    <rect x="10" y="3" width="11" height="1" fill="#F8FAFC"/>
                    <rect x="10" y="12" width="11" height="1" fill="#64748B"/>
                    <rect x="16" y="4" width="3" height="7" fill="#181a24"/>
                </g>

                <rect x="5" y="25" width="2" height="2" fill="#0E1015"/>
                <rect x="25" y="25" width="2" height="2" fill="#0E1015"/>

                <rect x="6" y="15" width="20" height="13" fill="#0E1015"/>
                <rect x="7" y="16" width="18" height="11" fill="#F8FAFC"/>
                <rect x="7" y="16" width="18" height="2" fill="${stripColor}"/>
            </svg>
        `;
    },

    render() {
        const grid = document.getElementById("profiles-slots-grid");
        if (!grid) return;

        grid.innerHTML = this.slots
            .map((s) => {
                const themeKey = this.PALETTE[s.theme] ? s.theme : "orange";
                const pal = this.PALETTE[themeKey];
                const accent = s.saved ? pal.main : "#64748b";
                const glow = s.saved ? pal.glow : "rgba(148, 153, 173, 0.2)";
                const padId = String(s.id).padStart(2, "0");
                const sizeTxt = s.saved ? NaSpireUI.formatBytes(s.total_bytes || 0) : "0 B";
                const dateTxt = s.updated_at || "Sin guardar";

                return `
                    <div class="slot-item" draggable="true" data-slot-id="${s.id}" id="slot-item-${s.id}" style="--slot-accent:${accent};--slot-glow:${glow};">
                        <div class="floppy-progress-float" id="slot-ov-${s.id}">
                            <div class="ov-head">
                                <span id="slot-ov-title-${s.id}">Procesando...</span>
                                <span class="ov-pct" id="slot-ov-pct-${s.id}">0%</span>
                            </div>
                            <div class="ov-track"><div class="ov-fill" id="slot-ov-fill-${s.id}"></div></div>
                            <div class="ov-file" id="slot-ov-file-${s.id}">Iniciando...</div>
                        </div>

                        <div class="slot-header-pill">
                            <span class="slot-dot-state"></span>
                            <span>SAVE ${padId}</span>
                            <span style="color:var(--text-muted);font-weight:600;">• ${s.saved ? "LISTO" : "VACÍO"}</span>
                        </div>

                        <div class="floppy-stage">
                            <div class="particles-layer" id="slot-particles-${s.id}"></div>
                            ${this._buildFloppySvg(s)}

                            <div class="floppy-label-overlay">
                                <div class="label-title-row">
                                    <input
                                        class="label-title-input"
                                        type="text"
                                        value="${this._escAttr(s.name || "")}"
                                        placeholder="Escribir nombre..."
                                        maxlength="24"
                                        data-rename-slot="${s.id}"
                                    />
                                </div>
                                <div class="label-meta">
                                    ${
                                        s.saved
                                            ? `${s.files_count || 0} arch. • ${s.folders_count || 0} carp.<br/>Tamaño: ${sizeTxt}`
                                            : `Sin respaldo aún<br/>Listo para guardar`
                                    }
                                </div>
                                <div class="label-date">
                                    <span>${this._escHtml(dateTxt)}</span>
                                    <span>.TNS</span>
                                </div>
                            </div>
                        </div>

                        <div class="slot-actions">
                            <button class="btn btn-sm btn-flex" data-slot-save="${s.id}" title="Guardar archivos actuales de la TI-Nspire en este disco">Guardar</button>
                            <button class="btn btn-primary btn-sm btn-flex" data-slot-load="${s.id}" ${s.saved ? "" : "disabled"} title="Borrar archivos de la TI-Nspire e instalar este perfil">Cargar</button>
                            <button class="btn btn-sm btn-icon" data-slot-edit="${s.id}" title="Editar disco y ver archivos">${NaSpireUI.icon("edit", 15)}</button>
                            <button class="btn btn-sm btn-icon danger" data-slot-clear="${s.id}" ${s.saved ? "" : "disabled"} title="Vaciar disco">${NaSpireUI.icon("trash", 15)}</button>
                        </div>
                    </div>
                `;
            })
            .join("");

        // Eventos inline
        grid.querySelectorAll("[data-rename-slot]").forEach((inp) => {
            inp.addEventListener("change", () => this.renameInline(Number(inp.dataset.renameSlot), inp.value));
        });
        grid.querySelectorAll("[data-slot-save]").forEach((btn) => {
            btn.addEventListener("click", () => this.startSave(Number(btn.dataset.slotSave)));
        });
        grid.querySelectorAll("[data-slot-load]").forEach((btn) => {
            btn.addEventListener("click", () => this.startLoad(Number(btn.dataset.slotLoad)));
        });
        grid.querySelectorAll("[data-slot-edit]").forEach((btn) => {
            btn.addEventListener("click", () => this.openEditModal(Number(btn.dataset.slotEdit)));
        });
        grid.querySelectorAll("[data-slot-clear]").forEach((btn) => {
            btn.addEventListener("click", () => this.clearSlot(Number(btn.dataset.slotClear)));
        });

        this._bindDragDrop(grid);
    },

    _bindDragDrop(grid) {
        grid.querySelectorAll(".slot-item").forEach((el) => {
            el.addEventListener("dragstart", (e) => {
                if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") {
                    e.preventDefault();
                    return;
                }
                this.draggedSlotId = Number(el.dataset.slotId);
                el.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(this.draggedSlotId));
            });
            el.addEventListener("dragend", () => {
                el.classList.remove("dragging");
                grid.querySelectorAll(".slot-item").forEach((x) => x.classList.remove("drag-over"));
                this.draggedSlotId = null;
            });
            el.addEventListener("dragover", (e) => {
                e.preventDefault();
                const targetId = Number(el.dataset.slotId);
                if (this.draggedSlotId && targetId !== this.draggedSlotId) {
                    el.classList.add("drag-over");
                }
            });
            el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
            el.addEventListener("drop", async (e) => {
                e.preventDefault();
                el.classList.remove("drag-over");
                const targetId = Number(el.dataset.slotId);
                if (!this.draggedSlotId || targetId === this.draggedSlotId) return;
                const fromIdx = this.slots.findIndex((x) => x.id === this.draggedSlotId);
                const toIdx = this.slots.findIndex((x) => x.id === targetId);
                if (fromIdx < 0 || toIdx < 0) return;

                const [moved] = this.slots.splice(fromIdx, 1);
                this.slots.splice(toIdx, 0, moved);
                this.render();

                const droppedEl = document.getElementById(`slot-item-${moved.id}`);
                if (droppedEl) droppedEl.classList.add("drop-anim");

                try {
                    const orderedIds = this.slots.map((s) => s.id);
                    await NaSpireAPI.profilesReorder(orderedIds);
                } catch (_) {
                    // Ignorar si falla persistencia puntual
                }
            });
        });
    },

    async renameInline(slotId, val) {
        try {
            const res = await NaSpireAPI.profilesRename(slotId, val);
            const s = this.slots.find((x) => x.id === slotId);
            if (s && res.slot) Object.assign(s, res.slot);
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    async clearSlot(slotId) {
        const s = this.slots.find((x) => x.id === slotId);
        if (!s) return;
        const ok = confirm(`¿Vaciar el disco SAVE ${String(slotId).padStart(2, "0")} (${s.name || "Sin nombre"})?`);
        if (!ok) return;
        try {
            const res = await NaSpireAPI.profilesClear(slotId);
            const idx = this.slots.findIndex((x) => x.id === slotId);
            if (idx >= 0 && res.slot) this.slots[idx] = res.slot;
            this.render();
            NaSpireUI.toast("Disco vaciado", "success");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    _protectNdless() {
        const chk = document.getElementById("chk-protect-ndless");
        return chk ? chk.checked : true;
    },

    async startSave(slotId) {
        const s = this.slots.find((x) => x.id === slotId);
        if (s && s.saved) {
            const ok = confirm(`¿Sobrescribir SAVE ${String(slotId).padStart(2, "0")} (${s.name || "Perfil"}) con los archivos actuales de la calculadora?`);
            if (!ok) return;
        }
        try {
            await NaSpireAPI.profilesSave(slotId, this._protectNdless());
            this._startProgressPolling(slotId, "save");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    async startLoad(slotId) {
        const s = this.slots.find((x) => x.id === slotId);
        if (!s || !s.saved) return;
        const protect = this._protectNdless();
        const msg = protect
            ? `Se borrarán los archivos actuales de tu TI-Nspire (protegiendo /ndless) y se cargará "${s.name}". ¿Continuar?`
            : `ADVERTENCIA: Se borrarán TODOS los archivos de tu TI-Nspire (incluido /ndless) y se cargará "${s.name}". ¿Continuar?`;
        if (!confirm(msg)) return;
        try {
            await NaSpireAPI.profilesLoad(slotId, protect);
            this._startProgressPolling(slotId, "load");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    _spawnParticles(slotId, colors) {
        const layer = document.getElementById(`slot-particles-${slotId}`);
        if (!layer) return;
        for (let i = 0; i < 4; i++) {
            const p = document.createElement("div");
            p.className = "px-particle";
            const side = Math.floor(Math.random() * 4);
            let x, y, dx, dy;
            if (side === 0) { x = 10; y = 35 + Math.random() * 180; dx = -(20 + Math.random() * 35); dy = (Math.random() - 0.5) * 40; }
            else if (side === 1) { x = 265; y = 35 + Math.random() * 180; dx = 20 + Math.random() * 35; dy = (Math.random() - 0.5) * 40; }
            else if (side === 2) { x = 35 + Math.random() * 200; y = 12; dx = (Math.random() - 0.5) * 40; dy = -(20 + Math.random() * 32); }
            else { x = 35 + Math.random() * 200; y = 265; dx = (Math.random() - 0.5) * 40; dy = 18 + Math.random() * 30; }
            p.style.left = `${x}px`;
            p.style.top = `${y}px`;
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.setProperty("--dx", `${dx}px`);
            p.style.setProperty("--dy", `${dy}px`);
            layer.appendChild(p);
            setTimeout(() => p.remove(), 860);
        }
    },

    _startProgressPolling(slotId, mode) {
        if (this.pollTimers[slotId]) clearInterval(this.pollTimers[slotId]);
        if (this.particleTimers[slotId]) clearInterval(this.particleTimers[slotId]);

        const slotEl = document.getElementById(`slot-item-${slotId}`);
        const ov = document.getElementById(`slot-ov-${slotId}`);
        const title = document.getElementById(`slot-ov-title-${slotId}`);
        const pct = document.getElementById(`slot-ov-pct-${slotId}`);
        const fill = document.getElementById(`slot-ov-fill-${slotId}`);
        const fileEl = document.getElementById(`slot-ov-file-${slotId}`);

        if (ov) {
            ov.classList.remove("done");
            ov.classList.add("visible");
        }
        if (slotEl) slotEl.classList.add("busy");

        const pColors = mode === "save" ? ["#38BDF8", "#FF6B35", "#f3f4f8"] : ["#FF6B35", "#10B981", "#fbbf24"];
        this.particleTimers[slotId] = setInterval(() => this._spawnParticles(slotId, pColors), 150);

        this.pollTimers[slotId] = setInterval(async () => {
            try {
                const res = await NaSpireAPI.profilesProgress(slotId);
                const st = res.progress || {};
                if (title) title.textContent = st.phase || "Procesando...";
                if (pct) pct.textContent = `${st.percent || 0}%`;
                if (fill) fill.style.width = `${st.percent || 0}%`;
                if (fileEl) fileEl.textContent = st.current_file || "";

                if (!st.running && st.done) {
                    clearInterval(this.pollTimers[slotId]);
                    clearInterval(this.particleTimers[slotId]);
                    if (slotEl) slotEl.classList.remove("busy");

                    if (st.error) {
                        if (ov) ov.classList.remove("visible", "done");
                        NaSpireUI.toast(st.error, "error");
                        return;
                    }

                    if (ov) ov.classList.add("done");
                    this._spawnParticles(slotId, ["#10B981", "#34d399", "#f3f4f8"]);
                    NaSpireUI.toast(mode === "save" ? "Perfil guardado en disco" : "Perfil cargado en TI-Nspire", "success");

                    setTimeout(async () => {
                        await this.loadSlots();
                        if (mode === "load" && NaSpireApp.connected) {
                            NaSpireExplorer.load("/");
                            NaSpireApp.refreshInfo();
                        }
                    }, 950);
                }
            } catch (_) {
                // Continuar polling en caso de micro-pausa
            }
        }, 280);
    },

    // --- Modal Editar Disco + Mini Explorador ---
    async openEditModal(slotId) {
        const s = this.slots.find((x) => x.id === slotId);
        if (!s) return;
        this.editingSlotId = slotId;
        this.editingTheme = this.PALETTE[s.theme] ? s.theme : "orange";

        document.getElementById("profile-edit-title").textContent = `Editar SAVE ${String(slotId).padStart(2, "0")}`;
        document.getElementById("profile-edit-name").value = s.name || "";
        this._renderEditSwatches();
        await this._refreshMiniExplorer();
        document.getElementById("profile-edit-modal").classList.add("open");
    },

    _renderEditSwatches() {
        const box = document.getElementById("profile-edit-swatches");
        if (!box) return;
        box.innerHTML = Object.keys(this.PALETTE)
            .map(
                (k) => `
                <button
                    type="button"
                    class="color-swatch ${k === this.editingTheme ? "selected" : ""}"
                    style="background:${this.PALETTE[k].main};"
                    title="${this.PALETTE[k].name}"
                    data-swatch="${k}"
                ></button>`
            )
            .join("");

        box.querySelectorAll("[data-swatch]").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.editingTheme = btn.dataset.swatch;
                this._renderEditSwatches();
            });
        });
    },

    async _refreshMiniExplorer() {
        const list = document.getElementById("profile-mini-explorer");
        const lbl = document.getElementById("profile-edit-files-label");
        if (!list) return;
        list.innerHTML = `<div class="mini-item" style="color:var(--text-muted);">Cargando contenido...</div>`;
        try {
            const res = await NaSpireAPI.profilesContents(this.editingSlotId);
            const items = res.items || [];
            if (lbl) lbl.textContent = `Contenido del disco (${items.length} elementos)`;
            if (!items.length) {
                list.innerHTML = `<div class="mini-item" style="color:var(--text-muted);">Este disco está vacío.</div>`;
                return;
            }
            list.innerHTML = items
                .map(
                    (it) => `
                    <div class="mini-item">
                        <span class="mini-path">
                            ${NaSpireUI.icon(it.is_dir ? "folder" : it.name.toLowerCase().endsWith(".tns") ? "file_tns" : "file_generic", 14)}
                            <span>${this._escHtml(it.path)}</span>
                        </span>
                        <span class="mini-meta">
                            <span>${it.is_dir ? "CARPETA" : NaSpireUI.formatBytes(it.size)}</span>
                            <button type="button" class="mini-del" data-del-path="${this._escAttr(it.path)}">Quitar</button>
                        </span>
                    </div>`
                )
                .join("");

            list.querySelectorAll("[data-del-path]").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    try {
                        await NaSpireAPI.profilesDeleteFile(this.editingSlotId, btn.dataset.delPath);
                        await this._refreshMiniExplorer();
                        await this.loadSlots();
                    } catch (err) {
                        NaSpireUI.toast(err.message, "error");
                    }
                });
            });
        } catch (err) {
            list.innerHTML = `<div class="mini-item" style="color:var(--error);">${this._escHtml(err.message)}</div>`;
        }
    },

    async miniAddFolder() {
        const folderName = prompt("Nombre o ruta de la carpeta dentro del disco (ej: Analisis C3):", "NuevaCarpeta");
        if (!folderName || !folderName.trim()) return;
        try {
            await NaSpireAPI.profilesMkdir(this.editingSlotId, folderName.trim());
            await this._refreshMiniExplorer();
            await this.loadSlots();
            NaSpireUI.toast("Carpeta creada en el disco", "success");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    async miniHandleFiles(fileList) {
        if (!fileList || !fileList.length) return;
        const destFolder = prompt("Carpeta destino dentro del disco (ej: / o /Analisis Numericos C3):", "/");
        if (destFolder === null) return;
        const base = destFolder.trim() === "/" || !destFolder.trim()
            ? ""
            : "/" + destFolder.trim().replace(/^\/+|\/+$/g, "");

        try {
            for (const file of Array.from(fileList)) {
                const buf = await file.arrayBuffer();
                const b64 = NaSpireUI.arrayBufferToBase64(buf);
                await NaSpireAPI.profilesAddFile({
                    slot_id: this.editingSlotId,
                    path: `${base}/${file.name}`,
                    content_base64: b64,
                });
            }
            await this._refreshMiniExplorer();
            await this.loadSlots();
            NaSpireUI.toast(`${fileList.length} archivo(s) agregado(s) al disco`, "success");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    goToCreatorForSlot() {
        const s = this.slots.find((x) => x.id === this.editingSlotId);
        if (!s) return;
        this.creatorTargetSlotId = s.id;
        this.closeModal("profile-edit-modal");
        NaSpireApp.switchView("creator");
        const banner = document.getElementById("creator-disk-banner");
        if (banner) {
            banner.style.display = "flex";
            banner.innerHTML = `<span>Modo Disco activo: <b>SAVE ${String(s.id).padStart(2, "0")} (${this._escHtml(s.name || "Sin título")})</b> — usa "Guardar en Disco" al terminar.</span>`;
        }
        NaSpireUI.toast(`Creador listo para guardar en SAVE ${String(s.id).padStart(2, "0")}`, "success");
    },

    async saveEditModal() {
        const name = document.getElementById("profile-edit-name").value.trim();
        try {
            await NaSpireAPI.profilesRename(this.editingSlotId, name, this.editingTheme);
            this.closeModal("profile-edit-modal");
            await this.loadSlots();
            NaSpireUI.toast("Disco actualizado", "success");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    // --- Modal "Guardar en Disco" desde Explorador / Creador / Editor ---
    async openSaveToDiskModal(opts) {
        this.pendingSaveToDisk = opts;
        if (!this.slots.length) {
            await this.loadSlots();
        }
        const sel = document.getElementById("std-slot-select");
        const preId = this.creatorTargetSlotId || (this.slots[0] && this.slots[0].id) || 1;
        sel.innerHTML = this.slots
            .map(
                (s) => `<option value="${s.id}" ${s.id === preId ? "selected" : ""}>SAVE ${String(s.id).padStart(2, "0")} — ${this._escHtml(s.name || "(Vacío)")}</option>`
            )
            .join("");
        document.getElementById("std-path-input").value = opts.defaultPath || "/archivo.tns";
        document.getElementById("save-to-disk-modal").classList.add("open");
    },

    async confirmSaveToDisk() {
        if (!this.pendingSaveToDisk) return;
        const slotId = Number(document.getElementById("std-slot-select").value);
        const destPath = document.getElementById("std-path-input").value.trim();
        if (!destPath) {
            NaSpireUI.toast("Ingresa una ruta válida", "error");
            return;
        }
        try {
            NaSpireUI.toast("Guardando en disco...");
            if (this.pendingSaveToDisk.fromCalcPath) {
                await NaSpireAPI.profilesAddFile({
                    slot_id: slotId,
                    path: destPath,
                    from_calc_path: this.pendingSaveToDisk.fromCalcPath,
                });
            } else if (typeof this.pendingSaveToDisk.getBase64 === "function") {
                const b64 = await this.pendingSaveToDisk.getBase64();
                if (!b64) return;
                await NaSpireAPI.profilesAddFile({
                    slot_id: slotId,
                    path: destPath,
                    content_base64: b64,
                });
            }
            this.closeModal("save-to-disk-modal");
            await this.loadSlots();
            NaSpireUI.toast(`Guardado en SAVE ${String(slotId).padStart(2, "0")}: ${destPath}`, "success");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    closeModal(id) {
        document.getElementById(id)?.classList.remove("open");
    },

    _escAttr(s) {
        return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },

    _escHtml(s) {
        return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
};

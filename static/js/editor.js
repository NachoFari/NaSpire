/**
 * Módulo Editor Visual + XML de Archivos .tns (NaSpire Studio — NaSuite)
 * Muestra las pestañas reales del documento (1.1 Calculadora, 1.2 Hoja de Cálculo, 1.3 Notas, Gráficos)
 * con editores visuales cómodos y un botón opcional para ver/editar el XML crudo.
 */
window.NaSpireEditor = {
    filename: "",
    calcPath: "",
    files: {},
    pages: [],
    activePageIdx: 0,
    activeFile: "",
    xmlMode: false,

    init() {
        document.getElementById("btn-editor-open-local")?.addEventListener("click", () => {
            document.getElementById("editor-local-file").click();
        });
        document.getElementById("editor-local-file")?.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
                NaSpireUI.toast(`Abriendo ${file.name}...`);
                const b64 = await NaSpireUI.fileToBase64(file);
                const res = await NaSpireAPI.inspectTns({ filename: file.name, content_base64: b64 });
                this.loadDoc(res);
                NaSpireUI.toast(`${file.name} cargado`, "success");
            } catch (err) {
                NaSpireUI.toast(err.message, "error");
            }
        });

        document.getElementById("btn-editor-toggle-xml")?.addEventListener("click", () => {
            this.xmlMode = !this.xmlMode;
            this.updateModeVisibility();
        });

        document.getElementById("btn-editor-pretty")?.addEventListener("click", async () => {
            if (!this.activeFile) return;
            const area = document.getElementById("editor-xml-area");
            try {
                const res = await NaSpireAPI.prettyXml(area.value);
                area.value = res.xml;
                this.files[this.activeFile] = res.xml;
                NaSpireUI.toast("XML formateado", "success");
            } catch (err) {
                NaSpireUI.toast(err.message, "error");
            }
        });

        document.getElementById("editor-xml-area")?.addEventListener("input", (e) => {
            if (this.activeFile) {
                this.files[this.activeFile] = e.target.value;
            }
        });

        document.getElementById("btn-editor-download")?.addEventListener("click", () => this.save(false));
        document.getElementById("btn-editor-save-calc")?.addEventListener("click", () => this.save(true));
    },

    async openFromCalc(calcPath) {
        if (!window.NaSpireApp.connected) {
            return NaSpireUI.toast("Conecta la calculadora primero", "error");
        }
        window.NaSpireApp.switchView("editor");
        NaSpireUI.toast(`Abriendo ${calcPath}...`);
        try {
            const res = await NaSpireAPI.inspectTns({ calc_path: calcPath });
            this.loadDoc(res);
            NaSpireUI.toast(`Abierto: ${res.filename}`, "success");
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    loadDoc(res) {
        this.filename = res.filename || "documento.tns";
        this.calcPath = res.calc_path || "";
        this.files = res.files || {};
        this.pages = (res.pages || []).map((p) => ({ ...p, modified: false }));
        this.activePageIdx = 0;
        this.xmlMode = false;

        const names = Object.keys(this.files);
        this.activeFile = names.includes("Problem1.xml") ? "Problem1.xml" : (names[0] || "");

        document.getElementById("editor-doc-title").textContent = this.calcPath || this.filename;
        document.getElementById("editor-save-path").value = this.calcPath || `/${this.filename}`;
        document.getElementById("btn-editor-toggle-xml").disabled = !this.activeFile;
        document.getElementById("btn-editor-pretty").disabled = !this.activeFile;
        document.getElementById("btn-editor-download").disabled = !this.activeFile;
        document.getElementById("btn-editor-save-calc").disabled = !this.activeFile;

        this.updateModeVisibility();
        this.renderPageTabs();
        this.renderActivePage();
        this.renderFileTabs();
        this.selectFile(this.activeFile);
    },

    updateModeVisibility() {
        const visPane = document.getElementById("editor-visual-pane");
        const xmlPane = document.getElementById("editor-xml-pane");
        const btnToggle = document.getElementById("btn-editor-toggle-xml");
        const btnPretty = document.getElementById("btn-editor-pretty");
        if (this.xmlMode) {
            visPane.style.display = "none";
            xmlPane.style.display = "flex";
            btnToggle.textContent = "Vista Visual";
            btnPretty.style.display = "inline-flex";
        } else {
            visPane.style.display = "flex";
            xmlPane.style.display = "none";
            btnToggle.textContent = "</> Ver XML";
            btnPretty.style.display = "none";
        }
    },

    renderPageTabs() {
        const wrap = document.getElementById("editor-page-tabs");
        if (!this.pages.length) {
            wrap.innerHTML = `<span class="device-meta-chip">Sin pestañas visuales (usa Ver XML)</span>`;
            return;
        }
        const icons = {
            calculator: "calc",
            spreadsheet: "spreadsheet",
            notes: "notes",
            graph: "graph",
            raw: "file_generic",
        };
        wrap.innerHTML = this.pages
            .map((p, idx) => {
                const ic = NaSpireUI.icon(icons[p.kind] || "file_generic", 15);
                const active = idx === this.activePageIdx ? "btn-primary" : "";
                return `<button class="btn btn-sm ${active}" data-page-idx="${idx}">${ic} ${p.id} ${p.label}</button>`;
            })
            .join("");

        wrap.querySelectorAll("[data-page-idx]").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.syncCurrentPageFromDom();
                this.activePageIdx = Number(btn.dataset.pageIdx);
                this.xmlMode = false;
                this.updateModeVisibility();
                this.renderPageTabs();
                this.renderActivePage();
            });
        });
    },

    renderActivePage() {
        const pane = document.getElementById("editor-visual-pane");
        const page = this.pages[this.activePageIdx];
        if (!page) {
            pane.innerHTML = `<div class="empty-state"><h3>Sin pestañas detectadas</h3><p>Usa el botón <b>&lt;/&gt; Ver XML</b> para editar el documento directamente.</p></div>`;
            return;
        }

        if (page.kind === "calculator") {
            this._renderCalculator(pane, page);
        } else if (page.kind === "spreadsheet") {
            this._renderSpreadsheet(pane, page);
        } else if (page.kind === "notes") {
            this._renderNotes(pane, page);
        } else if (page.kind === "graph") {
            this._renderGraph(pane, page);
        } else {
            pane.innerHTML = `
                <div class="empty-state">
                    <h3>${page.id} — ${page.label}</h3>
                    <p>Esta aplicación (${page.type}) no tiene editor visual dedicado todavía. Puedes editarla usando el botón <b>&lt;/&gt; Ver XML</b>.</p>
                </div>`;
        }
    },

    _renderCalculator(pane, page) {
        const syms = page.visual.symbols || [];
        const entries = page.visual.entries || [];

        const symRows = syms
            .map(
                (s, i) => `
                <div style="display:grid;grid-template-columns:105px 110px 100px 1fr 34px;gap:8px;align-items:center;" data-ed-sym="${i}">
                    <select class="select" data-sym-f="kind" style="padding:7px 8px;">
                        <option value="function" ${s.kind === "function" ? "selected" : ""}>Función</option>
                        <option value="var" ${s.kind !== "function" ? "selected" : ""}>Variable</option>
                    </select>
                    <input class="input" data-sym-f="name" value="${this._escAttr(s.name)}" placeholder="nombre" />
                    <input class="input" data-sym-f="params" value="${this._escAttr(s.params)}" placeholder="x,y" />
                    <input class="input" data-sym-f="value" value="${this._escAttr(s.value)}" placeholder="expresión o valor" style="font-family:Consolas,monospace;" />
                    <button class="btn btn-danger btn-icon" data-del-sym="${i}">×</button>
                </div>`
            )
            .join("");

        const entryRows = entries
            .map(
                (e, i) => `
                <div style="display:grid;grid-template-columns:1fr 180px 34px;gap:8px;align-items:center;" data-ed-entry="${i}">
                    <input class="input" data-ent-f="expr" value="${this._escAttr(e.expr)}" placeholder="Define f(x)=x^2" style="font-family:Consolas,monospace;" />
                    <input class="input" data-ent-f="result" value="${this._escAttr(e.result)}" placeholder="Resultado" style="font-family:Consolas,monospace;color:var(--text-muted);" />
                    <button class="btn btn-danger btn-icon" data-del-ent="${i}">×</button>
                </div>`
            )
            .join("");

        pane.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <strong style="font-size:13px;color:var(--fox-orange);">ƒ(x) Funciones y Variables del Documento</strong>
                        <button id="btn-ed-add-sym" class="btn btn-sm">+ Agregar símbolo</button>
                    </div>
                    <div id="ed-sym-list" style="display:flex;flex-direction:column;gap:7px;">${symRows || '<span style="font-size:12px;color:var(--text-muted);">No hay funciones/variables definidas aún.</span>'}</div>
                </div>
                <div style="border-top:1px solid var(--border-color);padding-top:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <strong style="font-size:13px;">${NaSpireUI.icon("calc", 15)} Historial / Comandos de la pestaña ${page.id}</strong>
                        <button id="btn-ed-add-ent" class="btn btn-sm">+ Agregar comando</button>
                    </div>
                    <div id="ed-ent-list" style="display:flex;flex-direction:column;gap:7px;">${entryRows || '<span style="font-size:12px;color:var(--text-muted);">Sin comandos en esta pestaña.</span>'}</div>
                </div>
            </div>`;

        pane.querySelector("#btn-ed-add-sym").addEventListener("click", () => {
            this.syncCurrentPageFromDom();
            page.visual.symbols.push({ kind: "function", name: "g", params: "x", value: "x^2" });
            page.modified = true;
            this._renderCalculator(pane, page);
        });
        pane.querySelector("#btn-ed-add-ent").addEventListener("click", () => {
            this.syncCurrentPageFromDom();
            page.visual.entries.push({ expr: "Define g(x)=x^2", result: "Hecho" });
            page.modified = true;
            this._renderCalculator(pane, page);
        });
        pane.querySelectorAll("[data-del-sym]").forEach((b) => {
            b.addEventListener("click", () => {
                this.syncCurrentPageFromDom();
                page.visual.symbols.splice(Number(b.dataset.delSym), 1);
                page.modified = true;
                this._renderCalculator(pane, page);
            });
        });
        pane.querySelectorAll("[data-del-ent]").forEach((b) => {
            b.addEventListener("click", () => {
                this.syncCurrentPageFromDom();
                page.visual.entries.splice(Number(b.dataset.delEnt), 1);
                page.modified = true;
                this._renderCalculator(pane, page);
            });
        });
    },

    _renderSpreadsheet(pane, page) {
        const cols = page.visual.columns || [];
        const formulas = page.visual.formulas || [];
        const rows = page.visual.rows || [];
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        let thead = `<thead><tr><th style="width:42px;">#</th>`;
        cols.forEach((_, idx) => {
            thead += `<th>${letters[idx] || "C" + (idx + 1)}</th>`;
        });
        thead += `</tr></thead>`;

        let tbody = `<tbody><tr><th>Var</th>`;
        cols.forEach((c, idx) => {
            tbody += `<td><input data-ed-scol="${idx}" value="${this._escAttr(c)}" style="color:var(--fox-orange);font-weight:700;" /></td>`;
        });
        tbody += `</tr><tr><th>ƒ(x)</th>`;
        cols.forEach((_, idx) => {
            tbody += `<td><input data-ed-sform="${idx}" value="${this._escAttr(formulas[idx] || "")}" style="color:#60a5fa;" placeholder="=..." /></td>`;
        });
        tbody += `</tr>`;

        rows.forEach((r, rIdx) => {
            tbody += `<tr><th>${rIdx + 1}</th>`;
            cols.forEach((_, cIdx) => {
                tbody += `<td><input data-ed-sr="${rIdx}" data-ed-sc="${cIdx}" value="${this._escAttr(r[cIdx] || "")}" /></td>`;
            });
            tbody += `</tr>`;
        });
        tbody += `</tbody>`;

        pane.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12.5px;color:var(--text-muted);">Arrastra la esquina naranja para autorrellenar, usa Ctrl+D, Ctrl+V desde Excel o escribe funciones TI:</span>
                <div style="display:flex;gap:6px;">
                    <button id="btn-ed-add-col" class="btn btn-sm">+ Columna</button>
                    <button id="btn-ed-add-row" class="btn btn-sm">+ Fila</button>
                </div>
            </div>
            <div class="sheet-wrap" style="overflow:auto;max-height:460px;">
                <table id="ed-sheet-table" class="sheet-table">${thead}${tbody}</table>
            </div>`;

        NaSpireSheetUX.enhance(pane.querySelector("#ed-sheet-table"), {
            rowAttr: "data-ed-sr",
            colAttr: "data-ed-sc",
            onAddRows: (n) => {
                this.syncCurrentPageFromDom();
                for (let i = 0; i < n; i++) page.visual.rows.push(page.visual.columns.map(() => ""));
                page.modified = true;
                this._renderSpreadsheet(pane, page);
            },
            onChanged: () => this.syncCurrentPageFromDom(),
        });

        pane.querySelector("#btn-ed-add-col").addEventListener("click", () => {
            this.syncCurrentPageFromDom();
            page.visual.columns.push("");
            page.visual.formulas.push("");
            page.visual.rows.forEach((r) => r.push(""));
            page.modified = true;
            this._renderSpreadsheet(pane, page);
        });
        pane.querySelector("#btn-ed-add-row").addEventListener("click", () => {
            this.syncCurrentPageFromDom();
            page.visual.rows.push(page.visual.columns.map(() => ""));
            page.modified = true;
            this._renderSpreadsheet(pane, page);
        });
    },

    _renderNotes(pane, page) {
        pane.innerHTML = `
            <div class="field" style="flex:1;display:flex;flex-direction:column;">
                <label>Contenido de Notas (${page.id})</label>
                <textarea id="ed-notes-text" class="textarea" style="flex:1;min-height:320px;line-height:1.55;">${this._escHtml(page.visual.text || "")}</textarea>
            </div>`;
    },

    _renderGraph(pane, page) {
        const exprs = page.visual.expressions || [];
        const rows = exprs
            .map(
                (ex, i) => `
                <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center;" data-ed-graph="${i}">
                    <span class="device-meta-chip" style="text-align:center;color:var(--fox-orange);font-weight:700;">${this._escHtml(ex.label)}(${this._escHtml(ex.params)}) =</span>
                    <input class="input" data-graph-expr="${i}" value="${this._escAttr(ex.expr)}" style="font-family:Consolas,monospace;" />
                </div>`
            )
            .join("");

        pane.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;">
                <strong style="font-size:13px;">${NaSpireUI.icon("graph", 15)} Funciones graficadas en ${page.id}</strong>
                ${rows || '<span style="font-size:12.5px;color:var(--text-muted);">No hay funciones graficadas en esta pestaña.</span>'}
            </div>`;
    },

    syncCurrentPageFromDom() {
        const page = this.pages[this.activePageIdx];
        if (!page || this.xmlMode) return;

        if (page.kind === "calculator") {
            const symEls = document.querySelectorAll("[data-ed-sym]");
            if (symEls.length || document.getElementById("ed-sym-list")) {
                page.visual.symbols = Array.from(symEls).map((el) => ({
                    kind: el.querySelector('[data-sym-f="kind"]').value,
                    name: el.querySelector('[data-sym-f="name"]').value.trim(),
                    params: el.querySelector('[data-sym-f="params"]').value.trim(),
                    value: el.querySelector('[data-sym-f="value"]').value.trim(),
                }));
            }
            const entEls = document.querySelectorAll("[data-ed-entry]");
            if (entEls.length || document.getElementById("ed-ent-list")) {
                page.visual.entries = Array.from(entEls).map((el) => ({
                    expr: el.querySelector('[data-ent-f="expr"]').value.trim(),
                    result: el.querySelector('[data-ent-f="result"]').value.trim(),
                }));
            }
            page.modified = true;
        } else if (page.kind === "spreadsheet") {
            document.querySelectorAll("[data-ed-scol]").forEach((inp) => {
                page.visual.columns[Number(inp.dataset.edScol)] = inp.value;
            });
            document.querySelectorAll("[data-ed-sform]").forEach((inp) => {
                page.visual.formulas[Number(inp.dataset.edSform)] = inp.value;
            });
            document.querySelectorAll("[data-ed-sr]").forEach((inp) => {
                const r = Number(inp.dataset.edSr);
                const c = Number(inp.dataset.edSc);
                if (page.visual.rows[r]) page.visual.rows[r][c] = inp.value;
            });
            page.modified = true;
        } else if (page.kind === "notes") {
            const ta = document.getElementById("ed-notes-text");
            if (ta) {
                page.visual.text = ta.value;
                page.modified = true;
            }
        } else if (page.kind === "graph") {
            document.querySelectorAll("[data-graph-expr]").forEach((inp) => {
                const i = Number(inp.dataset.graphExpr);
                if (page.visual.expressions[i]) {
                    page.visual.expressions[i].expr = inp.value;
                }
            });
            page.modified = true;
        }
    },

    renderFileTabs() {
        const wrap = document.getElementById("editor-file-tabs");
        const names = Object.keys(this.files);
        wrap.innerHTML = names
            .map((n) => `<button class="btn btn-sm ${n === this.activeFile ? "btn-primary" : ""}" data-xml-file="${n}">${n}</button>`)
            .join("");
        wrap.querySelectorAll("[data-xml-file]").forEach((btn) => {
            btn.addEventListener("click", () => this.selectFile(btn.dataset.xmlFile));
        });
    },

    selectFile(name) {
        if (!name || !(name in this.files)) return;
        this.activeFile = name;
        const area = document.getElementById("editor-xml-area");
        area.value = this.files[name];
        area.disabled = false;
        this.renderFileTabs();
    },

    async save(toCalc) {
        if (!this.activeFile) return;
        if (this.xmlMode) {
            this.files[this.activeFile] = document.getElementById("editor-xml-area").value;
        } else {
            this.syncCurrentPageFromDom();
        }

        const targetPath = toCalc ? (document.getElementById("editor-save-path").value.trim() || `/${this.filename}`) : "";
        try {
            NaSpireUI.toast(toCalc ? `Guardando en ${targetPath}...` : "Empaquetando .tns...");
            const res = await NaSpireAPI.saveTns({
                filename: this.filename,
                files: this.files,
                pages: this.xmlMode ? [] : this.pages,
                calc_path: targetPath,
            });
            if (res.files) {
                this.files = res.files;
                this.selectFile(this.activeFile);
            }
            if (toCalc && res.uploaded_path) {
                this.calcPath = res.uploaded_path;
                NaSpireUI.toast(`Guardado en la TI-Nspire: ${res.uploaded_path}`, "success");
                NaSpireExplorer.load(NaSpireExplorer.currentPath);
            } else {
                NaSpireUI.downloadBase64File(res.filename, res.content_base64);
                NaSpireUI.toast(`Descargado ${res.filename} (${NaSpireUI.formatBytes(res.size)})`, "success");
            }
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    _escAttr(s) {
        return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },

    _escHtml(s) {
        return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
};

/**
 * Módulo Creador Visual de Documentos .tns
 * Modos: Hoja de Cálculo / Listas, Funciones y Notas, Python (CX II) y Lua.
 */
window.NaSpireCreator = {
    mode: "spreadsheet",
    sheetCols: ["x", "y", "z"],
    sheetFormulas: ["", "=2*x", "=x^2"],
    sheetRows: [
        ["1", "2", "1"],
        ["2", "4", "4"],
        ["3", "6", "9"],
        ["4", "8", "16"],
    ],
    functionsList: [
        { name: "f", params: "x", expr: "x**2 + 2*x + 1", desc: "Cuadrática ejemplo" },
        { name: "hip", params: "a, b", expr: "sqrt(a**2 + b**2)", desc: "Hipotenusa" },
    ],

    init() {
        document.querySelectorAll(".creator-tab").forEach((btn) => {
            btn.addEventListener("click", () => this.switchMode(btn.dataset.mode));
        });

        document.getElementById("btn-sheet-preset-rk4")?.addEventListener("click", () => {
            this.sheetCols = ["n", "xn", "yn", "k1", "k2", "k3", "k4", "h"];
            this.sheetFormulas = ["", "", "", "", "", "", "", ""];
            this.sheetRows = [
                ["0", "0", "1", "=b1+c1", "=(b1+h1/2)+(c1+(h1/2)*d1)", "=(b1+h1/2)+(c1+(h1/2)*e1)", "=(b1+h1)+(c1+h1*f1)", "0.1"],
                ["1", "=b1+$h$1", "=c1+($h$1/6)*(d1+2*e1+2*f1+g1)", "=b2+c2", "=(b2+$h$1/2)+(c2+($h$1/2)*d2)", "=(b2+$h$1/2)+(c2+($h$1/2)*e2)", "=(b2+$h$1)+(c2+$h$1*f2)", ""],
                ["2", "=b2+$h$1", "=c2+($h$1/6)*(d2+2*e2+2*f2+g2)", "=b3+c3", "=(b3+$h$1/2)+(c3+($h$1/2)*d3)", "=(b3+$h$1/2)+(c3+($h$1/2)*e3)", "=(b3+$h$1)+(c3+$h$1*f3)", ""],
                ["3", "=b3+$h$1", "=c3+($h$1/6)*(d3+2*e3+2*f3+g3)", "=b4+c4", "=(b4+$h$1/2)+(c4+($h$1/2)*d4)", "=(b4+$h$1/2)+(c4+($h$1/2)*e4)", "=(b4+$h$1)+(c4+$h$1*f4)", ""],
                ["4", "=b4+$h$1", "=c4+($h$1/6)*(d4+2*e4+2*f4+g4)", "=b5+c5", "=(b5+$h$1/2)+(c5+($h$1/2)*d5)", "=(b5+$h$1/2)+(c5+($h$1/2)*e5)", "=(b5+$h$1)+(c5+$h$1*f5)", ""],
            ];
            document.getElementById("tns-filename").value = "rk4_hoja";
            this.renderSheet();
            NaSpireUI.toast("Plantilla RK4 cargada en la tabla", "success");
        });

        document.getElementById("btn-sheet-add-col").addEventListener("click", () => {
            this.syncSheetFromDom();
            const n = this.sheetCols.length + 1;
            this.sheetCols.push(`col${n}`);
            this.sheetFormulas.push("");
            this.sheetRows.forEach((r) => r.push(""));
            this.renderSheet();
        });

        document.getElementById("btn-sheet-add-row").addEventListener("click", () => {
            this.syncSheetFromDom();
            this.sheetRows.push(this.sheetCols.map(() => ""));
            this.renderSheet();
        });

        document.getElementById("btn-add-fn-row").addEventListener("click", () => {
            this.syncFunctionsFromDom();
            this.functionsList.push({ name: "g", params: "x", expr: "", desc: "" });
            this.renderFunctions();
        });

        document.getElementById("btn-build-download").addEventListener("click", () => this.build(false));
        document.getElementById("btn-build-upload").addEventListener("click", () => this.build(true));
        document.getElementById("btn-refresh-tns-folders")?.addEventListener("click", () => this.refreshFolders(true));

        this.renderSheet();
        this.renderFunctions();
    },

    async refreshFolders(notify = false) {
        const sel = document.getElementById("tns-upload-dir");
        if (!sel) return;
        const prev = sel.value || "/";
        if (!window.NaSpireApp.connected) {
            sel.innerHTML = `<option value="/">/ (Raíz — conecta la calculadora)</option>`;
            return;
        }
        try {
            const res = await NaSpireAPI.listFolders();
            const folders = res.folders && res.folders.length ? res.folders : ["/"];
            sel.innerHTML = folders
                .map((f) => `<option value="${f}">${f === "/" ? "/ (Raíz)" : f}</option>`)
                .join("");
            if (folders.includes(prev)) {
                sel.value = prev;
            } else if (folders.includes(NaSpireExplorer.currentPath)) {
                sel.value = NaSpireExplorer.currentPath;
            }
            if (notify) NaSpireUI.toast(`${folders.length} carpetas cargadas`, "success");
        } catch (err) {
            if (notify) NaSpireUI.toast(`No se pudieron cargar carpetas: ${err.message}`, "error");
        }
    },

    switchMode(mode) {
        this.mode = mode;
        document.querySelectorAll(".creator-tab").forEach((b) => {
            b.classList.toggle("btn-primary", b.dataset.mode === mode);
        });
        document.querySelectorAll(".creator-mode-box").forEach((box) => {
            box.style.display = box.id === `creator-mode-${mode}` ? "block" : "none";
        });
    },

    renderSheet() {
        const table = document.getElementById("sheet-table");
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        let thead = `<thead><tr><th style="width:42px;">#</th>`;
        this.sheetCols.forEach((c, idx) => {
            const L = letters[idx] || `C${idx + 1}`;
            thead += `<th>${L}</th>`;
        });
        thead += `</tr></thead>`;

        let tbody = `<tbody>`;
        // Fila de nombres de lista
        tbody += `<tr><th title="Nombre de variable/lista">Var</th>`;
        this.sheetCols.forEach((c, idx) => {
            tbody += `<td><input data-sheet-col="${idx}" value="${c}" placeholder="nombre_lista" style="color:var(--fox-orange);font-weight:700;" /></td>`;
        });
        tbody += `</tr>`;

        // Fila de fórmulas de referencia
        tbody += `<tr><th title="Fórmula de columna">ƒ(x)</th>`;
        this.sheetFormulas.forEach((f, idx) => {
            tbody += `<td><input data-sheet-formula="${idx}" value="${f}" placeholder="=..." style="color:#60a5fa;" /></td>`;
        });
        tbody += `</tr>`;

        // Filas de datos
        this.sheetRows.forEach((row, rIdx) => {
            tbody += `<tr><th>${rIdx + 1}</th>`;
            row.forEach((val, cIdx) => {
                tbody += `<td><input data-sheet-r="${rIdx}" data-sheet-c="${cIdx}" value="${val}" /></td>`;
            });
            tbody += `</tr>`;
        });
        tbody += `</tbody>`;

        table.innerHTML = thead + tbody;

        NaSpireSheetUX.enhance(table, {
            rowAttr: "data-sheet-r",
            colAttr: "data-sheet-c",
            onAddRows: (n) => {
                this.syncSheetFromDom();
                for (let i = 0; i < n; i++) this.sheetRows.push(this.sheetCols.map(() => ""));
                this.renderSheet();
            },
            onChanged: () => this.syncSheetFromDom(),
        });
    },

    syncSheetFromDom() {
        document.querySelectorAll("[data-sheet-col]").forEach((inp) => {
            this.sheetCols[Number(inp.dataset.sheetCol)] = inp.value;
        });
        document.querySelectorAll("[data-sheet-formula]").forEach((inp) => {
            this.sheetFormulas[Number(inp.dataset.sheetFormula)] = inp.value;
        });
        document.querySelectorAll("[data-sheet-r]").forEach((inp) => {
            const r = Number(inp.dataset.sheetR);
            const c = Number(inp.dataset.sheetC);
            if (this.sheetRows[r]) this.sheetRows[r][c] = inp.value;
        });
    },

    renderFunctions() {
        const wrap = document.getElementById("fn-rows");
        wrap.innerHTML = this.functionsList
            .map(
                (fn, idx) => `
                <div style="display:grid;grid-template-columns:110px 110px 1fr 1fr 34px;gap:8px;align-items:center;" data-fn-idx="${idx}">
                    <input class="input" data-fn-field="name" value="${fn.name}" placeholder="nombre" />
                    <input class="input" data-fn-field="params" value="${fn.params}" placeholder="x, y" />
                    <input class="input" data-fn-field="expr" value="${fn.expr}" placeholder="expresión Python (ej: sin(x)+x**2)" />
                    <input class="input" data-fn-field="desc" value="${fn.desc}" placeholder="descripción opcional" />
                    <button class="btn btn-danger btn-icon" data-fn-del="${idx}" title="Quitar">×</button>
                </div>`
            )
            .join("");

        wrap.querySelectorAll("[data-fn-del]").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.syncFunctionsFromDom();
                this.functionsList.splice(Number(btn.dataset.fnDel), 1);
                this.renderFunctions();
            });
        });
    },

    syncFunctionsFromDom() {
        const rows = document.querySelectorAll("[data-fn-idx]");
        this.functionsList = Array.from(rows).map((row) => ({
            name: row.querySelector('[data-fn-field="name"]').value.trim(),
            params: row.querySelector('[data-fn-field="params"]').value.trim(),
            expr: row.querySelector('[data-fn-field="expr"]').value.trim(),
            desc: row.querySelector('[data-fn-field="desc"]').value.trim(),
        }));
    },

    async build(uploadToCalc) {
        const filename = document.getElementById("tns-filename").value.trim() || "documento_naspire";
        const upload_dir = uploadToCalc ? (document.getElementById("tns-upload-dir").value.trim() || "/") : "";

        const payload = { mode: this.mode, filename, title: filename, upload_dir };
        if (this.mode === "spreadsheet") {
            this.syncSheetFromDom();
            payload.columns = this.sheetCols;
            payload.formulas = this.sheetFormulas;
            payload.rows = this.sheetRows;
        } else if (this.mode === "functions") {
            this.syncFunctionsFromDom();
            payload.functions = this.functionsList;
            payload.notes = document.getElementById("fn-notes").value;
        } else if (this.mode === "python") {
            payload.code = document.getElementById("tns-python-code").value;
        } else if (this.mode === "lua") {
            payload.code = document.getElementById("tns-lua-code").value;
        }

        try {
            NaSpireUI.toast("Compilando archivo .tns...");
            const res = await NaSpireAPI.buildTns(payload);
            if (uploadToCalc && res.uploaded_path) {
                NaSpireUI.toast(`¡Subido a la TI-Nspire en ${res.uploaded_path}!`, "success");
                NaSpireExplorer.load(NaSpireExplorer.currentPath);
            } else {
                NaSpireUI.downloadBase64File(res.filename, res.content_base64);
                NaSpireUI.toast(`Descargado ${res.filename} (${NaSpireUI.formatBytes(res.size)})`, "success");
            }
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },
};

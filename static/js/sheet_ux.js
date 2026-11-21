/**
 * Módulo UX tipo Excel para Hojas de Cálculo en NaSpire (Creador y Editor .tns)
 * - Arrastrar controlador de relleno (Fill Handle) para copiar valores, secuencias numéricas y fórmulas con ajuste relativo ($A$1 fijo, A1 relativo)
 * - Atajos de teclado: Enter, Shift+Enter, Tab, Shift+Tab, Ctrl+D (rellenar abajo), Ctrl+V (pegar tabla desde Excel/Sheets)
 */
window.NaSpireSheetUX = {
    /**
     * Ajusta referencias de celdas relativas dentro de una fórmula al desplazarla dRow filas / dCol columnas.
     * Respeta referencias absolutas ($A$1, $h$1, a$1, $a1).
     */
    shiftFormula(formula, dRow, dCol = 0) {
        if (!formula || !formula.startsWith("=")) return formula;
        return formula.replace(/(\$?)([a-zA-Z]{1,2})(\$?)(\d+)\b/g, (match, absC, colStr, absR, rowStr, offset, full) => {
            // No tocar si está precedido por letra/número o seguido de '(' (nombre de función como log10)
            const prev = offset > 0 ? full[offset - 1] : "";
            const next = full[offset + match.length] || "";
            if (/[a-zA-Z0-9_']/.test(prev) || next === "(") return match;

            let newRow = Number(rowStr);
            if (!absR) newRow = Math.max(1, newRow + dRow);

            let newCol = colStr;
            if (!absC && dCol !== 0 && colStr.length === 1) {
                const isUpper = colStr === colStr.toUpperCase();
                const base = isUpper ? 65 : 97;
                const code = Math.max(0, Math.min(25, colStr.charCodeAt(0) - base + dCol));
                newCol = String.fromCharCode(base + code);
            }
            return `${absC}${newCol}${absR}${newRow}`;
        });
    },

    /**
     * Activa navegación Excel, Ctrl+D, pegado desde Excel y Fill Handle arrastrable en una tabla .sheet-table.
     * @param {HTMLTableElement} tableEl
     * @param {{ rowAttr: string, colAttr: string, onAddRows?: (n: number) => void, onChanged?: () => void }} opts
     */
    enhance(tableEl, opts) {
        if (!tableEl) return;
        const { rowAttr, colAttr, onAddRows, onChanged } = opts;

        const getCell = (r, c) =>
            tableEl.querySelector(`input[${rowAttr}="${r}"][${colAttr}="${c}"]`);

        let dragSrc = null;
        let dragTargets = [];

        const clearHighlights = () => {
            tableEl.querySelectorAll(".sheet-fill-preview").forEach((el) => el.classList.remove("sheet-fill-preview"));
        };

        // Crear Fill Handle en cada celda de datos
        const inputs = Array.from(tableEl.querySelectorAll(`input[${rowAttr}][${colAttr}]`));
        inputs.forEach((inp) => {
            const td = inp.parentElement;
            if (!td) return;
            td.style.position = "relative";

            // Cuadradito naranja de arrastre (Fill Handle)
            const handle = document.createElement("div");
            handle.className = "sheet-fill-handle";
            handle.title = "Arrastra hacia abajo para autorrellenar (ajusta fórmulas automáticamente)";
            td.appendChild(handle);

            handle.addEventListener("mousedown", (e) => {
                e.preventDefault();
                dragSrc = {
                    r: Number(inp.getAttribute(rowAttr)),
                    c: Number(inp.getAttribute(colAttr)),
                    val: inp.value,
                };
                dragTargets = [];
                document.body.style.cursor = "crosshair";
            });

            td.addEventListener("mouseenter", () => {
                if (!dragSrc) return;
                const r = Number(inp.getAttribute(rowAttr));
                const c = Number(inp.getAttribute(colAttr));
                clearHighlights();
                dragTargets = [];
                if (c === dragSrc.c && r > dragSrc.r) {
                    for (let rr = dragSrc.r + 1; rr <= r; rr++) {
                        const cell = getCell(rr, c);
                        if (cell) {
                            cell.parentElement.classList.add("sheet-fill-preview");
                            dragTargets.push({ r: rr, c, cell });
                        }
                    }
                }
            });

            // Atajos de teclado tipo Excel
            inp.addEventListener("keydown", (e) => {
                // Si el menú de autocompletado de funciones está visible, dejarlo manejar Enter/Tab/Flechas
                const ac = document.getElementById("ti-ac-box");
                if (ac && ac.style.display !== "none" && ["Enter", "Tab", "ArrowUp", "ArrowDown"].includes(e.key)) {
                    return;
                }

                const r = Number(inp.getAttribute(rowAttr));
                const c = Number(inp.getAttribute(colAttr));

                if (e.key === "Enter") {
                    e.preventDefault();
                    const next = getCell(r + (e.shiftKey ? -1 : 1), c);
                    if (next) { next.focus(); next.select(); }
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = getCell(r + 1, c);
                    if (next) { next.focus(); next.select(); }
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const next = getCell(r - 1, c);
                    if (next) { next.focus(); next.select(); }
                } else if (e.ctrlKey && e.key.toLowerCase() === "d") {
                    // Ctrl+D: rellenar desde la celda de arriba ajustando fórmula
                    e.preventDefault();
                    const above = getCell(r - 1, c);
                    if (above) {
                        const val = above.value;
                        if (val.startsWith("=")) {
                            inp.value = this.shiftFormula(val, 1, 0);
                        } else if (val !== "" && !isNaN(Number(val))) {
                            const above2 = getCell(r - 2, c);
                            const step = above2 && above2.value !== "" && !isNaN(Number(above2.value))
                                ? Number(val) - Number(above2.value)
                                : 0;
                            inp.value = String(Number(val) + step);
                        } else {
                            inp.value = val;
                        }
                        onChanged?.();
                    }
                }
            });

            // Pegar bloque desde Excel / Google Sheets (Ctrl+V con tabulaciones y saltos de línea)
            inp.addEventListener("paste", (e) => {
                const text = e.clipboardData?.getData("text/plain") || "";
                if (!text.includes("\t") && !text.includes("\n")) return;
                e.preventDefault();
                const startR = Number(inp.getAttribute(rowAttr));
                const startC = Number(inp.getAttribute(colAttr));
                const matrix = text
                    .replace(/\r/g, "")
                    .split("\n")
                    .filter((ln, idx, arr) => ln.length > 0 || idx < arr.length - 1)
                    .map((ln) => ln.split("\t"));

                const neededRows = startR + matrix.length;
                const existingRows = tableEl.querySelectorAll(`input[${colAttr}="0"]`).length;
                if (neededRows > existingRows && onAddRows) {
                    onAddRows(neededRows - existingRows);
                    // Re-aplicar después del re-render
                    setTimeout(() => {
                        matrix.forEach((rowVals, dr) => {
                            rowVals.forEach((v, dc) => {
                                const target = getCell(startR + dr, startC + dc);
                                if (target) target.value = v.trim();
                            });
                        });
                        onChanged?.();
                    }, 0);
                    return;
                }

                matrix.forEach((rowVals, dr) => {
                    rowVals.forEach((v, dc) => {
                        const target = getCell(startR + dr, startC + dc);
                        if (target) target.value = v.trim();
                    });
                });
                onChanged?.();
            });
        });

        // Finalizar arrastre del Fill Handle
        const onMouseUp = () => {
            if (!dragSrc) return;
            document.body.style.cursor = "";
            if (dragTargets.length) {
                const baseVal = dragSrc.val;
                // Detectar paso numérico si la celda anterior también es número
                let numStep = null;
                if (baseVal !== "" && !isNaN(Number(baseVal))) {
                    const prevCell = getCell(dragSrc.r - 1, dragSrc.c);
                    if (prevCell && prevCell.value !== "" && !isNaN(Number(prevCell.value))) {
                        numStep = Number(baseVal) - Number(prevCell.value);
                    } else {
                        numStep = 1; // Serie +1 por defecto al arrastrar un número
                    }
                }

                dragTargets.forEach((t, idx) => {
                    const stepIdx = idx + 1;
                    if (baseVal.startsWith("=")) {
                        t.cell.value = this.shiftFormula(baseVal, stepIdx, 0);
                    } else if (numStep !== null) {
                        t.cell.value = String(Number((Number(baseVal) + numStep * stepIdx).toFixed(8)));
                    } else {
                        t.cell.value = baseVal;
                    }
                });
                onChanged?.();
                NaSpireUI.toast(`Autorrellenadas ${dragTargets.length} celdas`, "success");
            }
            clearHighlights();
            dragSrc = null;
            dragTargets = [];
        };

        window.addEventListener("mouseup", onMouseUp, { once: false });
    },
};

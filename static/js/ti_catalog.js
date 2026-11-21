/**
 * Catálogo oficial verificado de funciones TI-Nspire CX II CAS + Autocompletado en vivo
 * Todas las funciones aquí listadas pertenecen al catálogo oficial de TI-Nspire CAS.
 */
window.NaSpireCatalog = {
    lastFocusedInput: null,
    acBox: null,
    acItems: [],
    acIndex: 0,
    acTokenStart: 0,

    // Catálogo 100% real de TI-Nspire CX II CAS (sintaxis oficial TI-Nspire Reference Guide)
    functions: [
        // --- ÁLGEBRA / CAS ---
        { name: "solve", syntax: "solve(Ecuacion, Var)", cat: "Álgebra CAS", desc: "Resuelve simbólicamente una ecuación o desigualdad para Var.", ex: "solve(x^2-5*x+6=0, x)" },
        { name: "cSolve", syntax: "cSolve(Ecuacion, Var)", cat: "Álgebra CAS", desc: "Resuelve una ecuación incluyendo soluciones complejas.", ex: "cSolve(x^2+1=0, x)" },
        { name: "nSolve", syntax: "nSolve(Ecuacion, Var)", cat: "Álgebra CAS", desc: "Encuentra una solución real aproximada numéricamente.", ex: "nSolve(cos(x)=x, x)" },
        { name: "linSolve", syntax: "linSolve(Sistema, {Vars})", cat: "Álgebra CAS", desc: "Resuelve un sistema de ecuaciones lineales.", ex: "linSolve(x+y=5 and x-y=1, {x,y})" },
        { name: "factor", syntax: "factor(Expr)", cat: "Álgebra CAS", desc: "Factoriza expresiones algebraicas o números enteros.", ex: "factor(x^2-9)" },
        { name: "expand", syntax: "expand(Expr)", cat: "Álgebra CAS", desc: "Expande productos y potencias de expresiones algebraicas.", ex: "expand((x+2)^3)" },
        { name: "zeros", syntax: "zeros(Expr, Var)", cat: "Álgebra CAS", desc: "Devuelve una lista con las raíces reales donde Expr = 0.", ex: "zeros(x^2-4, x)" },
        { name: "cZeros", syntax: "cZeros(Expr, Var)", cat: "Álgebra CAS", desc: "Devuelve lista de raíces reales y complejas.", ex: "cZeros(x^2+4, x)" },
        { name: "polyRoots", syntax: "polyRoots(Polinomio, Var)", cat: "Álgebra CAS", desc: "Encuentra todas las raíces reales de un polinomio.", ex: "polyRoots(x^3-6*x^2+11*x-6, x)" },
        { name: "cPolyRoots", syntax: "cPolyRoots(Polinomio, Var)", cat: "Álgebra CAS", desc: "Encuentra todas las raíces reales y complejas de un polinomio.", ex: "cPolyRoots(x^2+2*x+5, x)" },
        { name: "partFrac", syntax: "partFrac(Expr, Var)", cat: "Álgebra CAS", desc: "Descompone una fracción racional en fracciones parciales.", ex: "partFrac(1/(x^2-1), x)" },
        { name: "propFrac", syntax: "propFrac(Expr, Var)", cat: "Álgebra CAS", desc: "Separa una fracción racional en parte entera y fracción propia.", ex: "propFrac((x^2+1)/(x-1), x)" },
        { name: "comDenom", syntax: "comDenom(Expr)", cat: "Álgebra CAS", desc: "Combina términos sobre un denominador común.", ex: "comDenom(1/x + 1/(x+1))" },
        { name: "approx", syntax: "approx(Expr)", cat: "Álgebra CAS", desc: "Devuelve el resultado decimal aproximado.", ex: "approx(pi/4)" },
        { name: "exact", syntax: "exact(Expr)", cat: "Álgebra CAS", desc: "Convierte un valor decimal a expresión exacta racional.", ex: "exact(0.75)" },

        // --- CÁLCULO ---
        { name: "derivative", syntax: "derivative(Expr, Var)", cat: "Cálculo", desc: "Calcula la derivada simbólica de Expr respecto a Var.", ex: "derivative(x^3+sin(x), x)" },
        { name: "integral", syntax: "integral(Expr, Var, Inf, Sup)", cat: "Cálculo", desc: "Calcula la integral indefinida o definida simbólica.", ex: "integral(x^2, x, 0, 1)" },
        { name: "nInt", syntax: "nInt(Expr, Var, Inf, Sup)", cat: "Cálculo", desc: "Calcula la integral definida numéricamente.", ex: "nInt(exp(-x^2), x, 0, 1)" },
        { name: "nDeriv", syntax: "nDeriv(Expr, Var, Valor)", cat: "Cálculo", desc: "Calcula la derivada numérica en un punto.", ex: "nDeriv(x^3, x, 2)" },
        { name: "limit", syntax: "limit(Expr, Var, Punto)", cat: "Cálculo", desc: "Calcula el límite simbólico cuando Var tiende a Punto.", ex: "limit(sin(x)/x, x, 0)" },
        { name: "deSolve", syntax: "deSolve(EDO, VarInd, VarDep)", cat: "Cálculo", desc: "Resuelve ecuaciones diferenciales ordinarias (EDO) simbólicamente.", ex: "deSolve(y'=x+y and y(0)=1, x, y)" },
        { name: "taylor", syntax: "taylor(Expr, Var, Orden, Punto)", cat: "Cálculo", desc: "Obtiene el polinomio de Taylor de grado Orden centrado en Punto.", ex: "taylor(sin(x), x, 5, 0)" },
        { name: "fMin", syntax: "fMin(Expr, Var)", cat: "Cálculo", desc: "Encuentra valores de Var donde Expr alcanza mínimos locales.", ex: "fMin(x^2-4*x+5, x)" },
        { name: "fMax", syntax: "fMax(Expr, Var)", cat: "Cálculo", desc: "Encuentra valores de Var donde Expr alcanza máximos locales.", ex: "fMax(-x^2+6*x, x)" },
        { name: "arcLen", syntax: "arcLen(Expr, Var, Inf, Sup)", cat: "Cálculo", desc: "Calcula la longitud de arco de una curva entre Inf y Sup.", ex: "arcLen(x^2, x, 0, 1)" },
        { name: "impDif", syntax: "impDif(Ecuacion, VarInd, VarDep)", cat: "Cálculo", desc: "Derivación implícita de una ecuación.", ex: "impDif(x^2+y^2=1, x, y)" },
        { name: "tangentLine", syntax: "tangentLine(Expr, Var, Punto)", cat: "Cálculo", desc: "Devuelve la ecuación de la recta tangente en Punto.", ex: "tangentLine(x^2, x, 2)" },
        { name: "normalLine", syntax: "normalLine(Expr, Var, Punto)", cat: "Cálculo", desc: "Devuelve la ecuación de la recta normal en Punto.", ex: "normalLine(x^2, x, 2)" },
        { name: "sum", syntax: "sum(Lista)", cat: "Hoja y Listas", desc: "Suma elementos de una lista o rango (ej: =sum(a1:a10)).", ex: "=sum(a1:a10)" },
        { name: "product", syntax: "product(Lista)", cat: "Hoja y Listas", desc: "Multiplica todos los elementos de una lista o rango.", ex: "=product(a1:a5)" },

        // --- HOJA DE CÁLCULO Y LISTAS ---
        { name: "mean", syntax: "mean(Lista)", cat: "Hoja y Listas", desc: "Media aritmética (promedio) de una lista o rango.", ex: "=mean(a1:a10)" },
        { name: "median", syntax: "median(Lista)", cat: "Hoja y Listas", desc: "Mediana de una lista o rango de datos.", ex: "=median(a1:a10)" },
        { name: "stDevSamp", syntax: "stDevSamp(Lista)", cat: "Hoja y Listas", desc: "Desviación estándar muestral (s).", ex: "=stDevSamp(a1:a10)" },
        { name: "stDevPop", syntax: "stDevPop(Lista)", cat: "Hoja y Listas", desc: "Desviación estándar poblacional (σ).", ex: "=stDevPop(a1:a10)" },
        { name: "varSamp", syntax: "varSamp(Lista)", cat: "Hoja y Listas", desc: "Varianza muestral (s²).", ex: "=varSamp(a1:a10)" },
        { name: "varPop", syntax: "varPop(Lista)", cat: "Hoja y Listas", desc: "Varianza poblacional (σ²).", ex: "=varPop(a1:a10)" },
        { name: "min", syntax: "min(Lista)", cat: "Hoja y Listas", desc: "Devuelve el valor mínimo de una lista o rango.", ex: "=min(a1:a10)" },
        { name: "max", syntax: "max(Lista)", cat: "Hoja y Listas", desc: "Devuelve el valor máximo de una lista o rango.", ex: "=max(a1:a10)" },
        { name: "count", syntax: "count(Lista)", cat: "Hoja y Listas", desc: "Cuenta cuántos valores numéricos hay en el rango.", ex: "=count(a1:a10)" },
        { name: "countIf", syntax: "countIf(Lista, Criterio)", cat: "Hoja y Listas", desc: "Cuenta elementos que cumplen una condición.", ex: "=countIf(a1:a10, ?>5)" },
        { name: "when", syntax: "when(Cond, SiVerdadero, SiFalso)", cat: "Hoja y Listas", desc: "Condicional de celda (equivalente a SI() de Excel).", ex: "=when(a1>0, a1, 0)" },
        { name: "seq", syntax: "seq(Expr, Var, Ini, Fin, Paso)", cat: "Hoja y Listas", desc: "Genera una lista evaluando Expr desde Ini hasta Fin.", ex: "=seq(n, n, 0, 10, 1)" },
        { name: "cumSum", syntax: "cumSum(Lista)", cat: "Hoja y Listas", desc: "Devuelve una lista con las sumas acumuladas.", ex: "=cumSum(a1:a10)" },
        { name: "round", syntax: "round(Valor, Decimales)", cat: "Hoja y Listas", desc: "Redondea un número a la cantidad indicada de decimales.", ex: "=round(b1, 4)" },
        { name: "mod", syntax: "mod(Dividendo, Divisor)", cat: "Hoja y Listas", desc: "Resto (módulo) de una división.", ex: "=mod(a1, 2)" },
        { name: "linRegMx", syntax: "linRegMx(ListaX, ListaY)", cat: "Hoja y Listas", desc: "Regresión lineal y = m*x + b.", ex: "linRegMx(x, y)" },
        { name: "quadReg", syntax: "quadReg(ListaX, ListaY)", cat: "Hoja y Listas", desc: "Regresión cuadrática a*x² + b*x + c.", ex: "quadReg(x, y)" },

        // --- MATRICES Y VECTORES ---
        { name: "rref", syntax: "rref(Matriz)", cat: "Matrices", desc: "Forma escalonada reducida por filas (Gauss-Jordan).", ex: "rref([[1,2,3],[4,5,6]])" },
        { name: "ref", syntax: "ref(Matriz)", cat: "Matrices", desc: "Forma escalonada por filas de una matriz.", ex: "ref(m)" },
        { name: "det", syntax: "det(Matriz)", cat: "Matrices", desc: "Calcula el determinante de una matriz cuadrada.", ex: "det([[1,2],[3,4]])" },
        { name: "eigVl", syntax: "eigVl(Matriz)", cat: "Matrices", desc: "Devuelve los valores propios (eigenvalues) de una matriz.", ex: "eigVl([[2,1],[1,2]])" },
        { name: "eigVc", syntax: "eigVc(Matriz)", cat: "Matrices", desc: "Devuelve matriz con los vectores propios (eigenvectors).", ex: "eigVc([[2,1],[1,2]])" },
        { name: "LU", syntax: "LU(Matriz, L, U, P)", cat: "Matrices", desc: "Factorización LU con matriz de permutación P.", ex: "LU(a, l, u, p)" },
        { name: "QR", syntax: "QR(Matriz, Q, R)", cat: "Matrices", desc: "Factorización QR de una matriz.", ex: "QR(a, q, r)" },
        { name: "dotP", syntax: "dotP(Vec1, Vec2)", cat: "Matrices", desc: "Producto punto (escalar) entre dos vectores.", ex: "dotP([1,2,3], [4,5,6])" },
        { name: "crossP", syntax: "crossP(Vec1, Vec2)", cat: "Matrices", desc: "Producto cruz (vectorial) entre dos vectores.", ex: "crossP([1,0,0], [0,1,0])" },
        { name: "norm", syntax: "norm(VecOMat)", cat: "Matrices", desc: "Norma euclidiana (Frobenius) de un vector o matriz.", ex: "norm([3,4])" },
        { name: "unitV", syntax: "unitV(Vec)", cat: "Matrices", desc: "Devuelve el vector unitario en la dirección de Vec.", ex: "unitV([3,4])" },
        { name: "identity", syntax: "identity(n)", cat: "Matrices", desc: "Crea la matriz identidad de dimensión n×n.", ex: "identity(3)" },
        { name: "newMat", syntax: "newMat(Filas, Cols)", cat: "Matrices", desc: "Crea una matriz llena de ceros de Filas×Cols.", ex: "newMat(3, 3)" },
        { name: "trace", syntax: "trace(Matriz)", cat: "Matrices", desc: "Calcula la traza (suma de elementos de la diagonal).", ex: "trace(m)" },
        { name: "augment", syntax: "augment(Mat1, Mat2)", cat: "Matrices", desc: "Concatena dos matrices horizontalmente.", ex: "augment(a, b)" },

        // --- TRIGONOMETRÍA, EXP Y COMPLEJOS ---
        { name: "sin", syntax: "sin(x)", cat: "Trig y Exp", desc: "Seno de x (según modo Radianes/Grados).", ex: "sin(pi/2)" },
        { name: "cos", syntax: "cos(x)", cat: "Trig y Exp", desc: "Coseno de x.", ex: "cos(x)" },
        { name: "tan", syntax: "tan(x)", cat: "Trig y Exp", desc: "Tangente de x.", ex: "tan(x)" },
        { name: "arcsin", syntax: "arcsin(x)", cat: "Trig y Exp", desc: "Arcoseno (seno inverso).", ex: "arcsin(0.5)" },
        { name: "arccos", syntax: "arccos(x)", cat: "Trig y Exp", desc: "Arcocoseno (coseno inverso).", ex: "arccos(0.5)" },
        { name: "arctan", syntax: "arctan(x)", cat: "Trig y Exp", desc: "Arcotangente (tangente inversa).", ex: "arctan(1)" },
        { name: "tExpand", syntax: "tExpand(Expr)", cat: "Trig y Exp", desc: "Expande expresiones trigonométricas (ej: sin(2x)).", ex: "tExpand(sin(2*x))" },
        { name: "tCollect", syntax: "tCollect(Expr)", cat: "Trig y Exp", desc: "Reduce productos y potencias trigonométricas.", ex: "tCollect(sin(x)*cos(x))" },
        { name: "ln", syntax: "ln(x)", cat: "Trig y Exp", desc: "Logaritmo natural (base e).", ex: "ln(x)" },
        { name: "log", syntax: "log(x, Base)", cat: "Trig y Exp", desc: "Logaritmo en base Base (base 10 si se omite).", ex: "log(100, 10)" },
        { name: "exp", syntax: "exp(x)", cat: "Trig y Exp", desc: "Función exponencial e^x.", ex: "exp(-x)" },
        { name: "sqrt", syntax: "sqrt(x)", cat: "Trig y Exp", desc: "Raíz cuadrada principal.", ex: "sqrt(x^2+y^2)" },
        { name: "abs", syntax: "abs(x)", cat: "Trig y Exp", desc: "Valor absoluto o módulo de un número complejo.", ex: "abs(x-1)" },
        { name: "real", syntax: "real(z)", cat: "Trig y Exp", desc: "Parte real de un número complejo.", ex: "real(3+4*i)" },
        { name: "imag", syntax: "imag(z)", cat: "Trig y Exp", desc: "Parte imaginaria de un número complejo.", ex: "imag(3+4*i)" },
        { name: "conj", syntax: "conj(z)", cat: "Trig y Exp", desc: "Complejo conjugado.", ex: "conj(3+4*i)" },

        // --- DEFINICIONES ---
        { name: "Define", syntax: "Define f(x)=Expr", cat: "Definiciones", desc: "Define una función reutilizable en todo el problema.", ex: "Define f(x,y)=x+y" },
    ],

    init() {
        this._createAutocompleteBox();
        this._bindCatalogModal();

        // Rastrear último input enfocado para insertar funciones desde el Catálogo o Autocomplete
        document.addEventListener("focusin", (e) => {
            const el = e.target;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
                if (el.id !== "catalog-search" && el.id !== "file-search") {
                    this.lastFocusedInput = el;
                }
            }
        });

        document.addEventListener("input", (e) => {
            const el = e.target;
            if (this._isFormulaInput(el)) {
                this._updateAutocomplete(el);
            } else {
                this.hideAutocomplete();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (!this.acBox || this.acBox.style.display === "none") return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                this.acIndex = (this.acIndex + 1) % this.acItems.length;
                this._renderAutocompleteList();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                this.acIndex = (this.acIndex - 1 + this.acItems.length) % this.acItems.length;
                this._renderAutocompleteList();
            } else if (e.key === "Tab" || e.key === "Enter") {
                if (this.acItems[this.acIndex]) {
                    e.preventDefault();
                    e.stopPropagation();
                    this._applyAutocomplete(this.lastFocusedInput, this.acItems[this.acIndex]);
                }
            } else if (e.key === "Escape") {
                this.hideAutocomplete();
            }
        }, true);

        document.addEventListener("click", (e) => {
            if (this.acBox && !this.acBox.contains(e.target) && e.target !== this.lastFocusedInput) {
                this.hideAutocomplete();
            }
        });
    },

    _isFormulaInput(el) {
        if (!el || el.tagName !== "INPUT") return false;
        return (
            el.hasAttribute("data-sheet-r") ||
            el.hasAttribute("data-sheet-formula") ||
            el.hasAttribute("data-ed-sr") ||
            el.hasAttribute("data-ed-sform") ||
            el.dataset.fnField === "expr" ||
            el.dataset.symF === "value" ||
            el.dataset.entF === "expr" ||
            el.hasAttribute("data-graph-expr")
        );
    },

    _createAutocompleteBox() {
        const box = document.createElement("div");
        box.id = "ti-ac-box";
        box.className = "ti-ac-box";
        box.style.display = "none";
        document.body.appendChild(box);
        this.acBox = box;
    },

    _updateAutocomplete(input) {
        const val = input.value || "";
        const pos = input.selectionStart ?? val.length;
        const before = val.slice(0, pos);
        const match = before.match(/([a-zA-Z]{2,})$/);
        if (!match) {
            this.hideAutocomplete();
            return;
        }
        const token = match[1].toLowerCase();
        this.acTokenStart = pos - match[1].length;

        const matches = this.functions
            .filter((f) => f.name.toLowerCase().startsWith(token) || f.name.toLowerCase().includes(token))
            .sort((a, b) => {
                const aS = a.name.toLowerCase().startsWith(token) ? 0 : 1;
                const bS = b.name.toLowerCase().startsWith(token) ? 0 : 1;
                return aS - bS || a.name.localeCompare(b.name);
            })
            .slice(0, 7);

        if (!matches.length) {
            this.hideAutocomplete();
            return;
        }

        this.acItems = matches;
        this.acIndex = 0;
        const rect = input.getBoundingClientRect();
        this.acBox.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`;
        this.acBox.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 240)}px`;
        this.acBox.style.display = "block";
        this._renderAutocompleteList();
    },

    _renderAutocompleteList() {
        this.acBox.innerHTML = this.acItems
            .map(
                (item, idx) => `
                <div class="ti-ac-item ${idx === this.acIndex ? "active" : ""}" data-ac-idx="${idx}">
                    <div class="ti-ac-head">
                        <span class="ti-ac-name">${item.syntax}</span>
                        <span class="ti-ac-cat">${item.cat}</span>
                    </div>
                    <div class="ti-ac-desc">${item.desc}</div>
                </div>`
            )
            .join("");

        this.acBox.querySelectorAll(".ti-ac-item").forEach((el) => {
            el.addEventListener("mousedown", (e) => {
                e.preventDefault();
                this._applyAutocomplete(this.lastFocusedInput, this.acItems[Number(el.dataset.acIdx)]);
            });
        });
    },

    _applyAutocomplete(input, item) {
        if (!input || !item) return;
        const val = input.value;
        const pos = input.selectionStart ?? val.length;
        const insertText = item.name === "Define" ? "Define " : `${item.name}()`;
        const newVal = val.slice(0, this.acTokenStart) + insertText + val.slice(pos);
        input.value = newVal;
        const caret = this.acTokenStart + insertText.length - (insertText.endsWith("()") ? 1 : 0);
        input.focus();
        input.setSelectionRange(caret, caret);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        this.hideAutocomplete();
    },

    hideAutocomplete() {
        if (this.acBox) this.acBox.style.display = "none";
        this.acItems = [];
    },

    // --- Modal Catálogo Oficial TI-Nspire ---
    _bindCatalogModal() {
        const modal = document.getElementById("catalog-modal");
        if (!modal) return;

        document.querySelectorAll("[data-open-catalog]").forEach((btn) => {
            btn.addEventListener("click", () => this.openCatalog());
        });
        document.getElementById("catalog-close")?.addEventListener("click", () => modal.classList.remove("open"));
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("open");
        });
        document.getElementById("catalog-search")?.addEventListener("input", () => this.renderCatalogList());
        document.getElementById("catalog-cat")?.addEventListener("change", () => this.renderCatalogList());
    },

    openCatalog() {
        const modal = document.getElementById("catalog-modal");
        if (!modal) return;
        modal.classList.add("open");
        this.renderCatalogList();
        setTimeout(() => document.getElementById("catalog-search")?.focus(), 40);
    },

    renderCatalogList() {
        const q = (document.getElementById("catalog-search")?.value || "").toLowerCase();
        const cat = document.getElementById("catalog-cat")?.value || "ALL";
        const list = document.getElementById("catalog-list");
        if (!list) return;

        const filtered = this.functions.filter((f) => {
            if (cat !== "ALL" && f.cat !== cat) return false;
            if (!q) return true;
            return (
                f.name.toLowerCase().includes(q) ||
                f.desc.toLowerCase().includes(q) ||
                f.syntax.toLowerCase().includes(q)
            );
        });

        if (!filtered.length) {
            list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);">No se encontraron funciones para "${q}".</div>`;
            return;
        }

        list.innerHTML = filtered
            .map(
                (f) => `
                <div class="catalog-row">
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <code style="color:var(--fox-orange);font-weight:700;font-size:13px;">${f.syntax}</code>
                            <span class="file-badge">${f.cat}</span>
                        </div>
                        <div style="font-size:12px;color:var(--text-main);margin-top:3px;">${f.desc}</div>
                        <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">Ejemplo: <code>${f.ex}</code></div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <button class="btn btn-sm btn-primary" data-cat-insert="${f.name}">Insertar</button>
                        <button class="btn btn-sm" data-cat-copy="${f.ex}" title="Copiar ejemplo">Copiar</button>
                    </div>
                </div>`
            )
            .join("");

        list.querySelectorAll("[data-cat-insert]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const fn = this.functions.find((x) => x.name === btn.dataset.catInsert);
                if (!fn) return;
                const target = this.lastFocusedInput;
                document.getElementById("catalog-modal").classList.remove("open");
                if (target && document.body.contains(target)) {
                    const text = fn.name === "Define" ? "Define " : `${fn.name}()`;
                    const s = target.selectionStart ?? target.value.length;
                    const e = target.selectionEnd ?? target.value.length;
                    target.value = target.value.slice(0, s) + text + target.value.slice(e);
                    const caret = s + text.length - (text.endsWith("()") ? 1 : 0);
                    target.focus();
                    target.setSelectionRange(caret, caret);
                    target.dispatchEvent(new Event("input", { bubbles: true }));
                    NaSpireUI.toast(`Insertado: ${fn.name}()`, "success");
                } else {
                    navigator.clipboard?.writeText(fn.syntax);
                    NaSpireUI.toast(`Copiado al portapapeles: ${fn.syntax}`, "success");
                }
            });
        });

        list.querySelectorAll("[data-cat-copy]").forEach((btn) => {
            btn.addEventListener("click", () => {
                navigator.clipboard?.writeText(btn.dataset.catCopy);
                NaSpireUI.toast(`Ejemplo copiado: ${btn.dataset.catCopy}`, "success");
            });
        });
    },
};

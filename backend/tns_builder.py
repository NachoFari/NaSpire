"""
Módulo generador de archivos .tns nativos para TI-Nspire OS 3.x–6.x:
- Hoja de Cálculo nativa (Listas y Hoja de Cálculo / urn:tabulator)
- Calculadora + Funciones + Notas nativas (TI.Scratchpad + TI.Notepad)
- Scripts Python (CX II) y Lua vía Luna (tools/luna.exe)
"""

import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any, Dict, List, Optional, Tuple

NO_WINDOW_FLAG = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

DOCUMENT_XML_TEMPLATE = (
    '<?xml version="1.0" encoding="UTF-8" ?>'
    '<doc ver="1.0">'
    "<properties><product>28</product><platform>1</platform><swver>6.4.0.74 CAS </swver><date>2025-12-10</date></properties>"
    "<settings><assessmentMode>0</assessmentMode><lastview>1</lastview><readOnlyMode>0</readOnlyMode>"
    "<lang>es</lang><dfmt>0</dfmt><tfmt>0</tfmt><curr>0</curr><expf>1</expf><ddig>7</ddig><angf>2</angf>"
    "<exapp>1</exapp><cplxf>1</cplxf><unit>1</unit><casAndExactMode>1</casAndExactMode><vectf>1</vectf>"
    "<base>1</base><gg_ddig>5</gg_ddig><gg_graphang>0</gg_graphang><gg_geomang>2</gg_geomang>"
    "<gg_axisendv>1</gg_axisendv><gg_tooltipfunman>0</gg_tooltipfunman><gg_autopoi>1</gg_autopoi>"
    "<gg_calcmenu>0</gg_calcmenu><gg_integerangles>0</gg_integerangles><gg_grid>0</gg_grid>"
    "<gg_autolabeling>0</gg_autolabeling><ds_dispdig>0</ds_dispdig><ds_diagnostics>0</ds_diagnostics>"
    "<gg_hideplotlabels>0</gg_hideplotlabels><boldnessFactor>0</boldnessFactor><examCode>0</examCode></settings>"
    "<cardIntendedData><cardIntendedWidth>320</cardIntendedWidth><cardIntendedHeight>217</cardIntendedHeight>"
    "<cardIntendedDensity>125.000000</cardIntendedDensity></cardIntendedData>"
    "<rights></rights><nps>1</nps><imgsize>0</imgsize></doc>"
)

FUNCTION_TABLE_TAIL = (
    '<tb:color version="2.0"><tb:columns>'
    + ("00" * 26)
    + "</tb:columns></tb:color>"
    '<tb:functiontable xmlns:tb="urn:TI.FunctionTable">'
    "<tb:defaultColumnWidth>70</tb:defaultColumnWidth>"
    "<tb:defaultIndependantStartValue>0.0</tb:defaultIndependantStartValue>"
    "<tb:defaultIndependantStepValue>1.0</tb:defaultIndependantStepValue>"
    "<tb:defaultIndependantAutoModeValue>1</tb:defaultIndependantAutoModeValue>"
    "<tb:defaultDependantAutoModeValue>1</tb:defaultDependantAutoModeValue>"
    "<tb:table><tb:columns>"
    '<tb:column type="function table independant column"><tb:columnWidthNative>70</tb:columnWidthNative>'
    "<tb:columnWidth>70</tb:columnWidth><tb:columnFlags>0</tb:columnFlags><tb:nvColumnWidth>0</tb:nvColumnWidth>"
    "<tb:autoSize>1</tb:autoSize></tb:column>"
    '<tb:column type="function table dependant column"><tb:columnWidthNative>234</tb:columnWidthNative>'
    "<tb:columnWidth>234</tb:columnWidth><tb:columnFlags>0</tb:columnFlags><tb:nvColumnWidth>0</tb:nvColumnWidth>"
    "</tb:column></tb:columns></tb:table></tb:functiontable>"
)


class TnsBuildError(Exception):
    """Error al compilar un documento .tns."""


def _find_luna(base_dir: str) -> Optional[str]:
    candidates = [
        os.path.join(base_dir, "tools", "luna.exe"),
        os.path.join(base_dir, "tools", "luna"),
        shutil.which("luna"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    return None


def _esc(text: str) -> str:
    return html.escape(str(text), quote=True).replace("'", "&apos;")


def _sanitize_var(name: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_]", "", (name or "").strip())
    if clean and clean[0].isdigit():
        clean = "v" + clean
    return clean


def _normalize_col_formula(formula: str, known_vars: List[str]) -> str:
    """
    Convierte una fórmula de columna estilo '=2*x' en '=2*'x' si refiere variables conocidas,
    manteniendo intacta cualquier fórmula que ya traiga apóstrofes.
    """
    f = (formula or "").strip()
    if not f:
        return ""
    if not f.startswith("="):
        f = "=" + f
    if "'" in f:
        return f
    body = f[1:]
    for v in sorted(set(v for v in known_vars if v), key=len, reverse=True):
        body = re.sub(rf"(?<![a-zA-Z0-9_'])\b{re.escape(v)}\b(?!\s*\()", f"'{v}", body)
    return "=" + body


def build_native_spreadsheet_problem_xml(
    columns: List[str],
    rows: List[List[str]],
    col_formulas: Optional[List[str]] = None,
) -> str:
    """
    Genera Problem1.xml NATIVO para Listas y Hoja de Cálculo (urn:tabulator)
    100% compatible con TI-Nspire CX / CX II OS 6.x.
    """
    col_formulas = col_formulas or []
    total_cols = max(26, len(columns))
    clean_vars = [_sanitize_var(c) for c in columns]

    sym_entries: List[str] = []
    col_xml_parts: List[str] = []

    for c_idx in range(total_cols):
        var_name = clean_vars[c_idx] if c_idx < len(clean_vars) else ""
        raw_formula = (col_formulas[c_idx] if c_idx < len(col_formulas) else "").strip()
        is_formula_col = bool(raw_formula)

        cells_xml: List[str] = []
        list_vals: List[str] = []

        if c_idx < len(columns):
            for r_idx, row in enumerate(rows, start=1):
                if c_idx >= len(row):
                    continue
                val = str(row[c_idx]).strip()
                if not val:
                    continue
                if val.startswith("="):
                    cells_xml.append(
                        f"<tb:cell><tb:rowId>{r_idx}</tb:rowId>"
                        f"<tb:formula>{_esc(val)}</tb:formula>"
                        f"<tb:data>{_esc(val[1:])}</tb:data></tb:cell>"
                    )
                else:
                    if is_formula_col:
                        cells_xml.append(
                            f"<tb:cell><tb:rowId>{r_idx}</tb:rowId>"
                            f"<tb:formula>={_esc(val)}</tb:formula>"
                            f"<tb:data>{_esc(val)}</tb:data></tb:cell>"
                        )
                    else:
                        cells_xml.append(
                            f"<tb:cell><tb:rowId>{r_idx}</tb:rowId>"
                            f"<tb:formula>{_esc(val)}</tb:formula>"
                            f"<tb:data>{_esc(val)}</tb:data></tb:cell>"
                        )
                    list_vals.append(val)

        if var_name and list_vals:
            sym_entries.append(
                f'<e t="1" f="0" c="0"><n>{_esc(var_name)}</n><v>{{{_esc(",".join(list_vals))}}}</v></e>'
            )

        col_type = "formula-column" if is_formula_col else "cell-column"
        name_tag = f"<tb:globalName>{_esc(var_name)}</tb:globalName>" if var_name else ""
        formula_tag = ""
        if is_formula_col:
            norm_f = _normalize_col_formula(raw_formula, clean_vars)
            formula_tag = f"<tb:formula>{_esc(norm_f)}</tb:formula>"

        col_xml_parts.append(
            f'<tb:column type="{col_type}">'
            f"{name_tag}"
            f"<tb:columnWidthNative>70</tb:columnWidthNative>"
            f"<tb:columnWidth>70</tb:columnWidth>"
            f"<tb:columnFlags>0</tb:columnFlags>"
            f"{formula_tag}"
            f"<tb:cells>{''.join(cells_xml)}</tb:cells>"
            f"</tb:column>"
        )

    sym_xml = f"<sym>{''.join(sym_entries)}</sym>"
    card_xml = (
        '<card clay="0" h1="10000" h2="10000" w1="10000" w2="10000">'
        "<isDummyCard>0</isDummyCard><flag>0</flag>"
        '<wdgt xmlns:tb="urn:tabulator" type="tabulator" ver="1.0">'
        "<tb:mFlags>1024</tb:mFlags><tb:value>2</tb:value><tb:cry>0</tb:cry>"
        "<tb:legal>none</tb:legal><tb:schk>false</tb:schk>"
        "<tb:guid>00000000000000000000000000000000</tb:guid>"
        "<tb:showingLnS>1</tb:showingLnS>"
        f"<tb:table><tb:rowHeights></tb:rowHeights><tb:columns>{''.join(col_xml_parts)}</tb:columns></tb:table>"
        f"{FUNCTION_TABLE_TAIL}"
        "</wdgt></card>"
    )

    return (
        '<?xml version="1.0" encoding="UTF-8" ?>'
        f'<prob xmlns="urn:TI.Problem" ver="1.0" pbname="">{sym_xml}{card_xml}</prob>'
    )


def _build_notepad_card_xml(notes_text: str) -> str:
    lines = notes_text.splitlines() if notes_text.strip() else ["Notas creadas con NaSpire Studio"]
    para_nodes: List[str] = []
    for line in lines:
        words = line.split(" ") if line else [""]
        leafs = []
        for idx, w in enumerate(words):
            chunk = w + (" " if idx < len(words) - 1 else "")
            leafs.append(
                f'<leaf name="1word" np="1" id0="0" pp0="{len(chunk)}">{html.escape(chunk)}</leaf>'
            )
        para_nodes.append(f'<node name="1para"><node name="1rtline">{"".join(leafs)}</node></node>')

    inner_tree = (
        '<r2dtotree version="1">'
        '<formatManager tableSize="1" capacity="10">'
        '<formatEntry entryIndex="0" entryID="0" entryRefCnt="3" tc="1" fc="268435199" '
        'fs="11" fst="0" cc="0" fest="0" feun="0" fesub="0" fesup="0" fn0="TI-Nspire Sans"></formatEntry>'
        "</formatManager>"
        f'<node name="1doc">{"".join(para_nodes)}</node>'
        "</r2dtotree>"
    )
    escaped_tree = html.escape(inner_tree, quote=True)
    return (
        '<card clay="0" h1="10000" h2="10000" w1="10000" w2="10000">'
        "<isDummyCard>0</isDummyCard><flag>0</flag>"
        '<wdgt xmlns:np="urn:TI.Notepad" type="TI.Notepad" ver="2.0">'
        "<np:mFlags>0</np:mFlags><np:value>3</np:value>"
        f"<np:fmtxt>{escaped_tree}</np:fmtxt>"
        "</wdgt></card>"
    )


def build_native_functions_notes_problem_xml(
    functions: List[Dict[str, str]],
    notes_text: str = "",
) -> str:
    """
    Genera Problem1.xml NATIVO con:
    - Pestaña 1.1: Calculadora (TI.Scratchpad) con las funciones ya definidas en <sym>
    - Pestaña 1.2: Notas (TI.Notepad) con el texto/formulario (si hay notas)
    """
    sym_entries: List[str] = []
    erows: List[str] = []

    for fn in functions:
        name = _sanitize_var(fn.get("name", ""))
        params = (fn.get("params") or "x").strip()
        expr = (fn.get("expr") or "").strip()
        if not name or not expr:
            continue
        # Convertir sintaxis Python ** a ^ de TI-Nspire
        ti_expr = expr.replace("**", "^")
        sym_entries.append(
            f'<e t="6" f="0" c="0"><n>{_esc(name)}</n><p>{_esc(params)}</p><v>{_esc(ti_expr)}</v></e>'
        )
        cmd = f"Define {name}({params})={ti_expr}"
        erows.append(
            f"<sp:erow><sp:entr>{_esc(cmd)}</sp:entr><sp:exct>{_esc(cmd)}</sp:exct>"
            '<sp:rslt><sp:warn2>{}</sp:warn2><sp:disp>Hecho</sp:disp></sp:rslt>'
            '<sp:ctxt ang="2" cplx="1" comp="1"/></sp:erow>'
        )

    auth_tree = html.escape(
        '<r2dtotree version="1"><formatManager tableSize="1" capacity="10">'
        '<formatEntry entryIndex="0" entryID="0" entryRefCnt="3" tc="1" fc="268435199" '
        'fs="11" fst="0" cc="0" fest="0" feun="0" fesub="0" fesup="0" fn0="TI-Nspire"></formatEntry>'
        '</formatManager><node name="0el" id0="0"><leaf name="0text" np="1" id0="0" pp0="0">'
        '<cursor index="0"/></leaf></node></r2dtotree>',
        quote=True,
    )

    calc_card = (
        '<card clay="0" h1="10000" h2="10000" w1="10000" w2="10000">'
        "<isDummyCard>0</isDummyCard><flag>0</flag>"
        '<wdgt xmlns:sp="urn:TI.Scratchpad" type="TI.Scratchpad" ver="1.0">'
        "<sp:mFlags>0</sp:mFlags><sp:value>0</sp:value>"
        f"<sp:auth>{auth_tree}</sp:auth>"
        f"{''.join(erows)}"
        "</wdgt></card>"
    )

    cards = [calc_card]
    if notes_text.strip():
        cards.append(_build_notepad_card_xml(notes_text))

    return (
        '<?xml version="1.0" encoding="UTF-8" ?>'
        f'<prob xmlns="urn:TI.Problem" ver="1.0" pbname=""><sym>{"".join(sym_entries)}</sym>{"".join(cards)}</prob>'
    )


class TnsBuilder:
    def __init__(self, base_dir: str) -> None:
        self.base_dir = base_dir

    def status(self) -> Dict[str, Any]:
        luna = _find_luna(self.base_dir)
        codec_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tns_codec")
        if codec_dir not in sys.path:
            sys.path.insert(0, codec_dir)
        codec_ok = True
        try:
            import tnstools  # noqa: F401
        except Exception:
            codec_ok = False
        return {
            "luna_available": luna is not None,
            "luna_path": luna or "",
            "native_xml_available": codec_ok,
        }

    def _safe_stem(self, filename: str, fallback: str) -> str:
        stem = "".join(
            ch for ch in os.path.splitext(filename)[0] if ch.isalnum() or ch in ("_", "-")
        )
        return stem or fallback

    def compile_native_xml_to_tns(
        self, filename: str, problem_xml: str, document_xml: str = DOCUMENT_XML_TEMPLATE
    ) -> Tuple[bytes, str]:
        """Empaqueta Document.xml + Problem1.xml a un archivo .tns NATIVO usando tns_codec."""
        safe_stem = self._safe_stem(filename, "documento_naspire")
        codec_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tns_codec")
        if codec_dir not in sys.path:
            sys.path.insert(0, codec_dir)

        try:
            import tnstools
        except Exception as exc:
            raise TnsBuildError(f"Módulo tns_codec no disponible: {exc}") from exc

        with tempfile.TemporaryDirectory(prefix="naspire_xml_") as tmp:
            xml_dir = os.path.join(tmp, "xml")
            os.makedirs(xml_dir, exist_ok=True)
            with open(os.path.join(xml_dir, "Document.xml"), "w", encoding="utf-8") as f:
                f.write(document_xml)
            with open(os.path.join(xml_dir, "Problem1.xml"), "w", encoding="utf-8") as f:
                f.write(problem_xml)

            import pathlib

            out_tns = os.path.join(tmp, f"{safe_stem}.tns")
            tnstools.build_tns_from_xml(pathlib.Path(xml_dir), pathlib.Path(out_tns))
            if not os.path.isfile(out_tns):
                raise TnsBuildError("No se pudo empaquetar el documento XML nativo a .tns.")
            with open(out_tns, "rb") as f:
                return f.read(), f"{safe_stem}.tns"

    def compile_spreadsheet_to_tns(
        self,
        filename: str,
        columns: List[str],
        rows: List[List[str]],
        formulas: Optional[List[str]] = None,
    ) -> Tuple[bytes, str]:
        prob_xml = build_native_spreadsheet_problem_xml(columns, rows, formulas)
        return self.compile_native_xml_to_tns(filename, prob_xml)

    def compile_functions_notes_to_tns(
        self,
        filename: str,
        functions: List[Dict[str, str]],
        notes: str = "",
    ) -> Tuple[bytes, str]:
        prob_xml = build_native_functions_notes_problem_xml(functions, notes)
        return self.compile_native_xml_to_tns(filename, prob_xml)

    def compile_rk4_solver_to_tns(
        self,
        filename: str = "rk4_solver",
        expr_xy: str = "x+y",
        x0: float = 0.0,
        y0: float = 1.0,
        h: float = 0.1,
        steps: int = 15,
    ) -> Tuple[bytes, str]:
        """
        Genera un documento .tns NATIVO de Runge-Kutta 4° orden (RK4) con:
        - Pestaña 1.1 (Calculadora): Define f(x,y)=... y h:=... listos para reemplazar.
        - Pestaña 1.2 (Listas y Hoja de Cálculo): Tabla completa n, x, y, k1, k2, k3, k4
          con fórmulas en vivo que se recalculan solas al cambiar f(x,y), h, x0 o y0.
        """
        # Evaluar valores iniciales aproximados para poblar <tb:data> (la calculadora recalcula en vivo)
        import math as _m

        safe_env = {k: getattr(_m, k) for k in dir(_m) if not k.startswith("_")}
        py_expr = expr_xy.replace("^", "**")

        def _f(xv: float, yv: float) -> float:
            try:
                return float(eval(py_expr, {"__builtins__": {}}, {**safe_env, "x": xv, "y": yv}))
            except Exception:
                return 0.0

        def _fmt(v: float) -> str:
            return f"{v:.6g}"

        # Columnas A..G: n, xn, yn, k1, k2, k3, k4
        col_names = ["n", "xn", "yn", "k1", "k2", "k3", "k4"]
        col_cells: List[List[Tuple[int, str, str]]] = [[] for _ in range(len(col_names))]

        xs, ys = [], []
        xv, yv = x0, y0
        for i in range(steps + 1):
            r = i + 1
            k1 = _f(xv, yv)
            k2 = _f(xv + h / 2.0, yv + (h / 2.0) * k1)
            k3 = _f(xv + h / 2.0, yv + (h / 2.0) * k2)
            k4 = _f(xv + h, yv + h * k3)

            xs.append(_fmt(xv))
            ys.append(_fmt(yv))

            col_cells[0].append((r, str(i), str(i)))
            if i == 0:
                col_cells[1].append((r, _fmt(xv), _fmt(xv)))
                col_cells[2].append((r, _fmt(yv), _fmt(yv)))
            else:
                col_cells[1].append((r, f"=b{r-1}+h", _fmt(xv)))
                col_cells[2].append((r, f"=c{r-1}+(h/6)*(d{r-1}+2*e{r-1}+2*f{r-1}+g{r-1})", _fmt(yv)))

            col_cells[3].append((r, f"=f(b{r},c{r})", _fmt(k1)))
            col_cells[4].append((r, f"=f(b{r}+h/2,c{r}+(h/2)*d{r})", _fmt(k2)))
            col_cells[5].append((r, f"=f(b{r}+h/2,c{r}+(h/2)*e{r})", _fmt(k3)))
            col_cells[6].append((r, f"=f(b{r}+h,c{r}+h*f{r})", _fmt(k4)))

            xv = xv + h
            yv = yv + (h / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)

        # Construir columnas XML (26 columnas A..Z)
        col_xml_parts: List[str] = []
        for c_idx in range(26):
            if c_idx < len(col_names):
                cname = col_names[c_idx]
                cells_str = "".join(
                    f"<tb:cell><tb:rowId>{rid}</tb:rowId>"
                    f"<tb:formula>{_esc(form)}</tb:formula>"
                    f"<tb:data>{_esc(val)}</tb:data></tb:cell>"
                    for rid, form, val in col_cells[c_idx]
                )
                col_xml_parts.append(
                    '<tb:column type="cell-column">'
                    f"<tb:globalName>{_esc(cname)}</tb:globalName>"
                    "<tb:columnWidthNative>70</tb:columnWidthNative>"
                    "<tb:columnWidth>70</tb:columnWidth>"
                    "<tb:columnFlags>0</tb:columnFlags>"
                    f"<tb:cells>{cells_str}</tb:cells>"
                    "</tb:column>"
                )
            else:
                col_xml_parts.append(
                    '<tb:column type="cell-column">'
                    "<tb:columnWidthNative>70</tb:columnWidthNative>"
                    "<tb:columnWidth>70</tb:columnWidth>"
                    "<tb:columnFlags>0</tb:columnFlags>"
                    "<tb:cells></tb:cells>"
                    "</tb:column>"
                )

        # Símbolos globales: f(x,y), h, xn, yn
        sym_xml = (
            "<sym>"
            f'<e t="6" f="0" c="0"><n>f</n><p>x,y</p><v>{_esc(expr_xy)}</v></e>'
            f'<e t="1" f="0" c="0"><n>h</n><v>{_esc(_fmt(h))}</v></e>'
            f'<e t="1" f="0" c="0"><n>xn</n><v>{{{_esc(",".join(xs))}}}</v></e>'
            f'<e t="1" f="0" c="0"><n>yn</n><v>{{{_esc(",".join(ys))}}}</v></e>'
            "</sym>"
        )

        # Pestaña 1.1: Calculadora para cambiar f(x,y) y h rápidamente
        auth_tree = html.escape(
            '<r2dtotree version="1"><formatManager tableSize="1" capacity="10">'
            '<formatEntry entryIndex="0" entryID="0" entryRefCnt="3" tc="1" fc="268435199" '
            'fs="11" fst="0" cc="0" fest="0" feun="0" fesub="0" fesup="0" fn0="TI-Nspire"></formatEntry>'
            '</formatManager><node name="0el" id0="0"><leaf name="0text" np="1" id0="0" pp0="0">'
            '<cursor index="0"/></leaf></node></r2dtotree>',
            quote=True,
        )
        cmd_f = f"Define f(x,y)={expr_xy}"
        cmd_h = f"h:={_fmt(h)}"
        calc_card = (
            '<card clay="0" h1="10000" h2="10000" w1="10000" w2="10000">'
            "<isDummyCard>0</isDummyCard><flag>0</flag>"
            '<wdgt xmlns:sp="urn:TI.Scratchpad" type="TI.Scratchpad" ver="1.0">'
            "<sp:mFlags>0</sp:mFlags><sp:value>0</sp:value>"
            f"<sp:auth>{auth_tree}</sp:auth>"
            f"<sp:erow><sp:entr>{_esc(cmd_f)}</sp:entr><sp:exct>{_esc(cmd_f)}</sp:exct>"
            '<sp:rslt><sp:warn2>{}</sp:warn2><sp:disp>Hecho</sp:disp></sp:rslt>'
            '<sp:ctxt ang="2" cplx="1" comp="1"/></sp:erow>'
            f"<sp:erow><sp:entr>{_esc(cmd_h)}</sp:entr><sp:exct>{_esc(cmd_h)}</sp:exct>"
            f'<sp:rslt><sp:warn2>{{}}</sp:warn2><sp:disp>{_esc(_fmt(h))}</sp:disp></sp:rslt>'
            '<sp:ctxt ang="2" cplx="1" comp="1"/></sp:erow>'
            "</wdgt></card>"
        )

        # Pestaña 1.2: Hoja de Cálculo RK4
        sheet_card = (
            '<card clay="0" h1="10000" h2="10000" w1="10000" w2="10000">'
            "<isDummyCard>0</isDummyCard><flag>0</flag>"
            '<wdgt xmlns:tb="urn:tabulator" type="tabulator" ver="1.0">'
            "<tb:mFlags>1024</tb:mFlags><tb:value>2</tb:value><tb:cry>0</tb:cry>"
            "<tb:legal>none</tb:legal><tb:schk>false</tb:schk>"
            "<tb:guid>00000000000000000000000000000000</tb:guid>"
            "<tb:showingLnS>1</tb:showingLnS>"
            f"<tb:table><tb:rowHeights></tb:rowHeights><tb:columns>{''.join(col_xml_parts)}</tb:columns></tb:table>"
            f"{FUNCTION_TABLE_TAIL}"
            "</wdgt></card>"
        )

        # Pestaña 1.3: Notas de instrucciones rápidas
        notes_card = _build_notepad_card_xml(
            "RUNGE-KUTTA 4 (RK4) — NaSpire / NaSuite\n"
            "1. En 1.1 Calculadora cambia f(x,y) y el paso h.\n"
            "2. En 1.2 Hoja de Calculo cambia x0 (celda B1) e y0 (celda C1).\n"
            "3. Toda la tabla (xn, yn, k1, k2, k3, k4) se recalcula automaticamente."
        )

        prob_xml = (
            '<?xml version="1.0" encoding="UTF-8" ?>'
            f'<prob xmlns="urn:TI.Problem" ver="1.0" pbname="">{sym_xml}{calc_card}{sheet_card}{notes_card}</prob>'
        )
        return self.compile_native_xml_to_tns(filename, prob_xml)

    def compile_python_to_tns(self, filename: str, code: str) -> Tuple[bytes, str]:
        """Compila un script Python (.py) a .tns usando Luna."""
        luna = _find_luna(self.base_dir)
        if not luna:
            raise TnsBuildError("No se encontró 'tools/luna.exe'.")
        safe_stem = self._safe_stem(filename, "script_naspire")

        with tempfile.TemporaryDirectory(prefix="naspire_tns_") as tmp:
            py_path = os.path.join(tmp, f"{safe_stem}.py")
            tns_path = os.path.join(tmp, f"{safe_stem}.tns")
            with open(py_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(code)

            proc = subprocess.run(
                [luna, py_path, tns_path],
                capture_output=True,
                text=True,
                creationflags=NO_WINDOW_FLAG,
                timeout=20,
            )
            if proc.returncode != 0 or not os.path.isfile(tns_path):
                err = (proc.stderr or proc.stdout or "Error desconocido en Luna").strip()
                raise TnsBuildError(f"Error compilando .tns con Luna: {err}")

            with open(tns_path, "rb") as f:
                return f.read(), f"{safe_stem}.tns"

    def compile_lua_to_tns(self, filename: str, code: str) -> Tuple[bytes, str]:
        """Compila un script Lua (.lua) a .tns usando Luna."""
        luna = _find_luna(self.base_dir)
        if not luna:
            raise TnsBuildError("No se encontró 'tools/luna.exe'.")
        safe_stem = self._safe_stem(filename, "app_naspire")

        with tempfile.TemporaryDirectory(prefix="naspire_tns_") as tmp:
            lua_path = os.path.join(tmp, f"{safe_stem}.lua")
            tns_path = os.path.join(tmp, f"{safe_stem}.tns")
            with open(lua_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(code)

            proc = subprocess.run(
                [luna, lua_path, tns_path],
                capture_output=True,
                text=True,
                creationflags=NO_WINDOW_FLAG,
                timeout=20,
            )
            if proc.returncode != 0 or not os.path.isfile(tns_path):
                err = (proc.stderr or proc.stdout or "Error desconocido en Luna").strip()
                raise TnsBuildError(f"Error compilando Lua a .tns con Luna: {err}")

            with open(tns_path, "rb") as f:
                return f.read(), f"{safe_stem}.tns"

"""
Módulo Editor Visual + XML de archivos .tns nativos para NaSpire Studio (NaSuite).
Decodifica cualquier .tns en pestañas editables visualmente:
- Calculadora (TI.Scratchpad): funciones/variables en <sym> y líneas <sp:erow>
- Listas y Hoja de Cálculo (tabulator): nombres de columnas, fórmulas de columna y celdas
- Notas (TI.Notepad): texto plano editable de párrafos
- Gráficos (TI.GeoGrapher): expresiones f1(x), f2(x), ...
Además conserva el modo XML avanzado (Document.xml, Problem1.xml, ...).
"""

import html
import os
import pathlib
import re
import sys
import tempfile
import xml.dom.minidom
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Tuple

WIDGET_LABELS = {
    "tabulator": "Listas y Hoja de Cálculo",
    "TI.Notepad": "Notas",
    "TI.Scratchpad": "Calculadora",
    "TI.GeoGrapher": "Gráficos / Geometría",
    "TI.DataGrapher": "Datos y Estadísticas",
    "TI.ScriptApp": "Script Lua",
    "TI.Python": "Python",
}


class TnsEditorError(Exception):
    """Error al inspeccionar o guardar un archivo .tns."""


def _import_tnstools():
    codec_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tns_codec")
    if codec_dir not in sys.path:
        sys.path.insert(0, codec_dir)
    import tnstools

    return tnstools


def _esc(text: str) -> str:
    return html.escape(str(text), quote=True).replace("'", "&apos;")


def _parse_symbols(prob_xml: str) -> List[Dict[str, str]]:
    syms: List[Dict[str, str]] = []
    m_sym = re.search(r"<sym>(.*?)</sym>", prob_xml, flags=re.S)
    if not m_sym:
        return syms
    for m in re.finditer(r'<e\s+([^>]+)>(.*?)</e>', m_sym.group(1), flags=re.S):
        attrs, body = m.group(1), m.group(2)
        t_m = re.search(r't="([^"]+)"', attrs)
        n_m = re.search(r"<n>(.*?)</n>", body, flags=re.S)
        p_m = re.search(r"<p>(.*?)</p>", body, flags=re.S)
        v_m = re.search(r"<v>(.*?)</v>", body, flags=re.S)
        syms.append(
            {
                "kind": "function" if (t_m and t_m.group(1) == "6") else "var",
                "t": t_m.group(1) if t_m else "1",
                "name": html.unescape(n_m.group(1)) if n_m else "",
                "params": html.unescape(p_m.group(1)) if p_m else "",
                "value": html.unescape(v_m.group(1)) if v_m else "",
            }
        )
    return syms


def _parse_calc_card(card_xml: str, symbols: List[Dict[str, str]]) -> Dict[str, Any]:
    rows: List[Dict[str, str]] = []
    for m in re.finditer(r"<sp:erow>(.*?)</sp:erow>", card_xml, flags=re.S):
        body = m.group(1)
        e_m = re.search(r"<sp:entr>(.*?)</sp:entr>", body, flags=re.S)
        d_m = re.search(r"<sp:disp>(.*?)</sp:disp>", body, flags=re.S)
        rows.append(
            {
                "expr": html.unescape(e_m.group(1)) if e_m else "",
                "result": html.unescape(d_m.group(1)) if d_m else "",
            }
        )
    return {"symbols": symbols, "entries": rows}


def _parse_spreadsheet_card(card_xml: str) -> Dict[str, Any]:
    m_cols = re.search(r"<tb:table>.*?<tb:columns>(.*?)</tb:columns>.*?</tb:table>", card_xml, flags=re.S)
    if not m_cols:
        return {"columns": ["a", "b", "c"], "formulas": ["", "", ""], "rows": [["", "", ""]]}

    raw_cols = re.findall(r"<tb:column\b[^>]*>.*?</tb:column>", m_cols.group(1), flags=re.S)
    parsed_cols = []
    max_used_col = 2  # Al menos 3 columnas visibles
    max_row = 4  # Al menos 4 filas visibles

    for idx, col_xml in enumerate(raw_cols):
        name_m = re.search(r"<tb:globalName>(.*?)</tb:globalName>", col_xml, flags=re.S)
        # Fórmula de columna aparece antes de <tb:cells>
        before_cells = col_xml.split("<tb:cells>")[0]
        form_m = re.search(r"<tb:formula>(.*?)</tb:formula>", before_cells, flags=re.S)
        cells_m = re.search(r"<tb:cells>(.*?)</tb:cells>", col_xml, flags=re.S)

        cname = html.unescape(name_m.group(1)) if name_m else ""
        cform = html.unescape(form_m.group(1)) if form_m else ""
        cells_map: Dict[int, str] = {}

        if cells_m:
            for cm in re.finditer(r"<tb:cell>(.*?)</tb:cell>", cells_m.group(1), flags=re.S):
                cbody = cm.group(1)
                r_m = re.search(r"<tb:rowId>(\d+)</tb:rowId>", cbody)
                f_m = re.search(r"<tb:formula>(.*?)</tb:formula>", cbody, flags=re.S)
                d_m = re.search(r"<tb:data>(.*?)</tb:data>", cbody, flags=re.S)
                if r_m:
                    rnum = int(r_m.group(1))
                    val = html.unescape(f_m.group(1)) if f_m else (html.unescape(d_m.group(1)) if d_m else "")
                    cells_map[rnum] = val
                    if rnum > max_row:
                        max_row = rnum

        if cname or cform or cells_map:
            max_used_col = max(max_used_col, idx)
        parsed_cols.append((cname, cform, cells_map))

    num_cols = min(len(parsed_cols), max_used_col + 1)
    columns = [parsed_cols[i][0] for i in range(num_cols)]
    formulas = [parsed_cols[i][1] for i in range(num_cols)]
    rows: List[List[str]] = []
    for r in range(1, max_row + 1):
        rows.append([parsed_cols[c][2].get(r, "") for c in range(num_cols)])

    return {"columns": columns, "formulas": formulas, "rows": rows}


def _parse_notes_card(card_xml: str) -> Dict[str, Any]:
    m = re.search(r"<np:fmtxt>(.*?)</np:fmtxt>", card_xml, flags=re.S)
    if not m:
        return {"text": ""}
    unescaped = html.unescape(m.group(1))
    lines: List[str] = []
    for para in re.findall(r'<node\s+name="1para">(.*?)</node>\s*</node>', unescaped, flags=re.S):
        words = re.findall(r'<leaf[^>]*>(.*?)</leaf>', para, flags=re.S)
        clean_words = [re.sub(r"<cursor[^>]*/?>", "", w) for w in words]
        lines.append(html.unescape("".join(clean_words)))
    if not lines:
        # Fallback: extraer texto de cualquier <leaf>
        words = re.findall(r"<leaf[^>]*>(.*?)</leaf>", unescaped, flags=re.S)
        lines = [html.unescape("".join(re.sub(r"<cursor[^>]*/?>", "", w) for w in words))]
    return {"text": "\n".join(lines)}


def _parse_graph_card(card_xml: str) -> Dict[str, Any]:
    exprs: List[Dict[str, str]] = []
    for m in re.finditer(r"<gg:expression>(.*?)</gg:expression>", card_xml, flags=re.S):
        body = m.group(1)
        lbl = re.search(r"<gg:lbl>(.*?)</gg:lbl>", body, flags=re.S)
        prms = re.search(r"<gg:prms>(.*?)</gg:prms>", body, flags=re.S)
        ex = re.search(r"<gg:expr>(.*?)</gg:expr>", body, flags=re.S)
        exprs.append(
            {
                "label": html.unescape(lbl.group(1)) if lbl else "f1",
                "params": html.unescape(prms.group(1)) if prms else "x",
                "expr": html.unescape(ex.group(1)) if ex else "",
            }
        )
    return {"expressions": exprs}


def _detect_pages(files: Dict[str, str]) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    for fname, content in sorted(files.items()):
        if not fname.lower().startswith("problem") or not fname.lower().endswith(".xml"):
            continue
        m_num = re.search(r"(\d+)", fname)
        pnum = m_num.group(1) if m_num else "1"
        symbols = _parse_symbols(content)
        cards = re.findall(r"<card\b.*?</card>", content, flags=re.S)
        for idx, card in enumerate(cards, start=1):
            w_match = re.search(r'<wdgt[^>]+type="([^"]+)"', card)
            w_type = w_match.group(1) if w_match else "Desconocido"
            if w_type == "TI.Placeholder":
                continue
            label = WIDGET_LABELS.get(w_type, w_type)
            kind = "raw"
            visual: Dict[str, Any] = {}

            if w_type == "TI.Scratchpad":
                kind = "calculator"
                visual = _parse_calc_card(card, symbols)
            elif w_type == "tabulator":
                kind = "spreadsheet"
                visual = _parse_spreadsheet_card(card)
            elif w_type == "TI.Notepad":
                kind = "notes"
                visual = _parse_notes_card(card)
            elif w_type == "TI.GeoGrapher":
                if "<gg:mode>2</gg:mode>" in card:
                    label = "Geometría"
                    kind = "raw"
                else:
                    label = "Gráficos"
                    kind = "graph"
                    visual = _parse_graph_card(card)

            pages.append(
                {
                    "id": f"{pnum}.{idx}",
                    "card_index": idx - 1,
                    "file": fname,
                    "type": w_type,
                    "label": label,
                    "kind": kind,
                    "visual": visual,
                }
            )
    return pages


def apply_visual_page_edit(files: Dict[str, str], page: Dict[str, Any]) -> Dict[str, str]:
    """Aplica cambios visuales de una pestaña sobre su archivo ProblemX.xml sin dañar las demás pestañas."""
    fname = page.get("file", "Problem1.xml")
    card_idx = int(page.get("card_index", 0))
    kind = page.get("kind", "raw")
    visual = page.get("visual", {})

    if fname not in files:
        raise TnsEditorError(f"No se encontró '{fname}' en el documento.")

    xml_text = files[fname]
    card_matches = list(re.finditer(r"<card\b.*?</card>", xml_text, flags=re.S))
    if card_idx < 0 or card_idx >= len(card_matches):
        raise TnsEditorError(f"Índice de pestaña inválido: {card_idx}")

    target_match = card_matches[card_idx]
    card_xml = target_match.group(0)
    new_card_xml = card_xml
    new_xml_text = xml_text

    if kind == "notes":
        from backend.tns_builder import _build_notepad_card_xml

        new_card_xml = _build_notepad_card_xml(visual.get("text", ""))
        new_xml_text = (
            xml_text[: target_match.start()] + new_card_xml + xml_text[target_match.end() :]
        )

    elif kind == "spreadsheet":
        columns = visual.get("columns", [])
        formulas = visual.get("formulas", [])
        rows = visual.get("rows", [])
        total_cols = max(26, len(columns))
        col_xml_parts: List[str] = []

        for c_idx in range(total_cols):
            cname = (columns[c_idx] if c_idx < len(columns) else "").strip()
            cform = (formulas[c_idx] if c_idx < len(formulas) else "").strip()
            is_fcol = bool(cform)
            cells_parts: List[str] = []
            if c_idx < len(columns):
                for r_idx, row in enumerate(rows, start=1):
                    if c_idx >= len(row):
                        continue
                    v = str(row[c_idx]).strip()
                    if not v:
                        continue
                    if v.startswith("="):
                        cells_parts.append(
                            f"<tb:cell><tb:rowId>{r_idx}</tb:rowId>"
                            f"<tb:formula>{_esc(v)}</tb:formula>"
                            f"<tb:data>{_esc(v[1:])}</tb:data></tb:cell>"
                        )
                    else:
                        f_val = f"={v}" if is_fcol else v
                        cells_parts.append(
                            f"<tb:cell><tb:rowId>{r_idx}</tb:rowId>"
                            f"<tb:formula>{_esc(f_val)}</tb:formula>"
                            f"<tb:data>{_esc(v)}</tb:data></tb:cell>"
                        )

            col_type = "formula-column" if is_fcol else "cell-column"
            name_tag = f"<tb:globalName>{_esc(cname)}</tb:globalName>" if cname else ""
            form_tag = f"<tb:formula>{_esc(cform)}</tb:formula>" if is_fcol else ""
            col_xml_parts.append(
                f'<tb:column type="{col_type}">'
                f"{name_tag}"
                "<tb:columnWidthNative>70</tb:columnWidthNative>"
                "<tb:columnWidth>70</tb:columnWidth>"
                "<tb:columnFlags>0</tb:columnFlags>"
                f"{form_tag}"
                f"<tb:cells>{''.join(cells_parts)}</tb:cells>"
                "</tb:column>"
            )

        new_cols_block = f"<tb:columns>{''.join(col_xml_parts)}</tb:columns>"
        new_card_xml = re.sub(
            r"(<tb:table>.*?)<tb:columns>.*?</tb:columns>(.*?</tb:table>)",
            lambda m: m.group(1) + new_cols_block + m.group(2),
            card_xml,
            count=1,
            flags=re.S,
        )
        new_xml_text = (
            xml_text[: target_match.start()] + new_card_xml + xml_text[target_match.end() :]
        )

    elif kind == "calculator":
        entries = visual.get("entries", [])
        symbols = visual.get("symbols", [])

        erows_xml = []
        for row in entries:
            expr = (row.get("expr") or "").strip()
            res = (row.get("result") or "Hecho").strip()
            if not expr:
                continue
            erows_xml.append(
                f"<sp:erow><sp:entr>{_esc(expr)}</sp:entr><sp:exct>{_esc(expr)}</sp:exct>"
                f'<sp:rslt><sp:warn2>{{}}</sp:warn2><sp:disp>{_esc(res)}</sp:disp></sp:rslt>'
                '<sp:ctxt ang="2" cplx="1" comp="1"/></sp:erow>'
            )

        # Reemplazar todos los <sp:erow>...</sp:erow> dentro de esta tarjeta
        stripped = re.sub(r"<sp:erow>.*?</sp:erow>", "", card_xml, flags=re.S)
        new_card_xml = stripped.replace("</wdgt>", "".join(erows_xml) + "</wdgt>", 1)
        new_xml_text = (
            xml_text[: target_match.start()] + new_card_xml + xml_text[target_match.end() :]
        )

        # Actualizar <sym> con las funciones/variables editadas
        sym_parts = []
        for s in symbols:
            sname = (s.get("name") or "").strip()
            sval = (s.get("value") or "").strip()
            if not sname or not sval:
                continue
            if s.get("kind") == "function":
                sparms = (s.get("params") or "x").strip()
                sym_parts.append(
                    f'<e t="6" f="0" c="0"><n>{_esc(sname)}</n><p>{_esc(sparms)}</p><v>{_esc(sval)}</v></e>'
                )
            else:
                sym_parts.append(
                    f'<e t="1" f="0" c="0"><n>{_esc(sname)}</n><v>{_esc(sval)}</v></e>'
                )
        new_sym = f"<sym>{''.join(sym_parts)}</sym>"
        new_xml_text = re.sub(r"<sym>.*?</sym>", lambda _: new_sym, new_xml_text, count=1, flags=re.S)

    elif kind == "graph":
        exprs = visual.get("expressions", [])
        idx_holder = [0]

        def _repl_expr(m):
            body = m.group(1)
            if idx_holder[0] < len(exprs):
                item = exprs[idx_holder[0]]
                idx_holder[0] += 1
                new_ex = _esc((item.get("expr") or "").strip())
                body = re.sub(r"<gg:expr>.*?</gg:expr>", f"<gg:expr>{new_ex}</gg:expr>", body, flags=re.S)
                body = re.sub(r"<gg:relv>.*?</gg:relv>", f"<gg:relv>{new_ex}</gg:relv>", body, flags=re.S)
            return f"<gg:expression>{body}</gg:expression>"

        new_card_xml = re.sub(r"<gg:expression>(.*?)</gg:expression>", _repl_expr, card_xml, flags=re.S)
        new_xml_text = (
            xml_text[: target_match.start()] + new_card_xml + xml_text[target_match.end() :]
        )

    updated = dict(files)
    updated[fname] = new_xml_text
    return updated


def pretty_xml(xml_text: str) -> str:
    """Formatea XML de forma legible sin romper el contenido."""
    try:
        dom = xml.dom.minidom.parseString(xml_text.encode("utf-8"))
        pretty = dom.toprettyxml(indent="  ", encoding="UTF-8").decode("utf-8")
        lines = [ln for ln in pretty.splitlines() if ln.strip()]
        return "\n".join(lines)
    except Exception:
        return xml_text


def inspect_tns_bytes(tns_bytes: bytes, filename: str = "documento.tns") -> Dict[str, Any]:
    """Decodifica un .tns en sus archivos XML internos y pestañas visuales."""
    tnstools = _import_tnstools()
    with tempfile.TemporaryDirectory(prefix="naspire_edit_") as tmp:
        in_path = pathlib.Path(tmp) / (os.path.basename(filename) or "documento.tns")
        out_dir = pathlib.Path(tmp) / "xml_out"
        in_path.write_bytes(tns_bytes)

        try:
            tnstools.decode_tns_file(in_path, out_dir)
        except Exception as exc:
            raise TnsEditorError(f"No se pudo decodificar '{filename}': {exc}") from exc

        files: Dict[str, str] = {}
        for p in sorted(out_dir.rglob("*")):
            if p.is_file():
                rel = p.relative_to(out_dir).as_posix()
                try:
                    files[rel] = p.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    continue

        if not files:
            raise TnsEditorError("El archivo .tns no contiene XML editables.")

        return {
            "filename": os.path.basename(filename),
            "size": len(tns_bytes),
            "files": files,
            "pages": _detect_pages(files),
        }


def save_tns_from_files(files: Dict[str, str], filename: str = "documento.tns") -> Tuple[bytes, str]:
    """Re-empaqueta un diccionario {nombre: xml_str} a un .tns nativo método 13."""
    if not files or "Document.xml" not in files:
        raise TnsEditorError("Falta 'Document.xml' para reconstruir el archivo .tns.")

    tnstools = _import_tnstools()
    safe_name = os.path.basename(filename).strip() or "documento_editado.tns"
    if not safe_name.lower().endswith(".tns"):
        safe_name += ".tns"

    with tempfile.TemporaryDirectory(prefix="naspire_save_") as tmp:
        xml_dir = pathlib.Path(tmp) / "xml_in"
        xml_dir.mkdir(parents=True, exist_ok=True)
        for rel, content in files.items():
            clean_rel = rel.lstrip("/\\")
            if ".." in clean_rel.split("/") or ".." in clean_rel.split("\\"):
                continue
            target = xml_dir / clean_rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

        out_tns = pathlib.Path(tmp) / safe_name
        try:
            tnstools.build_tns_from_xml(xml_dir, out_tns)
        except Exception as exc:
            raise TnsEditorError(f"Error al reconstruir .tns: {exc}") from exc

        return out_tns.read_bytes(), safe_name

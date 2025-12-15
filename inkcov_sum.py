#!/usr/bin/env python3
# inkcov_sum_debug.py — versão debug + saída marcada (OK_JSON:...)
import sys, os, subprocess, re, json, shutil
from math import isfinite

POINT_TO_CM = 25.4 / 72.0 / 10.0
POINT_TO_CM_SQ = POINT_TO_CM * POINT_TO_CM

def find_gs_executable():
    for name in ("gs", "gswin64c.exe", "gswin32c.exe"):
        path = shutil.which(name)
        if path:
            return path
    return None

def run_inkcov(gs_exec, pdf_path):
    cmd = [gs_exec, "-dBATCH", "-dNOPAUSE", "-sDEVICE=inkcov", pdf_path]
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p

def parse_inkcov_output(gs_output):
    pages = []
    current = None
    for line in gs_output.splitlines():
        raw = line.rstrip("\n")
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"Page\s+(\d+)", line, re.I)
        if m:
            if current:
                pages.append(current)
            current = {"page": int(m.group(1)), "lines": []}
            continue
        if current is None:
            continue
        m2 = re.match(r"^\s*([0-9\.\s\-eE\+]+)\s*(.*)$", raw)
        if m2:
            nums_part = m2.group(1).strip()
            text_part = m2.group(2).strip()
            nums = re.findall(r"[-+]?\d*\.\d+|\d+", nums_part)
            nums = [float(x) for x in nums]
            name = text_part if text_part != "" else None
            current["lines"].append({"nums": nums, "name": name})
    if current:
        pages.append(current)
    return pages

def get_pdf_page_sizes_pts(pdf_path):
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        sizes = []
        for p in reader.pages:
            try:
                w = float(p.mediabox.width); h = float(p.mediabox.height)
            except Exception:
                try:
                    coords = [float(x) for x in p.mediabox]
                    llx,lly,urx,ury = coords
                    w = abs(urx - llx); h = abs(ury - lly)
                except Exception:
                    w,h = 612.0,792.0
            sizes.append((w,h))
        return sizes
    except Exception:
        return [(612.0,792.0)]

def normalize_coverage_value(val):
    if not isfinite(val): return 0.0
    if val > 1.0: return val / 100.0
    if val < 0.0: return 0.0
    return val

def compute_totals(parsed_pages, page_sizes_pts):
    totals = {"C":0.0,"M":0.0,"Y":0.0,"K":0.0,"spots":{}}
    for pg in parsed_pages:
        page_idx = max(0, min(len(page_sizes_pts)-1, pg["page"]-1))
        w_pts, h_pts = page_sizes_pts[page_idx]
        area_page_cm2 = abs(w_pts * h_pts) * POINT_TO_CM_SQ
        for ln in pg["lines"]:
            nums = ln["nums"]
            if len(nums) >= 4:
                c = normalize_coverage_value(nums[0]); m = normalize_coverage_value(nums[1])
                y = normalize_coverage_value(nums[2]); k = normalize_coverage_value(nums[3])
                totals["C"] += c * area_page_cm2
                totals["M"] += m * area_page_cm2
                totals["Y"] += y * area_page_cm2
                totals["K"] += k * area_page_cm2
                if len(nums) > 4:
                    extras = nums[4:]
                    if ln.get("name"):
                        if len(extras) == 1:
                            nm = ln["name"]
                            totals["spots"].setdefault(nm, 0.0)
                            totals["spots"][nm] += normalize_coverage_value(extras[0]) * area_page_cm2
                        else:
                            for si, val in enumerate(extras):
                                nm = (ln["name"] or "Spot") + "_extra" + str(si+1)
                                totals["spots"].setdefault(nm, 0.0)
                                totals["spots"][nm] += normalize_coverage_value(val) * area_page_cm2
                    else:
                        for si, val in enumerate(extras):
                            nm = "Spot_" + str(si+1)
                            totals["spots"].setdefault(nm, 0.0)
                            totals["spots"][nm] += normalize_coverage_value(val) * area_page_cm2
            elif len(nums) == 1:
                nm = ln.get("name") or "Spot_1"
                totals["spots"].setdefault(nm, 0.0)
                totals["spots"][nm] += normalize_coverage_value(nums[0]) * area_page_cm2
    return totals

def main():
    if len(sys.argv) < 2:
        print("ERR:missing_pdf_path")
        sys.exit(1)
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print("ERR:pdf_not_found:" + pdf_path)
        sys.exit(1)
    gs_exec = find_gs_executable()
    if not gs_exec:
        print("ERR:ghostscript_not_found")
        sys.exit(1)
    try:
        p = run_inkcov(gs_exec, pdf_path)
    except Exception as e:
        print("ERR:gs_exec_failed:" + str(e))
        sys.exit(1)
    if p.returncode != 0:
        # imprimir stderr e stdout pra debug
        print("ERR:gs_returncode:" + str(p.returncode))
        if p.stdout:
            print("ERR_STDOUT:" + p.stdout)
        if p.stderr:
            print("ERR_STDERR:" + p.stderr)
        sys.exit(1)
    gs_out = p.stdout
    parsed = parse_inkcov_output(gs_out)
    page_sizes = get_pdf_page_sizes_pts(pdf_path)
    totals = compute_totals(parsed, page_sizes)
    result = {"pdf": os.path.abspath(pdf_path), "areas_cm2": totals}
    try:
        outpath = os.path.join(os.path.dirname(os.path.abspath(pdf_path)), "ink_coverage_out.json")
        with open(outpath, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
    except Exception:
        pass
    # saída marcada para facilitar parsing
    print("OK_JSON:" + json.dumps(result, separators=(",", ":")))

if __name__ == "__main__":
    main()

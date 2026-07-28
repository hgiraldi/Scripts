# AlphaProof - sidecar de OCR nativo (RapidOCR / ONNX, CPU, offline).
# Carrega o modelo UMA vez e fica lendo comandos por stdin (1 JSON por linha):
#   {"id": <n>, "path": "<png>"}   ->  {"id": <n>, "ok": true, "lines": [{t,x,y,w,h,cx,cy,c}, ...]}
# Emite {"ready": true} quando o modelo terminou de carregar. Erros: {"id","ok":false,"error"}.
# Assim o custo de init (alguns segundos) acontece 1x, e cada pagina depois sai em ~2-6s.
import sys, json, os
_DBG = os.environ.get("ALPHA_OCR_DEBUG")
def _dbg(m):
    if _DBG:
        try: sys.stderr.write("[ocr] " + str(m) + "\n"); sys.stderr.flush()
        except Exception: pass

# FORCA UTF-8 no stdin/stdout — senao o Windows usa cp1252 e QUEBRA ao escrever caractere fora
# do cp1252 (ex.: '√' √ lido de um simbolo do rotulo) -> "'charmap' codec can't encode".
try:
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stdin.reconfigure(encoding="utf-8")
except Exception:
    pass

def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def main():
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as e:
        emit({"ready": False, "error": "RapidOCR nao instalado: " + str(e)})
        return
    try:
        ocr = RapidOCR()
    except Exception as e:
        emit({"ready": False, "error": "falha ao carregar modelo: " + str(e)})
        return
    emit({"ready": True})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except Exception:
            continue
        cid = cmd.get("id")
        if cmd.get("quit"):
            break
        path = cmd.get("path")
        _dbg("recebi id=" + str(cid) + " path=" + str(path) + " existe=" + str(os.path.exists(path) if path else None))
        try:
            _dbg("chamando ocr()...")
            res, _ = ocr(path)
            _dbg("ocr() retornou " + str(len(res) if res else 0) + " itens")
            out = []
            if res:
                for box, text, conf in res:
                    xs = [p[0] for p in box]; ys = [p[1] for p in box]
                    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
                    out.append({
                        "t": text, "x": float(x0), "y": float(y0),
                        "w": float(x1 - x0), "h": float(y1 - y0),
                        "cx": float((x0 + x1) / 2), "cy": float((y0 + y1) / 2),
                        "c": float(conf)
                    })
            emit({"id": cid, "ok": True, "lines": out})
        except Exception as e:
            emit({"id": cid, "ok": False, "error": str(e)})

if __name__ == "__main__":
    main()

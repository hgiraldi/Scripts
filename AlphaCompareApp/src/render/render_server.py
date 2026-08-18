# Alpha Compare - sidecar de RENDER NATIVO (pdfium via pypdfium2, BSD).
# Renderiza PDF em ALTA resolução MUITO rápido (o mesmo motor do Precision Proof).
# Protocolo (1 JSON por linha no stdin):
#   {"id":<n>, "pdf":"<path>", "scale":<f>, "rot":<0|90|180|270>, "out":"<raw.bin>",
#    "crop":[x0,y0,x1,y1]  # opcional, em PONTOS da pagina, p/ re-render de regiao (gated)
#   } -> escreve RGB cru (W*H*3) em out e responde {"id","ok":true,"w":W,"h":H}
# Emite {"ready":true} ao subir. Erros: {"id","ok":false,"error"}.
# O custo de init do pdfium acontece 1x; cada render depois sai em ms (arquivo normal).
import sys, json, os, re, ctypes

# MESMO regex das camadas TÉCNICAS do render.js (branco/verniz/faca/registro/cotas...).
TEC = re.compile(r'^(branco|white|verniz|varnish|uv|faca|corte|cut|dieline|vinco|crease|cotas?|medidas?|registro|marcas?|tecnic|sangria|bleed|guias?)', re.I)

def hide_tec(pr, page):
    # esconde objetos cuja camada (mark "Name") casa TEC -> mesmo comportamento do render.js
    try:
        n = pr.FPDFPage_CountObjects(page)
    except Exception:
        return
    buf = (ctypes.c_ushort * 128)()          # pdfium escreve UTF-16LE -> buffer de ushort
    nbytes = ctypes.sizeof(buf)              # 256 bytes
    outlen = ctypes.c_ulong(0)
    for i in range(n):
        obj = pr.FPDFPage_GetObject(page, i)
        try:
            nm = pr.FPDFPageObj_CountMarks(obj)
        except Exception:
            nm = 0
        lyr = ""
        for j in range(nm):
            mk = pr.FPDFPageObj_GetMark(obj, j)
            # nas artes do Illustrator o NOME da camada vem no param "Title" (tag do mark = "Layer")
            if pr.FPDFPageObjMark_GetParamStringValue(mk, b"Title", buf, nbytes, ctypes.byref(outlen)):
                L = outlen.value            # comprimento em BYTES (inclui o \0 final)
                if L > 2:
                    lyr = bytes(buf)[:L].decode("utf-16-le", "ignore").rstrip("\x00")
                    break
        if lyr and TEC.match(lyr):
            try:
                pr.FPDFPageObj_SetIsActive(obj, False)
            except Exception:
                pass

def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()

try:
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stdin.reconfigure(encoding="utf-8")
except Exception:
    pass

def main():
    try:
        import pypdfium2 as pdfium
        import pypdfium2.raw as pr
    except Exception as e:
        emit({"ready": False, "error": "pypdfium2 nao instalado: " + str(e)})
        return
    emit({"ready": True})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        if req.get("quit"):
            break
        rid = req.get("id")
        doc = None
        try:
            doc = pdfium.PdfDocument(req["pdf"])
            pg = doc[int(req.get("page", 0))]
            if req.get("hideTec"):
                hide_tec(pr, pg.raw)
            scale = float(req.get("scale", 1.0))
            rot = int(req.get("rot", 0))
            crop = req.get("crop")   # [x0,y0,x1,y1] em pontos (origem topo-esq)
            kw = {"scale": scale, "rotation": rot}
            if crop and len(crop) == 4:
                # pypdfium2: crop = (left, bottom, right, top) de pontos a CORTAR de cada lado.
                w_pt, h_pt = pg.get_size()
                x0, y0, x1, y1 = [float(v) for v in crop]
                kw["crop"] = (x0, h_pt - y1, w_pt - x1, y0)
            bm = pg.render(**kw)
            a = bm.to_numpy()                 # (H,W,4) BGRA
            rgb = a[:, :, [2, 1, 0]].copy()   # -> RGB contiguo
            with open(req["out"], "wb") as f:
                f.write(rgb.tobytes())
            emit({"id": rid, "ok": True, "w": int(rgb.shape[1]), "h": int(rgb.shape[0])})
        except Exception as e:
            emit({"id": rid, "ok": False, "error": str(e)})
        finally:
            if doc is not None:
                try: doc.close()
                except Exception: pass

if __name__ == "__main__":
    main()

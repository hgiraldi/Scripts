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

def apply_hides(pr, page, hide_tec_flag, hide_layers, hide_images, hide_colors):
    # Aplica os MESMOS hides do painel: TEC (auto, por nome de camada) + o que o operador limpou
    # na tela "Limpar": camadas (hideLayers), imagens (hideImages) e cores (hideColors, tol 6).
    try:
        n = pr.FPDFPage_CountObjects(page)
    except Exception:
        return
    hl = set((x or "").lower() for x in (hide_layers or []))
    hc = hide_colors or []
    need_name = bool(hide_tec_flag) or bool(hl)
    buf = (ctypes.c_ushort * 128)(); nbytes = ctypes.sizeof(buf); outlen = ctypes.c_ulong(0)
    r = ctypes.c_uint(0); g = ctypes.c_uint(0); b = ctypes.c_uint(0); al = ctypes.c_uint(0)
    for i in range(n):
        obj = pr.FPDFPage_GetObject(page, i)
        kill = False
        # 1) camada (OCG): TEC auto OU limpada na mao.
        # O nome da camada vem no param "Name" do mark (mark "OC") - o MESMO param que o
        # pdfrender.js do painel le em objLayer(). "Title" so existe em PDF tagged: aqui
        # nao casava NENHUM objeto, entao nem o TEC nem a limpeza manual pegavam no nativo.
        if need_name:
            try: nm = pr.FPDFPageObj_CountMarks(obj)
            except Exception: nm = 0
            lyr = ""
            for j in range(nm):
                mk = pr.FPDFPageObj_GetMark(obj, j)
                for key in (b"Name", b"Title"):
                    if pr.FPDFPageObjMark_GetParamStringValue(mk, key, buf, nbytes, ctypes.byref(outlen)):
                        L = outlen.value
                        if L > 2:
                            lyr = bytes(buf)[:L].decode("utf-16-le", "ignore").rstrip("\x00")
                            break
                if lyr: break
            if lyr:
                if hide_tec_flag and TEC.match(lyr): kill = True
                elif lyr.lower() in hl: kill = True
        # 2) imagem (foto) limpada
        if not kill and hide_images:
            try:
                if pr.FPDFPageObj_GetType(obj) == 3:   # FPDF_PAGEOBJ_IMAGE
                    kill = True
            except Exception: pass
        # 3) cor de preenchimento limpada (spot z_/x_/w_, branco etc.), com tolerancia 6
        if not kill and hc:
            try:
                if pr.FPDFPageObj_GetFillColor(obj, ctypes.byref(r), ctypes.byref(g), ctypes.byref(b), ctypes.byref(al)):
                    rv, gv, bv = r.value, g.value, b.value
                    for c in hc:
                        if abs(rv - c[0]) <= 6 and abs(gv - c[1]) <= 6 and abs(bv - c[2]) <= 6:
                            kill = True; break
            except Exception: pass
        if kill:
            try: pr.FPDFPageObj_SetIsActive(obj, False)
            except Exception: pass

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
            hL = req.get("hideLayers"); hC = req.get("hideColors"); hI = req.get("hideImages")
            if req.get("hideTec") or hL or hC or hI:
                apply_hides(pr, pg.raw, req.get("hideTec"), hL, hI, hC)
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

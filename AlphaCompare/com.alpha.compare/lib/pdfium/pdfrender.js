/* ============================================================
 * Alpha Compare - motor de render PDF via pdfium (WASM, nativo, rápido).
 * Substitui o pdf.js. Carrega o pdfium.cjs (@embedpdf/pdfium, MIT) pelo Node do
 * CEP e o pdfium.wasm por fs (sem file://). Expõe window.ACPdf.
 *
 *   ACPdf.loadDoc(uint8) -> Promise<handle>
 *   ACPdf.pageCount(handle) / ACPdf.pageSize(handle, idx) -> {w,h} em PONTOS
 *   ACPdf.render(handle, idx, cropNorm|null, sPxPt) -> <canvas>
 *   ACPdf.destroy(handle)
 * cropNorm = {x,y,w,h} 0..1 da página; sPxPt = pixels por ponto (mesma escala p/ os 2).
 * ============================================================ */
(function (root) {
  "use strict";

  var _mod = null, _initing = null;

  // Descarta o módulo pdfium. Necessário porque: (a) um abort() do WASM (estouro de
  // memória) deixa o módulo MORTO pra sempre; (b) o heap linear do WASM NUNCA encolhe.
  // Após reset(), o próximo init() instancia um módulo NOVO com heap zerado. O antigo
  // (e seus ~2GB) é liberado pelo GC do Chromium quando perde a referência.
  function reset() { _mod = null; _initing = null; }

  function extDir() {
    var p = decodeURIComponent(window.location.pathname);   // /C:/.../index.html
    if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
    return require("path").dirname(p);
  }

  function init() {
    if (_mod) return Promise.resolve(_mod);
    if (_initing) return _initing;
    _initing = new Promise(function (resolve, reject) {
      try {
        var dir = extDir() + "/lib/pdfium";
        var wasm = require("fs").readFileSync(dir + "/pdfium.wasm");
        var wasmBinary = new Uint8Array(wasm).buffer;          // ArrayBuffer limpo
        var pdfiumInit = require(dir + "/pdfium.cjs").init;

        // O glue do Emscripten exige Node 16 (só um CHECK; não usa recurso de 16).
        // O CEP tem Node 15.9 -> finge 16 durante o init e restaura depois.
        var pv = (typeof process === "object" && process.versions) ? process.versions : null;
        var origNode = pv ? pv.node : null, faked = false;
        if (pv && origNode && parseInt(origNode, 10) < 16) {
          try { Object.defineProperty(pv, "node", { value: "16.0.0", configurable: true }); faked = true; } catch (e) {}
        }
        function restore() { if (faked) { try { Object.defineProperty(pv, "node", { value: origNode, configurable: true }); } catch (e) {} } }

        pdfiumInit({ wasmBinary: wasmBinary }).then(function (m) {
          restore();
          try { m.PDFiumExt_Init(); } catch (e) {}
          _mod = m; resolve(m);
        }, function (e) { restore(); reject(e); });
      } catch (e) { reject(e); }
    });
    return _initing;
  }

  function malloc(m, n) {
    var w = m.pdfium.wasmExports;
    return (w && w.malloc) ? w.malloc(n) : m.pdfium._malloc(n);
  }
  function mfree(m, p) {
    var w = m.pdfium.wasmExports;
    if (w && w.free) w.free(p); else if (m.pdfium._free) m.pdfium._free(p);
  }

  function loadDoc(bytes) {
    return init().then(function (m) {
      var len = bytes.length, ptr = malloc(m, len);
      m.pdfium.HEAPU8.set(bytes, ptr);                        // copia p/ heap do wasm
      var doc = m.FPDF_LoadMemDocument(ptr, len, "");
      if (!doc) { mfree(m, ptr); throw new Error("PDF inválido ou protegido"); }
      return { doc: doc, dataPtr: ptr, m: m };
    });
  }

  // IMPORTANTE: PDFs de produção têm foto CMYK gigante (arquivos de 200-700MB).
  // O heap do WASM tem teto de 2GB. Se mantivéssemos a página aberta, o pdfium
  // acumularia o cache da imagem decodificada → estoura com 2 docs abertos.
  // Por isso: SEMPRE load+close por chamada. Manipulações (setLayer/setColor)
  // persistem no DOC via FPDFPage_GenerateContent, não pela página aberta.
  // UMA página aberta por doc (cache): a limpeza de camada usa SetIsActive EM MEMÓRIA
  // e o render seguinte precisa ver a MESMA página. Fechar/reabrir obrigava a persistir
  // via GenerateContent — que reescreve o content stream e CORROMPE blend/overprint
  // (arte renderizava em negativo). O doc é transiente (withPdf destrói logo), então
  // segurar 1 página aberta não acumula memória; destroy() a fecha.
  function loadPage(h, idx) {
    if (h._pg && h._pgIdx === idx) return h._pg;
    if (h._pg) { try { h.m.FPDF_ClosePage(h._pg); } catch (e0) {} }
    h._pg = h.m.FPDF_LoadPage(h.doc, idx); h._pgIdx = idx;
    return h._pg;
  }
  function closePage(h, page) { /* página fica aberta no doc (cache); destroy() fecha */ }

  function pageCount(h) { return h.m.FPDF_GetPageCount(h.doc); }

  function pageSize(h, idx) {
    var m = h.m, page = loadPage(h, idx);
    var r = { w: m.FPDF_GetPageWidthF(page), h: m.FPDF_GetPageHeightF(page) };
    closePage(h, page); return r;
  }

  // lê uma string UTF-16LE de um buffer do heap
  function readU16(m, buf, byteLen) {
    var s = "", k;
    for (k = 0; k < byteLen - 1; k += 2) { var c = m.pdfium.HEAPU8[buf + k] | (m.pdfium.HEAPU8[buf + k + 1] << 8); if (c) s += String.fromCharCode(c); }
    return s;
  }
  // nome da LAYER (OCG) de um objeto: marca com param "Name". "" se não tiver.
  function objLayer(m, obj, buf, outP) {
    var nm = m.FPDFPageObj_CountMarks(obj), j;
    for (j = 0; j < nm; j++) {
      var mk = m.FPDFPageObj_GetMark(obj, j);
      if (m.FPDFPageObjMark_GetParamStringValue(mk, "Name", buf, 256, outP)) {
        var L = m.pdfium.HEAPU32[outP >> 2];
        if (L > 1) return readU16(m, buf, L);
      }
    }
    return "";
  }
  // cor de preenchimento RGBA de um objeto -> "r,g,b" ou null
  function objFill(m, obj, rP, gP, bP, aP) {
    if (!m.FPDFPageObj_GetFillColor(obj, rP, gP, bP, aP)) return null;
    return { r: m.pdfium.HEAPU32[rP >> 2], g: m.pdfium.HEAPU32[gP >> 2], b: m.pdfium.HEAPU32[bP >> 2], a: m.pdfium.HEAPU32[aP >> 2] };
  }

  // lê a ESTRUTURA: layers (por nome) e cores/tintas usadas (paleta), com contagem.
  function readStructure(h, idx) {
    var m = h.m, page = loadPage(h, idx), n = m.FPDFPage_CountObjects(page);
    var buf = malloc(m, 256), outP = malloc(m, 4), rP = malloc(m, 4), gP = malloc(m, 4), bP = malloc(m, 4), aP = malloc(m, 4);
    var layers = {}, colors = {}, i;
    var images = 0;
    for (i = 0; i < n; i++) {
      var obj = m.FPDFPage_GetObject(page, i);
      if (m.FPDFPageObj_GetType(obj) === 3) images++;
      var lyr = objLayer(m, obj, buf, outP); if (lyr) layers[lyr] = (layers[lyr] || 0) + 1;
      var fc = objFill(m, obj, rP, gP, bP, aP);
      if (fc && fc.a > 0) { var key = fc.r + "," + fc.g + "," + fc.b; colors[key] = (colors[key] || 0) + 1; }
    }
    mfree(m, buf); mfree(m, outP); mfree(m, rP); mfree(m, gP); mfree(m, bP); mfree(m, aP);
    closePage(h, page);
    var La = [], k; for (k in layers) if (layers.hasOwnProperty(k)) La.push({ name: k, count: layers[k] });
    var Ca = []; for (k in colors) if (colors.hasOwnProperty(k)) { var p = k.split(","); Ca.push({ r: +p[0], g: +p[1], b: +p[2], count: colors[k] }); }
    La.sort(function (a, b) { return b.count - a.count; }); Ca.sort(function (a, b) { return b.count - a.count; });
    return { layers: La, colors: Ca, images: images };
  }

  // liga/desliga os objetos de uma LAYER (por nome). Re-render reflete.
  function setLayerActive(h, idx, name, active) {
    var m = h.m, page = loadPage(h, idx), n = m.FPDFPage_CountObjects(page);
    var buf = malloc(m, 256), outP = malloc(m, 4), i, changed = 0;
    for (i = 0; i < n; i++) {
      var obj = m.FPDFPage_GetObject(page, i);
      if (objLayer(m, obj, buf, outP) === name) { m.FPDFPageObj_SetIsActive(obj, !!active); changed++; }
    }
    mfree(m, buf); mfree(m, outP);
    // SEM GenerateContent: SetIsActive vale em memória (página fica aberta no cache);
    // regenerar o content stream corrompia blend/overprint (render em negativo)
    closePage(h, page);
    return changed;
  }
  // liga/desliga os objetos de uma COR de preenchimento (tolerância tol por canal).
  function setColorActive(h, idx, r, g, b, active, tol) {
    var m = h.m, page = loadPage(h, idx), n = m.FPDFPage_CountObjects(page);
    var rP = malloc(m, 4), gP = malloc(m, 4), bP = malloc(m, 4), aP = malloc(m, 4), i, changed = 0;
    tol = tol || 0;
    for (i = 0; i < n; i++) {
      var obj = m.FPDFPage_GetObject(page, i), fc = objFill(m, obj, rP, gP, bP, aP);
      if (fc && Math.abs(fc.r - r) <= tol && Math.abs(fc.g - g) <= tol && Math.abs(fc.b - b) <= tol) { m.FPDFPageObj_SetIsActive(obj, !!active); changed++; }
    }
    mfree(m, rP); mfree(m, gP); mfree(m, bP); mfree(m, aP);
    // SEM GenerateContent: SetIsActive vale em memória (página fica aberta no cache);
    // regenerar o content stream corrompia blend/overprint (render em negativo)
    closePage(h, page);
    return changed;
  }

  // liga/desliga todos os objetos de IMAGEM (foto) da página. type 3 = imagem.
  function setImagesActive(h, idx, active) {
    var m = h.m, page = loadPage(h, idx), n = m.FPDFPage_CountObjects(page), i, changed = 0;
    for (i = 0; i < n; i++) {
      var obj = m.FPDFPage_GetObject(page, i);
      if (m.FPDFPageObj_GetType(obj) === 3) { m.FPDFPageObj_SetIsActive(obj, !!active); changed++; }
    }
    // SEM GenerateContent: SetIsActive vale em memória (página fica aberta no cache);
    // regenerar o content stream corrompia blend/overprint (render em negativo)
    closePage(h, page);
    return changed;
  }
  // conta objetos de imagem (p/ saber se vale oferecer "ocultar fotos")
  function countImages(h, idx) {
    var m = h.m, page = loadPage(h, idx), n = m.FPDFPage_CountObjects(page), i, c = 0;
    for (i = 0; i < n; i++) if (m.FPDFPageObj_GetType(m.FPDFPage_GetObject(page, i)) === 3) c++;
    closePage(h, page); return c;
  }
  // retângulos das IMAGENS (type 3) em FRAÇÃO da página {x,y,w,h} — p/ a máscara
  // "foto nos 2 lados = silencioso" do compare (regra da conferência).
  function getImageRects(h, idx) {
    var m = h.m, page = loadPage(h, idx), n = m.FPDFPage_CountObjects(page);
    var lP = malloc(m, 4), bP = malloc(m, 4), rP = malloc(m, 4), tP = malloc(m, 4);
    var pw = m.FPDF_GetPageWidthF(page), ph = m.FPDF_GetPageHeightF(page), out = [], i;
    for (i = 0; i < n; i++) {
      var o = m.FPDFPage_GetObject(page, i);
      if (m.FPDFPageObj_GetType(o) !== 3) continue;
      if (!m.FPDFPageObj_GetBounds(o, lP, bP, rP, tP)) continue;
      var F = m.pdfium.HEAPF32, l = F[lP >> 2], b = F[bP >> 2], r = F[rP >> 2], t = F[tP >> 2];
      var x = Math.max(0, l / pw), y = Math.max(0, 1 - t / ph);
      var x1 = Math.min(1, r / pw), y1 = Math.min(1, 1 - b / ph);
      if (x1 > x && y1 > y) out.push({ x: x, y: y, w: x1 - x, h: y1 - y });
    }
    mfree(m, lP); mfree(m, bP); mfree(m, rP); mfree(m, tP);
    closePage(h, page);
    return out;
  }

  // vários crops da MESMA página numa única sessão: abre a página UMA vez ->
  // o pdfium decodifica as fotos gigantes UMA vez (não a cada crop). Fecha no fim.
  // jobs = [{crop:{x,y,w,h 0..1}, s:pxPorPonto}] -> [canvas|null]
  function renderMany(h, idx, jobs) {
    var m = h.m, page = loadPage(h, idx), out = [], j;
    for (j = 0; j < jobs.length; j++) {
      try { out.push(renderOnPage(m, page, jobs[j].crop, jobs[j].s)); }
      catch (e) { out.push(null); }
    }
    closePage(h, page);
    return out;
  }

  // renderiza a página (ou só o crop) num canvas. sPxPt = pixels por ponto.
  function render(h, idx, cropNorm, sPxPt) {
    var m = h.m, page = loadPage(h, idx);
    var cv = renderOnPage(m, page, cropNorm, sPxPt);
    closePage(h, page);
    return cv;
  }
  function renderOnPage(m, page, cropNorm, sPxPt) {
    var pw = m.FPDF_GetPageWidthF(page), ph = m.FPDF_GetPageHeightF(page);
    var c = cropNorm || { x: 0, y: 0, w: 1, h: 1 };
    var outW = Math.max(1, Math.round(c.w * pw * sPxPt));
    var outH = Math.max(1, Math.round(c.h * ph * sPxPt));
    var fullW = Math.max(1, Math.round(pw * sPxPt));
    var fullH = Math.max(1, Math.round(ph * sPxPt));
    var startX = -Math.round(c.x * pw * sPxPt);
    var startY = -Math.round(c.y * ph * sPxPt);

    var bmp = m.FPDFBitmap_Create(outW, outH, 1);             // BGRA
    m.FPDFBitmap_FillRect(bmp, 0, 0, outW, outH, 0xFFFFFFFF); // fundo branco
    m.FPDF_RenderPageBitmap(bmp, page, startX, startY, fullW, fullH, 0, 0);

    var bufPtr = m.FPDFBitmap_GetBuffer(bmp);
    var stride = m.FPDFBitmap_GetStride(bmp);
    var heap = m.pdfium.HEAPU8;
    var cv = document.createElement("canvas"); cv.width = outW; cv.height = outH;
    var ctx = cv.getContext("2d"), img = ctx.createImageData(outW, outH), d = img.data;
    for (var y = 0; y < outH; y++) {
      var srow = bufPtr + y * stride, drow = y * outW * 4;
      for (var x = 0; x < outW; x++) {
        var si = srow + (x << 2), di = drow + (x << 2);
        d[di] = heap[si + 2]; d[di + 1] = heap[si + 1]; d[di + 2] = heap[si]; d[di + 3] = 255; // BGRA->RGBA opaco
      }
    }
    ctx.putImageData(img, 0, 0);
    m.FPDFBitmap_Destroy(bmp);
    return cv;                    // quem fecha a página é o chamador (render/renderMany)
  }

  function destroy(h) {
    if (!h || !h.m) return;
    try {
      if (h._pg) { try { h.m.FPDF_ClosePage(h._pg); } catch (e1) {} h._pg = null; }
      h.m.FPDF_CloseDocument(h.doc); mfree(h.m, h.dataPtr);
    } catch (e) {}
  }

  root.ACPdf = { init: init, reset: reset, loadDoc: loadDoc, pageCount: pageCount, pageSize: pageSize, render: render,
                 renderMany: renderMany, readStructure: readStructure, setLayerActive: setLayerActive, setColorActive: setColorActive,
                 setImagesActive: setImagesActive, countImages: countImages, getImageRects: getImageRects, destroy: destroy };

})(window);

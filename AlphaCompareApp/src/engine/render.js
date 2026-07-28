// AlphaProof - render de PDF via pdfium (WASM em Node) -> RGBA + PNG.
// Abre a pagina 0, esconde camadas tecnicas (branco/verniz/faca/registro) por MARK "Name",
// renderiza a pagina inteira numa escala p/ o lado maior chegar em ~alvoPx.
var fs = require("fs");
var zlib = require("zlib");
var path = require("path");
var DIR = path.join(__dirname, "..", "..", "lib", "pdfium");
var pdfiumInit = require(path.join(DIR, "pdfium.cjs")).init;
var wasmBinary = new Uint8Array(fs.readFileSync(path.join(DIR, "pdfium.wasm"))).buffer;

var TEC = /^(branco|white|verniz|varnish|uv|faca|corte|cut|dieline|vinco|crease|cotas?|medidas?|registro|marcas?|tecnic|sangria|bleed|guias?)/i;

var _m = null;
function ready() {
  if (_m) return Promise.resolve(_m);
  return pdfiumInit({ wasmBinary: wasmBinary }).then(function (m) { m.PDFiumExt_Init(); _m = m; return m; });
}

function mal(m, n) { var w = m.pdfium.wasmExports; return w && w.malloc ? w.malloc(n) : m.pdfium._malloc(n); }
function mfree(m, p) { var w = m.pdfium.wasmExports; if (w && w.free) w.free(p); else if (m.pdfium._free) m.pdfium._free(p); }

function open(m, file) {
  var b = fs.readFileSync(file);
  var p = mal(m, b.length); m.pdfium.HEAPU8.set(b, p);
  var doc = m.FPDF_LoadMemDocument(p, b.length, "");
  if (!doc) { mfree(m, p); throw new Error("PDF invalido: " + file); }
  var pg = m.FPDF_LoadPage(doc, 0);
  return { doc: doc, pg: pg, pw: m.FPDF_GetPageWidthF(pg), ph: m.FPDF_GetPageHeightF(pg), ptr: p };
}
function close(m, h) { if (h.pg) m.FPDF_ClosePage(h.pg); if (h.doc) m.FPDF_CloseDocument(h.doc); if (h.ptr) mfree(m, h.ptr); }

// esconde objetos cuja camada (mark "Name") casa TEC — tira branco/verniz/faca do render
function hideTec(m, h) {
  var page = h.pg, n = m.FPDFPage_CountObjects(page);
  var buf = mal(m, 256), outP = mal(m, 4);
  for (var i = 0; i < n; i++) {
    var obj = m.FPDFPage_GetObject(page, i), nm = m.FPDFPageObj_CountMarks(obj), lyr = "";
    for (var j = 0; j < nm; j++) {
      var mk = m.FPDFPageObj_GetMark(obj, j);
      if (m.FPDFPageObjMark_GetParamStringValue(mk, "Name", buf, 256, outP)) {
        var L = m.pdfium.HEAPU32[outP >> 2];
        if (L > 1) { var t = ""; for (var k = 0; k < L - 1; k += 2) { var cc = m.pdfium.HEAPU8[buf + k] | (m.pdfium.HEAPU8[buf + k + 1] << 8); if (cc) t += String.fromCharCode(cc); } lyr = t; break; }
      }
    }
    if (lyr && TEC.test(lyr)) m.FPDFPageObj_SetIsActive(obj, false);
  }
  mfree(m, buf); mfree(m, outP);
}

// retangulos das IMAGENS (fotos) em fracao da pagina — p/ o modo pixel mascarar depois
function imageRects(m, h) {
  var n = m.FPDFPage_CountObjects(h.pg), lP = mal(m, 4), bP = mal(m, 4), rP = mal(m, 4), tP = mal(m, 4), out = [];
  for (var i = 0; i < n; i++) {
    var o = m.FPDFPage_GetObject(h.pg, i); if (m.FPDFPageObj_GetType(o) !== 3) continue;
    if (!m.FPDFPageObj_GetBounds(o, lP, bP, rP, tP)) continue;
    var F = m.pdfium.HEAPF32, l = F[lP >> 2], b = F[bP >> 2], r = F[rP >> 2], t = F[tP >> 2];
    out.push({ x: Math.max(0, l / h.pw), y: Math.max(0, 1 - t / h.ph), w: Math.min(1, r / h.pw) - Math.max(0, l / h.pw), h: Math.min(1, 1 - b / h.ph) - Math.max(0, 1 - t / h.ph) });
  }
  mfree(m, lP); mfree(m, bP); mfree(m, rP); mfree(m, tP); return out;
}

// renderiza a pagina inteira em escala s (px/pt) -> RGBA
function renderFull(m, h, s) {
  var W = Math.round(h.pw * s), H = Math.round(h.ph * s);
  var bmp = m.FPDFBitmap_Create(W, H, 1);
  m.FPDFBitmap_FillRect(bmp, 0, 0, W, H, 0xFFFFFFFF);
  m.FPDF_RenderPageBitmap(bmp, h.pg, 0, 0, W, H, 0, 0);
  var buf = m.FPDFBitmap_GetBuffer(bmp), st = m.FPDFBitmap_GetStride(bmp), heap = m.pdfium.HEAPU8;
  var out = new Uint8Array(W * H * 4);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    var sro = buf + y * st + x * 4, dst = (y * W + x) * 4;
    out[dst] = heap[sro + 2]; out[dst + 1] = heap[sro + 1]; out[dst + 2] = heap[sro]; out[dst + 3] = heap[sro + 3];
  }
  m.FPDFBitmap_Destroy(bmp);
  return { data: out, width: W, height: H };
}

function rotImg(img, rot) {
  rot = ((rot % 360) + 360) % 360;
  if (!rot) return img;
  var W = img.width, H = img.height, sd = img.data;
  var W2 = (rot === 180) ? W : H, H2 = (rot === 180) ? H : W, out = new Uint8Array(W2 * H2 * 4);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    var si = (y * W + x) * 4, nx, ny;
    if (rot === 90) { nx = H - 1 - y; ny = x; }
    else if (rot === 180) { nx = W - 1 - x; ny = H - 1 - y; }
    else { nx = y; ny = W - 1 - x; }   // 270
    var di = (ny * W2 + nx) * 4;
    out[di] = sd[si]; out[di + 1] = sd[si + 1]; out[di + 2] = sd[si + 2]; out[di + 3] = 255;
  }
  return { data: out, width: W2, height: H2 };
}
function rot90(img) { return rotImg(img, 90); }
// fracao no espaco ROTACIONADO -> fracao no espaco CRU da pagina (inverso de aplicar rot)
function rotFrac(r, rot) {
  rot = ((rot % 360) + 360) % 360;
  if (rot === 90) return { x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w };
  if (rot === 180) return { x: 1 - r.x - r.w, y: 1 - r.y - r.h, w: r.w, h: r.h };
  if (rot === 270) return { x: r.y, y: 1 - r.x - r.w, w: r.h, h: r.w };
  return r;
}
function rotFracInv(r, rot) { rot = ((rot % 360) + 360) % 360; if (rot === 90) return rotFrac(r, 270); if (rot === 270) return rotFrac(r, 90); return rotFrac(r, rot); }

// renderiza SO um crop (fracao da pagina) na escala s (px/pt) -> RGBA
function renderCrop(m, h, fx0, fy0, fx1, fy1, s) {
  var pxX = Math.round(fx0 * h.pw * s), pxY = Math.round(fy0 * h.ph * s);
  var cw = Math.max(1, Math.round((fx1 - fx0) * h.pw * s)), ch = Math.max(1, Math.round((fy1 - fy0) * h.ph * s));
  var fullW = Math.round(h.pw * s), fullH = Math.round(h.ph * s);
  var bmp = m.FPDFBitmap_Create(cw, ch, 1);
  m.FPDFBitmap_FillRect(bmp, 0, 0, cw, ch, 0xFFFFFFFF);
  m.FPDF_RenderPageBitmap(bmp, h.pg, -pxX, -pxY, fullW, fullH, 0, 0);
  var buf = m.FPDFBitmap_GetBuffer(bmp), st = m.FPDFBitmap_GetStride(bmp), heap = m.pdfium.HEAPU8, out = new Uint8Array(cw * ch * 4);
  for (var yy = 0; yy < ch; yy++) for (var xx = 0; xx < cw; xx++) {
    var sro = buf + yy * st + xx * 4, dst = (yy * cw + xx) * 4;
    out[dst] = heap[sro + 2]; out[dst + 1] = heap[sro + 1]; out[dst + 2] = heap[sro]; out[dst + 3] = heap[sro + 3];
  }
  m.FPDFBitmap_Destroy(bmp);
  return { data: out, width: cw, height: ch };
}

// PNG (RGB) encoder
function writePNG(file, rgba) {
  var W = rgba.width, H = rgba.height, d = rgba.data;
  var raw = Buffer.alloc((W * 3 + 1) * H), o = 0, y, x, p;
  for (y = 0; y < H; y++) { raw[o++] = 0; for (x = 0; x < W; x++) { p = (y * W + x) * 4; raw[o++] = d[p]; raw[o++] = d[p + 1]; raw[o++] = d[p + 2]; } }
  function crc32(buf) { var c, n, k, T = crc32._t; if (!T) { T = crc32._t = []; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); T[n] = c >>> 0; } } c = 0xFFFFFFFF; for (n = 0; n < buf.length; n++) c = T[(c ^ buf[n]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function chunk(type, data) { var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); var body = Buffer.concat([Buffer.from(type, "ascii"), data]); var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0); return Buffer.concat([len, body, crc]); }
  var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  var sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  fs.writeFileSync(file, Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]));
}

// API alta: renderiza um PDF (esconde tecnicas, rot opcional) e devolve {img, rects, pw, ph}
function renderPdf(file, opts) {
  opts = opts || {};
  return ready().then(function (m) {
    var h = open(m, file);
    if (opts.hideTec) hideTec(m, h);
    var alvo = opts.alvoPx || 3600;
    var s = Math.min(opts.maxScale || 6, alvo / Math.max(h.pw, h.ph));
    var rects = imageRects(m, h);
    var img = renderFull(m, h, s);
    close(m, h);
    if (opts.rot) img = rotImg(img, opts.rot);
    return { img: img, rects: rects, scale: s };
  });
}

// ---- API orientada a DOC ABERTO (p/ re-leitura de linhas em alta) ----
function openDoc(file, opts) {
  opts = opts || {};
  return ready().then(function (m) {
    var h = open(m, file);
    if (opts.hideTec) hideTec(m, h);
    return { m: m, h: h, rot: (((opts.rot || 0) % 360) + 360) % 360 };
  });
}
function renderFullImg(doc, alvoPx, maxScale) {
  var m = doc.m, h = doc.h;
  var s = Math.min(maxScale || 8, (alvoPx || 3600) / Math.max(h.pw, h.ph));
  var img = renderFull(m, h, s);
  if (doc.rot) img = rotImg(img, doc.rot);
  return { img: img, scale: s, rotW: img.width, rotH: img.height, rects: imageRects(m, h) };
}
// re-le uma LINHA em ALTA. bbox em px do render ROTACIONADO (rotW,rotH). Retorna { img, rect }
// onde rect = a REGIÃO coberta em px do render rotacionado (p/ mapear a sub-linha de volta à página).
function renderLineHi(doc, bbox, rotW, rotH, targetH, margin) {
  var m = doc.m, h = doc.h, mg = margin == null ? 0.35 : margin;
  var mx = bbox.w * 0.04 + 6, my = bbox.h * mg + 4;
  var rx0 = Math.max(0, bbox.x - mx), ry0 = Math.max(0, bbox.y - my);
  var rx1 = Math.min(rotW, bbox.x + bbox.w + mx), ry1 = Math.min(rotH, bbox.y + bbox.h + my);
  var rect = { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 };
  var fr = { x: rx0 / rotW, y: ry0 / rotH, w: (rx1 - rx0) / rotW, h: (ry1 - ry0) / rotH };
  var raw = doc.rot ? rotFracInv(fr, doc.rot) : fr;   // fracao no espaco rotacionado -> cru
  var altPt = (doc.rot === 90 || doc.rot === 270) ? raw.w * h.pw : raw.h * h.ph;
  var s = Math.max(1, Math.min((targetH || 150) / Math.max(1, altPt), 40));
  var outW = raw.w * h.pw * s; if (outW > 2400) s = s * 2400 / outW;
  var img = renderCrop(m, h, raw.x, raw.y, raw.x + raw.w, raw.y + raw.h, s);
  return { img: doc.rot ? rotImg(img, doc.rot) : img, rect: rect };
}
function closeDoc(doc) { try { if (doc && doc.m && doc.h) close(doc.m, doc.h); } catch (e) {} }

module.exports = {
  ready: ready, renderPdf: renderPdf, writePNG: writePNG, rot90: rot90, rotImg: rotImg,
  openDoc: openDoc, renderFullImg: renderFullImg, renderLineHi: renderLineHi, closeDoc: closeDoc
};

/* ============================================================
 * AlphaPack - motor de TRAPPING (roda no painel, ES6 ok)
 * Recebe as regioes vetoriais do JSX, usa Clipper (offset + intersecao)
 * para gerar as tirinhas de trap, e devolve o payload p/ o JSX desenhar.
 *
 * Regra (nucleo do algoritmo, como no PowerTrapper para spots chapados):
 *   - a cor MAIS CLARA (menor densidade) "espalha" na mais escura;
 *   - a tira = intersecao( offset(clara, +trap) , escura );
 *   - fica na regiao escura, com a cor clara, em OVERPRINT;
 *   - nao trapa entre a mesma chapa (mesma spot) nem contra papel (sem tinta).
 *
 * Limites conhecidos (v1, honesto): so vetor chapado; sem sliding/centerline,
 * sem pull-back, sem rich-black keepaway, sem trap de imagem/gradiente.
 * Expoe window.APTrap.compute(regionsPayload, trapMm) -> {payload, tiras, pares}
 * ============================================================ */
(function () {
  "use strict";

  var RS = String.fromCharCode(30);   // \x1e
  var FS = String.fromCharCode(31);   // \x1f
  var SCALE = 10000;                  // pt -> inteiro Clipper
  var MM2PT = 72.0 / 25.4;

  var CL = null;
  function clip() { return CL || (CL = window.ClipperLib); }

  /* ---------- parsing das regioes vindas do JSX ---------- */
  function parseRegions(payload) {
    var regs = [];
    var blocos = payload.split(RS);
    var i;
    for (i = 0; i < blocos.length; i++) {
      if (!blocos[i]) continue;
      var f = blocos[i].split(FS);
      if (f.length < 4) continue;
      var spec = f[2];
      var paths = parseContours(f[3]);
      if (!paths.length) continue;
      regs.push({
        id: f[0],
        dark: parseFloat(f[1]) || 0,
        spec: spec,
        hasInk: specHasInk(spec),
        spot: specSpot(spec),
        paths: paths,
        bbox: bboxOf(paths)
      });
    }
    return regs;
  }

  function parseContours(s) {
    var out = [];
    var conts = s.split(";");
    var i, j;
    for (i = 0; i < conts.length; i++) {
      var pares = conts[i].split(" ");
      var path = [];
      for (j = 0; j < pares.length; j++) {
        if (!pares[j]) continue;
        var xy = pares[j].split(",");
        if (xy.length !== 2) continue;
        path.push({ X: Math.round(parseFloat(xy[0]) * SCALE), Y: Math.round(parseFloat(xy[1]) * SCALE) });
      }
      if (path.length >= 3) out.push(path);
    }
    return out;
  }

  function specHasInk(spec) {
    var p = spec.split("~");
    if (p[0] === "CMYK") return (parseFloat(p[1]) + parseFloat(p[2]) + parseFloat(p[3]) + parseFloat(p[4])) > 0.5;
    if (p[0] === "SPOT") return parseFloat(p[2]) > 0.5;
    return false;
  }
  function specSpot(spec) {
    var p = spec.split("~");
    return (p[0] === "SPOT") ? p[1].toLowerCase() : null;
  }

  function bboxOf(paths) {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    var i, j;
    for (i = 0; i < paths.length; i++) {
      for (j = 0; j < paths[i].length; j++) {
        var pt = paths[i][j];
        if (pt.X < minx) minx = pt.X;
        if (pt.X > maxx) maxx = pt.X;
        if (pt.Y < miny) miny = pt.Y;
        if (pt.Y > maxy) maxy = pt.Y;
      }
    }
    return { minx: minx, miny: miny, maxx: maxx, maxy: maxy };
  }
  function bboxOverlap(a, b, pad) {
    return !(a.maxx + pad < b.minx || b.maxx + pad < a.minx ||
             a.maxy + pad < b.miny || b.maxy + pad < a.miny);
  }

  /* ---------- operacoes Clipper ---------- */
  function offsetPaths(paths, delta) {
    var C = clip();
    var co = new C.ClipperOffset(2, SCALE * 0.02);   // miterLimit, arcTolerance
    co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
    var sol = new C.Paths();
    co.Execute(sol, delta);
    return sol;
  }
  function intersect(subj, clipp) {
    var C = clip();
    var c = new C.Clipper();
    c.AddPaths(subj, C.PolyType.ptSubject, true);
    c.AddPaths(clipp, C.PolyType.ptClip, true);
    var sol = new C.Paths();
    c.Execute(C.ClipType.ctIntersection, sol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    return sol;
  }
  function areaPt2(paths) {
    var C = clip();
    var a = 0, i;
    for (i = 0; i < paths.length; i++) a += C.Clipper.Area(paths[i]);
    return Math.abs(a) / (SCALE * SCALE);
  }

  /* ---------- serializacao p/ o aplicador JSX ---------- */
  function serializeTrap(spec, paths) {
    var conts = [];
    var i, j;
    for (i = 0; i < paths.length; i++) {
      var pts = [];
      for (j = 0; j < paths[i].length; j++) {
        pts.push((paths[i][j].X / SCALE).toFixed(3) + "," + (paths[i][j].Y / SCALE).toFixed(3));
      }
      if (pts.length >= 3) conts.push(pts.join(" "));
    }
    if (!conts.length) return null;
    return spec + FS + conts.join(";");
  }

  /* ---------- nucleo ---------- */
  function compute(regionsPayload, trapMm) {
    if (!window.ClipperLib) throw new Error("ClipperLib nao carregou (lib/clipper.js).");
    var trapPt = (parseFloat(trapMm) || 0.1) * MM2PT;
    var delta = trapPt * SCALE;
    var padBBox = trapPt * SCALE * 1.2;
    var minArea = 0.002;   // pt^2 - descarta ruido numerico

    var regs = parseRegions(regionsPayload);
    var traps = [], pares = 0;
    var i, k;

    /* pre-calcula o offset de cada regiao uma vez (reuso) */
    for (i = 0; i < regs.length; i++) regs[i]._off = null;

    for (i = 0; i < regs.length; i++) {
      for (k = i + 1; k < regs.length; k++) {
        var A = regs[i], B = regs[k];
        if (!bboxOverlap(A.bbox, B.bbox, padBBox)) continue;

        /* mesma chapa (mesma spot) -> sem risco de folga branca */
        if (A.spot && B.spot && A.spot === B.spot) continue;

        /* clara espalha na escura */
        var clara, escura;
        if (A.dark <= B.dark) { clara = A; escura = B; } else { clara = B; escura = A; }
        if (!clara.hasInk) continue;   // papel/sem tinta nao espalha

        pares++;
        if (!clara._off) clara._off = offsetPaths(clara.paths, delta);
        var band = intersect(clara._off, escura.paths);
        if (!band.length) continue;
        if (areaPt2(band) < minArea) continue;

        var s = serializeTrap(clara.spec, band);
        if (s) traps.push(s);
      }
    }

    return { payload: traps.join(RS), tiras: traps.length, pares: pares, regioes: regs.length };
  }

  window.APTrap = { compute: compute };
})();

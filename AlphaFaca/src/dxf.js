// Alpha Faca - parser + medidor de DXF
// Sem ES6 pesado (o projeto e' ExtendScript-first); aqui e' Node/Electron mas mantemos
// o estilo var/for por consistencia com o resto da Alpha.
//
// Saida de parseDxf(text):
// {
//   entities: [ { type, color, layer, length, polylines:[[{x,y}...]], closed } ],
//   layers:   { nome: {color} },
//   colorStats: { "1": {count, length}, ... },   // agrupado por cor RESOLVIDA
//   layerStats: { "CORTE": {count, length}, ... },
//   bbox: {minX,minY,maxX,maxY,w,h},              // so das entidades de geometria
//   insunits: <int|null>                          // dica de unidade ($INSUNITS)
// }

(function () {
  "use strict";

  // ---- tokenizacao: DXF e' par (codigo / valor) em linhas alternadas ----
  function tokenize(text) {
    // aceita \r\n ou \n
    var lines = text.split(/\r\n|\r|\n/);
    var toks = [];
    var i;
    for (i = 0; i + 1 < lines.length; i += 2) {
      var code = parseInt(lines[i], 10);
      if (isNaN(code)) {
        // linha desalinhada: tenta reposicionar avancando 1
        i -= 1;
        continue;
      }
      toks.push({ code: code, value: lines[i + 1] });
    }
    return toks;
  }

  // ---- header: $INSUNITS ----
  function readInsunits(toks) {
    var i;
    for (i = 0; i < toks.length - 2; i++) {
      if (toks[i].code === 9 && toks[i].value.replace(/\s/g, "") === "$INSUNITS") {
        // proximo par 70 e' o valor
        var j;
        for (j = i + 1; j < i + 4 && j < toks.length; j++) {
          if (toks[j].code === 70) return parseInt(toks[j].value, 10);
        }
      }
    }
    return null;
  }

  // ---- tabela de layers: nome -> cor ----
  function readLayers(toks) {
    var layers = {};
    var i = 0;
    // acha inicio da secao TABLES
    while (i < toks.length && !(toks[i].code === 2 && toks[i].value.replace(/\s/g, "") === "LAYER")) i++;
    // percorre registros ate ENDTAB
    var cur = null;
    for (; i < toks.length; i++) {
      var t = toks[i];
      if (t.code === 0 && t.value.replace(/\s/g, "") === "ENDTAB") break;
      if (t.code === 0 && t.value.replace(/\s/g, "") === "LAYER") {
        cur = { name: "", color: 7 };
      } else if (cur) {
        if (t.code === 2) cur.name = t.value.replace(/\s+$/g, "");
        else if (t.code === 62) {
          cur.color = Math.abs(parseInt(t.value, 10)); // negativa = layer off
          layers[cur.name] = { color: cur.color };
        }
      }
    }
    return layers;
  }

  // ---- fatia a secao ENTITIES em blocos por entidade ----
  function sliceEntities(toks) {
    var i = 0;
    // acha "ENTITIES"
    while (i < toks.length && !(toks[i].code === 2 && toks[i].value.replace(/\s/g, "") === "ENTITIES")) i++;
    i++; // pula o proprio ENTITIES
    var out = [];
    var cur = null;
    for (; i < toks.length; i++) {
      var t = toks[i];
      if (t.code === 0) {
        var v = t.value.replace(/\s/g, "");
        if (v === "ENDSEC") { if (cur) out.push(cur); break; }
        if (cur) out.push(cur);
        cur = { type: v, pairs: [] };
      } else if (cur) {
        cur.pairs.push(t);
      }
    }
    return out;
  }

  // pega o 1o valor de um codigo dentro do bloco
  function g(pairs, code) {
    var i;
    for (i = 0; i < pairs.length; i++) if (pairs[i].code === code) return pairs[i].value;
    return null;
  }
  function gn(pairs, code, def) {
    var v = g(pairs, code);
    if (v === null) return def;
    var n = parseFloat(v);
    return isNaN(n) ? def : n;
  }

  // ---- geometria ----
  function dist(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // amostra um arco (centro c, raio r, angulos em graus) numa polilinha
  function sampleArc(cx, cy, r, a0deg, a1deg) {
    var a0 = a0deg * Math.PI / 180, a1 = a1deg * Math.PI / 180;
    if (a1 < a0) a1 += 2 * Math.PI;
    var span = a1 - a0;
    var segs = Math.max(2, Math.ceil(span / (Math.PI / 24))); // ~7.5 graus por segmento
    var pts = [];
    var k;
    for (k = 0; k <= segs; k++) {
      var a = a0 + span * (k / segs);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return { pts: pts, length: r * span };
  }

  // arco por bulge entre p0 e p1 (bulge = tan(theta/4))
  function bulgeArc(p0, p1, bulge) {
    var chord = dist(p0, p1);
    if (chord < 1e-9 || Math.abs(bulge) < 1e-9) return { pts: [p0, p1], length: chord };
    var theta = 4 * Math.atan(Math.abs(bulge));            // angulo incluso
    var radius = chord / (2 * Math.sin(theta / 2));
    var arcLen = radius * theta;
    // amostragem para o preview
    var mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
    var d = radius * Math.cos(theta / 2);                  // dist centro->corda
    var nx = -(p1.y - p0.y) / chord, ny = (p1.x - p0.x) / chord;
    var sign = bulge > 0 ? 1 : -1;
    var cx = mx + sign * d * nx, cy = my + sign * d * ny;
    var a0 = Math.atan2(p0.y - cy, p0.x - cx);
    var a1 = Math.atan2(p1.y - cy, p1.x - cx);
    // garante o sentido correto do bulge
    if (bulge > 0) { if (a1 < a0) a1 += 2 * Math.PI; } else { if (a1 > a0) a1 -= 2 * Math.PI; }
    var span = a1 - a0;
    var segs = Math.max(2, Math.ceil(Math.abs(span) / (Math.PI / 24)));
    var pts = [];
    var k;
    for (k = 0; k <= segs; k++) {
      var a = a0 + span * (k / segs);
      pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    }
    return { pts: pts, length: arcLen };
  }

  // LWPOLYLINE: le vertices na ordem, com bulge (42) associado ao vertice anterior
  function parseLwpolyline(pairs) {
    var verts = [];
    var pendingBulge = 0;
    var cur = null;
    var i;
    for (i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      if (p.code === 10) {
        if (cur) { cur.bulge = pendingBulge; verts.push(cur); pendingBulge = 0; }
        cur = { x: parseFloat(p.value), y: 0, bulge: 0 };
      } else if (p.code === 20 && cur) {
        cur.y = parseFloat(p.value);
      } else if (p.code === 42) {
        pendingBulge = parseFloat(p.value);
      }
    }
    if (cur) { cur.bulge = pendingBulge; verts.push(cur); }
    var flag = parseInt(g(pairs, 70) || "0", 10);
    return { verts: verts, closed: (flag & 1) === 1 };
  }

  function buildPolyline(verts, closed) {
    var pts = [];
    var length = 0;
    var seq = verts.slice();
    if (closed && seq.length > 1) seq.push(seq[0]);
    var i;
    for (i = 0; i < seq.length - 1; i++) {
      var a = seq[i], b = seq[i + 1];
      var seg = bulgeArc({ x: a.x, y: a.y }, { x: b.x, y: b.y }, a.bulge || 0);
      length += seg.length;
      if (i === 0) pts = pts.concat(seg.pts);
      else pts = pts.concat(seg.pts.slice(1));
    }
    return { pts: pts, length: length };
  }

  // ---- entidade -> geometria medida ----
  function measureEntity(ent, layers) {
    var pairs = ent.pairs;
    var res = { type: ent.type, layer: (g(pairs, 8) || "0").replace(/\s+$/g, ""), polylines: [], length: 0, closed: false };

    // cor resolvida (62; se BYLAYER/256 ou BYBLOCK/0 ou ausente -> cor do layer)
    var c = g(pairs, 62);
    var color;
    if (c === null) color = layerColor(layers, res.layer);
    else {
      color = parseInt(c, 10);
      if (color === 256 || color === 0) color = layerColor(layers, res.layer);
    }
    res.color = color;

    if (ent.type === "LINE") {
      var a = { x: gn(pairs, 10, 0), y: gn(pairs, 20, 0) };
      var b = { x: gn(pairs, 11, 0), y: gn(pairs, 21, 0) };
      res.polylines.push([a, b]);
      res.length = dist(a, b);
    } else if (ent.type === "ARC") {
      var cx = gn(pairs, 10, 0), cy = gn(pairs, 20, 0), r = gn(pairs, 40, 0);
      var s = sampleArc(cx, cy, r, gn(pairs, 50, 0), gn(pairs, 51, 0));
      res.polylines.push(s.pts);
      res.length = s.length;
    } else if (ent.type === "CIRCLE") {
      var ccx = gn(pairs, 10, 0), ccy = gn(pairs, 20, 0), cr = gn(pairs, 40, 0);
      var circ = sampleArc(ccx, ccy, cr, 0, 360);
      res.polylines.push(circ.pts);
      res.length = 2 * Math.PI * cr;
      res.closed = true;
    } else if (ent.type === "LWPOLYLINE") {
      var lw = parseLwpolyline(pairs);
      var b1 = buildPolyline(lw.verts, lw.closed);
      res.polylines.push(b1.pts);
      res.length = b1.length;
      res.closed = lw.closed;
    } else {
      // tipos nao geometricos (MTEXT, TEXT, DIMENSION, INSERT...) -> sem comprimento
      res.length = 0;
    }
    return res;
  }

  function layerColor(layers, name) {
    if (layers[name] && typeof layers[name].color === "number") return layers[name].color;
    return 7;
  }

  // POLYLINE antigo: vertices vem como entidades VERTEX seguintes ate SEQEND.
  // Reprocessa a lista fatiada juntando esses casos.
  function foldPolylines(blocks) {
    var out = [];
    var i = 0;
    while (i < blocks.length) {
      var b = blocks[i];
      if (b.type === "POLYLINE") {
        var flag = parseInt(g(b.pairs, 70) || "0", 10);
        var closed = (flag & 1) === 1;
        var layer = (g(b.pairs, 8) || "0");
        var colorRaw = g(b.pairs, 62);
        var verts = [];
        i++;
        while (i < blocks.length && blocks[i].type === "VERTEX") {
          var vp = blocks[i].pairs;
          verts.push({ x: gn(vp, 10, 0), y: gn(vp, 20, 0), bulge: gn(vp, 42, 0) });
          i++;
        }
        if (i < blocks.length && blocks[i].type === "SEQEND") i++;
        // monta um pseudo-bloco LWPOLYLINE-like
        var pairs = [{ code: 8, value: layer }];
        if (colorRaw !== null) pairs.push({ code: 62, value: colorRaw });
        out.push({ type: "LWPOLYLINE", pairs: pairs, _verts: verts, _closed: closed });
      } else {
        out.push(b);
        i++;
      }
    }
    return out;
  }

  function parseDxf(text) {
    var toks = tokenize(text);
    var layers = readLayers(toks);
    var insunits = readInsunits(toks);
    var blocks = foldPolylines(sliceEntities(toks));

    var entities = [];
    var colorStats = {};
    var layerStats = {};
    var bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    var i, j, k;

    for (i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var m;
      if (b._verts) {
        var built = buildPolyline(b._verts, b._closed);
        m = {
          type: "LWPOLYLINE",
          layer: (g(b.pairs, 8) || "0").replace(/\s+$/g, ""),
          polylines: [built.pts],
          length: built.length,
          closed: b._closed
        };
        var cc = g(b.pairs, 62);
        m.color = (cc === null) ? layerColor(layers, m.layer)
          : ((parseInt(cc, 10) === 256 || parseInt(cc, 10) === 0) ? layerColor(layers, m.layer) : parseInt(cc, 10));
      } else {
        m = measureEntity(b, layers);
      }
      entities.push(m);

      // stats
      var key = String(m.color);
      if (!colorStats[key]) colorStats[key] = { count: 0, length: 0 };
      colorStats[key].count++;
      colorStats[key].length += m.length;

      if (!layerStats[m.layer]) layerStats[m.layer] = { count: 0, length: 0 };
      layerStats[m.layer].count++;
      layerStats[m.layer].length += m.length;

      // bbox so de quem tem geometria
      if (m.length > 0) {
        for (j = 0; j < m.polylines.length; j++) {
          for (k = 0; k < m.polylines[j].length; k++) {
            var pt = m.polylines[j][k];
            if (pt.x < bbox.minX) bbox.minX = pt.x;
            if (pt.y < bbox.minY) bbox.minY = pt.y;
            if (pt.x > bbox.maxX) bbox.maxX = pt.x;
            if (pt.y > bbox.maxY) bbox.maxY = pt.y;
          }
        }
      }
    }

    if (!isFinite(bbox.minX)) bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    bbox.w = bbox.maxX - bbox.minX;
    bbox.h = bbox.maxY - bbox.minY;

    return {
      entities: entities,
      layers: layers,
      colorStats: colorStats,
      layerStats: layerStats,
      bbox: bbox,
      insunits: insunits
    };
  }

  module.exports = { parseDxf: parseDxf };
})();

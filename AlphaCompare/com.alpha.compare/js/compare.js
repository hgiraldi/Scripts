/* ============================================================
 * Alpha Compare - engine de comparacao visual (v4, registro por feicao)
 * Roda no Chromium do CEP. Sem dependencias externas.
 *
 * Chave (validado com PDFs reais): comparar PDF x PDF renderizados na MESMA
 * escala px/pt (opts.prescaled) -> mesma arte = mesmo tamanho em pixels, NITIDO
 * (sem reamostrar). Ai o registro e so TRANSLACAO:
 *   coarse por SAD de cinza (autoAlign) + refino por CORRELACAO DE BORDAS.
 * Depois o original e deslocado UMA vez (fica alinhado) e a diferenca usa
 * tolerancia de posicao (slack) + filtro de forma (mata hairline de borda).
 * Caminho nao-prescaled (imagem/captura): encaixa recorte-no-recorte (fit).
 * ============================================================ */
(function (root) {
  "use strict";

  var MAX_WORK = 3400;   // resolucao alta: alinha melhor (menos sub-pixel) -> so os reais
  var CORR_SIDE = 150;
  var BORDER = 4;

  function drawOnWhite(src, W, H) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H); g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, W, H);
    return g.getImageData(0, 0, W, H);
  }
  function drawSizedOnWhite(src, W, H, dw, dh) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H); g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, dw, dh);
    return g.getImageData(0, 0, W, H);
  }

  function toGray(img) {
    var d = img.data, n = img.width * img.height, g = new Float32Array(n), j = 0;
    for (var i = 0; i < n; i++) { g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114; j += 4; }
    return g;
  }
  function edgeMap(g, W, H) {   // range 3x3 (max-min) = magnitude de borda
    var e = new Float32Array(W * H);
    for (var y = 1; y < H - 1; y++) {
      for (var x = 1; x < W - 1; x++) {
        var i = y * W + x, mn = g[i], mx = g[i];
        for (var dy = -1; dy <= 1; dy++) { var r = (y + dy) * W + x; for (var dx = -1; dx <= 1; dx++) { var v = g[r + dx]; if (v < mn) mn = v; if (v > mx) mx = v; } }
        e[i] = mx - mn;
      }
    }
    return e;
  }

  function downGray(gray, W, H, sw, sh) {
    var out = new Float32Array(sw * sh), fx = W / sw, fy = H / sh;
    for (var y = 0; y < sh; y++) {
      var y0 = (y * fy) | 0, y1 = ((y + 1) * fy) | 0; if (y1 <= y0) y1 = y0 + 1;
      for (var x = 0; x < sw; x++) {
        var x0 = (x * fx) | 0, x1 = ((x + 1) * fx) | 0; if (x1 <= x0) x1 = x0 + 1;
        var s = 0, c = 0;
        for (var yy = y0; yy < y1; yy++) { var row = yy * W; for (var xx = x0; xx < x1; xx++) { s += gray[row + xx]; c++; } }
        out[y * sw + x] = s / c;
      }
    }
    return out;
  }

  function downTo(gray, W, H, side) {
    var sw = Math.max(8, Math.round(W / Math.max(W, H) * side));
    var sh = Math.max(8, Math.round(H / Math.max(W, H) * side));
    return { a: downGray(gray, W, H, sw, sh), sw: sw, sh: sh };
  }
  function corrAt(a, b, sw, sh, ox, oy) {   // correlacao (produto) de bordas
    var s = 0, n = 0;
    for (var y = 0; y < sh; y++) {
      var sy = y - oy; if (sy < 0 || sy >= sh) continue;
      var ar = y * sw, br = sy * sw;
      for (var x = 0; x < sw; x++) { var sx = x - ox; if (sx < 0 || sx >= sw) continue; s += a[ar + x] * b[br + sx]; n++; }
    }
    if (n < sw * sh * 0.15) return -1;
    return s;
  }
  // correlacao NORMALIZADA (NCC): necessaria p/ comparar warps (rot/escala mudam a
  // energia de borda; a soma bruta premiaria sempre o 0° sem warp).
  function corrNorm(a, b, sw, sh, ox, oy) {
    var s = 0, sa = 0, sb = 0, n = 0;
    for (var y = 0; y < sh; y++) {
      var sy = y - oy; if (sy < 0 || sy >= sh) continue;
      var ar = y * sw, br = sy * sw;
      for (var x = 0; x < sw; x++) { var sx = x - ox; if (sx < 0 || sx >= sw) continue; var va = a[ar + x], vb = b[br + sx]; s += va * vb; sa += va * va; sb += vb * vb; n++; }
    }
    if (n < sw * sh * 0.15) return -1;
    var den = Math.sqrt(sa * sb); return den > 0 ? s / den : -1;
  }
  // alinhamento global (piramide) por BORDAS: branco vira 0, so o conteudo conta ->
  // acha offset grande (artboard afastado) sem se enganar com a margem branca.
  function autoAlign(fileGray, origGray, W, H) {
    var l1 = downTo(fileGray, W, H, 64), o1 = downTo(origGray, W, H, 64);
    var sw = l1.sw, sh = l1.sh, f = edgeMap(l1.a, sw, sh), o = edgeMap(o1.a, sw, sh);
    var best = -1, bx = 0, by = 0, oy, ox, c;
    for (oy = -(sh - 2); oy <= sh - 2; oy++) for (ox = -(sw - 2); ox <= sw - 2; ox++) { c = corrAt(f, o, sw, sh, ox, oy); if (c > best) { best = c; bx = ox; by = oy; } }
    var l1x = bx * W / sw, l1y = by * H / sh;

    var l2 = downTo(fileGray, W, H, 180), o2 = downTo(origGray, W, H, 180);
    var sw2 = l2.sw, sh2 = l2.sh, f2 = edgeMap(l2.a, sw2, sh2), o2e = edgeMap(o2.a, sw2, sh2);
    var cx = Math.round(l1x * sw2 / W), cy = Math.round(l1y * sh2 / H);
    var win = Math.max(4, Math.round(sw2 / 64) + 3);
    best = -1; var b2x = cx, b2y = cy, sum = 0, cnt = 0;
    for (oy = cy - win; oy <= cy + win; oy++) for (ox = cx - win; ox <= cx + win; ox++) { c = corrAt(f2, o2e, sw2, sh2, ox, oy); if (c >= 0) { sum += c; cnt++; } if (c > best) { best = c; b2x = ox; b2y = oy; } }
    var mean = cnt ? sum / cnt : best;
    var conf = best > 0 ? Math.max(0, Math.min(1, (best - mean) / best * 2)) : 0;
    return { ox: Math.round(b2x * W / sw2), oy: Math.round(b2y * H / sh2), conf: conf };
  }

  function fineAlign(fileGray, origGray, W, H, cx, cy) {   // refino SAD (nao-prescaled)
    var range = Math.max(4, Math.ceil(Math.max(W, H) / CORR_SIDE) + 3);
    var step = Math.max(2, Math.round(Math.max(W, H) / 400));
    var best = 1e18, bx = cx, by = cy, need = (W * H / (step * step)) * 0.4;
    for (var oy = cy - range; oy <= cy + range; oy++) {
      for (var ox = cx - range; ox <= cx + range; ox++) {
        var sad = 0, n = 0;
        for (var y = 0; y < H; y += step) {
          var sy = y - oy; if (sy < 0 || sy >= H) continue;
          var fr = y * W, or = sy * W;
          for (var x = 0; x < W; x += step) { var sx = x - ox; if (sx < 0 || sx >= W) continue; var dv = fileGray[fr + x] - origGray[or + sx]; sad += dv < 0 ? -dv : dv; n++; }
        }
        if (n < need) continue;
        var m = sad / n; if (m < best) { best = m; bx = ox; by = oy; }
      }
    }
    return { ox: bx, oy: by };
  }

  function fineEdgeAlign(eF, eO, W, H, cx, cy) {   // refino por CORRELACAO de bordas (prescaled)
    // O coarse (thumb 180) tem célula de ~W/180 px -> pode errar ~2 células (~38px em
    // tela 3400). Janela pequena aqui TRAVAVA no erro do coarse (caso Coca real: coarse
    // 646, certo 612, janela ±12 nunca via o 612 -> rótulo inteiro virava falso diff).
    // Estágio 1: janela larga que cobre o erro do coarse, varrendo de 3 em 3 (o pico do
    // produto de bordas é largo, não escapa). Estágio 2: passo 1 em volta do melhor.
    var step = Math.max(2, Math.round(Math.max(W, H) / 700));
    function sweep(cx0, cy0, rng, hop) {
      var best = -1, bx = cx0, by = cy0;
      for (var oy = cy0 - rng; oy <= cy0 + rng; oy += hop) {
        for (var ox = cx0 - rng; ox <= cx0 + rng; ox += hop) {
          var s = 0;
          for (var y = 0; y < H; y += step) {
            var sy = y - oy; if (sy < 0 || sy >= H) continue;
            var fr = y * W, or = sy * W;
            for (var x = 0; x < W; x += step) { var sx = x - ox; if (sx < 0 || sx >= W) continue; s += eF[fr + x] * eO[or + sx]; }
          }
          if (s > best) { best = s; bx = ox; by = oy; }
        }
      }
      return { ox: bx, oy: by };
    }
    var rng1 = Math.max(24, Math.round(Math.max(W, H) / 180) * 2 + 4);
    var c1 = sweep(cx, cy, rng1, 3);
    return sweep(c1.ox, c1.oy, 4, 1);
  }

  // desloca o original por (ox,oy) -> fica alinhado ao arquivo. Marca 'valid'.
  // srcValid (opcional): máscara de validade do original (ex.: cantos que o warp
  // girou p/ fora) -> pixel inválido vira branco/invalid (não conta como diferença).
  function shiftRGB(img, ox, oy, W, H, srcValid) {
    var out = new ImageData(W, H), valid = new Uint8Array(W * H), s = img.data, d = out.data;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var sx = x - ox, sy = y - oy, di = (y * W + x) * 4, sidx = sy * W + sx;
        if (sx >= 0 && sx < W && sy >= 0 && sy < H && (!srcValid || srcValid[sidx])) {
          var si = sidx * 4;
          d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = 255;
          valid[y * W + x] = 1;
        } else { d[di] = 255; d[di + 1] = 255; d[di + 2] = 255; d[di + 3] = 255; }
      }
    }
    return { img: out, valid: valid };
  }

  // ===== REGISTRO por ROTACAO + ESCALA (estilo GlobalVision) =====
  // warp de cinza: gira `ang` (rad) e escala `sc` em torno de (cx,cy). Bilinear, branco fora.
  function warpGrayF(src, W, H, ang, sc, cx, cy) {
    var out = new Float32Array(W * H), ca = Math.cos(ang) / sc, sa = Math.sin(ang) / sc, x, y;
    for (y = 0; y < H; y++) {
      var dy = y - cy, row = y * W;
      for (x = 0; x < W; x++) {
        var dx = x - cx, sx = cx + ca * dx + sa * dy, sy = cy - sa * dx + ca * dy;
        if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) { out[row + x] = 255; continue; }
        var x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, i = y0 * W + x0;
        out[row + x] = src[i] * (1 - fx) * (1 - fy) + src[i + 1] * fx * (1 - fy) + src[i + W] * (1 - fx) * fy + src[i + W + 1] * fx * fy;
      }
    }
    return out;
  }
  // warp de RGBA (ImageData): idem, branco fora, marca 'valid' (pixel que veio de dentro).
  function warpRGB(img, W, H, ang, sc, cx, cy) {
    var out = new ImageData(W, H), valid = new Uint8Array(W * H), s = img.data, d = out.data;
    var ca = Math.cos(ang) / sc, sa = Math.sin(ang) / sc, x, y;
    for (y = 0; y < H; y++) {
      var dy = y - cy;
      for (x = 0; x < W; x++) {
        var dx = x - cx, sx = cx + ca * dx + sa * dy, sy = cy - sa * dx + ca * dy, di = (y * W + x) * 4;
        if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) { d[di] = 255; d[di + 1] = 255; d[di + 2] = 255; d[di + 3] = 255; continue; }
        var x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, i = (y0 * W + x0) * 4, i2 = i + W * 4;
        var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        d[di] = s[i] * w00 + s[i + 4] * w10 + s[i2] * w01 + s[i2 + 4] * w11;
        d[di + 1] = s[i + 1] * w00 + s[i + 5] * w10 + s[i2 + 1] * w01 + s[i2 + 5] * w11;
        d[di + 2] = s[i + 2] * w00 + s[i + 6] * w10 + s[i2 + 2] * w01 + s[i2 + 6] * w11;
        d[di + 3] = 255; valid[y * W + x] = 1;
      }
    }
    return { img: out, valid: valid };
  }
  // busca coarse de (angulo, escala) que melhora a correlacao de bordas, ao redor da
  // translacao (ox0,oy0) ja achada. Retorna o melhor + 'gain' vs (0°,1x) p/ decidir se vale warpar.
  function searchRotScale(fileGray, origGray, W, H, ox0, oy0) {
    var side = 110, df = downTo(fileGray, W, H, side), doo = downTo(origGray, W, H, side);
    var sw = df.sw, sh = df.sh, cxs = sw / 2, cys = sh / 2, eF = edgeMap(df.a, sw, sh);
    var ANG = [-2, -1.5, -1, -0.6, -0.3, 0, 0.3, 0.6, 1, 1.5, 2], SCL = [0.99, 0.995, 1, 1.005, 1.01];
    var tox = Math.round(ox0 * sw / W), toy = Math.round(oy0 * sh / H), win = Math.max(6, Math.round(sw / 12));
    var base = -1, best = -1, bAng = 0, bScl = 1, bx = tox, by = toy, ai, si, oy, ox;
    for (ai = 0; ai < ANG.length; ai++) for (si = 0; si < SCL.length; si++) {
      var wg = warpGrayF(doo.a, sw, sh, ANG[ai] * Math.PI / 180, SCL[si], cxs, cys), eO = edgeMap(wg, sw, sh);
      var lb = -1, lx = tox, ly = toy;
      for (oy = toy - win; oy <= toy + win; oy++) for (ox = tox - win; ox <= tox + win; ox++) { var c = corrNorm(eF, eO, sw, sh, ox, oy); if (c > lb) { lb = c; lx = ox; ly = oy; } }
      if (ANG[ai] === 0 && SCL[si] === 1) base = lb;
      if (lb > best) { best = lb; bAng = ANG[ai]; bScl = SCL[si]; bx = lx; by = ly; }
    }
    return { ang: bAng, scl: bScl, ox: Math.round(bx * W / sw), oy: Math.round(by * H / sh), gain: base > 0 ? (best - base) / base : 0 };
  }

  // erosao booleana 3x3 (min): sobrevive só o INTERIOR de faixas largas (>=3px).
  // Usada p/ separar borda de GRADIENTE (rampa larga, re-tom) de borda de arte (fina).
  function erodeBool(src, W, H) {
    var out = new Uint8Array(W * H), x, y;
    for (y = 1; y < H - 1; y++) {
      var r0 = (y - 1) * W, r1 = y * W, r2 = (y + 1) * W;
      for (x = 1; x < W - 1; x++) {
        if (src[r1 + x] &&
            src[r0 + x - 1] && src[r0 + x] && src[r0 + x + 1] &&
            src[r1 + x - 1] && src[r1 + x + 1] &&
            src[r2 + x - 1] && src[r2 + x] && src[r2 + x + 1]) out[r1 + x] = 1;
      }
    }
    return out;
  }

  // dilatacao booleana separavel (max horizontal depois vertical), raio r.
  // usada no modo FORMA p/ tolerar o trapping/spread (borda que engordou alguns px).
  function dilateBool(src, W, H, r) {
    if (r <= 0) return src;
    var tmp = new Uint8Array(W * H), out = new Uint8Array(W * H), x, y, k;
    for (y = 0; y < H; y++) {
      var row = y * W;
      for (x = 0; x < W; x++) {
        var x0 = x - r < 0 ? 0 : x - r, x1 = x + r >= W ? W - 1 : x + r, v = 0;
        for (k = x0; k <= x1; k++) { if (src[row + k]) { v = 1; break; } }
        tmp[row + x] = v;
      }
    }
    for (x = 0; x < W; x++) {
      for (y = 0; y < H; y++) {
        var y0 = y - r < 0 ? 0 : y - r, y1 = y + r >= H ? H - 1 : y + r, v2 = 0;
        for (k = y0; k <= y1; k++) { if (tmp[k * W + x]) { v2 = 1; break; } }
        out[y * W + x] = v2;
      }
    }
    return out;
  }

  function labelBlobs(mask, W, H, minArea) {
    var lab = new Int32Array(W * H), comps = [], stack = new Int32Array(W * H), id = 0;
    for (var i = 0; i < W * H; i++) {
      if (!mask[i] || lab[i]) continue;
      id++; var sp = 0; stack[sp++] = i; lab[i] = id;
      var minx = W, miny = H, maxx = 0, maxy = 0, area = 0;
      while (sp > 0) {
        var p = stack[--sp], py = (p / W) | 0, px = p - py * W;
        area++;
        if (px < minx) minx = px; if (px > maxx) maxx = px;
        if (py < miny) miny = py; if (py > maxy) maxy = py;
        for (var dy = -1; dy <= 1; dy++) {
          var ny = py + dy; if (ny < 0 || ny >= H) continue;
          for (var dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            var nx = px + dx; if (nx < 0 || nx >= W) continue;
            var q = ny * W + nx; if (mask[q] && !lab[q]) { lab[q] = id; stack[sp++] = q; }
          }
        }
      }
      if (area < minArea) continue;
      comps.push({ id: id, area: area, x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, cx: (minx + maxx) >> 1, cy: (miny + maxy) >> 1 });
    }
    return { lab: lab, comps: comps };
  }

  // direcao (original ja alinhado): contraste local (std) + cor do fundo
  function classifyComp(c, fileImg, origImg, fileGray, origGray, W, H, tol) {
    var pad = 2;
    var x0 = Math.max(0, c.x - pad), y0 = Math.max(0, c.y - pad);
    var x1 = Math.min(W, c.x + c.w + pad), y1 = Math.min(H, c.y + c.h + pad);
    var sfS = 0, sfS2 = 0, soS = 0, soS2 = 0, cnt = 0;
    var bf0 = 0, bf1 = 0, bf2 = 0, bo0 = 0, bo1 = 0, bo2 = 0, bn = 0, strSum = 0;
    var rf0 = 0, rf1 = 0, rf2 = 0, ro0 = 0, ro1 = 0, ro2 = 0, rn = 0;
    var fd = fileImg.data, od = origImg.data;
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var i = y * W + x, p = i * 4;
        var gf = fileGray[i], go = origGray[i];
        sfS += gf; sfS2 += gf * gf; soS += go; soS2 += go * go; cnt++;
        var a = fd[p] - od[p]; if (a < 0) a = -a;
        var b = fd[p + 1] - od[p + 1]; if (b < 0) b = -b;
        var cc = fd[p + 2] - od[p + 2]; if (cc < 0) cc = -cc;
        var dmax = a > b ? (a > cc ? a : cc) : (b > cc ? b : cc);
        if (dmax > tol) { bf0 += fd[p]; bf1 += fd[p + 1]; bf2 += fd[p + 2]; bo0 += od[p]; bo1 += od[p + 1]; bo2 += od[p + 2]; bn++; strSum += dmax; }
        else { rf0 += fd[p]; rf1 += fd[p + 1]; rf2 += fd[p + 2]; ro0 += od[p]; ro1 += od[p + 1]; ro2 += od[p + 2]; rn++; }
      }
    }
    c.strength = bn > 0 ? strSum / bn : 0;   // FORÇA = média da diferença de cor (real=alto, ruído sub-pixel=baixo)
    if (cnt < 2) return "diff";
    var stdF = Math.sqrt(Math.max(0, sfS2 / cnt - (sfS / cnt) * (sfS / cnt)));
    var stdO = Math.sqrt(Math.max(0, soS2 / cnt - (soS / cnt) * (soS / cnt)));
    if (stdO > stdF + 8) return "miss";
    if (stdF > stdO + 8) return "extra";
    if (bn > 0 && rn > 0) {
      function mch(a0, a1, a2, b0, b1, b2) { var d0 = Math.abs(a0 - b0), d1 = Math.abs(a1 - b1), d2 = Math.abs(a2 - b2); return d0 > d1 ? (d0 > d2 ? d0 : d2) : (d1 > d2 ? d1 : d2); }
      var fD = mch(bf0 / bn, bf1 / bn, bf2 / bn, rf0 / rn, rf1 / rn, rf2 / rn);
      var oD = mch(bo0 / bn, bo1 / bn, bo2 / bn, ro0 / rn, ro1 / rn, ro2 / rn);
      if (oD > fD + 12) return "miss";
      if (fD > oD + 12) return "extra";
    }
    return "diff";
  }

  function buildOverlay(fileImg, lab, comps, W, H) {
    var typeOf = {};
    for (var c = 0; c < comps.length; c++) {
      var cc = comps[c];
      if (cc.ids) { for (var q = 0; q < cc.ids.length; q++) typeOf[cc.ids[q]] = cc.type; }  // bloco fundido: pinta todos os membros
      else typeOf[cc.id] = cc.type;
    }
    // ERRO (faltando/diferente) = VERMELHO; A MAIS (sobrando, ex.: código de barras) = AZUL
    var COL = { miss: [220, 38, 38], extra: [37, 99, 235], diff: [220, 38, 38], ok: [34, 165, 91] };
    var out = new ImageData(W, H), s = fileImg.data, d = out.data;
    for (var i = 0, j = 0; i < W * H; i++, j += 4) {
      var lg = (s[j] * 0.299 + s[j + 1] * 0.587 + s[j + 2] * 0.114), g = (lg * 0.45 + 255 * 0.55) | 0;
      var id = lab[i], t = id ? typeOf[id] : 0;
      if (t) { var col = COL[t]; d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255; }
      else { d[j] = g; d[j + 1] = g; d[j + 2] = g; d[j + 3] = 255; }
    }
    // itens especiais (texto/barcode) não têm pixels no lab -> desenha MOLDURA colorida
    var th = Math.max(2, Math.round(Math.max(W, H) / 500));
    function frame(cc, col) {
      var x0 = Math.max(0, cc.x - th), y0 = Math.max(0, cc.y - th);
      var x1 = Math.min(W, cc.x + cc.w + th), y1 = Math.min(H, cc.y + cc.h + th);
      for (var yy = y0; yy < y1; yy++) {
        for (var xx = x0; xx < x1; xx++) {
          var inX = xx >= cc.x + th && xx < cc.x + cc.w - th;
          var inY = yy >= cc.y + th && yy < cc.y + cc.h - th;
          if (inX && inY) continue;   // só a borda
          var p = (yy * W + xx) * 4;
          d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
        }
      }
    }
    for (var c2 = 0; c2 < comps.length; c2++) {
      // moldura na COR do tipo: texto trocado -> vermelho (erro); barcode a mais -> azul
      if (comps[c2].kind) frame(comps[c2], COL[comps[c2].type] || [220, 38, 38]);
    }
    return out;
  }

  // faixa que atravessa quase toda a largura/altura = sangria/borda do crop (não conteúdo).
  // Bloco real nunca é uma tira conexa cobrindo >=70% de um eixo.
  function isBand(c, W, H) {
    return (c.w >= 0.70 * W && c.h <= 0.30 * H) ||
           (c.h >= 0.70 * H && c.w <= 0.30 * W);
  }

  // dois blocos "vizinhos": a folga entre as caixas e <= g nos DOIS eixos.
  function boxesNear(a, b, g) {
    var ax2 = a.x + a.w, ay2 = a.y + a.h, bx2 = b.x + b.w, by2 = b.y + b.h;
    var gapX = (a.x > bx2) ? (a.x - bx2) : (b.x > ax2 ? b.x - ax2 : 0);
    var gapY = (a.y > by2) ? (a.y - by2) : (b.y > ay2 ? b.y - ay2 : 0);
    return gapX <= g && gapY <= g;
  }

  // funde blocos proximos num so (union-find). Fragmentos de UM mesmo caractere
  // alterado (9->6, acento, pingo do i) viram UMA marca. Cada bloco fundido guarda
  // .ids[] (membros originais) p/ o overlay pintar todos os pixels.
  function mergeNearby(comps, W, H, g) {
    var n = comps.length, i, j;
    if (n < 2 || g <= 0) {
      for (i = 0; i < n; i++) if (!comps[i].ids) comps[i].ids = [comps[i].id];
      return comps;
    }
    var parent = [];
    for (i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function uni(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (boxesNear(comps[i], comps[j], g)) uni(i, j);

    var groups = {}, r, key;
    for (i = 0; i < n; i++) { r = find(i); if (!groups[r]) groups[r] = []; groups[r].push(comps[i]); }

    var out = [];
    for (key in groups) {
      if (!groups.hasOwnProperty(key)) continue;
      var gp = groups[key];
      if (gp.length === 1) { if (!gp[0].ids) gp[0].ids = [gp[0].id]; out.push(gp[0]); continue; }
      var minx = W, miny = H, maxx = 0, maxy = 0, area = 0, ids = [], bestStr = -1;
      var ta = { miss: 0, extra: 0, diff: 0 };
      for (i = 0; i < gp.length; i++) {
        var c = gp[i];
        if (c.x < minx) minx = c.x; if (c.y < miny) miny = c.y;
        if (c.x + c.w > maxx) maxx = c.x + c.w; if (c.y + c.h > maxy) maxy = c.y + c.h;
        area += c.area; ids.push(c.id); ta[c.type] += c.area;
        if (c.strength > bestStr) bestStr = c.strength;
      }
      var tp = "diff";   // tipo dominante = o que cobre mais area no grupo
      if (ta.miss >= ta.extra && ta.miss >= ta.diff) tp = "miss";
      else if (ta.extra >= ta.miss && ta.extra >= ta.diff) tp = "extra";
      out.push({ id: ids[0], ids: ids, area: area, x: minx, y: miny, w: maxx - minx, h: maxy - miny,
                 cx: (minx + maxx) >> 1, cy: (miny + maxy) >> 1, type: tp, strength: bestStr });
    }
    return out;
  }

  function compare(fileCanvas, origCanvas, opts) {
    opts = opts || {};
    var colorTol = opts.colorTol != null ? opts.colorTol : 32;
    var slack = opts.slack != null ? opts.slack : 1;
    var minArea = opts.minArea != null ? opts.minArea : 3;
    var minStrength = opts.minStrength != null ? opts.minStrength : 100;  // FORÇA mín. (ruído sub-pixel <=72, edição real >=147)
    var structural = !!opts.structural;   // comparar por FORMA (invariante a cor/tom)
    var trapTol = opts.trapTol != null ? opts.trapTol : 3;   // tolerância de trapping/spread (px) no modo forma
    var prescaled = !!opts.prescaled;
    var MW = opts.maxWork || MAX_WORK;   // resolucao de trabalho (menor = mais rapido)

    var W, H, fileImg, origImg, fileRect, origRect;
    if (prescaled) {
      // mesma escala px/pt: nao estica um no outro; coloca ambos numa tela comum
      var fw = fileCanvas.width, fh = fileCanvas.height, ow = origCanvas.width, oh = origCanvas.height;
      var cw = Math.max(fw, ow), ch = Math.max(fh, oh);
      var k = Math.min(1, MW / Math.max(cw, ch));
      W = Math.max(2, Math.round(cw * k)); H = Math.max(2, Math.round(ch * k));
      fileImg = drawSizedOnWhite(fileCanvas, W, H, fw * k, fh * k);
      origImg = drawSizedOnWhite(origCanvas, W, H, ow * k, oh * k);
      fileRect = { w: fw * k, h: fh * k };
      origRect = { w: ow * k, h: oh * k };
    } else {
      var scale = Math.min(1, MW / Math.max(fileCanvas.width, fileCanvas.height));
      W = Math.max(2, Math.round(fileCanvas.width * scale)); H = Math.max(2, Math.round(fileCanvas.height * scale));
      fileImg = drawOnWhite(fileCanvas, W, H); origImg = drawOnWhite(origCanvas, W, H);
      fileRect = { w: W, h: H };
      origRect = fileRect;
    }

    var fileGray = toGray(fileImg), origGray = toGray(origImg);
    var al = autoAlign(fileGray, origGray, W, H);

    // REGISTRO rot+escala (GlobalVision-like): se houver giro/escala real, warpa o
    // original UMA vez (bilinear) antes do refino de translação. Sem giro -> caminho
    // rápido (só shiftRGB inteiro, sem reamostrar) preserva a nitidez do prescaled.
    var reg = searchRotScale(fileGray, origGray, W, H, al.ox, al.oy);
    // CONSERVADOR: warp reamostra (borra) o original inteiro — se aplicado sem necessidade
    // real, o detector de texto acha que TUDO foi re-estilizado. Só warpa com evidência
    // FORTE: rotação real (>=0.25°) ou escala grande (>=0.8%), sempre com ganho alto.
    // Escala minúscula (ex.: 0.5% por página 1056pt vs 1049pt) é artefato -> translação resolve.
    var useWarp = (Math.abs(reg.ang) >= 0.25 && reg.gain > 0.04) ||
                  (Math.abs(reg.scl - 1) >= 0.008 && reg.gain > 0.08);
    var warpValid = null;
    if (useWarp) {
      var wr = warpRGB(origImg, W, H, reg.ang * Math.PI / 180, reg.scl, W / 2, H / 2);
      origImg = wr.img; origGray = toGray(origImg); warpValid = wr.valid;
      al.ox = reg.ox; al.oy = reg.oy;
    } else { reg.ang = 0; reg.scl = 1; }

    // qualidade REAL do encaixe: fração das bordas fortes do ORIGINAL que têm borda
    // do ARQUIVO a <=1px com o offset aplicado. 0..1 honesto (~0.95+ = casou de fato;
    // a "conf" antiga era relativa ao thumb e enganava — 65% com encaixe perfeito).
    function alignQuality(eFq, eOq, ox, oy) {
      var tot = 0, hit = 0, y, x, sy, sx;
      for (y = 2; y < H - 2; y += 2) {
        var row = y * W;
        for (x = 2; x < W - 2; x += 2) {
          if (eOq[row + x] <= 70) continue;
          sx = x + ox; sy = y + oy;
          if (sx < 2 || sy < 2 || sx >= W - 2 || sy >= H - 2) continue;
          tot++;
          var okq = false;
          for (var dyq = -1; dyq <= 1 && !okq; dyq++) { var rq = (sy + dyq) * W + sx; for (var dxq = -1; dxq <= 1; dxq++) if (eFq[rq + dxq] > 70) { okq = true; break; } }
          if (okq) hit++;
        }
      }
      return tot > 20 ? hit / tot : 0;
    }
    var off, eF = null;
    if (prescaled) {
      eF = edgeMap(fileGray, W, H);
      var eO0 = edgeMap(origGray, W, H);
      // arremate SUB-CÉLULA: o produto de bordas pode preferir um vizinho 1px fora do
      // encaixe ideal (e 1px muda a força de um ponto final de 3x2). O off final é o
      // que MAXIMIZA a própria métrica de encaixe -> painel e bancada convergem.
      function pickBestQ(o0) {
        var bq = alignQuality(eF, eO0, o0.ox, o0.oy), bo = o0;
        for (var dq = 0; dq < 9; dq++) {
          var ddx = (dq % 3) - 1, ddy = ((dq / 3) | 0) - 1;
          if (!ddx && !ddy) continue;
          var qq = alignQuality(eF, eO0, o0.ox + ddx, o0.oy + ddy);
          // só troca com melhora REAL (+0.5%): quase-empate de amostragem não pode
          // tirar o off do lugar (caso bins: -1px "ganhava" por ruído e fragmentava tudo)
          if (qq > bq + 0.005) { bq = qq; bo = { ox: o0.ox + ddx, oy: o0.oy + ddy }; }
        }
        return { off: bo, q: bq };
      }
      var pk = pickBestQ(fineEdgeAlign(eF, eO0, W, H, al.ox, al.oy));
      off = pk.off; al.q = pk.q;
      // encaixe fraco? tenta OUTRO ponto de partida: caixas de tinta coincidentes
      // (imune ao chute do coarse, que varia com o recorte do operador) e fica com
      // o melhor. Deixa o resultado ESTÁVEL independente de como a arte foi recortada.
      if (al.q < 0.92) {
        function inkBoxG(g) {
          var x0 = W, y0 = H, x1 = -1, y1 = -1, xg, yg;
          for (yg = 0; yg < H; yg += 2) { var rg2 = yg * W; for (xg = 0; xg < W; xg += 2) if (g[rg2 + xg] < 230) { if (xg < x0) x0 = xg; if (xg > x1) x1 = xg; if (yg < y0) y0 = yg; if (yg > y1) y1 = yg; } }
          return x1 < 0 ? null : { x: x0, y: y0 };
        }
        var ibF = inkBoxG(fileGray), ibO = inkBoxG(origGray);
        if (ibF && ibO) {
          var pk2 = pickBestQ(fineEdgeAlign(eF, eO0, W, H, ibF.x - ibO.x, ibF.y - ibO.y));
          if (pk2.q > al.q) { off = pk2.off; al.q = pk2.q; }
        }
      }
    } else {
      off = fineAlign(fileGray, origGray, W, H, al.ox, al.oy);
    }
    al.ox = off.ox; al.oy = off.oy; al.ang = reg.ang; al.scl = reg.scl;

    // alinha o original de uma vez (fica sobreposto ao arquivo) + mascara valida
    var sh = shiftRGB(origImg, off.ox, off.oy, W, H, warpValid);
    origImg = sh.img; var valid = sh.valid;
    origGray = toGray(origImg);

    // ===== MÁSCARA DE FOTO (foto nos DOIS lados) =====
    // opts.photoF/photoO = retângulos das IMAGENS de cada PDF (fração 0..1 do próprio
    // render, lidos do pdfium). Pixel-diff dentro de foto∩foto = re-tratamento de
    // imagem (grão/nitidez/curvas da clicheria) -> SILENCIOSO no modo forma.
    // Texto/barcode/QR são isentos (kind) e continuam inspecionados por cima.
    var photoBoth = null;
    if (opts.photoF && opts.photoO && opts.photoF.length && opts.photoO.length) {
      var mF = new Uint8Array(W * H), mO = new Uint8Array(W * H), pr2, px0, py0, px1, py1, yy2, xx2, rw2;
      function fillRects(dst, rects, sw, shh, dx, dy) {
        for (var rj = 0; rj < rects.length; rj++) {
          pr2 = rects[rj];
          px0 = Math.max(0, Math.round(pr2.x * sw) + dx); py0 = Math.max(0, Math.round(pr2.y * shh) + dy);
          px1 = Math.min(W, Math.round((pr2.x + pr2.w) * sw) + dx); py1 = Math.min(H, Math.round((pr2.y + pr2.h) * shh) + dy);
          for (yy2 = py0; yy2 < py1; yy2++) { rw2 = yy2 * W; for (xx2 = px0; xx2 < px1; xx2++) dst[rw2 + xx2] = 1; }
        }
      }
      fillRects(mF, opts.photoF, fileRect.w, fileRect.h, 0, 0);
      fillRects(mO, opts.photoO, origRect.w, origRect.h, off.ox, off.oy);
      photoBoth = new Uint8Array(W * H);
      for (var pq = 0; pq < W * H; pq++) photoBoth[pq] = (mF[pq] && mO[pq]) ? 1 : 0;
    }

    // portao de borda: onde os DOIS lados tem borda forte, a diferenca e so
    // renderizacao (desalinho sub-pixel) -> ignora. So conta onde UM lado esta liso
    // (= conteudo presente num, ausente no outro). Como o GlobalVision "entende".
    var edgeGate = opts.edgeGate != null ? opts.edgeGate : 60;
    var eFile = eF || edgeMap(fileGray, W, H);   // arquivo nao muda -> reusa o do alinhamento
    var eOrig = edgeMap(origGray, W, H);          // original foi deslocado -> recalcula

    var fd = fileImg.data, od = origImg.data, tol = colorTol, S = slack;
    var mask = new Uint8Array(W * H);

    // ===== AUTO: escolhe COR ou FORMA sozinho =====
    // Mede o desvio de TOM em regioes CHAPADAS com conteudo nos dois lados. Se os
    // arquivos renderizam igual (revisao x revisao) da ~0 -> COR (pega ate ponto 1px).
    // Se tem tom/trapping diferente (original x tratado) da alto -> FORMA (ignora cor).
    var modeAuto = false;
    if (!structural && opts.autoMode !== false) {
      var tsum = 0, tn = 0, ti, tp;
      for (ti = 0; ti < W * H; ti++) {
        if (!valid[ti]) continue;
        if (eFile[ti] >= 40 || eOrig[ti] >= 40) continue;    // só chapado (sem borda)
        tp = ti * 4;
        if (fd[tp] > 245 && fd[tp + 1] > 245 && fd[tp + 2] > 245) continue;   // branco no arquivo
        if (od[tp] > 245 && od[tp + 1] > 245 && od[tp + 2] > 245) continue;   // branco no original
        var da = fd[tp] - od[tp]; if (da < 0) da = -da;
        var db = fd[tp + 1] - od[tp + 1]; if (db < 0) db = -db;
        var dc = fd[tp + 2] - od[tp + 2]; if (dc < 0) dc = -dc;
        tsum += da > db ? (da > dc ? da : dc) : (db > dc ? db : dc); tn++;
      }
      var toneShift = tn > 0 ? tsum / tn : 0;   // ~0 = mesmo render; >15 = tom diferente
      if (toneShift > (opts.toneAutoTh != null ? opts.toneAutoTh : 15)) { structural = true; modeAuto = true; }
    }

    // ===== MODO FORMA (estrutural, invariante a cor/tom) =====
    // Compara a ESTRUTURA (bordas), nao a cor. Assim tom diferente (tratamento da
    // pre-impressao) nao acusa. So conta borda forte de um lado SEM correspondente no
    // outro dentro de trapTol (tolerancia de trapping/spread). O n° trocado = borda
    // nova -> aparece; engrossar o amarelo alguns px -> tolerado.
    if (structural) {
      var sET = opts.edgeStrong != null ? opts.edgeStrong : 70;   // borda "forte"
      var sF = new Uint8Array(W * H), sO = new Uint8Array(W * H), q;
      for (q = 0; q < W * H; q++) { sF[q] = eFile[q] > sET ? 1 : 0; sO[q] = eOrig[q] > sET ? 1 : 0; }
      // SUPRESSÃO DE RE-TOM: gradiente reforçado (curvas da clicheria) vira "borda" LARGA
      // (rampa de 6-15px); borda de arte/texto/número é FINA (1-3px). Erosão 3x3 acha o
      // interior das bordas largas = zona de gradiente -> não conta como diferença.
      // Texto/registro/barcode (traço fino) somem na erosão -> continuam contando.
      var gzF = erodeBool(sF, W, H), gzO = erodeBool(sO, W, H);
      var gz = new Uint8Array(W * H);
      for (q = 0; q < W * H; q++) gz[q] = (gzF[q] || gzO[q]) ? 1 : 0;
      gz = dilateBool(gz, W, H, 3);                                // margem em volta da rampa
      var dFm = dilateBool(sF, W, H, trapTol), dOm = dilateBool(sO, W, H, trapTol);
      for (q = 0; q < W * H; q++) {
        if (!valid[q] || gz[q]) continue;
        if (photoBoth && photoBoth[q]) continue;   // dentro de foto nos 2 lados = re-tratamento
        if ((sF[q] && !dOm[q]) || (sO[q] && !dFm[q])) mask[q] = 1;
      }
    } else {
    // ===== MODO COR (padrao) =====
    function dFO(fi, gx, gy) {
      if (gx < 0 || gx >= W || gy < 0 || gy >= H) return 999;
      var oi = (gy * W + gx) * 4;
      var a = fd[fi] - od[oi]; if (a < 0) a = -a;
      var b = fd[fi + 1] - od[oi + 1]; if (b < 0) b = -b;
      var c = fd[fi + 2] - od[oi + 2]; if (c < 0) c = -c;
      return a > b ? (a > c ? a : c) : (b > c ? b : c);
    }
    function dOF(oi, gx, gy) {
      if (gx < 0 || gx >= W || gy < 0 || gy >= H) return 999;
      var fi = (gy * W + gx) * 4;
      var a = od[oi] - fd[fi]; if (a < 0) a = -a;
      var b = od[oi + 1] - fd[fi + 1]; if (b < 0) b = -b;
      var c = od[oi + 2] - fd[fi + 2]; if (c < 0) c = -c;
      return a > b ? (a > c ? a : c) : (b > c ? b : c);
    }
    for (var y = BORDER; y < H - BORDER; y++) {
      for (var x = BORDER; x < W - BORDER; x++) {
        var idx = y * W + x;
        if (!valid[idx]) continue;
        var fi = idx * 4;
        if (dFO(fi, x, y) <= tol) continue;
        var mF = false, dx, dy;
        for (dy = -S; dy <= S && !mF; dy++) for (dx = -S; dx <= S; dx++) { if (dFO(fi, x + dx, y + dy) <= tol) { mF = true; break; } }
        var mO = false;
        for (dy = -S; dy <= S && !mO; dy++) for (dx = -S; dx <= S; dx++) { if (dOF(fi, x + dx, y + dy) <= tol) { mO = true; break; } }
        if (!mF || !mO) {
          // ignora se AMBOS tem borda forte aqui (so renderizacao, nao conteudo)
          if (eFile[idx] < edgeGate || eOrig[idx] < edgeGate) mask[idx] = 1;
        }
      }
    }
    }   // fim do modo COR

    var res = labelBlobs(mask, W, H, minArea);
    var comps = [];
    for (var k2 = 0; k2 < res.comps.length; k2++) {
      var rc = res.comps[k2];
      if (isBand(rc, W, H)) continue;                     // faixa/sangria de borda -> ruido
      rc.type = classifyComp(rc, fileImg, origImg, fileGray, origGray, W, H, tol);   // define rc.strength
      // no modo FORMA a diferença é estrutural (cor pode ser igual) -> não filtra por FORÇA
      if (!structural && rc.strength < minStrength) continue;   // (modo cor) diferença fraca sub-pixel -> ruido
      // OBS: NÃO filtrar por espessura (hairline). Ponto final / acento / traço fino
      // são 1px de altura mas REAIS e de FORÇA alta; quem mata a tirinha sub-pixel de
      // borda é a FORÇA (ruído <=72, edição real >=147), não a geometria.
      comps.push(rc);
    }
    // funde fragmentos vizinhos do MESMO caractere numa marca so. Gap ~0,5% da
    // resolucao (fecha vaos dentro do glifo; ediçoes distintas ficam separadas).
    var mergeGap = opts.mergeGap != null ? opts.mergeGap : Math.max(4, Math.min(18, Math.round(Math.max(W, H) * 0.005)));
    // ===== NUVEM DE RE-TRAÇO (original x tratado com fonte re-desenhada) =====
    // A clicheria re-compõe o texto com peso/desenho diferente -> dezenas de "sobrando"
    // PEQUENOS e FRACOS (casca da fonte nova; força <170, área <400). Conteúdo A MAIS de
    // verdade é forte ou grande. Só age em NUVEM (>=8 de uma vez) pra nunca engolir um
    // extra legítimo de rev x rev. Os "faltando" (miss) não são tocados — é neles que
    // moram as omissões reais (caso Coca: R do INGR, l do 200ml, ponto do REGULAR).
    // ANTES do merge: senão a casca "extra" se funde com um miss real vizinho e o
    // grupo vira extra -> o miss real morreria junto no filtro.
    var nuvemOn = false;
    if (!structural) {
      var nuvem = [];
      for (var nv = comps.length - 1; nv >= 0; nv--) {
        var cnv = comps[nv];
        if (!cnv.kind && cnv.type === "extra" && cnv.strength < 170 && cnv.area < 400) nuvem.push(nv);
      }
      if (nuvem.length >= 8) {
        nuvemOn = true;
        for (nv = 0; nv < nuvem.length; nv++) comps.splice(nuvem[nv], 1);
      }
    }

    comps = mergeNearby(comps, W, H, mergeGap);

    // ===== MESMO OBJETO (só no modo FORMA): overprint/trapping não é diferença =====
    // K overprint no original x K com trapping no tratado: o OBJETO existe IGUAL nos
    // dois lados; o forma acusa a casca do contorno respirando. Assinatura medida
    // (caso 633593): lum média do comp QUASE IGUAL nos 2 lados (|dif|<=20, ambos com
    // tinta) e corpo ralo (fill<0.5 = casca, não conteúdo). Também: fio de faca na
    // borda do canvas e elemento técnico do ORIGINAL fora da arte do arquivo.
    // Texto/barcode (kind) são isentos; modo COR (caso Coca) não passa por aqui.
    if (structural && comps.length) {
      // lum média por comp nos 2 lados (uma passada no lab)
      var idIdx = {}, ci9;
      for (ci9 = 0; ci9 < comps.length; ci9++) {
        var ids9 = comps[ci9].ids || [comps[ci9].id];
        for (var j9 = 0; j9 < ids9.length; j9++) idIdx[ids9[j9]] = ci9;
      }
      var acc9 = [];
      for (ci9 = 0; ci9 < comps.length; ci9++) acc9.push({ f: 0, o: 0, n: 0 });
      var lab9 = res.lab, fd9 = fileImg.data, od9 = origImg.data;
      for (var p9 = 0; p9 < W * H; p9++) {
        var l9 = lab9[p9]; if (!l9 || idIdx[l9] == null) continue;
        var a9 = acc9[idIdx[l9]], q9 = p9 * 4;
        a9.f += 0.299 * fd9[q9] + 0.587 * fd9[q9 + 1] + 0.114 * fd9[q9 + 2];
        a9.o += 0.299 * od9[q9] + 0.587 * od9[q9 + 1] + 0.114 * od9[q9 + 2];
        a9.n++;
      }
      // caixa de tinta do ARQUIVO (limite da arte) p/ a regra do elemento fora da arte
      var fx0 = W, fy0 = H, fx1 = -1, fy1 = -1, xg9, yg9;
      for (yg9 = 0; yg9 < H; yg9 += 3) { var rg9 = yg9 * W; for (xg9 = 0; xg9 < W; xg9 += 3) if (fileGray[rg9 + xg9] < 230) { if (xg9 < fx0) fx0 = xg9; if (xg9 > fx1) fx1 = xg9; if (yg9 < fy0) fy0 = yg9; if (yg9 > fy1) fy1 = yg9; } }
      for (ci9 = comps.length - 1; ci9 >= 0; ci9--) {
        var c9 = comps[ci9];
        if (c9.kind) continue;
        var a9b = acc9[ci9];
        var lumF9 = a9b.n ? a9b.f / a9b.n : 255, lumO9 = a9b.n ? a9b.o / a9b.n : 255;
        var fill9 = c9.area / Math.max(1, c9.w * c9.h);
        var dLum9 = lumF9 - lumO9; if (dLum9 < 0) dLum9 = -dLum9;
        // A) casca de mesmo objeto: mesma cor média nos 2 lados + corpo ralo
        if (dLum9 <= 20 && lumF9 < 220 && lumO9 < 220 && fill9 < 0.5) { comps.splice(ci9, 1); continue; }
        // B) fio de faca/corte: filete colado na borda do canvas OU da caixa da arte
        var minD9 = Math.min(c9.w, c9.h);
        var nearB9 = c9.x <= 8 || c9.y <= 8 || (c9.x + c9.w) >= W - 8 || (c9.y + c9.h) >= H - 8 ||
                     c9.x <= fx0 + 8 || (c9.x + c9.w) >= fx1 - 8 || c9.y <= fy0 + 8 || (c9.y + c9.h) >= fy1 - 8;
        if (minD9 <= 3 && Math.max(c9.w, c9.h) >= 40 && nearB9) { comps.splice(ci9, 1); continue; }
        // B2) fio LONGO do MESMO objeto (linha de faca/registro deslocada além do
        // trapping): filete ≥40px com tinta e cor da MESMA família nos 2 lados.
        // Linha realmente removida tem o outro lado como FUNDO (dLum grande).
        if (minD9 <= 3 && Math.max(c9.w, c9.h) >= 40 && dLum9 <= 40 && lumF9 < 220 && lumO9 < 220) { comps.splice(ci9, 1); continue; }
        // C) elemento técnico do ORIGINAL fora da arte do arquivo (barra de dobra/corte):
        //    faltando com o F BRANCO ali e o comp além/na borda da caixa de tinta do F
        if (c9.type === "miss" && lumF9 >= 240 &&
            (c9.y >= fy1 - 6 || (c9.y + c9.h) <= fy0 + 6 || c9.x >= fx1 - 6 || (c9.x + c9.w) <= fx0 + 6)) { comps.splice(ci9, 1); continue; }
      }
    }

    // 2ª etapa da nuvem: a fonte re-desenhada também deixa RESÍDUOS de "faltando"
    // (serifa/quina do desenho antigo que o novo não tem; 2-5px, força ~100-150).
    // Omissão REAL é maior (R 66px, l 42px) ou fortíssima (ponto final: 166).
    // Só roda quando a nuvem foi detectada — rev x rev nunca passa por aqui.
    if (nuvemOn) {
      for (var nz = comps.length - 1; nz >= 0; nz--) {
        var cz2 = comps[nz];
        if (cz2.kind || cz2.area >= 30) continue;
        // PONTUAÇÃO PLENA sobrevive: pequena mas CHEIA (fill alto) e forte — um ponto
        // final é corpo pleno de tinta; resíduo de serifa é transição rala/fraca.
        var fillz = cz2.area / Math.max(1, cz2.w * cz2.h);
        var pontuacao = cz2.area >= 5 && cz2.strength >= 140 && fillz >= 0.55;
        if (!pontuacao) comps.splice(nz, 1);
      }
    }

    // ===== BARCODE INSPECTION (antes do texto p/ mascarar a área do código) =====
    // lê o EAN dos DOIS lados: arquivo tem e original não -> "aplicado"; leituras
    // diferentes -> ERRO; iguais -> "confere". O rect vai p/ a inspeção de texto ignorar
    // as barras (que geram falhas espúrias de "texto").
    var barcode = null, bcRect = null;
    if (root.ACBarcode) {
      try {
        // EAN deitado OU em PÉ (rótulo horizontal com código vertical): se a leitura
        // normal falhar, tenta a imagem girada 90° e re-mapeia o rect de volta.
        function scanRotAware(img) {
          var r0 = root.ACBarcode.scan(img);
          if (r0) return r0;
          var Wi = img.width, Hi = img.height, W2 = Hi, out = new Uint8Array(Hi * Wi * 4), sD = img.data;
          for (var yq = 0; yq < Hi; yq++) for (var xq = 0; xq < Wi; xq++) {
            var si = (yq * Wi + xq) * 4, di = (xq * W2 + (W2 - 1 - yq)) * 4;
            out[di] = sD[si]; out[di + 1] = sD[si + 1]; out[di + 2] = sD[si + 2]; out[di + 3] = 255;
          }
          var r90 = root.ACBarcode.scan({ data: out, width: W2, height: Wi });
          if (r90 && r90.rect) {
            var rr = r90.rect;
            r90.rect = { x: rr.y, y: W2 - rr.x - rr.w, w: rr.h, h: rr.w };
          }
          return r90;
        }
        var bcF = scanRotAware(fileImg);
        var bcO = bcF ? scanRotAware(origImg) : null;
        if (bcF && bcF.checksumOk) {
          bcRect = bcF.rect;
          var bst = !bcO ? "aplicado" : (bcO.code === bcF.code ? "confere" : "diverge");
          barcode = { file: bcF.code, orig: bcO ? bcO.code : null, status: bst, rect: bcF.rect };
        }
      } catch (eB) {}
    }

    // ===== LOCALIZADOR DE TEXTO DIFERENTE (só no modo FORMA) =====
    // Acha as REGIÕES/blocos de texto que diferem entre original e arquivo (restyle,
    // conteúdo trocado, faltando ou a mais) — dá o LOCAL na hora, na arte inteira, sem
    // cropar. Cada região vira um MARCADOR de bloco (kind:'text'). O OCR (passo async no
    // main.js) roda SÓ nessas poucas regiões e preenche o QUE mudou (ex.: 0763→0591) e
    // some as que eram só re-tom. Pixel dentro do bloco = texto -> suprime (não é objeto).
    var textRegions = null, textResid = null;
    if (structural && root.ACText && root.ACText.findRestyledRegions) {
      try {
        var rr = root.ACText.findRestyledRegions(fileImg, origImg, { photoMask: photoBoth });
        textRegions = (rr && rr.regions) ? rr.regions : [];
        textResid = (rr && rr.resid) ? rr.resid : null;   // máscara de residual (o que MUDOU) — pontua os segmentos do OCR
        for (var ri = 0; ri < textRegions.length; ri++) {
          var reg = textRegions[ri];
          for (var t2 = comps.length - 1; t2 >= 0; t2--) {
            var pc0 = comps[t2];
            if (!pc0.kind && pc0.cx >= reg.x && pc0.cx <= reg.x + reg.w && pc0.cy >= reg.y && pc0.cy <= reg.y + reg.h) comps.splice(t2, 1);
          }
          comps.push({ x: reg.x, y: reg.y, w: reg.w, h: reg.h,
                       cx: reg.x + (reg.w >> 1), cy: reg.y + (reg.h >> 1), area: reg.w * reg.h,
                       type: "diff", kind: "text", textFile: "", textOrig: "", region: ri, ids: [] });
        }
      } catch (eT) {}
    }

    // ===== CORPO DELETADO POR COR (complemento do modo FORMA) =====
    // Trapping/overprint são TOM SOBRE TOM (lum quase igual — medido: dif<=20) e só
    // ESTENDEM a tinta do próprio objeto. Um objeto pequeno DELETADO (ponto do ":")
    // deixa no lugar uma cor TOTALMENTE diferente (fundo) — mas o trapTol do forma
    // engole quando há um irmão a <=3px. Passe extra por COR (slack 1): CCs compactos,
    // pequenos e de cor bem diferente = deleção real. Fica FORA: casca fina de
    // re-peso (min dim <3), tom-sobre-tom (dLum<40) e tudo dentro de textRegion.
    if (structural) {
      try {
        var mask2 = new Uint8Array(W * H), fdc = fileImg.data, odc = origImg.data;
        var y5, x5, i5, f5;
        function pdiff(ai, bx, by, other) {   // maxdiff canal pixel ai (do lado A) vs (bx,by) do lado B
          if (bx < 0 || by < 0 || bx >= W || by >= H) return 999;
          var bi = (by * W + bx) * 4;
          var d0 = other === 1 ? fdc : odc, d1 = other === 1 ? odc : fdc;
          var a = d1[ai] - d0[bi]; if (a < 0) a = -a;
          var b = d1[ai + 1] - d0[bi + 1]; if (b < 0) b = -b;
          var c = d1[ai + 2] - d0[bi + 2]; if (c < 0) c = -c;
          return a > b ? (a > c ? a : c) : (b > c ? b : c);
        }
        for (y5 = BORDER; y5 < H - BORDER; y5++) {
          var rw5 = y5 * W;
          for (x5 = BORDER; x5 < W - BORDER; x5++) {
            i5 = rw5 + x5;
            if (!valid[i5]) continue;
            if (photoBoth && photoBoth[i5]) continue;
            f5 = i5 * 4;
            // pixel do F sem par de cor no O (raio slack) OU do O sem par no F
            var mF5 = false, mO5 = false, dx5, dy5;
            for (dy5 = -1; dy5 <= 1 && !mF5; dy5++) for (dx5 = -1; dx5 <= 1; dx5++) if (pdiff(f5, x5 + dx5, y5 + dy5, 1) <= colorTol) { mF5 = true; break; }
            for (dy5 = -1; dy5 <= 1 && !mO5; dy5++) for (dx5 = -1; dx5 <= 1; dx5++) if (pdiff(f5, x5 + dx5, y5 + dy5, 0) <= colorTol) { mO5 = true; break; }
            if (!mF5 || !mO5) mask2[i5] = 1;
          }
        }
        // FAIXA TÉCNICA (barra de acabamento preta na base): banda y escura nos DOIS
        // lados em >50% da largura = zona de marcas de impressão (bolinhas de controle
        // que o tratado remove) -> candidatos ali não são arte, ficam fora.
        var bandaTec = new Uint8Array(H);
        for (y5 = 0; y5 < H; y5++) {
          var rw6 = y5 * W, dark6 = 0;
          for (x5 = 0; x5 < W; x5 += 2) {
            var q6 = (rw6 + x5) * 4;
            var lf6 = 0.299 * fdc[q6] + 0.587 * fdc[q6 + 1] + 0.114 * fdc[q6 + 2];
            var lo6 = 0.299 * odc[q6] + 0.587 * odc[q6 + 1] + 0.114 * odc[q6 + 2];
            if (lf6 < 80 || lo6 < 80) dark6++;
          }
          if (dark6 > (W / 2) * 0.5) bandaTec[y5] = 1;
        }
        var res5 = labelBlobs(mask2, W, H, Math.max(4, minArea));
        // lum média por LABEL numa passada só (centenas de CCs candidatos; varrer por CC não escala)
        var lumAcc = {}, p5, l5;
        for (p5 = 0; p5 < W * H; p5++) {
          l5 = res5.lab[p5]; if (!l5) continue;
          var a5 = lumAcc[l5]; if (!a5) a5 = lumAcc[l5] = { f: 0, o: 0, n: 0 };
          var q5 = p5 * 4;
          a5.f += 0.299 * fdc[q5] + 0.587 * fdc[q5 + 1] + 0.114 * fdc[q5 + 2];
          a5.o += 0.299 * odc[q5] + 0.587 * odc[q5 + 1] + 0.114 * odc[q5 + 2];
          a5.n++;
        }
        for (var k5 = 0; k5 < res5.comps.length; k5++) {
          var c5 = res5.comps[k5];
          if (c5.area < 6 || c5.area > 400) continue;
          if (Math.min(c5.w, c5.h) < 3 || Math.max(c5.w, c5.h) > 40) continue;              // casca fina/risco fora
          if (c5.area / Math.max(1, c5.w * c5.h) < 0.5) continue;                            // corpo cheio, não anel
          if (bandaTec[Math.max(0, Math.min(H - 1, c5.cy))]) continue;   // marca de controle na faixa técnica
          var ac5 = lumAcc[c5.id];
          if (!ac5 || !ac5.n) continue;
          var dl5 = ac5.f / ac5.n - ac5.o / ac5.n; if (dl5 < 0) dl5 = -dl5;
          if (dl5 < 40) continue;
          c5.type = classifyComp(c5, fileImg, origImg, fileGray, origGray, W, H, tol);
          if (c5.strength < 120) continue;
          // dedup: já coberto por comp existente ou dentro de textRegion -> pula
          var dup5 = false, e5;
          for (e5 = 0; e5 < comps.length && !dup5; e5++) {
            var ce5 = comps[e5];
            if (c5.cx >= ce5.x - 8 && c5.cx <= ce5.x + ce5.w + 8 && c5.cy >= ce5.y - 8 && c5.cy <= ce5.y + ce5.h + 8) dup5 = true;
          }
          if (!dup5 && textRegions) for (e5 = 0; e5 < textRegions.length && !dup5; e5++) {
            var tr5 = textRegions[e5];
            if (c5.cx >= tr5.x && c5.cx <= tr5.x + tr5.w && c5.cy >= tr5.y && c5.cy <= tr5.y + tr5.h) dup5 = true;
          }
          if (dup5) continue;
          c5.ids = [c5.id];
          comps.push(c5);
        }
      } catch (eK) {}
    }

    // empurra o item do código de barras (depois de remover comps de pixel na área dele)
    if (barcode) {
      var br = barcode.rect, bm = Math.round(Math.max(W, H) * 0.006);
      for (var b2 = comps.length - 1; b2 >= 0; b2--) {
        var pc1 = comps[b2];
        if (pc1.kind !== "barcode" && pc1.cx >= br.x - bm && pc1.cx <= br.x + br.w + bm &&
            pc1.cy >= br.y - bm && pc1.cy <= br.y + br.h + bm) comps.splice(b2, 1);
      }
      if (barcode.status !== "confere") {
        comps.push({ x: br.x, y: br.y, w: br.w, h: br.h,
                     cx: br.x + (br.w >> 1), cy: br.y + (br.h >> 1), area: br.w * br.h,
                     type: barcode.status === "diverge" ? "diff" : "extra",
                     kind: "barcode", code: barcode.file, codeOrig: barcode.orig, ids: [] });
      } else {
        // "confere" também vira ITEM (verde, informativo): a leitura fica sempre VISÍVEL
        comps.push({ x: br.x, y: br.y, w: br.w, h: br.h,
                     cx: br.x + (br.w >> 1), cy: br.y + (br.h >> 1), area: br.w * br.h,
                     type: "ok", kind: "barcode", code: barcode.file, codeOrig: barcode.orig, ids: [] });
      }
    }

    // ===== QR CODE (jsQR): lê nos 2 lados; "a mais" (azul) se só no arquivo, "diferente"
    // (vermelho) se a leitura diverge. Isento dos ignores, como o barcode. =====
    if (root.jsQR) {
      try {
        var qf = root.jsQR(fileImg.data, W, H);
        var qo = qf ? root.jsQR(origImg.data, W, H) : null;
        if (qf && qf.data) {
          var lc = qf.location;
          var qx0 = Math.min(lc.topLeftCorner.x, lc.bottomLeftCorner.x), qx1 = Math.max(lc.topRightCorner.x, lc.bottomRightCorner.x);
          var qy0 = Math.min(lc.topLeftCorner.y, lc.topRightCorner.y), qy1 = Math.max(lc.bottomLeftCorner.y, lc.bottomRightCorner.y);
          var qw = Math.max(1, Math.round(qx1 - qx0)), qh = Math.max(1, Math.round(qy1 - qy0));
          var qs = !qo ? "aplicado" : (qo.data === qf.data ? "confere" : "diverge");
          for (var q2 = comps.length - 1; q2 >= 0; q2--) {
            var pcq = comps[q2];
            if (!pcq.kind && pcq.cx >= qx0 && pcq.cx <= qx1 && pcq.cy >= qy0 && pcq.cy <= qy1) comps.splice(q2, 1);
          }
          comps.push({ x: Math.round(qx0), y: Math.round(qy0), w: qw, h: qh,
                       cx: Math.round(qx0 + qw / 2), cy: Math.round(qy0 + qh / 2), area: qw * qh,
                       type: qs === "confere" ? "ok" : qs === "diverge" ? "diff" : "extra",
                       kind: "barcode", qr: true, code: qf.data, codeOrig: qo ? qo.data : null, ids: [] });
        }
      } catch (eQ) {}
    }

    // itens especiais primeiro (barcode > texto), depois por área
    comps.sort(function (a, b) {
      var ka = a.kind === "barcode" ? 2 : a.kind === "text" ? 1 : 0;
      var kb = b.kind === "barcode" ? 2 : b.kind === "text" ? 1 : 0;
      if (ka !== kb) return kb - ka;
      return b.area - a.area;
    });
    var counts = { miss: 0, extra: 0, diff: 0, ok: 0 };
    for (var m2 = 0; m2 < comps.length; m2++) if (counts[comps[m2].type] != null) counts[comps[m2].type]++;

    return { W: W, H: H, lab: res.lab, fileImg: fileImg, origImg: origImg,
             comps: comps, counts: counts, align: al, prescaled: prescaled, fileRect: fileRect,
             mode: structural ? "forma" : "cor", modeAuto: modeAuto, barcode: barcode,
             textRegions: textRegions, textResid: textResid };
  }

  root.ACEngine = { compare: compare, overlay: buildOverlay };

})(window);

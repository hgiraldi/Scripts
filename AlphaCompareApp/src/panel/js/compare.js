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
    var COL = { miss: [220, 38, 38], extra: [37, 99, 235], diff: [220, 38, 38], ok: [34, 165, 91], check: [245, 158, 11] };
    // regiões dos itens de texto/barcode (kind) ficam NÍTIDAS (mostra o conteúdo real do arquivo)
    // com um leve realce — pra dar pra LER a diferença; o resto fica lavado (contexto).
    var sharp = new Uint8Array(W * H), padS = Math.max(3, Math.round(Math.max(W, H) / 400));
    for (var cs = 0; cs < comps.length; cs++) {
      var kc = comps[cs]; if (!kc.kind) continue;
      var sx0 = Math.max(0, kc.x - padS), sy0 = Math.max(0, kc.y - padS);
      var sx1 = Math.min(W, kc.x + kc.w + padS), sy1 = Math.min(H, kc.y + kc.h + padS);
      for (var sy = sy0; sy < sy1; sy++) { var row = sy * W; for (var sx = sx0; sx < sx1; sx++) sharp[row + sx] = 1; }
    }
    var out = new ImageData(W, H), s = fileImg.data, d = out.data;
    for (var i = 0, j = 0; i < W * H; i++, j += 4) {
      var lg = (s[j] * 0.299 + s[j + 1] * 0.587 + s[j + 2] * 0.114);
      var id = lab[i], t = id ? typeOf[id] : 0;
      if (sharp[i]) {
        // texto/barcode: MOSTRA o conteúdo real do arquivo (com contraste) — NÃO cobre com cor.
        var v = (lg - 128) * 1.3 + 128; v = v < 0 ? 0 : v > 255 ? 255 : v | 0;
        d[j] = v; d[j + 1] = v; d[j + 2] = v; d[j + 3] = 255;
      } else if (t) {
        // diferença GRÁFICA (objeto/foto) sem conteúdo de texto: aí sim pinta a cor do tipo.
        var col = COL[t]; d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255;
      } else {
        var g = (lg * 0.5 + 128) | 0;   // fundo lavado (contexto)
        d[j] = g; d[j + 1] = g; d[j + 2] = g; d[j + 3] = 255;
      }
    }
    // MOLDURA FINA e destacada nos itens de texto/barcode (halo branco por fora p/ contraste) —
    // fica FORA do conteúdo (só a borda), não cobre o texto.
    var th = Math.max(1, Math.round(Math.max(W, H) / 950));
    function frame(cc, col) {
      var x0 = Math.max(0, cc.x - th), y0 = Math.max(0, cc.y - th);
      var x1 = Math.min(W, cc.x + cc.w + th), y1 = Math.min(H, cc.y + cc.h + th);
      var ho = Math.max(1, th >> 1);   // halo branco 1px por fora
      for (var yy = y0; yy < y1; yy++) {
        for (var xx = x0; xx < x1; xx++) {
          var inX = xx >= cc.x + th && xx < cc.x + cc.w - th;
          var inY = yy >= cc.y + th && yy < cc.y + cc.h - th;
          if (inX && inY) continue;   // só a borda
          var edge = (xx < cc.x - th + ho || xx >= cc.x + cc.w + th - ho || yy < cc.y - th + ho || yy >= cc.y + cc.h + th - ho);
          var p = (yy * W + xx) * 4;
          if (edge) { d[p] = 255; d[p + 1] = 255; d[p + 2] = 255; }   // halo branco na borda externa
          else { d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; }
          d[p + 3] = 255;
        }
      }
    }
    for (var c2 = 0; c2 < comps.length; c2++) {
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
    // SENSIBILIDADE: 0=Baixa/Precisa, 1=Média, 2=Alta/Sensível (recall-first sob trapping/textura)
    var sens = opts.sens != null ? opts.sens : 0;
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
    // igual a alignQuality, mas SEM o raio de 1px: usada só para ESCOLHER entre
    // candidatos de escala. A tolerante empata (94% x 93%) e o painel acabava
    // escolhendo a escala pior; a estrita separa de verdade.
    function alignQualityStrict(eFq, eOq, ox, oy) {
      var tot = 0, hit = 0, y, x, sy, sx;
      for (y = 2; y < H - 2; y += 2) {
        var row = y * W;
        for (x = 2; x < W - 2; x += 2) {
          if (eOq[row + x] <= 70) continue;
          sx = x + ox; sy = y + oy;
          if (sx < 2 || sy < 2 || sx >= W - 2 || sy >= H - 2) continue;
          tot++;
          if (eFq[sy * W + sx] > 70) hit++;
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
      // ===== AJUSTE DE ESCALA (X e Y independentes) =====
      // Só quando o encaixe continua ruim: as artes podem ter TAMANHOS diferentes
      // (sangria/margem técnica distinta, arte remontada) — aí translação nunca fecha
      // e TUDO vira falso. Procura o par (sx,sy) em MINIATURA (rápido), aplica no
      // original e só mantém se o encaixe melhorar de verdade. Um objeto realmente
      // redimensionado continua acusando: o ajuste é global, não por objeto.
      // itera: medir -> corrigir -> medir de novo (a 1a correção revela o resíduo)
      for (var itSc = 0; itSc < 2 && al.q < 0.95 && opts.autoScale !== false; itSc++) {
        // MEDE a escala em vez de procurar às cegas: quando as artes têm TAMANHOS
        // diferentes (sangria/margem técnica distinta, arte remontada), o deslocamento
        // local CRESCE LINEARMENTE ao longo do eixo — a inclinação dessa reta É o fator
        // de escala. Medido em miniatura por NCC de bandas; aplicado só se o encaixe
        // em resolução plena melhorar. Ajuste GLOBAL: objeto redimensionado continua acusando.
        var SS = 700, ks = Math.min(1, SS / Math.max(W, H));
        var Ws = Math.max(60, Math.round(W * ks)), Hs = Math.max(60, Math.round(H * ks));
        var fS = toGray(drawSizedOnWhite(fileCanvas, Ws, Hs, fileRect.w * ks, fileRect.h * ks));
        var oS = toGray(drawSizedOnWhite(origCanvas, Ws, Hs, origRect.w * ks, origRect.h * ks));
        var bx0 = off.ox * ks, by0 = off.oy * ks;
        function nccB(x0, x1, y0, y1, dx, dy) {
          var s2 = 0, sa = 0, sb = 0, n2 = 0, yb, xb;
          for (yb = y0; yb < y1; yb++) {
            var fyb = yb + dy; if (fyb < 0 || fyb >= Hs) continue;
            for (xb = x0; xb < x1; xb++) {
              var fxb = xb + dx; if (fxb < 0 || fxb >= Ws) continue;
              var va = 255 - oS[yb * Ws + xb], vb = 255 - fS[fyb * Ws + fxb];
              s2 += va * vb; sa += va * va; sb += vb * vb; n2++;
            }
          }
          if (n2 < 200) return -1;
          var den2 = Math.sqrt(sa * sb); return den2 > 0 ? s2 / den2 : -1;
        }
        function deslocB(x0, x1, y0, y1) {
          var best2 = -1, bdx = Math.round(bx0), bdy = Math.round(by0), rr, dxb, dyb, R0 = 14;
          for (dyb = Math.round(by0) - R0; dyb <= Math.round(by0) + R0; dyb += 2)
            for (dxb = Math.round(bx0) - R0; dxb <= Math.round(bx0) + R0; dxb += 2) {
              rr = nccB(x0, x1, y0, y1, dxb, dyb);
              if (rr > best2) { best2 = rr; bdx = dxb; bdy = dyb; }
            }
          for (dyb = bdy - 2; dyb <= bdy + 2; dyb++) for (dxb = bdx - 2; dxb <= bdx + 2; dxb++) {
            rr = nccB(x0, x1, y0, y1, dxb, dyb);
            if (rr > best2) { best2 = rr; bdx = dxb; bdy = dyb; }
          }
          return { dx: bdx, dy: bdy, ncc: best2 };
        }
        function inclina(cs, ds) {
          var n3 = cs.length, i3, mc = 0, md = 0;
          if (n3 < 4) return 0;
          for (i3 = 0; i3 < n3; i3++) { mc += cs[i3]; md += ds[i3]; }
          mc /= n3; md /= n3;
          var num = 0, den3 = 0;
          for (i3 = 0; i3 < n3; i3++) { num += (cs[i3] - mc) * (ds[i3] - md); den3 += (cs[i3] - mc) * (cs[i3] - mc); }
          return den3 > 0 ? num / den3 : 0;
        }
        var NB = 6, cX = [], dX = [], cY = [], dY = [], bi3, r4, xa, xb2, ya, yb2;
        for (bi3 = 0; bi3 < NB; bi3++) {
          xa = Math.round(bi3 * Ws / NB); xb2 = Math.round((bi3 + 1) * Ws / NB);
          r4 = deslocB(xa, xb2, 0, Hs);
          if (r4.ncc > 0.45) { cX.push((xa + xb2) / 2); dX.push(r4.dx); }
        }
        for (bi3 = 0; bi3 < NB - 1; bi3++) {
          ya = Math.round(bi3 * Hs / (NB - 1)); yb2 = Math.round((bi3 + 1) * Hs / (NB - 1));
          r4 = deslocB(0, Ws, ya, yb2);
          if (r4.ncc > 0.45) { cY.push((ya + yb2) / 2); dY.push(r4.dy); }
        }
        var sxE = 1 + inclina(cX, dX), syE = 1 + inclina(cY, dY);
        if (sxE < 0.85 || sxE > 1.18) sxE = 1;      // fora disso não é a mesma arte
        if (syE < 0.85 || syE > 1.18) syE = 1;
        al.scaleDbg = { sx: Math.round(sxE * 10000) / 10000, sy: Math.round(syE * 10000) / 10000, nx: cX.length, ny: cY.length };
        // A medição em Y costuma ser mais ruidosa (bandas finas, texto pequeno).
        // Testa em resolução plena: (sx,sy), só sx e só sy — fica com o melhor encaixe.
        var cands4 = [], q4best = al.q, ap4 = null;
        var stBest = alignQualityStrict(eF, eO0, off.ox, off.oy);   // base a bater
        if (Math.abs(sxE - 1) >= 0.003 && Math.abs(syE - 1) >= 0.003) cands4.push([sxE, syE]);
        if (Math.abs(sxE - 1) >= 0.003) cands4.push([sxE, 1]);
        if (Math.abs(syE - 1) >= 0.003) cands4.push([1, syE]);
        for (var ci4 = 0; ci4 < cands4.length; ci4++) {
          var nw = origRect.w * cands4[ci4][0], nh = origRect.h * cands4[ci4][1];
          if (nw > W * 1.5 || nh > H * 1.5) continue;
          var oImg4 = drawSizedOnWhite(origCanvas, W, H, nw, nh);
          var oGray4 = toGray(oImg4), eO4 = edgeMap(oGray4, W, H);
          var al4 = autoAlign(fileGray, oGray4, W, H);
          var o04 = fineEdgeAlign(eF, eO4, W, H, al4.ox, al4.oy);
          var bq4 = alignQuality(eF, eO4, o04.ox, o04.oy), bo4 = o04, dq4;
          for (dq4 = 0; dq4 < 9; dq4++) {
            var ddx4 = (dq4 % 3) - 1, ddy4 = ((dq4 / 3) | 0) - 1;
            if (!ddx4 && !ddy4) continue;
            var qq4 = alignQuality(eF, eO4, o04.ox + ddx4, o04.oy + ddy4);
            if (qq4 > bq4 + 0.005) { bq4 = qq4; bo4 = { ox: o04.ox + ddx4, oy: o04.oy + ddy4 }; }
          }
          var st4 = alignQualityStrict(eF, eO4, bo4.ox, bo4.oy);
          if (bq4 > al.q + 0.005 && st4 > stBest) { stBest = st4; q4best = bq4; ap4 = { img: oImg4, g: oGray4, e: eO4, w: nw, h: nh, off: bo4, sx: cands4[ci4][0], sy: cands4[ci4][1] }; }
        }
        al.scaleDbg.qOrig = Math.round(al.q * 1000) / 1000;
        al.scaleDbg.qBest = Math.round(q4best * 1000) / 1000;
        if (!ap4) break;                       // nada melhorou -> para
        origImg = ap4.img; origGray = ap4.g; eO0 = ap4.e; origRect = { w: ap4.w, h: ap4.h };
        off = ap4.off; al.q = q4best;
        al.sx = (al.sx || 1) * ap4.sx; al.sy = (al.sy || 1) * ap4.sy;   // escala ACUMULADA
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
      // NOTA (23/07): a "correção" de desmascarar fundo texturizado (Perdigão) inundava o
      // modo forma com a trama re-amostrada (215MB×130MB) — 230+ falsos. Revertido até o
      // R&D do Perdigão (registro local + supressão de textura). Aqui volta a mascarar toda
      // imagem∩imagem. Não afeta Coca (=3) nem DUX (=0). Ver ARQUITETURA "muro do Perdigão".
      function fillRects(dst, rects, sw, shh, dx, dy) {
        for (var rj = 0; rj < rects.length; rj++) {
          pr2 = rects[rj];
          // Alta sens: NÃO mascara imagem de PÁGINA INTEIRA (fundo/trama) — senão o texto por
          // cima (o registro 0763 do Perdigão) some. O FORÇA+CLUSTER corta o flood da textura.
          if (sens >= 2 && pr2.w > 0.8 && pr2.h > 0.8) continue;
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
    // TRAPPING DE TEXTO / RE-TRAÇO: as chapadas podem ter o MESMO tom (toneShift ~0)
    // e ainda assim o arquivo tratado ter o texto ENGORDADO pelo spread do trapping
    // (borda técnica de compensação de registro — não é conteúdo). A assinatura é:
    // muita diferença COLADA em borda dos DOIS lados (a casca do glifo respirando),
    // em vez de conteúdo presente num lado e ausente no outro.
    if (!structural && opts.autoMode !== false) {
      var nEdge = 0, nBr = 0, bx2, by2, bi2;
      for (var yB = 3; yB < H - 3; yB++) {
        var rwB = yB * W;
        for (var xB = 3; xB < W - 3; xB++) {
          bi2 = rwB + xB;
          if (!valid[bi2]) continue;
          var dGB = fileGray[bi2] - origGray[bi2]; if (dGB < 0) dGB = -dGB;
          if (dGB <= 60) continue;
          var okF = false, okO = false;
          for (by2 = -3; by2 <= 3 && !(okF && okO); by2++) {
            var rB2 = bi2 + by2 * W;
            for (bx2 = -3; bx2 <= 3; bx2++) {
              var eIdx = rB2 + bx2;
              if (eFile[eIdx] > 60) okF = true;
              if (eOrig[eIdx] > 60) okO = true;
              if (okF && okO) break;
            }
          }
          if (okF || okO) nEdge++;
          if (okF && okO) nBr++;
        }
      }
      al.breathe = nEdge ? Math.round(nBr / nEdge * 1000) / 1000 : 0;
      al.nEdge = nEdge;
      // limiar ABSOLUTO (margem branca não dilui) + fração alta = casca, não conteúdo
      if (nEdge >= 1200 && nBr / nEdge > 0.55) { structural = true; modeAuto = true; }
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
      for (ci9 = 0; ci9 < comps.length; ci9++) acc9.push({ f: 0, o: 0, n: 0, wf: 0 });
      var lab9 = res.lab, fd9 = fileImg.data, od9 = origImg.data;
      for (var p9 = 0; p9 < W * H; p9++) {
        var l9 = lab9[p9]; if (!l9 || idIdx[l9] == null) continue;
        var a9 = acc9[idIdx[l9]], q9 = p9 * 4;
        var lf9 = 0.299 * fd9[q9] + 0.587 * fd9[q9 + 1] + 0.114 * fd9[q9 + 2];
        a9.f += lf9;
        a9.o += 0.299 * od9[q9] + 0.587 * od9[q9 + 1] + 0.114 * od9[q9 + 2];
        if (lf9 >= 240) a9.wf++;
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
        // D) ruído sub-pixel do modo forma: fragmento minúsculo E fraco. Pontuação
        //    real (ponto/vírgula deletados) é pequena mas FORTE (>=120) — sobrevive.
        if (c9.area <= 12 && c9.strength < 120) { comps.splice(ci9, 1); continue; }
        // C) elemento técnico do ORIGINAL fora da arte do arquivo (barra de dobra/corte):
        //    faltando com o F BRANCO ali e o comp além/na borda da caixa de tinta do F
        var fracBr9 = a9b.n ? a9b.wf / a9b.n : 0;
        if (c9.type === "miss" && (lumF9 >= 240 || fracBr9 >= 0.6) &&
            (c9.y >= fy1 - 6 || (c9.y + c9.h) <= fy0 + 6 || c9.x >= fx1 - 6 || (c9.x + c9.w) <= fx0 + 6 ||
             (c9.y + c9.h) >= fileRect.h - 6 || (c9.x + c9.w) >= fileRect.w - 6)) { comps.splice(ci9, 1); continue; }
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
        // barcode também é sensível à escala: tenta nativo + box-downscales (média) — igual ao QR.
        function _bdown(img, iw, ih, nw, nh) {
          var out = new Uint8Array(nw * nh * 4), dd = img.data, rx = iw / nw, ry = ih / nh, x, y;
          for (y = 0; y < nh; y++) { var y0 = (y * ry) | 0, y1 = Math.min(ih, ((y + 1) * ry) | 0) || y0 + 1;
            for (x = 0; x < nw; x++) { var x0 = (x * rx) | 0, x1 = Math.min(iw, ((x + 1) * rx) | 0) || x0 + 1, r = 0, g = 0, b = 0, n = 0;
              for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { var so = (yy * iw + xx) * 4; r += dd[so]; g += dd[so + 1]; b += dd[so + 2]; n++; }
              var dt = (y * nw + x) * 4, v = n || 1; out[dt] = r / v; out[dt + 1] = g / v; out[dt + 2] = b / v; out[dt + 3] = 255; } }
          return out;
        }
        function bcMulti(img) {
          var r = scanRotAware(img); if (r && r.checksumOk) return r;
          var alvos = [2600, 2400, 2800, 2200, 3000], iw = img.width, ih = img.height;
          for (var i = 0; i < alvos.length; i++) { var nw = alvos[i]; if (nw >= iw - 60 || nw < 400) continue;
            var nh = Math.round(ih * nw / iw), r2 = scanRotAware({ data: _bdown(img, iw, ih, nw, nh), width: nw, height: nh });
            if (r2 && r2.checksumOk) { if (r2.rect) { var f = iw / nw; r2.rect = { x: r2.rect.x * f, y: r2.rect.y * f, w: r2.rect.w * f, h: r2.rect.h * f }; } return r2; } }
          return r;
        }
        var bcF = bcMulti(fileImg);
        var bcO = bcF ? bcMulti(origImg) : null;
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
    // DESLIGADO quando o arquivo tem SPREAD GLOBAL de trapping (breathe alto): ali o
    // engorde do texto gera centenas de fragmentos de cor e o passe vira ruído — nesse
    // cenário quem acha a troca é o OCR das regiões de texto, não o pixel.
    // ===== REGISTRO LOCAL (elástico por blocos) — só no modo forma =====
    // O alinhamento global deixa desalinho LOCAL variável (páginas de tamanhos diferentes,
    // distorção de render). Medido: ~85% dos blocos precisam de shift, e isso põe a borda do
    // trapping "fora do lugar" gerando falsos. Alinhar bloco a bloco (96px, ±6) ANTES do passe
    // corpo-por-cor crava o 28→29 do DUX (some sem isso) e limpa muito ruído. Recall-first.
    // (sens já definido no topo) — 0=Baixa/Precisa, 1=Média, 2=Alta/Sensível
    var odcW = origImg.data;
    if (structural && sens >= 2) {   // registro local só na Alta (é caro e adiciona ruído no limpo)
      odcW = new Uint8ClampedArray(origImg.data.length);
      var oDat = origImg.data, BLKr = 96, RCr = 6, bxr, byr, ddx, ddy, xs, ys;
      // 1) grade de deslocamentos: melhor shift por bloco (SAD do luma)
      var nbx = Math.ceil(W / BLKr), nby = Math.ceil(H / BLKr);
      var gdx = new Float32Array(nbx * nby), gdy = new Float32Array(nbx * nby), bxi, byi;
      for (byi = 0; byi < nby; byi++) { for (bxi = 0; bxi < nbx; bxi++) {
        bxr = bxi * BLKr; byr = byi * BLKr;
        var bwr = Math.min(BLKr, W - bxr), bhr = Math.min(BLKr, H - byr), bsad = 1e18, bdx = 0, bdy = 0, sad00 = 0;
        for (ddy = -RCr; ddy <= RCr; ddy++) { for (ddx = -RCr; ddx <= RCr; ddx++) {
          var sd = 0, nnr = 0;
          for (ys = byr; ys < byr + bhr; ys += 3) { for (xs = bxr; xs < bxr + bwr; xs += 3) {
            var xt = xs + ddx, yt = ys + ddy, dv;
            if (xt < 0 || yt < 0 || xt >= W || yt >= H) dv = 80; else { dv = fileGray[ys * W + xs] - origGray[yt * W + xt]; if (dv < 0) dv = -dv; }
            sd += dv; nnr++;
          } }
          sd /= nnr; if (ddx === 0 && ddy === 0) sad00 = sd; if (sd < bsad) { bsad = sd; bdx = ddx; bdy = ddy; }
        } }
        // só warpa se o shift MELHORA CLARO (>=4 de SAD) e o bloco tem conteúdo (sad00>=8).
        // Bloco liso/escuro/bem-alinhado fica em (0,0) — evita reamostrar e criar falso.
        if (!(sad00 >= 8 && (sad00 - bsad) >= 4)) { bdx = 0; bdy = 0; }
        gdx[byi * nbx + bxi] = bdx; gdy[byi * nbx + bxi] = bdy;
      } }
      // 2) warp SUAVE: interpola o shift bilinearmente entre centros de bloco (sem emenda)
      var xr2, yr2;
      for (yr2 = 0; yr2 < H; yr2++) { for (xr2 = 0; xr2 < W; xr2++) {
        var fxg = (xr2 - BLKr / 2) / BLKr, fyg = (yr2 - BLKr / 2) / BLKr;
        var gx0 = Math.floor(fxg), gy0 = Math.floor(fyg), wxg = fxg - gx0, wyg = fyg - gy0;
        if (gx0 < 0) { gx0 = 0; wxg = 0; } if (gy0 < 0) { gy0 = 0; wyg = 0; }
        var gx1 = gx0 + 1 < nbx ? gx0 + 1 : nbx - 1, gy1 = gy0 + 1 < nby ? gy0 + 1 : nby - 1;
        if (gx0 > nbx - 1) gx0 = nbx - 1; if (gy0 > nby - 1) gy0 = nby - 1;
        var i00 = gy0 * nbx + gx0, i10 = gy0 * nbx + gx1, i01 = gy1 * nbx + gx0, i11 = gy1 * nbx + gx1;
        var dxv = gdx[i00] * (1 - wxg) * (1 - wyg) + gdx[i10] * wxg * (1 - wyg) + gdx[i01] * (1 - wxg) * wyg + gdx[i11] * wxg * wyg;
        var dyv = gdy[i00] * (1 - wxg) * (1 - wyg) + gdy[i10] * wxg * (1 - wyg) + gdy[i01] * (1 - wxg) * wyg + gdy[i11] * wxg * wyg;
        var sx2 = Math.round(xr2 + dxv); if (sx2 < 0) sx2 = 0; else if (sx2 >= W) sx2 = W - 1;
        var sy2 = Math.round(yr2 + dyv); if (sy2 < 0) sy2 = 0; else if (sy2 >= H) sy2 = H - 1;
        var so2 = (sy2 * W + sx2) * 4, dor2 = (yr2 * W + xr2) * 4;
        odcW[dor2] = oDat[so2]; odcW[dor2 + 1] = oDat[so2 + 1]; odcW[dor2 + 2] = oDat[so2 + 2]; odcW[dor2 + 3] = 255;
      } }
    }
    // Baixa: passe corpo-por-cor só com trapping BAIXO (senão flooda). Média/Alta: roda
    // sempre (sobre o original localmente alinhado na Alta) — o FORÇA+CLUSTER lá embaixo
    // tira o flood. É o que faz o 28→29 do DUX (breathe 0.82) aparecer.
    if (structural && (sens >= 1 || !(al.breathe > (opts.breatheGate != null ? opts.breatheGate : 0.65)))) {
      try {
        var mask2 = new Uint8Array(W * H), fdc = fileImg.data, odc = odcW;
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
            // RAIO ASSIMÉTRICO — a chave para conviver com trapping:
            // o spread só ADICIONA tinta ao redor do objeto, nunca remove. Então:
            //  · cor do ARQUIVO procurada no ORIGINAL: raio LARGO (trapTol+1) — o
            //    engorde acha o glifo original ali do lado e não vira "a mais";
            //  · cor do ORIGINAL procurada no ARQUIVO: raio 1 — o que sumiu de verdade
            //    (o laço do 8 que virou 9) não tem para onde correr e é acusado.
            var mF5 = false, mO5 = false, dx5, dy5;
            for (dy5 = -1; dy5 <= 1 && !mF5; dy5++) for (dx5 = -1; dx5 <= 1; dx5++) if (pdiff(f5, x5 + dx5, y5 + dy5, 1) <= colorTol) { mF5 = true; break; }
            for (dy5 = -1; dy5 <= 1 && !mO5; dy5++) for (dx5 = -1; dx5 <= 1; dx5++) if (pdiff(f5, x5 + dx5, y5 + dy5, 0) <= colorTol) { mO5 = true; break; }
            if (!mF5 || !mO5) mask2[i5] = 1;
          }
        }
        // FAIXA TÉCNICA (barra de acabamento na borda da arte): banda escura e
        // atravessada (>50% da largura). CUIDADO: rótulo de FUNDO PRETO tem a arte
        // inteira assim — por isso a faixa só vale se for FINA (<=10% da altura) e
        // ENCOSTAR no topo ou na base. Sem isso, a arte toda virava zona morta e
        // escondia o erro real (caso DUX: 28→29 em bloco preto).
        var linhaEsc = new Uint8Array(H), bandaTec = new Uint8Array(H);
        for (y5 = 0; y5 < H; y5++) {
          var rw6 = y5 * W, dark6 = 0;
          for (x5 = 0; x5 < W; x5 += 2) {
            var q6 = (rw6 + x5) * 4;
            var lf6 = 0.299 * fdc[q6] + 0.587 * fdc[q6 + 1] + 0.114 * fdc[q6 + 2];
            var lo6 = 0.299 * odc[q6] + 0.587 * odc[q6 + 1] + 0.114 * odc[q6 + 2];
            if (lf6 < 80 || lo6 < 80) dark6++;
          }
          if (dark6 > (W / 2) * 0.5) linhaEsc[y5] = 1;
        }
        // agrupa as linhas escuras em faixas; só as FINAS e coladas na borda contam
        (function () {
          var yb = 0, lim = Math.max(6, Math.round(H * 0.10));
          while (yb < H) {
            if (!linhaEsc[yb]) { yb++; continue; }
            var y0b = yb;
            while (yb < H && linhaEsc[yb]) yb++;
            var alt = yb - y0b;
            if (alt <= lim && (y0b <= 3 || yb >= H - 3)) {
              for (var yy6 = y0b; yy6 < yb; yy6++) bandaTec[yy6] = 1;
            }
          }
        })();
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
        var _dbg = root.__ACDBG;   // {x0,y0,x1,y1} p/ rastrear por que um comp morre
        function _d(c, why) { if (_dbg && c.cx >= _dbg.x0 && c.cx <= _dbg.x1 && c.cy >= _dbg.y0 && c.cy <= _dbg.y1) { (root.__ACDBGOUT = root.__ACDBGOUT || []).push(c.cx + "," + c.cy + " " + c.w + "x" + c.h + " a" + c.area + " s" + (c.strength | 0) + " -> " + why); } }
        for (var k5 = 0; k5 < res5.comps.length; k5++) {
          var c5 = res5.comps[k5];
          if (c5.area < 6 || c5.area > 400) { _d(c5, "area " + c5.area); continue; }
          if (Math.min(c5.w, c5.h) < 3 || Math.max(c5.w, c5.h) > 40) { _d(c5, "dim " + c5.w + "x" + c5.h); continue; }   // casca fina/risco fora
          if (c5.area / Math.max(1, c5.w * c5.h) < 0.5) { _d(c5, "fill"); continue; }                            // corpo cheio, não anel
          if (bandaTec[Math.max(0, Math.min(H - 1, c5.cy))]) { _d(c5, "bandaTec"); continue; }   // marca de controle na faixa técnica
          var ac5 = lumAcc[c5.id];
          if (!ac5 || !ac5.n) continue;
          var dl5 = ac5.f / ac5.n - ac5.o / ac5.n; if (dl5 < 0) dl5 = -dl5;
          if (dl5 < 40) { _d(c5, "dLum " + dl5.toFixed(0)); continue; }
          c5.type = classifyComp(c5, fileImg, origImg, fileGray, origGray, W, H, tol);
          // PISO DE FORÇA por sensibilidade. 120 mata a troca em TEXTO CLARO PEQUENO SOBRE
          // FUNDO ESCURO: medido no DUX, o "(28 g)"→"(29 g)" tem força só 85-102 (letra
          // anti-aliased, a diferença fica em tom intermediário). Na Alta baixa p/ 80 e o
          // FORÇA+CLUSTER/mescla lá embaixo é quem segura o ruído extra. Recall-first.
          if (c5.strength < (sens >= 2 ? 80 : 120)) { _d(c5, "forca " + (c5.strength|0)); continue; }
          // dedup contra comp já existente (evita marcar 2×). Marcador de texto (kind:text,
          // vago e escondido sem OCR) NÃO bloqueia — senão engolia a deleção real dentro dele.
          var dup5 = false, e5;
          for (e5 = 0; e5 < comps.length && !dup5; e5++) {
            var ce5 = comps[e5]; if (ce5.kind === "text") continue;
            if (c5.cx >= ce5.x - 8 && c5.cx <= ce5.x + ce5.w + 8 && c5.cy >= ce5.y - 8 && c5.cy <= ce5.y + ce5.h + 8) dup5 = true;
          }
          // NÃO excluir por estar dentro de textRegion (23/07): com o OCR desligado, uma
          // deleção REAL de letra/pontuação (l do "200 ml", R do "INGR") cai numa região de
          // texto re-estilizada e sumia (virava marcador vago escondido). Os critérios acima
          // (dLum≥40, força≥120, fill≥0.5, corpo cheio) já garantem que é deleção real e NÃO
          // trapping (trapping estende o pixel, não muda a cor) — então pode marcar aqui.
          if (dup5) { _d(c5, "dup"); continue; }
          c5.ids = [c5.id];
          _d(c5, "ACEITO");
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
    // jsQR é SENSÍVEL À RESOLUÇÃO (falha em certas escalas — ex.: bate no 3400 do painel, mas lê
    // em 2800/4200). Reamostra e tenta várias escalas; devolve a leitura + fator p/ mapear a posição.
    // downscale por MÉDIA (box) — jsQR é sensível à escala; box-downscale do render limpo faz
    // o QR "fechar" numa escala boa (medido: 3400 falha, 2600/2400 lê). Nearest NÃO resolve.
    function _boxDown(img, iw, ih, nw, nh) {
      var out = new Uint8ClampedArray(nw * nh * 4), dd = img.data, rx = iw / nw, ry = ih / nh, x, y;
      for (y = 0; y < nh; y++) { var y0 = (y * ry) | 0, y1 = Math.min(ih, ((y + 1) * ry) | 0) || y0 + 1;
        for (x = 0; x < nw; x++) { var x0 = (x * rx) | 0, x1 = Math.min(iw, ((x + 1) * rx) | 0) || x0 + 1, r = 0, g = 0, b = 0, n = 0;
          for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { var so = (yy * iw + xx) * 4; r += dd[so]; g += dd[so + 1]; b += dd[so + 2]; n++; }
          var dt = (y * nw + x) * 4, v = n || 1; out[dt] = r / v; out[dt + 1] = g / v; out[dt + 2] = b / v; out[dt + 3] = 255; } }
      return out;
    }
    function qrMulti(img) {
      if (!root.jsQR) return null;
      var q = root.jsQR(img.data, W, H); if (q && q.data) return { q: q, f: 1 };
      var alvos = [2600, 2400, 2800, 2200, 3000, 2000];   // só downscale (média)
      for (var i = 0; i < alvos.length; i++) {
        var nw = alvos[i]; if (nw >= W - 60 || nw < 400) continue;
        var nh = Math.round(H * nw / W);
        var q2 = root.jsQR(_boxDown(img, W, H, nw, nh), nw, nh);
        if (q2 && q2.data) return { q: q2, f: W / nw };   // f mapeia coords -> espaço nativo
      }
      return null;
    }
    if (root.jsQR) {
      try {
        var rf = qrMulti(fileImg), qf = rf ? rf.q : null, ff = rf ? rf.f : 1;
        var ro = qf ? qrMulti(origImg) : null, qo = ro ? ro.q : null, fo = ro ? ro.f : 1;
        if (qf && qf.data) {
          var lc = qf.location;
          // mapeia a location de volta ao espaço nativo (W×H) pelo fator da escala que leu
          lc = { topLeftCorner: { x: lc.topLeftCorner.x * ff, y: lc.topLeftCorner.y * ff },
                 topRightCorner: { x: lc.topRightCorner.x * ff, y: lc.topRightCorner.y * ff },
                 bottomLeftCorner: { x: lc.bottomLeftCorner.x * ff, y: lc.bottomLeftCorner.y * ff },
                 bottomRightCorner: { x: lc.bottomRightCorner.x * ff, y: lc.bottomRightCorner.y * ff } };
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

    // ===== LIMPEZA FORMA (validado na bancada: Coca 13→3 reais, DUX limpa, 0 falso) =====
    // Roda no FINAL, sobre o conjunto já montado (texto/corpo-por-cor/barcode/QR). No modo
    // forma (original×tratado) sobram 3 FALSOS que a assinatura por BBOX separa da edição
    // real (ink% dos 2 lados no retângulo do comp): edição real = fill ASSIMÉTRICO (tinta
    // num lado só); objeto grande re-tonalizado (logo/texto engordado) = fill SIMÉTRICO e
    // CHEIO nos 2. kind (texto/barcode/QR) é ISENTO. Casa com "edição real ≥147 de força".
    if (structural && comps.length) {
      var fdC = fileImg.data, odC = origImg.data;
      var bboxSig = function (c) {
        var xe = Math.min(W, c.x + c.w), ye = Math.min(H, c.y + c.h), xb, yb, inkF = 0, inkO = 0, ds = 0, nb = 0;
        for (yb = c.y; yb < ye; yb++) { var rwb = yb * W; for (xb = c.x; xb < xe; xb++) { var qb = (rwb + xb) * 4;
          var lfb = 0.299 * fdC[qb] + 0.587 * fdC[qb + 1] + 0.114 * fdC[qb + 2], lob = 0.299 * odC[qb] + 0.587 * odC[qb + 1] + 0.114 * odC[qb + 2];
          var db = lfb - lob; if (db < 0) db = -db; ds += db; if (lfb < 200) inkF++; if (lob < 200) inkO++; nb++; } }
        if (!nb) nb = 1; return { fillF: inkF / nb * 100, fillO: inkO / nb * 100, dLum: ds / nb };
      };
      for (var cf = comps.length - 1; cf >= 0; cf--) {
        var cc = comps[cf]; if (cc.kind) continue;
        var areaC = cc.area || (cc.w * cc.h);
        // TESTES BARATOS PRIMEIRO (só área/força/geometria). O bboxSig varre o retângulo do
        // comp e, com os pisos baixos da Alta, são centenas de comps — calcular antes custava
        // ~10s. Só quem sobrevive aos baratos paga a assinatura.
        if (areaC < 30 && (cc.strength || 0) < (sens >= 2 ? 85 : 140)) { comps.splice(cf, 1); continue; }
        if (Math.min(cc.w, cc.h) <= 1 && areaC < 20) { comps.splice(cf, 1); continue; }
        var bs = bboxSig(cc), dFill = bs.fillF - bs.fillO; if (dFill < 0) dFill = -dFill;
        // R1: objeto grande RE-TONALIZADO — tinta cheia e simétrica nos 2 lados (não é add/del)
        if (areaC > 500 && bs.fillF > 90 && bs.fillO > 90 && dFill < 10) { comps.splice(cf, 1); continue; }
        // R3: tira de sangria/borda do canvas, diferença SUTIL (não é conteúdo)
        if ((cc.x <= 2 || (cc.x + cc.w) >= W - 2) && bs.dLum < 25) { comps.splice(cf, 1); continue; }
      }
    }

    // ===== FORÇA + CLUSTER (Média/Alta sens) — recall-first sob trapping/textura =====
    // Com o passe ligado sob trapping, sobra flood de comps FRACOS (o engorde) e SPECKLES
    // da textura re-amostrada. A troca REAL é FORTE (≥ limiar) e AGRUPADA (dígito/palavra);
    // trapping é fraco, textura é speckle espalhado. Filtra por força e agrupa: cluster
    // denso vira 1 marcador; se há poucos comps fortes (arte limpa), mostra todos.
    var nKind0 = 0, iK; for (iK = 0; iK < comps.length; iK++) if (!comps[iK].kind) nKind0++;
    // Age quando há acúmulo de comps (trapping/textura). Arte quase limpa (Coca, ≤15) passa
    // DIRETO — a Alta nunca perde o que a Baixa acha. No flood, filtra por força e MESCLA.
    if (structural && sens >= 1 && nKind0 > 15) {
      // 85 no Alta: MEDIDO no DUX, a troca "(28 g)"→"(29 g)" (texto claro pequeno em fundo
      // escuro, anti-aliased) tem força só 85-102. Cortar em 130/147 a fazia sumir. Quem
      // segura o ruído extra é o CLUSTER+MESCLA abaixo, não o limiar de força.
      var THs = sens >= 2 ? 85 : 170;
      var strongC = [], otherC = [], iC;
      for (iC = 0; iC < comps.length; iC++) {
        var cC = comps[iC];
        if (cC.kind) { otherC.push(cC); continue; }          // barcode/QR/texto-marcador: intocado
        if ((cC.strength || 0) >= THs) strongC.push(cC);     // fraco (trapping) descartado
      }
      root.__ACNSTRONG = strongC.length;
      var parC = [], gC; for (gC = 0; gC < strongC.length; gC++) parC[gC] = gC;
      var findC = function (a) { while (parC[a] !== a) { parC[a] = parC[parC[a]]; a = parC[a]; } return a; };
      // CLUSTER ANISOTRÓPICO — a chave p/ apontar o LOCAL EXATO do texto errado.
      // Raio circular grande junta linhas vizinhas (as linhas ficam a ~37px) e a marca vira o
      // parágrafo inteiro, sem indicar nada. Texto se organiza em LINHAS: junta bastante na
      // HORIZONTAL (palavra/número: gaps até ~40px) e pouquíssimo na VERTICAL (não pula de
      // linha). Assim o "(29 g)" do DUX vira uma caixa de ~80×20 em cima dele, e não o bloco.
      var RCLx = sens >= 2 ? (opts.rclX || 55) : 55, RCLy = sens >= 2 ? (opts.rclY || 6) : 55, aC, bC;
      for (aC = 0; aC < strongC.length; aC++) for (bC = aC + 1; bC < strongC.length; bC++) {
        var dcx = strongC[aC].cx - strongC[bC].cx; if (dcx < 0) dcx = -dcx;
        var dcy = strongC[aC].cy - strongC[bC].cy; if (dcy < 0) dcy = -dcy;
        if (dcx <= RCLx && dcy <= RCLy) parC[findC(aC)] = findC(bC);
      }
      var grpC = {}; for (gC = 0; gC < strongC.length; gC++) { var rC = findC(gC); (grpC[rC] = grpC[rC] || []).push(strongC[gC]); }
      // quanto mais flood, mais denso o cluster tem que ser p/ passar (textura re-amostrada
      // vira MUITO speckle; a troca real AGRUPA num dígito/palavra). Poucos comps (arte quase
      // limpa) = mostra tudo. O par SOLTO (n=2) da borda do DUX cai; o "(29 g)" (n≥3) fica.
      // Alta: minN FIXO em 3. O formula-por-volume subia p/ 4 e matava o cluster da troca real
      // (o "(29 g)" do DUX tem exatamente 3 comps) — a marca precisa APONTAR o texto errado.
      var minN = opts.minN || (sens >= 2 ? 3 : (strongC.length > 60 ? 4 : strongC.length > 12 ? 3 : 1)), kk, markers = [];
      for (kk in grpC) {
        var gg = grpC[kk];
        var mx0 = 1e9, my0 = 1e9, mx1 = -1, my1 = -1, msC = 0, tp = "diff", qc;
        for (qc = 0; qc < gg.length; qc++) { var cg = gg[qc];
          if (cg.x < mx0) mx0 = cg.x; if (cg.y < my0) my0 = cg.y;
          if (cg.x + cg.w > mx1) mx1 = cg.x + cg.w; if (cg.y + cg.h > my1) my1 = cg.y + cg.h;
          if ((cg.strength || 0) > msC) { msC = cg.strength || 0; tp = cg.type; }
        }
        // SOBREVIVE se for AGRUPADO (≥minN: troca fraca mas concentrada — o "(29 g)" do DUX
        // é 3 comps de força 91-113) OU FORTE SOZINHO (≥120 — o R/l/ponto da Coca é 1 comp de
        // 120-173). A isenção do "forte sozinho" só vale em arte POUCO ruidosa (≤40 comps):
        // no trapping pesado (DUX) o ruído isolado também chega a 165 e inundaria. Exigir só
        // densidade matava a Coca; só força matava o DUX; o volume decide (medido: Coca 48 comps
        // fortes, DUX 235, Perdigão 491 -> corte em 100 separa arte limpa de trapping pesado).
        // Limiar do "forte sozinho" GRADUADO pelo volume (medido: Coca 48 comps fortes, DUX
        // 235, Perdigão 491): arte limpa aceita 120 (o R=134/l=120 da Coca); com trapping
        // pesado sobe p/ 170, porque ali o ruído isolado chega a 165 — e o 0763 do Perdigão,
        // que fica em texto INCLINADO (o cluster por linha não o pega), tem 173-201 e passa.
        var soloTh = strongC.length <= 100 ? 120 : 170;
        if (gg.length < minN && msC < soloTh) continue;
        // PISO DO MARCADOR: mesmo agrupado, uma marca precisa de pelo menos um comp com
        // força razoável. Corta a cauda fraca do trapping sem tocar nas trocas reais
        // (medido: DUX "(29 g)"=113, Coca l=120/R=134/ponto=173, Perdigão 0763=173-201).
        if (msC < (opts.markTh != null ? opts.markTh : (sens >= 2 ? 108 : 0))) continue;
        var mwC = mx1 - mx0, mhC = my1 - my0;
        if (Math.min(mwC, mhC) <= 3 && Math.max(mwC, mhC) > 120) continue;   // fio de dobra/faca
        markers.push({ x: mx0, y: my0, w: mwC, h: mhC, cx: (mx0 + mx1) >> 1, cy: (my0 + my1) >> 1,
                       area: mwC * mhC, type: tp, strength: msC, ids: [] });
      }
      // MESCLA FINAL de marcas FORTES adjacentes: texto INCLINADO (o bloco do registro do
      // Perdigão) não forma cluster por linha, então cada dígito vira uma marca solta — 9
      // caixas para UM erro. Junta só as fortes (>=170) e vizinhas; as fracas (trapping do
      // DUX, <=148) ficam intactas, senão as linhas voltariam a virar bloco.
      var MG = 1;
      while (MG) {
        MG = 0;
        for (var m1 = 0; m1 < markers.length && !MG; m1++) {
          if ((markers[m1].strength || 0) < 170) continue;
          for (var m2 = m1 + 1; m2 < markers.length; m2++) {
            if ((markers[m2].strength || 0) < 170) continue;
            var A = markers[m1], B = markers[m2];
            var gx = Math.max(A.x, B.x) - Math.min(A.x + A.w, B.x + B.w);
            var gy = Math.max(A.y, B.y) - Math.min(A.y + A.h, B.y + B.h);
            if (gx <= 50 && gy <= 25) {
              var nx0 = Math.min(A.x, B.x), ny0 = Math.min(A.y, B.y);
              var nx1 = Math.max(A.x + A.w, B.x + B.w), ny1 = Math.max(A.y + A.h, B.y + B.h);
              A.x = nx0; A.y = ny0; A.w = nx1 - nx0; A.h = ny1 - ny0;
              A.cx = (nx0 + nx1) >> 1; A.cy = (ny0 + ny1) >> 1; A.area = A.w * A.h;
              if ((B.strength || 0) > (A.strength || 0)) { A.strength = B.strength; A.type = B.type; }
              markers.splice(m2, 1); MG = 1; break;
            }
          }
        }
      }
      comps = otherC.concat(markers);
    }

    // itens especiais primeiro (barcode > texto), depois por área
    comps.sort(function (a, b) {
      var ka = a.kind === "barcode" ? 2 : a.kind === "text" ? 1 : 0;
      var kb = b.kind === "barcode" ? 2 : b.kind === "text" ? 1 : 0;
      if (ka !== kb) return kb - ka;
      return b.area - a.area;
    });
    var counts = { miss: 0, extra: 0, diff: 0, ok: 0, check: 0 };
    for (var m2 = 0; m2 < comps.length; m2++) if (counts[comps[m2].type] != null) counts[comps[m2].type]++;

    return { W: W, H: H, lab: res.lab, fileImg: fileImg, origImg: origImg,
             comps: comps, counts: counts, align: al, prescaled: prescaled, fileRect: fileRect,
             origRect: origRect,   // tamanho do render do ORIGINAL na tela comum (páginas
                                   // de tamanhos diferentes) — a fase B mapeia o crop por ele
             mode: structural ? "forma" : "cor", modeAuto: modeAuto, barcode: barcode,
             textRegions: textRegions, textResid: textResid };
  }

  // v aparece na barra do painel: se não bater com esta, o CEP está com o motor
  // ANTIGO em cache (fechar e reabrir o painel/Illustrator resolve).
  // ===== CONFIRMAÇÃO DE TROCA DE TEXTO POR IMAGEM =====
  // Dados os DOIS recortes em alta resolução (F e O) de um candidato, decide se a troca é
  // REAL olhando os PIXELS — não a leitura do OCR (que erra em rótulo denso/trapado).
  // Alinha os recortes, mede a tinta de um lado SEM correspondente no outro (com folga de
  // trapping) e agrupa esse resíduo. Troca real de caractere = 1 aglomerado CONCENTRADO.
  // Trapping (mesma forma, borda gorda) e ruído de OCR (mesma imagem) = resíduo ~0.
  // Recorte que caiu em conteúdo diferente/desalinhado = resíduo ESPALHADO. Serve p/
  // texto E número igual. Retorna { real, bx, by, frac, big, spread }.
  function confirmTextChange(fImg, oImg, opts) {
    opts = opts || {};
    if (!fImg || !oImg || !fImg.data || !oImg.data) return { real: false };
    function inkMask(img) {
      var W = img.width, H = img.height, n = W * H, d = img.data, g = new Float32Array(n), soma = 0, i, j = 0;
      for (i = 0; i < n; i++) { g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114; soma += g[i]; j += 4; }
      var escuro = soma / n < 118, m = new Uint8Array(n);   // fundo escuro -> tinta clara
      for (i = 0; i < n; i++) { var v = escuro ? 255 - g[i] : g[i]; if (v < 120) m[i] = 1; }
      return { m: m, W: W, H: H };
    }
    var A = inkMask(fImg), B = inkMask(oImg);
    var W = Math.min(A.W, B.W), H = Math.min(A.H, B.H);
    if (W < 10 || H < 10) return { real: false };
    // alinhamento fino: offset (±R) que MAXIMIZA a sobreposição de tinta
    function ov(ox, oy) {
      var s = 0, x, y;
      for (y = 1; y < H - 1; y += 2) { var by = y + oy; if (by < 1 || by >= B.H - 1) continue;
        for (x = 1; x < W - 1; x += 2) { var bx = x + ox; if (bx < 1 || bx >= B.W - 1) continue; if (A.m[y * A.W + x] && B.m[by * B.W + bx]) s++; } }
      return s;
    }
    var R = 7, best = -1, BX = 0, BY = 0, ox, oy;
    for (oy = -R; oy <= R; oy++) for (ox = -R; ox <= R; ox++) { var s2 = ov(ox, oy); if (s2 > best) { best = s2; BX = ox; BY = oy; } }
    var tol = opts.tol != null ? opts.tol : 2;
    function near(mask, MW, MH, x, y) {
      for (var dy = -tol; dy <= tol; dy++) { var yy = y + dy; if (yy < 0 || yy >= MH) continue; var row = yy * MW;
        for (var dx = -tol; dx <= tol; dx++) { var xx = x + dx; if (xx < 0 || xx >= MW) continue; if (mask[row + xx]) return true; } }
      return false;
    }
    var resid = new Uint8Array(W * H), inkA = 0, inkB = 0, x, y;
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      var a = A.m[y * A.W + x], bx2 = x + BX, by2 = y + BY;
      var inB = bx2 >= 0 && by2 >= 0 && bx2 < B.W && by2 < B.H, b = inB ? B.m[by2 * B.W + bx2] : 0;
      if (a) inkA++; if (b) inkB++;
      if (a && !(inB && near(B.m, B.W, B.H, bx2, by2))) resid[y * W + x] = 1;
      else if (b && !near(A.m, A.W, A.H, x, y)) resid[y * W + x] = 1;
    }
    var totalInk = Math.min(inkA, inkB);
    if (totalInk < 40) return { real: false, frac: 0 };
    // despeckle (tira pixel solto de anti-alias)
    var p;
    for (p = 0; p < W * H; p++) if (resid[p]) {
      var viz = 0, px = p % W, py = (p / W) | 0;
      if (px > 0 && resid[p - 1]) viz++; if (px < W - 1 && resid[p + 1]) viz++;
      if (py > 0 && resid[p - W]) viz++; if (py < H - 1 && resid[p + W]) viz++;
      if (viz === 0) resid[p] = 0;
    }
    // ===== PERFIL POR COLUNA (diferencial) =====
    // O trapping engorda TODAS as letras -> resíduo uniforme (o "tapete"). A troca de
    // caractere é resíduo EXTRA concentrado numas colunas. Comparo resíduo/tinta de cada
    // coluna com a MEDIANA (a base do trapping): coluna muito acima = a troca.
    var colR = new Float32Array(W), colI = new Float32Array(W), ratios = [];
    for (x = 0; x < W; x++) {
      var rr = 0, ii = 0;
      for (y = 1; y < H - 1; y++) { var idx = y * W + x; if (resid[idx]) rr++; if (A.m[y * A.W + x] || (x + BX >= 0 && y + BY >= 0 && x + BX < B.W && y + BY < B.H && B.m[(y + BY) * B.W + (x + BX)])) ii++; }
      colR[x] = rr; colI[x] = ii;
      if (ii >= 3) ratios.push(rr / ii);
    }
    if (ratios.length < 4) return { real: false, frac: 0 };
    ratios.sort(function (a, b) { return a - b; });
    var base = ratios[(ratios.length / 2) | 0];                 // mediana = nível do trapping
    var lim = Math.max(0.35, base + 0.22, base * 1.7);          // pico = troca
    // maior RUN de colunas acima do limite (a mudança é contígua: um ou mais chars)
    var run = 0, bestRun = 0, runX0 = 0, bestX0 = 0, bestX1 = 0, runSum = 0, bestSum = 0;
    for (x = 0; x < W; x++) {
      var alto = colI[x] >= 3 && (colR[x] / Math.max(1, colI[x])) > lim && colR[x] >= 3;
      if (alto) { if (run === 0) { runX0 = x; runSum = 0; } run++; runSum += colR[x]; }
      else { if (run > bestRun) { bestRun = run; bestX0 = runX0; bestX1 = x - 1; bestSum = runSum; } run = 0; }
    }
    if (run > bestRun) { bestRun = run; bestX0 = runX0; bestX1 = W - 1; bestSum = runSum; }
    // altura típica do texto (linhas com tinta) -> largura mínima de ~meio caractere
    var linhasInk = 0;
    for (y = 0; y < H; y++) { var ci = 0; for (x = 0; x < W; x++) if (A.m[y * A.W + x]) ci++; if (ci > W * 0.03) linhasInk++; }
    var charH = Math.max(8, linhasInk), minRun = Math.max(4, Math.round(charH * 0.35));
    var real = bestRun >= minRun && bestSum >= charH * 4 && base < 0.9;   // base~1 = conteúdo totalmente diferente
    return { real: real, bx: (bestX0 + bestX1) >> 1, by: H >> 1,
             bw: bestX1 - bestX0 + 1, bh: charH, frac: base, big: bestRun, spread: bestSum, clusters: ratios.length,
             base: Math.round(base * 100) / 100, lim: Math.round(lim * 100) / 100, minRun: minRun, minBig: minRun };
  }

  // v27 = piso do marcador + mescla de marcas fortes (menos falso). v26 = cluster ANISOTROPICO (aponta o texto errado) + solo graduado. v25 = pisos de força sensíveis ao nível (o 28→29 do DUX tem força 91-113). v24 = sensibilidade (Baixa/Média/Alta) + registro local suave + força/cluster/mescla.
  // Se a barra do painel NÃO mostrar v24, o CEP está com o motor em CACHE (fechar/reabrir).
  root.ACEngine = { compare: compare, overlay: buildOverlay, confirmTextChange: confirmTextChange, v: 27 };

})(window);

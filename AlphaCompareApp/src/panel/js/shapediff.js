/* ============================================================
 * Alpha Compare - DETECTOR DE DEFEITOS DE FORMA (estilo Precision Proof)
 * Pega o que o OCR NÃO pega: letra "e" preenchida (miolo tampado), ponto/acento
 * FALTANDO, caractere QUEBRADO, pingo do "i" sumido — defeitos de PIXEL/forma em
 * que a palavra continua a mesma (o OCR lê igual).
 *
 * Roda DEPOIS do ACEngine (que já registrou os 2 lados na mesma escala + translação).
 * Método (o MESMO dos inspetores profissionais):
 *   1) OPTICAL FLOW (Demons piramidal): warpa o ORIGINAL até casar pixel-a-pixel com o
 *      arquivo (deformação local sub-pixel, coarse-to-fine). Mata o micro-desalinho que o
 *      registro global deixa. O campo roda em baixa resolução (rápido) e é upsampleado.
 *   2) RESIDUAL POLARIDADE-AGNÓSTICO |arquivo - original_warpado|: pega defeito tanto em
 *      texto ESCURO-no-claro quanto CLARO-no-escuro (a marca de tinta branca no fundo escuro
 *      também sobressai). Sobra só o que genuinamente difere (o warp já casou alinhamento).
 *   3) COMPACTO + SÓLIDO + ISOLADO -> candidato de forma. Recall-first: marca os top-N
 *      candidatos ("conferir"); o operador decide.
 * ============================================================ */
(function (root) {
  "use strict";

  function toGray(img) {
    var n = img.width * img.height, g = new Uint8Array(n), d = img.data, i, j = 0;
    for (i = 0; i < n; i++, j += 4) g[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
    return g;
  }
  // downsample por AMOSTRA (rápido) de uma ImageData p/ largura alvo (mantém proporção)
  function downTo(img, alvoW) {
    var W = img.width, H = img.height;
    if (W <= alvoW) return img;
    var f = W / alvoW, W2 = alvoW, H2 = Math.max(1, Math.round(H / f));
    var o = { data: new Uint8ClampedArray(W2 * H2 * 4), width: W2, height: H2 }, sd = img.data, dd = o.data;
    for (var y = 0; y < H2; y++) { var sy = (y * f) | 0; for (var x = 0; x < W2; x++) { var sx = (x * f) | 0, s = (sy * W + sx) * 4, t = (y * W2 + x) * 4; dd[t] = sd[s]; dd[t + 1] = sd[s + 1]; dd[t + 2] = sd[s + 2]; dd[t + 3] = 255; } }
    return o;
  }
  // downsample de um mapa cinza (Uint8 WxH) -> Float32 (W2xH2) por amostra
  function grayDown(g, W, H, W2) {
    if (W <= W2) { var c = new Float32Array(W * H), q; for (q = 0; q < W * H; q++) c[q] = g[q]; return { g: c, W: W, H: H }; }
    var f = W / W2, H2 = Math.max(1, Math.round(H / f)), o = new Float32Array(W2 * H2);
    for (var y = 0; y < H2; y++) { var sy = (y * f) | 0; for (var x = 0; x < W2; x++) o[y * W2 + x] = g[sy * W + ((x * f) | 0)]; }
    return { g: o, W: W2, H: H2 };
  }

  // ---- Demons (optical flow) ----
  function boxBlur(a, W, H, r) {
    var tmp = new Float32Array(W * H), i, x, y, s, inv = 1 / (2 * r + 1);
    for (y = 0; y < H; y++) { s = 0; for (x = -r; x <= r; x++) s += a[y * W + Math.min(W - 1, Math.max(0, x))]; for (x = 0; x < W; x++) { tmp[y * W + x] = s * inv; s += a[y * W + Math.min(W - 1, Math.max(0, x + r + 1))] - a[y * W + Math.min(W - 1, Math.max(0, x - r))]; } }
    for (x = 0; x < W; x++) { s = 0; for (y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (y = 0; y < H; y++) { a[y * W + x] = s * inv; s += tmp[Math.min(H - 1, Math.max(0, y + r + 1)) * W + x] - tmp[Math.min(H - 1, Math.max(0, y - r)) * W + x]; } }
  }
  function warpF(O, W, H, dx, dy, out) {
    for (var y = 0; y < H; y++) { var row = y * W; for (var x = 0; x < W; x++) { var i = row + x, fx = x + dx[i], fy = y + dy[i], x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0; if (x0 < 0) { x0 = 0; tx = 0; } else if (x0 >= W - 1) { x0 = W - 2; tx = 1; } if (y0 < 0) { y0 = 0; ty = 0; } else if (y0 >= H - 1) { y0 = H - 2; ty = 1; } var o0 = y0 * W + x0, a = O[o0], b = O[o0 + 1], c = O[o0 + W], e = O[o0 + W + 1], ix0 = a + (b - a) * tx, ix1 = c + (e - c) * tx; out[i] = ix0 + (ix1 - ix0) * ty; } }
  }
  function halfF(a, W, H) {
    var W2 = W >> 1, H2 = H >> 1, o = new Float32Array(W2 * H2);
    for (var y = 0; y < H2; y++) for (var x = 0; x < W2; x++) o[y * W2 + x] = 0.25 * (a[(2 * y) * W + 2 * x] + a[(2 * y) * W + 2 * x + 1] + a[(2 * y + 1) * W + 2 * x] + a[(2 * y + 1) * W + 2 * x + 1]);
    return { g: o, W: W2, H: H2 };
  }
  function upField(f, W, H, W2, H2) {
    var o = new Float32Array(W2 * H2), sx = W / W2, sy = H / H2;
    for (var y = 0; y < H2; y++) { var y0 = Math.min(H - 1, (y * sy) | 0); for (var x = 0; x < W2; x++) o[y * W2 + x] = f[y0 * W + Math.min(W - 1, (x * sx) | 0)]; }
    return o;
  }
  function demonsLvl(F, O, W, H, dx, dy, it, rr, cap) {
    var Ow = new Float32Array(W * H), i, x, y;
    for (var t = 0; t < it; t++) {
      warpF(O, W, H, dx, dy, Ow);
      for (y = 1; y < H - 1; y++) { var row = y * W; for (x = 1; x < W - 1; x++) { i = row + x; var gx = 0.5 * (Ow[i + 1] - Ow[i - 1]), gy = 0.5 * (Ow[i + W] - Ow[i - W]), diff = F[i] - Ow[i], den = gx * gx + gy * gy + diff * diff; if (den > 1e-3) { var f2 = diff / den; dx[i] += f2 * gx; dy[i] += f2 * gy; } } }
      boxBlur(dx, W, H, rr); boxBlur(dy, W, H, rr);
      for (i = 0; i < W * H; i++) { var m = dx[i] * dx[i] + dy[i] * dy[i]; if (m > cap * cap) { var s2 = cap / Math.sqrt(m); dx[i] *= s2; dy[i] *= s2; } }
    }
  }
  function pyrDemons(F, O, W, H, iters, rr, cap) {
    var pf = [{ g: F, W: W, H: H }], po = [{ g: O, W: W, H: H }];
    while (pf[pf.length - 1].W > 150) { var l = pf[pf.length - 1], m = po[po.length - 1]; pf.push(halfF(l.g, l.W, l.H)); po.push(halfF(m.g, m.W, m.H)); }
    var dx = null, dy = null;
    for (var L = pf.length - 1; L >= 0; L--) {
      var lw = pf[L].W, lh = pf[L].H;
      if (dx === null) { dx = new Float32Array(lw * lh); dy = new Float32Array(lw * lh); }
      else { var plw = pf[L + 1].W, plh = pf[L + 1].H, sc = lw / plw; var ndx = upField(dx, plw, plh, lw, lh), ndy = upField(dy, plw, plh, lw, lh); for (var q = 0; q < lw * lh; q++) { ndx[q] *= sc; ndy[q] *= sc; } dx = ndx; dy = ndy; }
      demonsLvl(pf[L].g, po[L].g, lw, lh, dx, dy, iters[Math.min(L, iters.length - 1)], rr, cap);
    }
    return { dx: dx, dy: dy, W: W, H: H };
  }

  // fileImg/origImg: ImageData JÁ ALINHADAS pelo ACEngine (mesmo frame WxH). opts: {workW, demW, resTh, minPx, maxCands}
  // -> [{x,y,w,h,cx,cy,area,type:'diff',kind:'shape',shape:'fill'|'miss'}] no frame ORIGINAL (WxH do fileImg)
  function detect(fileImg, origImg, opts) {
    opts = opts || {};
    if (!fileImg || !origImg) return [];
    if (fileImg.width !== origImg.width || fileImg.height !== origImg.height) return []; // precisam do mesmo frame
    var FW = fileImg.width, FH = fileImg.height;
    var workW = opts.workW || 2000;
    var f = downTo(fileImg, workW), o = downTo(origImg, workW);
    var W = f.width, H = f.height, k = FW / W;   // fator p/ voltar ao frame original
    var gF = toGray(f), gO = toGray(o);

    // 1) OPTICAL FLOW: campo em baixa resolução (rápido), upsampleado pro diff.
    var demW = Math.min(W, opts.demW || 1200);
    var Flo = grayDown(gF, W, H, demW), Olo = grayDown(gO, W, H, demW);
    var fld = pyrDemons(Flo.g, Olo.g, Flo.W, Flo.H, [36, 26, 16, 8, 5, 4], 2, 4);
    var scw = W / fld.W, sch = H / fld.H;
    var DX = upField(fld.dx, fld.W, fld.H, W, H), DY = upField(fld.dy, fld.W, fld.H, W, H);
    var q; for (q = 0; q < W * H; q++) { DX[q] *= scw; DY[q] *= sch; }
    var gOf = new Float32Array(W * H); for (q = 0; q < W * H; q++) gOf[q] = gO[q];
    var gOw = new Float32Array(W * H); warpF(gOf, W, H, DX, DY, gOw);

    // 2) RESIDUAL POLARIDADE-AGNÓSTICO
    var big = new Uint8Array(W * H), x, y, i;
    var TR = opts.resTh || 70;
    for (i = 0; i < W * H; i++) { var dR = gF[i] - gOw[i]; if (dR < 0) dR = -dR; big[i] = dR > TR ? 1 : 0; }

    // 3) BLOBS (conexos) no residual
    var lab = new Int32Array(W * H), stk = new Int32Array(W * H), comps = [], Mg = Math.max(18, (Math.min(W, H) * 0.02) | 0);
    for (i = 0; i < W * H; i++) {
      if (!big[i] || lab[i]) continue;
      var id = comps.length + 1, sp = 0, mnx = W, mny = H, mxx = 0, mxy = 0, cnt = 0, tc = false;
      stk[sp++] = i; lab[i] = id;
      while (sp) { var p = stk[--sp], px = p % W, py = (p / W) | 0; cnt++;
        if (px < mnx) mnx = px; if (px > mxx) mxx = px; if (py < mny) mny = py; if (py > mxy) mxy = py;
        if (px < Mg || py < Mg || px > W - Mg || py > H - Mg) tc = true;
        var nb = [p - 1, p + 1, p - W, p + W], qn; for (var kk = 0; kk < 4; kk++) { qn = nb[kk]; if (qn >= 0 && qn < W * H && big[qn] && !lab[qn]) { lab[qn] = id; stk[sp++] = qn; } }
      }
      comps.push({ mnx: mnx, mny: mny, mxx: mxx, mxy: mxy, cnt: cnt, tc: tc });
    }

    // ISOLADO? Defeito real (e preenchida, ponto) é isolado numa região que bate; linha/bloco
    // mal-registrado tem residual em volta toda. Conta o residual VIZINHO (fora do blob).
    function ehIsolado(mnx, mny, mxx, mxy, ownCnt) {
      var pad = 32, x0 = Math.max(0, mnx - pad), y0 = Math.max(0, mny - pad), x1 = Math.min(W, mxx + pad), y1 = Math.min(H, mxy + pad);
      var near = 0, xx, yy;
      for (yy = y0; yy < y1; yy += 2) for (xx = x0; xx < x1; xx += 2) if (big[yy * W + xx]) near++;
      return (near * 4 - ownCnt) < ownCnt * 1.5 + 40;
    }
    // 4) COMPACTO + SÓLIDO + ISOLADO -> candidatos (recall-first, top N por força)
    var cands = [], minPx = opts.minPx || 9, maxC = opts.maxCands || 10;
    for (i = 0; i < comps.length; i++) {
      var c = comps[i], w = c.mxx - c.mnx + 1, h = c.mxy - c.mny + 1;
      if (c.tc || c.cnt < minPx || w > 46 || h > 46) continue;             // borda / ruído / grande demais
      if (Math.max(w, h) / Math.min(w, h) > 3.5) continue;                 // fino = borda deslocada
      var solid = c.cnt / (w * h);
      if (solid < 0.45) continue;                                          // esparso = resíduo, não defeito sólido
      if (!ehIsolado(c.mnx, c.mny, c.mxx, c.mxy, c.cnt)) continue;         // região cheia de diff = deslocamento
      // rótulo best-effort: lado com mais TINTA (média mais escura) = "a mais"; senão "faltando"
      var sF = 0, sO = 0, nn = 0;
      for (y = c.mny; y <= c.mxy; y++) for (x = c.mnx; x <= c.mxx; x++) { sF += gF[y * W + x]; sO += gOw[y * W + x]; nn++; }
      cands.push({ mnx: c.mnx, mny: c.mny, mxx: c.mxx, mxy: c.mxy, w: w, h: h, cnt: c.cnt,
                   shape: (sF / nn) < (sO / nn) ? "fill" : "miss", score: c.cnt * solid });
    }
    cands.sort(function (a, b) { return b.score - a.score; });
    var keep = cands.slice(0, maxC);

    // marcadores de volta ao frame ORIGINAL (multiplica por k)
    var out = [];
    for (i = 0; i < keep.length; i++) {
      var g = keep[i], X = Math.round(g.mnx * k), Y = Math.round(g.mny * k), Wd = Math.max(6, Math.round(g.w * k)), Hd = Math.max(6, Math.round(g.h * k));
      out.push({ x: X, y: Y, w: Wd, h: Hd, cx: X + (Wd >> 1), cy: Y + (Hd >> 1), area: Wd * Hd,
                 type: "diff", kind: "shape", shape: g.shape, ids: [] });
    }
    return out;
  }

  root.ACShape = { detect: detect };
})(window);

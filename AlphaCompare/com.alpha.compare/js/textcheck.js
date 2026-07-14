/*
 * textcheck.js — AlphaCompare — Inspecao de TEXTO (estilo GlobalVision Text Inspection)
 *
 * Compara duas imagens JA ALINHADAS (arquivo tratado x original) e aponta
 * diferencas de texto vetorizado: substituicao (diff), falta (miss) e sobra (extra).
 *
 * Estrategia (validada em sondagem com renders reais de producao):
 *   1. Mascaras de tinta: corpo escuro acromatico (min<80 e croma<90) e branco (min>190),
 *      com despeckle de CCs < 8 px. Em texto contornado (letra escura + halo branco
 *      trapado) o CORPO escuro e o sinal estavel; o halo incha com o trapping.
 *   2. Bandas de linha por projecao horizontal da uniao das mascaras, com split
 *      recursivo de bandas altas no minimo interior da projecao.
 *   3. Janelas deslizantes por banda + NCC (TM_CCOEFF_NORMED manual) da mascara A
 *      contra a mascara B nas MESMAS coordenadas com busca so dentro do pad
 *      (busca livre deixa o glifo trocado fugir). Variantes de trapping:
 *      base / dilate3x3(template) / dilate3x3(regiao) / box-blur 3x3 2x em ambos.
 *      NUNCA dilatar 2x (absorve '1' dentro de '3').
 *   4. Supressor de fundo: NCC do grayscale bruto (min RGB) da mesma janela;
 *      score final = max(score, bgNCC). Foto identica tem bg ~0.97 e e suprimida;
 *      digito trocado tem bg baixo e nao escapa.
 *   5. Duas direcoes (A->B e B->A) pra pegar falta e sobra.
 *   6. Camada de existencia (falta/sobra pequenas, ex. ponto final): residual das
 *      mascaras de contraste local (|L - mediana15|>40), CCs confirmados pela media
 *      de |grayA-grayB| sobre os pixels do CC, minimizada em shifts ±1px.
 *   7. Merge de janelas reprovadas sobrepostas/adjacentes em regioes unicas.
 *
 * Sem canvas/document: roda no painel CEP (Chromium) e em Node puro (testes).
 * Imagens: {data, width, height} com data RGBA (Uint8Array/Uint8ClampedArray).
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.ACText = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

    // vizinhanca 8-conectada
    var DX8 = [-1, 0, 1, -1, 1, -1, 0, 1];
    var DY8 = [-1, -1, -1, 0, 0, 1, 1, 1];

    // ------------------------------------------------------------------
    // Canais e mascaras de tinta
    // ------------------------------------------------------------------

    // Extrai de uma imagem RGBA: luma, min(R,G,B) e as duas mascaras de tinta.
    function extraiCanais(img) {
        var W = img.width, H = img.height, n = W * H;
        var d = img.data;
        var luma = new Uint8Array(n);
        var gmin = new Uint8Array(n);
        var dark = new Uint8Array(n);   // corpo escuro acromatico
        var white = new Uint8Array(n);  // branco (halo/knockout)
        var i, p, r, g, b, mn, mx;
        for (i = 0, p = 0; i < n; i++, p += 4) {
            r = d[p]; g = d[p + 1]; b = d[p + 2];
            mn = r < g ? r : g; if (b < mn) mn = b;
            mx = r > g ? r : g; if (b > mx) mx = b;
            luma[i] = (77 * r + 150 * g + 29 * b) >> 8;
            gmin[i] = mn;
            // escuro E pouco cromatico (croma = max-min): pega preto/cinza de texto,
            // deixa fora vermelho/ciano/amarelo vivos (facas, fundos)
            if (mn < 80 && (mx - mn) < 90) dark[i] = 1;
            if (mn > 190) white[i] = 1;
        }
        return { luma: luma, gmin: gmin, dark: dark, white: white };
    }

    // Remove componentes conexos (8-conectividade) menores que minArea (in place).
    function despeckle(mask, W, H, minArea) {
        var n = W * H;
        var visited = new Uint8Array(n);
        var stack = new Int32Array(n);
        var order = new Int32Array(n);
        var i, k, sp, cnt, cur, cx, cy, nx, ny, ni;
        for (i = 0; i < n; i++) {
            if (!mask[i] || visited[i]) continue;
            sp = 0; cnt = 0;
            stack[sp++] = i; visited[i] = 1;
            while (sp > 0) {
                cur = stack[--sp];
                order[cnt++] = cur;
                cx = cur % W; cy = (cur / W) | 0;
                for (k = 0; k < 8; k++) {
                    nx = cx + DX8[k]; ny = cy + DY8[k];
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    ni = ny * W + nx;
                    if (mask[ni] && !visited[ni]) { visited[ni] = 1; stack[sp++] = ni; }
                }
            }
            if (cnt < minArea) {
                for (k = 0; k < cnt; k++) mask[order[k]] = 0;
            }
        }
        return mask;
    }

    // Copia a mascara removendo componentes conexos "grandes demais p/ glifo":
    // area > maxArea OU altura de bbox > maxH OU largura > maxW. Mata foto (prato
    // branco, sombras), fundo de madeira em fiapos longos e blocos graficos —
    // deixa so tinta tamanho-de-texto p/ a SEGMENTACAO nao colar tudo num blob.
    function removeGrandesCC(mask, W, H, maxArea, maxH, maxW) {
        var n = W * H;
        var out = new Uint8Array(n);
        var visited = new Uint8Array(n);
        var stack = new Int32Array(n);
        var order = new Int32Array(n);
        var i, k, sp, cnt, cur, cx, cy, nx, ny, ni, x0, x1, y0, y1;
        for (i = 0; i < n; i++) {
            if (!mask[i] || visited[i]) continue;
            sp = 0; cnt = 0; x0 = W; x1 = 0; y0 = H; y1 = 0;
            stack[sp++] = i; visited[i] = 1;
            while (sp > 0) {
                cur = stack[--sp];
                order[cnt++] = cur;
                cx = cur % W; cy = (cur / W) | 0;
                if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
                if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
                for (k = 0; k < 8; k++) {
                    nx = cx + DX8[k]; ny = cy + DY8[k];
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    ni = ny * W + nx;
                    if (mask[ni] && !visited[ni]) { visited[ni] = 1; stack[sp++] = ni; }
                }
            }
            if (cnt > maxArea || (y1 - y0 + 1) > maxH || (x1 - x0 + 1) > maxW) continue;
            for (k = 0; k < cnt; k++) out[order[k]] = 1;
        }
        return out;
    }

    // Dilatacao binaria 3x3 (separavel), retorna nova mascara.
    function dilateBin(mask, W, H) {
        var tmp = new Uint8Array(W * H);
        var out = new Uint8Array(W * H);
        var x, y, off, v;
        for (y = 0; y < H; y++) {
            off = y * W;
            for (x = 0; x < W; x++) {
                v = mask[off + x];
                if (!v && x > 0) v = mask[off + x - 1];
                if (!v && x < W - 1) v = mask[off + x + 1];
                tmp[off + x] = v;
            }
        }
        for (y = 0; y < H; y++) {
            off = y * W;
            for (x = 0; x < W; x++) {
                v = tmp[off + x];
                if (!v && y > 0) v = tmp[off - W + x];
                if (!v && y < H - 1) v = tmp[off + W + x];
                out[off + x] = v;
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Bandas de linha (projecao horizontal)
    // ------------------------------------------------------------------

    function achaBandas(union, W, H) {
        var proj = new Float64Array(H);
        var x, y, off, s;
        for (y = 0; y < H; y++) {
            off = y * W; s = 0;
            for (x = 0; x < W; x++) s += union[off + x];
            proj[y] = s;
        }
        var thr = Math.max(3, 0.004 * W);
        // runs contiguos acima do limiar
        var runs = [];
        y = 0;
        while (y < H) {
            if (proj[y] > thr) {
                var y2 = y;
                while (y2 + 1 < H && proj[y2 + 1] > thr) y2++;
                runs.push([y, y2]);
                y = y2 + 1;
            } else y++;
        }
        // mediana das alturas "tipo texto" (4..60 px) — runs gigantes (fundo
        // fotografico continuo) nao entram na mediana
        var hs = [];
        var i, h;
        for (i = 0; i < runs.length; i++) {
            h = runs[i][1] - runs[i][0] + 1;
            if (h >= 4 && h <= 60) hs.push(h);
        }
        hs.sort(function (a, b) { return a - b; });
        var medH = hs.length ? hs[(hs.length / 2) | 0] : 22;
        var maxH = Math.max(16, Math.round(1.6 * medH));
        // split recursivo no minimo interior da projecao (miolo 50%)
        var bands = [];
        var work = runs.slice();
        while (work.length) {
            var rn = work.pop();
            var a = rn[0], b = rn[1];
            h = b - a + 1;
            if (h <= maxH) {
                if (h >= 4) bands.push({ y0: a, y1: b, h: h });
                continue;
            }
            var lo = a + Math.max(1, (0.25 * h) | 0);
            var hi = b - Math.max(1, (0.25 * h) | 0);
            if (hi <= lo) { bands.push({ y0: a, y1: b, h: h }); continue; }
            var kMin = lo;
            for (y = lo; y <= hi; y++) if (proj[y] < proj[kMin]) kMin = y;
            work.push([a, kMin]);
            work.push([kMin + 1, b]);
        }
        bands.sort(function (p, q) { return p.y0 - q.y0; });
        return bands;
    }

    // Prefixo de somas por coluna de uma mascara dentro da faixa de linhas da banda.
    // pre[x1+1]-pre[x0] = qtd de pixels ligados em [x0..x1] x [y0..y1].
    function prefixoBanda(mask, W, y0, y1) {
        var pre = new Int32Array(W + 1);
        var colsum = new Int32Array(W);
        var x, y, off;
        for (y = y0; y <= y1; y++) {
            off = y * W;
            for (x = 0; x < W; x++) colsum[x] += mask[off + x];
        }
        var s = 0;
        for (x = 0; x < W; x++) { s += colsum[x]; pre[x + 1] = s; }
        return pre;
    }

    // ------------------------------------------------------------------
    // Patches Float32 e operacoes locais
    // ------------------------------------------------------------------

    function pegaPatch(src, W, x0, y0, w, h) {
        var out = new Float32Array(w * h);
        var x, y, off, oo;
        for (y = 0; y < h; y++) {
            off = (y0 + y) * W + x0;
            oo = y * w;
            for (x = 0; x < w; x++) out[oo + x] = src[off + x];
        }
        return out;
    }

    // Upsample 2x bilinear de um patch (p/ bandas baixas: NCC com meio-pixel).
    function up2(patch, w, h) {
        var w2 = w * 2, h2 = h * 2;
        var out = new Float32Array(w2 * h2);
        var x, y, sx, sy, x0, y0, x1, y1, fx, fy, v00, v01, v10, v11;
        for (y = 0; y < h2; y++) {
            sy = (y + 0.5) / 2 - 0.5;
            if (sy < 0) sy = 0; if (sy > h - 1) sy = h - 1;
            y0 = sy | 0; y1 = y0 + 1 < h ? y0 + 1 : y0; fy = sy - y0;
            for (x = 0; x < w2; x++) {
                sx = (x + 0.5) / 2 - 0.5;
                if (sx < 0) sx = 0; if (sx > w - 1) sx = w - 1;
                x0 = sx | 0; x1 = x0 + 1 < w ? x0 + 1 : x0; fx = sx - x0;
                v00 = patch[y0 * w + x0]; v01 = patch[y0 * w + x1];
                v10 = patch[y1 * w + x0]; v11 = patch[y1 * w + x1];
                out[y * w2 + x] = v00 * (1 - fy) * (1 - fx) + v01 * (1 - fy) * fx +
                                  v10 * fy * (1 - fx) + v11 * fy * fx;
            }
        }
        return out;
    }

    // Dilatacao 3x3 (max local) em patch float.
    function dil3(patch, w, h) {
        var tmp = new Float32Array(w * h);
        var out = new Float32Array(w * h);
        var x, y, o, v, m;
        for (y = 0; y < h; y++) {
            o = y * w;
            for (x = 0; x < w; x++) {
                m = patch[o + x];
                if (x > 0 && patch[o + x - 1] > m) m = patch[o + x - 1];
                if (x < w - 1 && patch[o + x + 1] > m) m = patch[o + x + 1];
                tmp[o + x] = m;
            }
        }
        for (y = 0; y < h; y++) {
            o = y * w;
            for (x = 0; x < w; x++) {
                m = tmp[o + x];
                if (y > 0 && tmp[o - w + x] > m) m = tmp[o - w + x];
                if (y < h - 1 && tmp[o + w + x] > m) m = tmp[o + w + x];
                out[o + x] = m;
            }
        }
        return out;
    }

    // Box blur 3x3 (bordas replicadas). Aplicado 2x aproxima gaussiana sigma~1.5.
    function blur3(patch, w, h) {
        var tmp = new Float32Array(w * h);
        var out = new Float32Array(w * h);
        var x, y, o, a, b, c;
        for (y = 0; y < h; y++) {
            o = y * w;
            for (x = 0; x < w; x++) {
                a = patch[o + (x > 0 ? x - 1 : 0)];
                b = patch[o + x];
                c = patch[o + (x < w - 1 ? x + 1 : w - 1)];
                tmp[o + x] = (a + b + c) / 3;
            }
        }
        for (y = 0; y < h; y++) {
            o = y * w;
            var oU = (y > 0 ? y - 1 : 0) * w;
            var oD = (y < h - 1 ? y + 1 : h - 1) * w;
            for (x = 0; x < w; x++) {
                out[o + x] = (tmp[oU + x] + tmp[o + x] + tmp[oD + x]) / 3;
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    // NCC manual (TM_CCOEFF_NORMED): max sobre os deslocamentos possiveis
    // do template dentro da regiao (que ja e a janela + pad). Ordem de
    // varredura centro-pra-fora com early-exit assim que passa do limiar.
    // ------------------------------------------------------------------

    function tmMax(reg, rw, rh, tpl, tw, th, exitThr) {
        var oh = rh - th, ow = rw - tw;
        if (oh < 0 || ow < 0) return -1;
        var nt = tw * th;
        var i, v, s = 0;
        for (i = 0; i < nt; i++) s += tpl[i];
        var tm = s / nt;
        var tz = new Float32Array(nt);
        var tnorm = 0;
        for (i = 0; i < nt; i++) { v = tpl[i] - tm; tz[i] = v; tnorm += v * v; }
        if (tnorm <= 1e-9) return -1;
        // ordem dos offsets: centro primeiro (o alinhamento ja e bom, o melhor
        // score costuma estar no centro — early-exit barato)
        var offs = [];
        var oy, ox, cy = oh / 2, cx = ow / 2;
        for (oy = 0; oy <= oh; oy++) {
            for (ox = 0; ox <= ow; ox++) {
                offs.push([(oy - cy) * (oy - cy) + (ox - cx) * (ox - cx), oy, ox]);
            }
        }
        offs.sort(function (a, b) { return a[0] - b[0]; });
        var best = -1;
        var k, ty, tx, cross, rs, rs2, rowOff, tOff, rv, varr, ncc;
        for (k = 0; k < offs.length; k++) {
            oy = offs[k][1]; ox = offs[k][2];
            cross = 0; rs = 0; rs2 = 0;
            for (ty = 0; ty < th; ty++) {
                rowOff = (oy + ty) * rw + ox;
                tOff = ty * tw;
                for (tx = 0; tx < tw; tx++) {
                    rv = reg[rowOff + tx];
                    cross += tz[tOff + tx] * rv;
                    rs += rv; rs2 += rv * rv;
                }
            }
            varr = rs2 - rs * rs / nt;
            if (varr <= 1e-9) continue;
            ncc = cross / Math.sqrt(tnorm * varr);
            if (ncc > best) best = ncc;
            if (best >= exitThr) return best;
        }
        return best;
    }

    // ------------------------------------------------------------------
    // Avaliacao de uma janela numa direcao (srcI=0: template A vs B => sobra;
    // srcI=1: template B vs A => falta). Retorna {pass, score}.
    // ------------------------------------------------------------------

    function avaliaJanela(ctx, band, x, srcI) {
        var W = ctx.W, H = ctx.H;
        var y0 = band.y0, h = band.h, w = band.winW;
        var pad = ctx.pad, thr = ctx.threshold;
        var area = w * h;
        var mSrc = srcI === 0 ? ctx.mascA : ctx.mascB;
        var mDst = srcI === 0 ? ctx.mascB : ctx.mascA;
        var preSrc = srcI === 0 ? band.preA : band.preB;
        var ups = h < 16;
        var rx0 = Math.max(0, x - pad), ry0 = Math.max(0, y0 - pad);
        var rx1 = Math.min(W, x + w + pad), ry1 = Math.min(H, y0 + h + pad);
        var rw = rx1 - rx0, rh = ry1 - ry0;
        var best = -1, avaliou = false;
        var mi, ink, frac, t, r, tw, th, s;
        for (mi = 0; mi < 2; mi++) {
            ink = preSrc[mi][x + w] - preSrc[mi][x];
            frac = ink / area;
            // janela precisa de tinta suficiente, mas nao pode ser bloco solido
            // (patch constante nao tem forma pra correlacionar)
            if (frac < ctx.minInkFrac || frac > 0.98) continue;
            avaliou = true;
            t = pegaPatch(mSrc[mi], W, x, y0, w, h);
            r = pegaPatch(mDst[mi], W, rx0, ry0, rw, rh);
            tw = w; th = h;
            var rw2 = rw, rh2 = rh;
            if (ups) {
                t = up2(t, tw, th); tw *= 2; th *= 2;
                r = up2(r, rw2, rh2); rw2 *= 2; rh2 *= 2;
            }
            // base
            s = tmMax(r, rw2, rh2, t, tw, th, thr);
            if (s > best) best = s;
            if (best >= thr) return { pass: true, score: best };
            // trapping engordou o outro lado: dilata template
            s = tmMax(r, rw2, rh2, dil3(t, tw, th), tw, th, thr);
            if (s > best) best = s;
            if (best >= thr) return { pass: true, score: best };
            // trapping engordou este lado: dilata regiao
            s = tmMax(dil3(r, rw2, rh2), rw2, rh2, t, tw, th, thr);
            if (s > best) best = s;
            if (best >= thr) return { pass: true, score: best };
            // suaviza ambos (blur 3x3 2x ~ gauss sigma 1.5): tolera meio-pixel
            s = tmMax(blur3(blur3(r, rw2, rh2), rw2, rh2), rw2, rh2,
                      blur3(blur3(t, tw, th), tw, th), tw, th, thr);
            if (s > best) best = s;
            if (best >= thr) return { pass: true, score: best };
        }
        if (!avaliou) return { pass: true, score: 1, pulou: true };
        // supressor de fundo: NCC do grayscale bruto (min RGB) da mesma janela.
        // Foto/textura identica da ~0.97 e mata o falso positivo; texto trocado
        // continua baixo e nao escapa.
        var gSrc = srcI === 0 ? ctx.gminA : ctx.gminB;
        var gDst = srcI === 0 ? ctx.gminB : ctx.gminA;
        t = pegaPatch(gSrc, W, x, y0, w, h);
        r = pegaPatch(gDst, W, rx0, ry0, rw, rh);
        tw = w; th = h;
        var rww = rw, rhh = rh;
        if (ups) {
            t = up2(t, tw, th); tw *= 2; th *= 2;
            r = up2(r, rww, rhh); rww *= 2; rhh *= 2;
        }
        s = tmMax(r, rww, rhh, t, tw, th, thr);
        if (s > best) best = s;
        return { pass: best >= thr, score: best };
    }

    // ------------------------------------------------------------------
    // Camada de existencia: mediana deslizante aproximada (linha->coluna),
    // mascara de contraste local, residual e confirmacao por diferenca de luma.
    // ------------------------------------------------------------------

    function medianaLinhas(src, out, W, H, rad, stride, count, lines, lineStride) {
        // mediana deslizante 1D generica (janela 2*rad+1, bordas replicadas)
        // percorre `lines` linhas de `count` elementos com passo `stride`;
        // inicio de cada linha avanca `lineStride`.
        var hist = new Int32Array(256);
        var li, i, j, v, vi, vo, med, lt, base, idx;
        for (li = 0; li < lines; li++) {
            base = li * lineStride;
            for (i = 0; i < 256; i++) hist[i] = 0;
            for (j = -rad; j <= rad; j++) {
                idx = j < 0 ? 0 : (j >= count ? count - 1 : j);
                hist[src[base + idx * stride]]++;
            }
            med = 0; lt = 0;
            while (lt + hist[med] <= rad) { lt += hist[med]; med++; }
            out[base] = med;
            for (i = 1; i < count; i++) {
                j = i - rad - 1; idx = j < 0 ? 0 : j;
                vo = src[base + idx * stride];
                j = i + rad; idx = j >= count ? count - 1 : j;
                vi = src[base + idx * stride];
                hist[vo]--; if (vo < med) lt--;
                hist[vi]++; if (vi < med) lt++;
                if (lt > rad) {
                    do { med--; lt -= hist[med]; } while (lt > rad);
                } else {
                    while (lt + hist[med] <= rad) { lt += hist[med]; med++; }
                }
                out[base + i * stride] = med;
            }
        }
    }

    // Mascara de contraste local: |L - mediana15x15 aproximada| > thr.
    // Pega tinta escura E clara sobre qualquer fundo (inclusive texto amarelo
    // em fundo vermelho, invisivel pras mascaras dark/white).
    function mascaraContraste(luma, W, H, thr) {
        var n = W * H;
        var tmp = new Uint8Array(n);
        var med = new Uint8Array(n);
        // linhas: stride 1, count W, lineStride W
        medianaLinhas(luma, tmp, W, H, 7, 1, W, H, W);
        // colunas: stride W, count H, lineStride 1
        medianaLinhas(tmp, med, W, H, 7, W, H, W, 1);
        var out = new Uint8Array(n);
        var i, d;
        for (i = 0; i < n; i++) {
            d = luma[i] - med[i];
            if (d < 0) d = -d;
            if (d > thr) out[i] = 1;
        }
        return out;
    }

    // Deteccoes de existencia numa direcao: resid = mSrc & ~dilate(mDst, nIter).
    // CC >= minArea confirmado se mean(|lSrc - lDst|) sobre os pixels do CC,
    // minimizada sobre shifts ±1px, >= minDiff.
    function detectaExistencia(mSrc, mDst, lSrc, lDst, W, H, o) {
        var dil = mDst, it;
        for (it = 0; it < o.existDilate; it++) dil = dilateBin(dil, W, H);
        var n = W * H;
        var resid = new Uint8Array(n);
        var i;
        for (i = 0; i < n; i++) if (mSrc[i] && !dil[i]) resid[i] = 1;
        // CCs do residual
        var visited = new Uint8Array(n);
        var stack = new Int32Array(n);
        var pix = new Int32Array(n);
        var dets = [];
        var k, sp, cnt, cur, cx, cy, nx, ny, ni;
        for (i = 0; i < n; i++) {
            if (!resid[i] || visited[i]) continue;
            sp = 0; cnt = 0;
            stack[sp++] = i; visited[i] = 1;
            var x0 = W, x1 = 0, y0 = H, y1 = 0;
            while (sp > 0) {
                cur = stack[--sp];
                pix[cnt++] = cur;
                cx = cur % W; cy = (cur / W) | 0;
                if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
                if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
                for (k = 0; k < 8; k++) {
                    nx = cx + DX8[k]; ny = cy + DY8[k];
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    ni = ny * W + nx;
                    if (resid[ni] && !visited[ni]) { visited[ni] = 1; stack[sp++] = ni; }
                }
            }
            if (cnt < o.existMinArea) continue;
            // confirmacao: diferenca media de luma sobre os pixels do CC,
            // minimizada em shifts ±1 (mata borda de trapping deslocada)
            var bestDiff = 1e9;
            var dy, dx, acc, px, py, j, d2;
            for (dy = -1; dy <= 1; dy++) {
                for (dx = -1; dx <= 1; dx++) {
                    acc = 0;
                    for (j = 0; j < cnt; j++) {
                        cur = pix[j];
                        px = cur % W; py = (cur / W) | 0;
                        var qx = px + dx, qy = py + dy;
                        if (qx < 0) qx = 0; if (qx >= W) qx = W - 1;
                        if (qy < 0) qy = 0; if (qy >= H) qy = H - 1;
                        d2 = lSrc[cur] - lDst[qy * W + qx];
                        if (d2 < 0) d2 = -d2;
                        acc += d2;
                    }
                    acc /= cnt;
                    if (acc < bestDiff) bestDiff = acc;
                }
            }
            if (bestDiff >= o.existMinDiff) {
                dets.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1,
                            area: cnt, diff: bestDiff });
            }
        }
        return dets;
    }

    // ------------------------------------------------------------------
    // Merge de regioes (bbox com folga)
    // ------------------------------------------------------------------

    function mesclaRegioes(regs, gapX, gapY) {
        var mudou = true;
        while (mudou) {
            mudou = false;
            var i, j;
            for (i = 0; i < regs.length && !mudou; i++) {
                for (j = i + 1; j < regs.length; j++) {
                    var a = regs[i], b = regs[j];
                    if (a.x0 - gapX <= b.x1 && b.x0 - gapX <= a.x1 &&
                        a.y0 - gapY <= b.y1 && b.y0 - gapY <= a.y1) {
                        if (b.x0 < a.x0) a.x0 = b.x0;
                        if (b.y0 < a.y0) a.y0 = b.y0;
                        if (b.x1 > a.x1) a.x1 = b.x1;
                        if (b.y1 > a.y1) a.y1 = b.y1;
                        a.dirs = a.dirs | b.dirs;
                        if (b.score < a.score) a.score = b.score;
                        a.nFail += b.nFail;
                        a.existArea += b.existArea;
                        regs.splice(j, 1);
                        mudou = true;
                        break;
                    }
                }
            }
        }
        return regs;
    }

    // ------------------------------------------------------------------
    // Deteccao de barcode por assinatura (fallback quando nao vem opts.barcodeRect)
    // Codigo de barras = linhas com MUITAS transicoes claro<->escuro (as barras
    // verticais sao cruzadas por cada linha). Acha a faixa de linhas mais densa
    // em transicoes e o intervalo de colunas onde elas se concentram.
    // ------------------------------------------------------------------
    function detectaBarcodeSig(gmin, W, H) {
        var trans = new Int32Array(H);   // qtd de transicoes por linha
        var y, x, off, prev, cur, tc;
        for (y = 0; y < H; y++) {
            off = y * W; tc = 0;
            prev = gmin[off] < 110 ? 1 : 0;
            for (x = 1; x < W; x++) {
                cur = gmin[off + x] < 110 ? 1 : 0;
                if (cur !== prev) tc++;
                prev = cur;
            }
            trans[y] = tc;
        }
        // faixa contigua de linhas com transicoes altas (> 18)
        var bestY0 = -1, bestY1 = -1, bestScore = 0;
        y = 0;
        while (y < H) {
            if (trans[y] > 18) {
                var y2 = y, acc = 0;
                while (y2 < H && trans[y2] > 18) { acc += trans[y2]; y2++; }
                if ((y2 - y) >= 15 && acc > bestScore) { bestScore = acc; bestY0 = y; bestY1 = y2 - 1; }
                y = y2;
            } else y++;
        }
        if (bestY0 < 0) return null;
        // intervalo de colunas: colunas que ficam escuras em muitas linhas da faixa
        var nb = bestY1 - bestY0 + 1;
        var colDark = new Int32Array(W);
        for (y = bestY0; y <= bestY1; y++) {
            off = y * W;
            for (x = 0; x < W; x++) if (gmin[off + x] < 110) colDark[x]++;
        }
        var thrc = nb * 0.30;
        var bx0 = -1, bx1 = -1;
        for (x = 0; x < W; x++) {
            if (colDark[x] >= thrc) { if (bx0 < 0) bx0 = x; bx1 = x; }
        }
        if (bx0 < 0) return null;
        return { x: bx0, y: bestY0, w: bx1 - bx0 + 1, h: bestY1 - bestY0 + 1 };
    }

    // Expande o rect do barcode p/ cobrir a linha de digitos legiveis (abaixo das
    // barras) e o texto placeholder do outro lado. Retorna caixa em px, clipada.
    function expandeBarcode(r, W, H) {
        var x0 = Math.floor(r.x - 0.2 * r.w);
        var x1 = Math.ceil(r.x + 1.4 * r.w);
        var y0 = Math.floor(r.y - 0.1 * r.h);
        var y1 = Math.ceil(r.y + 1.7 * r.h);
        if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
        if (x1 > W) x1 = W; if (y1 > H) y1 = H;
        return { x0: x0, y0: y0, x1: x1, y1: y1 };
    }

    // ------------------------------------------------------------------
    // Segmentacao em SECOES (blocos/paragrafos de texto)
    //   1. cada banda de linha -> segmentos horizontais de tinta com os vaos
    //      < ~0.8*medBandH fechados (RLSA: junta palavras numa linha-segmento);
    //   2. union-find junta dois segmentos se o vao VERTICAL entre suas bandas
    //      < ~1.2*medBandH E existe sobreposicao horizontal (junta linhas de um
    //      mesmo bloco/paragrafo);
    //   3. bbox da secao = uniao dos segmentos do grupo; descarta < 60 px de tinta.
    // ------------------------------------------------------------------
    function segmentaSecoes(unionSeg, W, H, bands, medBandH) {
        var gapClose = Math.max(2, Math.round(0.8 * medBandH));
        // vao vertical minusculo: junta so segmentos QUASE encostados (uma linha que
        // o achaBandas partiu em duas, ascendente/descendente). Linhas com entrelinha
        // normal ficam SEPARADAS -> uma secao por linha. Colar linhas via vao maior
        // faz a transitividade do union-find grudar o bloco/coluna inteiro num blob.
        var vGapMax = Math.max(1, Math.round(0.12 * medBandH));
        var segs = [];   // {x0,x1,y0,y1}
        var bi, b, x, y, off, lastInk, x0run;
        var colInk = new Uint8Array(W);
        for (bi = 0; bi < bands.length; bi++) {
            b = bands[bi];
            for (x = 0; x < W; x++) colInk[x] = 0;
            for (y = b.y0; y <= b.y1; y++) {
                off = y * W;
                for (x = 0; x < W; x++) if (unionSeg[off + x]) colInk[x] = 1;
            }
            x0run = -1; lastInk = -1;
            for (x = 0; x < W; x++) {
                if (colInk[x]) { if (x0run < 0) x0run = x; lastInk = x; }
                else if (x0run >= 0 && (x - lastInk) > gapClose) {
                    segs.push({ x0: x0run, x1: lastInk, y0: b.y0, y1: b.y1 });
                    x0run = -1;
                }
            }
            if (x0run >= 0) segs.push({ x0: x0run, x1: lastInk, y0: b.y0, y1: b.y1 });
        }
        var ns = segs.length;
        var parent = new Int32Array(ns);
        var i, j;
        for (i = 0; i < ns; i++) parent[i] = i;
        function acha(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
        var si, sj, vg, ra, rb, ovl, minw;
        for (i = 0; i < ns; i++) {
            si = segs[i];
            for (j = i + 1; j < ns; j++) {
                sj = segs[j];
                // exige sobreposicao horizontal FORTE (>=50% da menor largura): impede
                // que uma linha larga agarre um respingo distante e chaine colunas.
                ovl = Math.min(si.x1, sj.x1) - Math.max(si.x0, sj.x0) + 1;
                if (ovl <= 0) continue;
                minw = Math.min(si.x1 - si.x0 + 1, sj.x1 - sj.x0 + 1);
                if (ovl < 0.5 * minw) continue;
                if (sj.y0 > si.y1) vg = sj.y0 - si.y1;
                else if (si.y0 > sj.y1) vg = si.y0 - sj.y1;
                else vg = 0;
                if (vg < vGapMax) { ra = acha(i); rb = acha(j); if (ra !== rb) parent[ra] = rb; }
            }
        }
        // agrupa
        var grupos = {};
        var g, k;
        for (i = 0; i < ns; i++) {
            k = acha(i);
            g = grupos[k];
            if (!g) { g = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 }; grupos[k] = g; }
            si = segs[i];
            if (si.x0 < g.x0) g.x0 = si.x0;
            if (si.y0 < g.y0) g.y0 = si.y0;
            if (si.x1 > g.x1) g.x1 = si.x1;
            if (si.y1 > g.y1) g.y1 = si.y1;
        }
        var secs = [];
        var ink, gx, gy;
        for (k in grupos) {
            if (!grupos.hasOwnProperty(k)) continue;
            g = grupos[k];
            ink = 0;
            for (gy = g.y0; gy <= g.y1; gy++) {
                off = gy * W;
                for (gx = g.x0; gx <= g.x1; gx++) if (unionSeg[off + gx]) ink++;
            }
            if (ink < 60) continue;
            secs.push({ x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, ink: ink });
        }
        secs.sort(function (p, q) { return (p.y0 - q.y0) || (p.x0 - q.x0); });
        for (i = 0; i < secs.length; i++) secs[i].id = i;
        return secs;
    }

    // ------------------------------------------------------------------
    // API principal
    // ------------------------------------------------------------------

    function findTextDiffs(fileImg, origImg, opts) {
        var t0 = new Date().getTime();
        if (!fileImg || !origImg ||
            fileImg.width !== origImg.width || fileImg.height !== origImg.height) {
            throw new Error('ACText: imagens precisam ter as mesmas dimensoes (ja alinhadas)');
        }
        var o = opts || {};
        var threshold = o.threshold !== undefined ? o.threshold : 0.46;
        var minInkFrac = o.minInkFrac !== undefined ? o.minInkFrac : 0.08;
        // alto de proposito: o ratio por secao (nFail/nWindows) so e coerente com os
        // limiares calibrados se as candidatas NAO forem subamostradas (stride=1). No
        // full-res (~30k candidatas) roda < 8s; so afina se estourar imagens gigantes.
        var maxWindows = o.maxWindows !== undefined ? o.maxWindows : 60000;
        var pad = o.pad !== undefined ? o.pad : 2;
        var exOpts = {
            existDilate: o.existDilate !== undefined ? o.existDilate : 1,
            existMinArea: o.existMinArea !== undefined ? o.existMinArea : 3,
            existMinDiff: o.existMinDiff !== undefined ? o.existMinDiff : 60
        };
        var contrThr = o.contrastThr !== undefined ? o.contrastThr : 40;
        var speckMin = o.despeckleMin !== undefined ? o.despeckleMin : 8;
        // limiares de classificacao por secao (defaults validados no prototipo)
        var reworkedRatioMin = o.reworkedRatioMin !== undefined ? o.reworkedRatioMin : 0.30;
        var editRatioMax = o.editRatioMax !== undefined ? o.editRatioMax : 0.05;
        var minWindowsPerSection = o.minWindowsPerSection !== undefined ? o.minWindowsPerSection : 60;
        // ~5 janelas = 1 caractere (winW~=altura, step~=winW/6): edicao real de 1
        // char ainda dispara; near-miss de trapping sub-caractere (3-4 janelas) nao.
        var editMinCluster = o.editMinCluster !== undefined ? o.editMinCluster : 6;
        // edicao REAL = falhas concentradas num unico cluster (uma palavra/digito
        // trocado). Se as falhas estao espalhadas pela secao e ruido de trapping/
        // grafico, nao e edicao -> nao vira 'edit' (evita crya-wolf no fluxo).
        var editLocalFrac = o.editLocalFrac !== undefined ? o.editLocalFrac : 0.6;

        var W = fileImg.width, H = fileImg.height, n = W * H;
        var cA = extraiCanais(fileImg);
        var cB = extraiCanais(origImg);
        despeckle(cA.dark, W, H, speckMin); despeckle(cA.white, W, H, speckMin);
        despeckle(cB.dark, W, H, speckMin); despeckle(cB.white, W, H, speckMin);

        // uniao p/ bandas
        var union = new Uint8Array(n);
        var i;
        for (i = 0; i < n; i++) {
            union[i] = (cA.dark[i] | cA.white[i] | cB.dark[i] | cB.white[i]);
        }

        // residuais com tolerancia de 1px (prefiltro barato: janela sem residual
        // nao precisa de NCC — fundo fotografico identico sai de graca)
        var dDA = dilateBin(cA.dark, W, H), dWA = dilateBin(cA.white, W, H);
        var dDB = dilateBin(cB.dark, W, H), dWB = dilateBin(cB.white, W, H);
        var residA = new Uint8Array(n), residB = new Uint8Array(n);
        for (i = 0; i < n; i++) {
            if ((cA.dark[i] && !dDB[i]) || (cA.white[i] && !dWB[i])) residA[i] = 1;
            if ((cB.dark[i] && !dDA[i]) || (cB.white[i] && !dWA[i])) residB[i] = 1;
        }

        // ---- barcode: rect vindo de opts.barcodeRect ou detectado por assinatura ----
        // zera a area do barcode na uniao (nenhuma banda/secao se forma la) e guarda
        // a caixa expandida p/ descartar falhas/janelas cujo centro caia dentro.
        var bcRect = null, bcExp = null;
        if (o.barcodeRect && o.barcodeRect.w > 0 && o.barcodeRect.h > 0) bcRect = o.barcodeRect;
        else if (o.barcodeDetect === true) bcRect = detectaBarcodeSig(cA.gmin, W, H);
        if (bcRect) {
            bcExp = expandeBarcode(bcRect, W, H);
            var byy, bxx, boff;
            for (byy = bcExp.y0; byy < bcExp.y1; byy++) {
                boff = byy * W;
                for (bxx = bcExp.x0; bxx < bcExp.x1; bxx++) union[boff + bxx] = 0;
            }
        }

        var bands = achaBandas(union, W, H);

        var ctx = {
            W: W, H: H, pad: pad, threshold: threshold, minInkFrac: minInkFrac,
            mascA: [cA.dark, cA.white], mascB: [cB.dark, cB.white],
            gminA: cA.gmin, gminB: cB.gmin
        };

        // fase 1: coleta candidatos (janelas com residual — as demais passam direto)
        var candidatos = [];
        var bi, band, x;
        for (bi = 0; bi < bands.length; bi++) {
            band = bands[bi];
            band.winW = band.h < 8 ? 8 : (band.h > 40 ? 40 : band.h);
            band.step = Math.max(2, (band.winW / 6) | 0);
            band.preA = [prefixoBanda(cA.dark, W, band.y0, band.y1),
                         prefixoBanda(cA.white, W, band.y0, band.y1)];
            band.preB = [prefixoBanda(cB.dark, W, band.y0, band.y1),
                         prefixoBanda(cB.white, W, band.y0, band.y1)];
            band.preRA = prefixoBanda(residA, W, band.y0, band.y1);
            band.preRB = prefixoBanda(residB, W, band.y0, band.y1);
            for (x = 0; x + band.winW <= W; x += band.step) {
                var rA = band.preRA[x + band.winW] - band.preRA[x];
                var rB = band.preRB[x + band.winW] - band.preRB[x];
                var needA = rA >= 3, needB = rB >= 3;
                if (needA || needB) {
                    candidatos.push({ b: bi, x: x, dA: needA, dB: needB });
                }
            }
        }

        // orcamento de janelas: se estourar, afina uniformemente (mantem cobertura)
        var stride = 1;
        if (candidatos.length > maxWindows) {
            stride = Math.ceil(candidatos.length / maxWindows);
        }

        // fase 2: NCC nas candidatas
        var falhas = [];
        var avaliadas = 0;
        var ci, cand, res;
        for (ci = 0; ci < candidatos.length; ci += stride) {
            cand = candidatos[ci];
            band = bands[cand.b];
            if (cand.dA) {
                avaliadas++;
                res = avaliaJanela(ctx, band, cand.x, 0);
                if (!res.pass) {
                    falhas.push({ x: cand.x, y0: band.y0, y1: band.y1,
                                  w: band.winW, dir: 1, score: res.score, banda: cand.b });
                }
            }
            if (cand.dB) {
                avaliadas++;
                res = avaliaJanela(ctx, band, cand.x, 1);
                if (!res.pass) {
                    falhas.push({ x: cand.x, y0: band.y0, y1: band.y1,
                                  w: band.winW, dir: 2, score: res.score, banda: cand.b });
                }
            }
        }

        // medBandH: mediana das alturas de banda (usada no agrupamento das secoes)
        var medBandH = 12;
        if (bands.length) {
            var hh = [];
            for (bi = 0; bi < bands.length; bi++) hh.push(bands[bi].h);
            hh.sort(function (a, b) { return a - b; });
            medBandH = hh[(hh.length / 2) | 0] || 12;
        }

        // ---------- descarta falhas dentro do barcode ----------
        var falhasOk = [];
        var fi, f, fcx, fcy;
        for (fi = 0; fi < falhas.length; fi++) {
            f = falhas[fi];
            fcx = f.x + f.w / 2; fcy = (f.y0 + f.y1) / 2;
            if (bcExp && fcx >= bcExp.x0 && fcx < bcExp.x1 && fcy >= bcExp.y0 && fcy < bcExp.y1) continue;
            falhasOk.push(f);
        }

        // ---------- uniao de segmentacao (limpa) ----------
        // tinta dark|white de AMBOS os lados + contraste local (pega texto amarelo/
        // colorido invisivel pras mascaras dark/white), sem a area do barcode e sem
        // os componentes grandes (foto/prato/madeira/molduras) — senao o RLSA cola
        // a etiqueta inteira num unico blob.
        var segRaw = new Uint8Array(n);
        for (i = 0; i < n; i++) segRaw[i] = (cA.dark[i] | cA.white[i] | cB.dark[i] | cB.white[i]);
        if (o.segContrast === true) {
            var ctrA = mascaraContraste(cA.luma, W, H, o.segContrastThr !== undefined ? o.segContrastThr : 35);
            var ctrB = mascaraContraste(cB.luma, W, H, o.segContrastThr !== undefined ? o.segContrastThr : 35);
            for (i = 0; i < n; i++) if (ctrA[i] | ctrB[i]) segRaw[i] = 1;
        }
        if (bcExp) {
            var syy, sxx, soff;
            for (syy = bcExp.y0; syy < bcExp.y1; syy++) {
                soff = syy * W;
                for (sxx = bcExp.x0; sxx < bcExp.x1; sxx++) segRaw[soff + sxx] = 0;
            }
        }
        // filtro por ALTURA (nao por largura/area): tira foto, prato, madeira, icones
        // e logos — tudo mais alto que ~2 linhas de texto — impedindo o colapso num
        // blob so, MAS preserva linhas curtas-e-largas (inclusive texto re-trapado
        // virado "borrao", que e justamente o que a classe reworked deve pegar).
        var capH = Math.max(34, Math.round((o.segCapHMul !== undefined ? o.segCapHMul : 2.2) * medBandH));
        var capW = W;   // sem limite de largura
        var capA = n;   // sem limite de area
        var segUnion = removeGrandesCC(segRaw, W, H, capA, capH, capW);

        // bandas de linha DA UNIAO LIMPA (sem foto/grafico): agora a projecao tem
        // vaos reais entre as linhas -> bandas finas por linha, e as secoes ficam
        // por bloco/linha (nao gruda a etiqueta inteira num bloco gigante).
        var segBands = achaBandas(segUnion, W, H);
        var medSegH = 12;
        if (segBands.length) {
            var sh = [];
            for (bi = 0; bi < segBands.length; bi++) sh.push(segBands[bi].h);
            sh.sort(function (a, b) { return a - b; });
            medSegH = sh[(sh.length / 2) | 0] || 12;
        }
        for (bi = 0; bi < segBands.length; bi++) {
            var sb = segBands[bi];
            sb.winW = sb.h < 8 ? 8 : (sb.h > 40 ? 40 : sb.h);
            sb.step = Math.max(2, (sb.winW / 6) | 0);
            sb.preSeg = prefixoBanda(segUnion, W, sb.y0, sb.y1);
        }

        // ---------- segmenta em secoes (blocos/paragrafos) ----------
        var secs = segmentaSecoes(segUnion, W, H, segBands, medSegH);
        var si2, sec;
        for (si2 = 0; si2 < secs.length; si2++) {
            secs[si2].falhas = []; secs[si2].nFail = 0; secs[si2].nWindows = 0;
        }
        // atribui cada falha a secao que contem seu centro
        for (fi = 0; fi < falhasOk.length; fi++) {
            f = falhasOk[fi];
            fcx = f.x + f.w / 2; fcy = (f.y0 + f.y1) / 2;
            for (si2 = 0; si2 < secs.length; si2++) {
                sec = secs[si2];
                if (fcx >= sec.x0 && fcx <= sec.x1 && fcy >= sec.y0 && fcy <= sec.y1) {
                    sec.falhas.push(f); sec.nFail++;
                    break;
                }
            }
        }
        // denominador do ratio: janelas com tinta dentro da secao
        for (si2 = 0; si2 < secs.length; si2++) {
            sec = secs[si2];
            for (bi = 0; bi < segBands.length; bi++) {
                band = segBands[bi];
                if (band.y0 < sec.y0 || band.y1 > sec.y1) continue;   // banda inteira dentro da faixa da secao
                var winW = band.winW, step = band.step, area = winW * band.h;
                var pre = band.preSeg;
                var xend = sec.x1 - winW + 1;
                var xx;
                for (xx = sec.x0; xx <= xend; xx += step) {
                    var ink = pre[xx + winW] - pre[xx];
                    var frac = ink / area;
                    if (frac >= 0.06 && frac <= 0.98) sec.nWindows++;
                }
            }
        }

        // ---------- classifica cada secao ----------
        // ratio = nFail/nWindows. reworked = quase tudo mudou (re-trapping do bloco
        // inteiro). edit = poucas janelas mudaram, agrupadas num cluster localizado
        // (edicao real de conteudo). clean = ruido de trapping esparso ou nada.
        var comps = [];
        var nEdit = 0, nRework = 0, nClean = 0;
        for (si2 = 0; si2 < secs.length; si2++) {
            sec = secs[si2];
            sec.ratio = sec.nWindows > 0 ? sec.nFail / sec.nWindows : 0;
            sec.charDiffs = [];
            // clusteriza as janelas-falha da secao em caixas de caractere
            var cregs = [];
            var kf, ff, cg, tp;
            for (kf = 0; kf < sec.falhas.length; kf++) {
                ff = sec.falhas[kf];
                cregs.push({ x0: ff.x, y0: ff.y0, x1: ff.x + ff.w - 1, y1: ff.y1,
                             dirs: ff.dir, score: ff.score, nFail: 1, existArea: 0 });
            }
            mesclaRegioes(cregs, Math.max(4, medBandH >> 1), 3);
            // so clusters "tamanho de caractere/palavra" contam como edicao: altura
            // ate ~2,2 linhas. Cluster muito alto = regua/vinco/grafico, nao letra.
            var charMaxH = Math.max(30, Math.round(2.2 * medBandH));
            var maxCluster = 0;
            for (kf = 0; kf < cregs.length; kf++) {
                cg = cregs[kf];
                if ((cg.y1 - cg.y0 + 1) > charMaxH) continue;
                if (cg.nFail > maxCluster) maxCluster = cg.nFail;
            }
            // fracao das falhas da secao que caem no MAIOR cluster (localizacao)
            var localFrac = sec.nFail > 0 ? maxCluster / sec.nFail : 0;
            if (sec.nWindows < minWindowsPerSection) sec.classe = 'clean';
            else if (sec.ratio >= reworkedRatioMin) sec.classe = 'reworked';
            else if (sec.ratio > 0 && sec.ratio <= editRatioMax &&
                     maxCluster >= editMinCluster && localFrac >= editLocalFrac) sec.classe = 'edit';
            else sec.classe = 'clean';
            sec.maxCluster = maxCluster; sec.localFrac = localFrac;
            for (kf = 0; kf < cregs.length; kf++) {
                cg = cregs[kf];
                if ((cg.y1 - cg.y0 + 1) > charMaxH) continue;   // descarta regua/vinco
                tp = cg.dirs === 3 ? 'diff' : (cg.dirs === 2 ? 'miss' : 'extra');
                sec.charDiffs.push({ x: cg.x0, y: cg.y0, w: cg.x1 - cg.x0 + 1, h: cg.y1 - cg.y0 + 1,
                                     cx: (cg.x0 + cg.x1) / 2, cy: (cg.y0 + cg.y1) / 2,
                                     score: cg.score, type: tp });
            }
            if (sec.classe === 'edit') nEdit++;
            else if (sec.classe === 'reworked') nRework++;
            else nClean++;
        }

        // ---------- comps = charDiffs SO das secoes 'edit' (achatados) ----------
        var cd, c0, box;
        for (si2 = 0; si2 < secs.length; si2++) {
            sec = secs[si2];
            if (sec.classe !== 'edit') continue;
            box = { x: sec.x0, y: sec.y0, w: sec.x1 - sec.x0 + 1, h: sec.y1 - sec.y0 + 1 };
            for (cd = 0; cd < sec.charDiffs.length; cd++) {
                c0 = sec.charDiffs[cd];
                comps.push({ x: c0.x, y: c0.y, w: c0.w, h: c0.h, cx: c0.cx, cy: c0.cy,
                             area: c0.w * c0.h, type: c0.type, kind: 'text',
                             score: c0.score, section: sec.id, sectionBox: box, ids: [] });
            }
        }
        comps.sort(function (a, b) { return a.score - b.score; });

        // formato enxuto das secoes p/ o painel
        var sectionsOut = [];
        for (si2 = 0; si2 < secs.length; si2++) {
            sec = secs[si2];
            sectionsOut.push({ id: sec.id, x: sec.x0, y: sec.y0,
                               w: sec.x1 - sec.x0 + 1, h: sec.y1 - sec.y0 + 1,
                               nWindows: sec.nWindows, nFail: sec.nFail, ratio: sec.ratio,
                               classe: sec.classe, charDiffs: sec.charDiffs });
        }

        var out = {
            comps: comps,
            sections: sectionsOut,
            stats: {
                bands: bands.length,
                windows: avaliadas,
                sections: secs.length,
                edit: nEdit,
                reworked: nRework,
                clean: nClean,
                ms: new Date().getTime() - t0
            }
        };
        if (o.debug) {
            out.debug = {
                falhas: falhas,
                falhasOk: falhasOk,
                bandas: bands,
                candidatos: candidatos.length,
                stride: stride,
                barcode: bcExp,
                medBandH: medBandH,
                caps: { capH: capH, capW: capW, capA: capA },
                sections: secs
            };
        }
        return out;
    }

    // ---- LOCALIZADOR de regioes de texto que diferem (fase 1: onde mudou) ----
    function findRestyledRegions(fileImg, origImg, opts) {
        var o = opts || {};
        var trapTol   = o.trapTol   !== undefined ? o.trapTol   : 3;
        var speckMin  = o.speckMin  !== undefined ? o.speckMin  : 8;
        var residSpeck= o.residSpeck!== undefined ? o.residSpeck: 6;
        var capHMul   = o.capHMul   !== undefined ? o.capHMul   : 2.2;
        var thr       = o.thr       !== undefined ? o.thr       : 0.15;
        var mergeGap  = o.mergeGap  !== undefined ? o.mergeGap  : 1.2;
    
        var W = fileImg.width, H = fileImg.height, n = W * H, i, k;
    
        // 1) mascara de TINTA polarity-agnostica dos DOIS lados (dark|white).
        //    (opcional: OU-com contraste local p/ pegar texto COLORIDO — ver nota).
        var cA = extraiCanais(fileImg), cB = extraiCanais(origImg);
        // FOTO nos 2 lados (photoMask): sombra escura de foto re-tonada vira "tinta"
        // falsa e infla as regioes. Mata a tinta DARK dentro de foto∩foto; o WHITE fica
        // (knockout de texto e vetor por cima da foto — e o que o detector precisa ver).
        if (o.photoMask) { for (i = 0; i < n; i++) if (o.photoMask[i]) { cA.dark[i] = 0; cB.dark[i] = 0; } }
        despeckle(cA.dark,W,H,speckMin); despeckle(cA.white,W,H,speckMin);
        despeckle(cB.dark,W,H,speckMin); despeckle(cB.white,W,H,speckMin);
        var inkA = new Uint8Array(n), inkB = new Uint8Array(n), union = new Uint8Array(n);
        for (i = 0; i < n; i++) {
            inkA[i]  = cA.dark[i] | cA.white[i];
            inkB[i]  = cB.dark[i] | cB.white[i];
            union[i] = inkA[i] | inkB[i];
        }
    
        // 2) bandas de LINHA. Antes tira foto/logo (CC alto) p/ a projecao ter vaos
        //    reais entre linhas (senao a foto vira 1 blob e cola tudo).
        var bands0 = achaBandas(union, W, H);
        var hs = [], b;
        for (i = 0; i < bands0.length; i++) hs.push(bands0[i].h);
        hs.sort(function(a,c){return a-c;});
        var medH = hs.length ? hs[(hs.length/2)|0] : 22;
        var capH = Math.max(34, Math.round(capHMul * medH));
        var seg = removeGrandesCC(union, W, H, n, capH, W);
        var bands = achaBandas(seg, W, H);
    
        // 3) RESIDUAL tolerante a trapping: tinta de A que NAO cai sob a tinta de B
        //    dilatada (e vice-versa). Se A so esta mais encorpado/deslocado <=trapTol,
        //    a dilatacao de B cobre -> residual ~0 (tolera clicheria). Se A foi
        //    RE-ESTILIZADO (knockout no lugar de cinza-fino) ou o CONTEUDO mudou,
        //    B nao cobre -> residual grande. Bidirecional pega os dois sentidos.
        var dilA = inkA, dilB = inkB;
        for (k = 0; k < trapTol; k++) { dilA = dilateBin(dilA,W,H); dilB = dilateBin(dilB,W,H); }
        var residA = new Uint8Array(n), residB = new Uint8Array(n), resid = new Uint8Array(n);
        for (i = 0; i < n; i++) {
            if (inkA[i] && !dilB[i]) residA[i] = 1;
            if (inkB[i] && !dilA[i]) residB[i] = 1;
        }
        despeckle(residA,W,H,residSpeck); despeckle(residB,W,H,residSpeck);
        for (i = 0; i < n; i++) resid[i] = residA[i] | residB[i];
    
        // 4) metrica POR LINHA: rf = pixels de residual / pixels de tinta (union),
        //    dentro do bbox X apertado ao conteudo real da banda.
        var preUnion, preResid, x, xs0, xs1, colHas;
        var lines = [];
        for (var bi = 0; bi < bands.length; bi++) {
            b = bands[bi];
            preUnion = prefixoBanda(union, W, b.y0, b.y1);
            preResid = prefixoBanda(resid, W, b.y0, b.y1);
            // recorta X: primeira/ultima coluna com tinta na banda
            xs0 = -1; xs1 = -1;
            for (x = 0; x < W; x++) { if (preUnion[x+1] - preUnion[x] > 0) { if (xs0<0) xs0=x; xs1=x; } }
            if (xs0 < 0) continue;
            var inkSum   = preUnion[xs1+1] - preUnion[xs0];
            var residSum = preResid[xs1+1] - preResid[xs0];
            var rf = inkSum > 0 ? residSum / inkSum : 0;
            lines.push({ y0:b.y0, y1:b.y1, x0:xs0, x1:xs1, rf:rf, flag: rf > thr });
        }
    
        // 5) funde bandas flagradas contiguas (vao<=mergeGap*medH) em REGIOES;
        //    aperta o X de cada regiao as colunas de RESIDUAL (bbox p/ o OCR).
        var regions = [], cur = null, gap = mergeGap * medH, ln;
        for (i = 0; i < lines.length; i++) {
            ln = lines[i];
            if (ln.flag) {
                if (cur && (ln.y0 - cur.y1) <= gap) cur.y1 = ln.y1;
                else { if (cur) regions.push(cur); cur = { y0:ln.y0, y1:ln.y1 }; }
            } else if (cur) { regions.push(cur); cur = null; }
        }
        if (cur) regions.push(cur);
        for (i = 0; i < regions.length; i++) {
            var r = regions[i], src = resid, c0 = -1, c1 = -1, y, off;
            // colunas com residual na faixa (fallback: union)
            for (var pass = 0; pass < 2 && c0 < 0; pass++) {
                src = pass === 0 ? resid : union;
                for (x = 0; x < W; x++) {
                    var any = 0;
                    for (y = r.y0; y <= r.y1 && !any; y++) if (src[y*W + x]) any = 1;
                    if (any) { if (c0 < 0) c0 = x; c1 = x; }
                }
            }
            r.x = c0; r.y = r.y0; r.w = c1 - c0 + 1; r.h = r.y1 - r.y0 + 1;
        }
        // 6) MICRO-MARCAS (pontos/vírgulas de pontuação): um ponto removido fica a ~3px
        //    dos dígitos vizinhos e o trapTol normal ENGOLE. Passe fino: tinta de um lado
        //    sem cobertura do outro dilatado por só 1px, mantendo apenas CCs PEQUENOS
        //    (3..120px). Banda com >=2 micro-marcas vira REGIÃO (o OCR decide se a
        //    pontuação mudou — ex.: "1.1772.0001" -> "1 1772 0001").
        //    DESLIGADO por padrão (rollback pré-cloreto): só roda com o.microMarks=true.
        if (o.microMarks === true) (function () {
            var d1A = dilateBin(inkA, W, H), d1B = dilateBin(inkB, W, H);
            var rf2 = new Uint8Array(n), i2;
            for (i2 = 0; i2 < n; i2++) {
                if (o.photoMask && o.photoMask[i2]) continue;   // grão de FOTO não é pontuação
                if (inkA[i2] && !d1B[i2]) rf2[i2] = 1;
                if (inkB[i2] && !d1A[i2]) rf2[i2] = 1;
            }
            // CCs pequenos apenas
            var seen2 = new Int32Array(n), qx = new Int32Array(4096), qy = new Int32Array(4096), micro = [];
            var x2, y2, sp, cc = 0;
            for (y2 = 0; y2 < H; y2++) for (x2 = 0; x2 < W; x2++) {
                var p0 = y2 * W + x2;
                if (!rf2[p0] || seen2[p0]) continue;
                cc++; sp = 0; qx[sp] = x2; qy[sp] = y2; sp++; seen2[p0] = cc;
                var minx = x2, maxx = x2, miny = y2, maxy = y2, area = 0, overflow = false;
                while (sp > 0) {
                    sp--; var cx2 = qx[sp], cy2 = qy[sp]; area++;
                    if (cx2 < minx) minx = cx2; if (cx2 > maxx) maxx = cx2;
                    if (cy2 < miny) miny = cy2; if (cy2 > maxy) maxy = cy2;
                    for (var dd = 0; dd < 4; dd++) {
                        var nx = cx2 + (dd === 0 ? 1 : dd === 1 ? -1 : 0), ny = cy2 + (dd === 2 ? 1 : dd === 3 ? -1 : 0);
                        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                        var np = ny * W + nx;
                        if (rf2[np] && !seen2[np]) { seen2[np] = cc; if (sp < 4095) { qx[sp] = nx; qy[sp] = ny; sp++; } else overflow = true; }
                    }
                }
                if (!overflow && area >= 3 && area <= 120 && (maxx - minx) <= 18 && (maxy - miny) <= 18)
                    micro.push({ x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, cy: (miny + maxy) >> 1 });
            }
            // agrupa micro-marcas por BANDA (mesma linha) — >=2 na banda vira região
            micro.sort(function (a, b2) { return a.cy - b2.cy; });
            var gi2 = 0;
            while (gi2 < micro.length) {
                var g0 = micro[gi2], grp = [g0], gj = gi2 + 1;
                while (gj < micro.length && micro[gj].cy - g0.cy <= Math.max(10, medH)) { grp.push(micro[gj]); gj++; }
                // marca SOLITÁRIA de corpo real (área>=12, min dim>=3) também vira região:
                // caractere único deletado (R de "INGR.:") não tem irmão na banda; strips
                // finas de re-peso (min<=2) ficam de fora — e o OCR é o juiz final.
                var solitariaOk = grp.length === 1 && (grp[0].w * grp[0].h) >= 12 &&
                                  Math.min(grp[0].w, grp[0].h) >= 3;
                if (grp.length >= 2 || solitariaOk) {
                    var gx0 = 1e9, gy0 = 1e9, gx1 = -1, gy1 = -1, gk;
                    for (gk = 0; gk < grp.length; gk++) {
                        var gg = grp[gk];
                        if (gg.x < gx0) gx0 = gg.x; if (gg.y < gy0) gy0 = gg.y;
                        if (gg.x + gg.w > gx1) gx1 = gg.x + gg.w; if (gg.y + gg.h > gy1) gy1 = gg.y + gg.h;
                    }
                    // bbox PURO das marcas (p/ o zoom apontar exatamente nos pontos)
                    var pureX = gx0, pureY = gy0, pureW = gx1 - gx0, pureH = gy1 - gy0;
                    // expande p/ a LINHA inteira (o OCR precisa do contexto)
                    gy0 = Math.max(0, gy0 - medH); gy1 = Math.min(H, gy1 + medH);
                    gx0 = Math.max(0, gx0 - 30 * grp.length); gx1 = Math.min(W, gx1 + 30 * grp.length);
                    regions.push({ x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0, micro: true,
                                   mx: pureX, my: pureY, mw: pureW, mh: pureH });
                }
                gi2 = gj;
            }
        })();
        return { regions: regions, lines: lines, medH: medH, resid: resid };
        // NOTA texto COLORIDO (ex.: vermelho da Coca, invisivel a dark/white): no
        // passo 1 OU-com um canal de contraste local
        // contrast[i] = Math.abs(luma[i]-mediaLocal(luma,raio15)) > 35, entao o mesmo
        // residual pega glifo colorido. O metrico por linha NAO dispara p/ edicao de
        // 1 glifo (area<<linha) -> p/ isso use os CCs de `resid` (>=~20px) como
        // regioes-candidatas adicionais (sub-linha).
    }

    return {
        findTextDiffs: findTextDiffs,
        findRestyledRegions: findRestyledRegions
    };
});

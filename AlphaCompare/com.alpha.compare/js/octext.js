/*
 * octext.js - AlphaCompare - Inspecao de TEXTO por OCR (estilo GlobalVision Text Inspection).
 *
 * Le o texto dos dois lados (arquivo tratado x original) e compara STRINGS. Serve
 * para o caso em que a MESMA frase foi re-estilizada (branco-knockout encorpado x
 * cinza-fino sobre madeira): o pixel/forma nao isola porque a linha inteira difere,
 * mas o OCR le "0763" x "0591" e faz o diff exato dos digitos.
 *
 * Motor: tesseract.js 5.1.1 (LSTM, oem 1) 100% OFFLINE, embutido em
 *   lib/tesseract/ (core wasm nao-SIMD + eng/por traineddata). Roda no painel CEP
 *   (Chromium 88, via require do Node do mixed-context) E em Node puro (harness).
 *
 * Pre-processo validado (mascara binaria polarity-agnostic + upscale): para cada
 * secao, brilho = max(R,G,B) -> upscale (bilinear) -> Otsu global -> texto = classe
 * MINORITARIA (pega glifo escuro OU branco-knockout, removendo a madeira) ->
 * texto PRETO sobre fundo BRANCO, com borda. Sai um BMP 24-bit que o tesseract le.
 *
 * API (window.ACOcr / module.exports):
 *   ACOcr.init(opts) -> Promise            carrega worker/core/lang uma vez (cache)
 *   ACOcr.readSections(img, sections, opts) -> Promise<[{id,text,boxes:[{text,x,y,w,h}]}]>
 *   ACOcr.diffSections(fileImg, origImg, sections, opts) -> Promise<{comps, sectionsText}>
 *   ACOcr.preprocess(img, section, opts) -> {data,width,height, up,pad,sx,sy}  (debug)
 *   ACOcr.terminate() -> Promise
 *
 * Imagens: {data, width, height} com data RGBA (Uint8Array/Uint8ClampedArray).
 * Sections: [{ id, x, y, w, h, numeric?, charWhitelist?, psm? }] em px da img.
 *
 * Estilo ES5 (var/function; sem arrow/let/const/template-literal), Promises OK
 * (Chromium 88 e Node suportam). Comentarios pt-BR.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.ACOcr = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    "use strict";

    // ------------------------------------------------------------------
    // Resolucao de caminhos (painel: window.location; Node: __dirname)
    // Espelha o extDir() do lib/pdfium/pdfrender.js.
    // ------------------------------------------------------------------
    function reqNode(name) {
        // require do Node (existe no CEP mixed-context e no Node puro)
        if (typeof require === 'function') return require(name);
        throw new Error('ACOcr: require do Node indisponivel (necessario para o OCR).');
    }

    function extRoot() {
        // Raiz da extensao (pasta que contem index.html e /js e /lib).
        if (typeof window !== 'undefined' && window.location && window.location.pathname) {
            var p = decodeURIComponent(window.location.pathname);   // /C:/.../index.html
            if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
            return reqNode('path').dirname(p);
        }
        // Node: este arquivo esta em <ext>/js/octext.js -> sobe um nivel
        if (typeof __dirname !== 'undefined') return reqNode('path').dirname(__dirname);
        throw new Error('ACOcr: nao consegui resolver a raiz da extensao.');
    }

    function tessDir() { return extRoot() + '/lib/tesseract'; }

    // ------------------------------------------------------------------
    // Estado global (workers cacheados)
    // ------------------------------------------------------------------
    var _createWorker = null;   // funcao createWorker do tesseract.js
    var _wNum = null;           // worker numerico (eng) - digitos/codigos
    var _wTxt = null;           // worker de letras (por+eng)
    var _initing = null;

    // ------------------------------------------------------------------
    // init(opts): carrega o tesseract.js e sobe os dois workers UMA vez.
    //   opts.langNum   (default 'eng')      idioma do worker numerico
    //   opts.langText  (default 'por+eng')  idioma do worker de letras
    //   opts.textOnly  (default false)      sobe so o worker de letras
    //   opts.numOnly   (default false)      sobe so o worker numerico
    // ------------------------------------------------------------------
    // ------------------------------------------------------------------
    // BACKEND INLINE (SEM worker) — obrigatório no PAINEL CEP: worker_threads
    // do Node embutido DERRUBA o processo do CEF (a tela reseta ao terminar).
    // Mesma arquitetura do pdfium: require do glue + wasmBinary via fs, tudo no
    // thread principal. Reusa setImage/dump do próprio tesseract.js -> saída
    // idêntica à do worker (blocks/words/symbols/bbox/confidence).
    // ------------------------------------------------------------------
    var _inline = null;          // { M, apis:{langs->TessBaseAPI} } (módulo wasm persiste)
    function inlineInit() {
        if (_inline) return Promise.resolve(_inline);
        var dir = tessDir();
        var fs = reqNode('fs'), zlib = reqNode('zlib');
        var CoreFactory = reqNode(dir + '/node_modules/tesseract.js-core/tesseract-core.wasm.js');
        if (CoreFactory && CoreFactory.TesseractCore) CoreFactory = CoreFactory.TesseractCore;
        var wasmBinary = new Uint8Array(fs.readFileSync(dir + '/node_modules/tesseract.js-core/tesseract-core.wasm')).buffer;
        // glue Emscripten pode exigir Node>=16 (CEP tem 15.9) — finge e restaura (igual pdfium)
        var pv = (typeof process === 'object' && process.versions) ? process.versions : null;
        var origNode = pv ? pv.node : null, faked = false;
        if (pv && origNode && parseInt(origNode, 10) < 16) {
            try { Object.defineProperty(pv, 'node', { value: '16.0.0', configurable: true }); faked = true; } catch (eF) {}
        }
        function restore() { if (faked) { try { Object.defineProperty(pv, 'node', { value: origNode, configurable: true }); } catch (eR) {} } }
        return Promise.resolve(CoreFactory({ wasmBinary: wasmBinary })).then(function (M) {
            restore();
            var langs = ['eng', 'por'], i;
            for (i = 0; i < langs.length; i++) {
                var gz = fs.readFileSync(dir + '/lang/' + langs[i] + '.traineddata.gz');
                M.FS.writeFile(langs[i] + '.traineddata', new Uint8Array(zlib.gunzipSync(gz)));
            }
            _inline = { M: M, apis: {} };
            return _inline;
        }, function (e) { restore(); throw e; });
    }
    function inlineApi(st, langs) {
        if (st.apis[langs]) return st.apis[langs];
        var api = new st.M.TessBaseAPI();
        if (api.Init(null, langs, 1) === -1) throw new Error('Tesseract Init falhou (' + langs + ')');
        try {
            var dp = reqNode(tessDir() + '/node_modules/tesseract.js/src/worker-script/constants/defaultParams');
            var k; for (k in dp) if (dp.hasOwnProperty(k)) { try { api.SetVariable(k, String(dp[k])); } catch (eV) {} }
        } catch (eP) {}
        st.apis[langs] = api;
        return api;
    }
    // façade com a MESMA interface do worker (setParameters/recognize/terminate)
    function inlineWorker(langs) {
        var pend = {};
        return {
            setParameters: function (p) { var k; pend = {}; if (p) { for (k in p) if (p.hasOwnProperty(k)) pend[k] = p[k]; } return Promise.resolve(); },
            recognize: function (image) {
                return inlineInit().then(function (st) {
                    var api = inlineApi(st, langs);
                    var k; for (k in pend) if (pend.hasOwnProperty(k)) api.SetVariable(k, String(pend[k]));
                    var setImg = reqNode(tessDir() + '/node_modules/tesseract.js/src/worker-script/utils/setImage');
                    setImg(st.M, api, image);
                    api.Recognize(null);
                    var dump = reqNode(tessDir() + '/node_modules/tesseract.js/src/worker-script/utils/dump');
                    var out = reqNode(tessDir() + '/node_modules/tesseract.js/src/worker-script/constants/defaultOutput');
                    var data = dump(st.M, api, out, {});
                    return { data: data };
                });
            },
            terminate: function () { return Promise.resolve(); }
        };
    }

    function init(opts) {
        if (_initing) return _initing;
        var o = opts || {};
        var dir = tessDir();
        var CORE = dir + '/node_modules/tesseract.js-core';
        var LANG = dir + '/lang';
        var langNum = o.langNum || 'eng';
        var langText = o.langText || 'por+eng';
        var numOnly = o.numOnly === true;
        var textOnly = o.textOnly === true;

        // PAINEL (CEP): window/document existem -> worker_threads derrubaria o CEF.
        // Backend INLINE (core no thread principal). Node puro (bancada) segue no worker.
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            _initing = inlineInit().then(function () {
                if (!textOnly) _wNum = inlineWorker(langNum);
                if (!numOnly) _wTxt = inlineWorker(langText);
                return true;
            });
            return _initing;
        }

        _initing = new Promise(function (resolve, reject) {
            try {
                var t = reqNode(dir + '/node_modules/tesseract.js');
                _createWorker = t.createWorker;
                // workerPath EXPLÍCITO: o default usa __dirname, que no CEP vem como
                // URL file:// -> new Worker() recusa ("must be an absolute path...").
                // tessDir() já resolve o caminho Windows limpo (C:/...).
                var WORKER = dir + '/node_modules/tesseract.js/src/worker-script/node/index.js';
                var wopts = { workerPath: WORKER, corePath: CORE, langPath: LANG, gzip: true, cacheMethod: 'none', logger: function () {} };
                var jobs = [];
                if (!textOnly) {
                    jobs.push(_createWorker(langNum, 1, wopts).then(function (w) { _wNum = w; }));
                }
                if (!numOnly) {
                    jobs.push(_createWorker(langText, 1, wopts).then(function (w) { _wTxt = w; }));
                }
                Promise.all(jobs).then(function () { resolve(true); }, reject);
            } catch (e) { reject(e); }
        });
        return _initing;
    }

    function terminate() {
        var jobs = [];
        if (_wNum) { jobs.push(_wNum.terminate()); _wNum = null; }
        if (_wTxt) { jobs.push(_wTxt.terminate()); _wTxt = null; }
        _initing = null;
        return Promise.all(jobs);
    }

    // solta o MÓDULO wasm do tesseract (o heap não encolhe sozinho) — o painel chama
    // no fim do pipeline; a próxima leitura re-inicializa.
    function reset() {
        _inline = null; _initing = null; _wNum = null; _wTxt = null;
        return Promise.resolve();
    }

    // ------------------------------------------------------------------
    // Otsu global (histograma de 256 niveis) sobre um Uint8Array grayscale.
    // ------------------------------------------------------------------
    function otsu(g) {
        var hist = new Float64Array(256);
        var i, n = g.length;
        for (i = 0; i < n; i++) hist[g[i]]++;
        var sum = 0;
        for (i = 0; i < 256; i++) sum += i * hist[i];
        var sumB = 0, wB = 0, wF = 0, mx = 0, th = 0, mB, mF, v;
        for (i = 0; i < 256; i++) {
            wB += hist[i];
            if (wB === 0) continue;
            wF = n - wB;
            if (wF === 0) break;
            sumB += i * hist[i];
            mB = sumB / wB;
            mF = (sum - sumB) / wF;
            v = wB * wF * (mB - mF) * (mB - mF);
            if (v > mx) { mx = v; th = i; }
        }
        return th;
    }

    // ------------------------------------------------------------------
    // Upscale bilinear de um grayscale (Uint8Array) sw*sh -> dw*dh.
    // ------------------------------------------------------------------
    function resizeBilinearGray(src, sw, sh, dw, dh) {
        var out = new Uint8Array(dw * dh);
        var x, y, sx, sy, x0, y0, x1, y1, fx, fy, v00, v01, v10, v11;
        var sxr = sw > 1 ? (sw - 1) / (dw - 1 || 1) : 0;
        var syr = sh > 1 ? (sh - 1) / (dh - 1 || 1) : 0;
        for (y = 0; y < dh; y++) {
            sy = y * syr;
            y0 = sy | 0; y1 = y0 + 1 < sh ? y0 + 1 : y0; fy = sy - y0;
            for (x = 0; x < dw; x++) {
                sx = x * sxr;
                x0 = sx | 0; x1 = x0 + 1 < sw ? x0 + 1 : x0; fx = sx - x0;
                v00 = src[y0 * sw + x0]; v01 = src[y0 * sw + x1];
                v10 = src[y1 * sw + x0]; v11 = src[y1 * sw + x1];
                out[y * dw + x] = (v00 * (1 - fy) * (1 - fx) + v01 * (1 - fy) * fx +
                                   v10 * fy * (1 - fx) + v11 * fy * fx) + 0.5 | 0;
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Despeckle: remove componentes conexos (4-conectividade) < minArea de uma
    // mascara binaria (Uint8Array 0/1), in place. Usa pilha explicita (sem recursao).
    // ------------------------------------------------------------------
    function despeckle(mask, W, H, minArea) {
        var n = W * H;
        var visited = new Uint8Array(n);
        var stack = new Int32Array(n);
        var order = new Int32Array(n);
        var i, sp, cnt, cur, cx, cy, k;
        var DX = [-1, 1, 0, 0], DY = [0, 0, -1, 1], nx, ny, ni;
        for (i = 0; i < n; i++) {
            if (!mask[i] || visited[i]) continue;
            sp = 0; cnt = 0;
            stack[sp++] = i; visited[i] = 1;
            while (sp > 0) {
                cur = stack[--sp];
                order[cnt++] = cur;
                cx = cur % W; cy = (cur / W) | 0;
                for (k = 0; k < 4; k++) {
                    nx = cx + DX[k]; ny = cy + DY[k];
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    ni = ny * W + nx;
                    if (mask[ni] && !visited[ni]) { visited[ni] = 1; stack[sp++] = ni; }
                }
            }
            if (cnt < minArea) { for (k = 0; k < cnt; k++) mask[order[k]] = 0; }
        }
        return mask;
    }

    // ------------------------------------------------------------------
    // Codificador BMP 24-bit (bottom-up, BGR, linhas alinhadas a 4 bytes).
    // Entrada: gray Uint8Array (W*H) — grava R=G=B=gray. Saida: Uint8Array BMP.
    // O tesseract.js (setImage) detecta o BMP e le via bmp-js/leptonica.
    // ------------------------------------------------------------------
    function encodeBMP24(gray, W, H) {
        var rowSize = (W * 3 + 3) & ~3;
        var imgSize = rowSize * H;
        var offset = 54;
        var total = offset + imgSize;
        var buf = new Uint8Array(total);
        var dv = (typeof DataView !== 'undefined') ? new DataView(buf.buffer) : null;
        function u16(pos, val) {
            if (dv) { dv.setUint16(pos, val, true); return; }
            buf[pos] = val & 255; buf[pos + 1] = (val >> 8) & 255;
        }
        function u32(pos, val) {
            if (dv) { dv.setUint32(pos, val >>> 0, true); return; }
            buf[pos] = val & 255; buf[pos + 1] = (val >> 8) & 255;
            buf[pos + 2] = (val >> 16) & 255; buf[pos + 3] = (val >> 24) & 255;
        }
        // BITMAPFILEHEADER
        buf[0] = 0x42; buf[1] = 0x4D;               // 'BM'
        u32(2, total); u32(6, 0); u32(10, offset);
        // BITMAPINFOHEADER
        u32(14, 40); u32(18, W); u32(22, H);        // height>0 = bottom-up
        u16(26, 1); u16(28, 24); u32(30, 0);        // planes, bpp, compress
        u32(34, imgSize); u32(38, 2835); u32(42, 2835);
        u32(46, 0); u32(50, 0);
        // pixels (bottom-up)
        var x, y, srcRow, dstRow, v, p;
        for (y = 0; y < H; y++) {
            srcRow = (H - 1 - y) * W;               // linha de baixo primeiro
            dstRow = offset + y * rowSize;
            p = dstRow;
            for (x = 0; x < W; x++) {
                v = gray[srcRow + x];
                buf[p++] = v; buf[p++] = v; buf[p++] = v;   // B G R
            }
        }
        return buf;
    }

    // ------------------------------------------------------------------
    // Pre-processo de UMA secao -> imagem binaria (gray 0/255) pronta p/ OCR.
    // Retorna { data(gray Uint8Array), width, height, up, pad, sx, sy, sw, sh }.
    // ------------------------------------------------------------------
    function preprocess(img, section, opts) {
        var o = opts || {};
        var W = img.width, H = img.height, d = img.data;
        var pad = o.pad !== undefined ? o.pad : 30;
        var minpx = o.despeckleMin !== undefined ? o.despeckleMin : 1.2;
        var polarity = o.polarity || 'auto';   // 'auto' | 'bright' | 'dark'

        // clip da secao dentro da imagem
        var sx = Math.max(0, Math.round(section.x));
        var sy = Math.max(0, Math.round(section.y));
        var sw = Math.round(section.w), sh = Math.round(section.h);
        if (sx + sw > W) sw = W - sx;
        if (sy + sh > H) sh = H - sy;
        if (sw < 1 || sh < 1) return null;

        // fator de upscale: alto p/ glifos pequenos, mas limita o total de pixels
        var up = o.upscale !== undefined ? o.upscale : 8;
        var maxPix = o.maxPixels !== undefined ? o.maxPixels : 12000000;
        while (up > 1 && (sw * up) * (sh * up) > maxPix) up--;

        // brilho = max(R,G,B) por pixel do recorte
        var bright = new Uint8Array(sw * sh);
        var xx, yy, si, p, r, g, b, mx;
        for (yy = 0; yy < sh; yy++) {
            for (xx = 0; xx < sw; xx++) {
                p = ((sy + yy) * W + (sx + xx)) * 4;
                r = d[p]; g = d[p + 1]; b = d[p + 2];
                mx = r > g ? r : g; if (b > mx) mx = b;
                bright[yy * sw + xx] = mx;
            }
        }

        // upscale bilinear
        var dw = sw * up, dh = sh * up;
        var big = up > 1 ? resizeBilinearGray(bright, sw, sh, dw, dh) : bright;

        // Otsu + polaridade (texto = classe minoritaria em 'auto')
        var th = otsu(big);
        var i, nBig = dw * dh, above = 0;
        for (i = 0; i < nBig; i++) if (big[i] > th) above++;
        var below = nBig - above;
        var textBright;
        if (polarity === 'bright') textBright = true;
        else if (polarity === 'dark') textBright = false;
        else textBright = above <= below;   // minoria = texto (traco fino)

        var mask = new Uint8Array(nBig);
        if (textBright) { for (i = 0; i < nBig; i++) mask[i] = big[i] > th ? 1 : 0; }
        else { for (i = 0; i < nBig; i++) mask[i] = big[i] <= th ? 1 : 0; }

        // remove specks (< up*up*minpx pixels = < ~minpx pixel-fonte)
        despeckle(mask, dw, dh, Math.max(1, Math.round(up * up * minpx)));

        // monta imagem final: texto PRETO(0) sobre BRANCO(255), com borda
        var ow = dw + 2 * pad, oh = dh + 2 * pad;
        var out = new Uint8Array(ow * oh);
        for (i = 0; i < out.length; i++) out[i] = 255;
        for (yy = 0; yy < dh; yy++) {
            for (xx = 0; xx < dw; xx++) {
                if (mask[yy * dw + xx]) out[(yy + pad) * ow + (xx + pad)] = 0;
            }
        }
        return { data: out, width: ow, height: oh, up: up, pad: pad, sx: sx, sy: sy, sw: sw, sh: sh };
    }

    // ------------------------------------------------------------------
    // Achata o resultado do tesseract (blocks->...->words->symbols) em uma lista
    // de SIMBOLOS { text, x0, y0, x1, y1 } em ordem de leitura.
    // ------------------------------------------------------------------
    function flattenSymbols(data) {
        var out = [];
        var blocks = data && data.blocks;
        if (!blocks) return out;
        var bi, pi, li, wi, si, bl, pa, ln, wd, sy, bb;
        for (bi = 0; bi < blocks.length; bi++) {
            bl = blocks[bi]; if (!bl || !bl.paragraphs) continue;
            for (pi = 0; pi < bl.paragraphs.length; pi++) {
                pa = bl.paragraphs[pi]; if (!pa || !pa.lines) continue;
                for (li = 0; li < pa.lines.length; li++) {
                    ln = pa.lines[li]; if (!ln || !ln.words) continue;
                    for (wi = 0; wi < ln.words.length; wi++) {
                        wd = ln.words[wi];
                        if (wd && wd.symbols && wd.symbols.length) {
                            for (si = 0; si < wd.symbols.length; si++) {
                                sy = wd.symbols[si]; bb = sy.bbox || {};
                                out.push({ text: sy.text || '', x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1 });
                            }
                        } else if (wd && wd.bbox) {
                            // fallback: sem simbolos, usa a palavra inteira
                            bb = wd.bbox;
                            out.push({ text: wd.text || '', x0: bb.x0, y0: bb.y0, x1: bb.x1, y1: bb.y1, word: true });
                        }
                    }
                }
            }
        }
        return out;
    }

    // Um char e "de token" se for alfanumerico (letra/digito). Separadores
    // (espaco, '/', '.', ',', 'º', etc.) quebram tokens.
    function isTokChar(ch) {
        return /[0-9A-Za-zÀ-ÿ]/.test(ch);
    }

    // Agrupa a lista de simbolos em TOKENS (runs alfanumericos), cada um com
    // bbox = uniao dos simbolos e mapeamento p/ coords da img original.
    function tokenize(symbols, meta) {
        var toks = [];
        var cur = null;
        var i, s, ch, k;
        function pushCur() {
            if (cur && cur.text.length) {
                // mapeia bbox (px da img OCR) -> px da img original
                var x = meta.sx + (cur.x0 - meta.pad) / meta.up;
                var y = meta.sy + (cur.y0 - meta.pad) / meta.up;
                var w = (cur.x1 - cur.x0) / meta.up;
                var h = (cur.y1 - cur.y0) / meta.up;
                toks.push({ text: cur.text, x: x, y: y, w: w, h: h });
            }
            cur = null;
        }
        for (i = 0; i < symbols.length; i++) {
            s = symbols[i];
            var t = (s.text || '');
            // um simbolo pode conter mais de um char (fallback de palavra) — trata char a char
            var hasTok = false;
            for (k = 0; k < t.length; k++) { if (isTokChar(t[k])) { hasTok = true; break; } }
            if (!hasTok) { pushCur(); continue; }
            // extrai apenas os chars alfanumericos p/ o texto do token
            var clean = '';
            for (k = 0; k < t.length; k++) { ch = t[k]; if (isTokChar(ch)) clean += ch; }
            if (!cur) cur = { text: '', x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 };
            cur.text += clean;
            if (s.x0 < cur.x0) cur.x0 = s.x0;
            if (s.y0 < cur.y0) cur.y0 = s.y0;
            if (s.x1 > cur.x1) cur.x1 = s.x1;
            if (s.y1 > cur.y1) cur.y1 = s.y1;
        }
        pushCur();
        return toks;
    }

    // ------------------------------------------------------------------
    // Similaridade de strings (1 - Levenshtein normalizada)
    // ------------------------------------------------------------------
    function lev(a, b) {
        var m = a.length, n = b.length;
        if (m === 0) return n; if (n === 0) return m;
        var prev = new Int32Array(n + 1), cur = new Int32Array(n + 1);
        var i, j, cost, tmp;
        for (j = 0; j <= n; j++) prev[j] = j;
        for (i = 1; i <= m; i++) {
            cur[0] = i;
            for (j = 1; j <= n; j++) {
                cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
                var del = prev[j] + 1, ins = cur[j - 1] + 1, sub = prev[j - 1] + cost;
                cur[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
            }
            tmp = prev; prev = cur; cur = tmp;
        }
        return prev[n];
    }
    function sim(a, b) {
        if (!a && !b) return 1;
        var L = Math.max(a.length, b.length) || 1;
        return 1 - lev(a, b) / L;
    }
    function normTok(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

    // ------------------------------------------------------------------
    // Alinha duas sequencias de tokens (Needleman-Wunsch simples). Retorna
    // pares { f, o } onde f/o sao tokens ou null (gap). Match/mismatch usam
    // similaridade; gap tem custo fixo.
    // ------------------------------------------------------------------
    function alignTokens(fTok, oTok) {
        var m = fTok.length, n = oTok.length;
        var gap = 1.0;                      // custo de abrir gap
        var i, j;
        var D = [];
        for (i = 0; i <= m; i++) { D.push(new Float64Array(n + 1)); }
        for (i = 0; i <= m; i++) D[i][0] = i * gap;
        for (j = 0; j <= n; j++) D[0][j] = j * gap;
        for (i = 1; i <= m; i++) {
            for (j = 1; j <= n; j++) {
                var s = sim(normTok(fTok[i - 1].text), normTok(oTok[j - 1].text));
                var mm = D[i - 1][j - 1] + (1 - s);      // custo de casar (0 = igual)
                var dd = D[i - 1][j] + gap;
                var ii = D[i][j - 1] + gap;
                D[i][j] = mm < dd ? (mm < ii ? mm : ii) : (dd < ii ? dd : ii);
            }
        }
        // backtrack
        var pairs = [];
        i = m; j = n;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0) {
                var s2 = sim(normTok(fTok[i - 1].text), normTok(oTok[j - 1].text));
                if (Math.abs(D[i][j] - (D[i - 1][j - 1] + (1 - s2))) < 1e-9) {
                    pairs.push({ f: fTok[i - 1], o: oTok[j - 1] }); i--; j--; continue;
                }
            }
            if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + gap)) < 1e-9) {
                pairs.push({ f: fTok[i - 1], o: null }); i--; continue;
            }
            pairs.push({ f: null, o: oTok[j - 1] }); j--;
        }
        pairs.reverse();
        return pairs;
    }

    // ------------------------------------------------------------------
    // OCR de UMA secao num worker. Retorna Promise<{ text, toks }>.
    // ------------------------------------------------------------------
    function ocrSection(worker, img, section, opts) {
        var o = opts || {};
        var pp = preprocess(img, section, o);
        if (!pp) return Promise.resolve({ text: '', toks: [] });
        var psm = section.psm || o.psm || (section.numeric ? '7' : '6');
        var wl = section.numeric
            ? (section.charWhitelist !== undefined ? section.charWhitelist
                : (o.charWhitelist !== undefined ? o.charWhitelist : '0123456789/.-'))
            : (section.charWhitelist !== undefined ? section.charWhitelist : '');
        var bmp = encodeBMP24(pp.data, pp.width, pp.height);
        return worker.setParameters({ tessedit_pageseg_mode: String(psm), tessedit_char_whitelist: wl })
            .then(function () { return worker.recognize(bmp); })
            .then(function (rec) {
                var data = rec.data;
                var syms = flattenSymbols(data);
                var toks = tokenize(syms, pp);
                var text = data.text ? data.text.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '') : '';
                return { text: text, toks: toks };
            });
    }

    function pickWorker(section) {
        if (section.numeric) {
            if (_wNum) return _wNum;
            if (_wTxt) return _wTxt;   // fallback
        } else {
            if (_wTxt) return _wTxt;
            if (_wNum) return _wNum;
        }
        return null;
    }

    // ==================================================================
    // MODO "LABEL INTEIRA" estilo GlobalVision: OCR da arte toda dos 2 lados
    // (uma passada cada) -> palavras com CAIXA + CONFIANÇA -> casa por POSIÇÃO
    // (as imagens já vêm alinhadas) -> reporta TROCOU / SUMIU / A MAIS.
    // ==================================================================

    // OCR da imagem inteira (ou de uma seção grande). psm 11 = "sparse text": acha
    // texto espalhado pela label. Retorna [{text,x,y,w,h,conf}] em coords da imagem.
    function recognizeWords(img, opts) {
        var o = opts || {};
        var section = o.section || { x: 0, y: 0, w: img.width, h: img.height };
        section.psm = o.psm || section.psm || '11';
        return init(o).then(function () {
            var w = _wTxt || _wNum;
            if (!w) throw new Error('ACOcr: worker nao inicializado.');
            var pp = preprocess(img, section, { upscale: o.upscale != null ? o.upscale : 1 });
            if (!pp) return [];
            var bmp = encodeBMP24(pp.data, pp.width, pp.height);
            return w.setParameters({ tessedit_pageseg_mode: String(section.psm), tessedit_char_whitelist: o.charWhitelist || '' })
                .then(function () { return w.recognize(bmp); })
                .then(function (rec) {
                    var words = [], data = rec.data, blocks = data && data.blocks, bi, pi, li, wi;
                    if (!blocks) return words;
                    for (bi = 0; bi < blocks.length; bi++) {
                        var bl = blocks[bi]; if (!bl || !bl.paragraphs) continue;
                        for (pi = 0; pi < bl.paragraphs.length; pi++) {
                            var pa = bl.paragraphs[pi]; if (!pa || !pa.lines) continue;
                            for (li = 0; li < pa.lines.length; li++) {
                                var ln = pa.lines[li]; if (!ln || !ln.words) continue;
                                for (wi = 0; wi < ln.words.length; wi++) {
                                    var wd = ln.words[wi]; if (!wd || !wd.bbox) continue;
                                    var txt = (wd.text || '').replace(/\s+/g, ''); if (!txt) continue;
                                    var bb = wd.bbox;
                                    words.push({ text: txt,
                                        x: pp.sx + (bb.x0 - pp.pad) / pp.up, y: pp.sy + (bb.y0 - pp.pad) / pp.up,
                                        w: (bb.x1 - bb.x0) / pp.up, h: (bb.y1 - bb.y0) / pp.up,
                                        conf: wd.confidence != null ? wd.confidence : 0 });
                                }
                            }
                        }
                    }
                    return words;
                });
        });
    }

    // Casa palavras do ARQUIVO x ORIGINAL por POSIÇÃO (imagens alinhadas). Retorna diffs:
    //   {type:'diff',  textOrig, textFile}  TROCOU (mesma posição, texto diferente)
    //   {type:'miss',  textOrig, textFile:''}  SUMIU (no original, sem par no arquivo)
    //   {type:'extra', textOrig:'', textFile}  A MAIS (no arquivo, sem par no original)
    // Gates: confiança mínima (minConf), token >= 2 chars, e uma palavra "sem par" só
    // conta se NÃO houver nenhuma palavra parecida por perto (evita ruído de segmentação).
    function alignWords(wordsFile, wordsOrig, opts) {
        var o = opts || {}, minConf = o.minConf != null ? o.minConf : 55;
        var diffs = [], usedF = {}, i, j;
        function cx(wd) { return wd.x + wd.w / 2; } function cy(wd) { return wd.y + wd.h / 2; }
        // acha, na lista L, a palavra mais próxima (mesma linha) de wd ainda não usada
        function nearest(L, wd, used) {
            var best = -1, bd = 1e18;
            for (var k = 0; k < L.length; k++) {
                if (used && used[k]) continue;
                var tol = Math.max(wd.h, 12) * 1.1, dy = cy(L[k]) - cy(wd);
                if (dy < 0) dy = -dy; if (dy > tol) continue;                 // linha diferente
                var dx = cx(L[k]) - cx(wd); var maxdx = Math.max(wd.w, L[k].w) * 1.4 + tol;
                if ((dx < 0 ? -dx : dx) > maxdx) continue;
                var d = dx * dx + dy * dy * 4; if (d < bd) { bd = d; best = k; }
            }
            return best;
        }
        // existe alguma palavra em L com texto parecido perto de wd? (anti-ruído de segmentação)
        function similarNear(L, wd) {
            for (var k = 0; k < L.length; k++) {
                var dy = cy(L[k]) - cy(wd); if (dy < 0) dy = -dy; if (dy > Math.max(wd.h, 12) * 1.4) continue;
                var dx = cx(L[k]) - cx(wd); if ((dx < 0 ? -dx : dx) > Math.max(wd.w, L[k].w) * 2.2) continue;
                if (sim(normTok(L[k].text), normTok(wd.text)) >= 0.6) return true;
            }
            return false;
        }
        for (i = 0; i < wordsOrig.length; i++) {
            var wo = wordsOrig[i]; if (normTok(wo.text).length < 2 || wo.conf < minConf) continue;
            var fi = nearest(wordsFile, wo, usedF);
            if (fi < 0) { if (!similarNear(wordsFile, wo)) diffs.push({ type: 'miss', textOrig: wo.text, textFile: '', x: wo.x, y: wo.y, w: wo.w, h: wo.h }); continue; }
            usedF[fi] = 1; var wf = wordsFile[fi];
            if (wf.conf < minConf) continue;                       // leitura fraca de um lado -> não arrisca
            if (normTok(wo.text) !== normTok(wf.text)) diffs.push({ type: 'diff', textOrig: wo.text, textFile: wf.text, x: wf.x, y: wf.y, w: wf.w, h: wf.h });
        }
        for (j = 0; j < wordsFile.length; j++) {
            if (usedF[j]) continue; var wf2 = wordsFile[j];
            if (normTok(wf2.text).length < 2 || wf2.conf < minConf) continue;
            if (!similarNear(wordsOrig, wf2)) diffs.push({ type: 'extra', textOrig: '', textFile: wf2.text, x: wf2.x, y: wf2.y, w: wf2.w, h: wf2.h });
        }
        return diffs;
    }

    // ------------------------------------------------------------------
    // readSections(img, sections, opts) -> Promise<[{id,text,boxes:[{text,x,y,w,h}]}]>
    // Roda o OCR (com o pre-processo) em cada secao, sequencialmente (um worker por
    // idioma; evita concorrencia no mesmo worker).
    // ------------------------------------------------------------------
    function readSections(img, sections, opts) {
        var o = opts || {};
        return init(o).then(function () {
            var results = [];
            var chain = Promise.resolve();
            var k;
            function stepFactory(sec, idx) {
                return function () {
                    var w = pickWorker(sec);
                    if (!w) throw new Error('ACOcr: worker nao inicializado.');
                    return ocrSection(w, img, sec, o).then(function (r) {
                        results[idx] = {
                            id: sec.id !== undefined ? sec.id : idx,
                            text: r.text,
                            boxes: r.toks   // [{text,x,y,w,h}]
                        };
                    });
                };
            }
            for (k = 0; k < sections.length; k++) {
                chain = chain.then(stepFactory(sections[k], k));
            }
            return chain.then(function () { return results; });
        });
    }

    // ------------------------------------------------------------------
    // diffSections(fileImg, origImg, sections, opts) -> Promise<{comps, sectionsText}>
    //
    // Le cada secao nos DOIS lados, alinha os tokens e emite comps SO onde o texto
    // DIFERE. Cada comp: { x,y,w,h, cx,cy, area, kind:'text', type, textFile, textOrig, section }.
    //   type: 'diff'  = token trocado (0763 -> 0591)
    //         'miss'  = token no original ausente no arquivo
    //         'extra' = token no arquivo ausente no original
    //
    // ESCOPO SEGURO (validado): so emite diffs em secoes NUMERICAS/de-codigo, onde o
    // OCR (whitelist, psm7) e confiavel. Linhas de LETRA (frase re-estilizada) tem OCR
    // ruidoso e produzem erros DIFERENTES por lado (sim ~0.5) -> um == ingenuo daria
    // falso-positivo. Por isso a rota de letras fica DESLIGADA por padrao
    // (opts.letterDiff=false); quando ligada, usa gate de similaridade da secao inteira
    // (nunca == cru) — recomendada apenas com re-render em DPI maior.
    //
    // opts:
    //   numericAll   (false)  trata todas as secoes como numericas
    //   letterDiff   (false)  habilita diff das secoes de letra (fuzzy)
    //   letterSectionSim (0.82) se a similaridade da secao inteira >= isso, considera
    //                           "mesmo texto, so re-estilizado/ruido de OCR" -> nada
    //   tokDiffSim   (0.999)   secao numerica: token difere se sim < isso (=> exato)
    //   letterTokSim (0.5)     secao de letra: token difere se sim < isso
    //   minTokLen    (1)       ignora tokens menores que isso (ruido)
    // ------------------------------------------------------------------
    function diffSections(fileImg, origImg, sections, opts) {
        var o = opts || {};
        var numericAll = o.numericAll === true;
        var letterDiff = o.letterDiff === true;
        var letterSectionSim = o.letterSectionSim !== undefined ? o.letterSectionSim : 0.82;
        var tokDiffSim = o.tokDiffSim !== undefined ? o.tokDiffSim : 0.999;
        var letterTokSim = o.letterTokSim !== undefined ? o.letterTokSim : 0.5;
        var minTokLen = o.minTokLen !== undefined ? o.minTokLen : 1;

        return init(o).then(function () {
            return readSections(fileImg, sections, o).then(function (fRes) {
                return readSections(origImg, sections, o).then(function (oRes) {
                    var comps = [];
                    var sectionsText = [];
                    var k;
                    for (k = 0; k < sections.length; k++) {
                        var sec = sections[k];
                        var isNum = numericAll || sec.numeric === true;
                        var f = fRes[k], oo = oRes[k];
                        var fTok = filterToks(f.boxes, minTokLen);
                        var oTok = filterToks(oo.boxes, minTokLen);
                        sectionsText.push({
                            id: sec.id !== undefined ? sec.id : k,
                            numeric: !!isNum,
                            textFile: f.text, textOrig: oo.text,
                            sim: sim(normTok(joinToks(fTok)), normTok(joinToks(oTok)))
                        });

                        if (!isNum && !letterDiff) continue;   // letras desligadas por padrao

                        if (!isNum) {
                            // gate da secao inteira: texto essencialmente igual -> nao mexe
                            var ssim = sim(normTok(joinToks(fTok)), normTok(joinToks(oTok)));
                            if (ssim >= letterSectionSim) continue;
                        }

                        var thrSim = isNum ? tokDiffSim : letterTokSim;
                        var pairs = alignTokens(fTok, oTok);
                        var pi, pr, s, box, type, tf, to;
                        for (pi = 0; pi < pairs.length; pi++) {
                            pr = pairs[pi];
                            if (pr.f && pr.o) {
                                s = sim(normTok(pr.f.text), normTok(pr.o.text));
                                if (s < thrSim) {
                                    type = 'diff'; box = pr.f; tf = pr.f.text; to = pr.o.text;
                                    comps.push(mkComp(box, type, tf, to, sec, k, s));
                                }
                            } else if (pr.f && !pr.o) {
                                type = 'extra'; box = pr.f;
                                comps.push(mkComp(box, type, pr.f.text, '', sec, k, 0));
                            } else if (!pr.f && pr.o) {
                                type = 'miss'; box = pr.o;
                                comps.push(mkComp(box, type, '', pr.o.text, sec, k, 0));
                            }
                        }
                    }
                    return { comps: comps, sectionsText: sectionsText };
                });
            });
        });
    }

    // ------------------------------------------------------------------
    // verifyRegions(fileImg, origImg, regions, opts) -> Promise<{comps, regionsText}>
    //
    // FASE 2 do pipeline "localiza (pixel) -> confirma (OCR)". Recebe as REGIOES que
    // DIFEREM (fase 1 = detector de pixel / ACText.findRestyledRegions) e roda o OCR
    // SO nelas: le os 2 lados em modo GERAL (por+eng, psm6, SEM whitelist), extrai
    // TOKENS (numeros \d{2,} e palavras), alinha por posicao e emite comp SO onde o
    // CONTEUDO mudou. Economiza processamento (OCR em ~poucas regioes, nao na arte
    // inteira) e resolve a memoria (worker reciclado).
    //
    // Por que modo GERAL e nao whitelist numerica (fato medido): numa linha com
    // letras, a whitelist vira LIXO ("7633615"); ja lendo a FRASE ("SIF/DIPOA sob n
    // 0591/3515") o token do NUMERO sai limpo. Entao le geral e extrai o token \d+.
    //
    // PRECISAO (anti cria-wolf, validado no par Perdigao):
    //   - NUMERO: comparacao EXATA do token, mas so CONFIA quando (a) existe pelo
    //     menos um numero que BATE nos 2 lados na mesma regiao (controle, ex "3515")
    //     e (b) o par que difere tem um vizinho alinhado que TAMBEM bate (contexto).
    //     Assim o 0763->0591 sai, mas variacao de OCR em bloco re-tonado nao inventa
    //     numero. Exige ainda MESMO comprimento nos 2 lados (leitura instavel/ falta
    //     de digito e descartada).
    //   - PALAVRA (letra): so com opts.hiDPI=true (re-render em DPI alto); senao
    //     IGNORA letra por ruido (letra a ~10px da sim ~0.5). Fuzzy de limiar alto.
    //   - miss/extra: DESLIGADO por padrao (opts.reportMissExtra) — rota mais ruidosa
    //     em texto re-tonado.
    //
    // MEMORIA: le sequencialmente; RECICLA o worker (terminate + init textOnly) a
    //   cada opts.recycleEvery (default 6) LEITURAS -> nao estoura o heap do
    //   tesseract.js (ERR_WORKER_OUT_OF_MEMORY apos ~6 recognize()).
    //
    // opts principais:
    //   regionPad (24)      folga (px) em volta da regiao antes do OCR (a fase 1
    //                       aperta o X ao residual; a folga garante o glifo inteiro)
    //   upscale (8)         upscale do recorte (preprocess limita por maxPixels)
    //   psm ('6')           page-seg (6 = bloco; a regiao pode ter 1-2 linhas)
    //   minNumLen (2)       ignora numero com menos de N digitos
    //   recycleEvery (6)    recicla o worker a cada N leituras
    //   letters (false)     habilita diff de PALAVRA (fuzzy) — so com hiDPI
    //   hiDPI (false)       regiao re-renderizada em DPI alto (libera letra)
    //   letterDiffSim(0.34) palavra difere se sim < isso
    //   reportMissExtra(false) tambem emite token faltando/sobrando (so numero)
    // ------------------------------------------------------------------
    function isWordTok(t) { return /[A-Za-zÀ-ÿ]/.test(t) && !/\d/.test(t) && t.length >= 2; }
    function isNumTok(t, minLen) { return /^\d+$/.test(t) && t.length >= minLen; }

    // Dilatacao binaria por RAIO na horizontal (janela deslizante O(n)).
    function dilateH(mask, W, H, rad) {
        var out = new Uint8Array(W * H), y, x, off, i, cnt, addIdx, remIdx;
        for (y = 0; y < H; y++) {
            off = y * W; cnt = 0;
            for (i = 0; i <= rad && i < W; i++) cnt += mask[off + i];
            for (x = 0; x < W; x++) {
                out[off + x] = cnt > 0 ? 1 : 0;
                addIdx = x + rad + 1; remIdx = x - rad;
                if (addIdx < W) cnt += mask[off + addIdx];
                if (remIdx >= 0) cnt -= mask[off + remIdx];
            }
        }
        return out;
    }
    // Dilatacao binaria por RAIO na vertical.
    function dilateV(mask, W, H, rad) {
        var out = new Uint8Array(W * H), y, x, i, cnt, addY, remY;
        for (x = 0; x < W; x++) {
            cnt = 0;
            for (i = 0; i <= rad && i < H; i++) cnt += mask[i * W + x];
            for (y = 0; y < H; y++) {
                out[y * W + x] = cnt > 0 ? 1 : 0;
                addY = y + rad + 1; remY = y - rad;
                if (addY < H) cnt += mask[addY * W + x];
                if (remY >= 0) cnt -= mask[remY * W + x];
            }
        }
        return out;
    }
    // Componentes conexos (4-conn) com bbox+area; retorna os com area >= minArea.
    function connectedBoxes(mask, W, H, minArea) {
        var n = W * H, visited = new Uint8Array(n), stack = new Int32Array(n);
        var out = [], i, sp, cnt, cur, cx, cy, k, nx, ny, ni, x0, y0, x1, y1;
        var DX = [-1, 1, 0, 0], DY = [0, 0, -1, 1];
        for (i = 0; i < n; i++) {
            if (!mask[i] || visited[i]) continue;
            sp = 0; cnt = 0; x0 = W; y0 = H; x1 = 0; y1 = 0;
            stack[sp++] = i; visited[i] = 1;
            while (sp > 0) {
                cur = stack[--sp]; cnt++;
                cx = cur % W; cy = (cur / W) | 0;
                if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
                if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
                for (k = 0; k < 4; k++) {
                    nx = cx + DX[k]; ny = cy + DY[k];
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    ni = ny * W + nx;
                    if (mask[ni] && !visited[ni]) { visited[ni] = 1; stack[sp++] = ni; }
                }
            }
            if (cnt >= minArea) out.push({ x0: x0, y0: y0, x1: x1, y1: y1, area: cnt });
        }
        return out;
    }
    // Copia a mascara zerando CCs (4-conn) grandes demais p/ glifo (bbox alto>capH ou
    // largo>capW) — tira foto/logo/faixa e deixa so tinta tamanho-de-texto.
    function removeBigCCs(mask, W, H, capH, capW) {
        var n = W * H, out = new Uint8Array(n), visited = new Uint8Array(n);
        var stack = new Int32Array(n), order = new Int32Array(n);
        var i, sp, cnt, cur, cx, cy, k, nx, ny, ni, x0, y0, x1, y1;
        var DX = [-1, 1, 0, 0], DY = [0, 0, -1, 1];
        for (i = 0; i < n; i++) {
            if (!mask[i] || visited[i]) continue;
            sp = 0; cnt = 0; x0 = W; y0 = H; x1 = 0; y1 = 0;
            stack[sp++] = i; visited[i] = 1;
            while (sp > 0) {
                cur = stack[--sp]; order[cnt++] = cur;
                cx = cur % W; cy = (cur / W) | 0;
                if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
                if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
                for (k = 0; k < 4; k++) {
                    nx = cx + DX[k]; ny = cy + DY[k];
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    ni = ny * W + nx;
                    if (mask[ni] && !visited[ni]) { visited[ni] = 1; stack[sp++] = ni; }
                }
            }
            if ((y1 - y0 + 1) <= capH && (x1 - x0 + 1) <= capW) {
                for (k = 0; k < cnt; k++) out[order[k]] = 1;
            }
        }
        return out;
    }
    // Box-blur separavel (media local, raio r) de um Uint8Array -> Uint8Array.
    function boxBlur(src, W, H, r) {
        var tmp = new Float32Array(W * H), out = new Uint8Array(W * H);
        var x, y, off, sum, i, lo, hi, addI, remI;
        for (y = 0; y < H; y++) {
            off = y * W; sum = 0;
            for (i = 0; i <= r && i < W; i++) sum += src[off + i];
            for (x = 0; x < W; x++) {
                lo = x - r < 0 ? 0 : x - r; hi = x + r > W - 1 ? W - 1 : x + r;
                tmp[off + x] = sum / (hi - lo + 1);
                addI = x + 1 + r; if (addI <= W - 1) sum += src[off + addI];
                remI = x - r; if (remI >= 0) sum -= src[off + remI];
            }
        }
        for (x = 0; x < W; x++) {
            sum = 0;
            for (i = 0; i <= r && i < H; i++) sum += tmp[i * W + x];
            for (y = 0; y < H; y++) {
                lo = y - r < 0 ? 0 : y - r; hi = y + r > H - 1 ? H - 1 : y + r;
                out[y * W + x] = (sum / (hi - lo + 1) + 0.5) | 0;
                addI = y + 1 + r; if (addI <= H - 1) sum += tmp[addI * W + x];
                remI = y - r; if (remI >= 0) sum -= tmp[remI * W + x];
            }
        }
        return out;
    }
    // bbox apertado da tinta dentro de [x0..x1]x[y0..y1]; null se nao ha tinta.
    function tightBox(mask, W, x0, y0, x1, y1) {
        var x, y, tx0 = x1 + 1, ty0 = y1 + 1, tx1 = x0 - 1, ty1 = y0 - 1;
        for (y = y0; y <= y1; y++) {
            for (x = x0; x <= x1; x++) {
                if (mask[y * W + x]) {
                    if (x < tx0) tx0 = x; if (x > tx1) tx1 = x;
                    if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
                }
            }
        }
        if (tx1 < tx0) return null;
        return { x0: tx0, y0: ty0, x1: tx1, y1: ty1 };
    }

    function verifyRegions(fileImg, origImg, regions, opts) {
        var o = opts || {};
        var pad = o.regionPad !== undefined ? o.regionPad : 24;
        // recicla o worker a cada N LEITURAS (recognize). Com chunking cada leitura e
        // um pedaco pequeno; ~12 mantem o heap do tesseract.js longe do estouro.
        var recycleEvery = o.recycleEvery !== undefined ? o.recycleEvery : 12;
        var minNumLen = o.minNumLen !== undefined ? o.minNumLen : 2;
        var letters = o.letters === true;
        var hiDPI = o.hiDPI === true;
        var letterDiffSim = o.letterDiffSim !== undefined ? o.letterDiffSim : 0.34;
        var reportMissExtra = o.reportMissExtra === true;
        // opts repassados ao preprocess/ocrSection
        var ppOpts = {
            upscale: o.upscale !== undefined ? o.upscale : 8,
            maxPixels: o.maxPixels !== undefined ? o.maxPixels : 12000000,
            pad: o.ppPad !== undefined ? o.ppPad : 30,
            polarity: o.polarity || 'auto',
            despeckleMin: o.despeckleMin !== undefined ? o.despeckleMin : 1.2,
            psm: o.psm || '6'
        };

        // parametros da segmentacao de linhas por conectividade (2-colunas-safe)
        var contrR = o.contrR !== undefined ? o.contrR : 6;         // raio da media local (contraste)
        var contrThr = o.contrThr !== undefined ? o.contrThr : 24;  // |luma-mediaLocal| p/ virar tinta
        var capH = o.capH !== undefined ? o.capH : 70;               // CC mais alto = foto/grafico -> fora
        var capW = o.capW !== undefined ? o.capW : 2000;             // CC mais largo = faixa/grafico -> fora
        var blobHRad = o.blobHRad !== undefined ? o.blobHRad : 20;   // funde glifos numa LINHA (H)
        var blobVRad = o.blobVRad !== undefined ? o.blobVRad : 2;    // nao funde linhas vizinhas (V curto)
        var minBlobArea = o.minBlobArea !== undefined ? o.minBlobArea : 40; // segmento minimo
        var minLineH = o.minLineH !== undefined ? o.minLineH : 6;    // altura min de linha de texto
        var maxLineH = o.maxLineH !== undefined ? o.maxLineH : 60;   // altura max de linha de texto
        var segYPad = o.segYPad !== undefined ? o.segYPad : 4;       // folga do segmento
        var maxOcrW = o.maxOcrW !== undefined ? o.maxOcrW : 3600;    // largura maxima da imagem de OCR
        var dryRun = o.dryRun === true;                             // so localiza (sem OCR) p/ debug
        var bandPad = o.bandPad !== undefined ? o.bandPad : 6;       // folga vertical por chunk
        var bandXPad = o.bandXPad !== undefined ? o.bandXPad : 10;   // folga horizontal por chunk
        var maxLines = o.maxLines !== undefined ? o.maxLines : 40;   // teto de segmentos por regiao
        var linePsm = o.linePsm || o.psm || '7';                    // 1 linha -> psm 7

        var W = fileImg.width, H = fileImg.height;
        var dF = fileImg.data, dO = origImg.data;

        var comps = [];
        var regionsText = [];
        var reads = 0;               // leituras desde o ultimo init (p/ reciclar)
        var recycles = 0;            // quantas vezes reciclou (diagnostico)

        // pixel de TINTA (polarity-agnostico) numa imagem: corpo escuro acromatico
        // (min<80 & croma<90) OU branco-knockout (min>190). Igual ao extraiCanais.
        function isInk(d, p) {
            var r = d[p], g = d[p + 1], b = d[p + 2];
            var mn = r < g ? r : g; if (b < mn) mn = b;
            var mx = r > g ? r : g; if (b > mx) mx = b;
            return ((mn < 80 && (mx - mn) < 90) || mn > 190) ? 1 : 0;
        }

        // Segmenta a regiao em SEGMENTOS DE LINHA (2-colunas-safe). Por que nao a
        // projecao horizontal simples: a tira do registro tem DUAS colunas de texto
        // (ingredientes grandes a esquerda + industria/registro pequeno a direita)
        // sobrepostas em Y -> a projecao nunca "abre" entre linhas e o OCR le a papa
        // das 2 colunas. Solucao: agrupa por CONECTIVIDADE. Tinta da uniao (2 lados) ->
        // remove CCs grandes (foto/grafico) -> dilata H (funde glifos numa LINHA dentro
        // da coluna; a lacuna entre colunas e maior que blobHRad e NAO ponteia) -> CC
        // = 1 segmento de linha por coluna. Cada segmento e apertado a tinta real.
        // Localizacao fina (qual linha mudou) fica no diff de tokens + gate numerico;
        // o residual trap-tolerante e fraco/espalhado demais aqui p/ localizar sozinho.
        function changedSegments(reg) {
            var rx0 = Math.max(0, reg.x - pad), ry0 = Math.max(0, reg.y - pad);
            var rx1 = Math.min(W - 1, reg.x + reg.w - 1 + pad), ry1 = Math.min(H - 1, reg.y + reg.h - 1 + pad);
            if (rx1 < rx0 || ry1 < ry0) return [];
            var rw = rx1 - rx0 + 1, rh = ry1 - ry0 + 1, n = rw * rh;
            // luma local dos 2 lados (p/ mascara de CONTRASTE: o registro e cinza-fino
            // sobre madeira, baixo contraste -> isInk(min<80) NAO pega; |luma-mediaLocal|
            // pega qualquer texto contra o fundo, escuro OU claro).
            var lumaA = new Uint8Array(n), lumaB = new Uint8Array(n);
            var uni = new Uint8Array(n);
            var yy, xx, li, p, r, g, b;
            for (yy = 0; yy < rh; yy++) {
                for (xx = 0; xx < rw; xx++) {
                    p = ((ry0 + yy) * W + (rx0 + xx)) * 4; li = yy * rw + xx;
                    r = dF[p]; g = dF[p + 1]; b = dF[p + 2]; lumaA[li] = (77 * r + 150 * g + 29 * b) >> 8;
                    r = dO[p]; g = dO[p + 1]; b = dO[p + 2]; lumaB[li] = (77 * r + 150 * g + 29 * b) >> 8;
                }
            }
            var meanA = boxBlur(lumaA, rw, rh, contrR), meanB = boxBlur(lumaB, rw, rh, contrR);
            for (yy = 0; yy < rh; yy++) {
                for (xx = 0; xx < rw; xx++) {
                    p = ((ry0 + yy) * W + (rx0 + xx)) * 4; li = yy * rw + xx;
                    var ca = lumaA[li] - meanA[li]; if (ca < 0) ca = -ca;
                    var cb = lumaB[li] - meanB[li]; if (cb < 0) cb = -cb;
                    uni[li] = (isInk(dF, p) || isInk(dO, p) || ca > contrThr || cb > contrThr) ? 1 : 0;
                }
            }
            despeckle(uni, rw, rh, 8);
            // tinta so-de-texto: zera CCs grandes demais p/ glifo (foto, faixas, logo)
            var glyph = removeBigCCs(uni, rw, rh, capH, capW);
            // funde glifos numa mancha de LINHA (H forte, V curta) e rotula
            var lineBlob = dilateV(dilateH(glyph, rw, rh, blobHRad), rw, rh, blobVRad);
            var ccs = connectedBoxes(lineBlob, rw, rh, minBlobArea);
            var merged = [], c, cc, i, t;
            for (c = 0; c < ccs.length && merged.length < maxLines; c++) {
                cc = ccs[c];
                // aperta o bbox a tinta REAL (glyph) dentro do blob
                t = tightBox(glyph, rw, cc.x0, cc.y0, cc.x1, cc.y1);
                if (!t) continue;
                var h = t.y1 - t.y0 + 1, wseg = t.x1 - t.x0 + 1;
                if (h < minLineH || h > maxLineH || wseg < 12) continue;
                var sx0 = Math.max(0, t.x0 - segYPad), sx1 = Math.min(rw - 1, t.x1 + segYPad);
                var sy0 = Math.max(0, t.y0 - segYPad), sy1 = Math.min(rh - 1, t.y1 + segYPad);
                merged.push({ x0: rx0 + sx0, x1: rx0 + sx1, y0: ry0 + sy0, y1: ry0 + sy1 });
            }
            return merged;
        }

        // Segmenta uma LINHA (band) em PEDACOS (palavras) por lacunas de coluna. Cada
        // pedaco vira 1 recorte pequeno p/ OCR em up8 (a linha inteira em up8 daria
        // ~18000px de largura e estourava o worker; e o digito precisa de DPI alto,
        // fato: bbox apertado + up8 le 0763/0591 limpo). Runs de coluna com lacuna
        // <= wordGap sao fundidos (mesma palavra). Retorna [{x0,x1}] absolutos.
        function colChunks(band) {
            var bandH = band.y1 - band.y0 + 1;
            var wordGap = Math.max(8, Math.round(0.6 * bandH));
            var cols = [], x, y, p, has;
            for (x = band.x0; x <= band.x1; x++) {
                has = 0;
                for (y = band.y0; y <= band.y1 && !has; y++) {
                    p = (y * W + x) * 4;
                    if (isInk(dF, p) || isInk(dO, p)) has = 1;
                }
                cols.push(has);
            }
            var runs = [], i = 0, n = cols.length, j;
            while (i < n) {
                if (cols[i]) { j = i; while (j + 1 < n && cols[j + 1]) j++; runs.push([i, j]); i = j + 1; }
                else i++;
            }
            var chunks = [], cur = null, r;
            for (r = 0; r < runs.length; r++) {
                if (!cur) cur = [runs[r][0], runs[r][1]];
                else if (runs[r][0] - cur[1] - 1 <= wordGap) cur[1] = runs[r][1];
                else { chunks.push(cur); cur = [runs[r][0], runs[r][1]]; }
            }
            if (cur) chunks.push(cur);
            var out = [];
            for (r = 0; r < chunks.length; r++) {
                if (chunks[r][1] - chunks[r][0] + 1 >= 3)
                    out.push({ x0: band.x0 + chunks[r][0], x1: band.x0 + chunks[r][1] });
            }
            return out;
        }

        // garante o worker de TEXTO vivo (estado limpo: so por+eng)
        function freshText() {
            return terminate().then(function () { reads = 0; return init({ textOnly: true }); });
        }
        // recicla se ja passou do orcamento de leituras
        function maybeRecycle() {
            if (reads >= recycleEvery) { recycles++; return freshText(); }
            return Promise.resolve();
        }
        // le UM pedaco (chunk) de UMA linha de UMA imagem (modo geral, sem whitelist).
        // O upscale e limitado por chunk p/ a imagem NUNCA passar de maxOcrW de largura
        // (linha larga em up8 dava ~18000px e estourava o worker do tesseract.js).
        function readChunk(img, band, chunk) {
            var bx0 = Math.max(0, chunk.x0 - bandXPad), by0 = Math.max(0, band.y0 - bandPad);
            var bx1 = Math.min(W - 1, chunk.x1 + bandXPad), by1 = Math.min(H - 1, band.y1 + bandPad);
            var cw = bx1 - bx0 + 1;
            var up = ppOpts.upscale;
            while (up > 1 && cw * up > maxOcrW) up--;
            var co = {
                upscale: up, maxPixels: ppOpts.maxPixels, pad: ppOpts.pad,
                polarity: ppOpts.polarity, despeckleMin: ppOpts.despeckleMin
            };
            var sec = {
                x: bx0, y: by0, w: cw, h: by1 - by0 + 1,
                numeric: false, charWhitelist: '', psm: linePsm
            };
            return ocrSection(_wTxt, img, sec, co).then(function (r) {
                reads++;
                return r;                // {text, toks}
            });
        }

        // compara os tokens de UMA linha (ja lida chunk-a-chunk) e empurra os comps
        function diffLine(secId, fToks, oToks) {
            var pairs = alignTokens(fToks, oToks);
            var i, pr, added = 0;

            // flags de "casou" (mesmo token dos 2 lados) por par
            var matched = [];
            for (i = 0; i < pairs.length; i++) {
                pr = pairs[i];
                matched[i] = !!(pr.f && pr.o && normTok(pr.f.text) === normTok(pr.o.text) && pr.f.text.length > 0);
            }
            // controle numerico: existe numero que BATE nos 2 lados NA LINHA? (confianca)
            var numControls = 0;
            for (i = 0; i < pairs.length; i++) {
                if (matched[i] && isNumTok(pairs[i].f.text, minNumLen)) numControls++;
            }

            for (i = 0; i < pairs.length; i++) {
                pr = pairs[i];
                if (pr.f && pr.o) {
                    if (matched[i]) continue;
                    var ft = pr.f.text, ot = pr.o.text;
                    var fNum = /^\d+$/.test(ft), oNum = /^\d+$/.test(ot);
                    if (fNum && oNum) {
                        // NUMERO trocado (0763 -> 0591)
                        if (ft.length !== ot.length) continue;      // leitura instavel
                        if (ft.length < minNumLen) continue;
                        if (ft === ot) continue;
                        if (numControls < 1) continue;              // sem controle -> nao confia
                        // contexto: vizinho alinhado tem que casar (senao e ruido)
                        if (!(matched[i - 1] || matched[i + 1])) continue;
                        comps.push(mkComp(pr.f, 'diff', ft, ot, { id: secId }, secId, sim(normTok(ft), normTok(ot))));
                        added++;
                    } else if (letters && hiDPI && isWordTok(ft) && isWordTok(ot)) {
                        // PALAVRA (letra) — so em hi-DPI, fuzzy de limiar alto
                        var sw = sim(normTok(ft), normTok(ot));
                        if (sw < letterDiffSim) {
                            comps.push(mkComp(pr.f, 'diff', ft, ot, { id: secId }, secId, sw));
                            added++;
                        }
                    }
                } else if (reportMissExtra && pr.f && !pr.o) {
                    if (isNumTok(pr.f.text, minNumLen)) {
                        comps.push(mkComp(pr.f, 'extra', pr.f.text, '', { id: secId }, secId, 0)); added++;
                    }
                } else if (reportMissExtra && !pr.f && pr.o) {
                    if (isNumTok(pr.o.text, minNumLen)) {
                        comps.push(mkComp(pr.o, 'miss', '', pr.o.text, { id: secId }, secId, 0)); added++;
                    }
                }
            }
            return { fText: joinToks(fToks), oText: joinToks(oToks), numControls: numControls, added: added };
        }

        // processa UMA LINHA (band): OCR pedaco a pedaco nos 2 lados, junta os tokens
        // em ordem de leitura, e diffLine. Retorna Promise<{fText,oText,ctrl,added}>.
        function processBand(secId, band) {
            var chunks = colChunks(band);
            var fToks = [], oToks = [];
            var chain = Promise.resolve();
            function chunkStep(chunk) {
                return function () {
                    var fr;
                    return maybeRecycle()
                        .then(function () { return readChunk(fileImg, band, chunk); })
                        .then(function (r) { fr = r; return readChunk(origImg, band, chunk); })
                        .then(function (or) {
                            var a, ft = filterToks(fr.toks, 1), ot = filterToks(or.toks, 1);
                            for (a = 0; a < ft.length; a++) fToks.push(ft[a]);
                            for (a = 0; a < ot.length; a++) oToks.push(ot[a]);
                        });
                };
            }
            var ci;
            for (ci = 0; ci < chunks.length; ci++) chain = chain.then(chunkStep(chunks[ci]));
            return chain.then(function () { return diffLine(secId, fToks, oToks); });
        }

        // processa UMA regiao: localiza os segmentos que MUDARAM (residual) e processa
        function processRegion(idx, reg) {
            var secId = (reg.id !== undefined ? reg.id : idx);
            var bands = changedSegments(reg);
            if (dryRun) {
                var db = [], q;
                for (q = 0; q < bands.length; q++) {
                    var ch = colChunks(bands[q]), cw = [];
                    for (var cq = 0; cq < ch.length; cq++) cw.push(ch[cq].x1 - ch[cq].x0 + 1);
                    db.push({ seg: bands[q], w: bands[q].x1 - bands[q].x0 + 1, h: bands[q].y1 - bands[q].y0 + 1, chunks: ch.length, chunkW: cw });
                }
                regionsText.push({ index: idx, section: secId, segments: db });
                return Promise.resolve();
            }
            var accF = [], accO = [], ctrlSum = 0, addSum = 0;
            var chain = Promise.resolve();
            function bandStep(band) {
                return function () {
                    return processBand(secId, band).then(function (d) {
                        if (d.fText) accF.push(d.fText);
                        if (d.oText) accO.push(d.oText);
                        ctrlSum += d.numControls; addSum += d.added;
                    });
                };
            }
            var bi;
            for (bi = 0; bi < bands.length; bi++) chain = chain.then(bandStep(bands[bi]));
            return chain.then(function () {
                regionsText.push({
                    index: idx, section: secId,
                    region: { x: reg.x, y: reg.y, w: reg.w, h: reg.h },
                    lines: bands.length,
                    textFile: accF.join(' | '), textOrig: accO.join(' | '),
                    numControls: ctrlSum, diffs: addSum
                });
            });
        }

        // driver sequencial (recicla o worker a cada ~recycleEvery leituras)
        return freshText().then(function () {
            var chain = Promise.resolve();
            var k;
            function regStep(reg, idx) { return function () { return processRegion(idx, reg); }; }
            for (k = 0; k < regions.length; k++) {
                chain = chain.then(regStep(regions[k], k));
            }
            return chain.then(function () {
                return { comps: comps, regionsText: regionsText, recycles: recycles };
            });
        });
    }

    function filterToks(toks, minLen) {
        var out = [], i;
        for (i = 0; i < toks.length; i++) {
            if (normTok(toks[i].text).length >= minLen) out.push(toks[i]);
        }
        return out;
    }
    function joinToks(toks) {
        var s = '', i;
        for (i = 0; i < toks.length; i++) s += (i ? ' ' : '') + toks[i].text;
        return s;
    }
    function mkComp(box, type, textFile, textOrig, sec, secIdx, score) {
        var x = Math.round(box.x), y = Math.round(box.y);
        var w = Math.max(1, Math.round(box.w)), h = Math.max(1, Math.round(box.h));
        return {
            x: x, y: y, w: w, h: h,
            cx: x + w / 2, cy: y + h / 2, area: w * h,
            kind: 'text', type: type,
            textFile: textFile, textOrig: textOrig,
            section: (sec.id !== undefined ? sec.id : secIdx),
            score: score
        };
    }

    return {
        init: init,
        terminate: terminate,
        reset: reset,
        readSections: readSections,
        diffSections: diffSections,
        verifyRegions: verifyRegions,
        recognizeWords: recognizeWords,
        alignWords: alignWords,
        preprocess: preprocess,
        // utilitarios expostos p/ teste
        _encodeBMP24: encodeBMP24,
        _otsu: otsu,
        _sim: sim,
        _tessDir: tessDir,
        version: 'ACOcr/1.0 tesseract.js@5.1.1 LSTM'
    };
});

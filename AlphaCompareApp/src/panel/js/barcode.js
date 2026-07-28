/*
    barcode.js - Alpha Compare
    Inspecao de codigo de barras: detecta e decodifica EAN-13 em logica pura
    (sem canvas, sem DOM, sem dependencias) para rodar no painel CEP e em Node.

    API:
        ACBarcode.scan(img, opts)          -> null | { code, checksumOk, type, rect, votes }
        ACBarcode.decodeRegion(img, rect)  -> idem, buscando so dentro do rect expandido

    img = { data, width, height }  com data RGBA (Uint8ClampedArray/Uint8Array),
    mesmo layout de ImageData.

    Estrategia (validada contra renders reais de producao):
      1. Deteccao de banda: mascara escura (luminancia < 100), contagem de
         transicoes claro<->escuro por linha em janelas de colunas deslizantes;
         blocos contiguos de linhas com muitas transicoes = candidatos a banda.
      2. X-extent: colapsa a metade central da banda numa scanline por MEDIANA
         por coluna; bordas fortes agrupadas em clusters (gap > 15px separa);
         o cluster com mais bordas e o simbolo.
      3. Decodificacao por scanline: binariza no (min+max)/2, run-length,
         exige exatamente 59 runs (3 guarda + 24 esq + 5 centro + 24 dir + 3 guarda).
      4. Cada grupo de 4 runs e normalizado para soma 7 EM FLOAT (nunca
         arredondar para inteiro - quebra em ~1.6px/modulo) e casado por
         menor soma de quadrados contra as tabelas L/G/R do EAN-13.
      5. Checksum EAN-13 obrigatorio + voto majoritario entre as scanlines.
*/
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.ACBarcode = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

    // ---------------------------------------------------------------
    // Tabelas de referencia EAN-13 (larguras dos 4 runs de cada digito)
    // ---------------------------------------------------------------
    var LW = [[3,2,1,1],[2,2,2,1],[2,1,2,2],[1,4,1,1],[1,1,3,2],[1,2,3,1],[1,1,1,4],[1,3,1,2],[1,2,1,3],[3,1,1,2]];
    var GW = [[1,1,2,3],[1,2,2,2],[2,2,1,2],[1,1,4,1],[2,3,1,1],[1,3,2,1],[4,1,1,1],[2,1,3,1],[3,1,2,1],[2,1,1,3]];
    var RW = LW; // codificacao R tem as mesmas larguras da L (cores invertidas)

    // Paridade dos 6 digitos da esquerda -> primeiro digito do EAN-13
    var PARIDADE = {
        'OOOOOO': 0, 'OOEOEE': 1, 'OOEEOE': 2, 'OOEEEO': 3, 'OEOOEE': 4,
        'OEEOOE': 5, 'OEEEOO': 6, 'OEOEOE': 7, 'OEOEEO': 8, 'OEEOEO': 9
    };

    // Parametros de deteccao
    var LIMIAR_ESCURO = 100;   // luminancia abaixo disso = pixel "escuro"
    var MIN_TRANSICOES = 25;   // transicoes por linha para linha candidata
    var MIN_ALTURA_BANDA = 20; // altura minima da banda (px)
    var LIMIAR_BORDA = 50;     // |dL| na scanline mediana para contar borda
    var GAP_CLUSTER = 15;      // gap (px) que separa clusters de bordas
    var MIN_BORDAS_CLUSTER = 50; // EAN-13 tem ~60 bordas
    var MIN_LARGURA_SIMBOLO = 60; // px (95 modulos, nunca menos que isso)
    var MIN_CONTRASTE = 20;    // max-min minimo na scanline para binarizar
    var MAX_ERRO_GRUPO = 2.5;  // corte de erro no casamento de grupo

    // ---------------------------------------------------------------
    // Luminancia: RGBA -> Uint8Array (um byte por pixel)
    // ---------------------------------------------------------------
    function calcularLuminancia(img) {
        var W = img.width, H = img.height;
        var d = img.data;
        var L = new Uint8Array(W * H);
        var n = W * H;
        var i, j;
        for (i = 0, j = 0; i < n; i++, j += 4) {
            // 0.299R + 0.587G + 0.114B em inteiros (x1024) p/ velocidade
            L[i] = (306 * d[j] + 601 * d[j + 1] + 117 * d[j + 2]) >> 10;
        }
        return L;
    }

    // Conta transicoes claro<->escuro numa linha, dentro de [xa, xb)
    function contarTransicoes(L, W, y, xa, xb) {
        var base = y * W;
        var trans = 0;
        var x;
        var escuroAnt = L[base + xa] < LIMIAR_ESCURO;
        var escuro;
        for (x = xa + 1; x < xb; x++) {
            escuro = L[base + x] < LIMIAR_ESCURO;
            if (escuro !== escuroAnt) {
                trans++;
                escuroAnt = escuro;
            }
        }
        return trans;
    }

    // ---------------------------------------------------------------
    // 1. Bandas candidatas: blocos contiguos de linhas com muitas
    //    transicoes dentro da faixa de colunas [xa, xb)
    // ---------------------------------------------------------------
    function acharBandas(L, W, xa, xb, ya, yb) {
        var bandas = [];
        var y;
        var inicio = -1;
        for (y = ya; y < yb; y++) {
            var cand = contarTransicoes(L, W, y, xa, xb) > MIN_TRANSICOES;
            if (cand) {
                if (inicio < 0) inicio = y;
            } else {
                if (inicio >= 0) {
                    if (y - inicio >= MIN_ALTURA_BANDA) {
                        bandas.push({ y0: inicio, y1: y - 1, h: y - inicio });
                    }
                    inicio = -1;
                }
            }
        }
        if (inicio >= 0 && yb - inicio >= MIN_ALTURA_BANDA) {
            bandas.push({ y0: inicio, y1: yb - 1, h: yb - inicio });
        }
        // Maiores primeiro (a banda do codigo e alta; texto comum e baixo)
        bandas.sort(function (a, b) { return b.h - a.h; });
        return bandas;
    }

    // ---------------------------------------------------------------
    // 2. Scanline por MEDIANA por coluna da metade central da banda
    // ---------------------------------------------------------------
    function scanlineMediana(L, W, banda, xa, xb) {
        var yc0 = banda.y0 + (banda.h >> 2);
        var yc1 = banda.y1 - (banda.h >> 2);
        if (yc1 < yc0) { yc0 = banda.y0; yc1 = banda.y1; }
        // Amostra no maximo 41 linhas (mediana estavel e barata)
        var linhas = [];
        var total = yc1 - yc0 + 1;
        var passo = total > 41 ? total / 41 : 1;
        var f;
        for (f = yc0; f <= yc1 + 0.0001; f += passo) {
            var yi = Math.floor(f);
            if (yi > yc1) yi = yc1;
            linhas.push(yi);
        }
        var nl = linhas.length;
        var scan = new Float64Array(xb - xa);
        var coluna = new Array(nl);
        var x, k;
        for (x = xa; x < xb; x++) {
            for (k = 0; k < nl; k++) coluna[k] = L[linhas[k] * W + x];
            coluna.sort(function (a, b) { return a - b; });
            scan[x - xa] = coluna[nl >> 1];
        }
        return scan;
    }

    // Clusters de bordas fortes na scanline; retorna ordenado por n desc
    function acharClusters(scan, xa) {
        var bordas = [];
        var i;
        for (i = 1; i < scan.length; i++) {
            var d = scan[i] - scan[i - 1];
            if (d > LIMIAR_BORDA || d < -LIMIAR_BORDA) bordas.push(xa + i);
        }
        var clusters = [];
        var c0 = -1, cAnt = -1, n = 0;
        for (i = 0; i < bordas.length; i++) {
            if (c0 < 0) {
                c0 = bordas[i]; cAnt = bordas[i]; n = 1;
            } else if (bordas[i] - cAnt > GAP_CLUSTER) {
                clusters.push({ x0: c0, x1: cAnt, n: n });
                c0 = bordas[i]; cAnt = bordas[i]; n = 1;
            } else {
                cAnt = bordas[i]; n++;
            }
        }
        if (c0 >= 0) clusters.push({ x0: c0, x1: cAnt, n: n });
        var bons = [];
        for (i = 0; i < clusters.length; i++) {
            var c = clusters[i];
            if (c.n >= MIN_BORDAS_CLUSTER && (c.x1 - c.x0) >= MIN_LARGURA_SIMBOLO) {
                bons.push(c);
            }
        }
        bons.sort(function (a, b) { return b.n - a.n; });
        return bons;
    }

    // ---------------------------------------------------------------
    // 3/4. Decodificacao de UMA scanline
    // ---------------------------------------------------------------

    // Casa um grupo de 4 runs contra uma tabela; retorna {d, erro} ou null
    function casarGrupo(g0, g1, g2, g3, tabela) {
        var s = g0 + g1 + g2 + g3;
        if (s <= 0) return null;
        var f = 7 / s; // normaliza para soma 7 (FLOAT, nunca arredondar!)
        var n0 = g0 * f, n1 = g1 * f, n2 = g2 * f, n3 = g3 * f;
        var melhor = -1, erroMin = 1e9;
        var t, e0, e1, e2, e3, erro;
        for (t = 0; t < 10; t++) {
            e0 = n0 - tabela[t][0];
            e1 = n1 - tabela[t][1];
            e2 = n2 - tabela[t][2];
            e3 = n3 - tabela[t][3];
            erro = e0 * e0 + e1 * e1 + e2 * e2 + e3 * e3;
            if (erro < erroMin) { erroMin = erro; melhor = t; }
        }
        return { d: melhor, erro: erroMin };
    }

    // Checksum EAN-13: verdadeiro se o 13o digito confere
    function checksumEAN13(digitos) {
        var soma = 0;
        var i;
        for (i = 0; i < 12; i++) {
            soma += digitos[i] * ((i % 2) === 0 ? 1 : 3);
        }
        return ((10 - (soma % 10)) % 10) === digitos[12];
    }

    // Decodifica os valores de luminancia de um segmento de linha.
    // Retorna a string de 13 digitos (checksum ja validado) ou null.
    function decodificarLinha(vals) {
        var n = vals.length;
        if (n < 60) return null;
        var i;
        var mn = 255, mx = 0;
        for (i = 0; i < n; i++) {
            if (vals[i] < mn) mn = vals[i];
            if (vals[i] > mx) mx = vals[i];
        }
        if (mx - mn < MIN_CONTRASTE) return null;
        var limiar = (mn + mx) / 2;

        // Run-length (true = barra escura)
        var runs = [];
        var cores = [];
        var escuroAnt = vals[0] < limiar;
        var w = 1;
        for (i = 1; i < n; i++) {
            var escuro = vals[i] < limiar;
            if (escuro === escuroAnt) {
                w++;
            } else {
                runs.push(w); cores.push(escuroAnt);
                escuroAnt = escuro; w = 1;
            }
        }
        runs.push(w); cores.push(escuroAnt);

        // Trim dos runs claros das pontas (quiet zone)
        var a = 0, b = runs.length - 1;
        if (!cores[a]) a++;
        if (b >= a && !cores[b]) b--;
        if (b - a + 1 !== 59) return null; // exatamente 59 runs
        if (!cores[a]) return null;        // precisa comecar em barra

        var r = new Array(59);
        var soma = 0;
        for (i = 0; i < 59; i++) { r[i] = runs[a + i]; soma += r[i]; }
        var modulo = soma / 95;
        if (modulo <= 0) return null;

        // Sanidade das guardas: inicio (0..2), centro (27..31), fim (56..58)
        var guardas = [0, 1, 2, 27, 28, 29, 30, 31, 56, 57, 58];
        for (i = 0; i < guardas.length; i++) {
            var gm = r[guardas[i]] / modulo;
            if (gm < 0.35 || gm > 1.9) return null;
        }

        var digitos = new Array(13);
        var paridade = '';
        var g, base, mL, mG, mR;

        // 6 digitos da esquerda: runs[3..26], testa L (impar 'O') e G (par 'E')
        for (g = 0; g < 6; g++) {
            base = 3 + g * 4;
            mL = casarGrupo(r[base], r[base + 1], r[base + 2], r[base + 3], LW);
            mG = casarGrupo(r[base], r[base + 1], r[base + 2], r[base + 3], GW);
            if (mL === null || mG === null) return null;
            if (mL.erro <= mG.erro) {
                if (mL.erro > MAX_ERRO_GRUPO) return null;
                digitos[g + 1] = mL.d; paridade += 'O';
            } else {
                if (mG.erro > MAX_ERRO_GRUPO) return null;
                digitos[g + 1] = mG.d; paridade += 'E';
            }
        }

        // Primeiro digito pela paridade
        var d0 = PARIDADE[paridade];
        if (d0 === undefined) return null;
        digitos[0] = d0;

        // 6 digitos da direita: runs[32..55], tabela R
        for (g = 0; g < 6; g++) {
            base = 32 + g * 4;
            mR = casarGrupo(r[base], r[base + 1], r[base + 2], r[base + 3], RW);
            if (mR === null || mR.erro > MAX_ERRO_GRUPO) return null;
            digitos[g + 7] = mR.d;
        }

        if (!checksumEAN13(digitos)) return null;
        return digitos.join('');
    }

    // ---------------------------------------------------------------
    // 5. Decodifica todas as scanlines da banda e vota
    // ---------------------------------------------------------------
    function decodificarBanda(L, W, banda, x0, x1) {
        // Margem de quiet zone nas pontas do segmento
        var margem = Math.floor((x1 - x0) * 0.06) + 4;
        var sx0 = x0 - margem; if (sx0 < 0) sx0 = 0;
        var sx1 = x1 + margem + 1; if (sx1 > W) sx1 = W;
        var len = sx1 - sx0;
        if (len < 60) return null;

        var votos = {};
        var totalValidas = 0;
        var vals = new Array(len);
        var y, x, code;
        for (y = banda.y0; y <= banda.y1; y++) {
            var base = y * W + sx0;
            for (x = 0; x < len; x++) vals[x] = L[base + x];
            code = decodificarLinha(vals);
            if (code !== null) {
                totalValidas++;
                votos[code] = (votos[code] || 0) + 1;
            }
        }
        if (totalValidas < 3) return null;

        // Voto majoritario entre as linhas com checksum valido
        var vencedor = null, maxVotos = 0, k;
        for (k in votos) {
            if (votos.hasOwnProperty(k) && votos[k] > maxVotos) {
                maxVotos = votos[k]; vencedor = k;
            }
        }
        if (vencedor === null || maxVotos * 2 <= totalValidas) return null;

        return {
            code: vencedor,
            checksumOk: true,
            type: 'EAN-13',
            rect: { x: x0, y: banda.y0, w: x1 - x0 + 1, h: banda.h },
            votes: maxVotos
        };
    }

    // Pipeline completo dentro de uma janela de colunas/linhas
    function varrerJanela(L, W, xa, xb, ya, yb) {
        var bandas = acharBandas(L, W, xa, xb, ya, yb);
        var melhor = null;
        var i, j;
        var maxBandas = bandas.length < 6 ? bandas.length : 6;
        for (i = 0; i < maxBandas; i++) {
            var scan = scanlineMediana(L, W, bandas[i], xa, xb);
            var clusters = acharClusters(scan, xa);
            var maxClusters = clusters.length < 3 ? clusters.length : 3;
            for (j = 0; j < maxClusters; j++) {
                var res = decodificarBanda(L, W, bandas[i], clusters[j].x0, clusters[j].x1);
                if (res !== null && (melhor === null || res.votes > melhor.votes)) {
                    melhor = res;
                }
            }
        }
        return melhor;
    }

    // Varredura completa (janelas de colunas deslizantes) num mapa de
    // luminancia W x H; retorna o melhor resultado ou null
    function varrerTudo(L, W, H) {
        // Janelas de ~35% da largura, passo 25%
        var wJan = Math.floor(W * 0.35);
        if (wJan < 200) wJan = W < 200 ? W : 200;
        var passo = Math.floor(W * 0.25);
        if (passo < 1) passo = 1;

        var melhor = null;
        var xa = 0;
        while (true) {
            var xb = xa + wJan;
            if (xb > W) xb = W;
            var res = varrerJanela(L, W, xa, xb, 0, H);
            if (res !== null && (melhor === null || res.votes > melhor.votes)) {
                melhor = res;
            }
            if (xb >= W) break;
            xa += passo;
        }
        return melhor;
    }

    // Transpoe o mapa de luminancia (para simbolo rotacionado 90 graus)
    function transporLum(L, W, H) {
        var T = new Uint8Array(W * H);
        var x, y, base;
        for (y = 0; y < H; y++) {
            base = y * W;
            for (x = 0; x < W; x++) {
                T[x * H + y] = L[base + x];
            }
        }
        return T;
    }

    // Converte rect do espaco transposto de volta ao espaco original
    function rectDestranspor(rect) {
        return { x: rect.y, y: rect.x, w: rect.h, h: rect.w };
    }

    // ---------------------------------------------------------------
    // API publica
    // ---------------------------------------------------------------

    // Varre a imagem inteira atras de UM simbolo EAN-13 (o mais confiavel).
    // Barras verticais primeiro; se nada, tenta rotacionado 90 graus
    // (transposicao simples - sem deskew rotacional pesado).
    function scan(img, opts) {
        if (!img || !img.data || !img.width || !img.height) return null;
        var W = img.width, H = img.height;
        var L = calcularLuminancia(img);

        var melhor = varrerTudo(L, W, H);
        if (melhor !== null) return melhor;

        var T = transporLum(L, W, H);
        var res = varrerTudo(T, H, W);
        if (res !== null) res.rect = rectDestranspor(res.rect);
        return res;
    }

    // Busca so dentro do rect (seed de blob de diff), expandindo-o:
    // cresce ao longo do eixo das barras (x) e em altura, em passos,
    // ate decodificar ou esgotar as tentativas.
    // Tenta decodificar em volta de um rect num mapa de luminancia,
    // expandindo o rect em passos (blob pequeno pode estar dentro do simbolo)
    function decodificarEmVolta(L, W, H, rect) {
        var padsX = [
            (rect.w > 120 ? rect.w : 120),
            2 * rect.w + 300
        ];
        var padsY = [
            (rect.h > 50 ? rect.h : 50),
            2 * rect.h + 120
        ];
        var t;
        for (t = 0; t < padsX.length; t++) {
            var xa = Math.floor(rect.x - padsX[t]); if (xa < 0) xa = 0;
            var xb = Math.ceil(rect.x + rect.w + padsX[t]); if (xb > W) xb = W;
            var ya = Math.floor(rect.y - padsY[t]); if (ya < 0) ya = 0;
            var yb = Math.ceil(rect.y + rect.h + padsY[t]); if (yb > H) yb = H;
            if (xb - xa < 60 || yb - ya < MIN_ALTURA_BANDA) continue;
            var res = varrerJanela(L, W, xa, xb, ya, yb);
            if (res !== null) return res;
        }
        return null;
    }

    function decodeRegion(img, rect) {
        if (!img || !img.data || !rect) return null;
        var W = img.width, H = img.height;
        var L = calcularLuminancia(img);

        var res = decodificarEmVolta(L, W, H, rect);
        if (res !== null) return res;

        // Tenta rotacionado 90 graus (transposicao, rect com x<->y)
        var T = transporLum(L, W, H);
        var rectT = { x: rect.y, y: rect.x, w: rect.h, h: rect.w };
        res = decodificarEmVolta(T, H, W, rectT);
        if (res !== null) res.rect = rectDestranspor(res.rect);
        return res;
    }

    return {
        scan: scan,
        decodeRegion: decodeRegion
    };
});

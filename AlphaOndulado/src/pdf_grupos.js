// Alpha Ondulado - extrator de GRUPOS POR COR de um PDF ripado (roda no renderer).
//
// Espelha a logica do 10_Medicao_Ondulado.jsx, mas FORA do Illustrator:
//   - le a geometria vetorial + a cor de cada traco via pdf.js;
//   - agrupa espacialmente os tracos de uma MESMA cor em "grupos" (clusters);
//   - cada grupo vira uma placa com seu bounding box -> largura x altura -> cm2;
//   - a area de uma cor = SOMA das areas de todos os seus grupos.
//
// Sem ES6 pesado: mantido em estilo compativel/simples (o app e Electron, mas
// seguimos o padrao conservador do projeto).
//
// Interface:
//   analisarPdf(uint8, opts, onProgress) -> Promise({ cores, totalCm2, ... })

(function () {
  "use strict";

  var pathmod = require("path");
  var pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

  // worker empacotado do pdf.js (contexto Chromium do renderer)
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pathmod.join(__dirname, "..", "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.js");
  } catch (e) {}

  var PT_TO_MM = 25.4 / 72;   // 1 ponto PDF = 1/72 pol
  var OPS = pdfjsLib.OPS;

  // -------- util geometria --------
  function mmToCm(v) { return v / 10; }

  function applyMatrix(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }
  function mulMatrix(a, b) {
    // a * b (ambas [a,b,c,d,e,f])
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }

  function bboxEmpty() { return null; }
  function bboxAddPt(bb, x, y) {
    if (!bb) return [x, y, x, y];
    if (x < bb[0]) bb[0] = x;
    if (y < bb[1]) bb[1] = y;
    if (x > bb[2]) bb[2] = x;
    if (y > bb[3]) bb[3] = y;
    return bb;
  }
  function bboxUnion(a, b) {
    if (!a) return b ? [b[0], b[1], b[2], b[3]] : null;
    if (!b) return a;
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  }
  function bboxW(b) { return b[2] - b[0]; }
  function bboxH(b) { return b[3] - b[1]; }

  // dois bboxes (pt) estao "proximos" se a separacao em X E em Y for <= gap.
  // Se ha sobreposicao num eixo, a separacao daquele eixo e 0.
  function bboxProx(a, b, gap) {
    var sepX = (a[2] < b[0]) ? (b[0] - a[2]) : (b[2] < a[0]) ? (a[0] - b[2]) : 0;
    var sepY = (a[3] < b[1]) ? (b[1] - a[3]) : (b[3] < a[1]) ? (a[1] - b[3]) : 0;
    return sepX <= gap && sepY <= gap;
  }

  // -------- cor: nome canonico / familia --------
  // rgb 0..255. Detecta cromia pura aproximada e nomeia; senao "Cor N".
  function corKeyRGB(r, g, b) {
    return r + "_" + g + "_" + b;
  }
  function ehQuaseBranco(r, g, b) {
    return r >= 250 && g >= 250 && b >= 250;
  }
  function classificarCor(r, g, b) {
    // aproxima RGB -> familia de cromia pura (equivalente ao corCromiaPura do JSX).
    // Preto: baixo em tudo. Ciano/Magenta/Amarelo: 2 canais altos.
    var nome = null;
    if (r < 40 && g < 40 && b < 40) nome = "Preto";
    else if (r < 80 && g > 150 && b > 150) nome = "Ciano";
    else if (r > 150 && g < 80 && b > 120) nome = "Magenta";
    else if (r > 200 && g > 200 && b < 90) nome = "Amarelo";
    else if (r > 150 && g < 90 && b < 90) nome = "Vermelho";
    else if (r < 90 && g > 120 && b < 90) nome = "Verde";
    else if (r < 90 && g < 90 && b > 150) nome = "Azul";
    return nome; // null => sera "Cor N" (spot desconhecida)
  }

  // -------- leitura de nomes de SEPARACAO no PDF cru (best-effort) --------
  // Varre os bytes atras de /Separation /<Nome> ... e /DeviceN [ /<n1> /<n2> ]
  // so pra SUGERIR nomes de tinta reais (pantones, "preto", etc.).
  function lerNomesSeparacao(uint8) {
    var nomes = [];
    try {
      var s = "";
      // decodifica latin1 (nomes PDF sao ASCII/hex)
      var CH = 65536, i, j;
      for (i = 0; i < uint8.length; i += CH) {
        var end = Math.min(i + CH, uint8.length);
        var arr = [];
        for (j = i; j < end; j++) arr.push(String.fromCharCode(uint8[j]));
        s += arr.join("");
      }
      var reSep = /\/Separation\s*\/([^\s\/\[\]<>()]+)/g, m;
      while ((m = reSep.exec(s)) !== null) nomes.push(decodePdfName(m[1]));
      var reDN = /\/DeviceN\s*\[([^\]]*)\]/g;
      while ((m = reDN.exec(s)) !== null) {
        var inner = m[1], reN = /\/([^\s\/\[\]<>()]+)/g, mm;
        while ((mm = reN.exec(inner)) !== null) nomes.push(decodePdfName(mm[1]));
      }
    } catch (e) {}
    // unicos, sem "All"/"None"
    var out = [], seen = {};
    for (var k = 0; k < nomes.length; k++) {
      var n = nomes[k];
      var low = n.toLowerCase();
      if (low === "all" || low === "none" || low === "cyan" || low === "magenta" ||
          low === "yellow" || low === "black") { /* cromia: ignora como sugestao spot */ }
      if (!seen[n] && low !== "all" && low !== "none") { seen[n] = true; out.push(n); }
    }
    return out;
  }
  function decodePdfName(s) {
    return String(s).replace(/#([0-9A-Fa-f]{2})/g, function (_x, h) {
      return String.fromCharCode(parseInt(h, 16));
    });
  }

  // -------- percorre a operator list de uma pagina, coletando marcas --------
  // marca = { corKey, r,g,b, bbox(pt device) }
  function coletarMarcasDaPagina(opList, ctmBase, acc, stats) {
    var fn = opList.fnArray, args = opList.argsArray;
    var ctm = ctmBase.slice();
    var stack = [];
    var fill = [0, 0, 0], stroke = [0, 0, 0];
    var pathBB = bboxEmpty();  // bbox do path corrente em espaco DEVICE (ja transformado)
    var cx = 0, cy = 0;        // pen em espaco de usuario corrente

    function penDevice(x, y) {
      var p = applyMatrix(ctm, x, y);
      pathBB = bboxAddPt(pathBB, p[0], p[1]);
    }

    function registrar(cor) {
      if (!pathBB) return;
      if (ehQuaseBranco(cor[0], cor[1], cor[2])) { pathBB = bboxEmpty(); return; }
      acc.push({ r: cor[0], g: cor[1], b: cor[2], corKey: corKeyRGB(cor[0], cor[1], cor[2]),
                 bbox: [pathBB[0], pathBB[1], pathBB[2], pathBB[3]] });
    }

    for (var i = 0; i < fn.length; i++) {
      var op = fn[i], a = args[i];
      switch (op) {
        case OPS.save: stack.push(ctm.slice()); break;
        case OPS.restore: if (stack.length) ctm = stack.pop(); break;
        case OPS.transform: ctm = mulMatrix(ctm, a); break;

        case OPS.setFillRGBColor: fill = [a[0], a[1], a[2]]; break;
        case OPS.setStrokeRGBColor: stroke = [a[0], a[1], a[2]]; break;

        case OPS.constructPath:
          // a = [opsSub[], coords[]] (pdfjs 3.x)
          consumirPath(a[0], a[1], penDevice);
          break;

        // formas diretas (algumas versoes emitem fora do constructPath)
        case OPS.rectangle:
          penDevice(a[0], a[1]); penDevice(a[0] + a[2], a[1] + a[3]);
          break;

        case OPS.fill:
        case OPS.eoFill:
          registrar(fill); pathBB = bboxEmpty(); break;
        case OPS.stroke:
          registrar(stroke); pathBB = bboxEmpty(); break;
        case OPS.fillStroke:
        case OPS.eoFillStroke:
        case OPS.closeFillStroke:
        case OPS.closeEOFillStroke:
          registrar(fill); pathBB = bboxEmpty(); break;
        case OPS.closeStroke:
          registrar(stroke); pathBB = bboxEmpty(); break;

        case OPS.endPath:
          pathBB = bboxEmpty(); break; // clip/no-op: descarta

        case OPS.paintImageXObject:
        case OPS.paintInlineImageXObject:
        case OPS.paintImageMaskXObject:
          stats.temImagem = true; break;

        default: break;
      }
    }

    function consumirPath(ops, coords) {
      var k = 0, px = 0, py = 0;
      for (var o = 0; o < ops.length; o++) {
        switch (ops[o]) {
          case OPS.moveTo: px = coords[k++]; py = coords[k++]; penDevice(px, py); break;
          case OPS.lineTo: px = coords[k++]; py = coords[k++]; penDevice(px, py); break;
          case OPS.curveTo:
            penDevice(coords[k], coords[k + 1]); penDevice(coords[k + 2], coords[k + 3]);
            px = coords[k + 4]; py = coords[k + 5]; penDevice(px, py); k += 6; break;
          case OPS.curveTo2:
            penDevice(coords[k], coords[k + 1]); px = coords[k + 2]; py = coords[k + 3];
            penDevice(px, py); k += 4; break;
          case OPS.curveTo3:
            penDevice(coords[k], coords[k + 1]); px = coords[k + 2]; py = coords[k + 3];
            penDevice(px, py); k += 4; break;
          case OPS.closePath: break;
          case OPS.rectangle:
            var rx = coords[k++], ry = coords[k++], rw = coords[k++], rh = coords[k++];
            penDevice(rx, ry); penDevice(rx + rw, ry + rh); break;
          default: break;
        }
      }
    }
  }

  // -------- clustering: marcas de UMA cor -> grupos --------
  function clusterizar(marcas, gapPt) {
    var n = marcas.length;
    var parent = [];
    var i, j;
    for (i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function uni(x, y) { var rx = find(x), ry = find(y); if (rx !== ry) parent[rx] = ry; }

    // O(n^2) - ok para milhares de marcas; se explodir, otimizar por grade
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        if (bboxProx(marcas[i].bbox, marcas[j].bbox, gapPt)) uni(i, j);
      }
    }
    var mapa = {};
    for (i = 0; i < n; i++) {
      var r = find(i);
      if (!mapa[r]) mapa[r] = null;
      mapa[r] = bboxUnion(mapa[r], marcas[i].bbox);
    }
    var grupos = [];
    for (var key in mapa) {
      if (!mapa.hasOwnProperty(key)) continue;
      var bb = mapa[key];
      grupos.push(bbToGrupo(bb));
    }
    return grupos;
  }

  function bbToGrupo(bb) {
    var wMM = bboxW(bb) * PT_TO_MM;
    var hMM = bboxH(bb) * PT_TO_MM;
    var wCM = mmToCm(wMM), hCM = mmToCm(hMM);
    return {
      bbox: bb,
      wMM: wMM, hMM: hMM,
      wCM: wCM, hCM: hCM,
      areaCm2: wCM * hCM
    };
  }

  // -------- render da pagina 1 para preview/laudo --------
  function renderPreview(page, maxPx) {
    if (typeof document === "undefined") return Promise.resolve(""); // headless (teste em Node)
    var vp1 = page.getViewport({ scale: 1 });
    var scale = Math.min(maxPx / vp1.width, maxPx / vp1.height, 3);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    var vp = page.getViewport({ scale: scale });
    var canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    var ctx = canvas.getContext("2d");
    return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
      return canvas.toDataURL("image/png");
    });
  }

  // -------- principal --------
  function analisarPdf(uint8, opts, onProgress) {
    opts = opts || {};
    var gapMM = (opts.gapMM != null) ? opts.gapMM : 4;   // folga p/ juntar tracos no mesmo grupo
    var areaMinCm2 = (opts.areaMinCm2 != null) ? opts.areaMinCm2 : 0.02; // descarta cisco
    var gapPt = gapMM / PT_TO_MM;

    function prog(msg) { if (onProgress) try { onProgress(msg); } catch (e) {} }

    var sugestoesSpot = lerNomesSeparacao(uint8);

    var loadingTask = pdfjsLib.getDocument({ data: uint8, useSystemFonts: true });
    return loadingTask.promise.then(function (pdf) {
      prog("Lendo o PDF (" + pdf.numPages + " pag.)...");
      var marcas = [];
      var stats = { temImagem: false };
      var pageSizeMm = null;
      var previewDataUrl = "";

      var chain = Promise.resolve();
      for (var pg = 1; pg <= pdf.numPages; pg++) {
        (function (pgNum) {
          chain = chain.then(function () {
            return pdf.getPage(pgNum).then(function (page) {
              var vp = page.getViewport({ scale: 1 });
              if (!pageSizeMm) pageSizeMm = { w: vp.width * PT_TO_MM, h: vp.height * PT_TO_MM };
              // CTM base: espaco de usuario PDF (pontos), sem flip -> trabalhamos so em dims
              var ctmBase = [1, 0, 0, 1, 0, 0];
              return page.getOperatorList().then(function (opList) {
                coletarMarcasDaPagina(opList, ctmBase, marcas, stats);
                if (pgNum === 1) {
                  return renderPreview(page, 1400).then(function (url) { previewDataUrl = url; });
                }
              });
            });
          });
        })(pg);
      }

      return chain.then(function () {
        prog("Agrupando " + marcas.length + " tracos por cor...");
        // agrupa marcas por corKey
        var porCor = {};
        for (var i = 0; i < marcas.length; i++) {
          var mk = marcas[i];
          if (!porCor[mk.corKey]) porCor[mk.corKey] = { r: mk.r, g: mk.g, b: mk.b, marcas: [] };
          porCor[mk.corKey].marcas.push(mk);
        }

        var cores = [];
        var idxSpot = 0, corN = 0;
        for (var key in porCor) {
          if (!porCor.hasOwnProperty(key)) continue;
          var c = porCor[key];
          var grupos = clusterizar(c.marcas, gapPt);
          // descarta grupos minusculos (cisco/registro)
          var gg = [];
          for (var g = 0; g < grupos.length; g++) if (grupos[g].areaCm2 >= areaMinCm2) gg.push(grupos[g]);
          if (gg.length === 0) continue;
          gg.sort(function (a, b) { return b.areaCm2 - a.areaCm2; });

          var somaCm2 = 0;
          for (var s = 0; s < gg.length; s++) somaCm2 += gg[s].areaCm2;

          var nomeFam = classificarCor(c.r, c.g, c.b);
          var nome;
          if (nomeFam) nome = nomeFam;
          else if (idxSpot < sugestoesSpot.length) { nome = sugestoesSpot[idxSpot]; idxSpot++; }
          else { corN++; nome = "Cor " + corN; }

          cores.push({
            corKey: key, r: c.r, g: c.g, b: c.b,
            rgbCss: "rgb(" + c.r + "," + c.g + "," + c.b + ")",
            nome: nome, nomeAuto: nome,
            grupos: gg, nGrupos: gg.length,
            areaCm2: somaCm2
          });
        }

        cores.sort(function (a, b) { return b.areaCm2 - a.areaCm2; });

        var totalCm2 = 0;
        for (var t = 0; t < cores.length; t++) totalCm2 += cores[t].areaCm2;

        prog("Pronto: " + cores.length + " cores.");
        return {
          cores: cores,
          totalCm2: totalCm2,
          nCores: cores.length,
          nGruposTotal: (function () { var q = 0; for (var z = 0; z < cores.length; z++) q += cores[z].nGrupos; return q; })(),
          temImagem: stats.temImagem,
          pageSizeMm: pageSizeMm,
          previewDataUrl: previewDataUrl,
          sugestoesSpot: sugestoesSpot
        };
      });
    });
  }

  // renderiza SO a pagina 1 para preview (usado quando os grupos vem do leitor AI)
  function renderPaginaUm(uint8, maxPx) {
    var loadingTask = pdfjsLib.getDocument({ data: uint8, useSystemFonts: true });
    return loadingTask.promise.then(function (pdf) {
      return pdf.getPage(1).then(function (page) {
        var vp = page.getViewport({ scale: 1 });
        var pageSizeMm = { w: vp.width * PT_TO_MM, h: vp.height * PT_TO_MM };
        return renderPreview(page, maxPx || 1400).then(function (url) {
          return { previewDataUrl: url, pageSizeMm: pageSizeMm };
        });
      });
    });
  }

  module.exports = { analisarPdf: analisarPdf, renderPaginaUm: renderPaginaUm };
})();

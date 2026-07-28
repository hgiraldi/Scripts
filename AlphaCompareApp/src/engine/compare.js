// AlphaProof - motor de comparacao (headless). Orquestra: render dos 2 lados -> OCR nativo ->
// diff de texto (proofreading). O modulo de pixel/grafico entra depois (reaproveita o
// AlphaCompare/compare.js). Testavel no terminal: node compare.js <arq.pdf> <ori.pdf> [rot]
var os = require("os");
var path = require("path");
var fs = require("fs");
var render = require("./render");
var ocr = require("./ocr");
var textdiff = require("./textdiff");

var _tmpN = 0;
function tmpPng(tag) { return path.join(os.tmpdir(), "alphaproof_" + process.pid + "_" + tag + "_" + (++_tmpN) + ".png"); }

// re-le um bloco (bbox no espaco rotacionado) em ALTA e RE-DETECTA as sub-linhas (o RapidOCR
// separa; o full-page tinha juntado num blob garbled). Coords do CROP (x/y/cx/cy) p/ o matchPairs;
// pfx/pfy/pfw/pfh = a MESMA sub-linha mapeada de volta à PÁGINA (px do render rotacionado) p/ o marcador.
function readCropLines(doc, bbox, rotW, rotH) {
  var rr = render.renderLineHi(doc, bbox, rotW, rotH, 150, 0.5);
  var img = rr.img, rect = rr.rect, iw = img.width || 1, ih = img.height || 1;
  var p = tmpPng("ln");
  render.writePNG(p, img);
  return ocr.read(p).then(function (lines) {
    try { fs.unlinkSync(p); } catch (e) {}
    return (lines || []).map(function (l) {
      return { t: l.t, x: l.x, y: l.y, w: l.w, h: l.h, cx: l.cx, cy: l.cy, c: l.c,
               pfx: rect.x + (l.x / iw) * rect.w, pfy: rect.y + (l.y / ih) * rect.h,
               pfw: (l.w / iw) * rect.w, pfh: (l.h / ih) * rect.h };
    });
  }).catch(function () { try { fs.unlinkSync(p); } catch (e) {} return []; });
}

// arq/ori: {file, rot?, hideTec?}   opts: {python, onProgress, seed, reRead(=true)}
function run(arq, ori, opts) {
  opts = opts || {};
  var prog = opts.onProgress || function () {};
  var t0 = Date.now(), timing = {};
  var alvo = opts.alvoPx || 3600;
  var reRead = opts.reRead !== false;
  var docA, docO, fullA, fullO;
  return ocr.start({ python: opts.python, serverExe: opts.serverExe }).then(function () {
    prog("Renderizando…");
    var tR = Date.now();
    return render.openDoc(arq.file, { hideTec: arq.hideTec, rot: arq.rot }).then(function (dA) {
      docA = dA; fullA = render.renderFullImg(docA, alvo);
      timing.render = (Date.now() - tR) / 1000;
      var pA = tmpPng("arq"); render.writePNG(pA, fullA.img);
      prog("Lendo textos (OCR nativo)…");
      var tO = Date.now();
      // Carrega o ORIGINAL na rotação dada em resolução CHEIA -> { O, mp } (fixa docO/fullO).
      function loadOriFull(rotDeg, F) {
        return render.openDoc(ori.file, { hideTec: ori.hideTec, rot: rotDeg }).then(function (d) {
          docO = d; fullO = render.renderFullImg(d, alvo);
          var pO = tmpPng("ori"); render.writePNG(pO, fullO.img);
          return ocr.read(pO).then(function (O) {
            try { fs.unlinkSync(pO); } catch (e) {}
            return { O: O, mp: textdiff.matchPairs(F, O, { seed: opts.seed }) };
          });
        });
      }
      // Conta palavras de ALTA confiança do original numa rotação, em BAIXA resolução (pouca
      // memória): texto de cabeça-pra-baixo sai garbled/baixa-conf -> separa +90 de +270 barato.
      function ocrConf(rotDeg) {
        return render.openDoc(ori.file, { hideTec: ori.hideTec, rot: rotDeg }).then(function (d) {
          var full = render.renderFullImg(d, 1500);
          var p = tmpPng("det"); render.writePNG(p, full.img);
          return ocr.read(p).then(function (O) {
            render.closeDoc(d); try { fs.unlinkSync(p); } catch (e) {}
            var n = 0; for (var i = 0; i < O.length; i++) if (O[i].c > 0.85 && String(O[i].t).trim().length >= 2) n++;
            return { rot: rotDeg, conf: n };
          });
        });
      }
      // proporção da página do original numa rotação (barato: abre e mede, SEM OCR/render)
      function oriPortrait(rotDeg) {
        return render.openDoc(ori.file, { hideTec: false, rot: rotDeg }).then(function (d) {
          var sw = (d.rot === 90 || d.rot === 270), ow = sw ? d.h.ph : d.h.pw, oh = sw ? d.h.pw : d.h.ph;
          render.closeDoc(d); return oh > ow;
        });
      }
      return ocr.read(pA).then(function (F) {
        // AUTO-ORIENTAÇÃO: o app só passa a rotação MANUAL do operador (O.rot). Mede a PROPORÇÃO
        // do original; se diverge da do arquivo (um retrato, outro paisagem), ele está girado 90°
        // -> decide +90 vs +270 por confiança de texto em BAIXA res (barato) e OCR a vencedora em
        // cheia. Corrige o DUX (original paisagem × arquivo retrato) que comparava desalinhado -> 0
        // diffs. Faz no MÁX. 2 OCRs de página cheia (evita o "bad allocation"/OOM do OCR nativo).
        try { fs.unlinkSync(pA); } catch (e) {}
        var portA = fullA.rotH > fullA.rotW, baseRot = ori.rot || 0;
        return oriPortrait(baseRot).then(function (portO) {
          if (portA === portO) return loadOriFull(baseRot, F);   // orientação ok -> 1 OCR cheio
          prog("verificando orientação do original…");
          return ocrConf((baseRot + 90) % 360).then(function (a) {
            return ocrConf((baseRot + 270) % 360).then(function (b) {
              var chosen = (a.conf >= b.conf) ? a.rot : b.rot;
              prog("orientação do original ajustada: " + chosen + "° (" + Math.max(a.conf, b.conf) + " palavras)");
              return loadOriFull(chosen, F);
            });
          });
        }).then(function (best) {
          timing.ocr = (Date.now() - tO) / 1000;
          var O = best.O;
          var mpAll = best.mp;
          // PRE-FILTRO: só re-le pares onde o full-page JÁ mostra diferença de conteúdo real
          // (wordDiffs não-confusável/não-fragmento). Reduz ~50 candidatos -> ~10 (rápido) sem perder o alvo.
          if (process.env.APDEBUG) {
            mpAll.pairs.forEach(function (pr) { var s = (pr.fw.t + " " + pr.ow.t).toLowerCase(); if (/regist|sif|591|2515|3515|763/.test(s)) console.error("  [SIFpair] A=" + JSON.stringify(pr.fw.t) + " O=" + JSON.stringify(pr.ow.t) + " wd=" + textdiff.wordDiffs(String(pr.fw.t).trim(), String(pr.ow.t).trim()).length); });
            // linhas do full-page (arq e ori) que contêm o SIF, mesmo sem par
            F.forEach(function (w) { if (/regist|sif|591|763/i.test(w.t)) console.error("  [F-sif] " + JSON.stringify(w.t) + " @" + (w.cx | 0) + "," + (w.cy | 0)); });
            O.forEach(function (w) { if (/regist|sif|2515|763/i.test(w.t)) console.error("  [O-sif] " + JSON.stringify(w.t) + " @" + (w.cx | 0) + "," + (w.cy | 0)); });
          }
          var mp = { anchors: mpAll.anchors, pairs: mpAll.pairs.filter(function (pr) {
            var a = String(pr.fw.t).trim(), b = String(pr.ow.t).trim();
            // re-le se há diff de conteúdo claro OU os DÍGITOS diferem (pega o SIF garbled: um
            // número de 4 díg. mudou — o full-page lê garbled, mas a re-leitura em alta resolve).
            return textdiff.wordDiffs(a, b).length > 0 || textdiff.digits(a) !== textdiff.digits(b);
          }) };
          // ---- re-leitura em ALTA dos candidatos (le o numero pequeno exato + mata falso) ----
          var diffs = [], counts = { arqLinhas: F.length, oriLinhas: O.length };
          if (!reRead) {
            for (var z = 0; z < mp.pairs.length; z++) {
              var fw0 = mp.pairs[z].fw, ow0 = mp.pairs[z].ow, a0 = String(fw0.t).trim(), b0 = String(ow0.t).trim();
              var dd0 = textdiff.diffPair(a0, b0, Math.min(fw0.c, ow0.c));
              for (var q0 = 0; q0 < dd0.length; q0++) diffs.push({ arq: dd0[q0].arq, ori: dd0[q0].ori, x: fw0.x, y: fw0.y, w: fw0.w, h: fw0.h, arqLine: a0, oriLine: b0 });
            }
            return finish();
          }
          var tRR = Date.now();
          // separa: fast-path (letra alta-confiança -> confia no full-page) x RE-LEITURA em alta
          // (dígito difere OU garbled). O grosso do tempo é a re-leitura -> roda em PARALELO no pool.
          var toReread = [];
          mp.pairs.forEach(function (pr) {
            var fw = pr.fw, ow = pr.ow, lcf = Math.min(fw.c, ow.c);
            if (lcf >= 0.92 && textdiff.digits(String(fw.t)) === textdiff.digits(String(ow.t))) {
              var a1 = String(fw.t).trim(), b1 = String(ow.t).trim(), dd1 = textdiff.diffPair(a1, b1, lcf);
              for (var q1 = 0; q1 < dd1.length; q1++) diffs.push({ arq: dd1[q1].arq, ori: dd1[q1].ori, x: fw.x, y: fw.y, w: fw.w, h: fw.h, arqLine: a1, oriLine: b1 });
            } else toReread.push(pr);
          });
          var doneN = 0, totalRR = toReread.length;
          prog("Conferindo texto em alta (0/" + totalRR + ")…");
          function reOne(pr) {
            var fw = pr.fw, ow = pr.ow;
            return Promise.all([readCropLines(docA, fw, fullA.rotW, fullA.rotH), readCropLines(docO, ow, fullO.rotW, fullO.rotH)]).then(function (r2) {
              var la = r2[0], lo = r2[1];
              if (la.length && lo.length) {
                var sub = textdiff.matchPairs(la, lo, {});
                for (var si = 0; si < sub.pairs.length; si++) {
                  var sfw = sub.pairs[si].fw, sow = sub.pairs[si].ow;
                  var dd = textdiff.diffPair(sfw.t, sow.t, Math.min(sfw.c, sow.c));
                  if (process.env.APDEBUG && dd.length) console.error("  [sub] A=" + JSON.stringify(String(sfw.t).trim()) + " O=" + JSON.stringify(String(sow.t).trim()) + " -> " + JSON.stringify(dd));
                  // posição = a SUB-LINHA do arquivo mapeada à página (não o topo do bloco garbled)
                  var px = sfw.pfx != null ? sfw.pfx : fw.x, py = sfw.pfy != null ? sfw.pfy : fw.y;
                  var pw = sfw.pfw || fw.w, ph = sfw.pfh || fw.h;
                  for (var q = 0; q < dd.length; q++)
                    diffs.push({ arq: dd[q].arq, ori: dd[q].ori, x: px, y: py, w: pw, h: ph, arqLine: sfw.t, oriLine: sow.t });
                }
              }
              doneN++; prog("Conferindo texto em alta (" + doneN + "/" + totalRR + ")…");
            });
          }
          // dispara todas em paralelo — o pool de sidecars distribui as leituras entre os workers
          return Promise.all(toReread.map(reOne)).then(function () { timing.reread = (Date.now() - tRR) / 1000; return finish(); });
          function finish() {
            timing.total = (Date.now() - t0) / 1000;
            var out = {
              diffs: diffs, anchors: mp.anchors, candidates: mp.pairs.length, counts: counts,
              render: { arq: { w: fullA.rotW, h: fullA.rotH }, ori: { w: fullO.rotW, h: fullO.rotH } },
              timing: timing
            };
            if (opts.keepImages) out.images = { arq: fullA.img, ori: fullO.img };
            render.closeDoc(docA); render.closeDoc(docO);
            return out;
          }
          return finish();
        });
      });
    }).catch(function (e) { render.closeDoc(docA); render.closeDoc(docO); throw e; });
  });
}

module.exports = { run: run };

// ---- CLI de teste ----
if (require.main === module) {
  var arq = process.argv[2], ori = process.argv[3], rot = parseInt(process.argv[4] || "0", 10);
  if (!arq || !ori) { console.error("uso: node compare.js <arq.pdf> <ori.pdf> [rotOriginal]"); process.exit(1); }
  var hideTec = rot ? true : false;   // heuristica p/ o teste do DUX (rot=90 + esconde tecnicas)
  run({ file: arq, hideTec: hideTec }, { file: ori, rot: rot, hideTec: hideTec }, {
    onProgress: function (m) { process.stderr.write("  " + m + "\n"); }
  }).then(function (r) {
    console.log("linhas: arquivo=" + r.counts.arqLinhas + " original=" + r.counts.oriLinhas + "  ancoras=" + r.anchors);
    console.log("tempo: render " + r.timing.render.toFixed(1) + "s | OCR " + r.timing.ocr.toFixed(1) + "s | TOTAL " + r.timing.total.toFixed(1) + "s");
    console.log("DIFFS: " + r.diffs.length);
    r.diffs.forEach(function (d) { console.log("   ORI[" + d.ori + "] -> ARQ[" + d.arq + "]   @" + (d.x | 0) + "," + (d.y | 0)); });
    ocr.stop(); process.exit(0);
  }).catch(function (e) { console.error("ERRO:", e && e.stack || e); ocr.stop(); process.exit(1); });
}

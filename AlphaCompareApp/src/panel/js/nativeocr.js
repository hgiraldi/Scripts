/* ============================================================
 * Alpha Proof - ponte do painel para o MOTOR OCR NATIVO (RapidOCR/ONNX).
 * Roda no renderer (nodeIntegration). Chama src/engine/compare.run() com os 2 caminhos
 * de PDF, devolve os diffs de texto + a largura do render do arquivo (p/ mapear coords).
 * ============================================================ */
(function () {
  "use strict";
  var engine, ipcRenderer;
  try {
    // Em Electron o require relativo do renderer resolve pelo HTML, não pelo .js -> usa caminho
    // ABSOLUTO derivado da location (como o pdfrender). index.html está em .../src/panel.
    var _path = require("path");
    var _p = decodeURIComponent(window.location.pathname);
    if (/^\/[A-Za-z]:/.test(_p)) _p = _p.slice(1);
    var _panelDir = _path.dirname(_p);                       // .../src/panel
    engine = require(_path.join(_panelDir, "..", "engine", "compare"));   // .../src/engine/compare
    ipcRenderer = require("electron").ipcRenderer;
  } catch (e) {
    console.error("AlphaNativeOCR: falha ao carregar o motor nativo -> " + (e && e.stack || e));
    window.AlphaNativeOCR = null; return;
  }

  function pct(msg) {
    var m = String(msg || "").toLowerCase();
    var mm = m.match(/\((\d+)\s*\/\s*(\d+)\)/);
    // re-leitura em alta = a etapa mais longa: move a barra de 62 a 96 conforme N/M
    if (mm && m.indexOf("conferindo") >= 0) return 55 + 43 * (parseInt(mm[1], 10) / Math.max(1, parseInt(mm[2], 10)));
    if (m.indexOf("render") >= 0) return 32;
    if (m.indexOf("lendo") >= 0 || m.indexOf("ocr") >= 0) return 42;
    if (m.indexOf("compar") >= 0) return 98;
    return 40;
  }

  window.AlphaNativeOCR = {
    // o: {arqPath, arqRot, oriPath, oriRot, onProgress(pct,msg), onDone(err,diffs,arqW)}
    run: function (o) {
      console.warn("[nativeOCR] run start arq=" + o.arqPath + " ori=" + o.oriPath + " rotA=" + (o.arqRot || 0) + " rotO=" + (o.oriRot || 0));
      ipcRenderer.invoke("python-info").then(function (pi) {
        var py = pi && pi.env;
        var serverExe = pi && pi.serverExe;
        console.warn("[nativeOCR] OCR resolvido = " + (serverExe ? "exe congelado: " + serverExe : "python: " + py));
        engine.run(
          { file: o.arqPath, rot: o.arqRot || 0, hideTec: true },
          { file: o.oriPath, rot: o.oriRot || 0, hideTec: true },
          {
            python: py, serverExe: serverExe, alvoPx: 3600,
            onProgress: function (m) { console.warn("[nativeOCR] " + m); if (o.onProgress) o.onProgress(pct(m), m); }
          }
        ).then(function (res) {
          console.warn("[nativeOCR] OK -> diffs=" + ((res.diffs && res.diffs.length) || 0) + " ancoras=" + res.anchors + " candidatos=" + res.candidates + " tempo=" + (res.timing && res.timing.total));
          if (o.onDone) o.onDone(null, res.diffs || [], res.render && res.render.arq ? res.render.arq.w : 0);
        }).catch(function (e) {
          console.error("[nativeOCR] ENGINE ERRO: " + (e && e.stack || e));
          if (o.onDone) o.onDone(String((e && e.message) || e).slice(0, 160), [], 0);
        });
      }).catch(function (e) {
        console.error("[nativeOCR] PYTHON ERRO: " + (e && e.stack || e));
        if (o.onDone) o.onDone("python: " + String((e && e.message) || e).slice(0, 120), [], 0);
      });
    }
  };
})();

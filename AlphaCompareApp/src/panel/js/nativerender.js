/* ============================================================
 * Alpha Compare - ponte do painel p/ o RENDER NATIVO (pdfium via pypdfium2).
 * Sobe o render_server (exe congelado OU python+script), fala o protocolo JSON por stdin/stdout
 * e devolve o bitmap RGBA. Mesmo motor do Precision Proof: alta resolução, rápido.
 *   AlphaRender.render({pdf, scale, rot, crop, hideTec, hideLayers, hideImages, hideColors})
 *      -> Promise<{data:Uint8ClampedArray, width, height}>
 * ============================================================ */
(function () {
  "use strict";
  var cp, readline, os, path, fs, ipcRenderer;
  try {
    cp = require("child_process"); readline = require("readline");
    os = require("os"); path = require("path"); fs = require("fs");
    ipcRenderer = require("electron").ipcRenderer;
  } catch (e) {
    console.error("AlphaRender: sem node no renderer -> " + (e && e.message));
    window.AlphaRender = null; return;
  }
  var _proc = null, _pend = {}, _seq = 0, _readyP = null, _errbuf = "";

  function start() {
    if (_readyP) return _readyP;
    _readyP = ipcRenderer.invoke("render-info").then(function (info) {
      return new Promise(function (resolve, reject) {
        var cmd, args;
        if (info && info.serverExe) { cmd = info.serverExe; args = []; }
        else if (info && info.env && info.script) { cmd = info.env; args = ["-u", info.script]; }
        else { reject(new Error("render nativo indisponível (sem exe congelado e sem Python)")); return; }
        var env = Object.assign({}, process.env, { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" });
        var proc;
        try { proc = cp.spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], env: env }); }
        catch (e) { reject(new Error("não consegui iniciar o render nativo (" + cmd + "): " + e.message)); return; }
        proc.stdout.setEncoding("utf8");
        proc.stderr.on("data", function (d) { _errbuf += d; if (_errbuf.length > 4000) _errbuf = _errbuf.slice(-4000); });
        proc.on("error", function (e) { reject(new Error("render nativo falhou ao subir: " + e.message)); });
        proc.on("exit", function (c) {
          Object.keys(_pend).forEach(function (k) { _pend[k].reject(new Error("render server saiu (code " + c + ")" + (_errbuf ? "\n" + _errbuf.slice(-400) : ""))); delete _pend[k]; });
          _proc = null; _readyP = null;
        });
        var rl = readline.createInterface({ input: proc.stdout });
        rl.on("line", function (line) {
          var m; try { m = JSON.parse(line); } catch (e) { return; }
          if (m.ready === true) { _proc = proc; resolve(true); return; }
          if (m.ready === false) { reject(new Error(m.error || "render init falhou")); return; }
          if (m.id != null && _pend[m.id]) { var d = _pend[m.id]; delete _pend[m.id]; if (m.ok) d.resolve(m); else d.reject(new Error(m.error || "render falhou")); }
        });
      });
    }).catch(function (e) { _readyP = null; throw e; });
    return _readyP;
  }

  // opts: {pdf, scale, rot, crop:[x0,y0,x1,y1] em pontos, hideTec, hideLayers, hideImages, hideColors}
  //   -> {data(RGBA), width, height}
  // hideLayers/hideImages/hideColors = a LIMPEZA MANUAL da tela "Limpar" (pane.hideL/hideImg/hideC).
  // TEM que ir no protocolo: sem isso o render nativo (= o que a comparacao consome) volta a
  // mostrar o que o operador limpou e a limpeza vira so um preview.
  function render(opts) {
    return start().then(function () {
      var id = ++_seq;
      var out = path.join(os.tmpdir(), "alpharender_" + id + "_" + (new Date().getTime()) + ".bin");
      return new Promise(function (resolve, reject) {
        _pend[id] = { resolve: resolve, reject: reject };
        _proc.stdin.write(JSON.stringify({ id: id, pdf: opts.pdf, page: opts.page || 0,
          scale: opts.scale || 1, rot: opts.rot || 0, crop: opts.crop || null, hideTec: !!opts.hideTec,
          hideLayers: opts.hideLayers || [], hideImages: !!opts.hideImages, hideColors: opts.hideColors || [],
          out: out }) + "\n");
      }).then(function (m) {
        var W = m.w, H = m.h, raw = fs.readFileSync(out);
        try { fs.unlinkSync(out); } catch (e) {}
        var data = new Uint8ClampedArray(W * H * 4);
        for (var i = 0, j = 0, N = W * H; i < N; i++, j += 3) { var d = i * 4; data[d] = raw[j]; data[d + 1] = raw[j + 1]; data[d + 2] = raw[j + 2]; data[d + 3] = 255; }
        return { data: data, width: W, height: H };
      });
    });
  }

  // helper: RGBA -> canvas (o que o ACEngine consome via getImageData)
  function toCanvas(img) {
    var cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
    var ctx = cv.getContext("2d"); ctx.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    return cv;
  }

  window.AlphaRender = { start: start, render: render, toCanvas: toCanvas };
})();

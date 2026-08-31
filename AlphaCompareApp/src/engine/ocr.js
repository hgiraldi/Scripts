// AlphaProof - cliente do sidecar de OCR nativo (RapidOCR/ONNX) com POOL de workers.
// Sobe N processos Python (cada um carrega o modelo 1x) e distribui as leituras -> re-leitura
// em alta paraleliza ~Nx. Uso: ocr.start(python).then(...); ocr.read(png) -> Promise<lines>
var cp = require("child_process");
var path = require("path");
var readline = require("readline");

// no app empacotado o .py mora no app.asar.unpacked (Python nao le de dentro do asar)
var SERVER = path.join(__dirname, "..", "ocr", "ocr_server.py").replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
// POOL=1 é o mais rápido: o gargalo do re-read é o render SÍNCRONO dos crops (pdfium single-thread),
// não a inferência do OCR — mais workers só somam overhead de modelo/memória. (medido)
var POOL = parseInt(process.env.ALPHAPROOF_OCR_POOL || "1", 10);
var _workers = [];        // [{proc, pending:{}, seq, busy}]
var _readyP = null, _rr = 0;

// Resolve COMO subir o sidecar: se houver o OCR CONGELADO (PyInstaller -> ocr_server.exe,
// leva Python+onnx+modelos), sobe o exe DIRETO (sem Python na máquina). Senão, cai no
// Python + o script. Aceita string (python, legado) ou {python, serverExe}.
function resolveCmd(cfg) {
  if (typeof cfg === "string") cfg = { python: cfg };
  cfg = cfg || {};
  var exe = cfg.serverExe || process.env.ALPHACOMPARE_OCR_EXE;
  if (exe) { try { if (require("fs").existsSync(exe)) return { cmd: exe, args: [], frozen: true }; } catch (e) {} }
  var py = cfg.python || process.env.ALPHAPROOF_PYTHON || process.env.PYTHON || "python";
  return { cmd: py, args: ["-u", SERVER], frozen: false };
}

function spawnWorker(rc) {
  return new Promise(function (resolve, reject) {
    var w = { proc: null, pending: {}, seq: 0, busy: 0 };
    try {
      var env = Object.assign({}, process.env, { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" });
      w.proc = cp.spawn(rc.cmd, rc.args, { stdio: ["pipe", "pipe", "pipe"], env: env });
      w.proc.stdout.setEncoding("utf8");
    } catch (e) { reject(new Error("nao consegui iniciar o OCR (" + rc.cmd + "): " + e)); return; }
    var errbuf = "";
    w.proc.stderr.on("data", function (d) { errbuf += d.toString(); if (errbuf.length > 4000) errbuf = errbuf.slice(-4000); });
    w.proc.on("error", function (e) { reject(new Error("OCR falhou ao subir (" + rc.cmd + "): " + e.message)); });
    w.proc.on("exit", function (code) {
      var err = new Error("sidecar OCR encerrou (code " + code + ")" + (errbuf ? "\n" + errbuf.slice(-800) : ""));
      Object.keys(w.pending).forEach(function (k) { w.pending[k].reject(err); delete w.pending[k]; });
    });
    var rl = readline.createInterface({ input: w.proc.stdout });
    rl.on("line", function (line) {
      var msg; try { msg = JSON.parse(line); } catch (e) { return; }
      if (msg.ready === true) { resolve(w); return; }
      if (msg.ready === false) { reject(new Error(msg.error || "OCR nao inicializou")); return; }
      if (msg.id != null && w.pending[msg.id]) {
        var d = w.pending[msg.id]; delete w.pending[msg.id]; w.busy--;
        if (msg.ok) d.resolve(msg.lines || []); else { if (process.env.ALPHA_OCR_DEBUG) console.error("[ocr.js] read FALHOU id=" + msg.id + " msg=" + JSON.stringify(msg) + " errbuf=" + errbuf.slice(-400)); d.reject(new Error(msg.error || "OCR falhou")); }
      }
    });
  });
}

function start(cfg) {
  if (_readyP) return _readyP;
  var rc = resolveCmd(cfg), n = Math.max(1, POOL), jobs = [];
  for (var i = 0; i < n; i++) jobs.push(spawnWorker(rc));
  _readyP = Promise.all(jobs).then(function (ws) { _workers = ws; return true; })
    .catch(function (e) { _readyP = null; throw e; });
  return _readyP;
}

// escolhe o worker menos ocupado (balanceia a re-leitura entre os processos)
function pick() {
  var best = _workers[0];
  for (var i = 1; i < _workers.length; i++) if (_workers[i].busy < best.busy) best = _workers[i];
  return best;
}

function read(pngPath) {
  if (!_workers.length) return Promise.reject(new Error("OCR nao iniciado (chame start primeiro)"));
  var w = pick(), id = ++w.seq; w.busy++;
  return new Promise(function (resolve, reject) {
    w.pending[id] = { resolve: resolve, reject: reject };
    w.proc.stdin.write(JSON.stringify({ id: id, path: pngPath }) + "\n");
  });
}

function stop() {
  _workers.forEach(function (w) { try { w.proc.stdin.write(JSON.stringify({ quit: true }) + "\n"); } catch (e) {} try { w.proc.kill(); } catch (e) {} });
  _workers = []; _readyP = null;
}

module.exports = { start: start, read: read, stop: stop };

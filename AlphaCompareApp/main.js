// Alpha Proof - processo principal (Electron).
// Renderer (nodeIntegration) faz o trabalho pesado via require direto do motor; o main cuida de
// janela, dialogos de arquivo e do relatorio em PDF. Padrao dos outros apps Alpha.
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");

// LOG DE BOOT (diagnóstico do empacotado): escreve num arquivo em %TEMP%. Sempre ligado por ora.
const _bootLog = path.join(os.tmpdir(), "alphacompare_boot.log");
function boot(m) { try { fs.appendFileSync(_bootLog, new Date().toISOString() + "  " + m + "\n"); } catch (e) {} }
try { fs.writeFileSync(_bootLog, "== boot " + new Date().toISOString() + " packaged=" + (app.isPackaged) + " resources=" + (process.resourcesPath || "-") + " ==\n"); } catch (e) {}
process.on("uncaughtException", function (e) { boot("UNCAUGHT: " + (e && e.stack || e)); });
process.on("unhandledRejection", function (e) { boot("UNHANDLED_REJECTION: " + (e && e.stack || e)); });

// ===== TRAVA POR REDE: o app só abre na rede da empresa =====
// Robusto à TROCA DE IP: usa o HOSTNAME (aeserver16 resolve mesmo mudando o IP) + confere se a
// MÁQUINA está numa sub-rede da empresa (172.x ou 192.168.x). Fora da rede, avisa e não abre.
const NET_HOSTS = [                       // hostname sobrevive à troca de IP; IPs são reforço
  { host: "aeserver16", port: 445 },
  { host: "192.168.1.15", port: 445 },
  { host: "192.168.1.96", port: 445 },
  { host: "172.16.11.15", port: 445 },   // rede nova (a fabrica tem as duas faixas)
  { host: "172.16.11.96", port: 445 }
];
const NET_SUBNETS = ["192.168.", "172."]; // prefixos IPv4 da rede da empresa (172 = rede nova)
function canReach(host, port, timeout) {
  return new Promise(function (resolve) {
    const sock = new net.Socket();
    let done = false;
    function finish(ok) { if (done) return; done = true; try { sock.destroy(); } catch (e) {} resolve(ok); }
    sock.setTimeout(timeout || 2500);
    sock.once("connect", function () { finish(true); });
    sock.once("timeout", function () { finish(false); });
    sock.once("error", function () { finish(false); });
    try { sock.connect(port, host); } catch (e) { finish(false); }
  });
}
// a máquina tem um IPv4 numa sub-rede da empresa? (sobrevive à troca de servidor/IP)
function subredeEmpresa() {
  try {
    const ifs = os.networkInterfaces();
    for (const nome in ifs) {
      for (const a of ifs[nome]) {
        if (a.family !== "IPv4" || a.internal) continue;
        for (let i = 0; i < NET_SUBNETS.length; i++) if (a.address.indexOf(NET_SUBNETS[i]) === 0) return true;
      }
    }
  } catch (e) {}
  return false;
}
function naRede() {
  return Promise.all(NET_HOSTS.map(function (h) { return canReach(h.host, h.port, 2500); }))
    .then(function (r) { return r.some(Boolean) || subredeEmpresa(); });
}
// Loop: checa a rede; se falhar, mostra aviso (Tentar de novo / Fechar). Só abre se estiver na rede.
function gateRede() {
  return naRede().then(function (ok) {
    if (ok) return true;
    const r = dialog.showMessageBoxSync({
      type: "warning",
      title: "Alpha Compare — fora da rede",
      message: "Este aplicativo só funciona na rede da empresa.",
      detail: "Conecte-se à rede (Wi-Fi/cabo) da Alpha e tente novamente.",
      buttons: ["Tentar de novo", "Fechar"],
      defaultId: 0, cancelId: 1, noLink: true
    });
    if (r === 0) return gateRede();   // tenta de novo
    return false;                     // fecha
  });
}

// SPLASH (tela de carregamento estilo Photoshop/Illustrator): janelinha sem moldura com o logo
// enquanto o painel pesado (pdfium/wasm) carrega. Fecha sozinha quando o app termina de carregar.
let splashWin = null;
function createSplash() {
  try {
    splashWin = new BrowserWindow({
      width: 480, height: 320, frame: false, transparent: true, resizable: false,
      alwaysOnTop: true, center: true, show: false, skipTaskbar: true,
      backgroundColor: "#00000000", hasShadow: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    splashWin.loadFile(path.join(__dirname, "src", "panel", "splash.html"));
    splashWin.once("ready-to-show", function () { try { if (splashWin) splashWin.show(); } catch (e) {} });
  } catch (e) { boot("createSplash ERRO: " + (e && e.stack || e)); splashWin = null; }
}
function fecharSplash() {
  try { if (splashWin && !splashWin.isDestroyed()) splashWin.close(); } catch (e) {}
  splashWin = null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: "#0e1f43",
    icon: path.join(__dirname, "build", "icon.png"),
    title: "Alpha Compare",
    show: false,   // só aparece quando o painel terminar de carregar (a splash cobre a espera)
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.removeMenu();
  // mostra a janela principal e fecha a splash quando o painel carregou (ou por segurança, no máx 20s)
  var _mostrou = false;
  function mostrarApp() {
    if (_mostrou) return; _mostrou = true;
    try { win.show(); win.focus(); } catch (e) {}
    fecharSplash();
  }
  win.webContents.once("did-finish-load", function () { setTimeout(mostrarApp, 250); });
  var _splashGuard = setTimeout(mostrarApp, 20000);   // rede de segurança: nunca deixa preso na splash
  win.on("closed", function () { clearTimeout(_splashGuard); });
  // encaminha erros/logs do renderer pro terminal (diagnostico)
  win.webContents.on("console-message", function (_e, level, message, line, src) {
    if (level >= 2) console.log("[renderer] " + message + "  (" + (src || "").split(/[\\/]/).pop() + ":" + line + ")");
  });
  win.webContents.on("render-process-gone", function (_e, d) { boot("render-process-gone: " + JSON.stringify(d)); console.log("[render-process-gone] " + JSON.stringify(d)); });
  win.webContents.on("did-fail-load", function (_e, code, desc, url) { boot("did-fail-load code=" + code + " desc=" + desc + " url=" + url); });
  win.webContents.on("did-finish-load", function () { boot("did-finish-load OK"); });
  var _idx = path.join(__dirname, "src", "panel", "index.html");
  boot("loadFile: " + _idx + " existe=" + fs.existsSync(_idx));
  win.loadFile(_idx);
  // win.webContents.openDevTools();
}

app.whenReady().then(function () {
  boot("whenReady OK");
  gateRede().then(function (liberado) {
    boot("gateRede -> liberado=" + liberado);
    if (!liberado) { app.quit(); return; }
    createSplash();   // tela de carregamento primeiro
    try { createWindow(); boot("createWindow OK"); }
    catch (e) { boot("createWindow ERRO: " + (e && e.stack || e)); fecharSplash(); }
    app.on("activate", function () { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(function (e) { boot("gateRede ERRO: " + (e && e.stack || e)); });
}).catch(function (e) { boot("whenReady ERRO: " + (e && e.stack || e)); });
app.on("window-all-closed", function () { boot("window-all-closed"); if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("open-pdf", async function (_e, titulo) {
  const r = await dialog.showOpenDialog({
    title: titulo || "Abrir PDF",
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return { path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
});

// resolve um Python que RODA: testa env, PATH e caminhos comuns de instalacao no Windows.
const cp = require("child_process");
let _pyCache;
function resolvePython() {
  if (_pyCache !== undefined) return _pyCache;
  const cands = [];
  if (process.env.ALPHAPROOF_PYTHON) cands.push(process.env.ALPHAPROOF_PYTHON);
  if (process.env.PYTHON) cands.push(process.env.PYTHON);
  cands.push("python", "python3", "py");
  const home = process.env.USERPROFILE || os.homedir();
  const localApps = path.join(home, "AppData", "Local", "Programs", "Python");
  try { for (const d of fs.readdirSync(localApps)) cands.push(path.join(localApps, d, "python.exe")); } catch (e) {}
  ["Python312", "Python311", "Python310", "Python313"].forEach(function (v) {
    cands.push("C:/" + v + "/python.exe", path.join(home, "AppData", "Local", "Programs", "Python", v, "python.exe"));
  });
  for (const c of cands) {
    try { cp.execFileSync(c, ["--version"], { stdio: "ignore", timeout: 4000 }); _pyCache = c; return c; } catch (e) {}
  }
  _pyCache = null; return null;
}
// Localiza o OCR CONGELADO (PyInstaller -> ocr_server.exe): não precisa de Python na máquina.
// Empacotado: <resources>/ocr/ocr_server.exe (extraResources). Dev: src/ocr ou build/ocr.
let _ocrExeCache;
function resolveOcrExe() {
  if (_ocrExeCache !== undefined) return _ocrExeCache;
  const names = process.platform === "win32" ? ["ocr_server.exe"] : ["ocr_server"];
  const dirs = [];
  if (app.isPackaged) dirs.push(path.join(process.resourcesPath, "ocr"));
  dirs.push(path.join(__dirname, "build", "ocr_dist", "ocr_server"),   // dev: saída do PyInstaller
            path.join(__dirname, "build", "ocr"), path.join(__dirname, "src", "ocr"));
  for (const d of dirs) for (const n of names) {
    const p = path.join(d, n);
    try { if (fs.existsSync(p)) { _ocrExeCache = p; return p; } } catch (e) {}
  }
  _ocrExeCache = null; return null;
}
// Prefere o exe congelado; só procura Python se ele não existir (máquina sem o bundle).
ipcMain.handle("python-info", function () {
  const exe = resolveOcrExe();
  return { serverExe: exe, env: exe ? null : resolvePython() };
});

// Localiza o RENDER NATIVO congelado (PyInstaller -> render_server.exe = pdfium nativo).
// Empacotado: <resources>/render/render_server.exe. Dev: build/ocr_dist/render_server.
let _renderExeCache;
function resolveRenderExe() {
  if (_renderExeCache !== undefined) return _renderExeCache;
  const names = process.platform === "win32" ? ["render_server.exe"] : ["render_server"];
  const dirs = [];
  if (app.isPackaged) dirs.push(path.join(process.resourcesPath, "render"));
  dirs.push(path.join(__dirname, "build", "ocr_dist", "render_server"), path.join(__dirname, "build", "render"));
  for (const d of dirs) for (const n of names) {
    const p = path.join(d, n);
    try { if (fs.existsSync(p)) { _renderExeCache = p; return p; } } catch (e) {}
  }
  _renderExeCache = null; return null;
}
// serverExe = exe congelado (sem Python); senão {env, script} p/ rodar via Python (dev).
ipcMain.handle("render-info", function () {
  const exe = resolveRenderExe();
  return {
    serverExe: exe,
    env: exe ? null : resolvePython(),
    script: exe ? null : path.join(__dirname, "src", "render", "render_server.py")
  };
});

// gera o laudo em PDF a partir de um HTML (identidade Alpha), como no AlphaOndulado
ipcMain.handle("gerar-laudo", async function (_e, payload) {
  const r = await dialog.showSaveDialog({
    title: "Gerar laudo de conferencia",
    defaultPath: payload.defaultName || "conferencia.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    const tmp = path.join(os.tmpdir(), "alphaproof_laudo_" + process.pid + ".html");
    fs.writeFileSync(tmp, payload.html, "utf8");
    await win.loadFile(tmp);
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: "A4", margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 } });
    fs.writeFileSync(r.filePath, pdf);
    try { fs.unlinkSync(tmp); } catch (e) {}
    return { ok: true, path: r.filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally { win.destroy(); }
});

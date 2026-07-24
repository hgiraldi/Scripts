// Alpha Faca - processo principal (Electron)
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

function createWindow() {
  const win = new BrowserWindow({
    width: 1300, height: 840, minWidth: 1040, minHeight: 660,
    backgroundColor: "#0e1f43",
    icon: path.join(__dirname, "build", "icon.png"),
    title: "Alpha Faca",
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "src", "index.html"));
  // win.webContents.openDevTools();
}

app.whenReady().then(function () {
  createWindow();
  app.on("activate", function () { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", function () { if (process.platform !== "darwin") app.quit(); });

// ---- abrir DXF ----
ipcMain.handle("open-faca", async function () {
  const r = await dialog.showOpenDialog({
    title: "Abrir faca", properties: ["openFile"], filters: [{ name: "DXF", extensions: ["dxf"] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, { encoding: "latin1" }) };
});

// ---- armazenamento dos orçamentos salvos (dados, não PDF) ----
function orcDir() {
  const d = path.join(app.getPath("userData"), "orcamentos");
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}
function indexPath() { return path.join(orcDir(), "index.json"); }
function lerIndex() { try { return JSON.parse(fs.readFileSync(indexPath(), "utf8")); } catch (e) { return []; } }
function salvarIndex(a) { try { fs.writeFileSync(indexPath(), JSON.stringify(a, null, 2), "utf8"); } catch (e) {} }

ipcMain.handle("salvar-registro", async function (_e, meta) {
  const idx = lerIndex();
  idx.unshift(meta);
  salvarIndex(idx);
  return { ok: true };
});

ipcMain.handle("listar-orcamentos", async function () { return lerIndex(); });

ipcMain.handle("atualizar-percentual", async function (_e, p) {
  const idx = lerIndex();
  var i;
  for (i = 0; i < idx.length; i++) {
    if (String(idx[i].id) === String(p.id)) { idx[i].percentual = p.percentual; break; }
  }
  salvarIndex(idx);
  return { ok: true };
});

ipcMain.handle("excluir-orcamento", async function (_e, id) {
  salvarIndex(lerIndex().filter(function (m) { return String(m.id) !== String(id); }));
  return { ok: true };
});

// ---- cadastros compartilhados: caminho FIXO na rede (Windows UNC / Mac /Volumes) ----
const CAD_FILE = "alphafaca_cadastros.json";
function cadDir() {
  if (process.env.AF_CAD_DIR) return process.env.AF_CAD_DIR;   // override (testes/casos especiais)
  // mesmo compartilhamento "uteis" em 192.168.1.15, montado conforme o SO
  if (process.platform === "darwin") return "/Volumes/uteis/_Padroes_clientes_Alpha/_Scripts/BaseDados";
  return "\\\\192.168.1.15\\uteis\\_Padroes_clientes_Alpha\\_Scripts\\BaseDados";
}
function cadFilePath() { return path.join(cadDir(), CAD_FILE); }

ipcMain.handle("cad-caminho", async function () { return cadFilePath(); });
ipcMain.handle("ler-cadastros-arquivo", async function () {
  try {
    const p = cadFilePath();
    if (!fs.existsSync(p)) return { ok: true, data: null, dir: cadDir() };
    return { ok: true, data: JSON.parse(fs.readFileSync(p, "utf8")), dir: cadDir() };
  } catch (err) { return { ok: false, error: String(err), dir: cadDir() }; }
});
ipcMain.handle("salvar-cadastros-arquivo", async function (_e, args) {
  try {
    const d = cadDir();
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(cadFilePath(), JSON.stringify(args.data, null, 2), "utf8");
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err) }; }
});

// ---- gerar o PDF do cliente (só total) sob demanda ----
ipcMain.handle("gerar-pdf-cliente", async function (_e, payload) {
  const r = await dialog.showSaveDialog({
    title: "Gerar orçamento do cliente",
    defaultPath: payload.defaultName || "orcamento.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    const tmp = path.join(os.tmpdir(), "alphafaca_cliente_" + process.pid + ".html");
    fs.writeFileSync(tmp, payload.html, "utf8");
    await win.loadFile(tmp);
    const pdf = await win.webContents.printToPDF({
      printBackground: true, pageSize: "A4",
      margins: { marginType: "custom", top: 0, bottom: 0, left: 0, right: 0 }
    });
    fs.writeFileSync(r.filePath, pdf);
    try { fs.unlinkSync(tmp); } catch (e) {}
    return { ok: true, path: r.filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally { win.destroy(); }
});

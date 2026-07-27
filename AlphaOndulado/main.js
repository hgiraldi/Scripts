// Alpha Ondulado - processo principal (Electron)
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

function createWindow() {
  const win = new BrowserWindow({
    width: 1300, height: 860, minWidth: 1040, minHeight: 680,
    backgroundColor: "#0e1f43",
    icon: path.join(__dirname, "build", "icon.png"),
    title: "Alpha Ondulado",
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

// ---- abrir PDF ripado ----
ipcMain.handle("open-pdf", async function () {
  const r = await dialog.showOpenDialog({
    title: "Abrir PDF ripado",
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  return { path: p, name: path.basename(p) };
});

// ---- gerar o laudo PDF (identidade Alpha) sob demanda ----
ipcMain.handle("gerar-pdf-laudo", async function (_e, payload) {
  const r = await dialog.showSaveDialog({
    title: "Gerar laudo de orcamento",
    defaultPath: payload.defaultName || "laudo_orcamento.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    const tmp = path.join(os.tmpdir(), "alphaondulado_laudo_" + process.pid + ".html");
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

// abrir um arquivo no visualizador do SO (usado depois de gerar o laudo)
ipcMain.handle("abrir-arquivo", async function (_e, p) {
  try { await shell.openPath(p); return { ok: true }; }
  catch (err) { return { ok: false, error: String(err) }; }
});

// ---- banco local de ORCAMENTOS SALVOS (dados, na maquina) ----
// index.json = lista leve (metadados). <id>.json = registro completo (job + analise + preview)
function orcDir() {
  const d = path.join(app.getPath("userData"), "orcamentos");
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}
function indexPath() { return path.join(orcDir(), "index.json"); }
function lerIndex() { try { return JSON.parse(fs.readFileSync(indexPath(), "utf8")); } catch (e) { return []; } }
function salvarIndex(a) { try { fs.writeFileSync(indexPath(), JSON.stringify(a, null, 2), "utf8"); } catch (e) {} }
function recPath(id) { return path.join(orcDir(), String(id).replace(/[^\w\-]+/g, "_") + ".json"); }
function metaDe(rec) {
  return {
    id: rec.id, nomeArquivo: rec.nomeArquivo || "", cliente: rec.cliente || "",
    espessura: rec.espessura || "", tipo: rec.tipo || "", fator: rec.fator || 0,
    totalCm2: rec.totalCm2 || 0, preco: rec.preco || 0, data: rec.data || ""
  };
}

// salva (novo) ou atualiza (mesmo id). Retorna o meta.
ipcMain.handle("salvar-orcamento", async function (_e, rec) {
  try {
    if (!rec.id) rec.id = "AO" + Date.now();
    fs.writeFileSync(recPath(rec.id), JSON.stringify(rec), "utf8");
    const idx = lerIndex();
    let achou = false, i;
    for (i = 0; i < idx.length; i++) { if (String(idx[i].id) === String(rec.id)) { idx[i] = metaDe(rec); achou = true; break; } }
    if (!achou) idx.unshift(metaDe(rec));
    salvarIndex(idx);
    return { ok: true, id: rec.id };
  } catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle("listar-orcamentos", async function () { return lerIndex(); });

ipcMain.handle("abrir-orcamento", async function (_e, id) {
  try { return { ok: true, rec: JSON.parse(fs.readFileSync(recPath(id), "utf8")) }; }
  catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle("excluir-orcamento", async function (_e, id) {
  try {
    salvarIndex(lerIndex().filter(function (m) { return String(m.id) !== String(id); }));
    try { fs.unlinkSync(recPath(id)); } catch (e) {}
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err) }; }
});

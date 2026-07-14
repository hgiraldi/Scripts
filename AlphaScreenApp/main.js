// Alpha Screen - processo principal (Electron)
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1160,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: "#eceff5",
    icon: path.join(__dirname, "build", "icon.png"),
    title: "Alpha Screen",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "src", "index.html"));
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// dialogo de salvar (chamado pelo renderer)
ipcMain.handle("save-dialog", async (_e, defaultName) => {
  const r = await dialog.showSaveDialog({ defaultPath: defaultName, filters: [{ name: "PDF", extensions: ["pdf"] }] });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle("open-dialog", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "PDF", extensions: ["pdf"] }] });
  return (r.canceled || !r.filePaths.length) ? null : r.filePaths[0];
});

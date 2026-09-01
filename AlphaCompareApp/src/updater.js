// ============================================================================
// Alpha Update - atualizacao pela PASTA DA REDE (serve p/ qualquer app Alpha).
//
// A ideia: em vez de instalar na mao em cada maquina, o app olha um .txt numa pasta
// da rede. Se a versao de la for DIFERENTE da que esta rodando, o operador ve uma
// barra "Nova versao disponivel" e clica em Atualizar - o app copia o instalador da
// rede e o aplica sozinho.
//
//   \\aeserver16\Engine\versoes\<NomeDoApp>\
//        versao.txt
//        Alpha Compare Setup 0.1.3.exe
//        AlphaCompare-mac-0.1.3.dmg
//
// versao.txt (chave=valor; linhas com # sao comentario). Tolerante: se o arquivo
// tiver SO o numero da versao numa linha, tambem funciona.
//
//   versao=0.1.3
//   win=Alpha Compare Setup 0.1.3.exe
//   mac=AlphaCompare-mac-0.1.3.dmg
//   notas=limpeza da tela Limpar agora entra na comparacao
//
// Config por app: bloco "alphaUpdate" do package.json ({ nome, pastas }).
//
// Regra de disparo: versao DIFERENTE (nao "maior"). E de proposito - permite voltar
// atras publicando de novo a versao antiga no txt, sem mexer em maquina nenhuma.
// ============================================================================
const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

// aeserver16 PRIMEIRO: o 172.16.11.96 e o MESMO servidor, e falar com ele pelos dois
// nomes ao mesmo tempo derruba a sessao SMB (erro 1219). O IP fica so como reserva.
const PASTAS_PADRAO = [
  "\\\\aeserver16\\Engine\\versoes",
  "\\\\172.16.11.96\\Engine\\versoes",
  "/Volumes/Engine/versoes"            // como o share monta no Mac
];

function log(m) { try { console.log("[update] " + m); } catch (e) {} }

// ---------------------------------------------------------------- config
function config(appRoot) {
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8")); } catch (e) {}
  const c = pkg.alphaUpdate || {};
  return {
    nome: c.nome || (pkg.productName || pkg.name || "App").replace(/\s+/g, ""),
    pastas: (c.pastas && c.pastas.length) ? c.pastas : PASTAS_PADRAO
  };
}

// ---------------------------------------------------------------- leitura do txt
function parseTxt(txt) {
  const out = {};
  const linhas = String(txt).split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l || l.charAt(0) === "#" || l.charAt(0) === ";") continue;
    const eq = l.indexOf("=");
    if (eq > 0) {
      const k = l.slice(0, eq).trim().toLowerCase();
      const v = l.slice(eq + 1).trim();
      if (k && v) out[k] = v;
    } else if (!out.versao && /^[0-9][0-9a-zA-Z.\-]*$/.test(l)) {
      out.versao = l;                    // txt "cru": so o numero da versao
    }
  }
  return out;
}

// acha a pasta do app na rede (1a que responder) - com timeout curto p/ nao travar a UI
function acharPasta(cfg) {
  for (let i = 0; i < cfg.pastas.length; i++) {
    const dir = path.join(cfg.pastas[i], cfg.nome);
    try {
      if (fs.existsSync(path.join(dir, "versao.txt"))) { log("pasta = " + dir); return dir; }
    } catch (e) { /* rede fora / sem permissao: tenta a proxima */ }
  }
  return null;
}

// Le a versao publicada. NUNCA rejeita por rede fora: sem rede = "sem novidade".
//   -> { ok, temNova, versaoLocal, versaoRede, arquivo, notas, pasta, motivo }
function verificar(opts) {
  const appRoot = opts.appRoot;
  const versaoLocal = String(opts.versaoLocal || "").trim();
  const plataforma = opts.plataforma || process.platform;
  const cfg = config(appRoot);
  const base = { ok: false, temNova: false, versaoLocal: versaoLocal, versaoRede: "", arquivo: "", notas: "", pasta: "" };

  const dir = acharPasta(cfg);
  if (!dir) return Promise.resolve(Object.assign(base, { motivo: "pasta de versoes nao encontrada na rede" }));

  let info;
  try { info = parseTxt(fs.readFileSync(path.join(dir, "versao.txt"), "utf8")); }
  catch (e) { return Promise.resolve(Object.assign(base, { motivo: "nao consegui ler o versao.txt: " + e.message })); }

  const versaoRede = String(info.versao || "").trim();
  if (!versaoRede) return Promise.resolve(Object.assign(base, { motivo: "versao.txt sem a chave versao=" }));

  // nome do instalador: chave da plataforma; se faltar, procura sozinho na pasta
  const chave = (plataforma === "darwin") ? "mac" : "win";
  const ext = (plataforma === "darwin") ? ".dmg" : ".exe";
  let arquivo = info[chave] || "";
  if (!arquivo) {
    try {
      const cands = fs.readdirSync(dir).filter(function (f) { return f.toLowerCase().slice(-4) === ext; });
      // se houver mais de um, prefere o que cita a versao publicada
      arquivo = cands.filter(function (f) { return f.indexOf(versaoRede) >= 0; })[0] || cands[0] || "";
    } catch (e) {}
  }

  const r = Object.assign(base, {
    ok: true, versaoRede: versaoRede, arquivo: arquivo, notas: info.notas || "", pasta: dir,
    temNova: !!(versaoLocal && versaoRede && versaoRede !== versaoLocal)
  });
  if (r.temNova && !arquivo) {
    r.temNova = false;
    r.motivo = "versao " + versaoRede + " publicada, mas sem instalador " + ext + " na pasta";
  }
  log("local=" + versaoLocal + " rede=" + versaoRede + " temNova=" + r.temNova + (r.motivo ? " (" + r.motivo + ")" : ""));
  return Promise.resolve(r);
}

// ---------------------------------------------------------------- copia da rede
// Copia o instalador da rede p/ o TEMP local. Instalar direto do \\servidor da erro
// no NSIS (e no Mac o dmg fica preso ao volume), entao a copia local nao e opcional.
function baixar(info, onProgress) {
  return new Promise(function (resolve, reject) {
    const origem = path.join(info.pasta, info.arquivo);
    const destino = path.join(os.tmpdir(), "alphaupdate_" + info.versaoRede + "_" + info.arquivo);
    let total = 0;
    try { total = fs.statSync(origem).size; } catch (e) { reject(new Error("instalador nao encontrado: " + origem)); return; }

    // ja baixado e completo (ex.: 2a tentativa)? aproveita
    try { if (fs.existsSync(destino) && fs.statSync(destino).size === total) { resolve({ caminho: destino, total: total }); return; } } catch (e) {}

    let feito = 0;
    const ent = fs.createReadStream(origem);
    const sai = fs.createWriteStream(destino);
    ent.on("data", function (c) {
      feito += c.length;
      if (onProgress && total) onProgress(Math.min(99, Math.round(feito * 100 / total)), feito, total);
    });
    ent.on("error", function (e) { try { sai.destroy(); } catch (e2) {} reject(new Error("falha lendo da rede: " + e.message)); });
    sai.on("error", function (e) { reject(new Error("falha gravando no disco: " + e.message)); });
    sai.on("finish", function () {
      let okTam = false;
      try { okTam = fs.statSync(destino).size === total; } catch (e) {}
      if (!okTam) { reject(new Error("copia incompleta (rede caiu no meio?)")); return; }
      if (onProgress) onProgress(100, total, total);
      resolve({ caminho: destino, total: total });
    });
    ent.pipe(sai);
  });
}

// ---------------------------------------------------------------- aplicar
// Windows: instala e REABRE o app, por um ajudante que sobrevive ao app fechando.
//
// Sequencia (tudo dentro de um powershell solto, detached): espera o app fechar ->
// roda o instalador silencioso e ESPERA ele terminar -> reabre o app.
//
// Dois detalhes que custaram teste:
//  - Start-Process (ShellExecute), NAO spawn direto: numa instalacao "para todos os
//    usuarios" o instalador precisa subir privilegio, e o CreateProcess do spawn
//    falharia com EACCES em vez de mostrar o UAC.
//  - quem reabre o app somos NOS, nao o --force-run do NSIS: medido, o --force-run nao
//    reabriu o app quando o instalador rodou elevado. Sem isso o operador clica em
//    "Atualizar" e o app simplesmente some - parece que quebrou.
function aplicarWin(caminho, exePath) {
  return new Promise(function (resolve, reject) {
    const q = function (x) { return JSON.stringify(String(x)); };
    const ps = [
      "Start-Sleep -Seconds 2",                                        // deixa o app fechar
      // try/catch NAO e decoracao: se o operador RECUSAR o UAC, o -Wait estoura e sem o
      // catch o script morre aqui - o app teria sumido de vez. Assim ele sempre volta,
      // na versao velha, e o operador pode tentar de novo.
      "try { Start-Process -FilePath " + q(caminho) + " -ArgumentList '/S' -Wait -ErrorAction Stop } catch { }",
      "Start-Sleep -Seconds 1",
      "Start-Process -FilePath " + q(exePath)                          // volta (nova, ou a velha se falhou)
    ].join("; ");
    try {
      const h = cp.spawn("powershell.exe",
        ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps],
        { detached: true, stdio: "ignore", windowsHide: true });
      h.unref();
    } catch (e) { reject(new Error("nao consegui iniciar o instalador: " + e.message)); return; }
    resolve({ reiniciar: true });
  });
}

// Mac: monta o .dmg, copia o .app POR CIMA do que esta instalado e desmonta.
// O caminho de destino sai do proprio executavel em execucao - assim vale tanto p/
// /Applications quanto p/ ~/Applications, sem chutar.
function aplicarMac(caminho, exePath) {
  return new Promise(function (resolve, reject) {
    // /Applications/Alpha Compare.app/Contents/MacOS/Alpha Compare -> .../Alpha Compare.app
    const destino = exePath.replace(/\.app\/Contents\/MacOS\/[^/]+$/, ".app");
    if (destino === exePath || destino.slice(-4) !== ".app") {
      reject(new Error("nao identifiquei o .app instalado (rodando fora de um bundle?)"));
      return;
    }
    const sh = [
      "set -e",
      "DMG=" + JSON.stringify(caminho),
      "DEST=" + JSON.stringify(destino),
      'MNT=$(mktemp -d /tmp/alphaupd.XXXXXX)',
      'hdiutil attach "$DMG" -nobrowse -noautoopen -quiet -mountpoint "$MNT"',
      'APP=$(find "$MNT" -maxdepth 1 -name "*.app" | head -1)',
      'if [ -z "$APP" ]; then hdiutil detach "$MNT" -quiet || true; echo "dmg sem .app dentro" >&2; exit 1; fi',
      // ditto preserva permissao/symlink do bundle (cp -R quebra o Framework do Electron)
      'rm -rf "$DEST.antigo" && mv "$DEST" "$DEST.antigo" 2>/dev/null || true',
      'if ! ditto "$APP" "$DEST"; then mv "$DEST.antigo" "$DEST" 2>/dev/null || true; hdiutil detach "$MNT" -quiet || true; echo "sem permissao para substituir o app" >&2; exit 1; fi',
      'rm -rf "$DEST.antigo" || true',
      'xattr -dr com.apple.quarantine "$DEST" || true',
      'hdiutil detach "$MNT" -quiet || true',
      'rmdir "$MNT" 2>/dev/null || true'
    ].join("\n");
    cp.execFile("/bin/bash", ["-c", sh], { timeout: 300000 }, function (err, so, se) {
      if (err) { reject(new Error(((se || "").trim().split("\n").pop()) || err.message)); return; }
      resolve({ reiniciar: true, destino: destino });
    });
  });
}

function aplicar(caminho, exePath) {
  if (process.platform === "darwin") return aplicarMac(caminho, exePath);
  if (process.platform === "win32") return aplicarWin(caminho, exePath);
  return Promise.reject(new Error("plataforma sem atualizacao automatica: " + process.platform));
}

// relanca o app depois da troca (so no Mac; no Windows quem reabre e o --force-run)
function reabrirMac(destino) {
  try { cp.spawn("/usr/bin/open", ["-n", destino], { detached: true, stdio: "ignore" }).unref(); } catch (e) {}
}

module.exports = { verificar: verificar, baixar: baixar, aplicar: aplicar, reabrirMac: reabrirMac, parseTxt: parseTxt, config: config };

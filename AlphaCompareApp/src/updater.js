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
//
// Os dois sistemas seguem a MESMA receita, num ajudante em ARQUIVO que roda solto:
//   1. espera o app FECHAR de verdade (pelo PID, nao por um sleep chutado);
//   2. instala;
//   3. reabre o app.
//
// Por que assim, e nao "manda instalar e tchau" (que foi o que quebrou na 0.1.5):
//  - O instalador NSIS silencioso instala POR USUARIO por padrao. Se o app estava em
//    "C:\Program Files" (todos os usuarios), ele desinstalava de la e instalava em
//    %LOCALAPPDATA% -> o caminho que o ajudante ia reabrir nao existia mais e o app
//    simplesmente sumia. Agora o modo e FIXADO (/allusers ou /currentuser) conforme
//    onde o app esta hoje, e a reabertura ainda procura no registro se nao achar.
//  - Instalar com o app ainda vivo faz o NSIS matar o app no meio; esperar o PID
//    tira essa corrida.

function tmpFile(nome) { return path.join(os.tmpdir(), "alphaupdate_" + Date.now() + "_" + nome); }

// dispara um processo solto. No macOS o detached faz setsid() e o filho vira lider de
// sessao - sobrevive ao app fechar. No WINDOWS isso NAO basta (medido: o ajudante morre
// junto com o app), por isso la usamos o Agendador de Tarefas - ver dispararWin().
function solto(cmd, args) {
  const h = cp.spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true });
  h.unref();
  return h;
}

// Windows: registra e roda uma tarefa AGENDADA de uma vez so. Ela roda pelo servico do
// agendador, fora da arvore de processos do app - e o unico jeito que sobrevive ao app
// fechar (testado: spawn detached nao sobrevive). O XML evita a briga de aspas do /tr.
function dispararWin(script) {
  const nome = "AlphaUpdate_" + path.basename(script).replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);
  const args = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + script + '"';
  const xml = [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    '  <RegistrationInfo><Description>Alpha Update</Description></RegistrationInfo>',
    '  <Triggers />',
    '  <Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType>',
    '    <RunLevel>LeastPrivilege</RunLevel></Principal></Principals>',
    '  <Settings>',
    '    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>',
    '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
    '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
    '    <AllowHardTerminate>false</AllowHardTerminate>',
    '    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>',
    '    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>',
    '    <AllowStartOnDemand>true</AllowStartOnDemand><Enabled>true</Enabled><Hidden>false</Hidden>',
    '    <RunOnlyIfIdle>false</RunOnlyIfIdle><WakeToRun>false</WakeToRun>',
    '    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit><Priority>7</Priority>',
    '  </Settings>',
    '  <Actions Context="Author"><Exec>',
    '    <Command>powershell.exe</Command>',
    '    <Arguments>' + args.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") + '</Arguments>',
    '  </Exec></Actions>',
    '</Task>'
  ].join("\r\n");

  const xmlFile = script.replace(/\.ps1$/, ".xml");
  fs.writeFileSync(xmlFile, Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(xml, "utf16le")]));  // schtasks exige UTF-16
  cp.execFileSync("schtasks.exe", ["/create", "/tn", nome, "/xml", xmlFile, "/f"], { windowsHide: true, timeout: 30000 });
  cp.execFileSync("schtasks.exe", ["/run", "/tn", nome], { windowsHide: true, timeout: 30000 });
  return nome;
}

// valor -> literal de string do shell, ja escapado (aspas simples: dobra a aspa)
function aspasPS(v) { return "'" + String(v).replace(/'/g, "''") + "'"; }
function aspasSH(v) { return "'" + String(v).replace(/'/g, "'\\''") + "'"; }

// Windows: helper .ps1. O modo de instalacao acompanha onde o app esta hoje, senao o
// instalador "muda o app de lugar" no meio da atualizacao.
function aplicarWin(caminho, exePath) {
  return new Promise(function (resolve, reject) {
    const pf = (process.env["ProgramFiles"] || "C:\\Program Files").toLowerCase();
    const pf86 = (process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)").toLowerCase();
    const alvo = String(exePath || "").toLowerCase();
    const modo = (alvo.indexOf(pf) === 0 || alvo.indexOf(pf86) === 0) ? "/allusers" : "/currentuser";
    const script = tmpFile("aplicar.ps1");
    const nomeTarefa = "AlphaUpdate_" + path.basename(script).replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);

    // Os valores vao ESCRITOS no script, sem param(): medido que, disparado pelo Node,
    // "-File x.ps1 -Setup ..." nao casava os parametros e o ajudante saia sem fazer nada.
    const ps = [
      '$AppPid = ' + parseInt(process.pid, 10),
      '$Setup  = ' + aspasPS(caminho),
      '$Exe    = ' + aspasPS(exePath),
      '$Modo   = ' + aspasPS(modo),
      '$Log    = ' + aspasPS(path.join(os.tmpdir(), "alphacompare_update.log")),
      '$Tarefa = ' + aspasPS(nomeTarefa),
      'function Reg($m) { try { Add-Content -Path $Log -Value ((Get-Date).ToString("s") + "  " + $m) } catch { } }',
      'Reg "ajudante iniciou (modo $Modo)"',
      '# 1) espera o app fechar (ate 60s) - instalar com ele vivo e corrida perdida',
      'for ($i = 0; $i -lt 120; $i++) {',
      '  if (-not (Get-Process -Id $AppPid -ErrorAction SilentlyContinue)) { break }',
      '  Start-Sleep -Milliseconds 500',
      '}',
      'Reg "app fechou; instalando"',
      '# 2) instala. try/catch: se o operador RECUSAR o UAC o -Wait estoura, e sem isso o',
      '#    script morreria aqui - com o app ja fechado, ou seja, o app sumiria.',
      'try { Start-Process -FilePath $Setup -ArgumentList $Modo,"/S" -Wait -ErrorAction Stop; Reg "instalador terminou" }',
      'catch { Reg ("instalador FALHOU: " + $_.Exception.Message) }',
      'Start-Sleep -Seconds 2',
      '# 3) reabre. Se o caminho de antes nao existe mais (o instalador pode ter mudado o',
      '#    app de pasta), procura onde ele registrou a instalacao.',
      'if (-not (Test-Path $Exe)) {',
      '  Reg "caminho antigo sumiu; procurando no registro"',
      '  $nome = [IO.Path]::GetFileName($Exe)',
      '  foreach ($k in @("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",',
      '                   "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*")) {',
      '    foreach ($x in (Get-ItemProperty $k -ErrorAction SilentlyContinue)) {',
      '      if ($x.DisplayIcon) {',
      '        $c = ($x.DisplayIcon -replace ",.*$", "").Trim(\'"\')',
      '        if ($c -and (Split-Path $c -Leaf) -eq $nome -and (Test-Path $c)) { $Exe = $c; break }',
      '      }',
      '      if ($x.InstallLocation) {',
      '        $c2 = Join-Path $x.InstallLocation $nome',
      '        if (Test-Path $c2) { $Exe = $c2; break }',
      '      }',
      '    }',
      '    if (Test-Path $Exe) { break }',
      '  }',
      '}',
      'if (Test-Path $Exe) { Reg "reabrindo $Exe"; Start-Process -FilePath $Exe }',
      'else { Reg "NAO achei o app para reabrir" }',
      '# limpa a tarefa agendada que disparou este script (e os temporarios)',
      'try { schtasks.exe /delete /tn $Tarefa /f | Out-Null } catch { }',
      'try { Remove-Item $Setup, $PSCommandPath, ($PSCommandPath -replace "\\.ps1$", ".xml") -Force -ErrorAction SilentlyContinue } catch { }'
    ].join("\r\n");

    try { fs.writeFileSync(script, "\ufeff" + ps, "utf8"); }   // BOM: powershell le acentos certo
    catch (e) { reject(new Error("nao consegui preparar o atualizador: " + e.message)); return; }

    try { dispararWin(script); }
    catch (e) {
      // plano B: se o agendador estiver bloqueado, ao menos tenta o disparo comum
      log("schtasks falhou (" + (e && e.message) + ") -> tentando spawn detached");
      try { solto("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script]); }
      catch (e2) { reject(new Error("nao consegui iniciar o atualizador: " + e2.message)); return; }
    }
    resolve({ reiniciar: true, modo: modo });
  });
}

// Mac: helper .sh, mesma receita (valores escritos dentro, sem depender de argumentos).
// Trocar o bundle com o app AINDA RODANDO e pedir para travar - por isso o ajudante
// tambem espera o PID sair antes do ditto.
function aplicarMac(caminho, exePath) {
  return new Promise(function (resolve, reject) {
    // /Applications/Alpha Compare.app/Contents/MacOS/Alpha Compare -> .../Alpha Compare.app
    const destino = String(exePath || "").replace(/\.app\/Contents\/MacOS\/[^/]+$/, ".app");
    if (destino === exePath || destino.slice(-4) !== ".app") {
      reject(new Error("nao identifiquei o .app instalado (rodando fora de um bundle?)"));
      return;
    }
    const sh = [
      '#!/bin/bash',
      'APPPID=' + parseInt(process.pid, 10),
      'DMG=' + aspasSH(caminho),
      'DEST=' + aspasSH(destino),
      'LOG=' + aspasSH(path.join(os.tmpdir(), "alphacompare_update.log")),
      'reg(){ echo "$(date +%FT%T)  $1" >> "$LOG" 2>/dev/null; }',
      'reg "ajudante iniciou"',
      '# 1) espera o app fechar (ate 60s)',
      'for i in $(seq 1 120); do kill -0 "$APPPID" 2>/dev/null || break; sleep 0.5; done',
      'reg "app fechou; montando o dmg"',
      'MNT=$(mktemp -d /tmp/alphaupd.XXXXXX)',
      'if ! hdiutil attach "$DMG" -nobrowse -noautoopen -quiet -mountpoint "$MNT"; then',
      '  reg "hdiutil falhou"; open -n "$DEST"; exit 1',
      'fi',
      'APP=$(find "$MNT" -maxdepth 1 -name "*.app" | head -1)',
      'if [ -z "$APP" ]; then',
      '  reg "dmg sem .app dentro"; hdiutil detach "$MNT" -quiet; rmdir "$MNT" 2>/dev/null; open -n "$DEST"; exit 1',
      'fi',
      '# 2) troca o bundle. ditto (nao cp -R) preserva symlink/permissao do Electron Framework.',
      '#    Guarda o antigo ate a copia terminar: se falhar, devolve o que ja existia.',
      'rm -rf "$DEST.antigo" 2>/dev/null',
      'if mv "$DEST" "$DEST.antigo" 2>/dev/null; then',
      '  if ditto "$APP" "$DEST"; then rm -rf "$DEST.antigo"; reg "app trocado"',
      '  else rm -rf "$DEST"; mv "$DEST.antigo" "$DEST"; reg "ditto FALHOU - voltei o antigo"; fi',
      'else',
      '  ditto "$APP" "$DEST" && reg "app trocado (sem backup)" || reg "ditto FALHOU"',
      'fi',
      'xattr -dr com.apple.quarantine "$DEST" 2>/dev/null',
      'hdiutil detach "$MNT" -quiet 2>/dev/null; rmdir "$MNT" 2>/dev/null',
      '# 3) reabre - de um jeito ou de outro o operador tem o app de volta',
      'reg "reabrindo $DEST"',
      'open -n "$DEST"'
    ].join("\n");

    let script;
    try {
      script = tmpFile("aplicar.sh");
      fs.writeFileSync(script, sh, "utf8");
      fs.chmodSync(script, 0o755);
    } catch (e) { reject(new Error("nao consegui preparar o atualizador: " + e.message)); return; }

    try { solto("/bin/bash", [script]); }
    catch (e) { reject(new Error("nao consegui iniciar o atualizador: " + e.message)); return; }
    resolve({ reiniciar: true, destino: destino });
  });
}

function aplicar(caminho, exePath) {
  if (process.platform === "darwin") return aplicarMac(caminho, exePath);
  if (process.platform === "win32") return aplicarWin(caminho, exePath);
  return Promise.reject(new Error("plataforma sem atualizacao automatica: " + process.platform));
}

module.exports = { verificar: verificar, baixar: baixar, aplicar: aplicar, parseTxt: parseTxt, config: config };

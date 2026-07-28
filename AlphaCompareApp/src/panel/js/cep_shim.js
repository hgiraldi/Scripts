/* ============================================================
 * Alpha Proof - shim que faz o painel (feito p/ CEP) rodar no ELECTRON.
 * Define window.__adobe_cep__ e implementa em NODE as funcoes do host.jsx
 * (Desktop/Engine/Job/reference). O restante do painel roda igual.
 * Carregado ANTES do main.js.
 * ============================================================ */
(function () {
  "use strict";
  var fs = require("fs");
  var path = require("path");
  var os = require("os");

  // Engine: UNC no Windows, volume montado no Mac. Testa em ordem.
  var ENGINES = ["\\\\aeserver16\\Engine", "\\\\192.168.1.96\\Engine", "//aeserver16/Engine", "/Volumes/Engine"];
  function engineDir() {
    for (var i = 0; i < ENGINES.length; i++) { try { if (fs.existsSync(ENGINES[i])) return ENGINES[i]; } catch (e) {} }
    return null;
  }
  function desktopDir() {
    var d = path.join(os.homedir(), "Desktop");
    try { if (fs.existsSync(d)) return d; } catch (e) {}
    // OneDrive redireciona o Desktop
    var od = path.join(os.homedir(), "OneDrive", "Desktop");
    try { if (fs.existsSync(od)) return od; } catch (e2) {}
    return d;
  }
  function fmtData(t) { if (!t) return ""; var dt = new Date(t); function p(n) { return (n < 10 ? "0" : "") + n; } return p(dt.getDate()) + "/" + p(dt.getMonth() + 1) + "/" + dt.getFullYear(); }

  // ---- host.jsx portado p/ Node ----
  var HOST = {
    acDesktopPath: function () { return "OK|" + desktopDir(); },

    // sem Illustrator aberto neste app -> nao ha doc; o painel degrada ok
    acInfoDoc: function () { return "NADOC|sem documento aberto (Alpha Proof)"; },
    acRegioesIgnorar: function () { return "OK|"; },   // sem doc aberto -> nenhuma regiao estrutural

    // lista PDFs do Desktop (arquivo tratado). Prefere rev/v; ignora Conferencia_. Novo primeiro.
    acListarPdfsDesktop: function () {
      try {
        var base = desktopDir(), todos = [], comRev = [], MAXDEPTH = 6, LIMITE = 120;
        function scan(dir, depth, rot, insideJob) {
          if (depth > MAXDEPTH || todos.length >= LIMITE) return;
          var items; try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
          for (var i = 0; i < items.length && todos.length < LIMITE; i++) {
            var it = items[i], full = path.join(dir, it.name);
            if (it.isDirectory()) {
              var isJob = /rev/i.test(it.name);
              if (isJob || insideJob || depth < 1) scan(full, depth + 1, isJob ? it.name : rot, insideJob || isJob);
              continue;
            }
            if (!/\.pdf$/i.test(it.name)) continue;
            if (/^conferencia_/i.test(it.name)) continue;
            var t = 0; try { t = fs.statSync(full).mtimeMs; } catch (e2) {}
            var label = it.name + "   " + fmtData(t) + (rot ? "   [" + rot + "]" : "");
            var item = { label: label, path: full, t: t };
            todos.push(item);
            if (/rev/i.test(it.name) || insideJob) comRev.push(item);
          }
        }
        scan(base, 0, "", false);
        var lista = comRev.length > 0 ? comRev : todos;
        lista.sort(function (a, b) { return b.t - a.t; });
        var out = []; for (var j = 0; j < lista.length; j++) out.push(lista[j].label + "\t" + lista[j].path);
        return "OK|" + out.join("\n");
      } catch (e) { return "ERRO|" + e; }
    },

    // acha o original NORMAL (nao "Distorcido") mais novo em <Engine>/_Jobfolder/<os>/original/
    acBuscarOriginalDoJob: function (osArg) {
      try {
        var eng = engineDir(); if (!eng) return "ERRO|Engine inacessivel (rede)";
        var subs = ["original", "_original", "Original"], dir = null;
        for (var s = 0; s < subs.length && !dir; s++) {
          var p = path.join(eng, "_Jobfolder", String(osArg), subs[s]);
          try { if (fs.existsSync(p) && fs.statSync(p).isDirectory()) dir = p; } catch (e) {}
        }
        if (!dir) return "ERRO|Pasta 'original' do job " + osArg + " nao encontrada no Engine";
        var files = fs.readdirSync(dir).filter(function (n) { return /\.pdf$/i.test(n); });
        if (!files.length) return "ERRO|Nenhum PDF na pasta original do job " + osArg;
        var bestN = null, bestNT = -1, best = null, bestT = -1;
        files.forEach(function (nm) {
          var full = path.join(dir, nm), t = 0; try { t = fs.statSync(full).mtimeMs; } catch (e) {}
          if (t > bestT) { bestT = t; best = full; }
          if (!/distorcido/i.test(nm)) { if (t > bestNT) { bestNT = t; bestN = full; } }
        });
        var chosen = bestN || best;
        return "OK|" + chosen + "|" + path.basename(chosen) + "|" + (bestN ? "normal" : "distorcido");
      } catch (e) { return "ERRO|" + e; }
    },

    // pasta do job p/ o relatorio (<Engine>/_Jobfolder/<os>) -> reference dele
    acPastaJob: function (osArg) {
      try {
        var eng = engineDir(); if (!eng) return "OFF|Engine inacessivel";
        var p = path.join(eng, "_Jobfolder", String(osArg));
        if (fs.existsSync(p)) return "OK|" + p;
        return "NAO|job " + osArg + " nao encontrado";
      } catch (e) { return "OFF|" + e; }
    }
  };

  // parse "acFoo('arg')" ou "acFoo()" -> chama HOST.acFoo(arg)
  function runHost(src) {
    var m = String(src).match(/^\s*([a-zA-Z_]\w*)\s*\((.*)\)\s*;?\s*$/);
    if (!m || !HOST[m[1]]) return "__SEM_HOST__";
    var argsRaw = m[2].trim(), args = [];
    if (argsRaw) {
      // aceita 'texto' ou numero simples (as chamadas do painel usam 1 arg string/num)
      var q = argsRaw.match(/^'([^']*)'$/) || argsRaw.match(/^"([^"]*)"$/);
      args = [q ? q[1] : argsRaw];
    }
    try { return HOST[m[1]].apply(null, args); } catch (e) { return "ERRO|" + e; }
  }

  window.__adobe_cep__ = {
    evalScript: function (src, cb) {
      var r;
      try { r = runHost(src); } catch (e) { r = "ERRO|" + e; }
      // assincrono como o CEP real
      setTimeout(function () { if (cb) cb(r); }, 0);
    },
    getHostEnvironment: function () {
      // tema escuro por padrao (o painel escurece se o fundo for escuro)
      return JSON.stringify({ appSkinInfo: { panelBackgroundColor: { color: { red: 20, green: 33, blue: 61, alpha: 255 } } } });
    }
  };
})();

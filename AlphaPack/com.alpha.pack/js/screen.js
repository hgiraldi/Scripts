/* ============================================================
 * AlphaPack - janela de Screening (extensao Modeless propria)
 * - Puxa tintas do XML da OS (host apScreenPullOS)
 * - Le screening gravado no PDF linkado (XMP, via Node)
 * - Tabela estilo Ink Manager: tipo, selecionar por cor, filtrar por set
 * Convencao do host: "OK|<dado>" / "ERRO|<msg>".
 * ============================================================ */
(function () {
  "use strict";

  var cep = window.__adobe_cep__;
  function ev(src, cb) { if (!cep) { if (cb) cb("ERRO|Sem CEP (rode dentro do Illustrator)"); return; } cep.evalScript(src, cb || function () {}); }
  function $(id) { return document.getElementById(id); }
  function q(v) { return JSON.stringify(String(v)); }
  var RS = String.fromCharCode(30), FS = String.fromCharCode(31);

  var dados = null;        // { os, prod, inks:[...], origem:"OS"|"PDF"|"DOC" }
  var rawPayload = "";     // payload cru (RS/FS) atual, pra gravar no PDF

  function msg(txt, tipo) { var e = $("scMsg"); if (e) { e.textContent = txt; e.className = "msg " + (tipo || ""); } }
  function info(txt, tipo) { var e = $("scInfo"); if (e) { e.textContent = txt; e.className = "msg " + (tipo || ""); } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"; }); }

  /* ---------- tema + conexao ---------- */
  function aplicarTema() {
    try {
      var c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
      var escuro = ((0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) < 150);
      document.body.classList.toggle("ap-light", !escuro);
      document.body.classList.toggle("ap-dark", escuro);
    } catch (e) {}
  }
  function checarConexao() {
    ev("apPing()", function (r) {
      var ok = r && r.indexOf("OK|") === 0;
      $("dot").className = "dot " + (ok ? "ok" : "off");
      $("connLbl").textContent = ok ? (r.split("|")[1] || "sem documento") : "sem Illustrator";
    });
  }

  /* ---------- dados ---------- */
  function parse(payload, origem) {
    var parts = String(payload).split(RS);
    var head = (parts[0] || "").split(FS);
    var inks = [], i;
    for (i = 1; i < parts.length; i++) {
      if (!parts[i]) continue;
      var f = parts[i].split(FS);
      inks.push({ nome: f[0], ang: f[1], lpi: f[2], dot: f[3], tipo: f[4], ref: f[5], dual: f[6] === "1", base: f[7], book: f[8] || "" });
    }
    return { os: head[0] || "", prod: head[1] || "", inks: inks, origem: origem || "" };
  }

  function temDual(nome) {
    var i; for (i = 0; i < dados.inks.length; i++) { if (dados.inks[i].dual && dados.inks[i].base === nome) return true; } return false;
  }
  function tipoLabel(k) {
    if (String(k.tipo).toLowerCase() === "technical") return "Técnica";
    var b = String(k.book).toLowerCase();
    if (b === "process") return "Process";
    if (b === "designer") return "Spot";
    return b ? (b.charAt(0).toUpperCase() + b.slice(1)) : "—";
  }

  /* ---------- render (Ink Manager) ---------- */
  function render() {
    var body = $("scBody"); if (!body) return;
    body.innerHTML = "";
    var set = $("scSetSel").value, i, mostrados = 0;
    for (i = 0; i < dados.inks.length; i++) {
      var k = dados.inks[i];
      if (set === "main" && k.dual) continue;
      if (set === "dual" && !k.dual) continue;
      mostrados++;
      var tr = document.createElement("tr");
      if (k.dual) tr.className = "is-dual";
      var dualLbl = k.dual ? ("&rarr; " + esc(k.base)) : (temDual(k.nome) ? "<span class='badge'>tem ##</span>" : "");
      var ref = k.ref ? "<div class='ref'>" + esc(k.ref) + "</div>" : "";
      tr.innerHTML =
        "<td><b>" + esc(k.nome) + "</b>" + ref + "</td>" +
        "<td>" + esc(tipoLabel(k)) + "</td>" +
        "<td>" + esc(k.ang) + "&deg;</td>" +
        "<td>" + esc(k.lpi) + "</td>" +
        "<td>" + esc(k.dot) + "</td>" +
        "<td>" + dualLbl + "</td>" +
        "<td><button class='row-sel' data-ink='" + esc(k.nome) + "' title='Selecionar tudo desta tinta'>Selec.</button></td>";
      body.appendChild(tr);
    }
    var sels = body.querySelectorAll(".row-sel"), s;
    for (s = 0; s < sels.length; s++) sels[s].addEventListener("click", onSelInk);

    var nd = 0; for (i = 0; i < dados.inks.length; i++) if (dados.inks[i].dual) nd++;
    var fonte = dados.origem === "PDF" ? "PDF linkado" : dados.origem === "OS" ? "XML da OS" : "arquivo";
    info("OS " + esc(dados.os) + (dados.prod ? " · " + esc(dados.prod) : "") + " — " + dados.inks.length + " tintas" + (nd ? " (" + nd + " dual ##)" : "") + " · " + fonte, "ok");
    $("scWrap").style.display = "";
    $("scEmpty").style.display = "none";
    $("scPdfBox").style.display = "";
  }

  function vazio(txt) {
    dados = null;
    $("scWrap").style.display = "none";
    $("scPdfBox").style.display = "none";
    var e = $("scEmpty"); e.style.display = ""; if (txt) e.innerHTML = txt;
    info("", "");
  }

  function onSelInk() {
    var ink = this.getAttribute("data-ink");
    ev("apSelectByInk(" + q(ink) + ")", function (r) {
      if (r && r.indexOf("OK|") === 0) {
        var n = r.substring(3);
        msg(n === "0" ? ("Nada encontrado com a tinta “" + ink + "” (é PDF linkado? aí não dá pra selecionar por dentro).") : (n + " objeto(s) de “" + ink + "” selecionado(s)."), n === "0" ? "warn" : "ok");
      } else msg((r || "").replace(/^ERRO\|/, "Erro: "), "err");
    });
  }

  /* ---------- puxar do XML da OS ---------- */
  function pull() {
    info("puxando…", "");
    ev("apScreenPullOS(" + q($("scOS").value) + ")", function (r) {
      if (!r || r.indexOf("OK|") !== 0) { vazio(); info((r || "sem resposta").replace(/^ERRO\|/, "Erro: "), "err"); return; }
      var payload = r.substring(3);
      rawPayload = payload;
      dados = parse(payload, "OS"); render();
      // guarda no doc tambem (o alvo definitivo e o PDF, via "Gravar no PDF")
      ev("apScreenSave(" + q(encodeURIComponent(payload)) + ")");
    });
  }

  /* ---------- ler do PDF linkado (XMP via Node) ---------- */
  function readPdfXmp(path) {
    if (!window.APPdf) return null;
    var r = window.APPdf.read(path);
    return (r && r.ok) ? r.value : null;   // value null = sem screening
  }

  function readFromPdf() {
    info("procurando PDF linkado…", "");
    ev("apScreenLinkedPDFs()", function (r) {
      if (!r || r.indexOf("OK|") !== 0) { msg((r || "").replace(/^ERRO\|/, "Erro: "), "err"); return; }
      var lista = r.substring(3);
      var paths = lista ? lista.split(RS) : [];
      if (!paths.length) { vazio("Nenhum PDF linkado no documento ativo."); return; }
      var i, achou = null, quem = "";
      for (i = 0; i < paths.length; i++) {
        var v = readPdfXmp(paths[i]);
        if (v) { achou = v; quem = paths[i]; break; }
      }
      if (!achou) {
        vazio("Achei " + paths.length + " PDF(s) linkado(s), mas nenhum tem screening do AlphaPack gravado ainda.");
        $("scPdfPath").value = paths[0];
        return;
      }
      rawPayload = achou;
      dados = parse(achou, "PDF"); render();
      $("scPdfPath").value = quem;
      msg("Screening lido de: " + quem.replace(/^.*[\\\/]/, ""), "ok");
    });
  }

  function pickPdf() {
    try {
      if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
        var r = window.cep.fs.showOpenDialog(false, false, "PDF de destino", "", ["pdf"]);
        if (r && r.data && r.data.length) $("scPdfPath").value = r.data[0];
      }
    } catch (e) { msg("Não consegui abrir o seletor: " + (e.message || e), "err"); }
  }

  function write() {
    if (!rawPayload) { msg("Nada pra gravar — puxe a OS ou leia de um PDF primeiro.", "warn"); return; }
    if (!window.APPdf) { msg("Módulo de gravação não carregou (Node).", "err"); return; }
    var path = ($("scPdfPath").value || "").replace(/^\s+|\s+$/g, "");
    function grava(p) {
      var res = window.APPdf.write(p, encodeURIComponent(rawPayload));
      if (res && res.ok) msg("Screening gravado em " + p.replace(/^.*[\\\/]/, "") + ". Atualize o link na montagem.", "ok");
      else msg("Erro ao gravar: " + ((res && res.err) || "desconhecido"), "err");
    }
    if (path) { grava(path); return; }
    // sem caminho: grava no primeiro PDF linkado
    ev("apScreenLinkedPDFs()", function (r) {
      if (r && r.indexOf("OK|") === 0) {
        var l = r.substring(3), ps = l ? l.split(RS) : [];
        if (ps.length) { $("scPdfPath").value = ps[0]; grava(ps[0]); return; }
      }
      msg("Escolha um PDF de destino (nenhum PDF linkado encontrado).", "warn");
    });
  }

  /* ---------- wire ---------- */
  var b1 = $("btnScPull"); if (b1) b1.addEventListener("click", pull);
  var b2 = $("btnScReadPdf"); if (b2) b2.addEventListener("click", readFromPdf);
  var b3 = $("btnScPick"); if (b3) b3.addEventListener("click", pickPdf);
  var b4 = $("btnScWrite"); if (b4) b4.addEventListener("click", write);
  var sel = $("scSetSel"); if (sel) sel.addEventListener("change", function () { if (dados) render(); });

  aplicarTema();
  checarConexao();
  setInterval(checarConexao, 2000);
  // ao abrir a janela: tenta o doc; se vazio, tenta o PDF linkado
  ev("apScreenLoad()", function (r) {
    var p = (r && r.indexOf("OK|") === 0) ? r.substring(3) : "";
    if (p) { try { p = decodeURIComponent(p); } catch (e) {} rawPayload = p; dados = parse(p, "DOC"); render(); }
    else readFromPdf();
  });
})();

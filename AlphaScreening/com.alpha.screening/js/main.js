/* ============================================================
 * AlphaScreening - painel (Chromium/CEP)
 * Ink Manager + screening por tinta. Grava/le no PDF (XMP via Node).
 * Convencao do host: "OK|<dado>" / "ERRO|<msg>".
 * ============================================================ */
(function () {
  "use strict";

  var cep = window.__adobe_cep__;
  function ev(src, cb) { if (!cep) { if (cb) cb("ERRO|Sem CEP (rode dentro do Illustrator)"); return; } cep.evalScript(src, cb || function () {}); }
  function $(id) { return document.getElementById(id); }
  function q(v) { return JSON.stringify(String(v)); }
  var RS = String.fromCharCode(30), FS = String.fromCharCode(31);

  var dados = null;      // { os, prod, inks:[...], origem }
  var rawPayload = "";
  var filtro = "all";

  function msg(t, tipo) { var e = $("scMsg"); if (e) { e.textContent = t; e.className = "msg " + (tipo || ""); } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"; }); }

  /* ---------- tema + conexao ---------- */
  function aplicarTema() {
    try {
      var c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
      var escuro = ((0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) < 150);
      document.body.className = escuro ? "dark" : "light";
    } catch (e) {}
  }
  function checarConexao() {
    ev("apPing()", function (r) {
      var ok = r && r.indexOf("OK|") === 0;
      $("dot").className = "dot " + (ok ? "ok" : "off");
      $("connLbl").textContent = ok ? (r.split("|")[1] || "sem documento") : "sem Illustrator";
    });
  }

  /* ---------- classificacao / cores ---------- */
  function classe(k) {
    if (String(k.tipo).toLowerCase() === "technical") return "tech";
    if (String(k.book).toLowerCase() === "process") return "process";
    return "spot";
  }
  function tipoLabel(k) {
    var c = classe(k);
    return c === "tech" ? "Técnica" : c === "process" ? "Processo" : "Spot";
  }
  function swatch(k) {
    var n = String(k.nome).toLowerCase();
    if (/black|preto|^k$/.test(n)) return "#141414";
    if (/cyan|ciano|^c$/.test(n)) return "#00aeef";
    if (/magenta|^m$/.test(n)) return "#ec008c";
    if (/yellow|amarel|^y$/.test(n)) return "#ffdd00";
    if (/branco|white|^w$/.test(n)) return "#f2f2f2";
    // spot: hue estavel a partir do nome
    var h = 0, i; for (i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360;
    return "hsl(" + h + ",55%,55%)";
  }

  /* ---------- dados ---------- */
  function parse(payload, origem) {
    var parts = String(payload).split(RS), head = (parts[0] || "").split(FS), inks = [], i;
    for (i = 1; i < parts.length; i++) {
      if (!parts[i]) continue;
      var f = parts[i].split(FS);
      inks.push({ nome: f[0], ang: f[1], lpi: f[2], dot: f[3], tipo: f[4], ref: f[5], dual: f[6] === "1", base: f[7], book: f[8] || "" });
    }
    return { os: head[0] || "", prod: head[1] || "", inks: inks, origem: origem || "" };
  }
  function temDual(nome) { var i; for (i = 0; i < dados.inks.length; i++) if (dados.inks[i].dual && dados.inks[i].base === nome) return true; return false; }
  function passaFiltro(k) {
    if (filtro === "all") return true;
    if (filtro === "dual") return k.dual;
    if (filtro === "process") return classe(k) === "process";
    if (filtro === "spot") return classe(k) === "spot" || classe(k) === "tech";
    return true;
  }

  /* ---------- render ---------- */
  function render() {
    var body = $("scBody"); body.innerHTML = "";
    var i, mostrados = 0;
    for (i = 0; i < dados.inks.length; i++) {
      var k = dados.inks[i];
      if (!passaFiltro(k)) continue;
      mostrados++;
      var tr = document.createElement("tr");
      if (k.dual) tr.className = "dual";
      tr.setAttribute("data-ink", k.nome);
      var cls = classe(k);
      var dual = k.dual ? "<span class='dual-arrow'>&rarr; " + esc(k.base) + "</span>"
                        : (temDual(k.nome) ? "<span class='dual-tag'>##</span>" : "");
      var ref = k.ref ? "<div class='ink-ref'>" + esc(k.ref) + "</div>" : "";
      tr.innerHTML =
        "<td><span class='sw' style='background:" + swatch(k) + "'></span></td>" +
        "<td><div class='ink-name'>" + esc(k.nome) + "</div>" + ref + "</td>" +
        "<td><span class='type-badge " + cls + "'>" + esc(tipoLabel(k)) + "</span></td>" +
        "<td class='num'>" + esc(k.ang) + "°</td>" +
        "<td class='num'>" + esc(k.lpi) + "</td>" +
        "<td class='dot-cell'>" + esc(k.dot) + "</td>" +
        "<td style='text-align:center'>" + dual + "</td>";
      tr.addEventListener("click", onRow);
      body.appendChild(tr);
    }
    var nd = 0; for (i = 0; i < dados.inks.length; i++) if (dados.inks[i].dual) nd++;
    var fonte = dados.origem === "PDF" ? "PDF linkado" : dados.origem === "OS" ? "XML da OS" : "arquivo";
    var ib = $("scInfo");
    ib.style.display = ""; ib.innerHTML =
      "<b>OS " + esc(dados.os) + "</b>" + (dados.prod ? " · " + esc(dados.prod) : "") +
      " · " + dados.inks.length + " tintas" + (nd ? " · <b>" + nd + " dual ##</b>" : "") + " · " + fonte;
    $("scFilters").style.display = "";
    $("scWrap").style.display = "";
    $("scEmpty").style.display = "none";
    $("scPdfBox").style.display = "";
  }

  function vazio(txt) {
    dados = null; rawPayload = "";
    $("scWrap").style.display = "none";
    $("scFilters").style.display = "none";
    $("scInfo").style.display = "none";
    $("scPdfBox").style.display = "none";
    var e = $("scEmpty"); e.style.display = "";
    if (txt) e.innerHTML = "<div class='empty-ico'>◔</div><p>" + txt + "</p>";
  }

  /* ---------- clique na linha = selecionar a tinta ---------- */
  function onRow() {
    var ink = this.getAttribute("data-ink"), tr = this;
    var all = $("scBody").querySelectorAll("tr"), i;
    for (i = 0; i < all.length; i++) all[i].classList.remove("sel");
    tr.classList.add("sel");
    ev("apSelectByInk(" + q(ink) + ")", function (r) {
      if (r && r.indexOf("OK|") === 0) {
        var n = r.substring(3);
        msg(n === "0" ? ("Nada em “" + ink + "” (PDF linkado não dá pra selecionar por dentro).") : (n + " objeto(s) de “" + ink + "” selecionado(s)."), n === "0" ? "warn" : "ok");
      } else msg((r || "").replace(/^ERRO\|/, "Erro: "), "err");
    });
  }

  /* ---------- puxar OS ---------- */
  function pull() {
    msg("puxando…", "");
    ev("apScreenPullOS(" + q($("scOS").value) + ")", function (r) {
      if (!r || r.indexOf("OK|") !== 0) { vazio("<b>" + esc((r || "sem resposta").replace(/^ERRO\|/, "")) + "</b>"); return; }
      rawPayload = r.substring(3);
      dados = parse(rawPayload, "OS"); render();
      ev("apScreenSave(" + q(encodeURIComponent(rawPayload)) + ")");
      msg("Screening carregado do XML da OS.", "ok");
    });
  }

  /* ---------- ler do PDF linkado ---------- */
  function readFromPdf(silencioso) {
    ev("apScreenLinkedPDFs()", function (r) {
      if (!r || r.indexOf("OK|") !== 0) { if (!silencioso) msg((r || "").replace(/^ERRO\|/, "Erro: "), "err"); return; }
      var lista = r.substring(3), paths = lista ? lista.split(RS) : [];
      if (!paths.length) { if (!silencioso) vazio("<b>Nenhum PDF linkado</b> no documento ativo."); return; }
      var i, achou = null, quem = "";
      for (i = 0; i < paths.length; i++) {
        var res = window.APPdf ? window.APPdf.read(paths[i]) : null;
        if (res && res.ok && res.value) { achou = res.value; quem = paths[i]; break; }
      }
      if (!achou) { if (!silencioso) vazio("Achei " + paths.length + " PDF(s) linkado(s), mas <b>nenhum tem screening gravado</b> ainda."); return; }
      rawPayload = achou; dados = parse(achou, "PDF"); render();
      $("scPdfPath").value = quem;
      msg("Lido de: " + quem.replace(/^.*[\\\/]/, ""), "ok");
    });
  }

  function pickPdf() {
    try {
      if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
        var r = window.cep.fs.showOpenDialog(false, false, "PDF de destino", "", ["pdf"]);
        if (r && r.data && r.data.length) $("scPdfPath").value = r.data[0];
      }
    } catch (e) { msg("Seletor indisponível: " + (e.message || e), "err"); }
  }

  /* ---------- casar tinta do XML <-> colorante do PDF ---------- */
  function decodePdfName(n) { return String(n).replace(/#([0-9A-Fa-f]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); }); }
  function normKey(name) {
    var s = String(name).toLowerCase();
    var dual = /^##/.test(s);
    s = s.replace(/^##/, "").replace(/^\/\//, "").replace(/pantone/g, "").replace(/\bc\b/g, "").replace(/[\s_]+/g, "");
    return (dual ? "##" : "") + s;
  }

  /* ---------- gravar no PDF (halftone + XMP) ---------- */
  function write() {
    if (!dados || !rawPayload) { msg("Nada pra gravar — puxe a OS ou leia de um PDF.", "warn"); return; }
    if (!window.APPdf || !window.APPdf.writeHalftones) { msg("Módulo de gravação não carregou (Node).", "err"); return; }
    var path = ($("scPdfPath").value || "").replace(/^\s+|\s+$/g, "");
    if (path) { grava(path); return; }
    ev("apScreenLinkedPDFs()", function (r) {
      if (r && r.indexOf("OK|") === 0) { var l = r.substring(3), ps = l ? l.split(RS) : []; if (ps.length) { $("scPdfPath").value = ps[0]; grava(ps[0]); return; } }
      msg("Escolha um PDF de destino.", "warn");
    });
  }

  function grava(p) {
    // 1) casa colorantes do PDF com as tintas do XML
    var colorantes = window.APPdf.readColorants(p);
    var idx = {}, i;
    for (i = 0; i < dados.inks.length; i++) idx[normKey(dados.inks[i].nome)] = dados.inks[i];
    var screens = [], usados = [], semTinta = [];
    for (i = 0; i < colorantes.length; i++) {
      var dec = decodePdfName(colorantes[i]);
      var k = idx[normKey(dec)];
      if (k && k.lpi && k.ang) {
        screens.push({ name: colorantes[i], freq: parseInt(k.lpi, 10), angle: parseInt(k.ang, 10), dot: (k.dot || "C") });
        usados.push(dec + " (" + k.ang + "°/" + k.lpi + "/" + k.dot + ")");
      } else semTinta.push(dec);
    }
    if (!screens.length) { msg("Nenhum colorante do PDF casou com as tintas da OS. Colorantes: " + colorantes.join(", "), "warn"); return; }
    // 2) grava halftone + XMP
    var rh = window.APPdf.writeHalftones(p, screens);
    if (!rh || !rh.ok) { msg("Erro no halftone: " + ((rh && rh.err) || "?"), "err"); return; }
    window.APPdf.write(p, encodeURIComponent(rawPayload));
    var extra = semTinta.length ? " · sem screen: " + semTinta.join(", ") : "";
    msg("✓ " + screens.length + " tinta(s) screenada(s) em " + p.replace(/^.*[\\\/]/, "") + extra + ". Ripe pra testar no Automation.", "ok");
  }

  /* ---------- wire ---------- */
  $("btnScPull").addEventListener("click", pull);
  $("btnScReadPdf").addEventListener("click", function () { readFromPdf(false); });
  $("btnScPick").addEventListener("click", pickPdf);
  $("btnScWrite").addEventListener("click", write);
  $("scOS").addEventListener("keydown", function (e) { if (e.keyCode === 13) pull(); });
  var chips = $("scFilters").querySelectorAll(".chip"), i;
  for (i = 0; i < chips.length; i++) chips[i].addEventListener("click", function () {
    var cs = $("scFilters").querySelectorAll(".chip"), j;
    for (j = 0; j < cs.length; j++) cs[j].classList.remove("active");
    this.classList.add("active"); filtro = this.getAttribute("data-f");
    if (dados) render();
  });

  aplicarTema();
  checarConexao();
  setInterval(checarConexao, 2200);
  // ao abrir: doc XMP -> senao PDF linkado -> senao vazio
  ev("apScreenLoad()", function (r) {
    var p = (r && r.indexOf("OK|") === 0) ? r.substring(3) : "";
    if (p) { try { p = decodeURIComponent(p); } catch (e) {} rawPayload = p; dados = parse(p, "DOC"); render(); }
    else readFromPdf(true);
  });
})();

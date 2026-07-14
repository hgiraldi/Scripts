/* ============================================================
 * AlphaPack - orquestracao do painel (Chromium/CEP, ES6 ok)
 * Fala com o host JSX via window.__adobe_cep__.evalScript.
 * Convencao de retorno do host: "OK|<dado>" ou "ERRO|<msg>".
 * ============================================================ */
(function () {
  "use strict";

  var cep = window.__adobe_cep__;
  function evalScript(src, cb) {
    if (!cep) { if (cb) cb("ERRO|Sem CEP (rode dentro do Illustrator)"); return; }
    cep.evalScript(src, cb || function () {});
  }
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function q(v) { return JSON.stringify(String(v)); }   // string segura p/ evalScript

  /* ---------- tema ---------- */
  function aplicarTema() {
    try {
      var c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
      var escuro = ((0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) < 150);
      document.body.classList.toggle("ap-light", !escuro);
      document.body.classList.toggle("ap-dark", escuro);
    } catch (e) {}
  }

  /* ---------- banner de status ---------- */
  var bannerTimer = null;
  function banner(txt, tipo) {
    var b = $("banner");
    b.textContent = txt;
    b.className = "banner show " + (tipo || "");
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.className = "banner " + (tipo || ""); }, 4200);
  }
  function setMsg(id, txt, tipo) {
    var el = $(id); if (!el) return;
    el.textContent = txt; el.className = "msg " + (tipo || "");
  }

  /* ---------- abas ---------- */
  var tabs = document.querySelectorAll(".tab");
  var i;
  for (i = 0; i < tabs.length; i++) {
    on(tabs[i], "click", function () {
      var alvo = this.getAttribute("data-tab");
      var t;
      // Screening abre a JANELA separada (extensao Modeless), nao troca de pane
      if (alvo === "screen") {
        try { cep.requestOpenExtension("com.alpha.pack.screen", ""); }
        catch (e) { banner("Não consegui abrir a janela de Screening: " + (e.message || e), "err"); }
        return;
      }
      var all = document.querySelectorAll(".tab");
      for (t = 0; t < all.length; t++) all[t].classList.remove("active");
      this.classList.add("active");
      var panes = document.querySelectorAll(".pane");
      for (t = 0; t < panes.length; t++) panes[t].classList.remove("active");
      $("pane-" + alvo).classList.add("active");
    });
  }

  /* ---------- conexao ---------- */
  function checarConexao() {
    evalScript("apPing()", function (r) {
      var ok = r && r.indexOf("OK|") === 0;
      $("dot").className = "dot " + (ok ? "ok" : "off");
      if (ok) {
        var p = r.split("|");
        $("connLbl").textContent = p[1] ? p[1] : "sem documento";
      } else {
        $("connLbl").textContent = "sem Illustrator";
      }
    });
  }

  /* ---------- helper de botao ocupado ---------- */
  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.dataset.txt = btn.dataset.txt || btn.textContent;
    btn.textContent = on ? "processando..." : btn.dataset.txt;
  }

  /* ================= TRAPPING ================= */
  on($("btnTrap"), "click", function () {
    var btn = this;
    var trapMm = $("trapMm").value;
    var scope = $("trapScope").value;
    setMsg("trapMsg", "", "");
    busy(btn, true);

    evalScript("apTrapExport(" + q(scope) + ")", function (r) {
      if (!r || r.indexOf("OK|") !== 0) {
        busy(btn, false);
        setMsg("trapMsg", (r || "sem resposta").replace(/^ERRO\|/, "Erro: "), "err");
        return;
      }
      var regionsPayload = r.substring(3);
      var res;
      try {
        res = window.APTrap.compute(regionsPayload, trapMm);
      } catch (e) {
        busy(btn, false);
        setMsg("trapMsg", "Erro no motor: " + (e.message || e), "err");
        return;
      }
      if (!res.payload) {
        busy(btn, false);
        setMsg("trapMsg", res.regioes + " regioes, " + res.pares + " pares adjacentes, nenhuma tira gerada.", "warn");
        banner("Trapping: nada a trapar (0 tiras)", "");
        return;
      }
      evalScript("apTrapApply(" + q(res.payload) + ")", function (r2) {
        busy(btn, false);
        if (r2 && r2.indexOf("OK|") === 0) {
          var n = r2.substring(3);
          setMsg("trapMsg", n + " tira(s) desenhada(s) na layer 'AlphaPack Trap' (de " + res.regioes + " regioes).", "ok");
          banner("Trapping OK: " + n + " tiras", "ok");
        } else {
          setMsg("trapMsg", (r2 || "sem resposta").replace(/^ERRO\|/, "Erro ao aplicar: "), "err");
        }
      });
    });
  });

  /* ================= BARCODE ================= */
  on($("btnBarcode"), "click", function () {
    var btn = this;
    var code = $("bcCode").value, mag = $("bcMag").value, bwr = $("bcBwr").value,
        h = $("bcHeight").value, ink = $("bcInk").value;
    busy(btn, true);
    setMsg("bcMsg", "", "");
    var call = "apBarcodeEAN(" + q(code) + "," + q(mag) + "," + q(bwr) + "," + q(h) + "," + q(ink) + ")";
    evalScript(call, function (r) {
      busy(btn, false);
      if (r && r.indexOf("OK|") === 0) {
        setMsg("bcMsg", "Gerado EAN-13: " + r.substring(3), "ok");
        banner("Barcode " + r.substring(3) + " criado", "ok");
      } else {
        setMsg("bcMsg", (r || "sem resposta").replace(/^ERRO\|/, "Erro: "), "err");
      }
    });
  });

  /* ================= WHITE ================= */
  on($("btnWhite"), "click", function () {
    var btn = this;
    var choke = $("wChoke").value, spot = $("wSpot").value, over = $("wOver").checked ? "1" : "0";
    busy(btn, true);
    setMsg("wMsg", "", "");
    var call = "apWhiteUnderprint(" + q(choke) + "," + q(spot) + "," + q(over) + ")";
    evalScript(call, function (r) {
      busy(btn, false);
      if (r && r.indexOf("OK|") === 0) {
        setMsg("wMsg", "Chapa de branco criada (" + r.substring(3) + " itens) na layer 'AlphaPack White'.", "ok");
        banner("White underprint OK", "ok");
      } else {
        setMsg("wMsg", (r || "sem resposta").replace(/^ERRO\|/, "Erro: "), "err");
      }
    });
  });

  /* ---------- init ---------- */
  aplicarTema();
  checarConexao();
  setInterval(checarConexao, 1800);
})();

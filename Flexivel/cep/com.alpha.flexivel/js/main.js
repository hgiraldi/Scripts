/* ============================================================
 * Ondulado - painel CEP
 * Shim MINIMO do CEP (window.__adobe_cep__): evalScript + getHostEnvironment.
 * - operacoes vem do operacoes.json NA REDE (host.lerConfig) -> nao reinstala
 *   o painel pra adicionar/editar operacao.
 * - cada operacao e SELECIONAVEL (check verde Alpha); o botao Executar roda a
 *   selecionada. Conexao AUTOMATICA (bolinha verde/vermelha).
 * ============================================================ */
(function () {
  "use strict";

  var cep = window.__adobe_cep__;

  function evalScript(src, cb) {
    if (!cep) { if (cb) cb("__SEM_CEP__"); return; }
    cep.evalScript(src, cb || function () {});
  }
  function q(s) { return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"; }

  // ---- tema: segue o skin do Illustrator (claro/escuro) via classe alpha-dark ----
  function aplicarTema() {
    var escuro = true;
    try {
      var c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
      escuro = ((0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) < 150);
    } catch (e) {}
    document.body.classList.toggle("alpha-dark", escuro);
  }

  var ICON = {
    // Ondulado
    label:   '<svg viewBox="0 0 24 24"><path d="M4 7h9l6 5-6 5H4z"/><circle cx="7.5" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
    regua:   '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="1"/><path d="M7 9v3M11 9v3M15 9v3"/></svg>',
    header:  '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="4" rx="1" fill="currentColor" stroke="none"/><path d="M4 13h16M4 17h11"/></svg>',
    faca:    '<svg viewBox="0 0 24 24"><path d="M4 15h2M8 15h2M12 15h2M16 15h2"/><path d="M8 5h7l-3.5 6z" fill="currentColor" stroke="none"/></svg>',
    etiqueta:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="11" height="15" rx="1"/><path d="M7 8h6M7 11h4"/><path d="M7 15v3M9 15v3M11 15v3M13 15v3"/></svg>',
    // Flexivel
    montagem: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>',
    montdist: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><path d="M4 18c4-5 8 5 12 0"/></svg>',
    distorcao:'<svg viewBox="0 0 24 24"><path d="M5 7c5-4 9 4 14 0v10c-5 4-9-4-14 0z"/></svg>',
    numeros:  '<svg viewBox="0 0 24 24"><path d="M6 8h2v9M5 17h5"/><path d="M13 8h3v4h-3v5h3"/></svg>',
    planta:   '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 11h7v9M11 4v7h9"/></svg>',
    uteis:    '<svg viewBox="0 0 24 24"><path d="M15.5 6.5a3.2 3.2 0 0 1-4 4l-5 5 1.5 1.5 5-5a3.2 3.2 0 0 0 4-4z"/></svg>',
    micro:    '<svg viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><circle cx="7" cy="7" r="1.3"/><circle cx="12" cy="7" r="1.3"/><circle cx="17" cy="7" r="1.3"/><circle cx="7" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="17" cy="12" r="1.3"/><circle cx="7" cy="17" r="1.3"/><circle cx="12" cy="17" r="1.3"/><circle cx="17" cy="17" r="1.3"/></g></svg>',
    box:      '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>'
  };
  var CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  var OPS_PADRAO = [
    { tipo: "label",    nome: "Label Alpha",             desc: "Aplica a etiqueta/label padrão Alpha.", arq: "2_Label_Alpha.jsx" },
    { tipo: "regua",    nome: "Medição Ondulado",        desc: "Gera as medidas das placas.",           arq: "10_Medicao_Ondulado.jsx" },
    { tipo: "header",   nome: "Preenchimento Cabeçalho", desc: "Preenche os campos do cabeçalho.",      arq: "13_Preenchimento_Penha.jsx" },
    { tipo: "faca",     nome: "Risco Poliéster",         desc: "Gera o risco/faca em poliéster.",        arq: "14_Risco_Faca.jsx" },
    { tipo: "etiqueta", nome: "Gerar Etiquetas",         desc: "Gera as etiquetas empilhadas.",          arq: "12_Gerar_Etiquetas.jsx" }
  ];

  var osInput, statusEl, dotEl, connLblEl, opsEl, execBtn;
  var selecionada = null, selEl = null;

  function setStatus(msg, cls) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (cls ? " " + cls : "");
  }
  function osValido() { return /^[0-9]{7}$/.test(osInput.value); }

  function selecionar(op, el) {
    if (selEl) selEl.classList.remove("sel");
    selEl = el; selecionada = op;
    el.classList.add("sel");
    execBtn.disabled = false;
    setStatus("");
  }

  function montarOps(lista) {
    opsEl.innerHTML = "";
    selecionada = null; selEl = null; execBtn.disabled = true;
    lista.forEach(function (op) {
      var el = document.createElement("div");
      el.className = "op";
      el.innerHTML =
        '<div class="ico">' + (ICON[op.tipo] || ICON.faca) + '</div>' +
        '<div class="meta"><div class="name">' + op.nome + '</div>' +
        '<div class="desc">' + (op.desc || "") + '</div></div>' +
        '<span class="check">' + CHECK + '</span>';
      el.addEventListener("click", function () { selecionar(op, el); });
      opsEl.appendChild(el);
    });
    setTimeout(ajustarLargura, 40);
  }

  // largura dinamica: se as operacoes nao couberem na ALTURA disponivel, liga a
  // 2a coluna (.cols2 -> column-wrap) e o painel DOBRA de largura. Cabendo em 1
  // coluna, volta ao normal. (resizeContent vale p/ painel FLUTUANTE; acoplado,
  // o operador arrasta a borda e a 2a coluna aparece.)
  function ajustarLargura() {
    try {
      opsEl.classList.remove("cols2");
      var precisa2 = opsEl.scrollHeight > opsEl.clientHeight + 4;
      if (precisa2) opsEl.classList.add("cols2");
      if (cep && typeof cep.resizeContent === "function") {
        cep.resizeContent(precisa2 ? 588 : 300, window.innerHeight || 760);
      }
    } catch (e) {}
  }
  window.addEventListener("resize", function () { setTimeout(ajustarLargura, 60); });

  function executar() {
    if (!selecionada) return;
    if (!osValido()) { setStatus("Informe a O.S. (7 dígitos).", "err"); osInput.focus(); return; }
    execBtn.disabled = true;
    execBtn.classList.add("loading");
    execBtn.textContent = "Executando…";
    setStatus("Executando " + selecionada.nome + "…");
    evalScript("rodarOperacao(" + q(selecionada.arq) + "," + q(osInput.value) + ")", function (ret) {
      execBtn.classList.remove("loading");
      execBtn.textContent = "Executar";
      execBtn.disabled = false;
      if (ret === "__SEM_CEP__") { setStatus("Painel fora do Illustrator (sem CEP).", "err"); return; }
      if (ret && ret.indexOf("ERRO:") === 0) { setStatus(ret, "err"); return; }
      setStatus(selecionada.nome + " — concluído.", "ok");
    });
  }

  function parseOps(txt) {
    if (!txt || txt === "__SEM_CEP__" || txt.indexOf("ERRO:") === 0) return null;
    try { var o = JSON.parse(txt); if (o && o.operacoes && o.operacoes.length) return o.operacoes; } catch (e) {}
    return null;
  }

  // Camadas: 1) operacoes.json da REDE (editavel sem reinstalar) ->
  //          2) operacoes.json BUNDLADO (default que veio no painel) ->
  //          3) lista embutida (ultimo fallback).
  function carregarOperacoes() {
    evalScript("lerConfig()", function (ret) {
      var rede = parseOps(ret);
      if (rede) { montarOps(rede); return; }      // 1) rede
      carregarBundlado();                          // 2) e 3)
    });
  }

  function carregarBundlado() {
    var feito = false;
    function usar(lista) { if (feito) return; feito = true; montarOps(lista); }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "./operacoes.json", true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        usar(parseOps(xhr.responseText) || OPS_PADRAO);
      };
      xhr.onerror = function () { usar(OPS_PADRAO); };
      xhr.send();
      setTimeout(function () { usar(OPS_PADRAO); }, 1500);
    } catch (e) { usar(OPS_PADRAO); }
  }

  // IPs das redes que precisam estar conectadas (ajuste aqui se mudar).
  var SCRIPTS_IP = "192.168.1.15"; // servidor dos scripts/operacoes
  var ENGINE_IP  = "192.168.1.96"; // servidor Engine

  // checa se um host responde na porta 445 (SMB) com TIMEOUT, via Node. Roda no
  // processo do PAINEL (nao na thread do Illustrator) -> NUNCA trava/crasha o
  // Illustrator, mesmo se o IP estiver errado ou o servidor caido.
  function checkHost(ip, cb) {
    try {
      var net = require("net");
      var s = new net.Socket();
      var feito = false;
      function fim(ok) { if (feito) return; feito = true; try { s.destroy(); } catch (e) {} cb(ok); }
      s.setTimeout(1800);
      s.once("connect", function () { fim(true); });
      s.once("timeout", function () { fim(false); });
      s.once("error",   function () { fim(false); });
      s.connect(445, ip);
    } catch (e) { cb(false); } // sem Node -> nao quebra, so nao confirma
  }

  // verde se as DUAS redes respondem; vermelho avisando QUAL caiu.
  function checarConexao() {
    checkHost(SCRIPTS_IP, function (scriptsOk) {
      checkHost(ENGINE_IP, function (engineOk) {
        if (scriptsOk && engineOk) {
          dotEl.className = "dot on";
          connLblEl.textContent = "conectado às redes";
          return;
        }
        var faltam = [];
        if (!scriptsOk) faltam.push("Scripts (" + SCRIPTS_IP + ")");
        if (!engineOk)  faltam.push("Engine (" + ENGINE_IP + ")");
        dotEl.className = "dot off";
        connLblEl.textContent = "sem conexão: " + faltam.join(" e ");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    aplicarTema();
    osInput   = document.getElementById("os");
    statusEl  = document.getElementById("status");
    dotEl     = document.getElementById("dot");
    connLblEl = document.getElementById("connLbl");
    opsEl     = document.getElementById("ops");
    execBtn   = document.getElementById("exec");

    osInput.addEventListener("input", function () {
      var limpo = osInput.value.replace(/[^0-9]/g, "").slice(0, 7);
      if (osInput.value !== limpo) osInput.value = limpo;
      setStatus("");
    });
    execBtn.addEventListener("click", executar);

    carregarOperacoes();
    checarConexao();
    setInterval(checarConexao, 5000);
    osInput.focus();
  });
})();

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
    box:      '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>',
    // Geral (CheckList / Cotas)
    checklist:'<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="1.5"/><path d="M9 3.2h6V6H9z" fill="currentColor" stroke="none"/><path d="M8.6 11l1.4 1.4 2.6-2.6M8.6 15.6l1.4 1.4 2.6-2.6"/></svg>',
    cotas:    '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 5v4M20 5v4"/><path d="M7 14h10M7 12v4M17 12v4"/></svg>'
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
  var ocupado = false; // true enquanto uma operacao roda -> NAO checa rede (evita
                       // que o evalScript do poll colida com dialogos do script)

  // ---- banner de mensagem (o script dispara via evento CEP; o painel mostra) ----
  // Evita janelas ScriptUI do Illustrator (que entram em loop pelo CEP).
  var bannerEl, bannerTxt, bannerTimer = null;
  function montarBanner() {
    if (bannerEl) return;
    bannerEl = document.createElement("div");
    bannerEl.className = "banner hidden";
    bannerTxt = document.createElement("span");
    bannerTxt.className = "banner-txt";
    var x = document.createElement("button");
    x.className = "banner-x"; x.innerHTML = "&times;";
    x.addEventListener("click", esconderBanner);
    bannerEl.appendChild(bannerTxt);
    bannerEl.appendChild(x);
    document.body.appendChild(bannerEl);
  }
  function esconderBanner() {
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
    if (bannerEl) bannerEl.classList.add("hidden");
  }
  // data = "tipo|texto". info some sozinho (5s); erro fica fixo (fecha no x).
  function mostrarBanner(data) {
    montarBanner();
    var s = String(data || ""), tipo = "info", texto = s, bar = s.indexOf("|");
    if (bar > -1) { tipo = s.substring(0, bar); texto = s.substring(bar + 1); }
    bannerTxt.textContent = texto;
    bannerEl.className = "banner " + (tipo === "erro" ? "erro" : "info");
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
    if (tipo !== "erro") bannerTimer = setTimeout(esconderBanner, 5000);
  }

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

  function criarOpEl(op) {
    var el = document.createElement("div");
    el.className = "op";
    el.innerHTML =
      '<div class="ico">' + (ICON[op.tipo] || ICON.faca) + '</div>' +
      '<div class="meta"><div class="name">' + op.nome + '</div>' +
      '<div class="desc">' + (op.desc || "") + '</div></div>' +
      '<span class="check">' + CHECK + '</span>';
    el.addEventListener("click", function () { selecionar(op, el); });
    return el;
  }

  // recebe SECOES: [{ titulo?, operacoes:[...] }]. Cada secao = titulo (largura
  // cheia) + GRADE propria -> a secao nunca se quebra entre colunas.
  function montarSecoes(secoes) {
    opsEl.innerHTML = "";
    selecionada = null; selEl = null; execBtn.disabled = true;
    secoes.forEach(function (sec) {
      if (sec.titulo) {
        var h = document.createElement("div");
        h.className = "sec-title";
        h.textContent = sec.titulo;
        opsEl.appendChild(h);
      }
      var grid = document.createElement("div");
      grid.className = "sec-grid";
      (sec.operacoes || []).forEach(function (op) { grid.appendChild(criarOpEl(op)); });
      opsEl.appendChild(grid);
    });
  }

  function executar() {
    if (!selecionada) return;
    if (!selecionada.semOS && !osValido()) { setStatus("Informe a O.S. (7 dígitos).", "err"); osInput.focus(); return; }
    execBtn.disabled = true;
    execBtn.classList.add("loading");
    execBtn.textContent = "Executando…";
    setStatus("Executando " + selecionada.nome + "…");
    var pasta = selecionada.pasta || "";
    ocupado = true; // pausa o poll de rede enquanto o script roda (dialogos!)
    evalScript("rodarOperacao(" + q(selecionada.arq) + "," + q(osInput.value) + "," + q(pasta) + ")", function (ret) {
      ocupado = false;
      execBtn.classList.remove("loading");
      execBtn.textContent = "Executar";
      execBtn.disabled = false;
      if (ret === "__SEM_CEP__") { setStatus("Painel fora do Illustrator (sem CEP).", "err"); return; }
      if (ret && ret.indexOf("ERRO:") === 0) { setStatus(ret, "err"); return; }
      setStatus(selecionada.nome + " — concluído.", "ok");
    });
  }

  // aceita JSON com "secoes" [{titulo,operacoes}] OU "operacoes" (vira 1 secao).
  function parseConfig(txt) {
    if (!txt || txt === "__SEM_CEP__" || txt.indexOf("ERRO:") === 0) return null;
    try {
      var o = JSON.parse(txt);
      if (o && o.secoes && o.secoes.length) return o.secoes;
      if (o && o.operacoes && o.operacoes.length) return [{ operacoes: o.operacoes }];
    } catch (e) {}
    return null;
  }

  // Render IMEDIATO do bundlado (nao trava no boot). Depois, SE o servidor de
  // scripts responder (TCP), sobrescreve com o operacoes.json da REDE (editavel
  // sem reinstalar). Assim, rede caida no boot nao congela o painel.
  function carregarOperacoes() {
    carregarBundlado();
    checkHost(SCRIPTS_IP, function (ok) {
      if (!ok) return;
      evalScript("lerConfig()", function (ret) {
        var rede = parseConfig(ret);
        if (rede) montarSecoes(rede);
      });
    });
  }

  function carregarBundlado() {
    var feito = false;
    function usar(secoes) { if (feito) return; feito = true; montarSecoes(secoes); }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "./operacoes.json", true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        usar(parseConfig(xhr.responseText) || [{ operacoes: OPS_PADRAO }]);
      };
      xhr.onerror = function () { usar([{ operacoes: OPS_PADRAO }]); };
      xhr.send();
      setTimeout(function () { usar([{ operacoes: OPS_PADRAO }]); }, 1500);
    } catch (e) { usar([{ operacoes: OPS_PADRAO }]); }
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

  function setDot(on, txt) {
    dotEl.className = "dot " + (on ? "on" : "off");
    connLblEl.textContent = txt;
  }

  // 2 etapas: (1) servidores respondem? (TCP, nao trava). (2) se sim, as PASTAS
  // estao acessiveis/montadas? (host -> File.exists no caminho real; rapido pq o
  // servidor ja respondeu). Verde so quando a pasta existe MESMO = o run funciona.
  function checarConexao() {
    if (ocupado) return; // operacao rodando -> nao dispara evalScript (evita loop de dialogo)
    checkHost(SCRIPTS_IP, function (sOk) {
      checkHost(ENGINE_IP, function (eOk) {
        if (!sOk || !eOk) {
          var f = [];
          if (!sOk) f.push("Scripts (" + SCRIPTS_IP + ")");
          if (!eOk) f.push("Engine (" + ENGINE_IP + ")");
          setDot(false, "servidor fora: " + f.join(" e "));
          return;
        }
        if (ocupado) return; // operacao comecou durante o teste TCP -> nao mexe no motor
        evalScript("statusRede()", function (st) {
          if (st === "OK") { setDot(true, "conectado às redes"); return; }
          if (st && st.indexOf("OFF|") === 0) { setDot(false, "pasta não montada: " + st.substring(4)); return; }
          setDot(false, "rede inacessível");
        });
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

    // escuta as mensagens que o script manda (banner). Tipo de evento por-painel
    // (derivado do ID da extensao) p/ Ondulado e Flexivel nao se cruzarem.
    montarBanner();
    try {
      var EVT = "com.alpha.msg";
      if (cep && cep.getExtensionId) EVT = cep.getExtensionId().replace(/\.panel$/, "") + ".msg";
      if (cep && cep.addEventListener) cep.addEventListener(EVT, function (ev) { mostrarBanner(ev && ev.data); });
    } catch (e) {}

    carregarOperacoes();
    checarConexao();
    setInterval(checarConexao, 5000);
    osInput.focus();
  });
})();

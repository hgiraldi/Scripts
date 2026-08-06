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
    cotas:    '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 5v4M20 5v4"/><path d="M7 14h10M7 12v4M17 12v4"/></svg>',
    addcut:   '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 2.5"/></svg>',
    remap:    '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="16" r="3.2"/><path d="M13 6h5v5M11 18H6v-5"/></svg>',
    maleta:   '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="11" rx="1.5"/><path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/></svg>',
    pics:     '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1"/><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none"/><path d="M4 17l5-4 3 2 4-3 4 3"/></svg>',
    codigos:  '<svg viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="1.6"><path d="M4 6v12M7 6v12M10 6v12M13 6v9"/></g><rect x="15" y="13" width="5" height="5" rx="0.6"/><path d="M16.2 14.2h1.2v1.2h-1.2zM4 6h9M4 18h9" stroke="none" fill="currentColor"/></svg>'
  };
  var CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // Fallback EMBUTIDO (ultimo recurso, sem rede e sem operacoes.json bundlado).
  // Tem que ser COMPLETO (Ondulado + Geral): numa maquina onde o operacoes.json
  // da rede nao carrega e o XHR do bundlado estoura o timeout, e ISTO que aparece.
  // Se faltar a secao Geral aqui, "os scripts gerais somem" nessa maquina (bug real).
  var SECOES_PADRAO = [
    { titulo: "Ondulado", operacoes: [
      { tipo: "label",    nome: "Label Alpha",             desc: "Aplica a etiqueta/label padrão Alpha.", arq: "2_Label_Alpha.jsx" },
      { tipo: "regua",    nome: "Medição Ondulado",        desc: "Gera as medidas das placas.",           arq: "10_Medicao_Ondulado.jsx" },
      { tipo: "header",   nome: "Preenchimento Cabeçalho", desc: "Preenche os campos do cabeçalho.",      arq: "13_Preenchimento_Penha.jsx" },
      { tipo: "faca",     nome: "Risco Poliéster",         desc: "Gera o risco/faca em poliéster.",        arq: "14_Risco_Faca.jsx" },
      { tipo: "etiqueta", nome: "Gerar Etiquetas",         desc: "Gera as etiquetas empilhadas.",          arq: "12_Gerar_Etiquetas.jsx" },
      { tipo: "codigos",  nome: "Relatório de Códigos",    desc: "Lê os códigos selecionados e gera o laudo PDF.", arq: "15_Relatorio_Codigos.jsx" }
    ] },
    { titulo: "Geral", operacoes: [
      { tipo: "addcut",    nome: "Add Cut",         desc: "Cria as margens de corte (cut).",                 arq: "AddCut.jsx",          pasta: "modulo", semOS: true },
      { tipo: "remap",     nome: "Remapear Cores",  desc: "Remapeia/normaliza as cores do documento.",       arq: "RemapCores.jsx",      pasta: "modulo", semOS: true },
      { tipo: "checklist", nome: "CheckList",       desc: "Validação + XML do job (usa a O.S. do painel).",  arq: "CheckList.jsx",       pasta: "raiz" },
      { tipo: "cotas",     nome: "Cotas Alpha",     desc: "Gera as cotas do documento. Não precisa de O.S.", arq: "Cotas_Alpha.jsx",     pasta: "raiz",   semOS: true },
      { tipo: "maleta",    nome: "Ondulado Maleta", desc: "Faca de maleta a partir das entradas (mm).",      arq: "Ondulado_Maleta.jsx", pasta: "modulo", semOS: true },
      { tipo: "pics",      nome: "PICS",            desc: "Gera os PICS (usa a O.S. do painel).",            arq: "PICS.jsx",            pasta: "modulo" }
    ] }
  ];

  var osInput, statusEl, dotEl, connLblEl, opsEl, execBtn;
  var selecionada = null, selEl = null;
  var ocupado = false; // true enquanto uma operacao roda -> NAO checa rede (evita
                       // que o evalScript do poll colida com dialogos do script)

  // ---- banner de mensagem (o script dispara via evento CEP; o painel mostra) ----
  // Evita janelas ScriptUI do Illustrator (que entram em loop pelo CEP).
  var bannerEl, bannerTxt, bannerIco, bannerTimer = null;
  function montarBanner() {
    if (bannerEl) return;
    bannerEl = document.createElement("div");
    bannerEl.className = "banner hidden";
    bannerIco = document.createElement("span");
    bannerIco.className = "banner-ico";
    bannerTxt = document.createElement("span");
    bannerTxt.className = "banner-txt";
    var x = document.createElement("button");
    x.className = "banner-x"; x.innerHTML = "&times;";
    x.addEventListener("click", esconderBanner);
    bannerEl.appendChild(bannerIco);
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
    var erro = (tipo === "erro");
    bannerIco.innerHTML = erro ? "&#9888;" : "&#10003;"; // ⚠ erro / ✓ sucesso
    bannerTxt.textContent = texto;
    bannerEl.className = "banner " + (erro ? "erro" : "info");
    // re-dispara a animacao de entrada mesmo se o banner ja estava na tela
    if (bannerEl.style) { bannerEl.style.animation = "none"; void bannerEl.offsetWidth; bannerEl.style.animation = ""; }
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
    if (!erro) bannerTimer = setTimeout(esconderBanner, 5000); // erro fica fixo (fecha no x)
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
    if (ocupado) return; // nao re-entra enquanto uma operacao roda
    if (!selecionada.semOS && !osValido()) { setStatus("Informe a O.S. (7 dígitos).", "err"); osInput.focus(); return; }
    execBtn.disabled = true;
    execBtn.classList.add("loading");
    execBtn.textContent = "Executando…";
    setStatus("Executando " + selecionada.nome + "…");
    var pasta = selecionada.pasta || "";
    var token = String(Date.now()); // token unico deste clique (anti re-execucao do CEP)
    ocupado = true; // pausa o poll de rede enquanto o script roda (dialogos!)
    evalScript("rodarOperacao(" + q(selecionada.arq) + "," + q(osInput.value) + "," + q(pasta) + "," + q(token) + ")", function (ret) {
      ocupado = false;
      execBtn.classList.remove("loading");
      execBtn.textContent = "Executar";
      execBtn.disabled = false;
      if (ret === "__SEM_CEP__") { mostrarBanner("erro|Painel fora do Illustrator (sem CEP)."); setStatus("Sem CEP.", "err"); return; }
      if (ret && ret.indexOf("ERRO:") === 0) {
        var txtErr = ret.replace(/^ERRO:\s*/, "");
        mostrarBanner("erro|" + txtErr); setStatus(txtErr, "err"); return;
      }
      // o script pode devolver uma msg: "OK|tipo|texto". erro -> banner vermelho fixo;
      // sucesso/info -> banner verde (some em 5s). Sem modal (evita o alert que loopa).
      if (ret && ret.indexOf("OK|") === 0) {
        var msg = ret.substring(3), bar = msg.indexOf("|");
        var tipo = bar > -1 ? msg.substring(0, bar) : "info";
        var texto = bar > -1 ? msg.substring(bar + 1) : msg;
        // O 15_Relatorio_Codigos.jsx devolve "__CODIGOS__<manifest.json>": o JSX
        // ja capturou os codigos em PNG; agora o PAINEL decodifica e gera o PDF.
        if (texto && texto.indexOf("__CODIGOS__") === 0) {
          gerarRelatorioCodigos(texto.substring("__CODIGOS__".length));
          return;
        }
        if (tipo === "erro") { mostrarBanner("erro|" + texto); setStatus(texto, "err"); return; }
        if (texto) { mostrarBanner("info|" + texto); setStatus(texto, "ok"); return; }
      }
      mostrarBanner("info|" + selecionada.nome + " concluído.");
      setStatus(selecionada.nome + " — concluído.", "ok");
    });
  }

  // Relatorio de Codigos: o JSX capturou os codigos em PNG e escreveu o manifest;
  // aqui decodificamos (ZXing/jsQR) e geramos o PDF na pasta _pdf do job. Toda a
  // parte pesada roda no processo do PAINEL (nao trava o Illustrator). Sem modal.
  function gerarRelatorioCodigos(manifestPath) {
    if (typeof AlphaCodigos === "undefined" || !AlphaCodigos.gerar) {
      mostrarBanner("erro|Módulo de leitura de códigos não carregou (reinstale o painel).");
      setStatus("Módulo de códigos ausente.", "err");
      return;
    }
    setStatus("Lendo os códigos…");
    mostrarBanner("info|Lendo os códigos e gerando o relatório…");
    AlphaCodigos.gerar(manifestPath, function (txt) { setStatus(txt); })
      .then(function (res) {
        var resumo = res.lidos + "/" + res.total + " lido(s) · " + (res.aprovado ? "APROVADO" : "REPROVADO");
        var onde = res.arquivo.replace(/^.*[\\\/]/, "");
        var tudoOk = res.aprovado && !res.aviso;
        var texto = "Relatório gerado: " + onde + " — " + resumo + (res.aviso ? " (" + res.aviso + ")" : "");
        mostrarBanner((tudoOk ? "info|" : "erro|") + texto);
        setStatus(texto, tudoOk ? "ok" : "err");
      })
      .catch(function (e) {
        var m = (e && e.message) ? e.message : String(e);
        mostrarBanner("erro|Falha ao gerar o relatório de códigos: " + m);
        setStatus("Falha: " + m, "err");
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
  function lerOperacoesRede() {
    evalScript("lerConfig()", function (ret) {
      var rede = parseConfig(ret);
      if (rede) montarSecoes(rede);
    });
  }
  function carregarOperacoes() {
    carregarBundlado();
    // Mac: o teste TCP por IP nao e confiavel (monta por nome) -> le a rede DIRETO,
    // senao o painel fica so no operacoes.json empacotado (sem o Geral).
    if (IS_MAC) { lerOperacoesRede(); return; }
    checkAny(SCRIPTS_IPS, function (ip) {
      if (!ip) return;
      evalScript("setRedeIps(" + q(ip) + ",'')"); // le o operacoes.json da rede que respondeu
      lerOperacoesRede();
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
        usar(parseConfig(xhr.responseText) || SECOES_PADRAO);
      };
      xhr.onerror = function () { usar(SECOES_PADRAO); };
      xhr.send();
      // teto so pra nao ficar em branco se o XHR local travar. Folga maior (4s) pra
      // maquina lenta nao commitar o embutido antes do operacoes.json bundlado chegar.
      setTimeout(function () { usar(SECOES_PADRAO); }, 4000);
    } catch (e) { usar(SECOES_PADRAO); }
  }

  // IPs das redes que precisam estar conectadas (ajuste aqui se mudar).
  // Cada servidor pode estar em DUAS faixas (192.168.1.x e 172.16.11.x) -> testa
  // as duas e usa a que responder. O IP que respondeu e avisado ao host.jsx
  // (setRedeIps) pra ele nao perder tempo com o UNC da rede que nao existe.
  var SCRIPTS_IPS = ["192.168.1.15", "172.16.11.15"]; // servidor dos scripts/operacoes (uteis)
  var ENGINE_IPS  = ["192.168.1.96", "172.16.11.96"]; // servidor Engine
  // No MAC os volumes montam por NOME (nao por IP) e o teste TCP por IP nao da
  // timeout confiavel no Node do CEP -> "verificando" eterno. Entao no Mac pulamos
  // o teste TCP e usamos so a checagem de PASTAS (File.exists local em /Volumes).
  var IS_MAC = /Mac/i.test(navigator.platform);

  // checa se um host responde na porta 445 (SMB) com TIMEOUT, via Node. Roda no
  // processo do PAINEL (nao na thread do Illustrator) -> NUNCA trava/crasha o
  // Illustrator, mesmo se o IP estiver errado ou o servidor caido.
  function checkHost(ip, cb) {
    var tentativa = 0;
    function tentar() {
      tentativa++;
      var feito = false, s = null;
      // timeout RIGIDO em JS: garante o callback mesmo se o socket travar sem disparar
      // evento (acontece no Node do CEP no Mac) -> nunca fica "verificando" pra sempre.
      var hard = setTimeout(function () { fim(false); }, 3500);
      function fim(ok) {
        if (feito) return; feito = true;
        clearTimeout(hard);
        try { if (s) s.destroy(); } catch (e) {}
        if (!ok && tentativa < 2) { tentar(); return; } // 1 retry: evita falso "fora" em rede lenta
        cb(ok);
      }
      try {
        var net = require("net");
        s = new net.Socket();
        s.setTimeout(3000);
        s.once("connect", function () { fim(true); });
        s.once("timeout", function () { fim(false); });
        s.once("error",   function () { fim(false); });
        s.connect(445, ip);
      } catch (e) { fim(false); } // sem Node -> nao confirma
    }
    tentar();
  }

  // testa VARIOS ips ao mesmo tempo e devolve o PRIMEIRO que responder ("" = nenhum).
  // Em paralelo de proposito: em serie, a rede errada gastaria o timeout inteiro
  // antes de tentar a certa (a bolinha ficaria ~15s em "verificando").
  function checkAny(ips, cb) {
    var pendentes = ips.length, feito = false, i;
    function fim(ip) { if (feito) return; feito = true; cb(ip); }
    function testar(ip) {
      checkHost(ip, function (ok) {
        pendentes--;
        if (ok) fim(ip);
        else if (pendentes === 0) fim("");
      });
    }
    if (!pendentes) { cb(""); return; }
    for (i = 0; i < ips.length; i++) { testar(ips[i]); }
  }

  function setDot(on, txt) {
    dotEl.className = "dot " + (on ? "on" : "off");
    connLblEl.textContent = txt;
  }

  // 2 etapas: (1) servidores respondem? (TCP, nao trava). (2) se sim, as PASTAS
  // estao acessiveis/montadas? (host -> File.exists no caminho real; rapido pq o
  // servidor ja respondeu). Verde so quando a pasta existe MESMO = o run funciona.
  function verificarPastas(ipS, ipE) {
    // avisa o host qual IP respondeu (some com a espera do SMB no UNC morto)
    evalScript("setRedeIps(" + q(ipS || "") + "," + q(ipE || "") + ")");
    evalScript("statusRede()", function (st) {
      if (st === "OK") { setDot(true, "conectado às redes"); return; }
      if (st && st.indexOf("OFF|") === 0) { setDot(false, "pasta não montada: " + st.substring(4)); return; }
      setDot(false, "rede inacessível");
    });
  }
  function checarConexao() {
    if (ocupado) return; // operacao rodando -> nao dispara evalScript (evita loop de dialogo)
    if (IS_MAC) {
      // Mac: volumes ja montados em /Volumes. Pula o teste TCP por IP (que trava aqui)
      // e vai direto na checagem de PASTAS -> no Mac e File.exists local, nao trava.
      verificarPastas();
      return;
    }
    checkAny(SCRIPTS_IPS, function (ipS) {
      checkAny(ENGINE_IPS, function (ipE) {
        if (!ipS || !ipE) {
          var f = [];
          if (!ipS) f.push("Scripts (" + SCRIPTS_IPS.join(" / ") + ")");
          if (!ipE) f.push("Engine (" + ENGINE_IPS.join(" / ") + ")");
          setDot(false, "servidor fora: " + f.join(" e "));
          return;
        }
        if (ocupado) return; // operacao comecou durante o teste TCP -> nao mexe no motor
        verificarPastas(ipS, ipE);
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

/* ============================================================
 * Alpha Compare - orquestracao do painel (Chromium/CEP, ES6 ok)
 * ============================================================ */
(function () {
  "use strict";

  var cep = window.__adobe_cep__;
  function evalScript(src, cb) {
    if (!cep) { if (cb) cb("__SEM_CEP__"); return; }
    cep.evalScript(src, cb || function () {});
  }
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  // render de PDF agora é via pdfium (window.ACPdf) — nativo/rápido. Ver lib/pdfium/.
  if (window.ACPdf) ACPdf.init().catch(function () {});   // pré-inicializa o wasm
  // pré-carrega o OCR e GUARDA o erro (diagnóstico: aparece na barra se o OCR não rodar)
  var OCR_INIT_ERR = null;
  if (window.ACOcr) {
    try { ACOcr.init().catch(function (e) { OCR_INIT_ERR = String((e && e.message) || e).slice(0, 120); }); }
    catch (e2) { OCR_INIT_ERR = String((e2 && e2.message) || e2).slice(0, 120); }
  } else { OCR_INIT_ERR = "ACOcr não carregou"; }

  function aplicarTema() {
    var escuro = true;
    try {
      var c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
      escuro = ((0.299 * c.red + 0.587 * c.green + 0.114 * c.blue) < 150);
    } catch (e) {}
    document.body.classList.toggle("alpha-dark", escuro);
  }

  // ---- estado (cada pane guarda rawSrc + rotacao + src rotacionado) ----
  var O = { ids: { stage: "origDrop", canvas: "origCanvas", box: "origCropBox", hint: "#origDrop .drop-hint",
                   info: "origInfo", pdfNav: "origPdfNav", pageLbl: "origPageLbl", input: "origFileInput",
                   prep: "origPrep", prepBtn: "btnOrigPrep" },
            rawSrc: null, src: null, rot: 0, crop: null, fit: null, doc: null, bytes: null, page: 1, pages: 1,
            name: "", _onLoaded: null, hideL: {}, hideC: {} };
  var F = { ids: { stage: "fileDrop", canvas: "fileCanvas", box: "fileCropBox", hint: "#fileHint",
                   info: "fileInfo", pdfNav: "filePdfNav", pageLbl: "filePageLbl", input: "fileFileInput",
                   prep: "filePrep", prepBtn: "btnFilePrep" },
            rawSrc: null, src: null, rot: 0, crop: null, fit: null, doc: null, bytes: null, page: 1, pages: 1,
            name: "", _onLoaded: null, hideL: {}, hideC: {} };
  var RESULT = null, MANUAL = false, DESKTOP = "";
  var REPORT_MAX = 30;   // acima disso o relatorio fica travado (ruido/desalinhamento)
  var WORKRES = 3400;    // resolucao de trabalho (Alta=3400, Media=2800, Rapida=2200)

  function osDigits() { return ($("os").value || "").replace(/\D/g, ""); }

  // ---- conexao + info do doc ----
  function checarConexao() {
    evalScript("acDesktopPath()", function (r) {
      var ok = r && r.indexOf("OK|") === 0;
      $("dot").className = "dot " + (ok ? "ok" : "off");
      $("connLbl").textContent = ok ? "conectado" : "sem Illustrator";
      if (ok) DESKTOP = r.substring(3);
    });
    evalScript("acInfoDoc()", function (r) {
      if (r && r.indexOf("OK|") === 0) {
        var p = r.split("|");
        F.name = p[1] || "";
        if (p[2] && !$("os").value) { $("os").value = p[2]; updateCompareEnabled(); }
        $("jobName").textContent = p[1] || "—";
      }
    });
  }

  // ============ imagem / recorte ============
  function drawFitted(canvasEl, src) {
    var stage = canvasEl.parentElement;
    var W = stage.clientWidth, H = stage.clientHeight;
    canvasEl.width = W; canvasEl.height = H;
    var g = canvasEl.getContext("2d");
    g.clearRect(0, 0, W, H);
    var sc = Math.min(W / src.width, H / src.height);
    var dw = src.width * sc, dh = src.height * sc, ox = (W - dw) / 2, oy = (H - dh) / 2;
    g.imageSmoothingEnabled = true;
    g.drawImage(src, ox, oy, dw, dh);
    return { ox: ox, oy: oy, dw: dw, dh: dh };
  }

  function showPane(pane) {
    if (!pane.src) return;
    var canvasEl = $(pane.ids.canvas);
    canvasEl.style.display = "block";
    var hint = document.querySelector(pane.ids.hint); if (hint) hint.style.display = "none";
    pane.fit = drawFitted(canvasEl, pane.src);
    if (!pane.crop) pane.crop = { x: 0, y: 0, w: 1, h: 1 };
    positionBox(pane);
    $(pane.ids.box).style.display = "block";
    updateCompareEnabled();
    // re-ajusta SEMPRE que o stage muda de tamanho (resultado aparece, "Avançado" abre, etc.)
    // — sem isso a imagem/box deslocavam ao Comparar. ResizeObserver existe no Chrome 88.
    if (!pane._ro && typeof ResizeObserver !== "undefined") {
      pane._ro = new ResizeObserver(function () {
        if (pane.src) { pane.fit = drawFitted($(pane.ids.canvas), pane.src); positionBox(pane); }
      });
      pane._ro.observe($(pane.ids.stage));
    }
  }

  function positionBox(pane) {
    var box = $(pane.ids.box), f = pane.fit, c = pane.crop;
    box.style.left = (f.ox + c.x * f.dw) + "px";
    box.style.top = (f.oy + c.y * f.dh) + "px";
    box.style.width = (c.w * f.dw) + "px";
    box.style.height = (c.h * f.dh) + "px";
  }

  function cropCanvas(pane) {
    var c = pane.crop || { x: 0, y: 0, w: 1, h: 1 };
    var sw = pane.src.width, sh = pane.src.height;
    var x = Math.round(c.x * sw), y = Math.round(c.y * sh);
    var w = Math.max(2, Math.round(c.w * sw)), h = Math.max(2, Math.round(c.h * sh));
    var out = document.createElement("canvas");
    out.width = w; out.height = h;
    out.getContext("2d").drawImage(pane.src, x, y, w, h, 0, 0, w, h);
    return out;
  }

  // define a imagem-fonte de um pane (reseta rotacao/recorte) e dispara _onLoaded
  function setSource(pane, canvas) {
    pane.rawSrc = canvas; pane.rot = 0; pane.src = canvas; pane.crop = null;
    showPane(pane);
    var cb = pane._onLoaded; pane._onLoaded = null;
    if (cb) cb();
  }

  function rotateCanvas(src, deg) {
    if (!deg) return src;
    var w = src.width, h = src.height;
    var c = document.createElement("canvas");
    if (deg === 90 || deg === 270) { c.width = h; c.height = w; } else { c.width = w; c.height = h; }
    var g = c.getContext("2d");
    g.translate(c.width / 2, c.height / 2);
    g.rotate(deg * Math.PI / 180);
    g.drawImage(src, -w / 2, -h / 2);
    return c;
  }

  function rotatePane(pane, deg) {
    if (!pane.rawSrc) return;
    pane.rot = ((pane.rot || 0) + deg + 360) % 360;
    pane.src = rotateCanvas(pane.rawSrc, pane.rot);
    pane.crop = null;
    showPane(pane);
    if (RESULT) scheduleCompare();
  }
  // rect em FRAÇÃO da página crua -> fração do espaço ROTACIONADO (mesmo giro do rotateCanvas)
  function rotFrac(r, rot) {
    if (rot === 90) return { x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w };
    if (rot === 180) return { x: 1 - r.x - r.w, y: 1 - r.y - r.h, w: r.w, h: r.h };
    if (rot === 270) return { x: r.y, y: 1 - r.x - r.w, w: r.h, h: r.w };
    return r;
  }
  function rotFracInv(r, rot) { return rotFrac(r, (360 - (rot || 0)) % 360); }

  // lupa de precisao: mostra ampliado o ponto sob o cursor
  function drawLoupe(pane, cx, cy) {
    var lp = $("loupe");
    if (!pane.src || !pane.fit) { lp.style.display = "none"; return; }
    var r = $(pane.ids.canvas).getBoundingClientRect(), f = pane.fit;
    var u = (cx - r.left - f.ox) / f.dw, v = (cy - r.top - f.oy) / f.dh;
    var sx = u * pane.src.width, sy = v * pane.src.height;
    var LS = 150, Z = 6, span = LS / Z;
    lp.width = LS; lp.height = LS;
    var g = lp.getContext("2d");
    g.fillStyle = "#0c1420"; g.fillRect(0, 0, LS, LS);
    g.imageSmoothingEnabled = false;
    g.drawImage(pane.src, sx - span / 2, sy - span / 2, span, span, 0, 0, LS, LS);
    g.strokeStyle = "rgba(51,174,91,.9)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(LS / 2, 0); g.lineTo(LS / 2, LS); g.moveTo(0, LS / 2); g.lineTo(LS, LS / 2); g.stroke();
    var lx = cx + 20, ly = cy - LS - 20;
    if (lx + LS > window.innerWidth) lx = cx - LS - 20;
    if (ly < 0) ly = cy + 20;
    lp.style.left = lx + "px"; lp.style.top = ly + "px"; lp.style.display = "block";
  }
  function hideLoupe() { $("loupe").style.display = "none"; }

  // recorte: arrasta pra definir (pode começar da margem, de fora pra dentro).
  // clique simples NAO altera. Lupa aparece no hover e durante o arrasto.
  function attachCrop(pane) {
    var stage = $(pane.ids.stage), down = null, moved = false;
    // coords relativas ao CANVAS (não ao stage, que tem borda) — evita deslocamento
    function rel(e) { var r = $(pane.ids.canvas).getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function norm(px, py) {
      var f = pane.fit;
      return { x: Math.max(0, Math.min(1, (px - f.ox) / f.dw)), y: Math.max(0, Math.min(1, (py - f.oy) / f.dh)) };
    }
    on(stage, "mousedown", function (e) {
      if (!pane.src) return;
      // recalcula o fit AGORA (se o layout mudou desde o showPane — ex.: abriu "Avançado"
      // ou redimensionou — o fit ficava velho e o box/recorte deslocavam pra direita).
      pane.fit = drawFitted($(pane.ids.canvas), pane.src);
      positionBox(pane);
      down = rel(e); moved = false; e.preventDefault();
    });
    on(stage, "mousemove", function (e) { if (!down) drawLoupe(pane, e.clientX, e.clientY); });
    on(stage, "mouseleave", function () { if (!down) hideLoupe(); });
    on(window, "mousemove", function (e) {
      if (!down) return;
      drawLoupe(pane, e.clientX, e.clientY);
      var p = rel(e);
      if (!moved && Math.abs(p.x - down.x) + Math.abs(p.y - down.y) < 4) return;
      moved = true;
      var a = norm(Math.min(down.x, p.x), Math.min(down.y, p.y));
      var b = norm(Math.max(down.x, p.x), Math.max(down.y, p.y));
      pane.crop = { x: a.x, y: a.y, w: Math.max(0.02, b.x - a.x), h: Math.max(0.02, b.y - a.y) };
      positionBox(pane);
    });
    on(window, "mouseup", function () {
      // NÃO recompara a cada crop (trava). Só ajusta o recorte; recomparar é no botão Comparar.
      if (down) { hideLoupe(); if (moved && RESULT) setStatus("Recorte ajustado — clique Comparar para atualizar.", false); }
      down = null;
    });
  }

  // ============ carregar PDF/imagem em QUALQUER painel (mesmo renderizador) ============
  function loadFileIntoPane(pane, file) {
    if (!file) return;
    pane.name = file.name;
    $(pane.ids.info).textContent = file.name;
    var isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    file.arrayBuffer().then(function (buf) {
      if (isPdf) loadPdfPane(pane, new Uint8Array(buf), (typeof file.path === "string" && file.path) || null);
      else loadImagePane(pane, buf, file.type || "image/png");
    });
  }

  // carrega um PDF/imagem de um caminho local (Desktop/Engine) num painel
  function loadLocalInto(pane, path, name) {
    try {
      var buf = require("fs").readFileSync(path);
      pane.name = name;
      $(pane.ids.info).textContent = name;
      setStatus("");
      if (/\.pdf$/i.test(path)) loadPdfPane(pane, new Uint8Array(buf), path);
      else loadImagePane(pane, buf, "image/png");
    } catch (e) { pane._onLoaded = null; setStatus("Erro lendo " + name + ": " + e, true); }
  }

  // ============ ARQUIVO: puxar do Desktop do operador ============
  function pullDesktop() {
    setStatus("procurando PDFs no Desktop…", false, true);
    evalScript("acListarPdfsDesktop()", function (r) {
      if (!r || r.indexOf("OK|") !== 0) { setStatus("Desktop: " + (r ? r.split("|").slice(1).join(" ") : "erro"), true); return; }
      var body = r.substring(3);
      var linhas = body ? body.split("\n") : [];
      var list = [];
      for (var i = 0; i < linhas.length; i++) { var p = linhas[i].split("\t"); if (p[0] && p[1]) list.push({ name: p[0], path: p[1] }); }
      if (list.length === 0) { setStatus("Nenhum PDF (rev/v) no Desktop.", true); return; }
      setStatus("");
      if (list.length === 1) { loadLocalInto(F, list[0].path, list[0].name); return; }
      showDeskPicker(list);
    });
  }
  function showDeskPicker(list) {
    var ul = $("deskPickerList"); ul.innerHTML = "";
    list.forEach(function (it) {
      var li = document.createElement("li");
      li.className = "picker-item"; li.textContent = it.name; li.title = it.name;
      li.addEventListener("click", function () { $("deskPicker").style.display = "none"; loadLocalInto(F, it.path, it.name); });
      ul.appendChild(li);
    });
    $("deskPicker").style.display = "block";
  }

  function loadImagePane(pane, buf, mime) {
    var url = URL.createObjectURL(new Blob([buf], { type: mime }));
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      pane.pdf = false; pane.bytes = null; pane.struct = null; pane.hideL = {}; pane.hideC = {}; pane.hideImg = false;
      closePrep(pane); var pb = $(pane.ids.prepBtn); if (pb) pb.style.display = "none";
      $(pane.ids.pdfNav).style.display = "none";
      setSource(pane, c);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ===== CICLO DE VIDA DO DOC — TRANSIENTE (obrigatório: PDFs de 705MB no teto de 2GB do WASM) =====
  // NÃO mantemos doc pdfium vivo entre operações. Cada operação carrega FRESCO dos bytes,
  // faz o trabalho e destrói -> só UM doc por vez (nunca acumula/fragmenta o heap).
  // O heap linear do WASM nunca encolhe e um abort() mata o módulo pra sempre; por isso,
  // se abortar, reiniciamos o pdfium (heap zerado) e tentamos MAIS uma vez.
  function isFatalPdf(e) { var s = String(e); return /Aborted|out of bounds|enlarge memory|memory access/i.test(s); }
  // aceita Uint8Array OU o próprio pane: com srcPath conhecido (Desktop/Engine) lê do
  // DISCO sob demanda — não segura ~700MB de bytes na RAM do painel.
  function srcBytes(src) {
    if (!src) return null;
    if (src.ids) {   // é um pane
      if (src.bytes) return src.bytes;
      if (src.srcPath) { try { return new Uint8Array(require("fs").readFileSync(src.srcPath)); } catch (e) { return null; } }
      return null;
    }
    return src;      // Uint8Array direto
  }
  function withPdf(src, applyHidesFn, work, done, _retried) {
    var bytes = srcBytes(src);
    if (!bytes) { done("sem arquivo"); return; }
    ACPdf.loadDoc(bytes).then(function (h) {
      var out = null, err = null;
      try { if (applyHidesFn) applyHidesFn(h); out = work(h); } catch (e) { err = e; }
      try { ACPdf.destroy(h); } catch (e2) {}
      if (err && isFatalPdf(err) && !_retried) { ACPdf.reset(); setTimeout(function () { withPdf(bytes, applyHidesFn, work, done, true); }, 40); return; }
      done(err, out);
    }, function (e) {
      if (isFatalPdf(e) && !_retried) { ACPdf.reset(); setTimeout(function () { withPdf(bytes, applyHidesFn, work, done, true); }, 40); return; }
      done(e);
    });
  }

  // Camadas de ACABAMENTO/TÉCNICAS: não são conteúdo da embalagem e, renderizadas
  // sem overprint, cobrem a arte (o pdfium não simula overprint). Ficam ocultas por
  // padrão; o operador pode religar qualquer uma no ⚗ Limpar.
  var TEC_RE = /^(branco|white|opaque\s*white|verniz|verniz\s*loc|varnish|uv|faca|corte|cut|die\s*line|dieline|vinco|crease|cotas?|medidas?|dimens|registro|marcas?|tecnic|técnic|control|sangria|bleed|guias?|guide)/i;
  function autoHideTecnicas(layers) {
    var out = [], i, nm;
    for (i = 0; i < layers.length; i++) {
      nm = layers[i].name || "";
      if (TEC_RE.test(nm.replace(/^[\s_\-.]+/, ""))) out.push(nm);
    }
    return out;
  }

  function loadPdfPane(pane, u8, srcPath) {
    progStart(); progSet(30, "lendo PDF…");
    // com caminho conhecido (Desktop/Engine) NÃO segura ~700MB de bytes na RAM —
    // relê do disco sob demanda (srcBytes)
    pane.srcPath = srcPath || null;
    pane.bytes = srcPath ? null : u8;
    pane.pdf = true;
    pane.hideL = {}; pane.hideC = {}; pane.hideImg = false; pane.struct = null; closePrep(pane);   // zera manipulação anterior
    pane.page = 1;
    withPdf(u8, null, function (h) {
      pane.pages = ACPdf.pageCount(h);
      var sz = ACPdf.pageSize(h, 0); pane.pageW = sz.w; pane.pageH = sz.h;
      // Lê a estrutura JÁ no carregamento p/ ocultar as camadas TÉCNICAS sozinho
      // (branco de suporte, verniz, faca...). Sem isso o render sai irreconhecível:
      // são tintas de acabamento que na impressão vão em overprint/por baixo, mas o
      // pdfium (renderizador de tela) pinta OPACAS por cima e escondem a arte.
      var st = null;
      try { st = ACPdf.readStructure(h, 0); } catch (eS) {}
      if (st) {
        pane.struct = st;
        var tec = autoHideTecnicas(st.layers || []);
        for (var t = 0; t < tec.length; t++) pane.hideL[tec[t]] = true;
        pane._tec = tec;
        if (tec.length) applyHidesOn(h, pane);
      }
      return ACPdf.render(h, 0, null, Math.min(1.5, 800 / Math.max(sz.w, sz.h)));
    }, function (err, cv) {
      if (err) { pane.pdf = false; pane.bytes = null; pane.srcPath = null; progEnd("erro"); setStatus("Falha ao ler PDF: " + err, true); pane._onLoaded = null; return; }
      $(pane.ids.pdfNav).style.display = pane.pages > 1 ? "flex" : "none";
      $(pane.ids.prepBtn).style.display = "inline-block";   // habilita ⚗ Limpar (só PDF)
      setSource(pane, cv);
      progEnd(pane._tec && pane._tec.length
        ? "preview pronto · camadas técnicas ocultadas: " + pane._tec.join(", ")
        : "preview pronto");
    });
  }

  function renderPdfPagePane(pane) {   // usado na navegação de páginas
    $(pane.ids.pageLbl).textContent = pane.page + "/" + pane.pages;
    if (!_progTimer) progStart();
    progSet(70, "gerando preview…");
    withPdf(pane, function (h) { applyHidesOn(h, pane); }, function (h) {
      return ACPdf.render(h, pane.page - 1, null, previewScale(pane));
    }, function (err, cv) {
      if (err) { progEnd("erro"); setStatus("Erro no preview: " + err, true); return; }
      setSourceKeep(pane, cv); progEnd("preview pronto");
    });
  }

  // ============ TELA DE MANIPULAÇÃO (limpar cores/camadas antes de comparar) ============
  function previewScale(pane) { return Math.min(1.5, 800 / Math.max(pane.pageW || 1, pane.pageH || 1)); }
  function prepEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // atualiza o canvas do pane preservando a rotação (mas zerando o crop)
  function setSourceKeep(pane, canvas) {
    pane.rawSrc = canvas; pane.src = rotateCanvas(canvas, pane.rot || 0); pane.crop = null;
    showPane(pane);
  }

  // aplica os hides (imagens/camadas/cores) num doc FRESCO 'h' (destrutivo via GenerateContent).
  // Como 'h' é sempre recarregado dos bytes, é reversível: desmarcar = próximo load sem o hide.
  function applyHidesOn(h, pane) {
    var idx = pane.page - 1, k, p;
    if (pane.hideImg) ACPdf.setImagesActive(h, idx, false);   // some a FOTO (mata re-tom da imagem)
    for (k in pane.hideL) if (pane.hideL.hasOwnProperty(k) && pane.hideL[k]) ACPdf.setLayerActive(h, idx, k, false);
    for (k in pane.hideC) if (pane.hideC.hasOwnProperty(k) && pane.hideC[k]) { p = k.split(","); ACPdf.setColorActive(h, idx, +p[0], +p[1], +p[2], false, 6); }
  }

  // aplica a limpeza e re-renderiza o preview do pane (carrega fresco, aplica hides, destrói)
  function reloadWithPrep(pane) {
    progStart(); progSet(30, "aplicando limpeza…");
    withPdf(pane, function (h) { applyHidesOn(h, pane); }, function (h) {
      return ACPdf.render(h, pane.page - 1, null, previewScale(pane));
    }, function (err, cv) {
      if (err) { progEnd("erro"); setStatus("Falha ao aplicar: " + err, true); return; }
      setSourceKeep(pane, cv); progEnd("limpeza aplicada");
      var host = $(pane.ids.prep), msg = host && host.querySelector("[data-msg]");
      if (msg) msg.textContent = RESULT ? "aplicado — clique Comparar de novo" : "aplicado";
    });
  }

  function closePrep(pane) {
    var host = $(pane.ids.prep);
    if (host) { host.style.display = "none"; host.removeAttribute("data-open"); }
  }

  function openPrep(pane) {
    // PDF puxado do Desktop/Job guarda só o CAMINHO (bytes ficam null de propósito
    // pra não segurar 700MB na RAM) — o gate antigo por bytes barrava indevidamente
    if (!pane.pdf || (!pane.bytes && !pane.srcPath)) { setStatus("Carregue o PDF primeiro.", true); return; }
    var host = $(pane.ids.prep);
    if (host.getAttribute("data-open") === "1") { closePrep(pane); return; }   // toggle
    if (pane.struct) { buildPrepUI(pane, pane.struct); host.setAttribute("data-open", "1"); showPane(pane); return; }
    setStatus("lendo estrutura do PDF…", false, true);
    withPdf(pane, null, function (h) { return ACPdf.readStructure(h, pane.page - 1); }, function (err, struct) {
      if (err) { setStatus("Erro ao ler estrutura: " + err, true); return; }
      pane.struct = struct; buildPrepUI(pane, struct);
      host.setAttribute("data-open", "1"); setStatus(""); showPane(pane);
    });
  }

  function buildPrepUI(pane, struct) {
    // SÓ CAMADAS (pedido do fluxo): limpar a layer = o PDF é re-renderizado em todas
    // as operações (preview, comparação, OCR) como se aquela camada não existisse.
    // Cores/fotos saíram da tela — camada é a unidade de trabalho da clicheria.
    var host = $(pane.ids.prep), lyr = struct.layers || [], i, h = "";
    h += '<div class="prep-head"><span>⚗ Limpar camadas antes de comparar</span><button class="btn ghost xs" data-close="1">✕</button></div>';
    h += '<div class="prep-body">';
    h += '<div class="prep-sec"><label class="tt">Camadas (desmarque p/ tirar TUDO que está nela)</label><div class="prep-list">';
    if (!lyr.length) h += '<div class="prep-empty">sem camadas nomeadas neste PDF</div>';
    for (i = 0; i < lyr.length; i++) {
      var nm = lyr[i].name, onL = !pane.hideL[nm];
      h += '<label class="prep-row"><input type="checkbox" data-layer="' + prepEsc(nm) + '"' + (onL ? " checked" : "") + '><span>' + prepEsc(nm) + '</span><span class="cnt">' + lyr[i].count + "</span></label>";
    }
    h += "</div></div>";
    h += '<div class="prep-foot"><button class="btn accent sm" data-apply>Aplicar</button><button class="btn ghost sm" data-restore>Restaurar</button><span class="msg" data-msg></span></div>';
    h += "</div>";
    host.innerHTML = h; host.style.display = "block";
    wirePrep(pane);
  }

  function wirePrep(pane) {
    var host = $(pane.ids.prep), i;
    host.querySelector("[data-close]").onclick = function () { closePrep(pane); };
    var imgc = host.querySelector("[data-img]");
    if (imgc) imgc.onchange = function () { pane.hideImg = this.checked; };
    var lys = host.querySelectorAll("[data-layer]");
    for (i = 0; i < lys.length; i++) lys[i].onchange = function () { pane.hideL[this.getAttribute("data-layer")] = !this.checked; };
    var chips = host.querySelectorAll("[data-color]");
    for (i = 0; i < chips.length; i++) chips[i].onclick = function () {
      var key = this.getAttribute("data-color"); pane.hideC[key] = !pane.hideC[key];
      this.className = "prep-chip" + (pane.hideC[key] ? " off" : "");
    };
    host.querySelector("[data-apply]").onclick = function () { reloadWithPrep(pane); };
    host.querySelector("[data-restore]").onclick = function () { pane.hideL = {}; pane.hideC = {}; pane.hideImg = false; buildPrepUI(pane, pane.struct); host.setAttribute("data-open", "1"); reloadWithPrep(pane); };
  }

  // ============ ORIGINAL: puxar do job (Engine) ============
  function pullJob(after) {
    var os = osDigits();
    if (os.length < 5) { setStatus("Digite a O.S. (mín. 5 dígitos).", true); return; }
    setStatus("buscando original do job " + os + "…", false, true);
    O._onLoaded = (typeof after === "function") ? after : null;
    evalScript("acBuscarOriginalDoJob('" + os + "')", function (r) {
      if (!r || r.indexOf("OK|") !== 0) {
        O._onLoaded = null;
        setStatus("Original: " + (r ? r.split("|").slice(1).join(" ") : "erro"), true);
        return;
      }
      var p = r.split("|"); // OK|caminho|nome|tipo
      loadOriginalFromPath(p[1], p[2], p[3]);
    });
  }

  function loadOriginalFromPath(path, name, tipo) {
    try {
      var fs = require("fs");
      var buf = fs.readFileSync(path);
      O.name = name;
      var badge = tipo ? ' <span class="badge ' + (tipo === "distorcido" ? "dist" : "norm") + '">' + tipo + "</span>" : "";
      $("origInfo").innerHTML = name + badge;
      setStatus("");
      if (/\.pdf$/i.test(name)) loadPdfPane(O, new Uint8Array(buf), path);
      else loadImagePane(O, buf, "image/png");
    } catch (e) { O._onLoaded = null; setStatus("Erro lendo original: " + e, true); }
  }

  // ============ FLUXO: garantir arquivo + original, depois comparar ============
  function ensureThenCompare() {
    if (!F.src) { setStatus("Carregue o arquivo (arraste, ⤵ Desktop ou Escolher…).", true); return; }
    if (!O.src && osDigits().length >= 5) pullJob(runCompare);
    else runCompare();
  }

  // ============ COMPARAR ============
  var _cmpTimer = null;
  function scheduleCompare() {
    if (_cmpTimer) clearTimeout(_cmpTimer);
    _cmpTimer = setTimeout(runCompare, 220);
  }
  function readTol() {
    return { colorTol: +$("tolColor").value, slack: +$("tolThick").value,
             minArea: +$("tolArea").value, dpi: +$("dpi").value,
             structural: !!($("modoForma") && $("modoForma").checked),   // comparar por forma
             sens: _sensLevel,                                           // 0=Baixa 1=Média 2=Alta
             trapTol: $("tolTrap") ? +$("tolTrap").value : 3 };
  }
  // Sensibilidade (GlobalVision-style): o operador escolhe o quanto filtrar. Baixa = só erro
  // claro (0 falso). Alta = pega troca sob trapping pesado/textura/fundo escuro (aceita falsos).
  // PADRÃO = Alta (2): captura o erro mesmo no caso difícil; o operador baixa se quiser menos falso.
  var _sensLevel = 2;
  function setSens(n) {
    _sensLevel = n;
    var ids = ["sensBaixa", "sensMedia", "sensAlta"], i;
    for (i = 0; i < 3; i++) { var el = $(ids[i]); if (el) el.className = "sens-btn" + (i === n ? " on" : ""); }
    var leg = $("sensLegenda");
    if (leg) leg.textContent = n === 0
      ? "Baixa: só erros claros, sem falso. Use em revisão×revisão ou arte limpa."
      : n === 1
      ? "Média: original × tratado normal. Pega mais, com pouco falso."
      : "Alta: pega a troca mesmo sob trapping pesado/textura/fundo escuro (DUX, Perdigão). Aceita alguns falsos — confira cada marca.";
    if (RESULT) scheduleCompare();   // re-compara no novo nível
  }
  // ---- barra de progresso (anda suave enquanto espera + tempo decorrido) ----
  var _progT0 = 0, _progTimer = null, _progStage = "", _progCur = 0, _progTarget = 4;
  function progStart() {
    _progT0 = Date.now(); _progStage = "preparando…"; _progCur = 2; _progTarget = 6;
    $("progWrap").style.display = "flex";
    if (_progTimer) clearInterval(_progTimer);
    _progTimer = setInterval(progTick, 200); progTick();
  }
  function progSet(pct, stage) { _progStage = stage; _progTarget = pct; }
  function progTick() {
    _progCur += (_progTarget - _progCur) * 0.12;   // creep suave em direção ao alvo
    $("progFill").style.width = _progCur.toFixed(1) + "%";
    $("progLbl").textContent = _progStage + "  ·  " + ((Date.now() - _progT0) / 1000).toFixed(1) + "s";
  }
  function progEnd(ok) {
    if (_progTimer) { clearInterval(_progTimer); _progTimer = null; }
    $("progFill").style.width = "100%";
    $("progLbl").textContent = (ok || "pronto") + "  ·  " + ((Date.now() - _progT0) / 1000).toFixed(1) + "s";
    setTimeout(function () { $("progWrap").style.display = "none"; $("progFill").style.width = "0%"; }, 1400);
  }

  function runCompare() {
    if (!O.src || !F.src) {
      setStatus(!F.src ? "Carregue o arquivo (arraste, ⤵ Desktop ou Escolher…)."
                       : "Carregue/puxe o original.", true);
      return;
    }
    // PDF x PDF: registro por feição -> pdfium renderiza os DOIS na MESMA escala px/pt.
    // Se cropado, renderiza SÓ a região do crop (nítido, rápido, mesmo px/pt).
    if (O.pdf && F.pdf && O.pageW && F.pageW) {
      var useCrop = isCropped(O) || isCropped(F), s;
      if (useCrop) {
        var cwO = (isCropped(O) ? O.crop.w : 1) * O.pageW, chO = (isCropped(O) ? O.crop.h : 1) * O.pageH;
        var cwF = (isCropped(F) ? F.crop.w : 1) * F.pageW, chF = (isCropped(F) ? F.crop.h : 1) * F.pageH;
        s = Math.min(8, WORKRES / Math.max(cwO, chO, cwF, chF));
      } else {
        s = Math.min(5, WORKRES / Math.max(O.pageW, O.pageH, F.pageW, F.pageH));
      }
      // rects das FOTOS do PDF (fração da página) -> fração do RENDER (desconta o crop).
      // Alimenta a regra "foto nos 2 lados = silencioso" do compare.
      function photoRectsOf(h, pane) {
        if (pane.hideImg) return [];                       // fotos ocultadas não mascaram nada
        var rects = ACPdf.getImageRects(h, pane.page - 1), cr = isCropped(pane) ? pane.crop : { x: 0, y: 0, w: 1, h: 1 };
        var out = [], i, r, x0, y0, x1, y1;
        for (i = 0; i < rects.length; i++) {
          // rot do operador: rect da página crua -> espaço rotacionado (o crop vive lá)
          r = rotFrac(rects[i], pane.rot || 0);
          x0 = Math.max(0, (r.x - cr.x) / cr.w); y0 = Math.max(0, (r.y - cr.y) / cr.h);
          x1 = Math.min(1, (r.x + r.w - cr.x) / cr.w); y1 = Math.min(1, (r.y + r.h - cr.y) / cr.h);
          if (x1 > x0 && y1 > y0) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        }
        return out;
      }
      // render p/ COMPARAR respeitando a ROTAÇÃO do operador: gira o render inteiro e
      // aplica o crop DEPOIS (o recorte foi desenhado sobre o preview já girado).
      function renderPaneCv(h, pane) {
        var rot = pane.rot || 0;
        if (!rot) return ACPdf.render(h, pane.page - 1, isCropped(pane) ? pane.crop : null, s);
        var cvR = rotateCanvas(ACPdf.render(h, pane.page - 1, null, s), rot);
        if (!isCropped(pane)) return cvR;
        var cr = pane.crop;
        var cx0 = Math.round(cr.x * cvR.width), cy0 = Math.round(cr.y * cvR.height);
        var cw = Math.max(2, Math.round(cr.w * cvR.width)), chh = Math.max(2, Math.round(cr.h * cvR.height));
        var c2 = document.createElement("canvas"); c2.width = cw; c2.height = chh;
        c2.getContext("2d").drawImage(cvR, cx0, cy0, cw, chh, 0, 0, cw, chh);
        return c2;
      }
      // MEMÓRIA: cada lado é renderizado com seu próprio doc FRESCO, UM POR VEZ (withPdf
      // carrega->render->destrói). Nunca há 2 docs de 705MB no heap ao mesmo tempo.
      progStart(); progSet(35, "renderizando arquivo…");
      withPdf(F, function (h) { applyHidesOn(h, F); }, function (h) {
        return { cv: renderPaneCv(h, F), ph: photoRectsOf(h, F) };
      }, function (errF, rf) {
        if (errF) { progEnd("erro"); setStatus("Erro ao renderizar arquivo: " + errF, true); return; }
        progSet(65, "renderizando original…");
        withPdf(O, function (h) { applyHidesOn(h, O); }, function (h) {
          return { cv: renderPaneCv(h, O), ph: photoRectsOf(h, O) };
        }, function (errO, ro) {
          if (errO) { progEnd("erro"); setStatus("Erro ao renderizar original: " + errO, true); return; }
          progSet(85, "comparando…");
          setTimeout(function () {
            try {
              var opt = readTol(); opt.prescaled = true; opt.maxWork = WORKRES;
              opt.photoF = rf.ph; opt.photoO = ro.ph;
              RESULT = window.ACEngine.compare(rf.cv, ro.cv, opt);
              MANUAL = false; progEnd("pronto");
              // se o OCR vai rodar, a lista só aparece DEPOIS de ler tudo (finish());
              // senão, mostra já. Evita a lista "piscar" com marcadores intermediários.
              if (!applyOcrTextCheck()) renderResult();
            } catch (e) { progEnd("erro"); setStatus("Erro na comparação: " + e, true); }
          }, 20);
        });
      });
      return;
    }
    // demais casos (imagem/captura): encaixa recorte-no-recorte
    setStatus("comparando…", false, true);
    setTimeout(function () {
      try {
        var opt = readTol(); opt.maxWork = WORKRES;
        RESULT = window.ACEngine.compare(cropCanvas(F), cropCanvas(O), opt);
        MANUAL = false;
        if (!applyOcrTextCheck()) { renderResult(); setStatus(""); }
      } catch (e) { setStatus("Erro na comparação: " + e, true); }
    }, 30);
  }

  var MODE = "all";
  function modeSet() {
    return MODE === "miss" ? { miss: 1, ok: 1, check: 1 } : MODE === "struct" ? { miss: 1, extra: 1, ok: 1, check: 1 } : { miss: 1, extra: 1, diff: 1, ok: 1, check: 1 };
  }
  function imgToCanvas(imgData) {
    var c = document.createElement("canvas"); c.width = imgData.width; c.height = imgData.height;
    c.getContext("2d").putImageData(imgData, 0, 0); return c;
  }
  function keyOf(c) { return c.cx + "_" + c.cy + "_" + c.type + (c.kind ? "_" + c.kind : ""); }

  // ---- Aprender do que o operador ignora ----------------------------------
  // Assinatura do bloco: forma + textura + cor. Serve p/ achar "parecidos".
  var SIMILAR_TH = 1.15;   // distância máx. p/ considerar dois blocos parecidos
  function lumaAt(d, i) { return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; }
  function computeSig(c) {
    if (c.sig) return c.sig;
    var W = RESULT.W, H = RESULT.H, fd = RESULT.fileImg.data, od = RESULT.origImg.data;
    var x0 = c.x, y0 = c.y, x1 = Math.min(W, c.x + c.w), y1 = Math.min(H, c.y + c.h);
    var trans = 0, rows = 0, colSum = 0, n = 0, lSum = 0, lSum2 = 0;
    for (var y = y0; y < y1; y++) {
      var prev = -1, rowTrans = 0, any = false;
      for (var x = x0; x < x1; x++) {
        var p = (y * W + x) * 4;
        var lf = lumaAt(fd, p), lo = lumaAt(od, p);
        var l = Math.abs(lf - 127) > Math.abs(lo - 127) ? lf : lo;   // lado com mais "tinta"
        var b = l < 128 ? 1 : 0;
        if (prev >= 0 && b !== prev) rowTrans++;
        prev = b; any = true;
        var mx = Math.max(fd[p], fd[p + 1], fd[p + 2]), mn = Math.min(fd[p], fd[p + 1], fd[p + 2]);
        colSum += (mx - mn); n++; lSum += lf; lSum2 += lf * lf;
      }
      if (any) { trans += rowTrans; rows++; }
    }
    var wpx = Math.max(1, x1 - x0);
    var variance = n ? Math.max(0, lSum2 / n - (lSum / n) * (lSum / n)) : 0;
    var sig = {
      type: c.type,
      logArea: Math.log(c.area + 1),
      logAR: Math.log((c.w + 1) / (c.h + 1)),
      density: c.area / Math.max(1, c.w * c.h),
      striping: rows ? (trans / rows) / wpx : 0,   // transições/px de largura (código de barras = alto)
      colorful: n ? (colSum / n) / 255 : 0,         // saturação média (foto/cor = alto, texto = baixo)
      variance: Math.sqrt(variance) / 128,          // variação de tom (foto = alto)
      strength: (c.strength || 0) / 255
    };
    c.sig = sig; return sig;
  }
  function sigDist(a, b) {
    if (a.type !== b.type) return 999;   // só compara mesma natureza (falta com falta etc.)
    var d = 0, t;
    t = (a.logArea - b.logArea) / 2.0; d += t * t;
    t = (a.logAR - b.logAR) / 1.2; d += t * t;
    t = (a.density - b.density) / 0.6; d += t * t;
    t = (a.striping - b.striping) / 0.5; d += t * t * 2;   // textura pesa mais (barra x texto)
    t = (a.colorful - b.colorful) / 0.5; d += t * t;
    t = (a.variance - b.variance) / 0.5; d += t * t;
    t = (a.strength - b.strength) / 0.5; d += t * t;
    return Math.sqrt(d);
  }
  // marca como "auto" todo bloco parecido com algum que o operador marcou à mão
  function autoIgnoreSimilar() {
    if (!RESULT || !RESULT.ignored) return;
    var sigs = [];
    RESULT.comps.forEach(function (c) { if (RESULT.ignored[keyOf(c)] === "manual") sigs.push(computeSig(c)); });
    if (!sigs.length) return;
    RESULT.comps.forEach(function (c) {
      if (c.kind) return;                                   // texto/barcode NUNCA somem por semelhança
      var k = keyOf(c); if (RESULT.ignored[k]) return;      // já ignorada (manual/auto/estrutural)
      var sc = computeSig(c);
      for (var i = 0; i < sigs.length; i++) { if (sigDist(sigs[i], sc) < SIMILAR_TH) { RESULT.ignored[k] = "auto"; break; } }
    });
  }
  function ignoreCounts() {
    var man = 0, auto = 0, str = 0, kk;
    for (kk in RESULT.ignored) {
      var v = RESULT.ignored[kk]; if (!v) continue;
      if (v === "hide") continue;   // silencioso (spot z/x/w, foto) -> nem conta nem avisa
      if (v === "auto") auto++; else if (v === "struct") str++; else man++;
    }
    return { man: man, auto: auto, struct: str, total: man + auto + str };
  }

  // ---- Ignore estrutural (faca/cotas/fotos) a partir do documento aberto -----
  // é foto? textura fotográfica: força BAIXA (texto é mais forte), muita variação de
  // tom, colorido e sem listras. Limiar de força folgado abaixo do texto (~0.58) p/
  // NUNCA engolir uma edição de texto sobre a foto.
  function photographic(sig) {
    return sig.strength < 0.50 && sig.variance > 0.30 && sig.colorful > 0.30 && sig.striping < 0.15;
  }
  function parseRegions(payload) {   // "abW;abH|raster:..|faca:..|cota:..|silent:.."
    var res = { raster: [], faca: [], cota: [], silent: [] }, parts = payload.split("|"), i, j;
    for (i = 1; i < parts.length; i++) {
      var kv = parts[i].split(":"), key = kv[0], body = kv[1] || "";
      if (!res[key] || !body) continue;
      var segs = body.split(";");
      for (j = 0; j < segs.length; j++) {
        if (!segs[j]) continue;
        var n = segs[j].split(","); if (n.length < 4) continue;
        res[key].push({ x: +n[0], y: +n[1], w: +n[2], h: +n[3] });
      }
    }
    return res;
  }
  // regiões vêm normalizadas ao artboard; leva ao sistema de coords do compare
  // aplicando o MESMO crop usado pra renderizar o arquivo.
  function rectsToCompare(list) {
    var crop = (F.crop && isCropped(F)) ? F.crop : { x: 0, y: 0, w: 1, h: 1 };
    var fr = RESULT.fileRect || { w: RESULT.W, h: RESULT.H }, out = [];
    list.forEach(function (r) {
      out.push({
        x: ((r.x - crop.x) / crop.w) * fr.w, y: ((r.y - crop.y) / crop.h) * fr.h,
        w: (r.w / crop.w) * fr.w, h: (r.h / crop.h) * fr.h
      });
    });
    return out;
  }
  function inAnyRect(c, rects, m) {
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (c.cx >= r.x - m && c.cx <= r.x + r.w + m && c.cy >= r.y - m && c.cy <= r.y + r.h + m) return true;
    }
    return false;
  }
  // lê o doc aberto (arquivo) e auto-ignora faca/cotas (por região) e fotos (por textura).
  function applyStructuralIgnore() {
    if (!RESULT) return;
    evalScript("acRegioesIgnorar()", function (r) {
      if (!RESULT) return;
      var regs = { raster: [], faca: [], cota: [], silent: [] };
      if (r && r.indexOf("OK|") === 0) regs = parseRegions(r.substring(3));
      var rasterR = rectsToCompare(regs.raster), facaR = rectsToCompare(regs.faca),
          cotaR = rectsToCompare(regs.cota), silentR = rectsToCompare(regs.silent);
      var m = 0.01 * Math.max(RESULT.W, RESULT.H);   // margem p/ sangria/offset do PDF
      RESULT.comps.forEach(function (c) {
        if (c.kind) return;   // texto/barcode são ISENTOS de todos os ignores estruturais
        var k = keyOf(c); if (RESULT.ignored[k]) return;
        // silencioso (spot z/x/w) -> some sem contar nem avisar
        if (silentR.length && inAnyRect(c, silentR, m)) { RESULT.ignored[k] = "hide"; return; }
        if (facaR.length && inAnyRect(c, facaR, m)) { RESULT.ignored[k] = "struct"; return; }   // faca (conta)
        if (cotaR.length && inAnyRect(c, cotaR, m)) { RESULT.ignored[k] = "struct"; return; }   // cotas (conta)
        // foto: SÓ ignora se DENTRO de um raster do documento E fotográfico -> silencioso (não conta).
        // Sem rasters (host falhou/doc não é o arquivo) -> não mexe (usa aprender-parecidos).
        if (rasterR.length && inAnyRect(c, rasterR, m) && photographic(computeSig(c))) { RESULT.ignored[k] = "hide"; return; }
      });
      autoIgnoreSimilar();
      applyMode();
    });
  }

  // ---- Inspeção de TEXTO por OCR (estilo GlobalVision) — só no modo FORMA ----------
  // Lê as seções de texto nos dois lados e compara STRINGS. Pega troca de número/código
  // (ex.: 0763->0591) que o pixel não isola (linha inteira re-estilizada). PRECISÃO:
  // só confia no diff de uma seção se ela tiver um token numérico que BATE nos 2 lados
  // (controle interno provando que o OCR leu certo aquele campo).
  function digTokens(s) {
    var out = [], m = (s || "").match(/\d{3,}/g), i;
    if (m) for (i = 0; i < m.length; i++) out.push(m[i]);
    return out;
  }
  function sharesToken(a, b) {
    var ta = digTokens(a), tb = digTokens(b), i, j;
    for (i = 0; i < ta.length; i++) for (j = 0; j < tb.length; j++) if (ta[i] === tb[j]) return true;
    return false;
  }
  // ----- helpers do pipeline hi-DPI por linha -----
  function canvasToImg(cv) {
    var g = cv.getContext("2d"), d = g.getImageData(0, 0, cv.width, cv.height);
    return { data: d.data, width: cv.width, height: cv.height };
  }
  // similaridade de string (Levenshtein normalizado) — portão de confiança da linha
  function simText(a, b) {
    a = (a || "").replace(/\s+/g, " ").trim().toLowerCase();
    b = (b || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!a.length && !b.length) return 1; if (!a.length || !b.length) return 0;
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      for (j = 0; j <= n; j++) prev[j] = cur[j];
    }
    return 1 - prev[n] / Math.max(m, n);
  }
  // máscara de texto ACROMÁTICO (branco/knockout ou escuro), IGNORA foto colorida e madeira
  function isTextPx(fd, p) {
    var r = fd[p], g = fd[p + 1], b = fd[p + 2];
    var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    return (mx - mn) < 45 && (mn < 75 || mx > 200);
  }
  // divide um BLOCO em LINHAS apertadas (só texto), na fileImg — projeta a máscara de texto
  function splitRegionLines(reg) {
    var W = RESULT.W, Hh = RESULT.H, fd = RESULT.fileImg.data;
    var x0 = Math.max(0, reg.x | 0), x1 = Math.min(W, (reg.x + reg.w) | 0);
    var y0 = Math.max(0, reg.y | 0), y1 = Math.min(Hh, (reg.y + reg.h) | 0);
    if (x1 - x0 < 4 || y1 - y0 < 4) return [];
    var rowc = [], y, x;
    for (y = y0; y < y1; y++) {
      var c = 0;
      for (x = x0; x < x1; x++) if (isTextPx(fd, (y * W + x) * 4)) c++;
      rowc.push(c);
    }
    var thr = Math.max(6, (x1 - x0) * 0.02), bands = [], on = false, ls = 0, r;
    for (r = 0; r < rowc.length; r++) {
      var t = rowc[r] > thr;
      if (t && !on) { on = true; ls = r; } else if (!t && on) { on = false; if (r - ls >= 5) bands.push([y0 + ls, y0 + r]); }
    }
    if (on && rowc.length - ls >= 5) bands.push([y0 + ls, y0 + rowc.length]);
    var out = [], bi;
    for (bi = 0; bi < bands.length; bi++) {
      var by0 = bands[bi][0], by1 = bands[bi][1], cx0 = -1, cx1 = -1;
      for (x = x0; x < x1; x++) {
        var has = false;
        for (y = by0; y < by1 && !has; y++) if (isTextPx(fd, (y * W + x) * 4)) has = true;
        if (has) { if (cx0 < 0) cx0 = x; cx1 = x; }
      }
      if (cx0 >= 0) out.push({ x: cx0, y: by0, w: cx1 - cx0 + 1, h: by1 - by0 });
    }
    return out;
  }
  // quebra uma LINHA larga em SEGMENTOS por vãos de coluna (painéis distintos na mesma
  // banda viram leituras separadas — pequenas = OCR nítido e sem estourar o worker)
  function segmentLine(ln) {
    var W = RESULT.W, fd = RESULT.fileImg.data, x0 = ln.x, x1 = ln.x + ln.w, y0 = ln.y, y1 = ln.y + ln.h;
    var gapMin = Math.max(14, ln.h * 1.6), segs = [], sx = -1, lastInk = -1, x, y;
    for (x = x0; x < x1; x++) {
      var has = false;
      for (y = y0; y < y1 && !has; y++) if (isTextPx(fd, (y * W + x) * 4)) has = true;
      if (has) { if (sx < 0) sx = x; lastInk = x; }
      else if (sx >= 0 && (x - lastInk) > gapMin) { segs.push({ x: sx, y: y0, w: lastInk - sx + 1, h: ln.h }); sx = -1; }
    }
    if (sx >= 0) segs.push({ x: sx, y: y0, w: lastInk - sx + 1, h: ln.h });
    return segs;
  }
  // região do compare (px) -> retângulo em FRAÇÃO da página (via crop do arquivo)
  function toPageRect(rx, ry, rw, rh) {
    var cr = (F.crop && isCropped(F)) ? F.crop : { x: 0, y: 0, w: 1, h: 1 };
    var fr = RESULT.fileRect || { w: RESULT.W, h: RESULT.H };
    return { x: cr.x + (rx / fr.w) * cr.w, y: cr.y + (ry / fr.h) * cr.h,
             w: (rw / fr.w) * cr.w, h: (rh / fr.h) * cr.h };
  }
  // idem para o ORIGINAL. Duas correções que o lado do arquivo não precisa:
  //  1) desfaz o deslocamento do alinhamento (align.ox/oy) — na tela do compare o
  //     original está deslocado por ele;
  //  2) usa origRect (o render do ORIGINAL), não fileRect — as páginas têm tamanhos
  //     diferentes (Perdigão: 2147 x 2132 px).
  // Sem isso a fase B relê o lugar ERRADO no original, lê vazio e descarta a troca
  // real (foi o que escondeu o 0763→0591).
  function toPageRectO(rx, ry, rw, rh) {
    var cr = (O.crop && isCropped(O)) ? O.crop : { x: 0, y: 0, w: 1, h: 1 };
    var al2 = (RESULT && RESULT.align) || { ox: 0, oy: 0 };
    var orr = (RESULT && RESULT.origRect) || RESULT.fileRect || { w: RESULT.W, h: RESULT.H };
    var x2 = Math.max(0, rx - (al2.ox || 0)), y2 = Math.max(0, ry - (al2.oy || 0));
    return { x: cr.x + (x2 / orr.w) * cr.w, y: cr.y + (y2 / orr.h) * cr.h,
             w: (rw / orr.w) * cr.w, h: (rh / orr.h) * cr.h };
  }

  // Pipeline: cada BLOCO do detector -> divide em LINHAS apertadas -> re-renderiza cada
  // linha dos DOIS PDFs em DPI ALTO (ACPdf) -> OCR -> portão de similaridade (só confia se
  // os 2 lados leram a MESMA frase) -> mostra o texto/número que realmente mudou, com zoom.
  // Bloco cujas linhas leram IGUAL (só re-tom) some. Nunca trava (falhou = mantém marcador).
  // Renderiza vários crops (pr = fração da página) em DPI ALTO numa ÚNICA sessão:
  // 1 load do doc + 1 abertura de página (o pdfium decodifica as fotos gigantes UMA
  // vez, não por crop — era isso que custava minutos). Sem margens (noPad).
  // Retorna [{img,cn,s,pg}|null].
  function renderCropsHi(pane, items, targetPx, done) {
    withPdf(pane, function (h) { applyHidesOn(h, pane); }, function (h) {
      var pg = ACPdf.pageSize(h, pane.page - 1), jobs = [], meta = [], i;
      var rot = pane.rot || 0;
      for (i = 0; i < items.length; i++) {
        var pr = items[i].pr;
        // rot do operador: o pr vem do espaço ROTACIONADO (o da comparação) -> volta
        // pro espaço cru da página pro pdfium recortar certo
        if (rot) pr = rotFracInv(pr, rot);
        var cn = { x: Math.max(0, pr.x), y: Math.max(0, pr.y),
                   w: Math.min(1, pr.w), h: Math.min(1, pr.h) };
        // DPI por item: TEXTO PEQUENO precisa de mais resolução p/ a releitura ser
        // confiável; texto grande com DPI alto começa a inventar caractere (falsos).
        var tgt = items[i].target || targetPx;
        // A meta (tgt) é a ALTURA DA LINHA DEPOIS de girar. Com rot 90/270 a altura
        // final vem da LARGURA do recorte na página crua — usar a altura crua fazia o
        // recorte do original sair ~4× menor que o do arquivo (436x110 x 110x28) e o
        // texto chegava ilegível ao leitor. Era isso que impedia confirmar o 28→29.
        var altEfe = (rot === 90 || rot === 270) ? cn.w * pg.w : cn.h * pg.h;
        var s = Math.max(1, Math.min(tgt / Math.max(1, altEfe), 16));
        var outW = cn.w * pg.w * s, outPix = outW * (cn.h * pg.h * s);
        if (outW > 2200) { s = s * (2200 / outW); outPix = (cn.w * pg.w * s) * (cn.h * pg.h * s); }
        if (outPix > 500000) s = s * Math.sqrt(500000 / outPix);                    // teto do OCR
        jobs.push({ crop: cn, s: s }); meta.push({ cn: cn, s: s });
      }
      var cvs = ACPdf.renderMany(h, pane.page - 1, jobs), out = [], k;
      for (k = 0; k < cvs.length; k++) {
        if (!cvs[k]) { out.push(null); continue; }
        // devolve o texto NA HORIZONTAL: gira o crop de volta pro espaço da comparação
        var cvk = rot ? rotateCanvas(cvs[k], rot) : cvs[k];
        out.push({ img: canvasToImg(cvk), cn: meta[k].cn, s: meta[k].s, pg: pg });
      }
      return out;
    }, function (err, imgs) { done(err ? [] : (imgs || []), err); });
  }

  // recorta uma região (com margem de linha) da imagem JÁ ALINHADA do compare —
  // zero re-render/decode do PDF (estilo GlobalVision: rasteriza 1x, inspeciona da imagem)
  function cropImgData(src, x, y, w, h) {
    var W = RESULT.W, Hh = RESULT.H;
    var mX = Math.max(2, Math.round(w * 0.02)), mY = Math.max(3, Math.round(h * 0.35));
    var x0 = Math.max(0, x - mX), y0 = Math.max(0, y - mY);
    var x1 = Math.min(W, x + w + mX), y1 = Math.min(Hh, y + h + mY);
    var cw = x1 - x0, ch = y1 - y0;
    if (cw < 2 || ch < 2) return null;
    var out = new Uint8Array(cw * ch * 4), sd = src.data, yy;
    for (yy = 0; yy < ch; yy++) {
      var so = ((y0 + yy) * W + x0) * 4;
      out.set(sd.subarray(so, so + cw * 4), yy * cw * 4);
    }
    return { img: { data: out, width: cw, height: ch }, x0: x0, y0: y0 };
  }

  // Pipeline (estilo GlobalVision, adaptado ao nosso OCR): o pixel-diff (modo forma)
  // localiza AS regiões que mudaram -> re-renderiza SÓ essas linhas em DPI alto ->
  // OCR dos 2 lados -> portão de similaridade da linha (mata ruído "forno/forna") ->
  // reporta TROCOU / SUMIU / A MAIS. Nunca lê a label inteira (falso-positivo + lento).
  // respiro p/ o painel repintar entre leituras (o OCR roda na thread da UI:
  // sem ceder o controle, a tela congela e o operador acha que travou)
  function respira(fn) { setTimeout(fn, 16); }
  // O leitor de OCR é treinado em texto ESCURO sobre fundo CLARO. Rótulo de fundo
  // preto (texto branco) era lido errado — é por isso que o Perdigão (fundo claro)
  // saía limpo e o DUX (fundo preto) não. Inverte quando o fundo é escuro.
  function prepOcr(img) {
    if (!img || !img.data) return img;
    var d = img.data, n = img.width * img.height, i, soma = 0, passo = Math.max(1, (n / 4000) | 0), c = 0;
    for (i = 0; i < n; i += passo) { var q = i * 4; soma += 0.299 * d[q] + 0.587 * d[q + 1] + 0.114 * d[q + 2]; c++; }
    if (!c || soma / c >= 118) return img;                 // fundo já é claro
    var out = new Uint8Array(n * 4);
    for (i = 0; i < n; i++) {
      var o = i * 4;
      out[o] = 255 - d[o]; out[o + 1] = 255 - d[o + 1]; out[o + 2] = 255 - d[o + 2]; out[o + 3] = 255;
    }
    return { data: out, width: img.width, height: img.height };
  }
  function applyOcrTextCheck() {
    // fim de pipeline sem OCR? devolve a memória do pdfium (heap não encolhe sozinho)
    function pdfDone() { if (window.ACPdf) ACPdf.reset(); }
    // ===================================================================================
    // OCR de texto por STRING INTEIRA (v23) DESLIGADO — 23/07/2026.
    // Prova visual (scratchpad) mostrou que, no modo forma (original×tratado), a seleção
    // por resíduo entrega FOTO/gráfico ao OCR -> lê lixo e emite FALSOS; a troca pequena
    // (0763, 28g) nem sobressai como região (o resíduo fica todo na foto/trapping/fundo).
    // Decisão do Henrique: focar no FORTE real = rev×rev (mesma arte, 2 revisões), onde o
    // pixel-diff crava a mudança. Validado no scratchpad: identidade revA×revA = 0 comps;
    // marca de 6px (menor que um ponto) = 1 comp exatamente no local, modo cor, 0 falso.
    // Marcadores vagos de texto já são escondidos pelo applyMode, então o forma fica
    // silencioso (só objeto/foto/faca reais), não ruidoso. Backup do v23 e o material do
    // v22 (ocrPairs/verifyTokens) estão no scratchpad p/ reativar com detecção de linha
    // real + OCR melhor no futuro.
    pdfDone(); return false;
    // eslint-disable-next-line no-unreachable  (código do v23 mantido p/ referência abaixo)
    if (!RESULT || RESULT.mode !== "forma" || !window.ACOcr || !window.ACPdf) { pdfDone(); return false; }
    if (!(F.pdf && O.pdf)) { pdfDone(); return false; }
    var regs = RESULT.textRegions;
    // ===== REDE DE SEGURANÇA (ideia do Henrique) =====
    // O pixel não acusou nada? Antes de dizer "sem divergências", o OCR confere TODAS
    // as linhas de texto. É exatamente quando o operador precisa de certeza — e é o
    // caso em que uma troca pequena (28→29 num texto com trapping) escapa do pixel.
    var reais = 0, cR;
    for (cR = 0; cR < RESULT.comps.length; cR++) {
      var c0R = RESULT.comps[cR];
      if (c0R.type === "ok") continue;                       // barcode/QR conferido não conta
      if (c0R.kind === "text" && !c0R.textFile && !c0R.textOrig) continue;   // marcador vago
      reais++;
    }
    if (reais === 0 && window.ACText && window.ACText.findRestyledRegions) {
      try {
        var rrV = window.ACText.findRestyledRegions(RESULT.fileImg, RESULT.origImg, { varreduraTotal: true });
        if (rrV && rrV.regions && rrV.regions.length) {
          regs = RESULT.textRegions = rrV.regions;
          if (rrV.resid) RESULT.textResid = rrV.resid;
          RESULT._varredura = true;
        }
      } catch (eV) {}
    }
    if (!regs || !regs.length) { pdfDone(); return false; }
    var reqId = (RESULT._ocrReq = (RESULT._ocrReq || 0) + 1);
    // linhas das regiões que o pixel-diff marcou como texto (com o retângulo na página)
    var lines = [], ri;
    // conta residual (o que MUDOU de verdade) dentro de um retângulo — pontua o segmento
    function residCount(sg) {
      var rd = RESULT.textResid; if (!rd) return 1e9;   // sem residual? não filtra
      var Wr = RESULT.W, c = 0, x, y, x1 = Math.min(RESULT.W, sg.x + sg.w), y1 = Math.min(RESULT.H, sg.y + sg.h);
      for (y = sg.y; y < y1; y++) { var row = y * Wr; for (x = sg.x; x < x1; x++) if (rd[row + x]) c++; }
      return c;
    }
    for (ri = 0; ri < regs.length; ri++) {
      // região de RESÍDUO CONCENTRADO (conc): a troca é curta dentro de uma linha longa,
      // então a densidade média é baixa por natureza — o filtro abaixo a mataria.
      var isConc = !!regs[ri].conc;
      var subs = splitRegionLines(regs[ri]), si, gi;
      for (si = 0; si < subs.length; si++) {
        var ln = subs[si];
        if (ln.h < 10 || ln.w < 20) continue;                      // ruído / tira de sangria
        if (ln.h > 70) continue;                                   // não é LINHA de texto (bloco/foto) — OCR leria lixo
        var segs = ln.w > 520 ? segmentLine(ln) : [ln];            // painéis distintos = leituras separadas
        for (gi = 0; gi < segs.length; gi++) {
          var sg = segs[gi];
          if (sg.h < 10 || sg.w < 20) continue;
          // na VARREDURA (conferência ampla), linha SEM nenhum resíduo é texto
          // idêntico pixel a pixel — não gasta OCR com ela.
          if (residCount(sg) === 0) continue;   // pixel IDÊNTICO nos 2 lados = texto igual -> não lê
          sg.resid = isConc ? 1e9 : residCount(sg);
          if (sg.resid < 8) continue;           // resíduo desprezível = ruído de borda, não muda texto
          sg.region = ri; lines.push(sg);
        }
      }
    }
    // ordena por RESÍDUO TOTAL (não densidade): uma troca curta numa linha longa tem
    // densidade baixa mas resíduo real — a string inteira decide se é troca ou trapping.
    lines.sort(function (a, b) { return b.resid - a.resid; });
    var tetoL = 26;                            // teto de linhas (tempo ~2-3min no pior caso)
    if (lines.length > tetoL) lines = lines.slice(0, tetoL);
    if (!lines.length) { pdfDone(); return false; }
    var touchedReg = {};
    RESULT._ocrMsg = "lendo textos (OCR)…"; setStatus("lendo textos (OCR)…", false, true);

    // ===== COMPARAÇÃO DE STRING INTEIRA (estilo GlobalVision Text Inspection) =====
    // Renderiza cada linha em ALTA RESOLUÇÃO nos 2 lados, lê o TEXTO COMPLETO (letra,
    // número E acento) e compara as strings da esquerda p/ a direita. Erro de OCR é
    // comum aos 2 lados e se cancela; a diferença REAL é localizada por prefixo/sufixo
    // comum. Sem regras de dígito frágeis. O pixel cuida do resto (objeto/faca/foto),
    // sempre ignorando as regiões de texto.
    var TGT = 150;   // altura-alvo da linha no recorte -> caractere legível p/ o OCR
    var items = [], itemsO = [], li3;
    for (li3 = 0; li3 < lines.length; li3++) {
      var L3 = lines[li3], mx3 = L3.w * 0.02 + 8, my3 = L3.h * 0.5 + 4, prA, prB;
      try { prA = toPageRect(Math.max(0, L3.x - mx3), Math.max(0, L3.y - my3), L3.w + 2 * mx3, L3.h + 2 * my3); } catch (e3a) { prA = null; }
      try { prB = toPageRectO(Math.max(0, L3.x - mx3), Math.max(0, L3.y - my3), L3.w + 2 * mx3, L3.h + 2 * my3); } catch (e3b) { prB = null; }
      items.push({ pr: prA || { x: 0, y: 0, w: 0.001, h: 0.001 }, target: TGT });
      itemsO.push({ pr: prB || { x: 0, y: 0, w: 0.001, h: 0.001 }, target: TGT });
    }
    setStatus("lendo textos (OCR) — 0/" + lines.length, false, true);
    renderCropsHi(F, items, TGT, function (fT) {
      if (!RESULT || RESULT._ocrReq !== reqId) return;
      renderCropsHi(O, itemsO, TGT, function (oT) {
        if (!RESULT || RESULT._ocrReq !== reqId) return;
        runLineDiff(lines, fT, oT, reqId);
      });
    });
    return true;   // OCR começou; a lista sai no finish()
  }

  // Lê o TEXTO COMPLETO de cada linha nos 2 lados e localiza a diferença por STRING.
  function runLineDiff(lines, fT, oT, reqId) {
    var total = lines.length, k = 0, added = 0, readOk = 0, firstErr = null;
    function finish() {
      if (!RESULT || RESULT._ocrReq !== reqId) return;
      for (var t = RESULT.comps.length - 1; t >= 0; t--) {   // tira marcadores vagos
        var pc = RESULT.comps[t];
        if (pc.kind === "text" && !pc.textFile && !pc.textOrig) RESULT.comps.splice(t, 1);
      }
      var diag = firstErr || OCR_INIT_ERR;
      RESULT._ocrMsg = readOk === 0
        ? "⚠ OCR não rodou" + (diag ? " [" + diag + "]" : "") + " — blocos marcados p/ conferir"
        : (added ? ("texto: " + added + " diferença(s)") : "textos conferidos ✓") + "  [" + readOk + "/" + total + " linhas]";
      setStatus(""); renderResult();
      if (window.ACPdf) ACPdf.reset();
    }
    function ocrText(img) {
      var sec = { id: 0, x: 0, y: 0, w: img.width, h: img.height, numeric: false, psm: "7" };
      return window.ACOcr.readSections(img, [sec], { upscale: 1 }).then(function (r) { return (r[0] && r[0].text) || ""; });
    }
    function norm(s) { return String(s || "").replace(/\s+/g, " ").replace(/^ | $/g, ""); }
    function alnum(s) { return String(s || "").replace(/[^0-9A-Za-zÀ-ÿ]/g, ""); }
    // localiza a diferença: prefixo + sufixo comum; o miolo é a troca. Se a maior parte
    // NÃO casa (matched/total baixo), as duas leituras divergem em tudo = ruído -> ignora.
    function strDiff(a, b) {
      var A = norm(a), B = norm(b);
      if (A === B) return null;
      var la = A.length, lb = B.length, mn = Math.min(la, lb), p = 0;
      while (p < mn && A.charAt(p) === B.charAt(p)) p++;
      var s = 0; while (s < la - p && s < lb - p && A.charAt(la - 1 - s) === B.charAt(lb - 1 - s)) s++;
      var midA = A.slice(p, la - s), midB = B.slice(p, lb - s);
      var matched = p + s, tot = Math.max(la, lb);
      if (tot < 4 || matched < 4) return null;                     // strings curtas/ilegíveis
      if (matched / tot < 0.55) return null;                       // diferem em tudo = ruído
      if (Math.max(midA.length, midB.length) > 14) return null;    // miolo grande = bloco, não troca
      if (alnum(midA) === alnum(midB)) return null;                // só espaço/pontuação = ruído
      return { O: midA, F: midB, p: p, la: la };
    }
    function step() {
      if (!RESULT || RESULT._ocrReq !== reqId) return;
      if (k >= total) return finish();
      var L = lines[k], fR = fT[k], oR = oT[k];
      if (!fR || !oR) { k++; return respira(step); }
      setStatus("lendo textos (OCR) — " + (k + 1) + "/" + total, false, true);
      var pre = (k > 0 && k % 6 === 0 && window.ACOcr.terminate) ? window.ACOcr.terminate() : Promise.resolve();
      pre.then(function () { return ocrText(fR.img); }).then(function (tF) {
        return ocrText(oR.img).then(function (tO) {
          if (!RESULT || RESULT._ocrReq !== reqId) return;
          readOk++;
          var d = strDiff(tO, tF);
          if (d) {
            var frac = d.la > 0 ? d.p / d.la : 0.4;
            var px = Math.round(L.x + frac * L.w);
            var pw2 = Math.max(12, Math.round(L.w * (Math.max(d.O.length, d.F.length) + 1) / Math.max(1, d.la)));
            var tp = !alnum(d.F) ? "miss" : !alnum(d.O) ? "extra" : "diff";
            RESULT.comps.push({ x: Math.max(0, px - (pw2 >> 1)), y: L.y, w: pw2, h: L.h,
                                cx: px, cy: L.y + (L.h >> 1), area: Math.max(1, pw2 * L.h),
                                type: tp, kind: "text", textOrig: d.O, textFile: d.F, region: L.region, ids: [] });
            added++;
          }
          k++; respira(step);
        });
      }).catch(function (e) { if (!RESULT || RESULT._ocrReq !== reqId) return; if (!firstErr) firstErr = String((e && e.message) || e).slice(0, 120); k++; respira(step); });
    }
    step();
  }

  function applyMode() {
    if (!RESULT) return;
    if (!RESULT.ignored) RESULT.ignored = {};
    var ms = modeSet();
    RESULT.view = RESULT.comps.filter(function (c) {
      // marcador de texto VAGO (sem leitura) nunca entra na lista — ou o OCR confirmou
      // (tem texto) ou não é divergência. Evita "muitos textos" que não são nada.
      if (c.kind === "text" && !c.textFile && !c.textOrig) return false;
      return ms[c.type] && !RESULT.ignored[keyOf(c)];
    });
    RESULT.view.forEach(function (c) { c.px = Math.round(c.cx / RESULT.W * 100); c.py = Math.round(c.cy / RESULT.H * 100); });
    RESULT.overlayView = window.ACEngine.overlay(RESULT.fileImg, RESULT.lab, RESULT.view, RESULT.W, RESULT.H);
    RESULT.canOverlay = imgToCanvas(RESULT.overlayView);
    // "ok" (barcode/QR confere, verde) é informativo — NÃO conta como divergência
    $("sumTotal").textContent = RESULT.view.filter(function (c) { return c.type !== "ok" && c.type !== "check"; }).length;
    // contagens = SÓ o que está VISÍVEL (exclui ignorados: faca/cotas/foto/spots)
    var vc = { miss: 0, extra: 0, diff: 0 };
    RESULT.view.forEach(function (c) { if (vc[c.type] != null) vc[c.type]++; });
    $("sumMiss").textContent = vc.miss;
    $("sumExtra").textContent = vc.extra;
    $("sumDiff").textContent = vc.diff;
    buildDiffList();
    ACTIVE = -1;
    drawOverlay(-1);
    $("zoomRow").style.display = "none";
    // trava o relatorio quando ha muitas diferencas (provavel desalinhamento/ruido)
    var noisy = RESULT.view.length > REPORT_MAX;
    $("btnReport").disabled = noisy;
    $("btnReport").title = noisy
      ? "Muitas diferenças (" + RESULT.view.length + ") — provável desalinhamento. Ajuste o recorte (lupa) antes de gerar o relatório."
      : "Gerar relatório PDF no Desktop";
  }

  function isCropped(pane) {
    var c = pane.crop; return c && (c.x > 0.002 || c.y > 0.002 || c.w < 0.998 || c.h < 0.998);
  }

  function renderResult() {
    $("resultSection").style.display = "block";
    // novo resultado: para o piscar e volta o zoom pro encaixe
    if (BLINK.on) { $("ovBlink").checked = false; setBlink(false); }
    ovReset();
    var r = RESULT;
    r.canOrig = imgToCanvas(r.origImg);
    r.canFile = imgToCanvas(r.fileImg);
    // % de ENCAIXE honesto (align.q = fração de bordas casadas; ~95%+ = confiável).
    // A conf antiga (relativa) fica de reserva p/ resultados sem q.
    var conf = r.align.q != null ? Math.round(r.align.q * 100) : Math.round((r.align.conf || 0) * 100);
    var bothCrop = isCropped(O) && isCropped(F);
    // encaixe fraco = resultado NÃO confiável -> pede reajuste do recorte
    var suggerir = (r.align.q != null && r.align.q < 0.88) || (!bothCrop && r.comps.length > 60);
    var ai = $("alignInfo");
    // modo escolhido: cor (mesmo render) ou forma (tom/trapping diferente), auto ou forçado
    var modoTxt = r.mode === "forma"
      ? (r.modeAuto ? "modo forma (auto: tom diferente)" : "modo forma (você)")
      : "modo cor (auto: mesmo render)";
    // Barcode Inspection: leitura confere -> auditoria positiva na linha de status
    var bcTxt = (r.barcode && r.barcode.status === "confere")
      ? "  ·  ▮ barcode " + r.barcode.file + " ✓ confere" : "";
    var ocrTxt = r._ocrMsg ? "  ·  " + r._ocrMsg : "";
    // registro por rotação/escala (quando o auto detectou giro/escala real)
    var regTxt = "";
    if (r.align.ang) regTxt += "  ·  ↻ girou " + r.align.ang + "°";
    if (r.align.scl && r.align.scl !== 1) regTxt += "  ·  ⇱ escala " + Math.round(r.align.scl * 1000) / 10 + "%";
    // diagnóstico na barra: camadas técnicas ocultadas, escala aplicada e versão do
    // motor (se o v não bater com o do código, o CEP está com cache antigo)
    var tecTxt = "";
    if ((F._tec && F._tec.length) || (O._tec && O._tec.length)) {
      tecTxt = "  ·  ⚗ ocultadas: " + ((F._tec || []).concat(O._tec || []).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", "));
    }
    var sclTxt = (r.align.sx || r.align.sy)
      ? "  ·  ⇱ escala " + Math.round((r.align.sx || 1) * 1000) / 10 + "% × " + Math.round((r.align.sy || 1) * 1000) / 10 + "%" : "";
    var vTxt = window.ACEngine && window.ACEngine.v ? "  ·  v" + window.ACEngine.v : "";
    ai.textContent = "encaixe " + conf + "%" + regTxt + sclTxt + "  ·  " + modoTxt + tecTxt + bcTxt + ocrTxt + vTxt
      + (suggerir ? "  ·  ⚠ encaixe fraco — AJUSTE O RECORTE (▢) nos 2 lados e compare de novo" : "");
    ai.style.color = suggerir ? "var(--miss)" : "";
    applyMode();
  }

  var ACTIVE = -1;
  function buildDiffList() {
    var ul = $("diffList"); ul.innerHTML = "";
    var LABEL = { miss: "Faltando no arquivo", extra: "Sobrando no arquivo", diff: "Diferente" };
    RESULT.view.forEach(function (c, i) {
      c.px = Math.round(c.cx / RESULT.W * 100);
      c.py = Math.round(c.cy / RESULT.H * 100);
      var li = document.createElement("li");
      li.className = "diff-item " + c.type + (c.kind ? " k-" + c.kind : "");
      // itens especiais: código de barras mostra a LEITURA; texto mostra o tipo de inspeção
      var titulo;
      if (c.kind === "barcode") {
        var bcNome = c.qr ? "▦ QR code: " : "▮ Código de barras: ";
        titulo = bcNome + c.code +
                 (c.type === "ok" ? "  ✓ confere com o original"
                  : c.type === "diff" ? "  ✖ DIVERGE do original (" + (c.codeOrig || "?") + ")"
                                      : "  · aplicado (a mais que o original)");
      } else if (c.kind === "text") {
        if (c.type === "check") titulo = "⚠ Confira este texto: “" + (c.textOrig || "?") + "”  x  “" + (c.textFile || "?") + "”  (leitura incerta)";
        else if (!c.textFile && !c.textOrig) titulo = "T Texto diferente (clique p/ ampliar)";   // marcador de local (clicar mostra o zoom)
        else if (c.type === "diff") titulo = "T Texto trocado: " + (c.textOrig || "?") + " → " + (c.textFile || "?");
        else if (c.type === "miss") titulo = "T Texto faltando: " + (c.textOrig || "?");
        else titulo = "T Texto a mais: " + (c.textFile || "?");
      } else {
        titulo = LABEL[c.type];
      }
      li.innerHTML = '<span class="tag"></span><span class="di-main">' +
        '<div class="di-t">#' + (i + 1) + " · " + titulo + '</div>' +
        '<div class="di-s">' + c.px + "% , " + c.py + "%  ·  " + c.w + "×" + c.h + "px  ·  " + c.area + "px</div>" +
        '</span><button class="di-ig" title="Ignorar (some do resultado e do relatório)">✕</button>';
      li.addEventListener("click", function () { selectDiff(i); });
      li.querySelector(".di-ig").addEventListener("click", function (e) {
        e.stopPropagation();
        RESULT.ignored[keyOf(c)] = "manual";   // marcada à mão
        autoIgnoreSimilar();                    // some com as parecidas também
        applyMode();
      });
      ul.appendChild(li);
    });
    $("diffPos").textContent = RESULT.view.length ? "0 / " + RESULT.view.length : "sem divergências";
    var ic = ignoreCounts();
    var rb = $("diffRestore");
    if (rb) {
      rb.style.display = ic.total ? "inline-block" : "none";
      // detalha origem: você marcou / parecidas / faca-cotas-foto
      var partes = [];
      if (ic.man) partes.push(ic.man + " você");
      if (ic.auto) partes.push(ic.auto + " parecida" + (ic.auto > 1 ? "s" : ""));
      if (ic.struct) partes.push(ic.struct + " faca/cota/foto");
      rb.textContent = "↺ " + ic.total + " ignorada(s)" + (partes.length ? " (" + partes.join(" · ") + ")" : "");
      rb.title = "Restaurar as ignoradas";
    }
  }

  function selectDiff(i) {
    ACTIVE = i;
    var items = $("diffList").children;
    for (var k = 0; k < items.length; k++) items[k].classList.toggle("active", k === i);
    if (i >= 0 && items[i]) items[i].scrollIntoView({ block: "nearest" });
    $("diffPos").textContent = (i + 1) + " / " + RESULT.view.length;
    drawOverlay(i);
    // leva a divergência escolhida para o CENTRO do viewer. Se a marca é pequena,
    // aproxima o bastante pra ela aparecer (sem nunca AFASTAR o que o operador ampliou).
    if (i >= 0 && RESULT.view[i]) {
      var c9 = RESULT.view[i];
      var alvo = Math.max(c9.w, c9.h) || 1;
      var zSug = Math.max(1, Math.min(8, (RESULT.W * 0.16) / alvo));   // marca ~16% da largura
      ovFocus(c9.cx, c9.cy, zSug);
    }
    drawZoom(i);
    fsSync();          // barra da tela cheia acompanha a seleção
  }

  // zoom do objeto selecionado: Original / Arquivo / Diferença ampliados no ponto
  function drawZoom(i) {
    var row = $("zoomRow");
    if (i < 0 || !RESULT.view[i]) { row.style.display = "none"; return; }
    row.style.display = "flex";
    var c = RESULT.view[i], pad = Math.min(140, Math.max(14, Math.round(Math.max(c.w, c.h) * 0.9)));
    var sx = Math.max(0, c.x - pad), sy = Math.max(0, c.y - pad);
    var ex = Math.min(RESULT.W, c.x + c.w + pad), ey = Math.min(RESULT.H, c.y + c.h + pad);
    var box = { sx: sx, sy: sy, sw: ex - sx, sh: ey - sy };
    paintZoom($("zoomOrig"), RESULT.canOrig, box, c);
    paintZoom($("zoomFile"), RESULT.canFile, box, c);
    paintZoom($("zoomDiff"), RESULT.canOverlay, box, c);
  }
  function paintZoom(cv, srcCanvas, box, blob) {
    var CW = cv.clientWidth || 220, CH = cv.clientHeight || 160;
    cv.width = CW; cv.height = CH;
    var g = cv.getContext("2d");
    g.fillStyle = "#0c1420"; g.fillRect(0, 0, CW, CH);
    var sc = Math.min(CW / box.sw, CH / box.sh);
    var dw = box.sw * sc, dh = box.sh * sc, ox = (CW - dw) / 2, oy = (CH - dh) / 2;
    g.imageSmoothingEnabled = true;
    g.drawImage(srcCanvas, box.sx, box.sy, box.sw, box.sh, ox, oy, dw, dh);
    g.strokeStyle = "#33ae5b"; g.lineWidth = 1.5;
    g.strokeRect(ox + (blob.x - box.sx) * sc, oy + (blob.y - box.sy) * sc, blob.w * sc, blob.h * sc);
  }

  // PISCAR (flicker de proofing): alterna ORIGINAL ↔ ARQUIVO puros — a diferença "pula"
  var BLINK = { on: false, phase: 0, timer: null };
  function setBlink(on) {
    BLINK.on = on;
    if (BLINK.timer) { clearInterval(BLINK.timer); BLINK.timer = null; }
    if (on && RESULT) {
      BLINK.timer = setInterval(function () {
        if (!RESULT || !BLINK.on) { if (BLINK.timer) clearInterval(BLINK.timer); BLINK.timer = null; return; }
        BLINK.phase = 1 - BLINK.phase; drawOverlay(ACTIVE);
      }, 550);
    }
    if (RESULT) drawOverlay(ACTIVE);
  }

  function drawOverlay(highlight) {
    var cv = $("overlayCanvas");
    cv.width = RESULT.W; cv.height = RESULT.H;
    var g = cv.getContext("2d");
    var img = BLINK.on ? (BLINK.phase ? RESULT.origImg : RESULT.fileImg)
                       : ($("ovSwap").checked ? RESULT.origImg : RESULT.overlayView);
    g.putImageData(img, 0, 0);
    if (BLINK.on) {   // selo de qual lado está na tela
      var fs = Math.max(18, RESULT.W / 60);
      g.font = "bold " + fs + "px sans-serif";
      var lbl = BLINK.phase ? "ORIGINAL" : "ARQUIVO";
      g.fillStyle = BLINK.phase ? "rgba(220,38,38,.92)" : "rgba(37,99,235,.92)";
      g.fillRect(10, 10, g.measureText(lbl).width + fs, fs * 1.6);
      g.fillStyle = "#fff"; g.textBaseline = "middle";
      g.fillText(lbl, 10 + fs * 0.5, 10 + fs * 0.8);
    }
    if (highlight >= 0 && RESULT.view[highlight]) {
      var c = RESULT.view[highlight], pad = 3;
      g.lineWidth = Math.max(2, RESULT.W / 400); g.strokeStyle = "#33ae5b";
      g.strokeRect(c.x - pad, c.y - pad, c.w + 2 * pad, c.h + 2 * pad);
    }
  }

  // ===== VIEWER (zoom/pan estilo Esko) =====
  // Tudo por TRANSFORM (translate+scale, origem 0 0): a GPU compõe, não há reflow nem
  // scroll — é isso que dá a resposta imediata. OVX/OVY = deslocamento em px da janela.
  // OVZ = 1 é "ajustado à tela" (o canvas tem width:100% do wrap).
  var OVZ = 1, OVX = 0, OVY = 0, OVZMAX = 40;
  function ovBase() {   // geometria do fit: escala que faz a arte INTEIRA caber na janela
    var cv = $("overlayCanvas"), wrap = $("ovWrap");
    var vw = wrap.clientWidth || 1, vh = wrap.clientHeight || 1;
    var cw = cv.width || 1, ch = cv.height || 1;
    var fs = Math.min(vw / cw, vh / ch);
    return { fs: fs, w: cw * fs, h: ch * fs, vw: vw, vh: vh };
  }
  function ovClamp() {   // não deixa a arte fugir da janela
    var b = ovBase(), cw = b.w * OVZ, ch = b.h * OVZ;
    // Menor que a janela: mantém DENTRO dela, mas NÃO força o centro — forçar o centro
    // atropelava a âncora do cursor e dava a sensação de "o zoom vai pro lado errado".
    if (cw <= b.vw) OVX = Math.max(0, Math.min(b.vw - cw, OVX));
    else OVX = Math.min(0, Math.max(b.vw - cw, OVX));
    if (ch <= b.vh) OVY = Math.max(0, Math.min(b.vh - ch, OVY));
    else OVY = Math.min(0, Math.max(b.vh - ch, OVY));
  }
  function ovApply() {
    var cv = $("overlayCanvas"), b = ovBase();
    ovClamp();
    // escala TOTAL = fit × zoom do operador (o canvas fica no tamanho natural no DOM)
    var sc = b.fs * OVZ;
    cv.style.transform = "translate3d(" + OVX.toFixed(2) + "px," + OVY.toFixed(2) + "px,0) scale(" + sc.toFixed(5) + ")";
    // ampliado além da resolução da imagem -> mostra o PIXEL (não borra)
    cv.style.imageRendering = sc > 1.05 ? "pixelated" : "-webkit-optimize-contrast";
    var pct = Math.round(OVZ * 100) + "%";
    var zl = $("ovZoomLbl"); if (zl) zl.textContent = pct;
    var zl2 = $("ovZoomLbl2"); if (zl2) zl2.textContent = pct;
  }
  // zoom mantendo o ponto (px da janela) EXATAMENTE sob o cursor
  function ovZoomAt(f, mx, my) {
    var b = ovBase(), z0 = OVZ;
    OVZ = Math.max(1, Math.min(OVZMAX, OVZ * f));
    if (OVZ === z0) return;
    if (mx == null) { mx = b.vw / 2; my = b.vh / 2; }
    OVX = mx - (mx - OVX) * (OVZ / z0);
    OVY = my - (my - OVY) * (OVZ / z0);
    ovApply();
  }
  function ovReset() {   // ajustar à tela: zoom 1 e arte CENTRADA na janela
    var b;
    OVZ = 1; OVX = 0; OVY = 0;
    b = ovBase();
    OVX = (b.vw - b.w) / 2; OVY = (b.vh - b.h) / 2;
    ovApply();
  }
  function ovApplyZoom() { ovApply(); }                 // compat: chamadas antigas
  function ovZoomBy(f) { ovZoomAt(f, null, null); }     // botões +/−
  // ===== TELA CHEIA de inspeção =====
  // Move o PRÓPRIO #ovWrap para o container full (não duplica canvas): zoom, marcações
  // e piscar continuam sendo os mesmos objetos — nada para sincronizar ou re-desenhar.
  var FS_ON = false, FS_HOME = null;
  function fsSync() {
    if (!FS_ON) return;
    var n = RESULT && RESULT.view ? RESULT.view.length : 0;
    $("fsPos").textContent = n ? ((ACTIVE >= 0 ? ACTIVE + 1 : 0) + " / " + n) : "—";
    var d = "";
    if (RESULT && ACTIVE >= 0 && RESULT.view[ACTIVE]) {
      var c = RESULT.view[ACTIVE];
      d = c.kind === "barcode" ? ((c.qr ? "QR: " : "Código: ") + (c.code || ""))
        : c.kind === "text" ? ("Texto: " + (c.textOrig || "?") + (c.textFile ? " → " + c.textFile : ""))
        : ({ miss: "Faltando no arquivo", extra: "Sobrando no arquivo", diff: "Diferente", ok: "Confere" }[c.type] || "");
    }
    $("fsDesc").textContent = d;
    $("fsBlink").checked = $("ovBlink").checked;
    $("fsSwap").checked = $("ovSwap").checked;
  }
  function fsOpen() {
    if (FS_ON || !RESULT) return;
    var wrap = $("ovWrap"), full = $("ovFull");
    FS_HOME = { parent: wrap.parentNode, next: wrap.nextSibling };
    $("ovFullBody").appendChild(wrap);
    wrap.classList.add("full");
    full.style.display = "flex";
    FS_ON = true;
    setTimeout(function () { ovReset(); fsSync(); }, 20);   // espera o layout medir a janela nova
  }
  function fsClose() {
    if (!FS_ON) return;
    var wrap = $("ovWrap");
    wrap.classList.remove("full");
    if (FS_HOME && FS_HOME.parent) FS_HOME.parent.insertBefore(wrap, FS_HOME.next || null);
    $("ovFull").style.display = "none";
    FS_ON = false;
    setTimeout(function () { ovReset(); }, 20);
  }
  // centraliza uma divergência (px da imagem) na janela, no zoom atual (ou no mínimo pedido)
  function ovFocus(cx, cy, zMin) {
    if (!RESULT) return;
    var b = ovBase();
    if (zMin && OVZ < zMin) OVZ = Math.min(OVZMAX, zMin);
    OVX = b.vw / 2 - (cx / RESULT.W) * b.w * OVZ;
    OVY = b.vh / 2 - (cy / RESULT.H) * b.h * OVZ;
    ovApply();
  }

  // ============ RELATORIO ============
  function getLogoDataURL(cb) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = img.naturalWidth || 200; c.height = img.naturalHeight || 90;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
      try { cb(c.toDataURL("image/png"), c.width / c.height); } catch (e) { cb(null, 2); }
    };
    img.onerror = function () { cb(null, 2); };
    img.src = "./img/logo_alpha.png";
  }
  function thumbURL(imgData, maxW) {
    var c = document.createElement("canvas");
    c.width = imgData.width; c.height = imgData.height;
    c.getContext("2d").putImageData(imgData, 0, 0);
    var sc = Math.min(1, maxW / c.width);
    var o = document.createElement("canvas");
    o.width = Math.round(c.width * sc); o.height = Math.round(c.height * sc);
    o.getContext("2d").drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL("image/png");
  }
  // monta a foto (Original | Arquivo | Diferença) ampliada de uma divergência.
  // As células seguem a proporção do recorte (sem esticar). Retorna {url, aspect}.
  function makeDiffMontage(c) {
    var pad = Math.max(14, Math.round(Math.max(c.w, c.h) * 0.9));
    var sx = Math.max(0, c.x - pad), sy = Math.max(0, c.y - pad);
    var ex = Math.min(RESULT.W, c.x + c.w + pad), ey = Math.min(RESULT.H, c.y + c.h + pad);
    var bw = ex - sx, bh = ey - sy;
    var CH = 150, CW = Math.max(70, Math.min(Math.round(CH * bw / bh), 420));
    var gap = 6, W = CW * 3 + gap * 2, H = CH;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var g = cv.getContext("2d");
    g.fillStyle = "#0c1420"; g.fillRect(0, 0, W, H);
    var srcs = [RESULT.canOrig, RESULT.canFile, RESULT.canOverlay];
    for (var i = 0; i < 3; i++) {
      var offx = i * (CW + gap);
      var sc = Math.min(CW / bw, CH / bh), dw = bw * sc, dh = bh * sc;
      var dx = offx + (CW - dw) / 2, dy = (CH - dh) / 2;
      g.imageSmoothingEnabled = true;
      g.drawImage(srcs[i], sx, sy, bw, bh, dx, dy, dw, dh);
      g.strokeStyle = "#33ae5b"; g.lineWidth = 1.3;
      g.strokeRect(dx + (c.x - sx) * sc, dy + (c.y - sy) * sc, c.w * sc, c.h * sc);
    }
    return { url: cv.toDataURL("image/png"), aspect: W / H };
  }

  function gerarRelatorio() {
    if (!RESULT) { setStatus("Rode uma comparação primeiro.", true); return; }
    if (RESULT.view.length > REPORT_MAX) { setStatus("Muitas diferenças — ajuste o recorte antes de gerar o relatório.", true); return; }
    if (!DESKTOP) { setStatus("Sem caminho do Desktop (Illustrator conectado?)", true); return; }
    // DESTINO OBRIGATÓRIO = _reference do JOB. Se o original veio do job, já sabemos a
    // pasta; senão o operador PRECISA digitar a O.S. (rastreabilidade do relatório).
    var refDir = null;
    try {
      if (O.srcPath && /[\\\/]original[\\\/][^\\\/]+$/i.test(O.srcPath)) {
        var pth0 = require("path");
        refDir = pth0.join(pth0.dirname(pth0.dirname(O.srcPath)), "reference");
      }
    } catch (eR0) {}
    if (refDir) { gerarRelatorioEm(refDir); return; }
    var osj = osDigits();
    if (osj.length < 5) {
      setStatus("Digite a O.S. do job (campo no topo) — o relatório é salvo na pasta reference do job.", true);
      try { $("os").focus(); } catch (eF0) {}
      return;
    }
    setStatus("localizando pasta do job " + osj + "…", false, true);
    evalScript("acPastaJob('" + osj + "')", function (r) {
      if (r && r.indexOf("OK|") === 0) {
        try { gerarRelatorioEm(require("path").join(r.substring(3), "reference")); }
        catch (eJ) { gerarRelatorioEm(null); }
      } else if (r && r.indexOf("NAO|") === 0) {
        setStatus("O.S. " + osj + " não encontrada no Engine — confira o número.", true);
        try { $("os").focus(); } catch (eF1) {}
      } else {
        // Engine inacessível: não trava o operador — salva no Desktop com aviso
        gerarRelatorioEm(null);
      }
    });
  }

  function gerarRelatorioEm(reportDirResolved) {
    setStatus("gerando relatório…", false, true);
    getLogoDataURL(function (logo, logoAspect) {
      var now = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
      var dateStr = pad(now.getDate()) + "/" + pad(now.getMonth() + 1) + "/" + now.getFullYear() +
        " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
      var stamp = "" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
        pad(now.getHours()) + pad(now.getMinutes());
      var vc = { miss: 0, extra: 0, diff: 0 };
      RESULT.view.forEach(function (c) { if (vc[c.type] != null) vc[c.type]++; });
      var modeLabel = MODE === "miss" ? "Só faltando" : MODE === "struct" ? "Faltando + Sobrando" : "Tudo";
      var shots = RESULT.view.slice(0, 16).map(function (c, i) {
        var m = makeDiffMontage(c);
        return { n: i + 1, type: c.type, kind: c.kind || "", code: c.code || "", codeOrig: c.codeOrig || "", qr: !!c.qr,
                 textFile: c.textFile || "", textOrig: c.textOrig || "",
                 px: c.px, py: c.py, w: c.w, h: c.h, area: c.area, img: m.url, aspect: m.aspect };
      });
      // seção "Ignoradas": tudo que o operador tirou da conferência, com o motivo
      function descIgnorada(c) {
        if (c.kind === "barcode") return (c.qr ? "QR code " : "Codigo de barras ") + (c.code || "");
        if (c.kind === "text") return "Texto: " + (c.textOrig || "?") + (c.textFile ? " -> " + c.textFile : " (bloco)");
        return { miss: "Faltando no arquivo", extra: "Sobrando no arquivo", diff: "Diferente" }[c.type] || c.type;
      }
      var ignoredItems = [];
      RESULT.comps.forEach(function (c) {
        var v = RESULT.ignored && RESULT.ignored[keyOf(c)];
        if (!v || v === "hide") return;   // silenciosos não entram
        var motivo = v === "manual" ? "marcada pelo operador"
                   : v === "auto" ? "parecida com uma marcada"
                   : v === "struct" ? "faca/cota/foto" : String(v);
        ignoredItems.push({ desc: descIgnorada(c), motivo: motivo,
                            pos: Math.round(c.cx / RESULT.W * 100) + "%, " + Math.round(c.cy / RESULT.H * 100) + "%",
                            dims: (c.w | 0) + "x" + (c.h | 0) + "px" });
      });
      // destino já resolvido pelo gerarRelatorio (job direto ou via O.S. digitada);
      // null = Engine inacessível -> Desktop com aviso
      var reportDir = reportDirResolved;
      var res = window.ACReport.generate({
        reportDir: reportDir,
        desktopPath: DESKTOP, logo: logo, logoAspect: logoAspect || 2,
        os: $("os").value || "", job: F.name || O.name || "", dateStr: dateStr, stamp: stamp,
        tol: readTol(), modeLabel: modeLabel, total: RESULT.view.length, counts: vc, ignored: ignoreCounts(),
        ignoredItems: ignoredItems,
        barcode: RESULT.barcode || null, compareMode: RESULT.mode || "cor", imgAspect: RESULT.W / RESULT.H,
        align: RESULT.align, manual: MANUAL, comps: RESULT.view, shots: shots,
        images: { orig: thumbURL(RESULT.origImg, 700), file: thumbURL(RESULT.fileImg, 700), overlay: thumbURL(RESULT.overlayView, 700) }
      });
      if (res.ok) setStatus(res.where === "reference"
        ? "Relatório salvo na pasta reference do job: " + res.path.split(/[\\/]/).pop()
        : "Relatório salvo no Desktop: " + res.path.split(/[\\/]/).pop() + (reportDir ? "  (⚠ _reference inacessível)" : ""));
      else setStatus("Erro no relatório: " + res.msg, true);
    });
  }

  // ============ helpers UI ============
  function setStatus(msg, err, busy) {
    var el = $("statusMsg");
    el.textContent = msg || "";
    el.className = "status-msg" + (err ? " err" : busy ? " busy" : "");
  }
  function updateCompareEnabled() {
    $("btnCompare").disabled = !((O.src || F.src) || osDigits().length >= 5);
  }

  // limpa tudo p/ começar outro job
  function resetPane(pane, infoText) {
    pane.rawSrc = null; pane.src = null; pane.rot = 0; pane.crop = null; pane.fit = null;
    pane.pdf = false; pane.bytes = null; pane.hideL = {}; pane.hideC = {}; pane.hideImg = false; pane.struct = null; closePrep(pane);
    var pb = $(pane.ids.prepBtn); if (pb) pb.style.display = "none";
    pane.page = 1; pane.pages = 1;
    pane.name = ""; pane.pageW = null; pane.pageH = null; pane._onLoaded = null;
    var cv = $(pane.ids.canvas); if (cv) cv.style.display = "none";
    var box = $(pane.ids.box); if (box) box.style.display = "none";
    var hint = document.querySelector(pane.ids.hint); if (hint) hint.style.display = "";
    var nav = $(pane.ids.pdfNav); if (nav) nav.style.display = "none";
    $(pane.ids.info).textContent = infoText;
    var inp = $(pane.ids.input); if (inp) inp.value = "";
  }
  function resetAll() {
    RESULT = null; ACTIVE = -1;
    BLINK.on = false; if (BLINK.timer) { clearInterval(BLINK.timer); BLINK.timer = null; }
    var bl = $("ovBlink"); if (bl) bl.checked = false;
    ovReset();
    if (window.ACPdf) ACPdf.reset();   // heap do WASM zerado — recupera de módulo morto/pesado
    resetPane(O, "nenhum arquivo");
    resetPane(F, "solte o PDF do arquivo");
    $("os").value = ""; $("jobName").textContent = "—";
    $("resultSection").style.display = "none";
    $("deskPicker").style.display = "none";
    $("loupe").style.display = "none";
    setStatus("");
    updateCompareEnabled();
  }

  // liga upload/drag/drop de um painel (dropzone + input + escolher)
  function wireUpload(pane, dropId, pickId, inputId) {
    var drop = $(dropId);
    on($(pickId), "click", function (e) { e.stopPropagation(); $(inputId).click(); });
    on(drop, "click", function () { if (!pane.src) $(inputId).click(); });
    on($(inputId), "change", function (e) { if (e.target.files[0]) loadFileIntoPane(pane, e.target.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { on(drop, ev, function (e) { e.preventDefault(); drop.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { on(drop, ev, function (e) { e.preventDefault(); drop.classList.remove("drag"); }); });
    on(drop, "drop", function (e) { if (e.dataTransfer.files[0]) loadFileIntoPane(pane, e.dataTransfer.files[0]); });
  }

  // ============ eventos ============
  function bind() {
    wireUpload(O, "origDrop", "btnOrigPickFile", "origFileInput");
    wireUpload(F, "fileDrop", "btnFilePickFile", "fileFileInput");

    on($("btnPullJob"), "click", function () { pullJob(null); });
    on($("os"), "keydown", function (e) { if (e.key === "Enter") pullJob(null); });
    on($("os"), "input", updateCompareEnabled);

    on($("sensBaixa"), "click", function () { setSens(0); });
    on($("sensMedia"), "click", function () { setSens(1); });
    on($("sensAlta"), "click", function () { setSens(2); });

    on($("origPagePrev"), "click", function () { if (O.page > 1) { O.page--; renderPdfPagePane(O); } });
    on($("origPageNext"), "click", function () { if (O.page < O.pages) { O.page++; renderPdfPagePane(O); } });
    on($("filePagePrev"), "click", function () { if (F.page > 1) { F.page--; renderPdfPagePane(F); } });
    on($("filePageNext"), "click", function () { if (F.page < F.pages) { F.page++; renderPdfPagePane(F); } });
    on($("btnOrigRotL"), "click", function () { rotatePane(O, -90); });
    on($("btnOrigRotR"), "click", function () { rotatePane(O, 90); });
    on($("btnFileRotL"), "click", function () { rotatePane(F, -90); });
    on($("btnFileRotR"), "click", function () { rotatePane(F, 90); });
    on($("btnOrigReset"), "click", function () { O.crop = null; if (O.src) { showPane(O); if (RESULT) setStatus("Recorte resetado — clique Comparar para atualizar.", false); } });
    on($("btnFileReset"), "click", function () { F.crop = null; if (F.src) { showPane(F); if (RESULT) setStatus("Recorte resetado — clique Comparar para atualizar.", false); } });
    on($("btnOrigPrep"), "click", function () { openPrep(O); });
    on($("btnFilePrep"), "click", function () { openPrep(F); });

    on($("btnReset"), "click", resetAll);
    on($("btnPullDesktop"), "click", pullDesktop);
    on($("deskPickerClose"), "click", function () { $("deskPicker").style.display = "none"; });
    on($("workRes"), "change", function () { WORKRES = +this.value; });
    on($("btnCompare"), "click", ensureThenCompare);
    on($("btnReport"), "click", gerarRelatorio);
    on($("ovSwap"), "change", function () { if ($("ovSwap").checked && $("ovBlink").checked) { $("ovBlink").checked = false; setBlink(false); } drawOverlay(ACTIVE); });
    on($("ovBlink"), "change", function () { if ($("ovBlink").checked && $("ovSwap").checked) $("ovSwap").checked = false; setBlink($("ovBlink").checked); });
    on($("ovZoomIn"), "click", function () { ovZoomBy(1.4); });
    on($("ovZoomOut"), "click", function () { ovZoomBy(1 / 1.4); });
    on($("ovZoomFit"), "click", function () { ovReset(); });
    // --- tela cheia de inspeção ---
    on($("ovFullBtn"), "click", fsOpen);
    on($("fsClose"), "click", fsClose);
    on($("fsZoomIn"), "click", function () { ovZoomBy(1.4); });
    on($("fsZoomOut"), "click", function () { ovZoomBy(1 / 1.4); });
    on($("fsZoomFit"), "click", function () { ovReset(); });
    on($("fsPrev"), "click", function () { if (RESULT && RESULT.view.length) { selectDiff((ACTIVE <= 0 ? RESULT.view.length : ACTIVE) - 1); fsSync(); } });
    on($("fsNext"), "click", function () { if (RESULT && RESULT.view.length) { selectDiff((ACTIVE + 1) % RESULT.view.length); fsSync(); } });
    on($("fsBlink"), "change", function () {
      $("ovBlink").checked = this.checked;
      if (this.checked) { $("ovSwap").checked = false; $("fsSwap").checked = false; }
      setBlink(this.checked);
    });
    on($("fsSwap"), "change", function () {
      $("ovSwap").checked = this.checked;
      if (this.checked && $("ovBlink").checked) { $("ovBlink").checked = false; $("fsBlink").checked = false; setBlink(false); }
      drawOverlay(ACTIVE);
    });
    // atalhos da inspeção: Esc sai · setas navegam · B pisca · F ajusta
    on(window, "keydown", function (e) {
      if (!FS_ON) return;
      var t = document.activeElement && document.activeElement.tagName;
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      if (e.key === "Escape") { fsClose(); e.preventDefault(); }
      else if (e.key === "ArrowRight") { $("fsNext").click(); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { $("fsPrev").click(); e.preventDefault(); }
      else if (e.key === "b" || e.key === "B") { $("fsBlink").checked = !$("fsBlink").checked; $("fsBlink").dispatchEvent(new Event("change")); e.preventDefault(); }
      else if (e.key === "f" || e.key === "F") { ovReset(); e.preventDefault(); }
    });
    // ===== VIEWER estilo Esko =====
    // roda = zoom NO CURSOR (o ponto sob o mouse não sai do lugar) · arrastar = pan
    // Shift+arrastar = retângulo de zoom · botão direito = afastar · 2 cliques = ajustar
    (function () {
      var cv = $("overlayCanvas"), wrap = $("ovWrap");
      var pan = null, mq = null, mqBox = null, raf = 0, pend = null;
      function local(e) { var r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      on(wrap, "wheel", function (e) {
        e.preventDefault();
        var p = local(e);
        // passo proporcional ao movimento da roda/trackpad = zoom contínuo, sem "pulo"
        var d = e.deltaY;
        if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= 100;
        var f = Math.exp(-d * 0.0022);
        if (f > 2) f = 2; if (f < 0.5) f = 0.5;
        ovZoomAt(f, p.x, p.y);
      });
      on(cv, "dblclick", function () { ovReset(); });
      on(cv, "contextmenu", function (e) { e.preventDefault(); });
      on(cv, "mousedown", function (e) {
        if (e.button === 2) { var p2 = local(e); ovZoomAt(0.7, p2.x, p2.y); e.preventDefault(); return; }
        if (e.button !== 0) return;
        if (e.shiftKey) {                                        // MARQUEE (retângulo de zoom)
          mq = { x0: e.clientX, y0: e.clientY };
          mqBox = document.createElement("div"); mqBox.className = "ov-marquee";
          document.body.appendChild(mqBox); e.preventDefault(); return;
        }
        var p = local(e);                                        // PAN direto (padrão de viewer)
        pan = { mx: p.x, my: p.y, ox: OVX, oy: OVY };
        cv.classList.add("panning"); e.preventDefault();
      });
      on(window, "mousemove", function (e) {
        if (pan) {
          var p = local(e);
          pend = { x: pan.ox + (p.x - pan.mx), y: pan.oy + (p.y - pan.my) };
          if (!raf) raf = requestAnimationFrame(function () {     // 1 update por frame = fluido
            raf = 0; if (!pend) return;
            OVX = pend.x; OVY = pend.y; pend = null; ovApply();
          });
          return;
        }
        if (!mq || !mqBox) return;
        var x = Math.min(mq.x0, e.clientX), y = Math.min(mq.y0, e.clientY);
        var w = Math.abs(e.clientX - mq.x0), h = Math.abs(e.clientY - mq.y0);
        mqBox.style.left = x + "px"; mqBox.style.top = y + "px";
        mqBox.style.width = w + "px"; mqBox.style.height = h + "px";
        mqBox.style.display = (w > 6 && h > 6) ? "block" : "none";
      });
      on(window, "mouseup", function (e) {
        if (pan) { pan = null; cv.classList.remove("panning"); return; }
        if (!mq) return;
        var x0 = Math.min(mq.x0, e.clientX), y0 = Math.min(mq.y0, e.clientY);
        var w = Math.abs(e.clientX - mq.x0), h = Math.abs(e.clientY - mq.y0);
        if (mqBox && mqBox.parentNode) mqBox.parentNode.removeChild(mqBox);
        mq = null; mqBox = null;
        if (w < 12 || h < 12) return;
        var wr = wrap.getBoundingClientRect();
        var selCx = x0 + w / 2 - wr.left, selCy = y0 + h / 2 - wr.top;      // centro da seleção (px janela)
        var b = ovBase();
        var f = Math.min(b.vw / w, b.vh / h);
        var z0 = OVZ; OVZ = Math.max(1, Math.min(OVZMAX, OVZ * f));
        // leva o centro da seleção para o centro da janela
        OVX = b.vw / 2 - (selCx - OVX) * (OVZ / z0);
        OVY = b.vh / 2 - (selCy - OVY) * (OVZ / z0);
        ovApply();
      });
      on(window, "resize", function () { ovApply(); });
    })();
    on($("modeSel"), "change", function () { MODE = this.value; applyMode(); });

    on($("diffPrev"), "click", function () { if (RESULT && RESULT.view.length) selectDiff((ACTIVE <= 0 ? RESULT.view.length : ACTIVE) - 1); });
    on($("diffNext"), "click", function () { if (RESULT && RESULT.view.length) selectDiff((ACTIVE + 1) % RESULT.view.length); });
    on($("diffRestore"), "click", function () { if (RESULT) { RESULT.ignored = {}; applyMode(); } });

    ["tolColor", "tolThick", "tolArea", "tolTrap"].forEach(function (id) {
      on($(id), "input", function () {
        $("tolColorV").textContent = $("tolColor").value;
        $("tolThickV").textContent = $("tolThick").value;
        $("tolAreaV").textContent = $("tolArea").value;
        if ($("tolTrapV")) $("tolTrapV").textContent = $("tolTrap").value;
        if (RESULT) scheduleCompare();
      });
    });
    on($("modoForma"), "change", function () {
      if (RESULT) setStatus("Modo alterado — clique Comparar para atualizar.", false);
    });
    on($("dpi"), "input", function () { $("dpiV").textContent = $("dpi").value; });

    attachCrop(O);
    attachCrop(F);

    var rz = null;
    on(window, "resize", function () {
      if (rz) clearTimeout(rz);
      rz = setTimeout(function () { if (O.src) showPane(O); if (F.src) showPane(F); }, 150);
    });
  }

  aplicarTema();
  bind();
  checarConexao();
  setInterval(checarConexao, 4000);

})();

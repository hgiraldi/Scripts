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
      return ACPdf.render(h, 0, null, Math.min(1.5, 800 / Math.max(sz.w, sz.h)));
    }, function (err, cv) {
      if (err) { pane.pdf = false; pane.bytes = null; pane.srcPath = null; progEnd("erro"); setStatus("Falha ao ler PDF: " + err, true); pane._onLoaded = null; return; }
      $(pane.ids.pdfNav).style.display = pane.pages > 1 ? "flex" : "none";
      $(pane.ids.prepBtn).style.display = "inline-block";   // habilita ⚗ Limpar (só PDF)
      setSource(pane, cv); progEnd("preview pronto");
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
             trapTol: $("tolTrap") ? +$("tolTrap").value : 3 };
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
              MANUAL = false; renderResult(); progEnd("pronto");
              applyOcrTextCheck();       // inspeção de texto por OCR (modo forma)
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
        renderResult();
        applyOcrTextCheck();       // inspeção de texto por OCR (modo forma)
        setStatus("");
      } catch (e) { setStatus("Erro na comparação: " + e, true); }
    }, 30);
  }

  var MODE = "all";
  function modeSet() {
    return MODE === "miss" ? { miss: 1, ok: 1 } : MODE === "struct" ? { miss: 1, extra: 1, ok: 1 } : { miss: 1, extra: 1, diff: 1, ok: 1 };
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
        var s = Math.max(1, Math.min(targetPx / Math.max(1, cn.h * pg.h), 16));   // DPI alto
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
  function applyOcrTextCheck() {
    // fim de pipeline sem OCR? devolve a memória do pdfium (heap não encolhe sozinho)
    function pdfDone() { if (window.ACPdf) ACPdf.reset(); }
    if (!RESULT || RESULT.mode !== "forma" || !window.ACOcr || !window.ACPdf) { pdfDone(); return; }
    if (!(F.pdf && O.pdf)) { pdfDone(); return; }
    var regs = RESULT.textRegions;
    if (!regs || !regs.length) { pdfDone(); return; }
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
      var subs = splitRegionLines(regs[ri]), si, gi;
      for (si = 0; si < subs.length; si++) {
        var ln = subs[si];
        if (ln.h < 10 || ln.w < 20) continue;                      // ruído / tira de sangria
        if (ln.h > 70) continue;                                   // não é LINHA de texto (bloco/foto) — OCR leria lixo
        var segs = ln.w > 520 ? segmentLine(ln) : [ln];            // painéis distintos = leituras separadas
        for (gi = 0; gi < segs.length; gi++) {
          var sg = segs[gi];
          if (sg.h < 10 || sg.w < 20) continue;
          sg.resid = residCount(sg);
          if (sg.resid < Math.max(24, sg.w * sg.h * 0.012)) continue;   // nada mudou ali de fato — não gasta OCR
          sg.region = ri; lines.push(sg);
        }
      }
    }
    // mais residual (mudança mais densa) primeiro — o teto corta o lixo, não o registro
    lines.sort(function (a, b) { return (b.resid / (b.w * b.h)) - (a.resid / (a.w * a.h)); });
    if (lines.length > 24) lines = lines.slice(0, 24);              // teto (tempo)
    if (!lines.length) { pdfDone(); return; }
    var touchedReg = {};
    RESULT._ocrMsg = "lendo textos (OCR)…"; setStatus("lendo textos (OCR)…", false, true);

    // FASE A SEM re-render: recorta as linhas das imagens JÁ ALINHADAS do compare
    // (estilo GlobalVision — rasteriza 1x e inspeciona da imagem). O MESMO retângulo
    // serve pros 2 lados (o compare já alinhou o original ao arquivo).
    var fImgs = [], oImgs = [], li2;
    for (li2 = 0; li2 < lines.length; li2++) {
      var L2 = lines[li2];
      var cf = cropImgData(RESULT.fileImg, L2.x, L2.y, L2.w, L2.h);
      var co = cropImgData(RESULT.origImg, L2.x, L2.y, L2.w, L2.h);
      fImgs.push(cf); oImgs.push(co);
    }
    ocrPairs(lines, fImgs, oImgs, reqId, touchedReg, null);
  }

  function ocrPairs(lines, fImgs, oImgs, reqId, touchedReg, renderErr) {
    var total = lines.length, done = 0, cands = [], seen = {}, readOk = 0, firstErr = null;
    if (renderErr) firstErr = "render: " + String((renderErr && renderErr.message) || renderErr).slice(0, 100);
    function noteErr(e) { if (!firstErr) firstErr = String((e && e.message) || e).slice(0, 120); }

    // fase A: OCR das linhas -> COLETA candidatos (token numérico divergente + posição)
    function step(k) {
      if (!RESULT || RESULT._ocrReq !== reqId) return;
      if (k >= total) { verifyTokens(); return; }
      var fR = fImgs[k], oR = oImgs[k], L = lines[k];
      if (!fR || !oR) { done++; return step(k + 1); }
      setStatus("lendo textos (OCR) — " + (done + 1) + "/" + total, false, true);
      var w = Math.min(fR.img.width, oR.img.width), h = Math.min(fR.img.height, oR.img.height), sec = { id: 0, x: 0, y: 0, w: w, h: h };
      var pre = (k > 0 && k % 6 === 0 && window.ACOcr.terminate) ? window.ACOcr.terminate() : Promise.resolve();
      pre.then(function () {
        // crops em resolução do compare (linha ~18px) -> upscale 3 deixa legível
        return window.ACOcr.diffSections(fR.img, oR.img, [sec], { numericAll: true, upscale: 3 });
      }).then(function (res) {
        if (!RESULT || RESULT._ocrReq !== reqId) return;
        touchedReg[L.region] = true; readOk++;
        var stt = (res.sectionsText && res.sectionsText[0]) || {};
        // PORTÃO: só confia se os 2 lados leram a MESMA linha (senão é ruído de leitura)
        if (simText(stt.textFile || "", stt.textOrig || "") >= 0.45) {
          var cps = res.comps || [], j;
          for (j = 0; j < cps.length; j++) {
            var c = cps[j];
            if (!(digTokens(c.textFile).length || digTokens(c.textOrig).length)) continue;
            // bbox do token (px do crop, s=1) -> px do COMPARE (soma o offset do crop)
            var xc = fR.x0 + c.x, yc = fR.y0 + c.y;
            var key = Math.round(xc / 10) + "," + Math.round(yc / 10);
            if (seen[key]) continue; seen[key] = 1;
            cands.push({ type: c.type, tO: c.textOrig || "", tF: c.textFile || "",
                         xc: xc, yc: yc, wc: Math.max(4, c.w), hc: Math.max(4, c.h), line: L,
                         lineDigsF: ((stt.textFile || "").match(/\d/g) || []).join(""),
                         lineDigsO: ((stt.textOrig || "").match(/\d/g) || []).join("") });
          }
        }
        done++; step(k + 1);
      }).catch(function (e) { if (!RESULT || RESULT._ocrReq !== reqId) return; noteErr(e); done++; step(k + 1); });
    }

    // fase B: VERIFICAÇÃO por token (anti-falso): re-renderiza o token isolado em DPI
    // máximo nos 2 lados e re-lê SÓ dígitos. Igual dos 2 lados = leitura tropeçou na
    // linha longa -> DESCARTA. Diferente = troca REAL -> emite (com o de→para limpo).
    function verifyTokens() {
      // candidatos com MAIS dígitos primeiro (códigos reais tipo 0763/0591) — o teto
      // corta o fragmento de leitura, nunca o token de verdade
      function digN(c) { return (digTokens(c.tO).join("") + digTokens(c.tF).join("")).length; }
      cands.sort(function (a, b) { return digN(b) - digN(a); });
      if (cands.length > 16) cands = cands.slice(0, 16);   // teto
      if (!cands.length) { finish(0); return; }
      // token (px do compare) -> fração da página, com margem: MUITO contexto horizontal
      // (bbox do OCR vem estreito), POUCO vertical (1 linha só — 2ª linha confunde o psm7)
      var items = [], i;
      for (i = 0; i < cands.length; i++) {
        var cd0 = cands[i];
        var mx = cd0.wc * 1.2 + 12, my = cd0.hc * 0.3 + 2;
        var pr;
        try { pr = toPageRect(Math.max(0, cd0.xc - mx), Math.max(0, cd0.yc - my), cd0.wc + 2 * mx, cd0.hc + 2 * my); }
        catch (e0) { pr = null; }
        items.push({ pr: pr || { x: 0, y: 0, w: 0.001, h: 0.001 } });
      }
      setStatus("confirmando números…", false, true);
      renderCropsHi(F, items, 110, function (fT) {
        if (!RESULT || RESULT._ocrReq !== reqId) return;
        renderCropsHi(O, items, 110, function (oT) {
          if (!RESULT || RESULT._ocrReq !== reqId) return;
          runVerify(fT, oT);
        });
      });
      function runVerify(fT, oT) {
          if (!RESULT || RESULT._ocrReq !== reqId) return;
          var added = 0;
          function digitsOf(txt) { return ((txt || "").match(/\d/g) || []).join(""); }
          function vstep(i2) {
            if (!RESULT || RESULT._ocrReq !== reqId) return;
            if (i2 >= cands.length) { finish(added); return; }
            var cd = cands[i2], fR2 = fT[i2], oR2 = oT[i2];
            if (!fR2 || !oR2) { return vstep(i2 + 1); }
            var secF = { id: 0, x: 0, y: 0, w: fR2.img.width, h: fR2.img.height, numeric: true, psm: "7" };
            var secO = { id: 0, x: 0, y: 0, w: oR2.img.width, h: oR2.img.height, numeric: true, psm: "7" };
            window.ACOcr.readSections(fR2.img, [secF], { upscale: 2 }).then(function (rf) {
              return window.ACOcr.readSections(oR2.img, [secO], { upscale: 2 }).then(function (ro) {
                var dF = digitsOf(rf[0] && rf[0].text), dO = digitsOf(ro[0] && ro[0].text);
                // TROCA real = mesma estrutura, conteúdo diferente (0763/3515 vs 0591/3515:
                // 8 vs 8 dígitos). Comprimentos díspares = crop caiu em trecho re-diagramado
                // (falso). SUMIU/A MAIS só confirma se a fase A também viu um lado vazio.
                var ok = false;
                if (dF !== dO) {
                  if (dF && dO) ok = Math.min(dF.length, dO.length) >= 3 && Math.abs(dF.length - dO.length) <= 1;
                  else ok = (dF.length >= 4 || dO.length >= 4) && (cd.tO === "" || cd.tF === "");
                }
                // ANTI-FALSO "a mais/sumiu": se os dígitos existem na LEITURA DA LINHA
                // INTEIRA do outro lado (fase A), o texto está lá — só re-diagramado.
                function win4In(hay, s) {
                  if (!hay || !s || s.length < 4) return false;
                  for (var w4 = 0; w4 + 4 <= s.length; w4++) if (hay.indexOf(s.substr(w4, 4)) >= 0) return true;
                  return false;
                }
                if (ok && !dO && win4In(cd.lineDigsO, dF)) ok = false;   // "a mais" mas existe no original
                if (ok && !dF && win4In(cd.lineDigsF, dO)) ok = false;   // "sumiu" mas existe no arquivo
                if (ok) {
                  // troca REAL confirmada — marca no local do token (já em px do compare)
                  var px = cd.xc, py = cd.yc, pw2 = Math.max(8, cd.wc), ph2 = Math.max(8, cd.hc);
                  var tp = (!dF) ? "miss" : (!dO) ? "extra" : "diff";
                  // exibe o token da leitura de LINHA (fase A: "0763"/"0591", limpo);
                  // a re-leitura confirmou, mas o token da linha é o recorte exato
                  RESULT.comps.push({ x: px, y: py, w: pw2, h: ph2, cx: px + (pw2 >> 1), cy: py + (ph2 >> 1),
                                      area: Math.max(1, pw2 * ph2), type: tp, kind: "text",
                                      textOrig: cd.tO || dO, textFile: cd.tF || dF, region: cd.line.region, ids: [] });
                  added++;
                }
                vstep(i2 + 1);
              });
            }).catch(function () { vstep(i2 + 1); });
          }
          vstep(0);
      }
    }

    function finish(added) {
      // Se o OCR LEU as linhas: marcador vago (nada confirmado) = re-tom/re-diagramação
      // legítima -> SOME TUDO (o que é real virou comp preciso "0763→0591").
      // Se o OCR NÃO leu nada (falha/memória): mantém os marcadores como aviso honesto.
      if (readOk > 0) {
        for (var t = RESULT.comps.length - 1; t >= 0; t--) {
          var pc = RESULT.comps[t];
          if (pc.kind === "text" && pc.textFile === "" && pc.textOrig === "") RESULT.comps.splice(t, 1);
        }
      }
      var diag = firstErr || OCR_INIT_ERR;
      RESULT._ocrMsg = readOk === 0
        ? "⚠ OCR não rodou" + (diag ? " [" + diag + "]" : " (motivo desconhecido)") + " — blocos marcados p/ conferir"
        : (added ? ("texto: " + added + " troca(s) confirmada(s)") : "textos conferidos ✓") +
          "  [" + readOk + "/" + total + " linhas, " + cands.length + " verificado(s)]";
      setStatus(""); renderResult();
      // fim do pipeline: derruba o pdfium — o heap do WASM (pico de ~2GB) NUNCA encolhe
      // sozinho; o reset devolve a memória e a próxima ação re-inicializa (~1s)
      if (window.ACPdf) ACPdf.reset();
    }
    step(0);
  }

  function applyMode() {
    if (!RESULT) return;
    if (!RESULT.ignored) RESULT.ignored = {};
    var ms = modeSet();
    RESULT.view = RESULT.comps.filter(function (c) { return ms[c.type] && !RESULT.ignored[keyOf(c)]; });
    RESULT.view.forEach(function (c) { c.px = Math.round(c.cx / RESULT.W * 100); c.py = Math.round(c.cy / RESULT.H * 100); });
    RESULT.overlayView = window.ACEngine.overlay(RESULT.fileImg, RESULT.lab, RESULT.view, RESULT.W, RESULT.H);
    RESULT.canOverlay = imgToCanvas(RESULT.overlayView);
    // "ok" (barcode/QR confere, verde) é informativo — NÃO conta como divergência
    $("sumTotal").textContent = RESULT.view.filter(function (c) { return c.type !== "ok"; }).length;
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
    OVZ = 1; ovApplyZoom();
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
    ai.textContent = "encaixe " + conf + "%" + regTxt + "  ·  " + modoTxt + bcTxt + ocrTxt
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
        if (!c.textFile && !c.textOrig) titulo = "T Texto diferente (clique p/ ampliar)";   // marcador de local (clicar mostra o zoom)
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
    var cv = $("overlayCanvas"), wrap = cv.parentElement;
    if (i >= 0 && RESULT.view[i]) {
      var sc = cv.clientWidth / RESULT.W;
      wrap.scrollTop = RESULT.view[i].cy * sc - wrap.clientHeight / 2;
      wrap.scrollLeft = RESULT.view[i].cx * sc - wrap.clientWidth / 2;
    }
    drawZoom(i);
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

  // ZOOM + PAN na tela de comparação: Ctrl+roda ou botões +/−/⛶; arrastar move
  var OVZ = 1;
  function ovApplyZoom(cx, cy) {   // cx/cy: ponto (0..1) a manter sob o cursor
    var cv = $("overlayCanvas"), wrap = $("ovWrap");
    if (OVZ <= 1.001) {
      OVZ = 1; cv.classList.remove("zoomed"); cv.style.width = "";
    } else {
      cv.classList.add("zoomed");
      cv.style.width = Math.round(wrap.clientWidth * OVZ) + "px";
      if (cx != null) {
        wrap.scrollLeft = cx * cv.clientWidth - wrap.clientWidth / 2;
        wrap.scrollTop = cy * cv.clientHeight - wrap.clientHeight / 2;
      }
    }
  }
  function ovZoomBy(f, cx, cy) { OVZ = Math.max(1, Math.min(16, OVZ * f)); ovApplyZoom(cx, cy); }

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
    OVZ = 1; ovApplyZoom();
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
    on($("ovZoomFit"), "click", function () { OVZ = 1; ovApplyZoom(); });
    // ===== ZOOM estilo Esko Viewer =====
    // roda = zoom no cursor · arrastar = RETÂNGULO de zoom (marquee) ·
    // botão do meio OU espaço+arrastar = pan · duplo clique = ajustar à tela
    (function () {
      var cv = $("overlayCanvas"), wrap = $("ovWrap");
      var pan = null, mq = null, mqBox = null, spaceDown = false;
      on(window, "keydown", function (e) {
        if (e.code !== "Space") return;
        var t = document.activeElement && document.activeElement.tagName;
        if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
        spaceDown = true; cv.style.cursor = "grab"; e.preventDefault();
      });
      on(window, "keyup", function (e) { if (e.code === "Space") { spaceDown = false; cv.style.cursor = ""; } });
      on(wrap, "wheel", function (e) {
        e.preventDefault();
        var r = cv.getBoundingClientRect();
        var cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
        ovZoomBy(e.deltaY < 0 ? 1.25 : 0.8, cx, cy);
      });
      on(cv, "dblclick", function () { OVZ = 1; ovApplyZoom(); });
      on(cv, "contextmenu", function (e) { e.preventDefault(); });       // botão direito é ferramenta
      on(cv, "mousedown", function (e) {
        if (e.button === 2) {                                            // DIREITO = afastar (Esko)
          var r2 = cv.getBoundingClientRect();
          ovZoomBy(0.75, (e.clientX - r2.left) / r2.width, (e.clientY - r2.top) / r2.height);
          e.preventDefault(); return;
        }
        if (e.button === 1 || (e.button === 0 && spaceDown)) {          // PAN
          pan = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
          cv.classList.add("panning"); e.preventDefault(); return;
        }
        if (e.button !== 0) return;                                      // MARQUEE zoom
        mq = { x0: e.clientX, y0: e.clientY };
        mqBox = document.createElement("div");
        mqBox.className = "ov-marquee";
        document.body.appendChild(mqBox);
        e.preventDefault();
      });
      on(window, "mousemove", function (e) {
        if (pan) { wrap.scrollLeft = pan.sl - (e.clientX - pan.x); wrap.scrollTop = pan.st - (e.clientY - pan.y); return; }
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
        if (w < 12 || h < 12 || !RESULT) return;                         // clique simples: nada
        var r = cv.getBoundingClientRect();
        var fx = (x0 + w / 2 - r.left) / r.width, fy = (y0 + h / 2 - r.top) / r.height;   // centro da seleção
        var fator = Math.min(wrap.clientWidth / w, (wrap.clientHeight || 520) / h);
        OVZ = Math.max(1, Math.min(16, OVZ * fator));
        ovApplyZoom(fx, fy);
      });
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

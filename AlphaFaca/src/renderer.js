// Alpha Faca - renderer (v2: tela única, cadastros, custo + % de ganho)
var ipc = require("electron").ipcRenderer;
var fs = require("fs");
var dxf = require("./dxf");
var cm = require("./colormap");
var custo = require("./custo");
var relatorio = require("./relatorio");

var state = { parsed: null, mapa: {}, unidade: "mm", fileName: "", medidas: null, tipoFaca: "plana",
  celShapes: [], _draft: null, _poly: [], _polyCursor: null, _tx: null,
  ed: { scale: 1, tx: 0, ty: 0, fit: 1 }, edTool: "select", sel: [], _edAberto: false, _facaSegs: null, _edHandles: null, _clip: null, _marq: null };
var _idc = 0;
function novoId() { _idc++; return "x" + new Date().getTime() + "_" + _idc; }

// ---------- unidade ----------
var FATOR_M = { mm: 0.001, cm: 0.01, m: 1, pol: 0.0254 };
var INSUNIT_MAP = { 1: "pol", 4: "mm", 5: "cm", 6: "m" };
function duParaMetro(du) { return du * FATOR_M[state.unidade]; }
function duParaMM(du) { return du * FATOR_M[state.unidade] * 1000; }
function fmtM(m) { return m.toFixed(2).replace(".", ","); }
function fmtMM(v) { return (Math.round(v * 10) / 10).toString().replace(".", ","); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function val(id) { var e = document.getElementById(id); return e ? e.value : ""; }
function pad(n) { return n < 10 ? "0" + n : "" + n; }
function agora() { var d = new Date(); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }

// ---------- navegação ----------
var navItems = document.querySelectorAll(".nav-item");
(function () {
  var i;
  for (i = 0; i < navItems.length; i++) {
    navItems[i].addEventListener("click", (function (el) {
      return function () {
        var scr = el.getAttribute("data-screen"), k;
        for (k = 0; k < navItems.length; k++) navItems[k].classList.remove("active");
        el.classList.add("active");
        var scs = document.querySelectorAll(".screen");
        for (k = 0; k < scs.length; k++) scs[k].classList.remove("active");
        document.getElementById("screen-" + scr).classList.add("active");
        document.getElementById("crumbScreen").innerText = el.querySelector("span").innerText;
        if (scr === "salvos") { fecharDetalhe(); carregarSalvos(); }
        if (scr === "novo" || scr === "config") carregarCadRede(refletirCadNaUI);
      };
    })(navItems[i]));
  }
})();

// ---------- tema ----------
(function () { try { if (localStorage.getItem("alphaFacaTheme") === "dark") document.body.classList.add("dark"); } catch (e) {} syncThemeIcon(); })();
document.getElementById("themeToggle").addEventListener("click", function () {
  var dark = document.body.classList.toggle("dark");
  try { localStorage.setItem("alphaFacaTheme", dark ? "dark" : "light"); } catch (e) {}
  syncThemeIcon(); if (state.parsed) desenhar();
});
function syncThemeIcon() {
  var dark = document.body.classList.contains("dark");
  document.getElementById("themeIcon").innerHTML = dark
    ? '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M4.5 4.5 l2 2 M17.5 17.5 l2 2 M19.5 4.5 l-2 2 M6.5 17.5 l-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M21 13 A9 9 0 1 1 11 3 a7 7 0 0 0 10 10z" fill="currentColor"/>';
}

// ---------- abrir DXF ----------
document.getElementById("btnAbrir").addEventListener("click", abrirDialogo);
document.getElementById("btnAbrir2").addEventListener("click", abrirDialogo);
document.getElementById("btnNova").addEventListener("click", novaFaca);
function abrirDialogo() {
  ipc.invoke("open-faca").then(function (r) { if (r) carregarDxf(r.text, r.name); });
}
var dz = document.getElementById("dropzone");
["dragenter", "dragover"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("drag"); }); });
["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("drag"); }); });
dz.addEventListener("drop", function (e) {
  var f = e.dataTransfer.files[0]; if (!f) return;
  if (!/\.dxf$/i.test(f.name)) { alert("Arraste um arquivo .DXF."); return; }
  try { carregarDxf(fs.readFileSync(f.path, "latin1"), f.name); } catch (err) { alert("Não consegui ler: " + err.message); }
});

function carregarDxf(text, name) {
  var parsed;
  try { parsed = dxf.parseDxf(text); } catch (err) { alert("Falha ao interpretar o DXF: " + err.message); return; }
  state.parsed = parsed; state.mapa = cm.sugerirMapa(parsed); state.fileName = name;
  state.celShapes = []; state._poly = []; state._draft = null; atualizarCelastroUI();
  if (parsed.insunits && INSUNIT_MAP[parsed.insunits]) { state.unidade = INSUNIT_MAP[parsed.insunits]; document.getElementById("unidade").value = state.unidade; }
  document.getElementById("crumbFile").innerText = name;
  document.getElementById("dropzone").hidden = true;
  document.getElementById("novoConteudo").hidden = false;
  document.getElementById("btnNova").hidden = false;
  construirColormap();
  recalcularMedidas();
}
function novaFaca() {
  state.parsed = null; state.medidas = null; state.mapa = {}; state.fileName = "";
  state.celShapes = []; state._poly = []; state._draft = null; state.sel = []; atualizarCelastroUI();
  if (state._edAberto) closeEditor();
  document.getElementById("novoConteudo").hidden = true;
  document.getElementById("dropzone").hidden = false;
  document.getElementById("btnNova").hidden = true;
  document.getElementById("crumbFile").innerText = "";
  var med = document.querySelector('[data-screen="novo"]'); if (med) med.click();
}

document.getElementById("unidade").addEventListener("change", function () { state.unidade = this.value; recalcularMedidas(); });

// ---------- medidas + preview ----------
function recalcularMedidas() {
  if (!state.parsed) return;
  var med = cm.medir(state.parsed, state.mapa);
  var corteM = duParaMetro(med.corte.len), vincoM = duParaMetro(med.vinco.len), picoteM = duParaMetro(med.picote.len);
  var laserM = corteM + vincoM + picoteM;
  var bb = state.parsed.bbox;
  state.medidas = { corteM: corteM, vincoM: vincoM, picoteM: picoteM, laserM: laserM, areaBaseM2: duParaMetro(bb.w) * duParaMetro(bb.h) };
  renderStats(med, corteM, vincoM, picoteM, laserM);
  desenhar();
  recalcOrcamento();
}
function renderStats(med, corteM, vincoM, picoteM, laserM) {
  var cards = [
    { cls: "corte", lbl: "Corte", m: corteM, n: med.corte.count },
    { cls: "vinco", lbl: "Vinco", m: vincoM, n: med.vinco.count },
    { cls: "picote", lbl: "Picote", m: picoteM, n: med.picote.count },
    { cls: "laser", lbl: "Lâmina total", m: laserM, sub: "corte + vinco + picote" }
  ];
  var html = "", i;
  for (i = 0; i < cards.length; i++) {
    var c = cards[i];
    html += '<div class="stat ' + c.cls + '"><div class="lbl">' + c.lbl + '</div><div class="val">' + fmtM(c.m) + '<small>m</small></div><div class="sub">' + (c.sub ? c.sub : (c.n + " entid.")) + '</div></div>';
  }
  document.getElementById("stats").innerHTML = html;
  var bb = state.parsed.bbox;
  document.getElementById("facaSize").innerHTML = '<span class="muted">Tamanho da faca</span><b>' + fmtMM(duParaMM(bb.w)) + ' &times; ' + fmtMM(duParaMM(bb.h)) + ' mm</b>';
}

// mapa de cores
function nomeAci(n) { var m = { 1: "vermelho", 2: "amarelo", 3: "verde", 4: "ciano", 5: "azul", 6: "magenta", 7: "preto/branco", 8: "cinza" }; return m[n] || ("ACI " + n); }
function hexAci(n) { var m = { 1: "#e11d48", 2: "#eab308", 3: "#16a34a", 4: "#06b6d4", 5: "#2563eb", 6: "#d946ef", 7: "#334155", 8: "#94a3b8" }; return m[n] || "#64748b"; }
function construirColormap() {
  var box = document.getElementById("colormap"); box.innerHTML = "";
  var stats = state.parsed.colorStats;
  var cores = Object.keys(stats).sort(function (a, b) { return stats[b].length - stats[a].length; });
  var i;
  for (i = 0; i < cores.length; i++) {
    var cor = cores[i], st = stats[cor], key = "cor:" + cor, atual = state.mapa[key] || "ignorar";
    var row = document.createElement("div"); row.className = "cmrow";
    row.innerHTML = '<span class="dot" style="background:' + hexAci(parseInt(cor, 10)) + '"></span>' +
      '<span class="cmlabel"><b>Cor ' + cor + ' <span style="font-weight:400">(' + nomeAci(parseInt(cor, 10)) + ')</span></b><span>' + st.count + ' entid. &middot; ' + fmtM(duParaMetro(st.length)) + ' m</span></span>' + selectFuncao(atual, key);
    box.appendChild(row);
  }
  var sels = box.querySelectorAll("select"), j;
  for (j = 0; j < sels.length; j++) sels[j].addEventListener("change", function () { state.mapa[this.getAttribute("data-key")] = this.value; recalcularMedidas(); });
}
function selectFuncao(atual, key) {
  var ordem = ["corte", "vinco", "picote", "arte", "cotas", "ignorar"], s = '<select data-key="' + key + '">', i;
  for (i = 0; i < ordem.length; i++) s += '<option value="' + ordem[i] + '"' + (ordem[i] === atual ? " selected" : "") + '>' + cm.FUNCOES[ordem[i]].rotulo + '</option>';
  return s + '</select>';
}
function renderLegend() {
  var usadas = {}, i;
  for (i = 0; i < state.parsed.entities.length; i++) usadas[cm.classificar(state.parsed.entities[i], state.mapa)] = true;
  var ordem = ["corte", "vinco", "picote", "arte", "cotas"], html = "";
  for (i = 0; i < ordem.length; i++) if (usadas[ordem[i]]) html += '<span class="lg"><span class="sw" style="background:' + cm.FUNCOES[ordem[i]].cor + '"></span>' + cm.FUNCOES[ordem[i]].rotulo + '</span>';
  document.getElementById("legend").innerHTML = html;
}
function desenhar() {
  renderLegend();
  var canvas = document.getElementById("preview"), wrap = canvas.parentElement, dpr = window.devicePixelRatio || 1;
  var W = wrap.clientWidth, H = wrap.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  var ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  var bb = state.parsed.bbox; if (bb.w <= 0 && bb.h <= 0) return;
  var pad = 26, s = Math.min((W - pad * 2) / (bb.w || 1), (H - pad * 2) / (bb.h || 1));
  var offX = (W - bb.w * s) / 2, offY = (H - bb.h * s) / 2;
  function TX(x) { return offX + (x - bb.minX) * s; } function TY(y) { return H - (offY + (y - bb.minY) * s); }
  state._tx = { s: s, offX: offX, offY: offY, minX: bb.minX, minY: bb.minY, H: H };
  var ordem = ["arte", "cotas", "ignorar", "picote", "vinco", "corte"], oi;
  for (oi = 0; oi < ordem.length; oi++) {
    var alvo = ordem[oi], conf = cm.FUNCOES[alvo];
    ctx.strokeStyle = conf.cor; ctx.lineWidth = (alvo === "corte") ? 1.9 : (alvo === "vinco" ? 1.6 : 1);
    ctx.globalAlpha = conf.conta ? 1 : 0.4; if (alvo === "vinco") ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
    var i, j, k, ents = state.parsed.entities;
    for (i = 0; i < ents.length; i++) {
      var e = ents[i]; if (cm.classificar(e, state.mapa) !== alvo) continue;
      for (j = 0; j < e.polylines.length; j++) {
        var pl = e.polylines[j]; if (pl.length < 2) continue;
        ctx.beginPath(); ctx.moveTo(TX(pl[0].x), TY(pl[0].y));
        for (k = 1; k < pl.length; k++) ctx.lineTo(TX(pl[k].x), TY(pl[k].y));
        ctx.stroke();
      }
    }
  }
  // ---- celastro: regiões desenhadas (laranja) ----
  ctx.globalAlpha = 1; ctx.setLineDash([]);
  ctx.fillStyle = "rgba(249,115,22,.28)"; ctx.strokeStyle = "#f97316"; ctx.lineWidth = 1.6;
  var ci;
  for (ci = 0; ci < state.celShapes.length; ci++) { pathForma(ctx, state.celShapes[ci], TX, TY, s, true); ctx.fill(); ctx.stroke(); }
  // forma em construção (círculo / retângulo)
  if (state._draft) { ctx.setLineDash([5, 4]); pathForma(ctx, state._draft, TX, TY, s, true); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
  // polígono em construção
  if (state._poly.length) {
    ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(TX(state._poly[0].x), TY(state._poly[0].y));
    var pj; for (pj = 1; pj < state._poly.length; pj++) ctx.lineTo(TX(state._poly[pj].x), TY(state._poly[pj].y));
    if (state._polyCursor) ctx.lineTo(TX(state._polyCursor.x), TY(state._polyCursor.y));
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#f97316"; var pk;
    for (pk = 0; pk < state._poly.length; pk++) { ctx.beginPath(); ctx.arc(TX(state._poly[pk].x), TY(state._poly[pk].y), pk === 0 ? 5 : 3.2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.setLineDash([]);
}
// traça o contorno de uma forma de celastro no ctx (coords via TX/TY, raio × escala)
function pathForma(ctx, sh, TX, TY, scale, fechar) {
  ctx.beginPath();
  if (sh.type === "circle") ctx.arc(TX(sh.cx), TY(sh.cy), sh.r * scale, 0, Math.PI * 2);
  else if (sh.type === "rect") { var x0 = TX(sh.x0), y0 = TY(sh.y0), x1 = TX(sh.x1), y1 = TY(sh.y1); ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); }
  else if (sh.type === "poly" && sh.pts.length) { ctx.moveTo(TX(sh.pts[0].x), TY(sh.pts[0].y)); var i; for (i = 1; i < sh.pts.length; i++) ctx.lineTo(TX(sh.pts[i].x), TY(sh.pts[i].y)); if (fechar) ctx.closePath(); }
}
window.addEventListener("resize", function () { if (state.parsed) desenhar(); });

// ============================================================
// CELASTRO — desenho de regiões no preview (área, R$/m²)
// ============================================================
// área da UNIÃO das formas via rasterização (trata sobreposição automaticamente)
function celastroAreaM2() {
  if (!state.parsed || !state.celShapes.length) return 0;
  var bb = state.parsed.bbox;
  var scale = 1200 / Math.max(bb.w, bb.h, 1);            // px por unidade de desenho
  var w = Math.max(1, Math.round(bb.w * scale)), h = Math.max(1, Math.round(bb.h * scale));
  var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  var x = cv.getContext("2d"); x.fillStyle = "#fff";
  function PX(v) { return (v - bb.minX) * scale; }
  function PY(v) { return (v - bb.minY) * scale; }
  var i;
  for (i = 0; i < state.celShapes.length; i++) { pathForma(x, state.celShapes[i], PX, PY, scale, true); x.fill(); }
  var data = x.getImageData(0, 0, w, h).data, count = 0, p;
  for (p = 3; p < data.length; p += 4) if (data[p] > 0) count++;
  var areaUnits = count / (scale * scale);              // px -> unidades de desenho²
  var f = FATOR_M[state.unidade];
  return areaUnits * f * f;                             // -> m²
}
function atualizarCelastroUI() {
  var em = document.getElementById("celMetros"); if (em) em.innerText = celastroAreaM2().toFixed(3).replace(".", ",") + " m²";
  var q = state.celShapes.length, eq = document.getElementById("celQtd");
  if (eq) eq.innerText = q ? (q + " regi" + (q === 1 ? "ão" : "ões")) : "nenhuma região";
}
function selecaoMudou() { atualizarCelastroUI(); recalcOrcamento(); desenhar(); if (state._edAberto) edDesenhar(); }

// ---- geometria: regra "não pode sobre a faca" (corte/vinco/picote) ----
function computarFacaSegs() {
  state._facaSegs = [];
  if (!state.parsed) return;
  var ents = state.parsed.entities, i, j, k;
  for (i = 0; i < ents.length; i++) {
    var e = ents[i]; if (!cm.FUNCOES[cm.classificar(e, state.mapa)].conta || e.length <= 0) continue;
    for (j = 0; j < e.polylines.length; j++) {
      var pl = e.polylines[j];
      for (k = 0; k < pl.length - 1; k++) {
        var ax = pl[k].x, ay = pl[k].y, bx = pl[k + 1].x, by = pl[k + 1].y;
        state._facaSegs.push({ ax: ax, ay: ay, bx: bx, by: by, minx: Math.min(ax, bx), maxx: Math.max(ax, bx), miny: Math.min(ay, by), maxy: Math.max(ay, by) });
      }
    }
  }
}
function bboxForma(sh) {
  if (sh.type === "circle") return { minx: sh.cx - sh.r, maxx: sh.cx + sh.r, miny: sh.cy - sh.r, maxy: sh.cy + sh.r };
  if (sh.type === "rect") return { minx: Math.min(sh.x0, sh.x1), maxx: Math.max(sh.x0, sh.x1), miny: Math.min(sh.y0, sh.y1), maxy: Math.max(sh.y0, sh.y1) };
  var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, i;
  for (i = 0; i < sh.pts.length; i++) { var p = sh.pts[i]; if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x; if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y; }
  return { minx: minx, maxx: maxx, miny: miny, maxy: maxy };
}
function centroForma(sh) { var b = bboxForma(sh); return { x: (b.minx + b.maxx) / 2, y: (b.miny + b.maxy) / 2 }; }
function distSegPonto(px, py, ax, ay, bx, by) { var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; var t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = t < 0 ? 0 : (t > 1 ? 1 : t); var qx = ax + t * dx, qy = ay + t * dy; return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy)); }
function pontoEmPoly(px, py, pts) { var dentro = false, i, j; for (i = 0, j = pts.length - 1; i < pts.length; j = i++) { var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y; if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) dentro = !dentro; } return dentro; }
function segCruzaSeg(a, b, c, d) { function o(p, q, r) { return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); } var d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d); return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)); }
function polyPts(sh) { if (sh.type === "rect") { var x0 = Math.min(sh.x0, sh.x1), x1 = Math.max(sh.x0, sh.x1), y0 = Math.min(sh.y0, sh.y1), y1 = Math.max(sh.y0, sh.y1); return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]; } return sh.pts; }
function pontoEmForma(sh, x, y) { if (sh.type === "circle") return (x - sh.cx) * (x - sh.cx) + (y - sh.cy) * (y - sh.cy) <= sh.r * sh.r; return pontoEmPoly(x, y, polyPts(sh)); }
// true = a forma cobre/cruza alguma linha da faca (inválida)
function formaCruzaFaca(sh) {
  if (!state._facaSegs) return false;
  var bb = bboxForma(sh), segs = state._facaSegs, i;
  for (i = 0; i < segs.length; i++) {
    var s = segs[i];
    if (s.maxx < bb.minx || s.minx > bb.maxx || s.maxy < bb.miny || s.miny > bb.maxy) continue;
    if (sh.type === "circle") { if (distSegPonto(sh.cx, sh.cy, s.ax, s.ay, s.bx, s.by) <= sh.r) return true; }
    else {
      var pts = polyPts(sh);
      if (pontoEmPoly(s.ax, s.ay, pts) || pontoEmPoly(s.bx, s.by, pts)) return true;
      var a = { x: s.ax, y: s.ay }, b = { x: s.bx, y: s.by }, j;
      for (j = 0; j < pts.length; j++) { if (segCruzaSeg(a, b, pts[j], pts[(j + 1) % pts.length])) return true; }
    }
  }
  return false;
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function moverForma(sh, orig, dx, dy) {
  if (sh.type === "circle") { sh.cx = orig.cx + dx; sh.cy = orig.cy + dy; }
  else if (sh.type === "rect") { sh.x0 = orig.x0 + dx; sh.x1 = orig.x1 + dx; sh.y0 = orig.y0 + dy; sh.y1 = orig.y1 + dy; }
  else { var i; for (i = 0; i < sh.pts.length; i++) { sh.pts[i].x = orig.pts[i].x + dx; sh.pts[i].y = orig.pts[i].y + dy; } }
}
function escalarForma(sh, orig, ratio, cx, cy) {
  if (sh.type === "circle") { sh.cx = cx + (orig.cx - cx) * ratio; sh.cy = cy + (orig.cy - cy) * ratio; sh.r = Math.max(0.1, orig.r * ratio); }
  else if (sh.type === "rect") { sh.x0 = cx + (orig.x0 - cx) * ratio; sh.x1 = cx + (orig.x1 - cx) * ratio; sh.y0 = cy + (orig.y0 - cy) * ratio; sh.y1 = cy + (orig.y1 - cy) * ratio; }
  else { var i; for (i = 0; i < sh.pts.length; i++) { sh.pts[i].x = cx + (orig.pts[i].x - cx) * ratio; sh.pts[i].y = cy + (orig.pts[i].y - cy) * ratio; } }
}
function snap45(from, to) { var dx = to.x - from.x, dy = to.y - from.y, ang = Math.atan2(dy, dx), step = Math.PI / 4; ang = Math.round(ang / step) * step; var len = Math.sqrt(dx * dx + dy * dy); return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len }; }
// gira uma forma por 'ang' rad em torno de (cx,cy). Círculo orbita (centro gira, raio igual); rect vira poly.
function rotarForma(orig, ang, cx, cy) {
  var cosA = Math.cos(ang), sinA = Math.sin(ang);
  if (orig.type === "circle") { var dcx = orig.cx - cx, dcy = orig.cy - cy; return { type: "circle", cx: cx + dcx * cosA - dcy * sinA, cy: cy + dcx * sinA + dcy * cosA, r: orig.r }; }
  var pts = polyPts(orig), out = [], i;
  for (i = 0; i < pts.length; i++) { var dx = pts[i].x - cx, dy = pts[i].y - cy; out.push({ x: cx + dx * cosA - dy * sinA, y: cy + dx * sinA + dy * cosA }); }
  return { type: "poly", pts: out };
}
// o segmento a→b cruza alguma linha da faca?
function segCruzaFaca(a, b) {
  if (!state._facaSegs) return false;
  var minx = Math.min(a.x, b.x), maxx = Math.max(a.x, b.x), miny = Math.min(a.y, b.y), maxy = Math.max(a.y, b.y);
  var segs = state._facaSegs, i;
  for (i = 0; i < segs.length; i++) { var s = segs[i]; if (s.maxx < minx || s.minx > maxx || s.maxy < miny || s.miny > maxy) continue; if (segCruzaSeg(a, b, { x: s.ax, y: s.ay }, { x: s.bx, y: s.by })) return true; }
  return false;
}

// ============================================================
// EDITOR DE CELASTRO (tela cheia: zoom/pan, desenhar, mover, redimensionar)
// ============================================================
function edX(x) { return state.ed.tx + x * state.ed.scale; }
function edY(y) { return state.ed.ty - y * state.ed.scale; }
function edInv(sx, sy) { return { x: (sx - state.ed.tx) / state.ed.scale, y: (state.ed.ty - sy) / state.ed.scale }; }
function edCanvasEl() { return document.getElementById("edCanvas"); }
function edFit() {
  var cv = edCanvasEl(), wrap = cv.parentElement, W = wrap.clientWidth, H = wrap.clientHeight, bb = state.parsed.bbox;
  var pad = 70, s = Math.min((W - pad * 2) / (bb.w || 1), (H - pad * 2) / (bb.h || 1));
  state.ed.scale = s; state.ed.fit = s;
  state.ed.tx = W / 2 - s * (bb.minX + bb.w / 2);
  state.ed.ty = H / 2 + s * (bb.minY + bb.h / 2);
  edZoomLabel();
}
function edZoomLabel() { var el = document.getElementById("edZoomLabel"); if (el) el.innerText = Math.round(state.ed.scale / state.ed.fit * 100) + "%"; }
function edZoomAt(sx, sy, f) {
  var pt = edInv(sx, sy), ns = Math.max(state.ed.fit * 0.2, Math.min(state.ed.fit * 40, state.ed.scale * f));
  state.ed.scale = ns; state.ed.tx = sx - pt.x * ns; state.ed.ty = sy + pt.y * ns; edZoomLabel(); edDesenhar();
}
// cursor de rotação (seta curva estilo Illustrator) via SVG data-URI
function svgCursor(svg, hx, hy) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + hx + ' ' + hy + ', auto'; }
var _rotSvg = "<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 30 30'>" +
  "<path d='M8 21 A9 9 0 1 1 22 21' fill='none' stroke='white' stroke-width='4.5' stroke-linecap='round'/>" +
  "<path d='M8 21 A9 9 0 1 1 22 21' fill='none' stroke='#1f2a44' stroke-width='2.2' stroke-linecap='round'/>" +
  "<path d='M3.5 16.5 L8.5 23 L12.5 16.5 Z' fill='#1f2a44' stroke='white' stroke-width='1'/></svg>";
var CUR_ROT = svgCursor(_rotSvg, 15, 15);
// ---- seleção múltipla ----
function estaSel(i) { return state.sel.indexOf(i) >= 0; }
function bboxSelecao() {
  if (!state.sel.length) return null;
  var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, i;
  for (i = 0; i < state.sel.length; i++) { var b = bboxForma(state.celShapes[state.sel[i]]); if (!b) continue; if (b.minx < minx) minx = b.minx; if (b.maxx > maxx) maxx = b.maxx; if (b.miny < miny) miny = b.miny; if (b.maxy > maxy) maxy = b.maxy; }
  if (!isFinite(minx)) return null;
  return { minx: minx, maxx: maxx, miny: miny, maxy: maxy };
}
function centroSelecao() { var b = bboxSelecao(); return b ? { x: (b.minx + b.maxx) / 2, y: (b.miny + b.maxy) / 2 } : { x: 0, y: 0 }; }
function formaNoPonto(p) { var k; for (k = state.celShapes.length - 1; k >= 0; k--) if (pontoEmForma(state.celShapes[k], p.x, p.y)) return k; return -1; }
function rectsCruzam(a, b) { return !(a.maxx < b.minx || a.minx > b.maxx || a.maxy < b.miny || a.miny > b.maxy); }
// o que está sob o cursor (px de tela): alça (esticar), logo fora (girar) ou sobre a seleção (mover)
function edHoverAlvo(sx, sy) {
  if (!state.sel.length) return { tipo: "none" };
  if (state._edHandles) {
    var i, dmin = Infinity, ci = -1;
    for (i = 0; i < 4; i++) { var d = Math.sqrt(Math.pow(sx - state._edHandles[i][0], 2) + Math.pow(sy - state._edHandles[i][1], 2)); if (d < dmin) { dmin = d; ci = i; } }
    if (dmin < 9) return { tipo: "resize", corner: ci };       // sobre a alça = esticar
    if (dmin < 26) return { tipo: "rotate" };                   // logo fora do canto = girar
  }
  var p = edInv(sx, sy), j;
  for (j = 0; j < state.sel.length; j++) if (pontoEmForma(state.celShapes[state.sel[j]], p.x, p.y)) return { tipo: "move" };
  return { tipo: "none" };
}
function edCursorResize(corner) { return (corner === 0 || corner === 2) ? "nwse-resize" : "nesw-resize"; }
function edHandles(ctx) {
  var b = bboxSelecao(); if (!b) { state._edHandles = null; return; }
  var x0 = edX(b.minx), x1 = edX(b.maxx), y0 = edY(b.maxy), y1 = edY(b.miny);
  ctx.strokeStyle = "#2563eb"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
  var corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], i;
  // alças de canto: esticar (na alça) · girar (logo fora)
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 1.5;
  for (i = 0; i < 4; i++) { ctx.fillRect(corners[i][0] - 4, corners[i][1] - 4, 8, 8); ctx.strokeRect(corners[i][0] - 4, corners[i][1] - 4, 8, 8); }
  state._edHandles = corners;
}
function edDesenhar() {
  var cv = edCanvasEl(); if (!cv || !state.parsed) return;
  var wrap = cv.parentElement, dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  // faca
  var ordem = ["arte", "cotas", "ignorar", "picote", "vinco", "corte"], oi;
  for (oi = 0; oi < ordem.length; oi++) {
    var alvo = ordem[oi], conf = cm.FUNCOES[alvo];
    ctx.strokeStyle = conf.cor; ctx.lineWidth = (alvo === "corte") ? 1.6 : (alvo === "vinco" ? 1.3 : 1);
    ctx.globalAlpha = conf.conta ? 1 : 0.25; if (alvo === "vinco") ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
    var ents = state.parsed.entities, i, j, k;
    for (i = 0; i < ents.length; i++) { var e = ents[i]; if (cm.classificar(e, state.mapa) !== alvo) continue;
      for (j = 0; j < e.polylines.length; j++) { var pl = e.polylines[j]; if (pl.length < 2) continue;
        ctx.beginPath(); ctx.moveTo(edX(pl[0].x), edY(pl[0].y));
        for (k = 1; k < pl.length; k++) ctx.lineTo(edX(pl[k].x), edY(pl[k].y)); ctx.stroke(); } }
  }
  ctx.globalAlpha = 1; ctx.setLineDash([]);
  // formas de celastro
  var ci; for (ci = 0; ci < state.celShapes.length; ci++) {
    var sel = estaSel(ci), inval = formaCruzaFaca(state.celShapes[ci]);
    ctx.fillStyle = inval ? "rgba(239,68,68,.30)" : "rgba(249,115,22,.30)";
    ctx.strokeStyle = inval ? "#ef4444" : (sel ? "#c2410c" : "#f97316"); ctx.lineWidth = sel ? 2.3 : 1.6;
    pathForma(ctx, state.celShapes[ci], edX, edY, state.ed.scale, true); ctx.fill(); ctx.stroke();
  }
  if (state.sel.length) edHandles(ctx);
  // retângulo de seleção (marquee)
  if (state._marq) {
    var m = state._marq, mx0 = edX(m.minx), mx1 = edX(m.maxx), my0 = edY(m.maxy), my1 = edY(m.miny);
    ctx.strokeStyle = "#2563eb"; ctx.fillStyle = "rgba(37,99,235,.08)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    ctx.fillRect(mx0, my0, mx1 - mx0, my1 - my0); ctx.strokeRect(mx0, my0, mx1 - mx0, my1 - my0); ctx.setLineDash([]);
  }
  // draft (círculo/retângulo)
  if (state._draft) {
    var inv2 = formaCruzaFaca(state._draft); ctx.setLineDash([5, 4]);
    ctx.fillStyle = inv2 ? "rgba(239,68,68,.25)" : "rgba(249,115,22,.25)"; ctx.strokeStyle = inv2 ? "#ef4444" : "#f97316"; ctx.lineWidth = 1.6;
    pathForma(ctx, state._draft, edX, edY, state.ed.scale, true); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  }
  // polígono em construção
  if (state._poly.length) {
    ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(edX(state._poly[0].x), edY(state._poly[0].y)); var pj;
    for (pj = 1; pj < state._poly.length; pj++) ctx.lineTo(edX(state._poly[pj].x), edY(state._poly[pj].y)); ctx.stroke();
    if (state._polyCursor) {
      var lp = state._poly[state._poly.length - 1];
      ctx.strokeStyle = state._polyEdgeInval ? "#ef4444" : "#f97316";
      ctx.beginPath(); ctx.moveTo(edX(lp.x), edY(lp.y)); ctx.lineTo(edX(state._polyCursor.x), edY(state._polyCursor.y)); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.fillStyle = "#f97316"; var pk;
    for (pk = 0; pk < state._poly.length; pk++) { ctx.beginPath(); ctx.arc(edX(state._poly[pk].x), edY(state._poly[pk].y), pk === 0 ? 5 : 3.2, 0, Math.PI * 2); ctx.fill(); }
  }
}
function edSetTool(t) {
  state.edTool = t; state._poly = []; state._polyCursor = null; state._draft = null; state._marq = null;
  if (t !== "select") state.sel = [];
  var tb = document.querySelectorAll("#edTools .edtool[data-edtool]"), i;
  for (i = 0; i < tb.length; i++) tb[i].classList.toggle("active", tb[i].getAttribute("data-edtool") === t);
  var cv = edCanvasEl(); if (cv) cv.style.cursor = (t === "select") ? "default" : "crosshair";
  edDesenhar();
}
function openEditor() {
  if (!state.parsed) return;
  computarFacaSegs();
  state._edAberto = true; state._poly = []; state._draft = null; state.sel = []; state._marq = null;
  document.getElementById("edFile").innerText = state.fileName || "";
  document.getElementById("celEditor").hidden = false;
  edSetTool("select"); edFit(); edDesenhar(); edArea();
}
function closeEditor() { state._edAberto = false; document.getElementById("celEditor").hidden = true; selecaoMudou(); }
function edArea() { var el = document.getElementById("edArea"); if (el) el.innerText = celastroAreaM2().toFixed(3).replace(".", ",") + " m²"; }

(function ligarEditor() {
  var cv = edCanvasEl();
  function rel(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  document.getElementById("celAbrirEditor").addEventListener("click", openEditor);
  document.getElementById("edFechar").addEventListener("click", closeEditor);
  document.getElementById("celLimpar").addEventListener("click", function () { state.celShapes = []; state._poly = []; state._draft = null; state.sel = []; selecaoMudou(); if (state._edAberto) edArea(); });
  document.getElementById("edLimpar").addEventListener("click", function () { state.celShapes = []; state.sel = []; edDesenhar(); edArea(); });
  document.getElementById("edFit").addEventListener("click", function () { edFit(); edDesenhar(); });
  document.getElementById("edZoomIn").addEventListener("click", function () { var r = cv.getBoundingClientRect(); edZoomAt(r.width / 2, r.height / 2, 1.2); });
  document.getElementById("edZoomOut").addEventListener("click", function () { var r = cv.getBoundingClientRect(); edZoomAt(r.width / 2, r.height / 2, 1 / 1.2); });
  var tb = document.querySelectorAll("#edTools .edtool[data-edtool]"), i;
  for (i = 0; i < tb.length; i++) tb[i].addEventListener("click", function () { edSetTool(this.getAttribute("data-edtool")); });

  cv.addEventListener("wheel", function (e) { if (!state._edAberto) return; e.preventDefault(); var p = rel(e); edZoomAt(p.x, p.y, e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

  var space = false, mode = null, start = null, origs = null, center = null, initDist = 0, movedFar = false, startAng = 0, clickHit = -1, lastDx = 0, lastDy = 0;
  document.addEventListener("keydown", function (e) {
    if (!state._edAberto) return;
    if (e.code === "Space") { space = true; cv.style.cursor = "grab"; }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "0")) { e.preventDefault(); edFit(); edDesenhar(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C") && state.sel.length) { e.preventDefault(); state._clip = state.sel.map(function (i) { return clone(state.celShapes[i]); }); flashHint(state.sel.length + (state.sel.length === 1 ? " região copiada" : " regiões copiadas") + ". Ctrl+V para colar."); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V") && state._clip && state._clip.length) { e.preventDefault(); colar(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && state.edTool === "select") { e.preventDefault(); state.sel = state.celShapes.map(function (_s, i) { return i; }); edDesenhar(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D") && state.edTool === "select" && state.sel.length) { e.preventDefault(); duplicarComDelta(); }
    else if (e.key === "Escape") { if (state._poly.length || state._draft) { state._poly = []; state._draft = null; edDesenhar(); } else if (state.sel.length) { state.sel = []; edDesenhar(); } else closeEditor(); }
    else if (e.key === "Enter" && state.edTool === "poly" && state._poly.length >= 3) { fecharPoly(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && state.edTool === "select" && state.sel.length) { var ii = state.sel.slice().sort(function (a, b) { return b - a; }), z; for (z = 0; z < ii.length; z++) state.celShapes.splice(ii[z], 1); state.sel = []; edDesenhar(); edArea(); }
  });
  document.addEventListener("keyup", function (e) { if (e.code === "Space") { space = false; if (state._edAberto) cv.style.cursor = (state.edTool === "select") ? "default" : "crosshair"; } });

  function fecharPoly() {
    var sh = { type: "poly", pts: state._poly.slice() };
    if (formaCruzaFaca(sh)) { flashHint("A região não pode cruzar a faca — ajuste os pontos."); return; }
    state.celShapes.push(sh); state._poly = []; state._polyCursor = null; edDesenhar(); edArea();
  }
  // Ctrl+D: duplica a seleção repetindo o último deslocamento (faz "fileira")
  function duplicarComDelta() {
    var d = state._lastDelta || { dx: state.parsed.bbox.w * 0.05, dy: 0 };
    var clones = [], i;
    for (i = 0; i < state.sel.length; i++) { var base = state.celShapes[state.sel[i]]; var c = clone(base); moverForma(c, base, d.dx, d.dy); clones.push(c); }
    for (i = 0; i < clones.length; i++) if (formaCruzaFaca(clones[i])) { flashHint("Sem espaço livre para duplicar aqui."); return; }
    var novos = []; for (i = 0; i < clones.length; i++) { state.celShapes.push(clones[i]); novos.push(state.celShapes.length - 1); }
    state.sel = novos; state._lastDelta = d; edDesenhar(); edArea();
    flashHint(novos.length + (novos.length === 1 ? " região duplicada" : " regiões duplicadas") + " — Ctrl+D repete.");
  }
  function colar() {
    // cola em cima (mesma posição das cópias); ficam selecionadas p/ arrastar tudo junto
    var novos = [], i;
    for (i = 0; i < state._clip.length; i++) { state.celShapes.push(clone(state._clip[i])); novos.push(state.celShapes.length - 1); }
    state.sel = novos; state.edTool = "select";
    var tb = document.querySelectorAll("#edTools .edtool[data-edtool]"), k;
    for (k = 0; k < tb.length; k++) tb[k].classList.toggle("active", tb[k].getAttribute("data-edtool") === "select");
    edDesenhar(); edArea();
    flashHint(novos.length + (novos.length === 1 ? " região colada" : " regiões coladas") + " em cima — arraste para posicionar.");
  }

  cv.addEventListener("mousedown", function (e) {
    if (!state._edAberto || !state.parsed) return;
    var s = rel(e), p = edInv(s.x, s.y);
    if (space || e.button === 1) { mode = "pan"; start = { sx: s.x, sy: s.y, tx: state.ed.tx, ty: state.ed.ty }; cv.style.cursor = "grabbing"; return; }
    if (e.button !== 0) return;
    if (state.edTool === "select") {
      var alvo = edHoverAlvo(s.x, s.y);
      if (alvo.tipo === "rotate") {
        var r; for (r = 0; r < state.sel.length; r++) if (state.celShapes[state.sel[r]].type === "rect") state.celShapes[state.sel[r]] = { type: "poly", pts: polyPts(state.celShapes[state.sel[r]]) };
        mode = "rotate"; origs = state.sel.map(function (i) { return clone(state.celShapes[i]); }); center = centroSelecao();
        startAng = Math.atan2(p.y - center.y, p.x - center.x); cv.style.cursor = CUR_ROT; return;
      }
      if (alvo.tipo === "resize") {
        mode = "resize"; origs = state.sel.map(function (i) { return clone(state.celShapes[i]); }); center = centroSelecao();
        initDist = Math.max(1e-3, Math.sqrt((p.x - center.x) * (p.x - center.x) + (p.y - center.y) * (p.y - center.y)));
        cv.style.cursor = edCursorResize(alvo.corner); return;
      }
      var hit = formaNoPonto(p);
      if (hit >= 0) {
        if (e.shiftKey) { var ix = state.sel.indexOf(hit); if (ix >= 0) state.sel.splice(ix, 1); else state.sel.push(hit); edDesenhar(); return; }
        if (!estaSel(hit)) state.sel = [hit];
        mode = "move"; clickHit = hit; origs = state.sel.map(function (i) { return clone(state.celShapes[i]); }); start = p; movedFar = false; cv.style.cursor = "move";
        edDesenhar();
      } else {
        mode = "marquee"; start = { x: p.x, y: p.y, shift: e.shiftKey }; movedFar = false; state._marq = null;
      }
    } else if (state.edTool === "circle" || state.edTool === "rect") {
      mode = "draw"; start = p; movedFar = false;
    }
  });

  window.addEventListener("mousemove", function (e) {
    if (!state._edAberto) return;
    var s = rel(e), p = edInv(s.x, s.y);
    if (mode === null && !space && state.edTool === "select") {
      var a = edHoverAlvo(s.x, s.y);
      cv.style.cursor = a.tipo === "rotate" ? CUR_ROT : (a.tipo === "resize" ? edCursorResize(a.corner) : (a.tipo === "move" ? "move" : "default"));
    }
    if (mode === "pan") { state.ed.tx = start.tx + (s.x - start.sx); state.ed.ty = start.ty + (s.y - start.sy); edDesenhar(); return; }
    if (mode === "draw" && start) {
      movedFar = true;
      var cand;
      if (state.edTool === "circle") cand = { type: "circle", cx: start.x, cy: start.y, r: Math.sqrt((p.x - start.x) * (p.x - start.x) + (p.y - start.y) * (p.y - start.y)) };
      else cand = { type: "rect", x0: start.x, y0: start.y, x1: p.x, y1: p.y };
      if (!formaCruzaFaca(cand)) state._draft = cand;   // congela: só cresce até encostar na faca
      edDesenhar();
    } else if (mode === "marquee") {
      movedFar = true; state._marq = { minx: Math.min(start.x, p.x), maxx: Math.max(start.x, p.x), miny: Math.min(start.y, p.y), maxy: Math.max(start.y, p.y) }; edDesenhar();
    } else if (mode === "move") {
      movedFar = true; lastDx = p.x - start.x; lastDy = p.y - start.y; var mi;
      for (mi = 0; mi < state.sel.length; mi++) moverForma(state.celShapes[state.sel[mi]], origs[mi], lastDx, lastDy);
      edDesenhar();
    } else if (mode === "resize") {
      var dd = Math.sqrt((p.x - center.x) * (p.x - center.x) + (p.y - center.y) * (p.y - center.y)), rt = dd / initDist, ri;
      for (ri = 0; ri < state.sel.length; ri++) escalarForma(state.celShapes[state.sel[ri]], origs[ri], rt, center.x, center.y);
      edDesenhar();
    } else if (mode === "rotate") {
      var ang = Math.atan2(p.y - center.y, p.x - center.x) - startAng; if (e.shiftKey) ang = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
      var gi; for (gi = 0; gi < state.sel.length; gi++) state.celShapes[state.sel[gi]] = rotarForma(origs[gi], ang, center.x, center.y);
      edDesenhar();
    } else if (state.edTool === "poly" && state._poly.length) { var c = state._poly[state._poly.length - 1]; state._polyCursor = e.shiftKey ? snap45(c, p) : p; state._polyEdgeInval = segCruzaFaca(c, state._polyCursor); edDesenhar(); }
  });

  window.addEventListener("mouseup", function () {
    if (!state._edAberto) { mode = null; return; }
    if (mode === "pan") { cv.style.cursor = space ? "grab" : (state.edTool === "select" ? "default" : "crosshair"); mode = null; return; }
    if (mode === "draw") {
      if (state._draft) { var d = state._draft, ok = (d.type === "circle" && d.r > 0) || (d.type === "rect" && Math.abs(d.x1 - d.x0) > 0 && Math.abs(d.y1 - d.y0) > 0); if (ok) state.celShapes.push(d); }
      state._draft = null; mode = null; edDesenhar(); edArea(); return;
    }
    if (mode === "marquee") {
      if (movedFar && state._marq) {
        var m = state._marq, achados = [], i2;
        for (i2 = 0; i2 < state.celShapes.length; i2++) if (rectsCruzam(bboxForma(state.celShapes[i2]), m)) achados.push(i2);
        if (start.shift) { var u; for (u = 0; u < achados.length; u++) if (state.sel.indexOf(achados[u]) < 0) state.sel.push(achados[u]); }
        else state.sel = achados;
      } else if (!start.shift) { state.sel = []; }   // clique no vazio = desmarca
      state._marq = null; mode = null; edDesenhar(); return;
    }
    if (mode === "move" || mode === "resize" || mode === "rotate") {
      if (mode === "move" && !movedFar && clickHit >= 0) { state.sel = [clickHit]; mode = null; origs = null; edDesenhar(); return; }
      var inval = false, w; for (w = 0; w < state.sel.length; w++) if (formaCruzaFaca(state.celShapes[state.sel[w]])) { inval = true; break; }
      if (inval) { var z; for (z = 0; z < state.sel.length; z++) state.celShapes[state.sel[z]] = origs[z]; flashHint("Não pode ficar sobre a faca — revertido."); }
      else if (mode === "move" && movedFar) { state._lastDelta = { dx: lastDx, dy: lastDy }; }   // guarda p/ Ctrl+D
      mode = null; origs = null; edDesenhar(); edArea(); return;
    }
    mode = null;
  });

  cv.addEventListener("click", function (e) {
    if (!state._edAberto || state.edTool !== "poly") return;
    if (movedFar) { movedFar = false; return; }
    var s = rel(e), p = edInv(s.x, s.y);
    if (state._poly.length && e.shiftKey) p = snap45(state._poly[state._poly.length - 1], p);
    if (state._poly.length >= 3) {
      var q0x = edX(state._poly[0].x), q0y = edY(state._poly[0].y);
      if (Math.abs(q0x - s.x) < 12 && Math.abs(q0y - s.y) < 12) { fecharPoly(); return; }
    }
    if (state._poly.length && segCruzaFaca(state._poly[state._poly.length - 1], p)) { flashHint("A linha não pode cruzar a faca."); return; }
    state._poly.push(p); state._polyEdgeInval = false; edDesenhar();
  });

  var hintTimer = null;
  function flashHint(msg) {
    var el = document.getElementById("edHint"); if (!el) return;
    el.innerText = msg; el.classList.add("erro");
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { el.classList.remove("erro"); el.innerText = el.getAttribute("data-default"); }, 2600);
  }
})();

// ============================================================
// CADASTROS (localStorage alphaFacaCad)
// ============================================================
var CAD_DEFAULT = { clientes: [], laminasCorte: [], laminasVinco: [], picotePrecoM: "", celastroPrecoM2: "", madeiraPlana: [], madeiraRotativa: [] };
var _cadMem = null;
function normalizeCad(c) { c = c || {}; var k; for (k in CAD_DEFAULT) if (c[k] == null) c[k] = Array.isArray(CAD_DEFAULT[k]) ? [] : CAD_DEFAULT[k]; return c; }
function temCadastro(c) { return !!((c.clientes && c.clientes.length) || (c.laminasCorte && c.laminasCorte.length) || (c.laminasVinco && c.laminasVinco.length) || (c.madeiraPlana && c.madeiraPlana.length) || (c.madeiraRotativa && c.madeiraRotativa.length) || c.picotePrecoM || c.celastroPrecoM2); }
// leitura SÍNCRONA (memória): inicia do cache local; a rede atualiza async via carregarCadRede
function lerCad() {
  if (_cadMem) return _cadMem;
  var c; try { c = JSON.parse(localStorage.getItem("alphaFacaCad") || "{}"); } catch (e) { c = {}; }
  _cadMem = normalizeCad(c); return _cadMem;
}
function salvarCad(c) {
  _cadMem = normalizeCad(c);
  try { localStorage.setItem("alphaFacaCad", JSON.stringify(_cadMem)); } catch (e) {}   // cache local
  ipc.invoke("salvar-cadastros-arquivo", { data: _cadMem }).then(function (r) { atualizarStatusRede(r && r.ok); });
}
// puxa a versão mais recente do arquivo de rede (caminho fixo, definido no main). cb ao terminar.
function carregarCadRede(cb) {
  ipc.invoke("ler-cadastros-arquivo").then(function (r) {
    if (r && r.dir) { var pe = document.getElementById("cadRedePath"); if (pe) pe.innerText = r.dir; }
    if (r && r.ok && r.data) { _cadMem = normalizeCad(r.data); try { localStorage.setItem("alphaFacaCad", JSON.stringify(_cadMem)); } catch (e) {} atualizarStatusRede(true); }
    else if (r && r.ok) { atualizarStatusRede(true); var loc = lerCad(); if (temCadastro(loc)) salvarCad(loc); } // semeia o arquivo
    else { atualizarStatusRede(false); }                        // offline: mantém cache local
    if (cb) cb();
  }).catch(function () { atualizarStatusRede(false); if (cb) cb(); });
}
function refletirCadNaUI() {
  var cad = lerCad();
  var p = document.getElementById("cPicote"); if (p) p.value = cad.picotePrecoM;
  var c = document.getElementById("cCelastro"); if (c) c.value = cad.celastroPrecoM2;
  renderCadastros();
}
function atualizarStatusRede(ok) {
  var el = document.getElementById("cadRedeStatus"); if (!el) return;
  if (ok === false) { el.className = "rede-status off"; el.innerText = "rede indisponível — usando cópia local"; }
  else { el.className = "rede-status on"; el.innerText = "compartilhado na rede"; }
}

function initCadastros() {
  var cad = lerCad();
  // singles
  document.getElementById("cPicote").value = cad.picotePrecoM;
  document.getElementById("cCelastro").value = cad.celastroPrecoM2;
  ["cPicote", "cCelastro"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      var c = lerCad();
      c.picotePrecoM = val("cPicote"); c.celastroPrecoM2 = val("cCelastro");
      salvarCad(c); recalcOrcamento();
    });
  });
  // add handlers
  document.getElementById("cliAdd").addEventListener("click", function () {
    var nome = val("cliNome").trim(); if (!nome) return;
    var c = lerCad(); c.clientes.push(nome); salvarCad(c); document.getElementById("cliNome").value = ""; renderCadastros();
  });
  document.getElementById("lcAdd").addEventListener("click", function () {
    var c = lerCad(); c.laminasCorte.push({ id: novoId(), nome: val("lcNome").trim(), dentes: val("lcDentes").trim(), altura: val("lcAltura").trim(), precoM: val("lcPreco") });
    salvarCad(c); ["lcNome", "lcDentes", "lcAltura", "lcPreco"].forEach(function (i) { document.getElementById(i).value = ""; }); renderCadastros();
  });
  document.getElementById("lvAdd").addEventListener("click", function () {
    var c = lerCad(); c.laminasVinco.push({ id: novoId(), altura: val("lvAltura").trim(), precoM: val("lvPreco") });
    salvarCad(c); document.getElementById("lvAltura").value = ""; document.getElementById("lvPreco").value = ""; renderCadastros();
  });
  document.getElementById("mpAdd").addEventListener("click", function () {
    var c = lerCad(); c.madeiraPlana.push({ id: novoId(), espessura: val("mpEsp").trim(), precoM2: val("mpPreco") });
    salvarCad(c); document.getElementById("mpEsp").value = ""; document.getElementById("mpPreco").value = ""; renderCadastros();
  });
  document.getElementById("mrAdd").addEventListener("click", function () {
    var c = lerCad(); c.madeiraRotativa.push({ id: novoId(), diametro: val("mrDia").trim(), coeficiente: val("mrCoef") });
    salvarCad(c); document.getElementById("mrDia").value = ""; document.getElementById("mrCoef").value = ""; renderCadastros();
  });
  renderCadastros();
}

function renderCadastros() {
  var cad = lerCad();
  // clientes
  linhasCad("cliList", cad.clientes.map(function (nome, i) { return { _idx: i, main: "<b>" + esc(nome) + "</b>", preco: "" }; }), function (idx) {
    var c = lerCad(); c.clientes.splice(idx, 1); salvarCad(c); renderCadastros();
  });
  // laminas corte
  linhasCad("lcList", cad.laminasCorte.map(function (l) {
    return { id: l.id, main: "<b>" + esc(l.nome || "corte") + "</b> <span>" + (l.dentes ? "· " + esc(l.dentes) + " dentes " : "") + (l.altura ? "· alt " + esc(l.altura) : "") + "</span>", preco: custo.brl(parseFloat(l.precoM) || 0) + "/m" };
  }), function (id) { removerCad("laminasCorte", id); });
  // laminas vinco
  linhasCad("lvList", cad.laminasVinco.map(function (l) {
    return { id: l.id, main: "<b>alt " + esc(l.altura) + "</b>", preco: custo.brl(parseFloat(l.precoM) || 0) + "/m" };
  }), function (id) { removerCad("laminasVinco", id); });
  // madeira plana
  linhasCad("mpList", cad.madeiraPlana.map(function (m) {
    return { id: m.id, main: "<b>" + esc(m.espessura) + "</b>", preco: custo.brl(parseFloat(m.precoM2) || 0) + "/m²" };
  }), function (id) { removerCad("madeiraPlana", id); });
  // madeira rotativa
  linhasCad("mrList", cad.madeiraRotativa.map(function (m) {
    return { id: m.id, main: "<b>Ø " + esc(m.diametro) + "</b>", preco: "coef " + esc(m.coeficiente) };
  }), function (id) { removerCad("madeiraRotativa", id); });
  preencherSelects();
  recalcOrcamento();
}
function removerCad(chave, id) {
  var c = lerCad(); c[chave] = c[chave].filter(function (x) { return String(x.id) !== String(id); }); salvarCad(c); renderCadastros();
}
function linhasCad(boxId, itens, onDel) {
  var box = document.getElementById(boxId); box.innerHTML = "";
  if (!itens.length) { box.innerHTML = '<div class="cad-vazio">nenhum cadastrado</div>'; return; }
  itens.forEach(function (it) {
    var row = document.createElement("div"); row.className = "cad-row";
    row.innerHTML = '<div class="cr-main">' + it.main + '</div>' + (it.preco ? '<div class="cr-preco">' + it.preco + '</div>' : '') +
      '<button class="cr-del" title="Excluir"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 7 h14 M9 7 V5 h6 v2 M7 7 l1 13 h8 l1-13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    row.querySelector(".cr-del").addEventListener("click", function () { onDel(it.id != null ? it.id : it._idx); });
    box.appendChild(row);
  });
}

// preenche os selects do formulário a partir dos cadastros
function preencherSelects() {
  var cad = lerCad();
  // clientes (datalist)
  var dl = document.getElementById("clientesList"); dl.innerHTML = "";
  cad.clientes.forEach(function (nome) { var o = document.createElement("option"); o.value = nome; dl.appendChild(o); });
  // espessura
  opcoes("jEspessura", cad.madeiraPlana.map(function (m) { return { id: m.id, txt: m.espessura + "  (" + custo.brl(parseFloat(m.precoM2) || 0) + "/m²)" }; }));
  // diametro
  opcoes("jDiametro", cad.madeiraRotativa.map(function (m) { return { id: m.id, txt: "Ø " + m.diametro + "  (coef " + m.coeficiente + ")" }; }));
  // lamina corte
  opcoes("jLaminaCorte", cad.laminasCorte.map(function (l) { return { id: l.id, txt: (l.nome || "corte") + (l.dentes ? " · " + l.dentes : "") + (l.altura ? " · alt " + l.altura : "") + "  (" + custo.brl(parseFloat(l.precoM) || 0) + "/m)" }; }));
  // lamina vinco
  opcoes("jLaminaVinco", cad.laminasVinco.map(function (l) { return { id: l.id, txt: "alt " + l.altura + "  (" + custo.brl(parseFloat(l.precoM) || 0) + "/m)" }; }));
}
function opcoes(selId, arr) {
  var sel = document.getElementById(selId), atual = sel.value;
  var html = '<option value="">—</option>', i, temAtual = false;
  for (i = 0; i < arr.length; i++) { html += '<option value="' + arr[i].id + '">' + esc(arr[i].txt) + '</option>'; if (String(arr[i].id) === String(atual)) temAtual = true; }
  sel.innerHTML = html; if (temAtual) sel.value = atual;
}

// ============================================================
// ORÇAMENTO (form -> custo)
// ============================================================
(function ligarForm() {
  ["jCliente", "jEspessura", "jDiametro", "jComprCalha", "jQtdCalhas", "jLaminaCorte", "jLaminaVinco", "jCelastro", "jPercentual"].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.addEventListener("input", recalcOrcamento);
  });
  var segs = document.querySelectorAll("#tipoFaca .seg"), i;
  for (i = 0; i < segs.length; i++) segs[i].addEventListener("click", function () {
    var t = this.getAttribute("data-tipo"); state.tipoFaca = t;
    var ss = document.querySelectorAll("#tipoFaca .seg"), k; for (k = 0; k < ss.length; k++) ss[k].classList.remove("active");
    this.classList.add("active");
    document.getElementById("camposPlana").hidden = (t !== "plana");
    document.getElementById("camposRotativa").hidden = (t !== "rotativa");
    recalcOrcamento();
  });
  document.getElementById("btnSalvar").addEventListener("click", salvarOrcamento);
})();

function lerJob() {
  return {
    cliente: val("jCliente").trim(), tipoFaca: state.tipoFaca,
    espessuraId: val("jEspessura"), diametroId: val("jDiametro"),
    comprimentoCalha: val("jComprCalha"), qtdCalhas: val("jQtdCalhas"),
    laminaCorteId: val("jLaminaCorte"), laminaVincoId: val("jLaminaVinco"),
    celastroAreaM2: celastroAreaM2(), percentual: val("jPercentual"),
    areaBaseM2: state.medidas ? state.medidas.areaBaseM2 : 0
  };
}
function recalcOrcamento() {
  if (!state.medidas) return;
  var orc = custo.calcular(state.medidas, lerCad(), lerJob());
  renderDemo(orc);
  document.getElementById("demoPct").innerText = "(" + orc.percentual + "%)";
  document.getElementById("demoCusto").innerText = custo.brl(orc.custo);
  document.getElementById("demoGanho").innerText = custo.brl(orc.preco - orc.custo);
  document.getElementById("demoPreco").innerText = custo.brl(orc.preco);
  var falt = document.getElementById("faltando");
  falt.innerHTML = orc.ok ? "" : "<b>Falta preencher:</b> " + orc.faltando.map(esc).join(", ");
  document.getElementById("btnSalvar").disabled = !orc.ok;
}
function renderDemo(orc) {
  var html = "", i;
  for (i = 0; i < orc.items.length; i++) {
    var it = orc.items[i];
    html += '<tr><td class="desc">' + esc(it.desc) + (it.obs ? '<small>' + esc(it.obs) + '</small>' : '') +
      '</td><td class="c">' + it.driver.toFixed(it.un === "m²" ? 3 : (it.un.indexOf("calha") >= 0 ? 0 : 2)).replace(".", ",") + ' ' + esc(it.un) + '</td>' +
      '<td class="r">' + custo.brl(it.valor) + '</td></tr>';
  }
  document.getElementById("demoTbl").innerHTML = html;
}

function salvarOrcamento() {
  if (!state.medidas) return;
  var orc = custo.calcular(state.medidas, lerCad(), lerJob());
  if (!orc.ok) return;
  var bb = state.parsed.bbox;
  var meta = {
    id: "AF" + new Date().getTime(), dataStr: agora(),
    cliente: lerJob().cliente, fileName: state.fileName, tipoFaca: state.tipoFaca,
    medidas: { corteM: state.medidas.corteM, vincoM: state.medidas.vincoM, picoteM: state.medidas.picoteM },
    facaMM: { w: duParaMM(bb.w), h: duParaMM(bb.h) },
    items: orc.items, custo: orc.custo, percentual: orc.percentual
  };
  var msg = document.getElementById("salvarMsg"); msg.className = "pdf-msg"; msg.innerText = "Salvando…";
  ipc.invoke("salvar-registro", meta).then(function (r) {
    if (r && r.ok) { msg.className = "pdf-msg ok"; msg.innerText = "Salvo! Veja em “Orçamentos salvos”."; }
    else { msg.className = "pdf-msg err"; msg.innerText = "Falha ao salvar."; }
  });
}

// ============================================================
// ORÇAMENTOS SALVOS + DETALHE
// ============================================================
function carregarSalvos() {
  ipc.invoke("listar-orcamentos").then(function (lista) {
    lista = lista || [];
    document.getElementById("salvosCount").innerText = lista.length + " orçamento" + (lista.length === 1 ? "" : "s");
    document.getElementById("salvosVazio").hidden = lista.length > 0;
    var box = document.getElementById("listaSalvos"); box.innerHTML = "";
    var i; for (i = 0; i < lista.length; i++) box.appendChild(linhaSalvo(lista[i]));
  });
}
function precoDe(m) { return (m.custo || 0) * (1 + (parseFloat(m.percentual) || 0) / 100); }
function linhaSalvo(m) {
  var row = document.createElement("div"); row.className = "orc-item"; row.style.cursor = "pointer";
  row.innerHTML =
    '<div class="oi-os"><small>faca</small><b>' + esc((m.tipoFaca || "plana").charAt(0).toUpperCase()) + '</b></div>' +
    '<div class="oi-main"><div class="oi-cliente">' + esc(m.cliente || "Sem cliente") + '</div>' +
    '<div class="oi-desc">' + esc(m.fileName || "") + '</div>' +
    '<div class="oi-meta">' + esc(m.dataStr || "") + ' &middot; ' + esc(m.tipoFaca || "") + '</div></div>' +
    '<div class="oi-total"><small class="muted small">preço</small><br><b>' + custo.brl(precoDe(m)) + '</b></div>' +
    '<div class="oi-acoes"><button class="oi-btn del" title="Excluir"><svg viewBox="0 0 24 24" width="17" height="17"><path d="M5 7 h14 M9 7 V5 h6 v2 M7 7 l1 13 h8 l1-13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';
  row.addEventListener("click", function (e) { if (e.target.closest(".oi-btn")) return; abrirDetalhe(m); });
  row.querySelector(".oi-btn.del").addEventListener("click", function (e) {
    e.stopPropagation();
    if (!confirm("Excluir este orçamento (" + (m.cliente || "") + ")? Não dá para desfazer.")) return;
    ipc.invoke("excluir-orcamento", m.id).then(carregarSalvos);
  });
  return row;
}

function fecharDetalhe() {
  document.getElementById("salvosLista").hidden = false;
  document.getElementById("salvosDetalhe").hidden = true;
}
function abrirDetalhe(m) {
  document.getElementById("salvosLista").hidden = true;
  var box = document.getElementById("salvosDetalhe"); box.hidden = false;
  var linhas = "", i;
  for (i = 0; i < m.items.length; i++) {
    var it = m.items[i];
    linhas += '<tr><td class="desc">' + esc(it.desc) + (it.obs ? '<small>' + esc(it.obs) + '</small>' : '') + '</td>' +
      '<td class="c">' + Number(it.driver).toFixed(it.un === "m²" ? 3 : (String(it.un).indexOf("calha") >= 0 ? 0 : 2)).replace(".", ",") + ' ' + esc(it.un) + '</td>' +
      '<td class="r">' + custo.brl(it.valor) + '</td></tr>';
  }
  box.innerHTML =
    '<button class="det-back" id="detBack"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 6 l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Voltar</button>' +
    '<div class="det-grid"><div>' +
      '<div class="card"><div class="card-head"><h3>' + esc(m.cliente || "Sem cliente") + '</h3><span class="hint">' + esc(m.dataStr || "") + '</span></div>' +
        '<div class="det-kv"><span>Arquivo</span><b>' + esc(m.fileName || "—") + '</b></div>' +
        '<div class="det-kv"><span>Tipo de faca</span><b>' + esc(m.tipoFaca || "—") + '</b></div>' +
        '<div class="det-kv"><span>Tamanho</span><b>' + (m.facaMM ? fmtMM(m.facaMM.w) + ' × ' + fmtMM(m.facaMM.h) + ' mm' : "—") + '</b></div>' +
        '<div class="det-kv"><span>Corte / Vinco / Picote</span><b>' + fmtM(m.medidas.corteM) + ' / ' + fmtM(m.medidas.vincoM) + ' / ' + fmtM(m.medidas.picoteM) + ' m</b></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>Composição do custo</h3><span class="hint">interno</span></div>' +
        '<table class="orc-tbl">' + linhas + '</table></div>' +
    '</div><div class="side">' +
      '<div class="card total-card">' +
        '<div class="det-kv"><span>Custo</span><b id="dCusto">' + custo.brl(m.custo) + '</b></div>' +
        '<div class="det-pct"><span class="muted small">% de ganho</span><input type="number" step="0.5" id="dPct" value="' + esc(m.percentual) + '"></div>' +
        '<div class="total-lbl">Preço do cliente</div>' +
        '<div class="total-val" id="dPreco">' + custo.brl(precoDe(m)) + '</div>' +
        '<button class="btn primary full" id="dPdf"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 2 h9 l3 3 v17 H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 13 h6 M9 17 h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Gerar orçamento do cliente</button>' +
        '<div class="pdf-msg" id="dMsg"></div>' +
      '</div></div></div>';

  document.getElementById("detBack").addEventListener("click", function () { fecharDetalhe(); carregarSalvos(); });
  document.getElementById("dPct").addEventListener("input", function () {
    m.percentual = this.value;
    document.getElementById("dPreco").innerText = custo.brl(precoDe(m));
    ipc.invoke("atualizar-percentual", { id: m.id, percentual: m.percentual });
  });
  document.getElementById("dPdf").addEventListener("click", function () {
    var msg = document.getElementById("dMsg"); msg.className = "pdf-msg"; msg.innerText = "Gerando…";
    var html = relatorio.montarHtmlCliente({ cliente: m.cliente, dataStr: m.dataStr, preco: precoDe(m) });
    var nome = "Orcamento_" + (m.cliente || "cliente").replace(/[^\w\-]+/g, "_") + ".pdf";
    ipc.invoke("gerar-pdf-cliente", { html: html, defaultName: nome }).then(function (r) {
      if (r && r.ok) { msg.className = "pdf-msg ok"; msg.innerText = "PDF gerado."; }
      else if (r && r.canceled) { msg.className = "pdf-msg"; msg.innerText = ""; }
      else { msg.className = "pdf-msg err"; msg.innerText = "Falha: " + ((r && r.error) || "erro"); }
    });
  });
}

// ---------- init ----------
initCadastros();
carregarCadRede(refletirCadNaUI);   // busca a versão de rede (se configurada)

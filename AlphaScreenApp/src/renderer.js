// Alpha Screen — UI
const { ipcRenderer } = require("electron");
const fs = require("fs");
const engine = require("./engine");

const $ = (id) => document.getElementById(id);
let pdfPath = null, colorants = [], screensPdf = {}, inksXml = {}, state = [], transp = { hardBlend: 0, softTransp: 0 }, filtro = "all";

function log(t, cls) { const e = $("log"); e.textContent = t; e.className = "log " + (cls || ""); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, c => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"); }
const ENGINE_BASES = ["\\\\aeserver16\\Engine", "\\\\192.168.1.96\\Engine", "\\\\172.16.11.96\\Engine"];
// a fabrica tem duas faixas de rede: usa a raiz do Engine que responder
function engineBase() {
  for (const b of ENGINE_BASES) { try { if (fs.existsSync(b)) return b; } catch (e) {} }
  return ENGINE_BASES[0];
}
function osPrepress(os) { return engineBase() + "\\_Jobfolder\\" + os + "\\_prepress\\"; }

/* ---------- classificação / cor ---------- */
function normKey(name) { let s = String(name).toLowerCase(); const d = /^##/.test(s), sl = /^\/\//.test(s); s = s.replace(/^##/, "").replace(/^\/\//, "").replace(/pantone/g, "").replace(/\bc\b/g, "").replace(/[\s_]+/g, ""); return (d ? "##" : sl ? "//" : "") + s; }
function classe(k) { if (String(k.tipo).toLowerCase() === "technical") return "tech"; if (String(k.book).toLowerCase() === "process") return "process"; return "spot"; }
function tipoLabel(k) { const c = classe(k); return c === "tech" ? "Técnica" : c === "process" ? "Processo" : "Spot"; }
function swatch(k) {
  const n = String(k.nome).toLowerCase();
  if (/black|preto|^k$/.test(n)) return "#141414";
  if (/cyan|ciano|^c$/.test(n)) return "#00aeef";
  if (/magenta|^m$/.test(n)) return "#ec008c";
  if (/yellow|amarel|^y$/.test(n)) return "#ffdd00";
  if (/branco|white|^w$/.test(n)) return "#f2f2f2";
  let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360;
  return "hsl(" + h + ",52%,52%)";
}
function baseName(name) { return /^(##|\/\/)/.test(name) ? name.replace(/^(##|\/\/)/, "") : name; }

/* ---------- carregar PDF ---------- */
async function loadPdf(p) {
  pdfPath = p; log("Lendo PDF…", "work");
  let pdf;
  try {
    pdf = await engine.load(p);
    colorants = engine.listColorants(pdf);
    screensPdf = engine.screensFromPdf(pdf);
    transp = engine.transparencyOf(pdf);          // análise rápida reaproveitando o load
  } catch (e) { log("Erro ao ler PDF: " + (e.message || e), "err"); return; }
  $("hero").style.display = "none";
  $("workspace").style.display = "flex";
  $("pdfName").textContent = p.replace(/^.*[\\\/]/, "");
  $("pdfMeta").textContent = colorants.length + " colorantes · " + Object.keys(screensPdf).length + " com screen" + (transp.softTransp ? " · " + transp.softTransp + " transparências" : "");
  const m = p.replace(/^.*[\\\/]/, "").match(/(\d{6,})/);
  if (m && !$("os").value) $("os").value = m[1];
  buildTable();
  log("PDF carregado. Confira as junções e converta.", "");
}

/* ---------- puxar OS (screens do XML) ---------- */
function pullXml() {
  const os = $("os").value.trim();
  if (!os) { log("Informe a ordem de serviço.", "warn"); $("os").focus(); return; }
  log("Puxando XML da OS…", "work");
  // usa o host? não — aqui é Node: lê direto (mesma lógica do Xml_upload)
  const dir = engineBase() + "\\_Jobfolder\\" + os + "\\_xml\\";
  let file;
  try { const fl = fs.readdirSync(dir).filter(f => /\.xml$/i.test(f)).sort(); if (fl.length) file = dir + fl[fl.length - 1]; } catch (e) {}
  if (!file) { log("Sem XML acessível pra OS " + os + ".", "err"); return; }
  let txt; try { txt = fs.readFileSync(file, "utf8"); } catch (e) { log("Não li o XML: " + e.message, "err"); return; }
  inksXml = {};
  let m, re = /<Ink\b([^>]*)\/?>/g, n = 0;
  while ((m = re.exec(txt)) !== null) {
    const at = m[1], g = (k) => { const r = new RegExp(k + '="([^"]*)"').exec(at); return r ? r[1] : ""; };
    const nome = g("Name"); if (!nome || nome === "All") continue;
    inksXml[normKey(nome)] = { nome, ang: g("Angle"), lpi: g("LPI"), dot: g("DotShape"), tipo: g("Type"), book: g("Book"), ref: g("Ref") }; n++;
  }
  const prod = (/<Order\b[^>]*Product="([^"]*)"/.exec(txt) || [])[1] || "";
  $("xmlInfo").style.display = ""; $("xmlInfo").innerHTML = "<b>OS " + esc(os) + "</b>" + (prod ? " · " + esc(prod) : "") + " · " + n + " tintas do XML aplicadas.";
  buildTable();
  log("Screening do XML aplicado.", "ok");
}

function screenFor(colorant) {
  const k = inksXml[normKey(colorant)];
  if (k && k.lpi && k.ang) return { f: +k.lpi, a: +k.ang, dot: k.dot || "C", src: "XML" };
  if (screensPdf[colorant]) return Object.assign({ src: "PDF" }, screensPdf[colorant]);
  return null;
}

/* ---------- tabela ---------- */
function buildTable() {
  state = colorants.map(c => {
    const prev = state.find(s => s.color === c);
    let target = prev ? prev.target : c;
    if (!prev && /^(##|\/\/)/.test(c)) { const bk = normKey(c).replace(/^(##|\/\/)/, ""); const match = colorants.find(o => !/^(##|\/\/)/.test(o) && normKey(o) === bk); if (match) target = match; }
    return { color: c, target, screen: screenFor(c) };
  });
  const opts = colorants.slice().sort();
  const tb = $("inkBody"); tb.innerHTML = "";
  state.forEach(s => {
    const tr = document.createElement("tr");
    const dual = /^(##|\/\/)/.test(s.color); if (dual) tr.className = "dual";
    const sc = s.screen;
    const dtag = /^##/.test(s.color) ? "<span class='dtag'>##</span>" : /^\/\//.test(s.color) ? "<span class='dtag'>//</span>" : "";
    const inkK = inksXml[normKey(s.color)] || {};
    const book = inkK.book || (screensPdf[s.color] ? "" : "");
    const cls = (String(inkK.tipo).toLowerCase() === "technical") ? "tech" : (/^process$/i.test(book) || /cyan|magenta|yellow|black/i.test(s.color)) ? "process" : "spot";
    tr.innerHTML =
      "<td><span class='sw' style='background:" + swatch({ nome: s.color }) + "'></span></td>" +
      "<td><div class='tname'>" + esc(s.color) + dtag + "</div>" + (inkK.ref ? "<div class='tref'>" + esc(inkK.ref) + "</div>" : "") + "</td>" +
      "<td><span class='badge " + cls + "'>" + (cls === "tech" ? "Técnica" : cls === "process" ? "Processo" : "Spot") + "</span></td>" +
      "<td class='num'>" + (sc ? sc.a + "°" : "<span class='miss'>—</span>") + "</td>" +
      "<td class='num'>" + (sc ? sc.f : "<span class='miss'>?</span>") + "</td>" +
      "<td class='dotc'>" + (sc ? esc(sc.dot) : "<span class='miss'>?</span>") + "</td>" +
      "<td></td>";
    const sel = document.createElement("select");
    opts.forEach(o => { const op = document.createElement("option"); op.value = o; op.textContent = (o === s.color ? "— não juntar —" : "→ " + o); sel.appendChild(op); });
    sel.value = s.target; if (s.target !== s.color) sel.classList.add("merged");
    sel.addEventListener("change", () => { s.target = sel.value; sel.classList.toggle("merged", sel.value !== s.color); });
    tr.lastChild.appendChild(sel);
    if (filtro === "all" || (filtro === "dual" && dual) || (filtro === "process" && cls === "process") || (filtro === "spot" && (cls === "spot" || cls === "tech"))) tb.appendChild(tr);
  });
  $("btnConvert").disabled = false;
}

/* ---------- converter + salvar no _prepress + resetar ---------- */
async function convert() {
  const screens = {}, mergesByTarget = {}; let semScreen = [];
  state.forEach(s => {
    if (s.screen) screens[s.color] = { f: s.screen.f, a: s.screen.a, dot: s.screen.dot };
    else if (s.target !== s.color) semScreen.push(s.color);
    if (s.target !== s.color) (mergesByTarget[s.target] = mergesByTarget[s.target] || []).push(s.color);
  });
  if (semScreen.length) { log("Tintas a juntar sem screen (puxe a OS): " + semScreen.join(", "), "err"); return; }
  const merges = Object.keys(mergesByTarget).map(t => ({ target: t, sources: mergesByTarget[t] }));
  if (!merges.length) { log("Nenhuma junção definida — escolha ao menos uma chapa destino.", "warn"); return; }

  // aviso só no caso perigoso (blend não-separável)
  if (transp.hardBlend) {
    if (!confirm("⚠ " + transp.hardBlend + " objeto(s) com blend NÃO-SEPARÁVEL (Matiz/Cor/Saturação/Luminosidade).\n\nNessas áreas o rip pode não decidir o screen certo. O recomendado é ajustar na arte (veja o Guia). Converter mesmo assim?")) {
      log("Cancelado — ajuste os blends não-separáveis e tente de novo.", "warn"); return;
    }
  }

  // OS: do campo (auto-preenchido do nome/Puxar). Se não tiver, pede.
  const os = ($("os").value.match(/(\d{6,})/) || [])[1];
  if (!os) { log("Informe a ordem de serviço para salvar no _prepress.", "warn"); $("os").focus(); return; }
  const dir = osPrepress(os);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  const outPath = dir + pdfPath.replace(/^.*[\\\/]/, "");

  $("btnConvert").disabled = true;
  try {
    const r = await engine.convert(pdfPath, outPath, { screens, merges }, (m) => log(m, "work"));
    log("✓ Convertido: " + r.injected + " objetos · " + r.renamed + " tintas juntadas. Salvo em _prepress da OS " + os + ".", "ok");
    setTimeout(resetAll, 2600);
  } catch (e) { log("Erro na conversão: " + (e.message || e), "err"); $("btnConvert").disabled = false; }
}

/* ---------- reset ---------- */
function resetAll() {
  pdfPath = null; colorants = []; screensPdf = {}; inksXml = {}; state = []; transp = { hardBlend: 0, softTransp: 0 };
  $("workspace").style.display = "none";
  $("hero").style.display = "flex";
  $("xmlInfo").style.display = "none";
  $("inkBody").innerHTML = "";
  $("os").value = "";
  $("btnConvert").disabled = true;
  log("Pronto para o próximo arquivo.", "");
}

/* ---------- eventos ---------- */
const drop = $("drop");
async function pick() { const p = await ipcRenderer.invoke("open-dialog"); if (p) loadPdf(p); }
drop.addEventListener("click", pick);
$("pick").addEventListener("click", (e) => { e.stopPropagation(); pick(); });
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f && /\.pdf$/i.test(f.name)) loadPdf(f.path); else log("Arraste um arquivo .pdf", "err"); });
$("btnReset").addEventListener("click", resetAll);
$("btnPull").addEventListener("click", pullXml);
$("os").addEventListener("keydown", (e) => { if (e.key === "Enter") pullXml(); });
$("btnConvert").addEventListener("click", convert);
const chips = $("filters").querySelectorAll(".chip");
chips.forEach(c => c.addEventListener("click", () => { chips.forEach(x => x.classList.remove("active")); c.classList.add("active"); filtro = c.getAttribute("data-f"); if (colorants.length) buildTable(); }));

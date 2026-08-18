// Alpha Screen - motor de conversao (pdf-lib), gravacao INCREMENTAL.
// Junta colorantes mantendo o screen por objeto (dual numa chapa so):
// em cada content, apos "/CSx cs" de um colorante com screen, injeta "/ASgN gs"
// (ExtGState com /HT Type1 do screen daquele colorante); depois renomeia o
// colorante fonte (##X) -> alvo (X).
// IMPORTANTE: mantem os bytes originais INTACTOS e so ANEXA no fim os objetos
// mudados (nao regrava o PDF). Assim so o screening muda; o resto fica identico.
const fs = require("fs");
const zlib = require("zlib");
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, PDFRef, PDFString, decodePDFRawStream } = require("pdf-lib");

function pad10(n) { let x = String(n); while (x.length < 10) x = "0" + x; return x; }

// normaliza nome de tinta pra casar colorante do PDF com tinta do XMP
function normKeyInk(name) {
  let s = String(name).toLowerCase(); const d = /^##/.test(s), sl = /^\/\//.test(s);
  s = s.replace(/^##/, "").replace(/^\/\//, "").replace(/pantone/g, "").replace(/\bc\b/g, "").replace(/[\s_]+/g, "");
  return (d ? "##" : sl ? "//" : "") + s;
}
function parseRdfInks(xmp) {
  const inks = []; const re = /<rdf:li\b(?:(?!<\/rdf:li>)[\s\S])*?<\/rdf:li>/g; let m;
  while ((m = re.exec(xmp)) !== null) {
    const b = m[0];
    const g = (t) => { const r = new RegExp('<egInk:' + t + '>([^<]*)</egInk:' + t + '>').exec(b); return r ? r[1] : null; };
    if (g("name") === null) continue;
    inks.push({ block: b, name: g("name"), type: g("type"), book: g("book"), egname: g("egname"), r: g("r"), gg: g("g"), bb: g("b") });
  }
  return inks;
}
function parseInkStr(blk) {
  const nm = /\/NAME \(([^)]*)\)/.exec(blk), gp = /\/GROUP \(([^)]*)\)/.exec(blk), cm = /\/CMYK\[([^\]]*)\]/.exec(blk);
  return { name: nm ? nm[1] : null, group: gp ? gp[1] : null, cmyk: cm ? cm[1] : null };
}
// RENOMEIA a tinta ## pra base (identidade+cor da base) MANTENDO o screen dela,
// nas duas formas do XMP Esko. Assim a chapa mostra 2 entradas (base + ##).
function mergeInksInXmp(xmp, renameTo) {
  const inks = parseRdfInks(xmp);
  const baseByKey = {}; inks.forEach(k => { if (!/^(##|\/\/)/.test(k.name)) baseByKey[normKeyInk(k.name)] = k; });
  Object.keys(renameTo).forEach(src => {
    const base = baseByKey[normKeyInk(renameTo[src])]; if (!base) return;
    const srcInk = inks.find(k => k.name === src); if (!srcInk) return;
    let nb = srcInk.block;
    const setF = (t, v) => { if (v != null) nb = nb.replace(new RegExp('(<egInk:' + t + '>)[^<]*(</egInk:' + t + '>)'), '$1' + v + '$2'); };
    setF("name", base.name); setF("type", base.type); setF("book", base.book); setF("egname", base.egname);
    setF("r", base.r); setF("g", base.gg); setF("b", base.bb);
    xmp = xmp.replace(srcInk.block, nb);
  });
  const strBlocks = xmp.match(/<<(?:(?!>>)[\s\S])*?>>/g) || [];
  const strBase = {}; strBlocks.forEach(blk => { const p = parseInkStr(blk); if (p.name && !/^(##|\/\/)/.test(p.name)) strBase[normKeyInk(p.name)] = p; });
  Object.keys(renameTo).forEach(src => {
    const base = strBase[normKeyInk(renameTo[src])]; if (!base) return;
    strBlocks.forEach(blk => { const p = parseInkStr(blk); if (p.name === src) {
      let nb = blk;
      if (base.name != null) nb = nb.replace(/\/NAME \([^)]*\)/, '/NAME (' + base.name + ')');
      if (base.group != null) nb = nb.replace(/\/GROUP \([^)]*\)/, '/GROUP (' + base.group + ')');
      if (base.cmyk != null) nb = nb.replace(/\/CMYK\[[^\]]*\]/, '/CMYK[' + base.cmyk + ']');
      xmp = xmp.replace(blk, nb);
    }});
  });
  return xmp;
}

function decodeName(enc) {
  return String(enc).replace(/^\//, "").replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function nameOf(pdfName) { return pdfName && pdfName.encodedName ? pdfName.encodedName : String(pdfName); }

// --- transparencia: blends que fingem overprint (corrigiveis) + transparencia real (risco) ---
function bmName(bm) {
  if (bm && bm.encodedName) return bm.encodedName.replace(/^\//, "");
  if (bm instanceof PDFArray && bm.size()) { const f = bm.get(0); return f && f.encodedName ? f.encodedName.replace(/^\//, "") : "Normal"; }
  return "Normal";
}
function numOr(v, def) { return (v !== undefined && v !== null) ? Number(String(v)) : def; }
function scanTransparency(ctx) {
  const blendFix = []; let hardBlend = 0, softTransp = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of("Type")) === PDFName.of("ExtGState")) {
      const bm = bmName(obj.get(PDFName.of("BM")));
      const ca = numOr(obj.get(PDFName.of("ca")), 1), CA = numOr(obj.get(PDFName.of("CA")), 1);
      const sm = obj.get(PDFName.of("SMask"));
      const hasSMask = sm && String(sm) !== "/None";
      if (/^(Hue|Color|Saturation|Luminosity)$/.test(bm)) hardBlend++;          // caso perigoso e bem-definido
      else if ((bm === "Multiply" || bm === "Darken") && ca === 1 && CA === 1 && !hasSMask) blendFix.push(ref); // corrigivel
      if (ca < 1 || CA < 1) softTransp++;
      if (hasSMask) softTransp++;
    }
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Image") && obj.dict.get(PDFName.of("SMask"))) softTransp++;
  }
  return { blendFix, hardBlend, softTransp };
}
// coleta unidades de conteudo (paginas + Form XObjects) com Resources
function collectUnits(pdf) {
  const ctx = pdf.context, units = [];
  const getRes = (v) => { v = v instanceof PDFRef ? ctx.lookup(v) : v; return v instanceof PDFDict ? v : null; };
  for (const p of pdf.getPages()) {
    const res = getRes(p.node.get(PDFName.of("Resources")));
    const c = p.node.get(PDFName.of("Contents")); const refs = [];
    if (c instanceof PDFRef) refs.push(c); else if (c instanceof PDFArray) for (let i = 0; i < c.size(); i++) refs.push(c.get(i));
    if (res) units.push({ ref: p.ref, res, refs });
  }
  for (const [ref, obj] of ctx.enumerateIndirectObjects())
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Form")) {
      const res = getRes(obj.dict.get(PDFName.of("Resources")));
      if (res) units.push({ ref, res, refs: [ref] });
    }
  return units;
}

// So avisa das transparencias que SE SOBREPOEM as regioes ## (onde o screen vaza).
function riskyNearDual(ctx, units) {
  function egRisk(eg) {
    if (!(eg instanceof PDFDict)) return null;
    const ca = numOr(eg.get(PDFName.of("ca")), 1), CA = numOr(eg.get(PDFName.of("CA")), 1);
    const sm = eg.get(PDFName.of("SMask")); const hasSM = sm && String(sm) !== "/None";
    const bm = bmName(eg.get(PDFName.of("BM")));
    if (/^(Hue|Color|Saturation|Luminosity)$/.test(bm)) return "blend não-separável";
    if (ca < 1 || CA < 1) return "opacidade < 100%";
    if (hasSM) return "soft mask";
    return null;
  }
  const isHash = (c) => /^(##|\/\/)/.test(c || "");
  // formas (Form XObject) que pintam ## -> a caixa delas conta como regiao ##
  const formHasHash = new Set();
  for (const u of units) {
    const csd = u.res.get(PDFName.of("ColorSpace"));
    if (csd instanceof PDFDict) for (const [k, v] of csd.entries()) { const cs = v instanceof PDFRef ? ctx.lookup(v) : v; if (cs instanceof PDFArray && cs.get(0) === PDFName.of("Separation") && isHash(decodeName(nameOf(cs.get(1))))) { formHasHash.add(u.ref.objectNumber); break; } }
  }
  const mul = (m, C) => [m[0] * C[0] + m[1] * C[2], m[0] * C[1] + m[1] * C[3], m[2] * C[0] + m[3] * C[2], m[2] * C[1] + m[3] * C[3], m[4] * C[0] + m[5] * C[2] + C[4], m[4] * C[1] + m[5] * C[3] + C[5]];
  const tp = (C, x, y) => [C[0] * x + C[2] * y + C[4], C[1] * x + C[3] * y + C[5]];
  const over = (a, b) => a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const flagged = {};
  for (const u of units) {
    const csColor = {}, gsRisk = {}, imgRisk = {}, xForm = {};
    const csd = u.res.get(PDFName.of("ColorSpace"));
    if (csd instanceof PDFDict) for (const [k, v] of csd.entries()) { const cs = v instanceof PDFRef ? ctx.lookup(v) : v; if (cs instanceof PDFArray && cs.get(0) === PDFName.of("Separation")) csColor[nameOf(k)] = decodeName(nameOf(cs.get(1))); }
    const egd = u.res.get(PDFName.of("ExtGState"));
    if (egd instanceof PDFDict) for (const [k, v] of egd.entries()) { const r = egRisk(v instanceof PDFRef ? ctx.lookup(v) : v); if (r) gsRisk[nameOf(k)] = r; }
    const xod = u.res.get(PDFName.of("XObject"));
    if (xod instanceof PDFDict) for (const [k, v] of xod.entries()) { const xo = v instanceof PDFRef ? ctx.lookup(v) : v; if (xo instanceof PDFRawStream) { if (xo.dict.get(PDFName.of("Subtype")) === PDFName.of("Image") && xo.dict.get(PDFName.of("SMask"))) imgRisk[nameOf(k)] = "imagem transparente"; if (xo.dict.get(PDFName.of("Subtype")) === PDFName.of("Form") && v instanceof PDFRef && formHasHash.has(v.objectNumber)) xForm[nameOf(k)] = true; } }
    const hashHere = Object.values(csColor).some(isHash) || Object.keys(xForm).length;
    const riskHere = Object.keys(gsRisk).length || Object.keys(imgRisk).length;
    if (!hashHere || !riskHere) continue;

    let txt = ""; for (const sref of u.refs) { const st = ctx.lookup(sref); if (st instanceof PDFRawStream) { try { txt += Buffer.from(decodePDFRawStream(st).decode()).toString("latin1") + " "; } catch (e) { } } }
    const toks = txt.match(/\/[^\s\/\[\]<>(){}]+|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[A-Za-z*'"]+/g) || [];
    let ctm = [1, 0, 0, 1, 0, 0], stack = [], nums = [], last = null, box = null, curFill = null, curRisk = null;
    const hboxes = [], rboxes = [];
    const ext = (x, y) => { if (!box) box = [x, y, x, y]; else { if (x < box[0]) box[0] = x; if (y < box[1]) box[1] = y; if (x > box[2]) box[2] = x; if (y > box[3]) box[3] = y; } };
    const paint = () => { if (box) { if (isHash(curFill)) hboxes.push(box); if (curRisk) rboxes.push({ b: box, k: curRisk }); } box = null; };
    for (const t of toks) {
      if (/^[-+.\d]/.test(t)) { const n = parseFloat(t); if (!isNaN(n)) nums.push(n); continue; }
      if (t[0] === "/") { last = t; continue; }
      if (t === "q") stack.push(ctm.slice());
      else if (t === "Q") ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (t === "cm" && nums.length >= 6) ctm = mul(nums.slice(-6), ctm);
      else if ((t === "m" || t === "l") && nums.length >= 2) { const p = tp(ctm, nums[nums.length - 2], nums[nums.length - 1]); ext(p[0], p[1]); }
      else if (t === "c" && nums.length >= 6) { for (let i = 0; i < 6; i += 2) { const p = tp(ctm, nums[nums.length - 6 + i], nums[nums.length - 5 + i]); ext(p[0], p[1]); } }
      else if ((t === "v" || t === "y") && nums.length >= 4) { for (let i = 0; i < 4; i += 2) { const p = tp(ctm, nums[nums.length - 4 + i], nums[nums.length - 3 + i]); ext(p[0], p[1]); } }
      else if (t === "re" && nums.length >= 4) { const x = nums[nums.length - 4], yy = nums[nums.length - 3], w = nums[nums.length - 2], h = nums[nums.length - 1];[[x, yy], [x + w, yy], [x, yy + h], [x + w, yy + h]].forEach(q => { const p = tp(ctm, q[0], q[1]); ext(p[0], p[1]); }); }
      else if (t === "cs") { if (last) curFill = csColor[last] || null; }
      else if (t === "gs") { if (last) curRisk = gsRisk[last] || null; }
      else if (t === "Do") { if (last) { const b = [Infinity, Infinity, -Infinity, -Infinity];[[0, 0], [1, 0], [0, 1], [1, 1]].forEach(q => { const p = tp(ctm, q[0], q[1]); if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }); if (xForm[last]) hboxes.push(b); if (imgRisk[last]) rboxes.push({ b, k: imgRisk[last] }); } }
      else if (t === "f" || t === "F" || t === "f*" || t === "S" || t === "s" || t === "B" || t === "B*" || t === "b" || t === "b*") paint();
      else if (t === "n") box = null;
      nums = []; last = null;
    }
    for (const r of rboxes) for (const h of hboxes) if (over(r.b, h)) { flagged[r.k] = (flagged[r.k] || 0) + 1; break; }
  }
  return flagged;
}

async function analyzeTransparency(inPath) {
  const pdf = await load(inPath);
  const t = scanTransparency(pdf.context);
  return { blendFix: t.blendFix.length, hardBlend: t.hardBlend, softTransp: t.softTransp };
}

function type1Dict(ctx, f, a, dot) {
  const d = ctx.obj({});
  d.set(PDFName.of("Type"), PDFName.of("Halftone"));
  d.set(PDFName.of("HalftoneType"), ctx.obj(1));
  d.set(PDFName.of("Frequency"), ctx.obj(Number(f)));
  d.set(PDFName.of("Angle"), ctx.obj(Number(a)));
  d.set(PDFName.of("TransferFunction"), PDFName.of("Identity"));
  d.set(PDFName.of("SpotFunction"), PDFName.of("SimpleDot"));
  d.set(PDFName.of("EskoPNDSN"), PDFName.of(dot || "C"));
  const ext = ctx.obj({}); ext.set(PDFName.of("DotName"), PDFName.of(dot || "C"));
  d.set(PDFName.of("Esko_ExtHT"), ext);
  return d;
}

function decodeStream(s) {
  const raw = Buffer.from(s.contents);
  const filt = s.dict.get(PDFName.of("Filter"));
  const isFlate = filt && (String(filt) === "/FlateDecode" || (filt.array && filt.array.some(x => String(x) === "/FlateDecode")));
  if (isFlate) { try { return zlib.inflateSync(raw).toString("latin1"); } catch (e) { return raw.toString("latin1"); } }
  return raw.toString("latin1");
}

async function load(inPath) {
  return PDFDocument.load(fs.readFileSync(inPath), { throwOnInvalidObject: false, updateMetadata: false });
}

// lista colorantes Separation + DeviceN (unicos, decodificados)
function listColorants(pdf) {
  const ctx = pdf.context, set = {};
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFArray && obj.get(0) === PDFName.of("Separation")) {
      set[decodeName(nameOf(obj.get(1)))] = 1;
    } else if (obj instanceof PDFArray && obj.get(0) === PDFName.of("DeviceN")) {
      const names = obj.get(1);
      if (names instanceof PDFArray) for (let i = 0; i < names.size(); i++) set[decodeName(nameOf(names.get(i)))] = 1;
    }
  }
  delete set["All"]; delete set["None"];
  return Object.keys(set);
}

// le os screens ja presentes no PDF (master HalftoneType 5 -> Type1 por colorante)
function screensFromPdf(pdf) {
  const ctx = pdf.context, out = {};
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of("Type")) === PDFName.of("Halftone") &&
        String(obj.get(PDFName.of("HalftoneType"))) === "5") {
      for (const [key, val] of obj.entries()) {
        const kn = nameOf(key);
        if (kn === "/Type" || kn === "/HalftoneType" || kn === "/HalftoneName" || kn === "/Default") continue;
        const t1 = val instanceof PDFRef ? ctx.lookup(val) : val;
        if (t1 instanceof PDFDict) {
          const f = t1.get(PDFName.of("Frequency")), a = t1.get(PDFName.of("Angle"));
          let dot = "C"; const ext = t1.get(PDFName.of("Esko_ExtHT"));
          if (ext instanceof PDFDict) dot = decodeName(nameOf(ext.get(PDFName.of("DotName"))));
          else { const e2 = t1.get(PDFName.of("EskoPNDSN")); if (e2) dot = decodeName(nameOf(e2)); }
          if (f && a) out[decodeName(kn)] = { f: Number(String(f)), a: Number(String(a)), dot: dot };
        }
      }
    }
  }
  return out;
}

// plan = { screens:{colorante:{f,a,dot}}, merges:[{target, sources:[..]}] }
// Gravacao INCREMENTAL: preserva o original byte-a-byte e anexa so o que muda.
async function convert(inPath, outPath, plan, onProgress) {
  const log = onProgress || function () {};
  const orig = fs.readFileSync(inPath);
  const s = orig.toString("latin1");
  const pdf = await PDFDocument.load(orig, { throwOnInvalidObject: false, updateMetadata: false });
  const ctx = pdf.context;

  let rootNum = ctx.trailerInfo && ctx.trailerInfo.Root ? ctx.trailerInfo.Root.objectNumber : null;
  if (!rootNum) { const m = s.match(/\/Root\s+(\d+)\s+\d+\s+R(?![\s\S]*\/Root)/); rootNum = m ? +m[1] : null; }
  const sxAll = s.match(/startxref\s+(\d+)/g);
  const prevXref = sxAll ? sxAll[sxAll.length - 1].match(/(\d+)/)[1] : "0";

  const changed = new Set();
  const created = [];
  const mark = (ref) => { if (ref) changed.add(ref.objectNumber); };

  const renameTo = {};
  for (const m of plan.merges) for (const src of m.sources) if (src !== m.target) renameTo[src] = m.target;

  log("Criando halftones (masters Type5, jeito Esko)…");
  function encPdfName(x) { return String(x).replace(/#/g, "#23").replace(/ /g, "#20").replace(/\//g, "#2F"); }
  const t1cache = {};
  function t1ref(sc) { const k = sc.f + "|" + sc.a + "|" + sc.dot; if (!t1cache[k]) { const r = ctx.register(type1Dict(ctx, sc.f, sc.a, sc.dot)); created.push(r); t1cache[k] = r; } return t1cache[k]; }
  // colorantes base (nao-##) com seus screens.
  // IMPORTANTE: semeia a partir de TODAS as tintas do master original (screensFromPdf),
  // nao so das do plano. Tinta declarada no job mas que nao aparece como colorspace usado
  // (ex.: Magenta/Yellow de processo num arquivo que so pinta spots) fica de fora do
  // plano/listColorants; se nao entrar no master, o RIP do Esko aborta com
  // "Missing halftone information for colorant X" (ele exige cada tinta de processo
  // explicita, nao aceita o /Default). O plano ainda tem precedencia (override do operador).
  const baseScreen = {};
  const fullScreens = screensFromPdf(pdf);
  for (const c in fullScreens) if (!/^(##|\/\/)/.test(c)) baseScreen[c] = fullScreens[c];
  for (const c in plan.screens) if (!/^(##|\/\/)/.test(c)) baseScreen[c] = plan.screens[c];
  const baseColorants = Object.keys(baseScreen);
  const defScreen = baseColorants.length ? baseScreen[baseColorants[0]] : { f: 150, a: 0, dot: "C" };
  let hn = 1;
  // master Type5 = todas as bases -> screen base, EXCETO overrideColor -> overrideScreen
  function buildMaster(overrideColor, overrideScreen) {
    const d = ctx.obj({});
    d.set(PDFName.of("Type"), PDFName.of("Halftone"));
    d.set(PDFName.of("HalftoneType"), ctx.obj(5));
    for (const c of baseColorants) {
      const sc = (c === overrideColor) ? overrideScreen : baseScreen[c];
      d.set(PDFName.of(encPdfName(c)), t1ref(sc));
    }
    d.set(PDFName.of("Default"), t1ref(defScreen));
    d.set(PDFName.of("HalftoneName"), PDFString.of("AS_HT5_" + (hn++)));
    const r = ctx.register(d); created.push(r); return r;
  }
  // um master + ExtGState por tinta ## mesclada (a base do ## aponta pro screen do ##)
  const egByMerge = {};
  for (const src in renameTo) {
    const base = renameTo[src];
    const overrideScreen = plan.screens[src] || baseScreen[base] || defScreen;
    const masterRef = buildMaster(base, overrideScreen);
    const eg = ctx.obj({});
    eg.set(PDFName.of("Type"), PDFName.of("ExtGState"));
    eg.set(PDFName.of("HT"), masterRef);
    const egRef = ctx.register(eg); created.push(egRef);
    egByMerge[src] = egRef;
  }

  // master BASE (todas as bases -> screen base). A referencia (PackZ) poe um
  // master em TODO objeto - base tb - senao o base herda um /HT errado no RIP.
  let egBaseMaster = null;
  if (baseColorants.length) {
    const bmRef = buildMaster(null, null);   // sem override = todas as bases
    const eg = ctx.obj({});
    eg.set(PDFName.of("Type"), PDFName.of("ExtGState"));
    eg.set(PDFName.of("HT"), bmRef);
    egBaseMaster = ctx.register(eg); created.push(egBaseMaster);
  }
  function egForColor(color) {
    if (egByMerge[color]) return egByMerge[color];   // tinta ## -> master do ##
    if (baseScreen[color]) return egBaseMaster;       // tinta base c/ screen -> master base
    return null;
  }

  // unidades de conteudo: paginas + Form XObjects (com onde vive o ExtGState)
  const units = [];
  function resInfo(getResVal, defOwnerRef) {
    const resVal = getResVal();
    let resDict, resOwner;
    if (resVal instanceof PDFRef) { resDict = ctx.lookup(resVal); resOwner = resVal; }
    else if (resVal instanceof PDFDict) { resDict = resVal; resOwner = defOwnerRef; }
    else return null;
    if (!(resDict instanceof PDFDict)) return null;
    let egVal = resDict.get(PDFName.of("ExtGState")), egDict, egOwner;
    if (egVal instanceof PDFRef) { egDict = ctx.lookup(egVal); egOwner = egVal; }
    else if (egVal instanceof PDFDict) { egDict = egVal; egOwner = resOwner; }
    else { egDict = ctx.obj({}); resDict.set(PDFName.of("ExtGState"), egDict); egOwner = resOwner; }
    return { resDict, egDict, egOwner };
  }
  for (const page of pdf.getPages()) {
    const ri = resInfo(() => page.node.get(PDFName.of("Resources")), page.ref);
    if (!ri) continue;
    const contents = page.node.get(PDFName.of("Contents"));
    const refs = [];
    if (contents instanceof PDFRef) refs.push(contents);
    else if (contents instanceof PDFArray) for (let i = 0; i < contents.size(); i++) refs.push(contents.get(i));
    units.push({ contentRefs: refs, ...ri });
  }
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Form")) {
      const ri = resInfo(() => obj.dict.get(PDFName.of("Resources")), ref);
      if (ri) units.push({ contentRefs: [ref], ...ri });
    }
  }

  log("Prendendo screen por objeto (" + units.length + " blocos)…");
  let injected = 0;
  function csToColorant(cs, resDict) {
    if (cs instanceof PDFName) { const csd = resDict.get(PDFName.of("ColorSpace")); if (csd instanceof PDFDict) cs = csd.get(cs); }
    if (cs instanceof PDFRef) cs = ctx.lookup(cs);
    if (cs instanceof PDFArray && cs.get(0) === PDFName.of("Separation")) return decodeName(nameOf(cs.get(1)));
    return null;
  }
  for (const u of units) {
    // colorspaces vetoriais: /CSx -> colorante
    const name2color = {};
    const csDict = u.resDict.get(PDFName.of("ColorSpace"));
    if (csDict instanceof PDFDict) for (const [key, val] of csDict.entries()) {
      const cs = val instanceof PDFRef ? ctx.lookup(val) : val;
      if (cs instanceof PDFArray && cs.get(0) === PDFName.of("Separation")) name2color[nameOf(key)] = decodeName(nameOf(cs.get(1)));
      else if (cs instanceof PDFArray && cs.get(0) === PDFName.of("DeviceN")) {
        // a borda ## pode ser pintada via DeviceN -> tem que pegar o master tb.
        // Se o DeviceN tem um colorante ##, o bloco usa o master do ##; senao, o master base.
        const names = cs.get(1); let hashC = null, baseC = null;
        if (names instanceof PDFArray) for (let i = 0; i < names.size(); i++) { const c = decodeName(nameOf(names.get(i))); if (egByMerge[c]) hashC = c; else if (!baseC && baseScreen[c]) baseC = c; }
        if (hashC) name2color[nameOf(key)] = hashC; else if (baseC) name2color[nameOf(key)] = baseC;
      }
    }
    // imagens: /ImX -> colorante Separation (base ou ##; a cor esta no dict da imagem)
    const imgColor = {};
    const xoDict = u.resDict.get(PDFName.of("XObject"));
    if (xoDict instanceof PDFDict) for (const [k, v] of xoDict.entries()) {
      const xo = v instanceof PDFRef ? ctx.lookup(v) : v;
      if (xo instanceof PDFRawStream && xo.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) {
        const color = csToColorant(xo.dict.get(PDFName.of("ColorSpace")), u.resDict);
        if (color && egForColor(color)) imgColor[nameOf(k)] = color;
      }
    }
    // TODO colorante Separation com screen (base E ##) recebe master por objeto
    const used = {};
    for (const csn in name2color) if (egForColor(name2color[csn])) used[name2color[csn]] = 1;
    for (const xn in imgColor) used[imgColor[xn]] = 1;
    if (!Object.keys(used).length) continue;

    const egResName = {}; let idx = 0;
    for (const color in used) { const rn = "ASg" + (idx++); u.egDict.set(PDFName.of(rn), egForColor(color)); egResName[color] = rn; }
    mark(u.egOwner);

    for (const sref of u.contentRefs) {
      const st = ctx.lookup(sref);
      if (!(st instanceof PDFRawStream)) continue;
      let content;
      try { content = Buffer.from(decodePDFRawStream(st).decode()).toString("latin1"); }
      catch (e) { continue; }
      let did = false;
      // vetores: prende o master DEPOIS do /CSx cs (cobre o objeto) E DEPOIS do
      // scn/SCN (logo antes da pintura -> vence qualquer gs proprio = override).
      let curFill = null, curStroke = null;
      content = content.replace(/(\/[A-Za-z0-9_.]+)\s+(cs|CS)\b|\b(scn|SCN)\b/g, (m, csn, csop, paint) => {
        if (csop === "cs") { curFill = name2color[csn] || null; if (curFill && egResName[curFill]) { injected++; did = true; return m + " /" + egResName[curFill] + " gs"; } return m; }
        if (csop === "CS") { curStroke = name2color[csn] || null; if (curStroke && egResName[curStroke]) { injected++; did = true; return m + " /" + egResName[curStroke] + " gs"; } return m; }
        if (paint === "scn" && curFill && egResName[curFill]) { injected++; did = true; return m + " /" + egResName[curFill] + " gs"; }
        if (paint === "SCN" && curStroke && egResName[curStroke]) { injected++; did = true; return m + " /" + egResName[curStroke] + " gs"; }
        return m;
      });
      // imagens: prende o master ANTES de /ImX Do (dentro do q/Q da imagem -> auto-reseta)
      content = content.replace(/\/([A-Za-z0-9_.]+)\s+Do\b/g, (whole, xn) => {
        const color = imgColor["/" + xn];
        if (color && egResName[color]) { injected++; did = true; return "/" + egResName[color] + " gs " + whole; }
        return whole;
      });
      if (!did) continue;
      const enc = zlib.deflateSync(Buffer.from(content, "latin1"));
      const dict = st.dict;
      dict.set(PDFName.of("Filter"), PDFName.of("FlateDecode"));
      dict.set(PDFName.of("Length"), ctx.obj(enc.length));
      dict.delete(PDFName.of("DecodeParms"));
      ctx.assign(sref, PDFRawStream.of(dict, enc));
      mark(sref);
    }
  }

  log("Mesclando colorantes na base (nome + transform de cor)…");
  let renamed = 0;
  // Separation base (nao-##) por normKey, pra copiar altCS+tintTransform iguais
  const baseCsArr = {};
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFArray && obj.get(0) === PDFName.of("Separation")) {
      const nm = decodeName(nameOf(obj.get(1)));
      if (!/^(##|\/\/)/.test(nm)) baseCsArr[normKeyInk(nm)] = obj;
    }
  }
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFArray && obj.get(0) === PDFName.of("Separation")) {
      const color = decodeName(nameOf(obj.get(1)));
      if (renameTo[color]) {
        const b = baseCsArr[normKeyInk(renameTo[color])];
        if (b) { obj.set(1, b.get(1)); obj.set(2, b.get(2)); obj.set(3, b.get(3)); }   // nome+altCS+tintTransform da base = merge limpo
        else obj.set(1, PDFName.of(encPdfName(renameTo[color])));
        renamed++; mark(ref);
      }
    } else if (obj instanceof PDFArray && obj.get(0) === PDFName.of("DeviceN")) {
      // IMPORTANTE: o ## tambem pode estar num DeviceN. Se nao renomear aqui, o
      // colorante ## continua existindo -> "Ink <##X> missing in the XMP inklist".
      const names = obj.get(1);
      if (names instanceof PDFArray) {
        let hit = false;
        for (let i = 0; i < names.size(); i++) {
          const c = decodeName(nameOf(names.get(i)));
          if (renameTo[c]) {
            const b = baseCsArr[normKeyInk(renameTo[c])];
            names.set(i, b ? b.get(1) : PDFName.of(encPdfName(renameTo[c])));
            renamed++; hit = true;
          }
        }
        if (hit) mark(ref);
      }
    }
  }

  log("Atualizando lista de tintas no XMP…");
  const mergedNames = Object.keys(renameTo);   // nomes ## que foram mesclados
  if (mergedNames.length) {
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      if (obj.dict.get(PDFName.of("Type")) !== PDFName.of("Metadata")) continue;
      let txt;
      try { txt = Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1"); } catch (e) { continue; }
      if (!mergedNames.some(n => txt.indexOf(n) !== -1)) continue;
      const nt = mergeInksInXmp(txt, renameTo);
      const dict = obj.dict;
      const wasFlate = /FlateDecode/.test(String(dict.get(PDFName.of("Filter")) || ""));
      let body;
      if (wasFlate) { body = zlib.deflateSync(Buffer.from(nt, "latin1")); dict.set(PDFName.of("Filter"), PDFName.of("FlateDecode")); }
      else { body = Buffer.from(nt, "latin1"); dict.delete(PDFName.of("Filter")); }
      dict.set(PDFName.of("Length"), ctx.obj(body.length));
      dict.delete(PDFName.of("DecodeParms"));
      ctx.assign(ref, PDFRawStream.of(dict, body));
      mark(ref);
    }
  }

  log("Anexando (incremental)…");
  function serial(num) {
    const obj = ctx.lookup(PDFRef.of(num, 0));
    const inner = new Uint8Array(obj.sizeInBytes());
    obj.copyBytesInto(inner, 0);
    return Buffer.concat([Buffer.from(num + " 0 obj\n", "latin1"), Buffer.from(inner), Buffer.from("\nendobj\n", "latin1")]);
  }
  const nums = new Set();
  created.forEach(r => nums.add(r.objectNumber));
  changed.forEach(n => nums.add(n));
  const list = [...nums].sort((a, b) => a - b);

  const parts = []; let pos = orig.length; const xref = {};
  const push = (b) => { parts.push(b); pos += b.length; };
  push(Buffer.from("\n", "latin1"));
  for (const n of list) { xref[n] = pos; push(serial(n)); }

  // xref STREAM (mesmo formato do normalizado Esko) - evita PDF hibrido/warning
  function xentry(type, off, gen) { const b = Buffer.alloc(7); b.writeUInt8(type, 0); b.writeUInt32BE(off >>> 0, 1); b.writeUInt16BE(gen, 5); return b; }
  let maxNum = Math.max.apply(null, list);
  if (ctx.largestObjectNumber && ctx.largestObjectNumber > maxNum) maxNum = ctx.largestObjectNumber;
  const xrefObjNum = maxNum + 1;
  const size = xrefObjNum + 1;
  const xrefOffset = pos;
  const allNums = list.concat([xrefObjNum]).sort((a, b) => a - b);
  const data = Buffer.concat(allNums.map(n => xentry(1, (n === xrefObjNum ? xrefOffset : xref[n]), 0)));
  const comp = zlib.deflateSync(data);
  const index = []; let ii = 0;
  while (ii < allNums.length) { let jj = ii; while (jj + 1 < allNums.length && allNums[jj + 1] === allNums[jj] + 1) jj++; index.push(allNums[ii], jj - ii + 1); ii = jj + 1; }
  const xdict = "<< /Type /XRef /Size " + size + " /Root " + rootNum + " 0 R /Prev " + prevXref + " /W [ 1 4 2 ] /Index [ " + index.join(" ") + " ] /Filter /FlateDecode /Length " + comp.length + " >>";
  push(Buffer.concat([Buffer.from(xrefObjNum + " 0 obj\n" + xdict + "\nstream\n", "latin1"), comp, Buffer.from("\nendstream\nendobj\n", "latin1")]));
  push(Buffer.from("startxref\n" + xrefOffset + "\n%%EOF\n", "latin1"));

  fs.writeFileSync(outPath, Buffer.concat([orig, ...parts]));
  return { injected, renamed, masters: Object.keys(egByMerge).length, units: units.length, appendBytes: pos - orig.length };
}

// analise rapida a partir de um pdf JA carregado (nao recarrega o arquivo)
function transparencyOf(pdf) { const t = scanTransparency(pdf.context); return { hardBlend: t.hardBlend, softTransp: t.softTransp }; }

module.exports = { load, listColorants, screensFromPdf, convert, decodeName, analyzeTransparency, transparencyOf };

/* ============================================================
 * AlphaPack - host UNICO (ExtendScript / Illustrator 2022)
 * Tudo num arquivo so (sem #include/$.evalFile: no CEP nao e confiavel).
 * ES3 apenas: sem let/const/=>/forEach/JSON. Retornos sao STRINGS.
 * Convencao: "OK|<dado>"  ou  "ERRO|<mensagem>".
 * ============================================================ */

/* ============================================================
 *  UTILIDADES COMPARTILHADAS
 * ============================================================ */
var AP = {};
AP.MM2PT = 72.0 / 25.4;
AP.PT2MM = 25.4 / 72.0;
AP.mm = function (mm) { return mm * AP.MM2PT; };
AP.toMM = function (pt) { return pt * AP.PT2MM; };

AP.doc = function () {
    if (app.documents.length === 0) return null;
    return app.activeDocument;
};

AP.activeArtboard = function (doc) {
    var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
    var r = ab.artboardRect;
    return { left: r[0], top: r[1], right: r[2], bottom: r[3],
             cx: (r[0] + r[2]) / 2, cy: (r[1] + r[3]) / 2 };
};

AP.swatchByName = function (doc, nome) {
    var i, alvo = String(nome).toLowerCase();
    for (i = 0; i < doc.swatches.length; i++) {
        if (String(doc.swatches[i].name).toLowerCase() === alvo) return doc.swatches[i];
    }
    return null;
};

AP.ensureSpot = function (doc, nome, c, m, y, k) {
    var i;
    for (i = 0; i < doc.spots.length; i++) {
        if (String(doc.spots[i].name).toLowerCase() === String(nome).toLowerCase()) return doc.spots[i];
    }
    var sp = doc.spots.add();
    sp.name = nome;
    sp.colorType = ColorType.SPOT;
    var cor = new CMYKColor();
    cor.cyan = c; cor.magenta = m; cor.yellow = y; cor.black = k;
    sp.color = cor;
    return sp;
};

AP.spotColor = function (spot, tint) {
    var sc = new SpotColor();
    sc.spot = spot;
    sc.tint = (tint === undefined) ? 100 : tint;
    return sc;
};

AP.blackCMYK = function () {
    var k = new CMYKColor();
    k.cyan = 0; k.magenta = 0; k.yellow = 0; k.black = 100;
    return k;
};

AP.fontByName = function (nome) {
    var i, tentativas = [nome, "OCRB", "OCR B", "OCR-B", "Helvetica", "ArialMT", "Arial"];
    for (i = 0; i < tentativas.length; i++) {
        if (!tentativas[i]) continue;
        try { var f = app.textFonts.getByName(tentativas[i]); if (f) return f; } catch (e) {}
    }
    try { return app.textFonts[0]; } catch (e2) { return null; }
};

var AP_RS = String.fromCharCode(30);   // separador de registro
var AP_FS = String.fromCharCode(31);   // separador de campo

/* Ping de conexao: OK|<nomeDoc>|<osProvavel>. */
function apPing() {
    try {
        if (app.documents.length === 0) return "OK||";
        var doc = app.activeDocument;
        var os = "";
        var m = String(doc.name).match(/(\d{7})/);
        if (m) os = m[1];
        return "OK|" + doc.name + "|" + os;
    } catch (e) { return "ERRO|" + e.toString(); }
}


/* ============================================================
 *  SCREENING - puxar tintas da OS (mesmo XML do Xml_upload)
 *  Pasta: \\aeserver16\Engine\_Jobfolder\<OS>\_xml\*.xml
 *  Retorno OK|<os>\x1f<produto>\x1e<ink>\x1e<ink>...
 *  ink = nome FS angulo FS lpi FS dot FS tipo FS ref FS isDual FS base
 * ============================================================ */
// Engine: nome primeiro, depois os IPs das DUAS redes da fabrica (192.168.1.x / 172.16.11.x)
function apScreenFolderOS(os) {
    var bases = ($.os.indexOf("Windows") !== -1)
        ? ["//aeserver16/Engine", "//192.168.1.96/Engine", "//172.16.11.96/Engine"]
        : ["/Volumes/Engine", "/Engine"];
    var i, p;
    for (i = 0; i < bases.length; i++) {
        p = bases[i] + "/_Jobfolder/" + os + "/_xml/";
        try { if (new Folder(p).exists) return p; } catch (e) {}
    }
    return bases[0] + "/_Jobfolder/" + os + "/_xml/";
}

function apScreenPullOS(osArg) {
    try {
        var os = "";
        if (osArg) { var mo = String(osArg).match(/(\d{6,})/); if (mo) os = mo[1]; }
        if (!os) {
            var d = AP.doc();
            if (d) { var m = String(d.name).match(/(\d{7})/); if (m) os = m[1]; }
        }
        if (!os) return "ERRO|Informe a OS (ou abra o arquivo do job).";

        var folder = new Folder(apScreenFolderOS(os));
        if (!folder.exists)
            return "ERRO|Pasta _xml da OS " + os + " nao acessivel. Rode o Xml_upload uma vez pra liberar o acesso.";
        var files = folder.getFiles("*.xml");
        if (!files || files.length === 0)
            return "ERRO|Nenhum XML na pasta da OS " + os + ".";
        files.reverse();
        var xf = files[0];
        xf.encoding = "UTF-8";
        xf.open("r");
        var txt = xf.read();
        xf.close();

        // E4X - descarta BOM e o cabecalho <?xml?> se atrapalhar
        txt = String(txt).replace(/^﻿/, "").replace(/<\?xml[^>]*\?>/, "");
        XML.prettyPrinting = false; XML.ignoreWhitespace = true;
        var xml = new XML(txt);
        var inks = xml.Inks.Ink;
        var out = [];
        var i;
        for (i = 0; i < inks.length(); i++) {
            var nk = inks[i];
            var nm = String(nk.@Name);
            if (!nm || nm === "All") continue;      // 'All' e pseudo-tinta
            var ang = String(nk.@Angle);
            var lpi = String(nk.@LPI);
            var dot = String(nk.@DotShape);
            var typ = String(nk.@Type);
            var book = String(nk.@Book);
            var ref = String(nk.@Ref);
            var isDual = (nm.substring(0, 2) === "##") ? "1" : "0";
            var base = (isDual === "1") ? nm.substring(2) : nm;
            out.push(nm + AP_FS + ang + AP_FS + lpi + AP_FS + dot + AP_FS +
                     typ + AP_FS + ref + AP_FS + isDual + AP_FS + base + AP_FS + book);
        }
        if (out.length === 0) return "ERRO|XML da OS " + os + " sem tintas.";
        var prod = "";
        try { prod = String(xml.Order.@Product); } catch (ep) {}
        return "OK|" + os + AP_FS + prod + AP_RS + out.join(AP_RS);
    } catch (e) { return "ERRO|" + e.toString(); }
}

/* --- persistencia do screening no XMP do documento (sobrevive salvar/reabrir) --- */
var AP_XMP_NS  = "http://alphaclicheria.com.br/alphapack/1.0/";
var AP_XMP_PFX = "alphapack";

function apScreenXMPReady() {
    if (!ExternalObject.AdobeXMPScript)
        ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
    XMPMeta.registerNamespace(AP_XMP_NS, AP_XMP_PFX);
}

function apScreenSave(payload) {
    try {
        var doc = AP.doc(); if (!doc) return "ERRO|Sem documento aberto.";
        apScreenXMPReady();
        var xmp = new XMPMeta(doc.XMPString);
        xmp.setProperty(AP_XMP_NS, "screening", String(payload));
        doc.XMPString = xmp.serialize();
        return "OK|salvo (grave o arquivo pra persistir)";
    } catch (e) { return "ERRO|" + e.toString(); }
}

function apScreenLoad() {
    try {
        var doc = AP.doc(); if (!doc) return "OK|";      // sem doc: nada guardado
        apScreenXMPReady();
        var xmp = new XMPMeta(doc.XMPString);
        if (xmp.doesPropertyExist(AP_XMP_NS, "screening"))
            return "OK|" + String(xmp.getProperty(AP_XMP_NS, "screening").value);
        return "OK|";
    } catch (e) { return "ERRO|" + e.toString(); }
}

/* --- lista os PDFs linkados (PlacedItem) do documento ativo --- */
function apScreenLinkedPDFs() {
    try {
        var doc = AP.doc(); if (!doc) return "ERRO|Sem documento.";
        var out = [], i, f, nm;
        for (i = 0; i < doc.placedItems.length; i++) {
            f = null;
            try { f = doc.placedItems[i].file; } catch (e) {}
            if (!f) continue;
            nm = String(f.fsName);
            if (/\.pdf$/i.test(nm)) out.push(nm);
        }
        return "OK|" + out.join(AP_RS);
    } catch (e) { return "ERRO|" + e.toString(); }
}

/* --- seleciona no documento tudo que usa uma tinta (spot) --- */
function apScreenItemUsesInk(it, alvo) {
    try {
        if (it.filled && it.fillColor && it.fillColor.typename === "SpotColor" &&
            String(it.fillColor.spot.name).toLowerCase() === alvo) return true;
    } catch (e1) {}
    try {
        if (it.stroked && it.strokeColor && it.strokeColor.typename === "SpotColor" &&
            String(it.strokeColor.spot.name).toLowerCase() === alvo) return true;
    } catch (e2) {}
    return false;
}

function apSelectByInk(nome) {
    try {
        var doc = AP.doc(); if (!doc) return "ERRO|Sem documento.";
        var alvo = String(nome).toLowerCase();
        // RAPIDO: percorre por LAYER (nao doc.pageItems) e atribui a selecao
        // de uma vez so (setar .selected item a item trava o Illustrator).
        var sel = [], li, items, i, lyr;
        for (li = 0; li < doc.layers.length; li++) {
            lyr = doc.layers[li];
            if (lyr.locked || !lyr.visible) continue;
            items = lyr.pageItems;
            for (i = 0; i < items.length; i++) {
                if (apScreenItemUsesInk(items[i], alvo)) sel.push(items[i]);
            }
        }
        doc.selection = sel;   // uma atribuicao unica = instantaneo
        return "OK|" + sel.length;
    } catch (e) { return "ERRO|" + e.toString(); }
}


/* ============================================================
 *  BARCODE EAN-13
 * ============================================================ */
var EAN_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
var EAN_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
var EAN_R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
var EAN_PAR = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

function apEanCheck(d12) {
    var soma = 0, i, n;
    for (i = 0; i < 12; i++) { n = parseInt(d12.charAt(i), 10); soma += (i % 2 === 0) ? n : n * 3; }
    return (10 - (soma % 10)) % 10;
}

function apEanModules(ean13) {
    var first = parseInt(ean13.charAt(0), 10);
    var par = EAN_PAR[first];
    var s = "101", i, d;
    for (i = 1; i <= 6; i++) { d = parseInt(ean13.charAt(i), 10); s += (par.charAt(i - 1) === "L") ? EAN_L[d] : EAN_G[d]; }
    s += "01010";
    for (i = 7; i <= 12; i++) { d = parseInt(ean13.charAt(i), 10); s += EAN_R[d]; }
    s += "101";
    return s;
}

function apEanIsGuard(idx) {
    return (idx === 0 || idx === 2 || idx === 46 || idx === 48 || idx === 92 || idx === 94);
}

function apBarcodeEAN(codigo, magPct, bwrMM, heightMM, inkName) {
    var restore = app.userInteractionLevel;
    try {
        var doc = AP.doc();
        if (!doc) return "ERRO|Abra um documento primeiro.";

        magPct = parseFloat(magPct); if (isNaN(magPct) || magPct <= 0) magPct = 100;
        bwrMM = parseFloat(bwrMM);   if (isNaN(bwrMM) || bwrMM < 0) bwrMM = 0;
        heightMM = parseFloat(heightMM);

        var so = String(codigo).replace(/[^0-9]/g, "");
        if (so.length !== 12 && so.length !== 13) return "ERRO|Digite 12 ou 13 digitos (voce enviou " + so.length + ").";
        var d12 = so.substring(0, 12);
        var dv = apEanCheck(d12);
        if (so.length === 13 && parseInt(so.charAt(12), 10) !== dv) return "ERRO|Digito verificador invalido. Deveria ser " + dv + ".";
        var ean13 = d12 + dv;

        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var mag = magPct / 100.0;
        var X = AP.mm(0.33 * mag);
        var bwr = AP.mm(bwrMM);
        var barH = AP.mm((heightMM > 0 ? heightMM : 22.85 * mag));
        var guardExtra = 5 * X;

        var corFill;
        if (!inkName || String(inkName).toLowerCase() === "k" || String(inkName) === "") {
            corFill = AP.blackCMYK();
        } else {
            var sw = AP.swatchByName(doc, inkName);
            if (sw) { corFill = sw.color; }
            else { var sp = AP.ensureSpot(doc, inkName, 0, 0, 0, 100); corFill = AP.spotColor(sp, 100); }
        }

        var ab = AP.activeArtboard(doc);
        var larguraSimbolo = 95 * X;
        var ox = ab.cx - larguraSimbolo / 2;
        var oyTop = ab.cy + barH / 2;

        var grupo = doc.groupItems.add();
        grupo.name = "EAN-13 " + ean13;

        var mods = apEanModules(ean13);
        var i = 0, run, j;
        while (i < mods.length) {
            if (mods.charAt(i) === "1") {
                run = 0;
                while (i + run < mods.length && mods.charAt(i + run) === "1") run++;
                var estendida = false;
                for (j = 0; j < run; j++) { if (apEanIsGuard(i + j)) estendida = true; }
                var alturaBarra = barH + (estendida ? guardExtra : 0);
                var xStart = ox + i * X;
                var w = run * X - bwr;
                var xDraw = xStart + bwr / 2;
                if (w > 0) {
                    var rct = doc.pathItems.rectangle(oyTop, xDraw, w, alturaBarra);
                    rct.stroked = false; rct.filled = true; rct.fillColor = corFill;
                    rct.move(grupo, ElementPlacement.PLACEATEND);
                }
                i += run;
            } else { i++; }
        }

        var fonte = AP.fontByName("OCRB");
        var tamTexto = 9 * mag;
        var baseY = oyTop - barH - guardExtra + AP.mm(0.5);
        apEanTexto(doc, grupo, ean13.charAt(0), ox - 8 * X, baseY, tamTexto, fonte, corFill, false, 0);
        apEanTexto(doc, grupo, ean13.substring(1, 7), ox + 3 * X, baseY, tamTexto, fonte, corFill, true, 42 * X);
        apEanTexto(doc, grupo, ean13.substring(7, 13), ox + 50 * X, baseY, tamTexto, fonte, corFill, true, 42 * X);

        app.userInteractionLevel = restore;
        app.redraw();
        return "OK|" + ean13;
    } catch (e) {
        try { app.userInteractionLevel = restore; } catch (e2) {}
        return "ERRO|" + e.toString();
    }
}

function apEanTexto(doc, grupo, txt, x, y, tam, fonte, cor, centralizar, larguraArea) {
    var tf = doc.textFrames.add();
    tf.contents = txt;
    try { if (fonte) tf.textRange.characterAttributes.textFont = fonte; } catch (e) {}
    tf.textRange.characterAttributes.size = tam;
    tf.textRange.characterAttributes.fillColor = cor;
    tf.textRange.characterAttributes.strokeColor = new NoColor();
    tf.top = y;
    if (centralizar && larguraArea) { tf.left = x + (larguraArea - tf.width) / 2; }
    else { tf.left = x; }
    tf.move(grupo, ElementPlacement.PLACEATEND);
    return tf;
}


/* ============================================================
 *  WHITE UNDERPRINT
 * ============================================================ */
function apWhiteUnderprint(chokeMM, spotNome, overprint) {
    var restore = app.userInteractionLevel;
    try {
        var doc = AP.doc();
        if (!doc) return "ERRO|Abra um documento primeiro.";

        chokeMM = parseFloat(chokeMM); if (isNaN(chokeMM) || chokeMM < 0) chokeMM = 0;
        if (!spotNome) spotNome = "White";
        var doOverprint = (String(overprint) === "1" || overprint === true);

        var sel = doc.selection;
        var origem = [], i;
        if (sel && sel.length > 0) { for (i = 0; i < sel.length; i++) origem.push(sel[i]); }
        else { var lay = doc.activeLayer; for (i = 0; i < lay.pageItems.length; i++) origem.push(lay.pageItems[i]); }
        if (origem.length === 0) return "ERRO|Selecione a arte (ou tenha itens na layer ativa).";

        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var spot = AP.ensureSpot(doc, spotNome, 0, 0, 0, 0);
        var corBranco = AP.spotColor(spot, 100);

        var layW;
        try { layW = doc.layers.getByName("AlphaPack White"); }
        catch (e) { layW = doc.layers.add(); layW.name = "AlphaPack White"; }
        layW.move(doc, ElementPlacement.PLACEATEND);

        var copias = [];
        for (i = 0; i < origem.length; i++) {
            try { copias.push(origem[i].duplicate(layW, ElementPlacement.PLACEATBEGINNING)); } catch (ed) {}
        }
        if (copias.length === 0) return "ERRO|Nao consegui duplicar a arte.";

        doc.selection = null;
        for (i = 0; i < copias.length; i++) { try { copias[i].selected = true; } catch (es) {} }
        app.executeMenuCommand("group");
        try { app.executeMenuCommand("Live Pathfinder Add"); } catch (ep) {}
        try { app.executeMenuCommand("expandStyle"); } catch (ex) {}

        if (chokeMM > 0) {
            var off = -AP.mm(chokeMM);
            var xml = '<LiveEffect name="Adobe Offset Path"><Dict data="R mlim 4 I jntp 1 R ofst ' + off.toFixed(4) + ' "/></LiveEffect>';
            var itensSel = doc.selection;
            for (i = 0; i < itensSel.length; i++) { try { itensSel[i].applyEffect(xml); } catch (ee) {} }
            try { app.executeMenuCommand("expandStyle"); } catch (ex2) {}
        }

        var n = apRecolorSelecao(doc, corBranco, doOverprint);

        app.userInteractionLevel = restore;
        app.redraw();
        return "OK|" + n;
    } catch (e) {
        try { app.userInteractionLevel = restore; } catch (e2) {}
        return "ERRO|" + e.toString();
    }
}

function apRecolorSelecao(doc, cor, overprint) {
    var count = 0, sel = doc.selection, i;
    for (i = 0; i < sel.length; i++) count += apRecolorItem(sel[i], cor, overprint);
    return count;
}

function apRecolorItem(it, cor, overprint) {
    var count = 0;
    try {
        if (it.typename === "PathItem") {
            it.stroked = false; it.filled = true; it.fillColor = cor;
            try { it.fillOverprint = overprint ? true : false; } catch (eo) {}
            count++;
        } else if (it.typename === "CompoundPathItem") {
            var k; for (k = 0; k < it.pathItems.length; k++) count += apRecolorItem(it.pathItems[k], cor, overprint);
        } else if (it.typename === "GroupItem") {
            var j; for (j = 0; j < it.pageItems.length; j++) count += apRecolorItem(it.pageItems[j], cor, overprint);
        }
    } catch (e) {}
    return count;
}


/* ============================================================
 *  TRAPPING - exportador de geometria
 * ============================================================ */
function apTrapExport(scope) {
    try {
        var doc = AP.doc();
        if (!doc) return "ERRO|Abra um documento primeiro.";
        var raiz;
        if (scope === "sel" && doc.selection && doc.selection.length > 0) raiz = doc.selection;
        else raiz = doc.pageItems;

        var regioes = [];
        apTrapWalk(raiz, regioes);
        if (regioes.length === 0) return "ERRO|Nenhuma regiao vetorial chapada encontrada.";
        if (regioes.length > 1200) return "ERRO|Muitas regioes (" + regioes.length + "). Selecione uma area menor.";
        return "OK|" + regioes.join(AP_RS);
    } catch (e) { return "ERRO|" + e.toString(); }
}

function apTrapWalk(items, regioes) {
    var i;
    for (i = 0; i < items.length; i++) {
        var it = items[i], t = it.typename;
        try {
            if (t === "GroupItem") apTrapWalk(it.pageItems, regioes);
            else if (t === "PathItem") apTrapAddPath(it, regioes);
            else if (t === "CompoundPathItem") apTrapAddCompound(it, regioes);
        } catch (e) {}
    }
}

function apTrapAddPath(p, regioes) {
    if (!p.filled || !p.closed) return;
    var spec = apColorSpec(p.fillColor);
    if (!spec) return;
    var dark = apColorDarkness(p.fillColor);
    var cont = apFlattenPath(p);
    if (!cont) return;
    regioes.push(regioes.length + AP_FS + dark.toFixed(2) + AP_FS + spec + AP_FS + cont);
}

function apTrapAddCompound(cp, regioes) {
    if (cp.pathItems.length === 0) return;
    var base = cp.pathItems[0];
    var spec = apColorSpec(base.fillColor);
    if (!spec) return;
    var dark = apColorDarkness(base.fillColor);
    var partes = [], i;
    for (i = 0; i < cp.pathItems.length; i++) { var c = apFlattenPath(cp.pathItems[i]); if (c) partes.push(c); }
    if (partes.length === 0) return;
    regioes.push(regioes.length + AP_FS + dark.toFixed(2) + AP_FS + spec + AP_FS + partes.join(";"));
}

function apFlattenPath(p) {
    var pts = p.pathPoints;
    if (pts.length < 2) return null;
    var out = [], i, n = pts.length;
    for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        var P0 = a.anchor, P1 = a.rightDirection, P2 = b.leftDirection, P3 = b.anchor;
        out.push(apPt(P0[0], P0[1]));
        if (apDist(P0, P1) > 0.01 || apDist(P3, P2) > 0.01) {
            var steps = 12, s;
            for (s = 1; s < steps; s++) {
                var t = s / steps, mt = 1 - t;
                var x = mt*mt*mt*P0[0] + 3*mt*mt*t*P1[0] + 3*mt*t*t*P2[0] + t*t*t*P3[0];
                var y = mt*mt*mt*P0[1] + 3*mt*mt*t*P1[1] + 3*mt*t*t*P2[1] + t*t*t*P3[1];
                out.push(apPt(x, y));
            }
        }
    }
    return out.join(" ");
}

function apPt(x, y) { return (Math.round(x * 1000) / 1000) + "," + (Math.round(y * 1000) / 1000); }
function apDist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }

function apColorSpec(cor) {
    if (!cor) return null;
    var tn = cor.typename;
    if (tn === "CMYKColor") return "CMYK~" + rnd(cor.cyan) + "~" + rnd(cor.magenta) + "~" + rnd(cor.yellow) + "~" + rnd(cor.black);
    if (tn === "GrayColor") return "CMYK~0~0~0~" + rnd(cor.gray);
    if (tn === "SpotColor") return "SPOT~" + String(cor.spot.name).replace(/~/g, "-") + "~" + rnd(cor.tint);
    if (tn === "RGBColor") {
        var r = cor.red / 255, g = cor.green / 255, b = cor.blue / 255;
        var k = 1 - Math.max(r, Math.max(g, b));
        var c = (k < 1) ? (1 - r - k) / (1 - k) : 0;
        var m = (k < 1) ? (1 - g - k) / (1 - k) : 0;
        var y = (k < 1) ? (1 - b - k) / (1 - k) : 0;
        return "CMYK~" + rnd(c * 100) + "~" + rnd(m * 100) + "~" + rnd(y * 100) + "~" + rnd(k * 100);
    }
    return null;
}
function rnd(v) { return Math.round(v * 10) / 10; }

function apColorDarkness(cor) {
    if (!cor) return 0;
    var tn = cor.typename;
    if (tn === "CMYKColor") return apDarkCMYK(cor.cyan, cor.magenta, cor.yellow, cor.black);
    if (tn === "GrayColor") return cor.gray * 2.55;
    if (tn === "RGBColor") return 255 - (0.3 * cor.red + 0.59 * cor.green + 0.11 * cor.blue);
    if (tn === "SpotColor") {
        var base = cor.spot.color, d = 0;
        try {
            if (base.typename === "CMYKColor") d = apDarkCMYK(base.cyan, base.magenta, base.yellow, base.black);
            else if (base.typename === "GrayColor") d = base.gray * 2.55;
            else if (base.typename === "RGBColor") d = 255 - (0.3 * base.red + 0.59 * base.green + 0.11 * base.blue);
            else if (base.typename === "LabColor") d = 255 * (1 - base.l / 100);
        } catch (e) {}
        return d * (cor.tint / 100);
    }
    return 0;
}
function apDarkCMYK(c, m, y, k) {
    var R = 255 * (1 - c / 100) * (1 - k / 100);
    var G = 255 * (1 - m / 100) * (1 - k / 100);
    var B = 255 * (1 - y / 100) * (1 - k / 100);
    return 255 - (0.3 * R + 0.59 * G + 0.11 * B);
}


/* ============================================================
 *  TRAPPING - aplicador das tirinhas
 * ============================================================ */
function apTrapApply(payload) {
    var restore = app.userInteractionLevel;
    try {
        var doc = AP.doc();
        if (!doc) return "ERRO|Abra um documento primeiro.";
        if (!payload || payload.length === 0) return "OK|0";

        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var lay;
        try { lay = doc.layers.getByName("AlphaPack Trap"); }
        catch (e) { lay = doc.layers.add(); lay.name = "AlphaPack Trap"; }
        lay.move(doc, ElementPlacement.PLACEATBEGINNING);

        var traps = payload.split(AP_RS);
        var total = 0, i;
        for (i = 0; i < traps.length; i++) {
            if (traps[i].length === 0) continue;
            var campos = traps[i].split(AP_FS);
            if (campos.length < 2) continue;
            var cor = apTrapRebuildColor(doc, campos[0]);
            if (!cor) continue;
            var contornos = campos[1].split(";");
            var grupo = lay.groupItems.add();
            var c;
            for (c = 0; c < contornos.length; c++) {
                var arr = apTrapParseContour(contornos[c]);
                if (arr.length < 3) continue;
                var pth = lay.pathItems.add();
                pth.setEntirePath(arr);
                pth.closed = true; pth.stroked = false; pth.filled = true; pth.fillColor = cor;
                try { pth.fillOverprint = true; } catch (eo) {}
                pth.move(grupo, ElementPlacement.PLACEATEND);
                total++;
            }
            if (grupo.pageItems.length === 0) { try { grupo.remove(); } catch (er) {} }
        }

        app.userInteractionLevel = restore;
        app.redraw();
        return "OK|" + total;
    } catch (e) {
        try { app.userInteractionLevel = restore; } catch (e2) {}
        return "ERRO|" + e.toString();
    }
}

function apTrapParseContour(s) {
    var pares = s.split(" "), out = [], i;
    for (i = 0; i < pares.length; i++) {
        if (pares[i].length === 0) continue;
        var xy = pares[i].split(",");
        if (xy.length !== 2) continue;
        out.push([parseFloat(xy[0]), parseFloat(xy[1])]);
    }
    return out;
}

function apTrapRebuildColor(doc, spec) {
    var p = spec.split("~");
    if (p[0] === "CMYK") {
        var k = new CMYKColor();
        k.cyan = parseFloat(p[1]); k.magenta = parseFloat(p[2]); k.yellow = parseFloat(p[3]); k.black = parseFloat(p[4]);
        return k;
    } else if (p[0] === "SPOT") {
        var nome = p[1], tint = parseFloat(p[2]);
        var sw = AP.swatchByName(doc, nome), spot = null;
        if (sw && sw.color && sw.color.typename === "SpotColor") spot = sw.color.spot;
        if (!spot) {
            var j;
            for (j = 0; j < doc.spots.length; j++) {
                if (String(doc.spots[j].name).toLowerCase() === String(nome).toLowerCase()) { spot = doc.spots[j]; break; }
            }
        }
        if (!spot) spot = AP.ensureSpot(doc, nome, 0, 0, 0, 100);
        return AP.spotColor(spot, tint);
    }
    return null;
}

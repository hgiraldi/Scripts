/* ============================================================
 * AlphaScreening - host (ExtendScript / Illustrator 2022)
 * ES3 apenas: sem let/const/=>/forEach/JSON. Retornos sao STRINGS.
 * Convencao: "OK|<dado>"  ou  "ERRO|<mensagem>".
 * ============================================================ */
var AP = {};
AP.doc = function () { return (app.documents.length === 0) ? null : app.activeDocument; };

var AP_RS = String.fromCharCode(30);   // separador de registro
var AP_FS = String.fromCharCode(31);   // separador de campo

function apPing() {
    try {
        if (app.documents.length === 0) return "OK||";
        var doc = app.activeDocument;
        var os = "", m = String(doc.name).match(/(\d{7})/);
        if (m) os = m[1];
        return "OK|" + doc.name + "|" + os;
    } catch (e) { return "ERRO|" + e.toString(); }
}

/* ============================================================
 *  SCREENING - puxar tintas da OS (mesmo XML do Xml_upload)
 * ============================================================ */
function apScreenFolderOS(os) {
    if ($.os.indexOf("Windows") !== -1)
        return "\\\\aeserver16\\Engine\\_Jobfolder\\" + os + "\\_xml\\";
    return "/Engine/_JobFolder/" + os + "/_xml/";
}

function apScreenPullOS(osArg) {
    try {
        var os = "";
        if (osArg) { var mo = String(osArg).match(/(\d{6,})/); if (mo) os = mo[1]; }
        if (!os) { var d = AP.doc(); if (d) { var m = String(d.name).match(/(\d{7})/); if (m) os = m[1]; } }
        if (!os) return "ERRO|Informe a OS (ou abra o arquivo do job).";

        var folder = new Folder(apScreenFolderOS(os));
        if (!folder.exists)
            return "ERRO|Pasta _xml da OS " + os + " nao acessivel. Rode o Xml_upload uma vez pra liberar o acesso.";
        var files = folder.getFiles("*.xml");
        if (!files || files.length === 0) return "ERRO|Nenhum XML na pasta da OS " + os + ".";
        files.reverse();
        var xf = files[0];
        xf.encoding = "UTF-8"; xf.open("r");
        var txt = xf.read(); xf.close();

        txt = String(txt).replace(/^﻿/, "").replace(/<\?xml[^>]*\?>/, "");
        XML.prettyPrinting = false; XML.ignoreWhitespace = true;
        var xml = new XML(txt);
        var inks = xml.Inks.Ink, out = [], i;
        for (i = 0; i < inks.length(); i++) {
            var nk = inks[i];
            var nm = String(nk.@Name);
            if (!nm || nm === "All") continue;
            var ang = String(nk.@Angle), lpi = String(nk.@LPI), dot = String(nk.@DotShape);
            var typ = String(nk.@Type), book = String(nk.@Book), ref = String(nk.@Ref);
            var isDual = (nm.substring(0, 2) === "##") ? "1" : "0";
            var base = (isDual === "1") ? nm.substring(2) : nm;
            out.push(nm + AP_FS + ang + AP_FS + lpi + AP_FS + dot + AP_FS +
                     typ + AP_FS + ref + AP_FS + isDual + AP_FS + base + AP_FS + book);
        }
        if (out.length === 0) return "ERRO|XML da OS " + os + " sem tintas.";
        var prod = ""; try { prod = String(xml.Order.@Product); } catch (ep) {}
        return "OK|" + os + AP_FS + prod + AP_RS + out.join(AP_RS);
    } catch (e) { return "ERRO|" + e.toString(); }
}

/* --- persistencia no XMP do documento (sobrevive salvar/reabrir) --- */
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
        var doc = AP.doc(); if (!doc) return "OK|";
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
        // RAPIDO: por LAYER (nao doc.pageItems) + atribui a selecao de uma vez.
        var sel = [], li, items, i, lyr;
        for (li = 0; li < doc.layers.length; li++) {
            lyr = doc.layers[li];
            if (lyr.locked || !lyr.visible) continue;
            items = lyr.pageItems;
            for (i = 0; i < items.length; i++) {
                if (apScreenItemUsesInk(items[i], alvo)) sel.push(items[i]);
            }
        }
        doc.selection = sel;
        return "OK|" + sel.length;
    } catch (e) { return "ERRO|" + e.toString(); }
}

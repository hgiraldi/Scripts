#include "Xml_upload.jsx"

/* ========= Helpers ========= */

function getDataAtualFormatada() {
    var hoje = new Date();
    var dia = ("0" + hoje.getDate()).slice(-2);
    var mes = ("0" + (hoje.getMonth() + 1)).slice(-2);
    var ano = hoje.getFullYear();
    return dia + "/" + mes + "/" + ano;
}

function extrairAntesDaBarra(texto) {
    return texto.split("/")[0];
}

function extrairDepoisDeMM(texto) {
    var regex = /mm\s*(.*)$/i;
    var match = texto.match(regex);
    return match ? match[1] : "";
}

function larguraEmPt(textFrame) {
    var gb = textFrame.geometricBounds;
    return gb[2] - gb[0];
}

function ajustarTextoAchatando(textFrame, maxWidthPt) {
    try {
        var ca = textFrame.textRange.characterAttributes;
        ca.horizontalScale = 100;
        var w = larguraEmPt(textFrame);
        if (w > maxWidthPt && w > 0) {
            var escala = (maxWidthPt / w) * 100;
            if (escala < 10) escala = 10;
            ca.horizontalScale = escala;
        }
    } catch (e) {}
}

function mmToPt(mm) {
    return mm * 2.83464567;
}

function desbloquearEExibirTudo(doc) {
    function _unlockLayer(ly) {
        ly.locked = false;
        ly.visible = true;
        for (var i = 0; i < ly.pageItems.length; i++) {
            try {
                ly.pageItems[i].locked = false;
                ly.pageItems[i].hidden = false;
            } catch (e) {}
        }
        for (var j = 0; j < ly.layers.length; j++) {
            _unlockLayer(ly.layers[j]);
        }
    }
    for (var k = 0; k < doc.layers.length; k++) {
        _unlockLayer(doc.layers[k]);
    }
}

function substituirPlaceholdersNosTextos(doc, mapa, larguraMaxMaquinaPt) {
    for (var j = 0; j < doc.textFrames.length; j++) {
        var tf = doc.textFrames[j];
        var key = tf.contents;
        if (mapa.hasOwnProperty(key)) {
            tf.contents = mapa[key];
        }
    }
    for (var k = 0; k < doc.textFrames.length; k++) {
        var t = doc.textFrames[k];
        if (t.contents === mapa["{{maquina}}"]) {
            ajustarTextoAchatando(t, larguraMaxMaquinaPt);
        }
    }
}

function agruparTudoNoDocumento(doc) {
    doc.selection = null;
    for (var i = 0; i < doc.pageItems.length; i++) {
        try { doc.pageItems[i].selected = true; } catch (e) {}
    }
    if (doc.selection.length === 0) return null;
    app.executeMenuCommand('group');
    return doc.selection.length > 0 ? doc.selection[0] : null;
}

function criarCorPreta(doc) {
    var cor = new CMYKColor();
    cor.cyan = 0;
    cor.magenta = 0;
    cor.yellow = 0;
    cor.black = 100;
    return cor;
}

function gerarCode128NoLink(doc, texto, link, alturaMM, larguraMM) {
    if (!link) return;

    var bounds = link.geometricBounds; // [left, top, right, bottom]
    var x = bounds[0];
    var y = bounds[1];

    var barHeight = mmToPt(alturaMM);
    var maxWidth = mmToPt(larguraMM);
    var moduleWidth = 0.8;

    var code128Patterns = [
        // matriz completa do Code128, igual a anterior
    ];
    var startCode = 104;
    var stopCode = 106;

    var sequence = [startCode];
    for (var i = 0; i < texto.length; i++) sequence.push(texto.charCodeAt(i) - 32);

    var checksum = startCode;
    for (var i = 0; i < texto.length; i++) checksum += sequence[i + 1] * (i + 1);
    checksum = checksum % 103;
    sequence.push(checksum);
    sequence.push(stopCode);

    var cursorX = x;
    for (var s = 0; s < sequence.length; s++) {
        var pattern = code128Patterns[sequence[s]];
        if (!pattern) continue;
        for (var j = 0; j < pattern.length; j++) {
            var w = pattern[j] * moduleWidth;
            if (j % 2 === 0) {
                var bar = doc.pathItems.rectangle(y, cursorX, w, barHeight);
                bar.filled = true;
                bar.stroked = false;
                bar.fillColor = criarCorPreta(doc);
            }
            cursorX += w;
        }
    }

    // Ajuste proporcional se ultrapassar largura máxima
    var larguraAtual = cursorX - x;
    if (larguraAtual > maxWidth) {
        var escala = maxWidth / larguraAtual * 100;
        for (var pi = doc.pathItems.length - 1; pi >= 0; pi--) {
            var item = doc.pathItems[pi];
            if (item.filled && item.fillColor.black === 100) {
                item.resize(escala, escala);
                item.left = x + (maxWidth - item.width) / 2;
            }
        }
    }

    link.remove();
}

/* ========= Script principal ========= */

var docPrincipal = app.activeDocument;

var layerEtiquetas;
try {
    layerEtiquetas = docPrincipal.layers.getByName("etiquetaCores");
    for (var iClear = layerEtiquetas.pageItems.length - 1; iClear >= 0; iClear--) {
        layerEtiquetas.pageItems[iClear].remove();
    }
} catch (e) {
    layerEtiquetas = docPrincipal.layers.add();
    layerEtiquetas.name = "etiquetaCores";
}

var espacamento = mmToPt(10);
var alturaEtiqueta = mmToPt(52.465);
var yAtual = 0;

var caminhoBasePath = scriptDirectory + '/z_pdfs/Etiqueta_Penha.pdf';
var larguraMaxMaquinaPt = 81;

for (var i = 0; i < cores.length; i++) {
    var corAtual = cores[i];
    var qtdc = (i + 1) + "/" + cores.length;
    var codcorAtual = referenciaCor[i];

    var dados = {
        fi: extrairAntesDaBarra(np),
        cor: corAtual,
        espessura: espessura + " mm",
        lpc: lpc,
        qtdc: qtdc,
        data: getDataAtualFormatada(),
        maquina: extrairDepoisDeMM(cpc),
        codcor: codcorAtual
    };

    var mapa = {
        "{{fi}}": dados.fi,
        "{{cor}}": dados.cor,
        "{{espessura}}": dados.espessura,
        "{{lpc}}": dados.lpc,
        "{{qtdc}}": dados.qtdc,
        "{{data}}": dados.data,
        "{{maquina}}": dados.maquina,
        "{{codcor}}": dados.codcor
    };

    var caminhoBase = new File(caminhoBasePath);
    var docTemplate = app.open(caminhoBase);

    try {
        desbloquearEExibirTudo(docTemplate);
        substituirPlaceholdersNosTextos(docTemplate, mapa, larguraMaxMaquinaPt);

        var placedItems = docTemplate.placedItems;

        if (placedItems.length >= 1) gerarCode128NoLink(docTemplate, produtoComUnderline, placedItems[0], 11, 52);
        if (placedItems.length >= 2) gerarCode128NoLink(docTemplate, codcorAtual, placedItems[1], 10, 33);

        var grupoTemplate = agruparTudoNoDocumento(docTemplate);
        if (!grupoTemplate) throw new Error("Não foi possível agrupar o conteúdo da etiqueta no template.");

        var grupoNoPrincipal = grupoTemplate.duplicate(layerEtiquetas, ElementPlacement.PLACEATEND);
        try { grupoNoPrincipal.top = -yAtual; } catch (posErr) {}

        yAtual += alturaEtiqueta + espacamento;

    } catch (err) {
        alert("Erro na cor: " + corAtual + "\n" + err);
    } finally {
        docTemplate.close(SaveOptions.DONOTSAVECHANGES);
    }
}

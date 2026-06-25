#include "Xml_upload.jsx"

/**
 * 10_Medicao_Ondulado.jsx
 *
 * Mede por GRUPO (e nao mais por layer). Para cada GroupItem das layers,
 * descobre a COR PREDOMINANTE (mesma logica do 14_Risco_Faca) e nomeia cada
 * placa com o nome da spot + um indice. Ex.: 5 grupos cuja cor predominante
 * e a spot "preto" viram preto1, preto2, preto3, preto4 e preto5.
 *
 * Layers tecnicas (geradas por script) e layers ocultas/travadas sao puladas,
 * para que cut/registros/cotas/faca/label nao entrem como placas no XML.
 */

function pointsToMM(points) {
    return (points * 0.35278).toFixed(1);
}

function pointsToCM(points) {
    return (points * 0.035278).toFixed(0);
}

function saveXMLToFile(xmlContent, filePath) {
    var file = new File(filePath);
    file.encoding = "UTF-8";
    file.open("w");
    file.write(xmlContent);
    file.close();
}

function getFolderPathCopyLog() {
    var folderPathCopy = "";
    if ($.os.indexOf("Windows") !== -1) {
        folderPathCopy = "\\\\aeserver16\\Engine\\_Jobfolder\\" + serviceOrderNumber + "\\_log\\";
    } else {
        folderPathCopy = "/Engine/_Jobfolder/" + serviceOrderNumber + "/_log/";
    }
    return folderPathCopy;
}

var folderPathCopy = getFolderPathCopyLog();
var xmlFileName = serviceOrderNumber + "_AI_STAGGERED.xml";

var margemMM = 0;
var margemCM = (margemMM / 10).toFixed(1);

/* =============================
   BOUNDS VISIVEIS (clipados a mascara)
============================= */

function unionBounds(acc, b) {
    if (!b) return acc;
    if (!acc) return [b[0], b[1], b[2], b[3]];
    var left = Math.min(acc[0], b[0]);
    var top = Math.max(acc[1], b[1]);
    var right = Math.max(acc[2], b[2]);
    var bottom = Math.min(acc[3], b[3]);
    return [left, top, right, bottom];
}

function intersectBounds(a, b) {
    if (!a || !b) return null;
    var left = Math.max(a[0], b[0]);
    var right = Math.min(a[2], b[2]);
    var top = Math.min(a[1], b[1]);
    var bottom = Math.max(a[3], b[3]);
    if (left >= right || bottom >= top) return null;
    return [left, top, right, bottom];
}

function shouldIgnoreItemByStyle(it) {

    try {
        if (it.opacity === 0) return true;
    } catch (e) {}

    if (it.typename === "PathItem") {
        try {
            if (!it.filled && !it.stroked) return true;
        } catch (e1) {}
        return false;
    }

    if (it.typename === "CompoundPathItem") {
        try {
            if (it.pathItems && it.pathItems.length > 0) {
                var anyVis = false;
                for (var i = 0; i < it.pathItems.length; i++) {
                    var p = it.pathItems[i];
                    try {
                        if (p.opacity === 0) continue;
                    } catch (e0) {}
                    if (p.filled || p.stroked) {
                        anyVis = true;
                        break;
                    }
                }
                return !anyVis;
            }
        } catch (e2) {}
        return false;
    }

    return false;
}

function findMaskBoundsInGroup(grp) {

    var i, p, cp, k;

    for (i = 0; i < grp.pathItems.length; i++) {
        p = grp.pathItems[i];
        try {
            if (p.clipping) return p.geometricBounds;
        } catch (e1) {}
    }

    for (i = 0; i < grp.compoundPathItems.length; i++) {
        cp = grp.compoundPathItems[i];
        try {
            for (k = 0; k < cp.pathItems.length; k++) {
                p = cp.pathItems[k];
                try {
                    if (p.clipping) return p.geometricBounds;
                } catch (e2) {}
            }
        } catch (e3) {}
    }

    return grp.geometricBounds;
}

function getVisibleBoundsDeep(it) {

    if (!it || it.hidden || it.locked) return null;

    try {

        if (it.typename === "GroupItem") {

            if (it.clipped) {

                var maskB = findMaskBoundsInGroup(it);
                var childrenB = null;

                for (var j = 0; j < it.pageItems.length; j++) {

                    var child = it.pageItems[j];

                    if (child.typename === "PathItem") {
                        try {
                            if (child.clipping) continue;
                        } catch (e0) {}
                    }

                    if (child.typename === "CompoundPathItem") {

                        var isMask = false;

                        try {
                            for (var kk = 0; kk < child.pathItems.length; kk++) {

                                var pp = child.pathItems[kk];

                                try {
                                    if (pp.clipping) {
                                        isMask = true;
                                        break;
                                    }
                                } catch (e01) {}

                            }
                        } catch (e02) {}

                        if (isMask) continue;
                    }

                    if (shouldIgnoreItemByStyle(child) && child.typename !== "GroupItem") continue;

                    var cb = getVisibleBoundsDeep(child);
                    childrenB = unionBounds(childrenB, cb);
                }

                if (!childrenB) return null;

                var inter = intersectBounds(maskB, childrenB);
                return inter ? inter : null;
            }

            var b = null;

            for (var i = 0; i < it.pageItems.length; i++) {

                var child2 = it.pageItems[i];

                if (shouldIgnoreItemByStyle(child2) && child2.typename !== "GroupItem") continue;

                var cb2 = getVisibleBoundsDeep(child2);
                b = unionBounds(b, cb2);
            }

            return b;
        }

        if (shouldIgnoreItemByStyle(it)) return null;

        return it.geometricBounds;

    } catch (e) {
        return null;
    }
}

function boundsToDims(bounds) {

    var widthPt = bounds[2] - bounds[0];
    var heightPt = bounds[1] - bounds[3];

    return {
        wPt: widthPt,
        hPt: heightPt,
        wMM: (widthPt * 0.35278),
        hMM: (heightPt * 0.35278),
        wCM: (widthPt * 0.035278),
        hCM: (heightPt * 0.035278)
    };
}

/* =============================
   COR PREDOMINANTE DO GRUPO
   - mesma logica do 14_Risco_Faca.jsx
============================= */

// nome de cor TECNICA que deve ser ignorada (none/registro). Branco/white NAO
// entram aqui: so sao ignorados se o VALOR for 0,0,0,0 (ver spotEhBranco).
function corEhBrancoNome(nome) {
    var n = String(nome).toLowerCase();
    return (n === "none" || n === "[none]" ||
            n === "[registration]" || n === "[registro]");
}

// spot cuja cor e branca (CMYK 0/0/0/0 ou Gray 0) deve ser ignorada
function spotEhBranco(spot) {
    try {
        var c = spot.color;
        if (c && c.typename === "CMYKColor" &&
            c.cyan === 0 && c.magenta === 0 && c.yellow === 0 && c.black === 0) return true;
        if (c && c.typename === "GrayColor" && c.gray === 0) return true;
    } catch (e) {}
    return false;
}

// cor predominante (spot) de um grupo: a mais frequente em fill+stroke
function corPredominanteDoGrupo(grupo) {
    var contagem = {};

    function conta(cor) {
        if (!cor) return;
        if (cor.typename === "SpotColor" && cor.spot) {
            var nm = cor.spot.name;
            if (corEhBrancoNome(nm)) return;
            if (spotEhBranco(cor.spot)) return;
            contagem[nm] = (contagem[nm] || 0) + 1;
        }
    }

    function visita(item) {
        try { if (item.filled) conta(item.fillColor); } catch (e) {}
        try { if (item.stroked) conta(item.strokeColor); } catch (e) {}
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) visita(item.pageItems[i]);
        } else if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) visita(item.pathItems[i]);
        } else if (item.typename === "TextFrame") {
            try {
                var ca = item.textRange.characterAttributes;
                conta(ca.fillColor);
                conta(ca.strokeColor);
            } catch (e) {}
        }
    }

    visita(grupo);

    var melhor = null, maxC = 0;
    for (var nome in contagem) {
        if (contagem.hasOwnProperty(nome) && contagem[nome] > maxC) {
            maxC = contagem[nome];
            melhor = nome;
        }
    }
    return melhor;
}

/* =============================
   LAYERS TECNICAS A IGNORAR
   - layers geradas por script que NUNCA sao arte; seus grupos
     (cut, registros, cotas, faca, label) nao podem virar placa.
============================= */

function isLayerTecnica(layer) {
    var tecnicas = ["faca", "cut", "cota", "cotas", "registros", "label"];
    var n = String(layer.name).toLowerCase();
    for (var i = 0; i < tecnicas.length; i++) {
        if (n === tecnicas[i]) return true;
    }
    return false;
}

/* =============================
   PERGUNTA REPETICOES
============================= */

function askRepetitions() {

    var defaultVal = "1";
    var result;

    while (true) {

        result = prompt(
            "Quantas repetições tem o trabalho?\n(Digite um número inteiro entre 1 e 99.)",
            defaultVal
        );

        if (result === null) {
            return null;
        }

        result = String(result).replace(/^\s+|\s+$/g, "");
        var n = parseInt(result, 10);

        if (!isNaN(n) && n >= 1 && n <= 99) {
            return n;
        }

        alert("Valor inválido.\nInforme um número inteiro entre 1 e 99.");
        defaultVal = "1";
    }
}

function minValue(val, min) {
    if (isNaN(val) || val <= 0) return min;
    if (val < min) return min;
    return val;
}

/* =============================
   FUNCAO PRINCIPAL
============================= */

function groupsAndGenerateXML(repetitions) {

    var doc = app.activeDocument;

    var plateInfoArray = [];
    var colorCounters = {};   // nome da spot -> quantas placas dessa cor ja saíram
    var distinctColors = {};  // nome da spot -> true (para contar JobColors)
    var uniqueColorCount = 0;

    for (var i = 0; i < doc.layers.length; i++) {

        var layer = doc.layers[i];

        // pula layers ocultas/travadas e as tecnicas (cut, faca, registros, etc.)
        if (!layer.visible || layer.locked) continue;
        if (isLayerTecnica(layer)) continue;
        if (layer.pageItems.length === 0) continue;

        // percorre os grupos do TOPO desta layer (1 grupo = 1 placa)
        for (var g = 0; g < layer.pageItems.length; g++) {

            var grupo = layer.pageItems[g];
            if (grupo.typename !== "GroupItem") continue;

            var nomeCor = corPredominanteDoGrupo(grupo);
            if (!nomeCor) continue;

            var vb = getVisibleBoundsDeep(grupo);
            if (!vb) continue;

            var dims = boundsToDims(vb);

            var wMMraw = dims.wMM + parseFloat(margemMM);
            var hMMraw = dims.hMM + parseFloat(margemMM);
            var wCMraw = dims.wCM + parseFloat(margemCM);
            var hCMraw = dims.hCM + parseFloat(margemCM);

            wMMraw = minValue(wMMraw, 1);
            hMMraw = minValue(hMMraw, 1);
            wCMraw = minValue(wCMraw, 1);
            hCMraw = minValue(hCMraw, 1);

            var widthInMM = wMMraw.toFixed(1);
            var heightInMM = hMMraw.toFixed(1);
            var widthInCM = wCMraw.toFixed(0);
            var heightInCM = hCMraw.toFixed(0);

            // conta cores distintas (JobColors)
            if (!distinctColors[nomeCor]) {
                distinctColors[nomeCor] = true;
                uniqueColorCount++;
            }

            // nome da placa = nome da spot + indice (preto1, preto2, ...)
            colorCounters[nomeCor] = (colorCounters[nomeCor] || 0) + 1;
            var plateName = nomeCor + colorCounters[nomeCor];

            plateInfoArray.push({
                name: plateName,
                widthInMM: widthInMM,
                heightInMM: heightInMM,
                widthInCM: widthInCM,
                heightInCM: heightInCM
            });
        }
    }

    if (plateInfoArray.length === 0) {
        alert("Nenhum grupo com cor predominante foi encontrado.\nVerifique se a arte esta agrupada e com spots (nao branco).");
        return;
    }

    var platesCount = plateInfoArray.length;

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Billing>\n';

    xml += '    <Customer Billed="0" Operador="' + resultadoOperadorNome + '" Folder="' + folder + '" JobColors="' + uniqueColorCount + '" Name="' + cliente + '" Order="' + serviceOrderNumber + '" Plates="' + platesCount + '" crop="" mb="" ml="" mr="" mt="" operator="' + resultadoOperador + '" spetialcrop=""/>\n';

    for (var j = 0; j < plateInfoArray.length; j++) {

        var info = plateInfoArray[j];

        xml += '    <PARTIALPLATE Name="' + info.name +
            '" data="' + (j + 1) + '_' + info.name + '_' + info.heightInMM + 'x' + info.widthInMM +
            '" n="' + repetitions +
            '" x="' + info.widthInCM +
            '" xmm="' + info.widthInMM +
            '" y="' + info.heightInCM +
            '" ymm="' + info.heightInMM + '"/>\n';
    }

    xml += '</Billing>';

    saveXMLToFile(xml, folderPathCopy + xmlFileName);

    alert("MEDIDAS GERADAS\n\nPlacas: " + platesCount + "\nCores distintas: " + uniqueColorCount);
}

/* =============================
   EXECUCAO
============================= */

var repetitions = askRepetitions();

if (repetitions === null) {

    alert("Operação cancelada. XML não foi gerado.");

} else {

    groupsAndGenerateXML(repetitions);

}

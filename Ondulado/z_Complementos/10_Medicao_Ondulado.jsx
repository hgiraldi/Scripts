#include "Xml_upload.jsx"

/**
 * 10_Medicao_Ondulado.jsx
 * Mede cada layer pelo conteúdo VISÍVEL real:
 * - Respeita máscaras de recorte (clipping) em qualquer nível (inclui Compound Path como máscara)
 * - Para grupos clipped, usa a INTERSEÇÃO entre a máscara e o conteúdo visível
 * - Ignora paths “vazios” (sem fill e sem stroke) e itens com opacity == 0
 * - Não altera a arte (sem group/ungroup); gera o XML no _log da O.S.
 *
 * Observações:
 * - Usa geometricBounds para não contar “engorda” por stroke.
 *   Se quiser considerar stroke visível, troque geometricBounds -> visibleBounds
 *   nas partes indicadas (itens não-grupo).
 * - Opacity Mask (máscara de opacidade) não é exposta na API; este método não a considera.
 * - Variáveis externas esperadas: serviceOrderNumber, resultadoOperadorNome,
 *   resultadoOperador, cliente, folder (mantidas).
 */

// === Helpers existentes ===
function LayerInfo(name, width, height) {
    this.name = name;
    this.width = width;
    this.height = height;
}

function pointsToMM(points) {
    return (points * 0.35278).toFixed(1); // 1pt = 0,35278 mm
}

function pointsToCM(points) {
    return (points * 0.035278).toFixed(0); // 1pt = 0,035278 cm
}

function saveXMLToFile(xmlContent, filePath) {
    var file = new File(filePath);
    file.encoding = "UTF-8";
    file.open("w");
    file.write(xmlContent);
    file.close();
}

// === Caminho de saída no _log (mantido) ===
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

// Nome do XML (mantido)
var xmlFileName = serviceOrderNumber + "_AI_STAGGERED.xml";

// Margem adicional (em mm / cm)
var margemMM = 0; // ajuste se desejar
var margemCM = (margemMM / 10).toFixed(1);

// ===================== BLOCO: Medição VISÍVEL =====================

// Une bounds [L, T, R, B]
function unionBounds(acc, b) {
    if (!b) return acc;
    if (!acc) return [b[0], b[1], b[2], b[3]];
    var left = Math.min(acc[0], b[0]);
    var top = Math.max(acc[1], b[1]); // top = maior (sistema do Illustrator)
    var right = Math.max(acc[2], b[2]);
    var bottom = Math.min(acc[3], b[3]); // bottom = menor
    return [left, top, right, bottom];
}

// Interseção de dois retângulos [L, T, R, B]; retorna null se não há interseção
// (No Illustrator: top > bottom)
function intersectBounds(a, b) {
    if (!a || !b) return null;
    var left = Math.max(a[0], b[0]);
    var right = Math.min(a[2], b[2]);
    var top = Math.min(a[1], b[1]); // para a interseção, top = menor(topA, topB)
    var bottom = Math.max(a[3], b[3]); // para a interseção, bottom = maior(bottomA, bottomB)
    if (left >= right || bottom >= top) return null;
    return [left, top, right, bottom];
}

// Testa se um item deve ser ignorado por ser “invisível” para medição
function shouldIgnoreItemByStyle(it) {
    try {
        if (it.opacity === 0) return true;
    } catch (e) {}

    // PathItem
    if (it.typename === "PathItem") {
        try {
            if (!it.filled && !it.stroked) return true;
        } catch (e1) {}
        return false;
    }

    // CompoundPathItem: ao menos um path filho precisa ter fill/stroke
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

    // TextFrame, PlacedItem, RasterItem, SymbolItem, MeshItem etc.: mantemos (a não ser opacity 0)
    return false;
}

// Procura a BOUND da máscara de recorte em um GroupItem clipped,
// cobrindo casos em que a máscara é PathItem OU CompoundPathItem.
function findMaskBoundsInGroup(grp) {
    var i, p, cp, k;

    // 1) PathItem com clipping == true
    for (i = 0; i < grp.pathItems.length; i++) {
        p = grp.pathItems[i];
        try {
            if (p.clipping) return p.geometricBounds;
        } catch (e1) {}
    }

    // 2) CompoundPathItem contendo ao menos um PathItem com clipping == true
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

    // 3) Fallback raríssimo: se nada marcado como clipping, volta bounds do grupo
    return grp.geometricBounds;
}

/**
 * Retorna bounds visíveis REAIS de QUALQUER item, descendo na hierarquia.
 * Regras:
 * 1) GroupItem.clipped == true:
 *    - encontra a máscara (Path ou Compound Path) -> maskB
 *    - une bounds visíveis dos filhos (EXCETO a própria máscara), ignorando itens “vazios”
 *    - retorna a INTERSEÇÃO: intersectBounds(maskB, childrenB)
 *
 * 2) GroupItem (sem clipping):
 *    - une recursivamente bounds dos filhos visíveis, ignorando itens “vazios”
 *
 * 3) Demais tipos (Path/CompoundPath/etc.):
 *    - se “vazio” (sem fill e sem stroke) -> ignora (null)
 *    - senão retorna geometricBounds (troque por visibleBounds se quiser contar stroke)
 */
function getVisibleBoundsDeep(it) {
    if (!it || it.hidden || it.locked) return null;

    try {
        if (it.typename === "GroupItem") {
            // Grupo com máscara de recorte
            if (it.clipped) {
                var maskB = findMaskBoundsInGroup(it);

                // Une conteúdo visível (exceto a máscara)
                var childrenB = null;
                for (var j = 0; j < it.pageItems.length; j++) {
                    var child = it.pageItems[j];

                    // pular a própria máscara (Path ou Path dentro de CompoundPath)
                    if (child.typename === "PathItem") {
                        try {
                            if (child.clipping) continue;
                        } catch (e0) {}
                    }
                    if (child.typename === "CompoundPathItem") {
                        // se QUALQUER path do compound tiver clipping, considera que é a máscara
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

                    // ignorar itens vazios
                    if (shouldIgnoreItemByStyle(child) && child.typename !== "GroupItem") continue;

                    var cb = getVisibleBoundsDeep(child);
                    childrenB = unionBounds(childrenB, cb);
                }

                // Interseção: conteúdo ∩ máscara
                if (!childrenB) return null;
                var inter = intersectBounds(maskB, childrenB);
                return inter ? inter : null;
            }

            // Grupo normal: desce e une filhos
            var b = null;
            for (var i = 0; i < it.pageItems.length; i++) {
                var child2 = it.pageItems[i];
                if (shouldIgnoreItemByStyle(child2) && child2.typename !== "GroupItem") continue;
                var cb2 = getVisibleBoundsDeep(child2);
                b = unionBounds(b, cb2);
            }
            return b;
        }

        // Itens não-grupo
        if (shouldIgnoreItemByStyle(it)) return null;

        // geometricBounds não conta engorda de stroke
        return it.geometricBounds; // troque por it.visibleBounds se quiser contar stroke

    } catch (e) {
        // Alguns itens de plugin podem lançar exceção; ignoramos
        return null;
    }
}

// Calcula bounds visíveis agregadas dos itens de topo da layer (recursivo nos grupos).
function getLayerVisibleBounds(layer) {
    var bounds = null;
    for (var i = 0; i < layer.pageItems.length; i++) {
        var topItem = layer.pageItems[i];
        if (topItem.hidden || topItem.locked) continue;
        if (shouldIgnoreItemByStyle(topItem) && topItem.typename !== "GroupItem") continue;
        var b = getVisibleBoundsDeep(topItem);
        bounds = unionBounds(bounds, b);
    }
    return bounds; // null se nada válido
}

// Converte bounds [L, T, R, B] em números nas 3 unidades (sem arredondar aqui)
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

// ===================== NOVO: Perguntar nº de repetições =====================
function askRepetitions() {
    var defaultVal = "1";
    var result;

    while (true) {
        result = prompt(
            "Quantas repetições tem o trabalho?\n" +
            "(Digite um número inteiro entre 1 e 99.)",
            defaultVal
        );

        // Cancelou
        if (result === null) {
            return null;
        }

        // Remove espaços
        result = String(result).replace(/^\s+|\s+$/g, "");

        var n = parseInt(result, 10);

        if (!isNaN(n) && n >= 1 && n <= 99) {
            return n;
        }

        alert("Valor inválido.\nInforme um número inteiro entre 1 e 99.");
        defaultVal = "1";
    }
}


// ===================== Principal =====================
function minValue(val, min) {
    if (isNaN(val) || val <= 0) return min;
    if (val < min) return min;
    return val;
}

function groupLayersAndGenerateXML(repetitions) {
    var doc = app.activeDocument;
    var layerInfoArray = [];

    // Contagem de cores únicas por prefixo (ex.: "azul1", "azul2" => "azul")
    var jobColorsCount = {};
    var uniqueColorCount = 0;

    // Percorre layers do documento
    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];

        // Pula layers realmente vazias
        if (layer.pageItems.length === 0) continue;

        // Mede bounds visíveis da layer (sem agrupar nada)
        var lb = getLayerVisibleBounds(layer);
        if (!lb) continue; // só itens ocultos/travados/vazios etc.

        var dims = boundsToDims(lb);

        var wMMraw = dims.wMM + parseFloat(margemMM);
        var hMMraw = dims.hMM + parseFloat(margemMM);
        var wCMraw = dims.wCM + parseFloat(margemCM);
        var hCMraw = dims.hCM + parseFloat(margemCM);

        // força mínimo
        wMMraw = minValue(wMMraw, 1);
        hMMraw = minValue(hMMraw, 1);
        wCMraw = minValue(wCMraw, 1);
        hCMraw = minValue(hCMraw, 1);

        // agora sim arredonda
        var widthInMM = wMMraw.toFixed(1);
        var heightInMM = hMMraw.toFixed(1);
        var widthInCM = wCMraw.toFixed(0);
        var heightInCM = hCMraw.toFixed(0);


        // Conta cor única pelo prefixo sem o sufixo numérico
        var colorPrefix = layer.name.replace(/\d+$/, '');
        if (!jobColorsCount[colorPrefix]) {
            jobColorsCount[colorPrefix] = true;
            uniqueColorCount++;
        }

        // Guarda info para o XML
        layerInfoArray.push({
            name: layer.name,
            widthInMM: widthInMM,
            heightInMM: heightInMM,
            widthInCM: widthInCM,
            heightInCM: heightInCM
        });
    }

    // Quantidade de chapas = nº de layers medidas
    var platesCount = layerInfoArray.length;

    // ===================== Geração do XML (mantida, com n variável) =====================
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Billing>\n';
    xml += '    <Customer Billed="0" Operador="' + resultadoOperadorNome + '" Folder="' + folder + '" JobColors="' + uniqueColorCount + '" Name="' + cliente + '" Order="' + serviceOrderNumber + '" Plates="' + platesCount + '" crop="" mb="" ml="" mr="" mt="" operator="' + resultadoOperador + '" spetialcrop=""/>\n';

    for (var j = 0; j < layerInfoArray.length; j++) {
        var info = layerInfoArray[j];
        var plateType = "PARTIALPLATE"; // mantendo igual ao seu
        // data="idx_nome_ALTURAxLARGURA" (mantida sua convenção altura x largura)
        xml += '    <' + plateType +
            ' Name="' + info.name +
            '" data="' + (j + 1) + '_' + info.name + '_' + info.heightInMM + 'x' + info.widthInMM +
            '" n="' + repetitions +
            '" x="' + info.widthInCM +
            '" xmm="' + info.widthInMM +
            '" y="' + info.heightInCM +
            '" ymm="' + info.heightInMM + '"/>\n';
    }

    xml += '</Billing>';

    // Salva o XML
    saveXMLToFile(xml, folderPathCopy + xmlFileName);

    alert("MEDIDAS GERADAS");
}

// ===================== Execução =====================
var repetitions = askRepetitions();
if (repetitions === null) {
    alert("Operação cancelada. XML não foi gerado.");
} else {
    groupLayersAndGenerateXML(repetitions);
}
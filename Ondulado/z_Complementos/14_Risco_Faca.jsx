var serviceOrderNumber = "1377974";
#include "Xml_upload.jsx"

/* ========= Helpers ========= */
function getDataAtualFormatada() {
    var hoje = new Date();
    var dia = ("0" + hoje.getDate()).slice(-2);
    var mes = ("0" + (hoje.getMonth() + 1)).slice(-2);
    var ano = hoje.getFullYear();
    return dia + "/" + mes + "/" + ano;
}

var doc = app.activeDocument;

function escapeForRegExp(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// --------------------------------------
// Substitui tokens em uma string usando o mapping
// --------------------------------------
function replaceTokensInString(str, map) {
    if (str === undefined || str === null) return str;
    var result = str;
    for (var key in map) {
        if (map.hasOwnProperty(key)) {
            var token = "\\[\\[" + escapeForRegExp(key) + "\\]\\]";
            var re = new RegExp(token, "g");
            result = result.replace(re, map[key]);
        }
    }
    return result;
}


function replaceInTextFrames(doc, map) {
    var countReplaced = 0;
    var tf = doc.textFrames;
    for (var i = 0; i < tf.length; i++) {
        try {
            var original = tf[i].contents;
            var replaced = replaceTokensInString(original, map);
            if (replaced !== original) {
                tf[i].contents = replaced;
                countReplaced++;
            }
        } catch (e) {

        }
    }
    return countReplaced;
}


function remapSpotsPorArray(doc, cores) {

    var spotsBase = ["cor1", "cor2", "cor3", "cor4", "cor5", "cor6"];

    // ======================================================
    // FUNÇÕES INTERNAS
    // ======================================================

    function getBrancoCMYK() {
        var c = new CMYKColor();
        c.cyan = 0;
        c.magenta = 0;
        c.yellow = 0;
        c.black = 0;
        return c;
    }

    function getSpotByName(nome) {
        for (var i = 0; i < doc.spots.length; i++) {
            if (doc.spots[i].name === nome) {
                return doc.spots[i];
            }
        }
        return null;
    }

    function encontrarSwatchPorNome(cor) {
        if (!cor) return null;

        var corNormalizada = cor.toLowerCase();

        // correspondência direta
        for (var i = 0; i < doc.swatches.length; i++) {
            if (doc.swatches[i].name.toLowerCase() === corNormalizada) {
                return doc.swatches[i];
            }
        }

        // correspondência normalizada
        for (var i = 0; i < doc.swatches.length; i++) {
            var nome = doc.swatches[i].name.toLowerCase()
                .replace(/process /g, '')
                .replace(/pantone /g, '')
                .replace(/ c/g, '');

            if (nome === corNormalizada) {
                return doc.swatches[i];
            }
        }

        return null;
    }

    // ------------------------------------------------------
    // PINTA OBJETOS (PATH, COMPOUND, ETC)
    // ------------------------------------------------------
    function pintarItem(item, nomeSpot, novaCor) {

        // FILL
        if (
            item.filled &&
            item.fillColor &&
            item.fillColor.typename === "SpotColor" &&
            item.fillColor.spot &&
            item.fillColor.spot.name === nomeSpot
        ) {
            item.fillColor = novaCor;
        }

        // STROKE
        if (
            item.stroked &&
            item.strokeColor &&
            item.strokeColor.typename === "SpotColor" &&
            item.strokeColor.spot &&
            item.strokeColor.spot.name === nomeSpot
        ) {
            item.strokeColor = novaCor;
        }
    }

    // ------------------------------------------------------
    // PINTA TEXTO (SEGURO CONTRA ILLEGAL ARGUMENT)
    // ------------------------------------------------------
    function pintarTexto(item, nomeSpot, novaCor) {
        try {
            var tr = item.textRange;
            if (!tr || tr.length === 0) return;

            var ca = tr.characterAttributes;

            // FILL TEXTO
            if (
                ca.fillColor &&
                ca.fillColor.typename === "SpotColor" &&
                ca.fillColor.spot &&
                ca.fillColor.spot.name === nomeSpot
            ) {
                ca.fillColor = novaCor;
            }

            // STROKE TEXTO
            if (
                ca.strokeColor &&
                ca.strokeColor.typename === "SpotColor" &&
                ca.strokeColor.spot &&
                ca.strokeColor.spot.name === nomeSpot
            ) {
                ca.strokeColor = novaCor;
            }

        } catch (e) {
            // evita Illegal argument do Illustrator
        }
    }

    // ======================================================
    // LÓGICA PRINCIPAL
    // ======================================================

    for (var i = 0; i < spotsBase.length; i++) {

        var nomeSpot = spotsBase[i];
        var corDesejada = cores[i];

        // ------------------------------
        // EXISTE COR NO ARRAY
        // ------------------------------
        if (corDesejada) {

            var swatchDestino = encontrarSwatchPorNome(corDesejada);
            if (!swatchDestino) continue;

            var novaCor = swatchDestino.color;

            for (var j = 0; j < doc.pageItems.length; j++) {
                var item = doc.pageItems[j];

                if (item.typename === "TextFrame") {
                    pintarTexto(item, nomeSpot, novaCor);
                } else {
                    pintarItem(item, nomeSpot, novaCor);
                }
            }

            // ------------------------------
            // NÃO EXISTE → LIMPAR E REMOVER
            // ------------------------------
        } else {

            var branco = getBrancoCMYK();

            for (var j = 0; j < doc.pageItems.length; j++) {
                var item = doc.pageItems[j];

                if (item.typename === "TextFrame") {
                    pintarTexto(item, nomeSpot, branco);
                } else {
                    pintarItem(item, nomeSpot, branco);
                }
            }

            // remove a spot vazia
            try {
                var spot = getSpotByName(nomeSpot);
                if (spot) spot.remove();
            } catch (e) {}
        }
    }
}


function replaceInLayerAndArtboardNames(doc, map) {
    var changed = 0;
    // Layers
    for (var i = 0; i < doc.layers.length; i++) {
        try {
            var ln = doc.layers[i].name;
            var rn = replaceTokensInString(ln, map);
            if (rn !== ln) {
                doc.layers[i].name = rn;
                changed++;
            }
        } catch (e) {}
    }
    // Artboards
    for (var j = 0; j < doc.artboards.length; j++) {
        try {
            var an = doc.artboards[j].name;
            var rn2 = replaceTokensInString(an, map);
            if (rn2 !== an) {
                doc.artboards[j].name = rn2;
                changed++;
            }
        } catch (e) {}
    }
    return changed;
}

// --------------------------------------
// EXECUÇÃO PRINCIPAL
// --------------------------------------
function mainMap() {
    if (app.documents.length === 0) {
        alert("Nenhum documento aberto. Abra um documento e execute novamente.");
        return;
    }

    var doc = app.activeDocument;

    // Faz as substituições
    var textChanges = replaceInTextFrames(doc, mapping);
    var nameChanges = replaceInLayerAndArtboardNames(doc, mapping);

    // Relatório simples
    var message = "Substituição concluída.\n\n";
    message += "TextFrames alterados: " + textChanges + "\n";
    message += "Layers/Artboards renomeados: " + nameChanges + "\n\n";
    message += "Verifique o documento ativo.";
    //alert(message);
}




function ptToMm(pt) {
    return pt / 2.834645;
}

function mmToPt(mm) {
    return mm * 2.834645;
}

function getLayerByName(doc, name) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name.toLowerCase() == name.toLowerCase()) {
            return doc.layers[i];
        }
    }
    return null;
}

function getFirstItem(layer) {
    if (layer.pageItems.length > 0) {
        return layer.pageItems[0];
    }
    return null;
}

function getFacaBounds(layer) {
    var doc = app.activeDocument;
    var tempGroup = doc.groupItems.add();

    for (var i = 0; i < layer.pageItems.length; i++) {
        var dup = layer.pageItems[i].duplicate();
        dup.move(tempGroup, ElementPlacement.PLACEATEND);
    }

    var bounds = tempGroup.geometricBounds;
    tempGroup.remove();

    return bounds;
}

// 🔎 busca objeto pelo nome
function getItemByName(doc, nome) {
    for (var i = 0; i < doc.pageItems.length; i++) {
        if (doc.pageItems[i].name == nome) {
            return doc.pageItems[i];
        }
    }
    return null;
}



function main() {
    if (app.documents.length === 0) {
        alert("Nenhum documento aberto.");
        return;
    }

    var doc = app.activeDocument;

    var layerEntrada = getLayerByName(doc, "entrada");
    var layerCentro = getLayerByName(doc, "centro");
    var layerFaca = getLayerByName(doc, "faca");

    if (!layerEntrada || !layerCentro || !layerFaca) {
        alert("Verifique as layers.");
        return;
    }

    var entradaItem = getFirstItem(layerEntrada);
    var centroItem = getFirstItem(layerCentro);

    if (!entradaItem || !centroItem || layerFaca.pageItems.length === 0) {
        alert("Layer vazia.");
        return;
    }

    // =========================
    // ENTRADA
    // =========================
    var eb = entradaItem.geometricBounds;
    var entradaX = ptToMm(eb[0]);
    var entradaY = ptToMm(eb[1]);
    var entradaAltura = ptToMm(eb[1] - eb[3]);

    // =========================
    // CENTRO
    // =========================
    var cb = centroItem.geometricBounds;
    var centroX = ptToMm((cb[0] + cb[2]) / 2);
    var centroY = ptToMm((cb[1] + cb[3]) / 2);

    // =========================
    // FACA
    // =========================
    var fb = getFacaBounds(layerFaca);
    var facaX = ptToMm(fb[0]);
    var facaY = ptToMm(fb[1]);
    var facaLargura = ptToMm(fb[2] - fb[0]);
    var facaAltura = ptToMm(fb[1] - fb[3]);

    // =========================
    // OBJETO
    // =========================
    var dados_poliester = new Object();

    dados_poliester.entrada = new Object();
    dados_poliester.entrada.x = entradaX;
    dados_poliester.entrada.y = entradaY;
    dados_poliester.entrada.altura = entradaAltura.toFixed(3);

    dados_poliester.centro = new Object();
    dados_poliester.centro.x = centroX;
    dados_poliester.centro.y = centroY;

    dados_poliester.faca = new Object();
    dados_poliester.faca.x = facaX;
    dados_poliester.faca.y = facaY;
    dados_poliester.faca.largura = facaLargura.toFixed(3);
    dados_poliester.faca.altura = facaAltura.toFixed(3);

    alert(
        "ENTRADA X: " + dados_poliester.entrada.x +
        "\nENTRADA Y: " + dados_poliester.entrada.y +
        "\nALTURA ENTRADA: " + dados_poliester.entrada.altura +
        "\n\nCENTRO X: " + dados_poliester.centro.x +
        "\nCENTRO Y: " + dados_poliester.centro.y +
        "\n\nFACA LARGURA: " + dados_poliester.faca.largura +
        "\nFACA ALTURA: " + dados_poliester.faca.altura +
        "\nFACA X: " + dados_poliester.faca.x +
        "\nFACA Y: " + dados_poliester.faca.y
    );

    return {
        dados: dados_poliester,
        facaBounds: fb
    };
}

// =========================
// EXECUÇÃO
// =========================
var resultado = main();

function centralizarObjetoBaixoFaca(nomeObjeto, dados, facaBounds, distancia, bounds) {

    var doc = app.activeDocument;

    var item = getItemByName(doc, nomeObjeto);

    if (!item) {
        alert("Objeto não encontrado: " + nomeObjeto);
        return;
    }

    // =========================
    // CENTRO PELO OBJETO "CENTRO"
    // =========================
    var centroX = mmToPt(dados.faca.x);

    // =========================
    // BASE DA FACA
    // =========================
    var baseFacaY = facaBounds[bounds];

    // =========================
    // TAMANHO DO OBJETO
    // =========================
    var itemBounds = item.geometricBounds;
    var itemLargura = itemBounds[2] - itemBounds[0];
    var itemAltura = itemBounds[1] - itemBounds[3];

    // =========================
    // POSICIONAMENTO
    // =========================

    // 🔥 CENTRALIZA NO EIXO DO "CENTRO"
    item.left = centroX - (itemLargura / 2);

    // 🔥 DISTÂNCIA REAL DA BASE
    item.top = baseFacaY - distancia;
}

function centralizarObjetoBaixoCentro(nomeObjeto, dados, facaBounds, distancia, bounds) {

    var doc = app.activeDocument;

    var item = getItemByName(doc, nomeObjeto);

    if (!item) {
        alert("Objeto não encontrado: " + nomeObjeto);
        return;
    }

    // =========================
    // CENTRO PELO OBJETO "CENTRO"
    // =========================
    var centroX = mmToPt(dados.centro.x);

    // =========================
    // BASE DA FACA
    // =========================
    var baseFacaY = facaBounds[bounds];

    // =========================
    // TAMANHO DO OBJETO
    // =========================
    var itemBounds = item.geometricBounds;
    var itemLargura = itemBounds[2] - itemBounds[0];
    var itemAltura = itemBounds[1] - itemBounds[3];

    // =========================
    // POSICIONAMENTO
    // =========================

    // 🔥 CENTRALIZA NO EIXO DO "CENTRO"
    item.left = centroX - (itemLargura / 2);

    // 🔥 DISTÂNCIA REAL DA BASE
    item.top = baseFacaY - distancia;
}

//=================== Diretorios ========================//

var pdfFilePathEtiquetaCentro = scriptDirectory + '/z_pdfs/etiqueta_centro.ai';


//===================Etiqueta Centro=====================//

var pdfEtiquetaCentro = new File(pdfFilePathEtiquetaCentro);
var etiquetaCentro = doc.placedItems.add();
etiquetaCentro.file = pdfEtiquetaCentro;
etiquetaCentro.name = "Etiqueta_centro";

var distanciaMMCentro;

if (parseFloat(resultado.dados.entrada.altura) >= 100) {
    distanciaMMCentro = 30;
} else {
    distanciaMMCentro = 3;
}

var distanciaPTCentro = mmToPt(distanciaMMCentro);


centralizarObjetoBaixoCentro("Etiqueta_centro", resultado.dados, resultado.facaBounds, distanciaPTCentro, 3);
etiquetaCentro.resize(-100, 100);
etiquetaCentro.embed();


//Tratamento de varaiveis
function getCor(refArray, index, pos) {
    if (refArray && refArray[index] && refArray[index].indexOf("/") !== -1) {
        var partes = refArray[index].split("/");
        if (partes[pos]) {
            return (pos === 0 ? "Cód: " : "") + partes[pos];
        }
    }
    return " ";
}

function marcaSeContem(textoBase, palavra) {
    if (textoBase && textoBase.indexOf(palavra) !== -1) {
        return "X";
    }
    return "";
}


var q = 2;
if (cores.length > 1) {
    q = 3;
} else {
    alert("ARQUIVO DE UMA COR, NÃO PRECISA DE SEPARAÇÃO")
}

var partesNome = resultadoOperadorNome.split(" ");

var mapping = {
    "cliente": cliente,
    "ref": ref,
    "descr": clienteOnd,
    "medint": medInt,
    "fi": np,
    "Cor1": cores[0] || "",
    "Cor2": cores[1] || "",
    "Cor3": cores[2] || "",
    "Cor4": cores[3] || "",
    "Cor5": cores[4] || "",
    "Cor6": cores[5] || "",
    "data": getDataAtualFormatada(),
    "rep": repetitions,
    "pist": lanes,
    "onda": onda,
    "os": serviceOrderNumber,
    "esp": espessura,
    "cp": cp,
    "rev": rev.split("v")[1],
    "v": v.split("v")[1],
    "q": q,
    "maq": maquina,
    "operador": partesNome.slice(0, 2).join(" ")
};

var doc = app.activeDocument;
remapSpotsPorArray(doc, cores);

mainMap();




function substituirSpotCor(doc, nomeNovaCor) {

    function encontrarSwatchPorNome(cor) {

        if (!cor) return null;

        var corNormalizada = String(cor).toLowerCase();

        for (var i = 0; i < doc.swatches.length; i++) {

            var nomeSwatch = doc.swatches[i].name.toLowerCase();

            if (nomeSwatch === corNormalizada) {
                return doc.swatches[i];
            }

            var normalizado = nomeSwatch
                .replace(/process /g, '')
                .replace(/pantone /g, '')
                .replace(/ c/g, '');

            if (normalizado === corNormalizada) {
                return doc.swatches[i];
            }
        }

        return null;
    }

    var swatchDestino = encontrarSwatchPorNome(nomeNovaCor);

    if (!swatchDestino) return;

    var novaCor = swatchDestino.color;

    for (var i = 0; i < doc.pageItems.length; i++) {

        var item = doc.pageItems[i];

        try {

            if (
                item.filled &&
                item.fillColor &&
                item.fillColor.typename === "SpotColor" &&
                item.fillColor.spot &&
                item.fillColor.spot.name.toLowerCase() === "cor"
            ) {
                item.fillColor = novaCor;
            }

            if (
                item.stroked &&
                item.strokeColor &&
                item.strokeColor.typename === "SpotColor" &&
                item.strokeColor.spot &&
                item.strokeColor.spot.name.toLowerCase() === "cor"
            ) {
                item.strokeColor = novaCor;
            }

        } catch (e) {}

        try {

            if (item.typename === "TextFrame") {

                var ca = item.textRange.characterAttributes;

                if (
                    ca.fillColor &&
                    ca.fillColor.typename === "SpotColor" &&
                    ca.fillColor.spot &&
                    ca.fillColor.spot.name.toLowerCase() === "cor"
                ) {
                    ca.fillColor = novaCor;
                }

                if (
                    ca.strokeColor &&
                    ca.strokeColor.typename === "SpotColor" &&
                    ca.strokeColor.spot &&
                    ca.strokeColor.spot.name.toLowerCase() === "cor"
                ) {
                    ca.strokeColor = novaCor;
                }
            }

        } catch (e) {}
    }
}


//================================= CRIAÇÃO DOS DOCUMENTOS=============================================//


// ======================================
// CONFIGURAÇÕES
// ======================================

// Quantidade de documentos que serão criados
var quantidadeDocumentos = cores.length;

var nomesDocumentos = [];

for (var i = 0; i < cores.length; i++) {

    var corAtual = String(cores[i]).toUpperCase();

    nomesDocumentos.push(
        produtoComUnderline +
        "_RISCO_" +
        corAtual
    );
}
// ======================================
// DOCUMENTO ORIGINAL
// ======================================

var docOriginal = app.activeDocument;

function copiarSpots(origem, destino) {

    for (var i = 0; i < origem.spots.length; i++) {

        var spotOrigem = origem.spots[i];

        var existe = false;

        for (var j = 0; j < destino.spots.length; j++) {

            if (destino.spots[j].name == spotOrigem.name) {
                existe = true;
                break;
            }
        }

        if (existe) continue;

        try {

            var novaSpot = destino.spots.add();

            novaSpot.name = spotOrigem.name;
            novaSpot.colorType = spotOrigem.colorType;
            novaSpot.color = spotOrigem.color;

        } catch (e) {

        }
    }
}

// ======================================
// LOOP
// ======================================

for (var i = 0; i < quantidadeDocumentos; i++) {

    // ==========================
    // CRIA NOVO DOCUMENTO
    // ==========================

    var novoDoc = app.documents.add(
        docOriginal.documentColorSpace,
        docOriginal.width,
        docOriginal.height
    );

    novoDoc.rulerUnits = docOriginal.rulerUnits;

    // Nome que você quiser usar depois
    var nomeDocumento = nomesDocumentos[i];

    novoDoc.name = nomeDocumento;

    // ==========================
    // COPIA TUDO DO ORIGINAL
    // ==========================

    app.activeDocument = docOriginal;

    docOriginal.selectObjectsOnActiveArtboard();

    app.copy();

    app.activeDocument = novoDoc;

    app.paste();

    copiarSpots(
        docOriginal,
        novoDoc
    );

    try {

        for (var l = novoDoc.layers.length - 1; l >= 0; l--) {

            var layer = novoDoc.layers[l];

            if (
                layer.pageItems.length === 0 &&
                novoDoc.layers.length > 1
            ) {
                layer.remove();
            }
        }

    } catch (e) {}

    // Mapping global (cliente, OS, descrição, etc)
    replaceInTextFrames(novoDoc, mapping);
    replaceInLayerAndArtboardNames(novoDoc, mapping);

    // Mapping individual da separação
    var mappingCor = {
        "cor": cores[i]
    };

    replaceInTextFrames(novoDoc, mappingCor);
    replaceInLayerAndArtboardNames(novoDoc, mappingCor);

    substituirSpotCor(
        novoDoc,
        cores[i]
    );

    // Definir o local do desktop
    var pastaNoDesktop = "~/Desktop/" + produtoComUnderline + "/montado/";

    // Criar uma instância de IllustratorSaveOptions
    var opcoesSalvamento = new IllustratorSaveOptions();

    opcoesSalvamento.compatibility = Compatibility.ILLUSTRATOR24;
    opcoesSalvamento.pdfCompatible = true;
    opcoesSalvamento.embedICCProfile = false;
    opcoesSalvamento.embedLinkedFiles = false;
    opcoesSalvamento.compressed = false;

    // Salvar arquivo
    var arquivoAI = new File(
        pastaNoDesktop +
        nomeDocumento +
        ".ai"
    );

    novoDoc.saveAs(
        arquivoAI,
        opcoesSalvamento
    );
}
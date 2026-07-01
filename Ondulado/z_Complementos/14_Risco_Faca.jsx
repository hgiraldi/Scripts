#include "Xml_upload.jsx"

// cabVal(fn): valor da funcao; se a variavel faltar na O.S. (ou der QUALQUER erro) -> ""
// (vazio). Evita que "variavel faltando" (ex.: O.S. sem onda) pare o script -> o campo
// do cabecalho fica em branco e o Risco segue normal. Mesma logica do Preenchimento.
function cabVal(fn) {
    try {
        var r = fn();
        return (r === undefined || r === null) ? "" : r;
    } catch (e) {
        return "";
    }
}

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


// primeiras 2 palavras de um texto (ex.: "GOPPFER 657 xpto" -> "GOPPFER 657")
function primeirasDuasPalavras(txt) {
    var s = String(txt).replace(/^\s+/, "");
    var p = s.split(/\s+/);
    if (p.length >= 2) return p[0] + " " + p[1];
    return p[0];
}

// se o frame continha [[ref]]/[[descr]]/[[maq]], ACHATA horizontalmente p/ caber na
// largura maxima (35/30/16mm) mantendo a altura. So achata (escala < 100), nunca aumenta.
function achatarSeNecessario(frame, original) {
    var maxW = 0;
    if (/\[\[ref\]\]/.test(original)) maxW = mmToPt(35);
    else if (/\[\[descr\]\]/.test(original)) maxW = mmToPt(30);
    else if (/\[\[maq\]\]/.test(original)) maxW = mmToPt(16);
    if (maxW <= 0) return;
    try {
        var w = frame.width;
        if (w > maxW) frame.textRange.characterAttributes.horizontalScale = (maxW / w) * 100;
    } catch (e) {}
}

function replaceInTextFrames(doc, map, achatar) {
    var countReplaced = 0;
    var tf = doc.textFrames;
    for (var i = 0; i < tf.length; i++) {
        try {
            var original = tf[i].contents;
            var replaced = replaceTokensInString(original, map);
            if (replaced !== original) {
                tf[i].contents = replaced;
                countReplaced++;
                if (achatar) achatarSeNecessario(tf[i], original);
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

// Retorna a layer "Cotas"; cria caso nao exista. Reutiliza getLayerByName
// (case-insensitive) para evitar layers duplicadas.
function ensureLayerCotas(doc) {
    var layer = getLayerByName(doc, "cotas");
    if (!layer) {
        layer = doc.layers.add();
        layer.name = "cotas";
    }
    return layer;
}

function getFirstItem(layer) {
    if (layer.pageItems.length > 0) {
        return layer.pageItems[0];
    }
    return null;
}

function getFacaBounds(layer) {
    // Uniao dos geometricBounds dos itens da faca, SEM duplicar/agrupar (rapido).
    // Resultado identico ao geometricBounds de um grupo com esses itens.
    var b = null;
    for (var i = 0; i < layer.pageItems.length; i++) {
        var gb;
        try { gb = layer.pageItems[i].geometricBounds; } catch (e) { continue; }
        if (!b) {
            b = [gb[0], gb[1], gb[2], gb[3]];
        } else {
            if (gb[0] < b[0]) b[0] = gb[0]; // left  (min)
            if (gb[1] > b[1]) b[1] = gb[1]; // top   (max)
            if (gb[2] > b[2]) b[2] = gb[2]; // right (max)
            if (gb[3] < b[3]) b[3] = gb[3]; // bottom(min)
        }
    }
    return b;
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

   /* alert(
        "ENTRADA X: " + dados_poliester.entrada.x +
        "\nENTRADA Y: " + dados_poliester.entrada.y +
        "\nALTURA ENTRADA: " + dados_poliester.entrada.altura +
        "\n\nCENTRO X: " + dados_poliester.centro.x +
        "\nCENTRO Y: " + dados_poliester.centro.y +
        "\n\nFACA LARGURA: " + dados_poliester.faca.largura +
        "\nFACA ALTURA: " + dados_poliester.faca.altura +
        "\nFACA X: " + dados_poliester.faca.x +
        "\nFACA Y: " + dados_poliester.faca.y
    );*/

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

//===================Etiqueta Centro=====================//
// A etiqueta de centro NAO e mais place+embed (o place perdia as justificacoes
// de paragrafo). Agora e montada por cor, abrindo etiqueta_centro.ai dentro do
// loop de separacao (ver criarEtiquetaCentro). Vale para todos os clientes.


//=================== Cuidados Cliche ====================//
// Place do cuidadosCliche.pdf na layer "cotas". Sem mapping e sem resize.
// Posicao depende da altura da entrada de maquina:
//   - entrada >= 100mm: 20mm ABAIXO da faca, alinhado a direita da faca
//                       (borda direita do objeto = borda direita da faca, para dentro).
//   - entrada <  100mm: 40mm ACIMA da faca, centralizado na linha de 3/4 da
//                       largura da faca (entre o meio e a lateral direita).

// Clientes (nao-Penha) que usam a "etiqueta de cor" e que forcam o qrCode e o
// cuidadosCliche sempre no padrao "entrada < 100mm" (em cima da faca).
var clientesEtiquetaCor = ["artivinco_itatiba", "artivinco_santa_rosa", "somar_papelao"];
var folderLowerCor = String(folder).toLowerCase();
var isClienteCor = false;
for (var icc = 0; icc < clientesEtiquetaCor.length; icc++) {
    if (folderLowerCor === clientesEtiquetaCor[icc]) { isClienteCor = true; break; }
}

// Cria os PDFs auxiliares (cuidadosCliche, qrCode, logo_alpha, nao_pise e o
// logo do cliente) na layer "cotas" do 'doc' alvo e agrupa em "PDFS_AUX".
// O parametro chama-se 'doc' de proposito (sombreia o global), para os blocos
// abaixo continuarem usando 'doc' = documento alvo sem reescrever nada.
// Chamada na 1a cor; nas demais o grupo e copiado (ver copiarGrupoPorNome).
function criarPdfsAuxiliares(doc) {

// Posiciona os PDFs pela faca/centro REAIS deste documento. O clone centraliza
// o conteudo, entao a faca fica em posicao diferente da do docOriginal; usar
// resultado.facaBounds (coords do original) jogaria os PDFs para o lugar errado.
var fbAux = getFacaBoundsNoDoc(doc);
var centroXAux = getCentroXNoDoc(doc);

var pdfFilePathCuidados = scriptDirectory + '/z_pdfs/cuidadosCliche.pdf';
var pdfCuidados = new File(pdfFilePathCuidados);

var cuidadosCliche = doc.placedItems.add();
cuidadosCliche.file = pdfCuidados;
cuidadosCliche.name = "Cuidados_cliche";

// Bounds da faca (em pontos): [left, top, right, bottom]
var fbCuid = fbAux;
var facaLeftPt = fbCuid[0];
var facaTopPt = fbCuid[1];
var facaRightPt = fbCuid[2];
var facaBottomPt = fbCuid[3];

// Tamanho nativo do objeto colocado (em pontos) - nao redimensiona
var cuidBounds = cuidadosCliche.geometricBounds;
var cuidLargura = cuidBounds[2] - cuidBounds[0];
var cuidAltura = cuidBounds[1] - cuidBounds[3];

if (isPenha || (!isClienteCor && parseFloat(resultado.dados.entrada.altura) >= 100)) {
    // ABAIXO da faca: topo do objeto 20mm abaixo da base da faca
    cuidadosCliche.top = facaBottomPt - mmToPt(20);
    // Alinhado a direita da faca (borda direita coincide com a da faca)
    cuidadosCliche.left = facaRightPt - cuidLargura;
} else {
    // ACIMA da faca: base do objeto 40mm acima do topo da faca
    cuidadosCliche.top = facaTopPt + mmToPt(40) + cuidAltura;
    // Centralizado na linha de 3/4 da largura da faca (entre o meio e a direita)
    var linhaTresQuartos = facaLeftPt + (facaRightPt - facaLeftPt) * 0.75;
    cuidadosCliche.left = linhaTresQuartos - (cuidLargura / 2);
}

// Flip horizontal (igual a etiqueta centro)
cuidadosCliche.resize(-100, 100);

// Move para a layer "cotas" (cria se nao existir) ANTES do embed.
var layerCotasCuid = ensureLayerCotas(doc);
cuidadosCliche.move(layerCotasCuid, ElementPlacement.PLACEATBEGINNING);

cuidadosCliche.embed();


//===================== QR Code =========================//
// Place do qrCode.pdf na layer "cotas". Sem mapping e sem resize.
// Posicao depende da altura da entrada de maquina:
//   - entrada >= 100mm: 20mm ABAIXO da faca, alinhado a esquerda da faca
//                       (borda esquerda do objeto = borda esquerda da faca).
//   - entrada <  100mm: 40mm ACIMA da faca, centralizado na linha de 1/4 da
//                       largura da faca (entre o meio e a lateral esquerda).

var pdfFilePathQr = scriptDirectory + '/z_pdfs/qrCode.pdf';
var pdfQr = new File(pdfFilePathQr);

var qrCode = doc.placedItems.add();
qrCode.file = pdfQr;
qrCode.name = "QR_code";

// Bounds da faca (em pontos): [left, top, right, bottom]
var fbQr = fbAux;
var facaLeftPtQr = fbQr[0];
var facaTopPtQr = fbQr[1];
var facaRightPtQr = fbQr[2];
var facaBottomPtQr = fbQr[3];

// Tamanho nativo do objeto colocado (em pontos) - nao redimensiona
var qrBounds = qrCode.geometricBounds;
var qrLargura = qrBounds[2] - qrBounds[0];
var qrAltura = qrBounds[1] - qrBounds[3];

if (isPenha || (!isClienteCor && parseFloat(resultado.dados.entrada.altura) >= 100)) {
    // ABAIXO da faca: topo do objeto 20mm abaixo da base da faca
    qrCode.top = facaBottomPtQr - mmToPt(20);
    // Alinhado a esquerda da faca (borda esquerda coincide com a da faca)
    qrCode.left = facaLeftPtQr;
} else {
    // ACIMA da faca: base do objeto 40mm acima do topo da faca
    qrCode.top = facaTopPtQr + mmToPt(40) + qrAltura;
    // Centralizado na linha de 1/4 da largura da faca (entre o meio e a esquerda)
    var linhaUmQuarto = facaLeftPtQr + (facaRightPtQr - facaLeftPtQr) * 0.25;
    qrCode.left = linhaUmQuarto - (qrLargura / 2);
}

// Flip horizontal (igual a etiqueta centro)
qrCode.resize(-100, 100);

// Move para a layer "cotas" (cria se nao existir) ANTES do embed.
var layerCotasQr = ensureLayerCotas(doc);
qrCode.move(layerCotasQr, ElementPlacement.PLACEATBEGINNING);

qrCode.embed();


//==================== Logo Alpha =======================//
// Place do logo_alpha.pdf na layer "cotas". Sem mapping e sem resize de escala.
// Posicao FIXA (nao depende da entrada): 40mm ACIMA da faca, alinhado a direita.
// Tambem espelha (flip horizontal), igual aos demais.

var pdfFilePathLogo = scriptDirectory + '/z_pdfs/logo_alpha.pdf';
var pdfLogo = new File(pdfFilePathLogo);

var logoAlpha = doc.placedItems.add();
logoAlpha.file = pdfLogo;
logoAlpha.name = "Logo_alpha";

// Bounds da faca (em pontos): [left, top, right, bottom]
var fbLogo = fbAux;
var facaTopPtLogo = fbLogo[1];
var facaRightPtLogo = fbLogo[2];

// Tamanho nativo do objeto colocado (em pontos) - nao redimensiona
var logoBounds = logoAlpha.geometricBounds;
var logoLargura = logoBounds[2] - logoBounds[0];
var logoAltura = logoBounds[1] - logoBounds[3];

// ACIMA da faca: base do objeto 40mm acima do topo da faca
logoAlpha.top = facaTopPtLogo + mmToPt(40) + logoAltura;
// Alinhado a direita da faca (borda direita coincide com a da faca)
logoAlpha.left = facaRightPtLogo - logoLargura;

// Flip horizontal (igual a etiqueta centro)
logoAlpha.resize(-100, 100);

// Move para a layer "cotas" (cria se nao existir) ANTES do embed.
var layerCotasLogo = ensureLayerCotas(doc);
logoAlpha.move(layerCotasLogo, ElementPlacement.PLACEATBEGINNING);

logoAlpha.embed();


//==================== Nao Pise =========================//
// Place do nao_pise.pdf na layer "cotas". Sem mapping e sem resize de escala.
// Posicao FIXA (todas as ocasioes): 40mm ACIMA da faca, centralizado no "centro".
// Sem flip (nao solicitado).

// Largura da faca (mm) decide a versao: < 840mm usa o nao_pise_menor.
var larguraFacaMmNaoPise = ptToMm(fbAux[2] - fbAux[0]);
var nomeArqNaoPise = (larguraFacaMmNaoPise < 840) ? 'nao_pise_menor.pdf' : 'nao_pise.pdf';
var pdfFilePathNaoPise = scriptDirectory + '/z_pdfs/' + nomeArqNaoPise;
var pdfNaoPise = new File(pdfFilePathNaoPise);

var naoPise = doc.placedItems.add();
naoPise.file = pdfNaoPise;
naoPise.name = "Nao_pise";

// Bounds da faca (em pontos): [left, top, right, bottom]
var fbNaoPise = fbAux;
var facaTopPtNaoPise = fbNaoPise[1];

// Tamanho nativo do objeto colocado (em pontos) - nao redimensiona
var naoPiseBounds = naoPise.geometricBounds;
var naoPiseLargura = naoPiseBounds[2] - naoPiseBounds[0];
var naoPiseAltura = naoPiseBounds[1] - naoPiseBounds[3];

// ACIMA da faca: base do objeto 40mm acima do topo da faca
naoPise.top = facaTopPtNaoPise + mmToPt(40) + naoPiseAltura;
// Centralizado no eixo X do "centro"
var centroXNaoPise = centroXAux;
naoPise.left = centroXNaoPise - (naoPiseLargura / 2);

// Flip horizontal (igual a etiqueta centro)
naoPise.resize(-100, 100);

// Move para a layer "cotas" (cria se nao existir) ANTES do embed.
var layerCotasNaoPise = ensureLayerCotas(doc);
naoPise.move(layerCotasNaoPise, ElementPlacement.PLACEATBEGINNING);

naoPise.embed();


//================= Logo do Cliente =====================//
// Place do logo do cliente (SOMENTE se existir) na layer "cotas".
// Convencao: arquivo em z_pdfs/logos/ com o nome logo_<folder>.pdf
//   (ex.: cliente Penha -> folder "penha_sa" -> logo_penha_sa.pdf).
// Se o arquivo nao existir (cliente sem logo) ou a pasta nao existir,
// File.exists retorna false e nada e colocado - falha segura.
// Posicao FIXA: 40mm ACIMA da faca, alinhado a esquerda da faca. Espelhado.

var nomeLogoCliente = "logo_" + String(folder).toLowerCase() + ".pdf";
var pdfFilePathLogoCliente = scriptDirectory + '/z_pdfs/logos/' + nomeLogoCliente;
var pdfLogoCliente = new File(pdfFilePathLogoCliente);

if (pdfLogoCliente.exists) {

    var logoCliente = doc.placedItems.add();
    logoCliente.file = pdfLogoCliente;
    logoCliente.name = "Logo_cliente";

    // Bounds da faca (em pontos): [left, top, right, bottom]
    var fbLogoCli = fbAux;
    var facaTopPtLogoCli = fbLogoCli[1];
    var facaLeftPtLogoCli = fbLogoCli[0];

    // Tamanho nativo do objeto colocado (em pontos) - nao redimensiona
    var logoCliBounds = logoCliente.geometricBounds;
    var logoCliAltura = logoCliBounds[1] - logoCliBounds[3];

    // ACIMA da faca: base do objeto 40mm acima do topo da faca
    logoCliente.top = facaTopPtLogoCli + mmToPt(40) + logoCliAltura;
    // Alinhado a esquerda da faca (borda esquerda coincide com a da faca)
    logoCliente.left = facaLeftPtLogoCli;

    // Flip horizontal (igual aos demais)
    logoCliente.resize(-100, 100);

    // Move para a layer "cotas" (cria se nao existir) ANTES do embed.
    var layerCotasLogoCli = ensureLayerCotas(doc);
    logoCliente.move(layerCotasLogoCli, ElementPlacement.PLACEATBEGINNING);

    logoCliente.embed();
}

    // Agrupa tudo que esta na cotas agora (somente os PDFs auxiliares) em um
    // grupo "PDFS_AUX", para poder copiar como unidade nas outras cores.
    var lcAux = ensureLayerCotas(doc);
    var itensAux = [];
    for (var gi = 0; gi < lcAux.pageItems.length; gi++) {
        itensAux.push(lcAux.pageItems[gi]);
    }
    if (itensAux.length > 0) {
        var grupoAux = lcAux.groupItems.add();
        grupoAux.name = "PDFS_AUX";
        for (var gm = 0; gm < itensAux.length; gm++) {
            try { itensAux[gm].move(grupoAux, ElementPlacement.PLACEATEND); } catch (e) {}
        }
    }
}

// Copia o grupo 'nomeGrupo' de 'origem' para 'destino' preservando a posicao
// (copy/paste com Paste Remembers Layers), com retry contra a falha do clipboard.
function copiarGrupoPorNome(origem, destino, nomeGrupo) {
    var alvo = null;
    for (var bi = 0; bi < origem.pageItems.length; bi++) {
        if (origem.pageItems[bi].name === nomeGrupo) {
            alvo = origem.pageItems[bi];
            break;
        }
    }
    if (!alvo) return false;

    // Offset do grupo em relacao a faca NA ORIGEM (1a cor).
    var fbOrig = getFacaBoundsNoDoc(origem);
    var gbOrig = alvo.geometricBounds; // [left, top, right, bottom]
    var deltaLeft = gbOrig[0] - fbOrig[0];
    var deltaTop = gbOrig[1] - fbOrig[1];

    // Duplica DIRETO entre documentos (sem clipboard). O copy/paste falhava de
    // forma intermitente (1 cor saia sem os PDFs). Como e um unico grupo, e
    // rapido; a posicao perdida no duplicate e corrigida logo abaixo
    // reposicionando o grupo relativo a faca do destino.
    var layerCotasDest = ensureLayerCotas(destino);
    var prevUIL = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    var colado = null;
    try {
        colado = alvo.duplicate(layerCotasDest, ElementPlacement.PLACEATEND);
    } catch (e) {}
    app.userInteractionLevel = prevUIL;

    if (!colado) return false;

    // Reposiciona relativo a faca do destino (mesmo offset da origem)
    var fbDest = getFacaBoundsNoDoc(destino);
    colado.left = fbDest[0] + deltaLeft;
    colado.top = fbDest[1] + deltaTop;
    return true;
}


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
    //alert("ARQUIVO DE UMA COR, NÃO PRECISA DE SEPARAÇÃO")
}

var partesNome = (typeof resultadoOperadorNome !== "undefined" && resultadoOperadorNome)
    ? String(resultadoOperadorNome).split(" ") : [];

// cada valor passa pelo cabVal(...) -> se faltar na O.S. (ex.: onda), fica vazio.
var mapping = {
    "cliente": cabVal(function(){ return cliente; }),
    "ref": cabVal(function(){ return ref; }),
    "descr": cabVal(function(){ return clienteOnd; }),
    "medint": cabVal(function(){ return medInt; }),
    "fi": cabVal(function(){ return np; }),
    "Cor1": cabVal(function(){ return cores[0]; }),
    "Cor2": cabVal(function(){ return cores[1]; }),
    "Cor3": cabVal(function(){ return cores[2]; }),
    "Cor4": cabVal(function(){ return cores[3]; }),
    "Cor5": cabVal(function(){ return cores[4]; }),
    "Cor6": cabVal(function(){ return cores[5]; }),
    "data": cabVal(function(){ return getDataAtualFormatada(); }),
    "rep": cabVal(function(){ return repetitions; }),
    "pist": cabVal(function(){ return lanes; }),
    "onda": cabVal(function(){ return onda; }),
    "os": cabVal(function(){ return serviceOrderNumber; }),
    "esp": cabVal(function(){ return espessura; }),
    "cp": cabVal(function(){ return cp; }),
    "rev": cabVal(function(){ return rev.split("v")[1]; }),
    "v": cabVal(function(){ return v.split("v")[1]; }),
    "q": cabVal(function(){ return q; }),
    "maq": cabVal(function(){ return maquina ? primeirasDuasPalavras(maquina) : ""; }),
    "operador": cabVal(function(){ return partesNome.slice(0, 2).join(" "); })
};

var doc = app.activeDocument;
remapSpotsPorArray(doc, cores);

mainMap();


// ============================================================
// FASE 1 - RISCOS POR GRUPO DA LAYER "arte"
// Para cada grupo da arte: acha a cor predominante (spot mais frequente em
// fill/stroke, ignorando branco/none) e cria um quadrado de contorno nessa cor
// na layer "cut" (margens informadas). Roda em docOriginal antes do loop, entao
// os quadrados sao clonados para cada separacao. Nomeados "RISCO_<cor>" para
// facilitar copiar so os da cor certa em cada risco depois.
// ============================================================

// --- nome de cor TECNICA que deve ser ignorada (none/registro). Branco/white
// NAO entram aqui: so sao ignorados se o VALOR for 0,0,0,0 (ver spotEhBranco). ---
function corEhBrancoNome(nome) {
    var n = String(nome).toLowerCase();
    return (n === "none" || n === "[none]" ||
            n === "[registration]" || n === "[registro]");
}

// --- spot cuja cor e branca (CMYK 0/0/0/0 ou Gray 0) deve ser ignorada ---
function spotEhBranco(spot) {
    try {
        var c = spot.color;
        if (c && c.typename === "CMYKColor" &&
            c.cyan === 0 && c.magenta === 0 && c.yellow === 0 && c.black === 0) return true;
        if (c && c.typename === "GrayColor" && c.gray === 0) return true;
    } catch (e) {}
    return false;
}

// --- cromia PURA: exatamente um canal = 100 e o resto = 0 (tolerancia 1%).
// Mapeia para o nome canonico da separacao (black/cyan/magenta/yellow). E o
// quadrado que o operador pinta (ex.: preto = 0,0,0,100 -> "black"). ---
function aproxCromia(v, alvo) {
    return Math.abs(v - alvo) < 1;
}

function corCromiaPura(cor) {
    if (!cor || cor.typename !== "CMYKColor") return null;
    var c = cor.cyan, m = cor.magenta, y = cor.yellow, k = cor.black;
    if (aproxCromia(c, 100) && aproxCromia(m, 0) && aproxCromia(y, 0) && aproxCromia(k, 0)) return "cyan";
    if (aproxCromia(m, 100) && aproxCromia(c, 0) && aproxCromia(y, 0) && aproxCromia(k, 0)) return "magenta";
    if (aproxCromia(y, 100) && aproxCromia(c, 0) && aproxCromia(m, 0) && aproxCromia(k, 0)) return "yellow";
    if (aproxCromia(k, 100) && aproxCromia(c, 0) && aproxCromia(m, 0) && aproxCromia(y, 0)) return "black";
    return null;
}

function ehNomeCromia(nome) {
    return (nome === "black" || nome === "cyan" || nome === "magenta" || nome === "yellow");
}

// CMYKColor da separacao de cromia (black -> 0,0,0,100, etc.).
function cmykDaCromia(cromiaNome) {
    var c = new CMYKColor();
    c.cyan = 0; c.magenta = 0; c.yellow = 0; c.black = 0;
    if (cromiaNome === "cyan") c.cyan = 100;
    else if (cromiaNome === "magenta") c.magenta = 100;
    else if (cromiaNome === "yellow") c.yellow = 100;
    else if (cromiaNome === "black") c.black = 100;
    return c;
}

function melhorDaContagem(contagem) {
    var melhor = null, maxC = 0;
    for (var nome in contagem) {
        if (contagem.hasOwnProperty(nome) && contagem[nome] > maxC) {
            maxC = contagem[nome];
            melhor = nome;
        }
    }
    return melhor;
}

// --- cor predominante de um grupo: a spot mais frequente em fill+stroke. Se NAO
// houver spot, cai para a cromia pura mais frequente (black/cyan/...). Spot SEMPRE
// tem prioridade para nao mudar o que ja funcionava. ---
function corPredominanteDoGrupo(grupo) {
    var contagemSpot = {};
    var contagemCromia = {};

    function conta(cor) {
        if (!cor) return;
        if (cor.typename === "SpotColor" && cor.spot) {
            var nm = cor.spot.name;
            if (corEhBrancoNome(nm)) return;
            if (spotEhBranco(cor.spot)) return;
            contagemSpot[nm] = (contagemSpot[nm] || 0) + 1;
            return;
        }
        var crom = corCromiaPura(cor);
        if (crom) contagemCromia[crom] = (contagemCromia[crom] || 0) + 1;
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

    var melhorSpot = melhorDaContagem(contagemSpot);
    if (melhorSpot) return melhorSpot;
    return melhorDaContagem(contagemCromia);
}

// cor p/ pintar registro+cut a partir do nome predominante:
//  - spot existente -> SpotColor (tint 100). Cobre pantones e as spots de cromia
//    que o RemapCores cria (black1, cyan1...).
//  - cromia pura sem spot (black/cyan/magenta/yellow) -> CMYKColor puro, p/ a
//    cromia seguir como cor normal (registro + cut). null -> pula o grupo.
function corDoGrupo(doc, nomeCor) {
    try {
        var sc = new SpotColor();
        sc.spot = doc.spots.getByName(nomeCor);
        sc.tint = 100;
        return sc;
    } catch (e) {}
    if (ehNomeCromia(nomeCor)) return cmykDaCromia(nomeCor);
    return null;
}

// --- bounds visiveis de um objeto/grupo (trata grupo, clip e compound) ---
function getVisibleBounds(object) {
    var bounds, clippedItem, sandboxItem, sandboxLayer, curItem;

    if (object.guides) return undefined;

    if (object.typename == "GroupItem") {
        if (!object.pageItems || object.pageItems.length == 0) return undefined;

        if (object.clipped) {
            for (var i = 0; i < object.pageItems.length; i++) {
                curItem = object.pageItems[i];
                if (curItem.clipping) { clippedItem = curItem; break; }
                else if (curItem.typename == "CompoundPathItem") {
                    if (!curItem.pathItems.length) {
                        sandboxLayer = app.activeDocument.layers.add();
                        sandboxItem = curItem.duplicate(sandboxLayer);
                        app.activeDocument.selection = null;
                        sandboxItem.selected = true;
                        app.executeMenuCommand("noCompoundPath");
                        sandboxLayer.hasSelectedArtwork = true;
                        app.executeMenuCommand("group");
                        clippedItem = app.activeDocument.selection[0];
                        break;
                    } else if (curItem.pathItems[0].clipping) { clippedItem = curItem; break; }
                }
            }
            if (!clippedItem) clippedItem = object.pageItems[0];
            bounds = clippedItem.visibleBounds;
            if (sandboxLayer) { sandboxLayer.remove(); sandboxLayer = undefined; }
        } else {
            var subObjectBounds;
            var allBoundPoints = [[], [], [], []];
            for (var k = 0; k < object.pageItems.length; k++) {
                curItem = object.pageItems[k];
                subObjectBounds = getVisibleBounds(curItem);
                if (!subObjectBounds) continue;
                allBoundPoints[0].push(subObjectBounds[0]);
                allBoundPoints[1].push(subObjectBounds[1]);
                allBoundPoints[2].push(subObjectBounds[2]);
                allBoundPoints[3].push(subObjectBounds[3]);
            }
            if (!allBoundPoints[0].length) return undefined;
            bounds = [
                Math.min.apply(Math, allBoundPoints[0]),
                Math.max.apply(Math, allBoundPoints[1]),
                Math.max.apply(Math, allBoundPoints[2]),
                Math.min.apply(Math, allBoundPoints[3])
            ];
        }
    } else {
        bounds = object.visibleBounds;
    }
    return bounds;
}

// --- dialogo: escolher a layer da arte quando "arte" nao existe ---
function escolherLayerArteDialog(doc) {
    var win = new Window("dialog", "Layer 'arte' nao encontrada");
    win.orientation = "column";
    win.alignChildren = "fill";
    win.margins = 16;
    win.spacing = 10;
    win.add("statictext", undefined, "A layer 'arte' nao foi encontrada.");
    win.add("statictext", undefined, "Selecione a layer que contem a arte:");
    var dd = win.add("dropdownlist");
    for (var i = 0; i < doc.layers.length; i++) dd.add("item", doc.layers[i].name);
    if (dd.items.length > 0) dd.selection = 0;
    var grp = win.add("group");
    grp.alignment = "right";
    grp.add("button", undefined, "Cancelar", { name: "cancel" });
    grp.add("button", undefined, "OK", { name: "ok" });
    if (win.show() !== 1 || !dd.selection) return null;
    return doc.layers[dd.selection.index];
}

// --- dialogo: 4 margens (mm) -> retorna [left, top, right, bottom] em pt ---
function showMarginDialogRiscos() {
    var win = new Window("dialog", "Margem dos riscos");
    win.orientation = "column";
    win.alignChildren = "fill";
    win.margins = 16;
    win.spacing = 10;

    var panel = win.add("panel", undefined, "Margens (mm)");
    panel.orientation = "column";
    panel.alignChildren = "fill";
    panel.margins = 14;
    panel.spacing = 8;

    function linha(label, def) {
        var g = panel.add("group");
        var l = g.add("statictext", undefined, label);
        l.preferredSize.width = 75;
        var e = g.add("edittext", undefined, def);
        e.characters = 8;
        return e;
    }
    var inCima = linha("Cima:", "0");
    var inEsq = linha("Esquerda:", "0");
    var inDir = linha("Direita:", "0");
    var inBaixo = linha("Baixo:", "0");

    var grp = win.add("group");
    grp.alignment = "right";
    grp.add("button", undefined, "Cancelar", { name: "cancel" });
    grp.add("button", undefined, "Criar", { name: "ok" });

    if (win.show() !== 1) return null;

    return [
        mmToPt(parseFloat(inEsq.text) || 0),
        mmToPt(parseFloat(inCima.text) || 0),
        mmToPt(parseFloat(inDir.text) || 0),
        mmToPt(parseFloat(inBaixo.text) || 0)
    ];
}

// --- margens do risco POR CLIENTE (tira a margem do operador) ---
// Le z_Complementos/margens_clientes.json: chave = folder do cliente,
// valor = [cima, esquerda, direita, baixo] em mm. Cliente fora do JSON (ou JSON
// ausente/invalido) usa 6,6,6,6. Retorna no formato interno do cut [left, top,
// right, bottom] em PONTOS. showMarginDialogRiscos fica disponivel como fallback
// manual, mas nao e mais chamado no fluxo normal.
function getMargensCliente() {
    var cima = 6, esq = 6, dir = 6, baixo = 6; // padrao p/ cliente sem entrada

    function numOu(v, def) {
        var n = parseFloat(v);
        return isNaN(n) ? def : n;
    }

    try {
        var f = new File(scriptDirectory + "/z_Complementos/margens_clientes.json");
        if (f.exists) {
            f.encoding = "UTF-8";
            f.open("r");
            var txt = f.read();
            f.close();
            var mapa = eval("(" + txt + ")");
            var v = mapa[String(folder).toLowerCase()];
            if (v && v.length >= 4) {
                cima  = numOu(v[0], 6);
                esq   = numOu(v[1], 6);
                dir   = numOu(v[2], 6);
                baixo = numOu(v[3], 6);
            }
        }
    } catch (e) {}

    // formato interno do cut: [left, top, right, bottom] em pt
    return [mmToPt(esq), mmToPt(cima), mmToPt(dir), mmToPt(baixo)];
}

// --- linha de registro (contorno na cor, overprint); cria na layer e move pro grupo ---
function criaLinhaReg(layer, grupo, x1, y1, x2, y2, cor, stroke) {
    var l = layer.pathItems.add();
    l.setEntirePath([[x1, y1], [x2, y2]]);
    l.stroked = true;
    l.filled = false;
    l.strokeWidth = stroke;
    l.strokeColor = cor;
    l.strokeOverprint = true;
    l.move(grupo, ElementPlacement.PLACEATEND);
    return l;
}

// coleta os geometricBounds dos objetos-folha da arte (para evitar colisao)
// ===== bounds VISIVEL clipado a mascara (copiado da Medicao Ondulado) =====
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

// branco cromia = CMYK 0,0,0,0 (process, sem tinta). SPOT nao entra aqui -> spot conta.
function ehBrancoCromia(cor) {
    if (!cor) return false;
    return (cor.typename === "CMYKColor" && cor.cyan === 0 && cor.magenta === 0 && cor.yellow === 0 && cor.black === 0);
}
// item TEM pintura visivel? fill OU stroke que NAO seja none nem branco cromia 0,0,0,0.
function temPinturaVisivel(it) {
    var f = false, s = false;
    try { f = it.filled && !ehBrancoCromia(it.fillColor); } catch (e) {}
    try { s = it.stroked && !ehBrancoCromia(it.strokeColor); } catch (e) {}
    return f || s;
}

function shouldIgnoreItemByStyle(it) {

    try {
        if (it.opacity === 0) return true;
    } catch (e) {}

    if (it.typename === "PathItem") {
        try {
            // ignora vazio (none) OU so branco cromia 0,0,0,0
            if (!temPinturaVisivel(it)) return true;
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
                    if (temPinturaVisivel(p)) {
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

// bounds da folha INCLUINDO o stroke: geometricBounds engordado por METADE da
// espessura do traco (a "ultima mancha"). NAO usa visibleBounds (que pesa/varia).
function boundsFolhaComStroke(it) {
    var gb = it.geometricBounds; // [left, top, right, bottom]
    var sw = 0;
    try { if (it.stroked && it.strokeWidth) sw = it.strokeWidth / 2; } catch (e) {}
    if (sw > 0) return [gb[0] - sw, gb[1] + sw, gb[2] + sw, gb[3] - sw];
    return gb;
}

// recursao dos bounds. soVisiveis=true -> ignora none/branco cromia 0,0,0,0 no TAMANHO.
function boundsDeep(it, soVisiveis) {

    if (!it || it.hidden || it.locked) return null;

    try {

        if (it.typename === "GroupItem") {

            if (it.clipped) {

                var maskB = findMaskBoundsInGroup(it);
                var childrenB = null;

                for (var j = 0; j < it.pageItems.length; j++) {

                    var child = it.pageItems[j];

                    if (child.typename === "PathItem") {
                        try { if (child.clipping) continue; } catch (e0) {}
                    }

                    if (child.typename === "CompoundPathItem") {
                        var isMask = false;
                        try {
                            for (var kk = 0; kk < child.pathItems.length; kk++) {
                                try { if (child.pathItems[kk].clipping) { isMask = true; break; } } catch (e01) {}
                            }
                        } catch (e02) {}
                        if (isMask) continue;
                    }

                    if (soVisiveis && shouldIgnoreItemByStyle(child) && child.typename !== "GroupItem") continue;

                    childrenB = unionBounds(childrenB, boundsDeep(child, soVisiveis));
                }

                if (!childrenB) return null;
                var inter = intersectBounds(maskB, childrenB);
                return inter ? inter : null;
            }

            var b = null;
            for (var i = 0; i < it.pageItems.length; i++) {
                var child2 = it.pageItems[i];
                if (soVisiveis && shouldIgnoreItemByStyle(child2) && child2.typename !== "GroupItem") continue;
                b = unionBounds(b, boundsDeep(child2, soVisiveis));
            }
            return b;
        }

        if (soVisiveis && shouldIgnoreItemByStyle(it)) return null;

        return boundsFolhaComStroke(it);

    } catch (e) {
        return null;
    }
}

// TAMANHO do grupo pro cut: 1o tenta SO o visivel (ignora none/0,0,0,0, conta stroke).
// Se a exclusao ZERAR o grupo (ex.: dentro da mascara so sobrou 0,0,0,0), FAZ FALLBACK
// e conta tudo (baseline) -> o grupo NUNCA some; so nao soma o invisivel quando da.
function getVisibleBoundsDeep(it) {
    var r = boundsDeep(it, true);
    if (r) return r;
    return boundsDeep(it, false);
}

// coleta os bounds da arte p/ COLISAO, CLIPADOS a mascara: recorta cada item-folha ao
// bounds visivel (intersecta com a mascara acumulada), pula o caminho de mascara e
// itens invisiveis -> registros/label desviam so da arte VISIVEL (nao do que passa
// da mascara). Mantem o mesmo formato [left,top,right,bottom] que a colisao espera.
function coletarBoundsArte(grupo, arr) {
    coletarBoundsArteRec(grupo, arr, null);
}
function coletarBoundsArteRec(grupo, arr, maskAcc) {
    var localMask = maskAcc;
    try {
        if (grupo.typename === "GroupItem" && grupo.clipped) {
            var mb = findMaskBoundsInGroup(grupo);
            localMask = maskAcc ? intersectBounds(maskAcc, mb) : mb;
        }
    } catch (e) {}
    for (var i = 0; i < grupo.pageItems.length; i++) {
        var it = grupo.pageItems[i];
        if (it.typename === "GroupItem") {
            coletarBoundsArteRec(it, arr, localMask);
        } else {
            // pula o caminho de mascara (clipping) e itens invisiveis
            var ehMascara = false;
            try { ehMascara = (it.clipping === true); } catch (e) {}
            if (!ehMascara && it.typename === "CompoundPathItem") {
                try {
                    for (var k = 0; k < it.pathItems.length; k++) {
                        if (it.pathItems[k].clipping) { ehMascara = true; break; }
                    }
                } catch (e) {}
            }
            if (ehMascara) continue;
            if (shouldIgnoreItemByStyle(it)) continue;
            try {
                var gb = it.geometricBounds;
                var vis = localMask ? intersectBounds(localMask, gb) : gb;
                if (vis) arr.push(vis);
            } catch (e) {}
        }
    }
}

function embaralhar(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
}

// a caixa [cx +- raio, cy +- raio] colide com algum bounds de arte?
// ===== INDICE ESPACIAL p/ colisao com a arte (performance) =====
// boundsArte de uma arte detalhada tem MILHARES de retangulos; cada checagem de
// posicao varria a lista INTEIRA (era o gargalo do PASSO 3). O indice agrupa os
// bounds em CELULAS de grade -> a checagem so olha as celulas PERTO da marca.
// Resultado IDENTICO ao scan linear (lossless), ordens de magnitude mais rapido.
// O indice e cacheado no proprio array (arr._idx) e reusado nas checagens do grupo.
function criarIndiceBounds(arr, cell) {
    var mapa = {}, grandes = [];
    for (var i = 0; i < arr.length; i++) {
        var b = arr[i]; // [left, top, right, bottom]  (top > bottom)
        var c0 = Math.floor(b[0] / cell), c1 = Math.floor(b[2] / cell);
        var r0 = Math.floor(b[3] / cell), r1 = Math.floor(b[1] / cell);
        // bound GRANDE (cobre muitas celulas) vai pra lista fixa (sempre checada),
        // p/ nao inchar o mapa. Sao poucos (fundos, formas cheias).
        if ((c1 - c0) > 4 || (r1 - r0) > 4) { grandes.push(b); continue; }
        for (var cx = c0; cx <= c1; cx++) {
            for (var ry = r0; ry <= r1; ry++) {
                var k = cx + "_" + ry;
                if (!mapa[k]) mapa[k] = [];
                mapa[k].push(b);
            }
        }
    }
    return { cell: cell, mapa: mapa, grandes: grandes };
}

// indice cacheado no array; so vale a pena indexar listas grandes.
function idxDe(arr) {
    if (!arr || arr.length < 64) return null; // pequeno: scan linear ja e rapido
    if (!arr._idx) arr._idx = criarIndiceBounds(arr, mmToPt(5));
    return arr._idx;
}

// algum bound do indice sobrepoe a caixa-query [qL,qT,qR,qB] (top > bottom)?
// Lossless: se b sobrepoe a query, eles compartilham >=1 celula -> b e testado.
function indiceColide(idx, qL, qT, qR, qB) {
    var i, b;
    for (i = 0; i < idx.grandes.length; i++) {
        b = idx.grandes[i];
        if (qL < b[2] && qR > b[0] && qB < b[1] && qT > b[3]) return true;
    }
    var cell = idx.cell, mapa = idx.mapa;
    var c0 = Math.floor(qL / cell), c1 = Math.floor(qR / cell);
    var r0 = Math.floor(qB / cell), r1 = Math.floor(qT / cell);
    for (var cx = c0; cx <= c1; cx++) {
        for (var ry = r0; ry <= r1; ry++) {
            var arr = mapa[cx + "_" + ry];
            if (!arr) continue;
            for (var j = 0; j < arr.length; j++) {
                b = arr[j];
                if (qL < b[2] && qR > b[0] && qB < b[1] && qT > b[3]) return true;
            }
        }
    }
    return false;
}

// a caixa [cx +- raio, cy +- raio] colide com algum bounds de arte?
function caixaColideArte(cx, cy, raio, boundsArte) {
    var mL = cx - raio, mR = cx + raio, mT = cy + raio, mB = cy - raio;
    var idx = idxDe(boundsArte);
    if (idx) return indiceColide(idx, mL, mT, mR, mB);
    for (var i = 0; i < boundsArte.length; i++) {
        var b = boundsArte[i]; // [left, top, right, bottom]
        if (mL < b[2] && mR > b[0] && mB < b[1] && mT > b[3]) return true;
    }
    return false;
}

// acha posicao livre p/ a marca perto de um lado; DENTRO do vb se possivel,
// senao logo FORA (o cut cresce depois). lado: "topo","base","esq","dir".
function acharPosMarca(vb, boundsArte, raio, markHalf, lado) {
    var left = vb[0], top = vb[1], right = vb[2], bottom = vb[3];
    var passos = 6;
    var cands = [];
    var i, j;

    if (lado === "topo" || lado === "base") {
        var yIni = (lado === "topo") ? (top - markHalf) : (bottom + markHalf);
        var yFim = (top + bottom) / 2;
        var passoY = (yFim - yIni) / passos;
        var xs = [];
        for (j = 0; j <= passos; j++) {
            xs.push(left + markHalf + (right - left - 2 * markHalf) * (j / passos));
        }
        embaralhar(xs);
        for (i = 0; i <= passos; i++) {
            var cy = yIni + passoY * i;
            for (j = 0; j < xs.length; j++) cands.push([xs[j], cy]);
        }
    } else {
        var xIni = (lado === "esq") ? (left + markHalf) : (right - markHalf);
        var xFim = (left + right) / 2;
        var passoX = (xFim - xIni) / passos;
        var ys = [];
        for (j = 0; j <= passos; j++) {
            ys.push(bottom + markHalf + (top - bottom - 2 * markHalf) * (j / passos));
        }
        embaralhar(ys);
        for (i = 0; i <= passos; i++) {
            var cx = xIni + passoX * i;
            for (j = 0; j < ys.length; j++) cands.push([cx, ys[j]]);
        }
    }

    for (i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (c[0] - markHalf >= left && c[0] + markHalf <= right &&
            c[1] - markHalf >= bottom && c[1] + markHalf <= top) {
            if (!caixaColideArte(c[0], c[1], raio, boundsArte)) return c;
        }
    }

    // nao achou DENTRO -> tenta FORA, preferindo o lado-alvo e EVITANDO colisao
    // (com a propria arte e com os vizinhos, que entram em boundsArte na 3b).
    // nao achou DENTRO -> EMPURRA a marca pra FORA ate ficar livre (nunca em cima
    // da arte/vizinho), preferindo o lado-alvo. raio ja garante a folga de 4mm.
    var lados = [lado, "topo", "base", "esq", "dir"];
    var passo = mmToPt(4);
    for (var f = 0; f < lados.length; f++) {
        for (var d = 0; d < 10; d++) {
            var off = raio + passo * d;
            var pf;
            if (lados[f] === "topo")      pf = [(left + right) / 2, top + off];
            else if (lados[f] === "base") pf = [(left + right) / 2, bottom - off];
            else if (lados[f] === "esq")  pf = [left - off, (top + bottom) / 2];
            else                          pf = [right + off, (top + bottom) / 2];
            if (!caixaColideArte(pf[0], pf[1], raio, boundsArte)) return pf;
        }
    }
    // ultimo recurso (tudo cercado): lado-alvo a 4mm
    if (lado === "topo")  return [(left + right) / 2, top + raio];
    if (lado === "base")  return [(left + right) / 2, bottom - raio];
    if (lado === "esq")   return [left - raio, (top + bottom) / 2];
    return [right + raio, (top + bottom) / 2];
}

// a caixa [L,T,R,B] (L<R, B<T) NAO sobrepoe nenhum bounds de arte (com folga)?
function caixaLivreArte(L, T, R, B, arte, folga) {
    if (!arte) return true;
    var idx = idxDe(arte);
    if (idx) return !indiceColide(idx, L - folga, T + folga, R + folga, B - folga);
    for (var i = 0; i < arte.length; i++) {
        var b = arte[i]; // [left, top, right, bottom]
        if (L - folga < b[2] && R + folga > b[0] && B - folga < b[1] && T + folga > b[3]) return false;
    }
    return true;
}

// posiciona o canto sup-esq do bounds de tf em (L,T) via translate -> funciona mesmo
// com o frame ROTACIONADO (setar .left/.top em texto rotacionado e instavel e pode
// deixar o frame na origem 0,0 -> cut gigante).
function moverTopoEsq(tf, L, T) {
    var gb = tf.geometricBounds; // Illustrator: [left, top, right, bottom]
    tf.translate(L - gb[0], T - gb[1]); // dX = L - left atual ; dY = T - top atual
}

// centraliza o tf no EIXO do "+": vertical -> centro X no pMais[0]; horizontal ->
// centro Y no pMais[1]. Usa o bounds REAL (corrige qualquer desvio da rotacao).
function centralizarNoMais(tf, pMais, vertical) {
    var gb = tf.geometricBounds; // Illustrator: [left, top, right, bottom]
    if (vertical) {
        tf.translate(pMais[0] - (gb[0] + gb[2]) / 2, 0); // centro X = (left+right)/2
    } else {
        tf.translate(0, pMais[1] - (gb[1] + gb[3]) / 2); // centro Y = (top+bottom)/2
    }
}

// expande os bounds da arte∪marcas pelas margens do cut -> area DENTRO do cut onde o
// label pode ficar (inclui a faixa da margem) sem crescer o cut.
function expandirCut(uni) {
    if (!margensCut) return uni;
    return [uni[0] - margensCut[0], uni[1] + margensCut[1], uni[2] + margensCut[2], uni[3] - margensCut[3]];
}

// label (caixa wl x hl) livre? 2mm da ARTE e 0,1mm dos REGISTROS (+/x). A folga e
// medida no BOUNDS VETORIAL do label (curva), nao na fonte.
function labelLivre(L, T, wl, hl, arte, registros) {
    if (!caixaLivreArte(L, T, L + wl, T - hl, arte, mmToPt(2))) return false;
    if (!caixaLivreArte(L, T, L + wl, T - hl, registros, mmToPt(0.1))) return false;
    return true;
}

// a caixa wl x hl com canto sup-esq (L,T) cabe inteira dentro de refB?
function labelDentro(L, T, wl, hl, refB) {
    return !refB || (L >= refB[0] && L + wl <= refB[2] && T <= refB[1] && T - hl >= refB[3]);
}

// tenta o label DO LADO do "+", coladinho (~0,5mm), DENTRO de refB, 2mm da arte e
// 0,5mm dos registros, escolhendo a posicao MAIS DENTRO do bounds. FASE 1 (diagonais
// =false): CARDINAIS -> direita/esquerda DEITADO, cima/baixo EM PE (label segue a
// rotacao). FASE 2 (=true): 4 DIAGONAIS (deitado). Retorna { L, T, vertical } ou null.
function acharPosLabelLado(tf, pMais, markHalf, refB, arte, registros, diagonais) {
    var g = mmToPt(0.1); // folga (no VETOR) da borda do label ate a PONTA do registro (+/x)
    var w0 = tf.width, h0 = tf.height;
    // cada candidato: [L, T, wl, hl, vertical]
    var cands;
    if (!diagonais) {
        cands = [
            [pMais[0] + markHalf + g, pMais[1] + h0 / 2, w0, h0, false],          // direita (deitado)
            [pMais[0] - markHalf - g - w0, pMais[1] + h0 / 2, w0, h0, false],     // esquerda (deitado)
            [pMais[0] - h0 / 2, pMais[1] + markHalf + g + w0, h0, w0, true],      // cima (em pe)
            [pMais[0] - h0 / 2, pMais[1] - markHalf - g, h0, w0, true]            // baixo (em pe)
        ];
    } else {
        cands = [
            [pMais[0] + markHalf + g, pMais[1] - markHalf - g, w0, h0, false],            // baixo-dir
            [pMais[0] - markHalf - g - w0, pMais[1] - markHalf - g, w0, h0, false],       // baixo-esq
            [pMais[0] + markHalf + g, pMais[1] + markHalf + g + h0, w0, h0, false],       // cima-dir
            [pMais[0] - markHalf - g - w0, pMais[1] + markHalf + g + h0, w0, h0, false]   // cima-esq
        ];
    }
    var best = null, bestD = 1e18;
    for (var i = 0; i < cands.length; i++) {
        var L = cands[i][0], T = cands[i][1], wl = cands[i][2], hl = cands[i][3], vert = cands[i][4];
        if (!labelDentro(L, T, wl, hl, refB)) continue;
        if (!labelLivre(L, T, wl, hl, arte, registros)) continue;
        var ccx = L + wl / 2, ccy = T - hl / 2;
        var d = (ccx - pMais[0]) * (ccx - pMais[0]) + (ccy - pMais[1]) * (ccy - pMais[1]); // mais perto do "+"
        if (d < bestD) { bestD = d; best = { L: L, T: T, vertical: vert }; }
    }
    return best;
}

// grid dentro de refB, livre (2mm arte / 0,5mm registros), o mais perto do "+". [L,T] ou null.
function acharPosLabel(tf, pMais, refB, arte, registros) {
    if (!refB) return null;
    var wl = tf.width, hl = tf.height;
    var x0 = refB[0], x1 = refB[2] - wl;
    var y0 = refB[3] + hl, y1 = refB[1];
    if (x1 < x0 || y1 < y0) return null;
    var nx = 14, ny = 14, best = null, bestD = 1e18;
    for (var ix = 0; ix <= nx; ix++) {
        for (var iy = 0; iy <= ny; iy++) {
            var L = x0 + (x1 - x0) * (ix / nx);
            var T = y0 + (y1 - y0) * (iy / ny);
            if (!labelLivre(L, T, wl, hl, arte, registros)) continue;
            var cx = L + wl / 2, cy = T - hl / 2;
            var d = (cx - pMais[0]) * (cx - pMais[0]) + (cy - pMais[1]) * (cy - pMais[1]);
            if (d < bestD) { bestD = d; best = [L, T]; }
        }
    }
    return best;
}

// posiciona o label: 1) DO LADO do "+", DENTRO do bounds (refB com 1mm a menos p/ nao
// encostar na borda), prioridade pra mais dentro; 2) grid dentro do bounds; 3) ULTIMO
// CASO fora. Prioriza SEMPRE dentro do bounds. Retorna true se ficou FORA do bounds.
function posicionarLabel(tf, pMais, pX, markHalf, refB, arteOwn) {
    var arte = arteOwn ? arteOwn : [];
    var registros = [
        [pMais[0] - markHalf, pMais[1] + markHalf, pMais[0] + markHalf, pMais[1] - markHalf], // "+"
        [pX[0] - markHalf, pX[1] + markHalf, pX[0] + markHalf, pX[1] - markHalf]              // "x"
    ];
    var inset = mmToPt(2);
    var refBin = refB ? [refB[0] + inset, refB[1] - inset, refB[2] - inset, refB[3] + inset] : null;

    // 1) CARDINAIS (deitado nos lados / em pe em cima-baixo); 2) DIAGONAIS
    var r = acharPosLabelLado(tf, pMais, markHalf, refBin, arte, registros, false);
    var cardinal = !!r;
    if (!r) r = acharPosLabelLado(tf, pMais, markHalf, refBin, arte, registros, true);
    if (r) {
        if (r.vertical) { try { tf.rotate(90); } catch (e) {} }
        moverTopoEsq(tf, r.L, r.T);
        // re-centraliza no EIXO do "+" usando o bounds REAL (corrige desvio da rotacao);
        // so nas CARDINAIS (as diagonais sao nos cantos de proposito).
        if (cardinal) centralizarNoMais(tf, pMais, r.vertical);
        return false;
    }
    var res = acharPosLabel(tf, pMais, refBin, arte, registros); // 3) grid dentro do bounds
    if (res) { moverTopoEsq(tf, res[0], res[1]); return false; }

    // 4) ULTIMO CASO: nao achou lugar LIVRE -> CLAMPA dentro do bounds, o mais perto
    // possivel do "+". NUNCA sai do bounds (regra absoluta). Pode sobrepor algo.
    var wl = tf.width, hl = tf.height;
    var L = pMais[0] - wl / 2, T = pMais[1] + hl / 2;
    var cb = refB ? refB : refBin;
    if (cb) {
        if (L + wl > cb[2]) L = cb[2] - wl;
        if (L < cb[0]) L = cb[0];
        if (T - hl < cb[3]) T = cb[3] + hl;
        if (T > cb[1]) T = cb[1];
    }
    moverTopoEsq(tf, L, T);
    return false; // ficou DENTRO do bounds (clampado)
}

// desenha um par (+ e x) em REG_<cor> nas posicoes dadas; texto (label) opcional
// junto do "+". Retorna os bounds SO das marcas (o label nunca cresce o cut).
function desenharPar(registrosLayer, pMais, pX, cor, nomeCor, markHalf, stroke, comTexto, refB, arteOwn) {
    var grupoReg = registrosLayer.groupItems.add();
    grupoReg.name = "REG_" + nomeCor;

    // "+"
    criaLinhaReg(registrosLayer, grupoReg, pMais[0] - markHalf, pMais[1], pMais[0] + markHalf, pMais[1], cor, stroke);
    criaLinhaReg(registrosLayer, grupoReg, pMais[0], pMais[1] - markHalf, pMais[0], pMais[1] + markHalf, cor, stroke);
    // "x"
    criaLinhaReg(registrosLayer, grupoReg, pX[0] - markHalf, pX[1] - markHalf, pX[0] + markHalf, pX[1] + markHalf, cor, stroke);
    criaLinhaReg(registrosLayer, grupoReg, pX[0] - markHalf, pX[1] + markHalf, pX[0] + markHalf, pX[1] - markHalf, cor, stroke);

    var marcasB = [
        Math.min(pMais[0], pX[0]) - markHalf, Math.max(pMais[1], pX[1]) + markHalf,
        Math.max(pMais[0], pX[0]) + markHalf, Math.min(pMais[1], pX[1]) - markHalf
    ];

    if (comTexto) {
        try {
            // label = 4 ultimos digitos da O.S. (serviceOrderNumber); so neste par
            var osStr = "" + serviceOrderNumber;
            var lbl = (osStr.length >= 4) ? osStr.substring(osStr.length - 4) : osStr;

            var tf = registrosLayer.textFrames.add();
            tf.kind = TextType.POINTTEXT;
            tf.contents = lbl;
            tf.textRange.size = mmToPt(3.5);
            tf.textRange.fillColor = cor;
            try { tf.textRange.characterAttributes.overprintFill = true; } catch (e) {}
            try { tf.name = "LABEL"; } catch (e) {} // removido no poliester (recolorirRegistro)

            // Label em FONTE (texto), NAO curva. Posiciona (centraliza no "+") e agrupa.
            // recolorirRegistro remove o TextFrame "LABEL" na separacao (fonte nao vai
            // pro poliester). Sem createOutline -> nada de label duplicado.
            posicionarLabel(tf, pMais, pX, markHalf, refB, arteOwn);
            tf.move(grupoReg, ElementPlacement.PLACEATEND);
        } catch (eLabel) {}
    }

    return marcasB;
}

// --- Fase 3a: acha as posicoes do par nas 2 pontas do MAIOR lado (no vazio,
//     >=4mm da arte; dentro do bounds se der, senao fora). Desenha e retorna
//     { pMais, pX, bounds }. ---
// gera candidatos de posicao ao redor do grupo (4 lados x 3 fracoes), cada um
// EMPURRADO pra fora ate ficar livre da arte/vizinhos. Retorna so os livres.
// colisao da marca: folga >=4mm da arte PROPRIA; do vizinho basta NAO sobrepor
// (>=1mm) -> permite usar vaos estreitos entre o grupo e o vizinho.
function marcaColide(cx, cy, markHalf, arteOwn, vizinhos) {
    var rA = markHalf + mmToPt(3);
    var i, b;
    var idx = idxDe(arteOwn);
    if (idx) {
        if (indiceColide(idx, cx - rA, cy + rA, cx + rA, cy - rA)) return true;
    } else {
        for (i = 0; i < arteOwn.length; i++) {
            b = arteOwn[i];
            if (cx - rA < b[2] && cx + rA > b[0] && cy - rA < b[1] && cy + rA > b[3]) return true;
        }
    }
    var rV = markHalf + mmToPt(1);
    if (vizinhos) {
        for (i = 0; i < vizinhos.length; i++) {
            b = vizinhos[i];
            if (cx - rV < b[2] && cx + rV > b[0] && cy - rV < b[1] && cy + rV > b[3]) return true;
        }
    }
    return false;
}

// candidatos ao redor do grupo (4 lados x 3 fracoes), empurrados pra fora ate
// livre. Retorna [{ p:[x,y], lado }].
function gerarCandidatosMarca(vb, arteOwn, vizinhos, markHalf) {
    var left = vb[0], top = vb[1], right = vb[2], bottom = vb[3];
    var base = markHalf + mmToPt(3); // 3mm da arte propria
    var passo = mmToPt(4);
    var fr = [0.1, 0.5, 0.9];
    var cands = [];

    function pushOut(lado, frac) {
        for (var d = 0; d < 10; d++) {
            var off = base + passo * d;
            var p;
            if (lado === "topo")      p = [left + (right - left) * frac, top + off];
            else if (lado === "base") p = [left + (right - left) * frac, bottom - off];
            else if (lado === "esq")  p = [left - off, bottom + (top - bottom) * frac];
            else                      p = [right + off, bottom + (top - bottom) * frac];
            if (!marcaColide(p[0], p[1], markHalf, arteOwn, vizinhos)) return p;
        }
        return null;
    }

    var lados = ["topo", "base", "esq", "dir"];
    for (var s = 0; s < lados.length; s++) {
        for (var i = 0; i < fr.length; i++) {
            var p = pushOut(lados[s], fr[i]);
            if (p) cands.push({ p: p, lado: lados[s] });
        }
    }
    return cands;
}

function ladosOpostos(a, b) {
    return (a === "esq" && b === "dir") || (a === "dir" && b === "esq") ||
           (a === "topo" && b === "base") || (a === "base" && b === "topo");
}

// candidatos DENTRO do envelope (= bounds da arte, ou ate 100mm se a peca for
// pequena), >=4mm da arte propria e sem sobrepor vizinhos.
function candidatosDentro(vbEnv, arteOwn, vizinhos, markHalf) {
    var left = vbEnv[0], top = vbEnv[1], right = vbEnv[2], bottom = vbEnv[3];
    var availW = right - left - 2 * markHalf;
    var availH = top - bottom - 2 * markHalf;
    var cands = [];
    if (availW <= 0 || availH <= 0) return cands;
    var n = 8;
    for (var i = 0; i <= n; i++) {
        for (var j = 0; j <= n; j++) {
            var cx = left + markHalf + availW * (i / n);
            var cy = bottom + markHalf + availH * (j / n);
            if (!marcaColide(cx, cy, markHalf, arteOwn, vizinhos)) cands.push([cx, cy]);
        }
    }
    return cands;
}

// o ponto (marca +-markHalf) cabe inteiro dentro do bounds b?
function dentroDeBounds(p, b, markHalf) {
    return (p[0] - markHalf >= b[0] && p[0] + markHalf <= b[2] &&
            p[1] - markHalf >= b[3] && p[1] + markHalf <= b[1]);
}

// par mais distante de uma lista de pontos [x,y]
function parMaisDistante(pts) {
    var melhor = null, maxD = -1;
    for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
            var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
            var d = dx * dx + dy * dy;
            if (d > maxD) { maxD = d; melhor = [pts[i], pts[j]]; }
        }
    }
    return melhor;
}

// criterio lexicografico: 1) menor crescimento de AREA da cor MAIOR do encaixe
// (manter DENTRO do vermelho); 2) menor crescimento de EXTENSAO do cut proprio (nao
// esticar a dim. longa -> eixo curto/vao); 3) menor crescimento de AREA do proprio;
// 4) par mais afastado (registro).
function paresMelhor(rg, ge, ga, d2, bRg, bGe, bGa, bD2) {
    if (rg < bRg - 2.0) return true;   // area da cor maior (pt^2)
    if (rg > bRg + 2.0) return false;
    if (ge < bGe - 0.5) return true;   // extensao do proprio (pt)
    if (ge > bGe + 0.5) return false;
    if (ga < bGa - 2.0) return true;   // area do proprio (pt^2)
    if (ga > bGa + 2.0) return false;
    return d2 > bD2;                    // desempate: mais afastado
}

// caixa que engloba o bounds b e as 2 marcas (p1,p2 +- markHalf). Retorna
// [extensao(dim max), area].
function cutExtArea(b, p1, p2, markHalf) {
    var L = Math.min(b[0], p1[0] - markHalf, p2[0] - markHalf);
    var T = Math.max(b[1], p1[1] + markHalf, p2[1] + markHalf);
    var R = Math.max(b[2], p1[0] + markHalf, p2[0] + markHalf);
    var B = Math.min(b[3], p1[1] - markHalf, p2[1] - markHalf);
    var w = R - L, h = T - B;
    return [(w > h) ? w : h, w * h];
}

// escolhe o par seguindo a prioridade combinada: 1) nao crescer a area da cor MAIOR
// (ficar DENTRO do vermelho); 2) nao esticar a extensao do proprio (eixo curto/vao);
// 3) menor area do proprio; 4) par mais AFASTADO (registro).
function escolherPar(pool, vb, markHalf, preferir) {
    var minSep = 2 * markHalf + mmToPt(2); // + e x nunca "juntos"
    var minSep2 = minSep * minSep;

    var ownW0 = vb[2] - vb[0], ownH0 = vb[1] - vb[3];
    var ownMd0 = (ownW0 > ownH0) ? ownW0 : ownH0;
    var ownAr0 = ownW0 * ownH0;
    var redAr0 = 0;
    if (preferir) redAr0 = (preferir[2] - preferir[0]) * (preferir[1] - preferir[3]);

    var melhor = null, bRg = 1e18, bGe = 1e18, bGa = 1e18, bD2 = -1;
    for (var i = 0; i < pool.length; i++) {
        for (var j = i + 1; j < pool.length; j++) {
            var p1 = pool[i], p2 = pool[j];
            var dx = p1[0] - p2[0], dy = p1[1] - p2[1], dist2 = dx * dx + dy * dy;
            if (dist2 < minSep2) continue;

            // crescimento de AREA da cor MAIOR (encaixe): manter DENTRO do vermelho
            var rg = 0;
            if (preferir) {
                var red = cutExtArea(preferir, p1, p2, markHalf);
                rg = red[1] - redAr0; if (rg < 0) rg = 0;
            }
            // crescimento do PROPRIO: extensao (dim. max) e area
            var own = cutExtArea(vb, p1, p2, markHalf);
            var ge = own[0] - ownMd0; if (ge < 0) ge = 0;
            var ga = own[1] - ownAr0; if (ga < 0) ga = 0;

            if (paresMelhor(rg, ge, ga, dist2, bRg, bGe, bGa, bD2)) {
                bRg = rg; bGe = ge; bGa = ga; bD2 = dist2; melhor = [p1, p2];
            }
        }
    }
    return melhor;
}

// --- Fase 3a: PREFERE 2 marcas DENTRO do bounds (cut nao cresce); senao FORA,
//     preferindo lados opostos e o mais afastadas. Desenha e retorna. ---
// acha posicao livre p/ a marca perto de um CANTO (ladoX: "esq"/"dir";
// ladoY: "topo"/"base"). Usado na DIFERENCIACAO de pecas de mesmo tamanho.
// Procura do canto PRA DENTRO (livre da arte/vizinhos); se nada couber dentro,
// empurra pra FORA do canto. Sempre devolve um ponto.
function acharPosCanto(vb, arteResp, vizinhos, markHalf, ladoX, ladoY) {
    var left = vb[0], top = vb[1], right = vb[2], bottom = vb[3];
    var inset = markHalf + mmToPt(1);
    var ax = (ladoX === "esq") ? (left + inset) : (right - inset);
    var ay = (ladoY === "topo") ? (top - inset) : (bottom + inset);
    var sx = (ladoX === "esq") ? 1 : -1; // direcao PRA DENTRO
    var sy = (ladoY === "topo") ? -1 : 1;
    var passo = mmToPt(4);
    var d, cands, c, p;
    for (d = 0; d < 16; d++) {
        cands = [
            [ax + sx * passo * d, ay + sy * passo * d], // diagonal pra dentro
            [ax + sx * passo * d, ay],                  // ao longo do lado X
            [ax, ay + sy * passo * d]                   // ao longo do lado Y
        ];
        for (c = 0; c < cands.length; c++) {
            p = cands[c];
            if (p[0] - markHalf >= left && p[0] + markHalf <= right &&
                p[1] - markHalf >= bottom && p[1] + markHalf <= top) {
                if (!marcaColide(p[0], p[1], markHalf, arteResp, vizinhos)) return p;
            }
        }
    }
    // nada livre DENTRO -> empurra pra FORA do canto ate ficar livre
    for (d = 1; d < 12; d++) {
        var off = markHalf + mmToPt(3) + passo * d;
        p = [ax - sx * off, ay - sy * off];
        if (!marcaColide(p[0], p[1], markHalf, arteResp, vizinhos)) return p;
    }
    return [ax, ay]; // ultimo recurso (pode sobrepor)
}

function criarParRegistro(doc, vb, vbEnv, arteOwn, vizinhos, preferir, arteEncaixe, cor, nomeCor, registrosLayer, markHalf, stroke, comTexto, variacao) {
    var pMais = null, pX = null, i;
    if (variacao === undefined) variacao = -1; // -1 = colocacao otimizada normal

    // arte a respeitar 4mm: a propria + (no encaixe) a arte detalhada da cor MAIOR
    var arteResp = arteOwn;
    if (arteEncaixe && arteEncaixe.length) {
        arteResp = [];
        for (i = 0; i < arteOwn.length; i++) arteResp.push(arteOwn[i]);
        for (i = 0; i < arteEncaixe.length; i++) arteResp.push(arteEncaixe[i]);
    }

    // area de busca SEMPRE LOCAL (bounds da arte do proprio grupo) p/ as marcas
    // ficarem PERTO do grupo (nao espalhar pelo rotulo inteiro quando a cor maior
    // do encaixe e enorme). O "nao cair em cima do maior / nao crescer a peca" e
    // garantido pela arte detalhada do maior em arteResp (4mm) + o FORA empurrando
    // pro canal vazio mais proximo.
    var areaBusca = vbEnv;

    // junta candidatos DENTRO (nao crescem o cut) + FORA (empurrados ate livre) e
    // escolhe o par que deixa o cut com a MENOR area possivel.
    if (variacao >= 0) {
        // DIFERENCIACAO (pecas de mesmo tamanho/cor, sem encaixe): par em cantos
        // DIAGONAIS (fora do centro), + e x ALTERNADOS por indice -> distintas
        // entre si e com a inversao 180 (ponta-cabeca) visivel.
        // 0:+TL/xBR   1:+TR/xBL   2:+BR/xTL   3:+BL/xTR
        var _cfgs = [
            [["esq", "topo"], ["dir", "base"]],
            [["dir", "topo"], ["esq", "base"]],
            [["dir", "base"], ["esq", "topo"]],
            [["esq", "base"], ["dir", "topo"]]
        ];
        var _cfg = _cfgs[variacao % 4];
        pMais = acharPosCanto(vb, arteResp, vizinhos, markHalf, _cfg[0][0], _cfg[0][1]);
        pX    = acharPosCanto(vb, arteResp, vizinhos, markHalf, _cfg[1][0], _cfg[1][1]);
    } else {
        var pool = candidatosDentro(areaBusca, arteResp, vizinhos, markHalf);
        var fora = gerarCandidatosMarca(vb, arteResp, vizinhos, markHalf);
        for (i = 0; i < fora.length; i++) pool.push(fora[i].p);

        // escolhe o par que menos aumenta a area DOS DOIS (proprio cut + cor maior
        // do encaixe). Prefere ficar DENTRO do maior, mas pode sair um pouco.
        var par = escolherPar(pool, vb, markHalf, preferir);
        if (par) { pMais = par[0]; pX = par[1]; }
    }

    // recurso (nada escolhido): marcas no EIXO CURTO do grupo (cresce menos)
    if (!pMais) {
        var raio = markHalf + mmToPt(3);
        if ((vb[1] - vb[3]) >= (vb[2] - vb[0])) { // grupo mais alto -> laterais
            pMais = acharPosMarca(vb, arteResp, raio, markHalf, "esq");
            pX = acharPosMarca(vb, arteResp, raio, markHalf, "dir");
        } else { // mais largo -> topo/base
            pMais = acharPosMarca(vb, arteResp, raio, markHalf, "topo");
            pX = acharPosMarca(vb, arteResp, raio, markHalf, "base");
        }
    }

    // LABEL: refB = area do CUT (arte ∪ marcas + margens) -> cabe na faixa da margem,
    // nunca cresce o cut.
    var marksB = [
        Math.min(pMais[0], pX[0]) - markHalf, Math.max(pMais[1], pX[1]) + markHalf,
        Math.max(pMais[0], pX[0]) + markHalf, Math.min(pMais[1], pX[1]) - markHalf
    ];
    var refB = expandirCut(unirBounds(vb, marksB));

    var bounds = desenharPar(registrosLayer, pMais, pX, cor, nomeCor, markHalf, stroke, comTexto, refB, arteOwn);
    return { pMais: pMais, pX: pX, bounds: bounds };
}

// folga (distancia) entre dois bounds [left,top,right,bottom]; 0 se sobrepoem.
function distanciaBounds(a, b) {
    var dx = 0, dy = 0;
    if (a[2] < b[0]) dx = b[0] - a[2];
    else if (b[2] < a[0]) dx = a[0] - b[2];
    if (a[3] > b[1]) dy = a[3] - b[1];
    else if (b[3] > a[1]) dy = b[3] - a[1];
    return Math.sqrt(dx * dx + dy * dy);
}

// menor distancia entre a ARTE real (detalhada) de dois grupos. Usa os bounds dos
// objetos (nao o bounding box do grupo) -> evita "encaixe falso" entre grupos cujos
// bounding boxes se aproximam mas o desenho real esta longe.
function distanciaArte(arteA, arteB) {
    var menor = mmToPt(999999);
    if (!arteA || !arteB) return menor;
    for (var i = 0; i < arteA.length; i++) {
        for (var j = 0; j < arteB.length; j++) {
            var d = distanciaBounds(arteA[i], arteB[j]);
            if (d < menor) menor = d;
            if (menor <= 0) return 0;
        }
    }
    return menor;
}

// uniao de dois bounds (trata null)
function unirBounds(a, b) {
    if (!a) return b;
    if (!b) return a;
    return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])];
}

// folga (distancia) de um lado do vb ate o vizinho mais proximo daquele lado
// (que se sobrepoe no eixo perpendicular). Grande se nao houver vizinho.
function clearanceLado(vb, vizinhos, lado) {
    var menor = mmToPt(99999);
    if (!vizinhos) return menor;
    for (var i = 0; i < vizinhos.length; i++) {
        var v = vizinhos[i]; // [left, top, right, bottom]
        if (lado === "topo") {
            if (v[3] >= vb[1] && v[0] < vb[2] && v[2] > vb[0]) menor = Math.min(menor, v[3] - vb[1]);
        } else if (lado === "base") {
            if (v[1] <= vb[3] && v[0] < vb[2] && v[2] > vb[0]) menor = Math.min(menor, vb[3] - v[1]);
        } else if (lado === "esq") {
            if (v[2] <= vb[0] && v[3] < vb[1] && v[1] > vb[3]) menor = Math.min(menor, vb[0] - v[2]);
        } else { // dir
            if (v[0] >= vb[2] && v[3] < vb[1] && v[1] > vb[3]) menor = Math.min(menor, v[0] - vb[2]);
        }
    }
    return menor;
}

// --- doc tem imagem (incorporada/colocada)? so para AVISAR (nao bloqueia) ---
function docTemImagem(doc) {
    try { if (doc.rasterItems && doc.rasterItems.length > 0) return true; } catch (e) {}
    try { if (doc.placedItems && doc.placedItems.length > 0) return true; } catch (e2) {}
    return false;
}

// --- layers que alimentam o risco: a arte principal + a "medidas" (quadrados
// que representam as cores da imagem). "medidas" e opcional. ---
function getLayersFonteRisco(doc, arte) {
    var fontes = [arte];
    try {
        var med = doc.layers.getByName("medidas");
        if (med && med.name !== arte.name) fontes.push(med);
    } catch (e) {}
    return fontes;
}

// --- cria os quadrados (cut) e registros (+/x) - 1 por grupo da arte/medidas ---
function criarRiscosArte(doc) {
    // Imagem nao gera risco: avisa (sem bloquear) que cada cor da imagem deve
    // virar um quadrado de cromia na "arte"/"medidas". A layer de imagens fica fora.
    if (docTemImagem(doc)) {
        alert("ATENCAO: IMAGEM NO ARQUIVO\n\nO risco nao processa imagens (raster/colocadas) - elas serao IGNORADAS.\n\nRepresente cada cor da imagem por um QUADRADO de cromia pura\n(ex.: preto = 0,0,0,100) agrupado na layer 'arte' ou 'medidas'.");
    }

    var arte = null;
    try { arte = doc.layers.getByName("arte"); } catch (e) { arte = null; }
    if (!arte) {
        arte = escolherLayerArteDialog(doc);
        if (!arte) return; // operador cancelou
    }

    // arte + medidas alimentam o risco; guarda os nomes para remove-las das separacoes.
    var fontesRisco = getLayersFonteRisco(doc, arte);
    nomeLayerArte = arte.name;
    nomesLayersRisco = [];
    for (var _nf = 0; _nf < fontesRisco.length; _nf++) nomesLayersRisco.push(fontesRisco[_nf].name);

    var margens = getMargensCliente(); // [left, top, right, bottom] em pt (por cliente, via JSON)
    margensCut = margens; // o label pode ocupar a area do cut (com a margem), sem crescer o cut

    var cutLayer;
    try { cutLayer = doc.layers.getByName("cut"); }
    catch (e) { cutLayer = doc.layers.add(); cutLayer.name = "cut"; }

    var registrosLayer;
    try { registrosLayer = doc.layers.getByName("registros"); }
    catch (e) { registrosLayer = doc.layers.add(); registrosLayer.name = "registros"; }

    // LIMPA o conteudo das layers cut/registros antes de gerar -> evita DUPLICIDADE
    // quando o doc JA tem registros/cuts (rodada anterior, ou do PICS que tambem cria
    // a layer "registros"). Sao layers do proprio script, entao limpar e seguro.
    try { cutLayer.locked = false; } catch (e) {}
    try { registrosLayer.locked = false; } catch (e) {}
    var _liLimpa;
    for (_liLimpa = cutLayer.pageItems.length - 1; _liLimpa >= 0; _liLimpa--) {
        try { cutLayer.pageItems[_liLimpa].remove(); } catch (e) {}
    }
    for (_liLimpa = registrosLayer.pageItems.length - 1; _liLimpa >= 0; _liLimpa--) {
        try { registrosLayer.pageItems[_liLimpa].remove(); } catch (e) {}
    }

    var strokeCut = mmToPt(0.5);
    var markHalf = mmToPt(5) / 2;
    var strokeReg = mmToPt(0.3);
    var gap15 = mmToPt(15);

    // ===== PASSO 1: coleta os grupos da arte + medidas (cor, bounds, area) =====
    var grupos = [];
    for (var _lf = 0; _lf < fontesRisco.length; _lf++) {
        var _layerFonte = fontesRisco[_lf];
        for (var i = 0; i < _layerFonte.pageItems.length; i++) {
            var grupo = _layerFonte.pageItems[i];
            if (grupo.typename !== "GroupItem") continue;

            var nomeCor = corPredominanteDoGrupo(grupo);
            if (!nomeCor) continue;

            // spot existente OU cromia pura (CMYK puro) -> cor do registro/cut
            var corObj = corDoGrupo(doc, nomeCor);
            if (!corObj) continue;

            var vb = getVisibleBoundsDeep(grupo); // bounds VISIVEL (clipa o que passa da mascara)
            if (!vb) continue;

            var ba = [];
            coletarBoundsArte(grupo, ba);

            grupos.push({
                nomeCor: nomeCor,
                cor: corObj,
                vb: vb,
                boundsArte: ba,
                area: (vb[2] - vb[0]) * (vb[1] - vb[3]),
                par: null,
                marcasB: null,
                maioresIdx: null,
                pulaPar: false
            });
        }
    }

    // ===== PASSO 2: encaixes (cores DIFERENTES com folga <= 15mm) =====
    var pares = [];
    for (var a = 0; a < grupos.length; a++) {
        for (var b = a + 1; b < grupos.length; b++) {
            // PRE-FILTRO BARATO (performance): se as CAIXAS (vb) ja estao a mais de
            // 15mm, a arte detalhada dentro delas tambem esta -> impossivel encaixar.
            // Pula sem rodar o distanciaArte O(M^2) nem o regex de cor. Resultado
            // IDENTICO: os pares realmente proximos continuam fazendo o calculo
            // detalhado; so evita o custo caro nos pares obviamente distantes (a
            // grande maioria). Esse era o gargalo do "as vezes 10min".
            if (distanciaBounds(grupos[a].vb, grupos[b].vb) > gap15) continue;

            if (baseCor(grupos[a].nomeCor) === baseCor(grupos[b].nomeCor)) continue;
            // encaixe pela ARTE real (nao pelo bounding box) -> evita encaixe falso
            // (bounding boxes grandes se tocam, mas o desenho esta longe -> cut gigante)
            if (distanciaArte(grupos[a].boundsArte, grupos[b].boundsArte) <= gap15) {
                pares.push([a, b]);
                // o MENOR guarda o indice do MAIOR: vai por seu par DENTRO do bounds
                // do maior (canal vazio), sem crescer a peca/cor maior.
                var menIdx = (grupos[a].area <= grupos[b].area) ? a : b;
                var maiIdx = (grupos[a].area <= grupos[b].area) ? b : a;
                if (!grupos[menIdx].maioresIdx) grupos[menIdx].maioresIdx = [];
                grupos[menIdx].maioresIdx.push(maiIdx);
                // tamanhos PARECIDOS -> 1 par so (compartilhado): o MAIOR nao cria par
                // proprio, usa a replica do menor (mesma posicao, cada um na sua cor).
                // Diferente do caso "taca" (preto bem menor que vermelho), onde o maior
                // mantem o par proprio + a replica.
                if (grupos[menIdx].area / grupos[maiIdx].area >= 0.8) {
                    grupos[maiIdx].pulaPar = true;
                }
            }
        }
    }

    // ===== PASSO 2.5: DIFERENCIACAO de pecas de MESMO TAMANHO + MESMA COR (base),
    // SEM encaixe -> registros em arranjos distintos (cantos diagonais, +/x
    // alternados) p/ o operador nao montar peca de uma no lugar da outra nem de
    // ponta-cabeca. Ate 4 pecas; tolerancia 3mm em largura E altura. =====
    var temEncaixe = [], _zz;
    for (_zz = 0; _zz < grupos.length; _zz++) { grupos[_zz].variacao = -1; temEncaixe[_zz] = false; }
    for (_zz = 0; _zz < pares.length; _zz++) { temEncaixe[pares[_zz][0]] = true; temEncaixe[pares[_zz][1]] = true; }

    var _tol = mmToPt(3), _atrib = [];
    for (_zz = 0; _zz < grupos.length; _zz++) _atrib[_zz] = false;
    for (var _ca = 0; _ca < grupos.length; _ca++) {
        if (temEncaixe[_ca] || _atrib[_ca]) continue;
        var _wa = grupos[_ca].vb[2] - grupos[_ca].vb[0];
        var _ha = grupos[_ca].vb[1] - grupos[_ca].vb[3];
        var _cluster = [_ca];
        for (var _cb = _ca + 1; _cb < grupos.length; _cb++) {
            if (temEncaixe[_cb] || _atrib[_cb]) continue;
            if (baseCor(grupos[_ca].nomeCor) !== baseCor(grupos[_cb].nomeCor)) continue;
            var _wb = grupos[_cb].vb[2] - grupos[_cb].vb[0];
            var _hb = grupos[_cb].vb[1] - grupos[_cb].vb[3];
            if (Math.abs(_wa - _wb) <= _tol && Math.abs(_ha - _hb) <= _tol) _cluster.push(_cb);
        }
        if (_cluster.length >= 2) {
            for (var _ci = 0; _ci < _cluster.length; _ci++) {
                _atrib[_cluster[_ci]] = true;
                grupos[_cluster[_ci]].variacao = (_ci < 4) ? _ci : -1; // ate 4 arranjos
            }
        } else {
            _atrib[_ca] = true; // peca sozinha -> colocacao normal
        }
    }

    // ===== PASSO 3: par PROPRIO de cada grupo (colagem), evitando vizinhos =====
    // Sem regra de 100mm: melhor adequacao dos registros, crescendo o cut so com
    // base nas marcas criadas (nao aumenta a peca; no encaixe, nao aumenta a maior).
    for (var k = 0; k < grupos.length; k++) {
        var gr = grupos[k];
        if (gr.pulaPar) continue; // tamanho parecido: usa o par COMPARTILHADO (PASSO 4)
        var maiores = gr.maioresIdx || [];
        var vizinhos = [];
        var preferir = null;     // area de busca = bounds da(s) cor(es) maior(es)
        var arteEncaixe = [];    // arte detalhada do maior (respeita 4mm tbm)
        for (var o = 0; o < grupos.length; o++) {
            if (o === k) continue;
            var ehMaior = false;
            for (var m = 0; m < maiores.length; m++) { if (maiores[m] === o) { ehMaior = true; break; } }
            if (ehMaior) {
                preferir = unirBounds(preferir, grupos[o].vb);
                for (var bi = 0; bi < grupos[o].boundsArte.length; bi++) arteEncaixe.push(grupos[o].boundsArte[bi]);
            } else {
                vizinhos.push(grupos[o].vb);
            }
        }

        gr.par = criarParRegistro(doc, gr.vb, gr.vb, gr.boundsArte, vizinhos, preferir, arteEncaixe, gr.cor, gr.nomeCor, registrosLayer, markHalf, strokeReg, true, gr.variacao);
        gr.marcasB = gr.par ? gr.par.bounds : null;
    }

    // ===== PASSO 4: encaixe -> replica o par do MENOR na cor do MAIOR =====
    // (registro compartilhado, mesmo ponto, overprint; a maior ganha +1 par por cor).
    for (var p = 0; p < pares.length; p++) {
        var gA = grupos[pares[p][0]];
        var gB = grupos[pares[p][1]];
        var menor = (gA.area <= gB.area) ? gA : gB;
        var maior = (gA.area <= gB.area) ? gB : gA;
        if (!menor.par) continue;
        // trava: so replica se o par do menor estiver PERTO do maior (senao inflaria
        // o cut do maior la longe). distancia da arte ja garante isso, mas reforca.
        if (distanciaBounds(menor.par.bounds, maior.vb) > gap15) continue;

        // Se o maior COMPARTILHA o par (Part B, tamanhos parecidos -> pulou o proprio),
        // o label tbm vai na cor DELE (label nas duas cores). No caso "taca", o maior
        // ja tem label no par proprio, entao a replica vai sem label.
        var comTextoMaior = maior.pulaPar;
        var refBMaior = null, arteMaior = null;
        if (comTextoMaior) {
            var marksBR = [
                Math.min(menor.par.pMais[0], menor.par.pX[0]) - markHalf, Math.max(menor.par.pMais[1], menor.par.pX[1]) + markHalf,
                Math.max(menor.par.pMais[0], menor.par.pX[0]) + markHalf, Math.min(menor.par.pMais[1], menor.par.pX[1]) - markHalf
            ];
            refBMaior = expandirCut(unirBounds(maior.vb, marksBR));
            arteMaior = maior.boundsArte;
        }
        var bComp = desenharPar(registrosLayer, menor.par.pMais, menor.par.pX, maior.cor, maior.nomeCor, markHalf, strokeReg, comTextoMaior, refBMaior, arteMaior);
        if (bComp) maior.marcasB = unirBounds(maior.marcasB, bComp);
    }

    // ===== PASSO 5: cut = (arte + margens), expandido SO p/ englobar marcas que
    // saiam dele. Se as marcas couberam dentro, o cut NAO cresce (sem margem extra
    // em volta das marcas). Se sairam, cresce o minimo ate a marca. =====
    for (var c = 0; c < grupos.length; c++) {
        var g = grupos[c];

        var cutL = g.vb[0] - margens[0];
        var cutT = g.vb[1] + margens[1];
        var cutR = g.vb[2] + margens[2];
        var cutB = g.vb[3] - margens[3];
        // se as marcas saem do cut, ele cresce ate elas COM a mesma margem (nao
        // encostado nas marcas). CLAMP de seguranca: as marcas nunca crescem o cut
        // mais que 80mm alem do bounds (marcas legitimas ficam a <=40mm; alem disso
        // e bug de coordenada -> ignora, p/ nunca gerar cut gigante).
        if (g.marcasB) {
            var lim = mmToPt(80);
            var mbL = Math.max(g.marcasB[0], g.vb[0] - lim);
            var mbT = Math.min(g.marcasB[1], g.vb[1] + lim);
            var mbR = Math.min(g.marcasB[2], g.vb[2] + lim);
            var mbB = Math.max(g.marcasB[3], g.vb[3] - lim);
            if (mbL - margens[0] < cutL) cutL = mbL - margens[0];
            if (mbT + margens[1] > cutT) cutT = mbT + margens[1];
            if (mbR + margens[2] > cutR) cutR = mbR + margens[2];
            if (mbB - margens[3] < cutB) cutB = mbB - margens[3];
        }

        var left = cutL;
        var top = cutT;
        var width = cutR - cutL;
        var height = cutT - cutB;

        var rect = cutLayer.pathItems.rectangle(top, left, width, height);
        rect.filled = false;
        rect.stroked = true;
        rect.strokeWidth = strokeCut;
        rect.strokeColor = g.cor;
        rect.strokeOverprint = true;
        rect.name = "RISCO_" + g.nomeCor;
    }

}

// nome da layer usada como arte (para remove-la das separacoes)
var nomeLayerArte = null;
// nomes de TODAS as layers-fonte do risco (arte + medidas) p/ remover das separacoes
var nomesLayersRisco = [];
// margens do cut (p/ o label ocupar a area do cut, incluindo a margem, sem crescer o cut)
var margensCut = null;

function normalizarNomeCor(nome) {
    return String(nome).toLowerCase()
        .replace(/process /g, '')
        .replace(/pantone /g, '')
        .replace(/ c/g, '');
}

// Um RISCO_/REG_ "nomeCor" pertence a separacao "alvo" (cor da O.S.) se for a
// MESMA base: nomeCor == alvo OU nomeCor == alvo + numero. Assim as variacoes que
// o RemapCores cria (preto1, preto2, preto3...) caem TODAS no risco do "preto".
// So agrupa o sufixo NUMERICO -> nao funde cores realmente diferentes.
function pertenceASeparacao(nomeCor, alvo) {
    var n = normalizarNomeCor(nomeCor);
    if (n === alvo) return true;
    if (n.length > alvo.length && n.substring(0, alvo.length) === alvo) {
        return /^[0-9]+$/.test(n.substring(alvo.length));
    }
    return false;
}

// Base da cor para COMPARAR duas cores (encaixe): tira o sufixo numerico
// (preto1/preto2/preto3 -> "preto"), mas se sobrar vazio mantem o nome inteiro,
// para nao fundir cores cujo nome ja e so numero (ex.: Pantone 485 vs 486).
function baseCor(nome) {
    var n = normalizarNomeCor(nome);
    var semNum = n.replace(/[0-9]+$/, '');
    return semNum.length > 0 ? semNum : n;
}

// Garante a spot "cut" (100% cyan) no doc e retorna um SpotColor pronto.
function ensureCutSpot(docSep) {
    var spot;
    try {
        spot = docSep.spots.getByName("cut");
    } catch (e) {
        spot = docSep.spots.add();
        spot.name = "cut";
        spot.colorType = ColorModel.SPOT;
        var c = new CMYKColor();
        c.cyan = 100; c.magenta = 0; c.yellow = 0; c.black = 0;
        spot.color = c;
    }
    var sc = new SpotColor();
    sc.spot = docSep.spots.getByName("cut");
    sc.tint = 100;
    return sc;
}

// Prepara a separacao: (defensivo) remove a arte se tiver vindo, e na layer
// "cut" mantem APENAS os RISCO_ da cor atual, recolorindo-os para a spot "cut"
// (100% cyan) - mais visivel no arquivo do poliester.
function prepararSeparacao(docSep, corAtual) {
    for (var _nl = 0; _nl < nomesLayersRisco.length; _nl++) {
        try {
            var la = docSep.layers.getByName(nomesLayersRisco[_nl]);
            la.locked = false;
            la.visible = true;
            la.remove();
        } catch (e) {}
    }

    var cutLayer = null;
    try { cutLayer = docSep.layers.getByName("cut"); } catch (e) {}
    if (cutLayer) {
        var alvo = normalizarNomeCor(corAtual);
        var cutColor = ensureCutSpot(docSep);
        for (var ci = cutLayer.pageItems.length - 1; ci >= 0; ci--) {
            var it = cutLayer.pageItems[ci];
            var nm = String(it.name);
            if (nm.indexOf("RISCO_") === 0) {
                if (!pertenceASeparacao(nm.substring(6), alvo)) {
                    try { it.remove(); } catch (e) {}
                } else {
                    // risco desta cor -> recolore para a spot "cut" (cyan), overprint
                    try {
                        it.stroked = true;
                        it.strokeColor = cutColor;
                        it.strokeOverprint = true;
                    } catch (e) {}
                }
            }
        }
    }

    // Fase 2: na layer "registros" mantem so os REG_ da cor atual, RECOLORINDO as
    // marcas (+/x) para a spot "cut" (100% cyan) - mesma cor do cut, e REMOVENDO
    // o label (a fonte nao vai pro poliester).
    var regLayer = null;
    try { regLayer = docSep.layers.getByName("registros"); } catch (e) {}
    if (regLayer) {
        var alvoR = normalizarNomeCor(corAtual);
        var corReg = ensureCutSpot(docSep); // registros na spot "cut" (cyan)
        for (var ri = regLayer.pageItems.length - 1; ri >= 0; ri--) {
            var itr = regLayer.pageItems[ri];
            var nmr = String(itr.name);
            if (nmr.indexOf("REG_") === 0) {
                if (!pertenceASeparacao(nmr.substring(4), alvoR)) {
                    try { itr.remove(); } catch (e) {}
                } else {
                    recolorirRegistro(itr, corReg);
                }
            }
        }
    }

    // Pontilhado (dashed) em volta do artboard, PRETO K=100: traco 5mm / gap 3mm,
    // 0,5mm de espessura, overprint. Layer "borda" (criada se nao existir).
    try {
        var pretoB = new CMYKColor();
        pretoB.cyan = 0; pretoB.magenta = 0; pretoB.yellow = 0; pretoB.black = 100;
        var abIdx = docSep.artboards.getActiveArtboardIndex();
        var ab = docSep.artboards[abIdx].artboardRect; // [left, top, right, bottom]
        var bordaLayer;
        try { bordaLayer = docSep.layers.getByName("borda"); }
        catch (e) { bordaLayer = docSep.layers.add(); bordaLayer.name = "borda"; }
        try { bordaLayer.locked = false; bordaLayer.visible = true; } catch (e) {}
        var rectB = bordaLayer.pathItems.rectangle(ab[1], ab[0], ab[2] - ab[0], ab[1] - ab[3]);
        rectB.name = "BORDA_pontilhada";
        rectB.filled = false;
        rectB.stroked = true;
        rectB.strokeColor = pretoB;
        rectB.strokeWidth = mmToPt(0.5);
        rectB.strokeDashes = [mmToPt(5), mmToPt(3)];
        rectB.strokeOverprint = true;
    } catch (e) {}
}

// recolore as marcas (+/x) de um grupo REG_ para 'corPreta' e REMOVE o label (texto)
function recolorirRegistro(grupo, corPreta) {
    if (!grupo.pageItems) {
        try { grupo.strokeColor = corPreta; grupo.stroked = true; } catch (e) {}
        return;
    }
    for (var i = grupo.pageItems.length - 1; i >= 0; i--) {
        var it = grupo.pageItems[i];
        if (it.typename === "TextFrame" || String(it.name) === "LABEL") {
            try { it.remove(); } catch (e) {}            // label (texto ou vetor) nao vai pro poliester
        } else if (it.typename === "GroupItem") {
            recolorirRegistro(it, corPreta);
        } else {
            try { it.strokeColor = corPreta; it.stroked = true; } catch (e) {}
        }
    }
}

criarRiscosArte(doc);




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

// Clona o conteudo de 'origem' para 'destino' por COPY/PASTE (rapido e mantem a
// posicao, pois com "Paste Remembers Layers" o paste cola no lugar e recria as
// layers). Copy/paste e intermitente (clipboard/foco), entao tenta varias vezes
// e SO retorna quando confirma que o destino realmente recebeu o conteudo.
function clonarArtboardParaDoc(origem, destino) {
    var tentativas = 0;
    while (tentativas < 6) {
        tentativas++;

        // Limpa restos de uma tentativa anterior (normalmente o destino esta vazio)
        for (var ci = destino.pageItems.length - 1; ci >= 0; ci--) {
            try {
                destino.pageItems[ci].locked = false;
                destino.pageItems[ci].remove();
            } catch (e) {}
        }

        try {
            app.activeDocument = origem;
            app.redraw();

            origem.selectObjectsOnActiveArtboard();
            if (origem.selection.length === 0) {
                $.sleep(150);
                app.redraw();
                origem.selectObjectsOnActiveArtboard();
            }

            if (origem.selection.length > 0) {
                app.copy();

                app.activeDocument = destino;
                app.redraw();
                app.paste();

                if (destino.pageItems.length > 0) return true;
            }
        } catch (e) {}

        $.sleep(250);
    }

    alert("Nao foi possivel copiar o conteudo para a separacao apos varias tentativas.");
    return false;
}

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

// ======================================================
// ETIQUETA PENHA (somente cliente penha_sa)
// ======================================================
// Juncao do antigo 12_Gerar_Etiqueta_Penha.jsx. Para cada cor (cada risco),
// abre o template Etiqueta_Penha.pdf, troca os [[tokens]], gera os 2 codigos
// de barras (fi e codcor) sobre os retangulos placeholder, agrupa, espelha e
// posiciona 40mm ACIMA da faca: uma no centro de 1/4 e outra no centro de 3/4
// da largura da faca. Tudo na layer "cotas".

var isPenha = (String(folder).toLowerCase() === "penha_sa");
var localizacaoPenha = "";

// --- helpers de texto ---
function extrairAntesDaBarra(texto) {
    if (texto === undefined || texto === null) return texto;
    return String(texto).split("/")[0];
}

function extrairDepoisDaBarraSeguro(texto) {
    if (!texto) return texto;
    texto = String(texto);
    if (texto.indexOf("/") === -1) return texto;
    return texto.split("/")[1];
}

// --- cor preta CMYK para as barras ---
function criarCorPreta() {
    var cor = new CMYKColor();
    cor.cyan = 0;
    cor.magenta = 0;
    cor.yellow = 0;
    cor.black = 100;
    return cor;
}

// --- localiza retangulo placeholder pela SpotColor ---
function encontrarRectPorSpot(docBusca, spotName) {
    for (var i = 0; i < docBusca.pathItems.length; i++) {
        var pi = docBusca.pathItems[i];
        if (pi.filled && pi.fillColor && pi.fillColor.typename === "SpotColor") {
            if (pi.fillColor.spot && pi.fillColor.spot.name === spotName) {
                return pi;
            }
        }
    }
    return null;
}

// --- desbloqueia/exibe tudo no template ---
function desbloquearEExibirTudo(docAlvo) {
    function _unlockLayer(ly) {
        try { ly.locked = false; } catch (e) {}
        try { ly.visible = true; } catch (e) {}
        for (var i = 0; i < ly.pageItems.length; i++) {
            try {
                ly.pageItems[i].locked = false;
                ly.pageItems[i].hidden = false;
            } catch (e) {}
        }
        for (var j = 0; j < ly.layers.length; j++) _unlockLayer(ly.layers[j]);
    }
    for (var k = 0; k < docAlvo.layers.length; k++) _unlockLayer(docAlvo.layers[k]);
}

// --- agrupa tudo no documento ativo (template) ---
function agruparTudoNoDocumento(docAlvo) {
    docAlvo.selection = null;
    for (var i = 0; i < docAlvo.pageItems.length; i++) {
        try { docAlvo.pageItems[i].selected = true; } catch (e) {}
    }
    if (!docAlvo.selection || docAlvo.selection.length === 0) return null;
    app.executeMenuCommand('group');
    return docAlvo.selection.length > 0 ? docAlvo.selection[0] : null;
}

// --- gera Code128 centralizado no proprio retangulo (sem depender de artboard) ---
function gerarCode128SobreRect(docCB, texto, rectItem, alturaPt, larguraPt, indiceCB) {
    if (!rectItem) return false;
    try {
        var b = rectItem.geometricBounds; // [left, top, right, bottom]
        var rLeft = b[0],
            rTop = b[1],
            rRight = b[2],
            rBottom = b[3];
        var rectWidth = rRight - rLeft;
        var rectHeight = rTop - rBottom;

        var moduleWidth = 0.8;

        var startCode = 104,
            stopCode = 106;
        var sequence = [startCode];
        for (var i = 0; i < texto.length; i++) sequence.push(texto.charCodeAt(i) - 32);
        var checksum = startCode;
        for (var i = 0; i < texto.length; i++) checksum += sequence[i + 1] * (i + 1);
        checksum = checksum % 103;
        sequence.push(checksum);
        sequence.push(stopCode);

        var code128Patterns = [
            [2, 1, 2, 2, 2, 2],
            [2, 2, 2, 1, 2, 2],
            [2, 2, 2, 2, 2, 1],
            [1, 2, 1, 2, 2, 3],
            [1, 2, 1, 3, 2, 2],
            [1, 3, 1, 2, 2, 2],
            [1, 2, 2, 2, 1, 3],
            [1, 2, 2, 3, 1, 2],
            [1, 3, 2, 2, 1, 2],
            [2, 2, 1, 2, 1, 3],
            [2, 2, 1, 3, 1, 2],
            [2, 3, 1, 2, 1, 2],
            [1, 1, 2, 2, 3, 2],
            [1, 2, 2, 1, 3, 2],
            [1, 2, 2, 2, 3, 1],
            [1, 1, 3, 2, 2, 2],
            [1, 2, 3, 1, 2, 2],
            [1, 2, 3, 2, 2, 1],
            [2, 2, 3, 2, 1, 1],
            [2, 2, 1, 1, 3, 2],
            [2, 2, 1, 2, 3, 1],
            [2, 1, 3, 2, 1, 2],
            [2, 2, 3, 1, 1, 2],
            [3, 1, 2, 1, 3, 1],
            [3, 1, 1, 2, 2, 2],
            [3, 2, 1, 1, 2, 2],
            [3, 2, 1, 2, 2, 1],
            [3, 1, 2, 2, 1, 2],
            [3, 2, 2, 1, 1, 2],
            [3, 2, 2, 2, 1, 1],
            [2, 1, 2, 1, 2, 3],
            [2, 1, 2, 3, 2, 1],
            [2, 3, 2, 1, 2, 1],
            [1, 1, 1, 3, 2, 3],
            [1, 3, 1, 1, 2, 3],
            [1, 3, 1, 3, 2, 1],
            [1, 1, 2, 3, 1, 3],
            [1, 3, 2, 1, 1, 3],
            [1, 3, 2, 3, 1, 1],
            [2, 1, 1, 3, 1, 3],
            [2, 3, 1, 1, 1, 3],
            [2, 3, 1, 3, 1, 1],
            [1, 1, 2, 1, 3, 3],
            [1, 1, 2, 3, 3, 1],
            [1, 3, 2, 1, 3, 1],
            [1, 1, 3, 1, 2, 3],
            [1, 1, 3, 3, 2, 1],
            [1, 3, 3, 1, 2, 1],
            [3, 1, 3, 1, 2, 1],
            [2, 1, 1, 3, 3, 1],
            [2, 3, 1, 1, 3, 1],
            [2, 1, 3, 1, 1, 3],
            [2, 1, 3, 3, 1, 1],
            [2, 1, 3, 1, 3, 1],
            [3, 1, 1, 1, 2, 3],
            [3, 1, 1, 3, 2, 1],
            [3, 3, 1, 1, 2, 1],
            [3, 1, 2, 1, 1, 3],
            [3, 1, 2, 3, 1, 1],
            [3, 3, 2, 1, 1, 1],
            [3, 1, 4, 1, 1, 1],
            [2, 2, 1, 4, 1, 1],
            [4, 3, 1, 1, 1, 1],
            [1, 1, 1, 2, 2, 4],
            [1, 1, 1, 4, 2, 2],
            [1, 2, 1, 1, 2, 4],
            [1, 2, 1, 4, 2, 1],
            [1, 4, 1, 1, 2, 2],
            [1, 4, 1, 2, 2, 1],
            [1, 1, 2, 2, 1, 4],
            [1, 1, 2, 4, 1, 2],
            [1, 2, 2, 1, 1, 4],
            [1, 2, 2, 4, 1, 1],
            [1, 4, 2, 1, 1, 2],
            [1, 4, 2, 2, 1, 1],
            [2, 4, 1, 2, 1, 1],
            [2, 2, 1, 1, 1, 4],
            [4, 1, 3, 1, 1, 1],
            [2, 4, 1, 1, 1, 2],
            [1, 3, 4, 1, 1, 1],
            [1, 1, 1, 2, 4, 2],
            [1, 2, 1, 1, 4, 2],
            [1, 2, 1, 2, 4, 1],
            [1, 1, 4, 2, 1, 2],
            [1, 2, 4, 1, 1, 2],
            [1, 2, 4, 2, 1, 1],
            [4, 1, 1, 2, 1, 2],
            [4, 2, 1, 1, 1, 2],
            [4, 2, 1, 2, 1, 1],
            [2, 1, 2, 1, 4, 1],
            [2, 1, 4, 1, 2, 1],
            [4, 1, 2, 1, 2, 1],
            [1, 1, 1, 1, 4, 3],
            [1, 1, 1, 3, 4, 1],
            [1, 3, 1, 1, 4, 1],
            [1, 1, 4, 1, 1, 3],
            [1, 1, 4, 3, 1, 1],
            [4, 1, 1, 1, 1, 3],
            [4, 1, 1, 3, 1, 1],
            [1, 1, 3, 1, 4, 1],
            [1, 1, 4, 1, 3, 1],
            [3, 1, 1, 1, 4, 1],
            [4, 1, 1, 1, 3, 1],
            [2, 1, 1, 4, 1, 2],
            [2, 1, 1, 2, 1, 4],
            [2, 1, 1, 2, 3, 2],
            [2, 3, 3, 1, 1, 1, 2] // STOP
        ];

        var groupBars = docCB.groupItems.add();
        groupBars.name = "CB_" + texto + "_" + indiceCB;

        var cursorX = rLeft;
        var cursorY = rTop;

        for (var s = 0; s < sequence.length; s++) {
            var pattern = code128Patterns[sequence[s]];
            if (!pattern) continue;
            for (var j = 0; j < pattern.length; j++) {
                var w = pattern[j] * moduleWidth;
                if (j % 2 === 0) { // barra preta
                    var bar = docCB.pathItems.rectangle(cursorY, cursorX, w, alturaPt);
                    bar.filled = true;
                    bar.stroked = false;
                    bar.fillColor = criarCorPreta();
                    bar.move(groupBars, ElementPlacement.PLACEATBEGINNING);
                }
                cursorX += w;
            }
        }

        // Ajusta para largura/altura alvo
        if (groupBars.width !== 0) {
            var escalaLargura = larguraPt / groupBars.width;
            groupBars.resize(escalaLargura * 100, 100);
        }
        groupBars.height = alturaPt;

        // Centraliza no proprio retangulo placeholder
        groupBars.left = rLeft + (rectWidth - groupBars.width) / 2;
        groupBars.top = rTop - (rectHeight - groupBars.height) / 2;

        rectItem.remove();
        return true;

    } catch (e) {
        alert("Erro ao gerar CB: " + e);
        return false;
    }
}

// --- bounds da faca no doc de destino (separacao), com fallback ---
// Cache (1 entrada por doc): a faca nao se move dentro de uma separacao, entao
// reusamos o valor enquanto for o mesmo documento.
var _facaCacheDoc = null, _facaCacheVal = null;
function getFacaBoundsNoDoc(docAlvo) {
    if (docAlvo === _facaCacheDoc) return _facaCacheVal;
    var val = null;
    try {
        var lf = getLayerByName(docAlvo, "faca");
        if (lf && lf.pageItems.length > 0) {
            val = getFacaBounds(lf);
        }
    } catch (e) {}
    if (!val) val = resultado.facaBounds; // fallback: bounds do doc original
    _facaCacheDoc = docAlvo;
    _facaCacheVal = val;
    return val;
}

// --- abre um template, troca tokens, (opcional) gera barras, agrupa e duplica
//     para a layer "cotas" do docAlvo. Retorna o grupo no docAlvo (ou null).
//     Suprime o dialogo de "merge" de spot color e avisos de abertura. ---
function abrirTemplateParaDoc(docAlvo, caminhoTemplate, mapaTokens, fnBarras) {
    var arq = new File(caminhoTemplate);
    if (!arq.exists) {
        alert("Template nao encontrado: " + arq.fsName);
        return null;
    }

    var prevUIL = app.userInteractionLevel;
    var docT = null;
    var grupoNoAlvo = null;

    try {
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        // app.open pode falhar se o Illustrator estiver ocupado logo apos um
        // saveAs/close. Tenta algumas vezes com pausa/redraw antes de desistir.
        var tentativas = 0;
        while (docT === null && tentativas < 5) {
            try {
                docT = app.open(arq);
            } catch (eOpen) {
                tentativas++;
                try { app.redraw(); } catch (eR) {}
                $.sleep(200);
            }
        }
        if (docT === null) {
            throw new Error("Falha ao abrir o template apos varias tentativas: " + arq.fsName);
        }

        desbloquearEExibirTudo(docT);
        replaceInTextFrames(docT, mapaTokens, true); // achata ref/descr/maq se passar do max
        if (fnBarras) fnBarras(docT);

        var g = agruparTudoNoDocumento(docT);
        if (!g) throw new Error("Agrupamento do template falhou");

        var layerCotasDest = ensureLayerCotas(docAlvo);
        grupoNoAlvo = g.duplicate(layerCotasDest, ElementPlacement.PLACEATEND);

    } catch (e) {
        grupoNoAlvo = null;
        app.userInteractionLevel = prevUIL; // restaura para o alert aparecer
        alert("Erro no template (" + caminhoTemplate + "): " + e);
    } finally {
        // SEMPRE fecha o template e restaura o nivel de interacao, mesmo que
        // algo acima tenha lancado excecao (senao o script para em silencio).
        try { if (docT) docT.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
        app.userInteractionLevel = prevUIL;
        try { app.activeDocument = docAlvo; } catch (eAct) {}
    }

    return grupoNoAlvo;
}

// --- centro X (em pt) no doc de destino, com fallback ao original ---
var _centroCacheDoc = null, _centroCacheVal = null;
function getCentroXNoDoc(docAlvo) {
    if (docAlvo === _centroCacheDoc) return _centroCacheVal;
    var val = null;
    try {
        var lc = getLayerByName(docAlvo, "centro");
        if (lc && lc.pageItems.length > 0) {
            var b = lc.pageItems[0].geometricBounds; // [left, top, right, bottom]
            val = (b[0] + b[2]) / 2;
        }
    } catch (e) {}
    if (val === null) val = mmToPt(resultado.dados.centro.x);
    _centroCacheDoc = docAlvo;
    _centroCacheVal = val;
    return val;
}

// --- ETIQUETA DE CENTRO (todos os clientes) ---
// Abre etiqueta_centro.ai, troca tokens (mapping + cor da separacao), duplica,
// centraliza no objeto "centro", abaixo da faca (30mm se entrada>=100, senao
// 3mm) e espelha. Substitui o antigo place+embed (que perdia justificacao).
function criarEtiquetaCentro(docAlvo, indiceCor) {
    var mapaCentro = {};
    var k;
    for (k in mapping) {
        if (mapping.hasOwnProperty(k)) mapaCentro[k] = mapping[k];
    }
    mapaCentro["cor"] = cores[indiceCor];

    var grupoNoAlvo = abrirTemplateParaDoc(
        docAlvo,
        scriptDirectory + '/z_pdfs/etiqueta_centro.pdf',
        mapaCentro,
        null
    );
    if (!grupoNoAlvo) return;

    var fb = getFacaBoundsNoDoc(docAlvo);
    var facaBottom = fb[3];
    var centroX = getCentroXNoDoc(docAlvo);

    var distMM = (parseFloat(resultado.dados.entrada.altura) >= 100) ? 30 : 3;

    // ABAIXO da faca: topo do objeto a (distMM) abaixo da base da faca
    grupoNoAlvo.top = facaBottom - mmToPt(distMM);
    // Centralizado no eixo X do objeto "centro"
    grupoNoAlvo.left = centroX - (grupoNoAlvo.width / 2);
    // Espelha (igual ao place anterior)
    grupoNoAlvo.resize(-100, 100);
}

// --- ETIQUETA DE COR (somente artivinco_itatiba/santa_rosa e somar_papelao) ---
// Abre etiqueta_cor.pdf, troca ref/descr/qtdc, duplica em 2 (esquerda e direita)
// alinhadas as laterais da faca, abaixo da faca (40mm se entrada>=100, senao
// 3mm) e espelha.
function criarEtiquetaDeCor(docAlvo, indiceCor) {
    var qtdc = (indiceCor + 1) + "/" + cores.length;
    var mapaCor = {
        "cor": cabVal(function(){ return cores[indiceCor]; }),
        "ref": cabVal(function(){ return ref; }),
        "descr": cabVal(function(){ return clienteOnd; }),
        "qtdc": qtdc
    };

    var grupoNoAlvo = abrirTemplateParaDoc(
        docAlvo,
        scriptDirectory + '/z_pdfs/etiqueta_cor.pdf',
        mapaCor,
        null
    );
    if (!grupoNoAlvo) return;

    var fb = getFacaBoundsNoDoc(docAlvo);
    var facaLeft = fb[0],
        facaRight = fb[2],
        facaBottom = fb[3];

    var distMM = (parseFloat(resultado.dados.entrada.altura) >= 100) ? 40 : 3;
    var topo = facaBottom - mmToPt(distMM);

    // ESQUERDA: borda esquerda na lateral esquerda da faca
    grupoNoAlvo.top = topo;
    grupoNoAlvo.left = facaLeft;
    grupoNoAlvo.resize(100, -100); // espelha na VERTICAL (somar/artivinco)

    // DIREITA: duplica (ja espelhada) e alinha borda direita na lateral direita
    var grupoDir = grupoNoAlvo.duplicate();
    grupoDir.top = topo;
    grupoDir.left = facaRight - grupoDir.width;
}

// --- cria as 2 etiquetas Penha (1/4 e 3/4) para a cor indiceCor ---
function criarEtiquetasPenha(docAlvo, indiceCor) {
    var fiBarra = cabVal(function(){ return extrairAntesDaBarra(np); });
    var codcorAtual = cabVal(function(){ return extrairDepoisDaBarraSeguro(referenciaCor[indiceCor]); });
    var qtdc = (indiceCor + 1) + "/" + cores.length;

    // Tokens [[...]] do template (keys sem colchetes; replaceInTextFrames cuida do regex)
    var mapaPenha = {
        "cor": cabVal(function(){ return cores[indiceCor]; }),
        "data": cabVal(function(){ return getDataAtualFormatada(); }),
        "esp": cabVal(function(){ return espessura; }),
        "maq": cabVal(function(){ return maquina ? primeirasDuasPalavras(maquina) : ""; }),
        "fi/": fiBarra,
        "codcor": codcorAtual,
        "lpc": cabVal(function(){ return lpc; }),
        "qtdc": qtdc,
        "loc": cabVal(function(){ return localizacaoPenha; })
    };

    var grupoNoAlvo = abrirTemplateParaDoc(
        docAlvo,
        scriptDirectory + '/z_pdfs/Etiqueta_Penha.pdf',
        mapaPenha,
        function (docT) {
            var rectProduto = encontrarRectPorSpot(docT, "produtoComUnderline");
            var rectCodcor = encontrarRectPorSpot(docT, "codcorAtual");
            // CB da fi (rect produtoComUnderline) e CB do codcor (rect codcorAtual)
            gerarCode128SobreRect(docT, fiBarra, rectProduto, 31.1811, 147.402, indiceCor);
            gerarCode128SobreRect(docT, codcorAtual, rectCodcor, 28.3465, 93.5433, indiceCor);
        }
    );
    if (!grupoNoAlvo) return;

    var fb = getFacaBoundsNoDoc(docAlvo);
    var facaLeft = fb[0],
        facaTop = fb[1],
        facaRight = fb[2];
    var larguraFaca = facaRight - facaLeft;

    // 1/4 da largura da faca, 40mm ACIMA da faca
    grupoNoAlvo.top = facaTop + mmToPt(40) + grupoNoAlvo.height;
    grupoNoAlvo.left = (facaLeft + larguraFaca * 0.25) - (grupoNoAlvo.width / 2);
    grupoNoAlvo.resize(-100, 100); // espelha igual a etiqueta de centro

    // 3/4 da largura: duplica a etiqueta ja espelhada e so reposiciona em X
    var grupo34 = grupoNoAlvo.duplicate();
    grupo34.top = facaTop + mmToPt(40) + grupo34.height;
    grupo34.left = (facaLeft + larguraFaca * 0.75) - (grupo34.width / 2);
}

// ======================================
// LOCALIZACAO (Penha) - pergunta uma vez
// ======================================
if (isPenha) {
    var dlgLoc = new Window("dialog", "Localizacao");
    dlgLoc.orientation = "column";
    dlgLoc.alignChildren = "left";
    dlgLoc.add("statictext", undefined, "Digite a localizacao:");
    var inputLoc = dlgLoc.add("edittext", undefined, "");
    inputLoc.characters = 30;
    inputLoc.active = true;
    var grpLoc = dlgLoc.add("group");
    grpLoc.alignment = "right";
    // {name}: fechamento NATIVO (onClick->close entra em loop pelo painel CEP).
    // Valida no laco apos o show: mantem aberto enquanto vazio.
    var btnLocOk = grpLoc.add("button", undefined, "OK", { name: "ok" });
    var btnLocCancel = grpLoc.add("button", undefined, "Cancelar", { name: "cancel" });
    var rLoc;
    do {
        rLoc = dlgLoc.show();
        if (rLoc === 1 && inputLoc.text === "") { alert("A localizacao deve ser preenchida ou clique em Cancelar."); }
    } while (rLoc === 1 && inputLoc.text === "");
    localizacaoPenha = (rLoc === 1) ? inputLoc.text : "";
}


// ======================================
// PAUSA / CONFIRMACAO ANTES DE CRIAR OS ARQUIVOS
// ======================================
// Ultima chance de cancelar antes de gerar os arquivos .ai dos riscos.
// confirm() retorna true em "Sim" e false em "Nao".
var prosseguirCriacao = confirm(
    "Tudo pronto para gerar os arquivos de risco (" + quantidadeDocumentos + " arquivo(s)).\n\n" +
    "SIM  = criar os arquivos Illustrator dos riscos agora.\n" +
    "NAO  = cancelar agora (nenhum arquivo sera criado).",
    false,
    "Risco da Faca - Confirmar criacao"
);

if (prosseguirCriacao) {

// Guarda a 1a separacao para copiar dela os PDFs auxiliares nas demais cores.
var docPrimeiraCor = null;

// Esconde a arte no docOriginal para o clone NAO puxar a layer pesada da arte
// (economiza processamento - ela seria removida da separacao de qualquer jeito).
// Restaurada no fim do loop.
for (var _hl = 0; _hl < nomesLayersRisco.length; _hl++) {
    try { docOriginal.layers.getByName(nomesLayersRisco[_hl]).visible = false; } catch (e) {}
}

// Marca o inicio da geracao (para o log de tempo no fim).
var _tInicio = new Date().getTime();

// ======================================
// LOOP
// ======================================

for (var i = 0; i < quantidadeDocumentos; i++) {

    // ==========================
    // CRIA NOVO DOCUMENTO
    // ==========================

    // Cria a separacao SEGUINDO a unidade de medida do arquivo MAE. ATENCAO:
    // Document.rulerUnits e READ-ONLY (setar depois nao faz nada) - a unidade so
    // pode ser definida na CRIACAO, via DocumentPreset + addDocument. Fallback pro
    // metodo antigo (documents.add) se o addDocument falhar -> nunca quebra.
    var novoDoc = null;
    try {
        var _preset = new DocumentPreset();
        _preset.colorMode = docOriginal.documentColorSpace;
        _preset.units = docOriginal.rulerUnits; // <- segue o mestre (mm se o mae for mm)
        _preset.width = docOriginal.width;
        _preset.height = docOriginal.height;
        _preset.numArtboards = 1;
        // o startupPreset (nome do perfil) varia por instalacao; tenta alguns e fica
        // com o 1o que criar o doc na COLORSPACE certa. O DocumentPreset sobrepoe.
        var _cands = ["", "Basic CMYK", "Basic RGB", "Web", "Print"];
        for (var _ci = 0; _ci < _cands.length && !novoDoc; _ci++) {
            try {
                var _d = app.documents.addDocument(_cands[_ci], _preset, false);
                if (_d && _d.documentColorSpace === docOriginal.documentColorSpace) {
                    novoDoc = _d;
                } else if (_d) {
                    try { _d.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
                }
            } catch (e) {}
        }
    } catch (eAdd) { novoDoc = null; }

    if (!novoDoc) {
        // fallback: jeito antigo (garante a colorspace; sai em points, mas nao quebra)
        novoDoc = app.documents.add(
            docOriginal.documentColorSpace,
            docOriginal.width,
            docOriginal.height
        );
    }

    // Nome que você quiser usar depois
    var nomeDocumento = nomesDocumentos[i];

    novoDoc.name = nomeDocumento;

    // ==========================
    // COPIA TUDO DO ORIGINAL
    // ==========================

    // Clona o conteudo do original para o novoDoc por DUPLICACAO DIRETA entre
    // documentos (preserva layers e posicao) em vez de copy/paste, que dependia
    // do clipboard/foco e falhava em silencio (documento vazio).
    clonarArtboardParaDoc(docOriginal, novoDoc);
    app.activeDocument = novoDoc;

    copiarSpots(
        docOriginal,
        novoDoc
    );

    // Separacao NAO leva a layer da arte; na "cut" mantem so os riscos da cor.
    prepararSeparacao(novoDoc, cores[i]);

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

    // PDFs auxiliares (cotas): cria na 1a cor; nas demais copia o grupo da 1a.
    if (i === 0) {
        criarPdfsAuxiliares(novoDoc);
        docPrimeiraCor = novoDoc;
    } else if (docPrimeiraCor) {
        copiarGrupoPorNome(docPrimeiraCor, novoDoc, "PDFS_AUX");
        app.activeDocument = novoDoc;
    }

    // Etiquetas montadas por template (abrir/trocar/duplicar). Criadas ANTES da
    // troca de spot, para que a spot "cor" delas tambem seja remapeada.

    // Etiqueta de centro: todos os clientes.
    criarEtiquetaCentro(novoDoc, i);

    // Etiquetas Penha: somente penha_sa (2 por cor, 1/4 e 3/4).
    if (isPenha) {
        criarEtiquetasPenha(novoDoc, i);
    }

    // Etiqueta de cor: somente os 3 clientes (esquerda e direita).
    if (isClienteCor) {
        criarEtiquetaDeCor(novoDoc, i);
    }

    app.activeDocument = novoDoc;

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

// Log de tempo de geracao (append em txt - serve para acompanhar e comparar).
try {
    var _tFim = new Date().getTime();
    var _segundos = ((_tFim - _tInicio) / 1000).toFixed(1);
    var _arqTempo = new File("~/Desktop/" + produtoComUnderline + "/montado/tempo_geracao.txt");
    _arqTempo.open("a");
    _arqTempo.write(getDataAtualFormatada() + "  -  " + cores.length + " cor(es)  -  " + _segundos + "s\n");
    _arqTempo.close();
} catch (e) {}

// Restaura a visibilidade das layers-fonte (arte + medidas) no arquivo principal.
for (var _rl = 0; _rl < nomesLayersRisco.length; _rl++) {
    try { docOriginal.layers.getByName(nomesLayersRisco[_rl]).visible = true; } catch (e) {}
}

} // fim do if (prosseguirCriacao) - cancelado pelo usuario nao cria arquivos


// No fim de tudo: deixa a layer "cut" do arquivo principal com o olinho
// desligado (os cuts continuam no arquivo, so ficam ocultos).
try {
    var cutLayerPrincipal = docOriginal.layers.getByName("cut");
    cutLayerPrincipal.visible = false;
} catch (e) {}

// "medidas" tambem nao vai pra impressao (so quadrados de apoio): esconde no fim
// no arquivo principal, igual a "cut". O conteudo permanece, so fica oculto.
try {
    docOriginal.layers.getByName("medidas").visible = false;
} catch (e) {}

var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "z_Complementos/Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

var cliente = jsonObject.Customer[0].@attributes.Name;
var status = jsonObject.Job[0].Work[0].@attributes.Status;
var scriptAlpha = jsonObject.Job[0].Automation[0].@attributes.Scripalpha;
var cpc = jsonObject.Order[0].@attributes.CustomerP;
var mode = jsonObject.CtP[0].@attributes.Mode;
var cac = jsonObject.Order[0].@attributes.CAC;
var np = jsonObject.Order[0].@attributes.NP;
var supplied = jsonObject.Job[0].Supplied[0].@attributes.Material;
var type = jsonObject.Job[0].Cameron[0].@attributes.Type;
var espessura = jsonObject.CtP[0].@attributes.Tickness;
var folder = jsonObject.Customer[0].@attributes.Folder;
var produtoComUnderline = jsonObject.Order[0].@attributes.Product;
var produto = produtoComUnderline.replace(/_/g, " ");
var nomeArte = jsonObject.Order[0].@attributes.Name;
var operadorNome = removerAcentos(jsonObject.Job[0].History[0].Appointment[1].@attributes.name);
if (operadorNome) {
    resultadoOperadorNome = operadorNome;
} else {
    resultadoOperadorNome = "Sem Entrada";
}
var operador = jsonObject.Job[0].History[0].Appointment[1].@attributes.login
if (operador) {
    resultadoOperador = operador;
} else {
    resultadoOperador = "Sem Entrada";
}

var ncores = jsonObject.Inks[0].Ink.length;
var pos = jsonObject.Job[0].Cameron[0].@attributes.Pos;
var lpi = jsonObject.Inks[0].Ink[0].@attributes.LPI;
var lpc = Math.round(lpi / 2.54);

var uScreen = [];
var cores = [];
var coresD = [];
var coresSemVernizBranco = [];
var dotShape = [];

for (i = 0; i < ncores; i++) {
    cores.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    coresSemVernizBranco.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    coresD.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    uScreen.push(jsonObject.Inks[0].Ink[i].@attributes.uScreen);
    dotShape.push(jsonObject.Inks[0].Ink[i].@attributes.DotShape);
}


// Mapeamento de substituições
var substituicoes = {
    "HD11": "TR01",
    "CRS08": "TR02",
    "CRS04": "TR03",
    "CRS16": "DT01",
    "CRS19": "DT02",
    "CRS22": "DT03",
    "CRS12": "DT04",
    "CRS11": "DT05",
    "CRS13": "DT06",
    "CRS14": "DT07",
    "CRS10": "DT08",
};

// Loop para percorrer o array
for (var i = 0; i < dotShape.length; i++) {
    // Verifica se a cor atual precisa de substituição
    if (substituicoes[dotShape[i]]) {
        // Faz a substituição usando replace
        dotShape[i] = substituicoes[dotShape[i]];
    }
}

// Removendo cores indesejadas
for (i = cores.length - 1; i >= 0; i--) {

    if (cores[i] === "X" || cores[i] === "W" || cores[i] === "Z" || cores[i] === "All" || cores[i].indexOf("##") !== -1) {
        cores.splice(i, 1);
        dotShape.splice(i, 1);
        coresD.splice(i, 1);
        uScreen.splice(i, 1);
        coresSemVernizBranco.splice(i, 1);

    } else if (coresSemVernizBranco[i] === "Branco" ||
        coresSemVernizBranco[i] === "Branco Localizado" ||
        coresSemVernizBranco[i] === "Branco Total" ||
        coresSemVernizBranco[i] === "Verniz Localizado" ||
        coresSemVernizBranco[i] === "Verniz" ||
        coresSemVernizBranco[i] === "Branco~ca" ||
        coresSemVernizBranco[i] === "Branco2" ||
        coresSemVernizBranco[i] === "Branco 2" ||
        coresSemVernizBranco[i] === "Verniz 2" ||
        coresSemVernizBranco[i] === "Verniz2") {

        coresSemVernizBranco.splice(i, 1);

    } else {

    }
}

for (i = cores.length - 1; i >= 0; i--) {

    // if (dotShape[i] != "C" && dotShape[i] != "R")
    coresD[i] = cores[i] + " " + dotShape[i];
    uScreen[i] = cores[i] + " " + uScreen[i];

}


var coresComNumeros = [];

for (var i = 0; i < cores.length; i++) {
    var numero = i + 1;
    var corComNumero = numero + " " + cores[i];
    coresComNumeros.push(corComNumero);
}

var closureInput = parseFloat(jsonObject.Job[0].Cylinder[0].@attributes.Reduced);
var cylinderSizeMM = parseFloat(jsonObject.Job[0].Cylinder[0].@attributes.Size);
var objectHeight = parseFloat(jsonObject.Job[0].Package[0].@attributes.Length) || 0;
var objectWidth = parseFloat(jsonObject.Job[0].Package[0].@attributes.Width) || 0;
var smudgePrintingHeight = parseFloat(jsonObject.Job[0].SmudgePrinting[0].@attributes.Length) || 0;
var smudgePrintingWidht = parseFloat(jsonObject.Job[0].SmudgePrinting[0].@attributes.Width) || 0;
var repetitions = parseFloat(jsonObject.Job[0].Repeat[0].@attributes.Length) || 0;
var lanes = parseFloat(jsonObject.Job[0].Repeat[0].@attributes.Width) || 0;
var sizeCameron = parseFloat(jsonObject.Job[0].Cameron[0].@attributes.Width) || 0;
var distanceCameron = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Cameron) || 0;
var distanceBetweenLanes = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Width) || 0;
var displacementBetweenLanes = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Length) || 0;
var montagem = repetitions * lanes;

// Convert millimeter values to points
objectWidth = objectWidth / 0.35277777777782;
objectHeight = objectHeight / 0.35277777777782;
cylinderSize = cylinderSizeMM / 0.35277777777782;
distanceBetweenLanes = distanceBetweenLanes / 0.35277777777782;
displacementBetweenLanes = displacementBetweenLanes / 0.35277777777782;
sizeCameron = sizeCameron / 0.35277777777782;
distanceCameron = distanceCameron / 0.35277777777782;
smudgePrintingHeight = smudgePrintingHeight / 0.35277777777782;
smudgePrintingWidht = smudgePrintingWidht / 0.35277777777782;


// Distância entre os retângulos
var distanceBetweenRectangles = ((objectWidth * lanes) + sizeCameron + (2 * distanceCameron) + ((distanceBetweenLanes * lanes) - distanceBetweenLanes));

// Calculate the total width and height of the assembly in points
var totalWidth = (objectWidth + distanceBetweenLanes) * lanes;
var totalHeight = (objectHeight + distanceBetweenLanes) * repetitions;

// Calculate the gap between repetitions
var gapBetweenRepetitions = (cylinderSize - (objectHeight * repetitions)) / repetitions;

// Array para armazenar os valores de Click
var clickArray = [];

// Obtendo o objeto "Click" do primeiro elemento de "Inks"
var clickObj = jsonObject.Inks[0].Click[0]["@attributes"];

// Percorrendo todas as chaves do objeto "Click"
for (var prop in clickObj) {
    // Verificando se o valor é diferente de 0 e não está vazio
    if (clickObj[prop] !== "0" && clickObj[prop] !== "") {
        // Adicionando o valor ao array após converter para inteiro
        clickArray.push(parseInt(clickObj[prop]));
    }
}


// ==================================================
// Gerador de Code128-B em Illustrator via JSX
// ==================================================
// Henrique, esse script gera barras desenhadas com pathItems.rectangle()
// Basta passar sua string na variável "codigo" no final
// ==================================================

function gerarCode128(texto) {
    var doc = app.activeDocument;
    var x = 100; // posição inicial X
    var y = 500; // posição Y (topo da barra)
    var barHeight = 50; // altura das barras
    var moduleWidth = 1; // largura mínima (1 módulo)

    // =============================
    // Tabela oficial Code128 (107 símbolos)
    // Cada item: [barra, espaço, barra, espaço, barra, espaço]
    // =============================
    var code128Patterns = [
        [2,1,2,2,2,2], [2,2,2,1,2,2], [2,2,2,2,2,1], [1,2,1,2,2,3], [1,2,1,3,2,2], 
        [1,3,1,2,2,2], [1,2,2,2,1,3], [1,2,2,3,1,2], [1,3,2,2,1,2], [2,2,1,2,1,3],
        [2,2,1,3,1,2], [2,3,1,2,1,2], [1,1,2,2,3,2], [1,2,2,1,3,2], [1,2,2,2,3,1],
        [1,1,3,2,2,2], [1,2,3,1,2,2], [1,2,3,2,2,1], [2,2,3,2,1,1], [2,2,1,1,3,2],
        [2,2,1,2,3,1], [2,1,3,2,1,2], [2,2,3,1,1,2], [3,1,2,1,3,1], [3,1,1,2,2,2],
        [3,2,1,1,2,2], [3,2,1,2,2,1], [3,1,2,2,1,2], [3,2,2,1,1,2], [3,2,2,2,1,1],
        [2,1,2,1,2,3], [2,1,2,3,2,1], [2,3,2,1,2,1], [1,1,1,3,2,3], [1,3,1,1,2,3],
        [1,3,1,3,2,1], [1,1,2,3,1,3], [1,3,2,1,1,3], [1,3,2,3,1,1], [2,1,1,3,1,3],
        [2,3,1,1,1,3], [2,3,1,3,1,1], [1,1,2,1,3,3], [1,1,2,3,3,1], [1,3,2,1,3,1],
        [1,1,3,1,2,3], [1,1,3,3,2,1], [1,3,3,1,2,1], [3,1,3,1,2,1], [2,1,1,3,3,1],
        [2,3,1,1,3,1], [2,1,3,1,1,3], [2,1,3,3,1,1], [2,1,3,1,3,1], [3,1,1,1,2,3],
        [3,1,1,3,2,1], [3,3,1,1,2,1], [3,1,2,1,1,3], [3,1,2,3,1,1], [3,3,2,1,1,1],
        [3,1,4,1,1,1], [2,2,1,4,1,1], [4,3,1,1,1,1], [1,1,1,2,2,4], [1,1,1,4,2,2],
        [1,2,1,1,2,4], [1,2,1,4,2,1], [1,4,1,1,2,2], [1,4,1,2,2,1], [1,1,2,2,1,4],
        [1,1,2,4,1,2], [1,2,2,1,1,4], [1,2,2,4,1,1], [1,4,2,1,1,2], [1,4,2,2,1,1],
        [2,4,1,2,1,1], [2,2,1,1,1,4], [4,1,3,1,1,1], [2,4,1,1,1,2], [1,3,4,1,1,1],
        [1,1,1,2,4,2], [1,2,1,1,4,2], [1,2,1,2,4,1], [1,1,4,2,1,2], [1,2,4,1,1,2],
        [1,2,4,2,1,1], [4,1,1,2,1,2], [4,2,1,1,1,2], [4,2,1,2,1,1], [2,1,2,1,4,1],
        [2,1,4,1,2,1], [4,1,2,1,2,1], [1,1,1,1,4,3], [1,1,1,3,4,1], [1,3,1,1,4,1],
        [1,1,4,1,1,3], [1,1,4,3,1,1], [4,1,1,1,1,3], [4,1,1,3,1,1], [1,1,3,1,4,1],
        [1,1,4,1,3,1], [3,1,1,1,4,1], [4,1,1,1,3,1], [2,1,1,4,1,2], [2,1,1,2,1,4],
        [2,1,1,2,3,2], [2,3,3,1,1,1,2] // STOP
    ];

    var startCode = 104;
    var stopCode = code128Patterns[106];

    // =====================================
    // Converter texto -> sequência de códigos
    // =====================================
    var sequence = [];
    sequence.push(startCode);

    for (var i = 0; i < texto.length; i++) {
        var code = texto.charCodeAt(i) - 32; // Code128-B mapeia ASCII 32–127
        sequence.push(code);
    }

    // Checksum
    var checksum = startCode;
    for (var i = 0; i < texto.length; i++) {
        checksum += sequence[i+1] * (i+1);
    }
    checksum = checksum % 103;
    sequence.push(checksum);

    // Stop
    sequence.push(106);

    // =====================================
    // Desenhar no Illustrator
    // =====================================
    for (var s = 0; s < sequence.length; s++) {
        var pattern = code128Patterns[sequence[s]];
        if (!pattern) continue;

        for (var j = 0; j < pattern.length; j++) {
            var w = pattern[j] * moduleWidth;
            if (j % 2 == 0) {
                var bar = doc.pathItems.rectangle(y, x, w, barHeight);
                bar.filled = true;
                bar.stroked = false;
            }
            x += w;
        }
    }
}

gerarCode128(produtoComUnderline);

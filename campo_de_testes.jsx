// Prompt para obter o número de ordem de serviço
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


// Gera conteúdo JSON "manual"
var jsonSafe = '"T0001"';



// Caminho do JSON
var jsonPath = Folder.temp.fsName + "/qrcode_data.json";
var jsonFile = new File(jsonPath);
jsonFile.open("w");
jsonFile.write(jsonSafe);
jsonFile.close();

// Caminho do script Python
var exePath = File($.fileName).parent.fsName + "/gerar_qr.exe";

// Executa comando no sistema
function systemCall(command) {
    var temp = new File(Folder.temp + "/temp_output.txt");
    var bat;

    if ($.os.indexOf("Windows") !== -1) {
        bat = new File(Folder.temp + "/run_temp.bat");
        bat.open("w");
        bat.writeln('@echo off');
        bat.writeln(command + ' > "' + temp.fsName + '" 2>&1');
        bat.close();
        bat.execute();
    } else {
        bat = new File(Folder.temp + "/run_temp.command");
        bat.open("w");
        bat.writeln("#!/bin/bash");
        bat.writeln(command + ' > "' + temp.fsName + '" 2>&1');
        bat.close();
        bat.execute();
    }

    $.sleep(3000);
    var output = "";
    if (temp.exists) {
        temp.open("r");
        output = temp.read();
        temp.close();
    }

    return { success: output.indexOf("OK:") !== -1, output: output };
}

// Alternativa ao .trim()
function safeTrim(str) {
    return str.replace(/^\s+|\s+$/g, '');
}

// Roda o Python
var comando = '"' + exePath + '" "' + jsonPath + '"';
var result = systemCall(comando);

// Processa saída
if (result.success) {
    var parts = result.output.split("OK:");
    if (parts.length > 1) {
        var outputPath = safeTrim(parts[1].replace(/[\r\n]+/g, ""));
        var qrFile = new File(outputPath);

        if (qrFile.exists) {
            var docOriginal = app.activeDocument;

            // Abre SVG temporário
            var tempDoc = app.open(qrFile);

            // Seleciona todos
            tempDoc.selectObjectsOnActiveArtboard();

            // Copia
            app.copy();

            // Volta pro original
            app.activeDocument = docOriginal;
            app.paste();

            // Garante existência da layer QRCode
            var qrLayer = null;
            var layers = docOriginal.layers;
            for (var i = 0; i < layers.length; i++) {
                if (layers[i].name === "QRCode") {
                    qrLayer = layers[i];
                    break;
                }
            }

            if (!qrLayer) {
                qrLayer = layers.add();
                qrLayer.name = "QRCode";
            }

            qrLayer.zOrder(ZOrderMethod.BRINGTOFRONT);

            // Move os itens colados para a layer QRCode
            var selection = docOriginal.selection;
            for (var j = 0; j < selection.length; j++) {
                selection[j].move(qrLayer, ElementPlacement.PLACEATBEGINNING);
            }

            // Fecha sem salvar e remove SVG
            tempDoc.close(SaveOptions.DONOTSAVECHANGES);
            if (qrFile.remove()) {
                //alert("QR Code SVG colado e deletado com sucesso!");
            } else {
                alert("QR Code colado, mas o SVG não foi deletado.");
            }
        } else {
            alert("QR Code SVG não encontrado.");
        }
    }
} else {
    alert("Erro ao gerar QR Code:\n" + result.output);
}


var doc = app.activeDocument;
doc.selectObjectsOnActiveArtboard();

// Buscar a cor [Registration] ou [Registro]
var registrationSwatch = null;
for (var i = 0; i < doc.swatches.length; i++) {
    var swatch = doc.swatches[i];
    if (swatch.name === "[Registration]" || swatch.name === "[Registro]") {
        registrationSwatch = swatch;
        break;
    }
}

if (registrationSwatch === null || registrationSwatch.color.typename !== "SpotColor") {
    //alert("Amostra [Registration] não encontrada ou inválida.");
} else {
    var regColor = new SpotColor();
    regColor.spot = registrationSwatch.color.spot;
    regColor.tint = 100;

    var selection = doc.selection;
    for (var i = 0; i < selection.length; i++) {
        var item = selection[i];
        
        if (item.typename === "CompoundPathItem") {
            for (var j = 0; j < item.pathItems.length; j++) {
                if (item.pathItems[j].filled) item.pathItems[j].fillColor = regColor;
                if (item.pathItems[j].stroked) item.pathItems[j].strokeColor = regColor;
            }
        } else if (item.typename === "PathItem") {
            if (item.filled) item.fillColor = regColor;
            if (item.stroked) item.strokeColor = regColor;
        } else if (item.typename === "GroupItem") {
            aplicarRecursivo(item, regColor);
        }
    }

    //alert("Pintura concluída!");
}

function aplicarRecursivo(group, color) {
    for (var i = 0; i < group.pageItems.length; i++) {
        var item = group.pageItems[i];
        if (item.typename === "CompoundPathItem") {
            for (var j = 0; j < item.pathItems.length; j++) {
                if (item.pathItems[j].filled) item.pathItems[j].fillColor = color;
                if (item.pathItems[j].stroked) item.pathItems[j].strokeColor = color;
            }
        } else if (item.typename === "PathItem") {
            if (item.filled) item.fillColor = color;
            if (item.stroked) item.strokeColor = color;
        } else if (item.typename === "GroupItem") {
            aplicarRecursivo(item, color);
        }
    }
}


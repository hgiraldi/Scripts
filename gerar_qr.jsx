// Gera conteúdo JSON "manual"
var jsonSafe = '{' +
  '"serviceOrderNumber":"' + serviceOrderNumber + '",' +
  '"cliente":"' + cliente + '",' +
  '"cores":[';

for (var i = 0; i < cores.length; i++) {
  jsonSafe += '"' + cores[i] + '"';
  if (i < cores.length - 1) {
    jsonSafe += ',';
  }
}
jsonSafe += ']}';

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

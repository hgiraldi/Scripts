#include "Xml_upload.jsx"

function LayerInfo(name, width, height) {
    this.name = name;
    this.width = width;
    this.height = height;
}

function pointsToMM(points) {
    return (points * 0.35278).toFixed(1); // Converte pontos para mm e formata com 1 casa decimal
}

function pointsToCM(points) {
    return (points * 0.035278).toFixed(0); // Converte pontos para cm e formata para inteiro
}

function saveXMLToFile(xmlContent, filePath) {
    var file = new File(filePath);
    file.encoding = "UTF-8"; // Define a codificação UTF-8 para o arquivo XML
    file.open("w"); // Abre o arquivo para escrita
    file.write(xmlContent); // Escreve o conteúdo XML no arquivo
    file.close(); // Fecha o arquivo
}

// Function to get platform-specific folder path
function getFolderPathCopyLog() {
    var folderPathCopy = "";

    // Check the operating system
    if ($.os.indexOf("Windows") !== -1) {
        // Windows folder path
        folderPathCopy = "\\\\aeserver16\\Engine\\_Jobfolder\\" + serviceOrderNumber + "\\_log\\";
    } else {
        // Mac folder path
        folderPathCopy = "/Engine/_Jobfolder/" + serviceOrderNumber + "/_log/";
    }

    return folderPathCopy;
}

// Obtém o caminho para a pasta de destino
var folderPathCopy = getFolderPathCopyLog();

// Defina o nome do arquivo XML aqui
var xmlFileName = serviceOrderNumber + "_AI_STAGGERED.xml"; // Substitua pelo nome desejado

// Definir a margem em milímetros
var margemMM = 0; // Substitua pelo valor de margem desejado
var margemCM = (margemMM / 10).toFixed(1); // Converte a margem para centímetros

function groupLayersAndGenerateXML() {
    var doc = app.activeDocument;
    var layerInfoArray = [];

    // Contador de jobColors baseado no prefixo das layers
    var jobColorsCount = {}; // Armazenará as cores únicas
    var uniqueColorCount = 0; // Contador de cores únicas

    // Percorre todas as layers no documento
    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];

        if (layer.pageItems.length > 0) {
            layer.hasSelectedArtwork = true;
            var group = app.executeMenuCommand('group');
            group = doc.selection[0];

            // Converte as medidas do grupo para mm e cm
            var widthInMM = (parseFloat(pointsToMM(group.width)) + parseFloat(margemMM)).toFixed(1);
            var heightInMM = (parseFloat(pointsToMM(group.height)) + parseFloat(margemMM)).toFixed(1);
            var widthInCM = (parseFloat(pointsToCM(group.width)) + parseFloat(margemCM)).toFixed(0);
            var heightInCM = (parseFloat(pointsToCM(group.height)) + parseFloat(margemCM)).toFixed(0);

            // Armazenar o prefixo do nome para contar cores (ex: azul1, azul2 -> azul)
            var colorPrefix = layer.name.replace(/\d+$/, ''); // Remove dígitos finais do nome

            // Contabiliza cores únicas
            if (!jobColorsCount[colorPrefix]) {
                jobColorsCount[colorPrefix] = true; // Marca o prefixo como visto
                uniqueColorCount++; // Incrementa o contador de cores únicas
            }

            var layerInfo = new LayerInfo(layer.name, widthInMM, heightInMM);
            layerInfoArray.push({
                name: layer.name,
                widthInMM: widthInMM,
                heightInMM: heightInMM,
                widthInCM: widthInCM,
                heightInCM: heightInCM
            });

            group.name = layer.name;
            doc.selection = null;
        }
    }

    // Contar as layers (Plates)
    var platesCount = layerInfoArray.length;

    // Gerar o XML
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Billing>\n';
    xml += '    <Customer Billed="0" Operador="' + resultadoOperadorNome + '" Folder="' + folder + '" JobColors="' + uniqueColorCount + '" Name="' + cliente + '" Order="' + serviceOrderNumber + '" Plates="' + platesCount + '" crop="" mb="" ml="" mr="" mt="" operator="' + resultadoOperador + '" spetialcrop=""/>\n';

    for (var j = 0; j < layerInfoArray.length; j++) {
        var info = layerInfoArray[j];
        var plateType = j === 0 ? "PARTIALPLATE" : "PARTIALPLATE";
        xml += '    <' + plateType + ' Name="' + info.name + '" data="' + (j+1) + '_' + info.name + '_' + info.heightInMM + 'x' + info.widthInMM + '" n="1" x="' + info.widthInCM + '" xmm="' + info.widthInMM + '" y="' + info.heightInCM + '" ymm="' + info.heightInMM + '"/>\n';
    }

    xml += '</Billing>';

    // Salva o XML no arquivo
    saveXMLToFile(xml, folderPathCopy + xmlFileName);

    // Mensagem de sucesso
    alert("MEDIDAS GERADAS");
}

groupLayersAndGenerateXML();

#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

function showDialog(colors) {
    var dialog = new Window('dialog', 'Definir Quantidade de Placas por Cor');
    dialog.alignChildren = 'fill';

    var inputFields = {};
    
    for (var i = 0; i < colors.length; i++) {
        var group = dialog.add('group');
        group.add('statictext', undefined, colors[i] + ':');
        inputFields[colors[i]] = group.add('edittext', undefined, '0');
        inputFields[colors[i]].characters = 5;
    }

    var buttonGroup = dialog.add('group');
    buttonGroup.alignment = 'center';
    var okButton = buttonGroup.add('button', undefined, 'OK', { name: 'ok' });
    var cancelButton = buttonGroup.add('button', undefined, 'Cancel', { name: 'cancel' });
    
    var result = dialog.show();

    if (result === 1) { // Usuário clicou OK
        var platesCount = {};
        for (var i = 0; i < colors.length; i++) {
            var color = colors[i];
            platesCount[color] = parseInt(inputFields[color].text, 10);
        }
        return platesCount;
    } else { // Usuário clicou Cancel
        return null;
    }
}

// Função para criar layers com base nas cores e quantidades fornecidas
function createColorLayers(doc, platesCount) {
    var layersToKeep = [];
    
    for (var color in platesCount) {
        if (platesCount.hasOwnProperty(color)) {
            var count = platesCount[color];
            for (var i = 1; i <= count; i++) {
                var layerName = color + i;
                var newLayer = doc.layers.add();
                newLayer.name = layerName;
                layersToKeep.push(layerName);
            }
        }
    }
    
    return layersToKeep;
}

// Função para deletar a layer com nome "Layer 1"
function deleteLayerByName(doc, layerName) {
    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (layer.name === layerName) {
            layer.remove();
            break; // Sai do loop após encontrar e remover a layer
        }
    }
}

// Exemplo de uso
var doc = app.activeDocument;
var platesCount = showDialog(cores);

if (platesCount) {
    var layersToKeep = createColorLayers(doc, platesCount);
    deleteLayerByName(doc, "Layer 1");
}


// Nome do arquivo de texto que você deseja criar
var nomeArquivoTxt = nomeScript + "_" + cliente + "_" + serviceOrderNumber + "_" + produtoComUnderline + "_" + resultadoOperador;

// Função para obter o caminho da pasta
function getFolderPathUtilizacao() {
    var pastaDestino = "";

    // Check the operating system
    if ($.os.indexOf("Windows") !== -1) {
        // Windows folder path
        pastaDestino = "\\\\192.168.1.15\\uteis\\_Padroes_clientes_Alpha\\_Scripts\\Utilizacao\\Companion\\";
    } else {
        // Mac folder path
        pastaDestino = "/uteis/_Padroes_clientes_Alpha/_Scripts/Utilizacao/Companion/";
    }

    return pastaDestino;
}

// Obtém o caminho da pasta
var pastaDestino = getFolderPathUtilizacao();

var conteudo = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>' +
    '<Illustrator Origem ="' + nomeScript + '">' +
    '<Log Cliente ="' + cliente + '"' +
    ' Script ="' + nomeScript + '"' +
    ' Order ="' + serviceOrderNumber + '"' +
    ' CP ="' + produtoComUnderline + '"' +
    ' Operador ="' + resultadoOperadorNome + '"/>' +
    '</Illustrator>'

// Cria o objeto File para o arquivo de texto
var arquivoTxt = new File(pastaDestino + "/" + nomeArquivoTxt + ".xml");

// Cria o arquivo e escreve o conteúdo
arquivoTxt.open("w");
arquivoTxt.write(conteudo);
arquivoTxt.close();

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

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_LayersOndulado";

// Cria o objeto File para o destino de cópia
var destinoDaCopia = new File(folderPathCopy + "/" + nomeArquivoTxtCopy + ".xml");

// Copia o arquivo para o destino
if (arquivoTxt.copy(destinoDaCopia)) {

} else {
   // alert("VERIFICAR SE ESTA CONECTADO COM O AUTOMATION");
}



//============================CSV====================================//

// Função para obter a data atual em formato "YYYY-MM-DD HH:MM:SS"
function getCurrentDateTime() {
    var now = new Date();
    return now.getFullYear() + "-" +
           ("0" + (now.getMonth() + 1)).slice(-2) + "-" +
           ("0" + now.getDate()).slice(-2) + " " +
           ("0" + now.getHours()).slice(-2) + ":" +
           ("0" + now.getMinutes()).slice(-2) + ":" +
           ("0" + now.getSeconds()).slice(-2);
}

// Dados para o CSV
var linhaCSV = resultadoOperadorNome + "," +
               nomeScript + "," +
               serviceOrderNumber + "," +
               cliente + "," +
               banda + "," +
               "1," +
               getCurrentDateTime() + "\n";

// Caminho do arquivo CSV
var arquivoCSV = new File(pastaDestino + "/data_records.csv");

// Abre o arquivo CSV para append (adicionar linha ao final)
arquivoCSV.open("a");
arquivoCSV.write(linhaCSV);
arquivoCSV.close();


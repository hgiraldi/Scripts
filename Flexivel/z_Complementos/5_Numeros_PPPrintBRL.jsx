#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;


// Create a new layer for the numbers
var numbersLayer = app.activeDocument.layers.add();
numbersLayer.name = "numeros";

// Função para criar a caixa de diálogo
function criarCaixaDialogo() {
    var dialogBox = new Window("dialog", "Escolha a Orientação dos Números");

    // Radios + OK {name:"ok"} (fechamento NATIVO). Os 3 botoes-acao antigos
    // fechavam via onClick e entravam em loop quando rodados pelo painel CEP.
    dialogBox.orientation = "column";
    dialogBox.alignChildren = "left";
    var rbHor = dialogBox.add("radiobutton", undefined, "Horizontal");
    var rbDir = dialogBox.add("radiobutton", undefined, "Vertical para a Direita");
    var rbEsq = dialogBox.add("radiobutton", undefined, "Vertical para a Esquerda");
    rbHor.value = true;
    var grpNum = dialogBox.add("group");
    grpNum.alignment = "right";
    grpNum.add("button", undefined, "OK", { name: "ok" });

    dialogBox.show();

    if (rbDir.value) orientacaoEscolhida = "verticalDireita";
    else if (rbEsq.value) orientacaoEscolhida = "verticalEsquerda";
    else orientacaoEscolhida = "horizontal";
}

// Chame a função da caixa de diálogo
var orientacaoEscolhida;
criarCaixaDialogo();

function createNumberHorizontalConver(number, left, top) {
    var textFrame = app.activeDocument.textFrames.add(numbersLayer);
    if (number < 10) {
        textFrame.contents = "0" + number.toString();
    } else {
        textFrame.contents = number.toString();
    }
    textFrame.left = left + objectWidth + 10;
    textFrame.top = top;
    textFrame.textRange.characterAttributes.size = 2 * 2.83464567; // 2 mm in points
    textFrame.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
}

function createNumberVerticalNegative90Conver(number, left, top) {
    var textFrame = app.activeDocument.textFrames.add(numbersLayer);
    textFrame.rotate(-90);
    if (number < 10) {
        textFrame.contents = "0" + number.toString();
    } else {
        textFrame.contents = number.toString();
    }
    textFrame.left = left + objectWidth + 10;
    textFrame.top = top;
    textFrame.textRange.characterAttributes.size = 2 * 2.83464567; // 2 mm in points
    textFrame.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
}

function createNumberVertical90Conver(number, left, top) {
    var textFrame = app.activeDocument.textFrames.add(numbersLayer);
    textFrame.rotate(90);
    if (number < 10) {
        textFrame.contents = "0" + number.toString();
    } else {
        textFrame.contents = number.toString();
    }
    textFrame.left = left + objectWidth + 10;
    textFrame.top = top;
    textFrame.textRange.characterAttributes.size = 2 * 2.83464567; // 2 mm in points
    textFrame.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
}

// Function to create and position a number
function createNumberHorizontal(number, left, top) {
    var textFrame = app.activeDocument.textFrames.add(numbersLayer);
    textFrame.contents = "- " + number.toString();
    textFrame.left = left + objectWidth + 10;
    textFrame.top = top;
    textFrame.textRange.characterAttributes.size = 2 * 2.83464567; // 2 mm in points
    textFrame.textRange.characterAttributes.textFont = app.textFonts.getByName("Futura-Bold");
}

function createNumberVertical90(number, left, top) {
    var textFrame = app.activeDocument.textFrames.add(numbersLayer);
    textFrame.rotate(90);
    textFrame.contents = "- " + number.toString();
    textFrame.left = left + objectWidth + 10;
    textFrame.top = top;
    textFrame.textRange.characterAttributes.size = 2 * 2.83464567; // 2 mm in points
    textFrame.textRange.characterAttributes.textFont = app.textFonts.getByName("Futura-Bold");
}

function createNumberVerticalNegative90(number, left, top) {
    var textFrame = app.activeDocument.textFrames.add(numbersLayer);
    textFrame.rotate(-90);
    textFrame.contents = "- " + number.toString();
    textFrame.left = left + objectWidth + 10;
    textFrame.top = top;
    textFrame.textRange.characterAttributes.size = 2 * 2.83464567; // 2 mm in points
    textFrame.textRange.characterAttributes.textFont = app.textFonts.getByName("Futura-Bold");
}

// Create numbers for each repetition and lane
for (var r = 0; r < repetitions; r++) {
    var startNumber = 1;

    for (var l = 0; l < lanes; l++) {
        // Calculate the position of the number in points
        var left = l * (objectWidth + distanceBetweenLanes);
        var top = r * (objectHeight + gapBetweenRepetitions);

        // Apply displacement between lanes for even lanes (pistas pares)
        if (l % 2 === 0) {
            top += displacementBetweenLanes;
        }

        // Calculate the current number of identification for this pista
        var currentNumber = startNumber + l;


        // variável orientacaoEscolhida em um if
        if (orientacaoEscolhida === "horizontal") {
            if (folder == "conver") {
                createNumberHorizontalConver(currentNumber, left, top);
            } else {
                createNumberHorizontal(currentNumber, left, top);
            }
        } else if (orientacaoEscolhida === "verticalDireita") {
            if (folder == "conver") {
                createNumberVertical90Conver(currentNumber, left, top);
            } else {
                createNumberVertical90(currentNumber, left, top);
            }
        } else if (orientacaoEscolhida === "verticalEsquerda") {
            if (folder == "conver") {
                createNumberVerticalNegative90Conver(currentNumber, left, top);
            } else {
                createNumberVerticalNegative90(currentNumber, left, top);
            }
        }
    }

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

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_NumeroPistas";

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
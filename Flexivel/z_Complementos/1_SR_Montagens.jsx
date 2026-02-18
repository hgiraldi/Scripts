//serviceOrderNumber = "1377974"

#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

// Salvar o objeto selecionado em uma variável
var selectedObject = app.activeDocument.selection[0];

//Verificar posicao do arquivo
if ((objectHeight >= objectWidth) && (selectedObject.height >= selectedObject.width)) {


} else if ((objectHeight <= objectWidth) && (selectedObject.height <= selectedObject.width)) {


} else {

    selectedObject.rotate(90);
    alert("Link rotacionado para fazer a montagem")

}


// Criar a camada "arte" se ela não existir
var artLayer = app.activeDocument.layers.add();
artLayer.name = "arte";

// Duplicate objects and create the assembly based on the specified parameters
for (var r = 0; r < repetitions; r++) {
    for (var l = 0; l < lanes; l++) {
        // Duplicate the selected object
        var duplicate = selectedObject.duplicate(artLayer);


        // Calculate the position of the duplicate object in points
        var left = l * (objectWidth + distanceBetweenLanes);
        var top = r * (objectHeight + gapBetweenRepetitions);

        // Move the duplicate object to the calculated position
        duplicate.left = left;


        // Apply displacement between lanes for even lanes (pistas pares)
        if (l % 2 === 0) {
            duplicate.top = top + displacementBetweenLanes;
        } else {
            duplicate.top = top; // For odd lanes, no displacement is applied

        }
    }
}

// Apagar o objeto original selecionado
selectedObject.remove();


//calcular artboard
var alturaArtboard = cylinderSize + 56.7 + displacementBetweenLanes;
var larguraArtboard = distanceBetweenRectangles + 56.7;

// Definir o tamanho do artboard
var doc = app.activeDocument;
var newArtboardRect = [
    0, // left
    (alturaArtboard / 2), // top
    larguraArtboard, // right
    -(alturaArtboard / 2) // bottom (note o sinal negativo aqui)
];

doc.artboards[0].artboardRect = newArtboardRect;

// Selecionar toda a camada "arte"
var artLayer = app.activeDocument.layers.getByName("arte");
artLayer.hasSelectedArtwork = true;

// Agrupar os objetos selecionados
app.executeMenuCommand("group");

// Ajustar o grupo ao centro do artboard
var group = app.activeDocument.groupItems[0]; // Selecionar o grupo criado
var centerX = newArtboardRect[0] + (newArtboardRect[2] - newArtboardRect[0]) / 2;
var centerY = newArtboardRect[1] - (newArtboardRect[1] - newArtboardRect[3]) / 2;
var groupBounds = group.geometricBounds;
var groupCenterX = (groupBounds[0] + groupBounds[2]) / 2;
var groupCenterY = (groupBounds[1] + groupBounds[3]) / 2;
var deltaX = centerX - groupCenterX;
var deltaY = centerY - groupCenterY;
group.translate(deltaX, deltaY);

// Mover todos os objetos do grupo para a camada "arte"
while (group.pageItems.length > 0) {
    var item = group.pageItems[0];
    item.move(artLayer, ElementPlacement.PLACEATEND);
}

// Deletar o grupo vazio
group.remove();

// Esconder a camada "arte"
artLayer.visible = false;

// Verifica se a layer "registros" existe, caso contrário, cria uma nova layer com o nome "registros"
var layerRegistros = null;
try {
    layerRegistros = doc.layers.getByName("registros");
} catch (e) {
    layerRegistros = doc.layers.add();
    layerRegistros.name = "registros";
}

// ==================== Verificação de link =====================//
// Obtém todos os links no documento
var links = doc.placedItems;

// Define uma variável para rastrear se há algum problema
var temProblema = false;

// Itera sobre os links e verifica se a variável produtoComUnderline está presente nos nomes
for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var linkNome = link.file.name; // Obtém o nome do link

    // Verifica se a variável produtoComUnderline está presente no nome do link
    if (linkNome.indexOf(produtoComUnderline) === -1) {
        temProblema = true;
        break; // Sai do loop assim que encontrar um problema
    }
}



// Altera para a layer "registros" 
doc.activeLayer = layerRegistros;

// Cria a cor de spot "PassarRegistration" fora da função
var passarRegistration = createSpotColor("PassarRegistration", [100, 0, 0, 0]);

function createSpotColor(name, colorValues) {
    var doc = app.activeDocument;

    // Verifique se a cor de spot com o nome especificado já existe
    var existingSpot = findSpotColorByName(name);

    if (existingSpot) {
        // Se a cor de spot já existir, não faça nada e retorne a cor de spot existente
        return existingSpot;
    } else {
        // Caso contrário, crie uma nova cor de spot
        var newSpot = doc.spots.add();
        newSpot.name = name;

        // Defina os valores de cor para a cor de spot
        var spotColor = newSpot.color;
        spotColor.spotKind = SpotColorKind.SPOTCMYK;
        spotColor.colorValue = colorValues; // Substitua colorValues pelos valores CMYK desejados

        return newSpot;
    }
}

// Função auxiliar para encontrar uma cor de spot pelo nome
function findSpotColorByName(name) {
    var doc = app.activeDocument;
    var spotColors = doc.spots;

    for (var i = 0; i < spotColors.length; i++) {
        if (spotColors[i].name === name) {
            return spotColors[i]; // Retorna a cor de spot encontrada
        }
    }

    return null; // Retorna null se a cor de spot não for encontrada
}

// Pintando de registration
var doc = app.activeDocument;
var registrationColor = findRegistrationColor(doc);

var doc = app.activeDocument;

function findRegistrationColor(document) {
    var swatches = document.swatches;
    for (var i = 0; i < swatches.length; i++) {
        var swatch = swatches[i];
        if ((swatch.name === "[Registration]") || (swatch.name === "[Registro]")) {
            return swatch.color;
        }
    }
    return null; // Retorna null se a cor [registration] não for encontrada
}

// Função para verificar se uma cor já existe na paleta de amostras
function swatchExists(name) {
    for (var i = 0; i < doc.spots.length; i++) {
        var spot = doc.spots[i];
        if (spot.name === name) {
            return true;
        }
    }
    return false;
}

// Função para criar uma nova cor Spot e adicioná-la à paleta de amostras
function createSpotColorCMYK(c, m, y, k, colorName) {
    if (!swatchExists(colorName)) {
        var newSpot = doc.spots.add();
        newSpot.name = colorName;
        var newColor = new CMYKColor();
        newColor.cyan = c;
        newColor.magenta = m;
        newColor.yellow = y;
        newColor.black = k;
        newSpot.color = newColor;
    }
}

// Função para excluir cores da paleta de amostras
function excluirCores(paleta, nomesCores) {
    for (var i = paleta.length - 1; i >= 0; i--) {
        var cor = paleta[i];
        for (var j = 0; j < nomesCores.length; j++) {
            if (cor.name === nomesCores[j]) {
                cor.remove();
                break; // Sair do loop interno após encontrar a cor
            }
        }
    }
}

// Nomes das cores a serem removidas
var nomesCoresParaRemover = ["Cyan", "Magenta", "Yellow", "Black"];

// Obtém o documento ativo
var documentoAtivo = app.activeDocument;

// Obtém a paleta de amostras do documento ativo
var paletaAmostras = documentoAtivo.swatches;

// Chama a função para excluir as cores
excluirCores(paletaAmostras, nomesCoresParaRemover);


// Criar cores Spot na paleta de amostras
createSpotColorCMYK(100, 0, 0, 0, "Cyan");
createSpotColorCMYK(0, 100, 0, 0, "Magenta");
createSpotColorCMYK(0, 0, 100, 0, "Yellow");
createSpotColorCMYK(0, 0, 0, 100, "Black");

// Listar todas as cores na paleta de amostras
var allColors = [];

// Função para verificar se uma cor é indesejada
function isUnwantedColor(color) {
    // Adicione aqui qualquer lógica para verificar se a cor é indesejada
    return false; // Exemplo: não faz nenhuma verificação por enquanto
}

// Loop através das cores no documento do Illustrator
for (var k = 0; k < doc.swatches.length; k++) {
    var swatch = doc.swatches[k];
    var swatchColor = swatch.color;
    var nomeCor = swatch.name;

    // Verifique se o nome da cor ESPECIAIS
    if (nomeCor === "PANTONE Black C" || nomeCor === "PANTONE Yellow C") {
        allColors.push(nomeCor);
    } else {
        // Aplicar substituições apenas para outras cores
        nomeCor = nomeCor.replace(/PROCESS /g, '').replace(/PANTONE /g, '').replace(/ C/g, '');
        allColors.push(nomeCor);
    }
}


// Array para armazenar as cores em comum
var coresComuns = [];

// Função para verificar se uma cor está em um array
function corEstaNoArray(cor, array) {
    for (var i = 0; i < array.length; i++) {
        if (cor.toLowerCase() === array[i].toLowerCase()) {
            return true;
        }
    }
    return false;
}

// Loop através do array 'cores' para encontrar cores comuns
for (var i = 0; i < cores.length; i++) {
    var cor = cores[i];

    // Verifica se a cor também está em 'allColors' usando a função personalizada
    if (corEstaNoArray(cor, allColors) && !corEstaNoArray(cor, coresComuns)) {
        coresComuns.push(cor);
    }
}


// Função para aplicar cor ao texto com base na sequência de coresComuns

function aplicarCorTexto(texto, cor) {
    // Converte a cor de entrada para minúsculas
    var corNormalizada = cor.toLowerCase();

    var corEncontrada = false; // Flag para rastrear se a cor foi encontrada

    // Itera sobre as amostras de cores
    for (var k = 0; k < doc.swatches.length; k++) {
        var swatch = doc.swatches[k];
        var swatchColor = swatch.color;
        var nomeCorOriginal = swatch.name.toLowerCase();

        // Verifica correspondência direta (prioridade máxima)
        if (nomeCorOriginal === corNormalizada) {
            texto.textRange.characterAttributes.fillColor = swatchColor;
            //alert("Encontrou correspondência direta: " + cor);
            corEncontrada = true;
            return;
        }
    }

    // Se nenhuma correspondência direta foi encontrada, tenta normalizar
    if (!corEncontrada) {
        for (var k = 0; k < doc.swatches.length; k++) {
            var swatch = doc.swatches[k];
            var swatchColor = swatch.color;
            var nomeCorOriginal = swatch.name.toLowerCase();

            // Normaliza o nome da cor
            var nomeCorNormalizado = nomeCorOriginal
                .replace(/process /g, '')
                .replace(/pantone /g, '')
                .replace(/ c/g, '');

            // Verifica correspondência com o nome normalizado
            if (nomeCorNormalizado === corNormalizada) {
                texto.textRange.characterAttributes.fillColor = swatchColor;
                //alert("Encontrou correspondência normalizada: " + cor + " -> " + nomeCorOriginal);
                corEncontrada = true;
                return;
            }
        }
    }

    // Se nenhuma cor for encontrada, exibe um aviso
    if (!corEncontrada) {
        alert("Cor não encontrada: " + cor);
    }
}


// Função para criar retângulo branco
function createWhiteRectangle(x, y, width, height) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Camada padrão (outra camada pode ser usada)

    var rectangleWhite = layer.pathItems.rectangle(y, x, width, -height);
    var white = new CMYKColor(); // Cor branca (todos os canais CMYK em 0)
    rectangleWhite.fillColor = white;
    rectangleWhite.strokeColor = new NoColor();
    rectangleWhite.fillOverprint = false;

    return rectangleWhite;
}


// Função para criar retângulo preto
function createBlackRectangle(x, y, width, height) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Camada padrão (outra camada pode ser usada)

    var rectangle = layer.pathItems.rectangle(y, x, width, -height);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 100;

    rectangle.fillColor = spotColorFill;
    rectangle.strokeColor = new NoColor();

    return rectangle;
}

// Função para criar círculo branco com um determinado diâmetro em pontos
function createWhiteCircle(x, y, diameter) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Altere conforme necessário

    var circle = layer.pathItems.ellipse(y, x, diameter, diameter);
    var white = new CMYKColor(); // Cor branca (todos os canais CMYK em 0)
    circle.fillColor = white;
    circle.strokeColor = new NoColor();

    return circle;
}

// Função para criar círculo preto com um determinado diâmetro em pontos
function createBlackCircle(x, y, diameter) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Altere conforme necessário

    var circle = layer.pathItems.ellipse(y, x, diameter, diameter);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 100;

    circle.fillColor = spotColorFill;
    circle.strokeColor = new NoColor();

    return circle;
}

// Função para encontrar uma cor na paleta de amostras por nome (com correspondência aproximada)
function findColorByName(colorName) {
    var doc = app.activeDocument;

    for (var i = 0; i < doc.swatches.length; i++) {
        var swatch = doc.swatches[i];
        var swatchName = swatch.name;

        // Verifique se o nome da paleta de amostras contém o nome da cor desejada (com correspondência aproximada)
        if (swatchName.toLowerCase().indexOf(colorName.toLowerCase()) !== -1) {
            return swatch.color;
        }
    }

    // Retorne null se a cor não for encontrada
    return null;
}

// Função para criar círculo colorido com base no nome de uma cor da paleta de amostras
function createColoredCircleFromPalette(x, y, diameter, colorName) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Altere conforme necessário
    var foundColor = findColorByName(colorName);

    var circle = layer.pathItems.ellipse(y, x, diameter, diameter);

    if (foundColor != null) {
        // Atribua a cor ao círculo
        circle.fillColor = foundColor;
    } else {
        // Aviso se a cor não for encontrada
        alert("Cor não encontrada na paleta de amostras: " + colorName);
    }

    circle.strokeColor = new NoColor();

    return circle;
}

// Função para criar elipse branca com determinados valores de largura e altura em pontos
function createWhiteEllipse(x, y, width, height) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Altere conforme necessário

    var ellipse = layer.pathItems.ellipse(y, x, width, height);
    var white = new CMYKColor(); // Cor branca (todos os canais CMYK em 0)
    ellipse.fillColor = white;
    ellipse.strokeColor = new NoColor();

    return ellipse;
}

// Função para criar elipse preta com determinados valores de largura e altura em pontos
function createBlackEllipse(x, y, width, height) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Altere conforme necessário

    var ellipse = layer.pathItems.ellipse(y, x, width, height);
    var spotColor = new SpotColor();
    spotColor.spot = doc.spots.getByName("PassarRegistration"); // Substitua pelo nome exato da cor de spot
    spotColor.tint = 100; // Define a intensidade da cor em 100%

    ellipse.fillColor = spotColor;
    ellipse.strokeColor = new NoColor();
    return ellipse;
}

// Função para adicionar zeros à esquerda, se necessário
function adicionarZero(numero) {
    if (numero < 10) {
        return "0" + numero;
    }
    return numero.toString();
}

function resizeObjectByNamePercentKeepCenter(objectName, percentWidth, percentHeight) {
    var doc = app.activeDocument;
    var target = null;

    for (var i = 0; i < doc.pageItems.length; i++) {
        if (doc.pageItems[i].name === objectName) {
            target = doc.pageItems[i];
            break;
        }
    }

    if (target) {
        // Pega valores originais
        var originalWidth = target.width;
        var originalHeight = target.height;
        var centerX = target.left + originalWidth / 2;
        var centerY = target.top - originalHeight / 2; // top é do canto superior, então subtrai a metade da altura

        // Aplica novo tamanho
        var newWidth = originalWidth * (percentWidth / 100);
        var newHeight = originalHeight * (percentHeight / 100);
        target.width = newWidth;
        target.height = newHeight;

        // Recalcula posição pra manter o centro
        target.left = centerX - newWidth / 2;
        target.top = centerY + newHeight / 2;

        alert("Objeto redimensionado mantendo o centro.");
    } else {
        alert("Objeto '" + objectName + "' não encontrado.");
    }
}



// Função para formatar a data de hoje (DD/MM/AA)
function formatarData(data) {
    var dia = adicionarZero(data.getDate());
    var mes = adicionarZero(data.getMonth() + 1);
    var ano = adicionarZero(data.getFullYear() % 100); // Pegando os dois últimos dígitos do ano
    return dia + '/' + mes + '/' + ano;
}

// Define a cor preta em CMYK
var corBlack = new CMYKColor();
corBlack.cyan = 0;
corBlack.magenta = 0;
corBlack.yellow = 0;
corBlack.black = 100;

// Define a branca preta em CMYK
var whiteCMYK = new CMYKColor();
whiteCMYK.cyan = 0;
whiteCMYK.magenta = 0;
whiteCMYK.yellow = 0;
whiteCMYK.black = 0;

#include "montagens.jsx"

// Verificando se o produto está no nome do arquivo
var nomeArquivo = app.activeDocument.name;
if ((nomeArquivo.indexOf(produtoComUnderline) !== -1) && (coresComuns.length == cores.length) && (!temProblema)) {
    // Criando o texto no Illustrator somente se o produto estiver no nome do arquivo
    var doc = app.activeDocument;

    // Verifica se a layer "registros" existe, caso contrário, cria uma nova layer com o nome "registros"
    var layerRegistros = null;
    try {
        layerRegistros = doc.layers.getByName("registros");
    } catch (e) {
        layerRegistros = doc.layers.add();
        layerRegistros.name = "registros";
    }

    // Altera para a layer "registros" antes de criar o texto
    doc.activeLayer = layerRegistros;

    montagens();
    // Quando quiser mostrar a camada "arte" novamente
    artLayer.visible = true;



} else if (coresComuns.length != cores.length) {
    // Caso o produto não esteja no nome do arquivo, exibir um alerta personalizado
    var alertWindow = new Window("dialog", "Cores do arquivo nao batem com a OS");
    alertWindow.orientation = "column";

    var aviso = alertWindow.add("statictext", undefined, "Cores do arquivo nao batem com a OS");
    aviso.alignment = "center";
    aviso.characters = 50; // Define a largura do texto

    // Define a cor vermelha para o texto
    var myBrush = alertWindow.graphics.newPen(alertWindow.graphics.PenType.SOLID_COLOR, [1, 1, 0], 1);
    aviso.graphics.foregroundColor = myBrush;

    var okButton = alertWindow.add("button", undefined, "OK");
    okButton.alignment = "center";

    okButton.onClick = function() {
        alertWindow.close();
    }

    // Centralizando a janela de alerta no Illustrator
    alertWindow.center();

    alertWindow.show();
    artLayer.visible = true;
    artLayer.remove();

} else if (temProblema) {
    // Caso o produto não esteja no nome do arquivo, exibir um alerta personalizado
    var alertWindow = new Window("dialog", "Link nao corresponde com a OS");
    alertWindow.orientation = "column";

    var aviso = alertWindow.add("statictext", undefined, "Link nao corresponde com a OS");
    aviso.alignment = "center";
    aviso.characters = 50; // Define a largura do texto

    // Define a cor vermelha para o texto
    var myBrush = alertWindow.graphics.newPen(alertWindow.graphics.PenType.SOLID_COLOR, [1, 1, 0], 1);
    aviso.graphics.foregroundColor = myBrush;

    var okButton = alertWindow.add("button", undefined, "OK");
    okButton.alignment = "center";

    okButton.onClick = function() {
        alertWindow.close();
    }

    // Centralizando a janela de alerta no Illustrator
    alertWindow.center();

    alertWindow.show();
    artLayer.visible = true;
    artLayer.remove();

} else {
    // Caso o produto não esteja no nome do arquivo, exibir um alerta personalizado
    var alertWindow = new Window("dialog", "Produto nao encontrado");
    alertWindow.orientation = "column";

    var aviso = alertWindow.add("statictext", undefined, "Produto nao encontrado no nome do arquivo");
    aviso.alignment = "center";
    aviso.characters = 50; // Define a largura do texto

    // Define a cor vermelha para o texto
    var myBrush = alertWindow.graphics.newPen(alertWindow.graphics.PenType.SOLID_COLOR, [1, 1, 0], 1);
    aviso.graphics.foregroundColor = myBrush;

    var okButton = alertWindow.add("button", undefined, "OK");
    okButton.alignment = "center";

    okButton.onClick = function() {
        alertWindow.close();
    }

    // Centralizando a janela de alerta no Illustrator
    alertWindow.center();

    alertWindow.show();
    artLayer.visible = true;
    artLayer.remove();
}


// Remover camadas vazias
for (var i = doc.layers.length - 1; i >= 0; i--) {
    var currentLayer = doc.layers[i];
    if (currentLayer.pageItems.length === 0) {
        currentLayer.remove();
    }
}



// Verificar se a cor [registration] está disponível
if (registrationColor) {
    // Passo 1: Mesclar as cores "PassarRegistration" com a cor [registration]
    for (var i = 0; i < doc.pageItems.length; i++) {
        var item = doc.pageItems[i];

        // Verifica se o objeto tem preenchimento "PassarRegistration"
        if (item.fillColor && item.fillColor.spot && item.fillColor.spot.name == "PassarRegistration") {
            // Mescla o objeto com a cor [registration] mantendo as porcentagens originais
            var passRegistrationColor = item.fillColor;
            item.fillColor = registrationColor;

            // Ajusta as porcentagens de acordo com a mescla
            item.fillColor.tint = passRegistrationColor.tint;
        }
    }

} else {
    alert("A cor [registration] não foi encontrada.");
}

// Função para exibir os arrays em um alerta
function mostrarArrays() {
    var alertText =
        "Array cores: " + cores.join(", ") + "\n" +
        "Array allColors: " + allColors.join(", ") + "\n" +
        "Array CoresComuns: " + coresComuns.join(", ") + "\n" +
        "Array CoresSemBrancoVerniz: " + coresSemVernizBranco.join(", ");
    alert(alertText);
}

//mostrarArrays();

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

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_Montagem";

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


#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

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
    // Verifica se a cor está definida na paleta de cores
    for (var k = 0; k < doc.swatches.length; k++) {
        var swatch = doc.swatches[k];
        var swatchColor = swatch.color;
        var nomeCor = swatch.name.toLowerCase();

        // Verifica se a cor é uma das cores especiais
        if (nomeCor === cor.toLowerCase()) {
            texto.textRange.characterAttributes.fillColor = swatchColor; // Use a cor da paleta
            return; // Sai da função após encontrar a cor


        } else {

            var nomeCor = swatch.name.toLowerCase().replace(/process /g, '').replace(/pantone /g, '').replace(/ c/g, '');
            if (nomeCor === cor.toLowerCase()) {
                texto.textRange.characterAttributes.fillColor = swatchColor; // Use a cor da paleta
                return; // Sai da função após encontrar a cor
            }
        }
    }
}

function aplicarCorEscalas(escalas, cor) {
    // Verifica se a cor está definida na paleta de cores
    for (var k = 0; k < doc.swatches.length; k++) {
        var swatch = doc.swatches[k];
        var swatchColor = swatch.color;
        var nomeCor = swatch.name.toLowerCase();

        // Verifica se a cor é uma das cores especiais
        if (nomeCor === cor.toLowerCase()) {
            groupEscalas.fillColor = swatchColor; // Use a cor da paleta
            return; // Sai da função após encontrar a cor


        } else {

            var nomeCor = swatch.name.toLowerCase().replace(/process /g, '').replace(/pantone /g, '').replace(/ c/g, '');
            if (nomeCor === cor.toLowerCase()) {
                groupEscalas.fillColor = swatchColor; // Use a cor da paleta
                return; // Sai da função após encontrar a cor
            }
        }
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
    var achou = -1
    var achouSwatch = ""

    for (var i = 0; i < doc.swatches.length; i++) {
        var swatch = doc.swatches[i];
        var swatchName = swatch.name;

        if ((swatchName.toLowerCase() === "z") || (swatchName.toLowerCase() === "x") || (swatchName.toLowerCase() === "w")) {
            achou = i
            achouSwatch = swatch;
        }

    }

    if (achou >= 0) {
        return achouSwatch.color;

    } else {


        for (var i = 0; i < doc.swatches.length; i++) {
            var swatch = doc.swatches[i];
            var swatchName = swatch.name;

            if ((swatchName.toLowerCase().indexOf(colorName.toLowerCase()) !== -1) && (colorName.length > 2)) {
                achou = i
                achouSwatch = swatch;
            }

        }

        if (achou >= 0) {
            return achouSwatch.color;
        }


    }

    return null;

}

function findSpecificColor(colorName) {
    var doc = app.activeDocument;

    // Verifica se o colorName é "z" (ou qualquer outro nome específico que você precise)
    if (colorName.toLowerCase() === "z") {
        for (var i = 0; i < doc.swatches.length; i++) {
            var swatch = doc.swatches[i];
            if (swatch.name.toLowerCase() === "z") {
                return swatch.color;
            }
        }
    }

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

// Função para criar círculo colorido com base no nome de uma cor da paleta de amostras
function createColoredStrokeFromPalette(x, y, diameter, colorName) {
    var doc = app.activeDocument;
    var layer = doc.layers[0]; // Altere conforme necessário
    var foundColor = findSpecificColor(colorName);

    var circle = layer.pathItems.ellipse(y, x, diameter, diameter);

    if (foundColor != null) {
        // Atribua a cor ao círculo
        var strokeLargura = 0.05 / 0.35277777777782;
        circle.strokeColor = foundColor;
        circle.strokeWidth = strokeLargura;
        circle.strokeOverprint = true;

    } else {
        // Aviso se a cor não for encontrada
        alert("Cor não encontrada na paleta de amostras: " + colorName);
    }

    circle.fillColor = new NoColor();

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

// Obtém uma referência ao documento ativo
var doc = app.activeDocument;

// Deseleciona todos os objetos existentes
doc.selection = null;

// Variável para armazenar os objetos selecionados
var objetosSelecionadosGuias = [];

// Itera sobre todas as páginas no documento
for (var i = 0; i < doc.layers.length; i++) {
    var layer = doc.layers[i];

    // Itera sobre todos os itens na camada
    for (var j = 0; j < layer.pageItems.length; j++) {

        // Obtém uma referência ao objeto de caminho atual
        var pathItem = layer.pageItems[j];

        // Verifica as dimensões do objeto
        var largura = pathItem.width;
        var altura = pathItem.height;

        // Verifica se as dimensões são maiores que 5000mm
        if (largura > 16000 || altura > 16000) {
            // Adiciona o caminho à variável de objetos selecionados
            objetosSelecionadosGuias.push(pathItem);
        }
    }
}

// Variável para armazenar as guias com maior altura e largura
var guiasMaiorAltura = [];
var guiasMaiorLargura = [];

// Encontrar as guias com maior altura e largura
for (var i = 0; i < objetosSelecionadosGuias.length; i++) {
    var guiaAtual = objetosSelecionadosGuias[i];

    // Encontrar guias com maior altura
    if (!guiasMaiorAltura.length || guiaAtual.height > guiasMaiorAltura[0].height) {
        guiasMaiorAltura = [guiaAtual];
    } else if (guiaAtual.height === guiasMaiorAltura[0].height) {
        guiasMaiorAltura.push(guiaAtual);
    }

    // Encontrar guias com maior largura
    if (!guiasMaiorLargura.length || guiaAtual.width > guiasMaiorLargura[0].width) {
        guiasMaiorLargura = [guiaAtual];
    } else if (guiaAtual.width === guiasMaiorLargura[0].width) {
        guiasMaiorLargura.push(guiaAtual);
    }
}

// Verifica se foram encontradas guias
if (guiasMaiorAltura.length > 0 && guiasMaiorLargura.length > 0) {
    // Array para armazenar os pares de coordenadas
    var paresCoordenadas = [];

    // Faz pares de todas as alturas com cada largura
    for (var k = 0; k < guiasMaiorLargura.length; k++) {
        for (var l = 0; l < guiasMaiorAltura.length; l++) {
            var coordenadaX = guiasMaiorAltura[l].position[0];
            var coordenadaY = guiasMaiorLargura[k].position[1];

            // Adiciona o par de coordenadas ao array
            paresCoordenadas.push({
                x: coordenadaX,
                y: coordenadaY
            });

            // Mostra os pares de coordenadas como um alert
            //alert("Par de Coordenadas " + (paresCoordenadas.length) + ":\n" +
            //"x: " + coordenadaX + "\n" +
            //"y: " + coordenadaY);


            #include "micropontos.jsx"

            chamaMicroponto();

            // Calcula as coordenadas para o quadrado centralizado
            var larguraMicroponto = 6 / 0.35277777777782;
            var alturaMicroponto = 6 / 0.35277777777782;

            var x = coordenadaX - larguraMicroponto / 2;
            var y = coordenadaY + alturaMicroponto / 2;

            // Mover o grupoMicroponto para a posição correta
            micropontoGroup.position = [x, y];
        }
    }
} else {
    alert("Nenhuma guia encontrada ou layer vazia.");
}

// Nome do arquivo de texto que você deseja criar
var nomeArquivoTxt = nomeScript + "_" + cliente + "_" + serviceOrderNumber + "_" + produtoComUnderline + "_" + resultadoOperador;

// Função para obter o caminho da pasta
function getFolderPathUtilizacao() {
    var pastaDestino = "";

    // caminho unico p/ Windows e Mac (alphaBaseEngine/alphaBaseUteis resolvem a rede)
    pastaDestino = alphaBaseUteis() + "/_Padroes_clientes_Alpha/_Scripts/Utilizacao/Companion/";

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
// [CSV desativado] var arquivoCSV = new File(pastaDestino + "/data_records.csv");

// Abre o arquivo CSV para append (adicionar linha ao final)
// [CSV desativado] arquivoCSV.open("a");
// [CSV desativado] arquivoCSV.write(linhaCSV);
// [CSV desativado] arquivoCSV.close();



var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "Xml_upload.jsx"

var doc = app.activeDocument;

// Verifica se a layer "escalas" existe, caso contrário, cria uma nova layer com o nome "registros"
var layerEscalas = null;
try {
    layerEscalas = doc.layers.getByName("escalas");
} catch (e) {
    layerEscalas = doc.layers.add();
    layerEscalas.name = "escalas";
}

// Altera para a layer "registros" antes de criar o texto
doc.activeLayer = layerEscalas;

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

// Função para criar um circulo com fill e stroke
function createCircleLorena(x, y, size, fillColor, strokeColor, strokeWidth) {
    var circle = app.activeDocument.layers[0].pathItems.ellipse(y, x, size, size, true);
    circle.fillColor = fillColor;
    circle.stroked = true;
    circle.strokeColor = strokeColor;
    circle.strokeWidth = strokeWidth;
    return circle;
}

// Tamanhos dos quadrados em pontos
var circuloDiametro = 6 / 0.35277777777782;
var groupEscalasCores = app.activeDocument.groupItems.add();
var groupEscalasCoresFinal = app.activeDocument.groupItems.add();
var groupEscalasEspeciais = app.activeDocument.groupItems.add()
var grupoEscalasVerniz = app.activeDocument.groupItems.add()
var grupoEscalasBranco = app.activeDocument.groupItems.add()
var grupoEscalasBrancoFinal = app.activeDocument.groupItems.add()

// Loop para criar os quadrados
var fillColors = [2, 25, 100];
var fillColorsEspeciais = [100, 100, 100]

for (var i = 0; i < fillColors.length; i++) {
    var fillColor = new SpotColor();
    fillColor.spot = doc.spots.getByName("PassarRegistration");
    fillColor.tint = fillColors[i];

    var strokeColor = new SpotColor();
    strokeColor.spot = doc.spots.getByName("PassarRegistration");
    strokeColor.tint = 100;

    var strokeWidth = 0.085 / 0.35277777777782;

    var escalas = createCircleLorena(i * (circuloDiametro + 1.9843), 0, circuloDiametro, fillColor, strokeColor, strokeWidth);
    escalas.move(groupEscalasCores, ElementPlacement.PLACEATEND);
}

// Loop para duplicar o grupo de Escalas com base no numero de cores
for (var i = 0; i < coresSemVernizBranco.length; i++) {

    var group = groupEscalasCores.duplicate();
    group.left = (i + 1) * ((1.15 / 0.35277777777782) + groupEscalasCores.width);
    group.name = "groupEscalasCores" + cores[i];
    group.move(groupEscalasCoresFinal, ElementPlacement.PLACEATEND);


}

groupEscalasCoresFinal.translate(10, 0)
groupEscalasCores.remove();

function applyColorToGroup(group, fillColor, strokeColor) {
    for (var i = 0; i < group.pageItems.length; i++) {
        var square = group.pageItems[i];
        square.fillColor = fillColor;
        square.strokeColor = strokeColor;
    }
}


for (var i = 0; i < coresSemVernizBranco.length; i++) {
    var groupName = "groupEscalasCores" + coresSemVernizBranco[i];
    var group = null;

    // Verifique se o grupo existe antes de tentar acessá-lo
    for (var j = 0; j < app.activeDocument.groupItems.length; j++) {
        if (app.activeDocument.groupItems[j].name === groupName) {
            group = app.activeDocument.groupItems[j];
            break;
        }
    }

    if (group) {
        var cor = coresSemVernizBranco[i];
        var swatchColor = null;

        for (var k = 0; k < doc.spots.length; k++) {
            var swatch = doc.spots[k];
            var nomeCor = swatch.name.toLowerCase();

            if (nomeCor === cor.toLowerCase()) {
                swatchColor = new SpotColor();
                swatchColor.spot = swatch;
                swatchColor.tint = 100;
                break;
            } else {
                var nomeCorProcess = nomeCor.replace(/process /g, '').replace(/pantone /g, '').replace(/ c/g, '');
                if (nomeCorProcess === cor.toLowerCase()) {
                    swatchColor = new SpotColor();
                    swatchColor.spot = swatch;
                    swatchColor.tint = 100;
                    break;
                }
            }
        }

        if (swatchColor) {
            for (var j = 0; j < group.pageItems.length; j++) {
                var circle = group.pageItems[j];

                // Mantenha as porcentagens de preenchimento e traço
                var fillTint = circle.fillColor.tint;
                var strokeTint = circle.strokeColor.tint;

                circle.fillColor = swatchColor;
                circle.strokeColor = swatchColor;

                // Restaure as porcentagens de preenchimento e traço
                circle.fillColor.tint = fillTint;
                circle.strokeColor.tint = strokeTint;
            }
        }
    }
}


// Função para subtrair arrays
function subtractArrays(arr1, arr2) {
    var resultado = [];

    for (var i = 0; i < arr1.length; i++) {
        var elemento = arr1[i];
        var encontrado = false;

        for (var j = 0; j < arr2.length; j++) {
            if (elemento === arr2[j]) {
                encontrado = true;
                break;
            }
        }

        if (!encontrado) {
            resultado.push(elemento);
        }
    }

    return resultado;
}

// Subtrair coresSemVernizBranco de cores
var coresEspeciais = subtractArrays(cores, coresSemVernizBranco);

// Verificar se coresEspeciais contém "Vernize e Branco"
var contemVerniz = false;
var contemBranco = false;

// Inicialize a variável corDoVerniz como null
var corDoVerniz = null;
var corDoBranco = null;

// Verificar se coresEspeciais contém "Verniz" e capturar o nome da cor
for (var i = 0; i < coresEspeciais.length; i++) {
    if (coresEspeciais[i].toLowerCase().indexOf("verniz") >= 0) {
        corDoVerniz = coresEspeciais[i];
        contemVerniz = true; // Defina contemVerniz como true
        break;
    }
}

// Realizar ação com base no resultado
if (contemVerniz) {

    for (var i = 0; i < fillColorsEspeciais.length; i++) {
        var fillColorsEspecialVerniz = new SpotColor();
        fillColorsEspecialVerniz.spot = doc.spots.getByName(corDoVerniz); // Use corDoVerniz como nome
        fillColorsEspecialVerniz.tint = 100;

        var strokeColorEspecial = new SpotColor();
        strokeColorEspecial.spot = doc.spots.getByName(corDoVerniz); // Use corDoVerniz como nome
        strokeColorEspecial.tint = 100;

        var strokeWidthVerniz = 4 / 0.35277777777782;

        var escalasEspeciais = createCircleLorena(i * (circuloDiametro + 1.9843), 0, circuloDiametro, fillColorsEspecialVerniz, strokeColorEspecial, strokeWidthVerniz);
        escalasEspeciais.move(groupEscalasEspeciais, ElementPlacement.PLACEATEND);
        escalasEspeciais.strokeOverprint = true;
        escalasEspeciais.fillOverprint = true;
    }

    // Loop para duplicar o grupo de Escalas com base no numero de cores
    for (var i = 0; i < coresSemVernizBranco.length; i++) {

        var groupEspecial = groupEscalasEspeciais.duplicate();
        groupEspecial.left = (i + 1) * ((1.15 / 0.35277777777782) + groupEscalasEspeciais.width);
        groupEspecial.move(grupoEscalasVerniz, ElementPlacement.PLACEATEND);

    }

    grupoEscalasVerniz.translate((10 - ((strokeWidthVerniz / 2) - (strokeWidth / 2))), 0)

    groupEscalasEspeciais.remove();

} else {

}


for (var i = 0; i < coresEspeciais.length; i++) {
    if (coresEspeciais[i].toLowerCase().indexOf("branco") >= 0) {
        corDoBranco = coresEspeciais[i];
        contemBranco = true;
        break;
    }
}


if (contemBranco) {

    var coresBranco = [];

    
    for (var i = 0; i < coresEspeciais.length; i++) {
        if (coresEspeciais[i].toLowerCase().indexOf("branco") >= 0) {
            coresBranco.push(coresEspeciais[i]);
        }
    }

    
    if (coresBranco.length > 0) {
        for (var j = 0; j < coresBranco.length; j++) {
            var corDoBranco = coresBranco[j];

            
            var grupoEspeciaisBranco = doc.groupItems.add();


            for (var i = 0; i < fillColorsEspeciais.length; i++) {
                var fillColorsEspecial = new SpotColor();
                fillColorsEspecial.spot = doc.spots.getByName(corDoBranco);
                fillColorsEspecial.tint = 100;

                var strokeColorEspecial = new SpotColor();
                strokeColorEspecial.spot = doc.spots.getByName(corDoBranco);
                strokeColorEspecial.tint = 0.4;

                var strokeWidthBranco = 0.8 / 0.35277777777782;

                var escalasEspeciaisBranco = createCircleLorena(i * (circuloDiametro + 1.9843), 0, circuloDiametro, fillColorsEspecial, strokeColorEspecial, strokeWidthBranco);

                // Mova as escalas especiais para o grupo específico desta cor branca
                escalasEspeciaisBranco.move(grupoEspeciaisBranco, ElementPlacement.PLACEATEND);

                escalasEspeciaisBranco.strokeOverprint = true;
                escalasEspeciaisBranco.fillOverprint = true;

            }

            // Loop para duplicar o grupo de Escalas com base no número de cores Brancas encontradas
            var espaçoEntreGrupos = (1.15 / 0.35277777777782);
            var xOffset = 0; // Inicialize o deslocamento horizontal como 0
            for (var k = 0; k < coresSemVernizBranco.length; k++) {
                var groupEspecialBranco = grupoEspeciaisBranco.duplicate();

                // Defina a posição horizontal do grupo duplicado
                groupEspecialBranco.left = xOffset;

                // Atualize o deslocamento horizontal para a próxima iteração
                xOffset += groupEspecialBranco.width + espaçoEntreGrupos;

                // Mova o grupo duplicado para o grupoEscalasBrancoFinal
                groupEspecialBranco.move(grupoEscalasBrancoFinal, ElementPlacement.PLACEATEND);


            }

            grupoEspeciaisBranco.remove();
        }

    }
}

if (contemBranco) {

    grupoEscalasBrancoFinal.translate(67.2378, 0)

} else {

}



var grupoFinal = app.activeDocument.groupItems.add();
if (contemBranco && contemVerniz) {
    grupoEscalasVerniz.move(grupoFinal, ElementPlacement.PLACEATEND);
    grupoEscalasBrancoFinal.move(grupoFinal, ElementPlacement.PLACEATEND);
    groupEscalasCoresFinal.move(grupoFinal, ElementPlacement.PLACEATEND);
} else if (contemBranco) {
    grupoEscalasBrancoFinal.move(grupoFinal, ElementPlacement.PLACEATEND);
    groupEscalasCoresFinal.move(grupoFinal, ElementPlacement.PLACEATEND);
} else if (contemVerniz) {
    grupoEscalasVerniz.move(grupoFinal, ElementPlacement.PLACEATEND);
    groupEscalasCoresFinal.move(grupoFinal, ElementPlacement.PLACEATEND);
} else {
    groupEscalasCoresFinal.move(grupoFinal, ElementPlacement.PLACEATEND);
}


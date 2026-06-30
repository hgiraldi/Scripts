//var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "Xml_upload.jsx"

var doc = app.activeDocument;

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

var alturaValvula = 0;
var larguraValvula = 0;
var teraCapaBoca = false;
var teraCapaFundo = false;


//Atribuindo Valores conforme NP
if (np == "sacaria soldada valvulada") {
    teraCapaBoca = true;
    teraCapaFundo = true;
    createDialog();
} else if (np == "sacaria boca aberta") {
    teraCapaBoca = false;
    teraCapaFundo = true;
} else if (np == "sacaria easy open") {
    teraCapaBoca = true;
    teraCapaFundo = true;
} else if (np == "big bag tubular") {
    teraCapaBoca = false;
    teraCapaFundo = false;
} else if (np == "big bag travado") {
    teraCapaBoca = false;
    teraCapaFundo = false;
} else if (np == "sacaria costurada boca aberta") {
    teraCapaBoca = false;
    teraCapaFundo = false;
} else if (np == "sacaria costurada valvulada") {
    teraCapaBoca = false;
    teraCapaFundo = false;
} else {
    teraCapaBoca = false;
    teraCapaFundo = false;
}

// Função para verificar se o valor é numérico
function isNumeric(value) {
    return !isNaN(value) && isFinite(value);
}

// Função para criar a caixa de diálogo
function createDialog() {
    var dlg = new Window('dialog', 'Tamanho da Válvula');

    // Adiciona campo de altura
    dlg.add('statictext', undefined, 'Altura da Válvula (mm):');
    var alturaInput = dlg.add('edittext', undefined, '');
    alturaInput.characters = 10; // Limita o número de caracteres no campo

    // Adiciona campo de largura
    dlg.add('statictext', undefined, 'Largura da Válvula (mm):');
    var larguraInput = dlg.add('edittext', undefined, '');
    larguraInput.characters = 10; // Limita o número de caracteres no campo

    // Botão de confirmação
    var confirmBtn = dlg.add('button', undefined, 'Confirmar', {
        name: 'ok'
    });

    // Evento ao clicar no botão
    confirmBtn.onClick = function() {
        alturaValvula = alturaInput.text;
        larguraValvula = larguraInput.text;

        // Verifica se os valores inseridos são numéricos
        if (!isNumeric(alturaValvula) || !isNumeric(larguraValvula)) {
            alert('Por favor, insira apenas valores numéricos.');
        } else {
            alturaValvula = parseFloat(alturaValvula);
            larguraValvula = parseFloat(larguraValvula);
            dlg.close(); // Fecha a caixa de diálogo

            // Exibe os valores para garantir que foram inseridos corretamente
            //alert('Altura: ' + alturaValvula + ' mm\nLargura: ' + larguraValvula + ' mm');

        }
    };

    dlg.show();
}


//alert('Altura: ' + alturaValvula + ' mm\nLargura: ' + larguraValvula + ' mm');

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

function hasVrColor() {

    // Loop para verificar se alguma cor contém "~vr"
    for (var i = 0; i < cores.length; i++) {
        var cor = cores[i];
        if (cor.indexOf("~vr") >= 0) {
            return true;
            break;
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
//createSpotColorCMYK(100, 0, 0, 0, "Cyan");
//createSpotColorCMYK(0, 100, 0, 0, "Magenta");
//createSpotColorCMYK(0, 0, 100, 0, "Yellow");
createSpotColorCMYK(0, 0, 0, 100, "Black");


var capaBocaAltura, capaBocaLargura, capaFundoAltura, capaFundoLargura;
var capaBocaEscolha, capaFundoEscolha;

function main() {
    // Criação da janela
    var dlg = new Window('dialog', 'Configurações de Impressão');
    dlg.orientation = 'column';

    // Pergunta sobre impressão na Capa Boca
    if (teraCapaBoca) {
        dlg.capaBocaGroup = dlg.add('panel', undefined, 'Impressão na Capa Boca?');
        dlg.capaBocaGroup.orientation = 'column';

        dlg.capaBocaYes = dlg.capaBocaGroup.add('radiobutton', undefined, 'Sim');
        dlg.capaBocaNo = dlg.capaBocaGroup.add('radiobutton', undefined, 'Não');
        dlg.capaBocaYes.value = false;
        dlg.capaBocaNo.value = false;

        dlg.capaBocaDimGroup = dlg.capaBocaGroup.add('group');
        dlg.capaBocaDimGroup.orientation = 'row';
        dlg.capaBocaDimGroup.enabled = false;

        dlg.capaBocaDimGroup.add('statictext', undefined, 'Altura (mm):');
        dlg.capaBocaAltura = dlg.capaBocaDimGroup.add('edittext', undefined, '');
        dlg.capaBocaAltura.characters = 10;

        dlg.capaBocaDimGroup.add('statictext', undefined, 'Largura (mm):');
        dlg.capaBocaLargura = dlg.capaBocaDimGroup.add('edittext', undefined, '');
        dlg.capaBocaLargura.characters = 10;

        dlg.capaBocaYes.onClick = function() {
            dlg.capaBocaDimGroup.enabled = true;
            capaBocaEscolha = 'Sim'; // Armazenar a escolha
        };

        dlg.capaBocaNo.onClick = function() {
            dlg.capaBocaDimGroup.enabled = true;
            capaBocaEscolha = 'Não'; // Armazenar a escolha
        };
    }

    // Pergunta sobre impressão na Capa Fundo
    if (teraCapaFundo) {
        dlg.capaFundoGroup = dlg.add('panel', undefined, 'Impressão na Capa Fundo?');
        dlg.capaFundoGroup.orientation = 'column';

        dlg.capaFundoYes = dlg.capaFundoGroup.add('radiobutton', undefined, 'Sim');
        dlg.capaFundoNo = dlg.capaFundoGroup.add('radiobutton', undefined, 'Não');
        dlg.capaFundoYes.value = false;
        dlg.capaFundoNo.value = false;

        dlg.capaFundoDimGroup = dlg.capaFundoGroup.add('group');
        dlg.capaFundoDimGroup.orientation = 'row';
        dlg.capaFundoDimGroup.enabled = false;

        dlg.capaFundoDimGroup.add('statictext', undefined, 'Altura (mm):');
        dlg.capaFundoAltura = dlg.capaFundoDimGroup.add('edittext', undefined, '');
        dlg.capaFundoAltura.characters = 10;

        dlg.capaFundoDimGroup.add('statictext', undefined, 'Largura (mm):');
        dlg.capaFundoLargura = dlg.capaFundoDimGroup.add('edittext', undefined, '');
        dlg.capaFundoLargura.characters = 10;

        dlg.capaFundoYes.onClick = function() {
            dlg.capaFundoDimGroup.enabled = true;
            capaFundoEscolha = 'Sim'; // Armazenar a escolha
        };

        dlg.capaFundoNo.onClick = function() {
            dlg.capaFundoDimGroup.enabled = true;
            capaFundoEscolha = 'Não'; // Armazenar a escolha
        };
    }

    // Botão de OK — {name:'ok'} fecha NATIVO (onClick->close entra em loop pelo
    // painel CEP). O onClick abaixo ainda roda e grava as variaveis antes de fechar.
    dlg.okButton = dlg.add('button', undefined, 'OK', { name: 'ok' });
    dlg.okButton.onClick = function() {
        // Armazenamento das variáveis em escopo global
        if (teraCapaBoca) {
            capaBocaAltura = dlg.capaBocaAltura.text;
            capaBocaLargura = dlg.capaBocaLargura.text;
        }

        if (teraCapaFundo) {
            capaFundoAltura = dlg.capaFundoAltura.text;
            capaFundoLargura = dlg.capaFundoLargura.text;
        }

        // Fechar o diálogo
        dlg.close();
    };

    dlg.show();
}


if (teraCapaBoca || teraCapaFundo) {
    main();
}


var alturaMancha = smudgePrintingHeight;
var larguraMancha = smudgePrintingWidht;
var larguraTotal = objectWidth;

// Função para criar uma nova cor spot
function createSpotColor(colorName, colorValue) {
    var spot = app.activeDocument.spots.add();
    spot.name = colorName;
    spot.colorType = ColorModel.SPOT;

    var newColor = new CMYKColor();
    newColor.cyan = colorValue.cyan;
    newColor.magenta = colorValue.magenta;
    newColor.yellow = colorValue.yellow;
    newColor.black = colorValue.black;

    spot.color = newColor;
    return spot;
}

// Função para verificar se a cor spot já existe
function getSpotColorByName(colorName) {
    var spots = app.activeDocument.spots;
    for (var i = 0; i < spots.length; i++) {
        if (spots[i].name === colorName) {
            return spots[i];
        }
    }
    return null;
}

// Nome e valor da cor "z"
var colorName = "z";
var colorValue = {
    cyan: 0,
    magenta: 0,
    yellow: 0,
    black: 80,
};

// Verifica se a cor "z" já existe
var spotColor = getSpotColorByName(colorName);
if (spotColor === null) {
    // Se a cor não existir, cria uma nova cor spot
    spotColor = createSpotColor(colorName, colorValue);
    //alert("A cor spot '" + colorName + "' foi criada.");
} else {
    //alert("A cor spot '" + colorName + "' já existe.");
}

// Função para criar uma nova layer ou obter uma existente
function createOrGetLayer(layerName) {
    var layers = app.activeDocument.layers;
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].name === layerName) {
            return layers[i];
        }
    }
    // Se a layer não existir, cria uma nova
    var newLayer = layers.add();
    newLayer.name = layerName;
    return newLayer;
}

// Nome da layer
var layerNameFaca = "faca";
var layerNameCotas = "cotas";
var layerNameFotocelula = "fotocelula";

// Cria ou obtém a layer "faca"
var layerFaca = createOrGetLayer(layerNameFaca);
var layerFotocelula = createOrGetLayer(layerNameFotocelula);
var layerCotas = createOrGetLayer(layerNameCotas);



//alert("A layer '" + layerName + "' está ativa.");

function findColorByName(colorName) {
    var swatches = app.activeDocument.swatches;
    for (var i = 0; i < swatches.length; i++) {
        if (swatches[i].name == colorName) {
            return swatches[i].color;
        }
    }
}

function moveObject(obj, moveX, moveY) {
    // Move o objeto pela distância especificada
    obj.left += moveX; // Move horizontalmente
    obj.top += moveY; // Move verticalmente, ajustando porque valores menores movem para baixo
}

function removeObjectByName(objectName) {
    try {
        // Procurar o objeto pelo nome dentro de todas as camadas
        var objetoParaRemover = app.activeDocument.pageItems.getByName(objectName);

        // Verificar se o objeto foi encontrado
        if (objetoParaRemover != null) {
            objetoParaRemover.remove(); // Remover o objeto encontrado
            //alert("Objeto '" + objectName + "' removido com sucesso.");
        } else {
            //alert("Objeto com o nome '" + objectName + "' não foi encontrado.");
        }
    } catch (e) {
        //alert("Erro ao remover o objeto: " + e);
    }
}





function createTrapezoid(baseWidth, topWidth, height, strokeColor, preenchimentoFill, preenchimentoStroke) {
    // Calcula a posição dos pontos do trapézio
    var x1 = 0; // Ponto inferior esquerdo
    var x2 = baseWidth; // Ponto inferior direito
    var x3 = (baseWidth - topWidth) / 2; // Ponto superior esquerdo
    var x4 = x3 + topWidth; // Ponto superior direito

    var y1 = 0; // Ponto inferior
    var y2 = height; // Ponto superior

    // Cria o trapézio no documento ativo
    var trapezoid = app.activeDocument.pathItems.add();

    // Adiciona os pontos ao trapézio e fecha o caminho
    var points = [
        [x1, y1], // Inferior esquerdo
        [x2, y1], // Inferior direito
        [x4, y2], // Superior direito
        [x3, y2], // Superior esquerdo
        [x1, y1] // Volta ao ponto inicial para fechar o caminho
    ];

    trapezoid.setEntirePath(points);

    // Define as propriedades do contorno
    trapezoid.stroked = preenchimentoStroke;
    if (preenchimentoStroke) {
        trapezoid.strokeWidth = 0.2 / 0.35277777777782; // Define a largura do contorno
        trapezoid.strokeColor = findColorByName(strokeColor); // Define a cor do contorno
        trapezoid.strokeCap = StrokeCap.ROUNDENDCAP; // Pontas arredondadas
        trapezoid.strokeJoin = StrokeJoin.ROUNDENDJOIN; // Esquinas arredondadas
        trapezoid.strokeOverprint = true;
    }

    trapezoid.filled = preenchimentoFill;

    if (preenchimentoFill) {
        trapezoid.fillColor = findColorByName(strokeColor);
    }

    return trapezoid;
}

function createRightIsoscelesTriangle(x, y, sideLength, colorName, preenchimentoFill, preenchimentoStroke, name) {
    // Encontra a cor pela amostra
    var strokeColor = findColorByName(colorName);

    // Calcula as coordenadas dos três vértices do triângulo retângulo
    var x1 = x; // Ponto superior esquerdo
    var y1 = y;

    var x2 = x + sideLength; // Ponto superior direito (horizontal)
    var y2 = y;

    var x3 = x; // Ponto inferior esquerdo (vertical)
    var y3 = y - sideLength;

    // Cria um novo caminho de polígono (triângulo) no documento ativo
    var triangle = app.activeDocument.pathItems.add();
    triangle.setEntirePath([
        [x1, y1],
        [x2, y2],
        [x3, y3],
        [x1, y1]
    ]);
    triangle.closed = true;
    triangle.name = name;

    // Define as propriedades do triângulo
    triangle.stroked = preenchimentoStroke;

    if (preenchimentoStroke) {
        triangle.strokeWidth = 0.2 / 0.35277777777782; // Define a largura do contorno
        triangle.strokeColor = strokeColor; // Define a cor do contorno
        // Define o estilo do contorno
        triangle.strokeCap = StrokeCap.ROUNDENDCAP; // Pontas arredondadas
        triangle.strokeJoin = StrokeJoin.ROUNDENDJOIN; // Esquinas arredondadas
        triangle.strokeOverprint = true;
    }

    triangle.filled = preenchimentoFill;

    if (preenchimentoFill) {
        triangle.fillColor = strokeColor;
        triangle.fillOverprint = true;
    }

    return triangle;
}





// Função para criar um retângulo com stroke color "z"
function createRectangle(x, y, width, height, colorName, preenchimentoFill, preenchimentoStroke, name) {
    // Encontra a cor pela amostra
    var strokeColor = findColorByName(colorName);

    // Cria um novo retângulo no documento ativo
    var rect = app.activeDocument.pathItems.rectangle(y, x, width, height);
    rect.name = name;

    // Define as propriedades do retângulo
    rect.stroked = preenchimentoStroke;

    if (preenchimentoStroke) {
        rect.strokeWidth = 0.2 / 0.35277777777782; // Define a largura do contorno
        rect.strokeColor = strokeColor; // Define a cor do contorno
        // Define o estilo do contorno
        rect.strokeCap = StrokeCap.ROUNDENDCAP; // Pontas arredondadas
        rect.strokeJoin = StrokeJoin.ROUNDENDJOIN; // Esquinas arredondadas
        rect.strokeOverprint = true;
    }

    rect.filled = preenchimentoFill;

    if (preenchimentoFill) {
        rect.fillColor = strokeColor;
        rect.fillOverprint = true;
    }

    return rect;


}


//transformando os valores para o Illustrator
capaBocaAltura = capaBocaAltura / 0.35277777777782 || 0;
capaBocaLargura = capaBocaLargura / 0.35277777777782 || 0;
capaFundoAltura = capaFundoAltura / 0.35277777777782 || 0;
capaFundoLargura = capaFundoLargura / 0.35277777777782 || 0;
alturaValvula = alturaValvula / 0.35277777777782 || 0;
larguraValvula = larguraValvula / 0.35277777777782 || 0;
var distanciaArtboard = 10 / 0.35277777777777782;
var distanciaFacaInternaLargura = distanciaArtboard + ((objectWidth - smudgePrintingWidht) / 2);
var distanciaFacaInternaAltura = distanciaArtboard + ((objectHeight - smudgePrintingHeight) / 2);
var tamanhoBaseTrapezio = smudgePrintingWidht - (100 / 0.35277777777777782);
var distanciaTrapezio = 50 / 0.352777777777777782;
var tamanhoStroke = 0.2 / 0.35277777777782;
var distanciaEntreFacas = 30 / 0.35277777777782;
var larguraFotocelula = 80 / 0.35277777777782;
var alturaFotocelula = 8 / 0.35277777777782;
var larguraFotocelulaCosturada = 40 / 0.35277777777782;
var distanciaFrenteVerso = 60 / 0.35277777777782;
var alturaFotocelulaEasy = 30 / 0.35277777777782;
var larguraFotocelulaEasy = objectWidth - (140 / 0.35277777777782);
var larguraTriangulo = 120 / 0.35277777777782;
var larguraRetangulo = smudgePrintingWidht - larguraTriangulo;
var larguraCorda = 30 / 0.35277777777782;
var distanciaCorda = 335 / 0.35277777777782;

//calcular artboard
var alturaArtboard = cylinderSize * 2 + 56.7 + displacementBetweenLanes + capaBocaAltura + capaFundoAltura + 56.7;
var larguraArtboard = larguraTotal * 2 + 113.4;

// Definir o tamanho do artboard
var doc = app.activeDocument;
var newArtboardRect = [
    0, // left
    (alturaArtboard / 2), // top
    larguraArtboard, // right
    -(alturaArtboard / 2) // bottom (note o sinal negativo aqui)
];

doc.artboards[0].artboardRect = newArtboardRect;

// Define a layer "faca" como a layer ativa
app.activeDocument.activeLayer = layerFaca;



function sacariaSoldadaValvulada() {

    var facaExternaFrente = createRectangle(distanciaArtboard, objectHeight / 2, objectWidth, objectHeight, "z", false, true, "facaExternaFrente");
    var facaInternaFrente = createRectangle(distanciaFacaInternaLargura, smudgePrintingHeight / 2, smudgePrintingWidht, smudgePrintingHeight, "z", false, true, "facaInternaFrente");
    var facaTrapezio = createTrapezoid(smudgePrintingWidht, tamanhoBaseTrapezio, distanciaTrapezio, "z", false, true, );
    var facaTrapezioDuplicate = facaTrapezio.duplicate();
    facaTrapezioDuplicate.rotate(180);
    facaTrapezio.top = 0;
    facaTrapezioDuplicate.top = -distanciaTrapezio;

    var groupSimulacaoDobraCima = app.activeDocument.groupItems.add();
    facaTrapezioDuplicate.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    facaTrapezio.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    moveObject(groupSimulacaoDobraCima, distanciaFacaInternaLargura, (groupSimulacaoDobraCima.height / 2) + (smudgePrintingHeight / 2) + (tamanhoStroke / 2));
    groupSimulacaoDobraCima.name = "groupSimulacaoDobraCima";

    var groupSimulacaoDobraBaixo = groupSimulacaoDobraCima.duplicate();
    moveObject(groupSimulacaoDobraBaixo, 0, -smudgePrintingHeight);
    groupSimulacaoDobraBaixo.name = "groupSimulacaoDobraBaixo";

    var fotocelulaEsquerdaFrente = createRectangle((distanciaArtboard + (distanciaEntreFacas / 2)), -((objectHeight / 2) - alturaFotocelula), larguraFotocelula, alturaFotocelula, "z", true, false, "fotocelulaEsquerdaFrente")
    var fotocelulaDireitaFrente = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaDireitaFrente.name = "fotocelulaDireitaFrente"
    moveObject(fotocelulaDireitaFrente, ((objectWidth - larguraFotocelula) - ((distanciaEntreFacas / 2) * 2)), 0)

    //=====Valvula=====//
    var valvula = createRectangle(0, 0, larguraValvula, alturaValvula, "z", true, false, "valvula")
    valvula.fillColor.tint = 30;
    valvula.blendingMode = BlendModes.MULTIPLY;
    valvula.fillOverprint = false;
    // Criação do texto "Válvula"
    var doc = app.activeDocument;
    var textoValvula = doc.textFrames.add();
    textoValvula.contents = "Válvula";
    textoValvula.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-Black"); // Define a fonte Arial Black
    textoValvula.textRange.characterAttributes.size = 12 / 0.35277777777782;
    textoValvula.textRange.characterAttributes.fillColor = findColorByName("z");
    textoValvula.blendingMode = BlendModes.MULTIPLY;

    moveObject(textoValvula, (larguraValvula - textoValvula.width) / 2, -(textoValvula.height + alturaValvula) / 2)

    var groupValvula = app.activeDocument.groupItems.add();
    textoValvula.move(groupValvula, ElementPlacement.PLACEATEND);
    valvula.move(groupValvula, ElementPlacement.PLACEATEND);

    moveObject(groupValvula, (((distanciaArtboard + ((objectWidth + smudgePrintingWidht) / 2))) - larguraValvula), smudgePrintingHeight / 2)


    //criando o verso
    var facaExternaVerso = facaExternaFrente.duplicate();
    facaExternaVerso.name = "facaExternaVerso";
    var facaInternaVerso = facaInternaFrente.duplicate();
    facaInternaVerso.name = "facaInternaVerso";

    var fotocelulaDireitaVerso = fotocelulaDireitaFrente.duplicate();
    fotocelulaDireitaVerso.name = "fotocelulaDireitaVerso";
    var fotocelulaEsquerdaVerso = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaEsquerdaVerso.name = "fotocelulaEsquerdaVerso";

    var groupVerso = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaDireitaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaEsquerdaVerso.move(groupVerso, ElementPlacement.PLACEATEND);


    moveObject(groupVerso, distanciaFrenteVerso + objectWidth, 0);


}

function sacariaCosturadaAberta() {

    var facaExternaFrente = createRectangle(distanciaArtboard, objectHeight / 2, objectWidth, objectHeight, "z", false, true, "facaExternaFrente");
    var facaInternaFrente = createRectangle(distanciaFacaInternaLargura, smudgePrintingHeight / 2, smudgePrintingWidht, smudgePrintingHeight, "z", false, true, "facaInternaFrente");

    var facaTrapezio = createTrapezoid(smudgePrintingWidht, tamanhoBaseTrapezio, distanciaTrapezio, "z", false, true, );
    var facaTrapezioDuplicate = facaTrapezio.duplicate();
    facaTrapezioDuplicate.rotate(180);
    facaTrapezio.top = 0;
    facaTrapezioDuplicate.top = -distanciaTrapezio;

    var groupSimulacaoDobraCima = app.activeDocument.groupItems.add();
    facaTrapezioDuplicate.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    facaTrapezio.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    moveObject(groupSimulacaoDobraCima, distanciaFacaInternaLargura, (groupSimulacaoDobraCima.height / 2) + (smudgePrintingHeight / 2) + (tamanhoStroke / 2));
    groupSimulacaoDobraCima.name = "groupSimulacaoDobraCima";

    var groupSimulacaoDobraBaixo = groupSimulacaoDobraCima.duplicate();
    moveObject(groupSimulacaoDobraBaixo, 0, -smudgePrintingHeight);
    groupSimulacaoDobraBaixo.name = "groupSimulacaoDobraBaixo";

    var fotocelulaEsquerdaFrente = createRectangle((distanciaArtboard + (distanciaEntreFacas / 2)), -((objectHeight / 2) - alturaFotocelula), larguraFotocelula / 2, alturaFotocelula, "z", true, false, "fotocelulaEsquerdaFrente")
    var fotocelulaDireitaFrente = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaDireitaFrente.name = "fotocelulaDireitaFrente"
    moveObject(fotocelulaDireitaFrente, ((objectWidth - (larguraFotocelula / 2)) - ((distanciaEntreFacas / 2) * 2)), 0)


    //criando o verso
    var facaExternaVerso = facaExternaFrente.duplicate();
    facaExternaVerso.name = "facaExternaVerso";
    var facaInternaVerso = facaInternaFrente.duplicate();
    facaInternaVerso.name = "facaInternaVerso";

    var fotocelulaDireitaVerso = fotocelulaDireitaFrente.duplicate();
    fotocelulaDireitaVerso.name = "fotocelulaDireitaVerso";
    var fotocelulaEsquerdaVerso = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaEsquerdaVerso.name = "fotocelulaEsquerdaVerso";

    var groupVerso = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaDireitaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaEsquerdaVerso.move(groupVerso, ElementPlacement.PLACEATEND);


    moveObject(groupVerso, distanciaFrenteVerso + objectWidth, 0);


}

function sacariaBocaAberta() {

    var facaExternaFrente = createRectangle(distanciaArtboard, objectHeight / 2, objectWidth, objectHeight, "z", false, true, "facaExternaFrente");
    var facaInternaFrente = createRectangle(distanciaFacaInternaLargura, smudgePrintingHeight / 2, smudgePrintingWidht, smudgePrintingHeight, "z", false, true, "facaInternaFrente");
    var facaTrapezio = createTrapezoid(smudgePrintingWidht, tamanhoBaseTrapezio, distanciaTrapezio, "z", false, true, );
    var facaTrapezioDuplicate = facaTrapezio.duplicate();
    facaTrapezioDuplicate.rotate(180);
    facaTrapezio.top = 0;
    facaTrapezioDuplicate.top = -distanciaTrapezio;

    var groupSimulacaoDobraCima = app.activeDocument.groupItems.add();
    facaTrapezioDuplicate.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    facaTrapezio.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    moveObject(groupSimulacaoDobraCima, distanciaFacaInternaLargura, (groupSimulacaoDobraCima.height / 2) + (smudgePrintingHeight / 2) + (tamanhoStroke / 2));
    groupSimulacaoDobraCima.name = "groupSimulacaoDobraCima";

    var groupSimulacaoDobraBaixo = groupSimulacaoDobraCima.duplicate();
    moveObject(groupSimulacaoDobraBaixo, 0, -smudgePrintingHeight);
    groupSimulacaoDobraBaixo.name = "groupSimulacaoDobraBaixo";

    var fotocelulaEsquerdaFrente = createRectangle((distanciaArtboard + (distanciaEntreFacas / 2)), -((objectHeight / 2) - alturaFotocelula), larguraFotocelula, alturaFotocelula, "z", true, false, "fotocelulaEsquerdaFrente")
    var fotocelulaDireitaFrente = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaDireitaFrente.name = "fotocelulaDireitaFrente"
    moveObject(fotocelulaDireitaFrente, ((objectWidth - larguraFotocelula) - ((distanciaEntreFacas / 2) * 2)), 0)

    //criando o verso
    var facaExternaVerso = facaExternaFrente.duplicate();
    facaExternaVerso.name = "facaExternaVerso";
    var facaInternaVerso = facaInternaFrente.duplicate();
    facaInternaVerso.name = "facaInternaVerso";

    var fotocelulaDireitaVerso = fotocelulaDireitaFrente.duplicate();
    fotocelulaDireitaVerso.name = "fotocelulaDireitaVerso";
    var fotocelulaEsquerdaVerso = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaEsquerdaVerso.name = "fotocelulaEsquerdaVerso";

    var groupVerso = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaDireitaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaEsquerdaVerso.move(groupVerso, ElementPlacement.PLACEATEND);


    moveObject(groupVerso, distanciaFrenteVerso + objectWidth, 0);


}

function sacariaEasyOpen() {

    var facaExternaFrente = createRectangle(distanciaArtboard, objectHeight / 2, objectWidth, objectHeight, "z", false, true, "facaExternaFrente");
    var facaInternaFrente = createRectangle(distanciaFacaInternaLargura, smudgePrintingHeight / 2, smudgePrintingWidht, smudgePrintingHeight, "z", false, true, "facaInternaFrente");
    var facaTrapezio = createTrapezoid(smudgePrintingWidht, tamanhoBaseTrapezio, distanciaTrapezio, "z", false, true, );
    var facaTrapezioDuplicate = facaTrapezio.duplicate();
    facaTrapezioDuplicate.rotate(180);
    facaTrapezio.top = 0;
    facaTrapezioDuplicate.top = -distanciaTrapezio;

    var groupSimulacaoDobraCima = app.activeDocument.groupItems.add();
    facaTrapezioDuplicate.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    facaTrapezio.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    moveObject(groupSimulacaoDobraCima, distanciaFacaInternaLargura, (groupSimulacaoDobraCima.height / 2) + (smudgePrintingHeight / 2) + (tamanhoStroke / 2));
    groupSimulacaoDobraCima.name = "groupSimulacaoDobraCima";

    var groupSimulacaoDobraBaixo = groupSimulacaoDobraCima.duplicate();
    moveObject(groupSimulacaoDobraBaixo, 0, -smudgePrintingHeight);
    groupSimulacaoDobraBaixo.name = "groupSimulacaoDobraBaixo";

    var fotocelulaEsquerdaFrente = createRectangle((distanciaArtboard + (70 / 0.35277777777782)), -((objectHeight / 2) - alturaFotocelulaEasy), larguraFotocelulaEasy, alturaFotocelulaEasy, "Black", true, false, "fotocelulaEsquerdaFrente")
    var fotocelulaDireitaFrente = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaDireitaFrente.name = "fotocelulaDireitaFrente"

    //criando o verso
    var facaExternaVerso = facaExternaFrente.duplicate();
    facaExternaVerso.name = "facaExternaVerso";
    var facaInternaVerso = facaInternaFrente.duplicate();
    facaInternaVerso.name = "facaInternaVerso";

    var fotocelulaDireitaVerso = fotocelulaDireitaFrente.duplicate();
    fotocelulaDireitaVerso.name = "fotocelulaDireitaVerso";
    var fotocelulaEsquerdaVerso = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaEsquerdaVerso.name = "fotocelulaEsquerdaVerso";

    var groupVerso = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaDireitaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaEsquerdaVerso.move(groupVerso, ElementPlacement.PLACEATEND);


    moveObject(groupVerso, distanciaFrenteVerso + objectWidth, 0);


}

function bigBagTubular() {

    var facaExternaFrente = createRectangle(distanciaArtboard, objectHeight / 2, objectWidth, objectHeight, "z", false, true, "facaExternaFrente");
    var facaInternaFrente = createRectangle(distanciaFacaInternaLargura, smudgePrintingHeight / 2, smudgePrintingWidht, smudgePrintingHeight, "z", false, true, "facaInternaFrente");

    var facaTrapezio = createTrapezoid(smudgePrintingWidht, tamanhoBaseTrapezio, distanciaTrapezio, "z", false, true, );
    var facaTrapezioDuplicate = facaTrapezio.duplicate();
    facaTrapezioDuplicate.rotate(180);
    facaTrapezio.top = 0;
    facaTrapezioDuplicate.top = -distanciaTrapezio;

    var groupSimulacaoDobraCima = app.activeDocument.groupItems.add();
    facaTrapezioDuplicate.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    facaTrapezio.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    moveObject(groupSimulacaoDobraCima, distanciaFacaInternaLargura, (groupSimulacaoDobraCima.height / 2) + (smudgePrintingHeight / 2) + (tamanhoStroke / 2));
    groupSimulacaoDobraCima.name = "groupSimulacaoDobraCima";

    var groupSimulacaoDobraBaixo = groupSimulacaoDobraCima.duplicate();
    moveObject(groupSimulacaoDobraBaixo, 0, -smudgePrintingHeight);
    groupSimulacaoDobraBaixo.name = "groupSimulacaoDobraBaixo";

    var fotocelulaEsquerdaFrente = createRectangle((distanciaArtboard + (distanciaEntreFacas / 2)), -((objectHeight / 2) - alturaFotocelula), larguraFotocelula / 2, alturaFotocelula, "z", true, false, "fotocelulaEsquerdaFrente")
    var fotocelulaDireitaFrente = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaDireitaFrente.name = "fotocelulaDireitaFrente"
    moveObject(fotocelulaDireitaFrente, ((objectWidth - (larguraFotocelula / 2)) - ((distanciaEntreFacas / 2) * 2)), 0)


    //criando o verso
    var facaExternaVerso = facaExternaFrente.duplicate();
    facaExternaVerso.name = "facaExternaVerso";
    var facaInternaVerso = facaInternaFrente.duplicate();
    facaInternaVerso.name = "facaInternaVerso";

    var fotocelulaDireitaVerso = fotocelulaDireitaFrente.duplicate();
    fotocelulaDireitaVerso.name = "fotocelulaDireitaVerso";
    var fotocelulaEsquerdaVerso = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaEsquerdaVerso.name = "fotocelulaEsquerdaVerso";

    var groupVerso = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaDireitaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaEsquerdaVerso.move(groupVerso, ElementPlacement.PLACEATEND);


    moveObject(groupVerso, distanciaFrenteVerso + objectWidth, 0);


}

function bigBagTravado() {

    var facaExternaFrente = createRectangle(distanciaArtboard, objectHeight / 2, objectWidth, objectHeight, "z", false, true, "facaExternaFrente");
    var facaInternaFrente = createRectangle(distanciaFacaInternaLargura, smudgePrintingHeight / 2, smudgePrintingWidht, smudgePrintingHeight, "z", false, true, "facaInternaFrente");

    var facaTrapezio = createTrapezoid(smudgePrintingWidht, tamanhoBaseTrapezio, distanciaTrapezio, "z", false, true, );
    var facaTrapezioDuplicate = facaTrapezio.duplicate();
    facaTrapezioDuplicate.rotate(180);
    facaTrapezio.top = 0;
    facaTrapezioDuplicate.top = - distanciaTrapezio;

    var corda = createRectangle(distanciaArtboard + distanciaCorda, objectHeight / 2, larguraCorda, objectHeight, "z", true, false, "corda");
    corda.fillColor.tint = 50;
    corda.blendingMode = BlendModes.MULTIPLY;
    corda.fillOverprint = false;

    var frisoCorda = createRectangle(distanciaArtboard + distanciaCorda + (larguraCorda / 2), objectHeight / 2, 0, objectHeight, "z", false, true, "frisoCorda")
    frisoCorda.strokeDashes = [3, 5];

    var simulacaoCorda = app.activeDocument.groupItems.add();
    corda.move(simulacaoCorda, ElementPlacement.PLACEATEND);
    frisoCorda.move(simulacaoCorda, ElementPlacement.PLACEATEND);
    simulacaoCorda.name = "simulacaoCorda";

    var simulacaoCordaDireita = simulacaoCorda.duplicate();
    moveObject(simulacaoCordaDireita, objectWidth - (2*(distanciaCorda + (larguraCorda/2))), 0);
    simulacaoCordaDireita.name = "simulacaoCordaDireita";

    var groupSimulacaoCorda = app.activeDocument.groupItems.add();
    simulacaoCorda.move(groupSimulacaoCorda, ElementPlacement.PLACEATEND);
    simulacaoCordaDireita.move(groupSimulacaoCorda, ElementPlacement.PLACEATEND);
    groupSimulacaoCorda.name = "groupSimulacaoCorda"

    var groupSimulacaoDobraCima = app.activeDocument.groupItems.add();
    facaTrapezioDuplicate.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    facaTrapezio.move(groupSimulacaoDobraCima, ElementPlacement.PLACEATEND);
    moveObject(groupSimulacaoDobraCima, distanciaFacaInternaLargura, (groupSimulacaoDobraCima.height / 2) + (smudgePrintingHeight / 2) + (tamanhoStroke / 2));
    groupSimulacaoDobraCima.name = "groupSimulacaoDobraCima";

    var groupSimulacaoDobraBaixo = groupSimulacaoDobraCima.duplicate();
    moveObject(groupSimulacaoDobraBaixo, 0, -smudgePrintingHeight);
    groupSimulacaoDobraBaixo.name = "groupSimulacaoDobraBaixo";

    var fotocelulaEsquerdaFrente = createRectangle((distanciaArtboard + (distanciaEntreFacas / 2)), -((objectHeight / 2) - alturaFotocelula), larguraFotocelula / 2, alturaFotocelula, "z", true, false, "fotocelulaEsquerdaFrente")
    var fotocelulaDireitaFrente = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaDireitaFrente.name = "fotocelulaDireitaFrente"
    moveObject(fotocelulaDireitaFrente, ((objectWidth - (larguraFotocelula / 2)) - ((distanciaEntreFacas / 2) * 2)), 0)

    var doc = app.activeDocument;
    var textoFrente = doc.textFrames.add();
    textoFrente.name = "textoFrente"
    textoFrente.contents = "FRENTE";
    textoFrente.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-Black"); // Define a fonte Arial Black
    textoFrente.textRange.characterAttributes.size = 35 / 0.35277777777782;
    textoFrente.textRange.characterAttributes.fillColor = findColorByName("z");
    textoFrente.textRange.paragraphAttributes.justification = Justification.CENTER;
    textoFrente.blendingMode = BlendModes.MULTIPLY;
    moveObject(textoFrente, distanciaArtboard + ((objectWidth) / 2), objectHeight / 2 + distanciaArtboard)
    var textoLado1 = textoFrente.duplicate();
    textoLado1.name = "textoLado1"
    moveObject(textoLado1, objectWidth + distanciaFrenteVerso, 0)
    textoLado1.contents = "LADO 1"
    var textoVerso = textoFrente.duplicate();
    textoVerso.name = "textoVerso"
    moveObject(textoVerso, 0, -(objectHeight + distanciaFrenteVerso));
    textoVerso.contents = "VERSO"
    var textoLado2 = textoVerso.duplicate();
    textoLado2.name = "textoLado2"
    moveObject(textoLado2, objectWidth + distanciaFrenteVerso, 0)
    textoLado2.contents = "LADO 2"




    //criando o verso
    var facaExternaVerso = facaExternaFrente.duplicate();
    facaExternaVerso.name = "facaExternaVerso";
    var facaInternaVerso = facaInternaFrente.duplicate();
    facaInternaVerso.name = "facaInternaVerso";

    var fotocelulaDireitaVerso = fotocelulaDireitaFrente.duplicate();
    fotocelulaDireitaVerso.name = "fotocelulaDireitaVerso";
    var fotocelulaEsquerdaVerso = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaEsquerdaVerso.name = "fotocelulaEsquerdaVerso";
    
    var simulacaoCordaVerso = groupSimulacaoCorda.duplicate();
    simulacaoCordaVerso.name = "simulacaoCordaVerso";
    moveObject(simulacaoCordaVerso, 0, -(objectHeight + distanciaFrenteVerso));

    var simulacaoCordaLado1 = groupSimulacaoCorda.duplicate();
    simulacaoCordaLado1.name = "simulacaoCordaLado1";
    moveObject(simulacaoCordaLado1,distanciaFrenteVerso + objectWidth, 0)

    var simulacaoCordaLado2 = simulacaoCordaVerso.duplicate();
    simulacaoCordaLado2.name = "simulacaoCordaLado2";
    moveObject(simulacaoCordaLado2, distanciaFrenteVerso + objectWidth, 0)


    var groupVerso = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaDireitaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaEsquerdaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    moveObject(groupVerso, distanciaFrenteVerso + objectWidth, 0);
    groupVerso.name = "groupVerso";

    var groupLado1 = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupLado1, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupLado1, ElementPlacement.PLACEATEND);
    facaInternaFrente.move(groupLado1, ElementPlacement.PLACEATEND);
    facaExternaFrente.move(groupLado1, ElementPlacement.PLACEATEND);
    groupLado1.name = "groupLado1";

    groupLado2 = groupLado1.duplicate();
    groupLado2.name = "groupLado2"

    moveObject(groupLado2, 0, -(objectHeight + distanciaFrenteVerso));


}

function sacariaCosturadaValvulada() {

    var facaExternaFrente = createRectangle(distanciaArtboard, objectHeight / 2, objectWidth, objectHeight, "z", false, true, "facaExternaFrente");
    var facaInternaFrente = createRectangle(distanciaFacaInternaLargura, (-(objectHeight / 2) + smudgePrintingHeight) + (80 / 0.35277777777782), smudgePrintingWidht, smudgePrintingHeight, "z", false, true, "facaInternaFrente");

    var fotocelulaEsquerdaFrente = createRectangle((distanciaArtboard + (distanciaEntreFacas / 2)), -((objectHeight / 2) - alturaFotocelula), larguraFotocelulaCosturada, alturaFotocelula, "z", true, false, "fotocelulaEsquerdaFrente")
    var fotocelulaDireitaFrente = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaDireitaFrente.name = "fotocelulaDireitaFrente"
    moveObject(fotocelulaDireitaFrente, ((objectWidth - larguraFotocelulaCosturada) - ((distanciaEntreFacas / 2) * 2)), 0)

    var triangulo = createRightIsoscelesTriangle(distanciaFacaInternaLargura, (-(objectHeight / 2) + smudgePrintingHeight) + (80 / 0.35277777777782) + larguraTriangulo, larguraTriangulo, "z", false, true, "triangulo");
    triangulo.rotate(180);
    var retangulo = createRectangle(distanciaFacaInternaLargura + larguraTriangulo, (-(objectHeight / 2) + smudgePrintingHeight) + (80 / 0.35277777777782) + larguraTriangulo, larguraRetangulo, larguraTriangulo, "z", false, true, "retangulo")

    var groupSimulacao = app.activeDocument.groupItems.add();
    groupSimulacao.name = "groupSimulacao";
    triangulo.move(groupSimulacao, ElementPlacement.PLACEATEND);
    retangulo.move(groupSimulacao, ElementPlacement.PLACEATEND);

    var groupSimulacaoVerso = groupSimulacao.duplicate();
    groupSimulacaoVerso.name = "groupSimulacaoVerso";
    groupSimulacaoVerso.resize(-100, 100);


    //criando o verso
    var facaExternaVerso = facaExternaFrente.duplicate();
    facaExternaVerso.name = "facaExternaVerso";
    var facaInternaVerso = facaInternaFrente.duplicate();
    facaInternaVerso.name = "facaInternaVerso";

    var fotocelulaDireitaVerso = fotocelulaDireitaFrente.duplicate();
    fotocelulaDireitaVerso.name = "fotocelulaDireitaVerso";
    var fotocelulaEsquerdaVerso = fotocelulaEsquerdaFrente.duplicate();
    fotocelulaEsquerdaVerso.name = "fotocelulaEsquerdaVerso";

    var groupVerso = app.activeDocument.groupItems.add();
    facaExternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    facaInternaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaDireitaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    fotocelulaEsquerdaVerso.move(groupVerso, ElementPlacement.PLACEATEND);
    groupSimulacaoVerso.move(groupVerso, ElementPlacement.PLACEATEND);


    moveObject(groupVerso, distanciaFrenteVerso + objectWidth, 0);


}



//Chamanda as Plantas
if (np == "sacaria soldada valvulada") {

    sacariaSoldadaValvulada();

} else if (np == "sacaria costurada boca aberta") {

    sacariaCosturadaAberta();

} else if (np == "sacaria boca aberta") {

    sacariaBocaAberta();

} else if (np == "sacaria easy open") {

    sacariaEasyOpen();

} else if (np == "big bag tubular") {

    bigBagTubular();

} else if (np == "big bag travado") {

    bigBagTravado();

} else if (np == "sacaria costurada valvulada") {

    sacariaCosturadaValvulada();

} else {

    alert("NENHUMA PLANTA ESPECIFICADA - DARÁ ERRO")

}


//=========================Criação das capas=====================//

if (teraCapaBoca) {

    if (capaBocaLargura > 0 && capaBocaAltura > 0) {
        var capaBoca = createRectangle(distanciaArtboard + ((objectWidth - capaBocaLargura) / 2), (objectHeight / 2) + capaBocaAltura + distanciaEntreFacas, capaBocaLargura, capaBocaAltura, "z", false, true, "capaBoca");
    } else {
        alert("FAVOR INSERIR UM VALOR VALIDO PARA A CAPA BOCA")
    }

}
if (teraCapaFundo) {

    if (capaFundoLargura > 0 && capaFundoAltura > 0) {
        var capaFundo = createRectangle(distanciaArtboard + ((objectWidth - capaFundoLargura) / 2), -(objectHeight / 2) - distanciaEntreFacas, capaFundoLargura, capaFundoAltura, "z", false, true, "capaFundo");
    } else {
        alert("FAVOR INSERIR UM VALOR VALIDO PARA A CAPA FUNDO")
    }

}
if (teraCapaFundo && np == "sacaria easy open") {
    var capaFundoVerso = capaFundo.duplicate();
    capaFundoVerso.name = "capaFundoVerso";
    moveObject(capaFundoVerso, distanciaFrenteVerso + objectWidth, 0);

}

//=======================Criando as Setas para Quando Tem impressao===================//

if (np == "sacaria boca aberta") {
    var pdfFilePathDireita = scriptDirectory + '/z_pdfs/saida_maquina_direita.pdf';
    if (capaBocaEscolha == "Sim") {
        // Adicionar o PDF ao documento
        var doc = app.activeDocument;
        var pdfFile = new File(pdfFilePathDireita);

        // Verificar se o arquivo existe antes de tentar colocá-lo
        if (pdfFile.exists) {
            var placedItemBoca = doc.placedItems.add();
            placedItemBoca.file = pdfFile;
            placedItemBoca.position = [((distanciaArtboard * 2) + capaFundoLargura + ((objectWidth - capaFundoLargura) / 2)), (((objectHeight / 2) + capaFundoAltura + distanciaEntreFacas) - ((capaFundoAltura - placedItemBoca.height) / 2))];
            placedItemBoca.embed();
            placedItemBoca.name = "placedItemBoca";
        } else {
            alert('O arquivo PDF não foi encontrado: ' + pdfFilePathDireita);
        }
    }
} else {
    var pdfFilePathEsquerda = scriptDirectory + '/z_pdfs/saida_maquina_esquerda.pdf';
    if (capaBocaEscolha == "Sim") {
        // Adicionar o PDF ao documento
        var doc = app.activeDocument;
        var pdfFile = new File(pdfFilePathEsquerda);

        // Verificar se o arquivo existe antes de tentar colocá-lo
        if (pdfFile.exists) {
            var placedItemBoca = doc.placedItems.add();
            placedItemBoca.file = pdfFile;
            placedItemBoca.position = [((distanciaArtboard * 2) + capaBocaLargura + ((objectWidth - capaBocaLargura) / 2)), (((objectHeight / 2) + capaBocaAltura + distanciaEntreFacas) - ((capaBocaAltura - placedItemBoca.height) / 2))];
            placedItemBoca.embed();
            placedItemBoca.name = "placedItemBoca";
        } else {
            alert('O arquivo PDF não foi encontrado: ' + pdfFilePathEsquerda);
        }
    }
}

if (np == "sacaria boca aberta") {
    var pdfFilePathDireita = scriptDirectory + '/z_pdfs/saida_maquina_direita.pdf';
    if (capaFundoEscolha == "Sim") {
        // Adicionar o PDF ao documento
        var doc = app.activeDocument;
        var pdfFile = new File(pdfFilePathDireita);

        // Verificar se o arquivo existe antes de tentar colocá-lo
        if (pdfFile.exists) {
            var placedItemFundo = doc.placedItems.add();
            placedItemFundo.file = pdfFile;
            placedItemFundo.position = [((distanciaArtboard * 2) + capaFundoLargura + ((objectWidth - capaFundoLargura) / 2)), -(objectHeight / 2) - (capaFundoAltura / 2) - distanciaEntreFacas / 2];
            placedItemFundo.embed();
            placedItemFundo.name = "placedItemFundo";
        } else {
            alert('O arquivo PDF não foi encontrado: ' + pdfFilePathDireita);
        }
    }

} else {
    var pdfFilePathEsquerda = scriptDirectory + '/z_pdfs/saida_maquina_esquerda.pdf';
    if (capaFundoEscolha == "Sim") {
        // Adicionar o PDF ao documento
        var doc = app.activeDocument;
        var pdfFile = new File(pdfFilePathEsquerda);

        // Verificar se o arquivo existe antes de tentar colocá-lo
        if (pdfFile.exists) {
            var placedItemFundo = doc.placedItems.add();
            placedItemFundo.file = pdfFile;
            placedItemFundo.position = [((distanciaArtboard * 2) + capaFundoLargura + ((objectWidth - capaFundoLargura) / 2)), -(objectHeight / 2) - (capaFundoAltura / 2) - distanciaEntreFacas / 2];
            placedItemFundo.embed();
            placedItemFundo.name = "placedItemFundo";
        } else {
            alert('O arquivo PDF não foi encontrado: ' + pdfFilePathEsquerda);
        }

    }
}

//======================Selo Embrasa======================//

if (np == "sacaria costurada boca aberta" || np == "sacaria costurada valvulada") {
    var pdfFileSelo = scriptDirectory + '/z_pdfs/selo_embrasa.pdf';
    var doc = app.activeDocument;
    var pdfFileSelo = new File(pdfFileSelo);
    var placedItemSelo = doc.placedItems.add();
    placedItemSelo.file = pdfFileSelo;


    if (hasVrColor()) {
        //alert("Encontrada uma cor com '~vr'");
        placedItemSelo.position = [(distanciaArtboard + ((objectWidth - placedItemSelo.width) / 2)) + distanciaFrenteVerso + objectWidth, -(objectHeight / 2) + (placedItemSelo.height + (50 / 0.352777777777777782))];
        placedItemSelo.embed();
        placedItemSelo.name = "placedItemSelo";
    } else {
        //alert("Nenhuma cor com '~vr' encontrada");
        placedItemSelo.position = [(distanciaArtboard + ((objectWidth - placedItemSelo.width) / 2)), -(objectHeight / 2) + (placedItemSelo.height + (50 / 0.352777777777777782))];
        placedItemSelo.embed();
        placedItemSelo.name = "placedItemSelo";

    }

}


//======================Movendo os objetos para as layers===================//
function moveObjectByNameToLayer(objectName, layerName) {
    var doc = app.activeDocument;

    // Encontra o objeto pelo nome 
    var targetObject = null;
    for (var i = 0; i < doc.pageItems.length; i++) {
        if (doc.pageItems[i].name === objectName) {
            targetObject = doc.pageItems[i];
            break;
        }
    }

    if (targetObject) {
        // Encontra ou cria a camada
        var targetLayer = null;
        for (var j = 0; j < doc.layers.length; j++) {
            if (doc.layers[j].name === layerName) {
                targetLayer = doc.layers[j];
                break;
            }
        }

        if (!targetLayer) {
            targetLayer = doc.layers.add();
            targetLayer.name = layerName;
        }

        // Move o objeto para a camada desejada
        targetObject.moveToBeginning(targetLayer);
    } else {
        //alert("Objeto com o nome '" + objectName + "' não encontrado.");
    }
}

//Movendo para a layer faca
moveObjectByNameToLayer("facaExternaVerso", layerNameFaca);
moveObjectByNameToLayer("facaExternaFrente", layerNameFaca);
moveObjectByNameToLayer("facaInternaFrente", layerNameFaca);
moveObjectByNameToLayer("facaInternaVerso", layerNameFaca);
moveObjectByNameToLayer("groupSimulacaoDobraCima", layerNameFaca);
moveObjectByNameToLayer("groupSimulacaoDobraBaixo", layerNameFaca);
moveObjectByNameToLayer("groupSimulacao", layerNameFaca);
moveObjectByNameToLayer("groupSimulacaoVerso", layerNameFaca);
if (teraCapaBoca) {
    moveObjectByNameToLayer("capaBoca", layerNameFaca);
}
if (teraCapaFundo) {
    moveObjectByNameToLayer("capaFundo", layerNameFaca);
}
if (np == "sacaria easy open") {
    moveObjectByNameToLayer("capaFundoVerso", layerNameFaca);
}
if (np = "big bag travado") {
    moveObjectByNameToLayer("groupSimulacao", layerNameCotas);
    moveObjectByNameToLayer("simulacaoCordaVerso", layerNameCotas);
    moveObjectByNameToLayer("simulacaoCordaLado1", layerNameCotas);
    moveObjectByNameToLayer("simulacaoCordaLado2", layerNameCotas);
    moveObjectByNameToLayer("textoFrente", layerNameCotas);
    moveObjectByNameToLayer("textoLado1", layerNameCotas);
    moveObjectByNameToLayer("textoVerso", layerNameCotas);
    moveObjectByNameToLayer("textoLado2", layerNameCotas);
    moveObjectByNameToLayer("groupVerso", layerNameFaca);
    moveObjectByNameToLayer("groupLado1", layerNameFaca);
    moveObjectByNameToLayer("groupLado2", layerNameFaca);
}

//Movendo para a layer Fotocelula
moveObjectByNameToLayer("fotocelulaDireitaFrente", layerNameFotocelula);
moveObjectByNameToLayer("fotocelulaEsquerdaFrente", layerNameFotocelula);
moveObjectByNameToLayer("fotocelulaDireitaVerso", layerNameFotocelula);
moveObjectByNameToLayer("fotocelulaEsquerdaVerso", layerNameFotocelula);

//app.redraw();
//=======================Removendo Objetos com base na Planta=======================//
if (np == "sacaria soldada valvulada") {
    removeObjectByName("fotocelulaEsquerdaVerso");

} else if (np == "sacaria boca aberta") {
    removeObjectByName("fotocelulaEsquerdaVerso");
    removeObjectByName("groupSimulacaoDobraCima");

} else if (np == "sacaria easy open") {
    removeObjectByName("fotocelulaDireitaVerso");
    removeObjectByName("fotocelulaDireitaFrente");

} else if (np == "big bag tubular") {
    removeObjectByName("groupSimulacaoDobraCima");
    removeObjectByName("groupSimulacaoDobraBaixo");
    removeObjectByName("fotocelulaDireitaFrente");
    removeObjectByName("fotocelulaEsquerdaVerso");
    removeObjectByName("fotocelulaDireitaVerso");
    removeObjectByName("fotocelulaEsquerdaFrente");

} else if (np == "big bag travado") {
    removeObjectByName("groupSimulacaoDobraCima");
    removeObjectByName("groupSimulacaoDobraBaixo");
    removeObjectByName("fotocelulaDireitaFrente");
    removeObjectByName("fotocelulaEsquerdaVerso");
    removeObjectByName("fotocelulaDireitaVerso");
    removeObjectByName("fotocelulaEsquerdaFrente");

} else if (np == "sacaria costurada boca aberta") {
    removeObjectByName("groupSimulacaoDobraCima");
    removeObjectByName("groupSimulacaoDobraBaixo");
    removeObjectByName("fotocelulaDireitaFrente");
    removeObjectByName("fotocelulaEsquerdaVerso");

} else if (np == "sacaria costurada valvulada") {
    removeObjectByName("fotocelulaEsquerdaVerso");
    removeObjectByName("fotocelulaDireitaFrente");

} else {

}


//========================Ajsute do Artboard==================//
// Seleciona tudo no documento
app.activeDocument.selectObjectsOnActiveArtboard();

// Calcula o limite da seleção
var selectionBounds = app.activeDocument.selection[0].visibleBounds;
for (var i = 1; i < app.activeDocument.selection.length; i++) {
    var currentBounds = app.activeDocument.selection[i].visibleBounds;
    selectionBounds[0] = Math.min(selectionBounds[0], currentBounds[0]);
    selectionBounds[1] = Math.max(selectionBounds[1], currentBounds[1]);
    selectionBounds[2] = Math.max(selectionBounds[2], currentBounds[2]);
    selectionBounds[3] = Math.min(selectionBounds[3], currentBounds[3]);
}

// Converte 20 cm para pontos (1 cm = 2.83465 pts)
var extraSpace = 20 * 2.83465;

// Calcula o tamanho da nova prancheta
var newArtboard = [
    selectionBounds[0] - extraSpace, // Esquerda
    selectionBounds[1] + extraSpace, // Topo
    selectionBounds[2] + extraSpace, // Direita
    selectionBounds[3] - extraSpace // Base
];

// Cria uma nova prancheta com o tamanho calculado
var newArtboardIndex = app.activeDocument.artboards.add(newArtboard).index;

// Remover o primeiro artboard (index 0) e ajustar a prancheta ativa
var artboards = app.activeDocument.artboards;
artboards[0].remove();


// Remove a seleção
app.activeDocument.selection = null;

app.redraw();

// Remover camadas vazias
for (var i = doc.layers.length - 1; i >= 0; i--) {
    var currentLayer = doc.layers[i];
    if (currentLayer.pageItems.length === 0) {
        currentLayer.remove();
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
        folderPathCopy = "\\\\192.168.1.96\\Engine\\_Jobfolder\\" + serviceOrderNumber + "\\_log\\";
    } else {
        // Mac folder path
        folderPathCopy = "/Engine/_Jobfolder/" + serviceOrderNumber + "/_log/";
    }

    return folderPathCopy;
}

// Obtém o caminho para a pasta de destino
var folderPathCopy = getFolderPathCopyLog();

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_PlantaEmbrasa";

// Cria o objeto File para o destino de cópia
var destinoDaCopia = new File(folderPathCopy + "/" + nomeArquivoTxtCopy + ".xml");

// Copia o arquivo para o destino
if (arquivoTxt.copy(destinoDaCopia)) {

} else {
    //alert("VERIFICAR SE ESTA CONECTADO COM O AUTOMATION");
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


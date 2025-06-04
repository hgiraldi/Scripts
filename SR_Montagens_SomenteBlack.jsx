// Prompt para obter o número de ordem de serviço
var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "z_Complementos/Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

var cliente = jsonObject.Customer[0].@attributes.Name;
var cpc = jsonObject.Order[0].@attributes.CustomerP;
var mode = jsonObject.CtP[0].@attributes.Mode;
var cac = jsonObject.Order[0].@attributes.CAC;
var np = jsonObject.Order[0].@attributes.NP;
var type = jsonObject.Job[0].Cameron[0].@attributes.Type;
var folder = jsonObject.Customer[0].@attributes.Folder;
var produtoComUnderline = jsonObject.Order[0].@attributes.Product;
var produto = produtoComUnderline.replace(/_/g, " ");
var nomeArte = jsonObject.Order[0].@attributes.Name;
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
for (i = 0; i < ncores; i++) {
    cores.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    coresD.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    uScreen.push(jsonObject.Inks[0].Ink[i].@attributes.uScreen);
}

var dotShape = [];
for (i = 0; i < ncores; i++) {
    dotShape.push(jsonObject.Inks[0].Ink[i].@attributes.DotShape);
}

// Removendo cores indesejadas
for (i = cores.length - 1; i >= 0; i--) {

    if (cores[i] === "X" || cores[i] === "W" || cores[i] === "Z" || cores[i] === "All" || cores[i].indexOf("##") !== -1) {
        cores.splice(i, 1);
        dotShape.splice(i, 1);
        coresD.splice(i, 1);
        uScreen.splice(i, 1);
    } else {
        // if (dotShape[i] != "C" && dotShape[i] != "R")
        coresD[i] = coresD[i] + " " + dotShape[i];
        uScreen[i] = cores[i] + " " + uScreen[i];
    }
}

var coresComNumeros = [];

for (var i = 0; i < cores.length; i++) {
    var numero = i + 1;
    var corComNumero = numero + " " + cores[i];
    coresComNumeros.push(corComNumero);
}

var closureInput = parseFloat(jsonObject.Job[0].Cylinder[0].@attributes.Reduced);
var cylinderSizeMM = parseFloat(jsonObject.Job[0].Cylinder[0].@attributes.Size);
var objectHeight = parseFloat(jsonObject.Job[0].Package[0].@attributes.Length);
var objectWidth = parseFloat(jsonObject.Job[0].Package[0].@attributes.Width);
var repetitions = parseFloat(jsonObject.Job[0].Repeat[0].@attributes.Length);
var lanes = parseFloat(jsonObject.Job[0].Repeat[0].@attributes.Width);
var sizeCameron = parseFloat(jsonObject.Job[0].Cameron[0].@attributes.Width) || 0;
var distanceCameron = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Cameron) || 0;
var distanceBetweenLanes = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Width) || 0;
var displacementBetweenLanes = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Length) || 0;

// Convert millimeter values to points
objectWidth = objectWidth / 0.35277777777782;
objectHeight = objectHeight / 0.35277777777782;
cylinderSize = cylinderSizeMM / 0.35277777777782;
distanceBetweenLanes = distanceBetweenLanes / 0.35277777777782;
displacementBetweenLanes = displacementBetweenLanes / 0.35277777777782;
sizeCameron = sizeCameron / 0.35277777777782;
distanceCameron = distanceCameron / 0.35277777777782;

// Distância entre os retângulos
var distanceBetweenRectangles = ((objectWidth * lanes) + sizeCameron + (2 * distanceCameron) + ((distanceBetweenLanes * lanes) - distanceBetweenLanes));

// Calculate the total width and height of the assembly in points
var totalWidth = (objectWidth + distanceBetweenLanes) * lanes;
var totalHeight = (objectHeight + distanceBetweenLanes) * repetitions;

var blackPresent = false;

for (var i = 0; i < cores.length; i++) {
    if (cores[i] === "Black") {
        blackPresent = true;
        break; // Encerra o loop assim que a cor for encontrada.
    }
}

// Calculate the gap between repetitions
var gapBetweenRepetitions = (cylinderSize - (objectHeight * repetitions)) / repetitions;

var executeRestOfScript = true;


if (cores.length === 1 && blackPresent) {

} else {
    alert("Arquivo precisa ser somente Black. O script não será processado.");
    executeRestOfScript = false;
}

if (executeRestOfScript) {
    //================= Salvndo PDF e SR =================//

    // Verifica se existe pelo menos uma camada.
    if (app.activeDocument.layers.length > 0) {
        // Define o nome desejado para a camada.
        var novoNome = "arte";

        // Acessa a camada ativa (a camada visível no painel de camadas).
        var camadaAtiva = app.activeDocument.activeLayer;

        // Define o nome da camada para "arte".
        camadaAtiva.name = novoNome;

        // Opcional: Redesenha a tela para refletir a mudança no nome.
        app.activeDocument.activeLayer = camadaAtiva;
    }
    // Verificar se o documento está aberto
    var documento = app.activeDocument;
    var toleranceC = 50;
    var toleranceM = 50;
    var toleranceY = 50;

    // Função para verificar se uma cor atende às condições
    function shouldConvertTo100PercentBlack(color) {
        if (color.cyan === 0 || color.magenta === 0 || color.yellow === 0) {
            return false;
        }

        if (color.black < 40) {
            return false;
        }

        if (color.cyan < toleranceC && color.magenta < toleranceM && color.yellow < toleranceY && color.black < 40) {
            return false;
        }

        return true;
    }

    // Função para ajustar uma cor para o 100% preto
    function adjustTo100PercentBlack(color) {
        color.cyan = 0;
        color.magenta = 0;
        color.yellow = 0;
        color.black = 100;
    }

    // Percorre todos os objetos no documento
    for (var i = 0; i < documento.pageItems.length; i++) {
        var item = documento.pageItems[i];

        if (item.fillColor && shouldConvertTo100PercentBlack(item.fillColor)) {
            // Se a cor de preenchimento atender às condições, ajusta para o 100% preto
            adjustTo100PercentBlack(item.fillColor);
        }

        if (item.strokeColor && shouldConvertTo100PercentBlack(item.strokeColor)) {
            // Se a cor do traço atender às condições, ajusta para o 100% preto
            adjustTo100PercentBlack(item.strokeColor);
        }
    }



    // Função para verificar se uma cor é 100% preta (CMYK 0,0,0,100)
    function isColor100PercentBlack(color) {
        return (
            color.cyan == 0 &&
            color.magenta == 0 &&
            color.yellow == 0 &&
            color.black == 100
        );
    }

    // Percorre todos os objetos no documento
    for (var i = 0; i < documento.pageItems.length; i++) {
        var item = documento.pageItems[i];

        if (item.fillColor && isColor100PercentBlack(item.fillColor)) {
            // Se o preenchimento do objeto for preto (100% CMYK), aplica sobreposição
            item.fillOverprint = true;
        }

        if (item.strokeColor && isColor100PercentBlack(item.strokeColor)) {
            // Se o traço do objeto for preto (100% CMYK), aplica sobreposição
            item.strokeOverprint = true;
        }
    }

    // Local de salvamento
    var nomeDoDocumentoPDF = produtoComUnderline + "_UN.pdf";

    try {
        // Encontrar o objeto com a spot color 'z'
        var objetoComSpotColorZ = null;
        for (var i = 0; i < documento.pageItems.length; i++) {
            var objeto = documento.pageItems[i];
            if (objeto.strokeColor.spot && objeto.strokeColor.spot.name == "z") {
                objetoComSpotColorZ = objeto;
                break; // Parar após encontrar o primeiro objeto
            }
        }

        if (objetoComSpotColorZ) {
            // Selecionar o objeto com a spot color "z"
            objetoComSpotColorZ.selected = true;

            // Centralizar o artboard no objeto com margem
            var margem = 5 * 2.83465; // 5mm em pontos
            var artboard = documento.artboards[0];
            var bounds = objetoComSpotColorZ.geometricBounds;
            artboard.artboardRect = [
                bounds[0] - margem,
                bounds[1] + margem,
                bounds[2] + margem,
                bounds[3] - margem
            ];

            // Criar ou selecionar a layer "faca"
            var facaLayer;
            try {
                facaLayer = documento.layers.getByName("faca");
            } catch (e) {
                facaLayer = documento.layers.add();
                facaLayer.name = "faca";
            }

            // Mover o objeto selecionado para a layer "faca"
            objetoComSpotColorZ.move(facaLayer, ElementPlacement.INSIDE);


            // Salvar como PDF no caminho especificado
            var caminho = new File("~/Desktop/" + produtoComUnderline + "/arte/" + nomeDoDocumentoPDF);
            var opcoesPDF = new PDFSaveOptions();
            opcoesPDF.pDFPreset = "SR"; // Preset PDF "SR"
            documento.saveAs(caminho, opcoesPDF);

            alert("Operações concluídas com sucesso!");
        } else {
            alert("Nenhum objeto com a spot color 'z' encontrado.");
        }
    } catch (e) {
        alert("Ocorreu um erro: " + e.message);
    }





    // Variável com o nome do documento
    var nomeDoDocumento = produtoComUnderline + "_SR";

    // Definir o local do desktop
    var pastaNoDesktop = "~/Desktop/" + produtoComUnderline + "/arte/";


    // Criar uma instância de IllustratorSaveOptions
    var opcoesSalvamento = new IllustratorSaveOptions();

    // Definir as opções desejadas
    opcoesSalvamento.compatibility = Compatibility.ILLUSTRATOR24;
    opcoesSalvamento.pdfCompatible = true;
    opcoesSalvamento.embedICCProfile = false;
    opcoesSalvamento.embedLinkedFiles = false;
    opcoesSalvamento.compressed = false;



    // Verifique se o arquivo PDF existe
    var pdfFileMontagem = File(pastaNoDesktop + produtoComUnderline + "_UN.pdf");

    if (pdfFileMontagem.exists) {
        // Criar um novo documento
        var novoDocumento = app.documents.add(DocumentColorSpace.CMYK);

        // Salvar o documento com o nome desejado no local especificado
        var caminhoDoDocumento = pastaNoDesktop + nomeDoDocumento + ".ai";
        novoDocumento.saveAs(new File(caminhoDoDocumento), opcoesSalvamento);

        // Colocar o PDF no novo documento
        var doc = app.activeDocument;
        var placedItem = doc.placedItems.add();
        placedItem.file = pdfFileMontagem;


    } else {
        alert("O arquivo PDF não foi encontrado.");
    }

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

    // Define a branca preta em CMYK
    var whiteCMYK = new CMYKColor();
    corBlack.cyan = 0;
    corBlack.magenta = 0;
    corBlack.yellow = 0;
    corBlack.black = 0;

} else {

}

#include "z_Complementos/montagens.jsx"

// Verificando se o produto está no nome do arquivo
var nomeArquivo = app.activeDocument.name;
if ((nomeArquivo.indexOf(produtoComUnderline) !== -1) && (cores.length == 1) && (!temProblema)) {
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

} else if ((!blackPresent) && (cores.length > 1)) {
    // Caso o produto não esteja no nome do arquivo, exibir um alerta personalizado
    var alertWindow = new Window("dialog", "Não possui somente Black na OS");
    alertWindow.orientation = "column";

    var aviso = alertWindow.add("statictext", undefined, "Não possui somente Black na OS");
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



// Função para redimensionar objetos selecionados verticalmente
function redimensionarVerticalmente() {
    // Obter os tamanhos do cilindro e do fechamento das entradas do diálogo
    var tamanhoCilindro = cylinderSizeMM;
    var tamanhoFechamento = closureInput;

    // Calcular a porcentagem de redimensionamento
    var porcentagemRedimensionamento = (tamanhoFechamento / tamanhoCilindro) * 100;

    // Obter a seleção atual
    var selecao = app.activeDocument.selection;

    // Verificar se a seleção não está vazia
    if (selecao.length === 0) {
        alert("Nenhum objeto selecionado.");
        return;
    }


    // Criar um grupo temporário para os itens selecionados
    var grupoTemporario = app.activeDocument.groupItems.add();
    grupoTemporario.name = "Grupo Temporário";

    // Armazenar os itens originais e suas camadas originais
    var itensOriginais = [];
    var camadasOriginais = [];
    for (var i = 0; i < selecao.length; i++) {
        var item = selecao[i];
        itensOriginais.push(item);
        camadasOriginais.push(item.layer);
        item.move(grupoTemporario, ElementPlacement.PLACEATEND);
    }

    // Redimensionar verticalmente o grupo temporário (que agora contém todos os objetos)
    var limitesGrupo = grupoTemporario.geometricBounds;
    var alturaOriginal = limitesGrupo[2] - limitesGrupo[0];
    var fatorEscalaVertical = porcentagemRedimensionamento / 100;
    var novaAltura = alturaOriginal * fatorEscalaVertical;
    var fatorEscalaVerticalAbsoluto = novaAltura / alturaOriginal;
    grupoTemporario.resize(100, fatorEscalaVerticalAbsoluto * 100, true, true, true, true);

    // Mover os objetos de volta para suas camadas originais e posições originais
    for (var j = 0; j < itensOriginais.length; j++) {
        var item = itensOriginais[j];
        var camadaOriginal = camadasOriginais[j];
        item.move(camadaOriginal, ElementPlacement.PLACEATEND);
    }

    // Remover o grupo temporário
    grupoTemporario.remove();

    // Alertar o usuário sobre a operação de redimensionamento
    alert("Objetos selecionados distorcidos verticalmente em " + porcentagemRedimensionamento + "%");
}

// Seleciona todos os objetos no documento.
doc.selectObjectsOnActiveArtboard();
redimensionarVerticalmente();

// Função para exibir os arrays em um alerta
function mostrarArrays() {
    var alertText =
        "Array cores: " + cores.join(", ") + "\n" +
        "Array allColors: " + allColors.join(", ") + "\n" +
        "Array CoresComuns: " + coresComuns.join(", ");
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
        pastaDestino = "\\\\192.168.1.15\\uteis\\_Padroes_clientes_Alpha\\_Scripts\\Utilizacao\\";
    } else {
        // Mac folder path
        pastaDestino = "/uteis/_Padroes_clientes_Alpha/_Scripts/Utilizacao/";
    }

    return pastaDestino;
}

// Obtém o caminho da pasta
var pastaDestino = getFolderPathUtilizacao();

var conteudo = '<Illustrator Origem ="' + nomeScript + '">' +
    '<Log Cliente ="' + cliente + '"' +
    ' Script ="' + nomeScript + '"' +
    ' Order ="' + serviceOrderNumber + '"' +
    ' CP ="' + produtoComUnderline + '"' +
    ' Operador ="' + resultadoOperador + '"/>' +
    '</Illustrator>'


// Cria o objeto File para o arquivo de texto
var arquivoTxt = new File(pastaDestino + "/" + nomeArquivoTxt + ".xml");

// Cria o arquivo e escreve o conteúdo
arquivoTxt.open("w");
arquivoTxt.write(conteudo);
arquivoTxt.close();
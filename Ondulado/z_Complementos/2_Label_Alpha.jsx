#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;


// Função para adicionar zeros à esquerda, se necessário
function adicionarZero(numero) {
    if (numero < 10) {
        return "0" + numero;
    }
    return numero.toString();
}


//Registration
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
function createSpotColor(c, m, y, k, colorName) {
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
createSpotColor(100, 0, 0, 0, "Cyan");
createSpotColor(0, 100, 0, 0, "Magenta");
createSpotColor(0, 0, 100, 0, "Yellow");
createSpotColor(0, 0, 0, 100, "Black");

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
        nomeCor = nomeCor.replace(/PROCESS /g, '').replace(/PANTONE /g, '').replace(/ C$/, '');
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

    // Se nenhuma cor for encontrada: NAO usar alert (orfao no CEP trava o Illustrator)
    if (!corEncontrada) {
        // alert("Cor não encontrada: " + cor);
    }
}





// Função para formatar a data de hoje (DD/MM/AA)
function formatarData(data) {
    var dia = adicionarZero(data.getDate());
    var mes = adicionarZero(data.getMonth() + 1);
    var ano = adicionarZero(data.getFullYear() % 100); // Pegando os dois últimos dígitos do ano
    return dia + '/' + mes + '/' + ano;
}


function label(cust) {

    // Verifica se a camada "registros" já existe
    var layerLabel = app.activeDocument.layers.getByName("label");

    // Se a camada "registros" não existir, crie-a
    if (!layerLabel) {
        layerLabel = app.activeDocument.layers.add();
        layerLabel.name = "label";
    }

    // Ative a camada "registros" para que tudo criado a partir daqui seja colocado nela
    layerLabel.visible = true;
    app.activeDocument.activeLayer = layerLabel;

    if (cust == undefined) {
        cust = folder
    }

    if (((cust.indexOf("rioplastic") >= 0) || (cust.indexOf("embalagens_doma") >= 0)) && ((mode == "Advantage") || (mode == "Bellissima"))) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // ~1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posiciona o texto base
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // --- checa se é Bellissima COM algum coresD != "C"
        var isBellissima = (mode == "Bellissima");
        var hasNonC = false;
        if (isBellissima && coresD && coresD.length) {
            for (var j = 0; j < coresD.length; j++) {
                if ( coresD[j] !== "C") {
                    hasNonC = true;
                    break;
                }
            }
        }

        // Cria um textFrame por cor já com o conteúdo correto (uScreen ou mix)
        var coresTexto = [];
        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();

            if (isBellissima && hasNonC) {
                
                if (dotShape[i] == "C") {
                    corTexto.contents = uScreen[i];
                    // alert("Aqui")  // debug removido (alert orfao trava o CEP)
                } else {
                    corTexto.contents = coresD[i];
                    // alert("Aqui 2")  // debug removido (alert orfao trava o CEP)
                }
            } else {
                // Advantage ou Bellissima sem não-C: usa uScreen puro
                corTexto.contents = uScreen[i];
            }

            coresTexto.push(corTexto);
        }

        // Aplica cor conforme coresComuns
        for (var j = 0; j < coresComuns.length && j < coresTexto.length; j++) {
            aplicarCorTexto(coresTexto[j], coresComuns[j]);
        }

        // Posiciona as tags de cor na sequência
        var textoCores = doc.textFrames.add(); // (mantido se você usa em outro lugar)
        var xPosition = texto.width + 5;

        for (var k = 0; k < coresTexto.length; k++) {
            var t = coresTexto[k];
            t.textRange.characterAttributes.size = 5;
            t.position = [xPosition, -5];
            xPosition += t.width + 1; // espaçamento
            t.move(grupoLabel, ElementPlacement.PLACEATEND);
        }

    } else if (((cust.indexOf("rioplastic") >= 0) || (cust.indexOf("embalagens_doma") >= 0)) && (mode == "HD Flexo")) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = coresD[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }


        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }


    } else if (cliente === "VIDEPLAST RIO VERDE") {



        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cac + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }








    } else if (cliente === "VIDEPLAST VIDEIRA" || cliente === "VIDEPLAST UNIAO DA V") {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - MAT: " + cpc + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }



    } else if ((cust.indexOf("valfilm_mg") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

    } else if ((cust.indexOf("valgroup_ba1") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

    } else if ((cust.indexOf("tecnoval_laminados") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }



    } else if ((cust.indexOf("valmaster") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }



    } else if ((cust.indexOf("valfilm_lorena") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + "Des. " + cylinderSizeMM + " - Fechamento " + closureInput + " - FRENTE/VERSO - " + lpc + "lpc - " + formatarData(new Date()) + " - ALPHA ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }


    } else if ((cust.indexOf("valgroup_fi") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + "Des. " + cylinderSizeMM + " - Fechamento " + closureInput + " - FRENTE/VERSO - " + lpc + "lpc - " + formatarData(new Date()) + " - ALPHA ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();

            // Verificar se a cor é 'branco' ou 'verniz' e substituir
            if (cores[i] === "branco" || cores[i] === "Branco" || cores[i] === "BRANCO") {
                corTexto.contents = "White";
            } else if (cores[i] === "verniz" || cores[i] === "Verniz" || cores[i] === "VERNIZ" || cores[i] === "verniz total" || cores[i] === "Verniz Total" || cores[i] === "VERNIZ TOTAL") {
                corTexto.contents = "Full Varnish";
            } else {
                corTexto.contents = cores[i]; // Caso contrário, mantém a cor original
            }

            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }


    } else if ((cust.indexOf("fascreen") >= 0)) {


        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + cpc + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    } else if ((cust.indexOf("viskase") >= 0)) {


        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - FRENTE/VERSO - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    } else if ((cust.indexOf("protervac") >= 0)) {


        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - FRENTE/VERSO - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    } else if ((cust.indexOf("serviplas") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = "ALPHA - " + cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 9; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 9;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);


    } else if ((cust.indexOf("puma") >= 0) || (cust.indexOf("printek") >= 0) || (cust.indexOf("vr_label") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + cpc + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);


    } else if (cust.indexOf("ceti") >= 0) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = coresComPant[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);



    } else if ((cust.indexOf("olimplastic") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cac + " - " + formatarData(new Date()) + " - ";
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);


    } else {
        //padrão ALpha
        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);


    }

    textoCores.remove();

}


// Verificando se o produto está no nome do arquivo
var nomeArquivo = app.activeDocument.name;
if ((nomeArquivo.indexOf(produtoComUnderline) !== -1) && (coresComuns.length == cores.length)) {
    // Criando o texto no Illustrator somente se o produto estiver no nome do arquivo
    var doc = app.activeDocument;

    // Verifica se a layer "registros" existe, caso contrário, cria uma nova layer com o nome "registros"
    var layerLabel = null;
    try {
        layerLabel = doc.layers.getByName("label");
    } catch (e) {
        layerLabel = doc.layers.add();
        layerLabel.name = "label";
    }

    // Altera para a layer "registros" antes de criar o texto
    doc.activeLayer = layerLabel;

    // Suprime dialogos do Illustrator durante a geracao (fonte ausente, avisos,
    // substituicao...): no motor do CEP um dialogo implicito fica ORFAO e CONGELA
    // o Illustrator. Restaura sempre (try/finally), mesmo se der erro.
    var __uilLabel = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    try {
        label();
    } finally {
        app.userInteractionLevel = __uilLabel;
    }







}
// Sem aviso/alert: cria o label e segue; o painel mostra "concluido".



// Função para exibir os arrays em um alerta
function mostrarArrays() {
    var alertText =
        "cores: " + cores.join(", ") + "\n" +
        "allColors: " + allColors.join(", ") + "\n" +
        "CoresComuns: " + coresComuns.join(", ") + "\n" +
        "uScreen: " + uScreen.join(",") + "\n" +
        "coresD: " + coresD.join(",") + "\n" +
        "coresSemVernizBranco: " + coresSemVernizBranco.join(",") + "\n" +
        "dotShape: " + dotShape.join(",");
    // alert(alertText); // debug; nunca usar alert pelo painel (orfao trava o CEP)
}


//mostrarArrays();

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
        folderPathCopy = "\\\\aeserver16\\Engine\\_Jobfolder\\" + serviceOrderNumber + "\\_log\\";
    } else {
        // Mac folder path
        folderPathCopy = "/Engine/_Jobfolder/" + serviceOrderNumber + "/_log/";
    }

    return folderPathCopy;
}

// Obtém o caminho para a pasta de destino
var folderPathCopy = getFolderPathCopyLog();

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_Label";

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
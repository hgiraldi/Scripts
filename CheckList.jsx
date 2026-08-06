// Se a O.S. ja veio de fora (o painel CEP define $.global.serviceOrderNumber
// antes de rodar este script), NAO pergunta de novo. Rodando sozinho, pergunta.
// IMPORTANTE: checar via $.global -> o "var serviceOrderNumber" abaixo, por
// hoisting, sombreia o global e fica undefined; checar pelo nome dava sempre o
// prompt. Pelo $.global pega o valor real que o painel setou.
if (typeof $.global.serviceOrderNumber === "undefined" || !$.global.serviceOrderNumber) {
    $.global.serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");
}
var serviceOrderNumber = $.global.serviceOrderNumber;

#include "Flexivel/z_Complementos/Xml_upload.jsx"

// Exibindo o array resultante com alert
var clickString = "click = " + clickArray.join(", ");
//alert(clickString);

var doc = app.activeDocument;
var linksArte = [];
var placedItems = doc.placedItems;
var coordenadasLinksArte = [];
var gruposPorY = {};
var gruposPorX = {};
var tolerancia = 0.1;

// Fator de conversão de pontos (unidade padrão do Illustrator) para milímetros
var pontoParaMM = 2.83464567;

var linksRuins = 0; // links da arte INCORPORADOS (embed) ou AUSENTES (sem arquivo)

// Iterar sobre os links para capturar coordenadas
for (var i = 0; i < placedItems.length; i++) {
    var currentLink = placedItems[i];
    var currentLayer = currentLink.layer;

    if (currentLayer.name === "arte" && currentLayer.visible) {
        linksArte.push(currentLink);

        // Capturar as coordenadas x e y do link na layer "arte"
        var posX = currentLink.position[0];
        var posY = currentLink.position[1];
        // .file estoura 'Error 9062' se o link estiver INCORPORADO (embed) ou AUSENTE.
        var linkName;
        try {
            linkName = currentLink.file.name; // Nome do link
        } catch (eLink) {
            linkName = "[incorporado/ausente]";
            linksRuins++;
        }

        coordenadasLinksArte.push({
            x: posX,
            y: posY,
            name: linkName
        });

        // Agrupar por coordenada Y
        var grupoYEncontrado = false;
        for (var grupoY in gruposPorY) {
            if (Math.abs(grupoY - posY) <= tolerancia) {
                gruposPorY[grupoY].push(posX);
                grupoYEncontrado = true;
                break;
            }
        }
        if (!grupoYEncontrado) {
            gruposPorY[posY] = [posX];
        }

        // Agrupar por coordenada X com base nos nomes dos links
        var grupoXEncontrado = false;
        for (var grupoX in gruposPorX) {
            if (Math.abs(grupoX - posX) <= tolerancia) {
                gruposPorX[grupoX].push(linkName);
                grupoXEncontrado = true;
                break;
            }
        }
        if (!grupoXEncontrado) {
            gruposPorX[posX] = [linkName];
        }
    }
}

// Se algum link da arte estiver INCORPORADO ou AUSENTE (sem arquivo): AVISA e PARA,
// pra o operador relinkar/verificar antes. Menu antigo -> alert; painel -> banner.
if (linksRuins > 0) {
    var msgLink = linksRuins + " link(s) na arte estao INCORPORADOS ou AUSENTES. "
                + "Relinke/verifique os arquivos antes de rodar o CheckList.";
    if (typeof $.global !== "undefined" && typeof $.global.painelMsg === "function") {
        throw msgLink;      // PAINEL: banner "ERRO: ..." e PARA
    } else {
        alert(msgLink);     // MENU ANTIGO: alert na tela
        throw msgLink;      // PARA a execucao
    }
}

// Criar mensagem para exibir no alert
var mensagem = "Grupos por X (nomes dos links no mesmo eixo X):\n\n";
for (var x in gruposPorX) {
    mensagem += "X = " + x + ":\n" + gruposPorX[x].join(", ") + "\n\n";
}

// Exibir os agrupamentos em um alert no Illustrator
//alert(mensagem);


// Calcular as distâncias horizontais entre os links de cada grupo
for (var grupoY in gruposPorY) {
    var coordenadasX = gruposPorY[grupoY];

    // Ordenar as coordenadas X para calcular as distâncias na ordem correta
    coordenadasX.sort(function(a, b) {
        return a - b;
    });

    var textoGrupo = "Grupo Y = " + (grupoY / pontoParaMM).toFixed(2) + " mm:\n";

    // Calcular distâncias entre as coordenadas X do grupo
    for (var j = 0; j < coordenadasX.length - 1; j++) {
        var distanciaHorizontalPontos = Math.abs(coordenadasX[j] - coordenadasX[j + 1]);
        var distanciaHorizontalMM = distanciaHorizontalPontos / pontoParaMM;

        textoGrupo += "  Distância entre X" + (j + 1) + " e X" + (j + 2) + " = " + distanciaHorizontalMM.toFixed(2) + " mm\n";
    }

    // Exibir o resultado do grupo
    //alert(textoGrupo);
}


var nomeArquivo = app.activeDocument.name;

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
// Funções para achar as pastas

// Function to get platform-specific folder path
function getFolderPathCopyLog() {
    var folderPathCopy = "";

    // caminho unico p/ Windows e Mac (alphaBaseEngine/alphaBaseUteis resolvem a rede)
    folderPathCopy = alphaBaseEngine() + "/_Jobfolder/" + serviceOrderNumber + "/_log/";

    return folderPathCopy;
}

// Function to get platform-specific folder path
function getFolderPathCopyAlphaJob() {
    var folderPathCopy = "";

    // caminho unico p/ Windows e Mac (alphaBaseEngine/alphaBaseUteis resolvem a rede)
    folderPathCopy = alphaBaseEngine() + "/_AccessPoint/AlphaJob/";

    return folderPathCopy;
}

// Nomes das cores a serem removidas
var nomesCoresParaRemover = ["Cyan", "Magenta", "Yellow", "Black"];

// Obtém o documento ativo
var documentoAtivo = app.activeDocument;

// Obtém a paleta de amostras do documento ativo
var paletaAmostras = documentoAtivo.swatches;

// Chama a função para excluir as cores
excluirCores(paletaAmostras, nomesCoresParaRemover);

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

//variaveis para checar se vai criar o milestone ou não
var eMontadoEDistorcido = false;
if (supplied.indexOf("ontado e distorcido") > 0) {
    eMontadoEDistorcido = true;
} else {

}

//=============================Variaveis de Comparação===============================//
//var scriptLabelOK = false;
var codCoresOK = true;
var preenchimentoOK = true;
var scriptPistasOK = true;
var conjugacaoOK = true;
var todasDistanciasCorretas = true;
var fezMedicaoLayers = false;
var scriptMedicaoOndulado = false;
var scriptDistorcaoOK = false;
var scriptMontagemOK = false;
var osOK = false;
var nomeClienteOK = false;
var patternCount = 1;
var distorcaoOK = false;
var linkOk = false;
var labelOK = false;
var coresOK = false;
var facaOK = true;
var montagemOK = false;
var linksChecados = true;
var fezMontagemDist = false;
var medicaoScript = false;
if (medicao == "MS") {
    medicaoScript = true;
} else {

}
var eScriptObrigatorio = false;
if (scriptAlpha == "true") {
    eScriptObrigatorio = true;
} else {

}

var precisaDeCheck = true;
if (((status.indexOf("egravação") > 0) || (status.indexOf("epetição") > 0)) && (folder != "pp_print" && folder != "brl_embalagens")) {
    precisaDeCheck = false;
} else {

}

var precisaDePistas = false;

if ((status.indexOf("egravação") > 0) || (status.indexOf("epetição") > 0)) {
    precisaDePistas = false;
} else if ((folder == "conver" ||
        folder == "brl_embalagens" ||
        folder == "pp_print")) {
    precisaDePistas = true;

}

var eTesteForm = false;
if ((nomeArte.indexOf("Teste Form") >= 0) ||
    (nomeArte.indexOf("Single Color") >= 0) ||
    (nomeArte.indexOf("Test Form") >= 0) ||
    (nomeArte.indexOf("Teste P2P") >= 0) ||
    (nomeArte.indexOf("Test P2P") >= 0) ||
    (nomeArte.indexOf("Test Gama") >= 0) ||
    (nomeArte.indexOf("Teste Gama") >= 0)
) {
    eTesteForm = true;
} else {

}

var numerosArray = [];
var textosProcessados = []; // Array para rastrear objetos de texto processados

// Função para verificar se um objeto de texto já foi processado
function textoJaProcessado(item) {
    for (var i = 0; i < textosProcessados.length; i++) {
        if (textosProcessados[i] === item) {
            return true;
        }
    }
    return false;
}

// Função para percorrer todos os objetos de texto no documento
function extrairNumerosDeTexto(item) {
    // Verifica se o objeto de texto não está em uma das camadas específicas e se é um TextFrame
    if (item.typename === "TextFrame" && !isInExcludedLayer(item)) {
        // Verifica se o objeto já foi processado
        if (!textoJaProcessado(item)) {
            // Marca o objeto como processado
            textosProcessados.push(item);

            // Extrai o texto do quadro de texto
            var texto = item.contents;

            // Usa expressão regular para encontrar números no texto
            var numeros = texto.match(/\d+/g);

            // Adiciona os números ao array
            if (numeros) {
                numerosArray = numerosArray.concat(numeros);
            }
        }
    }

    // Verifica se o objeto possui subitens (como grupos) e os percorre recursivamente
    if (item.pageItems) {
        for (var i = 0; i < item.pageItems.length; i++) {
            extrairNumerosDeTexto(item.pageItems[i]);
        }
    }
}

// Função para verificar se o objeto está em uma camada excluída
function isInExcludedLayer(item) {
    var excludedLayers = ["cotas", "04", "sep"]; // Nomes das camadas a serem excluídas

    // Verifica se o objeto está em uma camada excluída
    for (var i = 0; i < excludedLayers.length; i++) {
        if (item.layer.name === excludedLayers[i]) {
            return true;
        }
    }

    return false;
}

// Função para remover espaços em branco do início e do fim de uma string
function trimString(str) {
    return str.replace(/^\s+|\s+$/g, '');
}

// Função para extrair o conteúdo de texto de um documento, ignorando espaços em branco
function extractTextFromDocument(doc) {
    var allText = [];
    for (var i = 0; i < doc.textFrames.length; i++) {
        var textFrame = doc.textFrames[i];
        if (!isInExcludedLayer(textFrame)) {
            var textContent = trimString(textFrame.contents);
            if (textContent.length > 0) {
                allText.push(textContent);
            }
        }
    }
    return allText;
}

// Função para contar a ocorrência de um padrão
function countPatternOccurrences(allFonts, pattern) {
    var regex = new RegExp(pattern, "g");
    var count = 0;
    for (var i = 0; i < allFonts.length; i++) {
        var matches = allFonts[i].match(regex);
        if (matches) {
            count += matches.length;
        }
    }
    return count;
}


// Função principal
function main() {
    var doc = app.activeDocument;
    var allFonts = extractTextFromDocument(doc);
    var allFontsString = allFonts.join("");
    allFontsString = allFontsString.replace(/[^a-zA-Z0-9]/g, "");
    allFontsString = allFontsString.toLowerCase();
    var pattern = "\\d{6}rev\\d{2}v\\d{2}"; // Padrão: 6 números + "rev" + 2 números + "v" + 2 números
    patternCount = countPatternOccurrences([allFontsString], pattern);

    // Resultado
    //alert("Fonts: " + allFontsString);
    //alert("Pattern Count: " + patternCount);
}


if ((folder != "ingaflex") || (folder != "grafica_goncalves")) {

    extrairNumerosDeTexto(doc);

} else {

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

function containsSpotZ(allColors) {
    // Normalizando os nomes das cores para comparação
    var normalizedColors = [];
    for (var i = 0; i < allColors.length; i++) {
        normalizedColors.push(allColors[i].toLowerCase());
    }

    // Verificando se existe a cor "z" ou começando com "z_"
    for (var j = 0; j < normalizedColors.length; j++) {
        if (normalizedColors[j] === 'z' || normalizedColors[j].indexOf('z_') === 0) {
            return true;
        }
    }
    return false;
}


var hasSpotZ = containsSpotZ(allColors);

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

var tamanhoCilindro = cylinderSizeMM || 0;
var tamanhoFechamento = closureInput || 0;

// Calcular a porcentagem de redimensionamento
var porcentagemRedimensionamento = (tamanhoFechamento / tamanhoCilindro) * 100;
//alert(porcentagemRedimensionamento);
porcentagemRedimensionamento = Math.round(porcentagemRedimensionamento * 100) / 100;
//alert(porcentagemRedimensionamento);

// Verificar se há links
if (linksArte.length === 0) {
    distorcaoOK = true;
    alert("SEM ARQUIVO LINKADO OU EM LAYER ERRADA (ARTE) - NÃO CHECADO A DISTORÇÃO E NEM LINK")
    linksChecados = false;
} else if ((folder != "polyplastic") &&
    (!eTesteForm) &&
    (folder != "brasplast") &&
    (!eMontadoEDistorcido) &&
    (!eAproveitamento)
) {

    //Checar Distorção
    for (var i = 0; i < linksArte.length; i++) {
        var placedItem = linksArte[i];

        // Obtém a matriz de transformação do item colocado
        var matrix = placedItem.matrix;

        // Obtém a rotação do item colocado em graus
        var rotation = Math.atan2(matrix.mValueB, matrix.mValueA) * (180 / Math.PI);
        rotation = Math.round(rotation);
        //alert(rotation);


        // Verifica se a rotação está em um dos ângulos desejados (90, -90, 180, 0)
        if (rotation === 90 || rotation === -90 || rotation === 180 || rotation === -180 || rotation === 0) {


            var scaleHorizontal = (Math.sqrt(matrix.mValueA * matrix.mValueA + matrix.mValueB * matrix.mValueB)) * 100;
            //alert(scaleHorizontal);
            scaleHorizontal = Math.round(scaleHorizontal * 100) / 100;
            //alert(scaleHorizontal);

            var scaleVertical = (Math.sqrt(matrix.mValueC * matrix.mValueC + matrix.mValueD * matrix.mValueD)) * 100;
            //alert(scaleVertical);
            scaleVertical = Math.round(scaleVertical * 100) / 100;
            //alert(scaleVertical);



            // Verifica se a porcentagem de redimensionamento não é 100 nem 0
            if (porcentagemRedimensionamento !== 100 && porcentagemRedimensionamento !== 0 && porcentagemRedimensionamento !== Infinity && !isNaN(porcentagemRedimensionamento)) {
                // Verifica se a escala é diferente da porcentagem de redimensionamento
                if ((scaleHorizontal != porcentagemRedimensionamento && scaleVertical != porcentagemRedimensionamento) || (scaleHorizontal == scaleVertical)) {
                    // Exibe um aviso
                    alert("O ARQUIVO NÃO ESTÁ DISTORCIDO OU COM DISTORÇÃO ERRADA");
                    distorcaoOK = false;
                    break;
                } else {
                    distorcaoOK = true;
                }
            } else {
                distorcaoOK = true;
            }

        } else {
            distorcaoOK = true;
        }
    }
} else {
    distorcaoOK = true;
}

//Checar faca
var PossuiItem = false;
var facaLayer;

try {
    facaLayer = doc.layers.getByName("faca");
    PossuiItem = facaLayer.pageItems.length > 0;
} catch (e) {
    facaLayer = false;
}

// Se a camada "faca" não for encontrada, procurar a subcamada "faca"
if (!facaLayer) {
    var allLayers = doc.layers;
    for (var i = 0; i < allLayers.length; i++) {
        var parentLayer = allLayers[i];
        try {
            facaLayer = parentLayer.layers.getByName("faca");
            if (facaLayer) {
                PossuiItem = facaLayer.pageItems.length > 0;
                break;
            }
        } catch (e) {
            facaLayer = false;
        }
    }
}

var possuiEmbalagem;

if ((objectHeight !== "") && (objectHeight > 0) && (!eMontadoEDistorcido)) {
    possuiEmbalagem = true;
} else {
    possuiEmbalagem = false;
}

var hasFill = false;
var hasStroke = false;
var fillOverprintOK = false;
var strokeOverprintOK = false;
var blendMode = "";

function processarItem(item) {
    if (item.typename === "PathItem") {
        hasFill = item.filled;
        hasStroke = item.stroked;
        fillOverprintOK = hasFill && item.fillOverprint;
        strokeOverprintOK = hasStroke && item.strokeOverprint;
        blendMode = item.blendingMode;
        //alert("É Path");
        //alert(hasFill);
        //alert(hasStroke);
        //alert(fillOverprintOK);
        //alert(strokeOverprintOK);
        //alert(blendMode);

        if (((hasFill && hasStroke && fillOverprintOK && strokeOverprintOK) ||
                ((hasFill || hasStroke) && (fillOverprintOK || strokeOverprintOK))) &&
            blendMode === BlendModes.NORMAL) {
            facaOK = true;
            //alert("Aqui1")
            return true;

        } else {
            facaOK = false;
            alert("FACA SEM OVERPRINT OU COM OVERPRINT + MULTIPLAY");
            return false;
        }

    } else if (item.typename === "CompoundPathItem") {
        hasFill = hasFill || (item.pathItems.length > 0 && item.pathItems[0].filled);
        hasStroke = hasStroke || (item.pathItems.length > 0 && item.pathItems[0].stroked);
        fillOverprintOK = fillOverprintOK || (item.pathItems.length > 0 && item.pathItems[0].filled && item.pathItems[0].fillOverprint);
        strokeOverprintOK = strokeOverprintOK || (item.pathItems.length > 0 && item.pathItems[0].stroked && item.pathItems[0].strokeOverprint);
        blendMode = item.blendingMode;
        //alert("É CompoundPath");
        //alert(hasFill);
        //alert(hasStroke);
        //alert(fillOverprintOK);
        //alert(strokeOverprintOK);
        //alert(blendMode);
        if (((hasFill && hasStroke && fillOverprintOK && strokeOverprintOK) ||
                ((hasFill || hasStroke) && (fillOverprintOK || strokeOverprintOK))) &&
            blendMode === BlendModes.NORMAL) {
            facaOK = true;
            //alert("Aqui2")
            return true;

        } else {
            facaOK = false;
            alert("FACA SEM OVERPRINT OU COM OVERPRINT + MULTIPLAY");
            return false;
        }
    }

}


function processarGrupo(grupo) {
    for (var j = 0; j < grupo.pageItems.length; j++) {
        var subItem = grupo.pageItems[j];
        var grupoBlendeMode = grupo.blendingMode;

        if (facaOK) {

            if (grupoBlendeMode != BlendModes.NORMAL) {
                facaOK = false;
                alert("FACA SEM OVERPRINT OU COM OVERPRINT + MULTIPLAY");
                return;

            } else if (subItem.typename === "GroupItem" && grupoBlendeMode == BlendModes.NORMAL) {
                processarGrupo(subItem); // Chamada recursiva para processar grupos internos

            } else {

                processarItem(subItem);

            }
        } else {
            //alert("FacaOK = False Grupo")
        }

    }
}

if (facaLayer && hasSpotZ && PossuiItem) {
    for (var i = 0; i < facaLayer.pageItems.length; i++) {
        var item = facaLayer.pageItems[i];

        if (facaOK) {

            if (item.typename === "GroupItem") {
                processarGrupo(item); // Chamar a função para processar grupos
            } else {
                processarItem(item);
            }

        } else {
            //alert("FacaOK = False Item")

        }
    }
} else if (!facaLayer && possuiEmbalagem) {
    alert("ARQUIVO SEM LAYER DE FACA")
    facaOK = false;

} else if (!PossuiItem && possuiEmbalagem) {
    alert("SEM OBJETO NA LAYER DE FACA")
    facaOK = false;

} else if (facaLayer && !hasSpotZ) {
    alert("FACA NÃO ESTA NA COR CORRETA ('Z')")
    facaOK = false;

} else {
    facaOK = true;
    //alert("Passou reto");
}

//Checar links

// Itera sobre os links e verifica se a variável produtoComUnderline está presente nos nomes
if (linksArte.length === 0) {
    linkOk = true;
    linksChecados = false;
} else {
    for (var i = 0; i < linksArte.length; i++) {
        var link = linksArte[i];
        var linkNome = link.file.name; // Obtém o nome do link

        // Verifica se a variável produtoComUnderline está presente no nome do link
        if (linkNome.indexOf(produtoComUnderline) === -1) {
            alert("ARQUIVO UNITARIO LINKADO ERRADO, NÃO CORRESPONDE COM A OS, FAVOR VERIFICAR");
            break;
        }
        linkOk = true;
    }
}

//Checar Montagem
if ((montagem > 0) &&
    (linksArte.length != 0) &&
    (!eMontadoEDistorcido) &&
    (folder != "valfilm_mg") &&
    (folder != "valgroup_ba1") &&
    (folder != "valmaster") &&
    (folder != "valgroup_fi") &&
    (folder != "valfilm_lorena") &&
    (folder != "tecnoval_laminados")) {
    if (montagem === linksArte.length) {
        montagemOK = true;
    } else {
        alert("MONTAGEM ERRADA - QUANTIDADE DE LINKS NÃO CORRESPONDE COM A MONTAGEM")
        montagemOK = false;
    }
} else {
    montagemOK = true;
}

//Checar Cores do Arquivo com OS
if (coresComuns.length === cores.length) {
    coresOK = true;
} else {
    alert("AS CORES DO ARQUIVO NÃO CORRESPONDEM COM OS, FAVOR VERIFICAR");
}

function occurrences(string, subString, allowOverlapping) {
    string += "";
    subString += "";
    if (subString.length <= 0) return (string.length + 1);
    var n = 0,
        pos = 0,
        step = allowOverlapping ? 1 : subString.length;
    while (true) {
        pos = string.indexOf(subString, pos);
        if (pos >= 0) {
            ++n;
            pos += step;
        } else break;
    }
    return n;
}



//Checar se possui o label
if ((folder != "ingaflex") && (folder != "grafica_goncalves") && (folder != "penha_sa") && (folder != "pp_print") && (folder != "brl_embalagens")) {

    main();
    //alert("entrou1")

    var numerosString = numerosArray.join("");
    //alert(numerosString);
    var numerosProduto = produto.replace(/\D/g, '');

    var count = occurrences(numerosString, numerosProduto, false);
    //alert("Count = " + count);
    //alert("PatternCount = " + patternCount)

    if (patternCount != count) {
        alert("O LABEL DE CORES ESTÁ INCORRETO, FAVOR VERIFICAR");
        labelOK = false;
    } else {
        labelOK = true;
    }

} else if ((folder == "pp_print") || (folder == "brl_embalagens")) {

    main();

    //alert("entrou2")

    var numerosString = numerosArray.join("");
    //alert(numerosString);
    var numerosProduto = produto.replace(/\D/g, '');

    var count = occurrences(numerosString, numerosProduto, false);
    //alert("Count = " + count);
    //alert("PatternCount = " + patternCount)

    if (patternCount != count) {
        alert("O LABEL DE CORES ESTÁ INCORRETO, FAVOR VERIFICAR");
        labelOK = false;
    } else {
        labelOK = true;
    }

    var referenciaCorLimpa = [];

    for (var i = 0; i < referenciaCor.length; i++) {
        referenciaCorLimpa.push(
            referenciaCor[i].replace(/\D/g, "")
        );
    }


    for (var i = 0; i < referenciaCorLimpa.length; i++) {

        var codCor = referenciaCorLimpa[i];

        //alert(
        //  "referenciaCorLimpa:\n" + referenciaCorLimpa.join(", ") +
        //  "\n\nnumerosProduto:\n" + numerosString
        //);


        // verifica se o código NÃO existe na string
        if (numerosString.indexOf(codCor) === -1) {
            codCoresOK = false;
            alert("O CÓDIGO DE CORES ESTÁ INCORRETO, FAVOR VERIFICAR");
            break; // já pode parar, pois encontrou erro
        } else {
            //alert("Codigo encontrado");
        }
    }


} else {
    alert("CLIENTE PRONTO - NÃO CHECADO LABEL POR CONTA DE SER ARQUIVO PRONTO (MUITOS OBJETOS)");
    labelOK = true;
}

//Checagem para verificar se o nome do cliente esta no label

if ((folder != "ingaflex") || (folder != "grafica_goncalves") || (folder != "penha_sa")) {

    var allFonts = extractTextFromDocument(doc);
    var allFontsString = allFonts.join("");
    allFontsString = allFontsString.replace(/[^a-zA-Z]/g, "");
    allFontsString = allFontsString.toLowerCase();
    var nomeCliente = cliente.replace(/[^a-zA-Z]/g, "");
    nomeCliente = nomeCliente.toLowerCase();
    //alert(allFontsString);
    //alert(nomeCliente);

    if (allFontsString.indexOf(nomeCliente) < 0) {
        alert("NOME DO CLIENTE NÃO ESTA NO LABEL DE CORES")
        nomeClienteOK = false;
    } else {
        nomeClienteOK = true;
    }
} else {
    nomeClienteOK = true;
}


// Checar Montagem - Altura x Cilindro

var comparacaoCylinder = cylinderSize + 0.2835;
var somaAltura = repetitions * objectHeight;
//alert("Tamanho do Cilindro: " + cylinderSize);
//alert("Soma Altura: " + somaAltura)
//alert("Comparação com Margem: " + comparacaoCylinder);

if ((somaAltura > 0) && (folder != "alpha_color") && (folder != "floraplast") && (folder != "novatack") && (!eMontadoEDistorcido)) {

    if (somaAltura > comparacaoCylinder) {
        osOK = false;
        alert("RETORNAR OS AO CTA - CONFIRMAR MONTAGEM")
    } else {
        osOK = true;
    }

} else {
    osOK = true;
}

//Checar obrigatoriedade de Script de Montagem!
function checarPrecisaDeMontagem() {
    var pAlpha = (type.indexOf("o Alpha") >= 0)
    var pCli = (type.indexOf("o Cliente") >= 0)
    if ((status == "Novo") && (!eAproveitamento)) {
        if (pAlpha) {
            return true;
        } else if (((folder == "limpack") ||
                (folder == "digilabel") ||
                (folder == "tri_color_etiquetas") ||
                (folder == "ediprint") ||
                (folder == "da_print") ||
                (folder == "marcoprint") ||
                (folder == "ads_print_etiquetas") ||
                (folder == "gade_graff") ||
                (folder == "interpack") ||
                (folder == "pinho_pack") ||
                (folder == "paper_label") ||
                (folder == "idr_rotulos") ||
                (folder == "louvetique") ||
                (folder == "grafica_boca_boa") ||
                (folder == "majicplast_matriz") ||
                (folder == "art_point_grafica") ||
                (folder == "schlemper") ||
                (folder == "novatack") ||
                (folder == "alpha_color") ||
                (folder == "grafica_gsj") ||
                (folder == "aplipack") ||
                (folder == "ral_print_sistemas")) && (pCli)) {
            return true;
        } else {
            return false;
        }
    } else {
        return false
    }
}

var precisaDeMontagem = checarPrecisaDeMontagem();
//alert("Precisa de Script de Montagem = " + precisaDeMontagem)

//Checar se foi feito montagem e distorção
function checkIfFileExistsMontagem() {
    var folderPathCopySR = getFolderPathCopyLog();
    var fileNameSR = serviceOrderNumber + "_I_Illustrator_Montagem.xml";
    var filePathSR = new File(folderPathCopySR + "/" + fileNameSR);

    if (filePathSR.exists) {
        return true;
    } else {
        return false;
    }
}
//Checar se foi feito montagem e distorção
function checkIfFileExistsDistorcao() {
    var folderPathCopyDist = getFolderPathCopyLog();
    var fileNameDist = serviceOrderNumber + "_I_Illustrator_Distorcao.xml";
    var filePathSDist = new File(folderPathCopyDist + "/" + fileNameDist);

    if (filePathSDist.exists) {
        return true;
    } else {
        return false;
    }
}
//Checar se foi feito montagem e distorção
function checkIfFileExistsMedicao() {
    var folderPathCopySR = getFolderPathCopyLog();
    var fileNameSR = serviceOrderNumber + "_AI_STAGGERED.xml";
    var filePathSR = new File(folderPathCopySR + "/" + fileNameSR);

    if (filePathSR.exists) {
        return true;
    } else {
        return false;
    }
}
//Checar se foi feito montagem e distorção
function checkIfFileExistsPreenchimento() {
    var folderPathCopySR = getFolderPathCopyLog();
    var fileNameSR = serviceOrderNumber + "_I_Illustrator_Preenchimento.xml";
    var filePathSR = new File(folderPathCopySR + "/" + fileNameSR);

    if (filePathSR.exists) {
        return true;
    } else {
        return false;
    }
}

//Checar se foi feito montagem e distorção
function checkIfFileExistsPistas() {
    var folderPathCopyPista = getFolderPathCopyLog();
    var fileNamePista = serviceOrderNumber + "_I_Illustrator_NumeroPistas.xml";
    var filePathPista = new File(folderPathCopyPista + "/" + fileNamePista);

    if (filePathPista.exists) {
        return true;
    } else {
        return false;
    }
}

var scriptMontagemOK = checkIfFileExistsMontagem();
var scriptDistorcaoOK = checkIfFileExistsDistorcao();
//alert("Scipt Montagem = " + scriptMontagemOK);

//====================CHECAGEM DE OBRIGATORIEDADE===================//
if (eScriptObrigatorio) {
    if (scriptMontagemOK && scriptDistorcaoOK) {
        fezMontagemDist = true;
    } else {
        alert('ESSA MONTAGEM PRECISA SER FEITA VIA SCRIPT "Montagem e Distorção"')
        fezMontagemDist = false;
    }

} else {
    fezMontagemDist = true;
}

//===============CHECAGEM DE ONDULADO==========================//
// A geracao de layers nao e mais necessaria (a medicao agora mede por
// grupo/cor predominante), entao o ondulado exige SOMENTE a medicao.
var scriptMedicaoOndulado = checkIfFileExistsMedicao();
var scriptPreenchimentoOk = checkIfFileExistsPreenchimento();

if (medicaoScript && categoria == "Produção") {
    if (scriptMedicaoOndulado) {
        fezMedicaoLayers = true;
    } else {
        alert('ONDULADO PRECISA DA MEDICAO')
        fezMedicaoLayers = false;
    }
} else {
    fezMedicaoLayers = true;
}

if (status == "novo" && folder == "penha_sa") {
    if (scriptPreenchimentoOk) {
        preenchimentoOK = true;
    } else {
        preenchimentoOK = false;
    }
} else {
    preenchimentoOK = true;
}
//===============CHECAGEM DE NUMERO DE PISTAS==========================//

var scriptPistas = checkIfFileExistsPistas();

if (precisaDePistas && precisaDeCheck) {
    if (scriptPistas) {
        scriptPistasOK = true;
    } else {
        alert('NUMERO DE PISTAS PRECISA SER GERADO PELO SCRIPT')
        scriptPistasOK = false;
    }
} else {
    scriptPistasOK = true;
}


//===============CHECAGEM DE DISTANCIA ENTRE PISTAS=======================//
if ((linksArte.length > 0) && (lanes > 1) && (displacementBetweenLanes == 0) && (banda == "Estreita") && (folder != "delgo_selos") && (!eAproveitamento) && (folder != "novatack") && (!eMontadoEDistorcido) && (distanceBetweenLanes != 0)) {
    // Checar as distâncias entre as coordenadas X dentro de cada grupo
    for (var grupoY in gruposPorY) {
        var coordenadasX = gruposPorY[grupoY];

        // Ordenar as coordenadas X para garantir a ordem correta ao calcular distâncias
        coordenadasX.sort(function(a, b) {
            return a - b;
        });

        // Comparar cada distância com a variável distanciaEntrePistas
        for (var j = 0; j < coordenadasX.length - 1; j++) {
            var distanciaHorizontalMM = (Math.abs(coordenadasX[j] - coordenadasX[j + 1]) / pontoParaMM).toFixed(3);

            // Verificar se a distância calculada corresponde à distanciaEntrePistas
            if (distanciaHorizontalMM !== distanciaEntrePistas) {
                todasDistanciasCorretas = false;
                alert('DISTANCIA ENTRE PISTAS ESTA INCORRETA NO ARQUIVO');
                break; // Se uma distância estiver incorreta, interrompe o loop
            }
        }

        if (!todasDistanciasCorretas) {
            break;
        }
    }

}

//===============CHECAGEM CONJUGACAO=======================//

if ((nomeArte.indexOf("CONJUGADO") !== -1) || (nomeArte.indexOf("CONJG") !== -1)) {
    var primeirosNomes = [];
    //alert("Entrou na checagem")
    // Verificar se os nomes dentro dos grupos são iguais
    for (var x in gruposPorX) {
        var nomesGrupo = gruposPorX[x];

        if (!nomesGrupo || nomesGrupo.length === 0) {
            conjugacaoOK = false;
            break;
        }

        var primeiroNome = nomesGrupo[0];
        var nomesIguaisNoGrupo = true;

        // Verificar se todos os nomes no grupo são iguais
        for (var j = 1; j < nomesGrupo.length; j++) {
            if (nomesGrupo[j] !== primeiroNome) {
                nomesIguaisNoGrupo = false;
                break;
            }
        }

        // Se o grupo tiver nomes diferentes, falha
        if (!nomesIguaisNoGrupo) {
            conjugacaoOK = false;
            break;
        }

        // Adicionar o primeiro nome ao array para comparação posterior
        primeirosNomes.push(primeiroNome);
    }

    // Se a conjugação não está correta, não continua verificando os primeiros nomes
    if (!conjugacaoOK) {
        alert("VERIFICAR CONJUGAÇÃO");
    } else {
        // Verificar se existe pelo menos um nome diferente entre os primeiros nomes dos grupos
        var nomesUnicos = [];
        for (var i = 0; i < primeirosNomes.length; i++) {
            var nomeAtual = primeirosNomes[i];
            var nomeJaAdicionado = false;

            // Verificar se o nome já foi adicionado ao array de nomesUnicos
            for (var j = 0; j < nomesUnicos.length; j++) {
                if (nomesUnicos[j] === nomeAtual) {
                    nomeJaAdicionado = true;
                    break;
                }
            }

            // Se o nome não foi adicionado, adicionar ao array de nomesUnicos
            if (!nomeJaAdicionado) {
                nomesUnicos.push(nomeAtual);
            }
        }

        // Se todos os primeiros nomes forem iguais, a conjugação está incorreta
        if (nomesUnicos.length === 1) {
            conjugacaoOK = false;
            alert("VERIFICAR CONJUGAÇÃO");
        }


    }
}


//------------------------------------------------------------------------------------------------------------------------------------------------------------//

// Nome do arquivo de texto que você deseja criar
var nomeArquivoTxt = nomeScript + "_v07_" + cliente + "_" + serviceOrderNumber + "_" + produtoComUnderline;

// Função para obter o caminho da pasta
function getFolderPathUtilizacao() {
    var pastaDestino = "";

    // caminho unico p/ Windows e Mac (alphaBaseEngine/alphaBaseUteis resolvem a rede)
    pastaDestino = alphaBaseUteis() + "/_Padroes_clientes_Alpha/_Scripts/Utilizacao/";

    return pastaDestino;
}

// Obtém o caminho da pasta
var pastaDestino = getFolderPathUtilizacao();



var conteudo = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>'
conteudo += '<Alpha Origem = "Illustrator" Script="' + nomeScript + '">'
conteudo += '<Order Customer ="' + folder + '" ID = "' + serviceOrderNumber + '" Name = "' + nomeArte + '" Product = "' + produtoComUnderline + '" CustomerFolder = "' + folder + '" Date = "" Time = "" By = "' + nomeScript + '" user = "' + resultadoOperador + '" Ticket = "CheckList" />'
conteudo += '<Origem Arquivo ="' + nomeArquivo + '" Esko = "no" InksOK = "" LastError = "" LogDate = "" LogName = "' + produtoComUnderline + '_CheckList.log" Options = "" Shuttle="AI" WorkFlow="AI_Script_CheckList" folder = "_prepress" />'
conteudo += '<Material File ="' + nomeArquivo + '" Folder = "" Milestone = "AI CheckList" linksChecados="' + linksChecados + '" />'
conteudo += '</Alpha>'


if (
    coresOK && linkOk && labelOK && distorcaoOK && facaOK &&
    montagemOK && nomeClienteOK && osOK && fezMontagemDist &&
    fezMedicaoLayers && todasDistanciasCorretas && conjugacaoOK &&
    scriptPistasOK && preenchimentoOK && codCoresOK
) {
    // Cria o objeto File para o arquivo de texto
    var arquivoTxt = new File(pastaDestino + "/" + nomeArquivoTxt + ".xml");

    // Cria o arquivo e escreve o conteúdo
    arquivoTxt.open("w");
    arquivoTxt.write(conteudo);
    arquivoTxt.close();

    // Obtém o caminho para a pasta de destino
    var folderPathCopy = getFolderPathCopyLog();
    var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_CheckList";

    // Cria o objeto File para o destino de cópia
    var destinoDaCopia = new File(folderPathCopy + "/" + nomeArquivoTxtCopy + ".xml");

    // Primeira tentativa de cópia
    var copiou = arquivoTxt.copy(destinoDaCopia);

    // Se falhar, tenta validar acesso manualmente (Sonoma / permissão)
    if (!copiou) {

        alert(
            "Não foi possível copiar o CheckList automaticamente.\n" +
            "Selecione manualmente a pasta _log para validar o acesso."
        );

        var pastaLogManual = Folder.selectDialog("Selecione a pasta _log");

        if (pastaLogManual) {
            destinoDaCopia = new File(pastaLogManual.fsName + "/" + nomeArquivoTxtCopy + ".xml");
            copiou = arquivoTxt.copy(destinoDaCopia);
        }
    }

    // Resultado final
    if (copiou) {
        alert("Arquivo Correto e CheckList copiado com sucesso");
    } else {
        alert("Erro ao copiar o arquivo CheckList.\nContatar suporte.");
    }

} else if (!precisaDeCheck) {

    alert("ARQUIVO CHECADO, PORÉM REGRAVAÇÃO OU REPETIÇÃO NÃO PRECISA DE CHECKLIST");

} else {
    // outros fluxos
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
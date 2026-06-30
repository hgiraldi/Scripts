/*
  replaceTokensInDoc.jsx
  Substitui tokens no formato [[nome]] pelo valor definido no objeto 'mapping'
  Compatível com ExtendScript (Illustrator JSX)
  - Busca em todos os TextFrames do documento ativo
  - Também tenta substituir nomes de layers e artboards (opcional)
  Ajuste o objeto 'mapping' abaixo conforme suas variáveis (ex: cliente, pedido, data, etc.)
*/

// --------------------------------------
// CONFIGURE AQUI: valores/variáveis
// --------------------------------------
// Prompt para obter o número de ordem de serviço

#include "Xml_upload.jsx"

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


// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

function remapSpotsPorArray(doc, cores) {

    var spotsBase = ["cor1", "cor2", "cor3", "cor4", "cor5", "cor6"];

    // ======================================================
    // FUNÇÕES INTERNAS
    // ======================================================

    function getBrancoCMYK() {
        var c = new CMYKColor();
        c.cyan = 0;
        c.magenta = 0;
        c.yellow = 0;
        c.black = 0;
        return c;
    }

    function getSpotByName(nome) {
        for (var i = 0; i < doc.spots.length; i++) {
            if (doc.spots[i].name === nome) {
                return doc.spots[i];
            }
        }
        return null;
    }

    function encontrarSwatchPorNome(cor) {
        if (!cor) return null;

        var corNormalizada = cor.toLowerCase();

        // correspondência direta
        for (var i = 0; i < doc.swatches.length; i++) {
            if (doc.swatches[i].name.toLowerCase() === corNormalizada) {
                return doc.swatches[i];
            }
        }

        // correspondência normalizada
        for (var i = 0; i < doc.swatches.length; i++) {
            var nome = doc.swatches[i].name.toLowerCase()
                .replace(/process /g, '')
                .replace(/pantone /g, '')
                .replace(/ c/g, '');

            if (nome === corNormalizada) {
                return doc.swatches[i];
            }
        }

        return null;
    }

    // ------------------------------------------------------
    // PINTA OBJETOS (PATH, COMPOUND, ETC)
    // ------------------------------------------------------
    function pintarItem(item, nomeSpot, novaCor) {

        // FILL
        if (
            item.filled &&
            item.fillColor &&
            item.fillColor.typename === "SpotColor" &&
            item.fillColor.spot &&
            item.fillColor.spot.name === nomeSpot
        ) {
            item.fillColor = novaCor;
        }

        // STROKE
        if (
            item.stroked &&
            item.strokeColor &&
            item.strokeColor.typename === "SpotColor" &&
            item.strokeColor.spot &&
            item.strokeColor.spot.name === nomeSpot
        ) {
            item.strokeColor = novaCor;
        }
    }

    // ------------------------------------------------------
    // PINTA TEXTO (SEGURO CONTRA ILLEGAL ARGUMENT)
    // ------------------------------------------------------
    function pintarTexto(item, nomeSpot, novaCor) {
        try {
            var tr = item.textRange;
            if (!tr || tr.length === 0) return;

            var ca = tr.characterAttributes;

            // FILL TEXTO
            if (
                ca.fillColor &&
                ca.fillColor.typename === "SpotColor" &&
                ca.fillColor.spot &&
                ca.fillColor.spot.name === nomeSpot
            ) {
                ca.fillColor = novaCor;
            }

            // STROKE TEXTO
            if (
                ca.strokeColor &&
                ca.strokeColor.typename === "SpotColor" &&
                ca.strokeColor.spot &&
                ca.strokeColor.spot.name === nomeSpot
            ) {
                ca.strokeColor = novaCor;
            }

        } catch (e) {
            // evita Illegal argument do Illustrator
        }
    }

    // ======================================================
    // LÓGICA PRINCIPAL
    // ======================================================

    for (var i = 0; i < spotsBase.length; i++) {

        var nomeSpot = spotsBase[i];
        var corDesejada = cores[i];

        // ------------------------------
        // EXISTE COR NO ARRAY
        // ------------------------------
        if (corDesejada) {

            var swatchDestino = encontrarSwatchPorNome(corDesejada);
            if (!swatchDestino) continue;

            var novaCor = swatchDestino.color;

            for (var j = 0; j < doc.pageItems.length; j++) {
                var item = doc.pageItems[j];

                if (item.typename === "TextFrame") {
                    pintarTexto(item, nomeSpot, novaCor);
                } else {
                    pintarItem(item, nomeSpot, novaCor);
                }
            }

            // ------------------------------
            // NÃO EXISTE → LIMPAR E REMOVER
            // ------------------------------
        } else {

            var branco = getBrancoCMYK();

            for (var j = 0; j < doc.pageItems.length; j++) {
                var item = doc.pageItems[j];

                if (item.typename === "TextFrame") {
                    pintarTexto(item, nomeSpot, branco);
                } else {
                    pintarItem(item, nomeSpot, branco);
                }
            }

            // remove a spot vazia
            try {
                var spot = getSpotByName(nomeSpot);
                if (spot) spot.remove();
            } catch (e) {}
        }
    }
}



//Tratamento de varaiveis
function getCor(refArray, index, pos) {
    if (refArray && refArray[index] && refArray[index].indexOf("/") !== -1) {
        var partes = refArray[index].split("/");
        if (partes[pos]) {
            return (pos === 0 ? "Cód: " : "") + partes[pos];
        }
    }
    return " ";
}

function marcaSeContem(textoBase, palavra) {
    if (textoBase && textoBase.indexOf(palavra) !== -1) {
        return "X";
    }
    return "";
}


var q = 2;
if (cores.length > 1) {
    q = 3;
} else {
    alert("ARQUIVO DE UMA COR, NÃO PRECISA DE SEPARAÇÃO")
}

var partesNome = resultadoOperadorNome.split(" ");



// Mapeamento: chave -> valor.
// A chave é o nome da variável sem colchetes; o token esperado no documento é [[chave]]
var mapping = {
    "cliente": clienteOnd,
    "cli": cliente,
    "ref": ref,
    "descr": nomeArte,
    "medint": medInt,
    "fi": np,
    "Cor1" : cores[0] || "",
    "Cor2" : cores[1] || "",
    "Cor3" : cores[2] || "",
    "Cor4" : cores[3] || "",
    "Cor5" : cores[4] || "",
    "Cor6" : cores[5] || "",
    "codCor1": getCor(referenciaCor, 0, 0),
    "fka1": getCor(referenciaCor, 0, 1),
    "codCor2": getCor(referenciaCor, 1, 0),
    "fka2": getCor(referenciaCor, 1, 1),
    "codCor3": getCor(referenciaCor, 2, 0),
    "fka3": getCor(referenciaCor, 2, 1),
    "codCor4": getCor(referenciaCor, 3, 0),
    "fka4": getCor(referenciaCor, 3, 1),
    "codCor5": getCor(referenciaCor, 4, 0),
    "fka5": getCor(referenciaCor, 4, 1),
    "email": marcaSeContem(tipoOriginal, "email"),
    "proprio": marcaSeContem(tipoOriginal, "proprio"),
    "amostra": marcaSeContem(tipoOriginal, "amostra"),
    "total": marcaSeContem(tipoCliche, "total"),
    "parcial": marcaSeContem(tipoCliche, "parcial"),
    "repremont": marcaSeContem(tipoCliche, "repremont"),
    "data": dataEntrega,
    "dataAtual" : getDataAtualFormatada(),
    "rep": repetitions,
    "pist": lanes,
    "onda": onda,
    "os": serviceOrderNumber,
    "esp": espessura,
    "cp": cp,
    "rev": rev.split("v")[1],
    "v": v.split("v")[1], 
    "q": q,
    "maq": maquina,
    "mm": dataEntrega.split(" ")[1],
    "yy": dataEntrega.split(" ")[2],
    "dd": dataEntrega.split(" ")[0],
    "operador": partesNome.slice(0, 2).join(" ")
};

var doc = app.activeDocument;
remapSpotsPorArray(doc, cores);

/* ========= Helpers ========= */
function getDataAtualFormatada() {
    var hoje = new Date();
    var dia = ("0" + hoje.getDate()).slice(-2);
    var mes = ("0" + (hoje.getMonth() + 1)).slice(-2);
    var ano = hoje.getFullYear();
    return dia + "/" + mes + "/" + ano;
}
 
// --------------------------------------
// UTIL: escapa string para uso em RegExp
// --------------------------------------
function escapeForRegExp(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// --------------------------------------
// Substitui tokens em uma string usando o mapping
// --------------------------------------
function replaceTokensInString(str, map) {
    if (str === undefined || str === null) return str;
    var result = str;
    for (var key in map) {
        if (map.hasOwnProperty(key)) {
            var token = "\\[\\[" + escapeForRegExp(key) + "\\]\\]";
            var re = new RegExp(token, "g");
            result = result.replace(re, map[key]);
        }
    }
    return result;
}

// --------------------------------------
// Percorre todos os TextFrames (inclui PointText e AreaText) e substitui conteúdos
// --------------------------------------
function replaceInTextFrames(doc, map) {
    var countReplaced = 0;
    var tf = doc.textFrames;
    for (var i = 0; i < tf.length; i++) {
        try {
            var original = tf[i].contents;
            var replaced = replaceTokensInString(original, map);
            if (replaced !== original) {
                tf[i].contents = replaced;
                countReplaced++;
            }
        } catch (e) {

        }
    }
    return countReplaced;
}

// --------------------------------------
// Opcional: substituir em nomes de layers e artboards
// (muitas vezes útil para automação)
// --------------------------------------
function replaceInLayerAndArtboardNames(doc, map) {
    var changed = 0;
    // Layers
    for (var i = 0; i < doc.layers.length; i++) {
        try {
            var ln = doc.layers[i].name;
            var rn = replaceTokensInString(ln, map);
            if (rn !== ln) {
                doc.layers[i].name = rn;
                changed++;
            }
        } catch (e) {}
    }
    // Artboards
    for (var j = 0; j < doc.artboards.length; j++) {
        try {
            var an = doc.artboards[j].name;
            var rn2 = replaceTokensInString(an, map);
            if (rn2 !== an) {
                doc.artboards[j].name = rn2;
                changed++;
            }
        } catch (e) {}
    }
    return changed;
}

// --------------------------------------
// EXECUÇÃO PRINCIPAL
// --------------------------------------
function main() {
    if (app.documents.length === 0) {
        alert("Nenhum documento aberto. Abra um documento e execute novamente.");
        return;
    }

    var doc = app.activeDocument;

    // Faz as substituições
    var textChanges = replaceInTextFrames(doc, mapping);
    var nameChanges = replaceInLayerAndArtboardNames(doc, mapping);

    // Relatório simples
    var message = "Substituição concluída.\n\n";
    message += "TextFrames alterados: " + textChanges + "\n";
    message += "Layers/Artboards renomeados: " + nameChanges + "\n\n";
    message += "Verifique o documento ativo.";
    //alert(message);
}

main();

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

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_Preenchimento";

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
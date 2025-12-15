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
var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "z_Complementos/Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

function remapSpotsPorArray(doc, cores) {

    var spotsBase = ["cor1", "cor2", "cor3", "cor4", "cor5"];

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



// Mapeamento: chave -> valor.
// A chave é o nome da variável sem colchetes; o token esperado no documento é [[chave]]
var mapping = {
    "cliente": clienteOnd,
    "ref": ref,
    "medint": medInt,
    "fi": np,
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
    "cp": cp,
    "rev": rev.split("v")[1],
    "v": v.split("v")[1]
};

var doc = app.activeDocument;
remapSpotsPorArray(doc, cores);

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
//var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "Xml_upload.jsx"

/* ========= Helpers ========= */
function getDataAtualFormatada() {
    var hoje = new Date();
    var dia = ("0" + hoje.getDate()).slice(-2);
    var mes = ("0" + (hoje.getMonth() + 1)).slice(-2);
    var ano = hoje.getFullYear();
    return dia + "/" + mes + "/" + ano;
}

function extrairAntesDaBarra(texto) {
    return texto.split("/")[0];
}

function extrairDepoisDeMM(texto) {
    var regex = /mm\s*(.*)$/i,
        match = texto.match(regex);
    return match ? match[1] : "";
}

function larguraEmPt(tf) {
    var gb = tf.geometricBounds;
    return gb[3] - gb[1];
}

function ajustarTextoAchatando(textFrame, maxWidth) {
    textFrame.textRange.characterAttributes.horizontalScale = 100;
    app.redraw();
    var larguraAtual = textFrame.width;
    if (larguraAtual > maxWidth) {
        var escala = (maxWidth / larguraAtual) * 100;
        textFrame.textRange.characterAttributes.horizontalScale = escala;
    }
}

function mmToPt(mm) {
    return mm * 2.83464567;
}

function desbloquearEExibirTudo(doc) {
    //alert("🔓 Desbloqueando camadas e objetos...");

    function _unlockLayer(ly) {
        try {
            ly.locked = false;
        } catch (e) {}
        try {
            ly.visible = true;
        } catch (e) {}
        for (var i = 0; i < ly.pageItems.length; i++) {
            try {
                ly.pageItems[i].locked = false;
                ly.pageItems[i].hidden = false;
            } catch (e) {}
        }
        for (var j = 0; j < ly.layers.length; j++) _unlockLayer(ly.layers[j]);
    }
    for (var k = 0; k < doc.layers.length; k++) _unlockLayer(doc.layers[k]);
    //alert("✅ Tudo desbloqueado.");
}

function substituirPlaceholdersNosTextos(doc, mapa, larguraMaxMaquinaPt) {
    //alert("✏️ Substituindo placeholders...");
    for (var j = 0; j < doc.textFrames.length; j++) {
        var tf = doc.textFrames[j],
            key = tf.contents;
        if (mapa.hasOwnProperty(key)) {
            tf.contents = mapa[key];
            //alert("→ Substituído: " + key + " => " + mapa[key]);
        }
    }
    for (var k = 0; k < doc.textFrames.length; k++) {
        var t = doc.textFrames[k];
        if (t.contents === mapa["{{maquina}}"]) {
            ajustarTextoAchatando(t, larguraMaxMaquinaPt);
            //alert("↔️ Ajustada largura do texto de máquina.");
        }
    }
}

function agruparTudoNoDocumento(doc) {
    //alert("📦 Agrupando itens...");
    doc.selection = null;
    for (var i = 0; i < doc.pageItems.length; i++) {
        try {
            doc.pageItems[i].selected = true;
        } catch (e) {}
    }
    if (!doc.selection || doc.selection.length === 0) {

        return null;
    }
    app.executeMenuCommand('group');
    //alert("✅ Grupo criado com sucesso.");
    return doc.selection.length > 0 ? doc.selection[0] : null;
}

function criarCorPreta() {
    var cor = new CMYKColor();
    cor.cyan = 0;
    cor.magenta = 0;
    cor.yellow = 0;
    cor.black = 100;
    return cor;
}

/* ====== Localiza retângulo pela SpotColor ====== */
function encontrarRectPorSpot(doc, spotName) {
    //alert("🔎 Procurando retângulo com SpotColor: " + spotName);
    for (var i = 0; i < doc.pathItems.length; i++) {
        var pi = doc.pathItems[i];
        if (pi.filled && pi.fillColor.typename === "SpotColor") {
            var nomeSpot = pi.fillColor.spot.name;
            if (nomeSpot === spotName) {
                //alert("✅ Retângulo encontrado para " + spotName);
                return pi;
            }
        }
    }
    //alert("⚠️ Nenhum retângulo encontrado para SpotColor: " + spotName);
    return null;

}

// Função para centralizar um grupo dentro de um artboard específico
function centralizarNoArtboard(doc, grupo, indexArtboard) {
    var abBounds = doc.artboards[indexArtboard].artboardRect; // [left, top, right, bottom]
    var abLeft = abBounds[0],
        abTop = abBounds[1],
        abRight = abBounds[2],
        abBottom = abBounds[3];

    var abWidth = abRight - abLeft,
        abHeight = abTop - abBottom;

    grupo.left = abLeft + (abWidth - grupo.width) / 2 - grupo.left + grupo.left;
    grupo.top = abTop - (abHeight - grupo.height) / 2 - grupo.top + grupo.top;

    app.redraw();
}

/* ===== Geração Code128 ===== */
function gerarCode128SobreRect(doc, texto, rectItem, alturaPt, larguraPt, indiceCB, textoArtb) {
    if (!rectItem) return false;

    try {
        // Conversão mm -> pt
        function mmToPt(mm) {
            return mm * 2.83465;
        }

        // Captura as dimensões e posição do retângulo
        var bounds = rectItem.geometricBounds,
            top = bounds[0],
            left = bounds[1],
            bottom = bounds[2],
            right = bounds[3];

        var rectWidth = right - left,
            rectHeight = top - bottom;

        var moduleWidth = 0.8;

        // Monta sequência do Code128
        var startCode = 104,
            stopCode = 106;
        var sequence = [startCode];
        for (var i = 0; i < texto.length; i++) sequence.push(texto.charCodeAt(i) - 32);
        var checksum = startCode;
        for (var i = 0; i < texto.length; i++) checksum += sequence[i + 1] * (i + 1);
        checksum = checksum % 103;
        sequence.push(checksum);
        sequence.push(stopCode);

        var code128Patterns = [
            [2, 1, 2, 2, 2, 2],
            [2, 2, 2, 1, 2, 2],
            [2, 2, 2, 2, 2, 1],
            [1, 2, 1, 2, 2, 3],
            [1, 2, 1, 3, 2, 2],
            [1, 3, 1, 2, 2, 2],
            [1, 2, 2, 2, 1, 3],
            [1, 2, 2, 3, 1, 2],
            [1, 3, 2, 2, 1, 2],
            [2, 2, 1, 2, 1, 3],
            [2, 2, 1, 3, 1, 2],
            [2, 3, 1, 2, 1, 2],
            [1, 1, 2, 2, 3, 2],
            [1, 2, 2, 1, 3, 2],
            [1, 2, 2, 2, 3, 1],
            [1, 1, 3, 2, 2, 2],
            [1, 2, 3, 1, 2, 2],
            [1, 2, 3, 2, 2, 1],
            [2, 2, 3, 2, 1, 1],
            [2, 2, 1, 1, 3, 2],
            [2, 2, 1, 2, 3, 1],
            [2, 1, 3, 2, 1, 2],
            [2, 2, 3, 1, 1, 2],
            [3, 1, 2, 1, 3, 1],
            [3, 1, 1, 2, 2, 2],
            [3, 2, 1, 1, 2, 2],
            [3, 2, 1, 2, 2, 1],
            [3, 1, 2, 2, 1, 2],
            [3, 2, 2, 1, 1, 2],
            [3, 2, 2, 2, 1, 1],
            [2, 1, 2, 1, 2, 3],
            [2, 1, 2, 3, 2, 1],
            [2, 3, 2, 1, 2, 1],
            [1, 1, 1, 3, 2, 3],
            [1, 3, 1, 1, 2, 3],
            [1, 3, 1, 3, 2, 1],
            [1, 1, 2, 3, 1, 3],
            [1, 3, 2, 1, 1, 3],
            [1, 3, 2, 3, 1, 1],
            [2, 1, 1, 3, 1, 3],
            [2, 3, 1, 1, 1, 3],
            [2, 3, 1, 3, 1, 1],
            [1, 1, 2, 1, 3, 3],
            [1, 1, 2, 3, 3, 1],
            [1, 3, 2, 1, 3, 1],
            [1, 1, 3, 1, 2, 3],
            [1, 1, 3, 3, 2, 1],
            [1, 3, 3, 1, 2, 1],
            [3, 1, 3, 1, 2, 1],
            [2, 1, 1, 3, 3, 1],
            [2, 3, 1, 1, 3, 1],
            [2, 1, 3, 1, 1, 3],
            [2, 1, 3, 3, 1, 1],
            [2, 1, 3, 1, 3, 1],
            [3, 1, 1, 1, 2, 3],
            [3, 1, 1, 3, 2, 1],
            [3, 3, 1, 1, 2, 1],
            [3, 1, 2, 1, 1, 3],
            [3, 1, 2, 3, 1, 1],
            [3, 3, 2, 1, 1, 1],
            [3, 1, 4, 1, 1, 1],
            [2, 2, 1, 4, 1, 1],
            [4, 3, 1, 1, 1, 1],
            [1, 1, 1, 2, 2, 4],
            [1, 1, 1, 4, 2, 2],
            [1, 2, 1, 1, 2, 4],
            [1, 2, 1, 4, 2, 1],
            [1, 4, 1, 1, 2, 2],
            [1, 4, 1, 2, 2, 1],
            [1, 1, 2, 2, 1, 4],
            [1, 1, 2, 4, 1, 2],
            [1, 2, 2, 1, 1, 4],
            [1, 2, 2, 4, 1, 1],
            [1, 4, 2, 1, 1, 2],
            [1, 4, 2, 2, 1, 1],
            [2, 4, 1, 2, 1, 1],
            [2, 2, 1, 1, 1, 4],
            [4, 1, 3, 1, 1, 1],
            [2, 4, 1, 1, 1, 2],
            [1, 3, 4, 1, 1, 1],
            [1, 1, 1, 2, 4, 2],
            [1, 2, 1, 1, 4, 2],
            [1, 2, 1, 2, 4, 1],
            [1, 1, 4, 2, 1, 2],
            [1, 2, 4, 1, 1, 2],
            [1, 2, 4, 2, 1, 1],
            [4, 1, 1, 2, 1, 2],
            [4, 2, 1, 1, 1, 2],
            [4, 2, 1, 2, 1, 1],
            [2, 1, 2, 1, 4, 1],
            [2, 1, 4, 1, 2, 1],
            [4, 1, 2, 1, 2, 1],
            [1, 1, 1, 1, 4, 3],
            [1, 1, 1, 3, 4, 1],
            [1, 3, 1, 1, 4, 1],
            [1, 1, 4, 1, 1, 3],
            [1, 1, 4, 3, 1, 1],
            [4, 1, 1, 1, 1, 3],
            [4, 1, 1, 3, 1, 1],
            [1, 1, 3, 1, 4, 1],
            [1, 1, 4, 1, 3, 1],
            [3, 1, 1, 1, 4, 1],
            [4, 1, 1, 1, 3, 1],
            [2, 1, 1, 4, 1, 2],
            [2, 1, 1, 2, 1, 4],
            [2, 1, 1, 2, 3, 2],
            [2, 3, 3, 1, 1, 1, 2] // STOP
        ];

        // Cria grupo do CB com nome único
        var groupBars = doc.groupItems.add();
        groupBars.name = "CB_" + texto + "_" + indiceCB;

        // Cursor inicial dentro do retângulo
        var cursorX = left + (rectWidth - larguraPt) / 2;
        var cursorY = top - (rectHeight - alturaPt) / 2;

        for (var s = 0; s < sequence.length; s++) {
            var pattern = code128Patterns[sequence[s]];
            if (!pattern) continue;
            for (var j = 0; j < pattern.length; j++) {
                var w = pattern[j] * moduleWidth;
                if (j % 2 === 0) { // barra preta
                    var bar = doc.pathItems.rectangle(cursorY, cursorX, w, alturaPt);
                    bar.filled = true;
                    bar.stroked = false;
                    bar.fillColor = criarCorPreta();
                    bar.move(groupBars, ElementPlacement.PLACEATBEGINNING);
                }
                cursorX += w;
            }
        }

        //alert("[" + texto + "]");

        // Ajusta largura proporcional
        var escalaLargura = larguraPt / groupBars.width;
        groupBars.resize(escalaLargura * 100, 100); // largura só
        groupBars.height = alturaPt;

        if (textoArtb === "codcorAtual") {
            //alert("centralizou1");
            centralizarNoArtboard(doc, groupBars, 1);
        }

        if (textoArtb === "produtoComUnderline") {
            //alert("centralizou2");
            centralizarNoArtboard(doc, groupBars, 2);
        }



        // Remove o retângulo original
        rectItem.remove();

        return true;

    } catch (e) {
        alert("Erro ao gerar CB: " + e);
        return false;
    }
}




/* ========= Principal ========= */
//alert("🚀 Iniciando script...");

var docPrincipal = app.activeDocument;
var layerEtiquetas;
try {
    layerEtiquetas = docPrincipal.layers.getByName("etiquetaCores");
    //alert("🗑 Limpando layer etiquetaCores...");
    for (var iClear = layerEtiquetas.pageItems.length - 1; iClear >= 0; iClear--) {
        try {
            layerEtiquetas.pageItems[iClear].remove();
        } catch (e) {}
    }
} catch (e) {
    layerEtiquetas = docPrincipal.layers.add();
    layerEtiquetas.name = "etiquetaCores";
    //alert("📂 Criada nova layer: etiquetaCores");
}

var espacamento = mmToPt(10),
    alturaEtiqueta = mmToPt(52.465),
    yAtual = 0;
var caminhoBasePath = scriptDirectory + '/z_pdfs/Etiqueta_Penha.pdf';
var larguraMaxMaquinaPt = 76.5354;

function extrairDepoisDaBarraSeguro(texto) {
    if (!texto) return texto;
    if (texto.indexOf("/") === -1) return texto;
    return texto.split("/")[1];
}

// ================== DIALOGO LOCALIZAÇÃO ==================
var localizacao = "";

var dlgS = new Window("dialog", "Localização");
dlgS.orientation = "column";
dlgS.alignChildren = "left";

dlgS.add("statictext", undefined, "Digite a localização:");

var inputLoc = dlgS.add("edittext", undefined, "");
inputLoc.characters = 30;
inputLoc.active = true;

var grpButtons = dlgS.add("group");
grpButtons.alignment = "right";

var btnOk = grpButtons.add("button", undefined, "OK");
var btnCancel = grpButtons.add("button", undefined, "Cancelar");

// OK → exige algo digitado
btnOk.onClick = function() {
    if (inputLoc.text === "") {
        alert("⚠️ A localização deve ser preenchida ou clique em Cancelar.");
        return;
    }
    localizacao = inputLoc.text;
    dlgS.close(1);
};

// Cancelar → localização vazia
btnCancel.onClick = function() {
    localizacao = "";
    dlgS.close(0);
};

dlgS.show();
// =========================================================



for (var i = 0; i < cores.length; i++) {
    var corAtual = cores[i],
        qtdc = (i + 1) + "/" + cores.length,
        codcorAtual = extrairDepoisDaBarraSeguro(referenciaCor[i]);

    //alert("🎨 Processando cor: " + corAtual);

    var dados = {
        fi: extrairAntesDaBarra(np),
        cor: corAtual,
        espessura: espessura + " mm",
        lpc: lpc,
        qtdc: qtdc,
        data: getDataAtualFormatada(),
        maquina: extrairDepoisDeMM(cpc),
        codcor: codcorAtual,
        loc: localizacao
    };

    var mapa = {
        "{{fi}}": dados.fi,
        "{{cor}}": dados.cor,
        "{{espessura}}": dados.espessura,
        "{{lpc}}": dados.lpc,
        "{{qtdc}}": dados.qtdc,
        "{{data}}": dados.data,
        "{{maquina}}": dados.maquina,
        "{{codcor}}": dados.codcor,
        "{{loc}}": dados.loc
    };

    var caminhoBase = new File(caminhoBasePath);
    var docTemplate = app.open(caminhoBase);
    //alert("📂 Template aberto: " + caminhoBasePath);

    try {
        // ... abre template
        desbloquearEExibirTudo(docTemplate);
        substituirPlaceholdersNosTextos(docTemplate, mapa, larguraMaxMaquinaPt);

        // ===== AQUI é o ajuste =====
        // agora geramos os CB dentro do template, já centralizados
        var rectProduto = encontrarRectPorSpot(docTemplate, "produtoComUnderline");
        var rectCodcor = encontrarRectPorSpot(docTemplate, "codcorAtual");

        gerarCode128SobreRect(docTemplate, dados.fi, rectProduto, 31.1811, 147.402, i, "produtoComUnderline");
        gerarCode128SobreRect(docTemplate, codcorAtual, rectCodcor, 28.3465, 93.5433, i, "codcorAtual");

        // depois agrupa tudo no template
        var grupoTemplate = agruparTudoNoDocumento(docTemplate);
        if (!grupoTemplate) throw new Error("Agrupamento falhou!");

        // agora sim duplicamos para o principal e aplicamos o espaçamento
        var grupoNoPrincipal = grupoTemplate.duplicate(layerEtiquetas, ElementPlacement.PLACEATEND);
        grupoNoPrincipal.top = docPrincipal.height - yAtual;
        yAtual += alturaEtiqueta + espacamento;

    } catch (err) {
        alert("💥 Erro na cor " + corAtual + ": " + err);
    } finally {
        docTemplate.close(SaveOptions.DONOTSAVECHANGES);
    }

}

alert("🏁 Etiquetas Criadas!");

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

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_EtiquetaCoresPenha";

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
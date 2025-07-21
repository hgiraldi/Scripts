var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "Xml_upload.jsx"

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
    var regex = /mm\s*(.*)$/i;
    var match = texto.match(regex);
    return match[1];
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

var caminhoBase = new File("~/Desktop/etiqueta_Penha.pdf");

var pathsEtiquetasGeradas = [];

for (var i = 0; i < cores.length; i++) {
    var corAtual = cores[i];
    var qtdc = (i + 1) + "/" + cores.length;
    var codcorAtual = referenciaCor[i];

    var dados = {
        fi: extrairAntesDaBarra(np),
        cor: corAtual,
        espessura: espessura + " mm",
        lpc: lpc,
        qtdc: qtdc,
        data: getDataAtualFormatada(),
        maquina: extrairDepoisDeMM(cpc),
        codcor: codcorAtual
    };

    var mapa = {
        "{{fi}}": dados.fi,
        "{{cor}}": dados.cor,
        "{{espessura}}": dados.espessura,
        "{{lpc}}": dados.lpc,
        "{{qtdc}}": dados.qtdc,
        "{{data}}": dados.data,
        "{{maquina}}": dados.maquina,
        "{{codcor}}": dados.codcor
    };

    var doc = app.open(caminhoBase);

    for (var j = 0; j < doc.textFrames.length; j++) {
        var tf = doc.textFrames[j];
        var novoConteudo = mapa[tf.contents];

        if (novoConteudo !== undefined) {
            tf.contents = novoConteudo;

            if (novoConteudo === dados.maquina) {
                ajustarTextoAchatando(tf, 81);
            }
        }
    }

    // Definir nome do arquivo gerado individual
    var nomeArquivo = "~/Desktop/etiqueta_" + dados.fi + "_" + dados.cor + ".pdf";
    var arquivoPDF = new File(nomeArquivo);
    var options = new PDFSaveOptions();
    doc.saveAs(arquivoPDF, options);

    pathsEtiquetasGeradas.push(nomeArquivo);

    doc.close(SaveOptions.DONOTSAVECHANGES);
}

// --- Juntar as etiquetas no PDF final ---

function mmToPt(mm) {
    return mm * 2.83464567;
}

var espacamento = mmToPt(10);
var caminhoBase = new File("~/Desktop/etiqueta_Penha.pdf");
var docFinal = app.open(caminhoBase);

app.redraw();

// Apaga todo conteúdo da base para ficar limpa
for (var i = docFinal.pageItems.length - 1; i >= 0; i--) {
    docFinal.pageItems[i].remove();
}

var yAtual = 0;

for (var i = 0; i < pathsEtiquetasGeradas.length; i++) {
    var docTemp = app.open(new File(pathsEtiquetasGeradas[i]));

    // Selecionar tudo e agrupar
    docTemp.selection = null;
    for (var j = 0; j < docTemp.pageItems.length; j++) {
        docTemp.pageItems[j].selected = true;
    }
    var grupo = docTemp.groupItems.add();
    for (var k = 0; k < docTemp.selection.length; k++) {
        docTemp.selection[k].move(grupo, ElementPlacement.PLACEATEND);
    }


    // Copiar grupov
    grupo.selected = true;
    app.copy();
    docTemp.close(SaveOptions.DONOTSAVECHANGES);

    // Colar no doc final
    docFinal.activate();
    app.paste();

    // Selecionar último grupo colado
    var colados = docFinal.selection;
    var grupoColado = null;
    if (colados.length == 1 && colados[0].typename == "GroupItem") {
        grupoColado = colados[0];
    } else {
        // Se múltiplos objetos foram colados, agrupar
        var grupoColado = docFinal.groupItems.add();
        for (var m = 0; m < colados.length; m++) {
            colados[m].move(grupoColado, ElementPlacement.PLACEATEND);
        }

    }

    // Posição vertical: empilha com espaçamento
    grupoColado.top = -yAtual;

    // Atualiza yAtual para próxima etiqueta
    var bounds = grupoColado.visibleBounds; // [y1, x1, y2, x2]
    var altura = mmToPt(52.465);
    yAtual += altura + espacamento;

    docFinal.selection = null;
}


// --- Selecionar todos os objetos e agrupar usando o comando interno ---
docFinal.selection = null;
app.executeMenuCommand('selectall');
app.executeMenuCommand('group');

var grupoFinalTodos = docFinal.selection[0]; // O grupo criado

// --- Ajustar artboard ao tamanho do grupo final ---
var bounds = grupoFinalTodos.visibleBounds; // [y1 (top), x1 (left), y2 (bottom), x2 (right)]
var y1 = bounds[0]; // top
var x1 = bounds[1]; // left
var y2 = bounds[2]; // bottom
var x2 = bounds[3]; // right

var larguraGrupo = Math.abs(y1 - y2);
var alturaGrupo = Math.abs(x2 - x1);

// Reposicionar o grupo no centro antes de ajustar o artboard
grupoFinalTodos.position = [0, 0];

// Define um artboard com largura e altura corretas, centralizado em (0,0)
var left = -larguraGrupo / 2;
var top = alturaGrupo / 2;
var right = larguraGrupo / 2;
var bottom = -alturaGrupo / 2;

docFinal.artboards[0].artboardRect = [left, top, right, bottom];

// Centraliza o grupo no artboard
grupoFinalTodos.left = 0 - grupoFinalTodos.width / 2;
grupoFinalTodos.top = 0 + grupoFinalTodos.height / 2;




// --- Salvar PDF final ---
var arquivoFinal = new File("~/Desktop/etiqueta_FINAL_" + dados.fi + ".pdf");
var pdfOptions = new PDFSaveOptions();
docFinal.saveAs(arquivoFinal, pdfOptions);

// Opcional: manter aberto ou fechar
// docFinal.close(SaveOptions.DONOTSAVECHANGES);
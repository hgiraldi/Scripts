// ============================================================
// 12_Gerar_Etiquetas.jsx
// Gera as etiquetas de cor EMPILHADAS numa pagina (layer "etiquetaCores" do doc
// ATIVO), pro operador usar como quiser. Condicional por cliente:
//   - Penha (folder = penha_sa) -> Etiqueta_Penha.pdf (2 barcodes Code128 + localizacao)
//   - demais                    -> etiqueta_cor.pdf   (cor / ref / descr / qtdc)
// Usa a logica MELHORADA do 14_Risco_Faca.jsx (tokens [[...]], achatamento, robusto).
// Atualiza/renomeia o antigo 12_Gerar_Etiqueta_Penha.jsx. SEM logs.
// (Funcoes abaixo = COPIA VERBATIM do 14_Risco_Faca.jsx -- manter em sincronia.)
// ============================================================

// O.S.: quando rodado pelo menu (Scripts.jsx), ja vem setado (numeroOrdemInput).
// Se rodar standalone (sem o menu), pergunta.
if (typeof serviceOrderNumber === "undefined" || !serviceOrderNumber) {
    var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");
}

#include "Xml_upload.jsx"

/* ===== Funcoes (copia verbatim do 14_Risco_Faca.jsx) ===== */
function getDataAtualFormatada() {
    var hoje = new Date();
    var dia = ("0" + hoje.getDate()).slice(-2);
    var mes = ("0" + (hoje.getMonth() + 1)).slice(-2);
    var ano = hoje.getFullYear();
    return dia + "/" + mes + "/" + ano;
}

function escapeForRegExp(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

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

function mmToPt(mm) {
    return mm * 2.834645;
}

function primeirasDuasPalavras(txt) {
    var s = String(txt).replace(/^\s+/, "");
    var p = s.split(/\s+/);
    if (p.length >= 2) return p[0] + " " + p[1];
    return p[0];
}

function achatarSeNecessario(frame, original) {
    var maxW = 0;
    if (/\[\[ref\]\]/.test(original)) maxW = mmToPt(35);
    else if (/\[\[descr\]\]/.test(original)) maxW = mmToPt(30);
    else if (/\[\[maq\]\]/.test(original)) maxW = mmToPt(16);
    if (maxW <= 0) return;
    try {
        var w = frame.width;
        if (w > maxW) frame.textRange.characterAttributes.horizontalScale = (maxW / w) * 100;
    } catch (e) {}
}

function replaceInTextFrames(doc, map, achatar) {
    var countReplaced = 0;
    var tf = doc.textFrames;
    for (var i = 0; i < tf.length; i++) {
        try {
            var original = tf[i].contents;
            var replaced = replaceTokensInString(original, map);
            if (replaced !== original) {
                tf[i].contents = replaced;
                countReplaced++;
                if (achatar) achatarSeNecessario(tf[i], original);
            }
        } catch (e) {

        }
    }
    return countReplaced;
}

function extrairAntesDaBarra(texto) {
    if (texto === undefined || texto === null) return texto;
    return String(texto).split("/")[0];
}

function extrairDepoisDaBarraSeguro(texto) {
    if (!texto) return texto;
    texto = String(texto);
    if (texto.indexOf("/") === -1) return texto;
    return texto.split("/")[1];
}

function criarCorPreta() {
    var cor = new CMYKColor();
    cor.cyan = 0;
    cor.magenta = 0;
    cor.yellow = 0;
    cor.black = 100;
    return cor;
}

function encontrarRectPorSpot(docBusca, spotName) {
    for (var i = 0; i < docBusca.pathItems.length; i++) {
        var pi = docBusca.pathItems[i];
        if (pi.filled && pi.fillColor && pi.fillColor.typename === "SpotColor") {
            if (pi.fillColor.spot && pi.fillColor.spot.name === spotName) {
                return pi;
            }
        }
    }
    return null;
}

function desbloquearEExibirTudo(docAlvo) {
    function _unlockLayer(ly) {
        try { ly.locked = false; } catch (e) {}
        try { ly.visible = true; } catch (e) {}
        for (var i = 0; i < ly.pageItems.length; i++) {
            try {
                ly.pageItems[i].locked = false;
                ly.pageItems[i].hidden = false;
            } catch (e) {}
        }
        for (var j = 0; j < ly.layers.length; j++) _unlockLayer(ly.layers[j]);
    }
    for (var k = 0; k < docAlvo.layers.length; k++) _unlockLayer(docAlvo.layers[k]);
}

function agruparTudoNoDocumento(docAlvo) {
    docAlvo.selection = null;
    for (var i = 0; i < docAlvo.pageItems.length; i++) {
        try { docAlvo.pageItems[i].selected = true; } catch (e) {}
    }
    if (!docAlvo.selection || docAlvo.selection.length === 0) return null;
    app.executeMenuCommand('group');
    return docAlvo.selection.length > 0 ? docAlvo.selection[0] : null;
}

function gerarCode128SobreRect(docCB, texto, rectItem, alturaPt, larguraPt, indiceCB) {
    if (!rectItem) return false;
    try {
        var b = rectItem.geometricBounds; // [left, top, right, bottom]
        var rLeft = b[0],
            rTop = b[1],
            rRight = b[2],
            rBottom = b[3];
        var rectWidth = rRight - rLeft;
        var rectHeight = rTop - rBottom;

        var moduleWidth = 0.8;

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

        var groupBars = docCB.groupItems.add();
        groupBars.name = "CB_" + texto + "_" + indiceCB;

        var cursorX = rLeft;
        var cursorY = rTop;

        for (var s = 0; s < sequence.length; s++) {
            var pattern = code128Patterns[sequence[s]];
            if (!pattern) continue;
            for (var j = 0; j < pattern.length; j++) {
                var w = pattern[j] * moduleWidth;
                if (j % 2 === 0) { // barra preta
                    var bar = docCB.pathItems.rectangle(cursorY, cursorX, w, alturaPt);
                    bar.filled = true;
                    bar.stroked = false;
                    bar.fillColor = criarCorPreta();
                    bar.move(groupBars, ElementPlacement.PLACEATBEGINNING);
                }
                cursorX += w;
            }
        }

        // Ajusta para largura/altura alvo
        if (groupBars.width !== 0) {
            var escalaLargura = larguraPt / groupBars.width;
            groupBars.resize(escalaLargura * 100, 100);
        }
        groupBars.height = alturaPt;

        // Centraliza no proprio retangulo placeholder
        groupBars.left = rLeft + (rectWidth - groupBars.width) / 2;
        groupBars.top = rTop - (rectHeight - groupBars.height) / 2;

        rectItem.remove();
        return true;

    } catch (e) {
        alert("Erro ao gerar CB: " + e);
        return false;
    }
}


/* ===================================================================
 * PRINCIPAL
 * =================================================================== */
var docPrincipal = app.activeDocument;

// cliente Penha?
var isPenha = (String(folder).toLowerCase() === "penha_sa");

// layer de destino (cria se nao existir; LIMPA se ja existir)
var layerEtiquetas;
try {
    layerEtiquetas = docPrincipal.layers.getByName("etiquetaCores");
    for (var iClear = layerEtiquetas.pageItems.length - 1; iClear >= 0; iClear--) {
        try { layerEtiquetas.pageItems[iClear].remove(); } catch (e) {}
    }
} catch (e) {
    layerEtiquetas = docPrincipal.layers.add();
    layerEtiquetas.name = "etiquetaCores";
}
try { layerEtiquetas.locked = false; layerEtiquetas.visible = true; } catch (e) {}

// LOCALIZACAO (somente Penha)
var localizacao = "";
if (isPenha) {
    var dlgS = new Window("dialog", "Localização");
    dlgS.orientation = "column";
    dlgS.alignChildren = "left";
    dlgS.add("statictext", undefined, "Digite a localização:");
    var inputLoc = dlgS.add("edittext", undefined, "");
    inputLoc.characters = 30;
    inputLoc.active = true;
    var grpB = dlgS.add("group");
    grpB.alignment = "right";
    // {name}: fechamento NATIVO (onClick->close entra em loop pelo painel CEP).
    // Valida no laco apos o show: mantem aberto enquanto vazio.
    var btnOk = grpB.add("button", undefined, "OK", { name: "ok" });
    var btnCancel = grpB.add("button", undefined, "Cancelar", { name: "cancel" });
    var rLoc;
    do {
        rLoc = dlgS.show();
        if (rLoc === 1 && inputLoc.text === "") { alert("Preencha a localização ou clique em Cancelar."); }
    } while (rLoc === 1 && inputLoc.text === "");
    localizacao = (rLoc === 1) ? inputLoc.text : "";
}

// Abre um template, troca os tokens [[...]], (Penha) gera os 2 barcodes, agrupa e
// DUPLICA pra layer "etiquetaCores". Robusto (DONTDISPLAYALERTS + retry/redraw +
// finally). Retorna o grupo no docPrincipal (ou null).
function processarEtiqueta(caminhoTemplate, mapaTokens, ehPenha, fiBarra, codcor, indiceCor) {
    var arq = new File(caminhoTemplate);
    if (!arq.exists) { alert("Template nao encontrado: " + arq.fsName); return null; }

    var prevUIL = app.userInteractionLevel;
    var docT = null, grupoNoAlvo = null;
    try {
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var tent = 0;
        while (docT === null && tent < 5) {
            try { docT = app.open(arq); }
            catch (eO) { tent++; try { app.redraw(); } catch (eR) {} $.sleep(200); }
        }
        if (docT === null) throw new Error("Falha ao abrir o template: " + arq.fsName);

        desbloquearEExibirTudo(docT);
        replaceInTextFrames(docT, mapaTokens, true); // achata ref/descr/maq se passar do max
        if (ehPenha) {
            gerarCode128SobreRect(docT, fiBarra, encontrarRectPorSpot(docT, "produtoComUnderline"), 31.1811, 147.402, indiceCor);
            gerarCode128SobreRect(docT, codcor,  encontrarRectPorSpot(docT, "codcorAtual"),         28.3465, 93.5433, indiceCor);
        }

        var g = agruparTudoNoDocumento(docT);
        if (!g) throw new Error("Agrupamento do template falhou");
        grupoNoAlvo = g.duplicate(layerEtiquetas, ElementPlacement.PLACEATEND);

    } catch (e) {
        grupoNoAlvo = null;
        app.userInteractionLevel = prevUIL;
        alert("Erro no template (" + caminhoTemplate + "): " + e);
    } finally {
        try { if (docT) docT.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) {}
        app.userInteractionLevel = prevUIL;
        try { app.activeDocument = docPrincipal; } catch (eA) {}
    }
    return grupoNoAlvo;
}

// LOOP: 1 etiqueta por cor, EMPILHADAS de cima p/ baixo
var espacamento = mmToPt(10);
var yAtual = 0;
var i;
for (i = 0; i < cores.length; i++) {
    var qtdc = (i + 1) + "/" + cores.length;
    var mapa, template, fiBarra = "", codcor = "";

    if (isPenha) {
        fiBarra = extrairAntesDaBarra(np);
        codcor  = extrairDepoisDaBarraSeguro(referenciaCor[i]);
        mapa = {
            "cor": cores[i],
            "data": getDataAtualFormatada(),
            "esp": espessura,
            "maq": ((typeof maquina !== "undefined" && maquina) ? primeirasDuasPalavras(maquina) : ""),
            "fi/": fiBarra,
            "codcor": codcor,
            "lpc": lpc,
            "qtdc": qtdc,
            "loc": localizacao
        };
        template = scriptDirectory + '/z_pdfs/Etiqueta_Penha.pdf';
    } else {
        mapa = {
            "cor": cores[i],
            "ref": ref,
            "descr": clienteOnd,
            "qtdc": qtdc
        };
        template = scriptDirectory + '/z_pdfs/etiqueta_cor.pdf';
    }

    var grupo = processarEtiqueta(template, mapa, isPenha, fiBarra, codcor, i);
    if (grupo) {
        // empilha: vai descendo a partir do topo da pagina
        grupo.top = docPrincipal.height - yAtual;
        yAtual += grupo.height + espacamento;
    }
}

alert("Etiquetas criadas! (" + cores.length + " cor(es) - " + (isPenha ? "Penha" : "Cor") + ")");

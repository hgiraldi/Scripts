// ===========Criando Spot Z============//

function findColorByName(colorName) {
    var swatches = app.activeDocument.swatches;
    for (var i = 0; i < swatches.length; i++) {
        if (swatches[i].name == colorName) {
            return swatches[i].color;
        }
    }
}

// Cria (ou retorna) a Spot Color "z" com 80% de preto
function ensureSpotZ(doc) {
    // Verifica se já existe
    for (var i = 0; i < doc.spots.length; i++) {
        if (doc.spots[i].name == "z") {
            return doc.spots[i]; // já existe, só retorna
        }
    }

    // Cria nova spot
    var spot = doc.spots.add();
    spot.name = "z";
    spot.colorType = ColorModel.SPOT;

    // Define cor CMYK 80% K
    var cmyk = new CMYKColor();
    cmyk.cyan = 0;
    cmyk.magenta = 0;
    cmyk.yellow = 0;
    cmyk.black = 80;
    spot.color = cmyk;

    return spot;
}

var doc = app.activeDocument;
var spotZ = ensureSpotZ(doc);

// =========== Criando Layer Faca ============//

// Cria (ou reaproveita) a layer "faca", ativa ela e apaga layers vazias (exceto "faca")
function ensureLayerFaca(doc) {
    var targetName = "faca";
    var lyr;

    // tenta achar por nome
    try {
        lyr = doc.layers.getByName(targetName);
    } catch (e) {
        // se não existe, cria
        lyr = doc.layers.add();
        lyr.name = targetName;
    }

    // ativa
    doc.activeLayer = lyr;

    // apaga layers vazias (sem itens e sem sublayers), exceto "faca"
    for (var i = doc.layers.length - 1; i >= 0; i--) {
        var L = doc.layers[i];
        if (L.name !== targetName && !L.locked && !L.hidden) {
            // Considera vazia se não tem pageItems e não tem sublayers
            var isEmpty = (L.pageItems.length === 0 && L.layers.length === 0);
            if (isEmpty) {
                try {
                    L.remove();
                } catch (e2) {}
            }
        }
    }

    return lyr;
}

var facaLayer = ensureLayerFaca(doc);

// =========================Funcoes de Retangulos e trapezios=====================//

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

function moveObject(obj, moveX, moveY) {
    // Move o objeto pela distância especificada
    obj.left += moveX; // Move horizontalmente
    obj.top += moveY; // Move verticalmente, ajustando porque valores menores movem para baixo
}

/* Faca de Maleta – Dialogo de Inputs (salva em app.insertLabel)
   Compatível com Illustrator (ExtendScript / JSX)
   - Captura em mm
   - Converte para pt
   - Persiste em app.insertLabel('faca_maleta_dados', 'k=v|k=v|...')
*/

/* Dialogo – Faca de Maleta (escopo global + dlg.okButton)
   -> Salva variáveis globais em mm e pt
   -> Escolha Esquerda/Direita via radiobutton
   -> 100% ExtendScript / JSX
*/

// ===== Vars globais (você acessa depois do dlg.show()) =====
var hAbaSup_mm, hPainel_mm, hAbaInf_mm;
var wP1_mm, wP2_mm, wP3_mm, wP4_mm, wLap_mm;
var ladoLap; // "esquerda" | "direita"

// Convertidos:
var hAbaSup_pt, hPainel_pt, hAbaInf_pt;
var wP1_pt, wP2_pt, wP3_pt, wP4_pt, wLap_pt;

// ===== Utils simples =====
function mm2pt(mm) {
    return mm * 2.834645669291339;
}

function _trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
}

function toNumberLoose(s) {
    s = _trim(s).replace(",", ".");
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n;
}

function mustPositiveNumber(ed, rotulo) {
    var v = toNumberLoose(ed.text);
    if (isNaN(v) || v <= 0) {
        alert('Valor inválido para "' + rotulo + '". Informe um número > 0.');
        try {
            ed.active = true;
        } catch (e) {}
        return null;
    }
    return v;
}

function addRow(parent, label, defVal) {
    var g = parent.add('group');
    g.orientation = 'row';
    g.alignChildren = ['left', 'center'];
    var st = g.add('statictext', undefined, label);
    st.preferredSize = [190, 20];
    var ed = g.add('edittext', undefined, defVal);
    ed.characters = 12;
    return ed;
}

// ===== Diálogo =====
var dlg = new Window('dialog', 'Faca de Maleta – Entradas (mm)');
dlg.orientation = 'column';
dlg.alignChildren = ['fill', 'top'];
dlg.margins = 14;

// Larguras
var pLarg = dlg.add('panel', undefined, 'Larguras dos 4 Painéis (mm)');
pLarg.orientation = 'column';
pLarg.alignChildren = ['left', 'top'];
pLarg.margins = 12;
dlg.edP1 = addRow(pLarg, 'Largura PAINEL 1:', '');
dlg.edP2 = addRow(pLarg, 'Largura PAINEL 2:', '');
dlg.edP3 = addRow(pLarg, 'Largura PAINEL 3:', '');
dlg.edP4 = addRow(pLarg, 'Largura PAINEL 4:', '');


// Dimensões
var pDim = dlg.add('panel', undefined, 'Dimensões (mm)');
pDim.orientation = 'column';
pDim.alignChildren = ['left', 'top'];
pDim.margins = 12;
dlg.edAbaSup = addRow(pDim, 'Altura da ABA SUPERIOR:', '');
dlg.edPainel = addRow(pDim, 'Altura do PAINEL:', '');
dlg.edAbaInf = addRow(pDim, 'Altura da ABA INFERIOR:', '');


// Lap
var pLap = dlg.add('panel', undefined, 'Lap');
pLap.orientation = 'column';
pLap.alignChildren = ['left', 'top'];
pLap.margins = 12;
dlg.edLap = addRow(pLap, 'Largura do LAP:', '');

var gSide = pLap.add('group');
gSide.orientation = 'row';
gSide.alignChildren = ['left', 'center'];
gSide.add('statictext', undefined, 'Lado do LAP:');
dlg.rbEsq = gSide.add('radiobutton', undefined, 'Esquerda');
dlg.rbDir = gSide.add('radiobutton', undefined, 'Direita');
dlg.rbEsq.value = true; // padrão

// Botões (segue sua lógica)
dlg.okButton = dlg.add('button', undefined, 'OK');
dlg.cancelButton = dlg.add('button', undefined, 'Cancelar');

dlg.edP1.active = true;

// ---- Ação OK (salva nas VARS GLOBAIS e fecha) ----
dlg.okButton.onClick = function() {
    // valida mm
    var _hAbaSup_mm = mustPositiveNumber(dlg.edAbaSup, 'Altura da ABA SUPERIOR');
    if (_hAbaSup_mm == null) return;
    var _hPainel_mm = mustPositiveNumber(dlg.edPainel, 'Altura do PAINEL');
    if (_hPainel_mm == null) return;
    var _hAbaInf_mm = mustPositiveNumber(dlg.edAbaInf, 'Altura da ABA INFERIOR');
    if (_hAbaInf_mm == null) return;

    var _wP1_mm = mustPositiveNumber(dlg.edP1, 'Largura PAINEL 1');
    if (_wP1_mm == null) return;
    var _wP2_mm = mustPositiveNumber(dlg.edP2, 'Largura PAINEL 2');
    if (_wP2_mm == null) return;
    var _wP3_mm = mustPositiveNumber(dlg.edP3, 'Largura PAINEL 3');
    if (_wP3_mm == null) return;
    var _wP4_mm = mustPositiveNumber(dlg.edP4, 'Largura PAINEL 4');
    if (_wP4_mm == null) return;

    var _wLap_mm = mustPositiveNumber(dlg.edLap, 'Largura do LAP');
    if (_wLap_mm == null) return;

    var _ladoLap = dlg.rbEsq.value ? 'esquerda' : 'direita';

    // grava globais em mm
    hAbaSup_mm = _hAbaSup_mm;
    hPainel_mm = _hPainel_mm;
    hAbaInf_mm = _hAbaInf_mm;
    wP1_mm = _wP1_mm;
    wP2_mm = _wP2_mm;
    wP3_mm = _wP3_mm;
    wP4_mm = _wP4_mm;
    wLap_mm = _wLap_mm;
    ladoLap = _ladoLap;

    // converte e grava globais em pt
    hAbaSup_pt = mm2pt(hAbaSup_mm);
    hPainel_pt = mm2pt(hPainel_mm);
    hAbaInf_pt = mm2pt(hAbaInf_mm);

    wP1_pt = mm2pt(wP1_mm);
    wP2_pt = mm2pt(wP2_mm);
    wP3_pt = mm2pt(wP3_mm);
    wP4_pt = mm2pt(wP4_mm);

    wLap_pt = mm2pt(wLap_mm);

    // fecha diálogo
    dlg.close();

    // =================================Criando a Maleta============================ //
    var menos3 = 8.50394;
    var painel1 = createRectangle(0, 0, wP1_pt, hPainel_pt, "z", false, true, "Painel1")
    var painel2 = createRectangle(wP1_pt, 0, wP2_pt, hPainel_pt, "z", false, true, "Painel2")
    var painel3 = createRectangle(wP1_pt + wP2_pt, 0, wP3_pt, hPainel_pt, "z", false, true, "Painel3")
    var painel4 = createRectangle(wP1_pt + wP2_pt + wP3_pt, 0, wP4_pt, hPainel_pt, "z", false, true, "Painel4")
    var painelAbaS1 = createRectangle(0, hAbaSup_pt, wP1_pt - (menos3 / 2), hAbaSup_pt, "z", false, true, "painelAbaS1")
    var painelAbaS2 = createRectangle((menos3 / 2) + wP1_pt, hAbaSup_pt, wP2_pt - menos3, hAbaSup_pt, "z", false, true, "painelAbaS2")
    var painelAbaS3 = createRectangle((menos3 / 2) + wP1_pt + wP2_pt, hAbaSup_pt, wP3_pt - menos3, hAbaSup_pt, "z", false, true, "painelAbaS3")
    var painelAbaS4 = createRectangle((menos3 / 2) + wP1_pt + wP2_pt + wP3_pt, hAbaSup_pt, wP4_pt - (menos3 / 2), hAbaSup_pt, "z", false, true, "painelAbaS4")
    var painelAbaI1 = createRectangle(0, -hPainel_pt, wP1_pt - (menos3 / 2), hAbaInf_pt, "z", false, true, "painelAbaI1")
    var painelAbaI2 = createRectangle((menos3 / 2) + wP1_pt, -hPainel_pt, wP2_pt - menos3, hAbaInf_pt, "z", false, true, "painelAbaI2")
    var painelAbaI3 = createRectangle((menos3 / 2) + wP1_pt + wP2_pt, -hPainel_pt, wP3_pt - menos3, hAbaInf_pt, "z", false, true, "painelAbaI3")
    var painelAbaI4 = createRectangle((menos3 / 2) + wP1_pt + wP2_pt + wP3_pt, -hPainel_pt, wP4_pt - (menos3 / 2), hAbaInf_pt, "z", false, true, "painelAbaI4")


    var lap = createTrapezoid(hPainel_pt, hPainel_pt * 0.9, wLap_pt, "z", false, true)

    lap.rotate(90);
    moveObject(lap, (-hPainel_pt / 2) - (wLap_pt / 2), (-hPainel_pt / 2) - (wLap_pt / 2));


    if (ladoLap == "direita") {
        lap.rotate(180);
        moveObject(lap, wP1_pt + wP2_pt + wP3_pt + wP4_pt + wLap_pt, 0);
    } else {

    }

    // === FIT DO ARTBOARD A TODO O DOCUMENTO + 200 mm DE MARGEM POR LADO ===

    // mm → pt
    function mmToPt(mm) {
        return mm * 72.0 / 25.4;
    }

    // Retorna [L, T, R, B] dos itens do documento (visíveis)
    function boundsOfDocument(doc) {
        var left = null,
            top = null,
            right = null,
            bottom = null;
        var prevCS = app.coordinateSystem;
        app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;

        try {
            var items = doc.pageItems;
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it.guides === true) continue;
                if (it.hidden === true) continue;

                var b;
                try {
                    b = it.visibleBounds;
                } catch (e) {
                    continue;
                }

                if (left === null || b[0] < left) left = b[0];
                if (top === null || b[1] > top) top = b[1];
                if (right === null || b[2] > right) right = b[2];
                if (bottom === null || b[3] < bottom) bottom = b[3];
            }
        } finally {
            app.coordinateSystem = prevCS;
        }
        return (left === null) ? null : [left, top, right, bottom];
    }

    // === Função principal ===
    function fitArtboardToDocWithPadding(doc, padMM) {
        if (!doc) return;
        var b = boundsOfDocument(doc);
        if (!b) return;

        var pad = mmToPt(padMM);
        app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;

        var L = b[0] - pad;
        var T = b[1] + pad;
        var R = b[2] + pad;
        var B = b[3] - pad;

        var abIndex = doc.artboards.getActiveArtboardIndex();
        doc.artboards[abIndex].artboardRect = [L, T, R, B];
    }

    // === CHAMADA ===
    fitArtboardToDocWithPadding(app.activeDocument, 20);


    function fitViewToActiveArtboard() {
        var doc = app.activeDocument;
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
        var r = ab.artboardRect; // [left, top, right, bottom]

        // 1) Centraliza a visão no centro do artboard
        var cx = (r[0] + r[2]) / 2;
        var cy = (r[1] + r[3]) / 2;
        doc.activeView.centerPoint = [cx, cy]; // View.centerPoint

        // 2) Calcula o zoom necessário para caber o artboard inteiro na janela atual
        //    Usamos View.bounds para saber o tamanho visível atual em coordenadas do documento.
        var vb = doc.activeView.bounds; // [L, T, R, B]
        var winW = vb[2] - vb[0];
        var winH = vb[1] - vb[3];

        var abW = r[2] - r[0];
        var abH = r[1] - r[3];

        // Fator para caber inteiro
        var factor = Math.min(winW / abW, winH / abH) * 0.90;

        // Ajusta o zoom relativo ao atual (View.zoom)
        doc.activeView.zoom = doc.activeView.zoom * factor;
    }

    fitViewToActiveArtboard();

};

// Cancelar
dlg.cancelButton.onClick = function() {
    dlg.close();
};

// Exibir
dlg.center();
dlg.show();
// Prompt para obter o número de ordem de serviço
var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

#include "z_Complementos/Xml_upload.jsx"

(function() {

    if (app.documents.length === 0) {
        alert("Nenhum documento aberto.");
        return;
    }

    if (!serviceOrderNumber || serviceOrderNumber === "") {
        alert("Número de O.S. inválido.");
        return;
    }

    var doc = app.activeDocument;

    // ===== Conversão mm → pt =====
    function mmToPt(mm) {
        return mm * 72.0 / 25.4; // 1 mm ≈ 2,83465 pt
    }

    // ===== Configurações =====
    var distancia_mm = 1.5; // folga da PONTA da cruz até a seleção
    var cruz_total_mm = 2.5; // cruz com 1 mm total (0,5 mm pra cada lado)
    var traco_mm = 0.3; // espessura do traço
    var margem_extra_mm = 6.0; // EXTRA (mantido do seu código)

    var cruz_meio_mm = cruz_total_mm / 2; // 0,5 mm
    // centro da cruz agora: 2,5 (folga) + 0,5 (meia cruz) - extra
    var distCentro_mm = distancia_mm + cruz_meio_mm - margem_extra_mm;

    var cruz_meio_pt = mmToPt(cruz_meio_mm);
    var distCentro_pt = mmToPt(distCentro_mm);
    var stroke_pt = mmToPt(traco_mm);

    var fonte_mm = 1.77; // tamanho da fonte
    var fonte_pt = mmToPt(fonte_mm);
    var textoOffset_mm = 4.5; // 4,5 mm para a direita da cruz de baixo
    var textoOffset_pt = mmToPt(textoOffset_mm);

    // ===== Layer "pics" para receber cruzes + texto =====
    var picsLayer;
    try {
        picsLayer = doc.layers.getByName("pics");
    } catch (e) {
        picsLayer = doc.layers.add();
        picsLayer.name = "pics";
    }

    // ===== Buscar cor [Registration] / [Registro] =====
    var reg = null;
    for (var s = 0; s < doc.swatches.length; s++) {
        var sw = doc.swatches[s];
        if (sw.name === "[Registration]" || sw.name === "[Registro]") {
            reg = sw.color;
            break;
        }
    }
    if (!reg) {
        try {
            reg = new RegistrationColor();
        } catch (e) {
            var c = new CMYKColor();
            c.cyan = 0;
            c.magenta = 0;
            c.yellow = 0;
            c.black = 100;
            reg = c;
        }
    }

    function criaLinha(targetLayer, x1, y1, x2, y2) {
        var l = targetLayer.pathItems.add();
        l.setEntirePath([
            [x1, y1],
            [x2, y2]
        ]);
        l.stroked = true;
        l.strokeWidth = stroke_pt;
        l.strokeColor = reg;
        l.filled = false;
        return l;
    }

    function criaCruzH(targetLayer, cx, cy) {
        // horizontal
        criaLinha(targetLayer, cx - cruz_meio_pt, cy, cx + cruz_meio_pt, cy);

    }

    function criaCruzV(targetLayer, cx, cy) {
        // vertical
        criaLinha(targetLayer, cx, cy - cruz_meio_pt, cx, cy + cruz_meio_pt);
    }

    // ===== Função que aplica cruzes + texto para UM grupo “mãe” =====
    function processaGrupoMae(grupoMae) {

        // 1) Bounds do grupo (não vamos re-agrupar, só usar o próprio grupo)
        var b = grupoMae.geometricBounds; // [top, left, bottom, right]
        var top = b[0];
        var left = b[1];
        var bottom = b[2];
        var right = b[3];

        var width = right - left;
        var height = top - bottom;

        // Centro do grupo
        var centroX = (left + right) / 2;
        var centroY = (top + bottom) / 2;

        // 2) Criar quadrado temporário do MESMO tamanho, centralizado
        var rectTop = centroY + (height / 2);
        var rectLeft = centroX - (width / 2);

        var tempRect = picsLayer.pathItems.rectangle(rectTop, rectLeft, width, height);
        tempRect.stroked = false;
        tempRect.filled = false;

        // Bounds do quadrado (base pra cruz)
        var rb = tempRect.geometricBounds; // [top, left, bottom, right]
        var rTop = rb[0];
        var rLeft = rb[1];
        var rBottom = rb[2];
        var rRight = rb[3];

        var rCentroX = (rLeft + rRight) / 2;
        var rCentroY = (rTop + rBottom) / 2;

        // 3) Criar as 4 cruzes PARA FORA usando o quadrado como base

        // TOP – para fora, acima
        criaCruzV(picsLayer, rCentroX, rTop + distCentro_pt);

        // BOTTOM – para fora, abaixo
        var bottomCrossY = rBottom - distCentro_pt; // guardamos o Y da cruz de baixo
        criaCruzV(picsLayer, rCentroX, bottomCrossY);

        // LEFT – para fora, à esquerda
        criaCruzH(picsLayer, rLeft - distCentro_pt, rCentroY);

        // RIGHT – para fora, à direita
        criaCruzH(picsLayer, rRight + distCentro_pt, rCentroY);

        // 4) Criar texto com serviceOrderNumber ao lado da cruz de baixo
        if (serviceOrderNumber && serviceOrderNumber !== "") {
            var textoX = rCentroX + textoOffset_pt;
            var textoY = bottomCrossY + 8.277165; // ajuste fino que você já usou

            var tf = picsLayer.textFrames.add();
            tf.kind = TextType.POINTTEXT;
            tf.position = [textoX, textoY]; // [x, y] baseline

            tf.contents = produto;
            tf.textRange.size = fonte_pt;
            tf.textRange.fillColor = reg;

            try {
                tf.textRange.paragraphAttributes.justification = Justification.LEFT;
            } catch (e) {}
        }

        // 5) Apagar o quadrado temporário
        tempRect.remove();
    }

    // ===== Percorrer TODOS os grupos “mãe” do documento =====
    // Consideramos "grupo mãe" como GroupItem diretamente dentro das layers (parent == layer),
    // e ignoramos a própria layer "pics" para não recursar em cima das marcas.
    // ===== Processar APENAS grupos "mãe" selecionados =====
    var gruposProcessados = 0;

    if (doc.selection.length === 0) {
        alert("Selecione ao menos um grupo 'mãe'.");
        return;
    }

    for (var i = 0; i < doc.selection.length; i++) {
        var item = doc.selection[i];

        // precisa ser GroupItem
        if (item.typename !== "GroupItem") {
            continue;
        }

        // precisa ser grupo mãe (parent direto da layer)
        if (item.parent.typename !== "Layer") {
            continue;
        }

        // evita aplicar nas marcas
        if (item.parent.name === "pics") {
            continue;
        }

        processaGrupoMae(item);
        gruposProcessados++;
    }

    if (gruposProcessados === 0) {
        alert("Nenhum grupo 'mãe' válido selecionado.");
    }

})();
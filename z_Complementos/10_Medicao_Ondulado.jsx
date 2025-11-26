// Prompt para obter o número de ordem de serviço
#include "Xml_upload.jsx"

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
    var distancia_mm      = 2.5; // folga da PONTA da cruz até a seleção
    var cruz_total_mm     = 1.0; // cruz com 1 mm total (0,5 mm pra cada lado)
    var traco_mm          = 0.3; // espessura do traço
    var margem_extra_mm   = 6.0; // EXTRA (mantido do seu código)

    var cruz_meio_mm      = cruz_total_mm / 2;        // 0,5 mm
    // centro da cruz agora: 2,5 (folga) + 0,5 (meia cruz) - extra
    var distCentro_mm     = distancia_mm + cruz_meio_mm - margem_extra_mm;

    var cruz_meio_pt      = mmToPt(cruz_meio_mm);
    var distCentro_pt     = mmToPt(distCentro_mm);
    var stroke_pt         = mmToPt(traco_mm);

    var fonte_mm          = 1.77;     // tamanho da fonte
    var fonte_pt          = mmToPt(fonte_mm);
    var textoOffset_mm    = 4.5;      // 4,5 mm para a direita da cruz de baixo
    var textoOffset_pt    = mmToPt(textoOffset_mm);

    // ===== Layer "pics" para receber cruzes + texto =====
    var picsLayer;
    try {
        picsLayer = doc.layers.getByName("pics");
    } catch (e) {
        picsLayer = doc.layers.add();
        picsLayer.name = "pics";
    }

    // ===== Helpers de VISIBILIDADE (baseados no seu 10_Medicao_Ondulado.jsx) =====

    // Une bounds [L, T, R, B]
    function unionBounds(acc, b) {
        if (!b) return acc;
        if (!acc) return [b[0], b[1], b[2], b[3]];
        var left   = Math.min(acc[0], b[0]);
        var top    = Math.max(acc[1], b[1]); // top = maior (sistema do Illustrator)
        var right  = Math.max(acc[2], b[2]);
        var bottom = Math.min(acc[3], b[3]); // bottom = menor
        return [left, top, right, bottom];
    }

    // Interseção de dois retângulos [L, T, R, B]; retorna null se não há interseção
    function intersectBounds(a, b) {
        if (!a || !b) return null;
        var left   = Math.max(a[0], b[0]);
        var right  = Math.min(a[2], b[2]);
        var top    = Math.min(a[1], b[1]);   // para a interseção, top = menor(topA, topB)
        var bottom = Math.max(a[3], b[3]);   // bottom = maior(bottomA, bottomB)
        if (left >= right || bottom >= top) return null;
        return [left, top, right, bottom];
    }

    // Testa se um item deve ser ignorado por ser “invisível” para medição
    function shouldIgnoreItemByStyle(it) {
        try {
            if (it.opacity === 0) return true;
        } catch (e) {}

        // PathItem
        if (it.typename === "PathItem") {
            try {
                if (!it.filled && !it.stroked) return true;
            } catch (e1) {}
            return false;
        }

        // CompoundPathItem: ao menos um path filho precisa ter fill/stroke
        if (it.typename === "CompoundPathItem") {
            try {
                if (it.pathItems && it.pathItems.length > 0) {
                    var anyVis = false;
                    for (var i = 0; i < it.pathItems.length; i++) {
                        var p = it.pathItems[i];
                        try { if (p.opacity === 0) continue; } catch (e0) {}
                        if (p.filled || p.stroked) { anyVis = true; break; }
                    }
                    return !anyVis;
                }
            } catch (e2) {}
            return false;
        }

        // TextFrame, PlacedItem, RasterItem, SymbolItem, MeshItem etc.: mantemos (a não ser opacity 0)
        return false;
    }

    // Procura a BOUND da máscara de recorte em um GroupItem clipped
    function findMaskBoundsInGroup(grp) {
        var i, p, cp, k;

        // 1) PathItem com clipping == true
        for (i = 0; i < grp.pathItems.length; i++) {
            p = grp.pathItems[i];
            try {
                if (p.clipping) return p.geometricBounds;
            } catch (e1) {}
        }

        // 2) CompoundPathItem contendo ao menos um PathItem com clipping == true
        for (i = 0; i < grp.compoundPathItems.length; i++) {
            cp = grp.compoundPathItems[i];
            try {
                for (k = 0; k < cp.pathItems.length; k++) {
                    p = cp.pathItems[k];
                    try {
                        if (p.clipping) return p.geometricBounds;
                    } catch (e2) {}
                }
            } catch (e3) {}
        }

        // 3) Fallback: se nada marcado como clipping, volta bounds do grupo
        return grp.geometricBounds;
    }

    /**
     * Retorna bounds visíveis REAIS de QUALQUER item, descendo na hierarquia.
     * Usa a mesma lógica do seu script de medição.
     * Formato retornado: [L, T, R, B]
     */
    function getVisibleBoundsDeep(it) {
        if (!it || it.hidden || it.locked) return null;

        try {
            if (it.typename === "GroupItem") {
                // Grupo com máscara de recorte
                if (it.clipped) {
                    var maskB = findMaskBoundsInGroup(it);

                    // Une conteúdo visível (exceto a própria máscara)
                    var childrenB = null;
                    for (var j = 0; j < it.pageItems.length; j++) {
                        var child = it.pageItems[j];

                        // pular a própria máscara (Path ou Path dentro de CompoundPath)
                        if (child.typename === "PathItem") {
                            try { if (child.clipping) continue; } catch (e0) {}
                        }
                        if (child.typename === "CompoundPathItem") {
                            var isMask = false;
                            try {
                                for (var kk = 0; kk < child.pathItems.length; kk++) {
                                    var pp = child.pathItems[kk];
                                    try { if (pp.clipping) { isMask = true; break; } } catch (e01) {}
                                }
                            } catch (e02) {}
                            if (isMask) continue;
                        }

                        // ignorar itens vazios
                        if (shouldIgnoreItemByStyle(child) && child.typename !== "GroupItem") continue;

                        var cb = getVisibleBoundsDeep(child);
                        childrenB = unionBounds(childrenB, cb);
                    }

                    if (!childrenB) return null;
                    var inter = intersectBounds(maskB, childrenB);
                    return inter ? inter : null;
                }

                // Grupo normal: une filhos
                var b = null;
                for (var i = 0; i < it.pageItems.length; i++) {
                    var child2 = it.pageItems[i];
                    if (shouldIgnoreItemByStyle(child2) && child2.typename !== "GroupItem") continue;
                    var cb2 = getVisibleBoundsDeep(child2);
                    b = unionBounds(b, cb2);
                }
                return b;
            }

            // Itens não-grupo
            if (shouldIgnoreItemByStyle(it)) return null;

            // geometricBounds aqui será tratado como [L, T, R, B] dentro da lógica do helper
            return it.geometricBounds;

        } catch (e) {
            return null;
        }
    }

    function criaLinha(targetLayer, x1, y1, x2, y2) {
        var l = targetLayer.pathItems.add();
        l.setEntirePath([[x1, y1], [x2, y2]]);
        l.stroked = true;
        l.strokeWidth = stroke_pt;
        l.strokeColor = reg;
        l.filled = false;
        return l;
    }

    function criaCruz(targetLayer, cx, cy) {
        // horizontal
        criaLinha(targetLayer, cx - cruz_meio_pt, cy, cx + cruz_meio_pt, cy);
        // vertical
        criaLinha(targetLayer, cx, cy - cruz_meio_pt, cx, cy + cruz_meio_pt);
    }

    // ===== Função que aplica cruzes + texto para UM grupo “mãe” =====
    function processaGrupoMae(grupoMae) {

        // 1) Bounds VISÍVEIS reais do grupo (respeita máscara)
        var vb = getVisibleBoundsDeep(grupoMae);
        if (!vb) return; // nada visível

        // vb no formato [L, T, R, B]
        var left   = vb[0];
        var top    = vb[1];
        var right  = vb[2];
        var bottom = vb[3];

        var width  = right - left;
        var height = top - bottom;

        // Centro do grupo visível
        var centroX = (left + right) / 2;
        var centroY = (top  + bottom) / 2;

        // 2) Criar quadrado temporário do MESMO tamanho, centralizado (na layer pics)
        var rectTop  = centroY + (height / 2);
        var rectLeft = centroX - (width  / 2);

        var tempRect = picsLayer.pathItems.rectangle(rectTop, rectLeft, width, height);
        tempRect.stroked = false;
        tempRect.filled  = false;

        // Bounds do quadrado (base pra cruz) – aqui usamos geometricBounds padrão
        var rb = tempRect.geometricBounds; // [top, left, bottom, right]
        var rTop    = rb[0];
        var rLeft   = rb[1];
        var rBottom = rb[2];
        var rRight  = rb[3];

        var rCentroX = (rLeft + rRight) / 2;
        var rCentroY = (rTop  + rBottom) / 2;

        // 3) Criar as 4 cruzes PARA FORA usando o quadrado como base

        // TOP – para fora, acima
        criaCruz(picsLayer, rCentroX, rTop + distCentro_pt);

        // BOTTOM – para fora, abaixo
        var bottomCrossY = rBottom - distCentro_pt; // guardamos o Y da cruz de baixo
        criaCruz(picsLayer, rCentroX, bottomCrossY);

        // LEFT – para fora, à esquerda
        criaCruz(picsLayer, rLeft - distCentro_pt, rCentroY);

        // RIGHT – para fora, à direita
        criaCruz(picsLayer, rRight + distCentro_pt, rCentroY);

        // 4) Criar texto com serviceOrderNumber ao lado da cruz de baixo
        if (serviceOrderNumber && serviceOrderNumber !== "") {
            var textoX = rCentroX + textoOffset_pt;
            var textoY = bottomCrossY + 8.277165; // mesmo ajuste fino que você já usou

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
    var gruposProcessados = 0;

    for (var li = 0; li < doc.layers.length; li++) {
        var lyr = doc.layers[li];

        // pula a layer "pics"
        if (lyr.name === "pics") {
            continue;
        }

        var gItems = lyr.groupItems;
        for (var gi = 0; gi < gItems.length; gi++) {
            var gMae = gItems[gi];
            // apenas grupos de topo (parent é a própria layer)
            if (gMae.parent === lyr) {
                processaGrupoMae(gMae);
                gruposProcessados++;
            }
        }
    }

    if (gruposProcessados === 0) {
        alert("Nenhum grupo 'mãe' encontrado para aplicar as cruzes.");
    }

})();

// captura-grupos-mae-com-mascara-intersect-global-with-alerts - CORRIGIDO
// ExtendScript (JSX) - Illustrator
// Resultado: popula $.global.capturedGroups e $.global.capturedGroupData
// -> além disso exibe um alert por grupo com as variáveis principais

if (app.documents.length === 0) {
    alert("Nenhum documento aberto.");
} else {
    var doc = app.activeDocument;

    function ptToMm(v) { return v * 0.3527777777778; }

    // --- utilidades para bounds [top, left, bottom, right] ---
    function validBounds(b) {
        return b && b.length === 4 && !isNaN(b[0]) && !isNaN(b[1]) && !isNaN(b[2]) && !isNaN(b[3]);
    }

    function boundsFromArray(arr) {
        return { top: arr[0], left: arr[1], bottom: arr[2], right: arr[3] };
    }

    function boundsUnion(a, b) {
        if (!a) return b;
        if (!b) return a;
        return {
            top: Math.max(a.top, b.top),
            left: Math.min(a.left, b.left),
            bottom: Math.min(a.bottom, b.bottom),
            right: Math.max(a.right, b.right)
        };
    }

    function boundsIntersection(a, b) {
        if (!a || !b) return null;
        var top = Math.min(a.top, b.top);
        var left = Math.max(a.left, b.left);
        var bottom = Math.max(a.bottom, b.bottom);
        var right = Math.min(a.right, b.right);
        if (right < left || top < bottom) return null;
        return { top: top, left: left, bottom: bottom, right: right };
    }

    function boundsWidth(b) { return Math.abs(b.right - b.left); }
    function boundsHeight(b) { return Math.abs(b.top - b.bottom); }

    function gatherItemsRecursive(container, outArray) {
        try {
            if (!container) return;
            if (container.pageItems && container.pageItems.length > 0) {
                for (var i = 0; i < container.pageItems.length; i++) {
                    var pi = container.pageItems[i];
                    outArray.push(pi);
                    if (pi.typename === "GroupItem" || pi.typename === "CompoundPathItem") {
                        gatherItemsRecursive(pi, outArray);
                    }
                }
            }
        } catch (e) {
            $.writeln("Erro gatherItemsRecursive: " + e);
        }
    }

    // arrays pra exportar
    var groupsInfo = [];
    var groupsNames = []; // array simples com nomes/id (capturedGroups)

    for (var i = 0; i < doc.pageItems.length; i++) {
        var item = doc.pageItems[i];
        if (item.typename !== "GroupItem") continue;
        if (!(item.parent && item.parent.typename === "Layer")) continue;

        var gb = item.geometricBounds; // [top,left,bottom,right]
        var topPt = gb[0], leftPt = gb[1], bottomPt = gb[2], rightPt = gb[3];

        var allItems = [];
        gatherItemsRecursive(item, allItems);

        var objectsBounds = null;
        for (var k = 0; k < allItems.length; k++) {
            var child = allItems[k];
            try {
                var vb;
                try { vb = child.visibleBounds; } catch (e) { vb = null; }
                if (validBounds(vb)) {
                    objectsBounds = boundsUnion(objectsBounds, boundsFromArray(vb));
                } else {
                    var gbChild = null;
                    try { gbChild = child.geometricBounds; } catch (e) { gbChild = null; }
                    if (validBounds(gbChild)) {
                        objectsBounds = boundsUnion(objectsBounds, boundsFromArray(gbChild));
                    }
                }
            } catch (e) { /* ignora item */ }
        }

        var maskBoundsUnion = null;
        for (var m = 0; m < allItems.length; m++) {
            var ch = allItems[m];
            try {
                var isClipping = false;
                try { isClipping = (ch.clipping === true); } catch (e) { isClipping = false; }

                if (isClipping) {
                    var vbMask = null;
                    try { vbMask = ch.visibleBounds; } catch (e) { vbMask = null; }
                    if (!validBounds(vbMask)) {
                        try { vbMask = ch.geometricBounds; } catch (e) { vbMask = null; }
                    }
                    if (validBounds(vbMask)) {
                        maskBoundsUnion = boundsUnion(maskBoundsUnion, boundsFromArray(vbMask));
                    }
                }
            } catch (e) { /* ignora */ }
        }

        var effectiveBounds = null;
        var usedMask = false;
        var fallbackUsed = false;

        if (maskBoundsUnion && objectsBounds) {
            var inter = boundsIntersection(objectsBounds, maskBoundsUnion);
            if (inter) {
                effectiveBounds = inter;
                usedMask = true;
            } else {
                effectiveBounds = maskBoundsUnion;
                usedMask = true;
            }
        } else if (objectsBounds) {
            // quando NÃO houver máscara, usar o tamanho do PRÓPRIO GRUPO (visibleBounds se disponível)
            try {
                var vbGroup = null;
                try { vbGroup = item.visibleBounds; } catch (e) { vbGroup = null; }
                var groupBoundsSource = validBounds(vbGroup) ? vbGroup : gb;
                var groupBoundsObj = boundsFromArray(groupBoundsSource);

                effectiveBounds = groupBoundsObj;
                usedMask = false;

            } catch (e) {
                effectiveBounds = objectsBounds;
                usedMask = false;
            }
        } else {
            try {
                var vbGroup = null;
                try { vbGroup = item.visibleBounds; } catch (e) { vbGroup = null; }
                if (validBounds(vbGroup)) {
                    effectiveBounds = boundsFromArray(vbGroup);
                } else {
                    effectiveBounds = boundsFromArray(gb);
                }
            } catch (e) {
                effectiveBounds = boundsFromArray(gb);
            }
            usedMask = false;
        }

        var widthPt = boundsWidth(effectiveBounds);
        var heightPt = boundsHeight(effectiveBounds);
        if (isNaN(widthPt) || isNaN(heightPt)) {
            widthPt = Math.abs(effectiveBounds.right - effectiveBounds.left);
            heightPt = Math.abs(effectiveBounds.top - effectiveBounds.bottom);
        }

        var widthMM = ptToMm(widthPt);
        var heightMM = ptToMm(heightPt);

        var groupName = item.name;
        if (!groupName || groupName === "") groupName = "Group_" + (groupsInfo.length + 1);

        var isSelected = false;
        try { isSelected = item.selected === true; } catch (e) { isSelected = false; }

        var info = {
            name: groupName,
            width_mm: Number(widthMM.toFixed(4)),
            height_mm: Number(heightMM.toFixed(4)),
            width_pt: Number(widthPt.toFixed(4)),
            height_pt: Number(heightPt.toFixed(4)),
            left_pt: Number(leftPt.toFixed(4)),
            top_pt: Number(topPt.toFixed(4)),
            right_pt: Number(rightPt.toFixed(4)),
            bottom_pt: Number(bottomPt.toFixed(4)),
            eff_left_pt: Number(effectiveBounds.left.toFixed(4)),
            eff_top_pt: Number(effectiveBounds.top.toFixed(4)),
            eff_right_pt: Number(effectiveBounds.right.toFixed(4)),
            eff_bottom_pt: Number(effectiveBounds.bottom.toFixed(4)),
            mask_used: usedMask,
            selected: isSelected,
            pageItemIndex: i,
            fallback_applied: fallbackUsed
        };

        // --- ALERT por grupo com as variáveis principais ---
        try {
            var selTag = isSelected ? " (SELECIONADO)" : "";
            var maskTag = usedMask ? " (MÁSCARA aplicada)" : " (sem máscara)";
            var fallbackTag = fallbackUsed ? "\n*FALLBACK APLICADO: objectsBounds foi unido com geometricBounds do grupo (possível stroke/efeito ignorado)." : "";
            var msg =
                "Grupo: " + groupName + selTag + maskTag + fallbackTag + "\n\n" +
                "Tamanho efetivo (levando em conta máscara quando houver):\n" +
                "  Largura: " + info.width_mm.toFixed(2) + " mm\n" +
                "  Altura:  " + info.height_mm.toFixed(2) + " mm\n\n" +
                "Tamanho em pt (efeito final):\n" +
                "  Largura: " + info.width_pt.toFixed(2) + " pt\n" +
                "  Altura:  " + info.height_pt.toFixed(2) + " pt\n\n" +
                "Coordenadas do grupo (geometricBounds) em pt:\n" +
                "  Left:   " + info.left_pt.toFixed(2) + " pt\n" +
                "  Top:    " + info.top_pt.toFixed(2) + " pt\n" +
                "  Right:  " + info.right_pt.toFixed(2) + " pt\n" +
                "  Bottom: " + info.bottom_pt.toFixed(2) + " pt\n\n" +
                "Bounds efetivos usados (pt):\n" +
                "  Left:   " + info.eff_left_pt.toFixed(2) + " pt\n" +
                "  Top:    " + info.eff_top_pt.toFixed(2) + " pt\n" +
                "  Right:  " + info.eff_right_pt.toFixed(2) + " pt\n" +
                "  Bottom: " + info.eff_bottom_pt.toFixed(2) + " pt\n\n" +
                "pageItemIndex: " + info.pageItemIndex;
            alert(msg);
        } catch (e) {
            $.writeln("Erro mostrando alert do grupo: " + e);
        }

        groupsInfo.push(info);
        groupsNames.push(groupName);

    }

    // --- exportar para escopo global e app.scriptArgs ---
    try {
        $.global.capturedGroups = groupsNames;
    } catch (e) {
        $.writeln("Erro ao setar $.global.capturedGroups: " + e);
    }

    try {
        $.global.capturedGroupData = groupsInfo;
    } catch (e) {
        $.writeln("Erro ao setar $.global.capturedGroupData: " + e);
    }

    try {
        app.scriptArgs.setValue("groupsInfo", JSON.stringify(groupsInfo));
    } catch (e) {
        $.writeln("Erro ao salvar scriptArgs: " + e);
    }

    alert("Captura concluída. " + groupsInfo.length + " grupos encontrados.\nVariáveis globais setadas: $.global.capturedGroups (nomes) e $.global.capturedGroupData (dados). (Veja logs se fallbacks foram aplicados).");
}

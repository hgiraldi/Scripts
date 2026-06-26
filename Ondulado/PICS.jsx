// ============================================================
// PICS.jsx
// Cria SOMENTE os registros (+/x) + label da O.S. em TODOS os grupos da layer
// "arte" do documento ATIVO (sem precisar selecionar), usando a MESMA logica do
// 14_Risco_Faca.jsx -- as funcoes abaixo sao COPIA VERBATIM do Risco_Faca.
// NAO cria o cut e NAO mexe em separacoes. Layer de destino: "registros".
// (Logica DUPLICADA do 14_Risco_Faca.jsx -- corrigir bug numa = replicar na outra.)
// ============================================================

// O.S. (so os 4 ultimos digitos viram o label)
var serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");

// ===== Conversao mm -> pt =====
function mmToPt(mm) {
    return mm * 72.0 / 25.4; // 1 mm ~ 2,83465 pt
}

// margens do cut (p/ o label ocupar a area do cut, incluindo a margem, sem crescer o cut)
var margensCut = null;

/* ===================================================================
 * Funcoes COPIA VERBATIM do 14_Risco_Faca.jsx (registros + label)
 * =================================================================== */
// --- nome de cor TECNICA que deve ser ignorada (none/registro). Branco/white
// NAO entram aqui: so sao ignorados se o VALOR for 0,0,0,0 (ver spotEhBranco). ---
function corEhBrancoNome(nome) {
    var n = String(nome).toLowerCase();
    return (n === "none" || n === "[none]" ||
            n === "[registration]" || n === "[registro]");
}

// --- spot cuja cor e branca (CMYK 0/0/0/0 ou Gray 0) deve ser ignorada ---
function spotEhBranco(spot) {
    try {
        var c = spot.color;
        if (c && c.typename === "CMYKColor" &&
            c.cyan === 0 && c.magenta === 0 && c.yellow === 0 && c.black === 0) return true;
        if (c && c.typename === "GrayColor" && c.gray === 0) return true;
    } catch (e) {}
    return false;
}

// --- cromia PURA: exatamente um canal = 100 e o resto = 0 (tolerancia 1%).
// Mapeia para o nome canonico da separacao (black/cyan/magenta/yellow). E o
// quadrado que o operador pinta (ex.: preto = 0,0,0,100 -> "black"). ---
function aproxCromia(v, alvo) {
    return Math.abs(v - alvo) < 1;
}

function corCromiaPura(cor) {
    if (!cor || cor.typename !== "CMYKColor") return null;
    var c = cor.cyan, m = cor.magenta, y = cor.yellow, k = cor.black;
    if (aproxCromia(c, 100) && aproxCromia(m, 0) && aproxCromia(y, 0) && aproxCromia(k, 0)) return "cyan";
    if (aproxCromia(m, 100) && aproxCromia(c, 0) && aproxCromia(y, 0) && aproxCromia(k, 0)) return "magenta";
    if (aproxCromia(y, 100) && aproxCromia(c, 0) && aproxCromia(m, 0) && aproxCromia(k, 0)) return "yellow";
    if (aproxCromia(k, 100) && aproxCromia(c, 0) && aproxCromia(m, 0) && aproxCromia(y, 0)) return "black";
    return null;
}

function ehNomeCromia(nome) {
    return (nome === "black" || nome === "cyan" || nome === "magenta" || nome === "yellow");
}

// CMYKColor da separacao de cromia (black -> 0,0,0,100, etc.).
function cmykDaCromia(cromiaNome) {
    var c = new CMYKColor();
    c.cyan = 0; c.magenta = 0; c.yellow = 0; c.black = 0;
    if (cromiaNome === "cyan") c.cyan = 100;
    else if (cromiaNome === "magenta") c.magenta = 100;
    else if (cromiaNome === "yellow") c.yellow = 100;
    else if (cromiaNome === "black") c.black = 100;
    return c;
}

function melhorDaContagem(contagem) {
    var melhor = null, maxC = 0;
    for (var nome in contagem) {
        if (contagem.hasOwnProperty(nome) && contagem[nome] > maxC) {
            maxC = contagem[nome];
            melhor = nome;
        }
    }
    return melhor;
}

// --- cor predominante de um grupo: a spot mais frequente em fill+stroke. Se NAO
// houver spot, cai para a cromia pura mais frequente (black/cyan/...). Spot SEMPRE
// tem prioridade para nao mudar o que ja funcionava. ---
function corPredominanteDoGrupo(grupo) {
    var contagemSpot = {};
    var contagemCromia = {};

    function conta(cor) {
        if (!cor) return;
        if (cor.typename === "SpotColor" && cor.spot) {
            var nm = cor.spot.name;
            if (corEhBrancoNome(nm)) return;
            if (spotEhBranco(cor.spot)) return;
            contagemSpot[nm] = (contagemSpot[nm] || 0) + 1;
            return;
        }
        var crom = corCromiaPura(cor);
        if (crom) contagemCromia[crom] = (contagemCromia[crom] || 0) + 1;
    }

    function visita(item) {
        try { if (item.filled) conta(item.fillColor); } catch (e) {}
        try { if (item.stroked) conta(item.strokeColor); } catch (e) {}
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) visita(item.pageItems[i]);
        } else if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++) visita(item.pathItems[i]);
        } else if (item.typename === "TextFrame") {
            try {
                var ca = item.textRange.characterAttributes;
                conta(ca.fillColor);
                conta(ca.strokeColor);
            } catch (e) {}
        }
    }

    visita(grupo);

    var melhorSpot = melhorDaContagem(contagemSpot);
    if (melhorSpot) return melhorSpot;
    return melhorDaContagem(contagemCromia);
}

// cor p/ pintar o registro a partir do nome predominante:
//  - spot existente -> SpotColor (tint 100). Cobre pantones e as spots de cromia
//    que o RemapCores cria (black1, cyan1...).
//  - cromia pura sem spot (black/cyan/magenta/yellow) -> CMYKColor puro, p/ a
//    cromia seguir como cor normal. null -> pula o grupo.
function corDoGrupo(doc, nomeCor) {
    try {
        var sc = new SpotColor();
        sc.spot = doc.spots.getByName(nomeCor);
        sc.tint = 100;
        return sc;
    } catch (e) {}
    if (ehNomeCromia(nomeCor)) return cmykDaCromia(nomeCor);
    return null;
}

// --- doc tem imagem (incorporada/colocada)? so para AVISAR (nao bloqueia) ---
function docTemImagem(doc) {
    try { if (doc.rasterItems && doc.rasterItems.length > 0) return true; } catch (e) {}
    try { if (doc.placedItems && doc.placedItems.length > 0) return true; } catch (e2) {}
    return false;
}

// --- layers que alimentam o risco: a arte principal + a "medidas" (quadrados
// que representam as cores da imagem). "medidas" e opcional. ---
function getLayersFonteRisco(doc, arte) {
    var fontes = [arte];
    try {
        var med = doc.layers.getByName("medidas");
        if (med && med.name !== arte.name) fontes.push(med);
    } catch (e) {}
    return fontes;
}

// --- bounds visiveis de um objeto/grupo (trata grupo, clip e compound) ---
function getVisibleBounds(object) {
    var bounds, clippedItem, sandboxItem, sandboxLayer, curItem;

    if (object.guides) return undefined;

    if (object.typename == "GroupItem") {
        if (!object.pageItems || object.pageItems.length == 0) return undefined;

        if (object.clipped) {
            for (var i = 0; i < object.pageItems.length; i++) {
                curItem = object.pageItems[i];
                if (curItem.clipping) { clippedItem = curItem; break; }
                else if (curItem.typename == "CompoundPathItem") {
                    if (!curItem.pathItems.length) {
                        sandboxLayer = app.activeDocument.layers.add();
                        sandboxItem = curItem.duplicate(sandboxLayer);
                        app.activeDocument.selection = null;
                        sandboxItem.selected = true;
                        app.executeMenuCommand("noCompoundPath");
                        sandboxLayer.hasSelectedArtwork = true;
                        app.executeMenuCommand("group");
                        clippedItem = app.activeDocument.selection[0];
                        break;
                    } else if (curItem.pathItems[0].clipping) { clippedItem = curItem; break; }
                }
            }
            if (!clippedItem) clippedItem = object.pageItems[0];
            bounds = clippedItem.visibleBounds;
            if (sandboxLayer) { sandboxLayer.remove(); sandboxLayer = undefined; }
        } else {
            var subObjectBounds;
            var allBoundPoints = [[], [], [], []];
            for (var k = 0; k < object.pageItems.length; k++) {
                curItem = object.pageItems[k];
                subObjectBounds = getVisibleBounds(curItem);
                if (!subObjectBounds) continue;
                allBoundPoints[0].push(subObjectBounds[0]);
                allBoundPoints[1].push(subObjectBounds[1]);
                allBoundPoints[2].push(subObjectBounds[2]);
                allBoundPoints[3].push(subObjectBounds[3]);
            }
            if (!allBoundPoints[0].length) return undefined;
            bounds = [
                Math.min.apply(Math, allBoundPoints[0]),
                Math.max.apply(Math, allBoundPoints[1]),
                Math.max.apply(Math, allBoundPoints[2]),
                Math.min.apply(Math, allBoundPoints[3])
            ];
        }
    } else {
        bounds = object.visibleBounds;
    }
    return bounds;
}

// --- dialogo: escolher a layer da arte quando "arte" nao existe ---
function escolherLayerArteDialog(doc) {
    var win = new Window("dialog", "Layer 'arte' nao encontrada");
    win.orientation = "column";
    win.alignChildren = "fill";
    win.margins = 16;
    win.spacing = 10;
    win.add("statictext", undefined, "A layer 'arte' nao foi encontrada.");
    win.add("statictext", undefined, "Selecione a layer que contem a arte:");
    var dd = win.add("dropdownlist");
    for (var i = 0; i < doc.layers.length; i++) dd.add("item", doc.layers[i].name);
    if (dd.items.length > 0) dd.selection = 0;
    var grp = win.add("group");
    grp.alignment = "right";
    grp.add("button", undefined, "Cancelar", { name: "cancel" });
    grp.add("button", undefined, "OK", { name: "ok" });
    if (win.show() !== 1 || !dd.selection) return null;
    return doc.layers[dd.selection.index];
}

// --- linha de registro (contorno na cor, overprint); cria na layer e move pro grupo ---
function criaLinhaReg(layer, grupo, x1, y1, x2, y2, cor, stroke) {
    var l = layer.pathItems.add();
    l.setEntirePath([[x1, y1], [x2, y2]]);
    l.stroked = true;
    l.filled = false;
    l.strokeWidth = stroke;
    l.strokeColor = cor;
    l.strokeOverprint = true;
    l.move(grupo, ElementPlacement.PLACEATEND);
    return l;
}

// coleta os geometricBounds dos objetos-folha da arte (para evitar colisao)
// ===== bounds VISIVEL clipado a mascara (copiado da Medicao Ondulado) =====
function unionBounds(acc, b) {
    if (!b) return acc;
    if (!acc) return [b[0], b[1], b[2], b[3]];
    var left = Math.min(acc[0], b[0]);
    var top = Math.max(acc[1], b[1]);
    var right = Math.max(acc[2], b[2]);
    var bottom = Math.min(acc[3], b[3]);
    return [left, top, right, bottom];
}

function intersectBounds(a, b) {
    if (!a || !b) return null;
    var left = Math.max(a[0], b[0]);
    var right = Math.min(a[2], b[2]);
    var top = Math.min(a[1], b[1]);
    var bottom = Math.max(a[3], b[3]);
    if (left >= right || bottom >= top) return null;
    return [left, top, right, bottom];
}

function shouldIgnoreItemByStyle(it) {

    try {
        if (it.opacity === 0) return true;
    } catch (e) {}

    if (it.typename === "PathItem") {
        try {
            if (!it.filled && !it.stroked) return true;
        } catch (e1) {}
        return false;
    }

    if (it.typename === "CompoundPathItem") {
        try {
            if (it.pathItems && it.pathItems.length > 0) {
                var anyVis = false;
                for (var i = 0; i < it.pathItems.length; i++) {
                    var p = it.pathItems[i];
                    try {
                        if (p.opacity === 0) continue;
                    } catch (e0) {}
                    if (p.filled || p.stroked) {
                        anyVis = true;
                        break;
                    }
                }
                return !anyVis;
            }
        } catch (e2) {}
        return false;
    }

    return false;
}

function findMaskBoundsInGroup(grp) {

    var i, p, cp, k;

    for (i = 0; i < grp.pathItems.length; i++) {
        p = grp.pathItems[i];
        try {
            if (p.clipping) return p.geometricBounds;
        } catch (e1) {}
    }

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

    return grp.geometricBounds;
}

function getVisibleBoundsDeep(it) {

    if (!it || it.hidden || it.locked) return null;

    try {

        if (it.typename === "GroupItem") {

            if (it.clipped) {

                var maskB = findMaskBoundsInGroup(it);
                var childrenB = null;

                for (var j = 0; j < it.pageItems.length; j++) {

                    var child = it.pageItems[j];

                    if (child.typename === "PathItem") {
                        try {
                            if (child.clipping) continue;
                        } catch (e0) {}
                    }

                    if (child.typename === "CompoundPathItem") {

                        var isMask = false;

                        try {
                            for (var kk = 0; kk < child.pathItems.length; kk++) {

                                var pp = child.pathItems[kk];

                                try {
                                    if (pp.clipping) {
                                        isMask = true;
                                        break;
                                    }
                                } catch (e01) {}

                            }
                        } catch (e02) {}

                        if (isMask) continue;
                    }

                    if (shouldIgnoreItemByStyle(child) && child.typename !== "GroupItem") continue;

                    var cb = getVisibleBoundsDeep(child);
                    childrenB = unionBounds(childrenB, cb);
                }

                if (!childrenB) return null;

                var inter = intersectBounds(maskB, childrenB);
                return inter ? inter : null;
            }

            var b = null;

            for (var i = 0; i < it.pageItems.length; i++) {

                var child2 = it.pageItems[i];

                if (shouldIgnoreItemByStyle(child2) && child2.typename !== "GroupItem") continue;

                var cb2 = getVisibleBoundsDeep(child2);
                b = unionBounds(b, cb2);
            }

            return b;
        }

        if (shouldIgnoreItemByStyle(it)) return null;

        return it.geometricBounds;

    } catch (e) {
        return null;
    }
}

// coleta os bounds da arte p/ COLISAO, CLIPADOS a mascara: recorta cada item-folha ao
// bounds visivel (intersecta com a mascara acumulada), pula o caminho de mascara e
// itens invisiveis -> registros/label desviam so da arte VISIVEL (nao do que passa
// da mascara). Mantem o mesmo formato [left,top,right,bottom] que a colisao espera.
function coletarBoundsArte(grupo, arr) {
    coletarBoundsArteRec(grupo, arr, null);
}
function coletarBoundsArteRec(grupo, arr, maskAcc) {
    var localMask = maskAcc;
    try {
        if (grupo.typename === "GroupItem" && grupo.clipped) {
            var mb = findMaskBoundsInGroup(grupo);
            localMask = maskAcc ? intersectBounds(maskAcc, mb) : mb;
        }
    } catch (e) {}
    for (var i = 0; i < grupo.pageItems.length; i++) {
        var it = grupo.pageItems[i];
        if (it.typename === "GroupItem") {
            coletarBoundsArteRec(it, arr, localMask);
        } else {
            // pula o caminho de mascara (clipping) e itens invisiveis
            var ehMascara = false;
            try { ehMascara = (it.clipping === true); } catch (e) {}
            if (!ehMascara && it.typename === "CompoundPathItem") {
                try {
                    for (var k = 0; k < it.pathItems.length; k++) {
                        if (it.pathItems[k].clipping) { ehMascara = true; break; }
                    }
                } catch (e) {}
            }
            if (ehMascara) continue;
            if (shouldIgnoreItemByStyle(it)) continue;
            try {
                var gb = it.geometricBounds;
                var vis = localMask ? intersectBounds(localMask, gb) : gb;
                if (vis) arr.push(vis);
            } catch (e) {}
        }
    }
}

function embaralhar(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
}

// a caixa [cx +- raio, cy +- raio] colide com algum bounds de arte?
// ===== INDICE ESPACIAL p/ colisao com a arte (performance) =====
// boundsArte de uma arte detalhada tem MILHARES de retangulos; cada checagem de
// posicao varria a lista INTEIRA (era o gargalo do PASSO 3). O indice agrupa os
// bounds em CELULAS de grade -> a checagem so olha as celulas PERTO da marca.
// Resultado IDENTICO ao scan linear (lossless), ordens de magnitude mais rapido.
// O indice e cacheado no proprio array (arr._idx) e reusado nas checagens do grupo.
function criarIndiceBounds(arr, cell) {
    var mapa = {}, grandes = [];
    for (var i = 0; i < arr.length; i++) {
        var b = arr[i]; // [left, top, right, bottom]  (top > bottom)
        var c0 = Math.floor(b[0] / cell), c1 = Math.floor(b[2] / cell);
        var r0 = Math.floor(b[3] / cell), r1 = Math.floor(b[1] / cell);
        // bound GRANDE (cobre muitas celulas) vai pra lista fixa (sempre checada),
        // p/ nao inchar o mapa. Sao poucos (fundos, formas cheias).
        if ((c1 - c0) > 4 || (r1 - r0) > 4) { grandes.push(b); continue; }
        for (var cx = c0; cx <= c1; cx++) {
            for (var ry = r0; ry <= r1; ry++) {
                var k = cx + "_" + ry;
                if (!mapa[k]) mapa[k] = [];
                mapa[k].push(b);
            }
        }
    }
    return { cell: cell, mapa: mapa, grandes: grandes };
}

// indice cacheado no array; so vale a pena indexar listas grandes.
function idxDe(arr) {
    if (!arr || arr.length < 64) return null; // pequeno: scan linear ja e rapido
    if (!arr._idx) arr._idx = criarIndiceBounds(arr, mmToPt(5));
    return arr._idx;
}

// algum bound do indice sobrepoe a caixa-query [qL,qT,qR,qB] (top > bottom)?
// Lossless: se b sobrepoe a query, eles compartilham >=1 celula -> b e testado.
function indiceColide(idx, qL, qT, qR, qB) {
    var i, b;
    for (i = 0; i < idx.grandes.length; i++) {
        b = idx.grandes[i];
        if (qL < b[2] && qR > b[0] && qB < b[1] && qT > b[3]) return true;
    }
    var cell = idx.cell, mapa = idx.mapa;
    var c0 = Math.floor(qL / cell), c1 = Math.floor(qR / cell);
    var r0 = Math.floor(qB / cell), r1 = Math.floor(qT / cell);
    for (var cx = c0; cx <= c1; cx++) {
        for (var ry = r0; ry <= r1; ry++) {
            var arr = mapa[cx + "_" + ry];
            if (!arr) continue;
            for (var j = 0; j < arr.length; j++) {
                b = arr[j];
                if (qL < b[2] && qR > b[0] && qB < b[1] && qT > b[3]) return true;
            }
        }
    }
    return false;
}

// a caixa [cx +- raio, cy +- raio] colide com algum bounds de arte?
function caixaColideArte(cx, cy, raio, boundsArte) {
    var mL = cx - raio, mR = cx + raio, mT = cy + raio, mB = cy - raio;
    var idx = idxDe(boundsArte);
    if (idx) return indiceColide(idx, mL, mT, mR, mB);
    for (var i = 0; i < boundsArte.length; i++) {
        var b = boundsArte[i]; // [left, top, right, bottom]
        if (mL < b[2] && mR > b[0] && mB < b[1] && mT > b[3]) return true;
    }
    return false;
}

// acha posicao livre p/ a marca perto de um lado; DENTRO do vb se possivel,
// senao logo FORA (o cut cresce depois). lado: "topo","base","esq","dir".
function acharPosMarca(vb, boundsArte, raio, markHalf, lado) {
    var left = vb[0], top = vb[1], right = vb[2], bottom = vb[3];
    var passos = 6;
    var cands = [];
    var i, j;

    if (lado === "topo" || lado === "base") {
        var yIni = (lado === "topo") ? (top - markHalf) : (bottom + markHalf);
        var yFim = (top + bottom) / 2;
        var passoY = (yFim - yIni) / passos;
        var xs = [];
        for (j = 0; j <= passos; j++) {
            xs.push(left + markHalf + (right - left - 2 * markHalf) * (j / passos));
        }
        embaralhar(xs);
        for (i = 0; i <= passos; i++) {
            var cy = yIni + passoY * i;
            for (j = 0; j < xs.length; j++) cands.push([xs[j], cy]);
        }
    } else {
        var xIni = (lado === "esq") ? (left + markHalf) : (right - markHalf);
        var xFim = (left + right) / 2;
        var passoX = (xFim - xIni) / passos;
        var ys = [];
        for (j = 0; j <= passos; j++) {
            ys.push(bottom + markHalf + (top - bottom - 2 * markHalf) * (j / passos));
        }
        embaralhar(ys);
        for (i = 0; i <= passos; i++) {
            var cx = xIni + passoX * i;
            for (j = 0; j < ys.length; j++) cands.push([cx, ys[j]]);
        }
    }

    for (i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (c[0] - markHalf >= left && c[0] + markHalf <= right &&
            c[1] - markHalf >= bottom && c[1] + markHalf <= top) {
            if (!caixaColideArte(c[0], c[1], raio, boundsArte)) return c;
        }
    }

    // nao achou DENTRO -> tenta FORA, preferindo o lado-alvo e EVITANDO colisao
    // (com a propria arte e com os vizinhos, que entram em boundsArte na 3b).
    // nao achou DENTRO -> EMPURRA a marca pra FORA ate ficar livre (nunca em cima
    // da arte/vizinho), preferindo o lado-alvo. raio ja garante a folga de 4mm.
    var lados = [lado, "topo", "base", "esq", "dir"];
    var passo = mmToPt(4);
    for (var f = 0; f < lados.length; f++) {
        for (var d = 0; d < 10; d++) {
            var off = raio + passo * d;
            var pf;
            if (lados[f] === "topo")      pf = [(left + right) / 2, top + off];
            else if (lados[f] === "base") pf = [(left + right) / 2, bottom - off];
            else if (lados[f] === "esq")  pf = [left - off, (top + bottom) / 2];
            else                          pf = [right + off, (top + bottom) / 2];
            if (!caixaColideArte(pf[0], pf[1], raio, boundsArte)) return pf;
        }
    }
    // ultimo recurso (tudo cercado): lado-alvo a 4mm
    if (lado === "topo")  return [(left + right) / 2, top + raio];
    if (lado === "base")  return [(left + right) / 2, bottom - raio];
    if (lado === "esq")   return [left - raio, (top + bottom) / 2];
    return [right + raio, (top + bottom) / 2];
}

// a caixa [L,T,R,B] (L<R, B<T) NAO sobrepoe nenhum bounds de arte (com folga)?
function caixaLivreArte(L, T, R, B, arte, folga) {
    if (!arte) return true;
    var idx = idxDe(arte);
    if (idx) return !indiceColide(idx, L - folga, T + folga, R + folga, B - folga);
    for (var i = 0; i < arte.length; i++) {
        var b = arte[i]; // [left, top, right, bottom]
        if (L - folga < b[2] && R + folga > b[0] && B - folga < b[1] && T + folga > b[3]) return false;
    }
    return true;
}

// posiciona o canto sup-esq do bounds de tf em (L,T) via translate -> funciona mesmo
// com o frame ROTACIONADO (setar .left/.top em texto rotacionado e instavel e pode
// deixar o frame na origem 0,0 -> cut gigante).
function moverTopoEsq(tf, L, T) {
    var gb = tf.geometricBounds; // Illustrator: [left, top, right, bottom]
    tf.translate(L - gb[0], T - gb[1]); // dX = L - left atual ; dY = T - top atual
}

// centraliza o tf no EIXO do "+": vertical -> centro X no pMais[0]; horizontal ->
// centro Y no pMais[1]. Usa o bounds REAL (corrige qualquer desvio da rotacao).
function centralizarNoMais(tf, pMais, vertical) {
    var gb = tf.geometricBounds; // Illustrator: [left, top, right, bottom]
    if (vertical) {
        tf.translate(pMais[0] - (gb[0] + gb[2]) / 2, 0); // centro X = (left+right)/2
    } else {
        tf.translate(0, pMais[1] - (gb[1] + gb[3]) / 2); // centro Y = (top+bottom)/2
    }
}

// expande os bounds da arte∪marcas pelas margens do cut -> area DENTRO do cut onde o
// label pode ficar (inclui a faixa da margem) sem crescer o cut.
function expandirCut(uni) {
    if (!margensCut) return uni;
    return [uni[0] - margensCut[0], uni[1] + margensCut[1], uni[2] + margensCut[2], uni[3] - margensCut[3]];
}

// label (caixa wl x hl) livre? 2mm da ARTE e 0,1mm dos REGISTROS (+/x). A folga e
// medida no BOUNDS VETORIAL do label (curva), nao na fonte.
function labelLivre(L, T, wl, hl, arte, registros) {
    if (!caixaLivreArte(L, T, L + wl, T - hl, arte, mmToPt(2))) return false;
    if (!caixaLivreArte(L, T, L + wl, T - hl, registros, mmToPt(0.1))) return false;
    return true;
}

// a caixa wl x hl com canto sup-esq (L,T) cabe inteira dentro de refB?
function labelDentro(L, T, wl, hl, refB) {
    return !refB || (L >= refB[0] && L + wl <= refB[2] && T <= refB[1] && T - hl >= refB[3]);
}

// tenta o label DO LADO do "+", coladinho (~0,5mm), DENTRO de refB, 2mm da arte e
// 0,5mm dos registros, escolhendo a posicao MAIS DENTRO do bounds. FASE 1 (diagonais
// =false): CARDINAIS -> direita/esquerda DEITADO, cima/baixo EM PE (label segue a
// rotacao). FASE 2 (=true): 4 DIAGONAIS (deitado). Retorna { L, T, vertical } ou null.
function acharPosLabelLado(tf, pMais, markHalf, refB, arte, registros, diagonais) {
    var g = mmToPt(0.1); // folga (no VETOR) da borda do label ate a PONTA do registro (+/x)
    var w0 = tf.width, h0 = tf.height;
    // cada candidato: [L, T, wl, hl, vertical]
    var cands;
    if (!diagonais) {
        cands = [
            [pMais[0] + markHalf + g, pMais[1] + h0 / 2, w0, h0, false],          // direita (deitado)
            [pMais[0] - markHalf - g - w0, pMais[1] + h0 / 2, w0, h0, false],     // esquerda (deitado)
            [pMais[0] - h0 / 2, pMais[1] + markHalf + g + w0, h0, w0, true],      // cima (em pe)
            [pMais[0] - h0 / 2, pMais[1] - markHalf - g, h0, w0, true]            // baixo (em pe)
        ];
    } else {
        cands = [
            [pMais[0] + markHalf + g, pMais[1] - markHalf - g, w0, h0, false],            // baixo-dir
            [pMais[0] - markHalf - g - w0, pMais[1] - markHalf - g, w0, h0, false],       // baixo-esq
            [pMais[0] + markHalf + g, pMais[1] + markHalf + g + h0, w0, h0, false],       // cima-dir
            [pMais[0] - markHalf - g - w0, pMais[1] + markHalf + g + h0, w0, h0, false]   // cima-esq
        ];
    }
    var best = null, bestD = 1e18;
    for (var i = 0; i < cands.length; i++) {
        var L = cands[i][0], T = cands[i][1], wl = cands[i][2], hl = cands[i][3], vert = cands[i][4];
        if (!labelDentro(L, T, wl, hl, refB)) continue;
        if (!labelLivre(L, T, wl, hl, arte, registros)) continue;
        var ccx = L + wl / 2, ccy = T - hl / 2;
        var d = (ccx - pMais[0]) * (ccx - pMais[0]) + (ccy - pMais[1]) * (ccy - pMais[1]); // mais perto do "+"
        if (d < bestD) { bestD = d; best = { L: L, T: T, vertical: vert }; }
    }
    return best;
}

// grid dentro de refB, livre (2mm arte / 0,5mm registros), o mais perto do "+". [L,T] ou null.
function acharPosLabel(tf, pMais, refB, arte, registros) {
    if (!refB) return null;
    var wl = tf.width, hl = tf.height;
    var x0 = refB[0], x1 = refB[2] - wl;
    var y0 = refB[3] + hl, y1 = refB[1];
    if (x1 < x0 || y1 < y0) return null;
    var nx = 14, ny = 14, best = null, bestD = 1e18;
    for (var ix = 0; ix <= nx; ix++) {
        for (var iy = 0; iy <= ny; iy++) {
            var L = x0 + (x1 - x0) * (ix / nx);
            var T = y0 + (y1 - y0) * (iy / ny);
            if (!labelLivre(L, T, wl, hl, arte, registros)) continue;
            var cx = L + wl / 2, cy = T - hl / 2;
            var d = (cx - pMais[0]) * (cx - pMais[0]) + (cy - pMais[1]) * (cy - pMais[1]);
            if (d < bestD) { bestD = d; best = [L, T]; }
        }
    }
    return best;
}

// posiciona o label: 1) DO LADO do "+", DENTRO do bounds (refB com 1mm a menos p/ nao
// encostar na borda), prioridade pra mais dentro; 2) grid dentro do bounds; 3) ULTIMO
// CASO fora. Prioriza SEMPRE dentro do bounds. Retorna true se ficou FORA do bounds.
function posicionarLabel(tf, pMais, pX, markHalf, refB, arteOwn) {
    var arte = arteOwn ? arteOwn : [];
    var registros = [
        [pMais[0] - markHalf, pMais[1] + markHalf, pMais[0] + markHalf, pMais[1] - markHalf], // "+"
        [pX[0] - markHalf, pX[1] + markHalf, pX[0] + markHalf, pX[1] - markHalf]              // "x"
    ];
    var inset = mmToPt(2);
    var refBin = refB ? [refB[0] + inset, refB[1] - inset, refB[2] - inset, refB[3] + inset] : null;

    // 1) CARDINAIS (deitado nos lados / em pe em cima-baixo); 2) DIAGONAIS
    var r = acharPosLabelLado(tf, pMais, markHalf, refBin, arte, registros, false);
    var cardinal = !!r;
    if (!r) r = acharPosLabelLado(tf, pMais, markHalf, refBin, arte, registros, true);
    if (r) {
        if (r.vertical) { try { tf.rotate(90); } catch (e) {} }
        moverTopoEsq(tf, r.L, r.T);
        // re-centraliza no EIXO do "+" usando o bounds REAL (corrige desvio da rotacao);
        // so nas CARDINAIS (as diagonais sao nos cantos de proposito).
        if (cardinal) centralizarNoMais(tf, pMais, r.vertical);
        return false;
    }
    var res = acharPosLabel(tf, pMais, refBin, arte, registros); // 3) grid dentro do bounds
    if (res) { moverTopoEsq(tf, res[0], res[1]); return false; }

    // 4) ULTIMO CASO: nao achou lugar LIVRE -> CLAMPA dentro do bounds, o mais perto
    // possivel do "+". NUNCA sai do bounds (regra absoluta). Pode sobrepor algo.
    var wl = tf.width, hl = tf.height;
    var L = pMais[0] - wl / 2, T = pMais[1] + hl / 2;
    var cb = refB ? refB : refBin;
    if (cb) {
        if (L + wl > cb[2]) L = cb[2] - wl;
        if (L < cb[0]) L = cb[0];
        if (T - hl < cb[3]) T = cb[3] + hl;
        if (T > cb[1]) T = cb[1];
    }
    moverTopoEsq(tf, L, T);
    return false; // ficou DENTRO do bounds (clampado)
}

// desenha um par (+ e x) em REG_<cor> nas posicoes dadas; texto (label) opcional
// junto do "+". Retorna os bounds SO das marcas (o label nunca cresce o cut).
function desenharPar(registrosLayer, pMais, pX, cor, nomeCor, markHalf, stroke, comTexto, refB, arteOwn) {
    var grupoReg = registrosLayer.groupItems.add();
    grupoReg.name = "REG_" + nomeCor;

    // "+"
    criaLinhaReg(registrosLayer, grupoReg, pMais[0] - markHalf, pMais[1], pMais[0] + markHalf, pMais[1], cor, stroke);
    criaLinhaReg(registrosLayer, grupoReg, pMais[0], pMais[1] - markHalf, pMais[0], pMais[1] + markHalf, cor, stroke);
    // "x"
    criaLinhaReg(registrosLayer, grupoReg, pX[0] - markHalf, pX[1] - markHalf, pX[0] + markHalf, pX[1] + markHalf, cor, stroke);
    criaLinhaReg(registrosLayer, grupoReg, pX[0] - markHalf, pX[1] + markHalf, pX[0] + markHalf, pX[1] - markHalf, cor, stroke);

    var marcasB = [
        Math.min(pMais[0], pX[0]) - markHalf, Math.max(pMais[1], pX[1]) + markHalf,
        Math.max(pMais[0], pX[0]) + markHalf, Math.min(pMais[1], pX[1]) - markHalf
    ];

    if (comTexto) {
        try {
            // label = 4 ultimos digitos da O.S. (serviceOrderNumber); so neste par
            var osStr = "" + serviceOrderNumber;
            var lbl = (osStr.length >= 4) ? osStr.substring(osStr.length - 4) : osStr;

            var tf = registrosLayer.textFrames.add();
            tf.kind = TextType.POINTTEXT;
            tf.contents = lbl;
            tf.textRange.size = mmToPt(3.5);
            tf.textRange.fillColor = cor;
            try { tf.textRange.characterAttributes.overprintFill = true; } catch (e) {}
            try { tf.name = "LABEL"; } catch (e) {} // removido no poliester (recolorirRegistro)

            // Label em FONTE (texto), NAO curva. Posiciona (centraliza no "+") e agrupa.
            // recolorirRegistro remove o TextFrame "LABEL" na separacao (fonte nao vai
            // pro poliester). Sem createOutline -> nada de label duplicado.
            posicionarLabel(tf, pMais, pX, markHalf, refB, arteOwn);
            tf.move(grupoReg, ElementPlacement.PLACEATEND);
        } catch (eLabel) {}
    }

    return marcasB;
}

// --- Fase 3a: acha as posicoes do par nas 2 pontas do MAIOR lado (no vazio,
//     >=4mm da arte; dentro do bounds se der, senao fora). Desenha e retorna
//     { pMais, pX, bounds }. ---
// gera candidatos de posicao ao redor do grupo (4 lados x 3 fracoes), cada um
// EMPURRADO pra fora ate ficar livre da arte/vizinhos. Retorna so os livres.
// colisao da marca: folga >=4mm da arte PROPRIA; do vizinho basta NAO sobrepor
// (>=1mm) -> permite usar vaos estreitos entre o grupo e o vizinho.
function marcaColide(cx, cy, markHalf, arteOwn, vizinhos) {
    var rA = markHalf + mmToPt(3);
    var i, b;
    var idx = idxDe(arteOwn);
    if (idx) {
        if (indiceColide(idx, cx - rA, cy + rA, cx + rA, cy - rA)) return true;
    } else {
        for (i = 0; i < arteOwn.length; i++) {
            b = arteOwn[i];
            if (cx - rA < b[2] && cx + rA > b[0] && cy - rA < b[1] && cy + rA > b[3]) return true;
        }
    }
    var rV = markHalf + mmToPt(1);
    if (vizinhos) {
        for (i = 0; i < vizinhos.length; i++) {
            b = vizinhos[i];
            if (cx - rV < b[2] && cx + rV > b[0] && cy - rV < b[1] && cy + rV > b[3]) return true;
        }
    }
    return false;
}

// candidatos ao redor do grupo (4 lados x 3 fracoes), empurrados pra fora ate
// livre. Retorna [{ p:[x,y], lado }].
function gerarCandidatosMarca(vb, arteOwn, vizinhos, markHalf) {
    var left = vb[0], top = vb[1], right = vb[2], bottom = vb[3];
    var base = markHalf + mmToPt(3); // 3mm da arte propria
    var passo = mmToPt(4);
    var fr = [0.1, 0.5, 0.9];
    var cands = [];

    function pushOut(lado, frac) {
        for (var d = 0; d < 10; d++) {
            var off = base + passo * d;
            var p;
            if (lado === "topo")      p = [left + (right - left) * frac, top + off];
            else if (lado === "base") p = [left + (right - left) * frac, bottom - off];
            else if (lado === "esq")  p = [left - off, bottom + (top - bottom) * frac];
            else                      p = [right + off, bottom + (top - bottom) * frac];
            if (!marcaColide(p[0], p[1], markHalf, arteOwn, vizinhos)) return p;
        }
        return null;
    }

    var lados = ["topo", "base", "esq", "dir"];
    for (var s = 0; s < lados.length; s++) {
        for (var i = 0; i < fr.length; i++) {
            var p = pushOut(lados[s], fr[i]);
            if (p) cands.push({ p: p, lado: lados[s] });
        }
    }
    return cands;
}

function ladosOpostos(a, b) {
    return (a === "esq" && b === "dir") || (a === "dir" && b === "esq") ||
           (a === "topo" && b === "base") || (a === "base" && b === "topo");
}

// candidatos DENTRO do envelope (= bounds da arte, ou ate 100mm se a peca for
// pequena), >=4mm da arte propria e sem sobrepor vizinhos.
function candidatosDentro(vbEnv, arteOwn, vizinhos, markHalf) {
    var left = vbEnv[0], top = vbEnv[1], right = vbEnv[2], bottom = vbEnv[3];
    var availW = right - left - 2 * markHalf;
    var availH = top - bottom - 2 * markHalf;
    var cands = [];
    if (availW <= 0 || availH <= 0) return cands;
    var n = 8;
    for (var i = 0; i <= n; i++) {
        for (var j = 0; j <= n; j++) {
            var cx = left + markHalf + availW * (i / n);
            var cy = bottom + markHalf + availH * (j / n);
            if (!marcaColide(cx, cy, markHalf, arteOwn, vizinhos)) cands.push([cx, cy]);
        }
    }
    return cands;
}

// o ponto (marca +-markHalf) cabe inteiro dentro do bounds b?
function dentroDeBounds(p, b, markHalf) {
    return (p[0] - markHalf >= b[0] && p[0] + markHalf <= b[2] &&
            p[1] - markHalf >= b[3] && p[1] + markHalf <= b[1]);
}

// par mais distante de uma lista de pontos [x,y]
function parMaisDistante(pts) {
    var melhor = null, maxD = -1;
    for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
            var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
            var d = dx * dx + dy * dy;
            if (d > maxD) { maxD = d; melhor = [pts[i], pts[j]]; }
        }
    }
    return melhor;
}

// criterio lexicografico: 1) menor crescimento de AREA da cor MAIOR do encaixe
// (manter DENTRO do vermelho); 2) menor crescimento de EXTENSAO do cut proprio (nao
// esticar a dim. longa -> eixo curto/vao); 3) menor crescimento de AREA do proprio;
// 4) par mais afastado (registro).
function paresMelhor(rg, ge, ga, d2, bRg, bGe, bGa, bD2) {
    if (rg < bRg - 2.0) return true;   // area da cor maior (pt^2)
    if (rg > bRg + 2.0) return false;
    if (ge < bGe - 0.5) return true;   // extensao do proprio (pt)
    if (ge > bGe + 0.5) return false;
    if (ga < bGa - 2.0) return true;   // area do proprio (pt^2)
    if (ga > bGa + 2.0) return false;
    return d2 > bD2;                    // desempate: mais afastado
}

// caixa que engloba o bounds b e as 2 marcas (p1,p2 +- markHalf). Retorna
// [extensao(dim max), area].
function cutExtArea(b, p1, p2, markHalf) {
    var L = Math.min(b[0], p1[0] - markHalf, p2[0] - markHalf);
    var T = Math.max(b[1], p1[1] + markHalf, p2[1] + markHalf);
    var R = Math.max(b[2], p1[0] + markHalf, p2[0] + markHalf);
    var B = Math.min(b[3], p1[1] - markHalf, p2[1] - markHalf);
    var w = R - L, h = T - B;
    return [(w > h) ? w : h, w * h];
}

// escolhe o par seguindo a prioridade combinada: 1) nao crescer a area da cor MAIOR
// (ficar DENTRO do vermelho); 2) nao esticar a extensao do proprio (eixo curto/vao);
// 3) menor area do proprio; 4) par mais AFASTADO (registro).
function escolherPar(pool, vb, markHalf, preferir) {
    var minSep = 2 * markHalf + mmToPt(2); // + e x nunca "juntos"
    var minSep2 = minSep * minSep;

    var ownW0 = vb[2] - vb[0], ownH0 = vb[1] - vb[3];
    var ownMd0 = (ownW0 > ownH0) ? ownW0 : ownH0;
    var ownAr0 = ownW0 * ownH0;
    var redAr0 = 0;
    if (preferir) redAr0 = (preferir[2] - preferir[0]) * (preferir[1] - preferir[3]);

    var melhor = null, bRg = 1e18, bGe = 1e18, bGa = 1e18, bD2 = -1;
    for (var i = 0; i < pool.length; i++) {
        for (var j = i + 1; j < pool.length; j++) {
            var p1 = pool[i], p2 = pool[j];
            var dx = p1[0] - p2[0], dy = p1[1] - p2[1], dist2 = dx * dx + dy * dy;
            if (dist2 < minSep2) continue;

            // crescimento de AREA da cor MAIOR (encaixe): manter DENTRO do vermelho
            var rg = 0;
            if (preferir) {
                var red = cutExtArea(preferir, p1, p2, markHalf);
                rg = red[1] - redAr0; if (rg < 0) rg = 0;
            }
            // crescimento do PROPRIO: extensao (dim. max) e area
            var own = cutExtArea(vb, p1, p2, markHalf);
            var ge = own[0] - ownMd0; if (ge < 0) ge = 0;
            var ga = own[1] - ownAr0; if (ga < 0) ga = 0;

            if (paresMelhor(rg, ge, ga, dist2, bRg, bGe, bGa, bD2)) {
                bRg = rg; bGe = ge; bGa = ga; bD2 = dist2; melhor = [p1, p2];
            }
        }
    }
    return melhor;
}

// --- Fase 3a: PREFERE 2 marcas DENTRO do bounds (cut nao cresce); senao FORA,
//     preferindo lados opostos e o mais afastadas. Desenha e retorna. ---
function criarParRegistro(doc, vb, vbEnv, arteOwn, vizinhos, preferir, arteEncaixe, cor, nomeCor, registrosLayer, markHalf, stroke, comTexto) {
    var pMais = null, pX = null, i;

    // arte a respeitar 4mm: a propria + (no encaixe) a arte detalhada da cor MAIOR
    var arteResp = arteOwn;
    if (arteEncaixe && arteEncaixe.length) {
        arteResp = [];
        for (i = 0; i < arteOwn.length; i++) arteResp.push(arteOwn[i]);
        for (i = 0; i < arteEncaixe.length; i++) arteResp.push(arteEncaixe[i]);
    }

    // area de busca SEMPRE LOCAL (bounds da arte do proprio grupo) p/ as marcas
    // ficarem PERTO do grupo (nao espalhar pelo rotulo inteiro quando a cor maior
    // do encaixe e enorme). O "nao cair em cima do maior / nao crescer a peca" e
    // garantido pela arte detalhada do maior em arteResp (4mm) + o FORA empurrando
    // pro canal vazio mais proximo.
    var areaBusca = vbEnv;

    // junta candidatos DENTRO (nao crescem o cut) + FORA (empurrados ate livre) e
    // escolhe o par que deixa o cut com a MENOR area possivel.
    var pool = candidatosDentro(areaBusca, arteResp, vizinhos, markHalf);
    var fora = gerarCandidatosMarca(vb, arteResp, vizinhos, markHalf);
    for (i = 0; i < fora.length; i++) pool.push(fora[i].p);

    // escolhe o par que menos aumenta a area DOS DOIS (proprio cut + cor maior do
    // encaixe). Prefere ficar DENTRO do maior, mas pode sair um pouco se for o
    // minimo (ex.: 4mm na lateral cresce menos que jogar pra cima).
    var par = escolherPar(pool, vb, markHalf, preferir);
    if (par) { pMais = par[0]; pX = par[1]; }

    // recurso (nada escolhido): marcas no EIXO CURTO do grupo (cresce menos)
    if (!pMais) {
        var raio = markHalf + mmToPt(3);
        if ((vb[1] - vb[3]) >= (vb[2] - vb[0])) { // grupo mais alto -> laterais
            pMais = acharPosMarca(vb, arteResp, raio, markHalf, "esq");
            pX = acharPosMarca(vb, arteResp, raio, markHalf, "dir");
        } else { // mais largo -> topo/base
            pMais = acharPosMarca(vb, arteResp, raio, markHalf, "topo");
            pX = acharPosMarca(vb, arteResp, raio, markHalf, "base");
        }
    }

    // LABEL: refB = area do CUT (arte ∪ marcas + margens) -> cabe na faixa da margem,
    // nunca cresce o cut.
    var marksB = [
        Math.min(pMais[0], pX[0]) - markHalf, Math.max(pMais[1], pX[1]) + markHalf,
        Math.max(pMais[0], pX[0]) + markHalf, Math.min(pMais[1], pX[1]) - markHalf
    ];
    var refB = expandirCut(unirBounds(vb, marksB));

    var bounds = desenharPar(registrosLayer, pMais, pX, cor, nomeCor, markHalf, stroke, comTexto, refB, arteOwn);
    return { pMais: pMais, pX: pX, bounds: bounds };
}

// folga (distancia) entre dois bounds [left,top,right,bottom]; 0 se sobrepoem.
function distanciaBounds(a, b) {
    var dx = 0, dy = 0;
    if (a[2] < b[0]) dx = b[0] - a[2];
    else if (b[2] < a[0]) dx = a[0] - b[2];
    if (a[3] > b[1]) dy = a[3] - b[1];
    else if (b[3] > a[1]) dy = b[3] - a[1];
    return Math.sqrt(dx * dx + dy * dy);
}

// menor distancia entre a ARTE real (detalhada) de dois grupos. Usa os bounds dos
// objetos (nao o bounding box do grupo) -> evita "encaixe falso" entre grupos cujos
// bounding boxes se aproximam mas o desenho real esta longe.
function distanciaArte(arteA, arteB) {
    var menor = mmToPt(999999);
    if (!arteA || !arteB) return menor;
    for (var i = 0; i < arteA.length; i++) {
        for (var j = 0; j < arteB.length; j++) {
            var d = distanciaBounds(arteA[i], arteB[j]);
            if (d < menor) menor = d;
            if (menor <= 0) return 0;
        }
    }
    return menor;
}

// uniao de dois bounds (trata null)
function unirBounds(a, b) {
    if (!a) return b;
    if (!b) return a;
    return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])];
}

// folga (distancia) de um lado do vb ate o vizinho mais proximo daquele lado
// (que se sobrepoe no eixo perpendicular). Grande se nao houver vizinho.
function clearanceLado(vb, vizinhos, lado) {
    var menor = mmToPt(99999);
    if (!vizinhos) return menor;
    for (var i = 0; i < vizinhos.length; i++) {
        var v = vizinhos[i]; // [left, top, right, bottom]
        if (lado === "topo") {
            if (v[3] >= vb[1] && v[0] < vb[2] && v[2] > vb[0]) menor = Math.min(menor, v[3] - vb[1]);
        } else if (lado === "base") {
            if (v[1] <= vb[3] && v[0] < vb[2] && v[2] > vb[0]) menor = Math.min(menor, vb[3] - v[1]);
        } else if (lado === "esq") {
            if (v[2] <= vb[0] && v[3] < vb[1] && v[1] > vb[3]) menor = Math.min(menor, vb[0] - v[2]);
        } else { // dir
            if (v[0] >= vb[2] && v[3] < vb[1] && v[1] > vb[3]) menor = Math.min(menor, v[0] - vb[2]);
        }
    }
    return menor;
}

function normalizarNomeCor(nome) {
    return String(nome).toLowerCase()
        .replace(/process /g, '')
        .replace(/pantone /g, '')
        .replace(/ c/g, '');
}

// Base da cor para COMPARAR duas cores (encaixe): tira o sufixo numerico
// (preto1/preto2/preto3 -> "preto"), mas se sobrar vazio mantem o nome inteiro,
// para nao fundir cores cujo nome ja e so numero (ex.: Pantone 485 vs 486).
function baseCor(nome) {
    var n = normalizarNomeCor(nome);
    var semNum = n.replace(/[0-9]+$/, '');
    return semNum.length > 0 ? semNum : n;
}

/* ===================================================================
 * Orquestracao: registros + label na layer "arte" do doc ativo.
 * IGUAL ao criarRiscosArte (PASSO 1-4); SEM o cut (PASSO 5) e SEM separacoes.
 * =================================================================== */
function criarRegistrosLabel(doc) {
    // Imagem nao gera registro: avisa (sem bloquear) que cada cor da imagem deve
    // virar um quadrado de cromia na "arte"/"medidas". A layer de imagens fica fora.
    if (docTemImagem(doc)) {
        alert("ATENCAO: IMAGEM NO ARQUIVO\n\nO PICS nao processa imagens (raster/colocadas) - elas serao IGNORADAS.\n\nRepresente cada cor da imagem por um QUADRADO de cromia pura\n(ex.: preto = 0,0,0,100) agrupado na layer 'arte' ou 'medidas'.");
    }

    var arte = null;
    try { arte = doc.layers.getByName("arte"); } catch (e) { arte = null; }
    if (!arte) {
        arte = escolherLayerArteDialog(doc);
        if (!arte) return -1; // operador cancelou
    }

    // arte + medidas alimentam os registros (medidas = quadrados das cores da imagem)
    var fontesRisco = getLayersFonteRisco(doc, arte);

    // margem PADRAO de 6mm (sem dialogo): faixa ao redor da arte onde o label PODE
    // ficar (refB = arte ∪ marcas + 6mm). A logica tenta SEMPRE por o label dentro
    // do bounds, perto do "+"; essa folga so e usada quando ele nao cabe colado.
    margensCut = [mmToPt(4), mmToPt(4), mmToPt(4), mmToPt(4)];

    var registrosLayer;
    try { registrosLayer = doc.layers.getByName("registros"); }
    catch (e) { registrosLayer = doc.layers.add(); registrosLayer.name = "registros"; }
    try { registrosLayer.locked = false; registrosLayer.visible = true; } catch (e) {}
    // LIMPA antes de gerar -> evita DUPLICIDADE ao rodar de novo (ou apos o Risco_Faca)
    var _liLimpa;
    for (_liLimpa = registrosLayer.pageItems.length - 1; _liLimpa >= 0; _liLimpa--) {
        try { registrosLayer.pageItems[_liLimpa].remove(); } catch (e) {}
    }

    var markHalf = mmToPt(5) / 2;
    var strokeReg = mmToPt(0.3);
    var gap15 = mmToPt(15);

    // ===== PASSO 1: coleta os grupos da arte + medidas (cor, bounds, area) =====
    var grupos = [];
    for (var _lf = 0; _lf < fontesRisco.length; _lf++) {
        var _layerFonte = fontesRisco[_lf];
        for (var i = 0; i < _layerFonte.pageItems.length; i++) {
            var grupo = _layerFonte.pageItems[i];
            if (grupo.typename !== "GroupItem") continue;

            var nomeCor = corPredominanteDoGrupo(grupo);
            if (!nomeCor) continue;

            // spot existente OU cromia pura (CMYK puro) -> cor do registro
            var corObj = corDoGrupo(doc, nomeCor);
            if (!corObj) continue;

            var vb = getVisibleBoundsDeep(grupo); // bounds VISIVEL (clipa o que passa da mascara)
            if (!vb) continue;

            var ba = [];
            coletarBoundsArte(grupo, ba);

            grupos.push({
                nomeCor: nomeCor,
                cor: corObj,
                vb: vb,
                boundsArte: ba,
                area: (vb[2] - vb[0]) * (vb[1] - vb[3]),
                par: null,
                marcasB: null,
                maioresIdx: null,
                pulaPar: false
            });
        }
    }

    // ===== PASSO 2: encaixes (cores DIFERENTES com folga <= 15mm) =====
    var pares = [];
    for (var a = 0; a < grupos.length; a++) {
        for (var b = a + 1; b < grupos.length; b++) {
            if (baseCor(grupos[a].nomeCor) === baseCor(grupos[b].nomeCor)) continue;
            if (distanciaArte(grupos[a].boundsArte, grupos[b].boundsArte) <= gap15) {
                pares.push([a, b]);
                var menIdx = (grupos[a].area <= grupos[b].area) ? a : b;
                var maiIdx = (grupos[a].area <= grupos[b].area) ? b : a;
                if (!grupos[menIdx].maioresIdx) grupos[menIdx].maioresIdx = [];
                grupos[menIdx].maioresIdx.push(maiIdx);
                if (grupos[menIdx].area / grupos[maiIdx].area >= 0.8) {
                    grupos[maiIdx].pulaPar = true;
                }
            }
        }
    }

    // ===== PASSO 3: par PROPRIO de cada grupo, evitando vizinhos =====
    for (var k = 0; k < grupos.length; k++) {
        var gr = grupos[k];
        if (gr.pulaPar) continue;
        var maiores = gr.maioresIdx || [];
        var vizinhos = [];
        var preferir = null;
        var arteEncaixe = [];
        for (var o = 0; o < grupos.length; o++) {
            if (o === k) continue;
            var ehMaior = false;
            for (var m = 0; m < maiores.length; m++) { if (maiores[m] === o) { ehMaior = true; break; } }
            if (ehMaior) {
                preferir = unirBounds(preferir, grupos[o].vb);
                for (var bi = 0; bi < grupos[o].boundsArte.length; bi++) arteEncaixe.push(grupos[o].boundsArte[bi]);
            } else {
                vizinhos.push(grupos[o].vb);
            }
        }

        gr.par = criarParRegistro(doc, gr.vb, gr.vb, gr.boundsArte, vizinhos, preferir, arteEncaixe, gr.cor, gr.nomeCor, registrosLayer, markHalf, strokeReg, true);
        gr.marcasB = gr.par ? gr.par.bounds : null;
    }

    // ===== PASSO 4: encaixe -> replica o par do MENOR na cor do MAIOR =====
    for (var p = 0; p < pares.length; p++) {
        var gA = grupos[pares[p][0]];
        var gB = grupos[pares[p][1]];
        var menor = (gA.area <= gB.area) ? gA : gB;
        var maior = (gA.area <= gB.area) ? gB : gA;
        if (!menor.par) continue;
        if (distanciaBounds(menor.par.bounds, maior.vb) > gap15) continue;

        var comTextoMaior = maior.pulaPar;
        var refBMaior = null, arteMaior = null;
        if (comTextoMaior) {
            var marksBR = [
                Math.min(menor.par.pMais[0], menor.par.pX[0]) - markHalf, Math.max(menor.par.pMais[1], menor.par.pX[1]) + markHalf,
                Math.max(menor.par.pMais[0], menor.par.pX[0]) + markHalf, Math.min(menor.par.pMais[1], menor.par.pX[1]) - markHalf
            ];
            refBMaior = expandirCut(unirBounds(maior.vb, marksBR));
            arteMaior = maior.boundsArte;
        }
        var bComp = desenharPar(registrosLayer, menor.par.pMais, menor.par.pX, maior.cor, maior.nomeCor, markHalf, strokeReg, comTextoMaior, refBMaior, arteMaior);
        if (bComp) maior.marcasB = unirBounds(maior.marcasB, bComp);
    }

    return grupos.length;
}

/* ===================================================================
 * Execucao
 * =================================================================== */
(function () {
    if (app.documents.length === 0) {
        alert("Nenhum documento aberto.");
        return;
    }
    if (!serviceOrderNumber || serviceOrderNumber === "") {
        alert("Número de O.S. inválido.");
        return;
    }

    var doc = app.activeDocument;
    var n = criarRegistrosLabel(doc);

    if (n === -1) return; // cancelou um dos dialogos
    if (n === 0) {
        alert("Nenhum grupo-mãe com cor (spot ou cromia pura) encontrado nas layers 'arte'/'medidas'.");
    } else {
        alert(n + " grupo(s) processado(s).\nRegistros (+/×) + label criados na layer 'registros'.");
    }
})();

// ============================================================
// RemapCores.jsx
// Standalone (pasta Ondulado/, ao lado do PICS.jsx). NAO precisa de O.S. e
// NAO entra no menu Scripts.jsx.
//
// O que faz: para CADA GRUPO que o operador SELECIONAR, descobre a cor
// predominante (mesma logica do 14_Risco_Faca/PICS) e cria uma SPOT nova
// chamada <nomeDaCor><numero> (preto1, preto2..., Magenta1, Magenta2...),
// remapeando dentro do grupo SOMENTE os objetos pintados com a cor
// predominante para essa spot nova. A spot nova nasce com a MESMA cor da
// original (vira separacao propria, mas visualmente identico).
//
// Numeracao CONTINUA: varre as spots ja existentes que batem com
// ^<cor>[0-9]+$ e comeca no maior + 1. Ex.: se ja existe ate preto5, a
// proxima vira preto6. NAO substitui e NAO da merge (cada grupo = 1 spot nova).
// ============================================================

/* ===================================================================
 * Funcoes COPIA VERBATIM do 14_Risco_Faca.jsx / PICS.jsx (cor predominante)
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

// --- cor predominante (spot) de um grupo: a mais frequente em fill+stroke ---
function corPredominanteDoGrupo(grupo) {
    var contagem = {};

    function conta(cor) {
        if (!cor) return;
        if (cor.typename === "SpotColor" && cor.spot) {
            var nm = cor.spot.name;
            if (corEhBrancoNome(nm)) return;
            if (spotEhBranco(cor.spot)) return;
            contagem[nm] = (contagem[nm] || 0) + 1;
        }
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

    var melhor = null, maxC = 0;
    for (var nome in contagem) {
        if (contagem.hasOwnProperty(nome) && contagem[nome] > maxC) {
            maxC = contagem[nome];
            melhor = nome;
        }
    }
    return melhor;
}

/* ===================================================================
 * Helpers do remap
 * =================================================================== */

function escapeRegExp(s) {
    return String(s).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function getSpotByName(doc, nome) {
    for (var i = 0; i < doc.spots.length; i++) {
        if (doc.spots[i].name === nome) return doc.spots[i];
    }
    return null;
}

// Proximo numero livre para a base (ex.: "preto"). Comeca no maior
// ^base[0-9]+$ existente + 1; mantem um contador em memoria para nao
// repetir dentro da mesma rodada (varios grupos da mesma cor).
var contadoresBase = {};
function proximoNumero(doc, base) {
    if (contadoresBase[base] === undefined) {
        var max = 0;
        var re = new RegExp("^" + escapeRegExp(base) + "([0-9]+)$");
        for (var s = 0; s < doc.spots.length; s++) {
            var m = doc.spots[s].name.match(re);
            if (m) {
                var num = parseInt(m[1], 10);
                if (!isNaN(num) && num > max) max = num;
            }
        }
        contadoresBase[base] = max;
    }
    contadoresBase[base] += 1;
    return contadoresBase[base];
}

// Cria uma spot nova clonando a cor (alternate) da spot original.
function criarSpotClonando(doc, nome, spotOriginal) {
    var existente = getSpotByName(doc, nome);
    if (existente) return existente; // a numeracao evita colisao; reusa por seguranca

    var novo = doc.spots.add();
    novo.name = nome;
    try { novo.colorType = spotOriginal.colorType; } catch (e) {
        try { novo.colorType = ColorModel.SPOT; } catch (e2) {}
    }
    try { novo.color = spotOriginal.color; } catch (e3) {}
    return novo;
}

// Remapeia, dentro do item (recursivo), SOMENTE os fills/strokes que usam a
// spot predominante -> nova spot, preservando o tint (porcentagem) original.
function remapItem(item, nomePredom, novoSpot) {

    function ehPredom(cor) {
        return (cor && cor.typename === "SpotColor" && cor.spot &&
                cor.spot.name === nomePredom);
    }

    function novaCor(antiga) {
        var c = new SpotColor();
        c.spot = novoSpot;
        try { c.tint = antiga.tint; } catch (e) { c.tint = 100; }
        return c;
    }

    // fill/stroke diretos (PathItem, CompoundPathItem)
    try { if (item.filled && ehPredom(item.fillColor)) item.fillColor = novaCor(item.fillColor); } catch (e1) {}
    try { if (item.stroked && ehPredom(item.strokeColor)) item.strokeColor = novaCor(item.strokeColor); } catch (e2) {}

    if (item.typename === "GroupItem") {
        for (var i = 0; i < item.pageItems.length; i++) remapItem(item.pageItems[i], nomePredom, novoSpot);
    } else if (item.typename === "CompoundPathItem") {
        for (var j = 0; j < item.pathItems.length; j++) remapItem(item.pathItems[j], nomePredom, novoSpot);
    } else if (item.typename === "TextFrame") {
        try {
            var ca = item.textRange.characterAttributes;
            if (ehPredom(ca.fillColor)) ca.fillColor = novaCor(ca.fillColor);
            if (ehPredom(ca.strokeColor)) ca.strokeColor = novaCor(ca.strokeColor);
        } catch (e3) {}
    }
}

/* ===================================================================
 * Execucao
 * =================================================================== */

function main() {

    if (app.documents.length === 0) {
        alert("Nenhum documento aberto.");
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;

    if (!sel || sel.length === 0) {
        alert("Selecione os GRUPOS que deseja remapear e rode novamente.");
        return;
    }

    var processados = 0;
    var ignoradosNaoGrupo = 0;
    var ignoradosSemCor = 0;
    var resumo = [];

    for (var i = 0; i < sel.length; i++) {

        var it = sel[i];

        if (!it || it.typename !== "GroupItem") {
            ignoradosNaoGrupo++;
            continue;
        }

        var nomePredom = corPredominanteDoGrupo(it);
        if (!nomePredom) {
            ignoradosSemCor++;
            continue;
        }

        var spotOrig = getSpotByName(doc, nomePredom);
        if (!spotOrig) {
            ignoradosSemCor++;
            continue;
        }

        var n = proximoNumero(doc, nomePredom);
        var novoNome = nomePredom + n;

        var novoSpot = criarSpotClonando(doc, novoNome, spotOrig);
        remapItem(it, nomePredom, novoSpot);

        processados++;
        resumo.push(novoNome);
    }

    var msg = "REMAP CONCLUIDO\n\nGrupos remapeados: " + processados;
    if (resumo.length > 0) {
        msg += "\nNovas cores: " + resumo.join(", ");
    }
    if (ignoradosNaoGrupo > 0) {
        msg += "\n\nIgnorados (nao eram grupo): " + ignoradosNaoGrupo;
    }
    if (ignoradosSemCor > 0) {
        msg += "\nGrupos sem cor predominante: " + ignoradosSemCor;
    }

    alert(msg);
}

main();

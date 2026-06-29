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

// --- canal de cromia de UM CMYKColor: o nome do unico canal != 0 (qualquer %);
// "" se for tudo 0 (branco, compativel com qualquer canal); null se nao for CMYK
// ou se misturar 2+ canais. Usado para validar os stops de um gradiente. ---
function canalCromiaCMYK(cor) {
    if (!cor || cor.typename !== "CMYKColor") return null;
    var nome = "", n = 0;
    if (cor.cyan    > 0.5) { nome = "cyan";    n++; }
    if (cor.magenta > 0.5) { nome = "magenta"; n++; }
    if (cor.yellow  > 0.5) { nome = "yellow";  n++; }
    if (cor.black   > 0.5) { nome = "black";   n++; }
    if (n === 0) return "";   // branco -> compativel com qualquer canal
    if (n === 1) return nome; // 1 canal so -> cromia pura desse canal
    return null;              // mistura
}

// --- canal de cromia de um GRADIENTE: black/cyan/magenta/yellow se TODOS os stops
// forem do MESMO canal (qualquer %; stops brancos contam como compativeis).
// null se misturar canais, tiver stop nao-CMYK, ou nao for gradiente. ---
function cromiaDeGradiente(cor) {
    if (!cor || cor.typename !== "GradientColor") return null;
    var stops;
    try { stops = cor.gradient.gradientStops; } catch (e) { return null; }
    if (!stops || stops.length === 0) return null;
    var nome = "";
    for (var i = 0; i < stops.length; i++) {
        var canal = canalCromiaCMYK(stops[i].color);
        if (canal === null) return null;   // stop misturado/nao-CMYK -> nao remapeia
        if (canal === "") continue;        // branco -> compativel
        if (nome === "") nome = canal;
        else if (nome !== canal) return null; // dois canais -> nao e cromia pura
    }
    return (nome === "") ? null : nome;     // gradiente todo branco -> ignora
}

// --- nome da SPOT de um gradiente de spot UNICA: todos os stops na mesma spot
// (qualquer tint; stops brancos 0,0,0,0 compativeis). null se misturar cores,
// nao for spot, ou nao for gradiente. ---
function spotDeGradiente(cor) {
    if (!cor || cor.typename !== "GradientColor") return null;
    var stops;
    try { stops = cor.gradient.gradientStops; } catch (e) { return null; }
    if (!stops || stops.length === 0) return null;
    var nome = null;
    for (var i = 0; i < stops.length; i++) {
        var sc = stops[i].color;
        if (sc && sc.typename === "SpotColor" && sc.spot) {
            if (nome === null) nome = sc.spot.name;
            else if (nome !== sc.spot.name) return null; // duas spots -> nao
        } else if (canalCromiaCMYK(sc) === "") {
            continue; // stop branco CMYK -> compativel
        } else {
            return null; // stop de outra cor -> nao
        }
    }
    return nome;
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
// houver spot, cai para a cromia pura mais frequente. Spot sempre tem prioridade. ---
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
        // gradiente de SPOT unica -> conta como aquela spot (prioridade de spot)
        var spg = spotDeGradiente(cor);
        if (spg) {
            if (!corEhBrancoNome(spg)) contagemSpot[spg] = (contagemSpot[spg] || 0) + 1;
            return;
        }
        var crom = corCromiaPura(cor) || cromiaDeGradiente(cor);
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

// Cria uma spot nova com a cor da cromia pura (sem spot original p/ clonar).
function criarSpotCromia(doc, nome, cromiaNome) {
    var existente = getSpotByName(doc, nome);
    if (existente) return existente;

    var novo = doc.spots.add();
    novo.name = nome;
    try { novo.colorType = ColorModel.SPOT; } catch (e) {}
    try { novo.color = cmykDaCromia(cromiaNome); } catch (e3) {}
    return novo;
}

// Remapeia, dentro do item (recursivo), SOMENTE os fills/strokes aceitos pelo
// predicado ehPredom -> nova spot, preservando o tint (porcentagem) original.
function remapItem(item, ehPredom, novoSpot, cromiaAlvo, spotAlvo) {

    function novaCor(antiga) {
        var c = new SpotColor();
        c.spot = novoSpot;
        // tint SEMPRE numerico valido. Cromia (CMYKColor) nao tem .tint -> vem
        // undefined; setar undefined deixa a spot invalida e o fillColor estoura
        // depois (silenciado pelo try de fora) -> objeto NAO era repintado. Por
        // isso so reaproveita o tint quando ele e mesmo um numero; senao 100.
        var t = 100;
        try {
            if (antiga && typeof antiga.tint === "number" && !isNaN(antiga.tint)) t = antiga.tint;
        } catch (e) {}
        c.tint = t;
        return c;
    }

    // tint de um stop p/ a spot nova, conforme o modo ("cromia" = % do canal CMYK
    // do stop; "spot" = tint do stop). Branco/0,0,0,0 -> 0.
    function tintDoStop(sc, modo) {
        var val = 0;
        if (modo === "cromia") {
            if (sc && sc.typename === "CMYKColor") {
                if (cromiaAlvo === "cyan") val = sc.cyan;
                else if (cromiaAlvo === "magenta") val = sc.magenta;
                else if (cromiaAlvo === "yellow") val = sc.yellow;
                else if (cromiaAlvo === "black") val = sc.black;
            }
        } else {
            if (sc && sc.typename === "SpotColor") {
                try { val = (typeof sc.tint === "number" && !isNaN(sc.tint)) ? sc.tint : 100; } catch (e) { val = 100; }
            }
        }
        return val;
    }

    // GRADIENTE -> cria um gradiente PROPRIO (nao compartilhado) com os stops na
    // spot nova, preservando a rampa E a geometria do objeto. Criar gradiente
    // proprio e ESSENCIAL: dois grupos com o MESMO degrade (swatch compartilhado)
    // iam parar na mesma spot porque alterar os stops mexia no swatch dos dois.
    // Agora cada um vira sua spot (preto1, preto2...). Retorna a GradientColor
    // nova (pronta p/ atribuir) ou null se nao for caso de remap.
    function gradienteRemap(cor) {
        if (!cor || cor.typename !== "GradientColor") return null;
        var modo = null;
        if (cromiaAlvo && cromiaDeGradiente(cor) === cromiaAlvo) modo = "cromia";
        else if (spotAlvo && spotDeGradiente(cor) === spotAlvo) modo = "spot";
        if (!modo) return null;

        var velho = cor.gradient;
        var stopsV = velho.gradientStops;
        var ng = app.activeDocument.gradients.add();
        try { ng.type = velho.type; } catch (e) {}
        // gradiente novo nasce com 2 stops; iguala a quantidade do original
        while (ng.gradientStops.length < stopsV.length) {
            try { ng.gradientStops.add(); } catch (eAdd) { break; }
        }
        var nstops = ng.gradientStops;
        for (var s = 0; s < stopsV.length && s < nstops.length; s++) {
            try { nstops[s].rampPoint = stopsV[s].rampPoint; } catch (e1) {}
            try { nstops[s].midPoint = stopsV[s].midPoint; } catch (e2) {}
            var nc = new SpotColor();
            nc.spot = novoSpot;
            nc.tint = tintDoStop(stopsV[s].color, modo);
            nstops[s].color = nc;
        }
        cor.gradient = ng; // troca SO a definicao; a geometria do objeto e preservada
        return cor;
    }

    // fill/stroke diretos (PathItem, CompoundPathItem)
    try {
        if (item.filled) {
            var _gf = gradienteRemap(item.fillColor);
            if (_gf) item.fillColor = _gf;
            else if (ehPredom(item.fillColor)) item.fillColor = novaCor(item.fillColor);
        }
    } catch (e1) {}
    try {
        if (item.stroked) {
            var _gs = gradienteRemap(item.strokeColor);
            if (_gs) item.strokeColor = _gs;
            else if (ehPredom(item.strokeColor)) item.strokeColor = novaCor(item.strokeColor);
        }
    } catch (e2) {}

    if (item.typename === "GroupItem") {
        for (var i = 0; i < item.pageItems.length; i++) remapItem(item.pageItems[i], ehPredom, novoSpot, cromiaAlvo, spotAlvo);
    } else if (item.typename === "CompoundPathItem") {
        for (var j = 0; j < item.pathItems.length; j++) remapItem(item.pathItems[j], ehPredom, novoSpot, cromiaAlvo, spotAlvo);
    } else if (item.typename === "TextFrame") {
        try {
            var ca = item.textRange.characterAttributes;
            var _gtf = gradienteRemap(ca.fillColor);
            if (_gtf) ca.fillColor = _gtf;
            else if (ehPredom(ca.fillColor)) ca.fillColor = novaCor(ca.fillColor);
            var _gts = gradienteRemap(ca.strokeColor);
            if (_gts) ca.strokeColor = _gts;
            else if (ehPredom(ca.strokeColor)) ca.strokeColor = novaCor(ca.strokeColor);
        } catch (e3) {}
    }
}

/* ===================================================================
 * Execucao
 * =================================================================== */

function docTemImagem(doc) {
    try { if (doc.rasterItems && doc.rasterItems.length > 0) return true; } catch (e) {}
    try { if (doc.placedItems && doc.placedItems.length > 0) return true; } catch (e2) {}
    return false;
}

function main() {

    if (app.documents.length === 0) {
        alert("Nenhum documento aberto.");
        return;
    }

    var doc = app.activeDocument;

    if (docTemImagem(doc)) {
        alert("REMAP BLOQUEADO\n\nO arquivo contem imagem (incorporada ou colocada).\n\nO remap troca a cor de vetores, nao dos pixels de uma imagem.\nTrate a imagem e represente cada cor por um QUADRADO de cromia pura\n(ex.: preto = 0,0,0,100), depois rode o remap novamente.");
        return;
    }

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
        var ehCromia = (!spotOrig) && ehNomeCromia(nomePredom);

        if (!spotOrig && !ehCromia) {
            ignoradosSemCor++;
            continue;
        }

        var n = proximoNumero(doc, nomePredom);
        var novoNome = nomePredom + n;

        var novoSpot, ehPredom, cromiaAlvo = null, spotAlvo = null;

        if (spotOrig) {
            novoSpot = criarSpotClonando(doc, novoNome, spotOrig);
            ehPredom = (function (alvo) {
                return function (cor) {
                    return (cor && cor.typename === "SpotColor" && cor.spot &&
                            cor.spot.name === alvo);
                };
            })(nomePredom);
            spotAlvo = nomePredom; // habilita o remap de gradiente de spot
        } else {
            novoSpot = criarSpotCromia(doc, novoNome, nomePredom);
            ehPredom = (function (alvo) {
                return function (cor) {
                    return corCromiaPura(cor) === alvo;
                };
            })(nomePredom);
            cromiaAlvo = nomePredom; // habilita o remap de gradiente de cromia
        }

        remapItem(it, ehPredom, novoSpot, cromiaAlvo, spotAlvo);

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

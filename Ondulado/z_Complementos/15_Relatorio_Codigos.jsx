// ============================================================
// 15_Relatorio_Codigos.jsx
// LAUDO DE VERIFICACAO DE CODIGOS (codigo de barras + QR Code).
//
// O operador SELECIONA no documento os codigos que quer conferir e roda esta
// operacao pelo painel CEP. Este script:
//   1. captura cada item selecionado em PNG de alta resolucao (Folder.temp);
//   2. le os dados do job no XML da O.S. (cliente, produto, arte, operador);
//   3. grava um manifest.json e devolve o caminho dele para o PAINEL.
// Quem DECODIFICA (ZXing/jsQR) e MONTA o PDF e o painel (js/codigos.js) -- o
// ExtendScript nao tem como ler barras/modulos. O PDF final e gravado em
//   \\aeserver16\Engine\_Jobfolder\<O.S.>\_pdf\   (irma da pasta reference)
//
// Contrato com o painel: a ultima msg deste script e "__CODIGOS__<manifest>".
// O main.js reconhece o prefixo e dispara a decodificacao + geracao do PDF.
// SO roda pelo painel (sem painel nao ha decodificador).
// ============================================================

// O.S.: pelo painel ja vem em $.global.serviceOrderNumber (input do painel).
// NAO declarar "var serviceOrderNumber" aqui: o hoisting do var criaria um local
// undefined que SOMBREIA a global setada pelo painel -> o typeof daria "undefined"
// e pediria a O.S. DE NOVO num prompt (bug). Sem var, "serviceOrderNumber" le a global.
if (typeof serviceOrderNumber === "undefined" || !serviceOrderNumber) {
    if (typeof $.global !== "undefined" && $.global.serviceOrderNumber) {
        serviceOrderNumber = String($.global.serviceOrderNumber);
    } else {
        serviceOrderNumber = prompt("Digite o número da Ordem de Serviço (7 dígitos):", "");
    }
}

#include "Xml_upload.jsx"

// ---------------- utilitarios ----------------

function mmToPt(mm) { return mm * 2.834645; }
function ptToMM(pt) { return pt / 2.834645; }

function adicionarZero(n) { return (n < 10 ? "0" : "") + n; }

function carimboData() {
    var d = new Date();
    return adicionarZero(d.getDate()) + "/" + adicionarZero(d.getMonth() + 1) + "/" + d.getFullYear() +
           " " + adicionarZero(d.getHours()) + ":" + adicionarZero(d.getMinutes());
}

function carimboArquivo() {
    var d = new Date();
    return String(d.getFullYear()) + adicionarZero(d.getMonth() + 1) + adicionarZero(d.getDate()) +
           "-" + adicionarZero(d.getHours()) + adicionarZero(d.getMinutes());
}

// valor de global opcional (o XML pode nao ter o campo)
function opc(nome, padrao) {
    try {
        if (typeof $.global[nome] !== "undefined" && $.global[nome] !== null && String($.global[nome]) !== "") {
            return String($.global[nome]);
        }
    } catch (e) {}
    try {
        var v = eval(nome);
        if (typeof v !== "undefined" && v !== null && String(v) !== "") return String(v);
    } catch (e2) {}
    return padrao || "";
}

function jsonStr(s) {
    var t = String(s === undefined || s === null ? "" : s);
    t = t.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    t = t.replace(/[\r\n\t]/g, " ");
    return '"' + t + '"';
}

// pasta _pdf do job no Engine (mesmo nivel da pasta reference). Cria se faltar.
function pastaPdfDoJob(os) {
    var bases = [alphaBaseEngine() + "/_Jobfolder/"];
    var i;
    for (i = 0; i < bases.length; i++) {
        var job = new Folder(bases[i] + os);
        if (!job.exists) continue;
        var pdf = new Folder(bases[i] + os + "/_pdf");
        if (!pdf.exists) { try { pdf.create(); } catch (e) {} }
        if (pdf.exists) return pdf;
    }
    return null;
}

// pasta temporaria de trabalho (PNGs + manifest), limpa a cada execucao
function pastaTrabalho(os) {
    var raiz = new Folder(Folder.temp.fsName.replace(/\\/g, "/") + "/alpha_codigos");
    if (!raiz.exists) raiz.create();
    var f = new Folder(raiz.fsName.replace(/\\/g, "/") + "/" + os);
    if (f.exists) {
        var antigos = f.getFiles();
        for (var i = 0; i < antigos.length; i++) { try { antigos[i].remove(); } catch (e) {} }
    } else {
        f.create();
    }
    return f;
}

// bounds visiveis do item, com folga (zona de silencio) em mm
function boundsComFolga(item, folgaMM) {
    var gb;
    try { gb = item.visibleBounds; } catch (e) { gb = item.geometricBounds; }
    var m = mmToPt(folgaMM);
    return [gb[0] - m, gb[1] + m, gb[2] + m, gb[3] - m]; // [left, top, right, bottom]
}

// captura o recorte em PNG. Resolucao alta o bastante pra barra fina virar
// varios pixels (o decodificador precisa disso), com teto de pixels.
function capturarRecorte(doc, clip, arquivo) {
    var wPt = clip[2] - clip[0];
    var hPt = clip[1] - clip[3];
    if (wPt <= 0 || hPt <= 0) return 0;

    var dpi = Math.round(1800 / (wPt / 72));   // alvo ~1800 px de largura
    if (dpi < 200) dpi = 200;
    if (dpi > 1200) dpi = 1200;
    while (((wPt / 72) * dpi) * ((hPt / 72) * dpi) > 14000000 && dpi > 150) dpi -= 50;

    var opts = new ImageCaptureOptions();
    opts.resolution = dpi;
    opts.antiAliasing = true;
    opts.transparency = false;   // fundo branco (a leitura precisa de fundo claro)
    try { opts.matte = true; } catch (eM) {}

    doc.imageCapture(arquivo, clip, opts);
    return dpi;
}

// nome amigavel do item (usa o nome dado na camada, se houver)
function nomeDoItem(item, indice) {
    var n = "";
    try { n = String(item.name || ""); } catch (e) {}
    n = n.replace(/^\s+|\s+$/g, "");
    if (n === "" || /^<.*>$/.test(n)) n = "Código " + indice;
    return n;
}

// ordem de leitura: de cima pra baixo, da esquerda pra direita
function ordenarPorPosicao(itens) {
    var i, j, tmp;
    for (i = 0; i < itens.length - 1; i++) {
        for (j = 0; j < itens.length - 1 - i; j++) {
            var a = itens[j], b = itens[j + 1];
            var ay, by, ax, bx;
            try { ay = a.visibleBounds[1]; ax = a.visibleBounds[0]; } catch (e1) { ay = 0; ax = 0; }
            try { by = b.visibleBounds[1]; bx = b.visibleBounds[0]; } catch (e2) { by = 0; bx = 0; }
            var trocar = (Math.abs(ay - by) > mmToPt(5)) ? (ay < by) : (ax > bx);
            if (trocar) { tmp = itens[j]; itens[j] = itens[j + 1]; itens[j + 1] = tmp; }
        }
    }
    return itens;
}

// ---------------- fluxo ----------------

function gerarPacoteCodigos() {
    // sem painel nao ha decodificador (a leitura roda no Node do CEP)
    if (typeof $.global.painelMsg !== "function") {
        alert("O Relatório de Códigos só funciona pelo painel Ondulado\n" +
              "(a leitura dos códigos roda no painel).");
        return;
    }

    if (app.documents.length === 0) { msgUsuario("Nenhum documento aberto.", "erro"); return; }
    var doc = app.activeDocument;

    var sel = doc.selection;
    if (!sel || sel.length === 0) {
        msgUsuario("Selecione no documento os códigos (barras e/ou QR) que entram no relatório.", "erro");
        return;
    }
    if (sel.length > 12) {
        msgUsuario("Selecione no máximo 12 códigos por relatório (selecionados: " + sel.length + ").", "erro");
        return;
    }

    var itens = [];
    var k;
    for (k = 0; k < sel.length; k++) itens.push(sel[k]);
    itens = ordenarPorPosicao(itens);

    var os = String(serviceOrderNumber);
    var trab = pastaTrabalho(os);

    // captura item a item (a selecao e perdida no imageCapture? nao -- mas
    // guardamos os itens antes por seguranca)
    var codigos = [];
    var i;
    for (i = 0; i < itens.length; i++) {
        var item = itens[i];
        var clip = boundsComFolga(item, 2.5);          // 2,5 mm de folga = zona de silencio
        var png = new File(trab.fsName.replace(/\\/g, "/") + "/codigo_" + (i + 1) + ".png");
        var dpi = 0;
        try {
            dpi = capturarRecorte(doc, clip, png);
        } catch (eCap) {
            msgUsuario("Falha ao capturar a imagem do código " + (i + 1) + ": " + eCap.toString(), "erro");
            return;
        }
        if (!png.exists) {
            msgUsuario("Não foi possível gerar a imagem do código " + (i + 1) + ".", "erro");
            return;
        }
        codigos.push({
            nome: nomeDoItem(item, i + 1),
            arquivo: png.fsName,
            dpi: dpi,
            larguraMM: Math.round(ptToMM(clip[2] - clip[0]) * 10) / 10,
            alturaMM: Math.round(ptToMM(clip[1] - clip[3]) * 10) / 10
        });
    }

    // pasta de destino do PDF (_pdf do job, irma da reference)
    var destino = pastaPdfDoJob(os);
    var destinoStr = destino ? destino.fsName : "";

    // ---- manifest pro painel ----
    var linhas = [];
    linhas.push("{");
    linhas.push('  "os": ' + jsonStr(os) + ",");
    linhas.push('  "cp": ' + jsonStr(opc("cp", "")) + ",");
    linhas.push('  "rev": ' + jsonStr(opc("rev", "")) + ",");
    linhas.push('  "v": ' + jsonStr(opc("v", "")) + ",");
    linhas.push('  "produtoComUnderline": ' + jsonStr(opc("produtoComUnderline", "")) + ",");
    linhas.push('  "cliente": ' + jsonStr(opc("cliente", "")) + ",");
    linhas.push('  "produto": ' + jsonStr(opc("produto", "")) + ",");
    linhas.push('  "nomeArte": ' + jsonStr(opc("nomeArte", "")) + ",");
    linhas.push('  "np": ' + jsonStr(opc("np", "")) + ",");
    linhas.push('  "operador": ' + jsonStr(opc("operadorNome", "")) + ",");
    linhas.push('  "documento": ' + jsonStr(doc.name) + ",");
    linhas.push('  "dataHora": ' + jsonStr(carimboData()) + ",");
    linhas.push('  "carimboArquivo": ' + jsonStr(carimboArquivo()) + ",");
    linhas.push('  "pastaPdf": ' + jsonStr(destinoStr) + ",");
    linhas.push('  "pastaTrabalho": ' + jsonStr(trab.fsName) + ",");
    linhas.push('  "codigos": [');
    for (i = 0; i < codigos.length; i++) {
        linhas.push("    {" +
            '"nome": ' + jsonStr(codigos[i].nome) + ", " +
            '"arquivo": ' + jsonStr(codigos[i].arquivo) + ", " +
            '"dpi": ' + codigos[i].dpi + ", " +
            '"larguraMM": ' + codigos[i].larguraMM + ", " +
            '"alturaMM": ' + codigos[i].alturaMM +
            "}" + (i < codigos.length - 1 ? "," : ""));
    }
    linhas.push("  ]");
    linhas.push("}");

    var manifest = new File(trab.fsName.replace(/\\/g, "/") + "/manifest.json");
    manifest.encoding = "UTF-8";
    manifest.open("w");
    manifest.write(linhas.join("\n"));
    manifest.close();

    // o painel le este prefixo, decodifica e gera o PDF
    msgUsuario("__CODIGOS__" + manifest.fsName, "info");
}

gerarPacoteCodigos();

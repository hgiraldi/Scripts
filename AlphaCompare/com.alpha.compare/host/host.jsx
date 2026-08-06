/* ============================================================
 * Alpha Compare - host (ExtendScript / Illustrator)
 * ES3 apenas: sem let/const/=>/forEach. Retornos sao STRINGS.
 * Convencao: "OK|<dado>"  ou  "ERRO|<mensagem>".
 * ============================================================ */

/* Caminho do Desktop do usuario (respeita redirecionamento do Windows). */
function acDesktopPath() {
    try {
        return "OK|" + Folder.desktop.fsName;
    } catch (e) {
        return "ERRO|" + e.toString();
    }
}

/* Info do documento aberto: nome|osProvavel|larguraMM|alturaMM (prancheta ativa). */
function acInfoDoc() {
    try {
        if (app.documents.length === 0) return "ERRO|Nenhum documento aberto";
        var doc = app.activeDocument;
        var nome = doc.name;
        // tenta achar 7 digitos seguidos no nome = O.S.
        var os = "";
        var m = nome.match(/(\d{7})/);
        if (m) os = m[1];
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
        var r = ab.artboardRect; // [left, top, right, bottom] em pt
        var wPt = r[2] - r[0];
        var hPt = r[1] - r[3];
        var wMM = Math.round(wPt / 72 * 25.4 * 10) / 10;
        var hMM = Math.round(hPt / 72 * 25.4 * 10) / 10;
        return "OK|" + nome + "|" + os + "|" + wMM + "|" + hMM;
    } catch (e) {
        return "ERRO|" + e.toString();
    }
}

/* Pasta do JOB (<Engine>/_Jobfolder/<os>) — p/ salvar o relatorio na _reference dele.
   OK|<pasta> ; NAO| (job nao existe) ; ERRO|<msg> (rede/excecao) */
function acPastaJob(os) {
    try {
        os = String(os).replace(/[^0-9]/g, "");
        if (os.length < 5) return "NAO|os_invalida";
        var engines = ["//aeserver16/Engine", "//192.168.1.96/Engine", "//172.16.11.96/Engine", "/Volumes/Engine"];   // Windows UNC + Mac (volume montado)
        var e;
        for (e = 0; e < engines.length; e++) {
            var f = new Folder(engines[e] + "/_Jobfolder/" + os);
            if (f.exists) return "OK|" + f.fsName;
        }
        return "NAO|nao_encontrada";
    } catch (er) { return "ERRO|" + er.toString(); }
}

/* Acha o PDF original do job no Engine a partir da O.S.
   Pasta: \\aeserver16\Engine\_Jobfolder\<OS>\original\ (irma de _xml/_log).
   Prefere o NORMAL (sem "Distorcido") mais NOVO; se so houver distorcido, usa ele.
   Retorna: OK|<caminho>|<nome>|<normal|distorcido>  ou  ERRO|<msg> */
function acBuscarOriginalDoJob(os) {
    try {
        os = String(os).replace(/[^0-9]/g, "");
        if (os.length < 5) return "ERRO|O.S. invalida";

        var engines = ["//aeserver16/Engine", "//192.168.1.96/Engine", "//172.16.11.96/Engine", "/Volumes/Engine"];   // Windows UNC + Mac (volume montado)
        var subs = ["original", "_original", "Original"];
        var dir = null, i, s, e;

        for (e = 0; e < engines.length && !dir; e++) {
            for (s = 0; s < subs.length; s++) {
                var p = engines[e] + "/_Jobfolder/" + os + "/" + subs[s];
                var fdir = new Folder(p);
                if (fdir.exists) { dir = fdir; break; }
            }
        }
        if (!dir) return "ERRO|Pasta 'original' do job " + os + " nao encontrada no Engine";

        var pdfs = dir.getFiles("*.pdf");
        if (!pdfs || pdfs.length === 0) return "ERRO|Nenhum PDF na pasta original do job " + os;

        var best = null, bestT = -1, bestN = null, bestNT = -1;
        for (i = 0; i < pdfs.length; i++) {
            var fl = pdfs[i];
            var t = 0;
            try { if (fl.modified) t = fl.modified.getTime(); } catch (em) {}
            var nm = "";
            try { nm = decodeURI(fl.name); } catch (en) { nm = fl.name; }
            if (!/distorcido/i.test(nm)) { if (t > bestNT) { bestNT = t; bestN = fl; } }  // NORMAL
            if (t > bestT) { bestT = t; best = fl; }
        }
        var chosen = bestN || best;    // prefere o NORMAL; so cai no distorcido se nao houver normal
        var nome; try { nome = decodeURI(chosen.name); } catch (ex) { nome = chosen.name; }
        return "OK|" + chosen.fsName + "|" + nome + "|" + (bestN ? "normal" : "distorcido");
    } catch (e) {
        return "ERRO|" + e.toString();
    }
}

/* Lista os PDFs do Desktop do operador (o arquivo sendo mexido, padrao
   ..._rev_v.pdf). Ignora os relatorios "Conferencia_" que a extensao salva la.
   Prefere os que casam com o padrao rev/v; se nenhum, devolve todos.
   Retorna: OK|<nome>\t<caminho>\n<nome>\t<caminho>...   ou  ERRO|<msg> */
function acListarPdfsDesktop() {
    try {
        var todos = [], comRev = [], MAXDEPTH = 6, LIMITE = 120;

        function nomeDe(x) { var n; try { n = decodeURI(x.name); } catch (e) { n = x.name; } return n; }
        function fmtData(t) {
            if (!t) return "";
            var dt = new Date(t); function p(n) { return (n < 10 ? "0" : "") + n; }
            return p(dt.getDate()) + "/" + p(dt.getMonth() + 1) + "/" + dt.getFullYear();
        }

        function scan(folder, depth, rot, insideJob) {
            if (depth > MAXDEPTH || todos.length >= LIMITE) return;
            var items;
            try { items = folder.getFiles(); } catch (eg) { return; }
            if (!items) return;
            for (var i = 0; i < items.length && todos.length < LIMITE; i++) {
                var it = items[i];
                if (it instanceof Folder) {
                    var fn = nomeDe(it);
                    var isJob = /rev/i.test(fn);
                    // desce se: e pasta de job, ou JA estamos dentro de um job (achar o pdf
                    // em subpasta tipo 'arte'), ou ainda no 1o nivel (container "Trabalhos").
                    if (isJob || insideJob || depth < 1) scan(it, depth + 1, isJob ? fn : rot, insideJob || isJob);
                    continue;
                }
                if (!(it instanceof File)) continue;
                var nm = nomeDe(it);
                if (!/\.pdf$/i.test(nm)) continue;
                if (/^conferencia_/i.test(nm)) continue;   // relatorios da propria extensao
                var t = 0; try { if (it.modified) t = it.modified.getTime(); } catch (e2) {}
                // mostra DATA (p/ distinguir cópias homônimas antigas x novas) + pasta do job
                var label = nm + "   " + fmtData(t) + (rot ? "   [" + rot + "]" : "");
                var item = { label: label, path: it.fsName, t: t };
                todos.push(item);
                if (/rev/i.test(nm) || insideJob) comRev.push(item);   // pdf de job (nome rev OU dentro de pasta job)
            }
        }
        scan(Folder.desktop, 0, "", false);

        var lista = comRev.length > 0 ? comRev : todos;
        lista.sort(function (a, b) { return b.t - a.t; }); // mais novo primeiro

        var out = [];
        for (var j = 0; j < lista.length; j++) out.push(lista[j].label + "\t" + lista[j].path);
        return "OK|" + out.join("\n");
    } catch (e) {
        return "ERRO|" + e.toString();
    }
}

/* Regioes a ignorar do documento ABERTO (= o arquivo tratado), normalizadas
   0..1 do artboard ativo, origem topo-esquerda (y p/ baixo, igual imagem).
   - raster: imagens (RasterItem/PlacedItem) -> so servem de "pista" p/ foto no painel
   - faca:   itens em camada/spot de corte (faca/corte/cut/die/vinco/dobra)
   - cota:   itens em camada de medida (cota/medida/dimensao)
   Retorna: OK|abW;abH|raster:x,y,w,h;...|faca:...|cota:...   ou  ERRO|<msg> */
function acRegioesIgnorar() {
    try {
        if (app.documents.length === 0) return "ERRO|Nenhum documento aberto";
        var doc = app.activeDocument;
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect; // [L,T,R,B] pt, y p/ cima
        var abL = ab[0], abT = ab[1], abR = ab[2], abB = ab[3];
        var abW = abR - abL, abH = abT - abB;
        if (abW <= 0 || abH <= 0) return "ERRO|Artboard invalido";

        var reFaca = /faca|corte|\bcut\b|die|dieline|contour|vinco|dobra|tracejad/i;
        var reCota = /cota|medida|dimens/i;
        var reSilent = /(^|\s)[zxw]_/i;   // spots z_ / x_ / w_ (ex.: z_bege, w_violeta) -> ignora sem avisar
        var rasters = [], facas = [], cotas = [], silents = [];

        function norm(b) {   // b=[L,T,R,B] (y cima) -> "x,y,w,h" 0..1 topo-esq
            var x = (b[0] - abL) / abW, y = (abT - b[1]) / abH;
            var w = (b[2] - b[0]) / abW, h = (b[1] - b[3]) / abH;
            return x.toFixed(4) + "," + y.toFixed(4) + "," + w.toFixed(4) + "," + h.toFixed(4);
        }
        function lname(it) { try { return it.layer ? it.layer.name : ""; } catch (e) { return ""; } }
        function sname(it) {
            var s = "";
            try { if (it.strokeColor && it.strokeColor.typename === "SpotColor") s += " " + it.strokeColor.spot.name; } catch (e1) {}
            try { if (it.fillColor && it.fillColor.typename === "SpotColor") s += " " + it.fillColor.spot.name; } catch (e2) {}
            return s;
        }

        var items = doc.pageItems, i, it, tn, b, tag;
        for (i = 0; i < items.length; i++) {
            it = items[i];
            try { if (it.hidden) continue; } catch (eh) {}
            try { if (it.guides) continue; } catch (eg) {}
            try { b = it.visibleBounds; } catch (eb) { continue; }
            tn = it.typename;
            if (tn === "RasterItem" || tn === "PlacedItem") { rasters.push(norm(b)); continue; }
            var sp = sname(it);
            if (reSilent.test(sp)) { silents.push(norm(b)); continue; }   // spot z_/x_/w_ -> silencioso
            tag = lname(it) + sp;
            if (reFaca.test(tag)) { facas.push(norm(b)); continue; }
            if (reCota.test(tag)) { cotas.push(norm(b)); continue; }
        }
        return "OK|" + abW.toFixed(1) + ";" + abH.toFixed(1)
            + "|raster:" + rasters.join(";")
            + "|faca:" + facas.join(";")
            + "|cota:" + cotas.join(";")
            + "|silent:" + silents.join(";");
    } catch (e) {
        return "ERRO|" + e.toString();
    }
}

/* Exporta a PRANCHETA ATIVA em PNG24 no temp; retorna o caminho.
   dpi: resolucao desejada. Clampa p/ no maximo ~4000px no maior lado. */
function acExportarPranchetaPNG(dpi) {
    var lvl = app.userInteractionLevel;
    try {
        if (app.documents.length === 0) return "ERRO|Nenhum documento aberto";
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        dpi = parseFloat(dpi);
        if (isNaN(dpi) || dpi < 36) dpi = 200;

        var doc = app.activeDocument;
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
        var r = ab.artboardRect;
        var wPt = r[2] - r[0];
        var hPt = r[1] - r[3];
        var maxPt = wPt > hPt ? wPt : hPt;
        var maxPx = maxPt / 72 * dpi;

        var scale = dpi / 72 * 100;            // % de escala p/ o PNG24
        var LIMIT = 4000;                       // teto de pixels no maior lado
        if (maxPx > LIMIT) scale = scale * (LIMIT / maxPx);
        if (scale < 5) scale = 5;

        var dest = Folder.temp.fsName + "/alphacompare_arquivo.png";
        var f = new File(dest);

        var opt = new ExportOptionsPNG24();
        opt.antiAliasing = true;
        opt.transparency = true;
        opt.artBoardClipping = true;            // recorta na prancheta ativa
        opt.horizontalScale = scale;
        opt.verticalScale = scale;

        doc.exportFile(f, ExportType.PNG24, opt);

        app.userInteractionLevel = lvl;
        if (!f.exists) return "ERRO|Falha ao gerar o PNG";
        return "OK|" + dest;
    } catch (e) {
        app.userInteractionLevel = lvl;
        return "ERRO|" + e.toString();
    }
}

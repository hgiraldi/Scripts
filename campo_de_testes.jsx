// call_inkcov_auto_detect_python.jsx
#target illustrator

// --------- CONFIG: só ajustar se seu .py tiver outro nome ----------
var pythonScriptName = "inkcov_sum.py"; // nome do script python (deixe na mesma pasta do .jsx)
// ------------------------------------------------------------------

// Variáveis globais usadas pela systemCall
var systemCallOutput = "";
var systemCallSuccess = false;

// systemCall (sua versão, sem return)
function systemCall(command) {
    var temp = new File(Folder.temp + "/temp_output.txt");
    var bat;
    try { if (temp.exists) temp.remove(); } catch (e) {}
    if ($.os.indexOf("Windows") !== -1) {
        bat = new File(Folder.temp + "/run_temp.bat");
        bat.open("w");
        bat.writeln('@echo off');
        bat.writeln(command + ' > "' + temp.fsName + '" 2>&1');
        bat.close();
        try { bat.execute(); } catch (e) {}
    } else {
        bat = new File(Folder.temp + "/run_temp.command");
        bat.open("w");
        bat.writeln("#!/bin/bash");
        bat.writeln(command + ' > "' + temp.fsName + '" 2>&1');
        bat.close();
        try { bat.execute(); } catch (e) {}
    }
    // aguardar mais um pouco para comandos demorados (ajuste se necessário)
    $.sleep(3500);
    var output = "";
    try {
        if (temp.exists) {
            temp.open("r");
            output = temp.read();
            temp.close();
        }
    } catch (e) { output = ""; }
    systemCallOutput = output;
    systemCallSuccess = (output.indexOf("OK_JSON:") !== -1);
}

// util: coloca entre aspas caminhos
function q(s) { return '"' + s + '"'; }

// detecta python executável preferencial: procura localmente no mesmo diretório do .jsx e depois em PATH
function detectPythonExec(pythonScriptFile) {
    // pasta do .jsx atual
    var scriptFile = new File($.fileName);
    var scriptFolder = scriptFile.parent;
    var folderPath = scriptFolder.fsName;

    // candidatos locais (na mesma pasta)
    var localCandidates = [];
    if ($.os.indexOf("Windows") !== -1) {
        localCandidates.push(folderPath + "\\python.exe");
        localCandidates.push(folderPath + "\\python"); // no caso
    } else {
        localCandidates.push(folderPath + "/python3");
        localCandidates.push(folderPath + "/python");
    }

    // candidatos no PATH fallback
    var pathCandidates = ["python", "python3", "py"];

    // função que testa um executável: roda "<candidate> -V" e checa se houve saída
    function testCandidate(candidate) {
        try {
            var cmd = candidate + " -V";
            systemCall(cmd);
            var out = systemCallOutput;
            // success heuristics: algo que contenha "Python" ou não seja vazio
            if (out && out.length > 0) {
                // aceita se contiver Python ou simplesmente não estiver vazio (alguns sistemas escrevem no stderr)
                if (out.toLowerCase().indexOf("python") !== -1 || out.indexOf("Python") !== -1 || out.indexOf("3.") !== -1) {
                    return true;
                }
                // algumas instalações retornam versão em stderr e systemCall capturou; aceitar não vazio
                return true;
            }
        } catch (e) {}
        return false;
    }

    // testar locais
    for (var i = 0; i < localCandidates.length; i++) {
        try {
            var c = localCandidates[i];
            var f = new File(c);
            if (f.exists) {
                // tornar caminho executável com aspas e testar
                if (testCandidate(q(c))) {
                    return q(c);
                }
                // tentar sem aspas (alguns sistemas preferem sem)
                if (testCandidate(c)) {
                    return c;
                }
            }
        } catch (e) {}
    }

    // testar PATH candidates
    for (var j = 0; j < pathCandidates.length; j++) {
        var pc = pathCandidates[j];
        if (testCandidate(pc)) return pc;
    }

    // se nada encontrado, retornar null
    return null;
}

// find placed PDF: usa doc.placedItems primeiro (mais confiável)
function findPlacedPDF_viaCollection(doc) {
    try {
        if (doc.placedItems && doc.placedItems.length > 0) {
            for (var i = 0; i < doc.placedItems.length; i++) {
                try {
                    var p = doc.placedItems[i];
                    if (p && p.file && p.file.name && p.file.name.toLowerCase().match(/\.pdf$/)) {
                        return p.file;
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
    return null;
}

// fallback recursivo
function findPlacedPDF_recursive(items) {
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        try { if (!it.visible) continue; } catch (e) {}
        if (it.typename === "GroupItem") {
            var f = findPlacedPDF_recursive(it.pageItems);
            if (f) return f;
        } else if (it.typename === "PlacedItem") {
            try {
                var fo = it.file;
                if (fo && fo.name && fo.name.toLowerCase().match(/\.pdf$/)) return fo;
            } catch (e) {}
        }
    }
    return null;
}

// main IIFE
(function main() {
    if (app.documents.length === 0) { alert("Nenhum documento aberto."); return; }
    var doc = app.activeDocument;

    // encontrar placed pdf
    var foundFile = findPlacedPDF_viaCollection(doc);
    if (!foundFile) foundFile = findPlacedPDF_recursive(doc.pageItems);
    if (!foundFile) {
        // debug placedItems list
        var dbg = "placedItems: " + (doc.placedItems ? doc.placedItems.length : 0) + "\n";
        try {
            for (var j = 0; doc.placedItems && j < doc.placedItems.length; j++) {
                try { dbg += " - " + doc.placedItems[j].file.fsName + "\n"; } catch (e) { dbg += " - (sem caminho)\n"; }
            }
        } catch (e) {}
        alert("Nenhum PlacedItem PDF encontrado.\nVerifique Links (Window > Links) e se o PDF está linked e não embed.\n\nDebug:\n" + dbg);
        return;
    }

    var pdfPath = foundFile.fsName;
    // localizar o Python executável (tenta local + PATH)
    // pythonScriptFullPath: pasta do jsx + pythonScriptName
    var scriptFolder = new File($.fileName).parent;
    var pythonScriptFullPath = scriptFolder.fsName + (scriptFolder.fsName.slice(-1) === "/" || scriptFolder.fsName.slice(-1) === "\\" ? "" : ( ($.os.indexOf("Windows") !== -1) ? "\\" : "/" )) + pythonScriptName;
    var pythonFileObj = new File(pythonScriptFullPath);
    if (!pythonFileObj.exists) {
        alert("Script Python não encontrado na mesma pasta do JSX:\n" + pythonScriptFullPath + "\nColoque o arquivo " + pythonScriptName + " na mesma pasta do JSX.");
        return;
    }

    var pythonExecDetected = detectPythonExec(pythonScriptFullPath);
    if (!pythonExecDetected) {
        alert("Não foi possível detectar um executável Python (local ou no PATH).\nTente garantir que 'python' ou 'python3' esteja no PATH ou coloque um python.exe na pasta do .jsx.\nTemp output: " + Folder.temp.fsName + "/temp_output.txt");
        return;
    }

    // construir comando final
    var cmd = pythonExecDetected + " " + q(pythonScriptFullPath) + " " + q(pdfPath);

    // confirmar
    if (!confirm("Executar comando:\n" + cmd + "\n\nContinuar?")) return;

    // executar
    systemCall(cmd);

    // analisar saída
    var out = systemCallOutput || "";
    if (out.indexOf("OK_JSON:") !== -1) {
        var jtxt = out.substring(out.indexOf("OK_JSON:") + "OK_JSON:".length);
        try {
            var parsed = JSON.parse(jtxt);
            var areas = parsed.areas_cm2 || parsed.areas || null;
            var msg = "Resultado (cm²) — PDF: " + parsed.pdf + "\n\n";
            if (areas) {
                if (areas.C!==undefined) msg += "C: " + (Math.round(areas.C*1000)/1000) + " cm²\n";
                if (areas.M!==undefined) msg += "M: " + (Math.round(areas.M*1000)/1000) + " cm²\n";
                if (areas.Y!==undefined) msg += "Y: " + (Math.round(areas.Y*1000)/1000) + " cm²\n";
                if (areas.K!==undefined) msg += "K: " + (Math.round(areas.K*1000)/1000) + " cm²\n";
                if (areas.spots) {
                    msg += "\nSpots:\n";
                    for (var s in areas.spots) { if (areas.spots.hasOwnProperty(s)) msg += " - " + s + ": " + (Math.round(areas.spots[s]*1000)/1000) + " cm²\n"; }
                }
            } else {
                msg += "JSON sem campo 'areas'.\nSaída completa:\n" + out;
            }
            alert(msg);
            // opcional: expor parsed globalmente para uso futuro no console
            try { inkCoverage = parsed; } catch (e) {}
            return;
        } catch (e) {
            alert("OK_JSON encontrado mas falha no parse: " + e + "\n\nSaída completa:\n" + out);
            return;
        }
    } else {
        // tentar fallback ler ink_coverage_out.json ao lado do pdf
        try {
            var fallback = new File(new File(pdfPath).parent.fsName + "/ink_coverage_out.json");
            if (fallback.exists) {
                fallback.open("r");
                var txt = fallback.read();
                fallback.close();
                var parsed2 = JSON.parse(txt);
                var areas2 = parsed2.areas_cm2 || parsed2.areas;
                var msg2 = "Resultado (fallback file) — PDF: " + parsed2.pdf + "\n\n";
                if (areas2) {
                    if (areas2.C!==undefined) msg2 += "C: " + (Math.round(areas2.C*1000)/1000) + " cm²\n";
                    if (areas2.M!==undefined) msg2 += "M: " + (Math.round(areas2.M*1000)/1000) + " cm²\n";
                    if (areas2.Y!==undefined) msg2 += "Y: " + (Math.round(areas2.Y*1000)/1000) + " cm²\n";
                    if (areas2.K!==undefined) msg2 += "K: " + (Math.round(areas2.K*1000)/1000) + " cm²\n";
                    if (areas2.spots) {
                        msg2 += "\nSpots:\n";
                        for (var ss in areas2.spots) { if (areas2.spots.hasOwnProperty(ss)) msg2 += " - " + ss + ": " + (Math.round(areas2.spots[ss]*1000)/1000) + " cm²\n"; }
                    }
                }
                alert(msg2);
                try { inkCoverage = parsed2; } catch (e) {}
                return;
            }
        } catch (e) {}
        // se nada deu certo, mostrar saída bruta pra debug
        var outmsg = out || "(nenhuma saída capturada)";
        alert("Não foi possível obter JSON válido do Python.\n\nSaída capturada:\n" + outmsg + "\n\nVerifique:\n - se o script python está no mesmo diretório do .jsx: " + pythonScriptFullPath + "\n - abra o arquivo temporário: " + Folder.temp.fsName + "/temp_output.txt\n - execute manualmente no terminal o comando mostrado antes para ver erros.");
        return;
    }
})(); // fim main

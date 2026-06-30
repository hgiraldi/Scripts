/* ============================================================
 * Ondulado - ponte JSX do painel CEP (PC + Mac)
 * Dispara os scripts .jsx da REDE. Caminho resolvido por SO. Checa DUAS redes:
 * a dos scripts (192.168.1.15) e a Engine (192.168.1.96) -> avisa qual caiu.
 * Reinstala so quando muda o VISUAL do painel (logica/operacoes vem da rede).
 * ============================================================ */

// --- pasta "Ondulado" dos scripts na rede (1o caminho que existir) ---
var CANDIDATOS_BASE = [
    "//192.168.1.15/uteis/_Padroes_clientes_Alpha/_Scripts/Scripts/Ondulado",   // Windows (UNC)
    "/Volumes/uteis/_Padroes_clientes_Alpha/_Scripts/Scripts/Ondulado",          // Mac
    "/Volumes/_Padroes_clientes_Alpha/_Scripts/Scripts/Ondulado"                 // Mac (outra montagem)
];
// --- pasta Engine (192.168.1.96) que tambem precisa estar conectada/montada ---
var CANDIDATOS_ENGINE = [
    "//192.168.1.96/Engine",   // Windows (UNC)
    "/Volumes/Engine",         // Mac (montado em /Volumes)
    "/Engine"                  // Mac (montado na raiz)
];

// ---- mensagens NO PAINEL (em vez de abrir janela do Illustrator) ----
// Janelas ScriptUI (new Window) entram em loop quando o script roda pelo CEP.
// Em vez disso o script chama painelMsg(): dispara um evento que o painel escuta
// e mostra como banner. NAO bloqueia o script. tipo: "info" | "erro".
// Disponibilizado em $.global p/ os scripts rodados via $.evalFile enxergarem.
var EVT_MSG = "com.alpha.ondulado.msg"; // por-painel: nao cruza com o Flexivel
function painelMsg(texto, tipo) {
    try {
        var xLib = new ExternalObject("lib:PlugPlugExternalObject");
        var ev = new CSXSEvent();
        ev.type = EVT_MSG;
        ev.data = (tipo || "info") + "|" + String(texto);
        ev.dispatch();
    } catch (e) {
        try { alert(String(texto)); } catch (e2) {} // sem painel -> alert nativo
    }
}
$.global.painelMsg = painelMsg;

function primeiroQueExiste(lista) {
    for (var i = 0; i < lista.length; i++) {
        try { if (new File(lista[i]).exists) return lista[i]; } catch (e) {}
    }
    return null;
}
// resolve o BASE NA HORA (se o share for montado depois, passa a achar).
function getBase() { return primeiroQueExiste(CANDIDATOS_BASE) || CANDIDATOS_BASE[0]; }

// status das DUAS PASTAS (resolvido na hora). "OK" se as duas estao ACESSIVEIS
// (montadas), senao "OFF|<quais nao acessiveis>". So e chamado pelo painel DEPOIS
// de confirmar que os servidores respondem (TCP), entao isto e rapido (nao trava).
function statusRede() {
    var scriptsOk = (primeiroQueExiste(CANDIDATOS_BASE) !== null);
    var engineOk = (primeiroQueExiste(CANDIDATOS_ENGINE) !== null);
    if (scriptsOk && engineOk) return "OK";
    var faltam = [];
    if (!scriptsOk) faltam.push("Scripts (192.168.1.15)");
    if (!engineOk) faltam.push("Engine (192.168.1.96)");
    return "OFF|" + faltam.join(" e ");
}

// teste de conexao: nome do documento ativo (ou ERRO:)
function pingDoc() {
    try {
        if (app.documents.length === 0) return "ERRO: nenhum documento aberto.";
        return app.activeDocument.name;
    } catch (e) { return "ERRO: " + e.toString(); }
}

// le o operacoes.json da REDE (z_Complementos). Editar = atualiza sem reinstalar.
function lerConfig() {
    try {
        var f = new File(getBase() + "/z_Complementos/operacoes.json");
        if (!f.exists) return "";
        f.encoding = "UTF-8";
        f.open("r");
        var t = f.read();
        f.close();
        return t;
    } catch (e) { return "ERRO: " + e.toString(); }
}

// roda uma operacao. 'arq' pode ter VARIOS scripts separados por virgula (rodam
// em sequencia, ex.: montagem + distorcao). 'os' = O.S.
function rodarOperacao(arq, os, pasta) {
    try {
        if (app.documents.length === 0) return "ERRO: nenhum documento aberto.";
        var BASE = getBase();
        var pastaBase = new File(BASE);
        if (!pastaBase.exists) return "ERRO: pasta nao montada/acessivel: " + BASE;

        $.global.serviceOrderNumber = String(os);

        // pasta == "raiz" -> scripts na RAIZ do Scripts (um nivel acima do BASE),
        // ex.: CheckList/Cotas. Senao -> z_Complementos do proprio modulo.
        var dirScripts, dirScriptDir;
        if (pasta === "raiz") {
            dirScripts = pastaBase.parent.fsName;       // .../Scripts
            dirScriptDir = dirScripts;
        } else {
            dirScripts = pastaBase.fsName + "/z_Complementos";
            dirScriptDir = pastaBase.fsName;            // z_pdfs etc. ficam aqui
        }
        $.global.scriptDirectory = dirScriptDir;

        var arquivos = String(arq).split(",");
        for (var i = 0; i < arquivos.length; i++) {
            var nome = arquivos[i].replace(/^\s+|\s+$/g, "");
            if (!nome) continue;
            var script = new File(dirScripts + "/" + nome);
            if (!script.exists) return "ERRO: script nao encontrado: " + script.fsName;
            $.evalFile(script);
        }
        return "OK";
    } catch (e) {
        return "ERRO: " + e.toString() + (e.line ? (" (linha " + e.line + ")") : "");
    }
}

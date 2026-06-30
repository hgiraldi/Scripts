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
// --- pasta Engine (192.168.1.96) que tambem precisa estar conectada ---
var CANDIDATOS_ENGINE = [
    "//192.168.1.96/Engine",   // Windows (UNC)
    "/Volumes/Engine"          // Mac
];

function primeiroQueExiste(lista) {
    for (var i = 0; i < lista.length; i++) {
        try { if (new File(lista[i]).exists) return lista[i]; } catch (e) {}
    }
    return null;
}
var BASE = primeiroQueExiste(CANDIDATOS_BASE) || CANDIDATOS_BASE[0];

// status das DUAS redes. "OK" se as duas estao acessiveis; senao "OFF|<quais cairam>".
function statusRede() {
    var scriptsOk = false;
    try { scriptsOk = (new File(BASE)).exists; } catch (e) {}
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
        var f = new File(BASE + "/z_Complementos/operacoes.json");
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
function rodarOperacao(arq, os) {
    try {
        if (app.documents.length === 0) return "ERRO: nenhum documento aberto.";
        var pasta = new File(BASE);
        if (!pasta.exists) return "ERRO: rede inacessivel: " + BASE;

        $.global.serviceOrderNumber = String(os);
        $.global.scriptDirectory = pasta.fsName;

        var arquivos = String(arq).split(",");
        for (var i = 0; i < arquivos.length; i++) {
            var nome = arquivos[i].replace(/^\s+|\s+$/g, "");
            if (!nome) continue;
            var script = new File(BASE + "/z_Complementos/" + nome);
            if (!script.exists) return "ERRO: script nao encontrado: " + script.fsName;
            $.evalFile(script);
        }
        return "OK";
    } catch (e) {
        return "ERRO: " + e.toString() + (e.line ? (" (linha " + e.line + ")") : "");
    }
}

/* ============================================================
 * Flexivel - ponte JSX do painel CEP (PC + Mac)
 * Dispara os scripts .jsx da REDE. Caminho resolvido por SO. Checa DUAS redes:
 * a dos scripts (uteis) e a Engine -> avisa qual caiu. Cada uma pode estar na
 * faixa 192.168.1.x OU 172.16.11.x (a fabrica tem as duas) -> tenta as duas.
 * Reinstala so quando muda o VISUAL do painel (logica/operacoes vem da rede).
 * ============================================================ */

// --- pasta "Flexivel" dos scripts na rede (1o caminho que existir) ---
// >>> MODO TESTE <<< : se existir a pasta Desktop/AlphaTeste, o painel roda os
// scripts DE LA (nao toca em producao). Some a pasta -> volta pra rede (producao).
// Candidatos POR SO: no MAC nunca checar caminho UNC (//servidor/...) -> um
// File.exists nele pode TRAVAR o Mac; no Windows nao checar /Volumes. $.os diz o SO.
var __ehWin = ($.os.indexOf("Windows") !== -1);
var TESTE_BASE = String(Folder.desktop.fsName).replace(/\\/g, "/") + "/AlphaTeste/Flexivel";

// IPs possiveis de cada servidor (mesma pasta, redes diferentes).
var IPS_SCRIPTS = ["192.168.1.15", "172.16.11.15"]; // uteis (scripts/operacoes)
var IPS_ENGINE  = ["192.168.1.96", "172.16.11.96"]; // Engine (_Jobfolder)
var SUB_SCRIPTS = "/uteis/_Padroes_clientes_Alpha/_Scripts/Scripts/Flexivel";

// IP que o PAINEL confirmou por TCP (setRedeIps). No Windows um File.exists num
// UNC morto so retorna depois do timeout do SMB -> testar o IP errado primeiro
// SEGURARIA o Illustrator. Por isso o que respondeu vai pra frente da fila.
var __ipScripts = "";
var __ipEngine  = "";
function setRedeIps(ipS, ipE) {
    __ipScripts = (ipS ? String(ipS) : "");
    __ipEngine  = (ipE ? String(ipE) : "");
    return "OK";
}

// devolve 'lista' com 'preferido' na frente (se estiver nela)
function ordenarPref(lista, preferido) {
    var out = [], i;
    if (preferido) {
        for (i = 0; i < lista.length; i++) { if (lista[i] === preferido) out.push(lista[i]); }
    }
    for (i = 0; i < lista.length; i++) { if (lista[i] !== preferido) out.push(lista[i]); }
    return out;
}

// caminhos de PRODUCAO dos scripts (sem o modo teste)
function basesProducao() {
    var out = [], ips, i;
    if (__ehWin) {
        ips = ordenarPref(IPS_SCRIPTS, __ipScripts);
        for (i = 0; i < ips.length; i++) { out.push("//" + ips[i] + SUB_SCRIPTS); }
    } else {
        out.push("/Volumes" + SUB_SCRIPTS);
        out.push("/Volumes/_Padroes_clientes_Alpha/_Scripts/Scripts/Flexivel");
    }
    return out;
}
// todos os candidatos dos scripts: modo teste primeiro, depois producao
function basesScripts() { return [TESTE_BASE].concat(basesProducao()); }

// --- pasta Engine que tambem precisa estar conectada/montada ---
function basesEngine() {
    var out = [], ips, i;
    if (__ehWin) {
        out.push("//aeserver16/Engine"); // NOME primeiro (evita conflito SMB 1219)
        ips = ordenarPref(IPS_ENGINE, __ipEngine);
        for (i = 0; i < ips.length; i++) { out.push("//" + ips[i] + "/Engine"); }
    } else {
        out.push("/Volumes/Engine"); // Mac: montado em /Volumes (ou raiz)
        out.push("/Engine");
    }
    return out;
}

// ---- mensagens NO PAINEL (em vez de abrir janela do Illustrator) ----
// Janelas ScriptUI (new Window) entram em loop quando o script roda pelo CEP.
// Em vez disso o script chama painelMsg(): dispara um evento que o painel escuta
// e mostra como banner. NAO bloqueia o script. tipo: "info" | "erro".
// Disponibilizado em $.global p/ os scripts rodados via $.evalFile enxergarem.
var EVT_MSG = "com.alpha.flexivel.msg"; // por-painel: nao cruza com o Ondulado
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
// Nada acessivel -> devolve o caminho de PRODUCAO (nunca o do modo teste): a msg
// de erro tem que mostrar a REDE que faltou, nao o Desktop/AlphaTeste da maquina.
function getBase() { return primeiroQueExiste(basesScripts()) || basesProducao()[0]; }

// rotulo do servidor pra mensagem: o IP que respondeu, ou os dois possiveis
function rotuloIps(ips, pref) { return pref ? pref : ips.join(" ou "); }

// status das DUAS PASTAS (resolvido na hora). "OK" se as duas estao ACESSIVEIS
// (montadas), senao "OFF|<quais nao acessiveis>". So e chamado pelo painel DEPOIS
// de confirmar que os servidores respondem (TCP), entao isto e rapido (nao trava).
function statusRede() {
    var scriptsOk = (primeiroQueExiste(basesScripts()) !== null);
    var engineOk = (primeiroQueExiste(basesEngine()) !== null);
    if (scriptsOk && engineOk) return "OK";
    var faltam = [];
    if (!scriptsOk) faltam.push("Scripts (" + rotuloIps(IPS_SCRIPTS, __ipScripts) + ")");
    if (!engineOk) faltam.push("Engine (" + rotuloIps(IPS_ENGINE, __ipEngine) + ")");
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
function rodarOperacao(arq, os, pasta, token) {
    try {
        // (a trava anti-loop fica no Xml_upload; aqui nao precisa mais de token)
        if (app.documents.length === 0) return "ERRO: nenhum documento aberto.";
        var BASE = getBase();
        var pastaBase = new File(BASE);
        if (!pastaBase.exists) {
            // BASE aqui e sempre um caminho de REDE (getBase nao cai no modo teste)
            return "ERRO: pasta dos scripts nao acessivel. Tentado: " + basesProducao().join(" e ");
        }

        $.global.serviceOrderNumber = String(os);

        // pasta == "raiz" -> scripts na RAIZ do Scripts (um nivel acima do BASE),
        // ex.: CheckList/Cotas. Senao -> z_Complementos do proprio modulo.
        var dirScripts, dirScriptDir;
        if (pasta === "raiz") {
            dirScripts = pastaBase.parent.fsName;       // .../Scripts
            dirScriptDir = dirScripts;
        } else if (pasta === "modulo") {
            dirScripts = pastaBase.fsName;              // .../Scripts/<modulo> (raiz do modulo)
            dirScriptDir = pastaBase.fsName;
        } else {
            dirScripts = pastaBase.fsName + "/z_Complementos";
            dirScriptDir = pastaBase.fsName;            // z_pdfs etc. ficam aqui
        }
        $.global.scriptDirectory = dirScriptDir;

        $.global.__msgPainel = ""; // limpa: o script grava aqui via msgUsuario

        var arquivos = String(arq).split(",");
        for (var i = 0; i < arquivos.length; i++) {
            var nome = arquivos[i].replace(/^\s+|\s+$/g, "");
            if (!nome) continue;
            var script = new File(dirScripts + "/" + nome);
            if (!script.exists) return "ERRO: script nao encontrado: " + script.fsName;
            try {
                $.evalFile(script);
            } catch (eScript) {
                // __LOOP_ABORT__ = re-execucao do CEP abortada para ESTE script (nao e
                // erro): segue p/ o proximo da sequencia (ex.: Montagem+Distorcao).
                // Qualquer outro erro real sobe pro catch de fora.
                if (String(eScript).indexOf("__LOOP_ABORT__") === -1) throw eScript;
            }
        }
        // devolve a msg que o script guardou (ex.: erro de cores) p/ o painel
        // mostrar no rodape SEM modal. "OK|tipo|texto" ou so "OK".
        var __m = $.global.__msgPainel || "";
        return __m ? ("OK|" + __m) : "OK";
    } catch (e) {
        if (String(e).indexOf("__LOOP_ABORT__") !== -1) {
            // re-run do loop abortado (nao e erro). A 1a passada pode ter gravado
            // uma msg (ex.: erro de cores) em __msgPainel -> devolve ela p/ o rodape,
            // senao a mensagem se perderia e o painel mostraria so "concluido".
            var __ma = $.global.__msgPainel || "";
            return __ma ? ("OK|" + __ma) : "OK";
        }
        return "ERRO: " + e.toString() + (e.line ? (" (linha " + e.line + ")") : "");
    }
}

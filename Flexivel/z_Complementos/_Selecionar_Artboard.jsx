// ============================================================
// Helper do PAINEL - Selecionar arte do artboard ativo
// Roda ENTRE a Montagem e a Distorcao na operacao "Montagem + Distorcao".
// O menu antigo (Scripts.jsx) faz doc.selectObjectsOnActiveArtboard() entre os dois
// #include; no painel os scripts rodam separados (cada um um $.evalFile), entao este
// passo vira um script proprio na sequencia. Ordem no operacoes.json:
//   1_SR_Montagens.jsx , ESTE , 3_Distorcao_Alpha.jsx
// A Distorcao distorce app.activeDocument.selection -> sem esta selecao nao faz nada.
// NAO inclui Xml_upload (nao precisa dos dados do job). Traz so a trava anti-loop.
// ============================================================

// --- trava anti-loop (mesma logica do Xml_upload; inline pq aqui nao ha #include) ---
// So aborta se o MESMO script rodou ha < 3s (re-execucao do CEP). Chave = nome.
// So sob o painel (no menu antigo $.fileName = "Scripts.jsx"); este helper so roda
// pelo painel, mas mantemos a mesma condicao por uniformidade.
var __lkNome = "?"; try { __lkNome = File($.fileName).name; } catch (eNm) {}
if (__lkNome !== "Scripts.jsx") {
    var __lkA = (new Date()).getTime(), __lkU = 0, __lkPrev = "";
    try {
        var __lkF = new File(Folder.desktop + "/alpha_run_lock.txt");
        if (__lkF.exists) {
            __lkF.open("r"); var __lkRaw = String(__lkF.read()); __lkF.close();
            var __lkBar = __lkRaw.indexOf("|");
            if (__lkBar > -1) { __lkPrev = __lkRaw.substring(0, __lkBar); __lkU = parseInt(__lkRaw.substring(__lkBar + 1), 10) || 0; }
        }
    } catch (eLk) {}
    if (__lkPrev === __lkNome && (__lkA - __lkU) < 3000) { throw new Error("__LOOP_ABORT__"); }
    try { var __lkW = new File(Folder.desktop + "/alpha_run_lock.txt"); __lkW.open("w"); __lkW.write(__lkNome + "|" + String(__lkA)); __lkW.close(); } catch (eLk2) {}
}
// -------------------------------------------------------------------------------------

// seleciona toda a arte do artboard ativo (alvo da Distorcao)
try {
    app.activeDocument.selectObjectsOnActiveArtboard();
} catch (e) {}

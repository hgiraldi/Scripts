var app = app || {};
app.documents = app.documents || [];


if (app.documents.length === 0) {
    alert("Não há nenhum documento aberto. Abra um documento antes de executar este script.");
} else {

    function getScriptDirectory() {
        var scriptFile = new File($.fileName);
        return scriptFile.parent.fsName;
    }
    // Diretorio do script (usado pelos scripts incluidos)
    var scriptDirectory = getScriptDirectory();

    // ======================= PALETA =======================
    // Cor de acento clara (boa no tema escuro do Illustrator). Os demais textos
    // ficam com cor NATIVA (adaptam ao tema) - so mudamos fonte/tamanho.
    var COR_TITULO = [0.40, 0.70, 1.00];
    var COR_ICONE  = [0.40, 0.70, 1.00]; // azul de destaque para os icones

    // ===================== HELPERS UI =====================
    // cor opcional: se nao passar (null), mantem a cor NATIVA do controle.
    function aplicarFonte(ctrl, fonte, estilo, tam, cor) {
        try { ctrl.graphics.font = ScriptUI.newFont(fonte, estilo, tam); } catch (e) {}
        if (cor) {
            try {
                ctrl.graphics.foregroundColor =
                    ctrl.graphics.newPen(ctrl.graphics.PenType.SOLID_COLOR, cor, 1);
            } catch (e) {}
        }
    }

    // Cria um icone vetorial (desenhado por codigo, sem arquivo externo) que
    // tambem funciona como botao: ao clicar, seleciona a operacao correspondente.
    function criarIcone(pai, tipo, aoClicar) {
        var ic = pai.add("iconbutton", undefined, undefined, { style: "toolbutton" });
        ic.preferredSize = [24, 24];
        ic.tipo = tipo;
        ic.onDraw = function () {
            var g = this.graphics;
            var pen   = g.newPen(g.PenType.SOLID_COLOR, COR_ICONE, 2);
            var brush = g.newBrush(g.BrushType.SOLID_COLOR, COR_ICONE);
            var t = this.tipo;
            var x, y;

            if (t === "montagem") {
                // grade 2x2 (step-and-repeat)
                g.newPath(); g.rectPath(5, 5, 6, 6);  g.strokePath(pen);
                g.newPath(); g.rectPath(13, 5, 6, 6); g.strokePath(pen);
                g.newPath(); g.rectPath(5, 13, 6, 6); g.strokePath(pen);
                g.newPath(); g.rectPath(13, 13, 6, 6); g.strokePath(pen);

            } else if (t === "montdist") {
                // grade no topo + onda embaixo (montagem + distorcao)
                g.newPath(); g.rectPath(5, 4, 6, 6);  g.strokePath(pen);
                g.newPath(); g.rectPath(13, 4, 6, 6); g.strokePath(pen);
                g.newPath();
                g.moveTo(4, 18); g.lineTo(8, 15); g.lineTo(12, 18);
                g.lineTo(16, 15); g.lineTo(20, 18);
                g.strokePath(pen);

            } else if (t === "label") {
                // etiqueta (tag) com furo
                g.newPath();
                g.moveTo(5, 6); g.lineTo(15, 6); g.lineTo(19, 12);
                g.lineTo(15, 18); g.lineTo(5, 18); g.closePath();
                g.strokePath(pen);
                g.newPath(); g.ellipsePath(7, 10, 4, 4); g.fillPath(brush);

            } else if (t === "distorcao") {
                // duas linhas onduladas
                g.newPath();
                g.moveTo(4, 9); g.lineTo(8, 6); g.lineTo(12, 9);
                g.lineTo(16, 6); g.lineTo(20, 9);
                g.strokePath(pen);
                g.newPath();
                g.moveTo(4, 17); g.lineTo(8, 14); g.lineTo(12, 17);
                g.lineTo(16, 14); g.lineTo(20, 17);
                g.strokePath(pen);

            } else if (t === "numeros") {
                // pistas (tracks) verticais
                for (x = 6; x <= 18; x += 6) {
                    g.newPath(); g.moveTo(x, 5); g.lineTo(x, 19); g.strokePath(pen);
                    g.newPath(); g.rectPath(x - 1, 5, 2, 2); g.fillPath(brush);
                }

            } else if (t === "planta") {
                // planta baixa: retangulo dividido
                g.newPath(); g.rectPath(5, 5, 14, 14); g.strokePath(pen);
                g.newPath(); g.moveTo(12, 5); g.lineTo(12, 19); g.strokePath(pen);
                g.newPath(); g.moveTo(12, 12); g.lineTo(19, 12); g.strokePath(pen);

            } else if (t === "uteis") {
                // ferramentas cruzadas (utilidades)
                g.newPath(); g.moveTo(6, 6);  g.lineTo(18, 18); g.strokePath(pen);
                g.newPath(); g.moveTo(6, 18); g.lineTo(18, 6);  g.strokePath(pen);
                g.newPath(); g.ellipsePath(10, 10, 4, 4); g.strokePath(pen);

            } else if (t === "micro") {
                // grade de micropontos
                for (x = 6; x <= 18; x += 6) {
                    for (y = 6; y <= 18; y += 6) {
                        g.newPath(); g.ellipsePath(x - 1, y - 1, 3, 3); g.fillPath(brush);
                    }
                }

            } else if (t === "box") {
                // caixa isometrica
                g.newPath(); g.rectPath(6, 10, 9, 9); g.strokePath(pen);
                g.newPath();
                g.moveTo(6, 10); g.lineTo(10, 6); g.lineTo(19, 6);
                g.lineTo(15, 10); g.closePath(); g.strokePath(pen);
                g.newPath();
                g.moveTo(15, 10); g.lineTo(19, 6); g.lineTo(19, 15);
                g.lineTo(15, 19); g.closePath(); g.strokePath(pen);
            }
        };
        if (aoClicar) ic.onClick = aoClicar;
        return ic;
    }

    // ======================= JANELA =======================
    var dlg = new Window("dialog", "Scripts Flexivel");
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.margins = 18;
    dlg.spacing = 12;
    // NAO definir backgroundColor em janela/painel que contenha radiobutton:
    // no Windows isso faz o texto dos labels dos radios sumir.

    // ---------------------- CABECALHO ---------------------
    var header = dlg.add("group");
    header.orientation = "column";
    header.alignChildren = ["left", "center"];
    header.spacing = 1;

    var titulo = header.add("statictext", undefined, "SCRIPTS  FLEXÍVEL");
    aplicarFonte(titulo, "Segoe UI", ScriptUI.FontStyle.BOLD, 20, COR_TITULO);

    var subtitulo = header.add("statictext", undefined, "Automação de pré-impressão flexográfica");
    aplicarFonte(subtitulo, "Segoe UI", ScriptUI.FontStyle.REGULAR, 10, null);

    // divisor fino
    var divisor = dlg.add("panel");
    divisor.alignment = ["fill", "top"];
    divisor.maximumSize.height = 2;
    divisor.minimumSize.height = 2;

    // ------------------- ORDEM DE SERVICO -----------------
    var painelOS = dlg.add("panel", undefined, "Ordem de Serviço");
    painelOS.orientation = "row";
    painelOS.alignChildren = ["left", "center"];
    painelOS.margins = [14, 16, 14, 14];
    painelOS.spacing = 8;

    var lblOS = painelOS.add("statictext", undefined, "Nº O.S.:");
    aplicarFonte(lblOS, "Segoe UI", ScriptUI.FontStyle.BOLD, 11, null);

    var numeroOrdemInput = painelOS.add("edittext", undefined, "");
    numeroOrdemInput.characters = 16;
    numeroOrdemInput.preferredSize.height = 26;
    numeroOrdemInput.active = true;

    var lblDigitos = painelOS.add("statictext", undefined, "(7 dígitos)");
    aplicarFonte(lblDigitos, "Segoe UI", ScriptUI.FontStyle.REGULAR, 9, null);

    // aceita apenas numeros, no maximo 7 digitos
    numeroOrdemInput.onChanging = function () {
        var limpo = this.text.replace(/[^0-9]/g, "");
        if (limpo.length > 7) limpo = limpo.substring(0, 7);
        if (this.text !== limpo) this.text = limpo;
    };

    // --------------------- OPERACAO -----------------------
    var painelOp = dlg.add("panel", undefined, "Selecione a operação");
    painelOp.orientation = "column";
    painelOp.alignChildren = ["fill", "top"];
    painelOp.margins = [14, 18, 14, 14];
    painelOp.spacing = 5;

    // Cada operacao: tipo do icone, label, descricao e se exige selecao no doc.
    var operacoes = [
        { tipo: "montagem",  texto: "Montagem",             precisaSel: true,  desc: "Monta (step-and-repeat) os itens selecionados." },
        { tipo: "montdist",  texto: "Montagem + Distorção", precisaSel: true,  desc: "Monta e aplica a distorção em sequência." },
        { tipo: "label",     texto: "Label Alpha",          precisaSel: false, desc: "Aplica a etiqueta/label padrão Alpha." },
        { tipo: "distorcao", texto: "Distorção",            precisaSel: true,  desc: "Aplica a distorção nos itens selecionados." },
        { tipo: "numeros",   texto: "Números Pistas",       precisaSel: false, desc: "Insere a numeração das pistas." },
        { tipo: "planta",    texto: "Planta Grupo Embrasa", precisaSel: false, desc: "Gera a planta do grupo Embrasa." },
        { tipo: "uteis",     texto: "Úteis",                precisaSel: false, desc: "Ferramentas/utilidades diversas do fluxo." },
        { tipo: "micro",     texto: "Micropontos",          precisaSel: false, desc: "Aplica os micropontos." },
        { tipo: "box",       texto: "Box Valfilm Mg",       precisaSel: true,  desc: "Gera o box Valfilm a partir da seleção." }
    ];

    // Como cada radio fica em um group proprio (lado a lado com o icone), eles
    // NAO sao exclusivos automaticamente. Controlamos a exclusividade na mao.
    var radios = [];

    function selecionarOp(indice) {
        var i;
        for (i = 0; i < radios.length; i++) {
            radios[i].value = (i === indice);
        }
        lblDesc.text = operacoes[indice].desc;
        btnExecutar.enabled = true;
    }

    (function () {
        var i;
        for (i = 0; i < operacoes.length; i++) {
            (function (idx) {
                var linha = painelOp.add("group");
                linha.orientation = "row";
                linha.alignChildren = ["left", "center"];
                linha.spacing = 8;
                // NAO definir backgroundColor aqui: a linha contem radiobutton.

                criarIcone(linha, operacoes[idx].tipo, function () { selecionarOp(idx); });

                // IMPORTANTE: NAO aplicar graphics em radiobutton no Windows —
                // isso faz o texto do label sumir. Mantemos nativos = legiveis.
                var rb = linha.add("radiobutton", undefined, operacoes[idx].texto);
                rb.onClick = function () { selecionarOp(idx); };
                radios[idx] = rb;
            })(i);
        }
    })();

    // descricao dinamica da operacao selecionada
    var lblDesc = painelOp.add("statictext", undefined, "Selecione uma operação acima.", { multiline: true });
    lblDesc.alignment = ["fill", "top"];
    lblDesc.minimumSize.height = 30;
    aplicarFonte(lblDesc, "Segoe UI", ScriptUI.FontStyle.REGULAR, 9, null);

    // referencias por nome (mantem compatibilidade com o restante do script)
    var rbMontagem  = radios[0];
    var rbMontDist  = radios[1];
    var rbLabel     = radios[2];
    var rbDistorcao = radios[3];
    var rbNumeros   = radios[4];
    var rbPlanta    = radios[5];
    var rbUteis     = radios[6];
    var rbMicro     = radios[7];
    var rbBox       = radios[8];

    // ---------------------- BOTOES ------------------------
    var grpBtns = dlg.add("group");
    grpBtns.orientation = "row";
    grpBtns.alignment = ["fill", "top"];
    grpBtns.alignChildren = ["right", "center"];
    grpBtns.spacing = 10;
    grpBtns.margins = [0, 6, 0, 0];

    var espaco = grpBtns.add("statictext", undefined, "");
    espaco.alignment = ["fill", "center"];

    var btnCancelar = grpBtns.add("button", undefined, "Cancelar", { name: "cancel" });
    btnCancelar.preferredSize = [110, 32];

    var btnExecutar = grpBtns.add("button", undefined, "Executar", { name: "ok" });
    btnExecutar.preferredSize = [130, 32];
    btnExecutar.enabled = false; // habilita ao escolher uma operacao

    dlg.defaultElement = btnExecutar;
    dlg.cancelElement = btnCancelar;

    // ----------------- BARRA DE PROGRESSO -----------------
    // Escondida ate clicar em Executar; "corre" para dar feedback visual.
    var barra = dlg.add("progressbar", undefined, 0, 100);
    barra.alignment = ["fill", "top"];
    barra.preferredSize.height = 6;
    barra.visible = false;

    function animarProgresso(de, ate) {
        var v;
        for (v = de; v <= ate; v += 4) {
            barra.value = v;
            dlg.update();
            $.sleep(12);
        }
        barra.value = ate;
        dlg.update();
    }

    // ======================= ACOES ========================
    btnExecutar.onClick = function () {
        var serviceOrderNumber = numeroOrdemInput.text;

        if (serviceOrderNumber.length !== 7) {
            alert("O número de ordem de serviço deve ter 7 dígitos.");
            return;
        }

        if (!rbMontagem.value && !rbMontDist.value && !rbLabel.value &&
            !rbDistorcao.value && !rbNumeros.value && !rbPlanta.value &&
            !rbUteis.value && !rbMicro.value && !rbBox.value) {
            alert("Selecione uma operação.");
            return;
        }

        // Pre-checagem de selecao: algumas operacoes exigem itens selecionados.
        // Validamos ANTES de animar a barra, para nao travar o botao.
        var iSel;
        for (iSel = 0; iSel < radios.length; iSel++) {
            if (radios[iSel].value && operacoes[iSel].precisaSel &&
                activeDocument.selection.length === 0) {
                alert("Nada está selecionado. Selecione pelo menos um item no documento antes de executar este script.");
                return;
            }
        }

        // ---- feedback visual: botao "rodando" + barra correndo ----
        btnExecutar.text = "Executando…";
        btnExecutar.enabled = false;
        btnCancelar.enabled = false;
        barra.visible = true;
        animarProgresso(0, 70);

        // Logica das operacoes (mantida do original)
        if (rbMontagem.value) {

            if (activeDocument.selection.length === 0) {
                alert("Nada está selecionado. Selecione pelo menos um item no documento antes de executar este script.");
            } else {
                #include "z_Complementos/1_SR_Montagens.jsx";

            }

        } else if (rbLabel.value) {

            #include "z_Complementos/2_Label_Alpha.jsx";

        } else if (rbDistorcao.value) {

            if (activeDocument.selection.length === 0) {
                alert("Nada está selecionado. Selecione pelo menos um item no documento antes de executar este script.");
            } else {
                #include "z_Complementos/3_Distorcao_Alpha.jsx";

            }

        } else if (rbMontDist.value) {
            // Montagem + Distorcao (sequencial)
            if (activeDocument.selection.length === 0) {
                alert("Nada está selecionado. Selecione pelo menos um item no documento antes de executar este script.");
            } else {
                #include "z_Complementos/1_SR_Montagens.jsx";

                doc.selectObjectsOnActiveArtboard();

                #include "z_Complementos/3_Distorcao_Alpha.jsx";

            }
        } else if (rbNumeros.value) {

            #include "z_Complementos/5_Numeros_PPPrintBRL.jsx";

        } else if (rbPlanta.value) {

            #include "z_Complementos/4_Planta_Embrasa.jsx";

        } else if (rbUteis.value) {

            #include "z_Complementos/7_Uteis.jsx";

        } else if (rbMicro.value) {

            #include "z_Complementos/8_Micropontos.jsx";

        } else if (rbBox.value) {

            if (activeDocument.selection.length === 0) {
                alert("Nada está selecionado. Selecione pelo menos um item no documento antes de executar este script.");
            } else {
                #include "z_Complementos/9_Box_Valfilm.jsx";

            }

        }

        animarProgresso(barra.value, 100);
        dlg.close();
    };

    btnCancelar.onClick = function () {
        dlg.close();
    };

    dlg.show();
}

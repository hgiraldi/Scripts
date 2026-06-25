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
    var COR_FUNDO  = [0.95, 0.96, 0.98];
    var COR_PAINEL = [1.00, 1.00, 1.00];
    var COR_TEXTO  = [0.13, 0.15, 0.20];
    var COR_TITULO = [0.40, 0.70, 1.00];
    var COR_SUB    = [0.45, 0.48, 0.55];
    var COR_ICONE  = [0.40, 0.70, 1.00]; // azul de destaque para os icones

    // ===================== HELPERS UI =====================
    // cor opcional: se nao passar (null), mantem a cor NATIVA do controle, que
    // se adapta ao tema do Illustrator (clara no tema escuro, escura no claro).
    function aplicarFonte(ctrl, fonte, estilo, tam, cor) {
        try { ctrl.graphics.font = ScriptUI.newFont(fonte, estilo, tam); } catch (e) {}
        if (cor) {
            try {
                ctrl.graphics.foregroundColor =
                    ctrl.graphics.newPen(ctrl.graphics.PenType.SOLID_COLOR, cor, 1);
            } catch (e) {}
        }
    }
    function aplicarFundo(ctrl, cor) {
        try {
            ctrl.graphics.backgroundColor =
                ctrl.graphics.newBrush(ctrl.graphics.BrushType.SOLID_COLOR, cor);
        } catch (e) {}
    }

    // Cria um icone vetorial (desenhado por codigo, sem arquivo externo) que
    // tambem funciona como botao: ao clicar, seleciona a operacao correspondente.
    // "tipo" define o desenho; "aoClicar" e chamado no clique.
    function criarIcone(pai, tipo, aoClicar) {
        var ic = pai.add("iconbutton", undefined, undefined, { style: "toolbutton" });
        ic.preferredSize = [24, 24];
        ic.tipo = tipo;
        ic.onDraw = function () {
            var g = this.graphics;
            var w = this.size[0], h = this.size[1];
            var pen   = g.newPen(g.PenType.SOLID_COLOR, COR_ICONE, 2);
            var brush = g.newBrush(g.BrushType.SOLID_COLOR, COR_ICONE);
            var t = this.tipo;

            if (t === "label") {
                // etiqueta (tag) com furo
                g.newPath();
                g.moveTo(5, 6); g.lineTo(15, 6); g.lineTo(19, 12);
                g.lineTo(15, 18); g.lineTo(5, 18); g.closePath();
                g.strokePath(pen);
                g.newPath(); g.ellipsePath(7, 10, 4, 4); g.fillPath(brush);

            } else if (t === "regua") {
                // regua com marcacoes (medicao)
                g.newPath(); g.rectPath(4, 8, 16, 8); g.strokePath(pen);
                var x;
                for (x = 7; x < 20; x += 3) {
                    g.newPath(); g.moveTo(x, 8); g.lineTo(x, 12); g.strokePath(pen);
                }

            } else if (t === "layers") {
                // camadas empilhadas
                g.newPath();
                g.moveTo(12, 4); g.lineTo(20, 8); g.lineTo(12, 12);
                g.lineTo(4, 8); g.closePath(); g.strokePath(pen);
                g.newPath();
                g.moveTo(4, 12); g.lineTo(12, 16); g.lineTo(20, 12);
                g.strokePath(pen);
                g.newPath();
                g.moveTo(4, 16); g.lineTo(12, 20); g.lineTo(20, 16);
                g.strokePath(pen);

            } else if (t === "header") {
                // cabecalho preenchido + linhas
                g.newPath(); g.rectPath(4, 5, 16, 5); g.fillPath(brush);
                g.newPath(); g.moveTo(4, 13); g.lineTo(20, 13); g.strokePath(pen);
                g.newPath(); g.moveTo(4, 17); g.lineTo(16, 17); g.strokePath(pen);

            } else if (t === "faca") {
                // linha de corte tracejada + lamina
                var xx;
                for (xx = 4; xx < 20; xx += 4) {
                    g.newPath(); g.moveTo(xx, 14); g.lineTo(xx + 2, 14); g.strokePath(pen);
                }
                g.newPath();
                g.moveTo(8, 5); g.lineTo(14, 5); g.lineTo(11, 11); g.closePath();
                g.fillPath(brush);

            } else if (t === "etiqueta") {
                // etiqueta impressa: moldura + linhas de texto + codigo de barras
                g.newPath(); g.rectPath(4, 5, 14, 16); g.strokePath(pen);
                g.newPath(); g.moveTo(8, 8); g.lineTo(16, 8); g.strokePath(pen);
                g.newPath(); g.moveTo(8, 11); g.lineTo(14, 11); g.strokePath(pen);
                var bx;
                for (bx = 8; bx <= 16; bx += 2) {
                    g.newPath(); g.moveTo(bx, 14); g.lineTo(bx, 18); g.strokePath(pen);
                }
            }
        };
        if (aoClicar) ic.onClick = aoClicar;
        return ic;
    }

    // ======================= JANELA =======================
    var dlg = new Window("dialog", "Scripts Ondulado");
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

    var titulo = header.add("statictext", undefined, "SCRIPTS  ONDULADO");
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

    // Cada operacao: tipo do icone, label e descricao mostrada ao selecionar.
    var operacoes = [
        { tipo: "label",  texto: "Label Alpha",             desc: "Aplica a etiqueta/label padrão Alpha no documento." },
        { tipo: "regua",  texto: "Medição Ondulado",        desc: "Gera as medidas das placas do ondulado." },
        { tipo: "regua",  texto: "Medição Ondulado (Teste)", desc: "TESTE: gera as medidas por GRUPO, usando a cor predominante de cada grupo (preto1, preto2...). Não substitui a medição original." },
        { tipo: "layers", texto: "Layers Ondulado",         desc: "Cria a estrutura de layers (placas por cor) do fluxo." },
        { tipo: "header", texto: "Preenchimento Cabeçalho", desc: "Preenche os campos do cabeçalho automaticamente." },
        { tipo: "faca",   texto: "Risco Poliester",         desc: "Gera o risco/faca em poliéster com data." },
        { tipo: "etiqueta", texto: "Gerar Etiquetas",        desc: "Gera as etiquetas (Penha ou cor, conforme o cliente) empilhadas numa página, pro operador usar." }
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
        // habilita o botao assim que houver uma operacao escolhida
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

                var rb = linha.add("radiobutton", undefined, operacoes[idx].texto);
                rb.onClick = function () { selecionarOp(idx); };
                // IMPORTANTE: NAO aplicar graphics (fonte/cor) em radiobutton no
                // Windows — isso faz o texto do label sumir. Mantemos nativos.
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
    var rbLabel        = radios[0];
    var rbMedicao      = radios[1];
    var rbMedicaoTeste = radios[2];
    var rbLayers       = radios[3];
    var rbPreench      = radios[4];
    var rbRisco        = radios[5];
    var rbEtiqueta     = radios[6];

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

    // Anima a barra ate "ate" (0-100) dando tempo de redesenhar a janela.
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

        if (!rbLabel.value && !rbMedicao.value && !rbMedicaoTeste.value && !rbLayers.value &&
            !rbPreench.value && !rbRisco.value && !rbEtiqueta.value) {
            alert("Selecione uma operação.");
            return;
        }

        // ---- feedback visual: botao "rodando" + barra correndo ----
        btnExecutar.text = "Executando…";
        btnExecutar.enabled = false;
        btnCancelar.enabled = false;
        barra.visible = true;
        animarProgresso(0, 70);

        if (rbMedicao.value) {

            #include "z_Complementos/10_Medicao_Ondulado.jsx";

        } else if (rbMedicaoTeste.value) {

            #include "z_Complementos/10_Medicao_Ondulado_Teste.jsx";

        } else if (rbLayers.value) {

            #include "z_Complementos/11_Criar_Layers_Ondulado.jsx";

        } else if (rbPreench.value) {

            #include "z_Complementos/13_Preenchimento_Penha.jsx";

        } else if (rbLabel.value) {

            #include "z_Complementos/2_Label_Alpha.jsx";

        } else if (rbRisco.value) {

            #include "z_Complementos/14_Risco_Faca.jsx";

        } else if (rbEtiqueta.value) {

            #include "z_Complementos/12_Gerar_Etiquetas.jsx";

        }

        animarProgresso(barra.value, 100);
        dlg.close();
    };

    btnCancelar.onClick = function () {
        dlg.close();
    };

    dlg.show();
}

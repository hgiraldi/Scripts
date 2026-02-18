//Label
function label(cust) {

    // Se a camada "registros" não existir, crie-a
    if (!layerLabel) {
        layerLabel = app.activeDocument.layers.add();
        layerLabel.name = "label";
    }

    // Verifica se a camada "registros" já existe
    var layerLabel = app.activeDocument.layers.getByName("label");

    if (cust == undefined) {
        cust = folder
    }

    if (((cust.indexOf("rioplastic") >= 0) || (cust.indexOf("embalagens_doma") >= 0)) && ((mode == "Advantage") || (mode == "Bellissima"))) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // ~1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posiciona o texto base
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // --- checa se é Bellissima COM algum coresD != "C"
        var isBellissima = (mode == "Bellissima");
        var hasNonC = false;
        if (isBellissima && coresD && coresD.length) {
            for (var j = 0; j < coresD.length; j++) {
                if (coresD[j] !== "C") {
                    hasNonC = true;
                    break;
                }
            }
        }

        // Cria um textFrame por cor já com o conteúdo correto (uScreen ou mix)
        var coresTexto = [];
        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();

            if (isBellissima && hasNonC) {

                if (dotShape[i] == "C") {
                    corTexto.contents = uScreen[i];
                    alert("Aqui")
                } else {
                    corTexto.contents = coresD[i];
                    alert("Aqui 2")
                }
            } else {
                // Advantage ou Bellissima sem não-C: usa uScreen puro
                corTexto.contents = uScreen[i];
            }

            coresTexto.push(corTexto);
        }

        // Aplica cor conforme coresComuns
        for (var j = 0; j < coresComuns.length && j < coresTexto.length; j++) {
            aplicarCorTexto(coresTexto[j], coresComuns[j]);
        }

        // Posiciona as tags de cor na sequência
        var textoCores = doc.textFrames.add(); // (mantido se você usa em outro lugar)
        var xPosition = texto.width + 5;

        for (var k = 0; k < coresTexto.length; k++) {
            var t = coresTexto[k];
            t.textRange.characterAttributes.size = 5;
            t.position = [xPosition, -5];
            xPosition += t.width + 1; // espaçamento
            t.move(grupoLabel, ElementPlacement.PLACEATEND);
        }



    } else if (((cust.indexOf("rioplastic") >= 0) || (cust.indexOf("embalagens_doma") >= 0)) && (mode == "HD Flexo")) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = coresD[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }


        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }


    } else if (cliente === "VIDEPLAST RIO VERDE") {



        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cac + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }








    } else if (cliente === "VIDEPLAST VIDEIRA" || cliente === "VIDEPLAST UNIAO DA V") {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - MAT: " + cpc + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }



    } else if ((cust.indexOf("valfilm_mg") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

    } else if ((cust.indexOf("valgroup_ba1") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

    } else if ((cust.indexOf("tecnoval_laminados") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }



    } else if ((cust.indexOf("valmaster") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + cpc + " - " + formatarData(new Date()) + " - " + "ALPHA" + " - " + produto + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }



    } else if ((cust.indexOf("valfilm_lorena") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + "Des. " + cylinderSizeMM + " - Fechamento " + closureInput + " - FRENTE/VERSO - " + lpc + "lpc - " + formatarData(new Date()) + " - ALPHA ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }


    } else if ((cust.indexOf("valgroup_fi") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - " + "Des. " + cylinderSizeMM + " - Fechamento " + closureInput + " - FRENTE/VERSO - " + lpc + "lpc - " + formatarData(new Date()) + " - ALPHA ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        texto.textRange.fillColor = registrationColor;

        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();

            // Verificar se a cor é 'branco' ou 'verniz' e substituir
            if (cores[i] === "branco" || cores[i] === "Branco" || cores[i] === "BRANCO") {
                corTexto.contents = "White";
            } else if (cores[i] === "verniz" || cores[i] === "Verniz" || cores[i] === "VERNIZ" || cores[i] === "verniz total" || cores[i] === "Verniz Total" || cores[i] === "VERNIZ TOTAL") {
                corTexto.contents = "Full Varnish";
            } else {
                corTexto.contents = cores[i]; // Caso contrário, mantém a cor original
            }

            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }


    } else if ((cust.indexOf("fascreen") >= 0)) {



        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + cpc + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    } else if ((cust.indexOf("viskase") >= 0)) {


        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - FRENTE/VERSO - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    } else if ((cust.indexOf("protervac") >= 0)) {


        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + cpc + " - FRENTE/VERSO - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    } else if ((cust.indexOf("serviplas") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = "ALPHA - " + cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 9; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 9;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);


    } else if ((cust.indexOf("puma") >= 0) || (cust.indexOf("printek") >= 0) || (cust.indexOf("vr_label") >= 0)) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + cpc + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    } else if (cust.indexOf("ceti") >= 0) {

        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + nomeArte + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = coresComPant[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);




    } else {
        //padrão ALpha
        var texto = doc.textFrames.add();
        texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
        texto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
        texto.textRange.paragraphAttributes.justification = Justification.RIGHT;
        texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        // Posicione o texto conforme necessário
        texto.position = [5, -5];

        var grupoLabel = app.activeDocument.groupItems.add();


        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width + 5;

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = 5;
            corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
            corTexto.position = [xPosition, -5];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        texto.move(grupoLabel, ElementPlacement.PLACEATEND);


    }

    textoCores.remove();

}
//Padrao
function montagemPadrao() {
    // Largura dos retângulos (0,12mm em pontos)
    var rectangleDiameter = sizeCameron;
    if (sizeCameron <= (1 / 0.35277777777782)) {
        var rectangleWidth = 0.08 / 0.35277777777782;
    } else {
        var rectangleWidth = 0.12 / 0.35277777777782;
    }

    // Cria o primeiro retângulo na vertical (0,12mm x sizeCameron)
    var verticalRectangle = createBlackRectangle(0, 0, rectangleWidth, rectangleDiameter);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,12mm)
    var horizontalRectangle = createBlackRectangle(0, 0, rectangleDiameter, rectangleWidth);

    // Rotaciona o segundo retângulo em 0 graus
    horizontalRectangle.rotate(0);

    // Diâmetro do círculo preto maior (sizeCameron)
    var blackCircleDiameter = sizeCameron;

    // Diâmetro do círculo branco menor (10% menor)
    var smallerWhiteCircleDiameter = blackCircleDiameter * 0.8;

    // Cria o círculo branco na camada padrão
    var whiteCircle = createWhiteCircle(0, 0, smallerWhiteCircleDiameter);

    // Cria o círculo preto na camada padrão
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Centraliza o círculo branco no círculo preto
    var centerX = blackCircle.position[0];
    var centerY = blackCircle.position[1];
    var whiteCircleOffsetX = (centerX + ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));
    var whiteCircleOffsetY = (centerY - ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));

    whiteCircle.position = [whiteCircleOffsetX, whiteCircleOffsetY];

    // Centraliza o retângulo vertical no círculo preto
    var verticalRectangleOffsetX = (centerX + ((sizeCameron / 2) - (rectangleWidth / 2)));
    var verticalRectangleOffsetY = centerY;

    verticalRectangle.position = [verticalRectangleOffsetX, verticalRectangleOffsetY];

    // Centraliza o retângulo horizontal no círculo preto
    var horizontalRectangleOffsetX = centerX;
    var horizontalRectangleOffsetY = -(centerY + ((sizeCameron / 2) - (rectangleWidth / 2)));

    horizontalRectangle.position = [horizontalRectangleOffsetX, horizontalRectangleOffsetY];

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(finalGroup, ElementPlacement.PLACEATEND);
    blackCircle.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    // Cria um novo grupo para conter os grupos duplicados
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);

    // Largura e altura do retângulo centralizado
    var rectangleWidthCentered = sizeCameron;
    var rectangleHeightCentered = cylinderSize;
    var rectangleWidth25Percent = rectangleWidthCentered * 0.15;

    // Posição do retângulo branco centralizado
    var rectangleX = mainGroup.position[0] + ((sizeCameron / 2) - (rectangleWidth25Percent / 2));
    var rectangleY = mainGroup.position[1] - (cylinderSize - 15); // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado branco no novo grupo
    var centeredRectangleWhite = createWhiteRectangle(rectangleX, rectangleY, rectangleWidth25Percent, rectangleHeightCentered);
    centeredRectangleWhite.move(mainGroup, ElementPlacement.PLACEATEND);


    // Posição do retângulo centralizado
    var rectangleX = mainGroup.position[0];
    var rectangleY = mainGroup.position[1] - cylinderSize; // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado no novo grupo
    var centeredRectangle = createBlackRectangle(rectangleX, rectangleY, rectangleWidthCentered, rectangleHeightCentered);
    centeredRectangle.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroup.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;

    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 5;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 5;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
    texto.textRange.fillColor = registrationColor;
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width;
    var tamanhoLabelCores = 5
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 5;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = -20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoLabel.height - retangulo.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);


    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    if (sizeCameron <= (1 / 0.35277777777782)) {
        var alturaMarceDeCorte = 0.1 / 0.35277777777782;
    } else {
        var alturaMarceDeCorte = 0.2 / 0.35277777777782;
    }
    var marcaDeCorte = createBlackRectangle((sizeCameron - larguraMarcaDeCorte), -((sizeCameron / 2) + (alturaMarceDeCorte / 2)), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    var grupoDuplicadoDireita = grupoDeRetangulos.duplicate();
    grupoDuplicadoDireita.left = grupoDeRetangulos.left + distanceBetweenRectangles + (larguraMarcaDeCorte - sizeCameron);

    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

        //Camerons Position
        if (pos == "E") {
            groupDuplicateRight.remove();
            cameronCentralGroup.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "D") {
            mainGroup.remove()
            cameronCentralGroup.remove();
            grupoDeRetangulos.remove();
        } else if (pos == "C") {
            mainGroup.remove()
            groupDuplicateRight.remove();
            grupoDeRetangulos.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "EC") {
            groupDuplicateRight.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "CD") {
            grupoDeRetangulos.remove();
            mainGroup.remove();
        } else if (pos == "ED") {
            cameronCentralGroup.remove();
        } else {

        }

        var alertMessage = "Montagem e Label feitos";

        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();


    }
}
//Contisul
function montagemContisul() {

    var larguraRetanguloBranco = 5 / 0.35277777777782;
    var alturaRetanguloBranco = 1.5 / 0.35277777777782;
    var larguraraRetanguloregistros = 0.15 / 0.35277777777782;
    var larguraraRetanguloregistrosBranco = 0.4 / 0.35277777777782;
    var alturaRetanguloregistroMaior = 4.1 / 0.35277777777782;
    var alturaRetanguloregistroMenor = 1.2 / 0.35277777777782;
    var diametroCirculo = 0.1 / 0.35277777777782;

    var cameron = createBlackRectangle(0, 0, sizeCameron, cylinderSize);
    var quadradoRegistro = createWhiteRectangle((sizeCameron - alturaRetanguloBranco) / 2, (cylinderSize - larguraRetanguloBranco) / 2, alturaRetanguloBranco, larguraRetanguloBranco);
    var retanguloRegistroMaior = createBlackRectangle((sizeCameron - larguraraRetanguloregistros) / 2, (cylinderSize - alturaRetanguloregistroMaior) / 2, larguraraRetanguloregistros, alturaRetanguloregistroMaior);
    var retanguloRegistroMenor = createBlackRectangle((sizeCameron - alturaRetanguloregistroMenor) / 2, (cylinderSize - larguraraRetanguloregistros) / 2, alturaRetanguloregistroMenor, larguraraRetanguloregistros);
    var microponto = createBlackCircle((sizeCameron - diametroCirculo) / 2, ((cylinderSize - diametroCirculo) / 2) + (alturaRetanguloregistroMaior / 2) + (diametroCirculo / 2) + 2 * diametroCirculo, diametroCirculo);
    var retanguloBrancoMaior = createWhiteRectangle((sizeCameron - larguraraRetanguloregistrosBranco) / 2, 0, larguraraRetanguloregistrosBranco, alturaRetanguloregistroMaior)
    var retanguloBrancoMenor = createWhiteRectangle((sizeCameron - alturaRetanguloBranco) / 2, ((alturaRetanguloregistroMaior - alturaRetanguloregistroMenor) / 2) + larguraraRetanguloregistrosBranco, alturaRetanguloBranco, larguraraRetanguloregistrosBranco)

    var groupRegistrosBranco = app.activeDocument.groupItems.add();
    retanguloBrancoMaior.move(groupRegistrosBranco, ElementPlacement.PLACEATEND);
    retanguloBrancoMenor.move(groupRegistrosBranco, ElementPlacement.PLACEATEND);

    var groupRegistrosBrancoUp = groupRegistrosBranco.duplicate();
    groupRegistrosBrancoUp.top = cylinderSize;


    // Cria grupo final e move os elementos para o grupo final
    var groupRegistros = app.activeDocument.groupItems.add();
    retanguloRegistroMaior.move(groupRegistros, ElementPlacement.PLACEATEND);
    retanguloRegistroMenor.move(groupRegistros, ElementPlacement.PLACEATEND);
    microponto.move(groupRegistros, ElementPlacement.PLACEATEND);
    quadradoRegistro.move(groupRegistros, ElementPlacement.PLACEATEND);


    var groupUp = groupRegistros.duplicate();
    groupUp.top = +cylinderSize - alturaRetanguloregistroMaior;

    var groupDown = groupRegistros.duplicate();
    groupDown.top = alturaRetanguloregistroMaior + groupRegistros.height;

    // Cria um novo grupo para conter os grupos duplicadosa
    var mainGroup = app.activeDocument.groupItems.add();
    groupRegistros.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDown.move(mainGroup, ElementPlacement.PLACEATEND);
    groupUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupRegistrosBranco.move(mainGroup, ElementPlacement.PLACEATEND);
    groupRegistrosBrancoUp.move(mainGroup, ElementPlacement.PLACEATEND);
    cameron.move(mainGroup, ElementPlacement.PLACEATEND);

    var cameronD = mainGroup.duplicate();
    cameronD.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    //====================LABEL===================//

    //inserir o label 
    var texto = doc.textFrames.add();
    var tamanhoLabel = 6;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 6;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + cpc + " - Des. " + cylinderSizeMM + " - Fechamento " + closureInput + " - Cliche: " + espessura + " - " + produto + " - " + formatarData(new Date()) + " - " + lpc + "lpc" + " - " + "ALPHA";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = whiteCMYK;
    texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");


    // Posicione o texto conforme necessário baseado nas posições
    texto.position = [distanciaLabel, -20 + cylinderSize / 2];

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var xPosition = 0;
    var tamanhoLabelCores = 6;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 6;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20 + cylinderSize / 2;
    grupoLabel.left = distanciaLabel;

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2)) + cylinderSize / 2];


    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);


    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            objectsToGroup.push(registrosLayer.pageItems[j]);
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

        var alertMessage = "Montagem e Label feitos";

        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();


    }
}
//Ralprint
function montagemRalprint() {

    var circuloBrancoCores = sizeCameron;
    var circuloPretoCores = sizeCameron * 0.9;
    var distanciaBranco = sizeCameron * 0.5;
    var distanciaPreto = (sizeCameron * 1.5) - (sizeCameron * 0.9);
    var smallerWhiteCircleDiameter = sizeCameron * 0.8;
    var rectangleWidth25Percent = sizeCameron * 0.15;

    // Largura dos retângulos (0,12mm em pontos)
    if (sizeCameron <= (1 / 0.35277777777782)) {
        var rectangleWidth = 0.08 / 0.35277777777782;
    } else {
        var rectangleWidth = 0.12 / 0.35277777777782;
    }

    //Criando Registros
    var verticalRectangle = createBlackRectangle(((sizeCameron - rectangleWidth) / 2), -(sizeCameron / 2), rectangleWidth, sizeCameron);
    var horizontalRectangle = createBlackRectangle(0, -(rectangleWidth / 2), sizeCameron, rectangleWidth);
    var circuloBrancoRegistro = createWhiteCircle(((sizeCameron - smallerWhiteCircleDiameter) / 2), smallerWhiteCircleDiameter / 2, smallerWhiteCircleDiameter);
    var circuloPretoRegistro = createBlackCircle(0, sizeCameron / 2, sizeCameron);
    var cameronBranco = createWhiteRectangle(((sizeCameron - rectangleWidth25Percent) / 2), -cylinderSize / 2, rectangleWidth25Percent, cylinderSize);
    var cameronRegistro = createBlackRectangle(0, -cylinderSize / 2, sizeCameron, cylinderSize);

    var finalGroup = app.activeDocument.groupItems.add();
    verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoRegistro.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPretoRegistro.move(finalGroup, ElementPlacement.PLACEATEND);


    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = cylinderSize / 2 - 13;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = cylinderSize / 2 - 13;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    // Cria um novo grupo para conter os grupos duplicados
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);
    cameronBranco.move(mainGroup, ElementPlacement.PLACEATEND);
    cameronRegistro.move(mainGroup, ElementPlacement.PLACEATEND);


    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 25);
    var yCoordPreto = -((cylinderSize / 2 - 25) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }

    //criando o retangulo registration abaixo das densidades
    var retanguloDensidade = createBlackRectangle(0, 0, sizeCameron, grupoCirculosBrancos.height * 1.1);
    retanguloDensidade.position = [0, -((cylinderSize / 2 - 25)) + (grupoCirculosBrancos.height - sizeCameron) + ((retanguloDensidade.height - grupoCirculosBrancos.height) / 2)];


    var groupDensidades = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(groupDensidades, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(groupDensidades, ElementPlacement.PLACEATEND);
    retanguloDensidade.move(groupDensidades, ElementPlacement.PLACEATEND);

    // Definir as coordenadas para mover o grupo para a posição desejada
    var novaPosicaoX = 0;
    var novaPosicaoY = groupDensidades.height / 2;

    // Mover o grupo para a nova posição
    groupDensidades.translate(novaPosicaoX - groupDensidades.position[0], novaPosicaoY - groupDensidades.position[1]);

    var duplicateDensidades = groupDensidades.duplicate();
    duplicateDensidades.left = distanceBetweenRectangles;
    duplicateDensidades.top = (cylinderSize / 2 - 25);
    groupDensidades.top = -(cylinderSize / 2 - 25) + groupDensidades.height;



    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroup.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;

    //inserir o label
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + nomeArte + " - " + lpc + "lpc -" + formatarData(new Date());
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = whiteCMYK;


    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        texto.position = [distanciaLabel, -20];
    } else if (pos == "CD" || pos == "D") {
        texto.rotate(180);
        texto.position = [(((sizeCameron + sizeCameron) / 2) - tamanhoLabel) / 2 + distanceBetweenRectangles, -20];
    } else if (pos == "C") {
        texto.position = [distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), -20];
    } else {

    }

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else if (pos == "C") {
        var tamanhoLabel90 = larguraCameronCentral;
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = registrationColor;

    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    } else if (pos == "CD" || pos == "D") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceBetweenRectangles, -(20 - ((textoHeightPorcent - texto.height) / 2))];
    } else if (pos == "C") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    } else {

    }

    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);


    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles + (((sizeCameron + sizeCameron) / 2) - tamanhoLabel) / 2;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else if (pos == "C") {
        var tamanhoLabel90 = larguraCameronCentral;
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);

    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    if (sizeCameron <= (1 / 0.35277777777782)) {
        var alturaMarceDeCorte = 0.1 / 0.35277777777782;
    } else {
        var alturaMarceDeCorte = 0.2 / 0.35277777777782;
    }

    var marcaDeCorte = createBlackRectangle((sizeCameron - larguraMarcaDeCorte), -(alturaMarceDeCorte / 2), larguraMarcaDeCorte, alturaMarceDeCorte);
    var duplicateMarca = marcaDeCorte.duplicate();
    duplicateMarca.left = distanceBetweenRectangles;

    var grupoMarcas = app.activeDocument.groupItems.add();
    marcaDeCorte.move(grupoMarcas, ElementPlacement.PLACEATEND);
    duplicateMarca.move(grupoMarcas, ElementPlacement.PLACEATEND);

    var marcasDuplicadas = grupoMarcas.duplicate();
    marcasDuplicadas.top = -cylinderSize + (alturaMarceDeCorte / 2);

    var grupoMarcasFinal = app.activeDocument.groupItems.add();
    grupoMarcas.move(grupoMarcasFinal, ElementPlacement.PLACEATEND);
    marcasDuplicadas.move(grupoMarcasFinal, ElementPlacement.PLACEATEND);

    grupoMarcasFinal.top = cylinderSize / 2 + (alturaMarceDeCorte / 2);

    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

        //Camerons Position
        if (pos == "E") {
            groupDuplicateRight.remove();
            cameronCentralGroup.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "D") {
            mainGroup.remove()
            cameronCentralGroup.remove();
            grupoDeRetangulos.remove();
        } else if (pos == "C") {
            mainGroup.remove()
            groupDuplicateRight.remove();
            grupoDeRetangulos.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "EC") {
            groupDuplicateRight.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "CD") {
            grupoDeRetangulos.remove();
            mainGroup.remove();
        } else if (pos == "ED") {
            cameronCentralGroup.remove();
        } else {

        }

        var alertMessage = "Montagem e Label feitos";

        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();


    }
}
//Novatack
function montagemNovatack() {
    // Largura dos retângulos (0,12mm em pontos)
    var rectangleDiameter = sizeCameron;
    var rectangleWidth = 0.16 / 0.35277777777782;

    // Cria o primeiro retângulo na vertical (0,12mm x sizeCameron)
    var verticalRectangle = createBlackRectangle(0, 0, rectangleWidth, rectangleDiameter);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,12mm)
    var horizontalRectangle = createBlackRectangle(0, 0, rectangleDiameter, rectangleWidth);

    // Rotaciona o segundo retângulo em 0 graus
    horizontalRectangle.rotate(0);

    // Diâmetro do círculo preto maior (sizeCameron)
    var blackCircleDiameter = sizeCameron;

    // Diâmetro do círculo branco menor (10% menor)
    var smallerWhiteCircleDiameter = blackCircleDiameter * 0.9;

    // Cria o círculo branco na camada padrão
    var whiteCircle = createWhiteCircle(0, 0, smallerWhiteCircleDiameter);

    // Cria o círculo preto na camada padrão
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Centraliza o círculo branco no círculo preto
    var centerX = blackCircle.position[0];
    var centerY = blackCircle.position[1];
    var whiteCircleOffsetX = (centerX + ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));
    var whiteCircleOffsetY = (centerY - ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));

    whiteCircle.position = [whiteCircleOffsetX, whiteCircleOffsetY];

    // Centraliza o retângulo vertical no círculo preto
    var verticalRectangleOffsetX = (centerX + ((sizeCameron / 2) - (rectangleWidth / 2)));
    var verticalRectangleOffsetY = centerY;

    verticalRectangle.position = [verticalRectangleOffsetX, verticalRectangleOffsetY];

    // Centraliza o retângulo horizontal no círculo preto
    var horizontalRectangleOffsetX = centerX;
    var horizontalRectangleOffsetY = -(centerY + ((sizeCameron / 2) - (rectangleWidth / 2)));

    horizontalRectangle.position = [horizontalRectangleOffsetX, horizontalRectangleOffsetY];

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(finalGroup, ElementPlacement.PLACEATEND);
    blackCircle.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    // Cria um novo grupo para conter os grupos duplicados
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);

    // Largura e altura do retângulo centralizado
    var rectangleWidthCentered = sizeCameron;
    var rectangleHeightCentered = cylinderSize;
    var rectangleWidth25Percent = rectangleWidthCentered * 0.15;

    // Posição do retângulo branco centralizado
    var rectangleX = mainGroup.position[0] + ((sizeCameron / 2) - (rectangleWidth25Percent / 2));
    var rectangleY = mainGroup.position[1] - (cylinderSize - 15); // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado branco no novo grupo
    var centeredRectangleWhite = createWhiteRectangle(rectangleX, rectangleY, rectangleWidth25Percent, rectangleHeightCentered);
    centeredRectangleWhite.move(mainGroup, ElementPlacement.PLACEATEND);


    // Posição do retângulo centralizado
    var rectangleX = mainGroup.position[0];
    var rectangleY = mainGroup.position[1] - cylinderSize; // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado no novo grupo
    var centeredRectangle = createBlackRectangle(rectangleX, rectangleY, rectangleWidthCentered, rectangleHeightCentered);
    centeredRectangle.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroup.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;

    // Definir a cor do texto para branco CMYK
    var whiteCMYK = new CMYKColor();
    whiteCMYK.cyan = 0;
    whiteCMYK.magenta = 0;
    whiteCMYK.yellow = 0;
    whiteCMYK.black = 0;

    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 5;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 5;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date());
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = whiteCMYK;
    texto.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);
    var grupoCores = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width + 20;
    var tamanhoLabelCores = 5
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 5;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("Geneva");
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoCores, ElementPlacement.PLACEATEND);

    }

    grupoCores.move(grupoLabel, ElementPlacement.PLACEATEND);

    grupoLabel.rotate(90);
    grupoLabel.top = -20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.left = distanceBetweenRectangles + 0.1;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoCores.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(grupoCores.geometricBounds[2], grupoCores.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = whiteCMYK;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoCores.height - retangulo.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    //criando o retangulo registration abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retanguloRegistration = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retanguloRegistration.rotate(90);
    retanguloRegistration.stroked = false;
    retanguloRegistration.filled = true;
    retanguloRegistration.fillColor = registrationColor;

    retanguloRegistration.position = [((sizeCameron - tamanhoLabel90) / 2), ((-40) - ((grupoCores.height - retangulo.height) / 2)) - grupoCores.height];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retanguloRegistration.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retanguloRegistration.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    //inserir CAC - Z
    var textoCac = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    textoCac.rotate(90);
    textoCac.contents = "Cliente: " + cac + " - " + nomeArte + " - " + "Cod = " + cpc;
    textoCac.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    textoCac.textRange.fillColor = whiteCMYK;
    textoCac.textRange.characterAttributes.textFont = app.textFonts.getByName("Arial-BoldMT");


    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        textoCac.position = [distanciaLabel, 20 + textoCac.height];
    } else if (pos == "CD" || pos == "D") {
        textoCac.position = [distanciaLabel + distanceBetweenRectangles, 20 + textoCac.height];
    } else if (pos == "C") {
        textoCac.position = [distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), 20 + textoCac.height];
    } else {

    }

    //criando o retangulo branco abaixo do CAC
    var white = new CMYKColor();
    var textoHeightPorcentCac = textoCac.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(textoCac.geometricBounds[2], textoCac.geometricBounds[1], textoHeightPorcentCac, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = registrationColor;
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), (20 + retangulo.height) - ((retangulo.height - textoCac.height) / 2)];
    } else if (pos == "CD" || pos == "D") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceBetweenRectangles, (20 + retangulo.height) - ((retangulo.height - textoCac.height) / 2)];
    } else if (pos == "C") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), (20 + retangulo.height) - ((retangulo.height - textoCac.height) / 2)];
    } else {

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    textoCac.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retanguloRegistration.move(grupoLabelFinal, ElementPlacement.PLACEATEND);


    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.2 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle((sizeCameron - larguraMarcaDeCorte), -((sizeCameron / 2) + (alturaMarceDeCorte / 2)), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    var grupoDuplicadoDireita = grupoDeRetangulos.duplicate();
    grupoDuplicadoDireita.left = grupoDeRetangulos.left + distanceBetweenRectangles + (larguraMarcaDeCorte - sizeCameron);

    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

        //Camerons Position
        if (pos == "E") {
            groupDuplicateRight.remove();
            cameronCentralGroup.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "D") {
            mainGroup.remove()
            cameronCentralGroup.remove();
            grupoDeRetangulos.remove();
        } else if (pos == "C") {
            mainGroup.remove()
            groupDuplicateRight.remove();
            grupoDeRetangulos.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "EC") {
            groupDuplicateRight.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "CD") {
            grupoDeRetangulos.remove();
            mainGroup.remove();
        } else if (pos == "ED") {
            cameronCentralGroup.remove();
        } else {

        }

        var alertMessage = "Montagem e Label feitos";

        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();


    }
}
//Ediprint
function montagemEdiprint() {

    if (sizeCameron > (0.5 / 0.35277777777782)) {
        // Largura dos retângulos (0,12mm em pontos)
        alert("aqui");
        var rectangleDiameter = sizeCameron;
        var rectangleWidth = 0.12 / 0.35277777777782;

        // Cria o primeiro retângulo na vertical (0,12mm x sizeCameron)
        var verticalRectangle = createBlackRectangle(0, 0, rectangleWidth, rectangleDiameter);

        // Cria o segundo retângulo na horizontal (sizeCameron x 0,12mm)
        var horizontalRectangle = createBlackRectangle(0, 0, rectangleDiameter, rectangleWidth);

        // Rotaciona o segundo retângulo em 0 graus
        horizontalRectangle.rotate(0);

        // Diâmetro do círculo preto maior (sizeCameron)
        var blackCircleDiameter = sizeCameron;

        // Diâmetro do círculo branco menor (10% menor)
        var smallerWhiteCircleDiameter = blackCircleDiameter * 0.8;

        // Cria o círculo branco na camada padrão
        var whiteCircle = createWhiteCircle(0, 0, smallerWhiteCircleDiameter);

        // Cria o círculo preto na camada padrão
        var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

        // Centraliza o círculo branco no círculo preto
        var centerX = blackCircle.position[0];
        var centerY = blackCircle.position[1];
        var whiteCircleOffsetX = (centerX + ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));
        var whiteCircleOffsetY = (centerY - ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));

        whiteCircle.position = [whiteCircleOffsetX, whiteCircleOffsetY];

        // Centraliza o retângulo vertical no círculo preto
        var verticalRectangleOffsetX = (centerX + ((sizeCameron / 2) - (rectangleWidth / 2)));
        var verticalRectangleOffsetY = centerY;

        verticalRectangle.position = [verticalRectangleOffsetX, verticalRectangleOffsetY];

        // Centraliza o retângulo horizontal no círculo preto
        var horizontalRectangleOffsetX = centerX;
        var horizontalRectangleOffsetY = -(centerY + ((sizeCameron / 2) - (rectangleWidth / 2)));

        horizontalRectangle.position = [horizontalRectangleOffsetX, horizontalRectangleOffsetY];

        // Cria grupo final e move os elementos para o grupo final
        var finalGroup = app.activeDocument.groupItems.add();
        verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
        horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
        whiteCircle.move(finalGroup, ElementPlacement.PLACEATEND);
        blackCircle.move(finalGroup, ElementPlacement.PLACEATEND);

        // Duplica o grupo para cima
        var groupDuplicateUp = finalGroup.duplicate();
        var distanceUp = (cylinderSize - sizeCameron) / 2 - 15;
        groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

        // Duplica o grupo para baixo
        var groupDuplicateDown = finalGroup.duplicate();
        var distanceDown = (cylinderSize - sizeCameron) / 2 - 15;
        groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

        // Cria um novo grupo para conter os grupos duplicados
        var mainGroup = app.activeDocument.groupItems.add();
        finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
        groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
        groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);

        // Largura e altura do retângulo centralizado
        var rectangleWidthCentered = sizeCameron;
        var rectangleHeightCentered = cylinderSize;
        var rectangleWidth25Percent = rectangleWidthCentered * 0.15;

        // Posição do retângulo branco centralizado
        var rectangleX = mainGroup.position[0] + ((sizeCameron / 2) - (rectangleWidth25Percent / 2));
        var rectangleY = mainGroup.position[1] - (cylinderSize - 15); // Adiciona a distância do cylinderSize à posição Y

        // Cria o retângulo centralizado branco no novo grupo
        var centeredRectangleWhite = createWhiteRectangle(rectangleX, rectangleY, rectangleWidth25Percent, rectangleHeightCentered);
        centeredRectangleWhite.move(mainGroup, ElementPlacement.PLACEATEND);


        // Posição do retângulo centralizado
        var rectangleX = mainGroup.position[0];
        var rectangleY = mainGroup.position[1] - cylinderSize; // Adiciona a distância do cylinderSize à posição Y

        // Cria o retângulo centralizado no novo grupo
        var centeredRectangle = createBlackRectangle(rectangleX, rectangleY, rectangleWidthCentered, rectangleHeightCentered);
        centeredRectangle.move(mainGroup, ElementPlacement.PLACEATEND);


        // Duplica o grupo para a direita
        var groupDuplicateRight = mainGroup.duplicate();
        groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

        // Criar um array para conter os grupos duplicados
        var cameronCentralGroup = [];

        // Criar um grupo para conter os objetos duplicados
        var cameronCentralGroup = app.activeDocument.groupItems.add();

        // Loop para duplicar e mover os objetos
        for (var i = 0; i < lanes - 1; i++) {
            var newGroupCameron = mainGroup.duplicate();
            var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
            newGroupCameron.translate(offsetX, 0);

            // Adicionar o grupo duplicado ao grupo cameronCentralGroup
            newGroupCameron.moveToBeginning(cameronCentralGroup);
        }

        // Renomear o grupo pai para "cameronCentralGroup"
        cameronCentralGroup.name = "cameronCentralGroup";


        //Centralizar Cameron Central
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
        cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;

        var circuloPretoCores = sizeCameron * 0.9;
        var distanciaPreto = 0.3;
        var yCoordPreto = 10 + (circuloPretoCores * 1.1);

        // Criar um grupo para círculos pretos
        var grupoCirculosColoridos = app.activeDocument.groupItems.add();

        // Loop para criar grupos de círculos coloridos e adicionar círculos
        for (var j = 0; j < cores.length; j++) {
            // Criar um grupo para círculos coloridos
            var novoGrupoCor = app.activeDocument.groupItems.add();
            novoGrupoCor.name = "grupoCor_" + (j + 1);

            // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
            var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
            circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
            yCoordPreto += distanciaPreto + circuloPretoCores;
            novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
        }

        var retanguloCirculosCores = createBlackRectangle(0, 0, sizeCameron, (grupoCirculosColoridos.height * 1.05));
        retanguloCirculosCores.top = retanguloCirculosCores.height + 10;

        retanguloCirculosCores.zOrder(ZOrderMethod.SENDBACKWARD);

        //inserir o label
        //padrão ALpha
        var texto = doc.textFrames.add();
        var tamanhoLabel = 5;
        if (tamanhoLabel >= sizeCameron) {
            tamanhoLabel = sizeCameron;
        } else {
            tamanhoLabel = 5;
        }
        var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
        texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - " + "Cod " + np + " - " + lpc + "lpc";
        texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        texto.position = [0, 0]

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width;
        var tamanhoLabelCores = 5
        if (tamanhoLabelCores >= sizeCameron) {
            tamanhoLabelCores = sizeCameron;
        } else {
            tamanhoLabelCores = 5;
        }

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = tamanhoLabelCores;
            corTexto.position = [xPosition, 0];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        grupoLabel.rotate(90);
        grupoLabel.top = -20;
        grupoLabel.left = distanciaLabel;

        // Posicione o texto conforme necessário baseado nas posições
        if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

        } else if (pos == "CD" || pos == "D") {
            grupoLabel.rotate(180);
            grupoLabel.left = distanceBetweenRectangles;
        } else if (pos == "C") {
            grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
        } else {

        }


        //criando o retangulo branco abaixo do label
        var white = new CMYKColor();
        var textoHeightPorcent = grupoLabel.height * 1.03;
        var tamanhoLabel90 = tamanhoLabel * 0.9;
        if (tamanhoLabel90 >= sizeCameron) {
            tamanhoLabel90 = sizeCameron
        } else {
            var tamanhoLabel90 = tamanhoLabel * 0.9;
        }
        var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
        retangulo.rotate(90);
        retangulo.stroked = false;
        retangulo.filled = true;
        retangulo.fillColor = white;

        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoLabel.height - retangulo.height) / 2))];
        // Posicione o retangulo conforme necessário baseado nas posições
        if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

        } else if (pos == "CD" || pos == "D") {
            retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
        } else if (pos == "C") {
            retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

        }

        var grupoLabelFinal = app.activeDocument.groupItems.add();
        grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
        retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);

        //marcar de corte cameron
        var larguraMarcaDeCorte = sizeCameron * 1.5;
        var alturaMarceDeCorte = 0.1 / 0.35277777777782;
        var marcaDeCorte = createBlackRectangle((sizeCameron - larguraMarcaDeCorte), (-alturaMarceDeCorte / 2) - sizeCameron / 2, larguraMarcaDeCorte, alturaMarceDeCorte);

        // Duplicar o objeto para cima
        var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
        marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

        // Agrupar os dois retângulos
        var grupoDeRetangulos = app.activeDocument.groupItems.add();
        marcaDeCorte.moveToBeginning(grupoDeRetangulos);
        marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

        // Mover o grupo para baixo usando a variável cylinderSize / 2
        grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

        var grupoDuplicadoDireita = grupoDeRetangulos.duplicate();
        grupoDuplicadoDireita.left = distanceBetweenRectangles;
    } else {
        // Variaveis dos registros
        var larguraRetanguloRegistros = 0.12 / 0.35277777777782;
        var diametroCirculoBrancoMenor = 0.85 / 0.35277777777782;
        var diametroCirculoPreto = 1 / 0.35277777777782;
        var diametroCirculoBrancoMaior = 1 / 0.35277777777782;
        var retangleBrancoLargura = sizeCameron * 0.15;
        var larguraCameronCentral = 0.5 / 0.35277777777782;

        //Criando os registros
        var circuloBrancoMaior = createWhiteCircle(0, (diametroCirculoBrancoMaior / 2), diametroCirculoBrancoMaior);
        var circuloPreto = createBlackCircle((diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, (diametroCirculoPreto / 2), diametroCirculoPreto);
        var circuloBrancoMenor = createWhiteCircle((diametroCirculoBrancoMaior - diametroCirculoBrancoMenor) / 2, (diametroCirculoBrancoMenor / 2), diametroCirculoBrancoMenor);
        var retanguloVerticalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
        var retanguloHorizontalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
        retanguloHorizontalRegistros.rotate(90);
        retanguloHorizontalRegistros.position = [(diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, larguraRetanguloRegistros / 2];
        retanguloVerticalRegistros.position = [(diametroCirculoBrancoMaior - larguraRetanguloRegistros) / 2, diametroCirculoPreto / 2];
        var cameron = createBlackRectangle((diametroCirculoBrancoMaior - sizeCameron) / 2, -cylinderSize / 2, sizeCameron, cylinderSize);
        var brancoCameron = createWhiteRectangle((diametroCirculoBrancoMaior - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

        // Cria grupo final e move os elementos para o grupo final
        var finalGroup = app.activeDocument.groupItems.add();
        retanguloVerticalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
        retanguloHorizontalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
        circuloBrancoMenor.move(finalGroup, ElementPlacement.PLACEATEND);
        circuloPreto.move(finalGroup, ElementPlacement.PLACEATEND);
        circuloBrancoMaior.move(finalGroup, ElementPlacement.PLACEATEND);

        // Duplica o grupo para cima
        var groupDuplicateUp = finalGroup.duplicate();
        var distanceUp = (cylinderSize - sizeCameron) / 2 - 19.06;
        groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

        // Duplica o grupo para baixo
        var groupDuplicateDown = finalGroup.duplicate();
        var distanceDown = (cylinderSize - sizeCameron) / 2 - 19.06;
        groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

        //Grupo do Cameron
        var mainGroup = app.activeDocument.groupItems.add();
        groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
        groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);
        finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
        brancoCameron.move(mainGroup, ElementPlacement.PLACEATEND);
        cameron.move(mainGroup, ElementPlacement.PLACEATEND);

        // Duplica o grupo para a direita
        var groupDuplicateRight = mainGroup.duplicate();
        groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

        //Criando os registros para cameron central
        var circuloBrancoMaiorCentral = createWhiteCircle(0, (diametroCirculoBrancoMaior / 2), diametroCirculoBrancoMaior);
        var circuloPretoCentral = createBlackCircle((diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, (diametroCirculoPreto / 2), diametroCirculoPreto);
        var circuloBrancoMenorCentral = createWhiteCircle((diametroCirculoBrancoMaior - diametroCirculoBrancoMenor) / 2, (diametroCirculoBrancoMenor / 2), diametroCirculoBrancoMenor);
        var retanguloVerticalRegistrosCentral = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
        var retanguloHorizontalRegistrosCentral = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
        retanguloHorizontalRegistrosCentral.rotate(90);
        retanguloHorizontalRegistrosCentral.position = [(diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, larguraRetanguloRegistros / 2];
        retanguloVerticalRegistrosCentral.position = [(diametroCirculoBrancoMaior - larguraRetanguloRegistros) / 2, diametroCirculoPreto / 2];
        var cameronCentral = createBlackRectangle((diametroCirculoBrancoMaior - larguraCameronCentral) / 2, -cylinderSize / 2, larguraCameronCentral, cylinderSize);
        var brancoCameronCentral = createWhiteRectangle((diametroCirculoBrancoMaior - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

        // Cria grupo final e move os elementos para o grupo final
        var finalGroupCentral = app.activeDocument.groupItems.add();
        retanguloVerticalRegistrosCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
        retanguloHorizontalRegistrosCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
        circuloBrancoMenorCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
        circuloPretoCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
        circuloBrancoMaiorCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);

        // Duplica o grupo para cima Central
        var groupDuplicateUpCentral = finalGroupCentral.duplicate();
        var distanceUp = ((cylinderSize - sizeCameron) / 2) - 19.06;
        groupDuplicateUpCentral.position = [finalGroupCentral.position[0], finalGroupCentral.position[1] - distanceUp];

        // Duplica o grupo para baixo Central
        var groupDuplicateDownCentral = finalGroupCentral.duplicate();
        var distanceDown = ((cylinderSize - sizeCameron) / 2) - 19.06;
        groupDuplicateDownCentral.position = [finalGroupCentral.position[0], finalGroupCentral.position[1] + distanceDown];

        //Grupo do Cameron Central
        var mainGroupCentral = app.activeDocument.groupItems.add();
        groupDuplicateUpCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
        groupDuplicateDownCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
        finalGroupCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
        brancoCameronCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
        cameronCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);

        // Criar um array para conter os grupos duplicados
        var cameronCentralGroup = [];

        // Criar um grupo para conter os objetos duplicados
        var cameronCentralGroup = app.activeDocument.groupItems.add();

        // Loop para duplicar e mover os objetos
        for (var i = 0; i < lanes - 1; i++) {
            var newGroupCameron = mainGroupCentral.duplicate();
            var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
            newGroupCameron.translate(offsetX, 0);

            // Adicionar o grupo duplicado ao grupo cameronCentralGroup
            newGroupCameron.moveToBeginning(cameronCentralGroup);
        }

        // Renomear o grupo pai para "cameronCentralGroup"
        cameronCentralGroup.name = "cameronCentralGroup";

        var circuloPretoCores = sizeCameron * 0.9;
        var distanciaPreto = 0.3;
        var yCoordPreto = 10 + (circuloPretoCores * 1.1);

        // Criar um grupo para círculos pretos
        var grupoCirculosColoridos = app.activeDocument.groupItems.add();

        // Loop para criar grupos de círculos coloridos e adicionar círculos
        for (var j = 0; j < cores.length; j++) {
            // Criar um grupo para círculos coloridos
            var novoGrupoCor = app.activeDocument.groupItems.add();
            novoGrupoCor.name = "grupoCor_" + (j + 1);

            // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
            var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
            circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
            yCoordPreto += distanciaPreto + circuloPretoCores;
            novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
        }

        var retanguloCirculosCores = createBlackRectangle(0, 0, sizeCameron, (grupoCirculosColoridos.height * 1.05));
        retanguloCirculosCores.top = retanguloCirculosCores.height + 10;

        retanguloCirculosCores.left = 0.25 / 0.35277777777782;
        grupoCirculosColoridos.left = 0.275 / 0.35277777777782;



        retanguloCirculosCores.zOrder(ZOrderMethod.SENDBACKWARD);

        //inserir o label
        //padrão ALpha
        var texto = doc.textFrames.add();
        var tamanhoLabel = 5;
        if (tamanhoLabel >= sizeCameron) {
            tamanhoLabel = sizeCameron;
        } else {
            tamanhoLabel = 5;
        }
        var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
        texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - " + "Cod " + np + " - " + lpc + "lpc";
        texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
        texto.textRange.fillColor = registrationColor;
        texto.position = [0, 0]

        // Crie um objeto de texto para cada parte de cores
        var coresTexto = [];

        for (var i = 0; i < cores.length; i++) {
            var corTexto = doc.textFrames.add();
            corTexto.contents = cores[i];
            coresTexto.push(corTexto);
        }

        // Aplique a cor a cada parte do texto com base na sequência de coresComuns
        for (var i = 0; i < coresComuns.length; i++) {
            aplicarCorTexto(coresTexto[i], coresComuns[i]);
        }

        var grupoLabel = app.activeDocument.groupItems.add();
        texto.move(grupoLabel, ElementPlacement.PLACEATEND);

        // Combine todas as partes do texto em um único objeto de texto
        var textoCores = doc.textFrames.add();
        var xPosition = texto.width;
        var tamanhoLabelCores = 5
        if (tamanhoLabelCores >= sizeCameron) {
            tamanhoLabelCores = sizeCameron;
        } else {
            tamanhoLabelCores = 5;
        }

        for (var i = 0; i < coresTexto.length; i++) {
            var corTexto = coresTexto[i];
            corTexto.textRange.size = tamanhoLabelCores;
            corTexto.position = [xPosition, 0];
            xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
            corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

        }

        grupoLabel.rotate(90);
        grupoLabel.top = -20;
        grupoLabel.left = distanciaLabel;

        // Posicione o texto conforme necessário baseado nas posições
        if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

        } else if (pos == "CD" || pos == "D") {
            grupoLabel.rotate(180);
            grupoLabel.left = distanceBetweenRectangles;
        } else if (pos == "C") {
            grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
        } else {

        }


        //criando o retangulo branco abaixo do label
        var white = new CMYKColor();
        var textoHeightPorcent = grupoLabel.height * 1.03;
        var tamanhoLabel90 = tamanhoLabel * 0.9;
        if (tamanhoLabel90 >= sizeCameron) {
            tamanhoLabel90 = sizeCameron
        } else {
            var tamanhoLabel90 = tamanhoLabel * 0.9;
        }
        var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
        retangulo.rotate(90);
        retangulo.stroked = false;
        retangulo.filled = true;
        retangulo.fillColor = white;

        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoLabel.height - retangulo.height) / 2))];
        // Posicione o retangulo conforme necessário baseado nas posições
        if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

        } else if (pos == "CD" || pos == "D") {
            retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
        } else if (pos == "C") {
            retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

        }

        var grupoLabelFinal = app.activeDocument.groupItems.add();
        grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
        retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);

        grupoLabelFinal.left = 0.25 / 0.35277777777782;



        //marcar de corte cameron
        var larguraMarcaDeCorte = sizeCameron * 1.5;
        var alturaMarceDeCorte = 0.1 / 0.35277777777782;
        var marcaDeCorte = createBlackRectangle((sizeCameron - larguraMarcaDeCorte), (-alturaMarceDeCorte / 2), larguraMarcaDeCorte, alturaMarceDeCorte);
        marcaDeCorte.left = 0;

        // Duplicar o objeto para cima
        var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
        marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

        // Agrupar os dois retângulos
        var grupoDeRetangulos = app.activeDocument.groupItems.add();
        marcaDeCorte.moveToBeginning(grupoDeRetangulos);
        marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

        // Mover o grupo para baixo usando a variável cylinderSize / 2
        grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

        var grupoDuplicadoDireita = grupoDeRetangulos.duplicate();
        grupoDuplicadoDireita.left = distanceBetweenRectangles + 0.25 / 0.35277777777782;
    }



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

        //Camerons Position
        if (pos == "E") {
            groupDuplicateRight.remove();
            cameronCentralGroup.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "D") {
            mainGroup.remove()
            cameronCentralGroup.remove();
            grupoDeRetangulos.remove();
        } else if (pos == "C") {
            mainGroup.remove()
            groupDuplicateRight.remove();
            grupoDeRetangulos.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "EC") {
            groupDuplicateRight.remove();
            grupoDuplicadoDireita.remove();
        } else if (pos == "CD") {
            grupoDeRetangulos.remove();
            mainGroup.remove();
        } else if (pos == "ED") {
            cameronCentralGroup.remove();
        } else {

        }

        var alertMessage = "Montagem e Label feitos";

        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();


    }
}
//GadeGraff
function montagemGadeGraff() {
    // Largura dos retângulos (0,12mm em pontos)
    var rectangleDiameter = sizeCameron;
    var rectangleWidth = 0.12 / 0.35277777777782;

    // Cria o primeiro retângulo na vertical (0,12mm x sizeCameron)
    var verticalRectangle = createBlackRectangle(0, 0, rectangleWidth, rectangleDiameter);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,12mm)
    var horizontalRectangle = createBlackRectangle(0, 0, rectangleDiameter, rectangleWidth);

    // Rotaciona o segundo retângulo em 0 graus
    horizontalRectangle.rotate(0);

    // Diâmetro do círculo preto maior (sizeCameron)
    var blackCircleDiameter = sizeCameron;

    // Diâmetro do círculo branco menor (10% menor)
    var smallerWhiteCircleDiameter = blackCircleDiameter * 0.8;

    // Cria o círculo branco na camada padrão
    var whiteCircle = createWhiteCircle(0, 0, smallerWhiteCircleDiameter);

    // Cria o círculo preto na camada padrão
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Centraliza o círculo branco no círculo preto
    var centerX = blackCircle.position[0];
    var centerY = blackCircle.position[1];
    var whiteCircleOffsetX = (centerX + ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));
    var whiteCircleOffsetY = (centerY - ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));

    whiteCircle.position = [whiteCircleOffsetX, whiteCircleOffsetY];

    // Centraliza o retângulo vertical no círculo preto
    var verticalRectangleOffsetX = (centerX + ((sizeCameron / 2) - (rectangleWidth / 2)));
    var verticalRectangleOffsetY = centerY;

    verticalRectangle.position = [verticalRectangleOffsetX, verticalRectangleOffsetY];

    // Centraliza o retângulo horizontal no círculo preto
    var horizontalRectangleOffsetX = centerX;
    var horizontalRectangleOffsetY = -(centerY + ((sizeCameron / 2) - (rectangleWidth / 2)));

    horizontalRectangle.position = [horizontalRectangleOffsetX, horizontalRectangleOffsetY];

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(finalGroup, ElementPlacement.PLACEATEND);
    blackCircle.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    // Cria um novo grupo para conter os grupos duplicados
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);

    // Largura e altura do retângulo centralizado
    var rectangleWidthCentered = sizeCameron;
    var rectangleHeightCentered = cylinderSize;
    var rectangleWidth25Percent = rectangleWidthCentered * 0.15;

    // Posição do retângulo branco centralizado
    var rectangleX = mainGroup.position[0] + ((sizeCameron / 2) - (rectangleWidth25Percent / 2));
    var rectangleY = mainGroup.position[1] - (cylinderSize - 15); // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado branco no novo grupo
    var centeredRectangleWhite = createWhiteRectangle(rectangleX, rectangleY, rectangleWidth25Percent, rectangleHeightCentered);
    centeredRectangleWhite.move(mainGroup, ElementPlacement.PLACEATEND);


    // Posição do retângulo centralizado
    var rectangleX = mainGroup.position[0];
    var rectangleY = mainGroup.position[1] - cylinderSize; // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado no novo grupo
    var centeredRectangle = createBlackRectangle(rectangleX, rectangleY, rectangleWidthCentered, rectangleHeightCentered);
    // Crie uma cor de spot com 50% de "PassarRegistration"
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 50;
    centeredRectangle.fillColor = spotColorFill;

    centeredRectangle.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroup.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;

    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 5;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 5;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width;
    var tamanhoLabelCores = 5
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 5;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = -20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoLabel.height - retangulo.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

        //Camerons Position
        if (pos == "E") {
            groupDuplicateRight.remove();
            cameronCentralGroup.remove();
        } else if (pos == "D") {
            mainGroup.remove()
            cameronCentralGroup.remove();
        } else if (pos == "C") {
            mainGroup.remove()
            groupDuplicateRight.remove();
            grupoDeRetangulos.remove();
        } else if (pos == "EC") {
            groupDuplicateRight.remove();
        } else if (pos == "CD") {
            mainGroup.remove();
        } else if (pos == "ED") {
            cameronCentralGroup.remove();
        } else {

        }

        var alertMessage = "Montagem e Label feitos";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();


    }
}
//Interpack
function montagemInterpack() {
    // Largura dos retângulos (0,12mm em pontos)
    var rectangleDiameter = sizeCameron;
    var rectangleWidth = 0.12 / 0.35277777777782;
    var circuloBrancoCores = 1.435 / 0.35277777777782;
    var circuloPretoCores = 1.148 / 0.35277777777782;
    var distanciaBranco = 0.57 / 0.35277777777782;
    var distanciaPreto = 0.857 / 0.35277777777782;

    // Cria o primeiro retângulo na vertical (0,12mm x sizeCameron)
    var verticalRectangle = createBlackRectangle(0, 0, rectangleWidth, rectangleDiameter);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,12mm)
    var horizontalRectangle = createBlackRectangle(0, 0, rectangleDiameter, rectangleWidth);

    // Rotaciona o segundo retângulo em 0 graus
    horizontalRectangle.rotate(0);

    // Diâmetro do círculo preto maior (sizeCameron)
    var blackCircleDiameter = sizeCameron;

    // Diâmetro do círculo branco menor (10% menor)
    var smallerWhiteCircleDiameter = blackCircleDiameter * 0.8;

    // Cria o círculo branco na camada padrão
    var whiteCircle = createWhiteCircle(0, 0, smallerWhiteCircleDiameter);

    // Cria o círculo preto na camada padrão
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Centraliza o círculo branco no círculo preto
    var centerX = blackCircle.position[0];
    var centerY = blackCircle.position[1];
    var whiteCircleOffsetX = (centerX + ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));
    var whiteCircleOffsetY = (centerY - ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));

    whiteCircle.position = [whiteCircleOffsetX, whiteCircleOffsetY];

    // Centraliza o retângulo vertical no círculo preto
    var verticalRectangleOffsetX = (centerX + ((sizeCameron / 2) - (rectangleWidth / 2)));
    var verticalRectangleOffsetY = centerY;

    verticalRectangle.position = [verticalRectangleOffsetX, verticalRectangleOffsetY];

    // Centraliza o retângulo horizontal no círculo preto
    var horizontalRectangleOffsetX = centerX;
    var horizontalRectangleOffsetY = -(centerY + ((sizeCameron / 2) - (rectangleWidth / 2)));

    horizontalRectangle.position = [horizontalRectangleOffsetX, horizontalRectangleOffsetY];

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(finalGroup, ElementPlacement.PLACEATEND);
    blackCircle.move(finalGroup, ElementPlacement.PLACEATEND);

    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 30);
    var yCoordPreto = -((cylinderSize / 2 - 30) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }

    //Grupo dos Circulos das Cores
    var circulosCores = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(circulosCores, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(circulosCores, ElementPlacement.PLACEATEND);

    // Definir as coordenadas para mover o grupo para a posição desejada
    var novaPosicaoX = ((sizeCameron - circuloBrancoCores) / 2);
    var novaPosicaoY = circulosCores.height / 2;

    // Mover o grupo para a nova posição
    circulosCores.translate(novaPosicaoX - circulosCores.position[0], novaPosicaoY - circulosCores.position[1]);

    var grupoDuplicadoDireitaCores = circulosCores.duplicate();

    // Calcula os valores de deslocamento
    var moveDownValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + sizeCameron));
    var moveUpValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + sizeCameron));

    // Move o grupo circulosCores para baixo
    circulosCores.translate(0, -moveDownValue);


    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    // Cria um novo grupo para conter os grupos duplicados
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);

    // Largura e altura do retângulo centralizado
    var rectangleWidthCentered = sizeCameron;
    var rectangleHeightCentered = cylinderSize;
    var rectangleWidth25Percent = rectangleWidthCentered * 0.15;

    // Posição do retângulo branco centralizado
    var rectangleX = mainGroup.position[0] + ((sizeCameron / 2) - (rectangleWidth25Percent / 2));
    var rectangleY = mainGroup.position[1] - (cylinderSize - 15); // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado branco no novo grupo
    var centeredRectangleWhite = createWhiteRectangle(rectangleX, rectangleY, rectangleWidth25Percent, rectangleHeightCentered);
    centeredRectangleWhite.move(mainGroup, ElementPlacement.PLACEATEND);


    // Posição do retângulo centralizado
    var rectangleX = mainGroup.position[0];
    var rectangleY = mainGroup.position[1] - cylinderSize; // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado no novo grupo
    var centeredRectangle = createBlackRectangle(rectangleX, rectangleY, rectangleWidthCentered, rectangleHeightCentered);
    // Crie uma cor de spot com 40% de "PassarRegistration"
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 40;
    centeredRectangle.fillColor = spotColorFill;

    centeredRectangle.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroup.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;

    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 5;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 5;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + cac + " - " + produto + " - " + formatarData(new Date()) + " - ";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width;
    var tamanhoLabelCores = 5
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 5;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = -20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoLabel.height - retangulo.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);

    circulosCores.zOrder(ZOrderMethod.BRINGTOFRONT);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

        //Camerons Position
        if (pos == "E") {
            groupDuplicateRight.remove();
            cameronCentralGroup.remove();
        } else if (pos == "D") {
            mainGroup.remove()
            cameronCentralGroup.remove();
        } else if (pos == "C") {
            mainGroup.remove()
            groupDuplicateRight.remove();
            grupoDeRetangulos.remove();
        } else if (pos == "EC") {
            groupDuplicateRight.remove();
        } else if (pos == "CD") {
            mainGroup.remove();
        } else if (pos == "ED") {
            cameronCentralGroup.remove();
        } else {

        }

        var alertMessage = "Montagem e Label feitos";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();


    }
}
//D&APrint
function montagemDeAPrint() {
    // Variaveis dos registros
    var alturaRetanguloBranco = 2.869 / 0.35277777777782;
    var larguraRetanguloRegistros = 0.08 / 0.35277777777782;
    var diametroCirculoBrancoMenor = 1.55 / 0.35277777777782;
    var diametroCirculoPreto = 1.722 / 0.35277777777782;
    var diametroMicropontoPreto = 0.287 / 0.35277777777782;
    var diametroMicropontoBranco = 0.114 / 0.35277777777782;
    var retangleBrancoLargura = 0.29 / 0.35277777777782;
    var circuloBrancoCores = 1.435 / 0.35277777777782;
    var circuloPretoCores = 1.148 / 0.35277777777782;
    var distanciaBranco = 0.57 / 0.35277777777782;
    var distanciaPreto = 0.857 / 0.35277777777782;

    if (sizeCameron < (2 / 0.35277777777782)) {
        var alturaRetanguloBranco = alturaRetanguloBranco * 0.75;
        var larguraRetanguloRegistros = larguraRetanguloRegistros * 0.75;
        var diametroCirculoBrancoMenor = diametroCirculoBrancoMenor * 0.75;
        var diametroCirculoPreto = diametroCirculoPreto * 0.75;
        var diametroMicropontoPreto = diametroMicropontoPreto * 0.75;
        var diametroMicropontoBranco = diametroMicropontoBranco * 0.75;
        var retangleBrancoLargura = retangleBrancoLargura * 0.75;
        var circuloBrancoCores = circuloBrancoCores * 0.75;
        var circuloPretoCores = circuloPretoCores * 0.75;
        var distanciaBranco = 0.43 / 0.35277777777782;
        var distanciaPreto = 0.647 / 0.35277777777782;
    } else {
        //alert("size cameron =" + sizeCameron + isNaN(sizeCameron))
    }

    // Criando os registros
    var retanguloBranco = createWhiteRectangle(0, -alturaRetanguloBranco / 2, sizeCameron, alturaRetanguloBranco);
    var circuloPreto = createBlackCircle(((sizeCameron - diametroCirculoPreto) / 2), diametroCirculoPreto / 2, diametroCirculoPreto);
    var circuloBranco = createWhiteCircle(((sizeCameron - diametroCirculoBrancoMenor) / 2), diametroCirculoBrancoMenor / 2, diametroCirculoBrancoMenor);
    var retanguloVerticalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, alturaRetanguloBranco);
    var retanguloHorizontalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, sizeCameron);
    retanguloHorizontalRegistros.rotate(90);
    retanguloHorizontalRegistros.position = [0, larguraRetanguloRegistros / 2];
    retanguloVerticalRegistros.position = [(sizeCameron - larguraRetanguloRegistros) / 2, alturaRetanguloBranco / 2];
    var circuloPretoMicroponto = createBlackCircle(sizeCameron + 0.6236, diametroMicropontoPreto / 2, diametroMicropontoPreto);
    var circuloBrancoMicroponto = createWhiteCircle(sizeCameron + 0.6236 + ((diametroMicropontoPreto - diametroMicropontoBranco) / 2), diametroMicropontoBranco / 2, diametroMicropontoBranco);
    var cameron = createBlackRectangle(0, -cylinderSize / 2, sizeCameron, cylinderSize);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 30;
    cameron.fillColor = spotColorFill;
    var brancoCameron = createWhiteRectangle((sizeCameron - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    retanguloVerticalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloHorizontalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBranco.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPreto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPretoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloBranco.move(finalGroup, ElementPlacement.PLACEATEND);


    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.115 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle(0, -(alturaMarceDeCorte / 2), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 30);
    var yCoordPreto = -((cylinderSize / 2 - 30) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }


    //Grupo do Cameron
    var mainGroup = app.activeDocument.groupItems.add();
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    grupoDeRetangulos.move(mainGroup, ElementPlacement.PLACEATEND);
    brancoCameron.move(mainGroup, ElementPlacement.PLACEATEND);
    cameron.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles - (larguraMarcaDeCorte - sizeCameron), mainGroup.position[1]];
    groupDuplicateRight.rotate(180);

    //Grupo dos Circulos das Cores
    var circulosCores = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(circulosCores, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(circulosCores, ElementPlacement.PLACEATEND);

    // Definir as coordenadas para mover o grupo para a posição desejada
    var novaPosicaoX = ((sizeCameron - circuloBrancoCores) / 2);
    var novaPosicaoY = circulosCores.height / 2;

    // Mover o grupo para a nova posição
    circulosCores.translate(novaPosicaoX - circulosCores.position[0], novaPosicaoY - circulosCores.position[1]);

    var grupoDuplicadoDireitaCores = circulosCores.duplicate();

    // Calcula os valores de deslocamento
    var moveDownValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));
    var moveUpValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));

    // Move o grupo circulosCores para baixo
    circulosCores.translate(0, -moveDownValue);

    // Move o grupo grupoDuplicadoDireitaCores para cima
    grupoDuplicadoDireitaCores.translate(0, moveUpValue);

    grupoDuplicadoDireitaCores.left = distanceBetweenRectangles + ((sizeCameron - circuloBrancoCores) / 2);

    //inserir o label 
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - " + lpc + "lpc" + " - " + "ALPHA";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;


    // Posicione o texto conforme necessário baseado nas posições
    texto.position = [distanciaLabel, -20];

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    // Posicione o retangulo conforme necessário baseado nas posições
    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];


    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j]) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//Digilabel
function montagemDigilabel() {
    // Largura dos retângulos (0,12mm em pontos)
    var rectangleDiameter = sizeCameron;
    var rectangleWidth = 0.12 / 0.35277777777782;

    // Cria o primeiro retângulo na vertical (0,12mm x sizeCameron)
    var verticalRectangle = createBlackRectangle(0, 0, rectangleWidth, rectangleDiameter);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,12mm)
    var horizontalRectangle = createBlackRectangle(0, 0, rectangleDiameter, rectangleWidth);

    // Rotaciona o segundo retângulo em 0 graus
    horizontalRectangle.rotate(0);

    // Diâmetro do círculo preto maior (sizeCameron)
    var blackCircleDiameter = sizeCameron;

    // Diâmetro do círculo branco menor (10% menor)
    var smallerWhiteCircleDiameter = blackCircleDiameter * 0.8;

    // Cria o círculo branco na camada padrão
    var whiteCircle = createWhiteCircle(0, 0, smallerWhiteCircleDiameter);

    // Cria o círculo preto na camada padrão
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Centraliza o círculo branco no círculo preto
    var centerX = blackCircle.position[0];
    var centerY = blackCircle.position[1];
    var whiteCircleOffsetX = (centerX + ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));
    var whiteCircleOffsetY = (centerY - ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));

    whiteCircle.position = [whiteCircleOffsetX, whiteCircleOffsetY];

    // Centraliza o retângulo vertical no círculo preto
    var verticalRectangleOffsetX = (centerX + ((sizeCameron / 2) - (rectangleWidth / 2)));
    var verticalRectangleOffsetY = centerY;

    verticalRectangle.position = [verticalRectangleOffsetX, verticalRectangleOffsetY];

    // Centraliza o retângulo horizontal no círculo preto
    var horizontalRectangleOffsetX = centerX;
    var horizontalRectangleOffsetY = -(centerY + ((sizeCameron / 2) - (rectangleWidth / 2)));

    horizontalRectangle.position = [horizontalRectangleOffsetX, horizontalRectangleOffsetY];

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(finalGroup, ElementPlacement.PLACEATEND);
    blackCircle.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    // Cria um novo grupo para conter os grupos duplicados
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);

    // Largura e altura do retângulo centralizado
    var rectangleWidthCentered = sizeCameron;
    var rectangleHeightCentered = cylinderSize;
    var rectangleWidth25Percent = rectangleWidthCentered * 0.15;

    // Posição do retângulo branco centralizado
    var rectangleX = mainGroup.position[0] + ((sizeCameron / 2) - (rectangleWidth25Percent / 2));
    var rectangleY = mainGroup.position[1] - (cylinderSize - 15); // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado branco no novo grupo
    var centeredRectangleWhite = createWhiteRectangle(rectangleX, rectangleY, rectangleWidth25Percent, rectangleHeightCentered);
    centeredRectangleWhite.move(mainGroup, ElementPlacement.PLACEATEND);


    // Posição do retângulo centralizado
    var rectangleX = mainGroup.position[0];
    var rectangleY = mainGroup.position[1] - cylinderSize; // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado no novo grupo
    var centeredRectangle = createBlackRectangle(rectangleX, rectangleY, rectangleWidthCentered, rectangleHeightCentered);
    centeredRectangle.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroup.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;



    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }


    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = -20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoLabel.height - retangulo.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);


    //inserir CAC - Z
    var textoCac = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    textoCac.rotate(90);
    textoCac.contents = cpc;
    textoCac.textRange.characterAttributes.size = tamanhoLabel;
    textoCac.textRange.fillColor = registrationColor;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        textoCac.position = [distanciaLabel, 20];
    } else if (pos == "CD" || pos == "D") {
        textoCac.rotate(180);
        textoCac.position = [distanciaLabel + distanceBetweenRectangles, 20];
    } else if (pos == "C") {
        textoCac.position = [distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), 20];
    } else {

    }

    //criando o retangulo branco abaixo do CAC
    var white = new CMYKColor();
    var textoHeightPorcentCac = textoCac.height * 1.05;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(textoCac.geometricBounds[2], textoCac.geometricBounds[1], textoHeightPorcentCac, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;
    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), (20 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), (20 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    } else if (pos == "CD" || pos == "D") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceBetweenRectangles, (20 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    } else if (pos == "C") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), (20 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    } else {

    }


    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.2 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle((sizeCameron - larguraMarcaDeCorte), -((sizeCameron / 2) + (alturaMarceDeCorte / 2)), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    var grupoDuplicadoDireita = grupoDeRetangulos.duplicate();
    grupoDuplicadoDireita.left = grupoDeRetangulos.left + distanceBetweenRectangles + (larguraMarcaDeCorte - sizeCameron);


    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    //Camerons Position
    if (pos == "E") {
        groupDuplicateRight.remove();
        cameronCentralGroup.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "D") {
        mainGroup.remove()
        cameronCentralGroup.remove();
        grupoDeRetangulos.remove();
    } else if (pos == "C") {
        mainGroup.remove()
        groupDuplicateRight.remove();
        grupoDeRetangulos.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "EC") {
        groupDuplicateRight.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "CD") {
        grupoDeRetangulos.remove();
        mainGroup.remove();
    } else if (pos == "ED") {
        cameronCentralGroup.remove();
    } else {

    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//Digilabel
function montagemCimed() {
    // Largura dos retângulos (0,12mm em pontos)
    var rectangleDiameter = sizeCameron;
    var rectangleWidth = 0.12 / 0.35277777777782;

    // Cria o primeiro retângulo na vertical (0,12mm x sizeCameron)
    var verticalRectangle = createBlackRectangle(0, 0, rectangleWidth, rectangleDiameter);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,12mm)
    var horizontalRectangle = createBlackRectangle(0, 0, rectangleDiameter, rectangleWidth);

    // Rotaciona o segundo retângulo em 0 graus
    horizontalRectangle.rotate(0);

    // Diâmetro do círculo preto maior (sizeCameron)
    var blackCircleDiameter = sizeCameron;

    // Diâmetro do círculo branco menor (10% menor)
    var smallerWhiteCircleDiameter = blackCircleDiameter * 0.8;

    // Cria o círculo branco na camada padrão
    var whiteCircle = createWhiteCircle(0, 0, smallerWhiteCircleDiameter);

    // Cria o círculo preto na camada padrão
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Centraliza o círculo branco no círculo preto
    var centerX = blackCircle.position[0];
    var centerY = blackCircle.position[1];
    var whiteCircleOffsetX = (centerX + ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));
    var whiteCircleOffsetY = (centerY - ((blackCircleDiameter - smallerWhiteCircleDiameter) / 2));

    whiteCircle.position = [whiteCircleOffsetX, whiteCircleOffsetY];

    // Centraliza o retângulo vertical no círculo preto
    var verticalRectangleOffsetX = (centerX + ((sizeCameron / 2) - (rectangleWidth / 2)));
    var verticalRectangleOffsetY = centerY;

    verticalRectangle.position = [verticalRectangleOffsetX, verticalRectangleOffsetY];

    // Centraliza o retângulo horizontal no círculo preto
    var horizontalRectangleOffsetX = centerX;
    var horizontalRectangleOffsetY = -(centerY + ((sizeCameron / 2) - (rectangleWidth / 2)));

    horizontalRectangle.position = [horizontalRectangleOffsetX, horizontalRectangleOffsetY];

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    verticalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(finalGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(finalGroup, ElementPlacement.PLACEATEND);
    blackCircle.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 15;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    // Cria um novo grupo para conter os grupos duplicados
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);

    // Largura e altura do retângulo centralizado
    var rectangleWidthCentered = sizeCameron;
    var rectangleHeightCentered = cylinderSize;
    var rectangleWidth25Percent = rectangleWidthCentered * 0.15;

    // Posição do retângulo branco centralizado
    var rectangleX = mainGroup.position[0] + ((sizeCameron / 2) - (rectangleWidth25Percent / 2));
    var rectangleY = mainGroup.position[1] - (cylinderSize - 15); // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado branco no novo grupo
    var centeredRectangleWhite = createWhiteRectangle(rectangleX, rectangleY, rectangleWidth25Percent, rectangleHeightCentered);
    centeredRectangleWhite.move(mainGroup, ElementPlacement.PLACEATEND);


    // Posição do retângulo centralizado
    var rectangleX = mainGroup.position[0];
    var rectangleY = mainGroup.position[1] - cylinderSize; // Adiciona a distância do cylinderSize à posição Y

    // Cria o retângulo centralizado no novo grupo
    var centeredRectangle = createBlackRectangle(rectangleX, rectangleY, rectangleWidthCentered, rectangleHeightCentered);
    centeredRectangle.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroup.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;



    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }


    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = -20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-20) - ((grupoLabel.height - retangulo.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);


    //inserir CAC - Z
    var textoCac = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    textoCac.rotate(90);
    textoCac.contents = cac;
    textoCac.textRange.characterAttributes.size = tamanhoLabel;
    textoCac.textRange.fillColor = registrationColor;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        textoCac.position = [distanciaLabel, 40];
    } else if (pos == "CD" || pos == "D") {
        textoCac.rotate(180);
        textoCac.position = [distanciaLabel + distanceBetweenRectangles, 40];
    } else if (pos == "C") {
        textoCac.position = [distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), 40];
    } else {

    }

    //criando o retangulo branco abaixo do CAC
    var white = new CMYKColor();
    var textoHeightPorcentCac = textoCac.height * 1.05;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(textoCac.geometricBounds[2], textoCac.geometricBounds[1], textoHeightPorcentCac, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;
    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), (40 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), (40 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    } else if (pos == "CD" || pos == "D") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceBetweenRectangles, (40 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    } else if (pos == "C") {
        retangulo.position = [((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), (40 + ((textoHeightPorcentCac - textoCac.height) / 2))];
    } else {

    }


    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.2 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle((sizeCameron - larguraMarcaDeCorte), -((sizeCameron / 2) + (alturaMarceDeCorte / 2)), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    var grupoDuplicadoDireita = grupoDeRetangulos.duplicate();
    grupoDuplicadoDireita.left = grupoDeRetangulos.left + distanceBetweenRectangles + (larguraMarcaDeCorte - sizeCameron);


    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    //Camerons Position
    if (pos == "E") {
        groupDuplicateRight.remove();
        cameronCentralGroup.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "D") {
        mainGroup.remove()
        cameronCentralGroup.remove();
        grupoDeRetangulos.remove();
    } else if (pos == "C") {
        mainGroup.remove()
        groupDuplicateRight.remove();
        grupoDeRetangulos.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "EC") {
        groupDuplicateRight.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "CD") {
        grupoDeRetangulos.remove();
        mainGroup.remove();
    } else if (pos == "ED") {
        cameronCentralGroup.remove();
    } else {

    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//Marcoprint
function montagemMarcoprint() {
    // Variaveis dos registros
    var larguraRetanguloRegistros = 0.18 / 0.35277777777782;
    var diametroCirculoBrancoMenor = 1.875 / 0.35277777777782;
    var diametroCirculoPreto = 2.25 / 0.35277777777782;
    var diametroCirculoBrancoMaior = 2.661 / 0.35277777777782;
    var retangleBrancoLargura = sizeCameron * 0.15;
    var larguraCameronCentral = 1 / 0.35277777777782;

    //Criando os registros
    var circuloBrancoMaior = createWhiteCircle(0, (diametroCirculoBrancoMaior / 2), diametroCirculoBrancoMaior);
    var circuloPreto = createBlackCircle((diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, (diametroCirculoPreto / 2), diametroCirculoPreto);
    var circuloBrancoMenor = createWhiteCircle((diametroCirculoBrancoMaior - diametroCirculoBrancoMenor) / 2, (diametroCirculoBrancoMenor / 2), diametroCirculoBrancoMenor);
    var retanguloVerticalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
    var retanguloHorizontalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
    retanguloHorizontalRegistros.rotate(90);
    retanguloHorizontalRegistros.position = [(diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, larguraRetanguloRegistros / 2];
    retanguloVerticalRegistros.position = [(diametroCirculoBrancoMaior - larguraRetanguloRegistros) / 2, diametroCirculoPreto / 2];
    var cameron = createBlackRectangle((diametroCirculoBrancoMaior - sizeCameron) / 2, -cylinderSize / 2, sizeCameron, cylinderSize);
    var brancoCameron = createWhiteRectangle((diametroCirculoBrancoMaior - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    retanguloVerticalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloHorizontalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMenor.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPreto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMaior.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 19.06;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 19.06;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    //Grupo do Cameron
    var mainGroup = app.activeDocument.groupItems.add();
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    brancoCameron.move(mainGroup, ElementPlacement.PLACEATEND);
    cameron.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles, mainGroup.position[1]];

    //Criando os registros para cameron central
    var circuloBrancoMaiorCentral = createWhiteCircle(0, (diametroCirculoBrancoMaior / 2), diametroCirculoBrancoMaior);
    var circuloPretoCentral = createBlackCircle((diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, (diametroCirculoPreto / 2), diametroCirculoPreto);
    var circuloBrancoMenorCentral = createWhiteCircle((diametroCirculoBrancoMaior - diametroCirculoBrancoMenor) / 2, (diametroCirculoBrancoMenor / 2), diametroCirculoBrancoMenor);
    var retanguloVerticalRegistrosCentral = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
    var retanguloHorizontalRegistrosCentral = createBlackRectangle(0, 0, larguraRetanguloRegistros, diametroCirculoPreto);
    retanguloHorizontalRegistrosCentral.rotate(90);
    retanguloHorizontalRegistrosCentral.position = [(diametroCirculoBrancoMaior - diametroCirculoPreto) / 2, larguraRetanguloRegistros / 2];
    retanguloVerticalRegistrosCentral.position = [(diametroCirculoBrancoMaior - larguraRetanguloRegistros) / 2, diametroCirculoPreto / 2];
    var cameronCentral = createBlackRectangle((diametroCirculoBrancoMaior - larguraCameronCentral) / 2, -cylinderSize / 2, larguraCameronCentral, cylinderSize);
    var brancoCameronCentral = createWhiteRectangle((diametroCirculoBrancoMaior - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

    // Cria grupo final e move os elementos para o grupo final
    var finalGroupCentral = app.activeDocument.groupItems.add();
    retanguloVerticalRegistrosCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
    retanguloHorizontalRegistrosCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
    circuloBrancoMenorCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
    circuloPretoCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);
    circuloBrancoMaiorCentral.move(finalGroupCentral, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima Central
    var groupDuplicateUpCentral = finalGroupCentral.duplicate();
    var distanceUp = ((cylinderSize - sizeCameron) / 2) - 19.06;
    groupDuplicateUpCentral.position = [finalGroupCentral.position[0], finalGroupCentral.position[1] - distanceUp];

    // Duplica o grupo para baixo Central
    var groupDuplicateDownCentral = finalGroupCentral.duplicate();
    var distanceDown = ((cylinderSize - sizeCameron) / 2) - 19.06;
    groupDuplicateDownCentral.position = [finalGroupCentral.position[0], finalGroupCentral.position[1] + distanceDown];

    //Grupo do Cameron Central
    var mainGroupCentral = app.activeDocument.groupItems.add();
    groupDuplicateUpCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
    groupDuplicateDownCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
    finalGroupCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
    brancoCameronCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);
    cameronCentral.move(mainGroupCentral, ElementPlacement.PLACEATEND);

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = mainGroupCentral.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";


    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;

    //apagar grupo do inicio do cameron cetral
    mainGroupCentral.remove();



    //inserir o label
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (diametroCirculoBrancoMaior - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date())
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;


    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        texto.position = [distanciaLabel, -20];
    } else if (pos == "CD" || pos == "D") {
        texto.rotate(180);
        texto.position = [(((diametroCirculoBrancoMaior + sizeCameron) / 2) - tamanhoLabel) / 2 + distanceBetweenRectangles, -20];
    } else if (pos == "C") {
        texto.position = [distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), -20];
    } else {

    }

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else if (pos == "C") {
        var tamanhoLabel90 = larguraCameronCentral;
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        retangulo.position = [((diametroCirculoBrancoMaior - tamanhoLabel90) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    } else if (pos == "CD" || pos == "D") {
        retangulo.position = [((diametroCirculoBrancoMaior - tamanhoLabel90) / 2) + distanceBetweenRectangles, -(20 - ((textoHeightPorcent - texto.height) / 2))];
    } else if (pos == "C") {
        retangulo.position = [((diametroCirculoBrancoMaior - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    } else {

    }

    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);


    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles + (((diametroCirculoBrancoMaior + sizeCameron) / 2) - tamanhoLabel) / 2;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else if (pos == "C") {
        var tamanhoLabel90 = larguraCameronCentral;
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((diametroCirculoBrancoMaior - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((diametroCirculoBrancoMaior - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((diametroCirculoBrancoMaior - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);


    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.17 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle(0, 0, alturaMarceDeCorte, larguraMarcaDeCorte);
    marcaDeCorte.rotate(90);
    marcaDeCorte.position = [(diametroCirculoBrancoMaior - larguraMarcaDeCorte) / 2 - (larguraMarcaDeCorte - sizeCameron) / 2, larguraRetanguloRegistros / 2];

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    var grupoDuplicadoDireita = grupoDeRetangulos.duplicate();
    grupoDuplicadoDireita.left = grupoDeRetangulos.left + distanceBetweenRectangles + (larguraMarcaDeCorte - sizeCameron);


    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    //Camerons Position
    if (pos == "E") {
        groupDuplicateRight.remove();
        cameronCentralGroup.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "D") {
        mainGroup.remove()
        cameronCentralGroup.remove();
        a
        grupoDeRetangulos.remove();
    } else if (pos == "C") {
        mainGroup.remove()
        groupDuplicateRight.remove();
        grupoDeRetangulos.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "EC") {
        groupDuplicateRight.remove();
        grupoDuplicadoDireita.remove();
    } else if (pos == "CD") {
        grupoDeRetangulos.remove();
        mainGroup.remove();
    } else if (pos == "ED") {
        cameronCentralGroup.remove();
    } else {

    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//TriColor
function montagemTricoloretiq() {


    //Variaveis Dos obejtos
    var retangleBrancoAltura = 9.523 / 0.35277777777782;
    var retangleHorizontalAltura = 0.106 / 0.35277777777782;
    var retangleVerticalLargura = 0.05 / 0.35277777777782;
    var larguraElipseBlack = 1.331 / 0.35277777777782;
    var alturaElipseBlack = 6.238 / 0.35277777777782;
    var larguraElipseWhite = 1.238 / 0.35277777777782;
    var alturaElipseWhite = 5.994 / 0.35277777777782;


    // Cria o primeiro retângulo na vertical
    var verticalRectangle = createBlackRectangle(((sizeCameron / 2) - (retangleVerticalLargura / 2)), -(retangleBrancoAltura / 2), retangleVerticalLargura, retangleBrancoAltura);

    // Cria o segundo retângulo na horizontal
    var horizontalRectangle = createBlackRectangle(0, -(retangleHorizontalAltura / 2), sizeCameron, retangleHorizontalAltura);

    // Cria cameron
    var retangleCameron = createBlackRectangle(0, -(cylinderSize / 2), sizeCameron, cylinderSize);

    // Cria box branco
    var retangleCameronBranco = createWhiteRectangle(0, -(retangleBrancoAltura / 2), sizeCameron, retangleBrancoAltura)

    // Cria o círculo preto interno
    var blackEllipse = createBlackEllipse(((sizeCameron / 2) - (larguraElipseBlack / 2)), (alturaElipseBlack / 2), larguraElipseBlack, alturaElipseBlack);

    // Cria o círculo branco
    var whiteEllipse = createWhiteEllipse(((sizeCameron / 2) - (larguraElipseWhite / 2)), (alturaElipseWhite / 2), larguraElipseWhite, alturaElipseWhite);


    // Cria grupo com os circulos e os retangulos
    var groupEllipseRetangles = app.activeDocument.groupItems.add();
    horizontalRectangle.move(groupEllipseRetangles, ElementPlacement.PLACEATEND);
    verticalRectangle.move(groupEllipseRetangles, ElementPlacement.PLACEATEND);
    whiteEllipse.move(groupEllipseRetangles, ElementPlacement.PLACEATEND);
    blackEllipse.move(groupEllipseRetangles, ElementPlacement.PLACEATEND);
    retangleCameronBranco.move(groupEllipseRetangles, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = groupEllipseRetangles.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - (112.5 + (retangleBrancoAltura / 2));
    groupDuplicateUp.position = [groupEllipseRetangles.position[0], groupEllipseRetangles.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = groupEllipseRetangles.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - (112.5 + (retangleBrancoAltura / 2));
    groupDuplicateDown.position = [groupEllipseRetangles.position[0], groupEllipseRetangles.position[1] + distanceDown];

    //deleta registros centro
    groupEllipseRetangles.remove();

    //microponto central
    // Diâmetro do círculo branco
    var whiteCircleDiameter = 1.518 / 0.35277777777782;

    // altura do retangulo central
    var alturaRectangleCenter = 0.09 / 0.35277777777782;

    // Diâmetro do círculo branco maior
    var whiteCircleDiameterBig = sizeCameron;

    // Diâmetro do círculo preto interno (0,42mm em pontos)
    var blackCircleDiameter = 0.22 / 0.35277777777782;

    // Cria Retangulo central
    var rectangleCenter = createBlackRectangle(0, -(alturaRectangleCenter / 2), sizeCameron, alturaRectangleCenter);

    // Cria o círculo preto interno
    var blackCircle = createBlackCircle(((sizeCameron / 2) - (blackCircleDiameter / 2)), (blackCircleDiameter / 2), blackCircleDiameter);

    // Cria o círculo branco
    var whiteCircle = createWhiteCircle(((sizeCameron / 2) - (whiteCircleDiameter / 2)), (whiteCircleDiameter / 2), whiteCircleDiameter);

    // Cria Circulo Branco Maior
    var whiteCircleBig = createWhiteCircle(((sizeCameron / 2) - (sizeCameron / 2)), (sizeCameron / 2), sizeCameron);


    //grupo registro central   
    var groupRegistrosCentral = app.activeDocument.groupItems.add();
    blackCircle.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    whiteCircle.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    rectangleCenter.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    whiteCircleBig.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);


    // Cria grupo final e move os elementos para o grupo final
    var groupRegistros = app.activeDocument.groupItems.add();
    groupRegistrosCentral.move(groupRegistros, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(groupRegistros, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(groupRegistros, ElementPlacement.PLACEATEND);
    retangleCameron.move(groupRegistros, ElementPlacement.PLACEATEND);

    // Criar um array para conter os grupos duplicados
    var cameronCentralGroup = [];

    // Criar um grupo para conter os objetos duplicados
    var cameronCentralGroup = app.activeDocument.groupItems.add();

    // Loop para duplicar e mover os objetos
    for (var i = 0; i < lanes - 1; i++) {
        var newGroupCameron = groupRegistros.duplicate();
        var offsetX = (objectWidth + distanceBetweenLanes) * (i + 1);
        newGroupCameron.translate(offsetX, 0);

        // Adicionar o grupo duplicado ao grupo cameronCentralGroup
        newGroupCameron.moveToBeginning(cameronCentralGroup);
    }

    // Renomear o grupo pai para "cameronCentralGroup"
    cameronCentralGroup.name = "cameronCentralGroup";

    //Centralizar Cameron Central
    var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

    // Obtém as coordenadas do centro do artboard
    var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
    var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

    cameronCentralGroup.left = centerX - cameronCentralGroup.width / 2;
    cameronCentralGroup.top = centerY + cameronCentralGroup.height / 2 + displacementBetweenLanes / 2;



    // Duplicar o grupo
    var duplicatedGroup = groupRegistros.duplicate();

    // Mover o grupo duplicado para a direita
    duplicatedGroup.left += distanceBetweenRectangles;

    // Definir a cor do texto para branco CMYK
    var whiteCMYK = new CMYKColor();
    whiteCMYK.cyan = 0;
    whiteCMYK.magenta = 0;
    whiteCMYK.yellow = 0;
    whiteCMYK.black = 0;

    //inserir o label
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date())
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.characterAttributes.fillColor = whiteCMYK


    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {
        texto.position = [distanciaLabel, -20];
    } else if (pos == "CD" || pos == "D") {
        texto.rotate(180);
        texto.position = [((((sizeCameron + sizeCameron) / 2) - tamanhoLabel) / 2) - 0.2 + distanceBetweenRectangles, -20];
    } else if (pos == "C") {
        texto.position = [distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2), -20];
    } else {

    }

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles + ((((sizeCameron + sizeCameron) / 2) - tamanhoLabel) / 2) - 0.2;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j] != cameronCentralGroup) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    //Camerons Position
    if (pos == "E") {
        duplicatedGroup.remove();
        cameronCentralGroup.remove();
    } else if (pos == "D") {
        groupRegistros.remove();
        cameronCentralGroup.remove();
    } else if (pos == "C") {
        duplicatedGroup.remove();
        groupRegistros.remove();
    } else if (pos == "EC") {
        duplicatedGroup.remove();
    } else if (pos == "CD") {
        groupRegistros.remove();
    } else if (pos == "ED") {
        cameronCentralGroup.remove();
    } else {

    }



    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();
}
//Limpack
function montagemLimpack() {
    // Largura e altura dos retângulos
    var rectangleWidth = 0.25 / 0.35277777777782;
    var retangleAltura = 5 / 0.35277777777782;

    // Cria o primeiro retângulo na vertical (0,25mm x retangleAltura)
    var verticalRectangle = createBlackRectangle(((sizeCameron / 2) - (rectangleWidth / 2)), -(retangleAltura / 2), rectangleWidth, retangleAltura);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,25mm)
    var horizontalRectangle = createBlackRectangle(0, -(rectangleWidth / 2), sizeCameron, rectangleWidth);

    // Cria cameron
    var retangleCameron = createBlackRectangle(0, -(cylinderSize / 2), sizeCameron, cylinderSize);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 40;
    retangleCameron.fillColor = spotColorFill;

    // Cria box branco
    var retangleCameronBranco = createWhiteRectangle(0, -(retangleAltura / 2), sizeCameron, retangleAltura)


    // Diâmetro do círculo em stroke (6mm em pontos)
    var coloredCircleDiameter = 6 / 0.35277777777782;

    // Diâmetro do círculo branco
    var whiteCircleDiameter = 0.6 / 0.35277777777782;

    // Diâmetro do círculo preto interno (0,42mm em pontos)
    var blackCircleDiameter = 0.42 / 0.35277777777782;

    // Cria o círculo preto interno
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Cria o círculo branco
    var whiteCircle = createWhiteCircle(0, 0, whiteCircleDiameter);

    // Cria o círculo branco de 0,18mm (em pontos)
    var smallWhiteCircleDiameter = 0.18 / 0.35277777777782;
    var smallWhiteCircle = createWhiteCircle(0, 0, smallWhiteCircleDiameter);

    // Cria grupos para cada círculo individualmente
    var whiteCircleGroup = app.activeDocument.groupItems.add();
    var blackCircleGroup = app.activeDocument.groupItems.add();
    var smallWhiteCircleGroup = app.activeDocument.groupItems.add();
    var coloredCircleGroup = app.activeDocument.groupItems.add();

    // Adiciona os círculos aos grupos correspondentes
    blackCircle.move(blackCircleGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(whiteCircleGroup, ElementPlacement.PLACEATEND);
    smallWhiteCircle.move(smallWhiteCircleGroup, ElementPlacement.PLACEATEND);

    // Posiciona o círculo preto centralizado sobre o círculo branco
    var xOffset = (whiteCircleDiameter - blackCircleDiameter) / 2;
    var yOffset = (whiteCircleDiameter - blackCircleDiameter) / 2;
    blackCircleGroup.translate(xOffset, -yOffset);

    // Posiciona o círculo branco menor centralizado sobre o círculo preto
    var smallWhiteCircleXOffset = (whiteCircleDiameter - smallWhiteCircleDiameter) / 2;
    var smallWhiteCircleYOffset = (whiteCircleDiameter - smallWhiteCircleDiameter) / 2;
    smallWhiteCircleGroup.translate(smallWhiteCircleXOffset, -smallWhiteCircleYOffset);

    // Cria grupo final e move os elementos para o grupo final
    var groupCameron = app.activeDocument.groupItems.add();
    verticalRectangle.move(groupCameron, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(groupCameron, ElementPlacement.PLACEATEND);
    retangleCameronBranco.move(groupCameron, ElementPlacement.PLACEATEND);
    retangleCameron.move(groupCameron, ElementPlacement.PLACEATEND);

    // Agrupa os círculos para manter o círculo preto acima do branco
    var circlesGroup = app.activeDocument.groupItems.add();
    smallWhiteCircleGroup.move(circlesGroup, ElementPlacement.PLACEATEND);
    blackCircleGroup.move(circlesGroup, ElementPlacement.PLACEATEND);
    whiteCircleGroup.move(circlesGroup, ElementPlacement.PLACEATEND);

    // Movendo o grupo para a nova posição
    circlesGroup.position = [sizeCameron + 1.984, (whiteCircleDiameter / 2)];

    var finalGroup = app.activeDocument.groupItems.add();
    circlesGroup.move(finalGroup, ElementPlacement.PLACEATEND);
    groupCameron.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplicar o grupo
    var duplicatedGroup = finalGroup.duplicate();

    // Aplicar rotação de 180 graus somente no grupo duplicado
    duplicatedGroup.rotate(180, true, true, true, true, Transformation.CENTER);

    // Mover o grupo duplicado para a direita
    duplicatedGroup.left += distanceBetweenRectangles - 1.984 - whiteCircleDiameter;

    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 5;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 5;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - ";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width;

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = 5;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(-90);
    grupoLabel.top = -25;
    grupoLabel.left = (0.6 + distanciaLabel + distanceBetweenRectangles) - sizeCameron;


    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        // Selecionar todos os objetos na layer "registros"
        registrosLayer.pageItems[0].selected = true;
        for (var j = 1; j < registrosLayer.pageItems.length; j++) {
            registrosLayer.pageItems[j].selected = true;
        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    // Quando quiser mostrar a camada "arte" novamente
    artLayer.visible = true;

    // Remover camadas vazias
    for (var i = doc.layers.length - 1; i >= 0; i--) {
        var currentLayer = doc.layers[i];
        if (currentLayer.pageItems.length === 0) {
            currentLayer.remove();
        }
    }

    var alertMessage = "Montagem e Label feitos";
    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//Majicplast
function montagemMajicplast() {
    // Largura e altura dos retângulos
    var rectangleWidth = 0.12 / 0.35277777777782;
    var retangleAltura = 4 / 0.35277777777782;
    var retanguloTamanho = 3 / 0.35277777777782;


    // Cria o primeiro retângulo na vertical (0,25mm x retangleAltura)
    var verticalRectangle = createBlackRectangle(((sizeCameron / 2) - (rectangleWidth / 2)), -(retanguloTamanho / 2), rectangleWidth, retanguloTamanho);

    // Cria o segundo retângulo na horizontal (sizeCameron x 0,25mm)
    var horizontalRectangle = createBlackRectangle(0, -(rectangleWidth / 2), sizeCameron, rectangleWidth);

    // Cria cameron
    var retangleCameron = createBlackRectangle(0, -(cylinderSize / 2), sizeCameron, cylinderSize);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 30;
    retangleCameron.fillColor = spotColorFill;

    // Cria box branco
    var retangleCameronBranco = createWhiteRectangle(0, -(retangleAltura / 2), sizeCameron, retangleAltura)


    // Diâmetro do círculo em stroke (6mm em pontos)
    var coloredCircleDiameter = 6 / 0.35277777777782;

    // Diâmetro do círculo branco
    var whiteCircleDiameter = 0.6 / 0.35277777777782;

    // Diâmetro do círculo preto interno (0,42mm em pontos)
    var blackCircleDiameter = 0.42 / 0.35277777777782;

    // Cria o círculo preto interno
    var blackCircle = createBlackCircle(0, 0, blackCircleDiameter);

    // Cria o círculo branco
    var whiteCircle = createWhiteCircle(0, 0, whiteCircleDiameter);

    // Cria o círculo branco de 0,18mm (em pontos)
    var smallWhiteCircleDiameter = 0.18 / 0.35277777777782;
    var smallWhiteCircle = createWhiteCircle(0, 0, smallWhiteCircleDiameter);

    // Cria grupos para cada círculo individualmente
    var whiteCircleGroup = app.activeDocument.groupItems.add();
    var blackCircleGroup = app.activeDocument.groupItems.add();
    var smallWhiteCircleGroup = app.activeDocument.groupItems.add();
    var coloredCircleGroup = app.activeDocument.groupItems.add();

    // Adiciona os círculos aos grupos correspondentes
    blackCircle.move(blackCircleGroup, ElementPlacement.PLACEATEND);
    whiteCircle.move(whiteCircleGroup, ElementPlacement.PLACEATEND);
    smallWhiteCircle.move(smallWhiteCircleGroup, ElementPlacement.PLACEATEND);

    // Posiciona o círculo preto centralizado sobre o círculo branco
    var xOffset = (whiteCircleDiameter - blackCircleDiameter) / 2;
    var yOffset = (whiteCircleDiameter - blackCircleDiameter) / 2;
    blackCircleGroup.translate(xOffset, -yOffset);

    // Posiciona o círculo branco menor centralizado sobre o círculo preto
    var smallWhiteCircleXOffset = (whiteCircleDiameter - smallWhiteCircleDiameter) / 2;
    var smallWhiteCircleYOffset = (whiteCircleDiameter - smallWhiteCircleDiameter) / 2;
    smallWhiteCircleGroup.translate(smallWhiteCircleXOffset, -smallWhiteCircleYOffset);

    // Cria grupo final e move os elementos para o grupo final
    var groupCameron = app.activeDocument.groupItems.add();
    verticalRectangle.move(groupCameron, ElementPlacement.PLACEATEND);
    horizontalRectangle.move(groupCameron, ElementPlacement.PLACEATEND);
    retangleCameronBranco.move(groupCameron, ElementPlacement.PLACEATEND);
    retangleCameron.move(groupCameron, ElementPlacement.PLACEATEND);

    // Agrupa os círculos para manter o círculo preto acima do branco
    var circlesGroup = app.activeDocument.groupItems.add();
    smallWhiteCircleGroup.move(circlesGroup, ElementPlacement.PLACEATEND);
    blackCircleGroup.move(circlesGroup, ElementPlacement.PLACEATEND);
    whiteCircleGroup.move(circlesGroup, ElementPlacement.PLACEATEND);

    // Movendo o grupo para a nova posição
    circlesGroup.position = [sizeCameron + 1.984, (whiteCircleDiameter / 2)];

    var finalGroup = app.activeDocument.groupItems.add();
    circlesGroup.move(finalGroup, ElementPlacement.PLACEATEND);
    groupCameron.move(finalGroup, ElementPlacement.PLACEATEND);

    // Duplicar o grupo
    var duplicatedGroup = finalGroup.duplicate();

    // Aplicar rotação de 180 graus somente no grupo duplicado
    duplicatedGroup.rotate(180, true, true, true, true, Transformation.CENTER);

    // Mover o grupo duplicado para a direita
    duplicatedGroup.left += distanceBetweenRectangles - 1.984 - whiteCircleDiameter;

    //Escalas de Densidade
    function createSquare(x, y, size, fillColor, strokeColor, strokeWidth) {
        var square = app.activeDocument.layers[0].pathItems.rectangle(y, x, size, size);
        square.fillColor = fillColor;
        square.stroked = true;
        square.strokeColor = strokeColor;
        square.strokeWidth = strokeWidth;
        return square;
    }

    // Tamanhos dos quadrados em pontos
    var squereTamanho = 6 / 0.35277777777782;
    var groupEscalasCores = app.activeDocument.groupItems.add();
    var groupEscalasCoresFinal = app.activeDocument.groupItems.add();
    var grupoEscalasBranco = app.activeDocument.groupItems.add();
    var grupoEscalasBrancoFinal = app.activeDocument.groupItems.add();
    var grupoFinalEscalas = app.activeDocument.groupItems.add();

    var fillColors = [100];
    var fillColorsEspeciais = [100]

    for (var i = 0; i < fillColors.length; i++) {
        var fillColor = new SpotColor();
        fillColor.spot = doc.spots.getByName("PassarRegistration");
        fillColor.tint = 100;

        var strokeColor = new SpotColor();
        strokeColor.spot = doc.spots.getByName("PassarRegistration");
        strokeColor.tint = 100;

        var strokeWidth = 0 / 0.35277777777782;

        var escalas = createSquare(i * (squereTamanho + 1.9843), 0, squereTamanho, fillColor, strokeColor, strokeWidth);
        escalas.move(groupEscalasCores, ElementPlacement.PLACEATEND);
    }

    // Cores consideradas "especiais"
    var coresEspeciais0 = ["yellow", "black", "magenta", "cyan"];

    // Saídas
    var coresQuadrados = [];
    var porcentagensQuadrados = [];

    // Tabela de porcentagens para especiais
    var porcentagensEspeciais = [100, 75, 50, 25, 2];

    for (var i = 0; i < coresSemVernizBranco.length; i++) {
        var cor = coresSemVernizBranco[i];

        // VERIFICA SE É ESPECIAL
        var ehEspecial = false;
        for (var j = 0; j < coresEspeciais0.length; j++) {
            if (cor.toLowerCase() === coresEspeciais0[j].toLowerCase()) {
                ehEspecial = true;
                break;
            }
        }

        // SE FOR ESPECIAL → 5 repetições com porcentagens diferentes
        if (ehEspecial) {
            for (var p = 0; p < porcentagensEspeciais.length; p++) {
                coresQuadrados.push(cor);
                porcentagensQuadrados.push(porcentagensEspeciais[p]);
            }
        }
        // SE NÃO FOR ESPECIAL → apenas 1 entrada com 100%
        else {
            coresQuadrados.push(cor);
            porcentagensQuadrados.push(100);
        }
    }

    // --------------------
    // Bloco substituto: gerar entries, duplicar template e aplicar tints corretamente
    // --------------------

    // utilitário: resolve um Spot a partir de nome / Spot / Swatch
    function resolveSpot(objOrName) {
        // se já for um Spot
        try {
            if (objOrName && objOrName.typename && objOrName.typename.toLowerCase().indexOf("spot") >= 0) {
                return objOrName;
            }
        } catch (e) {}

        // se for um Swatch com SpotColor
        try {
            if (objOrName && objOrName.color && objOrName.color.typename === "SpotColor") {
                return objOrName.color.spot;
            }
        } catch (e) {}

        // se for nome: tenta doc.spots depois doc.swatches
        try {
            var s = doc.spots.getByName(objOrName);
            return s;
        } catch (e1) {}
        try {
            var sw = doc.swatches.getByName(objOrName);
            if (sw && sw.color && sw.color.typename === "SpotColor") {
                return sw.color.spot;
            }
        } catch (e2) {}
        return null;
    }

    // porcentagens para especiais
    var porcentagensEspeciais = [100, 75, 50, 25, 2];

    // Saídas: vamos criar entradas completas {name, tint, spotObj}
    var entries = []; // cada entrada será uma escala (p.ex. Cyan 75)

    // construir entries (usa coresSemVernizBranco e coresEspeciais0 já definidos)
    for (var a = 0; a < coresSemVernizBranco.length; a++) {
        var cor = coresSemVernizBranco[a];
        var ehEspecial = false;
        for (var b = 0; b < coresEspeciais0.length; b++) {
            if (cor.toLowerCase() === coresEspeciais0[b].toLowerCase()) {
                ehEspecial = true;
                break;
            }
        }

        if (ehEspecial) {
            for (var p = 0; p < porcentagensEspeciais.length; p++) {
                var pct = porcentagensEspeciais[p];

                // tentar resolver o Spot direto pelo nome (mais confiável)
                var spotObj = resolveSpot(cor);

                entries.push({
                    name: cor,
                    tint: pct,
                    spot: spotObj // pode ser null se não houver Spot
                });
            }
        } else {
            var spot2 = resolveSpot(cor);
            entries.push({
                name: cor,
                tint: 100,
                spot: spot2
            });
        }
    }

    // --- Duplicar template para cada entry ---
    // Nomear grupos de forma consistente: groupEscalasCores_idx_nome_tint
    for (var i = 0; i < entries.length; i++) {
        var grp = groupEscalasCores.duplicate();
        // Posicionamento (ajuste se quiser horizontal em vez de vertical)
        var spacing = (2 / 0.35277777777782);
        grp.top = groupEscalasCores.top - (i + 1) * (grp.height + spacing);
        var safeName = entries[i].name.replace(/\s+/g, "_");
        grp.name = "groupEscalasCores_" + i + "_" + safeName + "_" + entries[i].tint;
        try {
            grp.move(groupEscalasCoresFinal, ElementPlacement.PLACEATEND);
        } catch (mvEx) {}
    }

    // Remova o template se quiser (comente se não quiser remover)
    try {
        groupEscalasCores.remove();
    } catch (e) {}

    // --- Aplicar cor a cada grupo recém-criado ---
    // Percorra os grupos (procura por prefixo)
    for (var ii = 0; ii < doc.groupItems.length; ii++) {
        var gitem = doc.groupItems[ii];
        if (gitem.name && gitem.name.indexOf("groupEscalasCores_") === 0) {
            // extrair índice do nome para localizar entry
            var parts = gitem.name.split("_");
            var idx = parseInt(parts[1], 10);
            if (!isNaN(idx) && entries[idx]) {
                var entry = entries[idx];

                // resolve spot: usa entry.spot se já veio, senão tenta pelo nome
                var spotObj = entry.spot;
                if (!spotObj) {
                    spotObj = resolveSpot(entry.name);
                }

                // se encontramos um Spot, criamos SpotColor com tint do entry
                var finalSpotColor = null;
                if (spotObj) {
                    try {
                        finalSpotColor = new SpotColor();
                        finalSpotColor.spot = spotObj;
                        finalSpotColor.tint = entry.tint; // 100/75/50/25/2
                    } catch (err) {
                        finalSpotColor = null;
                    }
                }

                // aplicar a cada item do grupo
                for (var jj = 0; jj < gitem.pageItems.length; jj++) {
                    var sq = gitem.pageItems[jj];

                    if (finalSpotColor) {
                        // cria instâncias separadas para fill e stroke
                        try {
                            var newFill = new SpotColor();
                            newFill.spot = finalSpotColor.spot;
                            newFill.tint = finalSpotColor.tint;
                            sq.fillColor = newFill;
                        } catch (errF) {
                            /* silent */ }

                        try {
                            var newStroke = new SpotColor();
                            newStroke.spot = finalSpotColor.spot;
                            newStroke.tint = finalSpotColor.tint;
                            sq.strokeColor = newStroke;
                        } catch (errS) {
                            /* silent */ }
                    } else {
                        // sem Spot: preserva o fill/stroke existente (ou aplique fallback CMYK se desejar)
                    }
                } // fim pageItems loop
            } // fim entries[idx] exist
        } // fim name check
    } // fim grupo loop



    // Função para subtrair arrays
    function subtractArrays(arr1, arr2) {
        var resultado = [];

        for (var i = 0; i < arr1.length; i++) {
            var elemento = arr1[i];
            var encontrado = false;

            for (var j = 0; j < arr2.length; j++) {
                if (elemento === arr2[j]) {
                    encontrado = true;
                    break;
                }
            }

            if (!encontrado) {
                resultado.push(elemento);
            }
        }

        return resultado;
    }

    // Subtrair coresSemVernizBranco de cores
    var coresEspeciais = subtractArrays(cores, coresSemVernizBranco);
    var contemBranco = false;
    var corDoBranco = null;

    // Verificar se coresEspeciais contém "Branco" e capturar o nome da cor
    for (var i = 0; i < coresEspeciais.length; i++) {
        if (coresEspeciais[i].toLowerCase().indexOf("branco") >= 0) {
            corDoBranco = coresEspeciais[i];
            contemBranco = true; // Defina contemVerniz como true
            break;
        }
    }


    if (contemBranco) {
        // Criar um array para armazenar todas as cores Brancas encontradas
        var coresBranco = [];

        // Verificar se coresEspeciais contém "Branco" e capturar o nome da cor
        for (var i = 0; i < coresEspeciais.length; i++) {
            if (coresEspeciais[i].toLowerCase().indexOf("branco") >= 0) {
                coresBranco.push(coresEspeciais[i]); // Adicionar a cor à lista de cores Brancas
            }
        }

        // Realizar ação com base nas cores Brancas encontradas
        if (coresBranco.length > 0) {
            for (var j = 0; j < coresBranco.length; j++) {
                var corDoBranco = coresBranco[j];

                // Criar um grupo para as escalas especiais da cor branca atual com o nome da cor
                var grupoEspeciaisBranco = doc.groupItems.add();


                for (var i = 0; i < fillColorsEspeciais.length; i++) {
                    var fillColorsEspecial = new SpotColor();
                    fillColorsEspecial.spot = doc.spots.getByName(corDoBranco);
                    fillColorsEspecial.tint = 100;

                    var strokeColorEspecial = new SpotColor();
                    strokeColorEspecial.spot = doc.spots.getByName(corDoBranco);
                    strokeColorEspecial.tint = 100;

                    var strokeWidthBranco = 0 / 0.35277777777782;

                    var escalasEspeciaisBranco = createSquare(i * (squereTamanho + 1.9843), 0, squereTamanho, fillColorsEspecial, strokeColorEspecial, strokeWidthBranco);

                    // Mova as escalas especiais para o grupo específico desta cor branca
                    escalasEspeciaisBranco.move(grupoEspeciaisBranco, ElementPlacement.PLACEATEND);

                    escalasEspeciaisBranco.strokeOverprint = true;
                    escalasEspeciaisBranco.fillOverprint = true;

                }

                // Loop para duplicar o grupo de Escalas com base no número de cores Brancas encontradas
                var espaçoEntreGrupos = (2 / 0.35277777777782);
                var xOffset = 0; // Inicialize o deslocamento horizontal como 0
                for (var k = 0; k < coresQuadrados.length; k++) {
                    var groupEspecialBranco = grupoEspeciaisBranco.duplicate();

                    // Defina a posição horizontal do grupo duplicado
                    groupEspecialBranco.top = xOffset;

                    // Atualize o deslocamento horizontal para a próxima iteração
                    xOffset += groupEspecialBranco.height + espaçoEntreGrupos;

                    // Mova o grupo duplicado para o grupoEscalasBrancoFinal
                    groupEspecialBranco.move(grupoEscalasBrancoFinal, ElementPlacement.PLACEATEND);


                }

                grupoEspeciaisBranco.remove();
            }

        }
    }

    if (contemBranco) {

        grupoEscalasBrancoFinal.translate(0, -((2 / 0.35277777777782) + grupoEscalasBrancoFinal.height))

    } else {

    }

    grupoEscalasBrancoFinal.move(grupoFinalEscalas, ElementPlacement.PLACEATEND);
    groupEscalasCoresFinal.move(grupoFinalEscalas, ElementPlacement.PLACEATEND);

    grupoFinalEscalas.top = -(52 / 0.35277777777782);
    grupoFinalEscalas.left = -(squereTamanho - sizeCameron);



    //inserir o label
    //padrão ALpha
    var texto = doc.textFrames.add();
    var tamanhoLabel = 5;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 5;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cliente + " - " + produto + " - " + lpc + "lpc - " + formatarData(new Date()) + " - ALPHA";
    texto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Semibold");
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;
    texto.position = [0, 0]

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    texto.move(grupoLabel, ElementPlacement.PLACEATEND);

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width + 1;

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = 5;
        corTexto.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Semibold");
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.left = -(sizeCameron - 2.3);


    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        // Selecionar todos os objetos na layer "registros"
        registrosLayer.pageItems[0].selected = true;
        for (var j = 1; j < registrosLayer.pageItems.length; j++) {
            registrosLayer.pageItems[j].selected = true;
        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2 - ((squereTamanho - sizeCameron) / 2);
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    // Quando quiser mostrar a camada "arte" novamente
    artLayer.visible = true;

    // Remover camadas vazias
    for (var i = doc.layers.length - 1; i >= 0; i--) {
        var currentLayer = doc.layers[i];
        if (currentLayer.pageItems.length === 0) {
            currentLayer.remove();
        }
    }

    var alertMessage = "Montagem e Label feitos - Verificar Cores do Cameron";
    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//AlphaColor
function montagemAlphaColor() {

    //Ajustes para Montagens
    if (cac.indexOf("TERMOENCOLHIVEL") >= 0) {
        distanceBetweenRectangles = distanceBetweenRectangles + (4 / 0.35277777777782);
    } else {

    }

    //Variaveis para Registros
    var retangleBrancoAltura = 3.75 / 0.35277777777782;
    var larguraRetanguloRegistros = 0.09 / 0.35277777777782;
    var diametroCirculoPreto = 2.265 / 0.35277777777782;
    var diametroCirculoBranco = 2.095 / 0.35277777777782;
    var alturaRetanguloBranco = 2.125 / 0.35277777777782;
    var larguraRegistrosQuadrados = 0.25 / 0.35277777777782;
    var diametroCirculoBrancoMaior = 2.225 / 0.35277777777782;
    var diametroMicropontoPreto = 1 / 0.35277777777782;
    var diametroMicropontoBranco = 0.25 / 0.35277777777782;
    var circuloBrancoCores = 2.5 / 0.35277777777782;
    var circuloPretoCores = 1.45 / 0.35277777777782;
    var distanciaBranco = 0.48 / 0.35277777777782;
    var distanciaPreto = 1.525 / 0.35277777777782;

    //Criando Registros
    var cameron = createBlackRectangle(0, -cylinderSize / 2, sizeCameron, cylinderSize);
    if ((cac == "IN MOLD LABEL") || (cac.indexOf("TERMOENCOLHIVEL") >= 0)) {
        var spotColor = doc.spots.getByName("PassarRegistration");
        var spotColorFill = new SpotColor();
        spotColorFill.spot = spotColor;
        spotColorFill.tint = 30;
        cameron.fillColor = spotColorFill;
    } else {

    }

    var retanguloBranco = createWhiteRectangle(0, -retangleBrancoAltura / 2, sizeCameron, retangleBrancoAltura);
    var circuloPreto = createBlackCircle(((sizeCameron - diametroCirculoPreto) / 2), diametroCirculoPreto / 2, diametroCirculoPreto);
    var circuloBranco = createWhiteCircle(((sizeCameron - diametroCirculoBranco) / 2), diametroCirculoBranco / 2, diametroCirculoBranco);
    var retanguloRegistrosCentralHorizontal = createBlackRectangle(0, -larguraRetanguloRegistros / 2, sizeCameron, larguraRetanguloRegistros);
    var retanguloRegistrosCentralVertical = createBlackRectangle(((sizeCameron - larguraRetanguloRegistros) / 2), -sizeCameron / 2, larguraRetanguloRegistros, sizeCameron);
    var circuloBrancoMaior = createWhiteCircle(((sizeCameron - diametroCirculoBrancoMaior) / 2), diametroCirculoBrancoMaior / 2, diametroCirculoBrancoMaior);
    var circuloPretoMicroponto = createBlackCircle(((sizeCameron - diametroMicropontoPreto) / 2), diametroMicropontoPreto / 2, diametroMicropontoPreto);
    var circuloBrancoMicroponto = createWhiteCircle(((sizeCameron - diametroMicropontoBranco) / 2), diametroMicropontoBranco / 2, diametroMicropontoBranco);
    var quadradoRegistros = createWhiteRectangle(((sizeCameron - alturaRetanguloBranco) / 2), -alturaRetanguloBranco / 2, alturaRetanguloBranco, alturaRetanguloBranco)
    var retanguloRegistrosHorizontal = createBlackRectangle(((sizeCameron - alturaRetanguloBranco) / 2), -larguraRegistrosQuadrados / 2, alturaRetanguloBranco, larguraRegistrosQuadrados)
    var retanguloRegistrosVertical = createBlackRectangle(((sizeCameron - larguraRegistrosQuadrados) / 2), -alturaRetanguloBranco / 2, larguraRegistrosQuadrados, alturaRetanguloBranco)


    // Crie um objeto de número para cada parte
    var numeros = [];

    for (var i = 0; i < cores.length; i++) {
        var numero = doc.textFrames.add();
        numero.contents = (i + 1).toString(); // Usar (i + 1) para começar com 1 em vez de 0
        numeros.push(numero);
    }

    // Aplique a cor a cada número com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(numeros[i], coresComuns[i]);
    }

    // Agrupe todos os números em um único grupo
    var grupoNumeros = app.activeDocument.groupItems.add();
    // Defina a posição inicial dos números
    var xPosition = 0;

    // Posicione e agrupe os números
    for (var i = 0; i < numeros.length; i++) {
        var numero = numeros[i];
        numero.textRange.characterAttributes.size = 2.7; // Defina o tamanho desejado
        numero.position = [xPosition, 0];
        numero.move(grupoNumeros, ElementPlacement.PLACEATEND);
    }

    var coordenadas = [{
            x: 3.15,
            y: 2.6
        },
        {
            x: 5.37,
            y: 2.6
        },
        {
            x: 3.15,
            y: 0
        },
        {
            x: 5.37,
            y: 0
        },
        {
            x: 1.02,
            y: 5
        },
        {
            x: 7.1,
            y: 5
        },
        {
            x: 1.02,
            y: -2
        },
        {
            x: 7.1,
            y: -2
        },
        {
            x: 3.3,
            y: 5.65
        },
        {
            x: 3.8,
            y: -2.85
        }
    ];

    // Loop através dos números de cores
    for (var i = 0; i < cores.length; i++) {
        // Verifique se a posição i existe nas coordenadas
        if (i < coordenadas.length) {
            // Mova o número para a posição i se ela existir
            numeros[i].position = [coordenadas[i].x, coordenadas[i].y];
            //numeros[i].textRange.paragraphAttributes.justification = Justification.CENTER;
        }
    }

    //Grupo Registros Central
    var groupRegistrosCentral = app.activeDocument.groupItems.add();
    grupoNumeros.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    retanguloRegistrosCentralHorizontal.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    retanguloRegistrosCentralVertical.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    circuloBranco.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    circuloPreto.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);
    retanguloBranco.move(groupRegistrosCentral, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUp = groupRegistrosCentral.duplicate();
    var distanceUp = ((cylinderSize / 2) - (retangleBrancoAltura / 2)) - 23.28;
    groupDuplicateUp.position = [groupRegistrosCentral.position[0], groupRegistrosCentral.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = groupRegistrosCentral.duplicate();
    var distanceDown = ((cylinderSize / 2) - (retangleBrancoAltura / 2)) - 23.28;
    groupDuplicateDown.position = [groupRegistrosCentral.position[0], groupRegistrosCentral.position[1] + distanceDown];

    //Grupo Micropontos
    var groupMicropontos = app.activeDocument.groupItems.add();
    circuloBrancoMicroponto.move(groupMicropontos, ElementPlacement.PLACEATEND);
    circuloPretoMicroponto.move(groupMicropontos, ElementPlacement.PLACEATEND);
    circuloBrancoMaior.move(groupMicropontos, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUpMicropontos = groupMicropontos.duplicate();
    var distanceUpMic = 41.4417;
    groupDuplicateUpMicropontos.translate(0, distanceUpMic);

    // Duplica o grupo para baixo
    var groupDuplicateDownMicropontos = groupMicropontos.duplicate();
    var distanceDownMic = 41.4417;
    groupDuplicateDownMicropontos.translate(0, -distanceDownMic)

    groupMicropontos.remove();

    //Grupo Quadrado Registros
    var groupQuadrado = app.activeDocument.groupItems.add();
    retanguloRegistrosHorizontal.move(groupQuadrado, ElementPlacement.PLACEATEND);
    retanguloRegistrosVertical.move(groupQuadrado, ElementPlacement.PLACEATEND);
    quadradoRegistros.move(groupQuadrado, ElementPlacement.PLACEATEND);

    // Duplica o grupo para cima
    var groupDuplicateUpQuadrados = groupQuadrado.duplicate();
    var distanceUpQ = 80.08;
    groupDuplicateUpQuadrados.translate(0, distanceUpQ);

    // Duplica o grupo para baixo
    var groupDuplicateDownQuadrados = groupQuadrado.duplicate();
    var distanceDownQ = 80.08;
    groupDuplicateDownQuadrados.translate(0, -distanceDownQ)

    groupQuadrado.remove();

    //Grupo do Cameron
    var groupCameron = app.activeDocument.groupItems.add();
    groupDuplicateDownQuadrados.move(groupCameron, ElementPlacement.PLACEATEND);
    groupDuplicateUpQuadrados.move(groupCameron, ElementPlacement.PLACEATEND);
    groupDuplicateDownMicropontos.move(groupCameron, ElementPlacement.PLACEATEND);
    groupDuplicateUpMicropontos.move(groupCameron, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(groupCameron, ElementPlacement.PLACEATEND);
    groupDuplicateUp.move(groupCameron, ElementPlacement.PLACEATEND);
    groupRegistrosCentral.move(groupCameron, ElementPlacement.PLACEATEND);
    cameron.move(groupCameron, ElementPlacement.PLACEATEND);


    var duplicateCameron = groupCameron.duplicate();
    duplicateCameron.position = [groupCameron.position[0] + distanceBetweenRectangles, groupCameron.position[1]];

    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 67.5);
    var yCoordPreto = -((cylinderSize / 2 - 67.5) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }

    var grupoCirculosColoridosFinal = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(grupoCirculosColoridosFinal, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(grupoCirculosColoridosFinal, ElementPlacement.PLACEATEND);

    var duplicategrupoCirculosColoridos = grupoCirculosColoridosFinal.duplicate();
    duplicategrupoCirculosColoridos.left = distanceBetweenRectangles + ((sizeCameron - circuloBrancoCores) / 2);

    var whiteCMYK = new CMYKColor();
    whiteCMYK.cyan = 0;
    whiteCMYK.magenta = 0;
    whiteCMYK.yellow = 0;
    whiteCMYK.black = 0;

    //inserir o label Cliente
    var texto = doc.textFrames.add();
    var tamanhoLabel = 12;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 12;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    texto.contents = cpc + " - " + nomeArte + " - " + formatarData(new Date()) + " - " + "ALPHACOLOR";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.rotate(90);
    if (cac == "IN MOLD LABEL") {
        texto.textRange.characterAttributes.fillColor = registrationColor;
    } else {
        texto.textRange.characterAttributes.fillColor = whiteCMYK
    }
    texto.position = [distanciaLabel, ((cylinderSize / 2) - 67.5)]

    //Texto CP
    var textoCp = doc.textFrames.add();
    var tamanhoLabel = 12;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 12;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2;
    textoCp.contents = produto;
    textoCp.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    textoCp.rotate(90);
    if (cac == "IN MOLD LABEL") {
        textoCp.textRange.characterAttributes.fillColor = registrationColor;
    } else {
        textoCp.textRange.characterAttributes.fillColor = whiteCMYK
    }
    textoCp.position = [distanciaLabel, -76 - 15]

    // Crie um objeto de texto para cada parte de coresv
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = coresComNumeros[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();
    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width;
    var tamanhoLabelCores = 12
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 12;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    var posLabel = ((cylinderSize / 2) - 67.5) - grupoCirculosColoridosFinal.height - grupoLabel.height - 5;
    grupoLabel.top = -posLabel;
    grupoLabel.left = distanciaLabel;

    // Posicione o texto conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        grupoLabel.rotate(180);
        grupoLabel.left = distanceBetweenRectangles;
    } else if (pos == "C") {
        grupoLabel.left = distanciaLabel + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)
    } else {

    }


    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.02;
    var tamanhoLabel90 = tamanhoLabel * 0.8;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.8;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((-posLabel) - ((grupoLabel.height - retangulo.height) / 2))];
    // Posicione o retangulo conforme necessário baseado nas posições
    if (pos == "ECD" || pos == "EC" || pos == "E" || pos == "ED") {

    } else if (pos == "CD" || pos == "D") {
        retangulo.left = distanceBetweenRectangles + ((sizeCameron - tamanhoLabel90) / 2);
    } else if (pos == "C") {
        retangulo.left = ((sizeCameron - tamanhoLabel90) / 2) + distanceCameron + objectWidth + sizeCameron + ((distanceBetweenLanes - sizeCameron) / 2)

    }

    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);


    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j]) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"

        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
        if (cac == "TERMOENCOLHIVEL LE") {
            group.left = centerX - group.width / 2 + (0.5 / 0.35277777777782);

        } else if (cac == "TERMOENCOLHIVEL LD") {
            group.left = centerX - group.width / 2 - (0.5 / 0.35277777777782);

        } else {
            group.left = centerX - group.width / 2;
        }


        //Mensagens para cada tipo de montagem
        if (cac.indexOf("BULA") >= 0 || cac.indexOf("ROTULO") >= 0) {

            var alertMessage = "Montagem e Label feitos, nao esquecer das cruzetas centrais e escalas de densidade";
            var dialog = new Window('dialog', 'Mensagem Importante');
            var messageText = dialog.add('statictext', undefined, alertMessage);
            messageText.characters = alertMessage.length;

            var okButton = dialog.add('button', undefined, 'OK');
            okButton.onClick = function() {
                dialog.close();
            };

            dialog.show();

        } else if (cac.indexOf("IN MOLD LABEL") >= 0) {

            var alertMessage = "Montagem e Label feitos, nao esquecer de aplicar as fotocelulas";
            var dialog = new Window('dialog', 'Mensagem Importante');
            var messageText = dialog.add('statictext', undefined, alertMessage);
            messageText.characters = alertMessage.length;

            var okButton = dialog.add('button', undefined, 'OK');
            okButton.onClick = function() {
                dialog.close();
            };

            dialog.show();

        } else {

            var alertMessage = "Montagem e Label feitos";
            var dialog = new Window('dialog', 'Mensagem Importante');
            var messageText = dialog.add('statictext', undefined, alertMessage);
            messageText.characters = alertMessage.length;

            var okButton = dialog.add('button', undefined, 'OK');
            okButton.onClick = function() {
                dialog.close();
            };

            dialog.show();



        }





    }
}
//PinhoPack
function montagemPinhoPack() {
    // Variaveis dos registros
    var alturaRetanguloBranco = 2.869 / 0.35277777777782;
    var larguraRetanguloRegistros = 0.08 / 0.35277777777782;
    var diametroCirculoBrancoMenor = 1.55 / 0.35277777777782;
    var diametroCirculoPreto = 1.722 / 0.35277777777782;
    var diametroMicropontoPreto = 0.287 / 0.35277777777782;
    var diametroMicropontoBranco = 0.114 / 0.35277777777782;
    var retangleBrancoLargura = 0.29 / 0.35277777777782;
    var circuloBrancoCores = 1.435 / 0.35277777777782;
    var circuloPretoCores = 1.148 / 0.35277777777782;
    var distanciaBranco = 0.57 / 0.35277777777782;
    var distanciaPreto = 0.857 / 0.35277777777782;

    if (sizeCameron < (2 / 0.35277777777782)) {
        var alturaRetanguloBranco = alturaRetanguloBranco * 0.75;
        var larguraRetanguloRegistros = larguraRetanguloRegistros * 0.75;
        var diametroCirculoBrancoMenor = diametroCirculoBrancoMenor * 0.75;
        var diametroCirculoPreto = diametroCirculoPreto * 0.75;
        var diametroMicropontoPreto = diametroMicropontoPreto * 0.75;
        var diametroMicropontoBranco = diametroMicropontoBranco * 0.75;
        var retangleBrancoLargura = retangleBrancoLargura * 0.75;
        var circuloBrancoCores = circuloBrancoCores * 0.75;
        var circuloPretoCores = circuloPretoCores * 0.75;
        var distanciaBranco = 0.43 / 0.35277777777782;
        var distanciaPreto = 0.647 / 0.35277777777782;
    } else {
        //alert("size cameron =" + sizeCameron + isNaN(sizeCameron))
    }

    // Criando os registros
    var retanguloBranco = createWhiteRectangle(0, -alturaRetanguloBranco / 2, sizeCameron, alturaRetanguloBranco);
    var circuloPreto = createBlackCircle(((sizeCameron - diametroCirculoPreto) / 2), diametroCirculoPreto / 2, diametroCirculoPreto);
    var circuloBranco = createWhiteCircle(((sizeCameron - diametroCirculoBrancoMenor) / 2), diametroCirculoBrancoMenor / 2, diametroCirculoBrancoMenor);
    var retanguloVerticalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, alturaRetanguloBranco);
    var retanguloHorizontalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, sizeCameron);
    retanguloHorizontalRegistros.rotate(90);
    retanguloHorizontalRegistros.position = [0, larguraRetanguloRegistros / 2];
    retanguloVerticalRegistros.position = [(sizeCameron - larguraRetanguloRegistros) / 2, alturaRetanguloBranco / 2];
    var circuloPretoMicroponto = createBlackCircle(sizeCameron + 0.6236, diametroMicropontoPreto / 2, diametroMicropontoPreto);
    var circuloBrancoMicroponto = createWhiteCircle(sizeCameron + 0.6236 + ((diametroMicropontoPreto - diametroMicropontoBranco) / 2), diametroMicropontoBranco / 2, diametroMicropontoBranco);
    var cameron = createBlackRectangle(0, -cylinderSize / 2, sizeCameron, cylinderSize);
    var brancoCameron = createWhiteRectangle((sizeCameron - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    retanguloVerticalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloHorizontalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBranco.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPreto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPretoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloBranco.move(finalGroup, ElementPlacement.PLACEATEND);


    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.115 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle(0, -(alturaMarceDeCorte / 2), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 30);
    var yCoordPreto = -((cylinderSize / 2 - 30) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }

    var groupDuplicateUpD = groupDuplicateUp.duplicate();
    var groupDuplicateDownD = groupDuplicateDown.duplicate();
    var finalGroupD = finalGroup.duplicate();
    var grupoDeRetangulosD = grupoDeRetangulos.duplicate();
    var brancoCameronD = brancoCameron.duplicate();
    var cameronD = cameron.duplicate();

    //Grupo do Cameron
    var mainGroup = app.activeDocument.groupItems.add();
    finalGroupD.move(mainGroup, ElementPlacement.PLACEATEND);
    cameronD.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateUpD.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDownD.move(mainGroup, ElementPlacement.PLACEATEND);
    grupoDeRetangulosD.move(mainGroup, ElementPlacement.PLACEATEND);
    //brancoCameronD.move(mainGroup, ElementPlacement.PLACEATEND);

    mainGroup.position = [mainGroup.position[0] + distanceBetweenRectangles - (larguraMarcaDeCorte - sizeCameron), mainGroup.position[1]];
    mainGroup.rotate(180);



    //Grupo dos Circulos das Cores
    var circulosCores = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(circulosCores, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(circulosCores, ElementPlacement.PLACEATEND);

    // Definir as coordenadas para mover o grupo para a posição desejada
    var novaPosicaoX = ((sizeCameron - circuloBrancoCores) / 2);
    var novaPosicaoY = circulosCores.height / 2;

    // Mover o grupo para a nova posição
    circulosCores.translate(novaPosicaoX - circulosCores.position[0], novaPosicaoY - circulosCores.position[1]);

    //var grupoDuplicadoDireitaCores = circulosCores.duplicate();

    // Calcula os valores de deslocamento
    var moveDownValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));
    var moveUpValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));

    // Move o grupo circulosCores para baixo
    circulosCores.translate(0, -moveDownValue);

    // Move o grupo grupoDuplicadoDireitaCores para cima
    //grupoDuplicadoDireitaCores.translate(0, moveUpValue);

    //grupoDuplicadoDireitaCores.left = distanceBetweenRectangles + ((sizeCameron - circuloBrancoCores) / 2);

    //inserir o label 
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - " + lpc + "lpc" + " - " + "ALPHA";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;


    // Posicione o texto conforme necessário baseado nas posições
    texto.position = [distanciaLabel, -20];

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    // Posicione o retangulo conforme necessário baseado nas posições
    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];


    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j]) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//Aplipack
function montagemAplipack() {
    // Variaveis dos registros
    var alturaRetanguloBranco = 2.869 / 0.35277777777782;
    var larguraRetanguloRegistros = 0.08 / 0.35277777777782;
    var diametroCirculoBrancoMenor = 1.55 / 0.35277777777782;
    var diametroCirculoPreto = 1.722 / 0.35277777777782;
    var diametroMicropontoPreto = 0.287 / 0.35277777777782;
    var diametroMicropontoBranco = 0.114 / 0.35277777777782;
    var retangleBrancoLargura = 0.29 / 0.35277777777782;
    var circuloBrancoCores = 1.435 / 0.35277777777782;
    var circuloPretoCores = 1.148 / 0.35277777777782;
    var distanciaBranco = 0.57 / 0.35277777777782;
    var distanciaPreto = 0.857 / 0.35277777777782;

    if (sizeCameron < (2 / 0.35277777777782)) {
        var alturaRetanguloBranco = alturaRetanguloBranco * 0.75;
        var larguraRetanguloRegistros = larguraRetanguloRegistros * 0.75;
        var diametroCirculoBrancoMenor = diametroCirculoBrancoMenor * 0.75;
        var diametroCirculoPreto = diametroCirculoPreto * 0.75;
        var diametroMicropontoPreto = diametroMicropontoPreto * 0.75;
        var diametroMicropontoBranco = diametroMicropontoBranco * 0.75;
        var retangleBrancoLargura = retangleBrancoLargura * 0.75;
        var circuloBrancoCores = circuloBrancoCores * 0.75;
        var circuloPretoCores = circuloPretoCores * 0.75;
        var distanciaBranco = 0.43 / 0.35277777777782;
        var distanciaPreto = 0.647 / 0.35277777777782;
    } else {
        //alert("size cameron =" + sizeCameron + isNaN(sizeCameron))
    }

    // Criando os registros
    var retanguloBranco = createWhiteRectangle(0, -alturaRetanguloBranco / 2, sizeCameron, alturaRetanguloBranco);
    var circuloPreto = createBlackCircle(((sizeCameron - diametroCirculoPreto) / 2), diametroCirculoPreto / 2, diametroCirculoPreto);
    var circuloBranco = createWhiteCircle(((sizeCameron - diametroCirculoBrancoMenor) / 2), diametroCirculoBrancoMenor / 2, diametroCirculoBrancoMenor);
    var retanguloVerticalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, alturaRetanguloBranco);
    var retanguloHorizontalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, sizeCameron);
    retanguloHorizontalRegistros.rotate(90);
    retanguloHorizontalRegistros.position = [0, larguraRetanguloRegistros / 2];
    retanguloVerticalRegistros.position = [(sizeCameron - larguraRetanguloRegistros) / 2, alturaRetanguloBranco / 2];
    var circuloPretoMicroponto = createBlackCircle(sizeCameron + 0.6236, diametroMicropontoPreto / 2, diametroMicropontoPreto);
    var circuloBrancoMicroponto = createWhiteCircle(sizeCameron + 0.6236 + ((diametroMicropontoPreto - diametroMicropontoBranco) / 2), diametroMicropontoBranco / 2, diametroMicropontoBranco);
    var cameron = createBlackRectangle(0, -cylinderSize / 2, sizeCameron, cylinderSize);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 60;
    cameron.fillColor = spotColorFill;
    var brancoCameron = createWhiteRectangle((sizeCameron - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    retanguloVerticalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloHorizontalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBranco.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPreto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPretoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloBranco.move(finalGroup, ElementPlacement.PLACEATEND);


    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.115 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle(0, -(alturaMarceDeCorte / 2), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 30);
    var yCoordPreto = -((cylinderSize / 2 - 30) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }


    //Grupo do Cameron
    var mainGroup = app.activeDocument.groupItems.add();
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    grupoDeRetangulos.move(mainGroup, ElementPlacement.PLACEATEND);
    brancoCameron.move(mainGroup, ElementPlacement.PLACEATEND);
    cameron.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles - (larguraMarcaDeCorte - sizeCameron), mainGroup.position[1]];
    groupDuplicateRight.rotate(180);

    //Grupo dos Circulos das Cores
    var circulosCores = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(circulosCores, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(circulosCores, ElementPlacement.PLACEATEND);

    // Definir as coordenadas para mover o grupo para a posição desejada
    var novaPosicaoX = ((sizeCameron - circuloBrancoCores) / 2);
    var novaPosicaoY = circulosCores.height / 2;

    // Mover o grupo para a nova posição
    circulosCores.translate(novaPosicaoX - circulosCores.position[0], novaPosicaoY - circulosCores.position[1]);

    var grupoDuplicadoDireitaCores = circulosCores.duplicate();

    // Calcula os valores de deslocamento
    var moveDownValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));
    var moveUpValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));

    // Move o grupo circulosCores para baixo
    circulosCores.translate(0, -moveDownValue);

    // Move o grupo grupoDuplicadoDireitaCores para cima
    grupoDuplicadoDireitaCores.translate(0, moveUpValue);

    grupoDuplicadoDireitaCores.left = distanceBetweenRectangles + ((sizeCameron - circuloBrancoCores) / 2);

    //inserir o label 
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - " + lpc + "lpc" + " - " + "ALPHA";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;


    // Posicione o texto conforme necessário baseado nas posições
    texto.position = [distanciaLabel, -20];

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    // Posicione o retangulo conforme necessário baseado nas posições
    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];


    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j]) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//WoodFlex
function montagemWoodFlex() {
    // Variaveis dos registros
    var alturaRetanguloBranco = 2.869 / 0.35277777777782;
    var larguraRetanguloRegistros = 0.08 / 0.35277777777782;
    var diametroCirculoBrancoMenor = 1.55 / 0.35277777777782;
    var diametroCirculoPreto = 1.722 / 0.35277777777782;
    var diametroMicropontoPreto = 0.287 / 0.35277777777782;
    var diametroMicropontoBranco = 0.114 / 0.35277777777782;
    var retangleBrancoLargura = 0.29 / 0.35277777777782;
    var circuloBrancoCores = 1.435 / 0.35277777777782;
    var circuloPretoCores = 1.148 / 0.35277777777782;
    var distanciaBranco = 0.57 / 0.35277777777782;
    var distanciaPreto = 0.857 / 0.35277777777782;
    var alturaRetanguloCentralWhite = 0.1 / 0.35277777777782;
    var larguraRetanguloCentralWhite = 1 / 0.35277777777782;
    var alturaRetanguloCentralBlack = 0.287 / 0.35277777777782;
    var larguraRetanguloCentralBlack = 1.2 / 0.35277777777782;

    if (sizeCameron < (2 / 0.35277777777782)) {
        var alturaRetanguloBranco = alturaRetanguloBranco * 0.75;
        var larguraRetanguloRegistros = larguraRetanguloRegistros * 0.75;
        var diametroCirculoBrancoMenor = diametroCirculoBrancoMenor * 0.75;
        var diametroCirculoPreto = diametroCirculoPreto * 0.75;
        var diametroMicropontoPreto = diametroMicropontoPreto * 0.75;
        var diametroMicropontoBranco = diametroMicropontoBranco * 0.75;
        var retangleBrancoLargura = retangleBrancoLargura * 0.75;
        var circuloBrancoCores = circuloBrancoCores * 0.75;
        var circuloPretoCores = circuloPretoCores * 0.75;
        var distanciaBranco = 0.43 / 0.35277777777782;
        var distanciaPreto = 0.647 / 0.35277777777782;
    } else {
        //alert("size cameron =" + sizeCameron + isNaN(sizeCameron))
    }

    // Criando os registros
    var retanguloBranco = createWhiteRectangle(0, -alturaRetanguloBranco / 2, sizeCameron, alturaRetanguloBranco);
    var circuloPreto = createBlackCircle(((sizeCameron - diametroCirculoPreto) / 2), diametroCirculoPreto / 2, diametroCirculoPreto);
    var circuloBranco = createWhiteCircle(((sizeCameron - diametroCirculoBrancoMenor) / 2), diametroCirculoBrancoMenor / 2, diametroCirculoBrancoMenor);
    var retanguloVerticalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, alturaRetanguloBranco);
    var retanguloHorizontalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, sizeCameron);
    retanguloHorizontalRegistros.rotate(90);
    retanguloHorizontalRegistros.position = [0, larguraRetanguloRegistros / 2];
    retanguloVerticalRegistros.position = [(sizeCameron - larguraRetanguloRegistros) / 2, alturaRetanguloBranco / 2];
    var circuloPretoMicroponto = createBlackCircle(sizeCameron + 0.3, diametroMicropontoPreto / 2, diametroMicropontoPreto);
    var circuloBrancoMicroponto = createWhiteCircle(sizeCameron + 0.3 + ((diametroMicropontoPreto - diametroMicropontoBranco) / 2), diametroMicropontoBranco / 2, diametroMicropontoBranco);
    var retanguloCentralWhite = createWhiteRectangle(sizeCameron + 0.15826771653545 + diametroMicropontoPreto, -alturaRetanguloCentralWhite / 2, larguraRetanguloCentralWhite, alturaRetanguloCentralWhite)
    var retanguloCentralBlack = createBlackRectangle((sizeCameron + 0.15826771653545 + diametroMicropontoPreto) - ((larguraRetanguloCentralBlack - larguraRetanguloCentralWhite) / 2), -alturaRetanguloCentralBlack / 2, larguraRetanguloCentralBlack, alturaRetanguloCentralBlack)
    var cameron = createBlackRectangle(0, -cylinderSize / 2, sizeCameron, cylinderSize);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 60;
    cameron.fillColor = spotColorFill;
    var brancoCameron = createWhiteRectangle((sizeCameron - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);


    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    retanguloVerticalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloHorizontalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBranco.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPreto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloCentralWhite.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPretoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloCentralBlack.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloBranco.move(finalGroup, ElementPlacement.PLACEATEND);


    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.115 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle(0, -(alturaMarceDeCorte / 2), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 30);
    var yCoordPreto = -((cylinderSize / 2 - 30) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }


    //Grupo do Cameron
    var mainGroup = app.activeDocument.groupItems.add();
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    grupoDeRetangulos.move(mainGroup, ElementPlacement.PLACEATEND);
    brancoCameron.move(mainGroup, ElementPlacement.PLACEATEND);
    cameron.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles - (larguraMarcaDeCorte - sizeCameron), mainGroup.position[1]];
    groupDuplicateRight.rotate(180);

    //Grupo dos Circulos das Cores
    var circulosCores = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(circulosCores, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(circulosCores, ElementPlacement.PLACEATEND);

    // Definir as coordenadas para mover o grupo para a posição desejada
    var novaPosicaoX = ((sizeCameron - circuloBrancoCores) / 2);
    var novaPosicaoY = circulosCores.height / 2;

    // Mover o grupo para a nova posição
    circulosCores.translate(novaPosicaoX - circulosCores.position[0], novaPosicaoY - circulosCores.position[1]);

    var grupoDuplicadoDireitaCores = circulosCores.duplicate();

    // Calcula os valores de deslocamento
    var moveDownValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));
    var moveUpValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));

    // Move o grupo circulosCores para baixo
    circulosCores.translate(0, -moveDownValue);

    // Move o grupo grupoDuplicadoDireitaCores para cima
    grupoDuplicadoDireitaCores.translate(0, moveUpValue);

    grupoDuplicadoDireitaCores.left = distanceBetweenRectangles + ((sizeCameron - circuloBrancoCores) / 2);

    //inserir o label 
    var texto = doc.textFrames.add();
    var tamanhoLabel = 6;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 6;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - " + lpc + "lpc" + " - " + "ALPHA";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;


    // Posicione o texto conforme necessário baseado nas posições
    texto.position = [distanciaLabel, -20];

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    // Posicione o retangulo conforme necessário baseado nas posições
    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 6;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 6;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];


    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j]) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//Shclemper
function montagemSchlemper() {
    // Variaveis dos registros
    var alturaRetanguloBranco = 2.869 / 0.35277777777782;
    var larguraRetanguloRegistros = 0.08 / 0.35277777777782;
    var diametroCirculoBrancoMenor = 1.55 / 0.35277777777782;
    var diametroCirculoPreto = 1.722 / 0.35277777777782;
    var diametroMicropontoPreto = 0.287 / 0.35277777777782;
    var diametroMicropontoBranco = 0.114 / 0.35277777777782;
    var diametroMicropontoBrancoMaior = 0.39 / 0.35277777777782;
    var retangleBrancoLargura = 0.29 / 0.35277777777782;
    var circuloBrancoCores = 1.435 / 0.35277777777782;
    var circuloPretoCores = 1.148 / 0.35277777777782;
    var distanciaBranco = 0.57 / 0.35277777777782;
    var distanciaPreto = 0.857 / 0.35277777777782;

    // Criando os registros
    var retanguloBranco = createWhiteRectangle(0, -alturaRetanguloBranco / 2, sizeCameron, alturaRetanguloBranco);
    var circuloPreto = createBlackCircle(((sizeCameron - diametroCirculoPreto) / 2), diametroCirculoPreto / 2, diametroCirculoPreto);
    var circuloBranco = createWhiteCircle(((sizeCameron - diametroCirculoBrancoMenor) / 2), diametroCirculoBrancoMenor / 2, diametroCirculoBrancoMenor);
    var retanguloVerticalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, alturaRetanguloBranco);
    var retanguloHorizontalRegistros = createBlackRectangle(0, 0, larguraRetanguloRegistros, sizeCameron);
    retanguloHorizontalRegistros.rotate(90);
    retanguloHorizontalRegistros.position = [0, larguraRetanguloRegistros / 2];
    retanguloVerticalRegistros.position = [(sizeCameron - larguraRetanguloRegistros) / 2, alturaRetanguloBranco / 2];
    var circuloBrancoMicropontoMaior = createWhiteCircle((sizeCameron + (0.6236 - (diametroMicropontoBrancoMaior - diametroMicropontoPreto) / 2)), diametroMicropontoBrancoMaior / 2, diametroMicropontoBrancoMaior);
    var circuloPretoMicroponto = createBlackCircle(sizeCameron + 0.6236, diametroMicropontoPreto / 2, diametroMicropontoPreto);
    var circuloBrancoMicroponto = createWhiteCircle(sizeCameron + 0.6236 + ((diametroMicropontoPreto - diametroMicropontoBranco) / 2), diametroMicropontoBranco / 2, diametroMicropontoBranco);
    var cameron = createBlackRectangle(0, -cylinderSize / 2, sizeCameron, cylinderSize);
    var spotColor = doc.spots.getByName("PassarRegistration");
    var spotColorFill = new SpotColor();
    spotColorFill.spot = spotColor;
    spotColorFill.tint = 60;
    cameron.fillColor = spotColorFill;

    var brancoCameron = createWhiteRectangle((sizeCameron - retangleBrancoLargura) / 2, -cylinderSize / 2, retangleBrancoLargura, cylinderSize);

    // Cria grupo final e move os elementos para o grupo final
    var finalGroup = app.activeDocument.groupItems.add();
    retanguloVerticalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloHorizontalRegistros.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBranco.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPreto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloPretoMicroponto.move(finalGroup, ElementPlacement.PLACEATEND);
    circuloBrancoMicropontoMaior.move(finalGroup, ElementPlacement.PLACEATEND);
    retanguloBranco.move(finalGroup, ElementPlacement.PLACEATEND);


    // Duplica o grupo para cima
    var groupDuplicateUp = finalGroup.duplicate();
    var distanceUp = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateUp.position = [finalGroup.position[0], finalGroup.position[1] - distanceUp];

    // Duplica o grupo para baixo
    var groupDuplicateDown = finalGroup.duplicate();
    var distanceDown = (cylinderSize - sizeCameron) / 2 - 11.33;
    groupDuplicateDown.position = [finalGroup.position[0], finalGroup.position[1] + distanceDown];

    //marcar de corte cameron
    var larguraMarcaDeCorte = sizeCameron * 1.5;
    var alturaMarceDeCorte = 0.115 / 0.35277777777782;
    var marcaDeCorte = createBlackRectangle(0, -(alturaMarceDeCorte / 2), larguraMarcaDeCorte, alturaMarceDeCorte);

    // Duplicar o objeto para cima
    var marcaDeCorteDuplicada = marcaDeCorte.duplicate();
    marcaDeCorteDuplicada.top = marcaDeCorte.top - cylinderSize; // Posição duplicada para cima

    // Agrupar os dois retângulos
    var grupoDeRetangulos = app.activeDocument.groupItems.add();
    marcaDeCorte.moveToBeginning(grupoDeRetangulos);
    marcaDeCorteDuplicada.moveToBeginning(grupoDeRetangulos);

    // Mover o grupo para baixo usando a variável cylinderSize / 2
    grupoDeRetangulos.top = grupoDeRetangulos.top + cylinderSize / 2;

    // Criando bolas de densidade
    var yCoordBranco = -(cylinderSize / 2 - 30);
    var yCoordPreto = -((cylinderSize / 2 - 30) + ((circuloBrancoCores - circuloPretoCores) / 2));

    // Criar um grupo para círculos brancos
    var grupoCirculosBrancos = app.activeDocument.groupItems.add();

    // Criar um grupo para círculos pretos
    var grupoCirculosColoridos = app.activeDocument.groupItems.add();

    // Loop para criar grupos de círculos brancos e adicionar círculos
    for (var i = 0; i < cores.length; i++) {
        var novoGrupoBranco = app.activeDocument.groupItems.add();
        novoGrupoBranco.name = "grupoBranco_" + (i + 1);

        // Adicionar círculo branco ao grupo
        var circleBranco = createWhiteCircle(((sizeCameron - circuloBrancoCores) / 2), yCoordBranco, circuloBrancoCores);
        circleBranco.move(novoGrupoBranco, ElementPlacement.PLACEATEND);
        yCoordBranco += distanciaBranco + circuloBrancoCores;
        novoGrupoBranco.move(grupoCirculosBrancos, ElementPlacement.PLACEATEND);
    }


    // Loop para criar grupos de círculos coloridos e adicionar círculos
    for (var j = 0; j < cores.length; j++) {
        // Criar um grupo para círculos coloridos
        var novoGrupoCor = app.activeDocument.groupItems.add();
        novoGrupoCor.name = "grupoCor_" + (j + 1);

        // Adicionar círculo colorido ao grupo usando a função createColoredCircleFromPalette
        var circleCor = createColoredCircleFromPalette(((sizeCameron - circuloPretoCores) / 2), yCoordPreto, circuloPretoCores, cores[j]);
        circleCor.move(novoGrupoCor, ElementPlacement.PLACEATEND);
        yCoordPreto += distanciaPreto + circuloPretoCores;
        novoGrupoCor.move(grupoCirculosColoridos, ElementPlacement.PLACEATEND);
    }


    //Grupo do Cameron
    var mainGroup = app.activeDocument.groupItems.add();
    groupDuplicateUp.move(mainGroup, ElementPlacement.PLACEATEND);
    groupDuplicateDown.move(mainGroup, ElementPlacement.PLACEATEND);
    finalGroup.move(mainGroup, ElementPlacement.PLACEATEND);
    grupoDeRetangulos.move(mainGroup, ElementPlacement.PLACEATEND);
    brancoCameron.move(mainGroup, ElementPlacement.PLACEATEND);
    cameron.move(mainGroup, ElementPlacement.PLACEATEND);

    // Duplica o grupo para a direita
    var groupDuplicateRight = mainGroup.duplicate();
    groupDuplicateRight.position = [mainGroup.position[0] + distanceBetweenRectangles - (larguraMarcaDeCorte - sizeCameron), mainGroup.position[1]];
    groupDuplicateRight.rotate(180);

    //Grupo dos Circulos das Cores
    var circulosCores = app.activeDocument.groupItems.add();
    grupoCirculosColoridos.move(circulosCores, ElementPlacement.PLACEATEND);
    grupoCirculosBrancos.move(circulosCores, ElementPlacement.PLACEATEND);

    // Definir as coordenadas para mover o grupo para a posição desejada
    var novaPosicaoX = ((sizeCameron - circuloBrancoCores) / 2);
    var novaPosicaoY = circulosCores.height / 2;

    // Mover o grupo para a nova posição
    circulosCores.translate(novaPosicaoX - circulosCores.position[0], novaPosicaoY - circulosCores.position[1]);

    var grupoDuplicadoDireitaCores = circulosCores.duplicate();

    // Calcula os valores de deslocamento
    var moveDownValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));
    var moveUpValue = (cylinderSize / 2) - ((circulosCores.height / 2) + (8.14 + 11.33 + alturaRetanguloBranco));

    // Move o grupo circulosCores para baixo
    circulosCores.translate(0, -moveDownValue);

    // Move o grupo grupoDuplicadoDireitaCores para cima
    grupoDuplicadoDireitaCores.translate(0, moveUpValue);

    grupoDuplicadoDireitaCores.left = distanceBetweenRectangles + ((sizeCameron - circuloBrancoCores) / 2);

    //inserir o label 
    var texto = doc.textFrames.add();
    var tamanhoLabel = 4;
    if (tamanhoLabel >= sizeCameron) {
        tamanhoLabel = sizeCameron;
    } else {
        tamanhoLabel = 4;
    }
    var distanciaLabel = (sizeCameron - tamanhoLabel) / 2
    texto.rotate(90);
    texto.contents = cliente + " - " + produto + " - " + formatarData(new Date()) + " - " + lpc + "lpc" + " - " + "ALPHA";
    texto.textRange.characterAttributes.size = tamanhoLabel; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;


    // Posicione o texto conforme necessário baseado nas posições
    texto.position = [distanciaLabel, -20];

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = texto.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    // Posicione o retangulo conforme necessário baseado nas posições
    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), -(20 - ((textoHeightPorcent - texto.height) / 2))];
    retangulo.zOrder(ZOrderMethod.SENDBACKWARD);

    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    var grupoLabel = app.activeDocument.groupItems.add();

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = 0;
    var tamanhoLabelCores = 4;
    if (tamanhoLabelCores >= sizeCameron) {
        tamanhoLabelCores = sizeCameron;
    } else {
        tamanhoLabelCores = 4;
    }

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = tamanhoLabelCores;
        corTexto.position = [xPosition, 0];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    grupoLabel.rotate(90);
    grupoLabel.top = grupoLabel.height + 20;
    grupoLabel.left = distanciaLabel;

    //criando o retangulo branco abaixo do label
    var white = new CMYKColor();
    var textoHeightPorcent = grupoLabel.height * 1.03;
    var tamanhoLabel90 = tamanhoLabel * 0.9;
    if (tamanhoLabel90 >= sizeCameron) {
        tamanhoLabel90 = sizeCameron
    } else {
        var tamanhoLabel90 = tamanhoLabel * 0.9;
    }
    var retangulo = doc.pathItems.rectangle(texto.geometricBounds[2], texto.geometricBounds[1], textoHeightPorcent, tamanhoLabel90);
    retangulo.rotate(90);
    retangulo.stroked = false;
    retangulo.filled = true;
    retangulo.fillColor = white;

    retangulo.position = [((sizeCameron - tamanhoLabel90) / 2), ((grupoLabel.height + 20) + ((retangulo.height - grupoLabel.height) / 2))];


    var grupoLabelFinal = app.activeDocument.groupItems.add();
    grupoLabel.move(grupoLabelFinal, ElementPlacement.PLACEATEND);
    retangulo.move(grupoLabelFinal, ElementPlacement.PLACEATEND);



    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        var objectsToGroup = [];
        // Adicionar todos os objetos na layer "registros" à seleção, exceto o grupo "cameronCentralGroup"
        for (var j = 0; j < registrosLayer.pageItems.length; j++) {
            if (registrosLayer.pageItems[j]) {
                objectsToGroup.push(registrosLayer.pageItems[j]);
            }
        }

        // Verificar se há objetos para agrupar
        if (objectsToGroup.length > 0) {
            // Selecionar todos os objetos, exceto o grupo "cameronCentralGroup"
            for (var k = 0; k < objectsToGroup.length; k++) {
                objectsToGroup[k].selected = true;
            }


        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros" exceto o grupo "cameronCentralGroup")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;
    }

    var alertMessage = "Montagem e Label feitos";

    var dialog = new Window('dialog', 'Mensagem Importante');
    var messageText = dialog.add('statictext', undefined, alertMessage);
    messageText.characters = alertMessage.length;

    var okButton = dialog.add('button', undefined, 'OK');
    okButton.onClick = function() {
        dialog.close();
    };

    dialog.show();

}
//Rioplastic
function montagemRioplasticLaminados() {

    // Cria cameron
    var retangleCameron = createBlackRectangle(0, -(cylinderSize / 2), sizeCameron, cylinderSize);
    retangleCameron.fillColor = corBlack;

    // Cria grupo final e move os elementos para o grupo final
    var groupCameron = app.activeDocument.groupItems.add();
    retangleCameron.move(groupCameron, ElementPlacement.PLACEATEND);

    // Duplicar o grupo
    var duplicatedGroup = groupCameron.duplicate();

    // Mover o grupo duplicado para a direita
    duplicatedGroup.left += distanceBetweenRectangles;

    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        // Selecionar todos os objetos na layer "registros"
        registrosLayer.pageItems[0].selected = true;
        for (var j = 1; j < registrosLayer.pageItems.length; j++) {
            registrosLayer.pageItems[j].selected = true;
        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

    }

    // Condição para mover o cameron caso tenha deslocamento de pistas
    if (lanes % 2 === 0 && displacementBetweenLanes > 0) {
        duplicatedGroup.top = (-displacementBetweenLanes / 2) + (cylinderSize / 2);
    } else {

    }

    if (pos != "") {
        var alertMessage = "Verificar a cor do Cameron conforme OS";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

    } else {
        var alertMessage = "Montagem e Label feitos";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

    }

    dialog.show();


    //Camerons Position
    if (pos == "E") {
        duplicatedGroup.remove()
    } else if (pos == "D") {
        groupCameron.remove()
    } else if (pos == "ED") {

    } else {
        duplicatedGroup.remove()
        groupCameron.remove()
    }

    //Label
    label();

}
//Grafigel
function montagemGrafigel() {

    // Cria cameron
    var retangleCameron = createBlackRectangle(0, -(cylinderSize / 2), sizeCameron, cylinderSize);
    retangleCameron.fillColor = registrationColor;

    // Cria grupo final e move os elementos para o grupo final
    var groupCameron = app.activeDocument.groupItems.add();
    retangleCameron.move(groupCameron, ElementPlacement.PLACEATEND);

    // Duplicar o grupo
    var duplicatedGroup = groupCameron.duplicate();

    // Mover o grupo duplicado para a direita
    duplicatedGroup.left += distanceBetweenRectangles;

    // Localizar a layer "registros" no documento
    var registrosLayer = null;
    for (var i = 0; i < app.activeDocument.layers.length; i++) {
        if (app.activeDocument.layers[i].name === "registros") {
            registrosLayer = app.activeDocument.layers[i];
            break;
        }
    }

    // Verificar se a layer "registros" foi encontrada e se há objetos nela
    if (registrosLayer && registrosLayer.pageItems.length > 0) {
        // Selecionar todos os objetos na layer "registros"
        registrosLayer.pageItems[0].selected = true;
        for (var j = 1; j < registrosLayer.pageItems.length; j++) {
            registrosLayer.pageItems[j].selected = true;
        }

        // Agrupar a seleção ativa (todos os objetos na layer "registros")
        app.executeMenuCommand('group');

        // Centralizar o grupo no artboard ativo
        var group = app.selection[0]; // Obtém o grupo resultante da seleção
        var artboard = app.activeDocument.artboards[app.activeDocument.artboards.getActiveArtboardIndex()]; // Obtém o artboard ativo

        // Obtém as coordenadas do centro do artboard
        var centerX = artboard.artboardRect[0] + (artboard.artboardRect[2] - artboard.artboardRect[0]) / 2;
        var centerY = artboard.artboardRect[1] + (artboard.artboardRect[3] - artboard.artboardRect[1]) / 2;

        // Centralizar o grupo no artboard usando a função "translate"
        group.left = centerX - group.width / 2;
        group.top = centerY + group.height / 2 + displacementBetweenLanes / 2;

    }

    // Condição para mover o cameron caso tenha deslocamento de pistas
    if (lanes % 2 === 0 && displacementBetweenLanes > 0) {
        duplicatedGroup.top = (-displacementBetweenLanes / 2) + (cylinderSize / 2);
    } else {

    }

    if (pos != "") {
        var alertMessage = "Verificar a cor do Cameron conforme OS";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

    } else {
        var alertMessage = "Montagem e Label feitos";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

    }

    dialog.show();


    //Camerons Position
    if (pos == "E") {
        duplicatedGroup.remove()
    } else if (pos == "D") {
        groupCameron.remove()
    } else if (pos == "ED") {

    } else {
        duplicatedGroup.remove()
        groupCameron.remove()
    }

    //padrão ALpha
    var texto = doc.textFrames.add();
    texto.contents = cliente + " - " + cac + " - " + produto + " - " + formatarData(new Date()) + " - ";
    texto.textRange.characterAttributes.size = 5; // Tamanho de 1,7 mm
    texto.textRange.fillColor = registrationColor;
    // Posicione o texto conforme necessário
    texto.position = [5, -5];

    var grupoLabel = app.activeDocument.groupItems.add();


    // Crie um objeto de texto para cada parte de cores
    var coresTexto = [];

    for (var i = 0; i < cores.length; i++) {
        var corTexto = doc.textFrames.add();
        corTexto.contents = cores[i];
        coresTexto.push(corTexto);
    }

    // Aplique a cor a cada parte do texto com base na sequência de coresComuns
    for (var i = 0; i < coresComuns.length; i++) {
        aplicarCorTexto(coresTexto[i], coresComuns[i]);
    }

    // Combine todas as partes do texto em um único objeto de texto
    var textoCores = doc.textFrames.add();
    var xPosition = texto.width + 5;

    for (var i = 0; i < coresTexto.length; i++) {
        var corTexto = coresTexto[i];
        corTexto.textRange.size = 5;
        corTexto.position = [xPosition, -5];
        xPosition += corTexto.width + 1; // Ajuste a posição horizontal para a próxima parte
        corTexto.move(grupoLabel, ElementPlacement.PLACEATEND);

    }

    texto.move(grupoLabel, ElementPlacement.PLACEATEND);
    grupoLabel.rotate(90);
    grupoLabel.position = [0, 0];
    textoCores.remove();
}
//Montagens
function montagens(cust) {

    if (cust == undefined) {
        cust = folder
    }

    var pAlpha = (type.indexOf("o Alpha") >= 0)
    var pCli = (type.indexOf("o Cliente") >= 0)
    var cArquivo = (type.indexOf("Conforme Arquivo") >= 0)

    if (((cust.indexOf("limpack") >= 0) || (cust.indexOf("valipack_lima") >= 0)) && pCli) {
        montagemLimpack();

    } else if (((cust.indexOf("rioplastic") >= 0) || (cust.indexOf("embalagens_doma") >= 0)) && pCli) {
        montagemRioplasticLaminados();

    } else if ((cust.indexOf("digilabel") >= 0) && pCli) {
        montagemDigilabel();

    } else if ((cust.indexOf("tri_color_etiquetas") >= 0) && pCli) {
        montagemTricoloretiq();

    } else if ((cust.indexOf("ediprint") >= 0) && pCli) {
        montagemEdiprint();

    } else if ((cust.indexOf("da_print") >= 0) && pCli) {
        montagemDeAPrint();

    } else if ((cust.indexOf("marcoprint") >= 0) && pCli) {
        montagemMarcoprint();

        //} else if ((cust.indexOf("woodflex") >= 0) && pCli) {
        //montagemWoodFlex();

    } else if ((cust.indexOf("ads_print_etiquetas") >= 0) && pCli) {
        montagemPadrao();

    } else if ((cust.indexOf("gade_graff") >= 0) && pCli) {
        montagemGadeGraff();

    } else if ((cust.indexOf("interpack") >= 0) && pCli) {
        montagemInterpack();

    } else if ((cust.indexOf("pinho_pack") >= 0) && pCli) {
        montagemPinhoPack();

    } else if ((cust.indexOf("paper_label") >= 0) && pCli) {
        montagemAplipack();

    } else if ((cust.indexOf("idr_rotulos") >= 0) && pCli) {
        montagemAplipack();

    } else if ((cust.indexOf("louvetique") >= 0) && pCli) {
        montagemAplipack();

    } else if ((cust.indexOf("grafica_boca_boa") >= 0) && pCli) {
        montagemAplipack();

    } else if ((cust.indexOf("majicplast_matriz") >= 0) && pCli) {
        montagemMajicplast();

    } else if ((cust.indexOf("art_point_grafica") >= 0) && pCli) {
        montagemAplipack();

    } else if ((cust.indexOf("schlemper") >= 0) && pCli) {
        montagemSchlemper();

    } else if ((cust.indexOf("novatack") >= 0) && pCli) {
        montagemNovatack();

    } else if ((cust.indexOf("videplast") >= 0) && pCli) {
        montagemRioplasticLaminados();

    } else if ((cust.indexOf("alpha_color") >= 0) && pCli) {
        montagemAlphaColor();

    } else if ((cust.indexOf("grafica_gsj") >= 0) && pCli) {
        montagemDigilabel();

    } else if ((cust.indexOf("grafigel") >= 0) && pCli) {
        montagemGrafigel();

    } else if ((cust.indexOf("aplipack") >= 0) && pCli) {
        montagemAplipack();

    } else if ((cust.indexOf("contisul") >= 0) && pCli) {
        montagemContisul();

    } else if ((cust.indexOf("ral_print_sistemas") >= 0) && pCli) {
        montagemRalprint();

    } else if ((cust.indexOf("cimed") >= 0) && pCli) {
        montagemCimed();

    } else if (cArquivo) {

        label();

        var alertMessage = "Cameron Conforme Arquivo - Somente Imposicao e Label feita";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();

    } else if (pAlpha) {
        montagemPadrao();

    } else {

        label();

        var alertMessage = "Sem Cameron Padrao Alpha ou do Cliente automatizado - Somente Imposicao e Label feita";
        var dialog = new Window('dialog', 'Mensagem Importante');
        var messageText = dialog.add('statictext', undefined, alertMessage);
        messageText.characters = alertMessage.length;

        var okButton = dialog.add('button', undefined, 'OK');
        okButton.onClick = function() {
            dialog.close();
        };

        dialog.show();
    }
}
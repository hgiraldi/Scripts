var app = app || {};
app.documents = app.documents || [];


if (app.documents.length === 0) {
    alert("Não há nenhum documento aberto. Abra um documento antes de executar este script.");
} else {
    var dlg = new Window("dialog", "Scripts Ondulado");

    function getScriptDirectory() {
        var scriptFile = new File($.fileName);
        return scriptFile.parent.fsName;
    }
    // Obter o diretório do script
    var scriptDirectory = getScriptDirectory();

    // Adiciona um texto explicativo
    var textoExplicativo = dlg.add("statictext", undefined, "Número da Ordem de Serviço:");

    // Adiciona um campo de texto maior para o número de ordem de serviço
    var numeroOrdemInput = dlg.add("edittext", undefined, "", {
        characters: 30,
        justify: "left"
    });

    // Ajusta a largura do campo de entrada
    numeroOrdemInput.preferredSize.width = 150;

    // Ajusta a largura da janela
    dlg.preferredSize.width = 150;

    numeroOrdemInput.active = true;

    // Adiciona checkboxes em linhas separadas
    //var checkbox1 = dlg.add("checkbox", undefined, "Montagem");
    //var checkbox8 = dlg.add("checkbox", undefined, "Montagem + Distorção");
    var checkbox2 = dlg.add("checkbox", undefined, "Label Alpha");
    //var checkbox3 = dlg.add("checkbox", undefined, "Distorção");
    //var checkbox4 = dlg.add("checkbox", undefined, "Números Pistas");
    //var checkbox5 = dlg.add("checkbox", undefined, "Planta Grupo Embrasa");
    //var checkbox6 = dlg.add("checkbox", undefined, "Úteis");
    //var checkbox7 = dlg.add("checkbox", undefined, "Micropontos");
    //var checkbox9 = dlg.add("checkbox", undefined, "Box Valfilm Mg");
    var checkbox10 = dlg.add("checkbox", undefined, "Medição Ondulado");
    var checkbox11 = dlg.add("checkbox", undefined, "Layers Ondulado");
    var checkbox12 = dlg.add("checkbox", undefined, "Etiquetas Cores Ondulado");
    var checkbox13 = dlg.add("checkbox", undefined, "Preenchimento Cabeçalho");
    var checkbox14 = dlg.add("checkbox", undefined, "Risco Poliester");


    // Adiciona um painel vazio para espaçamento
    dlg.add("panel");

    // Botão Executar para confirmar a seleção
    var btnExecutar = dlg.add("button", undefined, "Executar");
    // Botão Cancelar para fechar sem fazer nada
    var btnCancelar = dlg.add("button", undefined, "Cancelar");

    // Adiciona manipulador de eventos para checkboxes
    var checkboxes = [checkbox2, checkbox10, checkbox11, checkbox12, checkbox13, checkbox14];
    for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].alignment = "left";
        checkboxes[i].onClick = function() {
            for (var j = 0; j < checkboxes.length; j++) {
                if (checkboxes[j] != this) {
                    checkboxes[j].value = false;
                }
            }
        };
    }

    // Ação do botão Executar
    btnExecutar.onClick = function() {
        var serviceOrderNumber = numeroOrdemInput.text;

        if (serviceOrderNumber.length !== 7) {
            alert("O número de ordem de serviço deve ter 7 dígitos.");
            return;
        }

        if (checkbox10.value) {
            
            #include "z_Complementos/10_Medicao_Ondulado.jsx";

        } else if (checkbox11.value) {

            #include "z_Complementos/11_Criar_Layers_Ondulado.jsx";

        } else if (checkbox12.value) {

            #include "z_Complementos/12_Gerar_Etiqueta_Penha.jsx";
        

        } else if (checkbox13.value) {

            #include "z_Complementos/13_Preenchimento_Penha.jsx";

        } else if (checkbox2.value) {

            #include "z_Complementos/2_Label_Alpha.jsx";

        } else if (checkbox14.value) {

            #include "z_Complementos/14_Risco_Faca.jsx";

        }

    

        dlg.close();
    };

    // Ação do botão Cancelar
    btnCancelar.onClick = function() {
        dlg.close();
    };

    dlg.show();
}
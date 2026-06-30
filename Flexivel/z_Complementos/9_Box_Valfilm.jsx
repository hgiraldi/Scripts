#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

// Salvar o objeto selecionado em uma variável
var selectedObject = app.activeDocument.selection[0];

// Criar uma janela de diálogo
var dialog = new Window("dialog", "Configurar Tamanho do Box");

// Adicionar um painel à janela de diálogo
var panel = dialog.add("panel");
panel.alignChildren = "left";

// Adicionar um campo de texto para o tamanho do box
var tamanhoBoxText = panel.add("statictext", undefined, "Tamanho do Box:");
var tamanhoBoxInput = panel.add("edittext", undefined, "");
tamanhoBoxInput.characters = 10; // Definir o número de caracteres visíveis
tamanhoBoxInput.active = true;

// Adicionar botões OK e Cancelar
var buttonsGroup = dialog.add("group");
// Botoes com {name:"ok"}/{name:"cancel"}: o ScriptUI FECHA nativamente (o
// fechamento manual via onClick entra em loop quando roda pelo painel CEP).
var okButton = buttonsGroup.add("button", undefined, "OK", { name: "ok" });
var cancelButton = buttonsGroup.add("button", undefined, "Cancelar", { name: "cancel" });

// Mostrar a janela de diálogo (o valor e lido depois de tamanhoBoxInput.text)
dialog.show();

function boxValfilm() {
    var tamanhoCilindro = cylinderSizeMM;
    var tamanhoFechamento = closureInput;

    // Calcular a porcentagem de redimensionamento
    var porcentagemRedimensionamento = tamanhoCilindro / tamanhoFechamento;

    // Obter o valor numérico de tamanhoBoxInput
    var tamanhoBoxInputValue = parseFloat(tamanhoBoxInput.text);

    // Calcular o tamanhoBoxAntesDistorcao
    var tamanhoBoxAntesDistorcao = (tamanhoBoxInputValue / 0.35277777777782) * porcentagemRedimensionamento;

    // Calcular a escala necessária
    var escala = tamanhoBoxAntesDistorcao / selectedObject.height;

    // Aplicar a escala mantendo o ponto de referência no centro
    selectedObject.resize(100, escala * 100, true, true, true, true);
}

boxValfilm();

// Nome do arquivo de texto que você deseja criar
var nomeArquivoTxt = nomeScript + "_" + cliente + "_" + serviceOrderNumber + "_" + produtoComUnderline + "_" + resultadoOperador;

// Função para obter o caminho da pasta
function getFolderPathUtilizacao() {
    var pastaDestino = "";

    // Check the operating system
    if ($.os.indexOf("Windows") !== -1) {
        // Windows folder path
        pastaDestino = "\\\\192.168.1.15\\uteis\\_Padroes_clientes_Alpha\\_Scripts\\Utilizacao\\Companion\\";
    } else {
        // Mac folder path
        pastaDestino = "/uteis/_Padroes_clientes_Alpha/_Scripts/Utilizacao/Companion/";
    }

    return pastaDestino;
}

// Obtém o caminho da pasta
var pastaDestino = getFolderPathUtilizacao();

var conteudo = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>' +
    '<Illustrator Origem ="' + nomeScript + '">' +
    '<Log Cliente ="' + cliente + '"' +
    ' Script ="' + nomeScript + '"' +
    ' Order ="' + serviceOrderNumber + '"' +
    ' CP ="' + produtoComUnderline + '"' +
    ' Operador ="' + resultadoOperadorNome + '"/>' +
    '</Illustrator>'



// Cria o objeto File para o arquivo de texto
var arquivoTxt = new File(pastaDestino + "/" + nomeArquivoTxt + ".xml");

// Cria o arquivo e escreve o conteúdo
arquivoTxt.open("w");
arquivoTxt.write(conteudo);
arquivoTxt.close();



//============================CSV====================================//

// Função para obter a data atual em formato "YYYY-MM-DD HH:MM:SS"
function getCurrentDateTime() {
    var now = new Date();
    return now.getFullYear() + "-" +
           ("0" + (now.getMonth() + 1)).slice(-2) + "-" +
           ("0" + now.getDate()).slice(-2) + " " +
           ("0" + now.getHours()).slice(-2) + ":" +
           ("0" + now.getMinutes()).slice(-2) + ":" +
           ("0" + now.getSeconds()).slice(-2);
}

// Dados para o CSV
var linhaCSV = resultadoOperadorNome + "," +
               nomeScript + "," +
               serviceOrderNumber + "," +
               cliente + "," +
               banda + "," +
               "1," +
               getCurrentDateTime() + "\n";

// Caminho do arquivo CSV
var arquivoCSV = new File(pastaDestino + "/data_records.csv");

// Abre o arquivo CSV para append (adicionar linha ao final)
arquivoCSV.open("a");
arquivoCSV.write(linhaCSV);
arquivoCSV.close();



#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;


// Salvar o objeto selecionado em uma variável
var selectedObject = app.activeDocument.selection[0];

// Função para redimensionar objetos selecionados verticalmente
function redimensionarVerticalmente() {
    // Obter os tamanhos do cilindro e do fechamento das entradas do diálogo
    var tamanhoCilindro = cylinderSizeMM;
    var tamanhoFechamento = closureInput;

    // Calcular a porcentagem de redimensionamento
    var porcentagemRedimensionamento = (tamanhoFechamento / tamanhoCilindro) * 100;

    // Obter a seleção atual
    var selecao = app.activeDocument.selection;

    // Verificar se a seleção não está vazia
    if (selecao.length === 0) {
        alert("Nenhum objeto selecionado.");
        return;
    }

    // Criar um grupo temporário para os itens selecionados
    var grupoTemporario = app.activeDocument.groupItems.add();
    grupoTemporario.name = "Grupo Temporário";

    // Armazenar os itens originais e suas camadas originais
    var itensOriginais = [];
    var camadasOriginais = [];
    for (var i = 0; i < selecao.length; i++) {
        var item = selecao[i];
        itensOriginais.push(item);
        camadasOriginais.push(item.layer);
        item.move(grupoTemporario, ElementPlacement.PLACEATEND);
    }

    // Redimensionar verticalmente o grupo temporário (que agora contém todos os objetos)
    var limitesGrupo = grupoTemporario.geometricBounds;
    var alturaOriginal = limitesGrupo[2] - limitesGrupo[0];
    var fatorEscalaVertical = porcentagemRedimensionamento / 100;
    var novaAltura = alturaOriginal * fatorEscalaVertical;
    var fatorEscalaVerticalAbsoluto = novaAltura / alturaOriginal;
    grupoTemporario.resize(100, fatorEscalaVerticalAbsoluto * 100, true, true, true, true);

    // Mover os objetos de volta para suas camadas originais e posições originais
    for (var j = 0; j < itensOriginais.length; j++) {
        var item = itensOriginais[j];
        var camadaOriginal = camadasOriginais[j];
        item.move(camadaOriginal, ElementPlacement.PLACEATEND);
    }

    // Remover o grupo temporário
    grupoTemporario.remove();

    // Alertar o usuário sobre a operação de redimensionamento
    alert("Objetos selecionados distorcidos verticalmente em " + porcentagemRedimensionamento + "%");
}


// Verificando se o produto está no nome do arquivo
var nomeArquivo = app.activeDocument.name;
if (nomeArquivo.indexOf(produtoComUnderline) !== -1) {
    redimensionarVerticalmente();
} else {
    // Caso o produto não esteja no nome do arquivo, exibir um alerta personalizado
    var alertWindow = new Window("dialog", "OS nao bate com o arquivo");
    alertWindow.orientation = "column";

    var aviso = alertWindow.add("statictext", undefined, "OS nao bate com o arquivo");
    aviso.alignment = "center";
    aviso.characters = 17; // Define a largura do texto

    // Define a cor vermelha para o texto
    var myBrush = alertWindow.graphics.newPen(alertWindow.graphics.PenType.SOLID_COLOR, [1, 1, 0], 1);
    aviso.graphics.foregroundColor = myBrush;

    var okButton = alertWindow.add("button", undefined, "OK");
    okButton.alignment = "center";

    okButton.onClick = function() {
        alertWindow.close();
    }
    // Centralizando a janela de alerta no Illustrator
    alertWindow.center();

    alertWindow.show();
}


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

// Function to get platform-specific folder path
function getFolderPathCopyLog() {
    var folderPathCopy = "";

    // Check the operating system
    if ($.os.indexOf("Windows") !== -1) {
        // Windows folder path
        folderPathCopy = "\\\\aeserver16\\Engine\\_Jobfolder\\" + serviceOrderNumber + "\\_log\\";
    } else {
        // Mac folder path
        folderPathCopy = "/Engine/_Jobfolder/" + serviceOrderNumber + "/_log/";
    }

    return folderPathCopy;
}

// Obtém o caminho para a pasta de destino
var folderPathCopy = getFolderPathCopyLog();

var nomeArquivoTxtCopy = serviceOrderNumber + "_I_Illustrator_Distorcao";

// Cria o objeto File para o destino de cópia
var destinoDaCopia = new File(folderPathCopy + "/" + nomeArquivoTxtCopy + ".xml");

// Copia o arquivo para o destino
if (arquivoTxt.copy(destinoDaCopia)) {

} else {
   // alert("VERIFICAR SE ESTA CONECTADO COM O AUTOMATION");
}



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

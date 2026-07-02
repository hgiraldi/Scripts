#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;


// Salvar o objeto selecionado em uma variável
var selectedObject = app.activeDocument.selection[0];

// Veio da "Montagem + Distorcao" (combo do painel)? A montagem grava um sinal
// (Folder.temp/alpha_montou.txt) ao terminar. Se for recente, a distorcao esta rodando
// LOGO APOS a montagem -> seleciona TODA a arte do artboard. Avulso (sem sinal) usa a
// selecao do operador.
try {
    var __mfDist = new File(Folder.temp + "/alpha_montou.txt");
    if (__mfDist.exists) {
        __mfDist.open("r"); var __mtDist = parseInt(__mfDist.read(), 10) || 0; __mfDist.close();
        try { __mfDist.remove(); } catch (eRm) {}           // consome o sinal
        if (((new Date()).getTime() - __mtDist) < 20000) {  // veio logo apos a montagem
            try { app.activeDocument.selection = null; } catch (e1) {}
            app.activeDocument.selectObjectsOnActiveArtboard();
            selectedObject = app.activeDocument.selection[0];
        }
    }
} catch (eDist) {}

// ===== VALIDACAO ANTES DE DISTORCER =====
// A distorcao calcula a escala vertical a partir de cylinderSizeMM e closureInput
// (Cilindro/fechamento do XML). Sem esses dados eles vem NaN e o resize (linha ~48)
// quebra com "Numeric value expected", deixando a arte num grupo temporario. Aqui
// paramos antes, com aviso claro. throw de string -> banner (painel) / aviso (menu antigo).
if (app.activeDocument.selection.length === 0) {
    throw "Distorcao: nenhum objeto selecionado. Selecione a arte antes de distorcer.";
}
if (!isFinite(cylinderSizeMM) || !(cylinderSizeMM > 0) || !isFinite(closureInput) || !(closureInput > 0)) {
    throw "Distorcao: a O.S. nao tem dados do cilindro (cilindro=" + cylinderSizeMM + "mm, fechamento=" + closureInput + "mm). Verifique o Cilindro no XML da O.S.";
}
// =========================================

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
        msgUsuario("Distorcao: nenhum objeto selecionado.", "erro");
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
    msgUsuario("Distorcao aplicada: " + porcentagemRedimensionamento + "% na vertical.", "info");
}


// Verificando se o produto está no nome do arquivo
var nomeArquivo = app.activeDocument.name;
if (nomeArquivo.indexOf(produtoComUnderline) !== -1) {
    redimensionarVerticalmente();
} else {
    // Caso o produto não esteja no nome do arquivo, exibir um alerta personalizado
    msgUsuario("OS nao bate com o arquivo", "erro");
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
// [CSV desativado] var arquivoCSV = new File(pastaDestino + "/data_records.csv");

// Abre o arquivo CSV para append (adicionar linha ao final)
// [CSV desativado] arquivoCSV.open("a");
// [CSV desativado] arquivoCSV.write(linhaCSV);
// [CSV desativado] arquivoCSV.close();

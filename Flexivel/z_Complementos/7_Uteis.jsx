#include "Xml_upload.jsx"

// Obtém o nome completo do arquivo do script em execução
var nomeScript = File($.fileName).name;

function buscarClientes(pasta) {
    var clienteFolder = new Folder(pasta);

    if (!clienteFolder.exists) {
        return [];
    }

    var files = clienteFolder.getFiles("*.ai");
    var arquivosEncontrados = [];

    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        arquivosEncontrados.push(file);
    }

    return arquivosEncontrados;
}

function getFileName(filePath) {
    var file = new File(filePath);
    return file.displayName;
}

var pasta;

// caminho unico p/ Windows e Mac (alphaBaseUteis resolve a rede que responde)
pasta = alphaBaseUteis() + "/_Padroes_clientes_Alpha/" + folder;

var arquivosCliente = buscarClientes(pasta);

if (arquivosCliente.length > 0) {
    // Criando uma janela de diálogo personalizada
    var dialog = new Window("dialog", "Arquivos do Cliente");
    dialog.orientation = "column";

    var fileNames = [];
    var filePaths = [];

    for (var i = 0; i < arquivosCliente.length; i++) {
        var filePath = arquivosCliente[i].fsName;
        if ($.os.indexOf("Windows") !== -1) {
            // Obter o caminho completo
            var fileName = getFileName(filePath);
            fileNames.push(fileName);
            filePaths.push(filePath);
        } else {
            var fileName = filePath.split("/").pop();
            fileNames.push(fileName);
            filePaths.push(filePath);
        }
    }

    // Alerta para exibir os nomes dos arquivos
    //alert("Nomes dos arquivos:\n" + fileNames.join("\n"));

    // Alerta para exibir os caminhos dos arquivos
    //alert("Caminhos dos arquivos:\n" + filePaths.join("\n"));


    var fileList = dialog.add('listbox', [10, 10, 300, 160], fileNames);
    fileList.maximumSize.width = 300;
    fileList.maximumSize.height = 120;

    // Botão "Abrir" para abrir o arquivo selecionado
    // Abrir = {name:"ok"} (fecha NATIVO apos abrir). O fechamento via onClick
    // entrava em loop quando rodado pelo painel CEP. Validacao no laco abaixo.
    var btnAbrir = dialog.add('button', undefined, 'Abrir', { name: 'ok' });








    // Botão "Fechar" = {name:"cancel"} (fecha NATIVO)
    var btnFechar = dialog.add('button', undefined, 'Fechar', { name: 'cancel' });

    do {
        var rU = dialog.show();
        if (rU !== 1) break; // Fechar / Esc
        var selectedIndex = fileList.selection ? fileList.selection.index : -1;
        if (selectedIndex < 0) { alert('Por favor, selecione um arquivo antes de clicar em "Abrir".'); continue; }
        var selectedFilePath = filePaths[selectedIndex];
        if (!selectedFilePath) { alert('O caminho do arquivo selecionado não foi encontrado.'); continue; }
        var selectedFile = new File(selectedFilePath);
        if (!selectedFile.exists) { alert('O arquivo selecionado não existe.'); continue; }
        selectedFile.execute(); // Abrir o arquivo selecionado
        break; // abriu -> sai
    } while (true);
} else {
    alert("Nenhum arquivo encontrado para o cliente especificado.");
}

// Nome do arquivo de texto que você deseja criar
var nomeArquivoTxt = nomeScript + "_" + cliente + "_" + serviceOrderNumber + "_" + produtoComUnderline + "_" + resultadoOperador;

// Função para obter o caminho da pasta
function getFolderPathUtilizacao() {
    var pastaDestino = "";

    // caminho unico p/ Windows e Mac (alphaBaseEngine/alphaBaseUteis resolvem a rede)
    pastaDestino = alphaBaseUteis() + "/_Padroes_clientes_Alpha/_Scripts/Utilizacao/Companion/";

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
// [CSV desativado] var arquivoCSV = new File(pastaDestino + "/data_records.csv");

// Abre o arquivo CSV para append (adicionar linha ao final)
// [CSV desativado] arquivoCSV.open("a");
// [CSV desativado] arquivoCSV.write(linhaCSV);
// [CSV desativado] arquivoCSV.close();

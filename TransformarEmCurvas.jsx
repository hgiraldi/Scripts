// Função para listar todas as fontes na pasta "C:/Windows/Fonts"
function listarFontesWindows() {
  var fontsFolder = Folder('C:/Windows/Fonts'); // Caminho para a pasta de fontes do Windows
  var fontFiles = fontsFolder.getFiles(); // Obter todos os arquivos na pasta

  var fontNames = [];

  for (var i = 0; i < fontFiles.length; i++) {
    var fontFile = fontFiles[i];
    if (fontFile instanceof File && fontFile.displayName.match(/\.(otf|ttf)$/i)) {
      // Verificar se é um arquivo .otf ou .ttf
      var fontName = fontFile.displayName;
      fontNames.push(fontName);
    }
  }

  return fontNames;
}

var fontList = listarFontesWindows();

// Criar uma janela de diálogo para exibir as fontes
var dialog = new Window('dialog', 'Fontes do Windows');
var list = dialog.add('listbox', undefined, fontList);
list.size = [300, 200];

var closeButton = dialog.add('button', undefined, 'Fechar');
closeButton.onClick = function () {
  dialog.close();
};

dialog.show();

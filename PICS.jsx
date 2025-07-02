var doc = app.activeDocument;
var selections = doc.selection;

if (selections.length > 0) {
  var traco = new CMYKColor();
  traco.cyan = 0;
  traco.yellow = 0;
  traco.magenta = 0;
  traco.black = 100;

  for (var i = 0; i < selections.length; i++) {
    var selec = selections[i];
    var larg = selec.width / 2;
    var alt = selec.height / 2;
    var larg2 = selec.width + 11.34;
    var alt2 = selec.height + 11.34;


    var myLine = doc.activeLayer.pathItems.add();
    var myLine2 = doc.activeLayer.pathItems.add();
    var myLine3 = doc.activeLayer.pathItems.add();
    var myLine4 = doc.activeLayer.pathItems.add();

    
    myLine.stroked = true;
    myLine.strokeWidth = 1.4;
    myLine.strokeColor = traco;
    myLine.filled = false;
    myLine.setEntirePath([[0, 15], [0, 0]]);

    myLine2.stroked = true;
    myLine2.strokeWidth = 1.4;
    myLine2.strokeColor = traco;
    myLine2.filled = false;
    myLine2.setEntirePath([[0, 0], [15, 0]]);

    myLine3.stroked = true;
    myLine3.strokeWidth = 1.4;
    myLine3.strokeColor = traco;
    myLine3.filled = false;
    myLine3.setEntirePath([[0, 15], [0, 0]]);

    myLine4.stroked = true;
    myLine4.strokeWidth = 1.4;
    myLine4.strokeColor = traco;
    myLine4.filled = false;
    myLine4.setEntirePath([[0, 0], [15, 0]]);

    myLine.position = [selec.left + larg, selec.top + 24];
    myLine2.position = [selec.left - 24, selec.top - alt];
    myLine3.position = [selec.left + larg, selec.top - alt2];
    myLine4.position = [selec.left + larg2, selec.top - alt];
  }
} else {
  alert("Nenhum objeto selecionado. Selecione um ou mais objetos e execute o script novamente.");
}

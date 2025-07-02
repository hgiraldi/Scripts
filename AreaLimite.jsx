function mmToPt(mm) {
    return mm * 2.83465;
}

function getSpotColorZ(doc) {
    var spotName = "z";
    var spot;

    // Buscar Spot existente
    for (var i = 0; i < doc.spots.length; i++) {
        if (doc.spots[i].name === spotName) {
            spot = doc.spots[i];
            break;
        }
    }

    // Criar se não existir
    if (!spot) {
        spot = doc.spots.add();
        spot.name = spotName;
        spot.colorType = ColorModel.SPOT;

        var cmykColor = new CMYKColor();
        cmykColor.cyan = 0;
        cmykColor.magenta = 0;
        cmykColor.yellow = 0;
        cmykColor.black = 80;
        spot.color = cmykColor;
    }

    // Criar objeto SpotColor para aplicar no stroke
    var spotColor = new SpotColor();
    spotColor.spot = spot;
    spotColor.tint = 100;

    return spotColor;
}


function criarAreaLimite() {
    var doc = app.activeDocument;

    var facaLayer;
    try {
        facaLayer = doc.layers.getByName("faca");
    } catch (e) {
        alert("Layer 'faca' não encontrada.");
        return;
    }

    var areaLimiteLayer;
    try {
        areaLimiteLayer = doc.layers.getByName("areaLimite");
    } catch (e) {
        areaLimiteLayer = doc.layers.add();
        areaLimiteLayer.name = "areaLimite";
    }

    var spotColorZ = getSpotColorZ(doc);
    var reducaoPT = mmToPt(30); // 15 mm de cada lado

    var encontrados = 0;
    var modificados = 0;

    for (var i = 0; i < facaLayer.pathItems.length; i++) {
        var item = facaLayer.pathItems[i];

        if (!item.stroked) continue;

        if (
            item.strokeColor.typename === "SpotColor" &&
            item.strokeColor.spot.name.toLowerCase() === "z"
        ) {
            encontrados++;

            // Extrair os pontos do path
            var pontos = [];
            for (var p = 0; p < item.pathPoints.length; p++) {
                var anchor = item.pathPoints[p].anchor;
                pontos.push([anchor[0], anchor[1]]);
            }

            // Criar novo path com os mesmos pontos
            var novoItem = areaLimiteLayer.pathItems.add();
            novoItem.setEntirePath(pontos);
            novoItem.closed = item.closed;

            // Copiar posição
            novoItem.left = item.left;
            novoItem.top = item.top;

            // Aplicar estilo
            novoItem.filled = false;
            novoItem.stroked = true;
            novoItem.strokeWidth = mmToPt(20);
            novoItem.strokeColor = spotColorZ;
            novoItem.strokeDashes = [mmToPt(20), mmToPt(20)];


            // Redimensionar mantendo o centro
            var larguraOriginal = item.width;
            var alturaOriginal = item.height;

            var novaLargura = larguraOriginal - reducaoPT;
            var novaAltura = alturaOriginal - reducaoPT;

            if (novaLargura <= 0 || novaAltura <= 0) {
                novoItem.remove(); 
                continue;
            }

            var scaleX = (novaLargura / larguraOriginal) * 100;
            var scaleY = (novaAltura / alturaOriginal) * 100;

            novoItem.resize(
                scaleX,
                scaleY,
                true,
                true,
                true,
                true,
                1,
                Transformation.CENTER
            );

            modificados++;
        }
    }

    alert(
        "Total de objetos com SpotColor 'z' encontrados: " + encontrados + "\n" +
        "Área limite criada para: " + modificados + " objeto(s)."
    );
}

criarAreaLimite();
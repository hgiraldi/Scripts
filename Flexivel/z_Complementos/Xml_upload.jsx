// ---- mensagem ao usuario ----
// alert() nativo, igual ao menu antigo (estado estavel: no maximo loopa, NAO
// crasha). Banner/evento/guardar-msg foram revertidos.
function msgUsuario(texto, tipo) {
    alert(texto);
}

// Initialize global variables
var xmlData = {};

// Get platform-specific folder path
var folderPath = getFolderPath();

// 🔒 Força validação de acesso no Illustrator 26 / Sonoma
var folder = new Folder(folderPath);

if (!folder.exists || folder.getFiles().length === 0) {
    alert(
        "Permissão necessária para acessar os arquivos do job.\n" +
        "Selecione a pasta _xml uma vez."
    );

    folder = Folder.selectDialog("Selecione a pasta _xml do job");

    if (!folder) {
        throw new Error("Pasta não autorizada.");
    }

    folderPath = folder.fsName;
}

// Construct the XML file path
var xmlFilePath = getLatestXMLFile(folderPath);

if (xmlFilePath !== "") {
    xmlData = loadXML(xmlFilePath);
    var jsonObject = convertXMLtoJSON(xmlData.contents);
    //runRemainingScripts(jsonObject);
} else {
    alert("OS nao encontrada no Automation.");
}


// Function to get platform-specific folder path
function getFolderPath() {
    var folderPath = "";

    // Check the operating system
    if ($.os.indexOf("Windows") !== -1) {
        folderPath = "\\\\aeserver16\\Engine\\_Jobfolder\\" + serviceOrderNumber + "\\_xml\\";
    } else {
        folderPath = "/Engine/_JobFolder/" + serviceOrderNumber + "/_xml/";
    }

    return folderPath;
}



function getLatestXMLFile(folderPath) {
    var folder = new Folder(folderPath);
    var files = folder.getFiles("*.xml");

    if (files.length === 0) {
        return ""; // No XML files found
    }

    // Revertendo a ordem da matriz de arquivos
    files.reverse();

    return files[0]; // Seleciona o último arquivo após a inversão da ordem
}



// Function to load XML data from file
function loadXML(xmlFile) {
    var xmlData = {};

    // Read XML contents
    xmlFile.encoding = "UTF-8";
    xmlFile.open("r");
    xmlData.contents = xmlFile.read();
    xmlFile.close();

    return xmlData;
}

// Function to convert XML to JSON
function convertXMLtoJSON(xmlString) {
    var xmlDoc = new XML(xmlString);
    var jsonObject = {};

    // Recursive function to convert XML node to JSON object
    function parseNode(node) {
        var obj = {};

        for (var i = 0; i < node.elements().length(); i++) {
            var childNode = node.elements()[i];
            var nodeName = childNode.name().toString();

            if (!obj.hasOwnProperty(nodeName)) {
                obj[nodeName] = [];
            }

            obj[nodeName].push(parseNode(childNode));
        }

        if (node.attributes().length() > 0) {
            obj["@attributes"] = {};

            for (var j = 0; j < node.attributes().length(); j++) {
                var attribute = node.attributes()[j];
                var attributeName = attribute.name().toString();
                var attributeValue = attribute.toString();

                obj["@attributes"][attributeName] = attributeValue;
            }
        }

        if (isEmpty(obj)) {
            obj = node.toString();
        }

        return obj;
    }

    // Function to check if an object is empty
    function isEmpty(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                return false;
            }
        }
        return true;
    }

    // Start parsing from the root node
    jsonObject = parseNode(xmlDoc);

    return jsonObject;
}

// Function to run remaining scripts
function runRemainingScripts(jsonData) {
    // Display the JSON content
    alert("JSON Content:\n" + jsonStringify(jsonObject.Inks[0]));
    alert("JSON Content:\n" + (jsonObject.Inks[0].Ink[0].@attributes.Name));

    // Add more scripts that use the JSON data
}

// Custom JSON.stringify function for formatting
function jsonStringify(jsonData) {
    var jsonString = "";
    var indent = 0;

    function getIndentString() {
        return Array(indent + 1).join("  ");
    }

    function processValue(value) {
        if (typeof value === "string") {
            return '"' + value + '"';
        } else {
            return value;
        }
    }

    function processObject(obj) {
        var output = "{\n";

        indent++;

        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                output += getIndentString() + '"' + key + '": ';

                if (typeof obj[key] === "object") {
                    output += processValue(processObject(obj[key])) + ",\n";
                } else {
                    output += processValue(obj[key]) + ",\n";
                }
            }
        }

        output = output.slice(0, -2); // Remove trailing comma and newline
        indent--;
        output += "\n" + getIndentString() + "}";

        return output;
    }

    jsonString = processObject(jsonData);

    return jsonString;
}

function removerAcentos(texto) {
    var acentos = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c',
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
        'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
        'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
        'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
        'Ç': 'C'
    };

    var textoSemAcentos = '';
    var tamanho = texto.length;

    for (var i = 0; i < tamanho; i++) {
        var caractere = texto.charAt(i); // Obtém o caractere atual
        textoSemAcentos += acentos[caractere] || caractere;
    }

    return textoSemAcentos;
}

//VARIAVEIS GLOBAIS===========================================================================//

var cliente = jsonObject.Customer[0].@attributes.Name.replace(/,/g, ' ');
var medicao = jsonObject.Job[0].Automation[0].@attributes.Medicao;
var status = jsonObject.Job[0].Work[0].@attributes.Status;
var scriptAlpha = jsonObject.Job[0].Automation[0].@attributes.Scripalpha;
var depto = jsonObject.Job[0].Automation[0].@attributes.Depto || 0;
var banda = jsonObject.Job[0].Automation[0].@attributes.Banda || 0;
var cpc = jsonObject.Order[0].@attributes.CustomerP;
var mode = jsonObject.CtP[0].@attributes.Mode;
var cac = jsonObject.Order[0].@attributes.CAC;
var np = jsonObject.Order[0].@attributes.NP;
var categoria = jsonObject.Order[0].@attributes.Category;
var supplied = jsonObject.Job[0].Supplied[0].@attributes.Material;
var requested = jsonObject.Job[0].Requested[0].@attributes.Material;
var type = jsonObject.Job[0].Cameron[0].@attributes.Type;
var espessura = jsonObject.CtP[0].@attributes.Tickness;
var folder = jsonObject.Customer[0].@attributes.Folder;
var produtoComUnderline = jsonObject.Order[0].@attributes.Product;
var produto = produtoComUnderline.replace(/_/g, " ");
var nomeArte = jsonObject.Order[0].@attributes.Name;
var operadorNome = removerAcentos(jsonObject.Job[0].History[0].Appointment[1].@attributes.name);
if (operadorNome) {
    resultadoOperadorNome = operadorNome;
} else {
    resultadoOperadorNome = "Sem Entrada";
}
var operador = jsonObject.Job[0].History[0].Appointment[1].@attributes.login
if (operador) {
    resultadoOperador = operador;
} else {
    resultadoOperador = "Sem Entrada";
}

//Ondulado
var cp = produtoComUnderline.split("_")[0];
var rev = produtoComUnderline.split("_")[1];
var v = produtoComUnderline.split("_")[2];
var clienteOnd = nomeArte.split("-")[0];
var ref = nomeArte.split("-")[1];
var medInt = nomeArte.split("-")[2];
//Original
var tipoOriginal = "proprio";

if (supplied && supplied.toLowerCase().indexOf("via e-mail") !== -1) {
    tipoOriginal = "email";
} else if (supplied && supplied.toLowerCase().indexOf("amostra") !== -1) {
    tipoOriginal = "amostra";
}

var tipoCliche = "";
var temRepremont = false;

// verifica RS ou RC
if (
    requested &&
    (requested.indexOf("RS") !== -1 || requested.indexOf("RC") !== -1)
) {
    temRepremont = true;
}

// define tipo base
if (eAproveitamento === true) {
    tipoCliche = "parcial";
} else {
    tipoCliche = "total";
}

// ajusta para repremont
if (temRepremont) {
    if (tipoCliche === "parcial") {
        tipoCliche = "parcial,repremont";
    } else {
        tipoCliche = "repremont";
    }
}

//FIM ONDULADO



var ncores = jsonObject.Inks[0].Ink.length;
var pos = jsonObject.Job[0].Cameron[0].@attributes.Pos;
var lpi = jsonObject.Inks[0].Ink[0].@attributes.LPI;
var lpc = Math.round(lpi / 2.54);
var dataEntrega = (function () {
    var d = jsonObject.Order[0].@attributes.DueDate.split("T")[0].split("-");
    return d[2] + " " + d[1] + " " + d[0].substring(2, 4);
})();

var uScreen = [];
var cores = [];
var coresD = [];
var coresSemVernizBranco = [];
var dotShape = [];
var referenciaCor = [];

for (i = 0; i < ncores; i++) {
    cores.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    coresSemVernizBranco.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    coresD.push(jsonObject.Inks[0].Ink[i].@attributes.Name);
    uScreen.push(jsonObject.Inks[0].Ink[i].@attributes.uScreen);
    dotShape.push(jsonObject.Inks[0].Ink[i].@attributes.DotShape);
    referenciaCor.push(jsonObject.Inks[0].Ink[i].@attributes.Ref);
}


// Mapeamento de substituições
var substituicoes = {
    "HD11": "TR01",
    "CRS08": "TR02",
    "CRS04": "TR03",
    "CRS16": "DT01",
    "CRS19": "DT02",
    "CRS22": "DT03",
    "CRS12": "DT04",
    "CRS11": "DT05",
    "CRS13": "DT06",
    "CRS14": "DT07",
    "CRS10": "DT08",
};

// Loop para percorrer o array
for (var i = 0; i < dotShape.length; i++) {
    // Verifica se a cor atual precisa de substituição
    if (substituicoes[dotShape[i]]) {
        // Faz a substituição usando replace
        dotShape[i] = substituicoes[dotShape[i]];
    }
}

// Removendo cores indesejadas
for (i = cores.length - 1; i >= 0; i--) {

    if (cores[i] === "X" || cores[i] === "W" || cores[i] === "Z" || cores[i] === "All" || cores[i].indexOf("##") !== -1) {
        cores.splice(i, 1);
        dotShape.splice(i, 1);
        referenciaCor.splice(i, 1);
        coresD.splice(i, 1);
        uScreen.splice(i, 1);
        coresSemVernizBranco.splice(i, 1);

    } else if (coresSemVernizBranco[i] === "Branco" ||
        coresSemVernizBranco[i] === "Branco Localizado" ||
        coresSemVernizBranco[i] === "Branco Total" ||
        coresSemVernizBranco[i] === "Verniz Localizado" ||
        coresSemVernizBranco[i] === "Verniz" ||
        coresSemVernizBranco[i] === "Branco~ca" ||
        coresSemVernizBranco[i] === "Branco2" ||
        coresSemVernizBranco[i] === "Branco 2" ||
        coresSemVernizBranco[i] === "Verniz 2" ||
        coresSemVernizBranco[i] === "Verniz2") {

        coresSemVernizBranco.splice(i, 1);

    } else {

    }
}

for (i = cores.length - 1; i >= 0; i--) {

    // if (dotShape[i] != "C" && dotShape[i] != "R")
    coresD[i] = cores[i] + " " + dotShape[i];
    uScreen[i] = cores[i] + " " + uScreen[i];

}


var coresComNumeros = [];

for (var i = 0; i < cores.length; i++) {
    var numero = i + 1;
    var corComNumero = numero + " " + cores[i];
    coresComNumeros.push(corComNumero);
}

var coresComPant = [];

for (var i = 0; i < cores.length; i++) {
    
    if (/\d{2,}/.test(cores[i])) {
        
        coresComPant.push("PANT" + cores[i]);
    } else {
        
        coresComPant.push(cores[i]);
    }
}

var closureInput = parseFloat(jsonObject.Job[0].Cylinder[0].@attributes.Reduced);
var cylinderSizeMM = parseFloat(jsonObject.Job[0].Cylinder[0].@attributes.Size);
var objectHeight = parseFloat(jsonObject.Job[0].Package[0].@attributes.Length) || 0;
var objectWidthMM = parseFloat(jsonObject.Job[0].Package[0].@attributes.Width) || 0;
var smudgePrintingHeight = parseFloat(jsonObject.Job[0].SmudgePrinting[0].@attributes.Length) || 0;
var smudgePrintingWidht = parseFloat(jsonObject.Job[0].SmudgePrinting[0].@attributes.Width) || 0;
var repetitions = parseFloat(jsonObject.Job[0].Repeat[0].@attributes.Length) || 0;
var lanes = parseFloat(jsonObject.Job[0].Repeat[0].@attributes.Width) || 0;
var sizeCameron = parseFloat(jsonObject.Job[0].Cameron[0].@attributes.Width) || 0;
var distanceCameron = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Cameron) || 0;
var distanceBetweenLanesMM = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Width) || 0;
var displacementBetweenLanes = parseFloat(jsonObject.Job[0].Gap[0].@attributes.Length) || 0;
var montagem = repetitions * lanes;

// Convert millimeter values to points
objectWidth = objectWidthMM / 0.35277777777782;
objectHeight = objectHeight / 0.35277777777782;
cylinderSize = cylinderSizeMM / 0.35277777777782;
distanceBetweenLanes = distanceBetweenLanesMM / 0.35277777777782;
displacementBetweenLanes = displacementBetweenLanes / 0.35277777777782;
sizeCameron = sizeCameron / 0.35277777777782;
distanceCameron = distanceCameron / 0.35277777777782;
smudgePrintingHeight = smudgePrintingHeight / 0.35277777777782;
smudgePrintingWidht = smudgePrintingWidht / 0.35277777777782;


// Distância entre os retângulos
var distanceBetweenRectangles = ((objectWidth * lanes) + sizeCameron + (2 * distanceCameron) + ((distanceBetweenLanes * lanes) - distanceBetweenLanes));

//Calcular a distancia entre pistas para checar
var distanciaEntrePistas = (objectWidthMM + distanceBetweenLanesMM).toFixed(3);
//alert(distanciaEntrePistas);

// Calculate the total width and height of the assembly in points
var totalWidth = (objectWidth + distanceBetweenLanes) * lanes;
var totalHeight = (objectHeight + distanceBetweenLanes) * repetitions;

// Calculate the gap between repetitions
var gapBetweenRepetitions = (cylinderSize - (objectHeight * repetitions)) / repetitions;

// Array para armazenar os valores de Click
var clickArray = [];

// Obtendo o objeto "Click" do primeiro elemento de "Inks"
var clickObj = jsonObject.Inks[0].Click[0]["@attributes"];

// Percorrendo todas as chaves do objeto "Click"
for (var prop in clickObj) {
    // Verificando se o valor é diferente de 0 e não está vazio
    if (clickObj[prop] !== "0" && clickObj[prop] !== "") {
        // Adicionando o valor ao array após converter para inteiro
        clickArray.push(parseInt(clickObj[prop]));
    }
}

var eAproveitamento = false;
if (clickArray.length != cores.length) {
    eAproveitamento = true;
} else {

}
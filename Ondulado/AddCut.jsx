//@target illustrator
app.preferences.setBooleanPreference("ShowExternalJSXWarning", false);

// ================= MAIN =================
function main() {

    if (!documents.length) return;
    if (!selection.length || selection.typename === "TextRange") return;

    var doc = app.activeDocument;
    var units = getUnits();
    var sel = app.selection;

    // ================= CUT LAYER =================
    var cutLayer;

    try {
        cutLayer = doc.layers.getByName("cut");
    } catch (e) {
        cutLayer = doc.layers.add();
        cutLayer.name = "cut";
    }

    // ================= CUT SPOT =================
    var cutSpot;

    try {
        cutSpot = doc.spots.getByName("cut");
    } catch (e) {

        cutSpot = doc.spots.add();
        cutSpot.name = "cut";
        cutSpot.colorType = ColorModel.SPOT;

        var cutCMYK = new CMYKColor();
        cutCMYK.cyan = 0;
        cutCMYK.magenta = 100;
        cutCMYK.yellow = 0;
        cutCMYK.black = 0;

        cutSpot.color = cutCMYK;
    }

    var cutColor = new SpotColor();
    cutColor.spot = doc.spots.getByName("cut");
    cutColor.tint = 100;


    // ================= MODERN UI =================
    var margins = showMarginDialog(units);

    if (!margins) return;

    // ================= PROCESS =================
    for (var i = 0; i < sel.length; i++) {

        var obj = sel[i];

        var vBnds = getVisibleBounds(obj);

        if (!vBnds) continue;

        var leftMargin = margins[0];
        var topMargin = margins[1];
        var rightMargin = margins[2];
        var bottomMargin = margins[3];

        var objWidth = vBnds[2] - vBnds[0];
        var objHeight = vBnds[1] - vBnds[3];

        var rectWidth = objWidth + leftMargin + rightMargin;
        var rectHeight = objHeight + topMargin + bottomMargin;

        // Posiciona respeitando exatamente as margens informadas
        var top = vBnds[1] + topMargin;
        var left = vBnds[0] - leftMargin;
        // ================= RECTANGLE =================
        var rect = cutLayer.pathItems.rectangle(
            top,
            left,
            rectWidth,
            rectHeight
        );

        rect.filled = false;
        rect.stroked = true;
        rect.strokeWidth = 1;
        rect.strokeColor = cutColor;
    }
}

// ================= MODERN DIALOG =================
function showMarginDialog(units) {

    var win = new Window("dialog", "Create Cut Margins");

    win.orientation = "column";
    win.alignChildren = "fill";
    win.spacing = 15;
    win.margins = 20;

    // ================= TITLE =================
    var title = win.add("statictext", undefined, "Margins Configuration");
    title.graphics.font = ScriptUI.newFont("Arial", "BOLD", 14);

    // ================= PANEL =================
    var panel = win.add("panel", undefined, "Margins (" + units + ")");

    panel.orientation = "column";
    panel.alignChildren = "fill";
    panel.spacing = 10;
    panel.margins = 15;

    // ================= TOP =================
    var grpTop = panel.add("group");
    grpTop.add("statictext", undefined, "Cima:");

    var inputTop = grpTop.add("edittext", undefined, "0");
    inputTop.characters = 10;

    // ================= LEFT =================
    var grpLeft = panel.add("group");
    grpLeft.add("statictext", undefined, "Esquerda:");

    var inputLeft = grpLeft.add("edittext", undefined, "0");
    inputLeft.characters = 10;

    // ================= RIGHT =================
    var grpRight = panel.add("group");
    grpRight.add("statictext", undefined, "Direita:");

    var inputRight = grpRight.add("edittext", undefined, "0");
    inputRight.characters = 10;

    // ================= BOTTOM =================
    var grpBottom = panel.add("group");
    grpBottom.add("statictext", undefined, "Baixo:");

    var inputBottom = grpBottom.add("edittext", undefined, "0");
    inputBottom.characters = 10;

    // ================= BUTTONS =================
    var btns = win.add("group");
    btns.alignment = "right";

    var cancelBtn = btns.add("button", undefined, "Cancel");
    var okBtn = btns.add("button", undefined, "Create", {
        name: "ok"
    });

    // ================= EVENTS =================
    cancelBtn.onClick = function() {
        win.close();
    };

    okBtn.onClick = function() {
        win.close(1);
    };

    var result = win.show();

    if (result != 1) {
        return null;
    }

    var margins = [
        parseFloat(inputLeft.text) || 0,
        parseFloat(inputTop.text) || 0,
        parseFloat(inputRight.text) || 0,
        parseFloat(inputBottom.text) || 0
    ];

    for (var i = 0; i < margins.length; i++) {
        margins[i] = convertUnits(margins[i], units, "px");
    }

    return margins;
}

// ================= GET UNITS =================
function getUnits() {

    if (!documents.length) return "";

    var key = activeDocument.rulerUnits.toString().replace("RulerUnits.", "");

    switch (key) {

        case "Pixels":
            return "px";
        case "Points":
            return "pt";
        case "Picas":
            return "pc";
        case "Inches":
            return "in";
        case "Millimeters":
            return "mm";
        case "Centimeters":
            return "cm";

        case "Meters":
            return "m";
        case "Feet":
            return "ft";
        case "FeetInches":
            return "ft";
        case "Yards":
            return "yd";

        case "Unknown":

            var xmp = activeDocument.XMPString;

            if (/stDim:unit/i.test(xmp)) {

                var units = /<stDim:unit>(.*?)<\/stDim:unit>/g.exec(xmp)[1];

                if (units == "Meters") return "m";
                if (units == "Feet") return "ft";
                if (units == "FeetInches") return "ft";
                if (units == "Yards") return "yd";

                return "px";
            }

            break;

        default:
            return "px";
    }
}

// ================= GET VISIBLE BOUNDS =================
function getVisibleBounds(object) {

    var bounds, clippedItem, sandboxItem, sandboxLayer;
    var curItem;

    if (object.guides) {
        return undefined;
    }

    if (object.typename == "GroupItem") {

        if (!object.pageItems || object.pageItems.length == 0) {
            return undefined;
        }

        if (object.clipped) {

            for (var i = 0; i < object.pageItems.length; i++) {

                curItem = object.pageItems[i];

                if (curItem.clipping) {

                    clippedItem = curItem;
                    break;

                } else if (curItem.typename == "CompoundPathItem") {

                    if (!curItem.pathItems.length) {

                        sandboxLayer = app.activeDocument.layers.add();
                        sandboxItem = curItem.duplicate(sandboxLayer);

                        app.activeDocument.selection = null;

                        sandboxItem.selected = true;

                        app.executeMenuCommand("noCompoundPath");

                        sandboxLayer.hasSelectedArtwork = true;

                        app.executeMenuCommand("group");

                        clippedItem = app.activeDocument.selection[0];

                        break;

                    } else if (curItem.pathItems[0].clipping) {

                        clippedItem = curItem;
                        break;
                    }
                }
            }

            if (!clippedItem) {
                clippedItem = object.pageItems[0];
            }

            bounds = clippedItem.geometricBounds;

            if (sandboxLayer) {
                sandboxLayer.remove();
                sandboxLayer = undefined;
            }

        } else {

            var subObjectBounds;
            var allBoundPoints = [
                [],
                [],
                [],
                []
            ];

            for (var k = 0; k < object.pageItems.length; k++) {

                curItem = object.pageItems[k];

                subObjectBounds = getVisibleBounds(curItem);

                allBoundPoints[0].push(subObjectBounds[0]);
                allBoundPoints[1].push(subObjectBounds[1]);
                allBoundPoints[2].push(subObjectBounds[2]);
                allBoundPoints[3].push(subObjectBounds[3]);
            }

            bounds = [
                Math.min.apply(Math, allBoundPoints[0]),
                Math.max.apply(Math, allBoundPoints[1]),
                Math.max.apply(Math, allBoundPoints[2]),
                Math.min.apply(Math, allBoundPoints[3])
            ];
        }

    } else {

        bounds = object.geometricBounds;
    }

    return bounds;
}

// ================= CONVERT UNITS =================
function convertUnits(value, currUnits, newUnits) {
    return UnitValue(value, currUnits).as(newUnits);
}

// ================= RUN =================
try {
    main();
} catch (e) {
    alert(e);
}
/*
  Creates rectangles with specified margins around each selected objects
  Version for create squares: https://gist.github.com/creold/b6f2dc2c61d0a497a9264ba114df055a
  Author: Sergey Osokin, email: hi@sergosokin.ru
  Based on code by Joshb Duncan @joshbduncan
  Check my other scripts: https://github.com/creold
  Donate (optional):
  If you find this script helpful, you can buy me a coffee
  - via Buymeacoffee: https://www.buymeacoffee.com/aiscripts
  - via Donatty https://donatty.com/sergosokin
  - via DonatePay https://new.donatepay.ru/en/@osokin
  - via YooMoney https://yoomoney.ru/to/410011149615582
*/

//@target illustrator
app.preferences.setBooleanPreference("ShowExternalJSXWarning", false); // Fix drag and drop a .jsx file

// Main function
function main() {
  if (!documents.length) return;
  if (!selection.length || selection.typename === "TextRange") return;
  
  var units = getUnits();
  var sel = app.selection;

  var marginsStr = prompt("Enter margins for objects separated by comma (left, top, right, bottom), " + units, "0,0,0,0");
  if (!marginsStr.length || marginsStr == null) return;
  var margins = marginsStr.split(",");
  var len = Math.max(margins.length, 4);
  for (var j = 0; j < len; j++) {
    margins[j] = parseFloat(margins[j]);
    if (isNaN(margins[j])) margins[j] = 0;
    margins[j] = convertUnits(margins[j], units, "px");
  }

  var obj, vBnds;
  len = sel.length;
  for (var i = 0; i < len; i++) {
    obj = sel[i];
    vBnds = getVisibleBounds(obj);
    if (!vBnds) continue;

    var objWidth = vBnds[2] - vBnds[0];
    var objHeight = vBnds[1] - vBnds[3];

    var rectWidth = objWidth + margins[0] + margins[2];
    var rectHeight = objHeight + margins[1] + margins[3];

    var top = vBnds[1] + (rectHeight - objHeight) / 2;
    var left = vBnds[0] - (rectWidth - objWidth) / 2;

    var rect = obj.layer.pathItems.rectangle(top, left, rectWidth, rectHeight);
    rect.filled = false;
    rect.stroked = true;
    rect.strokeWidth = 1;
    rect.move(sel[i], ElementPlacement.PLACEAFTER);
  }
}

// Get active document ruler units
function getUnits() {
  if (!documents.length) return "";
  var key = activeDocument.rulerUnits.toString().replace("RulerUnits.", "");
  switch (key) {
    case "Pixels": return "px";
    case "Points": return "pt";
    case "Picas": return "pc";
    case "Inches": return "in";
    case "Millimeters": return "mm";
    case "Centimeters": return "cm";
    // Added in CC 2023 v27.1.1
    case "Meters": return "m";
    case "Feet": return "ft";
    case "FeetInches": return "ft";
    case "Yards": return "yd";
    // Parse new units in CC 2020-2023 if a document is saved
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
    default: return "px";
  }
}

// Get the actual "visible" bounds
// https://github.com/joshbduncan/illustrator-scripts/blob/main/jsx/DrawVisibleBounds.jsx
function getVisibleBounds(object) {
  var bounds, clippedItem, sandboxItem, sandboxLayer;
  var curItem;

  // skip guides (via william dowling @ github.com/wdjsdev)
  if (object.guides) {
    return undefined;
  }

  if (object.typename == "GroupItem") {
    // if the group has no pageItems, return undefined
    if (!object.pageItems || object.pageItems.length == 0) {
      return undefined;
    }
    // if the object is clipped
    if (object.clipped) {
      // check all sub objects to find the clipping path
      for (var i = 0; i < object.pageItems.length; i++) {
        curItem = object.pageItems[i];
        if (curItem.clipping) {
          clippedItem = curItem;
          break;
        } else if (curItem.typename == "CompoundPathItem") {
          if (!curItem.pathItems.length) {
            // catch compound path items with no pathItems (via William Dowling @ github.com/wdjsdev)
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
        // eliminate the sandbox layer since it's no longer needed
        sandboxLayer.remove();
        sandboxLayer = undefined;
      }
    } else {
      // if the object is not clipped
      var subObjectBounds;
      var allBoundPoints = [[], [], [], []];
      // get the bounds of every object in the group
      for (var i = 0; i < object.pageItems.length; i++) {
        curItem = object.pageItems[i];
        subObjectBounds = getVisibleBounds(curItem);
        allBoundPoints[0].push(subObjectBounds[0]);
        allBoundPoints[1].push(subObjectBounds[1]);
        allBoundPoints[2].push(subObjectBounds[2]);
        allBoundPoints[3].push(subObjectBounds[3]);
      }
      // determine the groups bounds from it sub object bound points
      bounds = [
        Math.min.apply(Math, allBoundPoints[0]),
        Math.max.apply(Math, allBoundPoints[1]),
        Math.max.apply(Math, allBoundPoints[2]),
        Math.min.apply(Math, allBoundPoints[3]),
      ];
    }
  } else {
    bounds = object.geometricBounds;
  }
  return bounds;
}

// Convert a value from one set of units to another
function convertUnits(value, currUnits, newUnits) {
  var convertedValue = UnitValue(value, currUnits).as(newUnits);
  return convertedValue;
}

// Run script
try {
  main();
} catch (e) {}
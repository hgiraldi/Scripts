var micropontoGroup = app.activeDocument.groupItems.add();
//Microponto 114
function micropontoPadrao114() {

    var diametroMicropontoBrancoMaior = 0.6 / 0.35277777777782;
    var diametroMicropontoBlack = 0.42 / 0.35277777777782;
    var diametroMicropontoBrancoMenor = 0.18 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBrancoMaior = createWhiteCircle((diametroContornoZ - diametroMicropontoBrancoMaior) / 2, -(diametroContornoZ - diametroMicropontoBrancoMaior) / 2, diametroMicropontoBrancoMaior);
    var micropontoBlack = createBlackCircle((diametroContornoZ - diametroMicropontoBlack) / 2, -(diametroContornoZ - diametroMicropontoBlack) / 2, diametroMicropontoBlack);
    var micropontoBrancoMenor = createWhiteCircle((diametroContornoZ - diametroMicropontoBrancoMenor) / 2, -(diametroContornoZ - diametroMicropontoBrancoMenor) / 2, diametroMicropontoBrancoMenor);

   
    micropontoBrancoMenor.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlack.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBrancoMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto 280
function micropontoPadrao280() {

    var diametroMicropontoBrancoMaior = 1 / 0.35277777777782;
    var diametroMicropontoBlack = 0.7  / 0.35277777777782;
    var diametroMicropontoBrancoMenor = 0.3 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBrancoMaior = createWhiteCircle((diametroContornoZ - diametroMicropontoBrancoMaior) / 2, -(diametroContornoZ - diametroMicropontoBrancoMaior) / 2, diametroMicropontoBrancoMaior);
    var micropontoBlack = createBlackCircle((diametroContornoZ - diametroMicropontoBlack) / 2, -(diametroContornoZ - diametroMicropontoBlack) / 2, diametroMicropontoBlack);
    var micropontoBrancoMenor = createWhiteCircle((diametroContornoZ - diametroMicropontoBrancoMenor) / 2, -(diametroContornoZ - diametroMicropontoBrancoMenor) / 2, diametroMicropontoBrancoMenor);

   
    micropontoBrancoMenor.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlack.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBrancoMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Videplast
function micropontoVideplast() {

    var larguraRetanguloBranco = 0.05 / 0.35277777777782;
    var diametroMicropontoBlack = 0.42 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBlack = createBlackCircle((diametroContornoZ - diametroMicropontoBlack) / 2, -(diametroContornoZ - diametroMicropontoBlack) / 2, diametroMicropontoBlack);
    var retanguloBrancoVertical = createWhiteRectangle((diametroContornoZ - larguraRetanguloBranco) / 2, -((diametroContornoZ - diametroMicropontoBlack) / 2) - diametroMicropontoBlack, larguraRetanguloBranco, diametroMicropontoBlack);
    var retanguloBrancoHorizontal = retanguloBrancoVertical.duplicate();
    retanguloBrancoHorizontal.rotate(90);
   
    retanguloBrancoHorizontal.move(micropontoGroup, ElementPlacement.PLACEATEND);
    retanguloBrancoVertical.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlack.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Fortplast
function micropontoFortplast() {

    var larguraRetanguloBranco = 0.08 / 0.35277777777782;
    var diametroMicropontoBlack = 0.48 / 0.35277777777782;
    var diametroMicropontoBranco = 0.56 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBranco = createWhiteCircle((diametroContornoZ - diametroMicropontoBranco) / 2, -(diametroContornoZ - diametroMicropontoBranco) / 2, diametroMicropontoBranco);
    var micropontoBlack = createBlackCircle((diametroContornoZ - diametroMicropontoBlack) / 2, -(diametroContornoZ - diametroMicropontoBlack) / 2, diametroMicropontoBlack);
    var retanguloBrancoVertical = createWhiteRectangle((diametroContornoZ - larguraRetanguloBranco) / 2, -((diametroContornoZ - diametroMicropontoBlack) / 2) - diametroMicropontoBlack, larguraRetanguloBranco, diametroMicropontoBlack);
    var retanguloBrancoHorizontal = retanguloBrancoVertical.duplicate();
    retanguloBrancoHorizontal.rotate(90);
   
    retanguloBrancoHorizontal.move(micropontoGroup, ElementPlacement.PLACEATEND);
    retanguloBrancoVertical.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlack.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBranco.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Valfilm mg 114
function micropontoValfilmMg114() {

    var diametroMicropontoBranco = 0.26 / 0.35277777777782;
    var diametroMicropontoBlackMaior = 0.4 / 0.35277777777782;
    var diametroMicropontoBlackMenor = 0.13 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBlackMaior = createBlackCircle((diametroContornoZ - diametroMicropontoBlackMaior) / 2, -(diametroContornoZ - diametroMicropontoBlackMaior) / 2, diametroMicropontoBlackMaior);
    var micropontoBranco = createWhiteCircle((diametroContornoZ - diametroMicropontoBranco) / 2, -(diametroContornoZ - diametroMicropontoBranco) / 2, diametroMicropontoBranco);
    var micropontoBlackMenor = createBlackCircle((diametroContornoZ - diametroMicropontoBlackMenor) / 2, -(diametroContornoZ - diametroMicropontoBlackMenor) / 2, diametroMicropontoBlackMenor);

   
    micropontoBlackMenor.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBranco.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlackMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Valfilm mg 280
function micropontoValfilmMg280() {

    var diametroMicropontoBranco = 0.46 / 0.35277777777782;
    var diametroMicropontoBlackMaior = 0.7 / 0.35277777777782;
    var diametroMicropontoBlackMenor = 0.23 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBlackMaior = createBlackCircle((diametroContornoZ - diametroMicropontoBlackMaior) / 2, -(diametroContornoZ - diametroMicropontoBlackMaior) / 2, diametroMicropontoBlackMaior);
    var micropontoBranco = createWhiteCircle((diametroContornoZ - diametroMicropontoBranco) / 2, -(diametroContornoZ - diametroMicropontoBranco) / 2, diametroMicropontoBranco);
    var micropontoBlackMenor = createBlackCircle((diametroContornoZ - diametroMicropontoBlackMenor) / 2, -(diametroContornoZ - diametroMicropontoBlackMenor) / 2, diametroMicropontoBlackMenor);

   
    micropontoBlackMenor.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBranco.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlackMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Tecnoval 114
function micropontoTecnoval114() {

    var diametroMicropontoBrancoMaior = 0.4 / 0.35277777777782;
    var diametroMicropontoBranco = 0.2 / 0.35277777777782;
    var diametroMicropontoBlackMaior = 0.3 / 0.35277777777782;
    var diametroMicropontoBlackMenor = 0.1 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBrancoMaior = createWhiteCircle((diametroContornoZ - diametroMicropontoBrancoMaior) / 2, -(diametroContornoZ - diametroMicropontoBrancoMaior) / 2, diametroMicropontoBrancoMaior);
    var micropontoBlackMaior = createBlackCircle((diametroContornoZ - diametroMicropontoBlackMaior) / 2, -(diametroContornoZ - diametroMicropontoBlackMaior) / 2, diametroMicropontoBlackMaior);
    var micropontoBranco = createWhiteCircle((diametroContornoZ - diametroMicropontoBranco) / 2, -(diametroContornoZ - diametroMicropontoBranco) / 2, diametroMicropontoBranco);
    var micropontoBlackMenor = createBlackCircle((diametroContornoZ - diametroMicropontoBlackMenor) / 2, -(diametroContornoZ - diametroMicropontoBlackMenor) / 2, diametroMicropontoBlackMenor);

   
    micropontoBlackMenor.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBranco.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlackMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBrancoMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Valfilm Passa 4
function micropontoPassa4() {

    var diametroMicropontoBlack = 0.7 / 0.35277777777782;
    var diametroMicropontoBrancoMenor = 0.3 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBlack = createBlackCircle((diametroContornoZ - diametroMicropontoBlack) / 2, -(diametroContornoZ - diametroMicropontoBlack) / 2, diametroMicropontoBlack);
    var micropontoBrancoMenor = createWhiteCircle((diametroContornoZ - diametroMicropontoBrancoMenor) / 2, -(diametroContornoZ - diametroMicropontoBrancoMenor) / 2, diametroMicropontoBrancoMenor);

   
    micropontoBrancoMenor.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlack.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Bomplastic
function micropontoBomplastic() {

    var diametroMicropontoBrancoMaior = 0.7 / 0.35277777777782;
    var diametroMicropontoBlackMaior = 0.5 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;
    var alturaRetangulo = 0.05 / 0.35277777777782;
    var larguraRetanguloBranco = 0.52 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var micropontoBrancoMaior = createWhiteCircle((diametroContornoZ - diametroMicropontoBrancoMaior) / 2, -(diametroContornoZ - diametroMicropontoBrancoMaior) / 2, diametroMicropontoBrancoMaior);
    var micropontoBlackMaior = createBlackCircle((diametroContornoZ - diametroMicropontoBlackMaior) / 2, -(diametroContornoZ - diametroMicropontoBlackMaior) / 2, diametroMicropontoBlackMaior);
    var retanguloBrancoVertical = createWhiteRectangle((diametroContornoZ - alturaRetangulo) / 2, (-(diametroContornoZ - larguraRetanguloBranco) / 2) - larguraRetanguloBranco, alturaRetangulo, larguraRetanguloBranco);
    var retanguloBrancoHorizontal = createWhiteRectangle((diametroContornoZ - larguraRetanguloBranco) / 2, (-(diametroContornoZ - alturaRetangulo) / 2) - alturaRetangulo, larguraRetanguloBranco, alturaRetangulo);
   
    retanguloBrancoVertical.move(micropontoGroup, ElementPlacement.PLACEATEND);
    retanguloBrancoHorizontal.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBlackMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    micropontoBrancoMaior.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}
//Microponto Majicplast 284
function micropontoMajicplast284() {

    var larguraRetangulo = 3 / 0.35277777777782;
    var alturaRetangulo = 0.12 / 0.35277777777782;
    var diametroContornoZ = 6 / 0.35277777777782;

    var contornoZ = createColoredStrokeFromPalette(0, 0, diametroContornoZ, "z");
    var retanguloHorizontal = createBlackRectangle((diametroContornoZ - larguraRetangulo) / 2, (-(diametroContornoZ - alturaRetangulo) / 2) - alturaRetangulo, larguraRetangulo, alturaRetangulo);
    var retanguloVertical = createBlackRectangle((diametroContornoZ - alturaRetangulo) / 2, (-(diametroContornoZ - larguraRetangulo) / 2) - larguraRetangulo, alturaRetangulo, larguraRetangulo);

    retanguloHorizontal.move(micropontoGroup, ElementPlacement.PLACEATEND);
    retanguloVertical.move(micropontoGroup, ElementPlacement.PLACEATEND);
    contornoZ.move(micropontoGroup, ElementPlacement.PLACEATEND);

}  



function chamaMicroponto() {

    if ((folder.indexOf("videplast") >= 0)) {
        micropontoVideplast();

    } else if ((folder.indexOf("fortplast") >= 0)) {
        micropontoFortplast();

    } else if ((folder.indexOf("valfilm_passa_4") >= 0)) {
        micropontoPassa4();

    } else if ((folder.indexOf("bomplastic") >= 0)) {
        micropontoBomplastic();

    } else if ((folder.indexOf("valfilm_mg") >= 0) && (espessura == "1.14" || espessura == "1.70" )) {
        micropontoValfilmMg114();

    } else if ((folder.indexOf("valfilm_mg") >= 0) && (espessura != "1.14" && espessura != "1.70" )) {
        micropontoValfilmMg280();

    } else if ((folder.indexOf("tecnoval_laminados") >= 0) && (espessura == "1.14" || espessura == "1.70" )) {
        micropontoTecnoval114();

    } else if ((folder.indexOf("majicplast_matriz") >= 0) && (espessura >= "2.84")) {
        micropontoMajicplast284();

    } else if (espessura == "1.14" || espessura == "1.70" ){
        micropontoPadrao114();

    } else {
        micropontoPadrao280();

    }

}



// Teste headless do extrator (roda no Node, sem app). Uso:
//   node test_extrator.js <caminho.pdf> [gapMM]
var fs = require("fs");
var grupos = require("./src/pdf_grupos.js");

var arq = process.argv[2];
var gap = process.argv[3] ? parseFloat(process.argv[3]) : 4;
if (!arq) { console.error("uso: node test_extrator.js <arquivo.pdf> [gapMM]"); process.exit(1); }

var bytes = new Uint8Array(fs.readFileSync(arq));
grupos.analisarPdf(bytes, { gapMM: gap }, function (m) { console.log("  ." + m); })
  .then(function (r) {
    console.log("\n== RESULTADO ==");
    console.log("pagina:", r.pageSizeMm ? (r.pageSizeMm.w.toFixed(1) + "x" + r.pageSizeMm.h.toFixed(1) + " mm") : "?");
    console.log("imagem?", r.temImagem, "| cores:", r.nCores, "| grupos:", r.nGruposTotal, "| total:", r.totalCm2.toFixed(2), "cm2");
    console.log("sugestoes spot:", JSON.stringify(r.sugestoesSpot));
    for (var i = 0; i < r.cores.length; i++) {
      var c = r.cores[i];
      console.log("\n[" + c.nome + "] rgb(" + c.r + "," + c.g + "," + c.b + ") - " +
        c.nGrupos + " grupos - " + c.areaCm2.toFixed(2) + " cm2");
      for (var g = 0; g < Math.min(c.grupos.length, 8); g++) {
        var gr = c.grupos[g];
        console.log("   grupo " + (g + 1) + ": " + gr.wCM.toFixed(1) + " x " + gr.hCM.toFixed(1) +
          " cm = " + gr.areaCm2.toFixed(2) + " cm2");
      }
      if (c.grupos.length > 8) console.log("   ...(+" + (c.grupos.length - 8) + " grupos)");
    }
  })
  .catch(function (e) { console.error("ERRO:", e && e.stack ? e.stack : e); process.exit(1); });

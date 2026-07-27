// Alpha Ondulado - HTML do LAUDO de orcamento (identidade Alpha, cores destrinchadas).
(function () {
  "use strict";
  var custo = require("./custo");
  var fs = require("fs");
  var path = require("path");

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  var _logo = null;
  function logoDataUrl() {
    if (_logo !== null) return _logo;
    try {
      var b = fs.readFileSync(path.join(__dirname, "assets", "logo_alpha.png"));
      _logo = "data:image/png;base64," + b.toString("base64");
    } catch (e) { _logo = ""; }
    return _logo;
  }

  // d: { cliente, espessura, tipo, fator, arranjo, dataStr, analise:{cores,totalCm2}, calc, previewDataUrl }
  function montarHtml(d) {
    d = d || {};
    var calc = d.calc || {};
    var cores = (d.analise && d.analise.cores) || [];

    // cores destrinchadas = so os NOMES (sem valores de grupo), como "chips"
    var chips = "", i;
    for (i = 0; i < cores.length; i++) {
      var c = cores[i];
      chips += '<span class="chip"><span class="dot" style="background:' + esc(c.rgbCss) + '"></span>' + esc(c.nome) + '</span>';
    }

    var totalCm2 = calc.totalCm2 != null ? calc.totalCm2 : (d.analise && d.analise.totalCm2) || 0;
    var arrTxt = (calc.arranjo && calc.arranjo.txt) ? calc.arranjo.txt : (d.arranjo || "—");

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>' + css() + '</style></head><body>' +
      '<div class="page">' +
        '<div class="topbar"></div>' +
        '<header class="head">' +
          (logoDataUrl() ? '<img class="logo" src="' + logoDataUrl() + '" alt="Alpha Clicheria">' : '') +
          '<div class="doc">ORÇAMENTO</div>' +
        '</header>' +

        '<section class="meta">' +
          '<div class="row"><span>Cliente</span><b>' + esc(d.cliente || "—") + '</b></div>' +
          (d.nomeArquivo ? '<div class="row"><span>Arquivo</span><b>' + esc(d.nomeArquivo) + '</b></div>' : '') +
          '<div class="row"><span>Espessura</span><b>' + esc(custo.num(parseFloat(d.espessura), 2)) + ' mm</b></div>' +
          '<div class="row"><span>Tipo</span><b>' + esc(custo.tipoLabel(d.tipo)) + '</b></div>' +
          '<div class="row"><span>Arranjo</span><b>' + esc(arrTxt) + '</b></div>' +
          '<div class="row"><span>Data</span><b>' + esc(d.dataStr || "") + '</b></div>' +
        '</section>' +

        (d.previewDataUrl ? '<div class="preview"><img src="' + d.previewDataUrl + '" alt="arte"></div>' : '') +

        (chips ? '<div class="cores"><span class="lb">Cores</span>' + chips + '</div>' : '') +

        '<section class="calcbox">' +
          '<div class="cl"><span>Área total</span><b>' + custo.num(totalCm2, 2) + ' cm²</b></div>' +
          '<div class="cl"><span>Fator</span><b>' + custo.brl(calc.fator || 0) + ' /cm²</b></div>' +
          '<div class="cl"><span>Arranjo</span><b>' + esc(arrTxt) + '</b></div>' +
          '<div class="cltot"><span>Valor do orçamento</span><b>' + custo.brl(calc.preco || 0) + '</b></div>' +
        '</section>' +

        '<footer class="foot">Alpha Clicheria &middot; ' + esc(d.dataStr || "") + '</footer>' +
      '</div></body></html>';
  }

  function css() {
    // layout compacto p/ caber SEMPRE em 1 pagina A4
    return [
      '@page{size:A4;margin:0;}',
      '*{margin:0;padding:0;box-sizing:border-box;}',
      'html,body{height:100%;}',
      'body{font-family:-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;color:#1f2a44;}',
      '.page{padding:0 42px 24px;max-height:100vh;overflow:hidden;}',
      '.topbar{height:8px;background:linear-gradient(90deg,#0e1f43,#21407a 60%,#35c6d8);margin:0 -42px 22px;}',
      '.head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;margin-bottom:18px;}',
      '.logo{width:118px;height:auto;}',
      '.doc{font-size:13px;letter-spacing:6px;color:#0e1f43;font-weight:700;}',
      '.meta{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;border:1px solid #e5e9f2;border-radius:12px;padding:4px 20px;margin-bottom:16px;}',
      '.meta .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef1f7;font-size:12.5px;}',
      '.meta .row span{color:#6b7280;}',
      '.meta .row b{font-weight:600;}',
      '.preview{text-align:center;margin-bottom:16px;}',
      '.preview img{max-width:100%;max-height:200px;border:1px solid #e5e9f2;border-radius:8px;}',
      '.cores{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:16px;}',
      '.cores .lb{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;margin-right:4px;}',
      '.chip{display:inline-flex;align-items:center;gap:7px;background:#f4f7fd;border:1px solid #e5e9f2;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;}',
      '.dot{width:12px;height:12px;border-radius:3px;border:1px solid #00000022;display:inline-block;}',
      '.calcbox{border:1px solid #e5e9f2;border-radius:14px;overflow:hidden;}',
      '.calcbox .cl{display:flex;justify-content:space-between;padding:11px 20px;border-bottom:1px solid #eef1f7;font-size:13px;}',
      '.calcbox .cl span{color:#6b7280;}',
      '.calcbox .cl b{font-variant-numeric:tabular-nums;}',
      '.calcbox .cltot{display:flex;justify-content:space-between;align-items:center;padding:20px;background:linear-gradient(135deg,#0e1f43,#21407a);color:#fff;}',
      '.calcbox .cltot span{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#b9c9ec;}',
      '.calcbox .cltot b{font-size:30px;font-weight:800;letter-spacing:-.5px;}',
      '.foot{margin-top:20px;padding-top:12px;border-top:1px solid #e5e9f2;text-align:center;font-size:10.5px;color:#9aa5bd;}'
    ].join("");
  }

  module.exports = { montarHtml: montarHtml };
})();

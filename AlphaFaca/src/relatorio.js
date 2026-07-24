// Alpha Faca - HTML do orçamento do CLIENTE (logo Alpha + total, sem especificações).
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

  // d: { cliente, dataStr, preco, descricao }
  function montarHtmlCliente(d) {
    d = d || {};
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>' + css() + '</style></head><body>' +
      '<div class="page">' +
        '<div class="topbar"></div>' +
        '<header class="head">' +
          (logoDataUrl() ? '<img class="logo" src="' + logoDataUrl() + '" alt="Alpha Clicheria">' : '') +
          '<div class="doc">ORÇAMENTO</div>' +
        '</header>' +

        '<section class="cli">' +
          '<div class="row"><span>Cliente</span><b>' + esc(d.cliente || "—") + '</b></div>' +
          (d.descricao ? '<div class="row"><span>Referência</span><b>' + esc(d.descricao) + '</b></div>' : '') +
          '<div class="row"><span>Data</span><b>' + esc(d.dataStr || "") + '</b></div>' +
        '</section>' +

        '<section class="totbox">' +
          '<span>Valor da faca</span>' +
          '<div class="tot">' + custo.brl(d.preco || 0) + '</div>' +
        '</section>' +

        '<p class="obs">Orçamento referente à confecção da faca de corte e vinco. Valor sujeito a confirmação após análise final do arquivo.</p>' +

        '<footer class="foot">Alpha Clicheria &middot; Facaria &middot; ' + esc(d.dataStr || "") + '</footer>' +
      '</div></body></html>';
  }

  function css() {
    return [
      '*{margin:0;padding:0;box-sizing:border-box;}',
      'body{font-family:-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;color:#1f2a44;}',
      '.page{padding:0 46px 40px;}',
      '.topbar{height:8px;background:linear-gradient(90deg,#0e1f43,#21407a 60%,#35c6d8);margin:0 -46px 46px;}',
      '.head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin-bottom:34px;}',
      '.logo{width:150px;height:auto;}',
      '.doc{font-size:14px;letter-spacing:6px;color:#6b7280;font-weight:600;}',
      '.cli{border:1px solid #e5e9f2;border-radius:12px;padding:6px 20px;margin-bottom:30px;}',
      '.cli .row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eef1f7;font-size:14px;}',
      '.cli .row:last-child{border-bottom:none;}',
      '.cli .row span{color:#6b7280;}',
      '.cli .row b{font-weight:600;}',
      '.totbox{text-align:center;padding:36px 20px;border-radius:16px;background:linear-gradient(135deg,#0e1f43,#21407a);color:#fff;}',
      '.totbox span{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#b9c9ec;}',
      '.tot{font-size:46px;font-weight:800;margin-top:8px;letter-spacing:-1px;}',
      '.obs{margin-top:26px;font-size:12px;color:#6b7280;line-height:1.7;text-align:center;}',
      '.foot{margin-top:40px;padding-top:16px;border-top:1px solid #e5e9f2;text-align:center;font-size:11px;color:#9aa5bd;}'
    ].join("");
  }

  module.exports = { montarHtmlCliente: montarHtmlCliente };
})();

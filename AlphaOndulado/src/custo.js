// Alpha Ondulado - motor de custo do orcamento.
//
// Regra (decidida com o operador):
//   Preco = (SOMA da area de TODOS os grupos, em cm2) x fator x ARRANJO
//   - fator (R$/cm2) e digitado pelo operador que gera o orcamento;
//   - ARRANJO = disposicao das poses (ex.: "2 x 2", "3 x 1"); o multiplicador e o
//     PRODUTO dos dois numeros (2x2 = 4, 3x1 = 3);
//   - espessura (2,84 / 3,96 / 5,00 / 6,35) e tipo (repremontagem / cliche /
//     alteracao) sao INFORMATIVOS no orcamento, nao entram na conta.
//
// analise: retorno do motor de grupos ({ cores:[...], totalCm2 })
// job:     { cliente, espessura, tipo, fator, arranjo }

(function () {
  "use strict";

  function n(v) { var x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? 0 : x; }

  // "2 x 2" / "3x1" / "2 X 4" -> { a, b, mult, txt }. Um numero so -> a x 1.
  function parseArranjo(v) {
    var s = String(v == null ? "" : v).replace(/[,]/g, ".");
    var m = s.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
    var a = 0, b = 0;
    if (m) { a = parseFloat(m[1]); b = parseFloat(m[2]); }
    else { var u = s.match(/(\d+(?:\.\d+)?)/); if (u) { a = parseFloat(u[1]); b = 1; } }
    var mult = (a > 0 && b > 0) ? a * b : 0;
    var txt = (a > 0 && b > 0) ? (fmtInt(a) + " × " + fmtInt(b)) : "";
    return { a: a, b: b, mult: mult, txt: txt };
  }
  function fmtInt(x) { return (x === Math.floor(x)) ? String(x) : String(x); }

  var ESPESSURAS = [2.84, 3.96, 5.00, 6.35];
  var TIPOS = [
    { id: "repremontagem", label: "Repremontagem" },
    { id: "cliche", label: "Clichê" },
    { id: "alteracao", label: "Alteração" }
  ];

  function tipoLabel(id) {
    for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i].id === id) return TIPOS[i].label;
    return "—";
  }

  function calcular(analise, job) {
    analise = analise || {}; job = job || {};
    var cores = analise.cores || [];
    var fator = n(job.fator);
    var arr = parseArranjo(job.arranjo);

    var totalCm2 = 0, i;
    for (i = 0; i < cores.length; i++) totalCm2 += (cores[i].areaCm2 || 0);
    if (analise.totalCm2 != null) totalCm2 = analise.totalCm2;

    var mult = arr.mult > 0 ? arr.mult : 0;
    var preco = totalCm2 * fator * mult;

    var faltando = [];
    if (!job.cliente) faltando.push("cliente");
    if (!job.espessura) faltando.push("espessura");
    if (!job.tipo) faltando.push("tipo (repremontagem / clichê / alteração)");
    if (fator <= 0) faltando.push("fator (R$/cm²)");
    if (arr.mult <= 0) faltando.push("arranjo (ex.: 2 x 2)");
    if (cores.length === 0) faltando.push("PDF com grupos de cor");

    return {
      cores: cores,
      totalCm2: totalCm2,
      fator: fator,
      arranjo: arr,
      preco: preco,
      faltando: faltando,
      ok: faltando.length === 0
    };
  }

  // R$ pt-BR sem Intl (mesmo do AlphaFaca)
  function brl(v) {
    var neg = v < 0;
    v = Math.abs(Math.round(v * 100) / 100);
    var inteiro = Math.floor(v);
    var cent = Math.round((v - inteiro) * 100);
    var s = inteiro.toString(), out = "", c = 0, k;
    for (k = s.length - 1; k >= 0; k--) { out = s.charAt(k) + out; c++; if (c % 3 === 0 && k > 0) out = "." + out; }
    return (neg ? "-" : "") + "R$ " + out + "," + (cent < 10 ? "0" + cent : cent);
  }

  // numero pt-BR com casas fixas (ex.: 1234.5 -> "1.234,50")
  function num(v, casas) {
    if (casas == null) casas = 2;
    var neg = v < 0;
    v = Math.abs(v);
    var f = Math.pow(10, casas);
    v = Math.round(v * f) / f;
    var inteiro = Math.floor(v);
    var frac = Math.round((v - inteiro) * f);
    var s = inteiro.toString(), out = "", c = 0, k;
    for (k = s.length - 1; k >= 0; k--) { out = s.charAt(k) + out; c++; if (c % 3 === 0 && k > 0) out = "." + out; }
    var fs = "";
    if (casas > 0) { fs = frac.toString(); while (fs.length < casas) fs = "0" + fs; fs = "," + fs; }
    return (neg ? "-" : "") + out + fs;
  }

  // parse pt-BR/en para numero (ex.: "0,85" -> 0.85). Usado ao salvar o fator.
  function num0(v) { return n(v); }

  module.exports = {
    calcular: calcular, brl: brl, num: num, num0: num0, parseArranjo: parseArranjo,
    ESPESSURAS: ESPESSURAS, TIPOS: TIPOS, tipoLabel: tipoLabel
  };
})();

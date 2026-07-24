// Alpha Faca - motor de custo (modelo v2: custo de matéria-prima + % de ganho).
//
// Custo = corte + vinco + picote + madeira + celastro
// Preço do cliente = Custo * (1 + percentual/100)
//
// medidas: { corteM, vincoM, picoteM, laserM, areaBaseM2 }   (metros / m^2, do DXF)
// cad:     cadastros (ver colormap? não — ver renderer: carregarCad())
//          {
//            laminasCorte:[{id,nome,dentes,altura,precoM}],
//            laminasVinco:[{id,altura,precoM}],
//            picotePrecoM, celastroPrecoM2,
//            madeiraPlana:[{id,espessura,precoM2}],
//            madeiraRotativa:[{id,diametro,coeficiente}]
//          }
// job:     {
//            cliente, tipoFaca:'plana'|'rotativa',
//            espessuraId, diametroId, comprimentoCalha, qtdCalhas,
//            laminaCorteId, laminaVincoId,
//            celastroAreaM2, percentual
//          }

(function () {
  "use strict";

  function n(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
  function acha(lista, id) {
    lista = lista || [];
    var i;
    for (i = 0; i < lista.length; i++) if (String(lista[i].id) === String(id)) return lista[i];
    return null;
  }

  function calcular(medidas, cad, job) {
    medidas = medidas || {}; cad = cad || {}; job = job || {};
    var corteM = n(medidas.corteM), vincoM = n(medidas.vincoM), picoteM = n(medidas.picoteM);

    var items = [];
    var faltando = [];
    function add(chave, desc, driver, un, rate, valor, obs) {
      items.push({ chave: chave, desc: desc, driver: driver, un: un, rate: rate, valor: valor, obs: obs || "" });
    }

    // ---- corte ----
    var lc = acha(cad.laminasCorte, job.laminaCorteId);
    if (corteM > 0 && !lc) faltando.push("lâmina de corte");
    add("corte", "Lâmina de corte", corteM, "m",
      lc ? n(lc.precoM) : 0, corteM * (lc ? n(lc.precoM) : 0),
      lc ? (lc.nome ? lc.nome + " · " : "") + (lc.dentes ? lc.dentes + " dentes · " : "") + (lc.altura ? "alt " + lc.altura : "") : "");

    // ---- vinco ----
    var lv = acha(cad.laminasVinco, job.laminaVincoId);
    if (vincoM > 0 && !lv) faltando.push("lâmina de vinco");
    add("vinco", "Lâmina de vinco", vincoM, "m",
      lv ? n(lv.precoM) : 0, vincoM * (lv ? n(lv.precoM) : 0),
      lv ? "alt " + lv.altura : "");

    // ---- picote ----
    if (picoteM > 0) {
      var pp = n(cad.picotePrecoM);
      if (pp <= 0) faltando.push("preço do picote (Configuração)");
      add("picote", "Picote", picoteM, "m", pp, picoteM * pp, "valor médio");
    }

    // ---- madeira ----
    if (job.tipoFaca === "rotativa") {
      var dia = acha(cad.madeiraRotativa, job.diametroId);
      var compr = n(job.comprimentoCalha), qtd = n(job.qtdCalhas);
      if (!dia) faltando.push("diâmetro da madeira (rotativa)");
      if (compr <= 0) faltando.push("comprimento da calha");
      if (qtd <= 0) faltando.push("quantidade de calhas");
      var coef = dia ? n(dia.coeficiente) : 0;
      var vMad = coef * compr * qtd;
      add("madeira", "Madeira (rotativa)", qtd, "calha(s)", 0, vMad,
        (dia ? "Ø" + dia.diametro + " · coef " + coef + " · " : "") + "calha " + compr + " m");
    } else {
      // plana (padrão)
      var esp = acha(cad.madeiraPlana, job.espessuraId);
      var area = n(job.areaBaseM2 != null ? job.areaBaseM2 : medidas.areaBaseM2);
      if (!esp) faltando.push("espessura da madeira (plana)");
      var vMadP = esp ? area * n(esp.precoM2) : 0;
      add("madeira", "Madeira (plana)", area, "m²", esp ? n(esp.precoM2) : 0, vMadP,
        esp ? "espessura " + esp.espessura : "");
    }

    // ---- celastro (opcional) — área das regiões desenhadas ----
    var celA = n(job.celastroAreaM2);
    if (celA > 0) {
      var cp = n(cad.celastroPrecoM2);
      if (cp <= 0) faltando.push("preço do celastro (Configuração)");
      add("celastro", "Celastro", celA, "m²", cp, celA * cp, "regiões desenhadas no preview");
    }

    // ---- cliente ----
    if (!job.cliente) faltando.push("cliente");

    var custo = 0, i;
    for (i = 0; i < items.length; i++) custo += items[i].valor;

    var pct = n(job.percentual);
    var preco = custo * (1 + pct / 100);

    return {
      items: items,
      custo: custo,
      percentual: pct,
      preco: preco,
      faltando: faltando,
      ok: faltando.length === 0
    };
  }

  // formata R$ pt-BR sem Intl
  function brl(v) {
    var neg = v < 0;
    v = Math.abs(Math.round(v * 100) / 100);
    var inteiro = Math.floor(v);
    var cent = Math.round((v - inteiro) * 100);
    var s = inteiro.toString(), out = "", c = 0, k;
    for (k = s.length - 1; k >= 0; k--) { out = s.charAt(k) + out; c++; if (c % 3 === 0 && k > 0) out = "." + out; }
    return (neg ? "-" : "") + "R$ " + out + "," + (cent < 10 ? "0" + cent : cent);
  }

  module.exports = { calcular: calcular, brl: brl };
})();

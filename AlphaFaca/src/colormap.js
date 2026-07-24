// Alpha Faca - mapa de cores/layers -> funcao da faca
// Preset detectado no arquivo real da Alpha (CX PIZZA 40): 1=corte, 3=vinco, 7=arte.

(function () {
  "use strict";

  // funcoes reconhecidas pelo motor de custo
  var FUNCOES = {
    corte:   { rotulo: "Corte",   cor: "#e11d48", conta: true },  // faca -> metro de corte
    vinco:   { rotulo: "Vinco",   cor: "#16a34a", conta: true },  // creasing -> metro de vinco
    picote:  { rotulo: "Picote",  cor: "#2563eb", conta: true },  // perf/serrilha
    arte:    { rotulo: "Arte",    cor: "#94a3b8", conta: false }, // impressao (nao e' faca)
    cotas:   { rotulo: "Cotas",   cor: "#a855f7", conta: false }, // dimensoes/texto
    ignorar: { rotulo: "Ignorar", cor: "#cbd5e1", conta: false }
  };

  // preset por cor ACI (AutoCAD Color Index)
  var PRESET_COR = {
    "1": "corte",   // vermelho
    "3": "vinco",   // verde
    "5": "picote",  // azul (palpite comum p/ perf)
    "7": "arte"     // preto/branco -> normalmente a arte / layer _IMPRIMIR
  };

  // heuristica por nome de layer (fallback quando a cor nao esta no preset)
  function porNomeLayer(nome) {
    var n = (nome || "").toUpperCase();
    if (/CORTE|CUT|FACA/.test(n)) return "corte";
    if (/VINC|CREAS|DOBRA|SCORE/.test(n)) return "vinco";
    if (/PICOT|PERF|SERRILH/.test(n)) return "picote";
    if (/IMPRIM|ARTE|PRINT|DESIGN/.test(n)) return "arte";
    if (/COTA|DIM|TEXT|MEDID/.test(n)) return "cotas";
    return null;
  }

  // sugere o mapa inicial. Fonte unica = COR (chaves "cor:N"), para o painel bater
  // exatamente com a classificacao. Prioridade por cor:
  //   1) preset ACI (1=corte, 3=vinco, 5=picote, 7=arte)
  //   2) se a cor nao esta no preset, deduz pelo nome do(s) layer(s) que a usam
  //   3) senao, "ignorar"
  function sugerirMapa(parsed) {
    // mapeia cada cor -> conjunto de layers que a utilizam
    var coresLayers = {};
    var i;
    for (i = 0; i < parsed.entities.length; i++) {
      var e = parsed.entities[i];
      var k = String(e.color);
      if (!coresLayers[k]) coresLayers[k] = {};
      coresLayers[k][e.layer] = true;
    }

    var mapa = {};
    var c;
    for (c in parsed.colorStats) {
      if (!parsed.colorStats.hasOwnProperty(c)) continue;
      if (PRESET_COR[c]) { mapa["cor:" + c] = PRESET_COR[c]; continue; }
      // tenta pelo nome dos layers dessa cor
      var achou = null;
      var lay;
      for (lay in coresLayers[c]) {
        var f = porNomeLayer(lay);
        if (f) { achou = f; break; }
      }
      mapa["cor:" + c] = achou || "ignorar";
    }
    return mapa;
  }

  // classifica UMA entidade dado o mapa atual.
  // prioridade: chave por layer (layer:NOME) > chave por cor (cor:N) > heuristica de nome > 'ignorar'
  function classificar(ent, mapa) {
    var kl = "layer:" + ent.layer;
    if (mapa[kl]) return mapa[kl];
    var kc = "cor:" + ent.color;
    if (mapa[kc]) return mapa[kc];
    var h = porNomeLayer(ent.layer);
    return h || "ignorar";
  }

  // agrega comprimentos por funcao aplicando o mapa. Retorna:
  // { corte:{m,count}, vinco:{...}, picote:{...}, arte:{...}, cotas:{...}, ignorar:{...} }
  function medir(parsed, mapa) {
    var acc = {};
    var f;
    for (f in FUNCOES) acc[f] = { len: 0, count: 0 };
    var i;
    for (i = 0; i < parsed.entities.length; i++) {
      var e = parsed.entities[i];
      var func = classificar(e, mapa);
      if (!acc[func]) acc[func] = { len: 0, count: 0 };
      acc[func].len += e.length;
      acc[func].count++;
    }
    return acc;
  }

  module.exports = {
    FUNCOES: FUNCOES,
    PRESET_COR: PRESET_COR,
    sugerirMapa: sugerirMapa,
    classificar: classificar,
    medir: medir
  };
})();

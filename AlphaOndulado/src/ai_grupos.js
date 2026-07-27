// Alpha Ondulado - leitor dos GRUPOS REAIS do Illustrator embutidos no PDF.
//
// Illustrator, ao salvar PDF "com capacidade de edicao", embute a ARTE no formato
// interno (PGF) dentro de objetos /AIPrivateData1..N. Esse art stream carrega:
//   u / U          -> begin / end GROUP (os grupos reais, aninhados)
//   %AI5_BeginLayer / (nome) Ln / LB -> layers por nome
//   ... (nome) .. Xx / XX -> cor SPOT com o nome em texto (ex.: (cor), (PANTONE 288 C))
//   c m y k K / g  -> cromia (cmyk) / cinza
//   m L l C c V v Y y + F f S s B b -> geometria + pintura
//
// Reproduz o 10_Medicao_Ondulado.jsx FORA do Illustrator: cada GRUPO do topo de uma
// layer de arte = 1 placa; cor predominante = spot mais frequente (ignora branco/none/
// registration); medida = bounding box do grupo (pt -> mm -> cm).
//
// Interface:  lerGruposAI(uint8) -> { ok, motivo?, layers, placas:[{cor,grupos:[...]}], ... }
// (a camada de cima agrega por cor, igual ao pdf_grupos)

(function () {
  "use strict";
  var zlib = require("zlib");
  var fzstd = require("fzstd"); // decoder puro-JS de Zstandard (arte do Illustrator 24+)

  var PT_TO_MM = 25.4 / 72;

  // ---------- 1. extrair e concatenar o art stream /AIPrivateDataN ----------
  function extrairArtStream(uint8) {
    var s = latin1(uint8);

    // mapeia os chunks de arte -> numero do objeto. Illustrator usa varios nomes:
    //   /AIPrivateData1..N   (PS, em chunks)
    //   /AIPDFPrivateData1..N (PDF, em chunks)
    // e o esquema antigo de 1 objeto: /Private <obj> 0 R (dentro do PieceInfo/Illustrator).
    var re = /\/AI(?:PDF)?PrivateData(\d+)\s+(\d+)\s+0\s+R/g, m;
    var mapa = []; // {n, obj}
    while ((m = re.exec(s)) !== null) mapa.push({ n: parseInt(m[1], 10), obj: parseInt(m[2], 10) });

    if (mapa.length === 0) {
      var re2 = /\/Private\s+(\d+)\s+0\s+R/g;
      while ((m = re2.exec(s)) !== null) mapa.push({ n: 1, obj: parseInt(m[1], 10) });
    }
    if (mapa.length === 0) return null;
    mapa.sort(function (a, b) { return a.n - b.n; });

    var partes = [];
    for (var i = 0; i < mapa.length; i++) {
      var raw = streamDoObjeto(uint8, s, mapa[i].obj);
      if (raw) partes.push(raw);
    }
    if (!partes.length) return null;

    // concatena os bytes dos chunks
    var total = 0, k;
    for (k = 0; k < partes.length; k++) total += partes[k].length;
    var buf = new Uint8Array(total), off = 0;
    for (k = 0; k < partes.length; k++) { buf.set(partes[k], off); off += partes[k].length; }

    // Illustrator 2020+ (AI24) comprime a arte PGF com Zstandard
    // (marcador %AI24_ZStandard_Data + frames com magic 28 B5 2F FD). Descomprime.
    buf = descomprimirZstd(buf);

    return latin1(buf); // art PGF e ASCII
  }

  // procura frames zstd (magic 28 B5 2F FD) e concatena o conteudo descomprimido.
  // Se nao houver zstd (Illustrator antigo / texto plano / zlib), devolve como veio.
  function descomprimirZstd(buf) {
    var offs = [];
    for (var i = 0; i + 3 < buf.length; i++) {
      if (buf[i] === 0x28 && buf[i + 1] === 0xB5 && buf[i + 2] === 0x2F && buf[i + 3] === 0xFD) offs.push(i);
    }
    if (!offs.length) return buf;
    var saidas = [], t = 0, j;
    for (j = 0; j < offs.length; j++) {
      var fim = (j + 1 < offs.length) ? offs[j + 1] : buf.length;
      try {
        var out = fzstd.decompress(buf.subarray(offs[j], fim));
        saidas.push(out); t += out.length;
      } catch (e) {
        // frame pode ir alem do proximo magic (magic coincidente): tenta ate o fim
        try { var out2 = fzstd.decompress(buf.subarray(offs[j])); saidas.push(out2); t += out2.length; break; }
        catch (e2) {}
      }
    }
    if (!saidas.length) return buf;
    var r = new Uint8Array(t), p = 0;
    for (j = 0; j < saidas.length; j++) { r.set(saidas[j], p); p += saidas[j].length; }
    return r;
  }

  // acha "<obj> 0 obj ... stream\n <bytes> \nendstream", infla se for FlateDecode
  function streamDoObjeto(uint8, s, objNum) {
    var reObj = new RegExp("(?:^|[^0-9])" + objNum + "\\s+0\\s+obj", "g");
    var mm = reObj.exec(s);
    if (!mm) return null;
    var dictStart = mm.index;
    var stIdx = s.indexOf("stream", dictStart);
    if (stIdx < 0) return null;
    var dict = s.substring(dictStart, stIdx);
    // inicio dos bytes: apos "stream" + EOL (\r\n ou \n)
    var p = stIdx + 6;
    if (s.charCodeAt(p) === 13) p++;
    if (s.charCodeAt(p) === 10) p++;
    var end = s.indexOf("endstream", p);
    if (end < 0) return null;
    // remove EOL antes de endstream
    var e = end;
    if (s.charCodeAt(e - 1) === 10) e--;
    if (s.charCodeAt(e - 1) === 13) e--;
    var bytes = uint8.subarray(p, e);
    if (/\/FlateDecode/.test(dict)) {
      try { return new Uint8Array(zlib.inflateSync(Buffer.from(bytes))); }
      catch (ex) { try { return new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes))); } catch (e2) { return bytes; } }
    }
    return bytes;
  }

  function latin1(u8) {
    // decodifica em blocos p/ nao estourar o stack
    var out = "", CH = 65536, i, j;
    for (i = 0; i < u8.length; i += CH) {
      var end = Math.min(i + CH, u8.length), arr = [];
      for (j = i; j < end; j++) arr.push(String.fromCharCode(u8[j]));
      out += arr.join("");
    }
    return out;
  }

  // ---------- 2. tokenizar a arte PGF ----------
  // tokens: numeros, (strings), e operadores (palavras). Comentarios %... ate EOL.
  function tokenizar(art) {
    var toks = [], i = 0, n = art.length;
    while (i < n) {
      var c = art.charAt(i);
      if (c === "%") { while (i < n && art.charAt(i) !== "\n" && art.charAt(i) !== "\r") i++; continue; }
      if (c === " " || c === "\n" || c === "\r" || c === "\t") { i++; continue; }
      if (c === "(") {
        // string com escape e parenteses balanceados
        var depth = 1, str = "", j = i + 1;
        while (j < n && depth > 0) {
          var ch = art.charAt(j);
          if (ch === "\\") { str += art.charAt(j + 1); j += 2; continue; }
          if (ch === "(") { depth++; str += ch; j++; continue; }
          if (ch === ")") { depth--; if (depth > 0) str += ch; j++; continue; }
          str += ch; j++;
        }
        toks.push({ t: "s", v: str }); i = j; continue;
      }
      // token ate proximo espaco/delimitador
      var start = i;
      while (i < n) {
        var d = art.charAt(i);
        if (d === " " || d === "\n" || d === "\r" || d === "\t" || d === "(" || d === "%") break;
        i++;
      }
      var w = art.substring(start, i);
      if (/^-?\.?\d/.test(w) && /^-?(\d+\.?\d*|\.\d+)$/.test(w)) toks.push({ t: "n", v: parseFloat(w) });
      else toks.push({ t: "o", v: w });
    }
    return toks;
  }

  // ---------- 3. interpretar: layers, grupos, cores, bounds ----------
  function corEhTecnica(nome) {
    var x = String(nome).toLowerCase();
    return (x === "none" || x === "[none]" || x === "white" || x === "registration" ||
            x === "[registration]" || x === "registro" || x === "[registro]");
  }
  function layerTecnica(nome) {
    var t = ["faca", "cut", "cota", "cotas", "registros", "label", "borda"];
    var x = String(nome).toLowerCase();
    for (var i = 0; i < t.length; i++) if (x === t[i]) return true;
    return false;
  }

  function interpretar(toks) {
    var stack = []; // numeros pendentes
    var strs = [];  // strings pendentes (nomes)
    var i, tk;

    var layerAtual = "";
    var layerTec = false;
    var grpDepth = 0;         // profundidade de grupo DENTRO da layer
    var grupoTopo = null;     // grupo de nivel 1 corrente

    var fillSpot = null, strokeSpot = null;
    var fillCromia = null, strokeCromia = null;

    var placas = [];          // {layer, contagemSpot, contagemCromia, bbox}
    var layersVistas = {};

    // MEDICAO POR SUBPATH (bounds VISIVEL, igual ao getVisibleBoundsDeep do JSX):
    // acumula as coords do subpath corrente; ao PINTAR, classifica o subpath em
    // CONTEUDO (pintado, f/F/s/S/b/B) ou CLIP (no-paint, n/N = mascara). O bounds
    // visivel do grupo = uniao do conteudo INTERSECTADA com a mascara.
    function addPt(x, y) {
      if (!grupoTopo) return;
      var b = grupoTopo.curBox;
      if (!b) { grupoTopo.curBox = [x, y, x, y]; return; }
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
    function flushSub(ehClip) {
      if (!grupoTopo || !grupoTopo.curBox) return;
      if (ehClip) grupoTopo.clipBB = boxUniao(grupoTopo.clipBB, grupoTopo.curBox);
      else grupoTopo.contentBB = boxUniao(grupoTopo.contentBB, grupoTopo.curBox);
      grupoTopo.curBox = null;
    }
    // conta a cor no momento em que ela e DEFINIDA (cada set de fill/stroke = 1 uso).
    // Espelha "spot mais frequente em fill+stroke" do 10_Medicao_Ondulado.
    function contaCorSet(isFill) {
      if (!grupoTopo) return;
      var spot = isFill ? fillSpot : strokeSpot;
      var crom = isFill ? fillCromia : strokeCromia;
      if (spot && !corEhTecnica(spot)) grupoTopo.spot[spot] = (grupoTopo.spot[spot] || 0) + 1;
      else if (crom) grupoTopo.cromia[crom] = (grupoTopo.cromia[crom] || 0) + 1;
    }

    for (i = 0; i < toks.length; i++) {
      tk = toks[i];
      if (tk.t === "n") { stack.push(tk.v); continue; }
      if (tk.t === "s") { strs.push(tk.v); continue; }
      var op = tk.v;

      switch (op) {
        // ---- layer ----
        case "Lb": layerTec = false; layerAtual = ""; break; // begin layer (nome vem no Ln)
        case "Ln":
          layerAtual = strs.length ? strs[strs.length - 1] : "";
          layerTec = layerTecnica(layerAtual);
          layersVistas[layerAtual] = true;
          break;
        case "LB": /* end layer */ layerAtual = ""; layerTec = false; grpDepth = 0; grupoTopo = null; break;

        // ---- grupo ----
        case "u": case "*u":
          grpDepth++;
          if (grpDepth === 1 && !layerTec) {
            grupoTopo = { layer: layerAtual, spot: {}, cromia: {}, contentBB: null, clipBB: null, curBox: null, bbox: null };
          }
          break;
        case "U": case "*U":
          if (grpDepth === 1 && grupoTopo) {
            flushSub(false); // subpath pendente sem pintura explicita conta como conteudo
            var vb = grupoTopo.contentBB;
            // a mascara de clip ENCOLHE p/ a area visivel; se nao cruza, mantem o conteudo
            if (vb && grupoTopo.clipBB) {
              var inter = boxInter(vb, grupoTopo.clipBB);
              if (inter) vb = inter;
            }
            grupoTopo.bbox = vb;
            if (vb) placas.push(grupoTopo);
            grupoTopo = null;
          }
          if (grpDepth > 0) grpDepth--;
          break;

        // ---- cor fill (spot com nome) ----
        // AI24: "C M Y K (nome) tint x"  |  outras versoes: "... (nome) ... Xx"
        case "x": case "Xx": // custom/spot FILL
          if (strs.length) { fillSpot = strs[strs.length - 1]; fillCromia = null; contaCorSet(true); }
          break;
        case "X": case "XX": // custom/spot STROKE
          if (strs.length) { strokeSpot = strs[strs.length - 1]; strokeCromia = null; contaCorSet(false); }
          break;
        case "k": // c m y k -> fill cmyk
          fillCromia = cromiaDe(stack); fillSpot = null; contaCorSet(true); break;
        case "K": // stroke cmyk
          strokeCromia = cromiaDe(stack); strokeSpot = null; contaCorSet(false); break;
        case "g": // gray fill
          fillCromia = (stack.length && stack[stack.length - 1] === 0) ? "black" : null; fillSpot = null; contaCorSet(true); break;
        case "G":
          strokeCromia = (stack.length && stack[stack.length - 1] === 0) ? "black" : null; strokeSpot = null; contaCorSet(false); break;

        // ---- geometria ----
        case "m": case "L": case "l":
          if (stack.length >= 2) addPt(stack[stack.length - 2], stack[stack.length - 1]);
          break;
        case "C": case "c": // 6 coords: 2 ctrl + 2 ctrl + 2 end
          consumirCoords(stack, 6, addPt); break;
        case "V": case "v": case "Y": case "y": // 4 coords
          consumirCoords(stack, 4, addPt); break;

        // ---- pintura: fecha o subpath (a cor ja foi contada no set) ----
        case "f": case "F": case "s": case "S": case "b": case "B":
          flushSub(false); break;   // pintado -> CONTEUDO
        case "n": case "N":
          flushSub(true); break;    // no-paint -> mascara de CLIP

        default: break;
      }

      // operadores consomem os operandos pendentes
      if (op !== undefined) { stack.length = 0; strs.length = 0; }
    }

    return { placas: placas, layers: keys(layersVistas) };
  }

  // caixas no formato [minX, minY, maxX, maxY]
  function boxUniao(a, b) {
    if (!a) return b ? [b[0], b[1], b[2], b[3]] : null;
    if (!b) return a;
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  }
  function boxInter(a, b) {
    if (!a || !b) return null;
    var x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]);
    var x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
    if (x1 <= x0 || y1 <= y0) return null; // nao se cruzam
    return [x0, y0, x1, y1];
  }

  function cromiaDe(stack) {
    if (stack.length < 4) return null;
    var c = stack[stack.length - 4], m = stack[stack.length - 3],
        y = stack[stack.length - 2], k = stack[stack.length - 1];
    function ap(v, a) { return Math.abs(v - a) < 0.02; }
    if (ap(c, 1) && ap(m, 0) && ap(y, 0) && ap(k, 0)) return "cyan";
    if (ap(m, 1) && ap(c, 0) && ap(y, 0) && ap(k, 0)) return "magenta";
    if (ap(y, 1) && ap(c, 0) && ap(m, 0) && ap(k, 0)) return "yellow";
    if (ap(k, 1) && ap(c, 0) && ap(m, 0) && ap(y, 0)) return "black";
    if (ap(c, 0) && ap(m, 0) && ap(y, 0) && ap(k, 0)) return null; // branco
    return null;
  }
  function consumirCoords(stack, count, addPt) {
    // usa os ULTIMOS 'count' numeros como pares (x,y)
    var base = stack.length - count;
    if (base < 0) base = 0;
    for (var p = base; p + 1 < stack.length; p += 2) addPt(stack[p], stack[p + 1]);
  }
  function keys(o) { var a = []; for (var k in o) if (o.hasOwnProperty(k)) a.push(k); return a; }

  function melhor(cont) {
    var best = null, mx = 0;
    for (var k in cont) if (cont.hasOwnProperty(k) && cont[k] > mx) { mx = cont[k]; best = k; }
    return best;
  }

  // ---------- 4. montar o resultado no MESMO formato do pdf_grupos ----------
  function lerGruposAI(uint8) {
    var art = extrairArtStream(uint8);
    if (!art) return { ok: false, motivo: "sem-aiprivatedata" };
    if (art.indexOf(" Lb") < 0 && art.indexOf("BeginLayer") < 0 && art.indexOf(" u\n") < 0) {
      // heuristica fraca; segue mesmo assim se tiver operadores
    }
    var toks = tokenizar(art);
    var r = interpretar(toks);
    if (!r.placas.length) return { ok: false, motivo: "sem-grupos" };

    // cada placa: cor predominante (spot > cromia) + dims
    var porCor = {}; // nomeCor -> { grupos:[...] }
    for (var i = 0; i < r.placas.length; i++) {
      var pl = r.placas[i];
      var nomeCor = melhor(pl.spot) || melhor(pl.cromia);
      if (!nomeCor) continue;
      var bb = pl.bbox;
      var wMM = Math.abs(bb[2] - bb[0]) * PT_TO_MM;
      var hMM = Math.abs(bb[3] - bb[1]) * PT_TO_MM;
      var wCM = wMM / 10, hCM = hMM / 10;
      var g = { wMM: wMM, hMM: hMM, wCM: wCM, hCM: hCM, areaCm2: wCM * hCM, layer: pl.layer, bbox: bb };
      if (!porCor[nomeCor]) porCor[nomeCor] = { nome: nomeCor, grupos: [] };
      porCor[nomeCor].grupos.push(g);
    }

    var cores = [];
    for (var nome in porCor) {
      if (!porCor.hasOwnProperty(nome)) continue;
      var c = porCor[nome];
      c.grupos.sort(function (a, b) { return b.areaCm2 - a.areaCm2; });
      var soma = 0;
      for (var s = 0; s < c.grupos.length; s++) soma += c.grupos[s].areaCm2;
      cores.push({
        nome: nome, nomeAuto: nome, corKey: nome,
        rgbCss: corParaCss(nome),
        grupos: c.grupos, nGrupos: c.grupos.length, areaCm2: soma
      });
    }
    cores.sort(function (a, b) { return b.areaCm2 - a.areaCm2; });
    var totalCm2 = 0, ng = 0;
    for (var t = 0; t < cores.length; t++) { totalCm2 += cores[t].areaCm2; ng += cores[t].nGrupos; }

    return {
      ok: true, fonte: "ai",
      cores: cores, totalCm2: totalCm2, nCores: cores.length, nGruposTotal: ng,
      layers: r.layers
    };
  }

  function corParaCss(nome) {
    var x = String(nome).toLowerCase();
    if (x === "black" || x.indexOf("preto") >= 0) return "rgb(30,30,30)";
    if (x === "cyan" || x.indexOf("cian") >= 0) return "rgb(0,174,239)";
    if (x === "magenta") return "rgb(236,0,140)";
    if (x === "yellow" || x.indexOf("amarelo") >= 0) return "rgb(255,222,0)";
    return "rgb(120,120,130)"; // spot generica (a UI mostra o nome de qualquer jeito)
  }

  module.exports = { lerGruposAI: lerGruposAI, extrairArtStream: extrairArtStream };
})();

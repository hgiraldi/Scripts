/* ============================================================
 * AlphaPack - gravacao/leitura de screening no PDF (Node/CEP)
 * v1: grava a prop XMP `alphapack:screening` via UPDATE INCREMENTAL
 *     (nao reescreve o PDF; so acrescenta no fim). Assume xref
 *     classico (confirmado nos .ai/PDF do Illustrator).
 * Expondo window.APPdf = { read(path), write(path, encoded) }.
 * ============================================================ */
(function () {
  "use strict";

  var NS = "http://alphaclicheria.com.br/alphapack/1.0/";

  function req(name) { try { return require(name); } catch (e) { return null; } }

  function pad10(n) { var x = String(n); while (x.length < 10) x = "0" + x; return x; }

  /* ---- extrai o valor (codificado) da prop, pegando a ULTIMA ocorrencia ---- */
  function extract(s) {
    var re = /<alphapack:screening>([\s\S]*?)<\/alphapack:screening>/g, m, last = null;
    while ((m = re.exec(s)) !== null) last = m[1];
    if (last === null) {
      var re2 = /alphapack:screening="([^"]*)"/g, m2;
      while ((m2 = re2.exec(s)) !== null) last = m2[1];
    }
    return last;
  }

  function read(path) {
    var fs = req("fs"); if (!fs) return { ok: false, err: "Node fs indisponivel" };
    try {
      // A prop e gravada no FIM (update incremental), entao lemos so a CAUDA:
      // evita carregar PDFs enormes (montagens de centenas de MB) inteiros.
      var TAIL = 1024 * 1024;
      var size = fs.statSync(path).size;
      var start = size > TAIL ? size - TAIL : 0;
      var len = size - start;
      var fd = fs.openSync(path, "r");
      var b = Buffer.alloc(len);
      fs.readSync(fd, b, 0, len, start);
      fs.closeSync(fd);
      var v = extract(b.toString("latin1"));
      if (v === null) return { ok: true, value: null };
      try { v = decodeURIComponent(v); } catch (e) {}
      return { ok: true, value: v };
    } catch (e) { return { ok: false, err: String(e.message || e) }; }
  }

  /* ---- injeta/atualiza a prop dentro de um pacote XMP ---- */
  function patchXmp(xmp, encoded) {
    // remove qualquer Description nosso anterior e a prop solta
    xmp = xmp.replace(/<rdf:Description\b[^>]*xmlns:alphapack="[^"]*"[\s\S]*?<\/rdf:Description>/g, "");
    xmp = xmp.replace(/<alphapack:screening>[\s\S]*?<\/alphapack:screening>/g, "");
    var bloco = '<rdf:Description rdf:about="" xmlns:alphapack="' + NS + '">' +
                '<alphapack:screening>' + encoded + '</alphapack:screening>' +
                '</rdf:Description>';
    if (xmp.indexOf("</rdf:RDF>") !== -1) return xmp.replace("</rdf:RDF>", bloco + "</rdf:RDF>");
    if (xmp.indexOf("</x:xmpmeta>") !== -1) return xmp.replace("</x:xmpmeta>", bloco + "</x:xmpmeta>");
    return xmp + bloco;
  }

  function write(path, encoded) {
    var fs = req("fs"), zlib = req("zlib");
    if (!fs) return { ok: false, err: "Node fs indisponivel" };
    try {
      var buf = fs.readFileSync(path);
      var s = buf.toString("latin1");

      // --- trailer info (vale p/ xref classico e xref-stream) ---
      var mRoot = s.match(/\/Root\s+(\d+)\s+\d+\s+R(?![\s\S]*\/Root\s+\d+\s+\d+\s+R)/);
      var mSize = s.match(/\/Size\s+(\d+)(?![\s\S]*\/Size\s+\d+)/);
      var mSx   = s.match(/startxref\s+(\d+)\s*%%EOF\s*$/);
      if (!mSx) { var all = s.match(/startxref\s+(\d+)/g); if (all) mSx = all[all.length - 1].match(/(\d+)/); }
      if (!mRoot || !mSize || !mSx) return { ok: false, err: "Nao achei Root/Size/startxref (PDF atipico)" };
      var root = mRoot[1], size = mSize[1], prev = mSx[1];

      // --- objeto de Metadata (ultimo xpacket = versao mais recente) ---
      var pk = s.lastIndexOf("<?xpacket");
      var newXmp, objNum, filter = null;
      if (pk !== -1) {
        var head = s.slice(0, pk);
        var streamKw = head.lastIndexOf("stream");
        if (streamKw === -1) return { ok: false, err: "stream do Metadata nao localizado" };
        var dict = head.slice(head.lastIndexOf("obj", streamKw));
        filter = /\/Filter\s*\/FlateDecode/.test(dict) ? "flate" : null;
        var objRe = /(\d+)\s+\d+\s+obj\b/g, mm, lastObj = null;
        while ((mm = objRe.exec(head)) !== null) lastObj = mm;
        if (!lastObj) return { ok: false, err: "obj do Metadata nao localizado" };
        objNum = lastObj[1];
        var endS = s.indexOf("endstream", pk);
        var cStart = streamKw + "stream".length;
        while (s.charCodeAt(cStart) === 13 || s.charCodeAt(cStart) === 10) cStart++;
        var raw = s.slice(cStart, endS).replace(/[\r\n]+$/, "");
        var xmp = raw;
        if (filter === "flate" && zlib) { try { xmp = zlib.inflateSync(Buffer.from(raw, "latin1")).toString("latin1"); } catch (ei) {} }
        newXmp = patchXmp(xmp, encoded);
      } else {
        // sem XMP: cria um pacote novo, reaproveitando um novo numero de objeto
        objNum = String(parseInt(size, 10));
        size = String(parseInt(size, 10) + 1);
        newXmp = '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
                 '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
                 '</rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
        newXmp = patchXmp(newXmp, encoded);
        // NOTA: sem /Metadata no Catalog este objeto fica orfao; caso raro (Illustrator sempre grava XMP).
      }

      // grava o pacote SEM filtro (XMP deve ser legivel)
      var len = Buffer.byteLength(newXmp, "latin1");
      var objStr = objNum + " 0 obj\n<< /Type /Metadata /Subtype /XML /Length " + len + " >>\nstream\n" + newXmp + "\nendstream\nendobj\n";
      var pre = "\n";
      var objOffset  = buf.length + pre.length;
      var xrefOffset = buf.length + pre.length + Buffer.byteLength(objStr, "latin1");
      var appended = pre + objStr +
        "xref\n" + objNum + " 1\n" + pad10(objOffset) + " 00000 n \n" +
        "trailer\n<< /Size " + size + " /Root " + root + " 0 R /Prev " + prev + " >>\n" +
        "startxref\n" + xrefOffset + "\n%%EOF\n";

      fs.writeFileSync(path, Buffer.concat([buf, Buffer.from(appended, "latin1")]));
      return { ok: true, bytes: appended.length };
    } catch (e) { return { ok: false, err: String(e.message || e) }; }
  }

  /* ============================================================
   *  HALFTONES (Etapa 1) - master Type5 por-colorante, padrao da pagina
   *  Reproduz a estrutura do PackZ: Type1 por tinta + Type5 mestre +
   *  ExtGState /HT aplicado no inicio do conteudo. Sem tocar no vetor.
   * ============================================================ */

  // acha o fim de um dicionario << >> balanceado (i = indice do "<<")
  function dictEnd(s, i) {
    var depth = 0, n = s.length;
    while (i < n) {
      if (s.charCodeAt(i) === 60 && s.charCodeAt(i + 1) === 60) { depth++; i += 2; continue; }
      if (s.charCodeAt(i) === 62 && s.charCodeAt(i + 1) === 62) { depth--; i += 2; if (depth === 0) return i; continue; }
      i++;
    }
    return -1;
  }

  function type1(freq, angle, dot) {
    return "<< /Type /Halftone /Frequency " + freq + " /TransferFunction /Identity /Angle " + angle +
           " /HalftoneType 1 /EskoPNDSN /" + dot + " /SpotFunction /SimpleDot /Esko_ExtHT<< /DotName /" + dot + ">> >>";
  }

  // le os colorantes (Separation/DeviceN) que existem no PDF, em forma PDF (#-encoded)
  function readColorants(path) {
    var fs = req("fs"); if (!fs) return [];
    try {
      var s = fs.readFileSync(path, "latin1");
      var set = {}, m;
      var re = /\/Separation\s*\/([^\s\/\]<>]+)/g;
      while ((m = re.exec(s)) !== null) { if (m[1] !== "None" && m[1] !== "All") set[m[1]] = 1; }
      var reN = /\/DeviceN\s*\[([^\]]*)\]/g, mn;
      while ((mn = reN.exec(s)) !== null) {
        var parts = mn[1].match(/\/([^\s\/\]<>]+)/g);
        if (parts) for (var i = 0; i < parts.length; i++) { var nm = parts[i].substring(1); if (nm !== "None" && nm !== "All") set[nm] = 1; }
      }
      var out = []; for (var k in set) if (set.hasOwnProperty(k)) out.push(k);
      return out;
    } catch (e) { return []; }
  }

  // screens = [{name:"<colorante PDF-encoded>", freq, angle, dot}]
  function writeHalftones(path, screens) {
    var fs = req("fs"), zlib = req("zlib");
    if (!fs) return { ok: false, err: "Node fs indisponivel" };
    if (!screens || !screens.length) return { ok: false, err: "Sem screens pra gravar" };
    try {
      var buf = fs.readFileSync(path);
      var s = buf.toString("latin1");
      var mRoot = s.match(/\/Root\s+(\d+)\s+\d+\s+R(?![\s\S]*\/Root\s+\d+\s+\d+\s+R)/);
      var mSize = s.match(/\/Size\s+(\d+)(?![\s\S]*\/Size\s+\d+)/);
      var mSx = s.match(/startxref\s+(\d+)\s*%%EOF\s*$/);
      if (!mSx) { var all = s.match(/startxref\s+(\d+)/g); if (all) mSx = all[all.length - 1].match(/(\d+)/); }
      if (!mRoot || !mSize || !mSx) return { ok: false, err: "PDF atipico (Root/Size/startxref)" };
      var root = mRoot[1], prev = mSx[1];
      var next = parseInt(mSize[1], 10);

      // 1) Type1 unicos (dedup por freq|angle|dot)
      var t1map = {}, t1objs = [], i, sc, key;
      for (i = 0; i < screens.length; i++) {
        sc = screens[i]; key = sc.freq + "|" + sc.angle + "|" + sc.dot;
        if (t1map[key] === undefined) { t1map[key] = next; t1objs.push({ num: next, body: type1(sc.freq, sc.angle, sc.dot) }); next++; }
      }
      var defT1 = t1objs[0].num;

      // 2) master Type5
      var masterNum = next++;
      var master = "<< /Type /Halftone /HalftoneType 5";
      for (i = 0; i < screens.length; i++) { sc = screens[i]; master += " /" + sc.name + " " + t1map[sc.freq + "|" + sc.angle + "|" + sc.dot] + " 0 R"; }
      master += " /Default " + defT1 + " 0 R /HalftoneName (AS_HT5) >>";

      // 3) ExtGState com /HT
      var egNum = next++;
      var eg = "<< /Type /ExtGState /HT " + masterNum + " 0 R >>";

      // 4) paginas: prepend gs no conteudo + /GSap no Resources/ExtGState
      var pageRe = /\/Type\s*\/Page(?![s])/g, pm, over = [], seenPage = {}, seenContent = {};
      while ((pm = pageRe.exec(s)) !== null) {
        var objIdx = s.lastIndexOf("obj", pm.index);
        var numMatch = s.slice(0, objIdx).match(/(\d+)\s+\d+\s+$/);
        if (!numMatch) continue;
        var pageNum = numMatch[1];
        if (seenPage[pageNum]) continue; seenPage[pageNum] = 1;
        var dOpen = s.indexOf("<<", objIdx), dClose = dictEnd(s, dOpen);
        if (dClose < 0) continue;
        var pd = s.slice(dOpen, dClose);
        var mC = pd.match(/\/Contents\s+(\d+)\s+\d+\s+R/);
        if (!mC) continue;
        var cNum = mC[1];

        // -- conteudo: prepend "/GSap gs" --
        if (!seenContent[cNum]) {
          seenContent[cNum] = 1;
          var cObj = new RegExp("(^|[^0-9])" + cNum + "\\s+0\\s+obj").exec(s);
          if (cObj) {
            var ci = cObj.index + cObj[1].length;
            var cDictOpen = s.indexOf("<<", ci), cDictClose = dictEnd(s, cDictOpen);
            var cDict = s.slice(cDictOpen, cDictClose);
            var stKw = s.indexOf("stream", cDictClose);
            var cs = stKw + 6; while (s.charCodeAt(cs) === 13 || s.charCodeAt(cs) === 10) cs++;
            var ce = s.indexOf("endstream", cs);
            var content = s.slice(cs, ce);
            var isFlate = /\/Filter\s*\/FlateDecode/.test(cDict);
            if (isFlate && zlib) { try { content = zlib.inflateSync(Buffer.from(content, "latin1")).toString("latin1"); } catch (ez) {} }
            var newContent = "/GSap gs\n" + content;
            var outBuf, len;
            if (isFlate && zlib) { outBuf = zlib.deflateSync(Buffer.from(newContent, "latin1")); len = outBuf.length; }
            else { outBuf = Buffer.from(newContent, "latin1"); len = outBuf.length; }
            var newCDict = cDict.replace(/\/Length\s+\d+/, "/Length " + len);
            if (newCDict === cDict) newCDict = cDict.replace(/>>\s*$/, " /Length " + len + " >>");
            over.push({ num: cNum, raw: cNum + " 0 obj" + newCDict + "\nstream\n", stream: outBuf, tail: "\nendstream\nendobj\n" });
          }
        }

        // -- page dict: injeta /GSap no ExtGState --
        var newPd;
        if (/\/ExtGState\s*<</.test(pd)) newPd = pd.replace(/\/ExtGState\s*<</, "/ExtGState<< /GSap " + egNum + " 0 R ");
        else if (/\/Resources\s*<</.test(pd)) newPd = pd.replace(/\/Resources\s*<</, "/Resources<< /ExtGState<< /GSap " + egNum + " 0 R >> ");
        else newPd = pd.replace(/>>\s*$/, " /Resources<< /ExtGState<< /GSap " + egNum + " 0 R >> >> >>");
        over.push({ num: pageNum, text: pageNum + " 0 obj" + newPd + "endobj\n" });
      }
      if (!over.length) return { ok: false, err: "Nenhuma pagina com /Contents encontrada" };

      // 5) monta o append + xref incremental
      var parts = [], xref = {};   // xref[num] = offset
      var pos = buf.length;
      function emit(str) { var b = Buffer.from(str, "latin1"); parts.push(b); pos += b.length; }
      function emitObj(num, str) { xref[num] = pos; emit(str); }

      emit("\n");
      for (i = 0; i < t1objs.length; i++) emitObj(t1objs[i].num, t1objs[i].num + " 0 obj" + t1objs[i].body + "\nendobj\n");
      emitObj(masterNum, masterNum + " 0 obj" + master + "\nendobj\n");
      emitObj(egNum, egNum + " 0 obj" + eg + "\nendobj\n");
      for (i = 0; i < over.length; i++) {
        var o = over[i];
        if (o.stream) { xref[o.num] = pos; emit(o.raw); parts.push(o.stream); pos += o.stream.length; emit(o.tail); }
        else emitObj(o.num, o.text);
      }

      // xref classico: uma subsecao por objeto (simples e valido em update)
      var nums = []; for (var kk in xref) if (xref.hasOwnProperty(kk)) nums.push(parseInt(kk, 10));
      nums.sort(function (a, b) { return a - b; });
      var xrefStart = pos;
      var xr = "xref\n";
      for (i = 0; i < nums.length; i++) xr += nums[i] + " 1\n" + pad10(xref[nums[i]]) + " 00000 n \n";
      xr += "trailer\n<< /Size " + next + " /Root " + root + " 0 R /Prev " + prev + " >>\nstartxref\n" + xrefStart + "\n%%EOF\n";
      emit(xr);

      var arr = [buf]; for (i = 0; i < parts.length; i++) arr.push(parts[i]);
      fs.writeFileSync(path, Buffer.concat(arr));
      return { ok: true, type1: t1objs.length, paginas: seenPage, master: masterNum };
    } catch (e) { return { ok: false, err: String(e.message || e) + (e.stack ? " @ " + e.stack.split("\n")[1] : "") }; }
  }

  window.APPdf = { read: read, write: write, writeHalftones: writeHalftones, readColorants: readColorants, NS: NS };
})();

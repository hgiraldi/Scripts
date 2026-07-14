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
      var s = fs.readFileSync(path, "latin1");
      var v = extract(s);
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

  window.APPdf = { read: read, write: write, NS: NS };
})();

/* ============================================================
 * Alpha Compare - relatorio PDF (jsPDF)
 * Gera A4 com logo Alpha, dados da O.S., miniaturas e a lista de
 * divergencias; grava no Desktop via Node fs.
 * ============================================================ */
(function (root) {
  "use strict";

  var NAVY = [18, 35, 59], ACCENT = [51, 174, 91], GREYT = [110, 120, 135];
  var COL = { miss: [220, 38, 38], extra: [37, 99, 235], diff: [220, 38, 38], moved: [245, 158, 11], ok: [34, 165, 91] };   // erro=vermelho, a mais=azul, deslocado=laranja, confere=verde
  var LABEL = { miss: "Faltando no arquivo", extra: "Sobrando no arquivo", diff: "Diferente", moved: "Bloco deslocado (observação)", ok: "Código de barras confere" };

  function safeName(s) {
    return String(s || "").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
  }

  function generate(data) {
    var jsPDFctor = (root.jspdf && root.jspdf.jsPDF) ? root.jspdf.jsPDF : null;
    if (!jsPDFctor) return { ok: false, msg: "jsPDF nao carregou" };

    var doc = new jsPDFctor({ unit: "mm", format: "a4", compress: true });
    var PW = 210, PH = 297, M = 14, y;

    // ---- cabecalho ----
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, PW, 26, "F");
    if (data.logo) {
      var la = data.logoAspect || 2, lh = 15, lw = lh * la;   // respeita a proporcao do logo
      if (lw > 46) { lw = 46; lh = lw / la; }
      try { doc.addImage(data.logo, "PNG", M, 4 + (18 - lh) / 2, lw, lh); } catch (e) {}
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text("RELATORIO DE CONFERENCIA VISUAL", PW - M, 13, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setTextColor(200, 210, 225);
    doc.text("Alpha Clicheria  -  Alpha Compare", PW - M, 19, { align: "right" });

    y = 34;
    // ---- metadados ----
    doc.setTextColor(30, 39, 53); doc.setFontSize(10);
    function meta(lbl, val, x, yy, maxW) {
      doc.setFont("helvetica", "bold"); doc.text(lbl, x, yy);
      doc.setFont("helvetica", "normal");
      var vtx = String(val || "-");
      // corta pra caber na coluna (nome de arquivo longo invadia a coluna vizinha)
      if (maxW) { while (vtx.length > 4 && doc.getTextWidth(vtx) > maxW) vtx = vtx.slice(0, -1) + "…"; }
      doc.text(vtx, x + 26, yy);
    }
    meta("O.S.:", data.os, M, y, PW / 2 - M - 28);
    meta("Data:", data.dateStr, PW / 2, y, PW / 2 - M - 28);
    y += 6;
    meta("Produto:", data.job, M, y, PW - 2 * M - 28); y += 6;
    var tol = data.tol || {};
    doc.setTextColor(GREYT[0], GREYT[1], GREYT[2]); doc.setFontSize(8.5);
    doc.text("Modo: " + (data.modeLabel || "Tudo") + "   |   Tolerancia -> cor: " + tol.colorTol +
             "  |  posicao: " + tol.slack + "px  |  area min: " + tol.minArea + "px  |  captura: " + tol.dpi + "dpi", M, y);
    y += 4;
    var alg = data.align || {};
    var confPct = Math.round((alg.conf || 0) * 100);
    doc.text("Alinhamento auto: deslocamento (" + (alg.ox || 0) + "," + (alg.oy || 0) +
             ") px  |  confianca " + confPct + "%" + (data.manual ? "  (ajuste manual aplicado)" : ""), M, y);
    y += 7;

    // ---- resumo (chips) ----
    doc.setDrawColor(226, 231, 238); doc.setLineWidth(0.3);
    doc.setFillColor(246, 248, 250); doc.rect(M, y, PW - 2 * M, 12, "F");
    var cx = M + 4, cyc = y + 7.5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 39, 53);
    doc.text(String(data.total) + " divergencias", cx, cyc); cx += 42;
    function chip(color, n, txt) {
      doc.setFillColor(color[0], color[1], color[2]); doc.rect(cx, cyc - 3, 3.2, 3.2, "F");
      doc.setTextColor(60, 70, 85); doc.setFontSize(9.5); doc.setFont("helvetica", "normal");
      doc.text(n + " " + txt, cx + 4.5, cyc); cx += 40;
    }
    chip(COL.miss, data.counts.miss, "faltando");
    chip(COL.extra, data.counts.extra, "sobrando");
    chip(COL.diff, data.counts.diff, "diferente");
    var ig = data.ignored;
    if (ig && ig.total) {
      var det = [];
      if (ig.struct) det.push(ig.struct + " faca/cota/foto");
      if (ig.man) det.push(ig.man + " marcada(s)");
      if (ig.auto) det.push(ig.auto + " parecida(s)");
      chip([150, 158, 168], ig.total, "ignorada(s)" + (det.length ? " (" + det.join(", ") + ")" : ""));
    }
    y += 17;

    // ---- Barcode Inspection: leitura decodificada dos DOIS lados ----
    if (data.barcode) {
      var bc = data.barcode;
      var bok = bc.status === "confere";
      doc.setFillColor(bok ? 236 : 254, bok ? 250 : 242, bok ? 241 : 242);
      doc.rect(M, y - 3, PW - 2 * M, 8, "F");
      doc.setFillColor(14, 165, 233); doc.rect(M + 2, y - 0.8, 2.6, 2.6, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.setTextColor(bok ? 22 : 180, bok ? 128 : 40, bok ? 70 : 40);
      var btxt = "Codigo de barras (EAN-13): " + bc.file;
      if (bc.status === "confere") btxt += "   -   CONFERE com o original";
      else if (bc.status === "diverge") btxt += "   -   DIVERGE do original (" + (bc.orig || "?") + ")  << VERIFICAR";
      else btxt += "   -   aplicado no arquivo (original nao tem)";
      // corta pra caber na faixa (leituras longas não vazam da página)
      if (doc.getTextWidth(btxt) > PW - 2 * M - 9) {
        while (btxt.length > 8 && doc.getTextWidth(btxt + "...") > PW - 2 * M - 9) btxt = btxt.slice(0, -1);
        btxt += "...";
      }
      doc.text(btxt, M + 7, y + 1.2);
      y += 9;
    }

    // ---- miniaturas (respeitando a PROPORCAO real da arte) ----
    var imgs = data.images || {};
    var aspect = data.imgAspect || 1.4;                 // largura/altura da imagem
    var tw = (PW - 2 * M - 8) / 3;
    var th = Math.max(10, Math.min(tw / aspect, 55));    // altura conforme a proporcao
    function thumb(url, x, label) {
      doc.setDrawColor(200, 208, 218); doc.setFillColor(20, 26, 34); doc.rect(x, y, tw, th, "FD");
      if (url) {
        var dw = tw - 1.2, dh = dw / aspect;
        if (dh > th - 1.2) { dh = th - 1.2; dw = dh * aspect; }
        try { doc.addImage(url, "PNG", x + (tw - dw) / 2, y + (th - dh) / 2, dw, dh); } catch (e) {}
      }
      doc.setFontSize(8); doc.setTextColor(GREYT[0], GREYT[1], GREYT[2]);
      doc.setFont("helvetica", "bold"); doc.text(label, x, y + th + 4);
    }
    thumb(imgs.orig, M, "ORIGINAL");
    thumb(imgs.file, M + tw + 4, "ARQUIVO");
    thumb(imgs.overlay, M + 2 * (tw + 4), "DIVERGENCIAS");
    y += th + 9;

    // ---- detalhe com FOTOS (Original | Arquivo | Diferença) por divergencia ----
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(30, 39, 53);
    doc.text("Divergencias em detalhe", M, y); y += 5;

    var shots = data.shots || [];
    if (shots.length === 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(GREYT[0], GREYT[1], GREYT[2]);
      doc.text("Nenhuma divergencia encontrada.", M, y + 2);
    }
    var iw = PW - 2 * M;
    // corta texto pra caber em maxW mm (com "..."), na FONTE corrente — títulos longos
    // (URL de QR code) invadiam a coluna de posição/tamanho à direita
    function fitTxt(txt, maxW) {
      txt = String(txt || "");
      if (doc.getTextWidth(txt) <= maxW) return txt;
      var lo = 0, hi = txt.length;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (doc.getTextWidth(txt.slice(0, mid) + "...") <= maxW) lo = mid; else hi = mid - 1; }
      return txt.slice(0, lo) + "...";
    }
    for (var i = 0; i < shots.length; i++) {
      var s = shots[i], asp = s.aspect || 4.7;
      var mw = iw, ih = iw / asp;
      if (ih > 62) { ih = 62; mw = ih * asp; }           // preserva proporcao (nunca estica)
      var mx = M + (iw - mw) / 2, subW = mw / 3;
      var blocoH = 5 + 3.5 + ih + 6;
      if (y + blocoH > PH - 12) { doc.addPage(); y = M; }
      // cabecalho da divergencia (itens especiais: barcode com a LEITURA, texto com rótulo próprio)
      var scol = COL[s.type] || [220, 38, 38];   // cor pelo TIPO: diferente=vermelho, a mais=azul
      var slbl;
      if (s.kind === "barcode") {
        slbl = (s.qr ? "QR CODE: " : "CODIGO DE BARRAS: ") + s.code +
          (s.type === "ok" ? "  -  CONFERE com o original"
           : s.type === "diff" ? "  -  DIVERGE do original (" + (s.codeOrig || "?") + ")"
                               : "  -  aplicado (a mais que o original)");
      } else if (s.kind === "text") {
        if (s.type === "diff") slbl = "TEXTO TROCADO: " + (s.textOrig || "?") + " -> " + (s.textFile || "?");
        else if (s.type === "miss") slbl = "TEXTO FALTANDO: " + (s.textOrig || "?");
        else slbl = "TEXTO A MAIS: " + (s.textFile || "?");
      } else {
        slbl = LABEL[s.type];
      }
      doc.setFillColor(scol[0], scol[1], scol[2]);
      doc.rect(M, y, 3, 3, "F");
      // mede a coluna de pos/tamanho PRIMEIRO e limita o título ao espaço restante
      var posTxt = "pos " + s.px + "% , " + s.py + "%   ·   " + s.w + "x" + s.h + " px   ·   area " + s.area + " px";
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      var posW = doc.getTextWidth(posTxt);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(30, 39, 53);
      doc.text(fitTxt("#" + s.n + "  " + slbl, PW - 2 * M - 5 - posW - 4), M + 5, y + 2.6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(GREYT[0], GREYT[1], GREYT[2]);
      doc.text(posTxt, PW - M, y + 2.6, { align: "right" });
      y += 5;
      // legendas das 3 colunas (alinhadas ao montage)
      doc.setFontSize(7); doc.setTextColor(120, 130, 145);
      doc.text("ORIGINAL", mx + 1, y + 2.4);
      doc.text("ARQUIVO", mx + subW + 1, y + 2.4);
      doc.text("DIFERENCA", mx + 2 * subW + 1, y + 2.4);
      y += 3.5;
      if (s.img) { try { doc.addImage(s.img, "PNG", mx, y, mw, ih); } catch (e) {} }
      doc.setDrawColor(210, 216, 224); doc.setLineWidth(0.2); doc.rect(mx, y, mw, ih);
      y += ih + 6;
    }
    if ((data.total || 0) > shots.length) {
      doc.setFontSize(8); doc.setTextColor(GREYT[0], GREYT[1], GREYT[2]);
      doc.text("+ " + ((data.total) - shots.length) + " divergencia(s) adicional(is) nao ilustrada(s).", M, y);
      y += 6;
    }

    // ---- IGNORADAS: o que o operador tirou da conferencia (rastreabilidade) ----
    var igItems = data.ignoredItems || [];
    if (igItems.length) {
      if (y + 22 > PH - 14) { doc.addPage(); y = M + 4; }
      y += 4;
      doc.setFillColor(243, 245, 248);
      doc.rect(M, y - 4, PW - 2 * M, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(60, 70, 85);
      doc.text("Ignoradas na conferencia (" + igItems.length + ")", M + 2, y);
      y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      for (var gi = 0; gi < igItems.length; gi++) {
        if (y > PH - 14) { doc.addPage(); y = M + 4; }
        var it = igItems[gi];
        doc.setTextColor(150, 158, 168);
        doc.text("x", M + 1, y);
        doc.setTextColor(90, 100, 115);
        // 1 linha SEMPRE (maxWidth quebrava em 2 linhas e encavalava com a de baixo)
        doc.text(fitTxt(it.desc + "   ·   " + it.pos + " (" + it.dims + ")   ·   " + it.motivo, PW - 2 * M - 6), M + 5, y);
        y += 4.4;
      }
      y += 2;
    }

    // ---- rodape ----
    var pages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7.5); doc.setTextColor(160, 168, 178);
      doc.text("Gerado por Alpha Compare  -  " + data.dateStr, M, PH - 8);
      doc.text(p + "/" + pages, PW - M, PH - 8, { align: "right" });
    }

    // ---- grava: _reference do JOB (cria se preciso); fallback Desktop ----
    try {
      var fs = require("fs"), path = require("path");
      var fname = "Conferencia_" + safeName(data.os || "OS") + "_" + safeName(data.stamp || "") + ".pdf";
      var ab = doc.output("arraybuffer"), buf = Buffer.from(ab);
      if (data.reportDir) {
        try {
          if (!fs.existsSync(data.reportDir)) fs.mkdirSync(data.reportDir, { recursive: true });
          var fullRef = path.join(data.reportDir, fname);
          fs.writeFileSync(fullRef, buf);
          return { ok: true, path: fullRef, where: "reference" };
        } catch (eRef) { /* rede indisponível -> cai pro Desktop */ }
      }
      var full = path.join(data.desktopPath, fname);
      fs.writeFileSync(full, buf);
      return { ok: true, path: full, where: "Desktop" };
    } catch (e) {
      return { ok: false, msg: String(e) };
    }
  }

  root.ACReport = { generate: generate };

})(window);

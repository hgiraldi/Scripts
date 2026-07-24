/* ============================================================
 * Ondulado - Relatorio de Verificacao de Codigos
 * ------------------------------------------------------------
 * O JSX (15_Relatorio_Codigos.jsx, na rede) captura os codigos SELECIONADOS
 * em PNG de alta resolucao e grava um manifest.json. Aqui no painel (Node +
 * Chromium) a gente:
 *   1. le o manifest e as imagens;
 *   2. DECODIFICA cada codigo (ZXing p/ EAN/ITF/Code128 + jsQR p/ QR),
 *      tentando rotacoes e negativo;
 *   3. confere o digito verificador (GTIN mod 10);
 *   4. monta o laudo em PDF (jsPDF) com a identidade Alpha;
 *   5. grava em <Engine>/_Jobfolder/<O.S.>/_pdf/ (irma da pasta reference).
 *
 * NAO usa modal nenhum (o CEP trava): tudo volta por callback -> banner.
 * ============================================================ */
window.AlphaCodigos = (function () {
  "use strict";

  var A4W = 210, A4H = 297;
  var COR = {
    navy:   [20, 43, 83],
    navy2:  [33, 64, 122],
    rosa:   [241, 0, 102],
    tinta:  [31, 42, 68],
    fraco:  [107, 114, 128],
    linha:  [223, 229, 240],
    faixa:  [242, 245, 250],
    verde:  [22, 163, 74],
    verdeE: [232, 247, 237],
    vermelho: [200, 30, 45],
    vermelhoE: [253, 236, 236],
    branco: [255, 255, 255]
  };

  /* ---------------- infra ---------------- */

  function fs()   { return require("fs"); }
  function pathM(){ return require("path"); }

  function lerJson(caminho) {
    var txt = fs().readFileSync(caminho, "utf8").replace(/^﻿/, "");
    return JSON.parse(txt);
  }

  function dataUrlDoArquivo(caminho, mime) {
    var b = fs().readFileSync(caminho);
    return "data:" + (mime || "image/png") + ";base64," + b.toString("base64");
  }

  function carregarImagem(dataUrl) {
    return new Promise(function (ok, falha) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { falha(new Error("imagem inválida")); };
      img.src = dataUrl;
    });
  }

  function canvasDaImagem(img) {
    var c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    var g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0);
    return c;
  }

  function canvasGirado(src, graus) {
    if (!graus) return src;
    var c = document.createElement("canvas");
    var trocaEixo = (graus === 90 || graus === 270);
    c.width  = trocaEixo ? src.height : src.width;
    c.height = trocaEixo ? src.width  : src.height;
    var g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.translate(c.width / 2, c.height / 2);
    g.rotate(graus * Math.PI / 180);
    g.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }

  function canvasInvertido(src) {
    var c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    var g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    var d = g.getImageData(0, 0, c.width, c.height);
    var p = d.data, i;
    for (i = 0; i < p.length; i += 4) {
      p[i] = 255 - p[i]; p[i + 1] = 255 - p[i + 1]; p[i + 2] = 255 - p[i + 2];
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  // reduz a imagem p/ embutir no PDF sem inchar o arquivo
  function canvasReduzido(src, maxPx) {
    var maior = Math.max(src.width, src.height);
    if (maior <= maxPx) return src;
    var f = maxPx / maior;
    var c = document.createElement("canvas");
    c.width = Math.round(src.width * f);
    c.height = Math.round(src.height * f);
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /* ---------------- decodificacao ---------------- */

  function formatosZX() {
    var F = ZXing.BarcodeFormat;
    var pedidos = [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.CODE_128, F.CODE_39,
                   F.CODABAR, F.QR_CODE, F.DATA_MATRIX];
    var out = [], i;
    for (i = 0; i < pedidos.length; i++) if (typeof pedidos[i] !== "undefined") out.push(pedidos[i]);
    return out;
  }

  function zxDecodificar(canvas) {
    var leitor = null;
    try {
      var hints = new Map();
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formatosZX());
      leitor = new ZXing.MultiFormatReader();
      leitor.setHints(hints);
      var fonte = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      var bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(fonte));
      var r = leitor.decode(bitmap);
      return { texto: r.getText(), formato: ZXing.BarcodeFormat[r.getBarcodeFormat()] };
    } catch (e) {
      return null;
    } finally {
      try { if (leitor) leitor.reset(); } catch (e2) {}
    }
  }

  function qrDecodificar(canvas) {
    try {
      if (typeof jsQR !== "function") return null;
      var g = canvas.getContext("2d");
      var d = g.getImageData(0, 0, canvas.width, canvas.height);
      var r = jsQR(d.data, d.width, d.height, { inversionAttempts: "attemptBoth" });
      if (r && r.data) return { texto: r.data, formato: "QR_CODE" };
    } catch (e) {}
    return null;
  }

  // tenta QR e 1D, em 4 rotacoes e tambem em negativo
  function decodificarCanvas(base) {
    var giros = [0, 90, 180, 270], i;
    var variantes = [];
    for (i = 0; i < giros.length; i++) variantes.push({ cv: canvasGirado(base, giros[i]), giro: giros[i], neg: false });

    var v, r;
    for (i = 0; i < variantes.length; i++) {
      v = variantes[i];
      r = qrDecodificar(v.cv);
      if (r) return { texto: r.texto, formato: r.formato, giro: v.giro, negativo: false };
      r = zxDecodificar(v.cv);
      if (r) return { texto: r.texto, formato: r.formato, giro: v.giro, negativo: false };
    }
    // negativo (codigo claro sobre fundo escuro)
    for (i = 0; i < variantes.length; i++) {
      v = variantes[i];
      var neg = canvasInvertido(v.cv);
      r = qrDecodificar(neg);
      if (r) return { texto: r.texto, formato: r.formato, giro: v.giro, negativo: true };
      r = zxDecodificar(neg);
      if (r) return { texto: r.texto, formato: r.formato, giro: v.giro, negativo: true };
    }
    return null;
  }

  /* ---------------- regras dos codigos ---------------- */

  var NOME_FORMATO = {
    EAN_13: "EAN-13 (código de barras de produto)",
    EAN_8: "EAN-8 (código de barras de produto)",
    UPC_A: "UPC-A",
    UPC_E: "UPC-E",
    ITF: "ITF-14 / DUN-14 (Interleaved 2 of 5)",
    CODE_128: "Code 128 / GS1-128",
    CODE_39: "Code 39",
    CODABAR: "Codabar",
    QR_CODE: "QR Code",
    DATA_MATRIX: "Data Matrix"
  };

  function nomeFormato(f, texto) {
    if (f === "ITF") {
      var n = String(texto || "").replace(/[^0-9]/g, "").length;
      if (n === 14) return "ITF-14 / DUN-14 (Interleaved 2 of 5)";
      return "ITF (Interleaved 2 of 5) — " + n + " dígitos";
    }
    return NOME_FORMATO[f] || String(f || "—");
  }

  // digito verificador GS1 (mod 10) — vale p/ EAN-13, EAN-8, UPC-A e GTIN-14 (ITF-14)
  function digitoGtin(num) {
    var d = String(num).replace(/[^0-9]/g, "");
    if (!(d.length === 8 || d.length === 12 || d.length === 13 || d.length === 14)) return null;
    var corpo = d.substring(0, d.length - 1);
    var verif = parseInt(d.charAt(d.length - 1), 10);
    var soma = 0, peso = 3, i;
    for (i = corpo.length - 1; i >= 0; i--) {
      soma += parseInt(corpo.charAt(i), 10) * peso;
      peso = (peso === 3) ? 1 : 3;
    }
    var calc = (10 - (soma % 10)) % 10;
    return { valido: (calc === verif), calculado: calc, informado: verif };
  }

  // agrupa o GTIN pra leitura humana (1 7891150 09348 9)
  function formatarGtin(num) {
    var d = String(num).replace(/[^0-9]/g, "");
    if (d.length === 14) return d.charAt(0) + " " + d.substring(1, 8) + " " + d.substring(8, 13) + " " + d.charAt(13);
    if (d.length === 13) return d.charAt(0) + " " + d.substring(1, 7) + " " + d.substring(7, 12) + " " + d.charAt(12);
    return d;
  }

  function ehNumerico(f) {
    return (f === "EAN_13" || f === "EAN_8" || f === "UPC_A" || f === "ITF");
  }

  /* ---------------- PDF ---------------- */

  // base do nome = cp_rev_v (produto). Prefere os campos cp/rev/v; se faltarem, usa
  // produtoComUnderline (que ja e cp_rev_v...). Sanitiza p/ nome de arquivo.
  function nomeArquivo(dados) {
    function limpa(s) { return String(s || "").replace(/[\\\/:*?"<>|]/g, "").replace(/\s+/g, ""); }
    var partes = [];
    if (dados.cp)  partes.push(limpa(dados.cp));
    if (dados.rev) partes.push(limpa(dados.rev));
    if (dados.v)   partes.push(limpa(dados.v));
    var base = partes.join("_");
    if (!base && dados.produtoComUnderline) {
      // pega os 3 primeiros segmentos (cp_rev_v) do produto
      base = limpa(dados.produtoComUnderline).split("_").slice(0, 3).join("_");
    }
    if (!base) base = "codigos";
    return base + "_verificacao_" + limpa(dados.os);
  }

  function novoPdf() {
    var J = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
    return new J({ orientation: "portrait", unit: "mm", format: "a4" });
  }

  function setFill(doc, c) { doc.setFillColor(c[0], c[1], c[2]); }
  function setText(doc, c) { doc.setTextColor(c[0], c[1], c[2]); }
  function setDraw(doc, c) { doc.setDrawColor(c[0], c[1], c[2]); }

  function cabecalho(doc, dados, logo) {
    setFill(doc, COR.navy);
    doc.rect(0, 0, A4W, 24, "F");
    setFill(doc, COR.rosa);
    doc.rect(0, 24, A4W, 1.2, "F");

    if (logo) {
      try { doc.addImage(logo.dataUrl, "PNG", 14, 4.5, logo.w, logo.h); } catch (e) {}
    }

    setText(doc, COR.branco);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("ALPHA CLICHERIA", A4W - 14, 11, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Controle de qualidade de pré-impressão", A4W - 14, 16.5, { align: "right" });
    doc.setFontSize(7.5);
    doc.text("O.S. " + dados.os, A4W - 14, 21, { align: "right" });
  }

  function rodape(doc, dados, pagina, total) {
    setDraw(doc, COR.linha);
    doc.setLineWidth(0.2);
    doc.line(14, 283, A4W - 14, 283);
    setText(doc, COR.fraco);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text("Alpha Clicheria · Controle de qualidade de pré-impressão", 14, 288);
    doc.text("Emitido em " + dados.dataHora + " · Página " + pagina + " de " + total, A4W - 14, 288, { align: "right" });
  }

  function tituloSecao(doc, texto, y) {
    setText(doc, COR.navy);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.text(texto, 14, y);
    setDraw(doc, COR.rosa);
    doc.setLineWidth(0.6);
    doc.line(14, y + 1.6, 14 + doc.getTextWidth(texto), y + 1.6);
    return y + 7;
  }

  // linha de tabela rotulo/valor com quebra automatica
  function linhaTabela(doc, rotulo, valor, y, larguraRotulo) {
    var lr = larguraRotulo || 42;
    var lv = A4W - 28 - lr;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    var linhas = doc.splitTextToSize(String(valor === undefined || valor === null || valor === "" ? "—" : valor), lv - 6);
    var alt = Math.max(7.5, linhas.length * 4.2 + 3.2);

    setFill(doc, COR.faixa);
    doc.rect(14, y, lr, alt, "F");
    setDraw(doc, COR.linha);
    doc.setLineWidth(0.2);
    doc.rect(14, y, lr, alt);
    doc.rect(14 + lr, y, lv, alt);

    setText(doc, COR.navy2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text(rotulo, 17, y + 5.2);

    setText(doc, COR.tinta);
    doc.setFont("helvetica", "normal");
    doc.text(linhas, 17 + lr, y + 5.2);
    return y + alt;
  }

  /* ---------------- fluxo principal ---------------- */

  /**
   * manifestPath : caminho do manifest.json gerado pelo JSX
   * onStatus(txt): progresso (opcional)
   * retorna Promise -> { arquivo, total, lidos, aprovado, aviso }
   */
  function gerar(manifestPath, onStatus) {
    function passo(t) { try { if (onStatus) onStatus(t); } catch (e) {} }

    return Promise.resolve().then(function () {
      var dados = lerJson(manifestPath);
      if (!dados.codigos || !dados.codigos.length) throw new Error("Nenhum código capturado.");

      // ---- 1) decodificar todos ----
      var resultados = [];
      var seq = Promise.resolve();
      dados.codigos.forEach(function (cod, idx) {
        seq = seq.then(function () {
          passo("Lendo código " + (idx + 1) + " de " + dados.codigos.length + "…");
          return carregarImagem(dataUrlDoArquivo(cod.arquivo)).then(function (img) {
            var base = canvasDaImagem(img);
            var lido = decodificarCanvas(base);
            var mini = canvasReduzido(base, 900);
            resultados.push({
              nome: cod.nome,
              larguraMM: cod.larguraMM,
              alturaMM: cod.alturaMM,
              dpi: cod.dpi,
              imagem: mini.toDataURL("image/png"),
              imgW: mini.width,
              imgH: mini.height,
              lido: lido
            });
          });
        });
      });

      return seq.then(function () {
        passo("Montando o relatório…");
        return montarPdf(dados, resultados);
      });
    });
  }

  function montarPdf(dados, resultados) {
    // logo do painel (PNG branco) p/ o cabecalho
    return lerLogo().then(function (logo) {
      var doc = novoPdf();
      var i;

      var totalLidos = 0;
      for (i = 0; i < resultados.length; i++) if (resultados[i].lido) totalLidos++;
      var reprovados = [];
      for (i = 0; i < resultados.length; i++) {
        var r = resultados[i];
        if (!r.lido) { reprovados.push(i + 1); continue; }
        if (ehNumerico(r.lido.formato)) {
          var dv = digitoGtin(r.lido.texto);
          if (dv && !dv.valido) reprovados.push(i + 1);
        }
      }
      var aprovado = (reprovados.length === 0);

      cabecalho(doc, dados, logo);

      var y = 36;
      setText(doc, COR.navy);
      doc.setFont("helvetica", "bold"); doc.setFontSize(15.5);
      doc.text("Relatório de Verificação de Códigos", 14, y);
      y += 6;
      setText(doc, COR.fraco);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      var sub = doc.splitTextToSize(
        "Conferência de leitura dos códigos de barras e QR Code do arquivo de pré-impressão. " +
        "Cada código foi capturado direto da arte e decodificado por software; o dígito verificador foi conferido.",
        A4W - 28);
      doc.text(sub, 14, y);
      y += sub.length * 4.2 + 5;

      // ---- identificacao ----
      y = tituloSecao(doc, "Identificação", y);
      y = linhaTabela(doc, "Cliente", dados.cliente, y);
      y = linhaTabela(doc, "Produto", dados.produto, y);
      y = linhaTabela(doc, "Arte", dados.nomeArte, y);
      y = linhaTabela(doc, "Ordem de Serviço", dados.os, y);
      y = linhaTabela(doc, "Arquivo conferido", dados.documento, y);
      y = linhaTabela(doc, "Data da análise", dados.dataHora, y);
      y = linhaTabela(doc, "Método",
        "Captura em alta resolução dos códigos selecionados no arquivo do Illustrator e decodificação " +
        "por software (ZXing / jsQR), com tentativa em todas as rotações e em negativo. " +
        "Dígito verificador conferido pelo cálculo GS1 (módulo 10).", y);
      y += 8;

      // ---- codigos ----
      y = tituloSecao(doc, "Códigos verificados", y);

      for (i = 0; i < resultados.length; i++) {
        y = cartaoCodigo(doc, dados, resultados[i], i + 1, y, logo);
      }

      // ---- resultado ----
      if (y > 240) { doc.addPage(); cabecalho(doc, dados, logo); y = 36; }
      y += 2;
      var alturaBox = 22;
      setFill(doc, aprovado ? COR.verde : COR.vermelho);
      doc.rect(14, y, A4W - 28, alturaBox, "F");
      setText(doc, COR.branco);
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text(aprovado ? "RESULTADO: APROVADO" : "RESULTADO: REPROVADO", A4W / 2, y + 8.5, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      var msg = aprovado
        ? ("Todos os " + resultados.length + " código(s) apresentaram leitura íntegra" +
           (temGtin(resultados) ? " e dígito verificador válido." : "."))
        : ("Verificar o(s) código(s) " + reprovados.join(", ") + " — sem leitura ou com dígito verificador inválido.");
      var msgL = doc.splitTextToSize(msg, A4W - 44);
      doc.text(msgL, A4W / 2, y + 14.5, { align: "center" });
      y += alturaBox + 12;

      // ---- assinatura ---- (só quebra pra outra página se realmente não couber)
      if (y + 12 > 281) { doc.addPage(); cabecalho(doc, dados, logo); y = 44; }
      setDraw(doc, COR.tinta);
      doc.setLineWidth(0.3);
      doc.line(A4W / 2 - 40, y, A4W / 2 + 40, y);
      setText(doc, COR.tinta);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("Conferido por " + (dados.operador ? dados.operador : "________________"), A4W / 2, y + 5, { align: "center" });
      setText(doc, COR.fraco);
      doc.setFontSize(7.5);
      doc.text("Responsável pela conferência", A4W / 2, y + 9.5, { align: "center" });

      // ---- rodape em todas as paginas ----
      var total = doc.internal.getNumberOfPages(), p;
      for (p = 1; p <= total; p++) { doc.setPage(p); rodape(doc, dados, p, total); }

      // ---- gravar ----
      // <cp>_<rev>_<v>_verificacao_<os>.pdf : SEM hora de proposito -> regerar SUBSTITUI
      // o anterior (mesmo job/rev/versao = mesmo arquivo). Base = produto (cp_rev_v).
      var nome = nomeArquivo(dados) + ".pdf";
      var pasta = dados.pastaPdf;
      var aviso = "";
      if (!pasta) {
        pasta = pathM().join(require("os").homedir(), "Desktop");
        aviso = "pasta _pdf do job não encontrada — salvo no Desktop";
      }
      var destino = pathM().join(pasta, nome);
      var bytes = doc.output("arraybuffer");
      try {
        fs().writeFileSync(destino, Buffer.from(new Uint8Array(bytes)));
      } catch (e) {
        var alt = pathM().join(require("os").homedir(), "Desktop", nome);
        fs().writeFileSync(alt, Buffer.from(new Uint8Array(bytes)));
        destino = alt;
        aviso = "sem permissão de gravação no job — salvo no Desktop";
      }

      return {
        arquivo: destino,
        nome: nome,
        total: resultados.length,
        lidos: totalLidos,
        aprovado: aprovado,
        aviso: aviso
      };
    });
  }

  function temGtin(resultados) {
    for (var i = 0; i < resultados.length; i++) {
      if (resultados[i].lido && ehNumerico(resultados[i].lido.formato)) return true;
    }
    return false;
  }

  // cartao de um codigo: imagem a esquerda, dados a direita
  function cartaoCodigo(doc, dados, r, num, y, logo) {
    var largura = A4W - 28;
    var imgLarg = 72;
    var imgAlt = Math.min(30, imgLarg * (r.imgH / r.imgW));
    if (imgAlt < 12) imgAlt = Math.min(30, Math.max(12, imgLarg * (r.imgH / r.imgW)));
    var imgLargFinal = imgLarg;
    if (imgAlt >= 30) { imgAlt = 30; imgLargFinal = Math.min(imgLarg, imgAlt * (r.imgW / r.imgH)); }

    // texto da direita
    var xDir = 14 + imgLarg + 8;
    var largDir = largura - imgLarg - 10;

    var linhas = [];
    if (r.lido) {
      linhas.push(["Tipo", nomeFormato(r.lido.formato, r.lido.texto)]);
      var conteudo = r.lido.texto;
      if (ehNumerico(r.lido.formato)) {
        var fmt = formatarGtin(conteudo);
        linhas.push(["Conteúdo", (fmt !== conteudo ? fmt + "   =   " : "") + conteudo]);
        var dv = digitoGtin(conteudo);
        if (dv) linhas.push(["Dígito verificador", dv.valido ? "Confere (válido)" : ("NÃO CONFERE — calculado " + dv.calculado + ", informado " + dv.informado)]);
      } else {
        linhas.push(["Conteúdo", conteudo]);
      }
      linhas.push(["Leitura", "APROVADO — decodificado sem erro" + (r.lido.giro ? " (código a " + r.lido.giro + "°)" : "")]);
    } else {
      linhas.push(["Tipo", "não identificado"]);
      linhas.push(["Conteúdo", "—"]);
      linhas.push(["Leitura", "NÃO LIDO — o software não decodificou este código"]);
    }
    linhas.push(["Dimensão na arte", r.larguraMM + " x " + r.alturaMM + " mm  ·  captura " + r.dpi + " dpi"]);

    // altura do bloco de texto
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    var alturaTexto = 0, i, quebras = [];
    for (i = 0; i < linhas.length; i++) {
      var q = doc.splitTextToSize(linhas[i][1], largDir - 34);
      quebras.push(q);
      alturaTexto += Math.max(4.6, q.length * 4.0 + 0.8);
    }
    var alturaCorpo = Math.max(imgAlt + 8, alturaTexto + 7);
    var alturaCartao = 7 + alturaCorpo;

    // cabe na pagina?
    if (y + alturaCartao > 272) {
      doc.addPage();
      cabecalho(doc, dados, logo);
      y = 36;
    }

    // moldura
    setDraw(doc, COR.linha);
    doc.setLineWidth(0.3);
    doc.rect(14, y, largura, alturaCartao);
    setFill(doc, COR.navy);
    doc.rect(14, y, largura, 7, "F");
    setText(doc, COR.branco);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text("CÓDIGO " + num + (r.nome ? "  ·  " + r.nome : ""), 17, y + 4.8);
    var etiqueta = r.lido ? "LIDO" : "NÃO LIDO";
    setText(doc, r.lido ? [190, 240, 205] : [255, 200, 200]);
    doc.text(etiqueta, A4W - 17, y + 4.8, { align: "right" });

    // imagem
    var yCorpo = y + 7;
    setFill(doc, COR.branco);
    doc.rect(17, yCorpo + 4, imgLarg, imgAlt + 0.001, "F");
    try {
      doc.addImage(r.imagem, "PNG", 17 + (imgLarg - imgLargFinal) / 2, yCorpo + 4, imgLargFinal, imgAlt);
    } catch (e) {}
    setDraw(doc, COR.linha);
    doc.setLineWidth(0.2);
    doc.rect(17 + (imgLarg - imgLargFinal) / 2, yCorpo + 4, imgLargFinal, imgAlt);

    // dados
    var yy = yCorpo + 5.5;
    for (i = 0; i < linhas.length; i++) {
      setText(doc, COR.fraco);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.text(String(linhas[i][0]).toUpperCase(), xDir, yy);
      var ehLeitura = (linhas[i][0] === "Leitura");
      var ehDv = (linhas[i][0] === "Dígito verificador");
      var ruim = (ehLeitura && !r.lido) || (ehDv && /NÃO CONFERE/.test(linhas[i][1]));
      var bom = (ehLeitura && r.lido) || (ehDv && /Confere/.test(linhas[i][1]));
      setText(doc, ruim ? COR.vermelho : (bom ? COR.verde : COR.tinta));
      doc.setFont("helvetica", (ruim || bom) ? "bold" : "normal");
      doc.setFontSize(8);
      doc.text(quebras[i], xDir + 32, yy);
      yy += Math.max(4.6, quebras[i].length * 4.0 + 0.8);
    }

    return y + alturaCartao + 5;
  }

  // logo do painel -> dataURL BRANCO SÓLIDO (para o cabecalho navy). Pinta de branco
  // todos os pixels não-transparentes (mantém o alfa) -> contraste máximo no navy.
  function lerLogo() {
    return new Promise(function (ok) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "./img/logo_alpha.png", true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
          try {
            var b = new Uint8Array(xhr.response), s = "", i;
            for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
            var url = "data:image/png;base64," + btoa(s);
            var img = new Image();
            img.onload = function () {
              try {
                var c = document.createElement("canvas");
                c.width = img.naturalWidth || img.width;
                c.height = img.naturalHeight || img.height;
                var g = c.getContext("2d");
                g.drawImage(img, 0, 0);
                var d = g.getImageData(0, 0, c.width, c.height), p = d.data, j;
                for (j = 0; j < p.length; j += 4) {
                  if (p[j + 3] > 8) { p[j] = 255; p[j + 1] = 255; p[j + 2] = 255; } // branco, alfa mantido
                }
                g.putImageData(d, 0, 0);
                var h = 15, w = h * (c.width / c.height);
                ok({ dataUrl: c.toDataURL("image/png"), w: w, h: h });
              } catch (e2) {
                var h2 = 15, w2 = h2 * (img.width / img.height);
                ok({ dataUrl: url, w: w2, h: h2 }); // fallback: logo original
              }
            };
            img.onerror = function () { ok(null); };
            img.src = url;
          } catch (e) { ok(null); }
        };
        xhr.onerror = function () { ok(null); };
        xhr.send();
      } catch (e) { ok(null); }
    });
  }

  return { gerar: gerar };
})();

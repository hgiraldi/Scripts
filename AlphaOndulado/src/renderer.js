// Alpha Ondulado - renderer (orquestra a UI).
(function () {
  "use strict";

  var electron = require("electron");
  var ipc = electron.ipcRenderer;
  var fs = require("fs");
  var custo = require("./custo");
  var relatorio = require("./relatorio");
  var grupos = require("./pdf_grupos");
  var ai = require("./ai_grupos");

  var GAP_FALLBACK_MM = 4;

  // ---- estado do NOVO orcamento ----
  var novo = { bytes: null, nomePdf: "", analise: null, fonte: null, savedId: null, reextraindo: false };
  // ---- estado do EDITOR (dentro de Orcamentos) ----
  var ed = null; // { id, nomeArquivo, cliente, espessura, tipo, arranjo, fator, analise, preview, fonte }
  var _indexCache = [];

  function $(id) { return document.getElementById(id); }
  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

  var _toastT = null;
  function toast(msg, erro) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (erro ? " erro" : "");
    if (_toastT) clearTimeout(_toastT);
    _toastT = setTimeout(function () { t.className = "toast"; }, 3400);
  }
  function status(msg) { $("statusExtr").textContent = msg || ""; }

  function dataHoje() {
    var d = new Date();
    function z(n) { return n < 10 ? "0" + n : "" + n; }
    return z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // normaliza p/ busca: minusculo + sem acento
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[áàâãä]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìîï]/g, "i")
      .replace(/[óòôõö]/g, "o").replace(/[úùûü]/g, "u").replace(/ç/g, "c");
  }

  // ================= NAVEGACAO =================
  function irPara(tela) {
    var itens = document.querySelectorAll(".navitem");
    for (var i = 0; i < itens.length; i++) {
      itens[i].classList.toggle("active", itens[i].getAttribute("data-tela") === tela);
    }
    $("telaNovo").classList.toggle("hide", tela !== "novo");
    $("telaSalvos").classList.toggle("hide", tela !== "salvos");
    if (tela === "salvos") { mostrarLista(); carregarLista(); }
  }
  (function () {
    var itens = document.querySelectorAll(".navitem");
    for (var i = 0; i < itens.length; i++) {
      itens[i].addEventListener("click", function () { irPara(this.getAttribute("data-tela")); });
    }
  })();

  /* ==========================================================================
     NOVO ORÇAMENTO
     ========================================================================== */
  on("btnPdf", "click", function () {
    ipc.invoke("open-pdf").then(function (r) {
      if (!r) return;
      try {
        var buf = fs.readFileSync(r.path);
        novo.bytes = new Uint8Array(buf);
        novo.nomePdf = r.name;
        novo.savedId = null; // arquivo novo => proximo Salvar cria registro novo
        $("pdfNome").textContent = r.name;
        extrair();
      } catch (e) { toast("Erro ao ler o arquivo: " + e.message, true); }
    });
  });

  function extrair() {
    if (!novo.bytes || novo.reextraindo) return;
    novo.reextraindo = true;
    status("Lendo os grupos do Illustrator…");

    var c1 = new Uint8Array(novo.bytes.length); c1.set(novo.bytes);
    var c2 = new Uint8Array(novo.bytes.length); c2.set(novo.bytes);

    var aiRes = null;
    try { aiRes = ai.lerGruposAI(c1); } catch (e) { aiRes = { ok: false, motivo: "erro:" + e.message }; }
    c1 = null;

    if (aiRes && aiRes.ok && aiRes.cores.length) {
      novo.fonte = "ai";
      status("Grupos do Illustrator: " + aiRes.nCores + " cores · " + aiRes.nGruposTotal + " grupos");
      grupos.renderPaginaUm(c2, 1400).then(function (pv) {
        finalizar(aiRes, pv ? pv.previewDataUrl : "");
      }).catch(function () { finalizar(aiRes, ""); });
    } else {
      status("O PDF não traz os grupos do Illustrator — usando agrupamento espacial…");
      grupos.analisarPdf(c2, { gapMM: GAP_FALLBACK_MM }, function (m) { status(m); })
        .then(function (res) {
          novo.fonte = "spatial";
          if (res.temImagem) toast("Atenção: o PDF contém imagem — cor de imagem não vira placa confiável.", true);
          finalizar(res, res.previewDataUrl);
        })
        .catch(function (e) {
          novo.reextraindo = false; status("");
          toast("Falha ao analisar o PDF: " + e.message, true);
          if (window.console) console.error(e);
        });
    }
  }

  function finalizar(res, previewUrl) {
    res.previewDataUrl = previewUrl || "";
    novo.analise = res;
    novo.reextraindo = false;
    renderBadge($("fonteBadge"), novo.fonte);
    renderPreview($("previewWrap"), res.previewDataUrl);
    renderCoresEdit($("tabelaCores"), res.cores);
    recalc();
  }

  function tipoSel(name) {
    var r = document.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < r.length; i++) if (r[i].checked) return r[i].value;
    return "";
  }
  function setTipo(name, v) {
    var r = document.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < r.length; i++) r[i].checked = (r[i].value === v);
  }

  function job() {
    return {
      cliente: $("cliente").value.replace(/^\s+|\s+$/g, ""),
      espessura: $("espessura").value,
      tipo: tipoSel("tipo"),
      arranjo: $("arranjo").value,
      fator: $("fator").value
    };
  }

  function recalc() {
    var j = job();
    var calc = custo.calcular(novo.analise || { cores: [] }, j);
    $("rArea").textContent = custo.num(calc.totalCm2, 2) + " cm²";
    $("rGrupos").textContent = novo.analise ? (novo.analise.nGruposTotal + " · " + novo.analise.nCores) : "—";
    $("rArranjo").textContent = calc.arranjo.txt ? (calc.arranjo.txt + " = " + calc.arranjo.mult) : "—";
    $("rTotal").textContent = custo.brl(calc.preco);
    $("faltando").textContent = calc.faltando.length ? ("Falta: " + calc.faltando.join(", ") + ".") : "";
    $("btnLaudo").disabled = !calc.ok;
    $("btnSalvar").disabled = !(novo.analise && novo.analise.cores.length && j.cliente);
    return calc;
  }

  ["cliente", "espessura", "arranjo", "fator"].forEach(function (id) {
    on(id, "input", recalc); on(id, "change", recalc);
  });
  on("tipoWrap", "change", recalc);

  // registro enxuto a partir de uma analise + job
  function montarRegistro(id, nomeArquivo, analise, fonte, j, calc) {
    var coresLite = [], cs = (analise && analise.cores) || [];
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], gl = [];
      for (var g = 0; g < c.grupos.length; g++) {
        gl.push({ wCM: c.grupos[g].wCM, hCM: c.grupos[g].hCM, areaCm2: c.grupos[g].areaCm2, layer: c.grupos[g].layer || "" });
      }
      coresLite.push({ nome: c.nome, rgbCss: c.rgbCss || "", nGrupos: c.nGrupos, areaCm2: c.areaCm2, grupos: gl });
    }
    return {
      id: id, nomeArquivo: nomeArquivo || "orcamento",
      cliente: j.cliente, espessura: j.espessura, tipo: j.tipo,
      arranjo: j.arranjo, fator: custo.num0(j.fator),
      totalCm2: calc.totalCm2, preco: calc.preco, data: dataHoje(), fonte: fonte,
      analise: {
        cores: coresLite, totalCm2: analise.totalCm2,
        nGruposTotal: analise.nGruposTotal, nCores: analise.nCores,
        previewDataUrl: analise.previewDataUrl || ""
      }
    };
  }

  on("btnSalvar", "click", function () {
    var calc = recalc();
    if (!(novo.analise && $("cliente").value)) { toast("Carregue um PDF e preencha o cliente.", true); return; }
    var rec = montarRegistro(novo.savedId, novo.nomePdf, novo.analise, novo.fonte, job(), calc);
    ipc.invoke("salvar-orcamento", rec).then(function (r) {
      if (r && r.ok) { novo.savedId = r.id; toast("Orçamento salvo."); }
      else toast("Erro ao salvar: " + ((r && r.error) || "?"), true);
    });
  });

  on("btnLaudo", "click", function () {
    var calc = recalc();
    if (!calc.ok) { toast("Preencha os campos que faltam.", true); return; }
    gerarPdf(novo.nomePdf, job(), novo.analise, calc, $("btnLaudo"));
  });

  /* ==========================================================================
     ORÇAMENTOS (lista + busca + editor na mesma tela)
     ========================================================================== */
  function mostrarLista() { $("salvosLista").classList.remove("hide"); $("salvosEditor").classList.add("hide"); }
  function mostrarEditor() { $("salvosLista").classList.add("hide"); $("salvosEditor").classList.remove("hide"); }

  function carregarLista() {
    ipc.invoke("listar-orcamentos").then(function (lista) {
      _indexCache = lista || [];
      pintarLista();
    });
  }

  function pintarLista() {
    var q = norm($("busca").value);
    var tokens = q.split(/\s+/).filter(Boolean);
    var lista = _indexCache.filter(function (m) {
      if (!tokens.length) return true;
      var alvo = norm((m.cliente || "") + " " + (m.nomeArquivo || ""));
      for (var i = 0; i < tokens.length; i++) if (alvo.indexOf(tokens[i]) < 0) return false;
      return true;
    });
    var box = $("listaSalvos");
    box.innerHTML = "";
    $("buscaInfo").textContent = _indexCache.length
      ? (lista.length + " de " + _indexCache.length + " orçamento" + (_indexCache.length === 1 ? "" : "s"))
      : "";
    if (!lista.length) {
      box.innerHTML = '<div class="vazio2">' + (_indexCache.length ? "Nada encontrado para a busca." : "Nenhum orçamento salvo ainda.") + '</div>';
      return;
    }
    for (var i = 0; i < lista.length; i++) box.appendChild(linhaSalvo(lista[i]));
  }
  on("busca", "input", pintarLista);

  function linhaSalvo(m) {
    var row = document.createElement("div");
    row.className = "orow";
    var esq = document.createElement("div");
    esq.className = "oesq";
    esq.innerHTML = '<div class="oarq">' + esc(m.nomeArquivo || "—") + '</div>' +
      '<div class="ometa">' + esc(m.cliente || "—") + ' · ' + esc(custo.tipoLabel(m.tipo)) +
      ' · ' + (m.espessura ? custo.num(parseFloat(m.espessura), 2) + ' mm' : '—') +
      (m.arranjo ? ' · ' + esc(m.arranjo) : '') + ' · ' + esc(m.data || "") + '</div>';
    esq.style.cursor = "pointer";
    esq.addEventListener("click", function () { abrirEditor(m.id); });

    var val = document.createElement("div");
    val.innerHTML = '<div class="opreco">' + custo.brl(m.preco || 0) + '</div>' +
      '<div class="ofator">' + custo.num(m.totalCm2 || 0, 0) + ' cm² × ' + custo.brl(m.fator || 0) + '</div>';

    var acoes = document.createElement("div");
    acoes.className = "oacoes";
    var bEdit = botao("btn ghost", "Editar", function () { abrirEditor(m.id); });
    var bDel = botao("btn danger", "Excluir", function () { excluirSalvo(m.id, m.nomeArquivo); });
    acoes.appendChild(bEdit); acoes.appendChild(bDel);

    row.appendChild(esq); row.appendChild(val); row.appendChild(acoes);
    return row;
  }
  function botao(cls, txt, fn) { var b = document.createElement("button"); b.className = cls; b.textContent = txt; b.addEventListener("click", fn); return b; }

  function abrirEditor(id) {
    ipc.invoke("abrir-orcamento", id).then(function (r) {
      if (!r || !r.ok) { toast("Erro ao abrir: " + ((r && r.error) || "?"), true); return; }
      var rec = r.rec;
      ed = {
        id: rec.id, nomeArquivo: rec.nomeArquivo || "",
        cliente: rec.cliente || "", espessura: rec.espessura || "", tipo: rec.tipo || "",
        arranjo: rec.arranjo || "", fator: rec.fator, analise: rec.analise || { cores: [] }, fonte: rec.fonte || null
      };
      $("edTitulo").textContent = rec.nomeArquivo || "Editar orçamento";
      $("edCliente").value = ed.cliente;
      $("edEspessura").value = ed.espessura;
      setTipo("edtipo", ed.tipo);
      $("edArranjo").value = ed.arranjo;
      $("edFator").value = (ed.fator != null && ed.fator !== "") ? custo.num(ed.fator, 2) : "";
      renderBadge($("edBadge"), ed.fonte);
      renderPreview($("edPreview"), ed.analise.previewDataUrl);
      renderCoresChips($("edCores"), ed.analise.cores);
      recalcEd();
      mostrarEditor();
    });
  }

  function jobEd() {
    return {
      cliente: $("edCliente").value.replace(/^\s+|\s+$/g, ""),
      espessura: $("edEspessura").value,
      tipo: tipoSel("edtipo"),
      arranjo: $("edArranjo").value,
      fator: $("edFator").value
    };
  }
  function recalcEd() {
    if (!ed) return { ok: false };
    var calc = custo.calcular(ed.analise || { cores: [] }, jobEd());
    $("edArea").textContent = custo.num(calc.totalCm2, 2) + " cm²";
    $("edArranjoR").textContent = calc.arranjo.txt ? (calc.arranjo.txt + " = " + calc.arranjo.mult) : "—";
    $("edTotal").textContent = custo.brl(calc.preco);
    $("edFalta").textContent = calc.faltando.length ? ("Falta: " + calc.faltando.join(", ") + ".") : "";
    $("edGerar").disabled = !calc.ok;
    return calc;
  }
  ["edCliente", "edEspessura", "edArranjo", "edFator"].forEach(function (id) {
    on(id, "input", recalcEd); on(id, "change", recalcEd);
  });
  on("edTipoWrap", "change", recalcEd);

  on("edSalvar", "click", function () {
    if (!ed) return;
    var calc = recalcEd();
    var rec = montarRegistro(ed.id, ed.nomeArquivo, ed.analise, ed.fonte, jobEd(), calc);
    ipc.invoke("salvar-orcamento", rec).then(function (r) {
      if (r && r.ok) { toast("Alterações salvas."); carregarLista(); }
      else toast("Erro ao salvar: " + ((r && r.error) || "?"), true);
    });
  });

  on("edGerar", "click", function () {
    if (!ed) return;
    var calc = recalcEd();
    if (!calc.ok) { toast("Preencha os campos que faltam.", true); return; }
    // salva o estado atual antes de gerar (mantém o banco em dia)
    var rec = montarRegistro(ed.id, ed.nomeArquivo, ed.analise, ed.fonte, jobEd(), calc);
    ipc.invoke("salvar-orcamento", rec);
    gerarPdf(ed.nomeArquivo, jobEd(), ed.analise, calc, $("edGerar"));
  });

  on("edExcluir", "click", function () {
    if (!ed) return;
    excluirSalvo(ed.id, ed.nomeArquivo, function () { mostrarLista(); });
  });
  on("edVoltar", "click", function () { ed = null; mostrarLista(); carregarLista(); });

  function excluirSalvo(id, nome, aposFn) {
    if (!confirm("Excluir o orçamento \"" + (nome || id) + "\"?\nEsta ação não pode ser desfeita.")) return;
    ipc.invoke("excluir-orcamento", id).then(function (r) {
      if (r && r.ok) { toast("Orçamento excluído."); if (aposFn) aposFn(); carregarLista(); }
      else toast("Erro ao excluir.", true);
    });
  }

  /* ==========================================================================
     COMPARTILHADO: preview, badge, cores, gerar PDF
     ========================================================================== */
  function renderBadge(el, fonte) {
    if (fonte === "ai") { el.className = "badge ai"; el.textContent = "✓ Grupos lidos do Illustrator"; }
    else if (fonte === "spatial") { el.className = "badge spatial"; el.textContent = "⚠ Agrupamento espacial (folga " + GAP_FALLBACK_MM + " mm)"; }
    else { el.className = "badge hide"; }
  }

  function renderPreview(wrap, url) {
    if (url) { wrap.className = "previewwrap"; wrap.innerHTML = '<img src="' + url + '" alt="arte">'; }
    else { wrap.className = "previewwrap vazio"; wrap.innerHTML = '<span class="ph">Sem preview</span>'; }
  }

  // tabela editavel (Novo): nome editavel + grupos detalhados
  function renderCoresEdit(box, cores) {
    box.innerHTML = "";
    if (!cores || !cores.length) { box.innerHTML = '<div class="vazio2">Nenhum grupo de cor encontrado neste PDF.</div>'; return; }
    for (var i = 0; i < cores.length; i++) box.appendChild(cardCor(cores[i]));
  }
  function cardCor(cor) {
    var card = document.createElement("div"); card.className = "corcard";
    var head = document.createElement("div"); head.className = "chead";
    var dot = document.createElement("span"); dot.className = "dot"; dot.style.background = cor.rgbCss || "#888";
    var nome = document.createElement("input"); nome.className = "cnome"; nome.type = "text"; nome.value = cor.nome;
    nome.addEventListener("input", function () { cor.nome = nome.value; });
    var info = document.createElement("div"); info.className = "cinfo";
    info.innerHTML = "<b>" + custo.num(cor.areaCm2, 2) + " cm²</b>" + cor.nGrupos + " " + (cor.nGrupos === 1 ? "grupo" : "grupos");
    head.appendChild(dot); head.appendChild(nome); head.appendChild(info); card.appendChild(head);
    var gwrap = document.createElement("div"); gwrap.className = "grupos";
    for (var g = 0; g < cor.grupos.length; g++) {
      var gr = cor.grupos[g], row = document.createElement("div"); row.className = "grow";
      row.innerHTML = "<span>grupo " + (g + 1) + "</span><b>" + custo.num(gr.wCM, 1) + " × " + custo.num(gr.hCM, 1) + " cm · " + custo.num(gr.areaCm2, 2) + " cm²</b>";
      gwrap.appendChild(row);
    }
    card.appendChild(gwrap); return card;
  }

  // chips read-only (Editor)
  function renderCoresChips(box, cores) {
    box.innerHTML = "";
    if (!cores || !cores.length) { box.innerHTML = '<div class="vazio2">—</div>'; return; }
    var wrap = document.createElement("div"); wrap.className = "chips";
    for (var i = 0; i < cores.length; i++) {
      var c = cores[i], chip = document.createElement("span"); chip.className = "chip";
      chip.innerHTML = '<span class="dot" style="background:' + esc(c.rgbCss || "#888") + '"></span>' + esc(c.nome) +
        ' <small>' + c.nGrupos + 'g · ' + custo.num(c.areaCm2, 0) + 'cm²</small>';
      wrap.appendChild(chip);
    }
    box.appendChild(wrap);
  }

  function gerarPdf(nomeArquivo, j, analise, calc, btn) {
    var html = relatorio.montarHtml({
      cliente: j.cliente, espessura: j.espessura, tipo: j.tipo, arranjo: j.arranjo,
      nomeArquivo: nomeArquivo, dataStr: dataHoje(),
      analise: analise, calc: calc, previewDataUrl: analise ? analise.previewDataUrl : ""
    });
    var base = (nomeArquivo || j.cliente || "orcamento").replace(/\.pdf$/i, "");
    var nomeArq = "orcamento_" + base.replace(/[^\w\-]+/g, "_") + ".pdf";
    if (btn) btn.disabled = true;
    ipc.invoke("gerar-pdf-laudo", { html: html, defaultName: nomeArq }).then(function (r) {
      if (btn) btn.disabled = false;
      if (!r || r.canceled) return;
      if (r.ok) { toast("Orçamento gerado."); ipc.invoke("abrir-arquivo", r.path); }
      else toast("Erro ao gerar: " + (r.error || "?"), true);
    });
  }

  // init
  recalc();
})();

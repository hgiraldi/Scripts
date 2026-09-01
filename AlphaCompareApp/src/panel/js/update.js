/* ============================================================
 * Alpha Compare - barra de ATUALIZACAO (pasta de versoes na rede).
 * Arquivo auto-contido de proposito: p/ levar isso pra outro app Alpha, copie este
 * .js + o bloco #updBar do index.html + o trecho ".upd" do style.css, e ajuste o
 * "alphaUpdate" do package.json. A logica pesada mora no main (src/updater.js).
 *
 * Estados da barra:
 *   novidade  -> "Nova versao X disponivel"  [Atualizar agora] [Depois]
 *   baixando  -> texto + barra de progresso (sem botao: nao da pra cancelar no meio)
 *   erro      -> mensagem + [Tentar de novo]
 * ============================================================ */
(function () {
  "use strict";
  var ipcRenderer;
  try { ipcRenderer = require("electron").ipcRenderer; }
  catch (e) { return; }   // fora do Electron (ex.: painel CEP): sem atualizacao, sem barulho

  var bar, txt, sub, acoes, prog, fill, INFO = null, ocupado = false;

  function $(id) { return document.getElementById(id); }

  function montar() {
    bar = $("updBar"); if (!bar) return false;
    txt = $("updTxt"); sub = $("updSub"); acoes = $("updAcoes");
    prog = $("updProg"); fill = $("updFill");
    return true;
  }

  function mostrar(on) { if (bar) bar.hidden = !on; }

  function estadoNovidade(info) {
    INFO = info;
    txt.innerHTML = 'Nova versão <b>' + esc(info.versaoRede) + '</b> disponível';
    sub.textContent = info.notas ? info.notas : ("você está na " + info.versaoLocal);
    prog.hidden = true;
    acoes.innerHTML = "";
    botao("Atualizar agora", "btn accent sm", "bi-download", aplicar);
    botao("Depois", "btn ghost sm", "", function () { mostrar(false); });
    mostrar(true);
  }

  function estadoBaixando() {
    txt.textContent = "Atualizando para a versão " + INFO.versaoRede + "…";
    sub.textContent = "copiando o instalador da rede — não feche o app";
    acoes.innerHTML = "";
    fill.style.width = "0%";
    prog.hidden = false;
    mostrar(true);
  }

  function estadoErro(msg) {
    ocupado = false;
    txt.textContent = "Não consegui atualizar";
    sub.textContent = msg || "erro desconhecido";
    prog.hidden = true;
    acoes.innerHTML = "";
    botao("Tentar de novo", "btn accent sm", "bi-arrow-clockwise", aplicar);
    botao("Fechar", "btn ghost sm", "", function () { mostrar(false); });
    mostrar(true);
  }

  function botao(rotulo, classe, icone, fn) {
    var b = document.createElement("button");
    b.className = classe;
    b.innerHTML = (icone ? '<i class="bi ' + icone + '"></i> ' : "") + esc(rotulo);
    b.onclick = fn;
    acoes.appendChild(b);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function aplicar() {
    if (ocupado || !INFO) return;
    ocupado = true;
    estadoBaixando();
    ipcRenderer.invoke("update-apply", INFO).then(function (r) {
      if (r && r.ok) {
        txt.textContent = "Pronto — reabrindo o Alpha Compare…";
        sub.textContent = "o app vai fechar e voltar já na versão " + INFO.versaoRede;
        fill.style.width = "100%";
      } else {
        estadoErro((r && r.erro) || "falha ao aplicar");
      }
    }).catch(function (e) { estadoErro(String((e && e.message) || e)); });
  }

  function checar(manual) {
    if (!bar && !montar()) return;
    ipcRenderer.invoke("update-check").then(function (r) {
      if (r && r.temNova) { estadoNovidade(r); return; }
      // sem novidade: em silencio no automatico; no clique manual, avisa e some
      if (manual) {
        txt.textContent = "Você já está na versão mais nova";
        sub.textContent = (r && r.motivo) ? r.motivo : ("versão " + (r && r.versaoLocal || ""));
        prog.hidden = true; acoes.innerHTML = "";
        botao("Fechar", "btn ghost sm", "", function () { mostrar(false); });
        mostrar(true);
        setTimeout(function () { if (!ocupado) mostrar(false); }, 6000);
      }
    }).catch(function (e) { if (manual) estadoErro(String((e && e.message) || e)); });
  }

  ipcRenderer.on("update-progress", function (_e, pct) {
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct || 0)) + "%";
    if (sub && pct >= 100) sub.textContent = "instalando… não feche o app";
  });

  document.addEventListener("DOMContentLoaded", function () {
    if (!montar()) return;
    // versao no cabecalho + clique = checagem manual (o suporte sempre pergunta isso)
    ipcRenderer.invoke("app-version").then(function (v) {
      var el = $("appVer");
      if (el) { el.textContent = "v" + v; el.title = "Clique para procurar atualização"; el.onclick = function () { checar(true); }; }
    }).catch(function () {});
    // automatica: espera o painel pesado (pdfium/wasm) assentar antes de tocar na rede
    setTimeout(function () { checar(false); }, 6000);
  });

  window.AlphaUpdate = { checar: checar };
})();

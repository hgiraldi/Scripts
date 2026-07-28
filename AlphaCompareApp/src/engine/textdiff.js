// AlphaProof - comparacao de TEXTO entre os 2 lados (linhas do OCR nativo).
// Estilo proofreading: pareia linha do ARQUIVO com a do ORIGINAL na MESMA posicao (offset LOCAL
// por ancoras, corrige arrasto/escala), faz diff PALAVRA-A-PALAVRA (LCS) e filtra confusao de OCR.
// DIGITO diferente = SEMPRE erro real (o alvo: 28/29, 0763/0591). Letra parecida / 0<->O = ruido.

function stripAccents(t) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "");
}
// normaliza dígitos SUPERSCRITO/subscrito (² ³ ¹ …) p/ dígito normal — senão "muscular.²" vs
// "muscular.2" viram falso (um lado sem [0-9], o outro com "2"). Nota de rodapé, não erro.
var SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉";
function supFix(t) { return String(t == null ? "" : t).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g, function (c) { return "" + (SUP.indexOf(c) % 10); }); }
function canon(t) { return stripAccents(supFix(t)).toLowerCase().replace(/[^a-z0-9]/g, ""); }
function digits(t) { var m = supFix(t).match(/[0-9]/g); return m ? m.join("") : ""; }
function lev(a, b) {
  if (a === b) return 0; if (!a) return b.length; if (!b) return a.length;
  var prev = [], i, j; for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    var cur = [i];
    for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) !== b.charAt(j - 1) ? 1 : 0));
    prev = cur;
  }
  return prev[b.length];
}
// true = confusao de OCR (nao reportar)
function confus(a, b) {
  var za = canon(a).replace(/0/g, "o"), zb = canon(b).replace(/0/g, "o");
  if (za === zb) return true;                       // 0<->O<->o, acento, caixa, pontuacao
  if (digits(a) !== digits(b)) return false;        // DIGITO mudou -> erro real
  var ca = canon(a), cb = canon(b);
  if (ca === cb) return true;
  function cc(t) {
    var pares = [["q", "o"], ["0", "o"], ["1", "i"], ["l", "i"], ["5", "s"], ["z", "s"], ["c", "e"], ["b", "s"], ["m", "h"], ["rn", "m"], ["cl", "d"], ["ii", "n"]];
    for (var i = 0; i < pares.length; i++) t = t.split(pares[i][0]).join(pares[i][1]);
    return t;
  }
  if (cc(ca) === cc(cb)) return true;
  var d = lev(ca, cb), L = Math.max(ca.length, cb.length, 1);
  if (d <= 2 && d / L <= 0.34) return true;          // so-letra muito parecido = leitura
  return false;
}

// comprimento da maior substring comum (p/ detectar fragmentacao de OCR)
function lcsSub(a, b) {
  var n = a.length, m = b.length, best = 0, i, j, prev = new Int32Array(m + 1), cur = new Int32Array(m + 1);
  for (i = 1; i <= n; i++) {
    for (j = 1; j <= m; j++) { cur[j] = a.charAt(i - 1) === b.charAt(j - 1) ? prev[j - 1] + 1 : 0; if (cur[j] > best) best = cur[j]; }
    var t = prev; prev = cur; cur = t; cur.fill(0);
  }
  return best;
}
// diff palavra-a-palavra por LCS: isola a troca curta mesmo com erro de OCR em outra palavra
function wordDiffs(a, b) {
  var wa = a.split(/\s+/).filter(Boolean), wb = b.split(/\s+/).filter(Boolean);
  var na = wa.length, nb = wb.length, i, j;
  var ca = wa.map(canon), cb = wb.map(canon);
  var dp = []; for (i = 0; i <= na; i++) { dp.push(new Int32Array(nb + 1)); }
  for (i = 1; i <= na; i++) for (j = 1; j <= nb; j++)
    dp[i][j] = ca[i - 1] === cb[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  var pares = []; i = na; j = nb;
  while (i > 0 && j > 0) {
    if (ca[i - 1] === cb[j - 1]) { pares.push([i - 1, j - 1]); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  pares.reverse();
  var out = [], ia = 0, ib = 0, k;
  for (k = 0; k <= pares.length; k++) {
    var pa = k < pares.length ? pares[k] : [na, nb];
    if (pa[0] > ia || pa[1] > ib) {
      var sa = wa.slice(ia, pa[0]).join(" "), sb = wb.slice(ib, pa[1]).join(" ");
      var _mn = Math.min(sa.length, sb.length), _mx = Math.max(sa.length, sb.length);
      if ((sa.length || sb.length) && canon(sa) !== canon(sb) && !confus(sa, sb)
          && _mx <= 12 && _mn > 0 && !(_mn <= 1 && _mx >= 4)) {   // 1-char vs longo = truncação/ruído
        var mudouDig = digits(sa) !== digits(sb);
        var ca2 = canon(sa), cb2 = canon(sb), lo = ca2.length < cb2.length ? ca2 : cb2, hi = ca2.length < cb2.length ? cb2 : ca2;
        // letra-só (sem mudar dígito): filtra ruído curto e FRAGMENTAÇÃO (o OCR só quebrou a
        // palavra diferente, nao houve troca real) — via maior substring comum >= 60% do menor.
        var frag = !mudouDig && (Math.max(ca2.length, cb2.length) <= 3 || (lo.length >= 3 && lcsSub(lo, hi) >= lo.length * 0.6));
        if (!frag) out.push({ arq: sa, ori: sb });
      }
    }
    ia = pa[0] + 1; ib = pa[1] + 1;
  }
  return out;
}

// ancoras: linhas cujo canon e UNICO e IGUAL nos 2 lados -> pares (ax,ay = arquivo; ox,oy = original)
function anchors(F, O) {
  var cf = {}, co = {}, i;
  for (i = 0; i < F.length; i++) { var k = canon(F[i].t); cf[k] = (cf[k] || 0) + 1; }
  for (i = 0; i < O.length; i++) { var k2 = canon(O[i].t); co[k2] = (co[k2] || 0) + 1; }
  var omap = {}; for (i = 0; i < O.length; i++) { var ko = canon(O[i].t); if (co[ko] === 1 && ko.length >= 4) omap[ko] = O[i]; }
  var A = [];
  for (i = 0; i < F.length; i++) { var kf = canon(F[i].t); if (cf[kf] === 1 && omap[kf]) { var ow = omap[kf]; A.push({ ax: F[i].cx, ay: F[i].cy, ox: ow.cx, oy: ow.cy }); } }
  return A;
}
// ajuste linear robusto por eixo: arq = s*ori + b (minimos quadrados + rejeicao de outlier).
// Lida com aspecto/escala diferentes (Coca: original 912 alt x arquivo 1389) que um offset nao pega.
function fitAxis(pairs, getA, getO) {
  function lsq(ps) {
    var n = ps.length, sx = 0, sy = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { var X = getO(ps[i]), Y = getA(ps[i]); sx += X; sy += Y; sxx += X * X; sxy += X * Y; }
    var den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-6) return { s: 1, b: (sy - sx) / (n || 1) };
    var s = (n * sxy - sx * sy) / den, b = (sy - s * sx) / n;
    return { s: s, b: b };
  }
  if (pairs.length < 2) return { s: 1, b: pairs.length ? getA(pairs[0]) - getO(pairs[0]) : 0 };
  var fit = lsq(pairs);
  // 2 passadas de rejeicao de outlier (residuo > 2.5x mediana)
  for (var pass = 0; pass < 2; pass++) {
    var res = pairs.map(function (p) { return Math.abs(getA(p) - (fit.s * getO(p) + fit.b)); });
    var sorted = res.slice().sort(function (a, b) { return a - b; });
    var med = sorted[sorted.length >> 1] || 0, lim = Math.max(8, med * 2.5);
    var keep = pairs.filter(function (p, i) { return res[i] <= lim; });
    if (keep.length >= 2 && keep.length < pairs.length) { pairs = keep; fit = lsq(pairs); } else break;
  }
  return fit;
}

// pareia linhas ARQ<->ORI por POSICAO (fit linear robusto). Retorna os pares que DIFEREM (canon)
// — os candidatos p/ re-leitura em alta.  { pairs:[{fw,ow}], anchors:n }
function matchPairs(F, O, opts) {
  opts = opts || {};
  var A = anchors(F, O);
  var fitX = fitAxis(A.slice(), function (p) { return p.ax; }, function (p) { return p.ox; });
  var fitY = fitAxis(A.slice(), function (p) { return p.ay; }, function (p) { return p.oy; });
  if (A.length < 6 && opts.seed && opts.seed.scl) {
    fitX = { s: opts.seed.scl, b: opts.seed.ox || 0 };
    fitY = { s: opts.seed.scl, b: opts.seed.oy || 0 };
  }
  var Ot = O.map(function (w) { return { w: w, ax: fitX.s * w.cx + fitX.b, ay: fitY.s * w.cy + fitY.b }; });
  var used = new Array(O.length), pairs = [], i, j;
  for (i = 0; i < F.length; i++) {
    var fw = F[i], best = -1, bd = 1e18;
    for (j = 0; j < Ot.length; j++) {
      if (used[j]) continue; var ow = Ot[j];
      var dyy = Math.abs(ow.ay - fw.cy); if (dyy > Math.max(fw.h, 14) * 0.75) continue;
      var dxx = Math.abs(ow.ax - fw.cx); if (dxx > Math.max(fw.w, 40) * 0.6 + 40) continue;
      var d = dxx + dyy * 3; if (d < bd) { bd = d; best = j; }
    }
    if (best < 0) continue; used[best] = true;
    var a = String(fw.t).trim(), b = String(O[best].t).trim();
    if (canon(a) === canon(b)) continue;      // linha igual -> nao e candidato
    pairs.push({ fw: fw, ow: O[best] });
  }
  return { pairs: pairs, anchors: A.length };
}

// diff de UM par ja LIMPO (texto+conf dos 2 lados). Aplica confusao + LCS de palavra + corte por tipo.
// a,b = textos (arq, ori);  lc = confianca minima da linha (do read).  -> [{arq, ori}]
function diffPair(a, b, lc) {
  a = String(a || "").trim(); b = String(b || "").trim();
  if (canon(a) === canon(b)) return [];
  if (confus(a, b)) return [];
  // guarda anti-MISPAIR: se as duas linhas são MUITO diferentes no geral (não é a mesma linha
  // com uma troca local), foi pareamento errado -> ignora. Números curtos ficam isentos.
  var ka = canon(a), kb = canon(b), mL = Math.max(ka.length, kb.length);
  if (mL > 6 && lcsSub(ka, kb) / mL < 0.4) return [];
  var out = [], wd = wordDiffs(a, b);
  for (var q = 0; q < wd.length; q++) {
    var soLetra = digits(wd[q].arq) === digits(wd[q].ori);
    // NÚMERO (o alvo: 28→29, 0763→0591) passa com conf 0.80; LETRA exige 0.90 (lixo é quase tudo letra)
    if (soLetra) { if (lc < 0.90) continue; } else { if (lc < 0.80) continue; }
    out.push({ arq: wd[q].arq, ori: wd[q].ori });
  }
  return out;
}

// caminho simples SEM re-leitura (compat): pareia + diff direto do full-page.
function compare(F, O, opts) {
  opts = opts || {};
  var mp = matchPairs(F, O, opts), diffs = [];
  for (var i = 0; i < mp.pairs.length; i++) {
    var fw = mp.pairs[i].fw, ow = mp.pairs[i].ow, lc = Math.min(fw.c, ow.c);
    var a = String(fw.t).trim(), b = String(ow.t).trim();
    var dd = diffPair(a, b, lc);
    for (var q = 0; q < dd.length; q++)
      diffs.push({ arq: dd[q].arq, ori: dd[q].ori, x: fw.x, y: fw.y, w: fw.w, h: fw.h, arqLine: a, oriLine: b });
  }
  return { diffs: diffs, anchors: mp.anchors };
}

module.exports = { compare: compare, matchPairs: matchPairs, diffPair: diffPair, canon: canon, digits: digits, confus: confus, wordDiffs: wordDiffs };

# GUIA JSX — Adobe Illustrator (ExtendScript)

> **Referência permanente** para desenvolvimento, manutenção, debug e refatoração de
> scripts JSX. **Consultar ANTES de qualquer alteração de código.**
>
> Fonte: *Adobe Illustrator Scripting Guide* (docsforadobe.dev) + comportamento
> **verificado em produção** neste projeto (os "⚠️ GOTCHA" são erros que já nos pegaram).

---

# Objetivo

Todo código deve ser compatível com **Adobe Illustrator 26.0.1 (Illustrator 2022)**
usando **ExtendScript (JSX)** — o motor é antigo (≈ ECMAScript 3 / SpiderMonkey).
A meta é **robustez em produção pré-impressão flexográfica**, não elegância.

---

# Regras Obrigatórias

* **Nunca** usar recursos modernos de JavaScript incompatíveis com ExtendScript.
* **Proibido:** `let`, `const`, arrow functions (`=>`), `Promise`, classes ES6,
  `async/await`, `Map`, `Set`, template literals (`` ` ``), destructuring, spread/rest,
  `for...of`, `Array.forEach/map/filter/reduce/find/includes`, `Object.assign`,
  `JSON` (use com cuidado — existe mas limitado), APIs modernas de browser/Node.
* **Usar apenas** sintaxe ES3-compatível: `var`, `function`, `for (var i...)`,
  `for (var k in obj)`, `switch`, `try/catch`.
* **Compatibilidade ACIMA de elegância.** Verbosidade é aceitável; quebrar não é.
* **Sempre preservar o comportamento existente** ao refatorar.

```javascript
// CORRETO
var i;
for (i = 0; i < itens.length; i++) {
    var it = itens[i];
}

// ERRADO (ES6)
itens.forEach(function (it) { ... });
const x = 1; let y = 2; var f = () => {};
```

> **Loops sobre coleções do DOM:** sempre `for (var i = 0; i < col.length; i++)`.
> Ao **remover** itens, itere de trás pra frente: `for (var i = col.length - 1; i >= 0; i--)`.

---

# Conhecimento do DOM Illustrator

Hierarquia: **`app` → `Document` → `Layer` → `PageItem`(s)**. As coleções são acessadas
por índice `col[i]` **ou** por nome `col.getByName("nome")` (lança exceção se não achar).

| Objeto | Como acessar | Notas |
|---|---|---|
| **app** | `app` (global, = `Application`) | `app.activeDocument`, `app.documents`, `app.selection`, `app.userInteractionLevel`, `app.preferences`, `app.executeMenuCommand("...")`, `app.redraw()`, `app.coordinateSystem` |
| **activeDocument** | `app.activeDocument` | o doc em foco. Guardar em `var doc = app.activeDocument;` no início e validar |
| **layers** | `doc.layers`, `doc.layers[i]`, `doc.layers.getByName("arte")` | `.add()`, `.name`, `.visible`, `.locked`, `.opacity`, `.hasSelectedArtwork`. **Sublayers:** `layer.layers` |
| **pageItems** | `doc.pageItems`, `layer.pageItems`, `group.pageItems` | **TODOS** os itens (Path, Group, Text, Placed, Raster, Compound...). É a coleção genérica — cada item tem `.typename` |
| **pathItems** | `doc.pathItems`, `layer.pathItems.add()`, `.rectangle()`, `.ellipse()`, `.polygon()` | só vetores fechados/abertos |
| **groupItems** | `doc.groupItems`, `layer.groupItems.add()` | agrupamento; `.pageItems` lista os filhos |
| **textFrames** | `doc.textFrames`, `layer.textFrames.add()` | ver seção *Text Frames* |
| **placedItems** | `doc.placedItems`, `layer.placedItems.add()` | PDF/imagem **linkada** (`.file`, `.embed()`) |
| **rasterItems** | `doc.rasterItems` | imagem rasterizada/embedada |
| **compoundPathItems** | `doc.compoundPathItems` | furos/letras (vários paths como 1); `.pathItems` |
| **symbolItems / symbols** | `doc.symbolItems` (instâncias) / `doc.symbols` (definições) | `symbols.getByName(...)`, `symbolItems.add(symbol)` |
| **swatches** | `doc.swatches`, `.getByName(...)`, `.add()` | TODAS as amostras (cores, gradientes, padrões) |
| **spots** | `doc.spots`, `.getByName(...)`, `.add()` | só cores **spot/Pantone**. Subconjunto de swatches |
| **colors** | não é coleção — são **objetos** (`new CMYKColor()`, etc.) aplicados em `.fillColor/.strokeColor` | ver seção *Cores* |
| **stories** | `doc.stories`, `story.textFrames`, `story.textRange` | fluxos de texto (1 story = 1+ textFrames encadeados) |
| **artboards** | `doc.artboards`, `doc.artboards[i]`, `.getActiveArtboardIndex()` | `.artboardRect = [l,t,r,b]`, `.name`, `.add(rect)` |

```javascript
// Padrão seguro de acesso por NOME (não por índice fixo):
var layerArte;
try { layerArte = doc.layers.getByName("arte"); }
catch (e) { layerArte = doc.layers.add(); layerArte.name = "arte"; }
```

> ⚠️ **GOTCHA — `pageItems` é recursivo-ish:** `layer.pageItems` pode incluir itens
> **aninhados** dentro de grupos. Para pegar só os **top-level**, filtre por
> `it.parent && it.parent.typename === "Layer"`.

---

# Sistema de Coordenadas

* **Internamente o Illustrator trabalha em PONTOS.** Toda medida no DOM (width, bounds,
  position, translate, strokeWidth...) está em **points**, independente da régua.
* **1 polegada = 72 points.** **1 mm = 72/25.4 ≈ 2.834645 pt.**
* A unidade da **régua** (`doc.rulerUnits`) é só **exibição** — NÃO muda a geometria.

```javascript
function mmToPt(mm) { return mm * 72.0 / 25.4; }
function ptToMm(pt) { return pt * 25.4 / 72.0; }
```

## position vs geometricBounds vs visibleBounds vs controlBounds

| Propriedade | Formato | O que é |
|---|---|---|
| **position** | `[x, y]` = `[left, top]` | canto **superior-esquerdo** do *geometricBounds* |
| **geometricBounds** | `[left, top, right, bottom]` | caixa do vetor **SEM** traço/efeitos |
| **visibleBounds** | `[left, top, right, bottom]` | caixa **COM** traço e efeitos (sombra etc.) |
| **controlBounds** | `[left, top, right, bottom]` | caixa incluindo pontos de controle (alças bézier) |
| **left / top** | número | atalhos = `geometricBounds[0]` / `[1]` |
| **width / height** | número | `right - left` / `top - bottom` |

* ⚠️ **GOTCHA CRÍTICO — ordem dos bounds:** no **Illustrator** é
  **`[left, top, right, bottom]`** → `gb[0]=left, gb[1]=top, gb[2]=right, gb[3]=bottom`.
  **NÃO** é `[top, left, bottom, right]` (isso é **InDesign**). Confundir isso troca X↔Y
  e desloca tudo (foi a "saga do label" deste projeto).
* **Eixo Y "para cima"** (PostScript): **`top > bottom`**. Logo
  `height = top - bottom = gb[1] - gb[3]` e `width = right - left = gb[2] - gb[0]`.
* **Origem:** depende de `app.coordinateSystem`. Em coordenadas de documento, a origem
  fica no canto do artboard; valores podem ser **negativos**. **Nunca** assuma origem 0,0.

```javascript
var gb = it.geometricBounds;          // [left, top, right, bottom]
var w  = gb[2] - gb[0];               // largura
var h  = gb[1] - gb[3];               // altura
var cx = (gb[0] + gb[2]) / 2;         // centro X
var cy = (gb[1] + gb[3]) / 2;         // centro Y

// Mover canto sup-esq do bounds para (L, T) — robusto p/ item rotacionado:
function moverTopoEsq(it, L, T) {
    var b = it.geometricBounds;       // [left, top, right, bottom]
    it.translate(L - b[0], T - b[1]); // dX = L - left ; dY = T - top
}
```

> **Cuidado ao calcular largura/altura:** use sempre `right-left` e `top-bottom` (com
> `top>bottom`). Se vier negativo, a ordem dos bounds está sendo lida errada.

---

# Text Frames

`tf.kind` define o tipo: `TextType.POINTTEXT`, `TextType.AREATEXT`, `TextType.PATHTEXT`.

* **Point Text** — texto livre a partir de um ponto.
* **Area Text** — texto dentro de um path (área).
* **Path Text** — texto sobre o contorno de um path.
* **Story** — fluxo de texto (vários textFrames encadeados compartilham 1 `story`).
* **TextRange** — intervalo de caracteres; onde se aplica formatação.
* **Characters / Words / Paragraphs** — coleções dentro do `textRange`/`story`.

```javascript
// POINT TEXT
var tf = layer.textFrames.add();
tf.kind = TextType.POINTTEXT;
tf.contents = "4570";
tf.position = [mmToPt(10), mmToPt(-10)]; // [x, y] da baseline/origem do ponto
tf.textRange.size = mmToPt(2.5);
tf.textRange.fillColor = corPreta;
try { tf.textRange.characterAttributes.overprintFill = true; } catch (e) {}

// AREA TEXT (precisa de um path)
var area = layer.textFrames.areaText(meuPath);
area.contents = "texto na area";

// PATH TEXT
var onPath = layer.textFrames.pathText(meuPath);

// Iterar parágrafos/palavras/caracteres
var p;
for (p = 0; p < tf.paragraphs.length; p++) { var par = tf.paragraphs[p]; }
for (p = 0; p < tf.words.length; p++)      { var w = tf.words[p]; }

// Formatar um intervalo específico
tf.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Bold");

// Texto -> CURVA (não depende de fonte instalada; bounds exato)
var grupoCurva = tf.createOutline(); // retorna GroupItem (o tf é consumido)
```

> ⚠️ **GOTCHA — `createOutline()` consome o `tf`** e pode invalidá-lo se falhar. Nomeie
> o resultado e tenha fallback (recriar o texto) para o label nunca sumir.
> Bounds do texto inclui *padding* da fonte; para posição exata, **converta em curva
> ANTES** de medir/posicionar.

---

# Paths e Shapes

* **PathItem** — vetor. `.pathPoints`, `.closed`, `.filled/.stroked`, `.setEntirePath(...)`.
* **PathPoint** — um nó. `.anchor` `[x,y]`, `.leftDirection` `[x,y]`, `.rightDirection` `[x,y]`, `.pointType` (`PointType.SMOOTH`/`CORNER`).
* **Anchor** — posição do nó. **LeftDirection / RightDirection** — alças bézier (de entrada/saída).
* **EntirePath** — atalho para definir todos os anchors de uma vez (linhas/polilinhas).

```javascript
// Linha simples por setEntirePath
var l = layer.pathItems.add();
l.setEntirePath([[x1, y1], [x2, y2]]);
l.stroked = true; l.filled = false;
l.strokeWidth = mmToPt(0.3);
l.strokeColor = cor;
l.strokeOverprint = true;
l.strokeDashes = [mmToPt(5), mmToPt(3)]; // pontilhado (traço, gap)

// Retângulo: rectangle(top, left, width, height)  -> top em coord (y-up)
var r = layer.pathItems.rectangle(top, left, width, height);
r.filled = false; r.stroked = true; r.strokeColor = cor;

// Elipse: ellipse(top, left, width, height)
var e = layer.pathItems.ellipse(top, left, w, h);

// Polígono: polygon(centerX, centerY, radius, sides)
var pg = layer.pathItems.polygon(cx, cy, raio, 6);

// Manipular nós/bézier
var pt = l.pathPoints[0];
pt.anchor = [x, y];
pt.leftDirection = [x - 5, y];   // alça de entrada
pt.rightDirection = [x + 5, y];  // alça de saída
pt.pointType = PointType.CORNER;
```

> `pathItems.rectangle/ellipse` usam `(top, left, width, height)` — **`top` é a coord Y
> do topo** (y-up). `width`/`height` positivos.

---

# Seleção de Objetos

* **`doc.selection`** — array dos itens selecionados (pode ser `[]`; pode conter
  `TextRange` se houver texto selecionado). Setar `doc.selection = null` limpa.
* **`item.selected`** — boolean por item.
* **`item.typename`** — string do tipo: `"PathItem"`, `"GroupItem"`, `"TextFrame"`,
  `"CompoundPathItem"`, `"PlacedItem"`, `"RasterItem"`, `"SymbolItem"`, `"Layer"`...

```javascript
// Identificação SEGURA de tipos selecionados
function descreverSelecao(doc) {
    var sel = doc.selection;
    if (!sel || sel.length === 0) { return "nada selecionado"; }
    var cont = {};
    var i;
    for (i = 0; i < sel.length; i++) {
        var t;
        try { t = sel[i].typename; } catch (e) { t = "INVALIDO"; }
        cont[t] = (cont[t] || 0) + 1;
    }
    var out = [];
    var k;
    for (k in cont) { if (cont.hasOwnProperty(k)) out.push(k + ":" + cont[k]); }
    return out.join(", ");
}

// Filtrar só GroupItems top-level da seleção
function gruposMaeSelecionados(doc) {
    var res = [];
    var i;
    for (i = 0; i < doc.selection.length; i++) {
        var it = doc.selection[i];
        if (it.typename === "GroupItem" && it.parent && it.parent.typename === "Layer") {
            res.push(it);
        }
    }
    return res;
}
```

> ⚠️ A seleção pode conter objetos **inválidos** (removidos) ou **`TextRange`**. Sempre
> cheque `typename` dentro de `try/catch`.

---

# Transformações

Métodos de `PageItem` (todos têm flags opcionais p/ transformar conteúdo/padrões/traço):

* **`translate(deltaX, deltaY [, transformObjects, transformFillPatterns, transformFillGradients, transformStrokePattern])`** — desloca.
* **`rotate(angle [, changePositions, ..., rotateAbout])`** — gira (graus). `rotateAbout` = `Transformation.CENTER` (padrão varia!).
* **`resize(scaleX, scaleY [, ..., scaleAbout])`** — escala em **%** (100 = original). `resize(-100, 100)` = espelha horizontal.
* **`transform(matrix [, ...])`** — aplica uma `Matrix`.
* **`Matrix`** — `app.getScaleMatrix()`, `getRotationMatrix()`, `getTranslationMatrix()`, `concatenateMatrix()`.

```javascript
// Espelhar horizontalmente (flip)
it.resize(-100, 100);

// Girar 90° em torno do centro do objeto
it.rotate(90, true, true, true, true, true, Transformation.CENTER);

// Matriz: transladar e escalar
var m = app.getTranslationMatrix(mmToPt(10), mmToPt(-5));
m = app.concatenateScaleMatrix(m, 50, 50);
it.transform(m);
```

> ⚠️ **GOTCHA — deslocamentos inesperados:**
> * `rotate`/`resize` têm um ponto de referência (`rotateAbout`/`scaleAbout`) cujo
>   **padrão pode ser a origem do documento**, não o centro do objeto → o item "voa".
>   Passe o ponto explicitamente (`Transformation.CENTER`) ou **reposicione depois**.
> * Em **texto rotacionado**, setar `.left/.top` é instável (vai pra 0,0). Use `translate`.
> * `duplicate(target, ...)` entre documentos preserva **coords ABSOLUTAS** — se o
>   artboard do destino estiver em outra posição, o conteúdo desloca (alinhe o artboard).
> * **Sempre** meça o bounds **depois** de transformar (a geometria mudou).

---

# Cores

Cores são **objetos** atribuídos a `.fillColor`/`.strokeColor`. **Priorizar CMYK e Pantone (Spot).** Evitar RGB no fluxo flexográfico.

```javascript
// CMYK (valores 0..100)
var c = new CMYKColor();
c.cyan = 0; c.magenta = 0; c.yellow = 0; c.black = 100; // preto K=100

// RGB (0..255) — evitar em produção
var rgb = new RGBColor(); rgb.red = 255; rgb.green = 0; rgb.blue = 0;

// Gray (0..100)
var g = new GrayColor(); g.gray = 50;

// Sem cor
var none = new NoColor(); // it.fillColor = new NoColor();  (= sem preenchimento)

// SPOT / Pantone
var spot;
try { spot = doc.spots.getByName("PANTONE 485 C"); }
catch (e) {
    spot = doc.spots.add();
    spot.name = "PANTONE 485 C";
    spot.colorType = ColorModel.SPOT;     // SPOT | PROCESS | REGISTRATION
    var sc = new CMYKColor(); sc.cyan = 0; sc.magenta = 95; sc.yellow = 100; sc.black = 0;
    spot.color = sc;
}
var spotColor = new SpotColor();
spotColor.spot = doc.spots.getByName("PANTONE 485 C");
spotColor.tint = 100;                      // 0..100
item.strokeColor = spotColor;
```

* **`doc.spots`** = só spots; **`doc.swatches`** = todos os swatches.
* `getByName` lança exceção → `try/catch`.
* ⚠️ **GOTCHA — "Black":** criar uma spot chamada **"Black"** colide com o swatch padrão
  do Illustrator (erro "nome em uso"). Para preto, use **CMYK K=100** direto.
* ⚠️ **`Document.rulerUnits` é READ-ONLY** e **cor não tem nada a ver com unidade** —
  mudar régua não afeta separação de cor.
* **Cor predominante / cromia:** para jobs em cromia, as cores podem ser process
  (não-spot) → a lógica que depende de `SpotColor` precisa tratar isso (ver os scripts).

---

# Debug

Sem debugger visual confiável no fluxo de produção — use **logs em arquivo** e **alerts pontuais**.

```javascript
// LOG EM ARQUIVO (não trava o fluxo; melhor que alert em loop)
function log(msg) {
    try {
        var f = new File("~/Desktop/debug_jsx.txt");
        f.open("a");                 // append
        f.encoding = "UTF-8";
        f.writeln("" + msg);
        f.close();
    } catch (e) {}
}

// RASTREAR ERRO com linha
try {
    // ... codigo ...
} catch (e) {
    log("ERRO: " + e + (e.line ? "  (linha " + e.line + ")" : "") + "  " + (e.fileName || ""));
}
```

* **Rastrear erros:** envolva blocos suspeitos em `try/catch` e logue
  `e.message`, `e.line`, `e.fileName`. `$.stack` ajuda a ver a pilha.
* **Registrar logs:** `File(...).open("a")` + `writeln`. Evite `alert()` dentro de loop
  (trava o operador). Use 1 alert no fim com o resumo.
* **Objetos inválidos:** acessar propriedade de item removido **lança exceção**. Teste:
  ```javascript
  function valido(it) { try { var _ = it.uuid !== undefined || it.typename; return true; } catch (e) { return false; } }
  ```
* **Referências nulas:** `if (!obj) {...}`. Coleções podem estar vazias (`col.length === 0`).
  `getByName` **lança** se não achar (não retorna null) → `try/catch`.
* **Depurar loops:** logue `i`, `col.length` e o `typename` de cada item; ao remover,
  itere **de trás pra frente** (índices mudam).
* **Falhas em seleção:** `doc.selection` pode ser `[]`, conter `TextRange` ou itens
  inválidos. Logue `descreverSelecao(doc)` (ver seção *Seleção*).
* **Problemas de layers:** confirme `getByName` exato (case-sensitive!), `visible`,
  `locked`. Layer travada **impede** remoção/edição de itens (falha silenciosa em
  `try/catch`). Logue `doc.layers.length` e os nomes.
* **Validar bounds:** logue `it.geometricBounds`; se `right < left` ou `top < bottom`,
  você leu na ordem errada (lembre: `[left, top, right, bottom]`, `top>bottom`).

> ⚠️ **`app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS`** suprime
> diálogos mas pode causar **parada silenciosa** → **restaurar em `finally`**.
> `app.open/copy/paste` às vezes precisam de **retry + `app.redraw()`**.

---

# Boas Práticas

* **Sempre validar documento aberto:**
  ```javascript
  if (app.documents.length === 0) { alert("Nenhum documento aberto."); return; }
  var doc = app.activeDocument;
  ```
* **Sempre validar seleção** antes de usar (`doc.selection.length`).
* **Evitar índices fixos** (`doc.layers[0]`) — preferir **busca por NOME** (`getByName`).
* **Criar funções reutilizáveis** (`mmToPt`, `moverTopoEsq`, `ensureLayer`...).
* **Evitar alterar estruturas sem necessidade** (não reagrupar/renomear à toa).
* **Minimizar `redraw()`** — só quando realmente precisar (após `copy/paste`/seleção).
* **Minimizar acesso repetitivo ao DOM** — **cacheie** em variável:
  ```javascript
  var n = col.length;            // cacheia o length
  for (var i = 0; i < n; i++) { var it = col[i]; /* use 'it' */ }
  ```
* **Iterar removendo:** de trás pra frente (`length-1 → 0`).
* **`try/catch` em operações de DOM** que podem lançar (getByName, remove, embed, file).
* **Restaurar estado** (userInteractionLevel, visibilidade de layers) em `finally`.

---

# Estratégia de Refatoração

**Antes de alterar qualquer script:**

1. **Entender completamente o fluxo atual** — ler o arquivo todo, seguir `#include`s,
   globais e funções compartilhadas (não mexer só no trecho aberto).
2. **Identificar o impacto** — quem chama essa função? Outros scripts dependem disso?
   (ver `PROJECT_STRUCTURE.md` / mapa do projeto).
3. **Explicar o que será modificado** — em 1-2 frases, antes de tocar no código.
4. **Alterar apenas o necessário** — a menor mudança que resolve.
5. **Preservar compatibilidade ExtendScript** (regras obrigatórias) e o comportamento.
6. **Mostrar trecho ORIGINAL e trecho NOVO** (diff claro).
7. **Explicar os riscos** da alteração (o que pode quebrar, o que testar).

> Verificar sempre: chaves balanceadas, e se há **funções verbatim/duplicadas** entre
> arquivos (ex.: `PICS.jsx` ⇄ `14_Risco_Faca.jsx`) — corrigir bug numa = replicar na outra.

---

# Estratégia de Debug

**Quando um erro for apresentado:**

1. **Localizar a linha exata** (`e.line`, mensagem do Illustrator, log).
2. **Explicar a causa provável** (referência nula? coleção vazia? ordem de bounds?
   propriedade read-only? layer travada? seleção inválida?).
3. **Consultar este GUIA** (gotchas conhecidos resolvem a maioria).
4. **Consultar o DOM oficial** do Illustrator (docsforadobe.dev) se for API específica.
5. **Propor a correção MÍNIMA possível.**
6. **Mostrar o código corrigido.**
7. **Explicar por que a correção resolve** (causa → efeito).

---

## Gotchas verificados em produção (resumo)

| Sintoma | Causa | Correção |
|---|---|---|
| Label/itens deslocados, X↔Y trocados | leu bounds como `[top,left,bottom,right]` (InDesign) | usar `[left, top, right, bottom]` |
| Arquivo salvo sempre em **points** (não mm) | `Document.rulerUnits` é **read-only** | definir unidade na **criação** via `DocumentPreset.units` + `addDocument` |
| Separação com **todos os cuts / labels** (sem filtrar) | clone copy/paste perdeu as layers ("Paste Remembers Layers" off) | garantir a pref ligada, ou clonar por `duplicate` preservando layers |
| Texto rotacionado vai pra origem 0,0 | `.left/.top` em texto rotacionado | usar `translate` |
| Erro "nome em uso" ao criar spot "Black" | colide com swatch padrão | usar CMYK K=100 |
| Script "fecha e não faz nada" | exceção não tratada no topo / erro de sintaxe | `try/catch`, conferir chaves; código destrutivo no topo é perigoso |
| Parada silenciosa | `DONTDISPLAYALERTS` não restaurado | restaurar `userInteractionLevel` em `finally` |

---

## Fontes
- [Adobe Illustrator Scripting Guide (docsforadobe.dev)](https://ai-scripting.docsforadobe.dev/)
- [Document](https://ai-scripting.docsforadobe.dev/jsobjref/Document/) ·
  [PageItem](https://ai-scripting.docsforadobe.dev/jsobjref/PageItem/) ·
  [DocumentPreset](https://ai-scripting.docsforadobe.dev/jsobjref/DocumentPreset/) ·
  [Documents](https://ai-scripting.docsforadobe.dev/jsobjref/Documents/)
- Comportamento verificado em produção neste projeto (Illustrator 2022 / 26.0.1).

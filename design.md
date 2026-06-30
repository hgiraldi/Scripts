# Alpha Clicheria — Guia de Design (Design System)

Guia visual extraído do redesign de `CTA08_jpgpdfsep_design.html`. Use como
referência para modernizar **outras páginas** do AlphaForms mantendo identidade
e comportamento. Tudo aqui é **camada visual** (CSS + pequenos hooks JS), pensada
para ser aplicada **sem quebrar a lógica existente**.

---

## Princípio nº 1 — Não quebrar a lógica

As páginas do AlphaForms são integrações Cloudflow/PageBuilder com **muita lógica
JS que depende de `id`s e `class`es específicas** (ex.: `numero_OS`, `mostrar_saidas`,
`saida`, `registerButton`, `upload_Kiosk`, `inlineRadio1/2`, `msg_prepress`, `msg_Kiosk`).

Regras ao redesenhar:
- **NUNCA** renomeie/remova `id`, `class` ou handlers (`onclick`, `onchange`, `oninput`).
- Prefira **copiar o arquivo** (`*_design.html`) e aplicar a camada visual por cima.
- Reordenar/aninhar markup é OK (o JS seleciona por `id`/`class`, não por ordem),
  desde que os elementos e atributos continuem existindo.
- A modernização é feita por um bloco `<style id="modernDesign">` injetado **antes
  de `</head>`** (depois dos CSS originais, para sobrepor) + hooks JS aditivos.
- Para sobrepor estilos que o JS define **inline** (ex.: `element.style.color = ...`),
  use `!important` no CSS (vence inline não-important).

---

## Paleta (CSS variables)

```css
:root {
    --alpha-blue:   #142b53;  /* navy da marca */
    --alpha-blue-2: #21407a;
    --alpha-blue-3: #2f5aa8;
    --alpha-accent: #F10066;  /* rosa da marca (destaques) */
    --alpha-accent-2:#ff3d86;
    --alpha-green:  #16a34a;  /* sucesso / selecionado */
    --alpha-amber:  #f59e0b;  /* atenção / pendente */
    --alpha-bg:     #eceff5;  /* fundo claro */
    --card:         #ffffff;
    --ink:          #1f2a44;  /* texto */
    --muted:        #6b7280;
    --line:         #e5e9f2;  /* bordas */
    --radius:       16px;
    --radius-sm:    10px;
    --shadow:       0 6px 24px rgba(20, 43, 83, .08);
    --shadow-lg:    0 16px 48px rgba(20, 43, 83, .18);
    --t:            .22s cubic-bezier(.4, 0, .2, 1);
}
/* Dark mode: redefina as variaveis no body.alpha-dark */
body.alpha-dark {
    --alpha-bg: #0b1220;
    --card:     #121c33;
    --ink:      #e8eefc;
    --muted:    #9fb0cf;
    --line:     #243352;
}
```

- **Fonte**: Poppins (`font-family: 'Poppins', system-ui, sans-serif`).
- **Ícones**: Font Awesome 6 (use `::before` com `font-family:"Font Awesome 6 Free"; font-weight:900;`
  para adicionar ícones sem mexer no HTML).

---

## Dark mode (toggle persistente)

Botão na navbar superior + classe `alpha-dark` no `<body>`, persistida em `localStorage`.

```html
<a class="nav-link" id="themeToggle" onclick="toggleAlphaTheme()">
  <i class="fa fa-moon"></i> <span id="themeToggleTxt">Escuro</span></a>
```
```js
function toggleAlphaTheme() {
    var dark = document.body.classList.toggle("alpha-dark");
    try { localStorage.setItem("alphaTheme", dark ? "dark" : "light"); } catch (e) {}
    _alphaSyncThemeBtn(dark);
}
function _alphaSyncThemeBtn(dark) {
    var t = document.getElementById("themeToggleTxt"), i = document.querySelector("#themeToggle i");
    if (t) t.innerText = dark ? "Claro" : "Escuro";
    if (i) i.className = dark ? "fa fa-sun" : "fa fa-moon";
}
(function () {
    try { if (localStorage.getItem("alphaTheme") === "dark") {
        document.body.classList.add("alpha-dark");
        document.addEventListener("DOMContentLoaded", function () { _alphaSyncThemeBtn(true); });
    } } catch (e) {}
})();
```

**Regra de ouro do dark mode:** se a cor do texto é controlada por JS inline
(comum nas páginas Alpha), recolora o texto por **estado real** (não pela cor inline).
Ex.: diferencie disponível/indisponível pelo `:disabled` do controle, não pela cor:
```css
body.alpha-dark .item:not(:disabled) + label { color: #e6ecfa !important; } /* disponivel */
body.alpha-dark .item:disabled       + label { color: #64748b !important; } /* indisponivel */
```

---

## Componentes

### Sidebar (navegação lateral)
- Fundo degradê navy: `linear-gradient(165deg,#0e1f43,#142b53 55%,#21407a)`.
- Itens com hover deslizante (`translateX`), borda-acento à esquerda no hover/ativo,
  ícones via `::before` (Font Awesome) por `id`/`class` do item.
- Texto inativo claro (`#dde6f7`) para contraste sobre o navy.

### Topbar (barra superior)
- Glassmorphism: `background: rgba(255,255,255,.85); backdrop-filter: blur(10px);`
  borda `--line`, `--radius`, `--shadow`. **Sticky** (`position:sticky; top:0; z-index:50`).
- Links como pílulas com hover preenchido em navy.
- Dark: `background: rgba(18,28,51,.85)`.

### Cards / formulário
- `background: var(--card); border:1px solid var(--line); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 26px 28px;`
- Inputs: borda `1.6px var(--line)`, `--radius-sm`, foco com anel
  `box-shadow: 0 0 0 4px rgba(47,90,168,.14)`.
- Validação inline via `:has()` (sem JS), reagindo a sinais que o JS já emite:
```css
#formulario:has(#error_os:not(:empty)) #numero_OS { border-color:#dc2626; }
#formulario:has(#mostrar_saidas:not([style*="none"])) #numero_OS { border-color: var(--alpha-green); }
```

### Título de página (heading)
- Texto em degradê (sobrepõe cor inline do JS) + traço de destaque centralizado:
```css
.titulo {
    color: transparent !important;
    background: linear-gradient(90deg,#142b53,#2f5aa8 55%,#F10066);
    -webkit-background-clip: text; background-clip: text;
    font-weight: 800;
}
.titulo::after { content:""; display:block; width:70px; height:4px;
    margin:12px auto 0; border-radius:999px;
    background: linear-gradient(90deg,#2f5aa8,#F10066); }
body.alpha-dark .titulo { background: linear-gradient(90deg,#9bc0ff,#cfe0ff 55%,#ff7eb0); }
```

### Toggle switch (substitui checkbox)
**Desenhe o toggle no `label`, nunca no `<input>`** (pseudo-elementos em `<input>`
são instáveis). Esconda o input, mantenha-o funcional via `for=`:
```css
.item { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
.lbl  { position:relative; display:flex; align-items:center; gap:11px; cursor:pointer; }
.lbl::before { content:""; flex:0 0 auto; width:42px; height:23px; border-radius:999px;
    background:#ccd5e6; transition:background .25s; }                 /* trilho */
.lbl::after  { content:""; position:absolute; left:2.5px; top:50%; width:18px; height:18px;
    border-radius:50%; background:#fff; transform:translateY(-50%);
    box-shadow:0 2px 5px rgba(20,43,83,.35); transition:left .25s; }  /* bolinha */
.item:checked + .lbl::before { background: var(--alpha-green); }
.item:checked + .lbl::after  { left: 21.5px; }
.item:disabled + .lbl { cursor:not-allowed; }
.item:disabled + .lbl::before { background:#e2e7f0; }
```
Estados (legenda): **verde** = selecionado · **cinza** = disponível/indisponível
· **laranja** (`#b45309` claro / `#fb923c` dark) = não solicitado/aplicável.

### Agrupamento em cards de categoria
- Itens relacionados em cards (`.saida-group`): título uppercase pequeno com
  sublinhado rosa, lista vertical (`flex-direction:column`), cards de mesma altura
  (`.groups { display:flex; align-items:stretch; gap:14px }`, `.group { flex:1 1 200px }`).
- ⚠️ Em grids Bootstrap, sobreponha `.col-md-*` (que força `flex:0 0 25%; max-width:25%`)
  com `flex:0 0 auto !important; max-width:none !important; width:100% !important`
  para evitar sobreposição de conteúdo.

### Botão principal (Enviar/ação)
- Pílula com degradê/realce, `box-shadow` colorida, hover com `translateY(-3px) scale(1.02)`,
  pulse sutil quando habilitado (`@keyframes`). Não brigue com a cor de fundo que o JS
  define (verde/vermelho) — anime `transform`/`box-shadow`.

### Banner de status (mensagens)
- Mensagens importantes no **topo do conteúdo** (não escondidas na sidebar), como
  pílula central. Use `:empty { display:none }` para colapsar quando vazias.
  Mantém a cor (verde/vermelho/laranja) que o JS injeta inline.

### Indicador de progresso "Pronto para enviar"
- Trilho animado que guia o usuário em estágios, dirigido por classe JS (`ready-ok`)
  + visibilidade via `:has(.item:checked)`:
  - selecionou itens mas falta passo (ex.: etiqueta) → **metade, laranja**, "Selecionar X".
  - passo concluído ou dispensado pela lógica → **cheio, verde**, "Pronto para enviar".
  - nada selecionado → recolhe.
- Detecte "passo dispensado" por estado real do DOM (controles `:disabled`/auto-checados),
  e use um `setInterval(fn, 600)` leve para sincronizar seleções feitas pelo próprio JS.

---

## Utilidades

```css
/* scrollbar moderna */
*::-webkit-scrollbar { width:10px; height:10px; }
*::-webkit-scrollbar-thumb { background:#c2cbe0; border-radius:999px; }
*::-webkit-scrollbar-thumb:hover { background: var(--alpha-blue-3); }
```
- Botões utilitários discretos (ex.: "Limpar"): pílula ghost com borda `--line`,
  hover muda para `--alpha-accent`.
- Responsivo: em `@media (max-width:991px)`, cards de categoria viram `flex-basis:100%`.

---

## Checklist ao aplicar em uma página nova

1. Copiar o arquivo para `*_design.html` e neutralizar redirects que mandariam o
   usuário para outra página (ex.: condicionar a redirects com `indexOf("_design") < 0`).
2. Injetar `<style id="modernDesign">` antes de `</head>` com as variáveis + componentes.
3. Adicionar o toggle de dark mode (navbar) + script de tema.
4. Conferir contraste em **claro e escuro**, recolorindo por estado real onde o JS
   define cor inline.
5. Validar que toda a lógica continua: `id`s/`class`es/handlers intactos.
6. Não inventar nomes de arquivos/funções — verificar no código antes de referenciar.

---

## Referência viva
Implementação completa e testada: **`CTA08_jpgpdfsep_design.html`**.
Copie os blocos de `<style id="modernDesign">` e os scripts auxiliares de lá.

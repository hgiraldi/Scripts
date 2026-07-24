# Alpha Compare — documento base do projeto

> **LEIA ESTE ARQUIVO PRIMEIRO** antes de mexer em qualquer código do AlphaCompare.
> Ele substitui a leitura exploratória dos fontes. Só abra os arquivos citados quando
> for editar o trecho específico. Mantenha este documento atualizado a cada mudança
> estrutural (é ele que evita re-descobrir o projeto do zero a cada conversa).

---

## 1. O que é

Extensão **CEP** para Adobe Illustrator 2022+ que compara o **PDF original do cliente**
com o **arquivo tratado** pela clicheria e aponta as diferenças **de conteúdo**
(texto trocado/faltando, objeto removido/a mais, barcode/QR divergente), ignorando o
que é trabalho normal de pré-impressão (trapping, overprint, re-desenho de fonte,
retoque de foto, faca, marcas técnicas). É um "Precision Proof / GlobalVision caseiro".

- **Pasta da extensão:** `AlphaCompare/com.alpha.compare/`
- **É gitignored** (não entra no repo de scripts). Backups e bancada vivem no scratchpad.
- **Usuário:** Henrique (Alpha Clicheria). Em teste com 2 operadores do Flexível + 1 do Ondulado.
- **Deploy Mac:** `scratchpad/mkzip.cjs` → `Desktop/AlphaCompare_Mac.zip` (ZIP com bit de
  execução Unix; o Compress-Archive do Windows perde o bit e o `.command` não abre).

---

## 2. Mapa dos arquivos

| Arquivo | Linhas | Papel |
|---|---:|---|
| `js/compare.js` | ~970 | **MOTOR.** Alinhamento, modos cor/forma, filtros, barcode/QR, overlay. `window.ACEngine` |
| `js/main.js` | ~1625 | **ORQUESTRAÇÃO + UI.** Panes, render, limpar, zoom, OCR guiado, relatório |
| `js/textcheck.js` | ~1256 | Char-matching e `findRestyledRegions` (regiões de texto re-estilizado) |
| `js/octext.js` | ~1310 | OCR (tesseract **inline**, sem worker) — `ACOcr` |
| `js/barcode.js` | ~473 | Leitor EAN-13 próprio — `ACBarcode.scan` |
| `js/report.js` | ~255 | Relatório PDF (jsPDF) |
| `host/host.jsx` | ~252 | ExtendScript: acha job no Engine, Desktop, pasta do job |
| `lib/pdfium/pdfrender.js` | ~279 | Render PDF via pdfium WASM — `ACPdf` |
| `index.html` / `css/style.css` | ~236 / ~203 | Painel |

---

## 3. Regras de ouro (violar = quebrar o produto)

1. **CEP não aceita worker_threads** — mata o renderer (tela reseta). Por isso o OCR é
   inline (`octext.js`). Nunca reintroduzir worker.
2. **Nenhum modal de dentro do painel** (`alert`, `new Window`) — deadlock no CEP.
3. **pdfium: doc transiente.** `withPdf(pane, ...)` carrega → trabalha → destrói. UM doc
   por vez (PDFs de produção têm 700MB; teto do WASM é 2GB e o heap nunca encolhe).
4. **Nunca chamar `FPDFPage_GenerateContent`** — reescreve o content stream e corrompe
   overprint/blend (a arte renderiza em NEGATIVO). A limpeza de camada usa
   `SetIsActive` em memória, com a página em cache (`h._pg`).
5. **PDF puxado do Desktop/Job guarda só `pane.srcPath`** (bytes = null, pra não segurar
   700MB na RAM). Qualquer gate do tipo `if (!pane.bytes)` está **errado** — use
   `pane.bytes || pane.srcPath`. Esse bug já apareceu 2×.
6. **ExtendScript (host.jsx) é ES3**: sem `let/const/=>/forEach/template literals`.
7. **Nunca commitar/deployar por conta própria** — Henrique avisa quando.

---

## 4. O motor (`compare.js`) — pipeline

```
render dos 2 lados na MESMA escala px/pt (prescaled)
   ↓
autoAlign (pirâmide de bordas, thumb 64→180)
   ↓
fineEdgeAlign  ← 2 ESTÁGIOS (janela larga passo 3 → ±4 passo 1)
   ↓            + pickBestQ (8 vizinhos, fica com o de maior encaixe; margem +0.005)
alignQuality → al.q  = fração de bordas do O que casam com o F (0..1 HONESTO)
   ↓            se q < 0.92 → 2ª tentativa partindo das caixas de tinta
   ↓            se q < 0.90 → AJUSTE DE ESCALA X/Y (mede a inclinação do
   ↓            deslocamento por bandas = fator de escala; itera até 3×; só mantém
   ↓            se o encaixe medido melhorar). Caso DUX: 74% → 93%
shiftRGB (original deslocado 1× ; máscara `valid`)
   ↓
máscara de FOTO (photoF ∩ photoO) → silencia re-tratamento de imagem
   ↓
AUTO cor/forma:
   • toneShift > 15  → FORMA (tom/trapping diferente = original × tratado)
   • breathe > 0.55  → FORMA (fonte re-desenhada: diffs colados em borda dos 2 lados)
   • senão           → COR (rev × rev; pega até ponto de 1px)
   ↓
MODO COR: diff de cor com slack + portão de borda
MODO FORMA: bordas fortes sem par dentro de trapTol (3px) + supressão de gradiente
   ↓
labelBlobs → classifyComp (define strength) → mergeNearby (funde fragmentos)
   ↓
[modo COR] filtro de NUVEM DE RE-TRAÇO (≥8 extras fracos e pequenos = casca de fonte)
[modo FORMA] regras de MESMO OBJETO (ver §5)
[modo FORMA] passe CORPO DELETADO POR COR (ver §5)
   ↓
barcode (scanRotAware: tenta 0° e 90°) + QR (jsQR) → item verde "ok" quando confere
   ↓
comps ordenados, counts, overlay
```

`ACEngine.compare(fileCanvas, origCanvas, opts)` retorna:
`{W,H,lab,fileImg,origImg,comps,counts,align:{ox,oy,conf,q,ang,scl},fileRect,origRect,mode,modeAuto,barcode,textRegions,textResid}`

**Tipos de comp:** `miss` (vermelho, faltando no arquivo), `extra` (azul, sobrando),
`diff` (vermelho), `ok` (verde, barcode/QR confere — **não conta como divergência**).
`kind`: `barcode` | `text` | (vazio = pixel).

---

## 5. Os filtros — por que cada um existe (NÃO REMOVER SEM ENTENDER)

Cada regra nasceu de um caso real. A bancada (§7) protege todas.

| Filtro | Onde | Por quê |
|---|---|---|
| **Nuvem de re-traço** | modo COR, antes do merge | Clicheria re-compõe fonte mais fina → dezenas de "extras" fracos (casca do glifo). ≥8 extras com força<170 e área<400 = nuvem → remove. Aplicado **antes** do merge (senão a casca se funde com um miss real e o mata). Depois do merge, 2ª etapa remove resíduos (área<30, força<160), **poupando pontuação plena** (área≥5, força≥140, fill≥0.55 — é o ponto final da Coca). |
| **Mesmo objeto (A)** | modo FORMA | Overprint × trapping é **tom sobre tom**: lum média do comp quase igual nos 2 lados (\|ΔLum\|≤20) e corpo ralo (fill<0.5) = casca do mesmo objeto → some. |
| **Fio de faca (B/B2)** | modo FORMA | Filete ≤3px de espessura e ≥40px longo, na borda do canvas/arte, ou com cor da mesma família nos 2 lados = linha técnica → some. |
| **Elemento técnico fora da arte (C)** | modo FORMA | `miss` com o arquivo BRANCO ali, além da caixa de tinta do arquivo = barra de dobra/corte do original → some. |
| **Corpo deletado por cor** | modo FORMA, depois das textRegions | **Insight do Henrique:** trapping só ESTENDE o mesmo pixel; deleção real muda a COR. Passe extra por cor (slack 1): CC compacto (área 6..400, min dim≥3, fill≥0.5), \|ΔLum\|≥40, força≥120, fora de comps/textRegions/faixa técnica → vira miss/extra. **É isso que faz o ponto do ":" aparecer** mesmo com o irmão a 3px (o trapTol sozinho o engoliria). |
| **Faixa técnica** | idem | Linha y com >50% da largura escura nos 2 lados = barra de acabamento; marcas de controle ali não são arte. |
| **Máscara de foto** | ambos | `photoF ∩ photoO` (rects lidos do pdfium) = re-tratamento de imagem → silencioso. |
| **Ruído sub-pixel (D)** | modo FORMA | comp sem kind com área ≤12 **e** força <120 = resto de alinhamento. Pontuação real é pequena mas FORTE (≥120) e sobrevive. |

### Camadas técnicas ocultadas sozinhas (`main.js`, no carregamento)

`TEC_RE` = branco/white, verniz/varnish/uv, faca/corte/cut/dieline, vinco/crease, cotas,
medidas, registro, marcas, sangria/bleed, guias. **Por que é obrigatório:** o pdfium é
renderizador de tela e **não simula overprint**; as tintas de acabamento (Branco de
suporte, Verniz) são pintadas OPACAS por cima e a arte sai irreconhecível — no caso DUX
o encaixe caía para 4% e tudo virava divergência. Ocultá-las é o mesmo efeito de abrir
com "Overprint Preview". O operador pode religar qualquer uma no ⚗ Limpar.

### Trapping ≠ conteúdo (caso DUX 590000)

Arquivo tratado com **spread de trapping** tem o texto visivelmente mais GORDO que o
original. Consequências e tratamentos:

- `breathe` (§4) detecta o engorde global e liga o modo FORMA (`al.breathe`, `al.nEdge`).
- O **passe "corpo deletado por cor" é DESLIGADO** quando `breathe > 0.65`: com engorde
  global ele gera centenas de fragmentos falsos. Nesse cenário quem acha a troca é o OCR.
- A **faixa técnica** (`bandaTec`) só vale para banda FINA (≤10% da altura) encostada no
  topo/base. Sem esse recorte, um rótulo de FUNDO PRETO tinha a arte inteira classificada
  como faixa técnica e o erro real era engolido.

---

## 6. Fluxos do painel (`main.js`)

- **Panes** `O` (original) e `F` (arquivo): `{src, rawSrc, rot, crop, pdf, bytes, srcPath, page, hideL, hideImg, struct}`.
- **Rotação** (`pane.rot`, 0/90/180/270): **vale na comparação**. `renderPaneCv` renderiza
  sem crop → gira → aplica o crop (o recorte é desenhado sobre o preview já girado).
  `rotFrac`/`rotFracInv` convertem retângulos entre o espaço cru da página e o girado
  (usados em `photoRectsOf` e `renderCropsHi`).
- **Limpar (⚗)**: só **camadas** (`buildPrepUI`). Desmarcar = `applyHidesOn` chama
  `ACPdf.setLayerActive(...false)` em **todo** render (preview, comparação, OCR) — o PDF
  é recomposto sem a camada; o arquivo em disco não muda.
> ### ⚠ OCR de texto DESLIGADO — detecção agora é 100% PIXEL (23/07/2026)
> `applyOcrTextCheck()` no `main.js` faz **`pdfDone(); return false;` logo no início** — o
> OCR de conferência de texto (v22 por token, v23 por string inteira) **não roda mais**:
> ele entregava FOTO/gráfico ao tesseract e emitia **falsos** (a "linha 0" do Perdigão era a
> foto do fogão). GlobalVision de verdade = **registro + diff de pixel + apresentar a região**;
> o OCR só rotularia. Constraint do Henrique: **sempre original × tratado** (rev×rev não serve).
>
> **Como o texto é pego SEM OCR (modo forma):** o passe **"corpo deletado por cor"** (§5) é
> trapping-robusto ("trapping ESTENDE o pixel, não muda a COR") e crava as deleções reais:
> dLum≥40, força≥120, fill≥0.5, área 6..400. Duas correções de 23/07 pra ele funcionar com o
> OCR off:
> 1. **Não pula mais textRegion** (linha ~1080): a deleção real (`l` do "200 ml", `R` do
>    "INGR") caía numa região de texto re-estilizada e sumia (virava marcador vago). Os
>    critérios estritos já garantem que é deleção, não trapping.
> 2. **Dedup ignora marcador de texto** (`kind:"text"`): senão o marcador vago engolia a
>    deleção real por sobreposição.
>
> **LIMPEZA FORMA** (novo passe no fim do `compare`, antes do sort): assinatura por BBOX
> (ink% dos 2 lados) separa edição real (fill ASSIMÉTRICO) de falso. 4 regras — R1: objeto
> grande RE-TONALIZADO (logo/texto, tinta cheia+simétrica >90% nos 2, área>500) → some; R2:
> fragmento pequeno-fraco (área<30 e força<140) → some; R3: tira de sangria na borda (dLum<25);
> R4: sliver de 1px. **Validado (bancada, 23/07): Coca = R+l+ponto (3) + QR verde, 0 falso, 4s.**
>
> **Ainda pendente (bucket do muro de trapping):** DUX `28→29` (o `breathe=0.82` DESLIGA o
> passe corpo-por-cor; o 28→29 vira só marcador de texto escondido) e Perdigão `0763` (o
> registro senta na trama re-amostrada — ver "muro do Perdigão" abaixo). Perdigão JÁ mostra o
> **código de barras** (placeholder "APLICAR CÓD DE BARRAS" no original × barras reais no
> tratado), via módulo barcode. Backup do OCR: `scratchpad/backup_v23_string_wip/` e
> `backup_v22_conservador_ref/`.
>
> ### 🎚 SENSIBILIDADE (Baixa/Média/Alta) — o operador escolhe o filtro (estilo GlobalVision)
> O programa é pra **CAPTURAR erro** (recall-first): melhor ver o erro com alguns falsos do que
> não ver. `opts.sens` (0/1/2) no `compare.js`; seletor no painel (`.sens-row` no index.html,
> `setSens()`/`_sensLevel` no main.js, `readTol()` passa `sens`):
> - **Baixa (0)** — detecção limpa (corpo-por-cor + LIMPEZA FORMA). **Coca = 3+QR, 0 falso, ~4s.**
>   Use em revisão×revisão / arte limpa.
> - **Média (1)** — passe corpo-por-cor ligado SEMPRE (sem gate de `breathe`) + força+cluster no flood.
> - **Alta (2)** — + **registro LOCAL suave** (warp por blocos 96px ±6, shift interpolado bilinear
>   = sem emenda) + **desmascara imagem de página inteira** (o texto sobre a trama do Perdigão
>   aparece) + **força ≥147** (trapping é mais fraco) + **cluster** (troca real agrupa; textura é
>   speckle espalhado). No flood moderado (gate `nKind0>15`) filtra por força (THs Alta **130** —
>   o 28→29 branco-no-escuro é fraco ~140) e **MESCLA** (RCL 95): o parágrafo trapado vira 1 caixa.
>   **Perdigão Alta = 8 marc. (0763) + barcode, ~20s; DUX Alta = 2 marc. (28→29 + 1 falso mesclado),
>   ~21s.** O trapping de texto branco-no-escuro tem a MESMA força da troca — só o merge reduz.
>
> Alavanca central (lembrete do Henrique): **força** separa trapping (fraco, ≤~140) de edição real
> (≥147). Overprint no preview: pdfium **não simula** (testado) — o warp+força cobre o objetivo.
>
> O texto abaixo descreve o OCR guiado **como era** (mantido p/ referência):

- **OCR guiado** (só quando há `textRegions` = só no modo forma): fase A lê as linhas das
  regiões a partir das imagens já alinhadas; fase B re-renderiza o token em alta resolução
  nos 2 lados pra confirmar (anti-falso). **Três coisas que a fase B exige — se faltar
  qualquer uma, a troca real é descartada (já aconteceu 2×):**
  1. `toPageRect` mapeia o lado **F** (usa `fileRect`).
  2. `toPageRectO` mapeia o lado **O**: desfaz `align.ox/oy` **e** usa `origRect`
     (as páginas têm tamanhos diferentes — Perdigão: 2147 × 2132 px). Usar `fileRect`
     no original faz ele reler o lugar errado, vir vazio e matar o `0763→0591`.
  3. **Coerência fase A ↔ fase B**: o número da fase A (≥3 dígitos) tem que reaparecer
     na releitura **do mesmo lado**. Sem isso, duas leituras ruins de trechos diferentes
     "confirmam" troca inexistente (falso `SETOR41→SETORA1`).
  4. **Via direta**: se o número da fase A aparece num lado e **não** no outro, confirma
     mesmo que a regra de comprimento reprove (as releituras pegam contextos diferentes).
- **Regiões por RESÍDUO CONCENTRADO** (`textcheck.js` passo 5b): a métrica por linha
  DILUI uma troca curta num parágrafo (um dígito dá rf≈0,02 < 0,15). O passo 5b agrupa o
  residual numa grade de ~1 caractere e, com ≥25px num aglomerado, cria região
  (`conc:true`) — é o que faz o OCR enxergar o `28→29`. Trapping não gera residual
  (a dilatação cobre), então não dispara à toa. No `main.js`, região `conc` **pula o
  filtro de densidade** da linha (senão morreria pelo mesmo motivo).
- **Relatório**: destino = `<pasta do job>/reference` (**sem underline**). Se o original
  não veio do job → **exige a O.S.** (`acPastaJob` no host). Engine fora → Desktop com aviso.
  Inclui seção "Ignoradas" (o que o operador dispensou, com motivo).
- **Barra de status**: `encaixe NN%` (= `align.q`). Abaixo de 88% → aviso vermelho
  "AJUSTE O RECORTE e compare de novo".
- **Viewer (zoom/pan)**: tudo por **CSS transform** (`translate3d + scale`, origem 0 0)
  no `#overlayCanvas` — GPU, sem reflow/scroll (era `style.width` + scroll do wrap, e
  por isso travava). Estado: `OVZ` (1 = fit), `OVX/OVY` (px). `ovBase()` calcula a
  escala de fit (largura **e** altura); a escala aplicada é `fit × OVZ`. Regras:
  - `ovZoomAt(f, mx, my)` mantém o ponto sob o cursor: `OVX = mx − (mx − OVX)·(z/z0)`.
  - `ovClamp()` só impede a arte de sair da janela — **nunca força o centro** (forçar
    atropelava a âncora e dava o "zoom vai pro lado errado"). O centro é aplicado só
    no `ovReset()` (fit).
  - Roda = zoom no cursor (passo contínuo `exp(−deltaY·0.0022)`, trackpad-friendly);
    arrastar = pan (via `requestAnimationFrame`); Shift+arrastar = retângulo de zoom;
    botão direito = afastar; 2 cliques = fit. Zoom máx **4000%** (`OVZMAX = 40`).
  - Clicar num item da lista chama `ovFocus(cx, cy, zMin)` — centraliza a divergência
    e aproxima o suficiente pra ela aparecer (nunca afasta o que o operador ampliou).
- **Tela cheia de inspeção** (`#ovFull`, botão ⤢): **move o próprio `#ovWrap`** para o
  container (não duplica canvas) — zoom, marcações e piscar continuam os mesmos objetos.
  `fsOpen`/`fsClose` guardam o lugar de origem (`FS_HOME`) e chamam `ovReset()` depois
  do layout medir. Barra própria com piscar/ver-original (espelham os checkboxes
  originais), navegação ‹ ›, % e ✕. Atalhos: `Esc` sai, `←/→` navegam, `B` pisca, `F` fit.

---

## 7. Bancada de aceite (scratchpad) — RODAR ANTES DE ENTREGAR

Scripts em `%TEMP%\claude\<slug>\<session>\scratchpad\` (stubs de DOM + motor real):

| Comando | Caso | Resultado esperado |
|---|---|---|
| `node bench.cjs coca` | Coca revisão × revisão | **3 miss** (R, l, ponto final) + **QR verde** |
| `node bench.cjs cocapdf` | Coca original × tratado (`original.pdf` × `422433_rev00_v00_UN.pdf`) | **3 miss + QR verde**, encaixe 97% |
| `OFFTEST=1 node bench.cjs cocapdf` | idem, com recorte deslocado | **mesmos 3 + QR** (prova estabilidade) |
| `node bench633.cjs` | HEIMAT (`1763457_141021_ori.pdf` rot 90 × `633593_rev00_v00_UN.pdf`) | com o arquivo íntegro: **0 divergências**. Com os 3 objetos removidos no teste: selo + vírgula + ponto do ":" + barcode verde |
| `node --max-old-space-size=6144 bench.cjs perdigao` | Perdigão (`1713231_031054_ori.pdf` × `561794_rev02_v00_UN.pdf`) | **`0763→0591` + barcode a mais, 0 falsos.** Roda na bancada com o flag de memória (~4 min) |

| `HIDETEC=1 ROTO=90 node bench.cjs dux` | DUX (`590000_rev00_v00_UN.pdf` × `1765789_201509_ori_teste.pdf`, original girado 90°) | **`289→29g`** (= o "(28 g)" → "(29 g)") + marcadores de região que o painel remove após o OCR. Encaixe 93% |

> Os PDFs vivem no Desktop do Henrique e **somem quando ele limpa a área de trabalho**
> (já aconteceu com `original.pdf` da Coca e o par do HEIMAT). Se o bench der ENOENT,
> é isso — peça o arquivo, não caia investigando o motor. A Coca-revisões roda de
> `.bin` salvos no scratchpad e por isso sempre funciona.

**Qualquer mudança no motor tem que passar Coca (cor) E 633 (forma) — são os dois polos.**

Outros utilitários: `mkzip.cjs` (ZIP Mac), `manual.cjs` (manual PDF), `replay.cjs`
(reconstrói a extensão a partir dos transcripts — usado no rollback de 14/07).

---

## 8. Histórico curto (o que já se tentou e falhou)

- **Detector de "caractere deletado" por pixel** (comparar casca): **não funciona** —
  medi rF/rO/fill/distância e a assinatura de uma letra apagada é idêntica à da casca de
  re-peso. Só a **cor** (§5) separa. Não tentar de novo.
- **Normalização anisotrópica** (razão de caixa de tinta): implementada, ficou inerte —
  a diferença de proporção na Coca era painel extra de manga, não distorção de sleeve.
- **trapTol menor** para pegar pontuação: traz os falsos de trapping de volta e **não**
  recupera o ponto. Trapping e verificação são configurações separadas (§5).
- **Rollback pré-Cloreto (14/07)**: motor voltou por replay dos transcripts. A versão v18
  (com auto-zoom, pontuação, moved, barcode fallback) está em
  `scratchpad/backup_v18_pos_cloreto/` — features de lá podem ser re-portadas sob demanda.

---

## 9. Estado atual (14/07/2026)

Em **teste de produção** (1 semana). Todos os casos da bancada passando. Últimas entregas:
encaixe honesto + auto-retentativa, rotação válida na comparação, limpar só camadas
(sem GenerateContent), barcode em pé, relatório na pasta `reference` com O.S. obrigatória,
regras de mesmo objeto/overprint, corpo deletado por cor. Manual em
`Desktop/AlphaCompare_Manual.pdf`; ZIP Mac em `Desktop/AlphaCompare_Mac.zip`.

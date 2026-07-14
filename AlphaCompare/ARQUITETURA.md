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
- **OCR guiado** (só quando há `textRegions`): fase A lê as linhas das regiões a partir
  das imagens já alinhadas; fase B re-renderiza o token em alta resolução nos 2 lados
  pra confirmar (anti-falso). `toPageRect` (lado F) e `toPageRectO` (lado O — **desfaz o
  offset do alinhamento**; sem isso o original é lido no lugar errado).
- **Relatório**: destino = `<pasta do job>/reference` (**sem underline**). Se o original
  não veio do job → **exige a O.S.** (`acPastaJob` no host). Engine fora → Desktop com aviso.
  Inclui seção "Ignoradas" (o que o operador dispensou, com motivo).
- **Barra de status**: `encaixe NN%` (= `align.q`). Abaixo de 88% → aviso vermelho
  "AJUSTE O RECORTE e compare de novo".

---

## 7. Bancada de aceite (scratchpad) — RODAR ANTES DE ENTREGAR

Scripts em `%TEMP%\claude\<slug>\<session>\scratchpad\` (stubs de DOM + motor real):

| Comando | Caso | Resultado esperado |
|---|---|---|
| `node bench.cjs coca` | Coca revisão × revisão | **3 miss** (R, l, ponto final) + **QR verde** |
| `node bench.cjs cocapdf` | Coca original × tratado (`original.pdf` × `422433_rev00_v00_UN.pdf`) | **3 miss + QR verde**, encaixe 97% |
| `OFFTEST=1 node bench.cjs cocapdf` | idem, com recorte deslocado | **mesmos 3 + QR** (prova estabilidade) |
| `node bench633.cjs` | HEIMAT (`1763457_141021_ori.pdf` rot 90 × `633593_rev00_v00_UN.pdf`) | com o arquivo íntegro: **0 divergências**. Com os 3 objetos removidos no teste: selo + vírgula + ponto do ":" + barcode verde |
| `node bench.cjs perdigao` | Perdigão | `0763→0591` + barcode a mais. **Só no painel** (a RAM da máquina barra o bench) |

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

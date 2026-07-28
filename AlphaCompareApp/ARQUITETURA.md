# Alpha Proof — Arquitetura

App **Electron** de conferência **original (cliente) × arquivo tratado**, estilo Precision
Proof / GlobalVision. Nasceu porque o painel CEP (AlphaCompare) não conseguia pegar trocas
de texto **pixel-invisíveis** (ex.: DUX `(28 g) → (29 g)`) em tempo/ruído aceitáveis — o
gargalo era o **OCR WASM lento** e a **detecção de linha fraca** do sandbox do CEP.

> **É `Alpha*` → NÃO vai para produção.** Só commit no git. Nunca copiar para a pasta de rede.

## Por que existe (o que ficou provado)

O Precision Proof é rápido por **OCR nativo (C++)** + **rede de detecção de linha** — não por um
algoritmo mágico. Medido (`AlphaCompare/scratchpad/proof_ocr.py`):

| | OCR nativo (RapidOCR) | Sweep WASM (CEP) |
| --- | --- | --- |
| Tempo / caso | **~20s** (quente ~16s) | 352–451s |
| Acha a linha | automático (detecção) | falhava (RLSA à mão) |
| Pega DUX 28→29 | **SIM** | não |

Trocar o tesseract-WASM por **RapidOCR nativo** (ONNX, CPU, offline) fora do sandbox resolve
os dois muros de uma vez. Este app é isso.

## Decisão de arquitetura: **o painel AlphaCompare RODA dentro do Electron**

Como Electron = Chromium + Node, o painel CEP inteiro (`AlphaCompare/com.alpha.compare`) roda sem
mudança — então a **tela, zoom, botões, overlay, lista de divergências, relatório = idênticos** ao
painel. O que muda é só a **plataforma** e um **motor a mais**:
- **Shim** (`src/panel/js/cep_shim.js`) substitui as APIs do CEP (`__adobe_cep__.evalScript`,
  `getHostEnvironment`) por **Node**: Desktop, Engine (`\\aeserver16\Engine`), job, pasta `reference`.
- **Motor pixel** (o `compare.js` do painel, WASM) continua pegando objeto/faca/foto/código/QR.
- **Motor de texto NATIVO** (RapidOCR) entra acoplado no hook `applyOcrTextCheck()` → funde os diffs
  de texto no `RESULT` (viram `kind:"text"`, aparecem no overlay/lista/zoom/relatório iguais).

```
Puxar do Job (Engine) / Desktop  →  render pane (pdfium)  →  COMPARAR
   │                                                            │
   │                                   pixel (compare.js WASM) ─┤→ RESULT.comps
   │                                                            │
   └─ src/engine (NATIVO): render → ocr.js (sidecar RapidOCR) → textdiff.js ─┘
        └ mergeNativeDiffs() mapeia coords (RESULT.W / arqW) e funde no RESULT
```

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `main.js` | Processo Electron: janela (carrega `src/panel/index.html`), diálogos, **resolve o Python**, laudo, log do renderer. |
| `src/panel/` | **Cópia do painel AlphaCompare** (index.html, css, js, lib, img) — a UI inteira. |
| `src/panel/js/cep_shim.js` | **Novo**: `window.__adobe_cep__` em Node — Desktop/Engine/Job/reference (host.jsx portado). |
| `src/panel/js/nativeocr.js` | **Novo**: ponte do painel → `src/engine/compare.run()` (OCR nativo). Passa o Python. |
| `src/panel/js/main.js` | Painel (editado): `applyOcrTextCheck()` chama o OCR nativo; `mergeNativeDiffs()` funde no RESULT. |
| `src/engine/render.js` | Render pdfium → RGBA + PNG. `hideTec`, `rotImg` (0/90/180/270), `imageRects`. |
| `src/engine/ocr.js` | Cliente do sidecar: sobe 1 processo Python (modelo 1×), fala JSON por linha. |
| `src/ocr/ocr_server.py` | Sidecar **RapidOCR/ONNX**. stdin `{id,path}` → stdout `{id,ok,lines[]}`. |
| `src/engine/textdiff.js` | **Núcleo texto**: âncoras → offset local → LCS de palavras → filtro de confusão. |
| `src/engine/compare.js` | Orquestrador do motor nativo (`run()`) + CLI: `node src/engine/compare.js <arq> <ori> [rot]`. |
| `lib/pdfium/` | pdfium WASM do motor nativo (self-contained). |

> O sidecar precisa de PDF **em disco** (job/Desktop dão caminho). Arquivo arrastado (bytes, sem
> caminho) roda só o pixel. Coord do texto mapeada por `RESULT.W / arqW` (página inteira, mesma
> rotação); crop desliga o OCR nativo por ora.

## Regras que NÃO podem ser violadas

1. **Dígito diferente = SEMPRE erro real** (é o alvo: 28/29, 0763/0591). Nunca filtrar.
2. **Confusão de OCR = ruído** (não reportar): `0↔O↔o`, acento, caixa, pontuação, pares clássicos
   (rn/m, cl/d…), e letra-só muito parecida (Levenshtein ≤2 e ≤34%). Ver `confus()` em `textdiff.js`.
3. **Pareamento por POSIÇÃO com offset LOCAL** (âncoras = linhas idênticas únicas). Um offset
   global não corrige o arrasto (~101% de escala entre original e tratado). Sem isso a tabela
   nutricional casa 1 linha deslocada e vira falso em cascata.
4. **Diff palavra-a-palavra (LCS)**, não prefixo/sufixo da linha: isola a troca curta (`(28`/`(29`)
   mesmo quando há erro de OCR em OUTRA palavra da mesma linha (`Adicione`/`Adlclone`).
5. Sidecar **carrega o modelo 1×** e fica vivo — só a 1ª comparação paga o init (~8s).
6. **Sem ES6-only-de-browser no engine** não se aplica aqui (é Node moderno) — mas o código segue
   o estilo dos outros apps (var/function) por consistência com o resto do repo.

## Dependência externa: Python + RapidOCR

O OCR roda por um **sidecar Python** (não achei port Node maduro do PP-OCR). Requisito na máquina:
`python -m pip install rapidocr-onnxruntime` (ONNX, CPU, **offline**, ~150 MB de modelos, sem
torch/paddle). `main.js` **auto-detecta** o Python (env `ALPHAPROOF_PYTHON`, PATH, instalação em
`AppData/Local/Programs/Python`). No empacotamento, os modelos vêm junto no pacote do RapidOCR.

## Estado atual

- **Fase 1 (feita/testada):** módulo de **texto** ponta a ponta. Motor headless pega o DUX
  `(28→(29)` limpo (5 diffs, ~44s frio). UI Electron abre e roda. Laudo em PDF.
- **Coca / Perdigão:** o OCR lê rápido, mas o pareamento por texto sozinho patina quando o
  **original tem aspecto/tamanho bem diferente** (poucas âncoras). **Fase 2:** semear o
  `localOffset` com o **registro do `AlphaCompare/compare.js`** (robusto a rotação/escala) via
  `opts.seed`. Coca também é do módulo pixel (3+QR); Perdigão 0763 é do detector de barcode.
- **Fase 2 (a fazer):** **módulo pixel/gráfico** reaproveitando `AlphaCompare/compare.js` em Node
  (registro + diff trapping-tolerante) para pegar objeto/faca/foto e semear o alinhamento do texto.

## Como rodar (dev)

```
cd AlphaProof
npm install
ALPHAPROOF_PYTHON="<python.exe>" npx electron .     # ou npm start se python estiver no PATH
```
Empacotar (portátil, por causa do bug do winCodeSign/symlink): `npm run dist:win` gera o portátil;
dmg só no Mac. (Ver memórias `electron-builder-wincodesign-symlink`, `electron-run-as-node-gotcha`.)

## Teste headless (sem UI)

```
ALPHAPROOF_PYTHON="<python.exe>" node src/engine/compare.js <arquivo.pdf> <original.pdf> [rotOriginal]
```
Bancada dos 3 casos e a prova de velocidade estão em `AlphaCompare/scratchpad/` (`proof_ocr.py`,
`dux_*_full.png`, etc.).

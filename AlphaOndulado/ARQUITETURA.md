# Alpha Ondulado — Arquitetura

> App desktop (PC + Mac, Electron) que lê um **PDF ripado** de papelão ondulado,
> reproduz a lógica de **grupos por cor** da medição do Ondulado (10_Medicao_Ondulado.jsx)
> — mas **fora do Illustrator** — e gera um **laudo de orçamento em PDF** para clichê.
>
> **Decisão (24/07/2026):** entrada é **exclusivamente PDF** (o arquivo que será orçado).
> O operador digita o **cliente**, escolhe a **espessura** e o **tipo**, informa o **arranjo**
> (ex.: "2 x 2") e digita o **fator (R$/cm²)**. **Não há cadastro de nada.** (Sem O.S.)
>
> **Fórmula (27/07):** `Preço = Σcm²(grupos) × fator × ARRANJO`, onde ARRANJO = produto dos
> dois números (2×2 = 4, 3×1 = 3). Espessura e tipo continuam informativos.
>
> **Decisão (24/07/2026) — grupos REAIS do Illustrator:** o motor principal lê os grupos
> que foram feitos no Illustrator, embutidos no PDF em `/AIPrivateData` (`ai_grupos.js`),
> **sem folga/heurística**. O agrupamento espacial via pdf.js (`pdf_grupos.js`) virou
> **fallback** para quando o PDF **não** traz esses dados (RIP que achatou a arte).

**LEIA ESTE DOCUMENTO PRIMEIRO.** É a base do projeto. Toda mudança estrutural
deve ser refletida aqui.

---

## Regra de deploy (herdada do CLAUDE.md)

`AlphaOndulado/` começa com `Alpha` → **projeto interno, NÃO vai para produção.**
Único destino é o **commit no git**. Nunca copiar para a pasta de rede da produção.

---

## Por que existe

O orçamento de clichê de ondulado é cobrado por **área (cm²)** das placas. A medição
oficial (`10_Medicao_Ondulado.jsx`) roda **dentro do Illustrator**, varre os `GroupItem`,
acha a **cor predominante** de cada grupo (spot mais frequente) e mede o bounding box.
Este app faz o **mesmo raciocínio** direto sobre o **PDF ripado**, sem depender do
Illustrator estar aberto, e transforma isso num **laudo de orçamento** (estilo Alpha Faca).

---

## Regras de negócio (decididas com o operador)

1. **Grupos por cor** — 3 grupos de preto = "preto em 3 partes", cada um com sua medida.
   **Sem índice numérico** (1/2/3) no laudo: só listar cada grupo (a produção pode inverter
   a ordem). Espelha o `corPredominanteDoGrupo` do JSX, mas ao nível de **cor + cluster
   espacial** (ver Pipeline).
2. **Área por cor** = **soma** das áreas de todos os grupos daquela cor.
3. **Preço = Σ(área de todos os grupos, cm²) × fator.** O **fator (R$/cm²)** é digitado
   pelo operador que gera o relatório.
4. **Espessura** (2,84 / 3,96 / 5,00 / 6,35 mm) e **tipo** (Repremontagem / Clichê /
   Alteração) são **informativos** no laudo — **não entram na conta**.

---

## Pipeline

```
Upload (PDF ripado)
  → [MOTOR PRINCIPAL] ai_grupos.js  lê /AIPrivateData (arte PGF do Illustrator):
        u/U = grupos reais · (nome) Xx = spot real · c m y k = cromia · m/L/C = geometria
        → cada GRUPO do topo de uma layer de arte = 1 placa (igual ao 10_Medicao_Ondulado)
        → cor predominante (spot > cromia, ignora branco/none/registration) + bbox → cm²
  → [FALLBACK] pdf_grupos.js (só se o PDF NÃO traz /AIPrivateData): pdf.js getOperatorList
        → MARCAS {cor RGB, bbox} → clusteriza espacialmente (folga 4mm) → grupos → cm²
  → Σ área de todos os grupos = totalCm2
  → Motor de custo (custo.js)  preço = totalCm2 × fator
  → Laudo PDF (relatorio.js)   identidade Alpha, cores destrinchadas, via printToPDF (main.js)
  → Banco local (main.js)      salvar / reabrir / mudar fator / re-salvar / excluir
```

### Como os grupos REAIS são lidos (`ai_grupos.js`)  ✅ VALIDADO em PDF real
Illustrator salva PDF "com capacidade de edição" (checkbox **Preservar recursos de edição
do Illustrator**, ligado por padrão) embutindo a **arte no formato interno (PGF)** dentro do
`PieceInfo/Illustrator`. Três layouts de armazenamento, todos cobertos:
`/AIPrivateData1..N` · `/AIPDFPrivateData1..N` · `/Private N 0 R` (antigo, 1 objeto).

**Compressão da arte (3 casos, todos tratados):**
1. **Zstandard** (Illustrator 2020+/AI24) — marcador `%AI24_ZStandard_Data` + frames com
   magic `28 B5 2F FD`. Descomprimido com **`fzstd`** (decoder puro-JS, sem build nativo →
   não quebra o portátil). **É o caso do arquivo real testado.**
2. **FlateDecode** (zlib) nos objetos-chunk → `zlib.inflateSync`.
3. **Texto plano** (AI antigo) → usado direto.

Operadores lidos da arte PGF (espelha o `10_Medicao_Ondulado.jsx`):
- **`u` / `U`** e **`*u` / `*U`** = begin/end **group** (grupos reais, aninhados) → grupo de
  **nível 1** sob uma layer de arte = **1 placa** (= `layer.pageItems` de topo do JSX).
- **`… (nome) tint x` / `X`** (AI24) e **`… (nome) … Xx` / `XX`** (outras versões) = fill/
  stroke **spot** com o **nome real** em texto (ex.: `(preto)`, `(vermelho)`, `(PANTONE 288 C)`)
  → cor predominante = spot mais frequente. Cor contada no **set** da cor (1 set = 1 uso).
- **`c m y k` / `g`** = cromia/cinza (fallback quando não há spot).
- **`m L l C c V v Y y`** = geometria → bounds do grupo (pt → mm → cm). **Medição por
  SUBPATH = bounds VISÍVEL** (igual `getVisibleBoundsDeep`): cada subpath é classificado no
  seu operador de pintura — `f/F/s/S/b/B` = **conteúdo** (entra no bounds), `n/N` = **máscara
  de clip** (não entra como conteúdo). Bounds do grupo = união do conteúdo **intersectada**
  com a máscara (`boxInter`); sem máscara → só o conteúdo pintado. Em arquivo sem clip o
  resultado é idêntico ao bruto (validado: `teste.pdf` seguiu batendo 100% com o XML).
- **`… Lb` / `(nome) Ln`** = layers por nome → **pula layers técnicas**
  (`faca/cut/cotas/registros/label/borda`), igual ao `isLayerTecnica`.

**Bancada (24/07) — PASSOU, bate com a medição oficial:** `teste.pdf` = job **1377974**
(PENHA SA, Illustrator 26.0, zstd). Comparado com o `1377974_AI_STAGGERED.xml` gerado pelo
`10_Medicao_Ondulado.jsx` DENTRO do Illustrator: **6 placas, 6 batem** (dimensão por dimensão,
só arredondamento sub-0,1 mm), **3 cores certas**, **agrupamento idêntico** (vermelho 3 /
amarelo 1 / preto 2). Área total app **2773,26 cm²** vs oficial **~2773,49** (0,008%). Casos:
`vermelho3`=39,6×27,9 · `vermelho2`=16,3×18,2 · `vermelho1`=1,1×4,0 · `amarelo`=39,4×27,9 ·
`preto2`=16,5×15,9 · `preto1`=1,1×4,0. **A máscara de clip não afetou este job.** O fallback
espacial dava 92 grupos (superdividido) — o motor AI dá a **estrutura verdadeira**.

**Resposta a "funciona em arquivo de outra máquina?":** sim, desde que salvo do mesmo jeito
(PDF com edição preservada). Não depende de máquina; cobre zstd/zlib/texto e os 3 layouts.
**Só NÃO funciona** se salvarem sem edição ou se um **RIP achatar/normalizar** e remover o
`AIPrivateData` → cai no fallback espacial (badge amarelo).

**Pendências de precisão:** (a) ~~máscara de clip~~ **FEITO** (medição por subpath, conteúdo
∩ clip); falta um job REAL com clip pra confirmar o encolhimento na prática; (b) confirmar
operadores de cor/paint de outras versões do Illustrator; (c) decompressão + parse de ~1,7 MB
rodam síncronos no renderer (ok hoje; mover p/ worker se travar em arte muito pesada).

### Como a cor é lida (o ponto delicado)
- O `pdf.js` **converte** qualquer cor de preenchimento para **RGB** na operator list
  (`OPS.setFillRGBColor`). Não expõe o nome da spot ali.
- **Cromia pura** (preto/ciano/magenta/amarelo/vermelho/verde/azul) é reconhecida por
  faixa de RGB (`classificarCor`) — equivale ao `corCromiaPura` do JSX.
- **Nomes de spot reais** (pantones, "preto" nomeado) são lidos por **varredura do PDF
  cru** atrás de `/Separation /Nome` e `/DeviceN [ … ]` (`lerNomesSeparacao`) e usados
  como **sugestão**. O casamento sugestão→cor ainda é **por ordem** (heurístico) — a
  calibração fina depende de PDFs reais.
- **O operador confirma/edita o nome de cada cor na UI** (campo editável). Isso torna o
  laudo robusto mesmo quando a detecção automática erra o nome.

### Parâmetros de ajuste (constantes no `analisarPdf`)
- `gapMM` (default **4 mm**) — folga máxima para dois traços caírem no **mesmo grupo**.
  Exposto na UI ("Folga p/ agrupar"); mudar re-extrai.
- `areaMinCm2` (default **0,02 cm²**) — descarta grupos minúsculos (cisco/registro).
- Branco/quase-branco (`ehQuaseBranco`, RGB ≥ 250) é **ignorado** (papel/fundo), igual ao
  `spotEhBranco` do JSX. Registration/none não são detectáveis por RGB — se virarem ruído,
  filtrar por área/posição.
- **Imagem** no PDF (`OPS.paintImage*`) → `temImagem=true` → **aviso** ao operador (a cor de
  imagem não vira placa confiável, mesma regra do `docTemImagem` do JSX).

---

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `main.js` | Processo Electron: `open-pdf`, `gerar-pdf-laudo` (printToPDF), `abrir-arquivo`, e o **banco de orçamentos** (`salvar-/listar-/abrir-/excluir-orcamento`). |
| `src/index.html` | Shell da UI: 2 telas (**Novo laudo** / **Orçamentos salvos**); upload, formulário, resumo, preview, tabela de cores, badge da fonte. |
| `src/style.css` | Identidade Alpha (navy/teal, Poppins, dark mode). |
| `src/renderer.js` | Orquestra: upload → **AI primeiro / fallback espacial** → preview + tabela editável → recálculo ao vivo → salvar/reabrir/excluir → laudo. |
| `src/ai_grupos.js` | **MOTOR PRINCIPAL**: lê `/AIPrivateData` → parser da arte PGF (grupos `u/U`, spots `Xx`, cromia, geometria) → placas por cor + cm². |
| `src/pdf_grupos.js` | **FALLBACK**: operator list do pdf.js → marcas → clusters espaciais (folga 4mm) → cm²; nomes de Separação; render do preview (`renderPaginaUm`). |
| `src/custo.js` | **Motor de custo** (Σcm² × fator) + `brl`/`num` pt-BR (sem Intl) + listas ESPESSURAS/TIPOS. |
| `src/relatorio.js` | Monta o **HTML do laudo** (identidade Alpha, cores destrinchadas). |
| `src/assets/logo_alpha.png` | Logo oficial (compartilhado com o Alpha Faca). |
| `test_extrator.js` | Teste **headless** do extrator no Node: `node test_extrator.js arquivo.pdf [gapMM]`. |

---

## Convenções técnicas

- **Unidade**: pontos PDF → mm por `× 25.4/72` (`PT_TO_MM`); mm → cm por `/10`. Validado:
  `etiqueta_cor.pdf` deu página 150×29 mm (coerente).
- **CTM**: `save/restore` empilham; `transform` multiplica; cada traço tem seu bbox já em
  espaço de device (pontos do documento). Não aplicamos o viewport do pdf.js na medida
  (só no preview) — a medida sai em espaço de usuário do PDF.
- **constructPath**: consome sub-ops (`moveTo/lineTo/curveTo/curveTo2/curveTo3/rectangle`)
  transformando cada ponto pelo CTM corrente.
- **Só conta em ops de PINTURA** (`fill/eoFill/stroke/…`). `clip`/`endPath` são descartados
  (não viram placa).

---

## Banco de orçamentos salvos (local)

`main.js` grava em `app.getPath("userData")/orcamentos/`:
- `index.json` = lista leve (metadados: id, nomeArquivo, cliente, espessura, tipo, fator,
  totalCm2, preço, data). Mais recente primeiro.
- `<id>.json` = registro completo (job + `analise` enxuta com cores/grupos + `previewDataUrl`).
- `id = "AO" + Date.now()`.

Fluxo (tela **Orçamentos salvos**): cada orçamento é **salvo com o nome do arquivo PDF**.
`salvar-orcamento` cria (id novo) ou **atualiza** (mesmo id → dá pra **mudar o fator e
salvar de novo**). **Abrir** recarrega job + tabela + preview a partir do `<id>.json` (não
precisa do PDF), marca `state.editId` e permite re-salvar. **Excluir** remove `<id>.json` +
entrada do índice (confirma antes). Nome da cor é editável e persiste no registro.

---

## UI (2 telas) e Orçamento PDF (27/07)

- **Novo orçamento**: upload → grupos → form (cliente, espessura, tipo, **arranjo**, fator) →
  resumo ao vivo → **Salvar** / **Gerar orçamento PDF**. Re-salvar na mesma sessão atualiza o
  mesmo registro (`novo.savedId`).
- **Orçamentos** (lista + editor na MESMA tela): **busca inteligente** (`norm` sem acento,
  por tokens, casa em cliente+nomeArquivo). Clicar numa linha ou **Editar** abre o **editor
  inline** (não navega p/ Novo): muda cliente/espessura/tipo/arranjo/fator, **Salvar
  alterações**, **Gerar orçamento PDF** ali mesmo, **Excluir**, **Voltar**. `edGerar` salva
  antes de gerar (mantém o banco em dia).
- **Orçamento PDF** (`relatorio.js`): título só **"ORÇAMENTO"** (sem "Laudo"/"papelão
  ondulado"), **só o total** (sem valores por grupo — cores viram *chips* com só o nome),
  **cabe em 1 página A4** (`@page` + layout compacto), **sem a frase** abaixo do valor.
  Mostra Arranjo no cabeçalho e no box do cálculo.

## Empacotamento / instalador (27/07)

`npm run dist:win` gera **NSIS** (`dist/Alpha Ondulado Setup <v>.exe`) **e portátil**
(`dist/AlphaOndulado-Portable-<v>.exe`), ~82 MB cada. Config:
- **`npmRebuild: false`** — evita recompilar o nativo `canvas` (dep opcional do pdfjs que
  **não** usamos; o pdf.js roda no renderer com canvas do DOM). Sem isso o build exige Visual
  Studio C++ e falha.
- **`files` inclui `node_modules/fzstd/**/*`** (bug corrigido: sem isso a leitura AI quebra
  no PC do vendedor — o `files` era whitelist e só tinha o pdfjs).
- Rodar o exe: garantir que **`ELECTRON_RUN_AS_NODE` NÃO esteja setado** (senão o Electron
  roda como Node e o app morre — [[electron-run-as-node-gotcha]]). PCs normais não têm isso.
- RAM: ~90 MB no processo principal (normal p/ Electron). `art`/`toks` (~1,7 MB) são locais e
  liberados após o parse.

## Estado / o que falta

- **Fase 1 (feita, 24/07)**: scaffold Electron; fallback pdf.js (grupos por cor + cm²);
  UI, motor de custo (Σcm² × fator), laudo PDF. Testado headless + app abre sem crash.
- **Fase 2 (feita, 24/07)**: **motor AI** (`ai_grupos.js`) lê os grupos REAIS do Illustrator
  do `/AIPrivateData` — incl. **descompressão Zstandard** (AI 2020+) via `fzstd`. **Validado
  no `teste.pdf` real**: layer `arte`, 3 cores reais, 6 grupos, 2773 cm² (vs 92 grupos do
  espacial). Motor AI é o principal, pdf.js vira fallback (badge na UI). **O.S. removida.**
  **Banco de orçamentos salvos** (salvar com nome do arquivo, reabrir, mudar fator, re-salvar,
  excluir). Sintaxe OK, custo/laudo testados, app abre sem crash (com fzstd carregado).
- **PENDENTE — CALIBRAÇÃO com PDF real**: falta rodar em **PDFs ripados de ondulado reais**
  para (a) **confirmar que o RIP conserva o `/AIPrivateData`** (senão cai no fallback), e
  (b) afinar o parser PGF (limites de grupo `u/U`, operadores de cor/paint não vistos ainda,
  bounds de curva). **Bancada de aceite = comparar área total + contagem de grupos/cores do
  app com o `_AI_STAGGERED.xml` do mesmo job.** Os PDFs auxiliares do repo (etiquetas) usam
  esquemas de armazenamento diferentes e NÃO são representativos.
- **Enhancements**: histórico de laudos (como no Faca), logo do cliente no laudo,
  empacotamento (portátil Windows / dmg Mac — ver saga do NSIS no Alpha Faca).

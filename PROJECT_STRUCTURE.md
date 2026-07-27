# PROJECT_STRUCTURE.md

> Mapa vivo do projeto. Mantido atualizado para acelerar análises futuras.
> Regras de código e fluxo ficam em [claude.md](claude.md). Este arquivo é o **mapa**: o que existe, o que faz, o que depende de quê.
> Última atualização: 2026-06-12 (convenção etiqueta→layer "Cotas")

---

## 1. Visão geral

Automações Adobe Illustrator 2022 em ExtendScript (JSX) para pré-impressão flexográfica.
Dois fluxos principais, cada um com seu menu orquestrador:

* **Flexivel/** — fluxo flexografia/filme
* **Ondulado/** — fluxo papelão ondulado
* **Raiz/** — scripts avulsos (cotas, checklist, testes)

Além dos dois fluxos JSX, há **apps Electron internos** (`Alpha*`, só commit, nunca
produção): **AlphaFaca/** (orçamento de faca via DXF, ver `AlphaFaca/ARQUITETURA.md`) e
**AlphaOndulado/** (PDF ripado → grupos por cor → laudo de orçamento de clichê, ver
`AlphaOndulado/ARQUITETURA.md`; reproduz a lógica de `10_Medicao_Ondulado.jsx` **fora** do
Illustrator via pdf.js — área cm² × fator do operador).

Padrão geral: `Scripts.jsx` (menu ScriptUI) pede o número da O.S. (7 dígitos) e inclui condicionalmente os complementos via `#include`. Quase todo complemento inclui `Xml_upload.jsx`, que carrega o XML da O.S. e publica ~70 variáveis globais consumidas pelos demais.

---

## 2. Estrutura de pastas

```
Scripts/  (raiz)
├── claude.md                 # regras de código/fluxo
├── PROJECT_STRUCTURE.md      # este arquivo
├── CheckList.jsx             # verifica coordenadas de links na layer "arte"
├── Cotas_Alpha.jsx           # cria cotas/dimensões (UI: cima/dir/baixo/esq)
├── campo_de_testes.jsx       # sandbox de testes (ignorado no git)
│
├── Flexivel/
│   ├── Scripts.jsx           # MENU (9 opções)
│   ├── z_pdfs/               # (vazio)
│   └── z_Complementos/
│       ├── Xml_upload.jsx    # CORE — carrega XML, publica ~70 globais
│       ├── 1_SR_Montagens.jsx        # montagens em matriz (repetições x pistas)
│       ├── 2_Label_Alpha.jsx         # labels/etiquetas + utils de cor  [DUP]
│       ├── 3_Distorcao_Alpha.jsx     # distorção vertical (closure/cylinder)
│       ├── 4_Planta_Embrasa.jsx      # planta/padrões cliente Embrasa
│       ├── 5_Numeros_PPPrintBRL.jsx  # numeração de pistas (layer "numeros")
│       ├── 6_Escalas_valfilm_lorena.jsx  # escalas (layer "escalas")
│       ├── 7_Uteis.jsx               # utilitários / padrões no servidor
│       ├── 8_Micropontos.jsx         # micropontos (layer "registros")
│       ├── 9_Box_Valfilm.jsx         # box Valfilm (redimensiona)
│       ├── montagens.jsx (359 KB)    # lib geométrica grande (shapes/trapézios)
│       │     └── montagemNovatack() blindada (fonte com fallback, sem alert) — ver §5.1
│       └── micropontos.jsx           # lib de linhas/texto/pontos de registro
│
└── Ondulado/
    ├── Scripts.jsx           # MENU (6 opções)
    ├── AddCut.jsx            # margens de corte (layer "cut", spot "cut")
    ├── AddCantoneira.jsx     # cantoneira (derivado de AddCut)
    ├── PICS.jsx              # registros (+/×) + label O.S. na layer "arte" do doc ativo (funcoes VERBATIM do Risco_Faca, self-contained, layer "registros", SEM cut)
    ├── Ondulado_Maleta.jsx   # maleta/porta (ensureSpotZ, ensureLayerFaca)
    ├── z_pdfs/               # saídas (cuidadosCliche.pdf, etiqueta_centro.ai, qrCode.pdf)
    └── z_Complementos/
        ├── Xml_upload.jsx    # CORE — versão Ondulado (~1.3 KB maior)
        ├── 2_Label_Alpha.jsx         # IDÊNTICO ao do Flexivel  [DUP]
        ├── 10_Medicao_Ondulado.jsx   # mede por grupo/cor predominante, exporta XML de medições
        ├── 12_Gerar_Etiqueta_Penha.jsx   # etiqueta Penha (tokens [[...]]) — DESATIVADO: fundido em 14_Risco_Faca; fora do menu Scripts.jsx; será deletado
        ├── 13_Preenchimento_Penha.jsx    # preenchimento cabeçalho Penha
        ├── 14_Risco_Faca.jsx         # risco/traço de faca (cores de corte)
        └── 15_Relatorio_Codigos.jsx  # LAUDO de verificação de códigos de barras/QR. Captura os itens SELECIONADOS em PNG (imageCapture) + manifest.json; a DECODIFICAÇÃO (ZXing/jsQR) e o PDF são feitos no PAINEL (cep/js/codigos.js). PDF vai na _pdf do job
```

---

## 3. Menus orquestradores

### Flexivel/Scripts.jsx — 9 opções (seleção exclusiva, O.S. 7 dígitos)
| Opção | Inclui |
|---|---|
| Montagem | `1_SR_Montagens.jsx` |
| Montagem + Distorção | `1_SR_Montagens.jsx` + `3_Distorcao_Alpha.jsx` (sequencial) |
| Label Alpha | `2_Label_Alpha.jsx` |
| Distorção | `3_Distorcao_Alpha.jsx` |
| Números Pistas | `5_Numeros_PPPrintBRL.jsx` |
| Planta Embrasa | `4_Planta_Embrasa.jsx` |
| Úteis | `7_Uteis.jsx` |
| Micropontos | `8_Micropontos.jsx` |
| Box Valfilm Mg | `9_Box_Valfilm.jsx` |

> Montagem/Distorção/Box exigem `selection.length > 0`.

### Ondulado/Scripts.jsx — 6 opções (seleção exclusiva, O.S. 7 dígitos)
| Opção | Inclui |
|---|---|
| Label Alpha | `2_Label_Alpha.jsx` |
| Medição Ondulado | `10_Medicao_Ondulado.jsx` |
| Preenchimento Cabeçalho | `13_Preenchimento_Penha.jsx` |
| Risco Poliester | `14_Risco_Faca.jsx` |
| Gerar Etiquetas | `12_Gerar_Etiquetas.jsx` |
| Relatório de Códigos | `15_Relatorio_Codigos.jsx` (exige seleção; PDF gerado no painel) |

---

## 4. Cadeia de #include

* **Quase todo complemento** (Flexivel e Ondulado) inclui `Xml_upload.jsx`.
* `Flexivel/8_Micropontos.jsx` → também `micropontos.jsx`
* `Flexivel/1_SR_Montagens.jsx` → também `montagens.jsx`
* `CheckList.jsx` (raiz) → `Flexivel/z_Complementos/Xml_upload.jsx`
* `Ondulado/PICS.jsx` → **self-contained** (não inclui mais o Xml_upload; só prompt da O.S.). Contém uma CÓPIA da lógica de registros+label do `14_Risco_Faca.jsx` — ver Duplicações.
* Os dois `Scripts.jsx` incluem seus complementos conforme as tabelas acima.

---

## 5. ⚠️ Duplicações (corrigir bug = replicar em todos)

* **`2_Label_Alpha.jsx`** — cópia **idêntica** em `Flexivel/` e `Ondulado/z_Complementos` (46 KB). Alterar um exige alterar o outro.
* **`Xml_upload.jsx`** — duas versões **estruturalmente iguais**, mas a do Ondulado é ~1.3 KB maior. Confirmar diffs antes de propagar mudanças.
* **`AddCantoneira.jsx`** deriva de `AddCut.jsx` (código base adaptado).
* **Registros+label (`PICS.jsx` ⇄ `14_Risco_Faca.jsx`)** — o `PICS.jsx` tem as 36 funções de registros+label como **CÓPIA VERBATIM** do `14_Risco_Faca.jsx` (corEhBrancoNome…clearanceLado + normalizarNomeCor, incl. `escolherLayerArteDialog` e `showMarginDialogRiscos`) — verificado por diff: **0 diferenças**. A orquestração `criarRegistrosLabel(doc)` é o `criarRiscosArte` PASSO 1-4 (layer "arte" com dialog de fallback), rodando no doc ATIVO, em TODOS os grupos da arte (sem seleção). Diferenças do Risco_Faca: **NÃO cria o cut (PASSO 5) nem separações**, e **SEM diálogo de margem** — usa `margensCut` fixo de **6mm** (faixa do refB onde o label pode ficar; a lógica tenta sempre dentro do bounds perto do "+", a folga só é usada quando não cabe colado). `showMarginDialogRiscos` foi removida do PICS. **Corrigir bug numa = replicar na outra** (decisão do usuário: PICS independente p/ não mexer no Risco_Faca recém-arrumado; manter byte a byte iguais).

### 5.1 `montagemNovatack()` — blindagem (só esta montagem)

Operador estava travando na montagem do cliente **Novatack**. Corrigido **apenas dentro de `montagemNovatack()`**, com helpers de sufixo `Novatack` logo acima da função (nenhuma outra montagem foi tocada):

| Problema | Fix |
|---|---|
| `app.textFonts.getByName("Geneva")` (fonte **de Mac**) e `("Arial-BoldMT")` derrubavam o script na máquina sem a fonte | `acharFonteNovatack()` + `aplicarFonteNovatack()`: lista de candidatas (Arial Bold → ArialMT → Helvetica → Myriad → Verdana → Tahoma → Segoe), match por nome PostScript/família+estilo, fallback p/ 1ª fonte instalada, e se nada existir mantém a fonte padrão **sem erro** |
| `aplicarCorTexto()` chama `alert()` quando a cor não está na paleta → **modal trava o painel CEP** | `aplicarCorTextoNovatack()`: mesma busca de swatch, sem modal; entra na lista de avisos da mensagem final |
| `for (i < coresComuns.length) aplicarCorTexto(coresTexto[i], …)` estourava índice quando `coresComuns` > `cores` | loop limitado ao menor dos dois |
| `cores` com item vazio → `TextFrame` vazio → `characterAttributes` dá "no such element" | itens vazios são pulados |
| `registrationColor` vem **null** em doc sem swatch `[Registration]`/`[Registro]` → "Illegal argument" no `fillColor` | `corRegistroNovatack()`: registration → spot `PassarRegistration` → CMYK 100/100/100/100 |
| Helpers desenham em `doc.layers[0]`; se o arquivo já tinha layer "registros", `layers[0]` virava a layer **"arte" (oculta)** e a montagem saía vazia | `prepararLayerNovatack()`: acha/cria "registros", normaliza o nome, destrava, torna visível, traz p/ o topo e vira `activeLayer` |
| `executeMenuCommand('group')` herdava a seleção anterior e `app.selection[0]` podia ser `undefined` | limpa a seleção antes, `selected = true` em try/catch e checa a seleção antes de agrupar |
| Posição dos camerons + `msgUsuario` ficavam **dentro** do `if (registrosLayer …)`: sem a layer, a montagem parava no meio **sem aviso** | movidos para fora — sempre rodam |
| `pos` do XML com espaço/minúscula não batia em nenhum `if` (cameron a mais, silencioso) | `posNovatack` = trim + upper, com aviso se vier vazio/desconhecido |
| `.remove()` em item já removido quebrava | `removerNovatack()` (try/catch) |
| `grupoCores` vazio (O.S. sem cores) → `.height`/`geometricBounds` quebravam o retângulo do label | `alturaSeguraNovatack()` / `boundsSegurosNovatack()` |
| `textFrames.add()` sem uso deixava um **texto vazio** solto na layer "registros" | removido |

A mensagem final agora sai como `"Montagem e Label feitos — avisos: …"` (linha única, compatível com o banner do painel).

### Funções utilitárias copiadas (não há lib central)
| Função | Onde aparece |
|---|---|
| `swatchExists` | 2_Label_Alpha (Flex+Ond), 4_Planta_Embrasa |
| `createSpotColor` | 2_Label_Alpha (Flex+Ond); variação em 6_Escalas e 12_Etiqueta |
| `findRegistrationColor` | 2_Label_Alpha (Flex+Ond) |
| `excluirCores` | 2_Label_Alpha (Flex+Ond) |
| `adicionarZero` | 2_Label_Alpha (Flex+Ond) |
| `getFolderPath` | Xml_upload (Flex+Ond), 10_Medicao (como `getFolderPathCopyLog`) |
| `getLatestXMLFile`, `loadXML`, `convertXMLtoJSON`, `removerAcentos` | Xml_upload (Flex+Ond) |
| `findSpotColorByName` | 6_Escalas, 12_Etiqueta |
| `mmToPt` | 12_Etiqueta, PICS |
| `getDataAtualFormatada` | 12_Etiqueta, 14_Risco_Faca |
| `pointsToMM` / `pointsToCM` | 10_Medicao |

---

## 6. Xml_upload.jsx — variáveis globais (~70)

CORE consumido por quase todos os complementos. Carrega o XML mais recente da O.S., converte para JSON e publica globais. Grupos principais:

* **Cliente/metadata:** `cliente, medicao, status, depto, banda, cpc, mode, cac, np, categoria, supplied, requested, type, espessura, folder, produto, produtoComUnderline, nomeArte, operador*`
* **Parsing produto (Ondulado):** `cp, rev, v, clienteOnd, ref, medInt, tipoOriginal, tipoCliche, temRepremont`
* **Cores/tinta:** `ncores, cores, coresD, coresSemVernizBranco, dotShape, referenciaCor, coresComNumeros, coresComPant, substituicoes`
* **Dimensões/geometria:** `closureInput, cylinderSizeMM, objectHeight, objectWidthMM, repetitions, lanes, sizeCameron, distanceCameron, distanceBetweenLanesMM, montagem, totalWidth, totalHeight, gapBetweenRepetitions` (+ versões convertidas para pontos)
* **Registros/impressão:** `pos, lpi, lpc, dataEntrega, uScreen`
* **Estruturas:** `clickArray, clickObj, eAproveitamento, xmlData, jsonObject, folderPath, xmlFilePath`

> Ao alterar nomes/contratos dessas globais, verificar TODOS os complementos que as consomem.

---

## 7. Convenções observadas

* Cores: CMYK + Pantone/Spot. Spot recorrentes: `cut` (100% cyan), `PassarRegistration`/registration.
* Layers nomeadas por função: `arte`, `cut`, `pics`, `numeros`, `escalas`, `registros`, `faca`, `cotas`.
* **Etiquetas/PDFs auxiliares vão na layer `cotas`** (minúsculo; criar se não existir, reutilizando `getLayerByName` — case-insensitive — p/ não duplicar). Itens incorporados via `PlacedItem.embed()` devem ser movidos para a layer ANTES do `embed()` — o embed invalida a referência ao PlacedItem. Implementado em `14_Risco_Faca.jsx` (`ensureLayerCotas`): hoje recebem `Etiqueta_centro` (etiqueta_centro.ai), `Cuidados_cliche` (cuidadosCliche.pdf), `QR_code` (qrCode.pdf) e `Logo_alpha` (logo_alpha.pdf). Posição dos PDFs auxiliares depende da altura da entrada (≥100mm → 20mm abaixo da faca; <100mm → 40mm acima): cuidadosCliche alinha à direita / ¾ da largura; qrCode alinha à esquerda / ¼ da largura. Exceções FIXAS (não dependem da entrada): `Logo_alpha` (40mm acima da faca, alinhado à direita) e `Nao_pise` (40mm acima da faca, centralizado no eixo X do "centro"; usa `nao_pise.pdf`, ou `nao_pise_menor.pdf` quando a largura da faca < 840mm). Espelham com `resize(-100, 100)`: Etiqueta_centro, Cuidados_cliche, QR_code e Logo_alpha. `Nao_pise` NÃO espelha.
* **Logo do cliente (condicional)**: `Logo_cliente` só é colocado se existir o arquivo `z_pdfs/logos/logo_<folder>.pdf` (convenção por nome, sem cadastro — `File.exists` decide; falha segura se ausente). `<folder>` é a global publicada por `Xml_upload.jsx` (atributo `Customer.Folder` do XML, ex.: `penha_sa` → `logo_penha_sa.pdf`). Posição fixa: 40mm acima da faca, alinhado à esquerda; espelhado.
* **Etiqueta Penha (fusão do antigo 12)**: em `14_Risco_Faca.jsx`, só quando `folder == "penha_sa"`. Por cor (dentro do loop de separação): abre `z_pdfs/Etiqueta_Penha.pdf`, troca `[[tokens]]` (`cor, data, esp, maq, fi/, codcor, lpc, qtdc, loc`), gera 2 Code128 (fi sobre rect spot `produtoComUnderline`; codcor sobre rect spot `codcorAtual`) centralizados nos retângulos, agrupa, espelha e coloca 2 etiquetas — centro de ¼ e ¾ da largura da faca, 40mm acima — na layer `cotas`. `fi/` = parte antes da "/" de `np`; `codcor` = parte depois da "/" de `referenciaCor[i]`. Pergunta `loc` (diálogo) uma vez. As etiquetas são criadas ANTES do `substituirSpotCor` no loop, para que a spot `cor` delas também seja remapeada para a cor da separação (igual à etiqueta do centro). Funções herdadas do 12: `gerarCode128SobreRect` (corrigida p/ centrar no rect, sem artboard), `encontrarRectPorSpot`, `agruparTudoNoDocumento`, `desbloquearEExibirTudo`. O `12_Gerar_Etiqueta_Penha.jsx` saiu do menu `Scripts.jsx`.
* **Etiquetas montadas por template** (helper `abrirTemplateParaDoc`: abre o template POR COR, troca `[[tokens]]`, opcional barras, agrupa, duplica p/ `cotas`; suprime o diálogo de merge de spot via `userInteractionLevel`). Tentou-se abrir 1×/job (cache do doc) mas o tempo total não mudou e a tela "congelava" sem redraw — revertido; mantém abrir por cor (mostra progresso etapa a etapa). No fim do loop, grava `tempo_geracao.txt` (em ~/Desktop/<produto>/montado/) com data, nº de cores e segundos. `getFacaBounds` = união de `geometricBounds` (sem duplicar/agrupar) + cache por doc (`getFacaBoundsNoDoc`/`getCentroXNoDoc`). Todas criadas por cor no loop, ANTES do `substituirSpotCor` (p/ a spot `cor` ser remapeada). São place→abrir porque o `place`/`embed` perdia justificação de parágrafo:
  - **`criarEtiquetaCentro`** (TODOS os clientes): abre `etiqueta_centro.ai`, mapping+`cor`, centraliza no objeto "centro", abaixo da faca (30mm se entrada≥100 / 3mm se <100), espelha. (Não é mais place+embed.)
  - **`criarEtiquetaDeCor`** (só `artivinco_itatiba`, `artivinco_santa_rosa`, `somar_papelao`): abre `etiqueta_cor.pdf`, troca `cor/ref/descr/qtdc`, 2 cópias (esquerda/direita) alinhadas às laterais da faca, abaixo (40mm se entrada≥100 / 3mm se <100), espelha.
  - Posição na separação usa `getFacaBoundsNoDoc`/`getCentroXNoDoc` (acham faca/centro no doc copiado, com fallback aos bounds originais).
* Para os 3 clientes acima (`clientesEtiquetaCor`), `qrCode` e `cuidadosCliche` são forçados ao layout "entrada < 100mm" (em cima), independente da entrada real.
* **PDFs auxiliares (cotas) só nas separações, não no docOriginal**: `criarPdfsAuxiliares(doc)` coloca os 5 PDFs e os agrupa em `PDFS_AUX`. No loop: na **1ª cor** cria; nas **demais** copia o grupo `PDFS_AUX` da 1ª separação via `copiarGrupoPorNome`. **Posicionamento**: o clone (`app.paste`) centraliza o conteúdo, então a faca fica em posição diferente da do docOriginal — por isso os PDFs são posicionados pela faca/centro REAIS do doc (`getFacaBoundsNoDoc`/`getCentroXNoDoc`), NÃO por `resultado.facaBounds`. `copiarGrupoPorNome` usa `duplicate` direto entre docs (NÃO copy/paste — falhava intermitentemente deixando uma cor sem PDFs) e reposiciona o grupo relativo à faca do destino (mesmo offset que tinha na 1ª). As **etiquetas** continuam refeitas por cor (dados por cor corretos). O clone base vem sempre do docOriginal (spot `cor` intacta p/ o `substituirSpotCor`).
* Token `maq` (template) = **2 primeiras palavras** de `maquina` (`primeirasDuasPalavras` — ex.: "GOPPFER 657 xpto" → "GOPPFER 657"). **Achatamento nas etiquetas**: `replaceInTextFrames(doc, map, achatar=true)` (só via `abrirTemplateParaDoc`, NÃO no artwork principal) → após trocar o token, se o frame continha `[[ref]]`/`[[descr]]`/`[[maq]]` e ficou mais largo que **35/30/16mm**, ACHATA horizontal (`horizontalScale`, `achatarSeNecessario`) mantendo a altura (só reduz, nunca aumenta).
* **Riscos por grupo da arte (Fase 1)**: `criarRiscosArte(doc)` roda em docOriginal após `remapSpotsPorArray` (cores já reais). Lê a layer `arte` (se faltar, diálogo p/ escolher); para cada grupo-mãe acha a **cor predominante** (spot mais frequente em fill+stroke via `corPredominanteDoGrupo`, ignorando branco/none/registration) e cria um **quadrado de contorno** (0,2mm, overprint, sem fill) nessa cor na layer **`cut`**, com 4 margens (diálogo mm), nomeado `RISCO_<cor>`. **Otimização**: antes do loop, a layer da arte é ESCONDIDA no docOriginal (`visible=false`) para o clone NÃO copiar a arte pesada (restaurada no fim do loop). Cada separação: `prepararSeparacao(docSep, cor)` mantém na `cut` só os `RISCO_<cor>` da cor (remove os das outras) e os **recolore para a spot `cut` 100% cyan** (`ensureCutSpot`) — mais visível no poliéster. O docOriginal mantém todos os cuts (nas cores originais) e, no fim do script, a layer `cut` fica com visibilidade OFF. Helpers: `getVisibleBounds` (do AddCut), `showMarginDialogRiscos`, `escolherLayerArteDialog`. **Fase 2 (base)**: na mesma varredura, `criarRegistroDoGrupo` cria 1 `+` e 1 `x` (4mm, traço 0,3mm) em 2 **cantos aleatórios distintos** do grupo + texto `produto` junto do `+`, tudo na cor predominante (overprint), agrupado em `REG_<cor>` na layer **`registros`**. `prepararSeparacao` também filtra a `registros` por cor (mantém só `REG_<cor>`) e, para os mantidos, RECOLORE as marcas (+/×) para **black 100% process** (CMYK K=100 — mais visível no poliéster) e REMOVE o label/texto (`recolorirRegistro`) — a fonte NÃO vai pro poliéster. **Fase 3a** (feita): `criarRegistroDoGrupo` posiciona o par nas 2 pontas do MAIOR lado do grupo, no vazio — `acharPosMarca` varre candidatos DENTRO do bounds da arte (`coletarBoundsArte`/`caixaColideArte`, folga ≥4mm); se não couber dentro, joga FORA e o cut é dimensionado pela UNIÃO (arte ∪ marcas) + margens (registros criados ANTES do cut). **Fase 3b** (feita): `criarRiscosArte` agora roda em **2 passadas** — coleta grupos (cor/bounds/área) → detecta **encaixes** (`distanciaArte` ≤15mm entre cores DIFERENTES — distância da ARTE real, NÃO do bounding box; senão grupos com bounding box grande "encaixam" com arte longe e a réplica infla o cut do maior = **cut gigante**. PASSO 4 ainda trava: só replica se `distanciaBounds(menor.par.bounds, maior.vb) ≤ 15mm`. **Tamanhos PARECIDOS** (área menor/maior ≥ 0,8): o MAIOR marca `pulaPar=true` e NÃO cria par próprio no PASSO 3 — usa só a réplica do menor (1 par compartilhado, mesma posição, cada um na sua cor); diferente do caso "taça" (preto ≪ vermelho) onde o maior mantém par próprio + réplica) → par próprio de cada grupo (3a, evitando vizinhos como obstáculo) → **replica o par do grupo MENOR na cor do MAIOR** (`desenharPar`, registro compartilhado no mesmo ponto, overprint; maior ganha +1 par por encaixe) → cut por grupo = (arte+margens) expandido SÓ p/ englobar marcas que saiam dele (se as marcas couberam dentro/na margem, o cut NÃO cresce; senão cresce o mínimo até a marca — sem margem extra em volta das marcas). O fallback do `acharPosMarca` (quando não cabe dentro) EMPURRA a marca pra fora (incrementos de 4mm, até ~40mm) até ficar livre de arte/vizinhos — o `+`/`x` NUNCA ficam em cima (só o texto pode sobrepor, é overprint e não atrapalha a gravação). **Posicionamento** (`criarParRegistro`): PRIORIDADE = par DENTRO do bounds da arte (`candidatosDentro`, grid ≥4mm da arte, sem sobrepor vizinhos) → cut não cresce. **Sem regra de 100mm** (removida — atrapalhava; melhor sempre adequar os registros, crescendo o cut só com base nas marcas). No **encaixe**, a área de busca é SEMPRE **local** (bounds do próprio grupo menor — `areaBusca = vbEnv`), p/ as marcas ficarem PERTO do grupinho e não espalharem pelo rótulo inteiro quando a cor maior é enorme (ex.: maior = rótulo todo). O que evita cair em cima do maior / crescer a peça é: o maior sai dos `vizinhos` (`maioresIdx`; senão sua vb = rótulo todo bloquearia o interior) e a **arte DETALHADA do maior entra na folga de 4mm** (`arteEncaixe` concatenada na `arteResp`) — aí o FORA empurra pro **canal vazio mais próximo do grupo** (a 4mm do vermelho), local. `preferir` (união das vb dos maiores) FILTRA o pool no encaixe: descarta candidatos FORA do bounds do maior (`dentroDeBounds`), p/ a réplica no maior NÃO crescer o vermelho — sobra o canal vazio DENTRO do vermelho mais próximo do grupo. Também decide girar o label. **Label** = 4 últimos dígitos da O.S. (`serviceOrderNumber`), no lugar do "produto", SÓ no par próprio (`comTexto=true`; o replicado do encaixe vai sem label → 1 par só) e **gira 90° (`labelVertical`)** quando, no encaixe, o label horizontal sairia do bounds do maior (cresceria a peça) — aí desce a partir do "+" no canal estreito. Folga da marca à arte PRÓPRIA = **3mm** (reduzida de 4mm p/ caber em vãos menores; `marcaColide`/`gerarCandidatosMarca`/recurso); vizinho continua ≥1mm. A escolha do par junta candidatos DENTRO (`candidatosDentro`, grid 9×9) + FORA (`gerarCandidatosMarca`, 4 lados × 3 frações empurrados até livre) e usa `escolherPar`/`paresMelhor`/`cutExtArea` com a lógica acordada (perguntas/respostas), lexicográfica: **1º** menor crescimento de ÁREA da cor MAIOR do encaixe (ficar DENTRO do vermelho — qualquer protrusão no vermelho enorme custa muita área → forte); **2º** menor crescimento de EXTENSÃO (dim. máxima) do cut PRÓPRIO (não esticar a dim. longa → eixo curto / vão interno; ex.: coluna alta vai pra LATERAL, não pra cima); **3º** menor crescimento de ÁREA do próprio; **4º** par mais AFASTADO (registro; `minSep` impede `+`/`×` juntos). Vazio interno da arte é o ideal (cut não cresce). Recurso final: marcas no eixo CURTO do grupo. **LABEL** (4 díg.): NÃO conta no cut (`desenharPar` retorna bounds só das marcas +/×, sem o texto) — a fonte não pode crescer o cut e nem vai pro poliéster (removida em `prepararSeparacao`). Label posicionado **dentro do CUT, sem nunca crescer o cut** (`marcasB` = só as marcas). O `refB` do label = **arte ∪ marcas + margens do cut** (`expandirCut`/`margensCut`) — cabe na **faixa da margem** (livre da arte). `posicionarLabel`/`acharPosLabelLado`/`acharPosLabel`/`labelLivre`: clearances **2mm da ARTE** e **0,5mm dos REGISTROS** (`labelLivre`). **Fase 1 — CARDINAIS** (`acharPosLabelLado(diagonais=false)`): direita/esquerda **deitado**, cima/baixo **em pé** (o label gira p/ seguir a orientação); **Fase 2 — DIAGONAIS** (`diagonais=true`): 4 cantos deitado. Borda do label a **3mm do CENTRO do `+`** (`g = 3mm − markHalf`), **CENTRALIZADO no eixo do `+`** (`centralizarNoMais`: nas cardinais, re-centraliza X no `pMais[0]` se vertical / Y no `pMais[1]` se horizontal, usando o bounds REAL pós-rotação — corrige desvio que a rotação da curva causava). DENTRO do `refB` (com **2mm de inset** p/ não passar da borda). Distâncias: 3mm do centro do `+`, **2mm da arte**, **0,5mm dos registros**, 2mm da borda do cut, escolhendo a posição **MAIS DENTRO do bounds** (centro mais perto do centro do refB). **Fase 3** grid dentro do bounds; **Fase 4 ÚLTIMO CASO**: CLAMPA dentro do bounds, mais perto possível do `+` — **NUNCA sai do bounds** (regra absoluta). Seleção das cardinais/diagonais = posição **mais perto do `+`** (`(ccx-pMais)²`). **Criação robusta** (`desenharPar`): converte em curva ("LABEL"); se a conversão invalidar o tf, RECRIA o texto → o label NUNCA some; sem alerta. (Um diagnóstico temporário em `.txt` foi usado p/ achar o bug de formato dos bounds e depois REMOVIDO — confirmado OK pelo usuário.) Convertido em curva ("LABEL", removido no poliéster, via `recolorirRegistro`). No Part B vai nas 2 cores. Se cair **sobre a arte**, avisa (`labelsEmArte` → alerta no fim). **NOTA**: tentamos 2× fazer o "cut seguir o label" (geometria real / lógica dos registros) e **ambas quebraram** — voltamos sempre p/ esta versão (refB=área do cut, label não cresce o cut). O label é **convertido em VETOR ANTES de posicionar/ajustar o cut** (`tf.createOutline()`, nomeado **"LABEL"**; `posicionarLabel` recebe a CURVA, não o texto) — bounds exato p/ o cut e NÃO depende de fonte instalada; `recolorirRegistro` remove o grupo "LABEL" (ou TextFrame, fallback) na separação. No **Part B** (par compartilhado, `maior.pulaPar`), a réplica no maior também leva label (label nas DUAS cores); no caso "taça" a réplica vai sem label (o maior já tem label no par próprio). **Posicionamento via `moverTopoEsq` (translate)** — NÃO setar `.left/.top` em texto (instável p/ rotacionado; deixava na origem 0,0 → cut gigante, bug raiz já corrigido). **BUG RAIZ DA SAGA DO LABEL (corrigido):** no Illustrator `geometricBounds`/`visibleBounds` = `[left,top,right,bottom]` (gb[0]=left, gb[1]=top, gb[2]=right, gb[3]=bottom), **não** `[top,left,bottom,right]` (InDesign). `moverTopoEsq` e `centralizarNoMais` estavam com X/Y trocados → o label era sempre posicionado um pouco fora/descentralizado; no diagnóstico deu **FORA-DO-BOUNDS pra todos os 18**. Corrigido: `moverTopoEsq` = `translate(L-gb[0], T-gb[1])`; `centralizarNoMais` vertical centra X com `(gb[0]+gb[2])/2`, horizontal centra Y com `(gb[1]+gb[3])/2`. Todo o resto do código (getVisibleBounds/unirBounds/caixaLivreArte/labelDentro/coletarBoundsArte) já usava o formato certo. Salvaguarda: PASSO 5 trava o crescimento do cut em ≤80mm além do bounds. PASSO 5: quando o cut cresce p/ englobar as marcas, cresce COM a mesma margem (não fica colado). Colisão (`marcaColide`): ≥4mm da arte PRÓPRIA, mas só não-sobrepor (≥1mm) dos VIZINHOS (cabe marca em vão estreito). Isso também mantém os cuts separados (marcas vão pro vazio) e e o **texto cresce AFASTANDO da arte** (lado do `+` em relação ao centro do grupo; right-justify quando vai pra esquerda) — assim o texto não cai sobre a arte e o cut (que CONTA o texto) cresce pro espaço livre, sem fundir com o vizinho. Texto 2,5mm. Encaixe é por grupo (replica o par do menor na cor do maior, 1 par extra por grupo que encaixa). A regra de peças pequenas (10/100mm) foi DESCARTADA pelo usuário — só adequar bem os registros (não crescer a peça nem a cor maior no encaixe). **Spots de cromia**: no INÍCIO do script (logo após `var doc`), cria Cyan/Magenta/Yellow/Black como **SPOT** (`removeSwatchesPorNome`+`criaSpotCromia`, padrão do 2_Label_Alpha) — p/ não perder a lógica de cor predominante em jobs de cromia. **Pontilhado da borda**: no fim de `prepararSeparacao` (cada arquivo de risco), desenha um retângulo em volta do artboard (`artboardRect`) na layer **"borda"**, spot **"Black"** (`ensureBlackSpot`), traço **0,5mm**, **dashed 5mm/3mm** (`strokeDashes=[mmToPt(5),mmToPt(3)]`), overprint, nomeado `BORDA_pontilhada`.
* O.S. sempre 7 dígitos; XML por O.S. lido do servidor via `getFolderPath`/`getLatestXMLFile`.
* `campo_de_testes.jsx` é sandbox (ignorado no git).

---

## 8. Como manter este arquivo

Ao descobrir/alterar algo estrutural, atualizar aqui: novo complemento, nova global em `Xml_upload`, nova duplicação, mudança em menu. Manter a data do topo.

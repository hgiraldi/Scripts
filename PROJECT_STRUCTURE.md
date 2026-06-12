# PROJECT_STRUCTURE.md

> Mapa vivo do projeto. Mantido atualizado para acelerar análises futuras.
> Regras de código e fluxo ficam em [claude.md](claude.md). Este arquivo é o **mapa**: o que existe, o que faz, o que depende de quê.
> Última atualização: 2026-06-12

---

## 1. Visão geral

Automações Adobe Illustrator 2022 em ExtendScript (JSX) para pré-impressão flexográfica.
Dois fluxos principais, cada um com seu menu orquestrador:

* **Flexivel/** — fluxo flexografia/filme
* **Ondulado/** — fluxo papelão ondulado
* **Raiz/** — scripts avulsos (cotas, checklist, testes)

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
│       └── micropontos.jsx           # lib de linhas/texto/pontos de registro
│
└── Ondulado/
    ├── Scripts.jsx           # MENU (6 opções)
    ├── AddCut.jsx            # margens de corte (layer "cut", spot "cut")
    ├── AddCantoneira.jsx     # cantoneira (derivado de AddCut)
    ├── PICS.jsx              # marcas de posicionamento/cruzes (layer "pics")
    ├── Ondulado_Maleta.jsx   # maleta/porta (ensureSpotZ, ensureLayerFaca)
    ├── z_pdfs/               # saídas (cuidadosCliche.pdf, etiqueta_centro.ai, qrCode.pdf)
    └── z_Complementos/
        ├── Xml_upload.jsx    # CORE — versão Ondulado (~1.3 KB maior)
        ├── 2_Label_Alpha.jsx         # IDÊNTICO ao do Flexivel  [DUP]
        ├── 10_Medicao_Ondulado.jsx   # mede camadas, exporta XML de medições
        ├── 11_Criar_Layers_Ondulado.jsx  # cria layers por cor (qtd placas)
        ├── 12_Gerar_Etiqueta_Penha.jsx   # etiqueta Penha (tokens [[...]])
        ├── 13_Preenchimento_Penha.jsx    # preenchimento cabeçalho Penha
        └── 14_Risco_Faca.jsx         # risco/traço de faca (cores de corte)
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
| Layers Ondulado | `11_Criar_Layers_Ondulado.jsx` |
| Etiquetas Cores | `12_Gerar_Etiqueta_Penha.jsx` |
| Preenchimento | `13_Preenchimento_Penha.jsx` |
| Risco Poliester | `14_Risco_Faca.jsx` |

---

## 4. Cadeia de #include

* **Quase todo complemento** (Flexivel e Ondulado) inclui `Xml_upload.jsx`.
* `Flexivel/8_Micropontos.jsx` → também `micropontos.jsx`
* `Flexivel/1_SR_Montagens.jsx` → também `montagens.jsx`
* `CheckList.jsx` (raiz) → `Flexivel/z_Complementos/Xml_upload.jsx`
* `Ondulado/PICS.jsx` → `Ondulado/z_Complementos/Xml_upload.jsx`
* Os dois `Scripts.jsx` incluem seus complementos conforme as tabelas acima.

---

## 5. ⚠️ Duplicações (corrigir bug = replicar em todos)

* **`2_Label_Alpha.jsx`** — cópia **idêntica** em `Flexivel/` e `Ondulado/z_Complementos` (46 KB). Alterar um exige alterar o outro.
* **`Xml_upload.jsx`** — duas versões **estruturalmente iguais**, mas a do Ondulado é ~1.3 KB maior. Confirmar diffs antes de propagar mudanças.
* **`AddCantoneira.jsx`** deriva de `AddCut.jsx` (código base adaptado).

### Funções utilitárias copiadas (não há lib central)
| Função | Onde aparece |
|---|---|
| `swatchExists` | 2_Label_Alpha (Flex+Ond), 4_Planta_Embrasa |
| `createSpotColor` | 2_Label_Alpha (Flex+Ond); variação em 6_Escalas e 12_Etiqueta |
| `findRegistrationColor` | 2_Label_Alpha (Flex+Ond), PICS.jsx |
| `excluirCores` | 2_Label_Alpha (Flex+Ond) |
| `adicionarZero` | 2_Label_Alpha (Flex+Ond) |
| `getFolderPath` | Xml_upload (Flex+Ond), 10_Medicao (como `getFolderPathCopyLog`), PICS |
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
* Layers nomeadas por função: `arte`, `cut`, `pics`, `numeros`, `escalas`, `registros`, `faca`.
* O.S. sempre 7 dígitos; XML por O.S. lido do servidor via `getFolderPath`/`getLatestXMLFile`.
* `campo_de_testes.jsx` é sandbox (ignorado no git).

---

## 8. Como manter este arquivo

Ao descobrir/alterar algo estrutural, atualizar aqui: novo complemento, nova global em `Xml_upload`, nova duplicação, mudança em menu. Manter a data do topo.

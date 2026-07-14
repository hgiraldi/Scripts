# AlphaScreening (projeto de teste)

Extensão CEP dedicada — **Ink Manager + screening por tinta** para o fluxo
flexográfico da Alpha. Independente do Flexível/Ondulado/AlphaCompare/AlphaPack
(ID próprio `com.alpha.screening`), pasta ignorada pelo git (`AlphaScreening/`).

## O que faz

1. **Puxar OS** — lê o XML da OS (`\\aeserver16\Engine\_Jobfolder\<OS>\_xml\*.xml`,
   mesma lógica do `Xml_upload`) e monta a lista de tintas com **ângulo, LPI e ponto**.
   Detecta as tintas `##` (o *dual screening* da cor correspondente).
2. **Ink Manager** — tabela com swatch, tipo (Processo/Spot/Técnica), ângulo, LPI,
   ponto e o dual. Filtros (Todas/Processo/Spots/Dual ##). **Clicar na linha
   seleciona no documento tudo que usa aquela tinta** (rápido: por layer, seleção
   atribuída de uma vez).
3. **Gravar no PDF** — grava o screening **dentro do PDF** (prop XMP
   `alphapack:screening`) por *update incremental* (não reescreve o PDF; preserva
   tudo). Assim viaja com o PDF linkado na montagem.
4. **Ler do PDF linkado** — lê o screening gravado nos PDFs linkados do documento
   ativo (lê só a cauda do arquivo → não trava com PDFs enormes).

## Instalar

1. Rode **`instalar.bat`** (liga o `PlayerDebugMode` e cria o junction do CEP).
2. **Reinicie o Illustrator** → menu **Janela ▸ Extensões ▸ AlphaScreening**.

Remover: **`desinstalar.bat`** (o repo não é tocado).

## Arquitetura

```
com.alpha.screening/
  CSXS/manifest.xml     extensao CEP (ILST 2022+, porta debug 8094)
  index.html            UI (Ink Manager)
  css/style.css         design (teal Alpha, claro/escuro)
  js/main.js            orquestra evalScript <-> host
  js/pdfwrite.js        grava/le o XMP no PDF (Node, update incremental)
  host/host.jsx         apPing + apScreenPullOS + XMP save/load + apSelectByInk
  img/                  logo + icones
```

## Estrutura do screening no PDF (base: PackZ/Esko)

O que o AE realmente screena são os `HalftoneType` (Type1 por tinta + Type5 mestre
mapeando separação→screen + ExtGState `/HT`). Hoje o AlphaScreening grava o **XMP**
com os dados (ângulo/LPI/ponto por tinta, e os `##` como dual). Injetar os
`HalftoneType` no PDF é o passo seguinte — pendente de confirmar como a montagem
chega no Automation (se o AE lê os PDFs individuais, os halftones do PDF servem).

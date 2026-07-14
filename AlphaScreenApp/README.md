# Alpha Screen (app desktop — projeto de teste)

Aplicativo **fora do Illustrator** (Electron) que junta colorantes de um PDF
**mantendo o screening por objeto** — ex.: joga o `##2168` na chapa do
`PANTONE 2168 C`, mas os objetos do `##` continuam com o screen deles (o *dual*
numa chapa só), igual o PackZ faz na mão.

Pasta ignorada pelo git (`AlphaScreenApp/`).

## Fluxo

1. **Arrasta o PDF normalizado** (o que sai do Automation, com os halftones).
2. **Puxa o screening do XML da OS** (opcional — o app também lê os screens que já
   estão no PDF). Mesma pasta do `Xml_upload`: `\\aeserver16\Engine\_Jobfolder\<OS>\_xml`.
3. **Tela de junções:** cada tinta mostra ângulo/LPI/ponto e um menu **"chapa
   destino"**. As `##`/`//` já vêm sugeridas pra base. O operador escolhe as junções
   (ex.: `black1` + `##black` → `black` = 3 screens numa chapa).
4. **Converter e salvar** → gera o PDF novo. Você joga no fluxo pra testar.

## Como funciona (o miolo)

Em cada content stream, logo após o `/CSx cs` de um colorante que tem screen, o
motor injeta `/ASgN gs` (um ExtGState com `/HT` = o `HalftoneType 1` daquele
screen). Assim o screen fica **preso ao objeto**. Depois renomeia o colorante
fonte (`##X` → `X`). Resultado: uma chapa `X` com os dois (ou mais) screens por
região. Usa a lib `pdf-lib` (aguenta os PDFs Esko: xref stream, object streams,
content comprimido).

Testado no `1761827…EXT.pdf` (normalizado, 159 MB): lê os 12 colorantes e os
screens do master, junta os 3 `##` nas bases (`##black`→Black, `##2168`→PANTONE
2168 C, `##2411`→PANTONE 2411 C), 394 objetos com screen preso, saída válida do
mesmo tamanho, em ~20 s.

## Rodar

Precisa de **Node.js** instalado.

```
cd AlphaScreenApp
npm install        # baixa electron + pdf-lib (uma vez)
npm start
```

Ou use os atalhos: **`Instalar Alpha Screen.bat`** (uma vez) e depois
**`Alpha Screen.bat`** pra abrir.

## Arquitetura

```
AlphaScreenApp/
  main.js            processo principal (janela + diálogos salvar/abrir)
  src/index.html     UI
  src/style.css      visual (teal Alpha, escuro)
  src/renderer.js    lógica da tela
  src/engine.js      motor de conversão (pdf-lib)
  src/xml.js         puxa o screening do XML da OS
```

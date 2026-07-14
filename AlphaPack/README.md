# AlphaPack (projeto de teste)

Suite de pré-impressão para flexografia dentro do Illustrator, no estilo do
**Esko DeskPack** — porém interna e enxuta. Painel **CEP independente** do
Flexível/Ondulado e do AlphaCompare (IDs próprios), pasta ignorada pelo git
(`AlphaPack/`). Instalar **só no seu Illustrator** por enquanto.

## Ferramentas da v1

1. **Trapping vetorial** — espalha a cor mais clara na mais escura entre regiões
   adjacentes e desenha as tirinhas em *overprint* na layer `AlphaPack Trap`.
   Motor geométrico real (Clipper: offset + interseção) rodando no painel.
2. **Barcode EAN-13** — vetorial, com magnificação, **Bar Width Reduction (BWR)**,
   altura e escolha de tinta (spot/CMYK). Recalcula/valida o dígito verificador.
3. **White Underprint** — chapa de branco sob a arte selecionada: une, estrangula
   (*choke*) e coloca em overprint na spot `White`.

## Instalar

1. Rode **`instalar.bat`** (liga o `PlayerDebugMode` e cria o junction do CEP).
2. Reinicie o Illustrator → menu **Janela ▸ Extensões ▸ AlphaPack**.

Para remover: **`desinstalar.bat`** (o repo não é tocado).

## Como o trapping funciona (e os limites honestos)

Fluxo: o host JSX (`host/trap_export.jsx`) extrai as regiões vetoriais chapadas
preservando a tinta e calculando a **densidade** de cada cor; o motor
(`js/trap.js` + `lib/clipper.js`) decide a direção (clara → escura) e gera a tira
= `interseção( offset(clara, +trap), escura )`; o host `trap_apply.jsx` desenha
de volta em overprint.

**Cobre bem:** spots/CMYK chapados adjacentes — o caso comum de clichê flexo.

**NÃO faz (ainda), diferente do PowerTrapper:**
- sliding traps / centerline (trap na linha média entre densidades parecidas);
- pull-back e rich-black keepaway;
- trapping de imagem, gradiente ou de/para transparência;
- respeito a overprints já existentes na arte.

Regras atuais: não trapa entre a **mesma spot** (mesma chapa, sem folga branca) nem
contra **papel** (região sem tinta). Converta **textos em curvas** antes de trapar.

## Arquitetura

```
com.alpha.pack/
  CSXS/manifest.xml        extensao CEP (ILST 2022+)
  index.html               UI (abas: Trapping, Barcode, Branco)
  css/style.css
  js/main.js               orquestra evalScript <-> host
  js/trap.js               motor de trapping (Clipper)
  lib/clipper.js           Clipper 6.4.2 (Angus Johnson, pure JS)
  img/                     logo.svg + icones do menu (icon-n/icon-r.png)
  host/host.jsx            TUDO num arquivo: AP.* + apPing + barcode + white + trapping
```

Convenção host↔painel: funções JSX retornam **string** `"OK|<dado>"` ou
`"ERRO|<msg>"`. Nada de modal dentro do JSX (o CEP trava).

> **Por que host.jsx é único:** no CEP o `//@include` e o `$.evalFile` (via
> `$.fileName`) não resolvem o caminho de forma confiável — os módulos não
> carregavam ("apX is not a function"). Manter tudo num arquivo evita isso.

## Próximos passos mapeados

- Trapping: centerline p/ densidades próximas; respeitar overprint existente;
  keepaway de preto rico; opção de choke em vez de spread.
- Barcode: EAN-8, GS1-128, DataMatrix/QR, indicador de quiet zone (`>`).
- Dynamic Marks (registro/barras/cotas) — próximo módulo.
- Step & Repeat e compensação de distorção (circunferência do cilindro).

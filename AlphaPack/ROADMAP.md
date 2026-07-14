# AlphaPack — suite de pre-impressao estilo Esko DeskPack (uso interno)

Projeto de teste, fora do fluxo de producao. Gitignored.
Ambiente: Adobe Illustrator 2022, ExtendScript JSX (sem ES6), opcionalmente painel CEP.
Foco: flexografia / clicheria (Alpha).

## Pesquisa: modulos do DeskPack e viabilidade de replicar internamente

### Muito viavel (alto valor)
- Dynamic Barcodes  -> gerar EAN/GS1/2D vetorial + bar width reduction (BWR), magnificacao, quiet zone
- Dynamic Marks     -> registro, cruzes, barras de cor/densitometro, cotas, marcas de texto (regenerar)
- White Underprint  -> chapa de branco sob a arte, spot "White", choke/estrangular
- Preflight / QC    -> fonte min, filete min, resolucao, spots, overprint, TAC
- Image Extractor   -> salvar imagens embutidas

### Viavel com escopo reduzido
- PowerLayout / Step & Repeat -> grade e escalonado simples (nesting otimizado = fora)
- Distortion (flexo)          -> compensacao de circunferencia do cilindro/sleeve (escala 1 eixo)
- Channel Mapping / Ink Manager -> gerir spots, ordem, overprint, converter (remap de canais = limitado)
- Dynamic VDP                 -> merge CSV em texto/barcode + exportar N versoes
- Viewer separacoes / TAC     -> preview de separacao (nativo) + mapa de cobertura total (pesado)

### Baixa viabilidade (honesto)
- PowerTrapper / Trapping -> motor geometrico complexo; so trap simples por overprint
- Screening               -> aplicado no RIP Esko; sem RIP nao faz nada
- Text Recognition (OCR)  -> problema dificil, baixo retorno
- boostX / CAD (.ard)     -> formatos proprietarios Esko
- PDF Import normalizado  -> nao da pra igualar o da Esko

## Nucleo escolhido para a v1 (CONSTRUIDO)
- Trapping vetorial (Clipper) -> PRIORIDADE do Henrique
- Barcode EAN-13 + BWR
- White Underprint (choke via Offset Path effect)
- Preflight / QC
Interface: painel CEP unico (com.alpha.pack). Ver README.md para arquitetura e limites.

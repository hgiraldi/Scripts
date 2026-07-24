# Alpha Faca — Arquitetura

> App desktop (PC + Mac, Electron) que lê um arquivo de faca (**somente DXF**),
> separa **corte × vinco × picote × arte**, mede o **metro linear** de cada tipo e
> gera um **orçamento em PDF** para o setor de facaria da Alpha (papelão ondulado).
>
> **Decisão (15/07/2026):** entrada é **exclusivamente DXF**. A leitura de PDF foi
> descartada (era a antiga Fase 4).

**LEIA ESTE DOCUMENTO PRIMEIRO.** É a base do projeto: mapa dos arquivos, pipeline,
convenções de leitura e regras que não podem ser violadas. Toda mudança estrutural
deve ser refletida aqui.

---

## Regra de deploy (herdada do CLAUDE.md)

`AlphaFaca/` começa com `Alpha` → **projeto interno, NÃO vai para produção.**
Único destino é o **commit no git**. Nunca copiar para a pasta de rede da produção.

---

## Por que existe (a lacuna)

O custo de uma faca de corte e vinco é cobrado essencialmente **por metro linear de
lâmina** (corte e vinco separados), mais base de compensado, corte a laser e borracha,
com multiplicadores de complexidade/poses/urgência. Softwares de mercado (ArtiosCAD,
Picador) custeiam a **caixa/produção** — **não** a fabricação da faca em si. O Alpha
Faca puxa a geometria do arquivo CAD e a converte em **orçamento de facaria**.

---

## Como se identifica CORTE de VINCO (o coração do app)

Convenção mundial de facaria, confirmada nos arquivos reais da Alpha:

### DXF (fonte principal — determinística)
Cada entidade carrega uma **cor** (group code `62`, padrão AutoCAD Color Index/ACI)
e um **layer** (group code `8`). Convenção-preset detectada no arquivo real
`15787 - CX PIZZA 40` da Alpha:

| Cor ACI | Função | No arquivo de referência |
| --- | --- | --- |
| **1 — vermelho** | **CORTE** (faca) | 864 entidades |
| **3 — verde** | **VINCO** (creasing) | 240 linhas |
| **5 — azul** | PICOTE/perf (palpite comum) | — |
| **7 — preto/branco** | ARTE (não é faca) | 781, na layer `2_IMPRIMIR` |
| 216 / MTEXT | COTAS/legenda (ignora) | ~22 |

**Não há convenção 100% universal** — cada cliente/fornecedor usa sua chave. Por isso
o mapa cor/layer→função é **editável na UI** (aba/painel "Mapa de cores"), com o preset
acima como padrão. Também há heurística por **nome de layer** (`CORTE`, `VINCO`,
`IMPRIM`/`ARTE`) como fallback — vista no arquivo `...FORTPLAST` (layer única `CORTE`).

### PDF — descartado
PDF não carrega "corte/vinco" como metadado confiável (só separaria com cores spot
nomeadas). Optou-se por **não** suportar PDF: a entrada é exclusivamente DXF.

---

## Pipeline

```
Upload (DXF)
  → Parser        (dxf.js)     tokeniza, extrai entidades: tipo, cor, layer, geometria
  → Mapa de cores (colormap.js) cor/layer → função (corte/vinco/picote/arte/ignorar)
  → Medidor       (dxf.js)     Σ comprimento por função, bbox (tamanho da faca), contagens
  → Motor de custo (custo.js)  Σm × R$/m + base + laser + borracha + MO × multiplicadores   [FEITO]
  → Relatório PDF (relatorio.js) orçamento com identidade Alpha, via printToPDF do main.js  [FEITO]
```

### Fórmula do orçamento — MODELO v2 (custo.js) [15/07/2026]
Custo real de matéria-prima + **% de ganho** na montagem (o % substitui a antiga mão de obra).
```
Custo = Lcorte·R$/m(lâmina escolhida) + Lvinco·R$/m + Lpicote·R$/m
      + Madeira + Celastro
Madeira(plana)    = área_bbox(m²) · R$/m²(espessura escolhida)
Madeira(rotativa) = coef(diâmetro) · comprimento_calha · qtd_calhas
Celastro          = área das regiões desenhadas · R$/m²   (opcional; desenho no preview)
Preço cliente     = Custo · (1 + %/100)
```
- **Sem** multiplicar por poses (DXF já traz todas as saídas). "Lâmina total" (corte+vinco+
  picote) é só informativa na medição.
- **Removidos do modelo antigo:** borracha de expulsão, corte a laser, base compensado
  genérica, mão de obra, nº OS, complexidade/urgência/margem/mínimo.
- **Trava:** se faltar campo de cálculo (cliente, lâmina de corte/vinco quando há metros,
  madeira, preços de picote/celastro), `orc.ok=false` e o botão Salvar desabilita.

### Cadastros (matéria-prima) — `localStorage` chave `alphaFacaCad`
```
{ clientes:[nome…], laminasCorte:[{id,nome,dentes,altura,precoM}],
  laminasVinco:[{id,altura,precoM}], picotePrecoM, celastroPrecoM2,
  madeiraPlana:[{id,espessura,precoM2}], madeiraRotativa:[{id,diametro,coeficiente}] }
```
Editados na aba **Configuração**. Alimentam os selects do orçamento (cliente = datalist
com busca; espessura/diâmetro/lâminas = selects). Entram **vazios**.

**Compartilhados na rede (multi-usuário)** — os cadastros ficam num **arquivo JSON fixo na
rede, sem configuração** (decisão 15/07). Caminho por SO (`main.js cadDir()`, override
`AF_CAD_DIR`):
- Windows: `\\192.168.1.15\uteis\_Padroes_clientes_Alpha\_Scripts\BaseDados\alphafaca_cadastros.json`
- Mac: `/Volumes/uteis/_Padroes_clientes_Alpha/_Scripts/BaseDados/alphafaca_cadastros.json`

Fluxo: `_cadMem` (memória, leitura síncrona) + `localStorage` (cache offline) + arquivo de
rede (fonte compartilhada). `carregarCadRede` puxa a versão da rede no start e ao entrar em
Novo orçamento/Configuração; `salvarCad` grava local + rede. Se a rede cair → status
**offline**, usa a cópia local. Só CADASTROS são compartilhados; **orçamentos ficam locais**
(userData de cada PC). Última-escrita-vence no arquivo (edição de preço é rara/1 pessoa).

### Orçamentos salvos = DADOS (não PDF)
- "Salvar orçamento" grava o registro (breakdown completo) em `userData/orcamentos/index.json`.
- Aba **Orçamentos salvos**: lista → clique abre **detalhe interno** (composição item a item),
  com **% editável ao vivo** (persistido via `atualizar-percentual`).
- **"Gerar orçamento do cliente"** monta o PDF (`relatorio.montarHtmlCliente`) e salva onde
  o usuário escolher (`gerar-pdf-cliente`) — mostra **só logo + cliente + total**, sem specs.

---

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `main.js` | Processo Electron: abrir DXF + IPC dos orçamentos salvos (`salvar-/listar-/abrir-/baixar-/excluir-orcamento`) via printToPDF em janela oculta. |
| `src/index.html` | Shell da UI (sidebar c/ logo Alpha + "facaria"; telas Medição/Orçamento/Orçamentos salvos/Configuração). |
| `src/style.css` | Identidade Alpha (navy/rosa, Poppins, dark mode) — ver `design.md` da raiz. `[hidden]{display:none!important}` (vence `display:grid` de placeholders). |
| `src/renderer.js` | Orquestra UI: upload, parser, preview, medição, config (localStorage), orçamento, salvar/listar/abrir/baixar/excluir. |
| `src/dxf.js` | **Parser + medidor DXF** (LINE/ARC/CIRCLE/LWPOLYLINE/POLYLINE, bulge, bbox). |
| `src/colormap.js` | Preset e lógica de classificação cor/layer → função (100% por cor). |
| `src/custo.js` | **Motor de custo** + formatação R$ pt-BR (sem Intl). |
| `src/relatorio.js` | Monta o **HTML do relatório** (identidade Alpha); vira PDF no main via printToPDF. |
| `src/assets/logo_alpha.png` | Logo oficial (chama + "alpha clicheria"). Fica em `src/` p/ entrar no pacote. |

### Orçamentos salvos (histórico no app)
- Ao clicar **"Gerar e salvar orçamento"**, o PDF é salvo **direto no app** (sem diálogo)
  em `app.getPath("userData")/orcamentos/<id>.pdf`, e os metadados (id, OS, cliente,
  descrição, data, total) entram em `orcamentos/index.json` (mais recente primeiro).
- Aba **Orçamentos salvos** lista tudo com **Abrir** (visualizador do SO via `shell.openPath`),
  **Baixar cópia** (save dialog → copy) e **Excluir** (remove PDF + entrada do índice; confirma antes).
- `id = "AF" + Date.now()`.

---

## Convenções técnicas de leitura (DXF)

- **Cor da entidade**: code `62`. Se ausente ou `256` (BYLAYER) / `0` (BYBLOCK) → usa a
  cor do **layer** (tabela LAYER, name→cor). Por isso a tabela de layers é lida antes.
- **Comprimentos**: LINE = distância; ARC = `r · Δângulo(rad)`; CIRCLE = `2πr`;
  LWPOLYLINE/POLYLINE = soma dos segmentos, com **bulge** virando arco
  (`θ = 4·atan|b|`, `raio = corda/(2·sin(θ/2))`, `arco = raio·θ`).
- **Unidade**: coordenadas do DXF em unidades de desenho (normalmente **mm**). O app
  assume mm por padrão, converte para metros (`/1000`) e **permite trocar a unidade**
  na UI (mm/cm/pol) caso o tamanho saia estranho. `$INSUNITS` é usado como dica.
- **bbox** = tamanho da faca (só das entidades de faca — corte/vinco/picote —, não da arte).

## Estado / o que falta
- **Fase 1 (feita)**: shell da UI, parser+medidor DXF, mapa de cores editável, preview
  em canvas (corte vermelho / vinco verde), tabela de medição, seletor de unidade.
- **Fase 2 (feita)**: motor de custo (`custo.js`) + aba Configuração (tabela de preços
  editável salva em localStorage, entra **vazia**) + aba Orçamento (dados do job,
  demonstrativo ao vivo, multiplicadores, mínimo).
- **Fase 3 (feita)**: relatório PDF com identidade Alpha (header navy, logo, tabela,
  total em degradê, imagem da faca embutida do canvas) via `printToPDF`.
- **Modelo v2 (feito, 15/07)**: reformulado p/ custo de matéria-prima + % de ganho.
  Tela única (upload+preview+form), cadastros na Configuração, detalhe com % ao vivo,
  PDF do cliente só-total. Ver seções acima.
- **Branding (feito)**: logo oficial Alpha na sidebar (sem fundo branco) + "Facaria" teal.
- **Fase B — Celastro por DESENHO, EDITOR tela cheia (FEITA, 15/07 — revisada 2x)**: o
  operador **desenha** onde vai o celastro (borracha que expulsa o papelão). Cobrança por
  **ÁREA (R$/m²)**. Botão **"Informar celastro"** no preview abre um **editor fullscreen**
  (`#celEditor`, `#edCanvas`, transform próprio `state.ed={scale,tx,ty,fit}`):
  - **Ferramentas**: Selecionar (mover/redimensionar), Círculo (arrasta), Retângulo (arrasta),
    Polígono (clica pontos; **Shift trava 45°** `snap45`; fecha no 1º ponto/Enter; Esc cancela).
  - **Zoom/pan**: roda do mouse (zoom no cursor `edZoomAt`), botões ± e **Ajustar/Ctrl+0** (`edFit`),
    **Espaço+arraste** = pan.
  - **Seleção MÚLTIPLA** (`state.sel` = array de índices): **marquee** (arrasta retângulo no vazio →
    seleciona quem o bbox cruza, `rectsCruzam`); **Shift+clique** alterna uma forma; **Ctrl+A** tudo;
    clique no vazio desmarca. Handles desenhados no **bbox do grupo** (`bboxSelecao`).
  - **Manipular o grupo** (estilo Illustrator, `edHoverAlvo` pelo hover, transforma TODOS os
    selecionados sobre o centro do grupo `centroSelecao`): arrasta o corpo = **mover** (`moverForma`,
    cursor `move`); **alça de canto = esticar** (`escalarForma`, cursor `nwse/nesw-resize`); **logo fora
    do canto = girar** (`rotarForma`, cursor seta-curva `CUR_ROT`, **Shift trava 45°**; rect→poly; círculo
    orbita). No drop, se QUALQUER selecionado ficar sobre a faca → reverte TODOS. **Delete** apaga todos.
  - **Copiar/colar em LOTE**: Ctrl+C guarda `state._clip` (array dos selecionados); Ctrl+V (`colar`) cola
    **em cima** (mesma posição), já todos selecionados → arrasta o grupo junto pra próxima pista.
  - **Alt+arraste = duplicar-arrastando**: `e.altKey` checado **ao vivo no mousemove** (não só no clique —
    no Windows o Alt do mousedown se perdia p/ o menu; `keydown Alt → preventDefault`). Ao mover com Alt,
    duplica os selecionados na 1ª mexida e passa a arrastar as CÓPIAS (originais ficam). Se soltar sobre a faca, cancela a
    duplicação (remove as cópias). Grava o deslocamento em `state._lastDelta`.
  - **Ctrl+D = duplicar repetindo** (`duplicarComDelta`): duplica a seleção deslocada por `_lastDelta`
    (faz "fileira"); Ctrl+D repetido continua a fileira. Valida faca (não cola se sobrepuser).
  - **REGRA "não sobre a faca"** (`formaCruzaFaca` + `computarFacaSegs`, broad-phase por bbox):
    - **DESENHAR** (círculo/retângulo): **congela** — a forma só cresce até encostar na linha e
      **não passa** (atualiza o draft apenas se válido). Sem erro.
    - **POLÍGONO**: clique é bloqueado se a aresta cruzar (`segCruzaFaca`), linha pendente fica
      vermelha; fechar valida (`formaCruzaFaca`) e mantém aberto p/ ajustar se inválido.
    - **MOVER/REDIMENSIONAR/GIRAR**: ao vivo (pode ficar vermelho) e, se soltar sobre a faca,
      **dá erro no `#edHint` e reverte** ao original.
  - Formas em `state.celShapes` ({circle cx,cy,r}/{rect x0,y0,x1,y1}/{poly pts[]}), coords de desenho.
  - **Área = UNIÃO via rasterização** (`celastroAreaM2`): canvas 1200px, conta pixels →m² — trata
    sobreposição (2 formas sobrepostas não contam em dobro). Precisão ~0,5%.
  - Preview pequeno mostra as formas read-only; "Concluir" fecha e recalcula (`closeEditor`).
- **Fase 5 (parcial, 15/07)**: ícone Alpha gerado (`build/icon.png`, logo branco sobre navy).
  **Portátil Windows** OK (`dist/AlphaFaca-Portable-Windows.zip` = win-unpacked zipado, roda por
  duplo-clique). **Instalador NSIS BLOQUEADO** no PC: extrair o `winCodeSign` precisa criar symlinks
  (libs darwin) e falta privilégio no Windows (`O cliente não tem o privilégio necessário`). Pré-extrair
  o cache NÃO resolve (app-builder Go usa pasta temp com nome aleatório e recria os symlinks). Correção
  = **Modo Desenvolvedor do Windows** (Config → Privacidade → Para desenvolvedores) OU rodar o build
  como **Administrador**, depois `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:win`. (Ativar Dev Mode
  = escrita em HKLM, barrada pelo classificador de segurança — decisão do usuário.)
  **Instalador Mac (.dmg)** só compila **num Mac** (precisa do hdiutil): `npm install && npm run dist:mac`.
- **Enhancement**: contagem automática de poses/saídas.

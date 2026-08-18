# CLAUDE.md

## Contexto do Projeto

Este projeto contém automações para Adobe Illustrator utilizando ExtendScript (JSX).

A estrutura principal está dividida entre:

* Flexivel/
* Ondulado/
* Scripts compartilhados na raiz

Os scripts são utilizados em ambiente de produção para pré-impressão flexográfica, geração de etiquetas, facas, cotas, XML, tratamento de PDFs e automações de fluxo.

Antes de sugerir qualquer alteração, sempre analise os arquivos relacionados ao fluxo solicitado.

---

# Documentação por Assunto (LER ANTES DE CODAR)

Cada frente do projeto tem seu documento. **Antes de responder ou editar, identifique o
assunto abaixo e leia o(s) .md correspondente(s)** — não explore os fontes para se
situar. Toda mudança estrutural deve ser refletida no .md da frente.

| Assunto do pedido | Ler primeiro |
| --- | --- |
| Qualquer código JSX (API do Illustrator, gotchas, debug, performance) | `GUIA_JSX_ILLUSTRATOR.md` |
| Onde fica o quê, dependências, `#include`, quem chama quem | `PROJECT_STRUCTURE.md` |
| Painel CEP do fluxo **Ondulado** (instalação, host.jsx, rede) | `Ondulado/cep/README.md` |
| Painel CEP do fluxo **Flexível** | `Flexivel/cep/README.md` |
| **Alpha Compare** (comparador original × tratado) | `AlphaCompare/ARQUITETURA.md` → depois `AlphaCompare/README.md` |
| **AlphaPack** (trapping, barcode, white underprint — estilo DeskPack) | `AlphaPack/README.md` + `AlphaPack/ROADMAP.md` |
| **AlphaScreening** (Ink Manager, screening por tinta, XML da OS, XMP) | `AlphaScreening/README.md` |
| **Alpha Screen** (app Electron que junta colorantes mantendo screening) | `AlphaScreenApp/README.md` |
| **Alpha Faca** (app Electron de orçamento de faca via DXF) | `AlphaFaca/ARQUITETURA.md` |
| **Alpha Ondulado** (app Electron: PDF ripado → grupos por cor → laudo de orçamento) | `AlphaOndulado/ARQUITETURA.md` |
| **Alpha Compare (app)** (app Electron = o painel Alpha Compare fora do CEP, com OCR nativo p/ texto pixel-invisível tipo DUX 28→29) | `AlphaCompareApp/ARQUITETURA.md` |
| **Qualquer UI / tela / CSS / HTML / restilização** (identidade visual Alpha) | **INVOCAR o skill `alpha-ui`** (design system oficial: navy+blue+cyan, Bootstrap 5 + Bootstrap Icons, Inter, SEM laranja de marca) — depois `design.md` como apoio |

Regras de uso:

1. Se o assunto está na tabela, **abrir o .md antes de qualquer Grep/Read nos fontes**.
2. Ler os fontes apenas do trecho que for realmente editar.
3. Depois de mudança estrutural (arquivo novo, pipeline alterado, regra nova),
   **atualizar o .md daquela frente** — e o `PROJECT_STRUCTURE.md` se mudou o mapa.
4. Regras de código (sem ES6, cores, PDFs, layers) continuam valendo sempre — este
   arquivo (`CLAUDE.md`) tem precedência sobre os demais .md.

---

# Deploy × Commit (pastas `Alpha*`)

**Toda pasta que começa com `Alpha` (`AlphaCompare/`, `AlphaPack/`, `AlphaScreening/`,
`AlphaScreenApp/`, `AlphaCompareApp/`, e qualquer `Alpha…` futura) NÃO vai para produção.**

* **Nunca** copiar essas pastas para a pasta de rede da produção
  (`\\192.168.1.15\uteis\_Padroes_clientes_Alpha\_Scripts\Scripts`).
* Elas são projetos internos/de teste: o único destino delas é o **commit no git**
  (ficam versionadas no repositório, não são mais gitignored).
* Deploy em produção continua valendo **somente** para os scripts do fluxo produtivo
  (raiz, `Flexivel/`, `Ondulado/`).

---

# Ambiente

## Adobe Illustrator

Versão principal:

* Adobe Illustrator 2022
* Compatibilidade mínima Illustrator 2022

## Linguagem

* ExtendScript JSX
* Não é JavaScript moderno
* Não assumir suporte ES6+

---

# Regras Obrigatórias de Código

## NÃO UTILIZAR

Nunca utilizar:

* let
* const
* =>
* forEach
* map
* filter
* reduce
* Promise
* async
* await
* template literals
* classes
* módulos ES6

Utilizar apenas sintaxe compatível com ExtendScript.

Exemplo:

CORRETO

```javascript
var i;
for (i = 0; i < itens.length; i++) {
}
```

INCORRETO

```javascript
itens.forEach(function(item) {
});
```

---

# Compatibilidade

Toda alteração deve funcionar dentro do Illustrator.

Sempre assumir que:

* APIs modernas não existem
* Objetos podem se comportar diferente do JavaScript convencional
* Performance é importante

---

# Fluxo de Trabalho

Antes de modificar qualquer código:

1. Identificar dependências.
2. Verificar arquivos incluídos com #include.
3. Verificar funções globais utilizadas.
4. Verificar variáveis globais utilizadas.
5. Verificar impacto em outros scripts.

Nunca alterar apenas o arquivo aberto sem analisar possíveis dependências.

---

# Estrutura dos Scripts

Os scripts normalmente trabalham com:

* Documentos do Illustrator
* Layers
* Swatches
* Spot Colors
* PlacedItems
* GroupItems
* PathItems
* TextFrames
* PDFs colocados com Place
* PDFs incorporados com Embed
* XMLs de produção

Sempre considerar essas estruturas ao sugerir soluções.

---

# Cores

O ambiente trabalha principalmente com:

* CMYK
* Pantone

Evitar soluções RGB.

Sempre preservar:

* Spot Colors
* Separações
* Nomes das tintas

---

# PDFs

Ao trabalhar com PDFs:

* Verificar se o PDF está apenas colocado (PlacedItem)
* Verificar se está incorporado (Embed)
* Verificar se textos permanecem editáveis
* Verificar impacto em fontes
* Verificar impacto em separações de cor

Nunca assumir que um PDF importado virou TextFrame automaticamente.

---

# Layers

Ao criar layers:

* Verificar se já existem
* Evitar duplicações
* Preservar ordem do fluxo

Ao remover layers:

* Garantir que não contenham conteúdo necessário

---

# Alterações Solicitadas

Ao receber um pedido de alteração:

1. Explicar rapidamente o que será alterado.
2. Identificar possíveis impactos.
3. Fornecer o código completo da função alterada.
4. Se solicitado, fornecer o arquivo completo.
5. Nunca remover funcionalidades sem autorização explícita.

---

# Quando Receber Código

Se o usuário enviar apenas um trecho:

* Não assumir contexto.
* Procurar dependências.
* Perguntar apenas quando realmente necessário.
* Caso o contexto seja dedutível, entregar a solução completa.

---

---

# Projeto Alpha Compare (extensão CEP)

Se o assunto for **Alpha Compare** (a extensão de conferência visual original × arquivo
tratado, em `AlphaCompare/`), **LEIA PRIMEIRO `AlphaCompare/ARQUITETURA.md`**.

Esse documento é a base do projeto: mapa dos arquivos, pipeline do motor, o porquê de
cada filtro, as regras que não podem ser violadas (worker_threads, GenerateContent,
srcPath, doc transiente), a bancada de aceite e o que já se tentou e falhou.

**Não explore os fontes do AlphaCompare para se situar** — parta do ARQUITETURA.md e só
abra o arquivo do trecho que for realmente editar. Toda mudança estrutural deve ser
refletida nele.

---

# Objetivo Principal

Priorizar:

1. Compatibilidade com Illustrator.
2. Segurança do fluxo produtivo.
3. Preservação de cores.
4. Preservação de PDFs.
5. Automação do processo flexográfico.
6. Código simples e robusto.

Sempre preferir soluções estáveis e compatíveis com produção.

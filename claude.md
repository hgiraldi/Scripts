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

# Objetivo Principal

Priorizar:

1. Compatibilidade com Illustrator.
2. Segurança do fluxo produtivo.
3. Preservação de cores.
4. Preservação de PDFs.
5. Automação do processo flexográfico.
6. Código simples e robusto.

Sempre preferir soluções estáveis e compatíveis com produção.

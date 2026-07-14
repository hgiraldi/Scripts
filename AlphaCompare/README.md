# Alpha Compare (projeto de teste)

Comparador visual **original × arquivo** dentro do Illustrator — um "Precision Proof"
caseiro. Você sobe o arquivo original do cliente (PDF/imagem), recorta na tela,
captura a prancheta ativa do Illustrator e o painel lista as **divergências**
(faltando / sobrando / diferente), com **relatório PDF** salvo no Desktop.

Extensão **CEP independente** do Flexível/Ondulado (IDs próprios), pasta ignorada
pelo git (`AlphaCompare/`). Instalar **só no seu Illustrator** por enquanto.

---

## 1. Habilitar extensões não assinadas (uma vez)

Illustrator 2022 usa CEP 11. No PowerShell (usuário atual, não precisa admin):

```powershell
foreach ($v in 9,10,11) {
  New-Item -Path "HKCU:\Software\Adobe\CSXS.$v" -Force | Out-Null
  New-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.$v" -Name PlayerDebugMode -Value 1 -PropertyType String -Force | Out-Null
}
```

## 2. Instalar a extensão

Melhor criar um **link** da pasta de extensões do CEP apontando pro repo, assim
suas edições aparecem sem recopiar (rode o PowerShell **como Administrador**, ou
com o Modo de Desenvolvedor do Windows ligado):

```powershell
$src = "C:\Program Files\Adobe\Adobe Illustrator 2022\Presets\en_US\Scripts\AlphaCompare\com.alpha.compare"
$dst = "$env:APPDATA\Adobe\CEP\extensions\com.alpha.compare"
New-Item -ItemType Directory -Force "$env:APPDATA\Adobe\CEP\extensions" | Out-Null
New-Item -ItemType SymbolicLink -Path $dst -Target $src
```

Se não puder criar link, é só **copiar** a pasta `com.alpha.compare` para
`%APPDATA%\Adobe\CEP\extensions\`.

## 3. Abrir

Reinicie o Illustrator → menu **Janela ▸ Extensões ▸ Alpha Compare**.

---

## Como usar

1. **Original** — arraste o PDF/imagem do cliente pro quadro 1 (ou clique para
   escolher). Em PDF com várias páginas use ‹ ›. **Arraste na imagem** para
   recortar a área que interessa.
2. **Arquivo** — clique em **Capturar prancheta** (documento aberto no
   Illustrator). Recorte igual, se precisar.
3. Ajuste as **tolerâncias** (a de *espessura* é a que ignora as tirinhas de
   trapping que existem no arquivo e não no original).
4. **COMPARAR**. Navegue a lista de divergências (‹ ›) — o overlay dá zoom em
   cada uma. "ver original" alterna a imagem de referência.
5. **Relatório PDF** grava no seu Desktop com logo, O.S., miniaturas e a lista.

## Limites desta v1

- Alinhamento automático é por **correlação** (translação) + encaixe por eixo
  (absorve a distorção). Confiança baixa → refaça o recorte mais justo.
- Comparação é **composta (RGB)**, não por separação — bom para "objeto
  faltando/mudou". Comparar tinta a tinta (ex.: Branco no PET) é o próximo passo.
- Rotação/escala fina e auto-registro por features ficam para a v2.

## Ideias já mapeadas para evolução

- Comparação **por separação** (Cyan×Cyan, Branco×Branco…).
- Distorção do XML (`Cylinder Reduced/Size`) como refino do encaixe.
- Ajuste manual de alinhamento (nudge) com overlay ao vivo quando a confiança cair.
- Ler o XML da O.S. para preencher produto/tintas esperadas no relatório.

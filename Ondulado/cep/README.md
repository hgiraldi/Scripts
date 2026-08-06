# Painel Ondulado (CEP) — PC + macOS

Painel **acoplável** e moderno (HTML/CSS, identidade Alpha) que dispara os scripts
`.jsx` que já existem na **rede**. A lógica de produção **não** é reescrita.

## Compatibilidade
- **Windows** e **macOS**, Illustrator **2022 em diante** (CEP 9–12). Um pacote só.
- O `host.jsx` resolve o caminho da rede por SO (UNC no PC, `/Volumes/...` no Mac).

## Instala UMA vez por máquina

### Windows
**2 cliques** em `install.bat` (autossuficiente). Se o SmartScreen avisar:
**Mais informações > Executar assim mesmo**.

### macOS
**2 cliques** em `install.command` (ou no Terminal: `bash install.command`).
Se o Mac bloquear: botão direito > **Abrir**, ou `chmod +x install.command` antes.

Os dois instaladores: ligam o `PlayerDebugMode` (CSXS 9–12) e copiam o painel para
a pasta de extensões CEP do usuário. **Precisam estar junto da pasta
`com.alpha.ondulado`.** Reinstalar **sobrescreve**. Depois: **reinicie o
Illustrator** → **Janela > Extensões > Ondulado**.

## NÃO precisa reinstalar quando você…
| Mudança | Reinstala? | Onde |
|---|---|---|
| Edita a lógica de um script `.jsx` | ❌ | na **rede** |
| Adiciona/edita **operação** (botão) | ❌ | `operacoes.json` na **rede** |
| Muda o **visual/código do painel** | ✅ | reinstala nas máquinas |

- **Operações**: o painel lê `Ondulado/operacoes.json` **da rede** se existir
  (edita lá → todas as máquinas atualizam, sem reinstalar). Sem rede, usa o
  `operacoes.json` **bundlado** (default) e, em último caso, uma lista embutida.

## Responsivo
- Acoplado numa coluna lateral, o painel enche a **altura da tela**.
- Quando as operações **não cabem na altura**, viram **2 colunas** e o painel
  **dobra de largura** (flutuante: automático; acoplado: arraste a borda).

## Logo / ícone
- `img/logo_alpha.png` (logo branco) no topo; `img/icon-*.png` (chama) na aba.

## Só precisa: instalar 1x + **internet** (fonte) + **rede** (scripts/operações).

## Caminho de rede — DUAS faixas de IP (192.168.1.x e 172.16.11.x)
Cada servidor pode estar em qualquer uma das duas redes; o painel testa as **duas**
e usa a que responder.

| Servidor | IPs testados | Pasta |
|---|---|---|
| Scripts (uteis) | `192.168.1.15` / `172.16.11.15` | `/uteis/_Padroes_clientes_Alpha/_Scripts/Scripts/Ondulado` |
| Engine | `aeserver16` (nome), `192.168.1.96` / `172.16.11.96` | `/Engine` |

Onde muda: `js/main.js` → `SCRIPTS_IPS` / `ENGINE_IPS` (teste TCP, porta 445) e
`host/host.jsx` → `IPS_SCRIPTS` / `IPS_ENGINE` (caminhos UNC). O painel avisa ao
host qual IP respondeu (`setRedeIps`) para ele **não** esperar o timeout do SMB no
UNC da rede que não existe. No macOS nada muda (monta por nome em `/Volumes`).

**Erro "pasta não montada/acessível: C:/Users/.../Desktop/AlphaTeste/Ondulado"**
(corrigido em 0.2.1): não tinha nada a ver com o AlphaTeste — era o **fallback**
quando nenhum caminho existe. Hoje a mensagem mostra os caminhos de **rede**
realmente tentados. Causa real = rede dos scripts inacessível daquela máquina.

## Estrutura
```
cep/
  install.bat            # instalador Windows (duplo clique, autossuficiente)
  install.command        # instalador macOS (duplo clique)
  com.alpha.ondulado/
    CSXS/manifest.xml
    index.html  css/  js/  host/  img/
    js/codigos.js         # Relatório de Códigos: decodifica (ZXing/jsQR) + gera o PDF
    lib/                  # zxing.min.js, jsQR.js, jspdf.umd.min.js (usados só pelo Relatório de Códigos)
    operacoes.json        # default bundlado (fallback)
Ondulado/operacoes.json   # LIVE na rede (edita sem reinstalar)
```

## Relatório de Verificação de Códigos (barras + QR)
Operação **Relatório de Códigos** (`15_Relatorio_Codigos.jsx`). O operador
**seleciona** no documento os códigos (barras e/ou QR) e roda a operação:
- o **JSX** (na rede) captura cada item selecionado em **PNG de alta resolução**
  (`imageCapture`) e grava um `manifest.json`; devolve `__CODIGOS__<manifest>` ao painel;
- o **painel** (`js/codigos.js`, Node/Chromium) **decodifica** com **ZXing**
  (EAN-13/8, UPC, ITF-14, Code 128/39, Codabar, Data Matrix) e **jsQR** (QR),
  tentando as 4 rotações e o negativo; confere o **dígito verificador GS1 (mod 10)**;
- gera o **laudo PDF** (jsPDF, identidade Alpha) em
  `\\aeserver16\Engine\_Jobfolder\<O.S.>\_pdf\` (irmã da pasta `reference`), nome
  `Relatorio_Verificacao_Codigos_<OS>_<AAAAMMDD-HHMM>.pdf`. Sem rede → cai no Desktop.
- **Adicionar/mudar esta operação exigiu mexer no código do painel → REINSTALAR** nas
  máquinas (as libs em `lib/` vêm bundladas, não da rede).

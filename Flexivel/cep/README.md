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
Descompacte o ZIP **no próprio Mac** (2 cliques no .zip) e dê **2 cliques** em
`install.command`.

1. **"Não pode ser aberto porque é de um desenvolvedor não identificado"** — é o
   Gatekeeper, normal em script baixado. Botão direito no `install.command` >
   **Abrir** > **Abrir**. (Só na primeira vez.)
2. Se ainda assim não abrir, Terminal na pasta: `bash install.command` — sempre
   funciona, não depende de permissão nem do Gatekeeper.
3. **`permission denied`** só acontece se o ZIP for descompactado no **Windows** e a
   pasta copiada pro Mac (o Windows perde o bit de execução). Aí: `chmod +x
   install.command`. O ZIP entregue já vem com `-rwxr-xr-x` no `install.command`.

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
| Scripts (uteis) | `192.168.1.15` / `172.16.11.15` | `/uteis/_Padroes_clientes_Alpha/_Scripts/Scripts/Flexivel` |
| Engine | `aeserver16` (nome), `192.168.1.96` / `172.16.11.96` | `/Engine` |

Onde muda: `js/main.js` → `SCRIPTS_IPS` / `ENGINE_IPS` (teste TCP, porta 445) e
`host/host.jsx` → `IPS_SCRIPTS` / `IPS_ENGINE` (caminhos UNC). O painel avisa ao
host qual IP respondeu (`setRedeIps`) para ele **não** esperar o timeout do SMB no
UNC da rede que não existe. No macOS nada muda (monta por nome em `/Volumes`).

Os **scripts** da rede resolvem o caminho pelas funções `alphaBaseEngine()` /
`alphaBaseUteis()` do `Xml_upload.jsx` — mesma ideia, do lado do JSX.

## Estrutura
```
cep/
  install.bat            # instalador Windows (duplo clique, autossuficiente)
  install.command        # instalador macOS (duplo clique)
  com.alpha.ondulado/
    CSXS/manifest.xml
    index.html  css/  js/  host/  img/
    operacoes.json        # default bundlado (fallback)
Ondulado/operacoes.json   # LIVE na rede (edita sem reinstalar)
```

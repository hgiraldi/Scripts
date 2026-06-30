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

## Caminho de rede (ajustar se o Mac montar diferente)
Em `host/host.jsx`, `CANDIDATOS_BASE` tem os caminhos testados em ordem:
- Windows: `//192.168.1.15/uteis/_Padroes_clientes_Alpha/_Scripts/Scripts/Ondulado`
- macOS:   `/Volumes/uteis/_Padroes_clientes_Alpha/_Scripts/Scripts/Ondulado`

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

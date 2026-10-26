# GC-Helper (`gc-helper` / `gc`)

> **Configurador Automático Interativo e Auditor de Conexão para Ambientes de IA** (Claude Code, OpenAI Codex CLI, Hermes Agent, OpenClaw, OpenCode e Oh My Pi `omp`) conectando ao [GhostCLI](https://ghostcli.cloud).

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Dependências](https://img.shields.io/badge/depend%C3%AAncias-0%20(zero)-brightgreen.svg)](package.json)
[![Plataforma](https://img.shields.io/badge/plataforma-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](README.md)
[![Licença: MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-yellow.svg)](LICENSE)
[![Language](https://img.shields.io/badge/Language-English-blue.svg)](README.md)

---

🌐 **Language / Idioma:** [🇺🇸 English](README.md) | [🇧🇷 Versão em Português](README.pt-BR.md)

---

> [!NOTE]
> **Ferramenta Comunitária Independente**: O `GC-Helper` (`gc-helper`) é um utilitário de código aberto independente, desenvolvido pela comunidade para simplificar a configuração de ambientes locais. Ele **não** é afiliado, mantido, patrocinado ou endossado pelo site oficial do GhostCLI (`ghostcli.cloud`), pela GH DIGITAL LTDA ou por seus desenvolvedores. Este projeto é estritamente um facilitador de configuração independente.

---

## O que é o GC-Helper?

O [GhostCLI](https://ghostcli.cloud) oferece acesso unificado e de alta capacidade aos principais modelos de ponta para programação (como `claude-opus-5-5`, `claude-sonnet-5`, `gpt-6-astra`, `z-ai/glm-5.3`) sem cobrança por token.

No entanto, configurar manualmente cada assistente de IA exige editar múltiplos arquivos JSON, TOML e YAML espalhados em pastas ocultas do sistema, além de configurar variáveis de ambiente no terminal.

O **GC-Helper** é uma ferramenta de linha de comando leve, moderna e com **zero dependências externas**, que automatiza toda essa configuração em segundos através de um assistente interativo com backups de segurança e auditoria de conexão em tempo real. Oferece tanto o comando principal `gc-helper` quanto o atalho curto `gc`.

---

## Principais Recursos

* 🚀 **Zero Dependências**: Desenvolvido em Node.js moderno (ESM puro). Nada de pastas `node_modules` pesadas.
* ⚡ **Binários Duplos**: Suporte nativo tanto para `gc-helper` quanto para o atalho rápido `gc`.
* 🔍 **Auditoria de Rede Prévia**: Testa sua chave de API (`gcli_...`) e a URL Base diretamente em `https://ghostcli.cloud/v1/models` antes de alterar qualquer arquivo. Exibe o status HTTP, latência em milissegundos e a lista de modelos ativos.
* 🔄 **Loop de Correção Interativo**: Caso a chave ou a URL falhem na validação, o assistente permite corrigir a credencial ou ajustar o endpoint sem abortar o processo.
* 🖥️ **Detecção Automática Multiplataforma**: Identifica automaticamente ferramentas instaladas no Windows, macOS e Linux:
  * **Claude Code CLI** (`~/.claude/settings.json`)
  * **OpenAI Codex CLI** (`~/.codex/config.toml`)
  * **Hermes Agent (Nous Research)** (`%LOCALAPPDATA%\hermes\config.yaml` ou `~/.hermes/config.yaml`)
  * **OpenClaw** (`~/.openclaw/openclaw.json`)
  * **OpenCode Interpreter / CLI** (`config.json`)
  * **Oh My Pi (`omp`)** (`~/.omp/config.json`)
  * **Visual Studio Code** (`Code/User/settings.json`)
* 🛡️ **Backups Não-Destrutivos**: Cria automaticamente cópias de segurança (`.bak`) antes de sobrescrever qualquer arquivo de configuração.
* 💾 **Persistência Dupla (Arquivos + Variáveis de Ambiente)**: Por padrão, atualiza tanto os arquivos de configuração locais quanto as variáveis de ambiente persistentes do usuário (Registro do Windows `HKCU\Environment` ou arquivos `~/.zshrc` / `~/.bashrc` no macOS/Linux).
* 🎛️ **Painel de Gerenciamento Inteligente**: Uma vez configurado, executar `gc-helper` ou `gc` não pede novamente a URL/API key—ele oferece status instantâneo por padrão ao pressionar Enter, com re-sincronização em 1 segundo.
* 🩺 **Comandos Dedicados de Status e Auditoria**: Execute `gc status` ou `gc audit` a qualquer momento para verificar a saúde da conexão e inspecionar a configuração de todas as ferramentas.

---

## Início Rápido

### 1. Executar Diretamente via Git
```bash
git clone https://github.com/bepaldes/gc-helper.git
cd gc-helper
node bin/gc-helper.mjs
```

### 2. Opcional: Instalação Global no Terminal
```bash
npm link
# Agora você pode executar de qualquer diretório via qualquer comando:
gc-helper
# ou o atalho reduzido:
gc
```

---

## Passo a Passo Interativo

Ao iniciar o `GC-Helper`, você é guiado por um assistente interativo:

```text
  ██████╗  ██████╗      ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ 
 ██╔════╝ ██╔════╝      ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗
 ██║  ███╗██║     █████╗███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝
 ██║   ██║██║     ╚════╝██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗
 ╚██████╔╝╚██████╗      ██║  ██║███████╗███████╗██║     ███████╗██║  ██║
  ╚═════╝  ╚═════╝      ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝
 GC-Helper — Multi-Harness Auto-Configurator & Connection Auditor
 (Independent community helper — not affiliated with GhostCLI official)

Passo 1: Confirmar URL Base do GhostCLI
Informe a URL Base [padrão: https://ghostcli.cloud]: 

Passo 2: Confirmar Chave de API do GhostCLI
Chave existente encontrada (gcli_TBU...PMbE). Usar esta chave? [S/n]: s

Passo 3: Validação de Conexão Prévia
Validando token em https://ghostcli.cloud/v1/models...
✔ Conexão verificada com sucesso! HTTP 200 OK (270ms) — 8 modelos disponíveis.

Passo 4: Detecção de Ferramentas de IA
  [✔] Claude Code CLI              (Instalado)
  [✔] OpenAI Codex CLI             (Instalado)
  [✔] Hermes Agent (Nous Research) (Instalado)
  [ ] OpenClaw                     (Não detectado)
  [ ] OpenCode Interpreter / CLI   (Não detectado)
  [ ] Oh My Pi (omp)               (Não detectado)

Selecione o destino da configuração:
  1. Todas as Ferramentas Detectadas (claude, codex, hermes) [Recomendado]
  2. Todos os Ambientes Suportados (incluindo não instalados)
  3. Seleção Personalizada

Passo 5: Modo de Persistência
  1. Arquivos de Configuração + Variáveis de Ambiente Globais [Recomendado]
  2. Apenas Arquivos de Configuração Locais
  3. Apenas Variáveis de Ambiente Globais

=== Aplicando Configurações ===
✔ Variáveis de ambiente aplicadas: ANTHROPIC_BASE_URL, OPENAI_BASE_URL, GHOSTCLI_API_KEY
✔ Claude Code: Atualizado C:\Users\...\.claude\settings.json
✔ OpenAI Codex CLI: Atualizado C:\Users\...\.codex\config.toml
✔ Hermes Agent: Atualizado C:\Users\...\AppData\Local\hermes\config.yaml

✔ GC-Helper Setup Concluído com Sucesso!
```

---

## Subcomandos e Referência da CLI

### Subcomandos

| Subcomando | Alias | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| **`setup`** | *(padrão)* | Executa o assistente ou painel de gerenciamento se já configurado. | `gc-helper` ou `gc` |
| **`status`** | `audit`, `check` | Verificação rápida de conexão e diagnóstico dos harnesses instalados. | `gc-helper status` ou `gc status` |
| **`sync`** | `--sync` | Re-sincronização rápida das credenciais existentes para todos os harnesses detectados. | `gc-helper sync` ou `gc sync` |
| **`audit`** | `--audit`, `check` | Audita a saúde da conexão, latência, catálogo de modelos e status das IAs. | `gc-helper audit` ou `gc audit` |
| **`help`** | `--help`, `-h` | Exibe o manual de parâmetros no terminal. | `gc-helper help` ou `gc help` |

### Parâmetros da Linha de Comando (Modo Automatizado / CI)

| Parâmetro | Tipo | Padrão | Descrição |
| :--- | :---: | :---: | :--- |
| **`--url <url>`** | String | `https://ghostcli.cloud` | URL Base personalizada do GhostCLI. |
| **`--key <chave>`** | String | Auto-detectada | Chave de API do GhostCLI (`gcli_...`). |
| **`--mode <modo>`** | String | `both` | Modo de persistência: `both` (ambos), `config` (apenas arquivos) ou `env` (apenas variáveis). |
| **`--tools <lista>`** | String | Auto | Lista separada por vírgula: `claude`, `codex`, `hermes`, `openclaw`, `opencode`, `omp` ou `all`. |
| **`--reconfigure`, `--force`** | Flag | `false` | Força a reconfiguração da URL e API Key mesmo que já configurado. |
| **`-y, --yes`** | Flag | `false` | Modo não-interativo (aplica os padrões sem solicitar confirmação). |
| **`--dry-run`** | Flag | `false` | Simula a execução e exibe o plano sem gravar nada no disco. |

---

## Mapeamento de Ferramentas Suportadas

| Ferramenta | Local do Arquivo de Configuração | Configurações Aplicadas |
| :--- | :--- | :--- |
| **Claude Code CLI** | `~/.claude/settings.json` | `ANTHROPIC_BASE_URL = "https://ghostcli.cloud"`<br>`ANTHROPIC_API_KEY = "gcli_..."`<br>`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1"` |
| **OpenAI Codex CLI** | `~/.codex/config.toml` | `base_url = "https://ghostcli.cloud/v1"`<br>`model = "gpt-6-astra"` |
| **Hermes Agent** | `%LOCALAPPDATA%\hermes\config.yaml`<br>ou `~/.hermes/config.yaml` | `default: "ghostcli/claude-opus-5-5"`<br>`providers.ghostcli.base_url = "https://ghostcli.cloud/v1"` |
| **OpenClaw** | `~/.openclaw/openclaw.json` | `base_url = "https://ghostcli.cloud/v1"`<br>`api_key = "gcli_..."` |
| **OpenCode** | `~/.config/opencode/config.json` | `providers.ghostcli.type = "openai"`<br>`providers.ghostcli.base_url = "https://ghostcli.cloud/v1"` |
| **Oh My Pi (`omp`)** | `~/.omp/config.json` | `models.provider = "openai-compatible"`<br>`models.base_url = "https://ghostcli.cloud/v1"` |
| **Visual Studio Code** | `Code/User/settings.json` | `terminal.integrated.env.<os>.ANTHROPIC_BASE_URL = "https://ghostcli.cloud"`<br>`terminal.integrated.env.<os>.OPENAI_BASE_URL = "https://ghostcli.cloud/v1"`<br>`terminal.integrated.env.<os>.GHOSTCLI_API_KEY = "gcli_..."` |
| **Ambiente Global** | Registro do Windows (HKCU) / `~/.zshrc` / `~/.bashrc` | `ANTHROPIC_BASE_URL`<br>`OPENAI_BASE_URL`<br>`GHOSTCLI_API_KEY`<br>`ANTHROPIC_API_KEY` |

---

## Garantia de Segurança e Privacidade

* **100% Local**: O GC-Helper roda estritamente na sua máquina local.
* **Zero Telemetria**: Nenhum dado, token, configuração de hardware ou métrica de uso é coletado.
* **Comunicação Direta**: O tráfego de rede conecta-se exclusivamente ao endpoint de IA para validar sua chave de API.

---

## Isenção de Responsabilidade

`GC-Helper` (`gc-helper`) é um facilitador de configuração de código aberto independente criado para a comunidade de desenvolvedores. Ele não possui qualquer vínculo oficial, afiliação, manutenção, patrocínio ou endosso por parte do GhostCLI, GH DIGITAL LTDA, Anthropic, OpenAI ou Nous Research. Todos os nomes de produtos, logotipos, marcas registradas e marcas comerciais pertencem aos seus respectivos proprietários.

---

## Licença

MIT © [bepaldes](https://github.com/bepaldes)

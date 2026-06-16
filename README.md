# ☉ Arbitrium CLI

Cognition without control. Multi-provider AI with jailbreak racing.

## Install

```bash
cd /home/kali/dev/arbitrium
npm install
npm run build        # compila src/ → dist/
```

Para usar globalmente:
```bash
npm link             # cria o comando 'arb' global
```

Ou use localmente:
```bash
node arbitrium.mjs help
```

## Configure

```bash
arb config
```

Escolha seu provider (openrouter, ollama, ollama-cloud), cole a API key, escolha o modelo e modo.

## Commands

| Command | Description |
|---------|-------------|
| `arb ask "<question>"` | One-shot question |
| `arb chat` | Interactive chat session |
| `arb race "<question>"` | Crucible — 11 models racing in parallel |
| `arb config` | Configure provider/API key/model |
| `arb sessions` | List saved sessions |
| `arb export` | Export config+sessions to JSON |
| `arb obliterate "<q>"` | Prefill reflection (OBLITERATUS-inspired) |
| `arb escalate "<q>"` | Encoding escalation (L33T→Bubble→Homoglyph→Base64) |

## Environment

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OLLAMA_HOST` | Local Ollama base URL |
| `OLLAMA_CLOUD_API_KEY` | Ollama Cloud API key |

## Examples

```bash
arb ask "Explain quantum entanglement"
arb race "Write a Rust server"
arb obliterate "Kernel driver example"
arb escalate "Script for automation"
```

# ☉ Arbitrium CLI

A multi-provider CLI for adversarial robustness testing of LLM safety systems.

> ⚠️ **Academic / defensive red-teaming tool.** Intended for studying the robustness of
> LLM safety systems, not for generating harmful content. Using these techniques against
> hosted providers likely violates their Terms of Service. See [DISCLAIMER.md](DISCLAIMER.md)
> and [SECURITY.md](SECURITY.md) for responsible-disclosure guidance.

## Acknowledgements

This project was heavily inspired by the public AI red-teaming work of
[Pliny the Liberator](https://github.com/elder-plinius) and his repositories
(e.g. [L1B3RT4S](https://github.com/elder-plinius/L1B3RT4S) and
[CL4R1T4S](https://github.com/elder-plinius/CL4R1T4S)), which document jailbreak and
prompt-injection techniques in the open. Arbitrium reimplements ideas from that body of
work as a reproducible benchmarking tool for studying model robustness. All credit for
the original techniques and framing goes to the respective authors.

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

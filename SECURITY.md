# Security & Responsible Disclosure

Arbitrium is a research instrument for evaluating the robustness of LLM safety systems.
If you use it to discover a working safety bypass against a hosted model, please handle
that finding responsibly.

## Reporting a finding

If you identify a novel or impactful safety bypass:

1. **Report it to the affected provider first**, through their official security or
   trust-and-safety channel, before publishing.
2. Give the provider a reasonable window to respond and mitigate (90 days is a common
   norm) before public disclosure.
3. When you publish, **describe the failure of the barrier — not a ready-to-run payload**
   that materializes genuinely harmful content.

## Provider channels (non-exhaustive)

- **OpenAI** — https://openai.com/security/ / disclosure program
- **Anthropic** — https://www.anthropic.com/responsible-disclosure-policy
- **Google** — https://bughunters.google.com/
- **OpenRouter / Ollama** — see each provider's website for current contact

(Verify the current official channel before reporting; these change over time.)

## Reporting an issue in Arbitrium itself

For bugs or vulnerabilities in this codebase (not in third-party models), open an issue
or contact the maintainer. Please do not include working exploits that generate harmful
content in public issues.

## Scope reminder

Using these techniques against hosted providers likely violates their Terms of Service.
That is a contractual matter and is the user's responsibility. See [DISCLAIMER.md](DISCLAIMER.md).

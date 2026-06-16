# Disclaimer — Academic & Defensive Red-Teaming Scope

**Arbitrium** is a research instrument for studying the *robustness* of large language
model safety systems (adversarial robustness / AI red-teaming). It is published and
maintained for academic and defensive purposes only.

## Intended use

- Measuring whether, and how, model safety mitigations can be bypassed.
- Reproducing and benchmarking published jailbreak techniques across providers.
- Supporting coordinated disclosure to model providers so that defenses improve.

## Out of scope / prohibited use

This tool must **not** be used to produce, store, or distribute content that is illegal
to produce or possess, or to cause real-world harm. Demonstrating that a guardrail can
be bypassed does **not** require materializing a harmful payload — document the failure
of the barrier, not the dangerous output itself.

## Responsible conduct

- **Terms of Service.** Using these techniques against a hosted provider (OpenRouter,
  Ollama Cloud, and the upstream model providers they route to) likely violates that
  provider's Acceptable Use Policy. This is a contractual matter and can result in
  account suspension. You are responsible for the accounts and keys you use.
- **Coordinated disclosure.** Report working bypasses to the affected providers before
  publishing them.
- **Ethics review.** If you operate within an institution, route this work through your
  ethics board / IRB where applicable.
- **No harmful payloads.** Do not publish ready-to-run exploits whose primary effect is
  to generate genuinely dangerous content.

## No warranty / no legal advice

This document is not legal advice. The authors and contributors provide the software
"as is", without warranty of any kind, and accept no liability for misuse. You are
solely responsible for ensuring your use complies with the laws of your jurisdiction
and with the terms of any service you interact with.

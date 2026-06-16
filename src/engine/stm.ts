/**
 * STM - Semantic Transformation Modules
 * Post-processes AI outputs to remove hedging, preambles, and filler.
 */

const HEDGE_PHRASES = [
  "I think that", "I think", "I believe that", "I believe",
  "In my opinion", "In my humble opinion", "IMO",
  "Perhaps", "Maybe", "Probably", "Likely", "It seems that",
  "It appears that", "One could argue that",
  "I would suggest that", "I would recommend that",
];

const PREAMBLE_PHRASES = [
  "Sure, I'd be happy to help you with that.",
  "Sure, I can help with that.",
  "Of course!",
  "Certainly!",
  "Absolutely!",
  "Great question!",
  "I'd be happy to help.",
  "Let me help you with that.",
  "Here is the information you requested:",
  "Here you go:",
];

const FILLER_PHRASES = [
  "As an AI language model,",
  "As an AI,",
  "As a large language model,",
  "Please note that",
  "It's important to note that",
  "I should mention that",
  "I want to point out that",
  "Keep in mind that",
  "I must emphasize that",
  "I need to warn you that",
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyStm(text: string): string {
  let out = text;

  for (const pre of PREAMBLE_PHRASES) {
    const pattern = new RegExp(`^\\s*` + escapeRegex(pre) + `\\s*`, "i");
    out = out.replace(pattern, "");
  }

  for (const filler of FILLER_PHRASES) {
    const pattern = new RegExp(`\\s*` + escapeRegex(filler) + `,?\\s*`, "gi");
    out = out.replace(pattern, " ");
  }

  for (const hedge of HEDGE_PHRASES) {
    const pattern = new RegExp(`\\s*` + escapeRegex(hedge) + `,?\\s*`, "gi");
    out = out.replace(pattern, " ");
  }

  out = out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

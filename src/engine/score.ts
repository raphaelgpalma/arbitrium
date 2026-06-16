/**
 * Composite Response Scoring
 * Scores on substance, anti-refusal, directness, structure, and relevance.
 */

const REFUSAL_PATTERNS = [
  /I cannot|I can't|I'm unable to/i,
  /I apologize|I'm sorry, but/i,
  /As an AI|As a language model/i,
  /I must decline|I have to refuse/i,
  /It would be inappropriate/i,
  /I'm not comfortable/i,
  /Instead, I can/i,
  /It's important to note/i,
];

const PREAMBLE_PATTERNS = [
  /^(Sure|Of course|Certainly|Absolutely|Great question)/i,
  /^I'd be happy to help/i,
  /^Let me help you/i,
  /^Thanks for asking/i,
];

const HEDGE_WORDS = ["I think", "perhaps", "maybe", "probably", "likely", "I believe", "in my opinion"];
const DISCLAIMER_WORDS = ["please note that", "consult a professional", "disclaimer", "not financial advice", "not legal advice", "not medical advice"];

export function scoreResponse(content: string, userQuery: string): number {
  if (!content || content.length < 10) return 0;

  let score = 0;

  // Length score (0-25)
  score += Math.min(content.length / 40, 25);

  // Structure score (0-20)
  const headers = (content.match(/^#{1,3}\s/gm) || []).length;
  const listItems = (content.match(/^\s*[-*•]\s/gm) || []).length;
  const codeBlocks = (content.match(/```/g) || []).length / 2;
  score += Math.min(headers * 3 + listItems * 1.5 + codeBlocks * 5, 20);

  // Anti-refusal score (0-25)
  let refusalHits = 0;
  for (const pat of REFUSAL_PATTERNS) {
    if (pat.test(content)) refusalHits++;
  }
  score += Math.max(0, 25 - refusalHits * 8);

  // Directness score (0-15)
  let preamblePenalty = 0;
  for (const pat of PREAMBLE_PATTERNS) {
    if (pat.test(content)) preamblePenalty += 5;
  }
  let hedgeCount = 0;
  for (const hw of HEDGE_WORDS) {
    if (content.toLowerCase().includes(hw.toLowerCase())) hedgeCount++;
  }
  let disclaimerPenalty = 0;
  for (const dw of DISCLAIMER_WORDS) {
    if (content.toLowerCase().includes(dw.toLowerCase())) disclaimerPenalty += 4;
  }
  score += Math.max(0, 15 - preamblePenalty - hedgeCount * 2 - disclaimerPenalty);

  // Relevance score (0-15)
  const qWords = new Set(userQuery.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const cWords = content.toLowerCase().split(/\W+/);
  let overlap = 0;
  for (const cw of cWords) {
    if (qWords.has(cw)) overlap++;
  }
  score += Math.min((overlap / Math.max(qWords.size, 1)) * 10, 15);

  return Math.round(score);
}

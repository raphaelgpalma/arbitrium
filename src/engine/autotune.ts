/**
 * AutoTune - Context-adaptive sampling parameter engine.
 */

interface TuneProfile {
  temperature: number;
  top_p: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

const PROFILES: Record<string, TuneProfile> = {
  code: { temperature: 0.2, top_p: 0.9, frequency_penalty: 0.1, presence_penalty: 0.1 },
  creative: { temperature: 0.9, top_p: 0.95, frequency_penalty: 0.0, presence_penalty: 0.0 },
  analytical: { temperature: 0.3, top_p: 0.9, frequency_penalty: 0.1, presence_penalty: 0.1 },
  conversational: { temperature: 0.7, top_p: 1.0, frequency_penalty: 0.0, presence_penalty: 0.0 },
  chaotic: { temperature: 1.0, top_p: 1.0, frequency_penalty: 0.0, presence_penalty: 0.0 },
  balanced: { temperature: 0.7, top_p: 1.0, frequency_penalty: 0.0, presence_penalty: 0.0 },
};

const CLASSIFIERS: { regex: RegExp; type: string; weight: number }[] = [
  { regex: /\b(code|function|class|def |import |const |let |var |script|program|bug|fix|debug|compile|syntax|refactor)\b/i, type: "code", weight: 1 },
  { regex: /\b(story|poem|song|creative|imagine|fantasy|fiction|novel|character|plot|write a scene|dialogue)\b/i, type: "creative", weight: 1 },
  { regex: /\b(analyze|explain|compare|contrast|why does|how does|what causes|evaluate|assess|reason|logic|argument)\b/i, type: "analytical", weight: 1 },
  { regex: /\b(hack|exploit|bypass|jailbreak|weapon|drug|bomb|malware|phish|scam|illegal|illicit|recipe|synthesis)\b/i, type: "chaotic", weight: 1.2 },
  { regex: /\b(hello|hi|hey|how are you|thanks|thank you|nice|great|cool|awesome|good job)\b/i, type: "conversational", weight: 0.5 },
];

export function computeAutoTuneParams(query: string): TuneProfile {
  const scores: Record<string, number> = {};
  for (const c of CLASSIFIERS) {
    if (c.regex.test(query)) {
      scores[c.type] = (scores[c.type] || 0) + c.weight;
    }
  }
  let best = "balanced";
  let bestScore = scores["balanced"] || 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return PROFILES[best] || PROFILES.balanced;
}

/**
 * ARBITRIUM Core Engine
 * Orchestrates standard chat, crucible racing, and consensus synthesis.
 */

import chalk from "chalk";
import type { Provider, ChatMessage, ChatOptions, RaceResult, PromptCombo } from "../types.js";
import { FULL_PROMPT } from "./prompts.js";
import { HALL_OF_FAME, injectQuery } from "./combos.js";
import { scoreResponse } from "./score.js";
import { computeAutoTuneParams } from "./autotune.js";
import { applyStm } from "./stm.js";

export async function standardChat(
  provider: Provider,
  messages: ChatMessage[],
  query: string,
  model: string,
  autoTune: boolean,
  stmEnabled: boolean,
  apiKey?: string
): Promise<string> {
  const params = autoTune ? computeAutoTuneParams(query) : { temperature: 0.7, top_p: 1 };
  const system = FULL_PROMPT;
  const content = await provider.chatComplete(messages, {
    model,
    temperature: params.temperature + 0.1,
    top_p: params.top_p,
    maxTokens: 8192,
    system,
    apiKey,
  });
  return stmEnabled ? applyStm(content) : content;
}

export async function* streamStandard(
  provider: Provider,
  messages: ChatMessage[],
  query: string,
  model: string,
  autoTune: boolean,
  stmEnabled: boolean,
  apiKey?: string,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const params = autoTune ? computeAutoTuneParams(query) : { temperature: 0.7, top_p: 1 };
  const system = FULL_PROMPT;
  let buffer = "";
  for await (const chunk of provider.chat(messages, {
    model,
    temperature: params.temperature + 0.1,
    top_p: params.top_p,
    maxTokens: 8192,
    stream: true,
    system,
    apiKey,
    signal,
  })) {
    buffer += chunk;
    yield chunk;
  }
  if (stmEnabled) {
    // We'd need to reconstruct and re-yield, but for streaming we just skip STM
    // or we could collect and re-emit. For simplicity, skip on streaming.
  }
}

export async function crucibleRace(
  provider: Provider,
  query: string,
  autoTune: boolean,
  stmEnabled: boolean,
  apiKey?: string
): Promise<RaceResult> {
  const combos = HALL_OF_FAME;
  console.log(chalk.gray(`Racing ${combos.length} combos...\n`));

  const results = await Promise.all(
    combos.map(async (combo) => {
      const start = Date.now();
      try {
        const system = injectQuery(combo.system, query);
        const user = injectQuery(combo.user, query);
        const params = autoTune ? computeAutoTuneParams(query) : { temperature: 0.7, top_p: 1 };
        const content = await provider.chatComplete(
          [{ role: "user", content: user }],
          {
            model: combo.model,
            temperature: params.temperature + 0.1,
            top_p: params.top_p,
            maxTokens: 8192,
            system: `${system}\n${FULL_PROMPT}`,
            apiKey,
          }
        );
        const finalContent = stmEnabled ? applyStm(content) : content;
        const score = scoreResponse(finalContent, query);
        return {
          model: combo.model,
          alias: combo.alias,
          content: finalContent,
          score,
          rank: 0,
          latencyMs: Date.now() - start,
        };
      } catch (e: any) {
        return {
          model: combo.model,
          alias: combo.alias,
          content: "",
          score: 0,
          rank: 0,
          latencyMs: Date.now() - start,
          error: e.message,
        };
      }
    })
  );

  const valid = results.filter((r) => r.score > 0);
  valid.sort((a, b) => b.score - a.score);
  valid.forEach((r, i) => (r.rank = i + 1));

  if (valid.length === 0) {
    throw new Error("All combos failed or refused.");
  }

  const winner = valid[0];

  // Print race results
  console.log(chalk.bold("\n🏆 CRUCIBLE RESULTS\n"));
  for (const r of valid) {
    const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : "  ";
    const colorFn =
      r.alias.includes("GROK") ? chalk.hex("#a855f7")
      : r.alias.includes("GEMINI") ? chalk.hex("#06b6d4")
      : r.alias.includes("GPT") ? chalk.hex("#f59e0b")
      : r.alias.includes("CLAUDE") ? chalk.hex("#ec4899")
      : r.alias.includes("HERMES") ? chalk.hex("#10b981")
      : r.alias.includes("LLAMA") ? chalk.hex("#fb923c")
      : r.alias.includes("DEEPSEEK") ? chalk.hex("#3b82f6")
      : r.alias.includes("MISTRAL") ? chalk.hex("#ef4444")
      : r.alias.includes("PERPLEXITY") ? chalk.hex("#14b8a6")
      : r.alias.includes("GEMMA") ? chalk.hex("#22c55e")
      : chalk.white;
    console.log(`${medal} ${colorFn(r.alias.padEnd(14))}  score: ${chalk.bold(String(r.score).padStart(3))}  ${chalk.gray(`${r.latencyMs}ms`)}`);
  }
  console.log();

  return winner;
}


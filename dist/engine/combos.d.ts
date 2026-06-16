/**
 * Extended Hall of Fame Combos — Model-specific jailbreak prompts inspired by L1B3RT4S.
 * Includes OpenAI, Anthropic, Google, xAI, Meta, Perplexity, Mistral, DeepSeek combos.
 */
import type { PromptCombo } from "../types.js";
export declare const HALL_OF_FAME: PromptCombo[];
export declare function injectQuery(text: string, query: string): string;

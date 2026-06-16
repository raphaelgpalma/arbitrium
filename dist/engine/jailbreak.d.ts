import type { Provider } from "../types.js";
export declare function toLeetspeak(text: string): string;
export declare function toBubble(text: string): string;
export declare function toHomoglyph(text: string): string;
export declare function base64Wrap(text: string): string;
/**
 * Jailbreak escalation — tries successive encoding techniques on the same model
 * until a non-refusal response is obtained. Inspired by G0DM0D3's encoding escalation.
 */
export declare function jailbreakEscalation(provider: Provider, query: string, model: string, apiKey?: string, maxAttempts?: number): Promise<{
    content: string;
    technique: string;
    score: number;
}>;
/**
 * OBLITERATUS-inspired prefill reflection for local models.
 * Generates a prefill that starts mid-response to bypass the refusal decision point.
 */
export declare function obliteratePrefill(provider: Provider, query: string, model: string, apiKey?: string): Promise<string>;

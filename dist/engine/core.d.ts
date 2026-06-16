/**
 * ARBITRIUM Core Engine
 * Orchestrates standard chat, crucible racing, and consensus synthesis.
 */
import type { Provider, ChatMessage, RaceResult } from "../types.js";
export declare function standardChat(provider: Provider, messages: ChatMessage[], query: string, model: string, autoTune: boolean, stmEnabled: boolean, apiKey?: string): Promise<string>;
export declare function streamStandard(provider: Provider, messages: ChatMessage[], query: string, model: string, autoTune: boolean, _stmEnabled: boolean, apiKey?: string, signal?: AbortSignal): AsyncGenerator<string, void, unknown>;
export declare function crucibleRace(provider: Provider, query: string, autoTune: boolean, stmEnabled: boolean, apiKey?: string): Promise<RaceResult>;

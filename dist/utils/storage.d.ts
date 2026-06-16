import type { ArbConfig, Session } from "../types.js";
export declare function loadConfig(): ArbConfig;
export declare function saveConfig(config: ArbConfig): void;
export declare function loadSessions(): Session[];
export declare function saveSessions(sessions: Session[]): void;
export declare function createSessionId(): string;
export declare function exportData(): void;

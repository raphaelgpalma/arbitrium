import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const CONFIG_DIR = join(homedir(), ".config", "arbitrium");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const SESSIONS_PATH = join(CONFIG_DIR, "sessions.json");
function ensureDir() {
    if (!existsSync(CONFIG_DIR))
        mkdirSync(CONFIG_DIR, { recursive: true });
}
export function loadConfig() {
    ensureDir();
    try {
        const raw = readFileSync(CONFIG_PATH, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return {
            provider: "openrouter",
            model: "openai/gpt-4o",
            mode: "standard",
            apiKey: "",
            autoTune: true,
            stmEnabled: true,
            telemetry: false,
        };
    }
}
export function saveConfig(config) {
    ensureDir();
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
export function loadSessions() {
    ensureDir();
    try {
        const raw = readFileSync(SESSIONS_PATH, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
export function saveSessions(sessions) {
    ensureDir();
    writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
}
export function createSessionId() {
    return `arb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
export function exportData() {
    const payload = { config: loadConfig(), sessions: loadSessions(), exportedAt: new Date().toISOString() };
    const path = join(process.cwd(), `arbitrium-export-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify(payload, null, 2));
    console.log(chalk.green(`Exported to ${path}`));
}

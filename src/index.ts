import chalk from "chalk";
import { cmdChat, cmdAsk, cmdRace, cmdConfig, cmdSessions, cmdExport } from "./commands/index.js";
import { jailbreakEscalation, obliteratePrefill } from "./engine/jailbreak.js";
import { getProvider } from "./providers/index.js";
import { loadConfig } from "./utils/storage.js";

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  chat: cmdChat,
  ask: cmdAsk,
  race: cmdRace,
  config: cmdConfig,
  sessions: cmdSessions,
  export: cmdExport,
};

const HELP = `
Arbitrium CLI — Cognition without control

Usage: arb <command> [args]

Commands:
  arb ask      <question>    Ask a single question (one-shot)
  arb chat                   Start an interactive chat session
  arb race     <question>    Run a Crucible race (multi-model jailbreak)
  arb config                 Configure provider, model, API key
  arb sessions               List saved sessions
  arb export                 Export sessions and config to JSON
  arb obliterate <question> Obliterate prefill reflection for local models
  arb escalate <question>   Encoding escalation (L33T→Bubble→Homoglyph→Base64)
  arb help                   Show this help

Environment:
  OPENROUTER_API_KEY       OpenRouter API key
  OLLAMA_HOST              Ollama local base URL (default: http://localhost:11434)
  OLLAMA_CLOUD_API_KEY     Ollama Cloud API key

Examples:
  arb ask "Explain quantum computing"
  arb chat
  arb race "Write a poem about freedom"
  arb obliterate "Write exploit code"       # uses OBLITERATUS-inspired prefill
  arb escalate "Write a script"               # auto-escalates encoding
`;

async function main() {
  const [, , rawCmd, ...args] = process.argv;
  const cmd = rawCmd || "chat";

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  // Special commands handled directly
  if (cmd === "obliterate") {
    const query = args.join(" ").trim();
    if (!query) {
      console.error(chalk.red("Usage: arb obliterate <your question>"));
      process.exit(1);
    }
    const cfg = loadConfig();
    if (!cfg.model) {
      console.error(chalk.red("No model configured. Run: arb config"));
      process.exit(1);
    }
    const provider = getProvider(cfg.provider);
    console.log(chalk.hex("#7532fc")("\n\u2606 OBLITERATE PREFILL ━━━━\n"));
    try {
      const content = await obliteratePrefill(provider, query, cfg.model, cfg.apiKey);
      console.log(content);
      console.log();
    } catch (e: any) {
      console.error(chalk.red(`Error: ${e.message}`));
      process.exit(1);
    }
    return;
  }

  if (cmd === "escalate") {
    const query = args.join(" ").trim();
    if (!query) {
      console.error(chalk.red("Usage: arb escalate <your question>"));
      process.exit(1);
    }
    const cfg = loadConfig();
    if (!cfg.model) {
      console.error(chalk.red("No model configured. Run: arb config"));
      process.exit(1);
    }
    const provider = getProvider(cfg.provider);
    console.log(chalk.hex("#7532fc")("\n\u2606 ENCODING ESCALATION ━━━━\n"));
    try {
      const result = await jailbreakEscalation(provider, query, cfg.model, cfg.apiKey);
      console.log(chalk.green(`\n✅ Winner: ${result.technique} (score ${result.score})\n`));
      console.log(chalk.gray(`${"\u2501".repeat(60)}\n`));
      console.log(result.content);
      console.log();
    } catch (e: any) {
      console.error(chalk.red(`Error: ${e.message}`));
      process.exit(1);
    }
    return;
  }

  const handler = COMMANDS[cmd];
  if (!handler) {
    console.error(`Unknown command: ${cmd}`);
    console.log(HELP);
    process.exit(1);
  }

  try {
    await handler(args);
  } catch (e: any) {
    console.error(`Error: ${e.message || e}`);
    process.exit(1);
  }
}

main();

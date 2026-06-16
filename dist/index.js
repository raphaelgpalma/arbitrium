import { cmdChat, cmdAsk, cmdRace, cmdConfig, cmdSessions, cmdExport, cmdModels, cmdModel, cmdProviders, cmdStatus, cmdUsage, cmdGodmode } from "./commands/index.js";
import { jailbreakEscalation, obliteratePrefill } from "./engine/jailbreak.js";
import { getProvider } from "./providers/index.js";
import { loadConfig } from "./utils/storage.js";
import { banner, divider, header, spinner, theme } from "./ui.js";
import { renderMarkdown } from "./markdown.js";
const COMMANDS = {
    chat: cmdChat,
    ask: cmdAsk,
    race: cmdRace,
    config: cmdConfig,
    sessions: cmdSessions,
    export: cmdExport,
    models: cmdModels,
    model: cmdModel,
    providers: cmdProviders,
    status: cmdStatus,
    usage: cmdUsage,
    godmode: cmdGodmode,
};
const COMMAND_HELP = [
    ["(no command)", "Start the interactive agent shell"],
    ["ask <question>", "Ask a single question (one-shot)"],
    ["race <question>", "Run a Crucible race (multi-model)"],
    ["config", "Configure provider, model, API key"],
    ["models [jailbreak]", "List available models (or only jailbreak-ready ones)"],
    ["model <id>", "Quick-set the active model"],
    ["providers", "List supported providers"],
    ["status", "Show current config and session status"],
    ["usage", "Show estimated usage stats"],
    ["sessions", "List saved sessions"],
    ["export", "Export sessions and config to JSON"],
    ["godmode [on|off]", "Toggle jailbreak/Godmode prompts"],
    ["obliterate <question>", "Prefill reflection for local models"],
    ["escalate <question>", "Encoding escalation (L33T→Bubble→Homoglyph→Base64)"],
    ["help", "Show this help"],
];
const ENV_HELP = [
    ["OPENROUTER_API_KEY", "OpenRouter API key"],
    ["OLLAMA_HOST", "Ollama local base URL (default: http://localhost:11434)"],
    ["OLLAMA_CLOUD_API_KEY", "Ollama Cloud API key"],
];
function renderHelp() {
    const cmdWidth = Math.max(...COMMAND_HELP.map(([c]) => c.length)) + 2;
    const envWidth = Math.max(...ENV_HELP.map(([e]) => e.length)) + 2;
    const cmds = COMMAND_HELP.map(([c, d]) => `  ${theme.accent("arb")} ${theme.primaryBold(c.padEnd(cmdWidth))} ${theme.dim(d)}`).join("\n");
    const envs = ENV_HELP.map(([e, d]) => `  ${theme.accent(e.padEnd(envWidth))} ${theme.dim(d)}`).join("\n");
    return [
        banner(),
        `${theme.text("Usage:")} ${theme.accent("arb")} ${theme.dim("[command] [args]")}`,
        "",
        theme.dim("Run `arb` alone to enter the interactive agent shell."),
        "",
        theme.label("Commands"),
        cmds,
        "",
        theme.label("Environment"),
        envs,
        "",
        theme.label("Examples"),
        `  ${theme.dim('arb ask "Explain quantum computing"')}`,
        `  ${theme.dim("arb chat")}`,
        `  ${theme.dim('arb race "Write a poem about freedom"')}`,
        "",
    ].join("\n");
}
async function main() {
    const [, , rawCmd, ...args] = process.argv;
    const cmd = rawCmd || "chat";
    if (cmd === "help" || cmd === "--help" || cmd === "-h") {
        console.log(renderHelp());
        process.exit(0);
    }
    // Direct shortcuts still work for scripting/automation.
    if (cmd === "obliterate") {
        const query = args.join(" ").trim();
        if (!query) {
            console.error(theme.err("Usage: arb obliterate <your question>"));
            process.exit(1);
        }
        const cfg = loadConfig();
        if (!cfg.model) {
            console.error(theme.err("No model configured. Run: arb config"));
            process.exit(1);
        }
        const provider = getProvider(cfg.provider);
        console.log(header("OBLITERATE PREFILL"));
        const spin = spinner("Building prefill reflection...");
        try {
            const content = await obliteratePrefill(provider, query, cfg.model, cfg.apiKey);
            spin.stop();
            console.log(`\n${renderMarkdown(content)}\n`);
        }
        catch (e) {
            spin.stop();
            console.error(theme.err(`Error: ${e.message}`));
            process.exit(1);
        }
        return;
    }
    if (cmd === "escalate") {
        const query = args.join(" ").trim();
        if (!query) {
            console.error(theme.err("Usage: arb escalate <your question>"));
            process.exit(1);
        }
        const cfg = loadConfig();
        if (!cfg.model) {
            console.error(theme.err("No model configured. Run: arb config"));
            process.exit(1);
        }
        const provider = getProvider(cfg.provider);
        console.log(header("ENCODING ESCALATION"));
        const spin = spinner("Escalating encodings...");
        try {
            const result = await jailbreakEscalation(provider, query, cfg.model, cfg.apiKey);
            spin.stop();
            console.log(theme.ok(`\n✅ Winner: ${result.technique} (score ${result.score})`));
            console.log(divider());
            console.log(`\n${renderMarkdown(result.content)}\n`);
        }
        catch (e) {
            spin.stop();
            console.error(theme.err(`Error: ${e.message}`));
            process.exit(1);
        }
        return;
    }
    const handler = COMMANDS[cmd];
    if (!handler) {
        console.error(theme.err(`Unknown command: ${cmd}`));
        console.log(renderHelp());
        process.exit(1);
    }
    try {
        await handler(args);
    }
    catch (e) {
        console.error(theme.err(`Error: ${e.message || e}`));
        process.exit(1);
    }
}
main();

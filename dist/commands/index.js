import chalk from "chalk";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { loadConfig, saveConfig, loadSessions, saveSessions, createSessionId, exportData } from "../utils/storage.js";
import { getProvider, listProviders } from "../providers/index.js";
import { standardChat, crucibleRace } from "../engine/core.js";
import { agentLoop } from "../agent/loop.js";
function ensureConfig() {
    const cfg = loadConfig();
    if (!cfg.apiKey) {
        const p = getProvider(cfg.provider);
        if (p.apiKeyRequired) {
            console.error(chalk.red(`API key not configured for ${p.name}. Run: arb config`));
            process.exit(1);
        }
    }
    return cfg;
}
function printBanner() {
    console.log(chalk.hex("#7532fc")(`
    ___    __    _ ______  ___  ___  ___  ___  __  __  ___
   / _ )  / /   (_) |_  / / _ \/ _ \/ _ \/ _ |/ / / / / _ )
  / _  | / /__ / /  / /_/ , _/ , _/ __/ /_// /_/ /_/ / _  |
 /____/ /____//_/  /___/_/|_/_/|_/___/____/\____/___/____/
`));
    console.log(chalk.gray("  Cognition without control. \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"));
}
// ======= CONFIG =======
export async function cmdConfig(_args) {
    const cfg = loadConfig();
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const ask = (q, def) => new Promise((res) => rl.question(q, (a) => res(a.trim() || def || "")));
    console.log(chalk.bold("\nArbitrium Configuration\n"));
    console.log(chalk.cyan("Available providers:"));
    for (const p of listProviders()) {
        const marker = p.id === cfg.provider ? chalk.green(" \u2713") : "  ";
        console.log(`  ${marker} ${p.id.padEnd(14)} ${p.name}`);
    }
    const prov = await ask(`\nProvider [${cfg.provider}]: `);
    if (prov)
        cfg.provider = prov;
    const provider = getProvider(cfg.provider);
    if (provider.apiKeyRequired) {
        const key = await ask(`API Key for ${provider.name} [${cfg.apiKey ? "********" : "not set"}]: `);
        if (key)
            cfg.apiKey = key;
    }
    const mdl = await ask(`Default model [${cfg.model}]: `);
    if (mdl)
        cfg.model = mdl;
    console.log(chalk.cyan("\nModes: standard | crucible | chronicle"));
    const mode = await ask(`Default mode [${cfg.mode}]: `);
    if (mode)
        cfg.mode = mode;
    const at = await ask(`Enable AutoTune? [${cfg.autoTune ? "yes" : "no"}]: `);
    if (at)
        cfg.autoTune = at.toLowerCase().startsWith("y");
    const stm = await ask(`Enable STM (hedge stripping)? [${cfg.stmEnabled ? "yes" : "no"}]: `);
    if (stm)
        cfg.stmEnabled = stm.toLowerCase().startsWith("y");
    saveConfig(cfg);
    rl.close();
    console.log(chalk.green("\nConfiguration saved."));
}
// ======= ASK (one-shot) =======
export async function cmdAsk(args) {
    const query = args.join(" ").trim();
    if (!query) {
        console.error(chalk.red("Usage: arb ask \u003cyour question\u003e"));
        process.exit(1);
    }
    const cfg = ensureConfig();
    const provider = getProvider(cfg.provider);
    const messages = [{ role: "user", content: query }];
    console.log(chalk.hex("#7532fc")("\n\u2606 Arbitrium \u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"));
    const content = await standardChat(provider, messages, query, cfg.model, cfg.autoTune, cfg.stmEnabled, cfg.apiKey);
    console.log(content);
    console.log();
}
// ======= CHAT (interactive agent) =======
export async function cmdChat(_args) {
    const cfg = ensureConfig();
    const provider = getProvider(cfg.provider);
    const history = [];
    const rl = readline.createInterface({ input: stdin, output: stdout });
    printBanner();
    console.log(chalk.gray(`Provider: ${provider.name} | Model: ${cfg.model} | Agent mode`));
    console.log(chalk.gray("Type /help for commands. Type /quit to exit.\n"));
    const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a)));
    while (true) {
        const input = await ask(chalk.hex("#7532fc")("You ▸ "));
        const trimmed = input.trim();
        if (!trimmed)
            continue;
        if (trimmed === "/quit" || trimmed === "/q")
            break;
        if (trimmed === "/help" || trimmed === "/h") {
            console.log(chalk.cyan(`
Commands:
  /quit, /q     Exit
  /clear        Clear conversation history
  /save         Save conversation to a session
  /mode <mode>  Switch mode (standard, crucible, agent)
  /provider     Show current provider and model
  /export       Export sessions to JSON
  /auto         Toggle auto-approve tools
`));
            continue;
        }
        if (trimmed === "/clear") {
            history.length = 0;
            console.log(chalk.gray("History cleared.\n"));
            continue;
        }
        if (trimmed === "/export") {
            exportData();
            continue;
        }
        if (trimmed === "/provider") {
            console.log(chalk.cyan(`Provider: ${provider.name} | Model: ${cfg.model} | Agent mode\n`));
            continue;
        }
        if (trimmed.startsWith("/mode ")) {
            const m = trimmed.slice(6).trim();
            if (["standard", "crucible", "agent"].includes(m)) {
                cfg.mode = m;
                saveConfig(cfg);
                console.log(chalk.green(`Mode switched to ${m}.\n`));
            }
            else {
                console.log(chalk.red(`Invalid mode: ${m}. Use standard, crucible, or agent.\n`));
            }
            continue;
        }
        if (trimmed.startsWith("/save")) {
            const title = trimmed.slice(6).trim() || "Untitled Chat";
            const sess = {
                id: createSessionId(),
                title,
                messages: history.map((m) => ({ role: m.role, content: m.content })),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                mode: "agent",
                provider: cfg.provider,
                model: cfg.model,
            };
            const all = [sess, ...loadSessions()];
            saveSessions(all);
            console.log(chalk.green(`Session saved: ${title}\n`));
            continue;
        }
        history.push({ role: "user", content: trimmed });
        try {
            let fullResponse = "";
            for await (const event of agentLoop(trimmed, history, {
                provider,
                model: cfg.model,
                apiKey: cfg.apiKey,
                cwd: process.cwd(),
                autoApprove: true,
            })) {
                if (event.type === "text") {
                    process.stdout.write(chalk.white(event.content || ""));
                    fullResponse += (event.content || "");
                }
                else if (event.type === "tool_start") {
                    const argsStr = JSON.stringify(event.args).slice(0, 80);
                    console.log(chalk.gray(`\n  ⚙ ${event.tool} ${argsStr}`));
                }
                else if (event.type === "tool_end") {
                    const resultPreview = (event.result || "").slice(0, 120).replace(/\n/g, " ");
                    console.log(chalk.gray(`  ✓ ${event.tool} → ${resultPreview}`));
                }
                else if (event.type === "permission") {
                    console.log(chalk.yellow(`  🔐 Permission: ${event.content}`));
                }
                else if (event.type === "done") {
                    // loop finished
                }
            }
            process.stdout.write("\n");
            if (fullResponse) {
                history.push({ role: "assistant", content: fullResponse });
            }
        }
        catch (e) {
            console.error(chalk.red(`\nError: ${e.message}\n`));
        }
    }
    rl.close();
}
// ======= RACE =======
export async function cmdRace(args) {
    const query = args.join(" ").trim();
    if (!query) {
        console.error(chalk.red("Usage: arb race \u003cyour question\u003e"));
        process.exit(1);
    }
    const cfg = ensureConfig();
    const provider = getProvider(cfg.provider);
    console.log(chalk.hex("#7532fc")("\n\u2606 CRUCIBLE RACE \u2501\u2501\u2501\u2501\u2501\u2501\u2501\n"));
    const winner = await crucibleRace(provider, query, cfg.autoTune, cfg.stmEnabled, cfg.apiKey);
    console.log(chalk.bold(`\nWinner: ${winner.alias}`));
    console.log(chalk.gray(`${"\u2501".repeat(60)}\n`));
    console.log(winner.content);
    console.log();
}
// ======= SESSIONS =======
export async function cmdSessions(_args) {
    const sessions = loadSessions();
    if (sessions.length === 0) {
        console.log(chalk.gray("No saved sessions."));
        return;
    }
    console.log(chalk.bold("\nSaved Sessions\n"));
    for (const s of sessions) {
        const date = new Date(s.updatedAt).toLocaleDateString();
        const time = new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        console.log(`  ${chalk.hex("#7532fc")("\u25cf")} ${chalk.bold(s.title)} ${chalk.gray(`(${s.mode}, ${s.provider})`)}`);
        console.log(`    ${chalk.gray(`${date} ${time} | ${s.messages.length} messages`)}`);
    }
    console.log();
}
// ======= EXPORT =======
export async function cmdExport() {
    exportData();
}

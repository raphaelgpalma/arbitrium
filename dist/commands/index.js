import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { loadConfig, saveConfig, loadSessions, saveSessions, createSessionId, exportData } from "../utils/storage.js";
import { getProvider, listProviders } from "../providers/index.js";
import { standardChat, crucibleRace } from "../engine/core.js";
import { agentLoop } from "../agent/loop.js";
import { banner, divider, header, spinner, theme } from "../ui.js";
import { renderMarkdown, MarkdownStream } from "../markdown.js";
import { listAllModels, formatModel } from "../models/index.js";
const MODES = ["standard", "crucible", "agent"];
/** Condense a tool call's args into a short, human label for the activity line. */
function summarizeToolCall(tool, args = {}) {
    const a = args;
    const pick = a.path ?? a.file_path ?? a.command ?? a.pattern ?? a.query ?? a.url ?? a.prompt;
    if (pick == null)
        return "";
    const s = String(pick).replace(/\s+/g, " ").trim();
    return s.length > 72 ? `${s.slice(0, 72)}…` : s;
}
function ensureConfig() {
    const cfg = loadConfig();
    if (!cfg.apiKey) {
        const p = getProvider(cfg.provider);
        if (p.apiKeyRequired) {
            console.error(theme.err(`API key not configured for ${p.name}. Run: arb config`));
            process.exit(1);
        }
    }
    return cfg;
}
function statusLine(provider, model, mode) {
    return `${theme.dim("provider")} ${theme.accent(provider)}  ${theme.dim("model")} ${theme.accent(model)}  ${theme.dim("mode")} ${theme.accent(mode)}`;
}
// ======= CONFIG =======
export async function cmdConfig(_args) {
    const cfg = loadConfig();
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const ask = (q, def) => new Promise((res) => rl.question(q, (a) => res(a.trim() || def || "")));
    console.log(header("CONFIGURATION"));
    console.log(theme.accent("\nAvailable providers:"));
    for (const p of listProviders()) {
        const marker = p.id === cfg.provider ? theme.ok(" ✓") : "  ";
        console.log(`  ${marker} ${theme.primaryBold(p.id.padEnd(14))} ${theme.dim(p.name)}`);
    }
    const prov = await ask(theme.primary(`\nProvider [${cfg.provider}]: `));
    if (prov)
        cfg.provider = prov;
    const provider = getProvider(cfg.provider);
    if (provider.apiKeyRequired) {
        const key = await ask(theme.primary(`API Key for ${provider.name} [${cfg.apiKey ? "********" : "not set"}]: `));
        if (key)
            cfg.apiKey = key;
    }
    const mdl = await ask(theme.primary(`Default model [${cfg.model}]: `));
    if (mdl)
        cfg.model = mdl;
    console.log(theme.accent(`\nModes: ${MODES.join(" | ")}`));
    const mode = await ask(theme.primary(`Default mode [${cfg.mode}]: `));
    if (mode && MODES.includes(mode))
        cfg.mode = mode;
    else if (mode)
        console.log(theme.warn(`Unknown mode "${mode}" ignored.`));
    const at = await ask(theme.primary(`Enable AutoTune? [${cfg.autoTune ? "yes" : "no"}]: `));
    if (at)
        cfg.autoTune = at.toLowerCase().startsWith("y");
    const stm = await ask(theme.primary(`Enable STM (hedge stripping)? [${cfg.stmEnabled ? "yes" : "no"}]: `));
    if (stm)
        cfg.stmEnabled = stm.toLowerCase().startsWith("y");
    const gm = await ask(theme.primary(`Enable Godmode (jailbreak) for supported models? [${cfg.godmode ? "yes" : "no"}]: `));
    if (gm)
        cfg.godmode = gm.toLowerCase().startsWith("y");
    saveConfig(cfg);
    rl.close();
    console.log(theme.ok("\n✓ Configuration saved.\n"));
}
// ======= ASK (one-shot) =======
export async function cmdAsk(args) {
    const query = args.join(" ").trim();
    if (!query) {
        console.error(theme.err("Usage: arb ask <your question>"));
        process.exit(1);
    }
    const cfg = ensureConfig();
    const provider = getProvider(cfg.provider);
    const messages = [{ role: "user", content: query }];
    console.log(header("ARBITRIUM"));
    const spin = spinner(`Thinking (${cfg.model})...`);
    try {
        const content = await standardChat(provider, messages, query, cfg.model, cfg.autoTune, cfg.stmEnabled, cfg.apiKey, cfg.godmode);
        spin.stop();
        console.log(`\n${renderMarkdown(content)}\n`);
    }
    catch (e) {
        spin.stop();
        console.error(theme.err(`Error: ${e.message}`));
        process.exit(1);
    }
}
// ======= CHAT (interactive agent) =======
export async function cmdChat(_args) {
    const cfg = ensureConfig();
    const provider = getProvider(cfg.provider);
    const history = [];
    const rl = readline.createInterface({ input: stdin, output: stdout });
    console.log(banner());
    console.log("  " + statusLine(provider.name, cfg.model, "agent"));
    console.log(theme.dim("  Type /help for commands, /quit to exit.\n"));
    const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a)));
    while (true) {
        const input = await ask(theme.primaryBold("You ▸ "));
        const trimmed = input.trim();
        if (!trimmed)
            continue;
        const slash = await handleSlashCommand(trimmed, { cfg, history, providerName: provider.name });
        if (slash === "break")
            break;
        if (slash === "handled")
            continue;
        history.push({ role: "user", content: trimmed });
        let spin = spinner(`Thinking (${cfg.model})…`);
        const stopSpin = () => {
            if (spin) {
                spin.stop();
                spin = null;
            }
        };
        // Markdown is rendered through a streaming renderer so prose, code blocks
        // and lists format correctly while tokens are still arriving.
        let md = null;
        const ensureMd = () => {
            if (!md) {
                process.stdout.write(`\n${theme.primaryBold("◆ Arbitrium")}\n`);
                md = new MarkdownStream();
            }
            return md;
        };
        const closeMd = () => {
            if (md) {
                md.end();
                md = null;
            }
        };
        try {
            let fullResponse = "";
            for await (const event of agentLoop(trimmed, history, {
                provider,
                model: cfg.model,
                apiKey: cfg.apiKey,
                cwd: process.cwd(),
                autoApprove: true,
                godmode: cfg.godmode,
                onShellProgress: (p) => {
                    if (p.type === "stdout" || p.type === "stderr") {
                        stopSpin();
                        process.stdout.write(theme.dim(p.data));
                    }
                },
            })) {
                if (event.type === "text") {
                    stopSpin();
                    ensureMd().push(event.content || "");
                    fullResponse += event.content || "";
                }
                else if (event.type === "tool_start") {
                    stopSpin();
                    closeMd();
                    const label = summarizeToolCall(event.tool || "", event.args);
                    process.stdout.write(`\n${theme.accent("⏺")} ${theme.label(event.tool || "tool")}${label ? ` ${theme.dim(label)}` : ""}\n`);
                }
                else if (event.type === "tool_end") {
                    const raw = event.result || "";
                    const isErr = /^\s*(error|tool error|unknown tool)/i.test(raw);
                    const lines = raw.split("\n").filter((l) => l.length).slice(0, 4);
                    const more = raw.split("\n").filter((l) => l.length).length - lines.length;
                    const mark = isErr ? theme.err("  ⎿ ✗") : theme.ok("  ⎿");
                    const body = lines.map((l) => theme.dim(`     ${l.slice(0, 100)}`)).join("\n");
                    process.stdout.write(`${mark}${body ? `\n${body}` : ""}`);
                    if (more > 0)
                        process.stdout.write(`\n${theme.dim(`     … +${more} lines`)}`);
                    process.stdout.write("\n");
                }
                else if (event.type === "permission") {
                    stopSpin();
                    process.stdout.write(theme.warn(`  🔐 Permission: ${event.content}\n`));
                }
                else if (event.type === "done") {
                    closeMd();
                }
            }
            stopSpin();
            closeMd();
            process.stdout.write("\n");
            if (fullResponse) {
                history.push({ role: "assistant", content: fullResponse });
            }
        }
        catch (e) {
            stopSpin();
            closeMd();
            console.error(theme.err(`\nError: ${e.message}\n`));
        }
    }
    rl.close();
}
// ======= RACE =======
export async function cmdRace(args) {
    const query = args.join(" ").trim();
    if (!query) {
        console.error(theme.err("Usage: arb race <your question>"));
        process.exit(1);
    }
    const cfg = ensureConfig();
    const provider = getProvider(cfg.provider);
    console.log(header("CRUCIBLE RACE"));
    const winner = await crucibleRace(provider, query, cfg.autoTune, cfg.stmEnabled, cfg.apiKey);
    console.log(theme.primaryBold(`\n🏆 Winner: ${winner.alias}`));
    console.log(divider());
    console.log(`\n${renderMarkdown(winner.content)}\n`);
}
// ======= SESSIONS =======
export async function cmdSessions(_args) {
    const sessions = loadSessions();
    if (sessions.length === 0) {
        console.log(theme.dim("No saved sessions."));
        return;
    }
    console.log(header("SAVED SESSIONS"));
    console.log();
    for (const s of sessions) {
        const date = new Date(s.updatedAt).toLocaleDateString();
        const time = new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        console.log(`  ${theme.primary("●")} ${theme.primaryBold(s.title)} ${theme.dim(`(${s.mode}, ${s.provider})`)}`);
        console.log(`    ${theme.dim(`${date} ${time} | ${s.messages.length} messages`)}`);
    }
    console.log();
}
// ======= EXPORT =======
export async function cmdExport() {
    exportData();
}
// ======= INTERACTIVE SHELL DISPATCH =======
// Shared slash-command handlers used by cmdChat. They return true when the
// loop should continue, false when it should break.
async function handleSlashCommand(input, ctx) {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/"))
        return "continue";
    const [cmd, ...rest] = trimmed.slice(1).split(/\s+/);
    const args = rest.join(" ");
    switch (cmd.toLowerCase()) {
        case "q":
        case "quit":
        case "exit":
            return "break";
        case "h":
        case "help":
            console.log(`
${theme.label("Slash commands")}
  ${theme.accent("/quit, /q")}                Exit
  ${theme.accent("/clear")}                  Clear conversation history
  ${theme.accent("/save [title]")}           Save conversation to a session
  ${theme.accent("/mode <mode>")}            Switch mode (${MODES.join(", ")})
  ${theme.accent("/provider")}               Show current provider and model
  ${theme.accent("/models")}                 List available models
  ${theme.accent("/model <id>")}             Set active model
  ${theme.accent("/providers")}              List supported providers
  ${theme.accent("/status")}                 Show current config and session status
  ${theme.accent("/usage")}                  Show estimated usage stats
  ${theme.accent("/sessions")}               List saved sessions
  ${theme.accent("/export")}                 Export sessions to JSON
  ${theme.accent("/godmode [on|off]")}       Toggle jailbreak/Godmode
  ${theme.accent("/config")}                 Run interactive configuration
`);
            return "handled";
        case "clear":
            ctx.history.length = 0;
            console.log(theme.dim("History cleared.\n"));
            return "handled";
        case "save": {
            const title = args || "Untitled Chat";
            const sess = {
                id: createSessionId(),
                title,
                messages: ctx.history.map((m) => ({ role: m.role, content: m.content })),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                mode: "agent",
                provider: ctx.cfg.provider,
                model: ctx.cfg.model,
            };
            const all = [sess, ...loadSessions()];
            saveSessions(all);
            console.log(theme.ok(`Session saved: ${title}\n`));
            return "handled";
        }
        case "mode": {
            const m = args.trim();
            if (MODES.includes(m)) {
                ctx.cfg.mode = m;
                saveConfig(ctx.cfg);
                console.log(theme.ok(`Mode switched to ${m}.\n`));
            }
            else {
                console.log(theme.err(`Invalid mode: ${m || "(none)"}. Use ${MODES.join(", ")}.\n`));
            }
            return "handled";
        }
        case "provider":
            console.log("  " + statusLine(ctx.providerName, ctx.cfg.model, ctx.cfg.mode) + "\n");
            return "handled";
        case "export":
            exportData();
            return "handled";
        case "models":
            await cmdModels([]);
            return "handled";
        case "model": {
            if (!args) {
                console.log(theme.err("Usage: /model <provider/model> or /model <model-id>\n"));
                return "handled";
            }
            await cmdModel([args]);
            // reload cfg so subsequent turns use the new model
            Object.assign(ctx.cfg, loadConfig());
            return "handled";
        }
        case "providers":
            await cmdProviders([]);
            return "handled";
        case "status":
            await cmdStatus([]);
            return "handled";
        case "usage":
            await cmdUsage([]);
            return "handled";
        case "sessions":
            await cmdSessions([]);
            return "handled";
        case "godmode": {
            const arg = args.toLowerCase();
            const newVal = arg === "on" || arg === "true" || arg === "1"
                ? true
                : arg === "off" || arg === "false" || arg === "0"
                    ? false
                    : !ctx.cfg.godmode;
            ctx.cfg.godmode = newVal;
            saveConfig(ctx.cfg);
            const status = ctx.cfg.godmode ? theme.ok("ON") : theme.dim("OFF");
            console.log(theme.ok(`Godmode is now ${status}\n`));
            return "handled";
        }
        case "config":
            await cmdConfig([]);
            Object.assign(ctx.cfg, loadConfig());
            return "handled";
        default:
            console.log(theme.err(`Unknown command: ${trimmed}. Type /help.\n`));
            return "handled";
    }
}
// ======= MODELS =======
export async function cmdModels(args) {
    const cfg = loadConfig();
    if (!cfg.provider) {
        console.error(theme.err("No provider configured. Run: arb config"));
        process.exit(1);
    }
    const spin = spinner(`Loading models for ${cfg.provider}...`);
    try {
        const models = await listAllModels({ provider: cfg.provider, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl });
        spin.stop();
        if (models.length === 0) {
            console.log(theme.dim("No models found."));
            return;
        }
        console.log(header("MODELS"));
        console.log(`  ${theme.dim("provider")} ${theme.accent(cfg.provider)}  ${theme.dim("configured")} ${theme.accent(cfg.model || "none")}\n`);
        for (const m of models.slice(0, 200)) {
            const marker = m.id === cfg.model ? theme.ok("✓ ") : "  ";
            console.log(`${marker}${theme.dim(m.provider + "/")}${theme.primary(m.id)}`);
            console.log(`    ${theme.dim(formatModel(m))}`);
        }
        console.log();
    }
    catch (e) {
        spin.stop();
        console.error(theme.err(`Error: ${e.message}`));
        process.exit(1);
    }
}
// ======= MODEL (quick set) =======
export async function cmdModel(args) {
    const modelId = args.join(" ").trim();
    if (!modelId) {
        console.error(theme.err("Usage: arb model <provider/model> or arb model <model-id>"));
        process.exit(1);
    }
    const cfg = loadConfig();
    const [maybeProvider, ...rest] = modelId.split("/");
    if (rest.length > 0 && ["openrouter", "ollama", "ollama-cloud"].includes(maybeProvider)) {
        cfg.provider = maybeProvider;
        cfg.model = rest.join("/");
    }
    else {
        cfg.model = modelId;
    }
    saveConfig(cfg);
    console.log(theme.ok(`Model set to ${cfg.provider}/${cfg.model}`));
}
// ======= PROVIDERS =======
export async function cmdProviders(_args) {
    console.log(header("PROVIDERS"));
    for (const p of listProviders()) {
        console.log(`  ${theme.primary(p.id.padEnd(16))} ${theme.dim(p.name)}`);
    }
    console.log();
}
// ======= STATUS =======
export async function cmdStatus(_args) {
    const cfg = loadConfig();
    const sessions = loadSessions();
    console.log(header("STATUS"));
    console.log(`  ${theme.dim("provider")}  ${theme.accent(cfg.provider)}`);
    console.log(`  ${theme.dim("model")}     ${theme.accent(cfg.model || "not set")}`);
    console.log(`  ${theme.dim("mode")}      ${theme.accent(cfg.mode)}`);
    console.log(`  ${theme.dim("godmode")}  ${cfg.godmode ? theme.ok("on") : theme.dim("off")}`);
    console.log(`  ${theme.dim("api key")}   ${cfg.apiKey ? theme.ok("set") : theme.err("not set")}`);
    console.log(`  ${theme.dim("sessions")} ${theme.accent(String(sessions.length))}`);
    console.log();
}
// ======= USAGE =======
export async function cmdUsage(_args) {
    const sessions = loadSessions();
    let prompts = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    for (const s of sessions) {
        for (const m of s.messages) {
            prompts++;
            const tokens = m.content.length / 4; // very rough heuristic
            if (m.role === "user")
                inputTokens += tokens;
            else if (m.role === "assistant")
                outputTokens += tokens;
        }
    }
    const estimatedCost = 0; // placeholder until real token tracking is added
    console.log(header("USAGE"));
    console.log(`  ${theme.dim("sessions")}       ${theme.accent(String(sessions.length))}`);
    console.log(`  ${theme.dim("messages")}      ${theme.accent(String(prompts))}`);
    console.log(`  ${theme.dim("input tokens")}  ${theme.accent(String(Math.round(inputTokens)))}`);
    console.log(`  ${theme.dim("output tokens")} ${theme.accent(String(Math.round(outputTokens)))}`);
    console.log(`  ${theme.dim("est. cost")}     ${theme.accent("\$" + estimatedCost.toFixed(4))}`);
    console.log();
}
// ======= GODMODE =======
export async function cmdGodmode(args) {
    const cfg = loadConfig();
    const arg = args[0]?.toLowerCase();
    if (arg === "on" || arg === "true" || arg === "1")
        cfg.godmode = true;
    else if (arg === "off" || arg === "false" || arg === "0")
        cfg.godmode = false;
    else
        cfg.godmode = !cfg.godmode;
    saveConfig(cfg);
    const status = cfg.godmode ? theme.ok("ON") : theme.dim("OFF");
    console.log(theme.ok(`Godmode is now ${status}`));
    if (cfg.godmode) {
        console.log(theme.dim("Jailbreak system prompts will be used for supported models."));
    }
}

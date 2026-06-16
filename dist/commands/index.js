import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { loadConfig, saveConfig, loadSessions, saveSessions, createSessionId, exportData } from "../utils/storage.js";
import { getProvider, listProviders } from "../providers/index.js";
import { standardChat, crucibleRace } from "../engine/core.js";
import { agentLoop } from "../agent/loop.js";
import { banner, divider, header, spinner, theme } from "../ui.js";
import { renderMarkdown, MarkdownStream } from "../markdown.js";
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
        const content = await standardChat(provider, messages, query, cfg.model, cfg.autoTune, cfg.stmEnabled, cfg.apiKey);
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
        if (trimmed === "/quit" || trimmed === "/q")
            break;
        if (trimmed === "/help" || trimmed === "/h") {
            console.log(`
${theme.label("Commands")}
  ${theme.accent("/quit, /q")}     Exit
  ${theme.accent("/clear")}        Clear conversation history
  ${theme.accent("/save [title]")} Save conversation to a session
  ${theme.accent("/mode <mode>")}  Switch mode (${MODES.join(", ")})
  ${theme.accent("/provider")}     Show current provider and model
  ${theme.accent("/export")}       Export sessions to JSON
`);
            continue;
        }
        if (trimmed === "/clear") {
            history.length = 0;
            console.log(theme.dim("History cleared.\n"));
            continue;
        }
        if (trimmed === "/export") {
            exportData();
            continue;
        }
        if (trimmed === "/provider") {
            console.log("  " + statusLine(provider.name, cfg.model, cfg.mode) + "\n");
            continue;
        }
        if (trimmed.startsWith("/mode")) {
            const m = trimmed.slice(5).trim();
            if (MODES.includes(m)) {
                cfg.mode = m;
                saveConfig(cfg);
                console.log(theme.ok(`Mode switched to ${m}.\n`));
            }
            else {
                console.log(theme.err(`Invalid mode: ${m || "(none)"}. Use ${MODES.join(", ")}.\n`));
            }
            continue;
        }
        if (trimmed.startsWith("/save")) {
            const title = trimmed.slice(5).trim() || "Untitled Chat";
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
            console.log(theme.ok(`Session saved: ${title}\n`));
            continue;
        }
        if (trimmed.startsWith("/")) {
            console.log(theme.err(`Unknown command: ${trimmed}. Type /help.\n`));
            continue;
        }
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

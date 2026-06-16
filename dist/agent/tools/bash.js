import { resolve } from "node:path";
import { createShellBridge, setShellProgressHandler } from "../shell-bridge.js";
// One persistent shell per agent session. OpenCode/Claude Code keep the shell
// alive so that state (cwd, env, git status, background jobs) persists across
// multiple tool calls. We lazily create a bridge keyed by cwd.
const BRIDGES = new Map();
function getBridge(cwd) {
    const existing = BRIDGES.get(cwd);
    if (existing)
        return existing;
    const bridge = createShellBridge({ cwd });
    BRIDGES.set(cwd, bridge);
    return bridge;
}
/** Optional hook for the agent UI to stream live shell output. */
export function setShellProgressCallback(handler) {
    setShellProgressHandler(handler
        ? (p) => {
            if (p.type === "stdout" || p.type === "stderr")
                handler(p);
        }
        : undefined);
}
export const bashTool = {
    name: "bash",
    description: "Executes a shell command in a persistent shell session. Use for git, npm, docker, file operations, etc. Commands run in the current working directory by default. Use the workdir parameter to change directory. Output is streamed live and state (env, cwd) persists across calls.",
    parameters: {
        command: { type: "string", description: "The command to execute", required: true },
        description: { type: "string", description: "Clear, concise description of what this command does in 5-10 words", required: true },
        timeout: { type: "number", description: "Optional timeout in milliseconds (default 120000)" },
        workdir: { type: "string", description: "Working directory. Defaults to current directory." },
    },
    async execute(args, ctx) {
        const command = args.command;
        const workdir = args.workdir ? resolve(ctx.cwd, args.workdir) : ctx.cwd;
        const timeout = args.timeout || 120000;
        const allowed = await ctx.ask("bash", command);
        if (allowed === "deny")
            return { content: "", error: "Bash command denied by user." };
        const bridge = getBridge(workdir);
        await bridge.start();
        try {
            return await bridge.run({
                command,
                description: args.description || undefined,
                timeout,
            });
        }
        catch (e) {
            return { content: "", error: `Shell error: ${e.message}` };
        }
    },
};
/** Terminate all persistent shell bridges. Useful on agent session exit. */
export function closeAllShellBridges() {
    for (const bridge of BRIDGES.values()) {
        bridge.stop();
    }
    BRIDGES.clear();
}

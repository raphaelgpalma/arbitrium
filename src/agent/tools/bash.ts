import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { ToolDef, ToolContext, ToolResult } from "../types.js";

export const bashTool: ToolDef = {
  name: "bash",
  description: "Executes a bash command in a persistent shell session. Use for git, npm, docker, file operations, etc. Commands run in the current working directory by default. Use the workdir parameter to change directory.",
  parameters: {
    command: { type: "string", description: "The command to execute", required: true },
    description: { type: "string", description: "Clear, concise description of what this command does in 5-10 words", required: true },
    timeout: { type: "number", description: "Optional timeout in milliseconds (default 120000)" },
    workdir: { type: "string", description: "Working directory. Defaults to current directory." },
  },
  async execute(args, ctx) {
    const command = args.command as string;
    const workdir = args.workdir ? resolve(ctx.cwd, args.workdir as string) : ctx.cwd;
    const timeout = (args.timeout as number) || 120000;

    const allowed = await ctx.ask("bash", command);
    if (allowed === "deny") return { content: "", error: "Bash command denied by user." };

    return new Promise((res) => {
      const child = spawn("bash", ["-c", command], {
        cwd: workdir,
        env: { ...process.env, HOME: process.env.HOME },
        timeout,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
        if (stdout.length > 50000) stdout = stdout.slice(-50000);
      });
      child.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
        if (stderr.length > 50000) stderr = stderr.slice(-50000);
      });

      child.on("close", (code) => {
        const out = stdout.trim() || "(no output)";
        const err = stderr.trim();
        const result = err ? `${out}\n\n[stderr]\n${err}` : out;
        res({
          title: `Bash: ${command.slice(0, 60)}`,
          content: `Exit code: ${code}\n\n${result}`,
        });
      });

      child.on("error", (e) => {
        res({ content: "", error: `Bash error: ${e.message}` });
      });
    });
  },
};

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
/**
 * Persistent shell bridge.
 *
 * OpenCode / Claude Code keep a long-lived shell (often a PTY) so that
 * `cd`, environment variables, background jobs, and interactive programs
 * persist across tool calls. Arbitrium implements the same idea using only
 * Node built-ins: a single `bash` child process stays alive for the lifetime
 * of the agent session, and commands are sent down its stdin delimited by a
 * marker. If `node-pty` happens to be installed, it is used automatically for
 * a true PTY experience.
 */
export class ShellBridge extends EventEmitter {
    child = null;
    pty = null;
    buffer = "";
    current = null;
    ready = false;
    startPromise = null;
    queue = [];
    marker;
    cwd;
    shell;
    env;
    constructor(options) {
        super();
        this.cwd = options.cwd;
        this.shell = options.shell || (process.platform === "win32" ? (process.env.COMSPEC || "cmd.exe") : "/bin/bash");
        this.env = { ...process.env, ...(options.env || {}) };
        this.marker = `__ARB_SHELL_EOF_${randomUUID().replace(/-/g, "")}__`;
    }
    async start() {
        if (this.startPromise)
            return this.startPromise;
        if (this.child || this.pty)
            return;
        this.startPromise = this.doStart();
        return this.startPromise;
    }
    async doStart() {
        // Try node-pty only if the user has installed it themselves.
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore node-pty is an optional peer dependency
            const mod = await import("node-pty");
            const pty = mod.spawn || mod.default?.spawn;
            if (pty) {
                this.pty = pty(this.shell, ["-i"], {
                    name: "xterm-256color",
                    cols: 120,
                    rows: 40,
                    cwd: this.cwd,
                    env: this.env,
                });
                this.pty.onData((data) => this.handleData(data));
                this.pty.onExit(({ exitCode }) => this.handleExit(exitCode));
                this.ready = true;
                return;
            }
        }
        catch {
            /* fall through to built-in spawn bridge */
        }
        const child = spawn(this.shell, ["--noprofile", "--norc"], {
            cwd: this.cwd,
            env: this.env,
            stdio: ["pipe", "pipe", "pipe"],
            detached: process.platform !== "win32",
        });
        this.child = child;
        child.stdout?.on("data", (d) => this.handleData(d.toString()));
        child.stderr?.on("data", (d) => this.handleData(d.toString()));
        child.on("error", (err) => this.handleError(err));
        child.on("close", (code) => this.handleExit(code ?? 1));
        await this.waitForReady();
        this.ready = true;
    }
    stop() {
        this.current?.timer && clearTimeout(this.current.timer);
        this.current = null;
        this.queue = [];
        if (this.pty) {
            try {
                this.pty.kill();
            }
            catch {
                /* ignore */
            }
            this.pty = null;
        }
        if (this.child) {
            try {
                if (!this.child.killed) {
                    if (process.platform !== "win32" && this.child.pid) {
                        try {
                            process.kill(-this.child.pid, "SIGTERM");
                        }
                        catch {
                            this.child.kill("SIGTERM");
                        }
                    }
                    else {
                        this.child.kill("SIGTERM");
                    }
                }
            }
            catch {
                /* ignore */
            }
            this.child = null;
        }
    }
    get isReady() {
        return this.ready;
    }
    waitForReady() {
        return new Promise((res) => {
            const check = () => {
                if (this.child?.stdin?.writable) {
                    res();
                    return;
                }
                setTimeout(check, 20);
            };
            check();
        });
    }
    /**
     * Run one command in the persistent shell. Returns a promise that resolves
     * when the marker following the command is observed. Streams partial stdout/
     * stderr through the `progress` callback.
     */
    async run(cmd, onProgress) {
        await this.start();
        return this.runInternal(cmd, onProgress);
    }
    runInternal(cmd, onProgress) {
        return new Promise((resolve, reject) => {
            const id = randomUUID();
            const timeout = cmd.timeout ?? 120_000;
            const item = { id, command: cmd.command, description: cmd.description, timeout };
            const start = () => {
                const timer = setTimeout(() => {
                    this.current?.reject(new Error(`Timed out after ${timeout} ms`));
                    this.current = null;
                    this.dequeue();
                }, timeout);
                this.current = {
                    id,
                    description: cmd.description,
                    resolve: (value) => {
                        timer && clearTimeout(timer);
                        resolve(value);
                    },
                    reject: (reason) => {
                        timer && clearTimeout(timer);
                        reject(reason);
                    },
                    stdout: "",
                    stderr: "",
                    timeout,
                    timer,
                    startTime: Date.now(),
                };
                // Wrap each command in a small runner that emits the marker and the
                // exit code. This works with plain non-interactive bash without needing
                // a PTY or PROMPT_COMMAND.
                const wrapped = this.wrapCommand(cmd.command);
                if (this.pty) {
                    this.pty.write(`${wrapped}\r`);
                }
                else {
                    this.child?.stdin?.write(`${wrapped}\n`);
                }
            };
            if (this.current) {
                this.queue.push(item);
                return;
            }
            start();
        });
    }
    normalizeCommand(command) {
        // Trim trailing newlines so the marker pattern is clean.
        return command.replace(/\n+$/, "");
    }
    wrapCommand(command) {
        const clean = this.normalizeCommand(command)
            .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f]/g, "");
        // Run the command directly in the persistent shell (no subshell) so that
        // environment variables, cd, and other state mutations persist across calls.
        // A trailing marker printf reads $? from the same shell process.
        return `${clean}; printf '\\n${this.marker}\\nexit_code=%d\\n' $?`;
    }
    handleData(chunk) {
        this.buffer += chunk;
        // Continuously scan the buffer so that commands that emit data in multiple
        // chunks are still recognized as soon as the marker appears.
        while (this.current) {
            const markerIdx = this.buffer.indexOf(`\n${this.marker}\n`);
            if (markerIdx === -1)
                break;
            const before = this.buffer.slice(0, markerIdx);
            this.buffer = this.buffer.slice(markerIdx + this.marker.length + 2);
            // The line after the marker is "exit_code=...".
            const newline = this.buffer.indexOf("\n");
            const exitLine = newline === -1 ? this.buffer : this.buffer.slice(0, newline);
            if (newline !== -1)
                this.buffer = this.buffer.slice(newline + 1);
            else
                this.buffer = "";
            const exitCodeMatch = exitLine.match(/exit_code=(-?\d+)/);
            const exitCode = exitCodeMatch ? Number(exitCodeMatch[1]) : 0;
            this.finishCurrent(before, exitCode);
            // finishCurrent clears this.current, so the loop naturally exits.
            return;
        }
        // Also handle the case where the marker is the very first thing in the
        // buffer (no leading newline) while we are waiting.
        while (this.current) {
            const markerIdx = this.buffer.indexOf(`${this.marker}\n`);
            if (markerIdx !== 0)
                break;
            this.buffer = this.buffer.slice(this.marker.length + 1);
            const newline = this.buffer.indexOf("\n");
            const exitLine = newline === -1 ? this.buffer : this.buffer.slice(0, newline);
            if (newline !== -1)
                this.buffer = this.buffer.slice(newline + 1);
            else
                this.buffer = "";
            const exitCodeMatch = exitLine.match(/exit_code=(-?\d+)/);
            const exitCode = exitCodeMatch ? Number(exitCodeMatch[1]) : 0;
            this.finishCurrent("", exitCode);
            return;
        }
        // If we haven't seen a marker yet, stream whatever we can to progress.
        if (this.current && onProgressGlobal) {
            onProgressGlobal({ type: "stdout", data: chunk });
        }
    }
    handleExit(code) {
        if (this.current) {
            this.current.reject(new Error(`Shell exited with code ${code}`));
            this.current = null;
        }
        this.emit("exit", code);
    }
    handleError(err) {
        if (this.current) {
            this.current.reject(err);
            this.current = null;
        }
    }
    finishCurrent(output, exitCode) {
        const cur = this.current;
        if (!cur)
            return;
        const duration = Date.now() - cur.startTime;
        let stripped = this.stripControlCodes(output);
        stripped = this.stripBashNoise(stripped);
        stripped = stripped.trim();
        const result = stripped || "(no output)";
        const content = `Exit code: ${exitCode}\nDuration: ${duration}ms\n\n${result}`;
        cur.resolve({
            title: cur.description || `Shell: ${cur.id.slice(0, 8)}`,
            content,
            error: exitCode !== 0 ? `Command exited with code ${exitCode}` : undefined,
        });
        this.current = null;
        this.dequeue();
    }
    dequeue() {
        if (this.queue.length === 0)
            return;
        const next = this.queue.shift();
        if (!next)
            return;
        // Re-enter run() logic for the next queued command.
        this.runInternal({ command: next.command, description: next.description, timeout: next.timeout });
    }
    stripControlCodes(str) {
        // Remove ANSI escape sequences and carriage returns for cleaner model output.
        return str
            .replace(/\r\n/g, "\n")
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
            .replace(/\x1b\][^\x07]*\x07/g, "")
            .replace(/\x07/g, "");
    }
    stripBashNoise(str) {
        // Bash non-interactive startup can emit warnings; strip them for clean
        // model output. The marker setup noise is already flushed by the init
        // command, so this is just defensive.
        return str
            .replace(/^bash: cannot set terminal process group \(.*?\): Inappropriate ioctl for device\n?/gm, "")
            .replace(/^bash: no job control in this shell\n?/gm, "")
            .replace(/^bash-[\d.]+\$\s*/gm, "");
    }
}
let onProgressGlobal;
export function setShellProgressHandler(handler) {
    onProgressGlobal = handler;
}
export function createShellBridge(options) {
    const bridge = new ShellBridge(options);
    bridge.start().catch(() => {
        /* starting is best-effort; individual run() calls will surface errors */
    });
    return bridge;
}
